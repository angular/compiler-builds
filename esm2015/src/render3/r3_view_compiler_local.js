/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { flatten, identifierName, sanitizeIdentifier, tokenReference } from '../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding } from '../compiler_util/expression_converter';
import * as core from '../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, LiteralPrimitive, PropertyRead } from '../expression_parser/ast';
import { Identifiers } from '../identifiers';
import { LifecycleHooks } from '../lifecycle_reflector';
import * as o from '../output/output_ast';
import { typeSourceSpan } from '../parse_util';
import { CssSelector, SelectorMatcher } from '../selector';
import { error } from '../util';
import * as t from './r3_ast';
import { Identifiers as R3 } from './r3_identifiers';
/**
 * Name of the context parameter passed into a template function
 */
const /** @type {?} */ CONTEXT_NAME = 'ctx';
/**
 * Name of the RenderFlag passed into a template function
 */
const /** @type {?} */ RENDER_FLAGS = 'rf';
/**
 * Name of the temporary to use during data binding
 */
const /** @type {?} */ TEMPORARY_NAME = '_t';
/**
 * The prefix reference variables
 */
const /** @type {?} */ REFERENCE_PREFIX = '_r';
/**
 * The name of the implicit context reference
 */
const /** @type {?} */ IMPLICIT_REFERENCE = '$implicit';
/**
 * Name of the i18n attributes *
 */
const /** @type {?} */ I18N_ATTR = 'i18n';
const /** @type {?} */ I18N_ATTR_PREFIX = 'i18n-';
/**
 * I18n separators for metadata *
 */
const /** @type {?} */ MEANING_SEPARATOR = '|';
const /** @type {?} */ ID_SEPARATOR = '@@';
/**
 * @param {?} outputCtx
 * @param {?} directive
 * @param {?} reflector
 * @param {?} bindingParser
 * @return {?}
 */
export function compileDirective(outputCtx, directive, reflector, bindingParser) {
    const /** @type {?} */ definitionMapValues = [];
    const /** @type {?} */ field = (key, value) => {
        if (value) {
            definitionMapValues.push({ key, value, quoted: false });
        }
    };
    // e.g. `type: MyDirective`
    field('type', outputCtx.importExpr(directive.type.reference));
    // e.g. `selectors: [['', 'someDir', '']]`
    field('selectors', createDirectiveSelector(/** @type {?} */ ((directive.selector))));
    // e.g. `factory: () => new MyApp(injectElementRef())`
    field('factory', createFactory(directive.type, outputCtx, reflector, directive.queries));
    // e.g. `hostBindings: (dirIndex, elIndex) => { ... }
    field('hostBindings', createHostBindingsFunction(directive, outputCtx, bindingParser));
    // e.g. `attributes: ['role', 'listbox']`
    field('attributes', createHostAttributesArray(directive, outputCtx));
    // e.g 'inputs: {a: 'a'}`
    field('inputs', conditionallyCreateMapObjectLiteral(directive.inputs));
    // e.g 'outputs: {a: 'a'}`
    field('outputs', conditionallyCreateMapObjectLiteral(directive.outputs));
    const /** @type {?} */ className = /** @type {?} */ ((identifierName(directive.type)));
    className || error(`Cannot resolver the name of ${directive.type}`);
    const /** @type {?} */ definitionField = outputCtx.constantPool.propertyNameOf(1 /* Directive */);
    const /** @type {?} */ definitionFunction = o.importExpr(R3.defineDirective).callFn([o.literalMap(definitionMapValues)]);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(new o.ClassStmt(className, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], definitionFunction)], [], new o.ClassMethod(null, [], []), []));
}
/**
 * @param {?} outputCtx
 * @param {?} component
 * @param {?} nodes
 * @param {?} hasNgContent
 * @param {?} ngContentSelectors
 * @param {?} reflector
 * @param {?} bindingParser
 * @param {?} directiveTypeBySel
 * @param {?} pipeTypeByName
 * @return {?}
 */
export function compileComponent(outputCtx, component, nodes, hasNgContent, ngContentSelectors, reflector, bindingParser, directiveTypeBySel, pipeTypeByName) {
    const /** @type {?} */ definitionMapValues = [];
    const /** @type {?} */ field = (key, value) => {
        if (value) {
            definitionMapValues.push({ key, value, quoted: false });
        }
    };
    // Generate the CSS matcher that recognize directive
    let /** @type {?} */ directiveMatcher = null;
    if (directiveTypeBySel.size) {
        const /** @type {?} */ matcher = new SelectorMatcher();
        directiveTypeBySel.forEach((staticType, selector) => {
            matcher.addSelectables(CssSelector.parse(selector), staticType);
        });
        directiveMatcher = matcher;
    }
    // Directives and Pipes used from the template
    const /** @type {?} */ directives = new Set();
    const /** @type {?} */ pipes = new Set();
    // e.g. `type: MyApp`
    field('type', outputCtx.importExpr(component.type.reference));
    // e.g. `selectors: [['my-app']]`
    field('selectors', createDirectiveSelector(/** @type {?} */ ((component.selector))));
    const /** @type {?} */ selector = component.selector && CssSelector.parse(component.selector);
    const /** @type {?} */ firstSelector = selector && selector[0];
    // e.g. `attr: ["class", ".my.app"]`
    // This is optional an only included if the first selector of a component specifies attributes.
    if (firstSelector) {
        const /** @type {?} */ selectorAttributes = firstSelector.getAttrs();
        if (selectorAttributes.length) {
            field('attrs', outputCtx.constantPool.getConstLiteral(o.literalArr(selectorAttributes.map(value => value != null ? o.literal(value) : o.literal(undefined))), /* forceShared */ true));
        }
    }
    // e.g. `factory: function MyApp_Factory() { return new MyApp(injectElementRef()); }`
    field('factory', createFactory(component.type, outputCtx, reflector, component.queries));
    // e.g `hostBindings: function MyApp_HostBindings { ... }
    field('hostBindings', createHostBindingsFunction(component, outputCtx, bindingParser));
    // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
    const /** @type {?} */ templateTypeName = component.type.reference.name;
    const /** @type {?} */ templateName = templateTypeName ? `${templateTypeName}_Template` : null;
    const /** @type {?} */ templateFunctionExpression = new TemplateDefinitionBuilder(outputCtx, outputCtx.constantPool, reflector, CONTEXT_NAME, BindingScope.ROOT_SCOPE, 0, templateTypeName, templateName, component.viewQueries, directiveMatcher, directives, pipeTypeByName, pipes)
        .buildTemplateFunction(nodes, [], hasNgContent, ngContentSelectors);
    field('template', templateFunctionExpression);
    // e.g. `directives: [MyDirective]`
    if (directives.size) {
        const /** @type {?} */ expressions = Array.from(directives).map(d => outputCtx.importExpr(d));
        field('directives', o.literalArr(expressions));
    }
    // e.g. `pipes: [MyPipe]`
    if (pipes.size) {
        const /** @type {?} */ expressions = Array.from(pipes).map(d => outputCtx.importExpr(d));
        field('pipes', o.literalArr(expressions));
    }
    // e.g `inputs: {a: 'a'}`
    field('inputs', conditionallyCreateMapObjectLiteral(component.inputs));
    // e.g 'outputs: {a: 'a'}`
    field('outputs', conditionallyCreateMapObjectLiteral(component.outputs));
    // e.g. `features: [NgOnChangesFeature(MyComponent)]`
    const /** @type {?} */ features = [];
    if (component.type.lifecycleHooks.some(lifecycle => lifecycle == LifecycleHooks.OnChanges)) {
        features.push(o.importExpr(R3.NgOnChangesFeature, null, null).callFn([outputCtx.importExpr(component.type.reference)]));
    }
    if (features.length) {
        field('features', o.literalArr(features));
    }
    const /** @type {?} */ definitionField = outputCtx.constantPool.propertyNameOf(2 /* Component */);
    const /** @type {?} */ definitionFunction = o.importExpr(R3.defineComponent).callFn([o.literalMap(definitionMapValues)]);
    const /** @type {?} */ className = /** @type {?} */ ((identifierName(component.type)));
    className || error(`Cannot resolver the name of ${component.type}`);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(new o.ClassStmt(className, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], definitionFunction)], [], new o.ClassMethod(null, [], []), []));
}
/**
 * @param {?} feature
 * @return {?}
 */
function unsupported(feature) {
    if (this) {
        throw new Error(`Builder ${this.constructor.name} doesn't support ${feature} yet`);
    }
    throw new Error(`Feature ${feature} is not supported yet`);
}
const /** @type {?} */ BINDING_INSTRUCTION_MAP = {
    [0 /* Property */]: R3.elementProperty,
    [1 /* Attribute */]: R3.elementAttribute,
    [2 /* Class */]: R3.elementClassNamed,
    [3 /* Style */]: R3.elementStyleNamed,
};
/**
 * @param {?} args
 * @return {?}
 */
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
// Pipes always have at least one parameter, the value they operate on
const /** @type {?} */ pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
/**
 * @param {?} args
 * @return {?}
 */
function pipeBinding(args) {
    return pipeBindingIdentifiers[args.length] || R3.pipeBindV;
}
const /** @type {?} */ pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
/**
 * @param {?} outputContext
 * @param {?} literal
 * @return {?}
 */
function getLiteralFactory(outputContext, literal) {
    const { literalFactory, literalFactoryArguments } = outputContext.constantPool.getLiteralFactory(literal);
    literalFactoryArguments.length > 0 || error(`Expected arguments to a literal factory function`);
    let /** @type {?} */ pureFunctionIdent = pureFunctionIdentifiers[literalFactoryArguments.length] || R3.pureFunctionV;
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    return o.importExpr(pureFunctionIdent).callFn([literalFactory, ...literalFactoryArguments]);
}
/**
 * @return {?}
 */
function noop() { }
class BindingScope {
    /**
     * @param {?=} parent
     * @param {?=} declareLocalVarCallback
     */
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
    /**
     * @param {?} name
     * @return {?}
     */
    get(name) {
        let /** @type {?} */ current = this;
        while (current) {
            let /** @type {?} */ value = current.map.get(name);
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
     * @param {?} name Name of the variable.
     * @param {?} lhs AST representing the left hand side of the `let lhs = rhs;`.
     * @param {?=} rhs AST representing the right hand side of the `let lhs = rhs;`. The `rhs` can be
     * `undefined` for variable that are ambient such as `$event` and which don't have `rhs`
     * declaration.
     * @return {?}
     */
    set(name, lhs, rhs) {
        !this.map.has(name) ||
            error(`The name ${name} is already defined in scope to be ${this.map.get(name)}`);
        this.map.set(name, { lhs: lhs, rhs: rhs, declared: false });
        return this;
    }
    /**
     * @param {?} name
     * @return {?}
     */
    getLocal(name) { return this.get(name); }
    /**
     * @param {?} declareCallback
     * @return {?}
     */
    nestedScope(declareCallback) {
        return new BindingScope(this, declareCallback);
    }
    /**
     * @return {?}
     */
    freshReferenceName() {
        let /** @type {?} */ current = this;
        // Find the top scope as it maintains the global reference count
        while (current.parent)
            current = current.parent;
        const /** @type {?} */ ref = `${REFERENCE_PREFIX}${current.referenceNameIndex++}`;
        return ref;
    }
}
BindingScope.ROOT_SCOPE = new BindingScope().set('$event', o.variable('$event'));
function BindingScope_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingScope.ROOT_SCOPE;
    /**
     * Keeps a map from local variables to their expressions.
     *
     * This is used when one refers to variable such as: 'let abc = a.b.c`.
     * - key to the map is the string literal `"abc"`.
     * - value `lhs` is the left hand side which is an AST representing `abc`.
     * - value `rhs` is the right hand side which is an AST representing `a.b.c`.
     * - value `declared` is true if the `declareLocalVarCallback` has been called for this scope
     * already.
     * @type {?}
     */
    BindingScope.prototype.map;
    /** @type {?} */
    BindingScope.prototype.referenceNameIndex;
    /** @type {?} */
    BindingScope.prototype.parent;
    /** @type {?} */
    BindingScope.prototype.declareLocalVarCallback;
}
/** @enum {number} */
const RenderFlags = {
    /* Whether to run the creation block (e.g. create elements and directives) */
    Create: 1,
    /* Whether to run the update block (e.g. refresh bindings) */
    Update: 2,
};
export { RenderFlags };
class TemplateDefinitionBuilder {
    /**
     * @param {?} outputCtx
     * @param {?} constantPool
     * @param {?} reflector
     * @param {?} contextParameter
     * @param {?} parentBindingScope
     * @param {?=} level
     * @param {?=} contextName
     * @param {?=} templateName
     * @param {?=} viewQueries
     * @param {?=} directiveMatcher
     * @param {?=} directives
     * @param {?=} pipeTypeByName
     * @param {?=} pipes
     */
    constructor(outputCtx, constantPool, reflector, contextParameter, parentBindingScope, level = 0, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes) {
        this.outputCtx = outputCtx;
        this.constantPool = constantPool;
        this.reflector = reflector;
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
        this._inI18nSection = false;
        this._i18nSectionIndex = -1;
        this._phToNodeIdxes = [{}];
        // These should be handled in the template or element directly.
        this.visitReference = invalid;
        this.visitVariable = invalid;
        this.visitAttribute = invalid;
        this.visitBoundAttribute = invalid;
        this.visitBoundEvent = invalid;
        this._bindingScope =
            parentBindingScope.nestedScope((lhsVar, expression) => {
                this._bindingCode.push(lhsVar.set(expression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
        this._valueConverter = new ValueConverter(outputCtx, () => this.allocateDataSlot(), (name, localName, slot, value) => {
            const /** @type {?} */ pipeType = pipeTypeByName.get(name);
            if (pipeType) {
                this.pipes.add(pipeType);
            }
            this._bindingScope.set(localName, value);
            this._creationCode.push(o.importExpr(R3.pipe).callFn([o.literal(slot), o.literal(name)]).toStmt());
        });
    }
    /**
     * @param {?} nodes
     * @param {?} variables
     * @param {?=} hasNgContent
     * @param {?=} ngContentSelectors
     * @return {?}
     */
    buildTemplateFunction(nodes, variables, hasNgContent = false, ngContentSelectors = []) {
        // Create variable bindings
        for (const /** @type {?} */ variable of variables) {
            const /** @type {?} */ variableName = variable.name;
            const /** @type {?} */ expression = o.variable(this.contextParameter).prop(variable.value || IMPLICIT_REFERENCE);
            const /** @type {?} */ scopedName = this._bindingScope.freshReferenceName();
            // Add the reference to the local scope.
            this._bindingScope.set(variableName, o.variable(variableName + scopedName), expression);
        }
        // Output a `ProjectionDef` instruction when some `<ng-content>` are present
        if (hasNgContent) {
            this._projectionDefinitionIndex = this.allocateDataSlot();
            const /** @type {?} */ parameters = [o.literal(this._projectionDefinitionIndex)];
            // Only selectors with a non-default value are generated
            if (ngContentSelectors.length > 1) {
                const /** @type {?} */ r3Selectors = ngContentSelectors.map(s => core.parseSelectorToR3Selector(s));
                // `projectionDef` needs both the parsed and raw value of the selectors
                const /** @type {?} */ parsed = this.outputCtx.constantPool.getConstLiteral(asLiteral(r3Selectors), true);
                const /** @type {?} */ unParsed = this.outputCtx.constantPool.getConstLiteral(asLiteral(ngContentSelectors), true);
                parameters.push(parsed, unParsed);
            }
            this.instruction(this._creationCode, null, R3.projectionDef, ...parameters);
        }
        // Define and update any view queries
        for (let /** @type {?} */ query of this.viewQueries) {
            // e.g. r3.Q(0, somePredicate, true);
            const /** @type {?} */ querySlot = this.allocateDataSlot();
            const /** @type {?} */ predicate = getQueryPredicate(query, this.outputCtx);
            const /** @type {?} */ args = [
                o.literal(querySlot, o.INFERRED_TYPE),
                predicate,
                o.literal(query.descendants, o.INFERRED_TYPE),
            ];
            if (query.read) {
                args.push(this.outputCtx.importExpr(/** @type {?} */ ((query.read.identifier)).reference));
            }
            this.instruction(this._creationCode, null, R3.query, ...args);
            // (r3.qR(tmp = r3.ɵld(0)) && (ctx.someDir = tmp));
            const /** @type {?} */ temporary = this._temporary();
            const /** @type {?} */ getQueryList = o.importExpr(R3.load).callFn([o.literal(querySlot)]);
            const /** @type {?} */ refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
            const /** @type {?} */ updateDirective = o.variable(CONTEXT_NAME)
                .prop(query.propertyName)
                .set(query.first ? temporary.prop('first') : temporary);
            this._bindingCode.push(refresh.and(updateDirective).toStmt());
        }
        t.visitAll(this, nodes);
        const /** @type {?} */ creationCode = this._creationCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(1 /* Create */), null, false), this._creationCode)] :
            [];
        const /** @type {?} */ updateCode = this._bindingCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(2 /* Update */), null, false), this._bindingCode)] :
            [];
        // Generate maps of placeholder name to node indexes
        // TODO(vicb): This is a WIP, not fully supported yet
        for (const /** @type {?} */ phToNodeIdx of this._phToNodeIdxes) {
            if (Object.keys(phToNodeIdx).length > 0) {
                const /** @type {?} */ scopedName = this._bindingScope.freshReferenceName();
                const /** @type {?} */ phMap = o.variable(scopedName)
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
    /**
     * @param {?} name
     * @return {?}
     */
    getLocal(name) { return this._bindingScope.get(name); }
    /**
     * @param {?} ngContent
     * @return {?}
     */
    visitContent(ngContent) {
        const /** @type {?} */ slot = this.allocateDataSlot();
        const /** @type {?} */ selectorIndex = ngContent.selectorIndex;
        const /** @type {?} */ parameters = [
            o.literal(slot),
            o.literal(this._projectionDefinitionIndex),
        ];
        const /** @type {?} */ attributeAsList = [];
        ngContent.attributes.forEach((attribute) => {
            const /** @type {?} */ name = attribute.name;
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
    /**
     * @param {?} element
     * @return {?}
     */
    visitElement(element) {
        const /** @type {?} */ elementIndex = this.allocateDataSlot();
        const /** @type {?} */ referenceDataSlots = new Map();
        const /** @type {?} */ wasInI18nSection = this._inI18nSection;
        const /** @type {?} */ outputAttrs = {};
        const /** @type {?} */ attrI18nMetas = {};
        let /** @type {?} */ i18nMeta = '';
        // Elements inside i18n sections are replaced with placeholders
        // TODO(vicb): nested elements are a WIP in this phase
        if (this._inI18nSection) {
            const /** @type {?} */ phName = element.name.toLowerCase();
            if (!this._phToNodeIdxes[this._i18nSectionIndex][phName]) {
                this._phToNodeIdxes[this._i18nSectionIndex][phName] = [];
            }
            this._phToNodeIdxes[this._i18nSectionIndex][phName].push(elementIndex);
        }
        // Handle i18n attributes
        for (const /** @type {?} */ attr of element.attributes) {
            const /** @type {?} */ name = attr.name;
            const /** @type {?} */ value = attr.value;
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
            const /** @type {?} */ selector = createCssSelector(element.name, outputAttrs);
            this.directiveMatcher.match(selector, (sel, staticType) => { this.directives.add(staticType); });
        }
        // Element creation mode
        const /** @type {?} */ parameters = [
            o.literal(elementIndex),
            o.literal(element.name),
        ];
        // Add the attributes
        const /** @type {?} */ i18nMessages = [];
        const /** @type {?} */ attributes = [];
        let /** @type {?} */ hasI18nAttr = false;
        Object.getOwnPropertyNames(outputAttrs).forEach(name => {
            const /** @type {?} */ value = outputAttrs[name];
            attributes.push(o.literal(name));
            if (attrI18nMetas.hasOwnProperty(name)) {
                hasI18nAttr = true;
                const /** @type {?} */ meta = parseI18nMeta(attrI18nMetas[name]);
                const /** @type {?} */ variable = this.constantPool.getTranslation(value, meta);
                attributes.push(variable);
            }
            else {
                attributes.push(o.literal(value));
            }
        });
        let /** @type {?} */ attrArg = o.TYPED_NULL_EXPR;
        if (attributes.length > 0) {
            attrArg = hasI18nAttr ? getLiteralFactory(this.outputCtx, o.literalArr(attributes)) :
                this.constantPool.getConstLiteral(o.literalArr(attributes), true);
        }
        parameters.push(attrArg);
        if (element.references && element.references.length > 0) {
            const /** @type {?} */ references = flatten(element.references.map(reference => {
                const /** @type {?} */ slot = this.allocateDataSlot();
                referenceDataSlots.set(reference.name, slot);
                // Generate the update temporary.
                const /** @type {?} */ variableName = this._bindingScope.freshReferenceName();
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
        const /** @type {?} */ implicit = o.variable(CONTEXT_NAME);
        // Generate Listeners (outputs)
        element.outputs.forEach((outputAst) => {
            const /** @type {?} */ elName = sanitizeIdentifier(element.name);
            const /** @type {?} */ evName = sanitizeIdentifier(outputAst.name);
            const /** @type {?} */ functionName = `${this.templateName}_${elName}_${evName}_listener`;
            const /** @type {?} */ localVars = [];
            const /** @type {?} */ bindingScope = this._bindingScope.nestedScope((lhsVar, rhsExpression) => {
                localVars.push(lhsVar.set(rhsExpression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
            const /** @type {?} */ bindingExpr = convertActionBinding(bindingScope, implicit, outputAst.handler, 'b', () => error('Unexpected interpolation'));
            const /** @type {?} */ handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], [...localVars, ...bindingExpr.render3Stmts], o.INFERRED_TYPE, null, functionName);
            this.instruction(this._creationCode, outputAst.sourceSpan, R3.listener, o.literal(outputAst.name), handler);
        });
        // Generate element input bindings
        element.inputs.forEach((input) => {
            if (input.type === 4 /* Animation */) {
                this._unsupported('animations');
            }
            const /** @type {?} */ convertedBinding = this.convertPropertyBinding(implicit, input.value);
            const /** @type {?} */ instruction = BINDING_INSTRUCTION_MAP[input.type];
            if (instruction) {
                // TODO(chuckj): runtime: security context?
                const /** @type {?} */ value = o.importExpr(R3.bind).callFn([convertedBinding]);
                this.instruction(this._bindingCode, input.sourceSpan, instruction, o.literal(elementIndex), o.literal(input.name), value);
            }
            else {
                this._unsupported(`binding type ${input.type}`);
            }
        });
        // Traverse element child nodes
        if (this._inI18nSection && element.children.length == 1 &&
            element.children[0] instanceof t.Text) {
            const /** @type {?} */ text = /** @type {?} */ (element.children[0]);
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
    /**
     * @param {?} template
     * @return {?}
     */
    visitTemplate(template) {
        const /** @type {?} */ templateIndex = this.allocateDataSlot();
        let /** @type {?} */ elName = '';
        if (template.children.length === 1 && template.children[0] instanceof t.Element) {
            // When the template as a single child, derive the context name from the tag
            elName = sanitizeIdentifier((/** @type {?} */ (template.children[0])).name);
        }
        const /** @type {?} */ contextName = elName ? `${this.contextName}_${elName}` : '';
        const /** @type {?} */ templateName = contextName ? `${contextName}_Template_${templateIndex}` : `Template_${templateIndex}`;
        const /** @type {?} */ templateContext = `ctx${this.level}`;
        const /** @type {?} */ parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            o.TYPED_NULL_EXPR,
        ];
        const /** @type {?} */ attributeNames = [];
        const /** @type {?} */ attributeMap = {};
        template.attributes.forEach(a => {
            attributeNames.push(asLiteral(a.name), asLiteral(''));
            attributeMap[a.name] = a.value;
        });
        // Match directives on template attributes
        if (this.directiveMatcher) {
            const /** @type {?} */ selector = createCssSelector('ng-template', attributeMap);
            this.directiveMatcher.match(selector, (cssSelector, staticType) => { this.directives.add(staticType); });
        }
        if (attributeNames.length) {
            parameters.push(this.constantPool.getConstLiteral(o.literalArr(attributeNames), true));
        }
        // e.g. C(1, C1Template)
        this.instruction(this._creationCode, template.sourceSpan, R3.containerCreate, ...trimTrailingNulls(parameters));
        // e.g. p(1, 'forOf', ɵb(ctx.items));
        const /** @type {?} */ context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(input => {
            const /** @type {?} */ convertedBinding = this.convertPropertyBinding(context, input.value);
            this.instruction(this._bindingCode, template.sourceSpan, R3.elementProperty, o.literal(templateIndex), o.literal(input.name), o.importExpr(R3.bind).callFn([convertedBinding]));
        });
        // Create the template function
        const /** @type {?} */ templateVisitor = new TemplateDefinitionBuilder(this.outputCtx, this.constantPool, this.reflector, templateContext, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes);
        const /** @type {?} */ templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
        this._postfixCode.push(templateFunctionExpr.toDeclStmt(templateName, null));
    }
    /**
     * @param {?} text
     * @return {?}
     */
    visitBoundText(text) {
        const /** @type {?} */ nodeIndex = this.allocateDataSlot();
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(nodeIndex));
        this.instruction(this._bindingCode, text.sourceSpan, R3.textCreateBound, o.literal(nodeIndex), this.convertPropertyBinding(o.variable(CONTEXT_NAME), text.value));
    }
    /**
     * @param {?} text
     * @return {?}
     */
    visitText(text) {
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), o.literal(text.value));
    }
    /**
     * @param {?} text
     * @param {?} i18nMeta
     * @return {?}
     */
    visitSingleI18nTextChild(text, i18nMeta) {
        const /** @type {?} */ meta = parseI18nMeta(i18nMeta);
        const /** @type {?} */ variable = this.constantPool.getTranslation(text.value, meta);
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), variable);
    }
    /**
     * @return {?}
     */
    allocateDataSlot() { return this._dataIndex++; }
    /**
     * @return {?}
     */
    bindingContext() { return `${this._bindingContext++}`; }
    /**
     * @param {?} statements
     * @param {?} span
     * @param {?} reference
     * @param {...?} params
     * @return {?}
     */
    instruction(statements, span, reference, ...params) {
        statements.push(o.importExpr(reference, null, span).callFn(params, span).toStmt());
    }
    /**
     * @param {?} implicit
     * @param {?} value
     * @return {?}
     */
    convertPropertyBinding(implicit, value) {
        const /** @type {?} */ pipesConvertedValue = value.visit(this._valueConverter);
        const /** @type {?} */ convertedPropertyBinding = convertPropertyBinding(this, implicit, pipesConvertedValue, this.bindingContext(), BindingForm.TrySimple, interpolate);
        this._bindingCode.push(...convertedPropertyBinding.stmts);
        return convertedPropertyBinding.currValExpr;
    }
}
function TemplateDefinitionBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._dataIndex;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._bindingContext;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._prefixCode;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._creationCode;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._variableCode;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._bindingCode;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._postfixCode;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._temporary;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._projectionDefinitionIndex;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._valueConverter;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._unsupported;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._bindingScope;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._inI18nSection;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._i18nSectionIndex;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype._phToNodeIdxes;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.visitReference;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.visitVariable;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.visitAttribute;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.visitBoundAttribute;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.visitBoundEvent;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.outputCtx;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.constantPool;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.reflector;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.contextParameter;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.level;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.contextName;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.templateName;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.viewQueries;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.directiveMatcher;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.directives;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.pipeTypeByName;
    /** @type {?} */
    TemplateDefinitionBuilder.prototype.pipes;
}
/**
 * @param {?} query
 * @param {?} outputCtx
 * @return {?}
 */
function getQueryPredicate(query, outputCtx) {
    if (query.selectors.length > 1 || (query.selectors.length == 1 && query.selectors[0].value)) {
        const /** @type {?} */ selectors = query.selectors.map(value => /** @type {?} */ (value.value));
        selectors.some(value => !value) && error('Found a type among the string selectors expected');
        return outputCtx.constantPool.getConstLiteral(o.literalArr(selectors.map(value => o.literal(value))));
    }
    if (query.selectors.length == 1) {
        const /** @type {?} */ first = query.selectors[0];
        if (first.identifier) {
            return outputCtx.importExpr(first.identifier.reference);
        }
    }
    error('Unexpected query form');
    return o.NULL_EXPR;
}
/**
 * @param {?} type
 * @param {?} outputCtx
 * @param {?} reflector
 * @param {?} queries
 * @return {?}
 */
export function createFactory(type, outputCtx, reflector, queries) {
    let /** @type {?} */ args = [];
    const /** @type {?} */ elementRef = reflector.resolveExternalReference(Identifiers.ElementRef);
    const /** @type {?} */ templateRef = reflector.resolveExternalReference(Identifiers.TemplateRef);
    const /** @type {?} */ viewContainerRef = reflector.resolveExternalReference(Identifiers.ViewContainerRef);
    for (let /** @type {?} */ dependency of type.diDeps) {
        const /** @type {?} */ token = dependency.token;
        if (token) {
            const /** @type {?} */ tokenRef = tokenReference(token);
            if (tokenRef === elementRef) {
                args.push(o.importExpr(R3.injectElementRef).callFn([]));
            }
            else if (tokenRef === templateRef) {
                args.push(o.importExpr(R3.injectTemplateRef).callFn([]));
            }
            else if (tokenRef === viewContainerRef) {
                args.push(o.importExpr(R3.injectViewContainerRef).callFn([]));
            }
            else if (dependency.isAttribute) {
                args.push(o.importExpr(R3.injectAttribute).callFn([o.literal(/** @type {?} */ ((dependency.token)).value)]));
            }
            else {
                const /** @type {?} */ tokenValue = token.identifier != null ? outputCtx.importExpr(tokenRef) : o.literal(tokenRef);
                const /** @type {?} */ directiveInjectArgs = [tokenValue];
                const /** @type {?} */ flags = extractFlags(dependency);
                if (flags != 0 /* Default */) {
                    // Append flag information if other than default.
                    directiveInjectArgs.push(o.literal(flags));
                }
                args.push(o.importExpr(R3.directiveInject).callFn(directiveInjectArgs));
            }
        }
        else {
            unsupported('dependency without a token');
        }
    }
    const /** @type {?} */ queryDefinitions = [];
    for (let /** @type {?} */ query of queries) {
        const /** @type {?} */ predicate = getQueryPredicate(query, outputCtx);
        // e.g. r3.Q(null, somePredicate, false) or r3.Q(null, ['div'], false)
        const /** @type {?} */ parameters = [
            o.literal(null, o.INFERRED_TYPE),
            predicate,
            o.literal(query.descendants),
        ];
        if (query.read) {
            parameters.push(outputCtx.importExpr(/** @type {?} */ ((query.read.identifier)).reference));
        }
        queryDefinitions.push(o.importExpr(R3.query).callFn(parameters));
    }
    const /** @type {?} */ createInstance = new o.InstantiateExpr(outputCtx.importExpr(type.reference), args);
    const /** @type {?} */ result = queryDefinitions.length > 0 ? o.literalArr([createInstance, ...queryDefinitions]) :
        createInstance;
    return o.fn([], [new o.ReturnStatement(result)], o.INFERRED_TYPE, null, type.reference.name ? `${type.reference.name}_Factory` : null);
}
/**
 * @param {?} dependency
 * @return {?}
 */
function extractFlags(dependency) {
    let /** @type {?} */ flags = 0 /* Default */;
    if (dependency.isHost) {
        flags |= 1 /* Host */;
    }
    if (dependency.isOptional) {
        flags |= 8 /* Optional */;
    }
    if (dependency.isSelf) {
        flags |= 2 /* Self */;
    }
    if (dependency.isSkipSelf) {
        flags |= 4 /* SkipSelf */;
    }
    if (dependency.isValue) {
        unsupported('value dependencies');
    }
    return flags;
}
/**
 *  Remove trailing null nodes as they are implied.
 * @param {?} parameters
 * @return {?}
 */
function trimTrailingNulls(parameters) {
    while (o.isNull(parameters[parameters.length - 1])) {
        parameters.pop();
    }
    return parameters;
}
/**
 * @param {?} selector
 * @return {?}
 */
function createDirectiveSelector(selector) {
    return asLiteral(core.parseSelectorToR3Selector(selector));
}
/**
 * @param {?} directiveMetadata
 * @param {?} outputCtx
 * @return {?}
 */
function createHostAttributesArray(directiveMetadata, outputCtx) {
    const /** @type {?} */ values = [];
    const /** @type {?} */ attributes = directiveMetadata.hostAttributes;
    for (let /** @type {?} */ key of Object.getOwnPropertyNames(attributes)) {
        const /** @type {?} */ value = attributes[key];
        values.push(o.literal(key), o.literal(value));
    }
    if (values.length > 0) {
        return outputCtx.constantPool.getConstLiteral(o.literalArr(values));
    }
    return null;
}
/**
 * @param {?} directiveMetadata
 * @param {?} outputCtx
 * @param {?} bindingParser
 * @return {?}
 */
function createHostBindingsFunction(directiveMetadata, outputCtx, bindingParser) {
    const /** @type {?} */ statements = [];
    const /** @type {?} */ temporary = temporaryAllocator(statements, TEMPORARY_NAME);
    const /** @type {?} */ hostBindingSourceSpan = typeSourceSpan(directiveMetadata.isComponent ? 'Component' : 'Directive', directiveMetadata.type);
    // Calculate the queries
    for (let /** @type {?} */ index = 0; index < directiveMetadata.queries.length; index++) {
        const /** @type {?} */ query = directiveMetadata.queries[index];
        // e.g. r3.qR(tmp = r3.ld(dirIndex)[1]) && (r3.ld(dirIndex)[0].someDir = tmp);
        const /** @type {?} */ getDirectiveMemory = o.importExpr(R3.load).callFn([o.variable('dirIndex')]);
        // The query list is at the query index + 1 because the directive itself is in slot 0.
        const /** @type {?} */ getQueryList = getDirectiveMemory.key(o.literal(index + 1));
        const /** @type {?} */ assignToTemporary = temporary().set(getQueryList);
        const /** @type {?} */ callQueryRefresh = o.importExpr(R3.queryRefresh).callFn([assignToTemporary]);
        const /** @type {?} */ updateDirective = getDirectiveMemory.key(o.literal(0, o.INFERRED_TYPE))
            .prop(query.propertyName)
            .set(query.first ? temporary().prop('first') : temporary());
        const /** @type {?} */ andExpression = callQueryRefresh.and(updateDirective);
        statements.push(andExpression.toStmt());
    }
    const /** @type {?} */ directiveSummary = directiveMetadata.toSummary();
    // Calculate the host property bindings
    const /** @type {?} */ bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    const /** @type {?} */ bindingContext = o.importExpr(R3.load).callFn([o.variable('dirIndex')]);
    if (bindings) {
        for (const /** @type {?} */ binding of bindings) {
            const /** @type {?} */ bindingExpr = convertPropertyBinding(null, bindingContext, binding.expression, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
            statements.push(...bindingExpr.stmts);
            statements.push(o.importExpr(R3.elementProperty)
                .callFn([
                o.variable('elIndex'),
                o.literal(binding.name),
                o.importExpr(R3.bind).callFn([bindingExpr.currValExpr]),
            ])
                .toStmt());
        }
    }
    // Calculate host event bindings
    const /** @type {?} */ eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings) {
        for (const /** @type {?} */ binding of eventBindings) {
            const /** @type {?} */ bindingExpr = convertActionBinding(null, bindingContext, binding.handler, 'b', () => error('Unexpected interpolation'));
            const /** @type {?} */ bindingName = binding.name && sanitizeIdentifier(binding.name);
            const /** @type {?} */ typeName = identifierName(directiveMetadata.type);
            const /** @type {?} */ functionName = typeName && bindingName ? `${typeName}_${bindingName}_HostBindingHandler` : null;
            const /** @type {?} */ handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], [...bindingExpr.stmts, new o.ReturnStatement(bindingExpr.allowDefault)], o.INFERRED_TYPE, null, functionName);
            statements.push(o.importExpr(R3.listener).callFn([o.literal(binding.name), handler]).toStmt());
        }
    }
    if (statements.length > 0) {
        const /** @type {?} */ typeName = directiveMetadata.type.reference.name;
        return o.fn([
            new o.FnParam('dirIndex', o.NUMBER_TYPE),
            new o.FnParam('elIndex', o.NUMBER_TYPE),
        ], statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_HostBindings` : null);
    }
    return null;
}
class ValueConverter extends AstMemoryEfficientTransformer {
    /**
     * @param {?} outputCtx
     * @param {?} allocateSlot
     * @param {?} definePipe
     */
    constructor(outputCtx, allocateSlot, definePipe) {
        super();
        this.outputCtx = outputCtx;
        this.allocateSlot = allocateSlot;
        this.definePipe = definePipe;
    }
    /**
     * @param {?} pipe
     * @param {?} context
     * @return {?}
     */
    visitPipe(pipe, context) {
        // Allocate a slot to create the pipe
        const /** @type {?} */ slot = this.allocateSlot();
        const /** @type {?} */ slotPseudoLocal = `PIPE:${slot}`;
        const /** @type {?} */ target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        const /** @type {?} */ bindingId = pipeBinding(pipe.args);
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(bindingId));
        const /** @type {?} */ value = pipe.exp.visit(this);
        const /** @type {?} */ args = this.visitAll(pipe.args);
        return new FunctionCall(pipe.span, target, [new LiteralPrimitive(pipe.span, slot), value, ...args]);
    }
    /**
     * @param {?} array
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(array, context) {
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), values => {
            // If the literal has calculated (non-literal) elements transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const /** @type {?} */ literal = o.literalArr(values);
            return values.every(a => a.isConstant()) ?
                this.outputCtx.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.outputCtx, literal);
        });
    }
    /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(map, context) {
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), values => {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const /** @type {?} */ literal = o.literalMap(values.map((value, index) => ({ key: map.keys[index].key, value, quoted: map.keys[index].quoted })));
            return values.every(a => a.isConstant()) ?
                this.outputCtx.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.outputCtx, literal);
        });
    }
}
function ValueConverter_tsickle_Closure_declarations() {
    /** @type {?} */
    ValueConverter.prototype.outputCtx;
    /** @type {?} */
    ValueConverter.prototype.allocateSlot;
    /** @type {?} */
    ValueConverter.prototype.definePipe;
}
/**
 * @template T
 * @param {?} arg
 * @return {?}
 */
function invalid(arg) {
    throw new Error(`Invalid state: Visitor ${this.constructor.name} doesn't handle ${o.constructor.name}`);
}
/**
 * @param {?} value
 * @return {?}
 */
function asLiteral(value) {
    if (Array.isArray(value)) {
        return o.literalArr(value.map(asLiteral));
    }
    return o.literal(value, o.INFERRED_TYPE);
}
/**
 * @param {?} keys
 * @return {?}
 */
function conditionallyCreateMapObjectLiteral(keys) {
    if (Object.getOwnPropertyNames(keys).length > 0) {
        return mapToExpression(keys);
    }
    return null;
}
/**
 * @param {?} map
 * @param {?=} quoted
 * @return {?}
 */
function mapToExpression(map, quoted = false) {
    return o.literalMap(Object.getOwnPropertyNames(map).map(key => ({ key, quoted, value: asLiteral(map[key]) })));
}
/**
 * Creates an allocator for a temporary variable.
 *
 * A variable declaration is added to the statements the first time the allocator is invoked.
 * @param {?} statements
 * @param {?} name
 * @return {?}
 */
function temporaryAllocator(statements, name) {
    let /** @type {?} */ temp = null;
    return () => {
        if (!temp) {
            statements.push(new o.DeclareVarStmt(TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
            temp = o.variable(name);
        }
        return temp;
    };
}
/**
 * @param {?=} i18n
 * @return {?}
 */
function parseI18nMeta(i18n) {
    let /** @type {?} */ meaning;
    let /** @type {?} */ description;
    let /** @type {?} */ id;
    if (i18n) {
        // TODO(vicb): figure out how to force a message ID with closure ?
        const /** @type {?} */ idIndex = i18n.indexOf(ID_SEPARATOR);
        const /** @type {?} */ descIndex = i18n.indexOf(MEANING_SEPARATOR);
        let /** @type {?} */ meaningAndDesc;
        [meaningAndDesc, id] =
            (idIndex > -1) ? [i18n.slice(0, idIndex), i18n.slice(idIndex + 2)] : [i18n, ''];
        [meaning, description] = (descIndex > -1) ?
            [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
            ['', meaningAndDesc];
    }
    return { description, id, meaning };
}
/**
 * Creates a `CssSelector` given a tag name and a map of attributes
 * @param {?} tag
 * @param {?} attributes
 * @return {?}
 */
function createCssSelector(tag, attributes) {
    const /** @type {?} */ cssSelector = new CssSelector();
    cssSelector.setElement(tag);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const /** @type {?} */ value = attributes[name];
        cssSelector.addAttribute(name, value);
        if (name.toLowerCase() === 'class') {
            const /** @type {?} */ classes = value.trim().split(/\s+/g);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    });
    return cssSelector;
}
//# sourceMappingURL=r3_view_compiler_local.js.map