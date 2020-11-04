/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { flatten, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { IvyParser } from '../../expression_parser/parser';
import * as html from '../../ml_parser/ast';
import { HtmlParser } from '../../ml_parser/html_parser';
import { WhitespaceVisitor } from '../../ml_parser/html_whitespaces';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import { isNgContainer as checkIsNgContainer, splitNsName } from '../../ml_parser/tags';
import { mapLiteral } from '../../output/map_util';
import * as o from '../../output/output_ast';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { CssSelector } from '../../selector';
import { BindingParser } from '../../template_parser/binding_parser';
import { error, partitionArray } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { prepareSyntheticListenerFunctionName, prepareSyntheticListenerName, prepareSyntheticPropertyName } from '../util';
import { I18nContext } from './i18n/context';
import { createGoogleGetMsgStatements } from './i18n/get_msg_utils';
import { createLocalizeStatements } from './i18n/localize_utils';
import { I18nMetaVisitor } from './i18n/meta';
import { assembleBoundTextPlaceholders, assembleI18nBoundString, declareI18nVariable, getTranslationConstPrefix, hasI18nMeta, I18N_ICU_MAPPING_PREFIX, i18nFormatPlaceholderNames, icuFromI18nMessage, isI18nRootNode, isSingleI18nIcu, placeholdersToParams, TRANSLATION_VAR_PREFIX, wrapI18nPlaceholder } from './i18n/util';
import { StylingBuilder } from './styling_builder';
import { asLiteral, chainedInstruction, CONTEXT_NAME, getAttrsForDirectiveMatching, getInterpolationArgsLength, IMPLICIT_REFERENCE, invalid, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, trimTrailingNulls, unsupported } from './util';
// Selector attribute name of `<ng-content>`
const NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
const NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
// Global symbols available only inside event bindings.
const EVENT_BINDING_SCOPE_GLOBALS = new Set(['$event']);
// List of supported global targets for event listeners
const GLOBAL_TARGET_RESOLVERS = new Map([['window', R3.resolveWindow], ['document', R3.resolveDocument], ['body', R3.resolveBody]]);
const LEADING_TRIVIA_CHARS = [' ', '\n', '\r', '\t'];
//  if (rf & flags) { .. }
export function renderFlagCheckIfStmt(flags, statements) {
    return o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
}
export function prepareEventListenerParameters(eventAst, handlerName = null, scope = null) {
    const { type, name, target, phase, handler } = eventAst;
    if (target && !GLOBAL_TARGET_RESOLVERS.has(target)) {
        throw new Error(`Unexpected global target '${target}' defined for '${name}' event.
        Supported list of global targets: ${Array.from(GLOBAL_TARGET_RESOLVERS.keys())}.`);
    }
    const eventArgumentName = '$event';
    const implicitReceiverAccesses = new Set();
    const implicitReceiverExpr = (scope === null || scope.bindingLevel === 0) ?
        o.variable(CONTEXT_NAME) :
        scope.getOrCreateSharedContextVar(0);
    const bindingExpr = convertActionBinding(scope, implicitReceiverExpr, handler, 'b', () => error('Unexpected interpolation'), eventAst.handlerSpan, implicitReceiverAccesses, EVENT_BINDING_SCOPE_GLOBALS);
    const statements = [];
    if (scope) {
        statements.push(...scope.restoreViewStatement());
        statements.push(...scope.variableDeclarations());
    }
    statements.push(...bindingExpr.render3Stmts);
    const eventName = type === 1 /* Animation */ ? prepareSyntheticListenerName(name, phase) : name;
    const fnName = handlerName && sanitizeIdentifier(handlerName);
    const fnArgs = [];
    if (implicitReceiverAccesses.has(eventArgumentName)) {
        fnArgs.push(new o.FnParam(eventArgumentName, o.DYNAMIC_TYPE));
    }
    const handlerFn = o.fn(fnArgs, statements, o.INFERRED_TYPE, null, fnName);
    const params = [o.literal(eventName), handlerFn];
    if (target) {
        params.push(o.literal(false), // `useCapture` flag, defaults to `false`
        o.importExpr(GLOBAL_TARGET_RESOLVERS.get(target)));
    }
    return params;
}
function createComponentDefConsts() {
    return { prepareStatements: [], constExpressions: [] };
}
export class TemplateDefinitionBuilder {
    constructor(constantPool, parentBindingScope, level = 0, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds, _constants = createComponentDefConsts()) {
        this.constantPool = constantPool;
        this.level = level;
        this.contextName = contextName;
        this.i18nContext = i18nContext;
        this.templateIndex = templateIndex;
        this.templateName = templateName;
        this.directiveMatcher = directiveMatcher;
        this.directives = directives;
        this.pipeTypeByName = pipeTypeByName;
        this.pipes = pipes;
        this._namespace = _namespace;
        this.i18nUseExternalIds = i18nUseExternalIds;
        this._constants = _constants;
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
        /** Index of the currently-selected node. */
        this._currentIndex = 0;
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
        // i18n context local to this template
        this.i18n = null;
        // Number of slots to reserve for pureFunctions
        this._pureFunctionSlots = 0;
        // Number of binding slots
        this._bindingSlots = 0;
        // Projection slots found in the template. Projection slots can distribute projected
        // nodes based on a selector, or can just use the wildcard selector to match
        // all nodes which aren't matching any selector.
        this._ngContentReservedSlots = [];
        // Number of non-default selectors found in all parent templates of this template. We need to
        // track it to properly adjust projection slot index in the `projection` instruction.
        this._ngContentSelectorsOffset = 0;
        // Expression that should be used as implicit receiver when converting template
        // expressions to output AST.
        this._implicitReceiverExpr = null;
        // These should be handled in the template or element directly.
        this.visitReference = invalid;
        this.visitVariable = invalid;
        this.visitTextAttribute = invalid;
        this.visitBoundAttribute = invalid;
        this.visitBoundEvent = invalid;
        this._bindingScope = parentBindingScope.nestedScope(level);
        // Turn the relative context file path into an identifier by replacing non-alphanumeric
        // characters with underscores.
        this.fileBasedI18nSuffix = relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_') + '_';
        this._valueConverter = new ValueConverter(constantPool, () => this.allocateDataSlot(), (numSlots) => this.allocatePureFunctionSlots(numSlots), (name, localName, slot, value) => {
            const pipeType = pipeTypeByName.get(name);
            if (pipeType) {
                this.pipes.add(pipeType);
            }
            this._bindingScope.set(this.level, localName, value);
            this.creationInstruction(null, R3.pipe, [o.literal(slot), o.literal(name)]);
        });
    }
    buildTemplateFunction(nodes, variables, ngContentSelectorsOffset = 0, i18n) {
        this._ngContentSelectorsOffset = ngContentSelectorsOffset;
        if (this._namespace !== R3.namespaceHTML) {
            this.creationInstruction(null, this._namespace);
        }
        // Create variable bindings
        variables.forEach(v => this.registerContextVariables(v));
        // Initiate i18n context in case:
        // - this template has parent i18n context
        // - or the template has i18n meta associated with it,
        //   but it's not initiated by the Element (e.g. <ng-template i18n>)
        const initI18nContext = this.i18nContext ||
            (isI18nRootNode(i18n) && !isSingleI18nIcu(i18n) &&
                !(isSingleElementTemplate(nodes) && nodes[0].i18n === i18n));
        const selfClosingI18nInstruction = hasTextChildrenOnly(nodes);
        if (initI18nContext) {
            this.i18nStart(null, i18n, selfClosingI18nInstruction);
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
        this._nestedTemplateFns.forEach(buildTemplateFn => buildTemplateFn());
        // Output the `projectionDef` instruction when some `<ng-content>` tags are present.
        // The `projectionDef` instruction is only emitted for the component template and
        // is skipped for nested templates (<ng-template> tags).
        if (this.level === 0 && this._ngContentReservedSlots.length) {
            const parameters = [];
            // By default the `projectionDef` instructions creates one slot for the wildcard
            // selector if no parameters are passed. Therefore we only want to allocate a new
            // array for the projection slots if the default projection slot is not sufficient.
            if (this._ngContentReservedSlots.length > 1 || this._ngContentReservedSlots[0] !== '*') {
                const r3ReservedSlots = this._ngContentReservedSlots.map(s => s !== '*' ? core.parseSelectorToR3Selector(s) : s);
                parameters.push(this.constantPool.getConstLiteral(asLiteral(r3ReservedSlots), true));
            }
            // Since we accumulate ngContent selectors while processing template elements,
            // we *prepend* `projectionDef` to creation instructions block, to put it before
            // any `projection` instructions
            this.creationInstruction(null, R3.projectionDef, parameters, /* prepend */ true);
        }
        if (initI18nContext) {
            this.i18nEnd(null, selfClosingI18nInstruction);
        }
        // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
        const creationStatements = this._creationCodeFns.map((fn) => fn());
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        const updateStatements = this._updateCodeFns.map((fn) => fn());
        //  Variable declaration must occur after binding resolution so we can generate context
        //  instructions that build on each other.
        // e.g. const b = nextContext().$implicit(); const b = nextContext();
        const creationVariables = this._bindingScope.viewSnapshotStatements();
        const updateVariables = this._bindingScope.variableDeclarations().concat(this._tempVariables);
        const creationBlock = creationStatements.length > 0 ?
            [renderFlagCheckIfStmt(1 /* Create */, creationVariables.concat(creationStatements))] :
            [];
        const updateBlock = updateStatements.length > 0 ?
            [renderFlagCheckIfStmt(2 /* Update */, updateVariables.concat(updateStatements))] :
            [];
        return o.fn(
        // i.e. (rf: RenderFlags, ctx: any)
        [new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
            // Temporary variable declarations for query refresh (i.e. let _t: any;)
            ...this._prefixCode,
            // Creating mode (i.e. if (rf & RenderFlags.Create) { ... })
            ...creationBlock,
            // Binding and refresh mode (i.e. if (rf & RenderFlags.Update) {...})
            ...updateBlock,
        ], o.INFERRED_TYPE, null, this.templateName);
    }
    // LocalResolver
    getLocal(name) {
        return this._bindingScope.get(name);
    }
    // LocalResolver
    notifyImplicitReceiverUse() {
        this._bindingScope.notifyImplicitReceiverUse();
    }
    i18nTranslate(message, params = {}, ref, transformFn) {
        const _ref = ref || this.i18nGenerateMainBlockVar();
        // Closure Compiler requires const names to start with `MSG_` but disallows any other const to
        // start with `MSG_`. We define a variable starting with `MSG_` just for the `goog.getMsg` call
        const closureVar = this.i18nGenerateClosureVar(message.id);
        const statements = getTranslationDeclStmts(message, _ref, closureVar, params, transformFn);
        this._constants.prepareStatements.push(...statements);
        return _ref;
    }
    registerContextVariables(variable) {
        const scopedName = this._bindingScope.freshReferenceName();
        const retrievalLevel = this.level;
        const lhs = o.variable(variable.name + scopedName);
        this._bindingScope.set(retrievalLevel, variable.name, lhs, 1 /* CONTEXT */, (scope, relativeLevel) => {
            let rhs;
            if (scope.bindingLevel === retrievalLevel) {
                // e.g. ctx
                rhs = o.variable(CONTEXT_NAME);
            }
            else {
                const sharedCtxVar = scope.getSharedContextName(retrievalLevel);
                // e.g. ctx_r0   OR  x(2);
                rhs = sharedCtxVar ? sharedCtxVar : generateNextContextExpr(relativeLevel);
            }
            // e.g. const $item$ = x(2).$implicit;
            return [lhs.set(rhs.prop(variable.value || IMPLICIT_REFERENCE)).toConstDecl()];
        });
    }
    i18nAppendBindings(expressions) {
        if (expressions.length > 0) {
            expressions.forEach(expression => this.i18n.appendBinding(expression));
        }
    }
    i18nBindProps(props) {
        const bound = {};
        Object.keys(props).forEach(key => {
            const prop = props[key];
            if (prop instanceof t.Text) {
                bound[key] = o.literal(prop.value);
            }
            else {
                const value = prop.value.visit(this._valueConverter);
                this.allocateBindingSlots(value);
                if (value instanceof Interpolation) {
                    const { strings, expressions } = value;
                    const { id, bindings } = this.i18n;
                    const label = assembleI18nBoundString(strings, bindings.size, id);
                    this.i18nAppendBindings(expressions);
                    bound[key] = o.literal(label);
                }
            }
        });
        return bound;
    }
    // Generates top level vars for i18n blocks (i.e. `i18n_N`).
    i18nGenerateMainBlockVar() {
        return o.variable(this.constantPool.uniqueName(TRANSLATION_VAR_PREFIX));
    }
    // Generates vars with Closure-specific names for i18n blocks (i.e. `MSG_XXX`).
    i18nGenerateClosureVar(messageId) {
        let name;
        const suffix = this.fileBasedI18nSuffix.toUpperCase();
        if (this.i18nUseExternalIds) {
            const prefix = getTranslationConstPrefix(`EXTERNAL_`);
            const uniqueSuffix = this.constantPool.uniqueName(suffix);
            name = `${prefix}${sanitizeIdentifier(messageId)}$$${uniqueSuffix}`;
        }
        else {
            const prefix = getTranslationConstPrefix(suffix);
            name = this.constantPool.uniqueName(prefix);
        }
        return o.variable(name);
    }
    i18nUpdateRef(context) {
        const { icus, meta, isRoot, isResolved, isEmitted } = context;
        if (isRoot && isResolved && !isEmitted && !isSingleI18nIcu(meta)) {
            context.isEmitted = true;
            const placeholders = context.getSerializedPlaceholders();
            let icuMapping = {};
            let params = placeholders.size ? placeholdersToParams(placeholders) : {};
            if (icus.size) {
                icus.forEach((refs, key) => {
                    if (refs.length === 1) {
                        // if we have one ICU defined for a given
                        // placeholder - just output its reference
                        params[key] = refs[0];
                    }
                    else {
                        // ... otherwise we need to activate post-processing
                        // to replace ICU placeholders with proper values
                        const placeholder = wrapI18nPlaceholder(`${I18N_ICU_MAPPING_PREFIX}${key}`);
                        params[key] = o.literal(placeholder);
                        icuMapping[key] = o.literalArr(refs);
                    }
                });
            }
            // translation requires post processing in 2 cases:
            // - if we have placeholders with multiple values (ex. `START_DIV`: [�#1�, �#2�, ...])
            // - if we have multiple ICUs that refer to the same placeholder name
            const needsPostprocessing = Array.from(placeholders.values()).some((value) => value.length > 1) ||
                Object.keys(icuMapping).length;
            let transformFn;
            if (needsPostprocessing) {
                transformFn = (raw) => {
                    const args = [raw];
                    if (Object.keys(icuMapping).length) {
                        args.push(mapLiteral(icuMapping, true));
                    }
                    return instruction(null, R3.i18nPostprocess, args);
                };
            }
            this.i18nTranslate(meta, params, context.ref, transformFn);
        }
    }
    i18nStart(span = null, meta, selfClosing) {
        const index = this.allocateDataSlot();
        this.i18n = this.i18nContext ?
            this.i18nContext.forkChildContext(index, this.templateIndex, meta) :
            new I18nContext(index, this.i18nGenerateMainBlockVar(), 0, this.templateIndex, meta);
        // generate i18nStart instruction
        const { id, ref } = this.i18n;
        const params = [o.literal(index), this.addToConsts(ref)];
        if (id > 0) {
            // do not push 3rd argument (sub-block id)
            // into i18nStart call for top level i18n context
            params.push(o.literal(id));
        }
        this.creationInstruction(span, selfClosing ? R3.i18n : R3.i18nStart, params);
    }
    i18nEnd(span = null, selfClosing) {
        if (!this.i18n) {
            throw new Error('i18nEnd is executed with no i18n context present');
        }
        if (this.i18nContext) {
            this.i18nContext.reconcileChildContext(this.i18n);
            this.i18nUpdateRef(this.i18nContext);
        }
        else {
            this.i18nUpdateRef(this.i18n);
        }
        // setup accumulated bindings
        const { index, bindings } = this.i18n;
        if (bindings.size) {
            const chainBindings = [];
            bindings.forEach(binding => {
                chainBindings.push({ sourceSpan: span, value: () => this.convertPropertyBinding(binding) });
            });
            // for i18n block, advance to the most recent element index (by taking the current number of
            // elements and subtracting one) before invoking `i18nExp` instructions, to make sure the
            // necessary lifecycle hooks of components/directives are properly flushed.
            this.updateInstructionChainWithAdvance(this.getConstCount() - 1, R3.i18nExp, chainBindings);
            this.updateInstruction(span, R3.i18nApply, [o.literal(index)]);
        }
        if (!selfClosing) {
            this.creationInstruction(span, R3.i18nEnd);
        }
        this.i18n = null; // reset local i18n context
    }
    i18nAttributesInstruction(nodeIndex, attrs, sourceSpan) {
        let hasBindings = false;
        const i18nAttrArgs = [];
        const bindings = [];
        attrs.forEach(attr => {
            const message = attr.i18n;
            const converted = attr.value.visit(this._valueConverter);
            this.allocateBindingSlots(converted);
            if (converted instanceof Interpolation) {
                const placeholders = assembleBoundTextPlaceholders(message);
                const params = placeholdersToParams(placeholders);
                i18nAttrArgs.push(o.literal(attr.name), this.i18nTranslate(message, params));
                converted.expressions.forEach(expression => {
                    hasBindings = true;
                    bindings.push({
                        sourceSpan,
                        value: () => this.convertPropertyBinding(expression),
                    });
                });
            }
        });
        if (bindings.length > 0) {
            this.updateInstructionChainWithAdvance(nodeIndex, R3.i18nExp, bindings);
        }
        if (i18nAttrArgs.length > 0) {
            const index = o.literal(this.allocateDataSlot());
            const constIndex = this.addToConsts(o.literalArr(i18nAttrArgs));
            this.creationInstruction(sourceSpan, R3.i18nAttributes, [index, constIndex]);
            if (hasBindings) {
                this.updateInstruction(sourceSpan, R3.i18nApply, [index]);
            }
        }
    }
    getNamespaceInstruction(namespaceKey) {
        switch (namespaceKey) {
            case 'math':
                return R3.namespaceMathML;
            case 'svg':
                return R3.namespaceSVG;
            default:
                return R3.namespaceHTML;
        }
    }
    addNamespaceInstruction(nsInstruction, element) {
        this._namespace = nsInstruction;
        this.creationInstruction(element.startSourceSpan, nsInstruction);
    }
    /**
     * Adds an update instruction for an interpolated property or attribute, such as
     * `prop="{{value}}"` or `attr.title="{{value}}"`
     */
    interpolatedUpdateInstruction(instruction, elementIndex, attrName, input, value, params) {
        this.updateInstructionWithAdvance(elementIndex, input.sourceSpan, instruction, () => [o.literal(attrName), ...this.getUpdateInstructionArguments(value), ...params]);
    }
    visitContent(ngContent) {
        const slot = this.allocateDataSlot();
        const projectionSlotIdx = this._ngContentSelectorsOffset + this._ngContentReservedSlots.length;
        const parameters = [o.literal(slot)];
        this._ngContentReservedSlots.push(ngContent.selector);
        const nonContentSelectAttributes = ngContent.attributes.filter(attr => attr.name.toLowerCase() !== NG_CONTENT_SELECT_ATTR);
        const attributes = this.getAttributeExpressions(ngContent.name, nonContentSelectAttributes, [], []);
        if (attributes.length > 0) {
            parameters.push(o.literal(projectionSlotIdx), o.literalArr(attributes));
        }
        else if (projectionSlotIdx !== 0) {
            parameters.push(o.literal(projectionSlotIdx));
        }
        this.creationInstruction(ngContent.sourceSpan, R3.projection, parameters);
        if (this.i18n) {
            this.i18n.appendProjection(ngContent.i18n, slot);
        }
    }
    visitElement(element) {
        var _a, _b;
        const elementIndex = this.allocateDataSlot();
        const stylingBuilder = new StylingBuilder(null);
        let isNonBindableMode = false;
        const isI18nRootElement = isI18nRootNode(element.i18n) && !isSingleI18nIcu(element.i18n);
        const outputAttrs = [];
        const [namespaceKey, elementName] = splitNsName(element.name);
        const isNgContainer = checkIsNgContainer(element.name);
        // Handle styling, i18n, ngNonBindable attributes
        for (const attr of element.attributes) {
            const { name, value } = attr;
            if (name === NON_BINDABLE_ATTR) {
                isNonBindableMode = true;
            }
            else if (name === 'style') {
                stylingBuilder.registerStyleAttr(value);
            }
            else if (name === 'class') {
                stylingBuilder.registerClassAttr(value);
            }
            else {
                outputAttrs.push(attr);
            }
        }
        // Match directives on non i18n attributes
        this.matchDirectives(element.name, element);
        // Regular element or ng-container creation mode
        const parameters = [o.literal(elementIndex)];
        if (!isNgContainer) {
            parameters.push(o.literal(elementName));
        }
        // Add the attributes
        const allOtherInputs = [];
        const boundI18nAttrs = [];
        element.inputs.forEach(input => {
            const stylingInputWasSet = stylingBuilder.registerBoundInput(input);
            if (!stylingInputWasSet) {
                if (input.type === 0 /* Property */ && input.i18n) {
                    boundI18nAttrs.push(input);
                }
                else {
                    allOtherInputs.push(input);
                }
            }
        });
        // add attributes for directive and projection matching purposes
        const attributes = this.getAttributeExpressions(element.name, outputAttrs, allOtherInputs, element.outputs, stylingBuilder, [], boundI18nAttrs);
        parameters.push(this.addAttrsToConsts(attributes));
        // local refs (ex.: <div #foo #bar="baz">)
        const refs = this.prepareRefsArray(element.references);
        parameters.push(this.addToConsts(refs));
        const wasInNamespace = this._namespace;
        const currentNamespace = this.getNamespaceInstruction(namespaceKey);
        // If the namespace is changing now, include an instruction to change it
        // during element creation.
        if (currentNamespace !== wasInNamespace) {
            this.addNamespaceInstruction(currentNamespace, element);
        }
        if (this.i18n) {
            this.i18n.appendElement(element.i18n, elementIndex);
        }
        // Note that we do not append text node instructions and ICUs inside i18n section,
        // so we exclude them while calculating whether current element has children
        const hasChildren = (!isI18nRootElement && this.i18n) ? !hasTextChildrenOnly(element.children) :
            element.children.length > 0;
        const createSelfClosingInstruction = !stylingBuilder.hasBindingsWithPipes &&
            element.outputs.length === 0 && boundI18nAttrs.length === 0 && !hasChildren;
        const createSelfClosingI18nInstruction = !createSelfClosingInstruction && hasTextChildrenOnly(element.children);
        if (createSelfClosingInstruction) {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainer : R3.element, trimTrailingNulls(parameters));
        }
        else {
            this.creationInstruction(element.startSourceSpan, isNgContainer ? R3.elementContainerStart : R3.elementStart, trimTrailingNulls(parameters));
            if (isNonBindableMode) {
                this.creationInstruction(element.startSourceSpan, R3.disableBindings);
            }
            if (boundI18nAttrs.length > 0) {
                this.i18nAttributesInstruction(elementIndex, boundI18nAttrs, (_a = element.startSourceSpan) !== null && _a !== void 0 ? _a : element.sourceSpan);
            }
            // Generate Listeners (outputs)
            if (element.outputs.length > 0) {
                const listeners = element.outputs.map((outputAst) => ({
                    sourceSpan: outputAst.sourceSpan,
                    params: this.prepareListenerParameter(element.name, outputAst, elementIndex)
                }));
                this.creationInstructionChain(R3.listener, listeners);
            }
            // Note: it's important to keep i18n/i18nStart instructions after i18nAttributes and
            // listeners, to make sure i18nAttributes instruction targets current element at runtime.
            if (isI18nRootElement) {
                this.i18nStart(element.startSourceSpan, element.i18n, createSelfClosingI18nInstruction);
            }
        }
        // the code here will collect all update-level styling instructions and add them to the
        // update block of the template function AOT code. Instructions like `styleProp`,
        // `styleMap`, `classMap`, `classProp`
        // are all generated and assigned in the code below.
        const stylingInstructions = stylingBuilder.buildUpdateLevelInstructions(this._valueConverter);
        const limit = stylingInstructions.length - 1;
        for (let i = 0; i <= limit; i++) {
            const instruction = stylingInstructions[i];
            this._bindingSlots += this.processStylingUpdateInstruction(elementIndex, instruction);
        }
        // the reason why `undefined` is used is because the renderer understands this as a
        // special value to symbolize that there is no RHS to this binding
        // TODO (matsko): revisit this once FW-959 is approached
        const emptyValueBindInstruction = o.literal(undefined);
        const propertyBindings = [];
        const attributeBindings = [];
        // Generate element input bindings
        allOtherInputs.forEach(input => {
            const inputType = input.type;
            if (inputType === 4 /* Animation */) {
                const value = input.value.visit(this._valueConverter);
                // animation bindings can be presented in the following formats:
                // 1. [@binding]="fooExp"
                // 2. [@binding]="{value:fooExp, params:{...}}"
                // 3. [@binding]
                // 4. @binding
                // All formats will be valid for when a synthetic binding is created.
                // The reasoning for this is because the renderer should get each
                // synthetic binding value in the order of the array that they are
                // defined in...
                const hasValue = value instanceof LiteralPrimitive ? !!value.value : true;
                this.allocateBindingSlots(value);
                propertyBindings.push({
                    name: prepareSyntheticPropertyName(input.name),
                    sourceSpan: input.sourceSpan,
                    value: () => hasValue ? this.convertPropertyBinding(value) : emptyValueBindInstruction
                });
            }
            else {
                // we must skip attributes with associated i18n context, since these attributes are handled
                // separately and corresponding `i18nExp` and `i18nApply` instructions will be generated
                if (input.i18n)
                    return;
                const value = input.value.visit(this._valueConverter);
                if (value !== undefined) {
                    const params = [];
                    const [attrNamespace, attrName] = splitNsName(input.name);
                    const isAttributeBinding = inputType === 1 /* Attribute */;
                    const sanitizationRef = resolveSanitizationFn(input.securityContext, isAttributeBinding);
                    if (sanitizationRef)
                        params.push(sanitizationRef);
                    if (attrNamespace) {
                        const namespaceLiteral = o.literal(attrNamespace);
                        if (sanitizationRef) {
                            params.push(namespaceLiteral);
                        }
                        else {
                            // If there wasn't a sanitization ref, we need to add
                            // an extra param so that we can pass in the namespace.
                            params.push(o.literal(null), namespaceLiteral);
                        }
                    }
                    this.allocateBindingSlots(value);
                    if (inputType === 0 /* Property */) {
                        if (value instanceof Interpolation) {
                            // prop="{{value}}" and friends
                            this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value), elementIndex, attrName, input, value, params);
                        }
                        else {
                            // [prop]="value"
                            // Collect all the properties so that we can chain into a single function at the end.
                            propertyBindings.push({
                                name: attrName,
                                sourceSpan: input.sourceSpan,
                                value: () => this.convertPropertyBinding(value),
                                params
                            });
                        }
                    }
                    else if (inputType === 1 /* Attribute */) {
                        if (value instanceof Interpolation && getInterpolationArgsLength(value) > 1) {
                            // attr.name="text{{value}}" and friends
                            this.interpolatedUpdateInstruction(getAttributeInterpolationExpression(value), elementIndex, attrName, input, value, params);
                        }
                        else {
                            const boundValue = value instanceof Interpolation ? value.expressions[0] : value;
                            // [attr.name]="value" or attr.name="{{value}}"
                            // Collect the attribute bindings so that they can be chained at the end.
                            attributeBindings.push({
                                name: attrName,
                                sourceSpan: input.sourceSpan,
                                value: () => this.convertPropertyBinding(boundValue),
                                params
                            });
                        }
                    }
                    else {
                        // class prop
                        this.updateInstructionWithAdvance(elementIndex, input.sourceSpan, R3.classProp, () => {
                            return [
                                o.literal(elementIndex), o.literal(attrName), this.convertPropertyBinding(value),
                                ...params
                            ];
                        });
                    }
                }
            }
        });
        if (propertyBindings.length > 0) {
            this.updateInstructionChainWithAdvance(elementIndex, R3.property, propertyBindings);
        }
        if (attributeBindings.length > 0) {
            this.updateInstructionChainWithAdvance(elementIndex, R3.attribute, attributeBindings);
        }
        // Traverse element child nodes
        t.visitAll(this, element.children);
        if (!isI18nRootElement && this.i18n) {
            this.i18n.appendElement(element.i18n, elementIndex, true);
        }
        if (!createSelfClosingInstruction) {
            // Finish element construction mode.
            const span = (_b = element.endSourceSpan) !== null && _b !== void 0 ? _b : element.sourceSpan;
            if (isI18nRootElement) {
                this.i18nEnd(span, createSelfClosingI18nInstruction);
            }
            if (isNonBindableMode) {
                this.creationInstruction(span, R3.enableBindings);
            }
            this.creationInstruction(span, isNgContainer ? R3.elementContainerEnd : R3.elementEnd);
        }
    }
    visitTemplate(template) {
        var _a;
        const NG_TEMPLATE_TAG_NAME = 'ng-template';
        const templateIndex = this.allocateDataSlot();
        if (this.i18n) {
            this.i18n.appendTemplate(template.i18n, templateIndex);
        }
        const tagName = sanitizeIdentifier(template.tagName || '');
        const contextName = `${this.contextName}${tagName ? '_' + tagName : ''}_${templateIndex}`;
        const templateName = `${contextName}_Template`;
        const parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            // We don't care about the tag's namespace here, because we infer
            // it based on the parent nodes inside the template instruction.
            o.literal(template.tagName ? splitNsName(template.tagName)[1] : template.tagName),
        ];
        // find directives matching on a given <ng-template> node
        this.matchDirectives(NG_TEMPLATE_TAG_NAME, template);
        // prepare attributes parameter (including attributes used for directive matching)
        const attrsExprs = this.getAttributeExpressions(NG_TEMPLATE_TAG_NAME, template.attributes, template.inputs, template.outputs, undefined /* styles */, template.templateAttrs);
        parameters.push(this.addAttrsToConsts(attrsExprs));
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            const refs = this.prepareRefsArray(template.references);
            parameters.push(this.addToConsts(refs));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // Create the template function
        const templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, templateIndex, templateName, this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds, this._constants);
        // Nested templates must not be visited until after their parent templates have completed
        // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
        // be able to support bindings in nested templates to local refs that occur after the
        // template definition. e.g. <div *ngIf="showing">{{ foo }}</div>  <div #foo></div>
        this._nestedTemplateFns.push(() => {
            const templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables, this._ngContentReservedSlots.length + this._ngContentSelectorsOffset, template.i18n);
            this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName));
            if (templateVisitor._ngContentReservedSlots.length) {
                this._ngContentReservedSlots.push(...templateVisitor._ngContentReservedSlots);
            }
        });
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(template.sourceSpan, R3.templateCreate, () => {
            parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
            return trimTrailingNulls(parameters);
        });
        // handle property bindings e.g. ɵɵproperty('ngForOf', ctx.items), et al;
        this.templatePropertyBindings(templateIndex, template.templateAttrs);
        // Only add normal input/output binding instructions on explicit <ng-template> elements.
        if (template.tagName === NG_TEMPLATE_TAG_NAME) {
            const [i18nInputs, inputs] = partitionArray(template.inputs, hasI18nMeta);
            // Add i18n attributes that may act as inputs to directives. If such attributes are present,
            // generate `i18nAttributes` instruction. Note: we generate it only for explicit <ng-template>
            // elements, in case of inline templates, corresponding instructions will be generated in the
            // nested template function.
            if (i18nInputs.length > 0) {
                this.i18nAttributesInstruction(templateIndex, i18nInputs, (_a = template.startSourceSpan) !== null && _a !== void 0 ? _a : template.sourceSpan);
            }
            // Add the input bindings
            if (inputs.length > 0) {
                this.templatePropertyBindings(templateIndex, inputs);
            }
            // Generate listeners for directive output
            if (template.outputs.length > 0) {
                const listeners = template.outputs.map((outputAst) => ({
                    sourceSpan: outputAst.sourceSpan,
                    params: this.prepareListenerParameter('ng_template', outputAst, templateIndex)
                }));
                this.creationInstructionChain(R3.listener, listeners);
            }
        }
    }
    visitBoundText(text) {
        if (this.i18n) {
            const value = text.value.visit(this._valueConverter);
            this.allocateBindingSlots(value);
            if (value instanceof Interpolation) {
                this.i18n.appendBoundText(text.i18n);
                this.i18nAppendBindings(value.expressions);
            }
            return;
        }
        const nodeIndex = this.allocateDataSlot();
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(nodeIndex)]);
        const value = text.value.visit(this._valueConverter);
        this.allocateBindingSlots(value);
        if (value instanceof Interpolation) {
            this.updateInstructionWithAdvance(nodeIndex, text.sourceSpan, getTextInterpolationExpression(value), () => this.getUpdateInstructionArguments(value));
        }
        else {
            error('Text nodes should be interpolated and never bound directly.');
        }
    }
    visitText(text) {
        // when a text element is located within a translatable
        // block, we exclude this text element from instructions set,
        // since it will be captured in i18n content and processed at runtime
        if (!this.i18n) {
            this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
        }
    }
    visitIcu(icu) {
        let initWasInvoked = false;
        // if an ICU was created outside of i18n block, we still treat
        // it as a translatable entity and invoke i18nStart and i18nEnd
        // to generate i18n context and the necessary instructions
        if (!this.i18n) {
            initWasInvoked = true;
            this.i18nStart(null, icu.i18n, true);
        }
        const i18n = this.i18n;
        const vars = this.i18nBindProps(icu.vars);
        const placeholders = this.i18nBindProps(icu.placeholders);
        // output ICU directly and keep ICU reference in context
        const message = icu.i18n;
        // we always need post-processing function for ICUs, to make sure that:
        // - all placeholders in a form of {PLACEHOLDER} are replaced with actual values (note:
        // `goog.getMsg` does not process ICUs and uses the `{PLACEHOLDER}` format for placeholders
        // inside ICUs)
        // - all ICU vars (such as `VAR_SELECT` or `VAR_PLURAL`) are replaced with correct values
        const transformFn = (raw) => {
            const params = Object.assign(Object.assign({}, vars), placeholders);
            const formatted = i18nFormatPlaceholderNames(params, /* useCamelCase */ false);
            return instruction(null, R3.i18nPostprocess, [raw, mapLiteral(formatted, true)]);
        };
        // in case the whole i18n message is a single ICU - we do not need to
        // create a separate top-level translation, we can use the root ref instead
        // and make this ICU a top-level translation
        // note: ICU placeholders are replaced with actual values in `i18nPostprocess` function
        // separately, so we do not pass placeholders into `i18nTranslate` function.
        if (isSingleI18nIcu(i18n.meta)) {
            this.i18nTranslate(message, /* placeholders */ {}, i18n.ref, transformFn);
        }
        else {
            // output ICU directly and keep ICU reference in context
            const ref = this.i18nTranslate(message, /* placeholders */ {}, /* ref */ undefined, transformFn);
            i18n.appendIcu(icuFromI18nMessage(message).name, ref);
        }
        if (initWasInvoked) {
            this.i18nEnd(null, true);
        }
        return null;
    }
    allocateDataSlot() {
        return this._dataIndex++;
    }
    getConstCount() {
        return this._dataIndex;
    }
    getVarCount() {
        return this._pureFunctionSlots;
    }
    getConsts() {
        return this._constants;
    }
    getNgContentSelectors() {
        return this._ngContentReservedSlots.length ?
            this.constantPool.getConstLiteral(asLiteral(this._ngContentReservedSlots), true) :
            null;
    }
    bindingContext() {
        return `${this._bindingContext++}`;
    }
    templatePropertyBindings(templateIndex, attrs) {
        const propertyBindings = [];
        attrs.forEach(input => {
            if (input instanceof t.BoundAttribute) {
                const value = input.value.visit(this._valueConverter);
                if (value !== undefined) {
                    this.allocateBindingSlots(value);
                    if (value instanceof Interpolation) {
                        // Params typically contain attribute namespace and value sanitizer, which is applicable
                        // for regular HTML elements, but not applicable for <ng-template> (since props act as
                        // inputs to directives), so keep params array empty.
                        const params = [];
                        // prop="{{value}}" case
                        this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value), templateIndex, input.name, input, value, params);
                    }
                    else {
                        // [prop]="value" case
                        propertyBindings.push({
                            name: input.name,
                            sourceSpan: input.sourceSpan,
                            value: () => this.convertPropertyBinding(value)
                        });
                    }
                }
            }
        });
        if (propertyBindings.length > 0) {
            this.updateInstructionChainWithAdvance(templateIndex, R3.property, propertyBindings);
        }
    }
    // Bindings must only be resolved after all local refs have been visited, so all
    // instructions are queued in callbacks that execute once the initial pass has completed.
    // Otherwise, we wouldn't be able to support local refs that are defined after their
    // bindings. e.g. {{ foo }} <div #foo></div>
    instructionFn(fns, span, reference, paramsOrFn, prepend = false) {
        fns[prepend ? 'unshift' : 'push'](() => {
            const params = Array.isArray(paramsOrFn) ? paramsOrFn : paramsOrFn();
            return instruction(span, reference, params).toStmt();
        });
    }
    processStylingUpdateInstruction(elementIndex, instruction) {
        let allocateBindingSlots = 0;
        if (instruction) {
            const calls = [];
            instruction.calls.forEach(call => {
                allocateBindingSlots += call.allocateBindingSlots;
                calls.push({
                    sourceSpan: call.sourceSpan,
                    value: () => {
                        return call.params(value => (call.supportsInterpolation && value instanceof Interpolation) ?
                            this.getUpdateInstructionArguments(value) :
                            this.convertPropertyBinding(value));
                    }
                });
            });
            this.updateInstructionChainWithAdvance(elementIndex, instruction.reference, calls);
        }
        return allocateBindingSlots;
    }
    creationInstruction(span, reference, paramsOrFn, prepend) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
    }
    creationInstructionChain(reference, calls) {
        const span = calls.length ? calls[0].sourceSpan : null;
        this._creationCodeFns.push(() => {
            return chainedInstruction(reference, calls.map(call => call.params()), span).toStmt();
        });
    }
    updateInstructionWithAdvance(nodeIndex, span, reference, paramsOrFn) {
        this.addAdvanceInstructionIfNecessary(nodeIndex, span);
        this.updateInstruction(span, reference, paramsOrFn);
    }
    updateInstruction(span, reference, paramsOrFn) {
        this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
    }
    updateInstructionChain(reference, bindings) {
        const span = bindings.length ? bindings[0].sourceSpan : null;
        this._updateCodeFns.push(() => {
            const calls = bindings.map(property => {
                const value = property.value();
                const fnParams = Array.isArray(value) ? value : [value];
                if (property.params) {
                    fnParams.push(...property.params);
                }
                if (property.name) {
                    // We want the property name to always be the first function parameter.
                    fnParams.unshift(o.literal(property.name));
                }
                return fnParams;
            });
            return chainedInstruction(reference, calls, span).toStmt();
        });
    }
    updateInstructionChainWithAdvance(nodeIndex, reference, bindings) {
        this.addAdvanceInstructionIfNecessary(nodeIndex, bindings.length ? bindings[0].sourceSpan : null);
        this.updateInstructionChain(reference, bindings);
    }
    addAdvanceInstructionIfNecessary(nodeIndex, span) {
        if (nodeIndex !== this._currentIndex) {
            const delta = nodeIndex - this._currentIndex;
            if (delta < 1) {
                throw new Error('advance instruction can only go forwards');
            }
            this.instructionFn(this._updateCodeFns, span, R3.advance, [o.literal(delta)]);
            this._currentIndex = nodeIndex;
        }
    }
    allocatePureFunctionSlots(numSlots) {
        const originalSlots = this._pureFunctionSlots;
        this._pureFunctionSlots += numSlots;
        return originalSlots;
    }
    allocateBindingSlots(value) {
        this._bindingSlots += value instanceof Interpolation ? value.expressions.length : 1;
    }
    /**
     * Gets an expression that refers to the implicit receiver. The implicit
     * receiver is always the root level context.
     */
    getImplicitReceiverExpr() {
        if (this._implicitReceiverExpr) {
            return this._implicitReceiverExpr;
        }
        return this._implicitReceiverExpr = this.level === 0 ?
            o.variable(CONTEXT_NAME) :
            this._bindingScope.getOrCreateSharedContextVar(0);
    }
    convertPropertyBinding(value) {
        const convertedPropertyBinding = convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), BindingForm.Expression, () => error('Unexpected interpolation'));
        const valExpr = convertedPropertyBinding.currValExpr;
        this._tempVariables.push(...convertedPropertyBinding.stmts);
        return valExpr;
    }
    /**
     * Gets a list of argument expressions to pass to an update instruction expression. Also updates
     * the temp variables state with temp variables that were identified as needing to be created
     * while visiting the arguments.
     * @param value The original expression we will be resolving an arguments list from.
     */
    getUpdateInstructionArguments(value) {
        const { args, stmts } = convertUpdateArguments(this, this.getImplicitReceiverExpr(), value, this.bindingContext());
        this._tempVariables.push(...stmts);
        return args;
    }
    matchDirectives(elementName, elOrTpl) {
        if (this.directiveMatcher) {
            const selector = createCssSelector(elementName, getAttrsForDirectiveMatching(elOrTpl));
            this.directiveMatcher.match(selector, (cssSelector, staticType) => {
                this.directives.add(staticType);
            });
        }
    }
    /**
     * Prepares all attribute expression values for the `TAttributes` array.
     *
     * The purpose of this function is to properly construct an attributes array that
     * is passed into the `elementStart` (or just `element`) functions. Because there
     * are many different types of attributes, the array needs to be constructed in a
     * special way so that `elementStart` can properly evaluate them.
     *
     * The format looks like this:
     *
     * ```
     * attrs = [prop, value, prop2, value2,
     *   PROJECT_AS, selector,
     *   CLASSES, class1, class2,
     *   STYLES, style1, value1, style2, value2,
     *   BINDINGS, name1, name2, name3,
     *   TEMPLATE, name4, name5, name6,
     *   I18N, name7, name8, ...]
     * ```
     *
     * Note that this function will fully ignore all synthetic (@foo) attribute values
     * because those values are intended to always be generated as property instructions.
     */
    getAttributeExpressions(elementName, renderAttributes, inputs, outputs, styles, templateAttrs = [], boundI18nAttrs = []) {
        const alreadySeen = new Set();
        const attrExprs = [];
        let ngProjectAsAttr;
        for (const attr of renderAttributes) {
            if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                ngProjectAsAttr = attr;
            }
            // Note that static i18n attributes aren't in the i18n array,
            // because they're treated in the same way as regular attributes.
            if (attr.i18n) {
                attrExprs.push(o.literal(attr.name), this.i18nTranslate(attr.i18n));
            }
            else {
                attrExprs.push(...getAttributeNameLiterals(attr.name), trustedConstAttribute(elementName, attr));
            }
        }
        // Keep ngProjectAs next to the other name, value pairs so we can verify that we match
        // ngProjectAs marker in the attribute name slot.
        if (ngProjectAsAttr) {
            attrExprs.push(...getNgProjectAsLiteral(ngProjectAsAttr));
        }
        function addAttrExpr(key, value) {
            if (typeof key === 'string') {
                if (!alreadySeen.has(key)) {
                    attrExprs.push(...getAttributeNameLiterals(key));
                    value !== undefined && attrExprs.push(value);
                    alreadySeen.add(key);
                }
            }
            else {
                attrExprs.push(o.literal(key));
            }
        }
        // it's important that this occurs before BINDINGS and TEMPLATE because once `elementStart`
        // comes across the BINDINGS or TEMPLATE markers then it will continue reading each value as
        // as single property value cell by cell.
        if (styles) {
            styles.populateInitialStylingAttrs(attrExprs);
        }
        if (inputs.length || outputs.length) {
            const attrsLengthBeforeInputs = attrExprs.length;
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                // We don't want the animation and attribute bindings in the
                // attributes array since they aren't used for directive matching.
                if (input.type !== 4 /* Animation */ && input.type !== 1 /* Attribute */) {
                    addAttrExpr(input.name);
                }
            }
            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                if (output.type !== 1 /* Animation */) {
                    addAttrExpr(output.name);
                }
            }
            // this is a cheap way of adding the marker only after all the input/output
            // values have been filtered (by not including the animation ones) and added
            // to the expressions. The marker is important because it tells the runtime
            // code that this is where attributes without values start...
            if (attrExprs.length !== attrsLengthBeforeInputs) {
                attrExprs.splice(attrsLengthBeforeInputs, 0, o.literal(3 /* Bindings */));
            }
        }
        if (templateAttrs.length) {
            attrExprs.push(o.literal(4 /* Template */));
            templateAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        if (boundI18nAttrs.length) {
            attrExprs.push(o.literal(6 /* I18n */));
            boundI18nAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        return attrExprs;
    }
    addToConsts(expression) {
        if (o.isNull(expression)) {
            return o.TYPED_NULL_EXPR;
        }
        const consts = this._constants.constExpressions;
        // Try to reuse a literal that's already in the array, if possible.
        for (let i = 0; i < consts.length; i++) {
            if (consts[i].isEquivalent(expression)) {
                return o.literal(i);
            }
        }
        return o.literal(consts.push(expression) - 1);
    }
    addAttrsToConsts(attrs) {
        return attrs.length > 0 ? this.addToConsts(o.literalArr(attrs)) : o.TYPED_NULL_EXPR;
    }
    prepareRefsArray(references) {
        if (!references || references.length === 0) {
            return o.TYPED_NULL_EXPR;
        }
        const refsParam = flatten(references.map(reference => {
            const slot = this.allocateDataSlot();
            // Generate the update temporary.
            const variableName = this._bindingScope.freshReferenceName();
            const retrievalLevel = this.level;
            const lhs = o.variable(variableName);
            this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DEFAULT */, (scope, relativeLevel) => {
                // e.g. nextContext(2);
                const nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                // e.g. const $foo$ = reference(1);
                const refExpr = lhs.set(o.importExpr(R3.reference).callFn([o.literal(slot)]));
                return nextContextStmt.concat(refExpr.toConstDecl());
            }, true);
            return [reference.name, reference.value];
        }));
        return asLiteral(refsParam);
    }
    prepareListenerParameter(tagName, outputAst, index) {
        return () => {
            const eventName = outputAst.name;
            const bindingFnName = outputAst.type === 1 /* Animation */ ?
                // synthetic @listener.foo values are treated the exact same as are standard listeners
                prepareSyntheticListenerFunctionName(eventName, outputAst.phase) :
                sanitizeIdentifier(eventName);
            const handlerName = `${this.templateName}_${tagName}_${bindingFnName}_${index}_listener`;
            const scope = this._bindingScope.nestedScope(this._bindingScope.bindingLevel, EVENT_BINDING_SCOPE_GLOBALS);
            return prepareEventListenerParameters(outputAst, handlerName, scope);
        };
    }
}
export class ValueConverter extends AstMemoryEfficientTransformer {
    constructor(constantPool, allocateSlot, allocatePureFunctionSlots, definePipe) {
        super();
        this.constantPool = constantPool;
        this.allocateSlot = allocateSlot;
        this.allocatePureFunctionSlots = allocatePureFunctionSlots;
        this.definePipe = definePipe;
        this._pipeBindExprs = [];
    }
    // AstMemoryEfficientTransformer
    visitPipe(pipe, context) {
        // Allocate a slot to create the pipe
        const slot = this.allocateSlot();
        const slotPseudoLocal = `PIPE:${slot}`;
        // Allocate one slot for the result plus one slot per pipe argument
        const pureFunctionSlot = this.allocatePureFunctionSlots(2 + pipe.args.length);
        const target = new PropertyRead(pipe.span, pipe.sourceSpan, pipe.nameSpan, new ImplicitReceiver(pipe.span, pipe.sourceSpan), slotPseudoLocal);
        const { identifier, isVarLength } = pipeBindingCallInfo(pipe.args);
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
        const args = [pipe.exp, ...pipe.args];
        const convertedArgs = isVarLength ?
            this.visitAll([new LiteralArray(pipe.span, pipe.sourceSpan, args)]) :
            this.visitAll(args);
        const pipeBindExpr = new FunctionCall(pipe.span, pipe.sourceSpan, target, [
            new LiteralPrimitive(pipe.span, pipe.sourceSpan, slot),
            new LiteralPrimitive(pipe.span, pipe.sourceSpan, pureFunctionSlot),
            ...convertedArgs,
        ]);
        this._pipeBindExprs.push(pipeBindExpr);
        return pipeBindExpr;
    }
    updatePipeSlotOffsets(bindingSlots) {
        this._pipeBindExprs.forEach((pipe) => {
            // update the slot offset arg (index 1) to account for binding slots
            const slotOffset = pipe.args[1];
            slotOffset.value += bindingSlots;
        });
    }
    visitLiteralArray(array, context) {
        return new BuiltinFunctionCall(array.span, array.sourceSpan, this.visitAll(array.expressions), values => {
            // If the literal has calculated (non-literal) elements transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values.
            const literal = o.literalArr(values);
            return getLiteralFactory(this.constantPool, literal, this.allocatePureFunctionSlots);
        });
    }
    visitLiteralMap(map, context) {
        return new BuiltinFunctionCall(map.span, map.sourceSpan, this.visitAll(map.values), values => {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values.
            const literal = o.literalMap(values.map((value, index) => ({ key: map.keys[index].key, value, quoted: map.keys[index].quoted })));
            return getLiteralFactory(this.constantPool, literal, this.allocatePureFunctionSlots);
        });
    }
}
// Pipes always have at least one parameter, the value they operate on
const pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
function pipeBindingCallInfo(args) {
    const identifier = pipeBindingIdentifiers[args.length];
    return {
        identifier: identifier || R3.pipeBindV,
        isVarLength: !identifier,
    };
}
const pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
function pureFunctionCallInfo(args) {
    const identifier = pureFunctionIdentifiers[args.length];
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
    const { literalFactory, literalFactoryArguments } = constantPool.getLiteralFactory(literal);
    // Allocate 1 slot for the result plus 1 per argument
    const startSlot = allocateSlots(1 + literalFactoryArguments.length);
    const { identifier, isVarLength } = pureFunctionCallInfo(literalFactoryArguments);
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    const args = [o.literal(startSlot), literalFactory];
    if (isVarLength) {
        args.push(o.literalArr(literalFactoryArguments));
    }
    else {
        args.push(...literalFactoryArguments);
    }
    return o.importExpr(identifier).callFn(args);
}
/**
 * Gets an array of literals that can be added to an expression
 * to represent the name and namespace of an attribute. E.g.
 * `:xlink:href` turns into `[AttributeMarker.NamespaceURI, 'xlink', 'href']`.
 *
 * @param name Name of the attribute, including the namespace.
 */
function getAttributeNameLiterals(name) {
    const [attributeNamespace, attributeName] = splitNsName(name);
    const nameLiteral = o.literal(attributeName);
    if (attributeNamespace) {
        return [
            o.literal(0 /* NamespaceURI */), o.literal(attributeNamespace), nameLiteral
        ];
    }
    return [nameLiteral];
}
/** The prefix used to get a shared context in BindingScope's map. */
const SHARED_CONTEXT_KEY = '$$shared_ctx$$';
export class BindingScope {
    constructor(bindingLevel = 0, parent = null, globals) {
        this.bindingLevel = bindingLevel;
        this.parent = parent;
        this.globals = globals;
        /** Keeps a map from local variables to their BindingData. */
        this.map = new Map();
        this.referenceNameIndex = 0;
        this.restoreViewVariable = null;
        if (globals !== undefined) {
            for (const name of globals) {
                this.set(0, name, o.variable(name));
            }
        }
    }
    static createRootScope() {
        return new BindingScope();
    }
    get(name) {
        let current = this;
        while (current) {
            let value = current.map.get(name);
            if (value != null) {
                if (current !== this) {
                    // make a local copy and reset the `declare` state
                    value = {
                        retrievalLevel: value.retrievalLevel,
                        lhs: value.lhs,
                        declareLocalCallback: value.declareLocalCallback,
                        declare: false,
                        priority: value.priority,
                        localRef: value.localRef
                    };
                    // Cache the value locally.
                    this.map.set(name, value);
                    // Possibly generate a shared context var
                    this.maybeGenerateSharedContextVar(value);
                    this.maybeRestoreView(value.retrievalLevel, value.localRef);
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
    }
    /**
     * Create a local variable for later reference.
     *
     * @param retrievalLevel The level from which this value can be retrieved
     * @param name Name of the variable.
     * @param lhs AST representing the left hand side of the `let lhs = rhs;`.
     * @param priority The sorting priority of this var
     * @param declareLocalCallback The callback to invoke when declaring this local var
     * @param localRef Whether or not this is a local ref
     */
    set(retrievalLevel, name, lhs, priority = 0 /* DEFAULT */, declareLocalCallback, localRef) {
        if (this.map.has(name)) {
            if (localRef) {
                // Do not throw an error if it's a local ref and do not update existing value,
                // so the first defined ref is always returned.
                return this;
            }
            error(`The name ${name} is already defined in scope to be ${this.map.get(name)}`);
        }
        this.map.set(name, {
            retrievalLevel: retrievalLevel,
            lhs: lhs,
            declare: false,
            declareLocalCallback: declareLocalCallback,
            priority: priority,
            localRef: localRef || false
        });
        return this;
    }
    // Implemented as part of LocalResolver.
    getLocal(name) {
        return this.get(name);
    }
    // Implemented as part of LocalResolver.
    notifyImplicitReceiverUse() {
        if (this.bindingLevel !== 0) {
            // Since the implicit receiver is accessed in an embedded view, we need to
            // ensure that we declare a shared context variable for the current template
            // in the update variables.
            this.map.get(SHARED_CONTEXT_KEY + 0).declare = true;
        }
    }
    nestedScope(level, globals) {
        const newScope = new BindingScope(level, this, globals);
        if (level > 0)
            newScope.generateSharedContextVar(0);
        return newScope;
    }
    /**
     * Gets or creates a shared context variable and returns its expression. Note that
     * this does not mean that the shared variable will be declared. Variables in the
     * binding scope will be only declared if they are used.
     */
    getOrCreateSharedContextVar(retrievalLevel) {
        const bindingKey = SHARED_CONTEXT_KEY + retrievalLevel;
        if (!this.map.has(bindingKey)) {
            this.generateSharedContextVar(retrievalLevel);
        }
        // Shared context variables are always generated as "ReadVarExpr".
        return this.map.get(bindingKey).lhs;
    }
    getSharedContextName(retrievalLevel) {
        const sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + retrievalLevel);
        // Shared context variables are always generated as "ReadVarExpr".
        return sharedCtxObj && sharedCtxObj.declare ? sharedCtxObj.lhs : null;
    }
    maybeGenerateSharedContextVar(value) {
        if (value.priority === 1 /* CONTEXT */ &&
            value.retrievalLevel < this.bindingLevel) {
            const sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + value.retrievalLevel);
            if (sharedCtxObj) {
                sharedCtxObj.declare = true;
            }
            else {
                this.generateSharedContextVar(value.retrievalLevel);
            }
        }
    }
    generateSharedContextVar(retrievalLevel) {
        const lhs = o.variable(CONTEXT_NAME + this.freshReferenceName());
        this.map.set(SHARED_CONTEXT_KEY + retrievalLevel, {
            retrievalLevel: retrievalLevel,
            lhs: lhs,
            declareLocalCallback: (scope, relativeLevel) => {
                // const ctx_r0 = nextContext(2);
                return [lhs.set(generateNextContextExpr(relativeLevel)).toConstDecl()];
            },
            declare: false,
            priority: 2 /* SHARED_CONTEXT */,
            localRef: false
        });
    }
    getComponentProperty(name) {
        const componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
        componentValue.declare = true;
        this.maybeRestoreView(0, false);
        return componentValue.lhs.prop(name);
    }
    maybeRestoreView(retrievalLevel, localRefLookup) {
        // We want to restore the current view in listener fns if:
        // 1 - we are accessing a value in a parent view, which requires walking the view tree rather
        // than using the ctx arg. In this case, the retrieval and binding level will be different.
        // 2 - we are looking up a local ref, which requires restoring the view where the local
        // ref is stored
        if (this.isListenerScope() && (retrievalLevel < this.bindingLevel || localRefLookup)) {
            if (!this.parent.restoreViewVariable) {
                // parent saves variable to generate a shared `const $s$ = getCurrentView();` instruction
                this.parent.restoreViewVariable = o.variable(this.parent.freshReferenceName());
            }
            this.restoreViewVariable = this.parent.restoreViewVariable;
        }
    }
    restoreViewStatement() {
        // restoreView($state$);
        return this.restoreViewVariable ?
            [instruction(null, R3.restoreView, [this.restoreViewVariable]).toStmt()] :
            [];
    }
    viewSnapshotStatements() {
        // const $state$ = getCurrentView();
        const getCurrentViewInstruction = instruction(null, R3.getCurrentView, []);
        return this.restoreViewVariable ?
            [this.restoreViewVariable.set(getCurrentViewInstruction).toConstDecl()] :
            [];
    }
    isListenerScope() {
        return this.parent && this.parent.bindingLevel === this.bindingLevel;
    }
    variableDeclarations() {
        let currentContextLevel = 0;
        return Array.from(this.map.values())
            .filter(value => value.declare)
            .sort((a, b) => b.retrievalLevel - a.retrievalLevel || b.priority - a.priority)
            .reduce((stmts, value) => {
            const levelDiff = this.bindingLevel - value.retrievalLevel;
            const currStmts = value.declareLocalCallback(this, levelDiff - currentContextLevel);
            currentContextLevel = levelDiff;
            return stmts.concat(currStmts);
        }, []);
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
/**
 * Creates a `CssSelector` given a tag name and a map of attributes
 */
export function createCssSelector(elementName, attributes) {
    const cssSelector = new CssSelector();
    const elementNameNoNs = splitNsName(elementName)[1];
    cssSelector.setElement(elementNameNoNs);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const nameNoNs = splitNsName(name)[1];
        const value = attributes[name];
        cssSelector.addAttribute(nameNoNs, value);
        if (name.toLowerCase() === 'class') {
            const classes = value.trim().split(/\s+/);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    });
    return cssSelector;
}
/**
 * Creates an array of expressions out of an `ngProjectAs` attributes
 * which can be added to the instruction parameters.
 */
function getNgProjectAsLiteral(attribute) {
    // Parse the attribute value into a CssSelectorList. Note that we only take the
    // first selector, because we don't support multiple selectors in ngProjectAs.
    const parsedR3Selector = core.parseSelectorToR3Selector(attribute.value)[0];
    return [o.literal(5 /* ProjectAs */), asLiteral(parsedR3Selector)];
}
/**
 * Gets the instruction to generate for an interpolated property
 * @param interpolation An Interpolation AST
 */
function getPropertyInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.propertyInterpolate;
        case 3:
            return R3.propertyInterpolate1;
        case 5:
            return R3.propertyInterpolate2;
        case 7:
            return R3.propertyInterpolate3;
        case 9:
            return R3.propertyInterpolate4;
        case 11:
            return R3.propertyInterpolate5;
        case 13:
            return R3.propertyInterpolate6;
        case 15:
            return R3.propertyInterpolate7;
        case 17:
            return R3.propertyInterpolate8;
        default:
            return R3.propertyInterpolateV;
    }
}
/**
 * Gets the instruction to generate for an interpolated attribute
 * @param interpolation An Interpolation AST
 */
function getAttributeInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 3:
            return R3.attributeInterpolate1;
        case 5:
            return R3.attributeInterpolate2;
        case 7:
            return R3.attributeInterpolate3;
        case 9:
            return R3.attributeInterpolate4;
        case 11:
            return R3.attributeInterpolate5;
        case 13:
            return R3.attributeInterpolate6;
        case 15:
            return R3.attributeInterpolate7;
        case 17:
            return R3.attributeInterpolate8;
        default:
            return R3.attributeInterpolateV;
    }
}
/**
 * Gets the instruction to generate for interpolated text.
 * @param interpolation An Interpolation AST
 */
function getTextInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.textInterpolate;
        case 3:
            return R3.textInterpolate1;
        case 5:
            return R3.textInterpolate2;
        case 7:
            return R3.textInterpolate3;
        case 9:
            return R3.textInterpolate4;
        case 11:
            return R3.textInterpolate5;
        case 13:
            return R3.textInterpolate6;
        case 15:
            return R3.textInterpolate7;
        case 17:
            return R3.textInterpolate8;
        default:
            return R3.textInterpolateV;
    }
}
/**
 * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
 *
 * @param template text of the template to parse
 * @param templateUrl URL to use for source mapping of the parsed template
 * @param options options to modify how the template is parsed
 */
export function parseTemplate(template, templateUrl, options = {}) {
    const { interpolationConfig, preserveWhitespaces, enableI18nLegacyMessageIdFormat } = options;
    const bindingParser = makeBindingParser(interpolationConfig);
    const htmlParser = new HtmlParser();
    const parseResult = htmlParser.parse(template, templateUrl, Object.assign(Object.assign({ leadingTriviaChars: LEADING_TRIVIA_CHARS }, options), { tokenizeExpansionForms: true }));
    if (parseResult.errors && parseResult.errors.length > 0) {
        // TODO(ayazhafiz): we may not always want to bail out at this point (e.g. in
        // the context of a language service).
        return {
            interpolationConfig,
            preserveWhitespaces,
            template,
            errors: parseResult.errors,
            nodes: [],
            styleUrls: [],
            styles: [],
            ngContentSelectors: []
        };
    }
    let rootNodes = parseResult.rootNodes;
    // process i18n meta information (scan attributes, generate ids)
    // before we run whitespace removal process, because existing i18n
    // extraction process (ng extract-i18n) relies on a raw content to generate
    // message ids
    const i18nMetaVisitor = new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ !preserveWhitespaces, enableI18nLegacyMessageIdFormat);
    rootNodes = html.visitAll(i18nMetaVisitor, rootNodes);
    if (!preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
        // run i18n meta visitor again in case whitespaces are removed (because that might affect
        // generated i18n message content) and first pass indicated that i18n content is present in a
        // template. During this pass i18n IDs generated at the first pass will be preserved, so we can
        // mimic existing extraction process (ng extract-i18n)
        if (i18nMetaVisitor.hasI18nMeta) {
            rootNodes = html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
        }
    }
    const { nodes, errors, styleUrls, styles, ngContentSelectors } = htmlAstToRender3Ast(rootNodes, bindingParser);
    return {
        interpolationConfig,
        preserveWhitespaces,
        errors: errors.length > 0 ? errors : null,
        template,
        nodes,
        styleUrls,
        styles,
        ngContentSelectors
    };
}
const elementRegistry = new DomElementSchemaRegistry();
/**
 * Construct a `BindingParser` with a default configuration.
 */
export function makeBindingParser(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    return new BindingParser(new IvyParser(new Lexer()), interpolationConfig, elementRegistry, null, []);
}
export function resolveSanitizationFn(context, isAttribute) {
    switch (context) {
        case core.SecurityContext.HTML:
            return o.importExpr(R3.sanitizeHtml);
        case core.SecurityContext.SCRIPT:
            return o.importExpr(R3.sanitizeScript);
        case core.SecurityContext.STYLE:
            // the compiler does not fill in an instruction for [style.prop?] binding
            // values because the style algorithm knows internally what props are subject
            // to sanitization (only [attr.style] values are explicitly sanitized)
            return isAttribute ? o.importExpr(R3.sanitizeStyle) : null;
        case core.SecurityContext.URL:
            return o.importExpr(R3.sanitizeUrl);
        case core.SecurityContext.RESOURCE_URL:
            return o.importExpr(R3.sanitizeResourceUrl);
        default:
            return null;
    }
}
function trustedConstAttribute(tagName, attr) {
    const value = asLiteral(attr.value);
    switch (elementRegistry.securityContext(tagName, attr.name, /* isAttribute */ true)) {
        case core.SecurityContext.HTML:
            return o.importExpr(R3.trustConstantHtml).callFn([value], attr.valueSpan);
        case core.SecurityContext.SCRIPT:
            return o.importExpr(R3.trustConstantScript).callFn([value], attr.valueSpan);
        case core.SecurityContext.RESOURCE_URL:
            return o.importExpr(R3.trustConstantResourceUrl).callFn([value], attr.valueSpan);
        default:
            return value;
    }
}
function isSingleElementTemplate(children) {
    return children.length === 1 && children[0] instanceof t.Element;
}
function isTextNode(node) {
    return node instanceof t.Text || node instanceof t.BoundText || node instanceof t.Icu;
}
function hasTextChildrenOnly(children) {
    return children.every(isTextNode);
}
/** Name of the global variable that is used to determine if we use Closure translations or not */
const NG_I18N_CLOSURE_MODE = 'ngI18nClosureMode';
/**
 * Generate statements that define a given translation message.
 *
 * ```
 * var I18N_1;
 * if (typeof ngI18nClosureMode !== undefined && ngI18nClosureMode) {
 *     var MSG_EXTERNAL_XXX = goog.getMsg(
 *          "Some message with {$interpolation}!",
 *          { "interpolation": "\uFFFD0\uFFFD" }
 *     );
 *     I18N_1 = MSG_EXTERNAL_XXX;
 * }
 * else {
 *     I18N_1 = $localize`Some message with ${'\uFFFD0\uFFFD'}!`;
 * }
 * ```
 *
 * @param message The original i18n AST message node
 * @param variable The variable that will be assigned the translation, e.g. `I18N_1`.
 * @param closureVar The variable for Closure `goog.getMsg` calls, e.g. `MSG_EXTERNAL_XXX`.
 * @param params Object mapping placeholder names to their values (e.g.
 * `{ "interpolation": "\uFFFD0\uFFFD" }`).
 * @param transformFn Optional transformation function that will be applied to the translation (e.g.
 * post-processing).
 * @returns An array of statements that defined a given translation.
 */
export function getTranslationDeclStmts(message, variable, closureVar, params = {}, transformFn) {
    const statements = [
        declareI18nVariable(variable),
        o.ifStmt(createClosureModeGuard(), createGoogleGetMsgStatements(variable, message, closureVar, i18nFormatPlaceholderNames(params, /* useCamelCase */ true)), createLocalizeStatements(variable, message, i18nFormatPlaceholderNames(params, /* useCamelCase */ false))),
    ];
    if (transformFn) {
        statements.push(new o.ExpressionStatement(variable.set(transformFn(variable))));
    }
    return statements;
}
/**
 * Create the expression that will be used to guard the closure mode block
 * It is equivalent to:
 *
 * ```
 * typeof ngI18nClosureMode !== undefined && ngI18nClosureMode
 * ```
 */
function createClosureModeGuard() {
    return o.typeofExpr(o.variable(NG_I18N_CLOSURE_MODE))
        .notIdentical(o.literal('undefined', o.STRING_TYPE))
        .and(o.variable(NG_I18N_CLOSURE_MODE));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUFnQixNQUFNLDBDQUEwQyxDQUFDO0FBRS9LLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQW1CLFlBQVksRUFBZSxNQUFNLDZCQUE2QixDQUFDO0FBQ2pQLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFekQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHNDQUFzQyxDQUFDO0FBRXZHLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1B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QUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ25ELEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZmxhdHRlbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nLCBjb252ZXJ0VXBkYXRlQXJndW1lbnRzLCBMb2NhbFJlc29sdmVyfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFBhcnNlZEV2ZW50VHlwZSwgUHJvcGVydHlSZWFkLCBUaGlzUmVjZWl2ZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge0l2eVBhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yLCBwYXJ0aXRpb25BcnJheX0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7STE4bkNvbnRleHR9IGZyb20gJy4vaTE4bi9jb250ZXh0JztcbmltcG9ydCB7Y3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4vaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge0kxOG5NZXRhVmlzaXRvcn0gZnJvbSAnLi9pMThuL21ldGEnO1xuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgYXNzZW1ibGVJMThuQm91bmRTdHJpbmcsIGRlY2xhcmVJMThuVmFyaWFibGUsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgsIGhhc0kxOG5NZXRhLCBJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNoYWluZWRJbnN0cnVjdGlvbiwgQ09OVEVYVF9OQU1FLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nLCBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCwgSU1QTElDSVRfUkVGRVJFTkNFLCBpbnZhbGlkLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBHbG9iYWwgc3ltYm9scyBhdmFpbGFibGUgb25seSBpbnNpZGUgZXZlbnQgYmluZGluZ3MuXG5jb25zdCBFVkVOVF9CSU5ESU5HX1NDT1BFX0dMT0JBTFMgPSBuZXcgU2V0PHN0cmluZz4oWyckZXZlbnQnXSk7XG5cbi8vIExpc3Qgb2Ygc3VwcG9ydGVkIGdsb2JhbCB0YXJnZXRzIGZvciBldmVudCBsaXN0ZW5lcnNcbmNvbnN0IEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTID0gbmV3IE1hcDxzdHJpbmcsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFxuICAgIFtbJ3dpbmRvdycsIFIzLnJlc29sdmVXaW5kb3ddLCBbJ2RvY3VtZW50JywgUjMucmVzb2x2ZURvY3VtZW50XSwgWydib2R5JywgUjMucmVzb2x2ZUJvZHldXSk7XG5cbmNvbnN0IExFQURJTkdfVFJJVklBX0NIQVJTID0gWycgJywgJ1xcbicsICdcXHInLCAnXFx0J107XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhcbiAgICBldmVudEFzdDogdC5Cb3VuZEV2ZW50LCBoYW5kbGVyTmFtZTogc3RyaW5nfG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHt0eXBlLCBuYW1lLCB0YXJnZXQsIHBoYXNlLCBoYW5kbGVyfSA9IGV2ZW50QXN0O1xuICBpZiAodGFyZ2V0ICYmICFHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5oYXModGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBnbG9iYWwgdGFyZ2V0ICcke3RhcmdldH0nIGRlZmluZWQgZm9yICcke25hbWV9JyBldmVudC5cbiAgICAgICAgU3VwcG9ydGVkIGxpc3Qgb2YgZ2xvYmFsIHRhcmdldHM6ICR7QXJyYXkuZnJvbShHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5rZXlzKCkpfS5gKTtcbiAgfVxuXG4gIGNvbnN0IGV2ZW50QXJndW1lbnROYW1lID0gJyRldmVudCc7XG4gIGNvbnN0IGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3NlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBpbXBsaWNpdFJlY2VpdmVyRXhwciA9IChzY29wZSA9PT0gbnVsbCB8fCBzY29wZS5iaW5kaW5nTGV2ZWwgPT09IDApID9cbiAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICBzY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICBzY29wZSwgaW1wbGljaXRSZWNlaXZlckV4cHIsIGhhbmRsZXIsICdiJywgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpLFxuICAgICAgZXZlbnRBc3QuaGFuZGxlclNwYW4sIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3NlcywgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBpZiAoc2NvcGUpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSk7XG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnNjb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkpO1xuICB9XG4gIHN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5yZW5kZXIzU3RtdHMpO1xuXG4gIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID1cbiAgICAgIHR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWUsIHBoYXNlISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3M6IG8uRm5QYXJhbVtdID0gW107XG5cbiAgaWYgKGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcy5oYXMoZXZlbnRBcmd1bWVudE5hbWUpKSB7XG4gICAgZm5BcmdzLnB1c2gobmV3IG8uRm5QYXJhbShldmVudEFyZ3VtZW50TmFtZSwgby5EWU5BTUlDX1RZUEUpKTtcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZXJGbiA9IG8uZm4oZm5BcmdzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZuTmFtZSk7XG4gIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGV2ZW50TmFtZSksIGhhbmRsZXJGbl07XG4gIGlmICh0YXJnZXQpIHtcbiAgICBwYXJhbXMucHVzaChcbiAgICAgICAgby5saXRlcmFsKGZhbHNlKSwgIC8vIGB1c2VDYXB0dXJlYCBmbGFnLCBkZWZhdWx0cyB0byBgZmFsc2VgXG4gICAgICAgIG8uaW1wb3J0RXhwcihHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5nZXQodGFyZ2V0KSEpKTtcbiAgfVxuICByZXR1cm4gcGFyYW1zO1xufVxuXG4vLyBDb2xsZWN0cyBpbmZvcm1hdGlvbiBuZWVkZWQgdG8gZ2VuZXJhdGUgYGNvbnN0c2AgZmllbGQgb2YgdGhlIENvbXBvbmVudERlZi5cbi8vIFdoZW4gYSBjb25zdGFudCByZXF1aXJlcyBzb21lIHByZS1wcm9jZXNzaW5nLCB0aGUgYHByZXBhcmVTdGF0ZW1lbnRzYCBzZWN0aW9uXG4vLyBjb250YWlucyBjb3JyZXNwb25kaW5nIHN0YXRlbWVudHMuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBvbmVudERlZkNvbnN0cyB7XG4gIHByZXBhcmVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xuICBjb25zdEV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50RGVmQ29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gIHJldHVybiB7cHJlcGFyZVN0YXRlbWVudHM6IFtdLCBjb25zdEV4cHJlc3Npb25zOiBbXX07XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuXG4gIC8qKiBJbmRleCBvZiB0aGUgY3VycmVudGx5LXNlbGVjdGVkIG5vZGUuICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRleDogbnVtYmVyID0gMDtcblxuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgX2NvbnN0YW50czogQ29tcG9uZW50RGVmQ29uc3RzID0gY3JlYXRlQ29tcG9uZW50RGVmQ29uc3RzKCkpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPSBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUobGV2ZWwpO1xuXG4gICAgLy8gVHVybiB0aGUgcmVsYXRpdmUgY29udGV4dCBmaWxlIHBhdGggaW50byBhbiBpZGVudGlmaWVyIGJ5IHJlcGxhY2luZyBub24tYWxwaGFudW1lcmljXG4gICAgLy8gY2hhcmFjdGVycyB3aXRoIHVuZGVyc2NvcmVzLlxuICAgIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCA9IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpICsgJ18nO1xuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChudW1TbG90czogbnVtYmVyKSA9PiB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHMpLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQodGhpcy5sZXZlbCwgbG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnBpcGUsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChuYW1lKV0pO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIG5nQ29udGVudFNlbGVjdG9yc09mZnNldDogbnVtYmVyID0gMCxcbiAgICAgIGkxOG4/OiBpMThuLkkxOG5NZXRhKTogby5GdW5jdGlvbkV4cHIge1xuICAgIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCA9IG5nQ29udGVudFNlbGVjdG9yc09mZnNldDtcblxuICAgIGlmICh0aGlzLl9uYW1lc3BhY2UgIT09IFIzLm5hbWVzcGFjZUhUTUwpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCB0aGlzLl9uYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIHZhcmlhYmxlcy5mb3JFYWNoKHYgPT4gdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXModikpO1xuXG4gICAgLy8gSW5pdGlhdGUgaTE4biBjb250ZXh0IGluIGNhc2U6XG4gICAgLy8gLSB0aGlzIHRlbXBsYXRlIGhhcyBwYXJlbnQgaTE4biBjb250ZXh0XG4gICAgLy8gLSBvciB0aGUgdGVtcGxhdGUgaGFzIGkxOG4gbWV0YSBhc3NvY2lhdGVkIHdpdGggaXQsXG4gICAgLy8gICBidXQgaXQncyBub3QgaW5pdGlhdGVkIGJ5IHRoZSBFbGVtZW50IChlLmcuIDxuZy10ZW1wbGF0ZSBpMThuPilcbiAgICBjb25zdCBpbml0STE4bkNvbnRleHQgPSB0aGlzLmkxOG5Db250ZXh0IHx8XG4gICAgICAgIChpc0kxOG5Sb290Tm9kZShpMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGkxOG4pICYmXG4gICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuISwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgdGhlIGluaXRpYWwgcGFzcyB0aHJvdWdoIHRoZSBub2RlcyBvZiB0aGlzIHRlbXBsYXRlLiBJbiB0aGlzIHBhc3MsIHdlXG4gICAgLy8gcXVldWUgYWxsIGNyZWF0aW9uIG1vZGUgYW5kIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyBmb3IgZ2VuZXJhdGlvbiBpbiB0aGUgc2Vjb25kXG4gICAgLy8gcGFzcy4gSXQncyBuZWNlc3NhcnkgdG8gc2VwYXJhdGUgdGhlIHBhc3NlcyB0byBlbnN1cmUgbG9jYWwgcmVmcyBhcmUgZGVmaW5lZCBiZWZvcmVcbiAgICAvLyByZXNvbHZpbmcgYmluZGluZ3MuIFdlIGFsc28gY291bnQgYmluZGluZ3MgaW4gdGhpcyBwYXNzIGFzIHdlIHdhbGsgYm91bmQgZXhwcmVzc2lvbnMuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICAvLyBBZGQgdG90YWwgYmluZGluZyBjb3VudCB0byBwdXJlIGZ1bmN0aW9uIGNvdW50IHNvIHB1cmUgZnVuY3Rpb24gaW5zdHJ1Y3Rpb25zIGFyZVxuICAgIC8vIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IHNsb3Qgb2Zmc2V0IHdoZW4gdXBkYXRlIGluc3RydWN0aW9ucyBhcmUgcHJvY2Vzc2VkLlxuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IHRoaXMuX2JpbmRpbmdTbG90cztcblxuICAgIC8vIFBpcGVzIGFyZSB3YWxrZWQgaW4gdGhlIGZpcnN0IHBhc3MgKHRvIGVucXVldWUgYHBpcGUoKWAgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGFuZFxuICAgIC8vIGBwaXBlQmluZGAgdXBkYXRlIGluc3RydWN0aW9ucyksIHNvIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBzbG90IG9mZnNldHMgbWFudWFsbHlcbiAgICAvLyB0byBhY2NvdW50IGZvciBiaW5kaW5ncy5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlci51cGRhdGVQaXBlU2xvdE9mZnNldHModGhpcy5fYmluZGluZ1Nsb3RzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBiZSBwcm9jZXNzZWQgYmVmb3JlIGNyZWF0aW9uIGluc3RydWN0aW9ucyBzbyB0ZW1wbGF0ZSgpXG4gICAgLy8gaW5zdHJ1Y3Rpb25zIGNhbiBiZSBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBpbnRlcm5hbCBjb25zdCBjb3VudC5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5mb3JFYWNoKGJ1aWxkVGVtcGxhdGVGbiA9PiBidWlsZFRlbXBsYXRlRm4oKSk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgdGFncyBhcmUgcHJlc2VudC5cbiAgICAvLyBUaGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIGlzIG9ubHkgZW1pdHRlZCBmb3IgdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZSBhbmRcbiAgICAvLyBpcyBza2lwcGVkIGZvciBuZXN0ZWQgdGVtcGxhdGVzICg8bmctdGVtcGxhdGU+IHRhZ3MpLlxuICAgIGlmICh0aGlzLmxldmVsID09PSAwICYmIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBCeSBkZWZhdWx0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb25zIGNyZWF0ZXMgb25lIHNsb3QgZm9yIHRoZSB3aWxkY2FyZFxuICAgICAgLy8gc2VsZWN0b3IgaWYgbm8gcGFyYW1ldGVycyBhcmUgcGFzc2VkLiBUaGVyZWZvcmUgd2Ugb25seSB3YW50IHRvIGFsbG9jYXRlIGEgbmV3XG4gICAgICAvLyBhcnJheSBmb3IgdGhlIHByb2plY3Rpb24gc2xvdHMgaWYgdGhlIGRlZmF1bHQgcHJvamVjdGlvbiBzbG90IGlzIG5vdCBzdWZmaWNpZW50LlxuICAgICAgaWYgKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID4gMSB8fCB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzWzBdICE9PSAnKicpIHtcbiAgICAgICAgY29uc3QgcjNSZXNlcnZlZFNsb3RzID0gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5tYXAoXG4gICAgICAgICAgICBzID0+IHMgIT09ICcqJyA/IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSA6IHMpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1Jlc2VydmVkU2xvdHMpLCB0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbmNlIHdlIGFjY3VtdWxhdGUgbmdDb250ZW50IHNlbGVjdG9ycyB3aGlsZSBwcm9jZXNzaW5nIHRlbXBsYXRlIGVsZW1lbnRzLFxuICAgICAgLy8gd2UgKnByZXBlbmQqIGBwcm9qZWN0aW9uRGVmYCB0byBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYmxvY2ssIHRvIHB1dCBpdCBiZWZvcmVcbiAgICAgIC8vIGFueSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb25zXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycywgLyogcHJlcGVuZCAqLyB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gdGhpcy5fdXBkYXRlQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyAgVmFyaWFibGUgZGVjbGFyYXRpb24gbXVzdCBvY2N1ciBhZnRlciBiaW5kaW5nIHJlc29sdXRpb24gc28gd2UgY2FuIGdlbmVyYXRlIGNvbnRleHRcbiAgICAvLyAgaW5zdHJ1Y3Rpb25zIHRoYXQgYnVpbGQgb24gZWFjaCBvdGhlci5cbiAgICAvLyBlLmcuIGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpLiRpbXBsaWNpdCgpOyBjb25zdCBiID0gbmV4dENvbnRleHQoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdTY29wZS5nZXQobmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCB0aGlzLmkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpO1xuICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXIgY29uc3QgdG9cbiAgICAvLyBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgIGNvbnN0IGNsb3N1cmVWYXIgPSB0aGlzLmkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZS5pZCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKG1lc3NhZ2UsIF9yZWYsIGNsb3N1cmVWYXIsIHBhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgIHRoaXMuX2NvbnN0YW50cy5wcmVwYXJlU3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnM6IEFTVFtdKSB7XG4gICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB0aGlzLmkxOG4hLmFwcGVuZEJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4bkJpbmRQcm9wcyhwcm9wczoge1trZXk6IHN0cmluZ106IHQuVGV4dHx0LkJvdW5kVGV4dH0pOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSB7XG4gICAgY29uc3QgYm91bmQ6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgT2JqZWN0LmtleXMocHJvcHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSBwcm9wc1trZXldO1xuICAgICAgaWYgKHByb3AgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChwcm9wLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgY29uc3Qge3N0cmluZ3MsIGV4cHJlc3Npb25zfSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnN0IHtpZCwgYmluZGluZ3N9ID0gdGhpcy5pMThuITtcbiAgICAgICAgICBjb25zdCBsYWJlbCA9IGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nKHN0cmluZ3MsIGJpbmRpbmdzLnNpemUsIGlkKTtcbiAgICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9ucyk7XG4gICAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChsYWJlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH1cblxuICAvLyBHZW5lcmF0ZXMgdG9wIGxldmVsIHZhcnMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBpMThuX05gKS5cbiAgcHJpdmF0ZSBpMThuR2VuZXJhdGVNYWluQmxvY2tWYXIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShUUkFOU0xBVElPTl9WQVJfUFJFRklYKSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZXMgdmFycyB3aXRoIENsb3N1cmUtc3BlY2lmaWMgbmFtZXMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBNU0dfWFhYYCkuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4blN0YXJ0KHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgbWV0YTogaTE4bi5JMThuTWV0YSwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTpcbiAgICAgIHZvaWQge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgdGhpcy5pMThuID0gdGhpcy5pMThuQ29udGV4dCA/XG4gICAgICAgIHRoaXMuaTE4bkNvbnRleHQuZm9ya0NoaWxkQ29udGV4dChpbmRleCwgdGhpcy50ZW1wbGF0ZUluZGV4ISwgbWV0YSkgOlxuICAgICAgICBuZXcgSTE4bkNvbnRleHQoaW5kZXgsIHRoaXMuaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCksIDAsIHRoaXMudGVtcGxhdGVJbmRleCwgbWV0YSk7XG5cbiAgICAvLyBnZW5lcmF0ZSBpMThuU3RhcnQgaW5zdHJ1Y3Rpb25cbiAgICBjb25zdCB7aWQsIHJlZn0gPSB0aGlzLmkxOG47XG4gICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoaW5kZXgpLCB0aGlzLmFkZFRvQ29uc3RzKHJlZildO1xuICAgIGlmIChpZCA+IDApIHtcbiAgICAgIC8vIGRvIG5vdCBwdXNoIDNyZCBhcmd1bWVudCAoc3ViLWJsb2NrIGlkKVxuICAgICAgLy8gaW50byBpMThuU3RhcnQgY2FsbCBmb3IgdG9wIGxldmVsIGkxOG4gY29udGV4dFxuICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlkKSk7XG4gICAgfVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBzZWxmQ2xvc2luZyA/IFIzLmkxOG4gOiBSMy5pMThuU3RhcnQsIHBhcmFtcyk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgY29uc3QgY2hhaW5CaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICAgIGJpbmRpbmdzLmZvckVhY2goYmluZGluZyA9PiB7XG4gICAgICAgIGNoYWluQmluZGluZ3MucHVzaCh7c291cmNlU3Bhbjogc3BhbiwgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhiaW5kaW5nKX0pO1xuICAgICAgfSk7XG4gICAgICAvLyBmb3IgaTE4biBibG9jaywgYWR2YW5jZSB0byB0aGUgbW9zdCByZWNlbnQgZWxlbWVudCBpbmRleCAoYnkgdGFraW5nIHRoZSBjdXJyZW50IG51bWJlciBvZlxuICAgICAgLy8gZWxlbWVudHMgYW5kIHN1YnRyYWN0aW5nIG9uZSkgYmVmb3JlIGludm9raW5nIGBpMThuRXhwYCBpbnN0cnVjdGlvbnMsIHRvIG1ha2Ugc3VyZSB0aGVcbiAgICAgIC8vIG5lY2Vzc2FyeSBsaWZlY3ljbGUgaG9va3Mgb2YgY29tcG9uZW50cy9kaXJlY3RpdmVzIGFyZSBwcm9wZXJseSBmbHVzaGVkLlxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UodGhpcy5nZXRDb25zdENvdW50KCkgLSAxLCBSMy5pMThuRXhwLCBjaGFpbkJpbmRpbmdzKTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkFwcGx5LCBbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIH1cbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkVuZCk7XG4gICAgfVxuICAgIHRoaXMuaTE4biA9IG51bGw7ICAvLyByZXNldCBsb2NhbCBpMThuIGNvbnRleHRcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkF0dHJpYnV0ZXNJbnN0cnVjdGlvbihcbiAgICAgIG5vZGVJbmRleDogbnVtYmVyLCBhdHRyczogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiB2b2lkIHtcbiAgICBsZXQgaGFzQmluZGluZ3M6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpMThuQXR0ckFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgYXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhdHRyLmkxOG4hIGFzIGkxOG4uTWVzc2FnZTtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IGF0dHIudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhjb252ZXJ0ZWQpO1xuICAgICAgaWYgKGNvbnZlcnRlZCBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMobWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycyk7XG4gICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGFyYW1zKSk7XG4gICAgICAgIGNvbnZlcnRlZC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgICAgIGhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoYmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2Uobm9kZUluZGV4LCBSMy5pMThuRXhwLCBiaW5kaW5ncyk7XG4gICAgfVxuICAgIGlmIChpMThuQXR0ckFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgaW5kZXg6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSk7XG4gICAgICBjb25zdCBjb25zdEluZGV4ID0gdGhpcy5hZGRUb0NvbnN0cyhvLmxpdGVyYWxBcnIoaTE4bkF0dHJBcmdzKSk7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc291cmNlU3BhbiwgUjMuaTE4bkF0dHJpYnV0ZXMsIFtpbmRleCwgY29uc3RJbmRleF0pO1xuICAgICAgaWYgKGhhc0JpbmRpbmdzKSB7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc291cmNlU3BhbiwgUjMuaTE4bkFwcGx5LCBbaW5kZXhdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgbnNJbnN0cnVjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eSBvciBhdHRyaWJ1dGUsIHN1Y2ggYXNcbiAgICogYHByb3A9XCJ7e3ZhbHVlfX1cImAgb3IgYGF0dHIudGl0bGU9XCJ7e3ZhbHVlfX1cImBcbiAgICovXG4gIHByaXZhdGUgaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgdmFsdWU6IGFueSwgcGFyYW1zOiBhbnlbXSkge1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbixcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChhdHRyTmFtZSksIC4uLnRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpLCAuLi5wYXJhbXNdKTtcbiAgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBwcm9qZWN0aW9uU2xvdElkeCA9IHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCArIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoO1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG5cbiAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKTtcblxuICAgIGNvbnN0IG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzID1cbiAgICAgICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZmlsdGVyKGF0dHIgPT4gYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPVxuICAgICAgICB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKG5nQ29udGVudC5uYW1lLCBub25Db250ZW50U2VsZWN0QXR0cmlidXRlcywgW10sIFtdKTtcblxuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpLCBvLmxpdGVyYWxBcnIoYXR0cmlidXRlcykpO1xuICAgIH0gZWxzZSBpZiAocHJvamVjdGlvblNsb3RJZHggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRQcm9qZWN0aW9uKG5nQ29udGVudC5pMThuISwgc2xvdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHN0eWxpbmdCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKG51bGwpO1xuXG4gICAgbGV0IGlzTm9uQmluZGFibGVNb2RlOiBib29sZWFuID0gZmFsc2U7XG4gICAgY29uc3QgaXNJMThuUm9vdEVsZW1lbnQ6IGJvb2xlYW4gPVxuICAgICAgICBpc0kxOG5Sb290Tm9kZShlbGVtZW50LmkxOG4pICYmICFpc1NpbmdsZUkxOG5JY3UoZWxlbWVudC5pMThuKTtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gSGFuZGxlIHN0eWxpbmcsIGkxOG4sIG5nTm9uQmluZGFibGUgYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHtuYW1lLCB2YWx1ZX0gPSBhdHRyO1xuICAgICAgaWYgKG5hbWUgPT09IE5PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICAgIGlzTm9uQmluZGFibGVNb2RlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0QXR0cnMucHVzaChhdHRyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGFsbE90aGVySW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBib3VuZEkxOG5BdHRyczogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIGJvdW5kSTE4bkF0dHJzLnB1c2goaW5wdXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgYXR0cmlidXRlcyBmb3IgZGlyZWN0aXZlIGFuZCBwcm9qZWN0aW9uIG1hdGNoaW5nIHB1cnBvc2VzXG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgICBlbGVtZW50Lm5hbWUsIG91dHB1dEF0dHJzLCBhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzLCBzdHlsaW5nQnVpbGRlciwgW10sXG4gICAgICAgIGJvdW5kSTE4bkF0dHJzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJpYnV0ZXMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPGRpdiAjZm9vICNiYXI9XCJiYXpcIj4pXG4gICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheShlbGVtZW50LnJlZmVyZW5jZXMpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcblxuICAgIGNvbnN0IHdhc0luTmFtZXNwYWNlID0gdGhpcy5fbmFtZXNwYWNlO1xuICAgIGNvbnN0IGN1cnJlbnROYW1lc3BhY2UgPSB0aGlzLmdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleSk7XG5cbiAgICAvLyBJZiB0aGUgbmFtZXNwYWNlIGlzIGNoYW5naW5nIG5vdywgaW5jbHVkZSBhbiBpbnN0cnVjdGlvbiB0byBjaGFuZ2UgaXRcbiAgICAvLyBkdXJpbmcgZWxlbWVudCBjcmVhdGlvbi5cbiAgICBpZiAoY3VycmVudE5hbWVzcGFjZSAhPT0gd2FzSW5OYW1lc3BhY2UpIHtcbiAgICAgIHRoaXMuYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24oY3VycmVudE5hbWVzcGFjZSwgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuISwgZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZG8gbm90IGFwcGVuZCB0ZXh0IG5vZGUgaW5zdHJ1Y3Rpb25zIGFuZCBJQ1VzIGluc2lkZSBpMThuIHNlY3Rpb24sXG4gICAgLy8gc28gd2UgZXhjbHVkZSB0aGVtIHdoaWxlIGNhbGN1bGF0aW5nIHdoZXRoZXIgY3VycmVudCBlbGVtZW50IGhhcyBjaGlsZHJlblxuICAgIGNvbnN0IGhhc0NoaWxkcmVuID0gKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pID8gIWhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwO1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiA9ICFzdHlsaW5nQnVpbGRlci5oYXNCaW5kaW5nc1dpdGhQaXBlcyAmJlxuICAgICAgICBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwICYmIGJvdW5kSTE4bkF0dHJzLmxlbmd0aCA9PT0gMCAmJiAhaGFzQ2hpbGRyZW47XG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyIDogUjMuZWxlbWVudCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIFIzLmRpc2FibGVCaW5kaW5ncyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChib3VuZEkxOG5BdHRycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMuaTE4bkF0dHJpYnV0ZXNJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIGVsZW1lbnRJbmRleCwgYm91bmRJMThuQXR0cnMsIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICAgIGlmIChlbGVtZW50Lm91dHB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBlbGVtZW50Lm91dHB1dHMubWFwKFxuICAgICAgICAgICAgKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiAoe1xuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBvdXRwdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgcGFyYW1zOiB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcihlbGVtZW50Lm5hbWUsIG91dHB1dEFzdCwgZWxlbWVudEluZGV4KVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihSMy5saXN0ZW5lciwgbGlzdGVuZXJzKTtcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZTogaXQncyBpbXBvcnRhbnQgdG8ga2VlcCBpMThuL2kxOG5TdGFydCBpbnN0cnVjdGlvbnMgYWZ0ZXIgaTE4bkF0dHJpYnV0ZXMgYW5kXG4gICAgICAvLyBsaXN0ZW5lcnMsIHRvIG1ha2Ugc3VyZSBpMThuQXR0cmlidXRlcyBpbnN0cnVjdGlvbiB0YXJnZXRzIGN1cnJlbnQgZWxlbWVudCBhdCBydW50aW1lLlxuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4blN0YXJ0KGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4hLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGNvZGUgaGVyZSB3aWxsIGNvbGxlY3QgYWxsIHVwZGF0ZS1sZXZlbCBzdHlsaW5nIGluc3RydWN0aW9ucyBhbmQgYWRkIHRoZW0gdG8gdGhlXG4gICAgLy8gdXBkYXRlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1QgY29kZS4gSW5zdHJ1Y3Rpb25zIGxpa2UgYHN0eWxlUHJvcGAsXG4gICAgLy8gYHN0eWxlTWFwYCwgYGNsYXNzTWFwYCwgYGNsYXNzUHJvcGBcbiAgICAvLyBhcmUgYWxsIGdlbmVyYXRlZCBhbmQgYXNzaWduZWQgaW4gdGhlIGNvZGUgYmVsb3cuXG4gICAgY29uc3Qgc3R5bGluZ0luc3RydWN0aW9ucyA9IHN0eWxpbmdCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIGNvbnN0IGxpbWl0ID0gc3R5bGluZ0luc3RydWN0aW9ucy5sZW5ndGggLSAxO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gc3R5bGluZ0luc3RydWN0aW9uc1tpXTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB0aGlzLnByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gdGhlIHJlYXNvbiB3aHkgYHVuZGVmaW5lZGAgaXMgdXNlZCBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciB1bmRlcnN0YW5kcyB0aGlzIGFzIGFcbiAgICAvLyBzcGVjaWFsIHZhbHVlIHRvIHN5bWJvbGl6ZSB0aGF0IHRoZXJlIGlzIG5vIFJIUyB0byB0aGlzIGJpbmRpbmdcbiAgICAvLyBUT0RPIChtYXRza28pOiByZXZpc2l0IHRoaXMgb25jZSBGVy05NTkgaXMgYXBwcm9hY2hlZFxuICAgIGNvbnN0IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb24gPSBvLmxpdGVyYWwodW5kZWZpbmVkKTtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgaW5wdXRUeXBlID0gaW5wdXQudHlwZTtcbiAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gYW5pbWF0aW9uIGJpbmRpbmdzIGNhbiBiZSBwcmVzZW50ZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXRzOlxuICAgICAgICAvLyAxLiBbQGJpbmRpbmddPVwiZm9vRXhwXCJcbiAgICAgICAgLy8gMi4gW0BiaW5kaW5nXT1cInt2YWx1ZTpmb29FeHAsIHBhcmFtczp7Li4ufX1cIlxuICAgICAgICAvLyAzLiBbQGJpbmRpbmddXG4gICAgICAgIC8vIDQuIEBiaW5kaW5nXG4gICAgICAgIC8vIEFsbCBmb3JtYXRzIHdpbGwgYmUgdmFsaWQgZm9yIHdoZW4gYSBzeW50aGV0aWMgYmluZGluZyBpcyBjcmVhdGVkLlxuICAgICAgICAvLyBUaGUgcmVhc29uaW5nIGZvciB0aGlzIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHNob3VsZCBnZXQgZWFjaFxuICAgICAgICAvLyBzeW50aGV0aWMgYmluZGluZyB2YWx1ZSBpbiB0aGUgb3JkZXIgb2YgdGhlIGFycmF5IHRoYXQgdGhleSBhcmVcbiAgICAgICAgLy8gZGVmaW5lZCBpbi4uLlxuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgTGl0ZXJhbFByaW1pdGl2ZSA/ICEhdmFsdWUudmFsdWUgOiB0cnVlO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoaW5wdXQubmFtZSksXG4gICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICB2YWx1ZTogKCkgPT4gaGFzVmFsdWUgPyB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpIDogZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIG11c3Qgc2tpcCBhdHRyaWJ1dGVzIHdpdGggYXNzb2NpYXRlZCBpMThuIGNvbnRleHQsIHNpbmNlIHRoZXNlIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWRcbiAgICAgICAgLy8gc2VwYXJhdGVseSBhbmQgY29ycmVzcG9uZGluZyBgaTE4bkV4cGAgYW5kIGBpMThuQXBwbHlgIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAgICBpZiAoaW5wdXQuaTE4bikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBbYXR0ck5hbWVzcGFjZSwgYXR0ck5hbWVdID0gc3BsaXROc05hbWUoaW5wdXQubmFtZSk7XG4gICAgICAgICAgY29uc3QgaXNBdHRyaWJ1dGVCaW5kaW5nID0gaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LnNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGVCaW5kaW5nKTtcbiAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VMaXRlcmFsID0gby5saXRlcmFsKGF0dHJOYW1lc3BhY2UpO1xuXG4gICAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2Fzbid0IGEgc2FuaXRpemF0aW9uIHJlZiwgd2UgbmVlZCB0byBhZGRcbiAgICAgICAgICAgICAgLy8gYW4gZXh0cmEgcGFyYW0gc28gdGhhdCB3ZSBjYW4gcGFzcyBpbiB0aGUgbmFtZXNwYWNlLlxuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCksIG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBbcHJvcF09XCJ2YWx1ZVwiXG4gICAgICAgICAgICAgIC8vIENvbGxlY3QgYWxsIHRoZSBwcm9wZXJ0aWVzIHNvIHRoYXQgd2UgY2FuIGNoYWluIGludG8gYSBzaW5nbGUgZnVuY3Rpb24gYXQgdGhlIGVuZC5cbiAgICAgICAgICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhdHRyTmFtZSxcbiAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpLFxuICAgICAgICAgICAgICAgIHBhcmFtc1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uICYmIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKHZhbHVlKSA+IDEpIHtcbiAgICAgICAgICAgICAgLy8gYXR0ci5uYW1lPVwidGV4dHt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBib3VuZFZhbHVlID0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnNbMF0gOiB2YWx1ZTtcbiAgICAgICAgICAgICAgLy8gW2F0dHIubmFtZV09XCJ2YWx1ZVwiIG9yIGF0dHIubmFtZT1cInt7dmFsdWV9fVwiXG4gICAgICAgICAgICAgIC8vIENvbGxlY3QgdGhlIGF0dHJpYnV0ZSBiaW5kaW5ncyBzbyB0aGF0IHRoZXkgY2FuIGJlIGNoYWluZWQgYXQgdGhlIGVuZC5cbiAgICAgICAgICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXR0ck5hbWUsXG4gICAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJvdW5kVmFsdWUpLFxuICAgICAgICAgICAgICAgIHBhcmFtc1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xhc3MgcHJvcFxuICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChwcm9wZXJ0eUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZ3MpO1xuICAgIH1cblxuICAgIGlmIChhdHRyaWJ1dGVCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIFIzLmF0dHJpYnV0ZSwgYXR0cmlidXRlQmluZGluZ3MpO1xuICAgIH1cblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biEsIGVsZW1lbnRJbmRleCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGNvbnN0IHNwYW4gPSBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuO1xuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4bkVuZChzcGFuLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmVuYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cbiAgfVxuXG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogdC5UZW1wbGF0ZSkge1xuICAgIGNvbnN0IE5HX1RFTVBMQVRFX1RBR19OQU1FID0gJ25nLXRlbXBsYXRlJztcbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kVGVtcGxhdGUodGVtcGxhdGUuaTE4biEsIHRlbXBsYXRlSW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSB8fCAnJyk7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfSR7dGFnTmFtZSA/ICdfJyArIHRhZ05hbWUgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuXG4gICAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgICAgLy8gaXQgYmFzZWQgb24gdGhlIHBhcmVudCBub2RlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLlxuICAgICAgby5saXRlcmFsKHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWUpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgICAgTkdfVEVNUExBVEVfVEFHX05BTUUsIHRlbXBsYXRlLmF0dHJpYnV0ZXMsIHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cyxcbiAgICAgICAgdW5kZWZpbmVkIC8qIHN0eWxlcyAqLywgdGVtcGxhdGUudGVtcGxhdGVBdHRycyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheSh0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmltcG9ydEV4cHIoUjMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGhpcy5pMThuLFxuICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZU5hbWUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlciwgdGhpcy5kaXJlY3RpdmVzLCB0aGlzLnBpcGVUeXBlQnlOYW1lLFxuICAgICAgICB0aGlzLnBpcGVzLCB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgICAgIHRoaXMuX2NvbnN0YW50cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgPG5nLXRlbXBsYXRlPiBlbGVtZW50cy5cbiAgICBpZiAodGVtcGxhdGUudGFnTmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUpIHtcbiAgICAgIGNvbnN0IFtpMThuSW5wdXRzLCBpbnB1dHNdID1cbiAgICAgICAgICBwYXJ0aXRpb25BcnJheTx0LkJvdW5kQXR0cmlidXRlLCB0LkJvdW5kQXR0cmlidXRlPih0ZW1wbGF0ZS5pbnB1dHMsIGhhc0kxOG5NZXRhKTtcblxuICAgICAgLy8gQWRkIGkxOG4gYXR0cmlidXRlcyB0aGF0IG1heSBhY3QgYXMgaW5wdXRzIHRvIGRpcmVjdGl2ZXMuIElmIHN1Y2ggYXR0cmlidXRlcyBhcmUgcHJlc2VudCxcbiAgICAgIC8vIGdlbmVyYXRlIGBpMThuQXR0cmlidXRlc2AgaW5zdHJ1Y3Rpb24uIE5vdGU6IHdlIGdlbmVyYXRlIGl0IG9ubHkgZm9yIGV4cGxpY2l0IDxuZy10ZW1wbGF0ZT5cbiAgICAgIC8vIGVsZW1lbnRzLCBpbiBjYXNlIG9mIGlubGluZSB0ZW1wbGF0ZXMsIGNvcnJlc3BvbmRpbmcgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZVxuICAgICAgLy8gbmVzdGVkIHRlbXBsYXRlIGZ1bmN0aW9uLlxuICAgICAgaWYgKGkxOG5JbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCBpMThuSW5wdXRzLCB0ZW1wbGF0ZS5zdGFydFNvdXJjZVNwYW4gPz8gdGVtcGxhdGUuc291cmNlU3Bhbik7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgaW5wdXQgYmluZGluZ3NcbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCBpbnB1dHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBsaXN0ZW5lcnMgZm9yIGRpcmVjdGl2ZSBvdXRwdXRcbiAgICAgIGlmICh0ZW1wbGF0ZS5vdXRwdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGVtcGxhdGUub3V0cHV0cy5tYXAoXG4gICAgICAgICAgICAob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+ICh7XG4gICAgICAgICAgICAgIHNvdXJjZVNwYW46IG91dHB1dEFzdC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICBwYXJhbXM6IHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKCduZ190ZW1wbGF0ZScsIG91dHB1dEFzdCwgdGVtcGxhdGVJbmRleClcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uQ2hhaW4oUjMubGlzdGVuZXIsIGxpc3RlbmVycyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kQm91bmRUZXh0KHRleHQuaTE4biEpO1xuICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyh2YWx1ZS5leHByZXNzaW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcblxuICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksXG4gICAgICAgICAgKCkgPT4gdGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvcignVGV4dCBub2RlcyBzaG91bGQgYmUgaW50ZXJwb2xhdGVkIGFuZCBuZXZlciBib3VuZCBkaXJlY3RseS4nKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgLy8gd2hlbiBhIHRleHQgZWxlbWVudCBpcyBsb2NhdGVkIHdpdGhpbiBhIHRyYW5zbGF0YWJsZVxuICAgIC8vIGJsb2NrLCB3ZSBleGNsdWRlIHRoaXMgdGV4dCBlbGVtZW50IGZyb20gaW5zdHJ1Y3Rpb25zIHNldCxcbiAgICAvLyBzaW5jZSBpdCB3aWxsIGJlIGNhcHR1cmVkIGluIGkxOG4gY29udGVudCBhbmQgcHJvY2Vzc2VkIGF0IHJ1bnRpbWVcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogdC5JY3UpIHtcbiAgICBsZXQgaW5pdFdhc0ludm9rZWQgPSBmYWxzZTtcblxuICAgIC8vIGlmIGFuIElDVSB3YXMgY3JlYXRlZCBvdXRzaWRlIG9mIGkxOG4gYmxvY2ssIHdlIHN0aWxsIHRyZWF0XG4gICAgLy8gaXQgYXMgYSB0cmFuc2xhdGFibGUgZW50aXR5IGFuZCBpbnZva2UgaTE4blN0YXJ0IGFuZCBpMThuRW5kXG4gICAgLy8gdG8gZ2VuZXJhdGUgaTE4biBjb250ZXh0IGFuZCB0aGUgbmVjZXNzYXJ5IGluc3RydWN0aW9uc1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICBpbml0V2FzSW52b2tlZCA9IHRydWU7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpY3UuaTE4biEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4hO1xuICAgIGNvbnN0IHZhcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnZhcnMpO1xuICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UucGxhY2Vob2xkZXJzKTtcblxuICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgY29uc3QgbWVzc2FnZSA9IGljdS5pMThuISBhcyBpMThuLk1lc3NhZ2U7XG5cbiAgICAvLyB3ZSBhbHdheXMgbmVlZCBwb3N0LXByb2Nlc3NpbmcgZnVuY3Rpb24gZm9yIElDVXMsIHRvIG1ha2Ugc3VyZSB0aGF0OlxuICAgIC8vIC0gYWxsIHBsYWNlaG9sZGVycyBpbiBhIGZvcm0gb2Yge1BMQUNFSE9MREVSfSBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIChub3RlOlxuICAgIC8vIGBnb29nLmdldE1zZ2AgZG9lcyBub3QgcHJvY2VzcyBJQ1VzIGFuZCB1c2VzIHRoZSBge1BMQUNFSE9MREVSfWAgZm9ybWF0IGZvciBwbGFjZWhvbGRlcnNcbiAgICAvLyBpbnNpZGUgSUNVcylcbiAgICAvLyAtIGFsbCBJQ1UgdmFycyAoc3VjaCBhcyBgVkFSX1NFTEVDVGAgb3IgYFZBUl9QTFVSQUxgKSBhcmUgcmVwbGFjZWQgd2l0aCBjb3JyZWN0IHZhbHVlc1xuICAgIGNvbnN0IHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gey4uLnZhcnMsIC4uLnBsYWNlaG9sZGVyc307XG4gICAgICBjb25zdCBmb3JtYXR0ZWQgPSBpMThuRm9ybWF0UGxhY2Vob2xkZXJOYW1lcyhwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBbcmF3LCBtYXBMaXRlcmFsKGZvcm1hdHRlZCwgdHJ1ZSldKTtcbiAgICB9O1xuXG4gICAgLy8gaW4gY2FzZSB0aGUgd2hvbGUgaTE4biBtZXNzYWdlIGlzIGEgc2luZ2xlIElDVSAtIHdlIGRvIG5vdCBuZWVkIHRvXG4gICAgLy8gY3JlYXRlIGEgc2VwYXJhdGUgdG9wLWxldmVsIHRyYW5zbGF0aW9uLCB3ZSBjYW4gdXNlIHRoZSByb290IHJlZiBpbnN0ZWFkXG4gICAgLy8gYW5kIG1ha2UgdGhpcyBJQ1UgYSB0b3AtbGV2ZWwgdHJhbnNsYXRpb25cbiAgICAvLyBub3RlOiBJQ1UgcGxhY2Vob2xkZXJzIGFyZSByZXBsYWNlZCB3aXRoIGFjdHVhbCB2YWx1ZXMgaW4gYGkxOG5Qb3N0cHJvY2Vzc2AgZnVuY3Rpb25cbiAgICAvLyBzZXBhcmF0ZWx5LCBzbyB3ZSBkbyBub3QgcGFzcyBwbGFjZWhvbGRlcnMgaW50byBgaTE4blRyYW5zbGF0ZWAgZnVuY3Rpb24uXG4gICAgaWYgKGlzU2luZ2xlSTE4bkljdShpMThuLm1ldGEpKSB7XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgLyogcGxhY2Vob2xkZXJzICovIHt9LCBpMThuLnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgICAgY29uc3QgcmVmID1cbiAgICAgICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgLyogcGxhY2Vob2xkZXJzICovIHt9LCAvKiByZWYgKi8gdW5kZWZpbmVkLCB0cmFuc2Zvcm1Gbik7XG4gICAgICBpMThuLmFwcGVuZEljdShpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSkubmFtZSwgcmVmKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdFdhc0ludm9rZWQpIHtcbiAgICAgIHRoaXMuaTE4bkVuZChudWxsLCB0cnVlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrO1xuICB9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGF0YUluZGV4O1xuICB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICB9XG5cbiAgZ2V0Q29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbnN0YW50cztcbiAgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gO1xuICB9XG5cbiAgcHJpdmF0ZSB0ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3MoXG4gICAgICB0ZW1wbGF0ZUluZGV4OiBudW1iZXIsIGF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10pIHtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGF0dHJzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgaWYgKGlucHV0IGluc3RhbmNlb2YgdC5Cb3VuZEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcblxuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgIC8vIFBhcmFtcyB0eXBpY2FsbHkgY29udGFpbiBhdHRyaWJ1dGUgbmFtZXNwYWNlIGFuZCB2YWx1ZSBzYW5pdGl6ZXIsIHdoaWNoIGlzIGFwcGxpY2FibGVcbiAgICAgICAgICAgIC8vIGZvciByZWd1bGFyIEhUTUwgZWxlbWVudHMsIGJ1dCBub3QgYXBwbGljYWJsZSBmb3IgPG5nLXRlbXBsYXRlPiAoc2luY2UgcHJvcHMgYWN0IGFzXG4gICAgICAgICAgICAvLyBpbnB1dHMgdG8gZGlyZWN0aXZlcyksIHNvIGtlZXAgcGFyYW1zIGFycmF5IGVtcHR5LlxuICAgICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgICAgICAvLyBwcm9wPVwie3t2YWx1ZX19XCIgY2FzZVxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgdGVtcGxhdGVJbmRleCwgaW5wdXQubmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCIgY2FzZVxuICAgICAgICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgbmFtZTogaW5wdXQubmFtZSxcbiAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BlcnR5QmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UodGVtcGxhdGVJbmRleCwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm46IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuICAgIGZuc1twcmVwZW5kID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSgoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHBhcmFtc09yRm4pID8gcGFyYW1zT3JGbiA6IHBhcmFtc09yRm4oKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtcykudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBlbGVtZW50SW5kZXg6IG51bWJlciwgaW5zdHJ1Y3Rpb246IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsKSB7XG4gICAgbGV0IGFsbG9jYXRlQmluZGluZ1Nsb3RzID0gMDtcbiAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGNvbnN0IGNhbGxzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gICAgICBpbnN0cnVjdGlvbi5jYWxscy5mb3JFYWNoKGNhbGwgPT4ge1xuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90cyArPSBjYWxsLmFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICAgICAgICBjYWxscy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2VTcGFuOiBjYWxsLnNvdXJjZVNwYW4sXG4gICAgICAgICAgdmFsdWU6ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsLnBhcmFtcyhcbiAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gKGNhbGwuc3VwcG9ydHNJbnRlcnBvbGF0aW9uICYmIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSkgYXMgby5FeHByZXNzaW9uW107XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIGluc3RydWN0aW9uLnJlZmVyZW5jZSwgY2FsbHMpO1xuICAgIH1cblxuICAgIHJldHVybiBhbGxvY2F0ZUJpbmRpbmdTbG90cztcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSwgcHJlcGVuZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10sIHByZXBlbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uQ2hhaW4ocmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBjYWxsczoge1xuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIHBhcmFtczogKCkgPT4gby5FeHByZXNzaW9uW11cbiAgfVtdKSB7XG4gICAgY29uc3Qgc3BhbiA9IGNhbGxzLmxlbmd0aCA/IGNhbGxzWzBdLnNvdXJjZVNwYW4gOiBudWxsO1xuICAgIHRoaXMuX2NyZWF0aW9uQ29kZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIHJldHVybiBjaGFpbmVkSW5zdHJ1Y3Rpb24ocmVmZXJlbmNlLCBjYWxscy5tYXAoY2FsbCA9PiBjYWxsLnBhcmFtcygpKSwgc3BhbikudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5hZGRBZHZhbmNlSW5zdHJ1Y3Rpb25JZk5lY2Vzc2FyeShub2RlSW5kZXgsIHNwYW4pO1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbihcbiAgICAgIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgYmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdKSB7XG4gICAgY29uc3Qgc3BhbiA9IGJpbmRpbmdzLmxlbmd0aCA/IGJpbmRpbmdzWzBdLnNvdXJjZVNwYW4gOiBudWxsO1xuXG4gICAgdGhpcy5fdXBkYXRlQ29kZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGxzID0gYmluZGluZ3MubWFwKHByb3BlcnR5ID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wZXJ0eS52YWx1ZSgpO1xuICAgICAgICBjb25zdCBmblBhcmFtcyA9IEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbdmFsdWVdO1xuICAgICAgICBpZiAocHJvcGVydHkucGFyYW1zKSB7XG4gICAgICAgICAgZm5QYXJhbXMucHVzaCguLi5wcm9wZXJ0eS5wYXJhbXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wZXJ0eS5uYW1lKSB7XG4gICAgICAgICAgLy8gV2Ugd2FudCB0aGUgcHJvcGVydHkgbmFtZSB0byBhbHdheXMgYmUgdGhlIGZpcnN0IGZ1bmN0aW9uIHBhcmFtZXRlci5cbiAgICAgICAgICBmblBhcmFtcy51bnNoaWZ0KG8ubGl0ZXJhbChwcm9wZXJ0eS5uYW1lKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZuUGFyYW1zO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjaGFpbmVkSW5zdHJ1Y3Rpb24ocmVmZXJlbmNlLCBjYWxscywgc3BhbikudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShcbiAgICAgIG5vZGVJbmRleDogbnVtYmVyLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSkge1xuICAgIHRoaXMuYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3NhcnkoXG4gICAgICAgIG5vZGVJbmRleCwgYmluZGluZ3MubGVuZ3RoID8gYmluZGluZ3NbMF0uc291cmNlU3BhbiA6IG51bGwpO1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbihyZWZlcmVuY2UsIGJpbmRpbmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3Nhcnkobm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgaWYgKG5vZGVJbmRleCAhPT0gdGhpcy5fY3VycmVudEluZGV4KSB7XG4gICAgICBjb25zdCBkZWx0YSA9IG5vZGVJbmRleCAtIHRoaXMuX2N1cnJlbnRJbmRleDtcblxuICAgICAgaWYgKGRlbHRhIDwgMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FkdmFuY2UgaW5zdHJ1Y3Rpb24gY2FuIG9ubHkgZ28gZm9yd2FyZHMnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIFIzLmFkdmFuY2UsIFtvLmxpdGVyYWwoZGVsdGEpXSk7XG4gICAgICB0aGlzLl9jdXJyZW50SW5kZXggPSBub2RlSW5kZXg7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG9yaWdpbmFsU2xvdHMgPSB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cztcbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSBudW1TbG90cztcbiAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWU6IEFTVHxudWxsKSB7XG4gICAgdGhpcy5fYmluZGluZ1Nsb3RzICs9IHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCA6IDE7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbiBleHByZXNzaW9uIHRoYXQgcmVmZXJzIHRvIHRoZSBpbXBsaWNpdCByZWNlaXZlci4gVGhlIGltcGxpY2l0XG4gICAqIHJlY2VpdmVyIGlzIGFsd2F5cyB0aGUgcm9vdCBsZXZlbCBjb250ZXh0LlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBpZiAodGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHIpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwcjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHIgPSB0aGlzLmxldmVsID09PSAwID9cbiAgICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLmdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZTogQVNUKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICB0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLkV4cHJlc3Npb24sXG4gICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcbiAgICByZXR1cm4gdmFsRXhwcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGEgbGlzdCBvZiBhcmd1bWVudCBleHByZXNzaW9ucyB0byBwYXNzIHRvIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBleHByZXNzaW9uLiBBbHNvIHVwZGF0ZXNcbiAgICogdGhlIHRlbXAgdmFyaWFibGVzIHN0YXRlIHdpdGggdGVtcCB2YXJpYWJsZXMgdGhhdCB3ZXJlIGlkZW50aWZpZWQgYXMgbmVlZGluZyB0byBiZSBjcmVhdGVkXG4gICAqIHdoaWxlIHZpc2l0aW5nIHRoZSBhcmd1bWVudHMuXG4gICAqIEBwYXJhbSB2YWx1ZSBUaGUgb3JpZ2luYWwgZXhwcmVzc2lvbiB3ZSB3aWxsIGJlIHJlc29sdmluZyBhbiBhcmd1bWVudHMgbGlzdCBmcm9tLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZTogQVNUKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IHthcmdzLCBzdG10c30gPVxuICAgICAgICBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSk7XG5cbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uc3RtdHMpO1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaERpcmVjdGl2ZXMoZWxlbWVudE5hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKGVsZW1lbnROYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7XG4gICAgICAgIHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZXMgYWxsIGF0dHJpYnV0ZSBleHByZXNzaW9uIHZhbHVlcyBmb3IgdGhlIGBUQXR0cmlidXRlc2AgYXJyYXkuXG4gICAqXG4gICAqIFRoZSBwdXJwb3NlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gcHJvcGVybHkgY29uc3RydWN0IGFuIGF0dHJpYnV0ZXMgYXJyYXkgdGhhdFxuICAgKiBpcyBwYXNzZWQgaW50byB0aGUgYGVsZW1lbnRTdGFydGAgKG9yIGp1c3QgYGVsZW1lbnRgKSBmdW5jdGlvbnMuIEJlY2F1c2UgdGhlcmVcbiAgICogYXJlIG1hbnkgZGlmZmVyZW50IHR5cGVzIG9mIGF0dHJpYnV0ZXMsIHRoZSBhcnJheSBuZWVkcyB0byBiZSBjb25zdHJ1Y3RlZCBpbiBhXG4gICAqIHNwZWNpYWwgd2F5IHNvIHRoYXQgYGVsZW1lbnRTdGFydGAgY2FuIHByb3Blcmx5IGV2YWx1YXRlIHRoZW0uXG4gICAqXG4gICAqIFRoZSBmb3JtYXQgbG9va3MgbGlrZSB0aGlzOlxuICAgKlxuICAgKiBgYGBcbiAgICogYXR0cnMgPSBbcHJvcCwgdmFsdWUsIHByb3AyLCB2YWx1ZTIsXG4gICAqICAgUFJPSkVDVF9BUywgc2VsZWN0b3IsXG4gICAqICAgQ0xBU1NFUywgY2xhc3MxLCBjbGFzczIsXG4gICAqICAgU1RZTEVTLCBzdHlsZTEsIHZhbHVlMSwgc3R5bGUyLCB2YWx1ZTIsXG4gICAqICAgQklORElOR1MsIG5hbWUxLCBuYW1lMiwgbmFtZTMsXG4gICAqICAgVEVNUExBVEUsIG5hbWU0LCBuYW1lNSwgbmFtZTYsXG4gICAqICAgSTE4TiwgbmFtZTcsIG5hbWU4LCAuLi5dXG4gICAqIGBgYFxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBmdW5jdGlvbiB3aWxsIGZ1bGx5IGlnbm9yZSBhbGwgc3ludGhldGljIChAZm9vKSBhdHRyaWJ1dGUgdmFsdWVzXG4gICAqIGJlY2F1c2UgdGhvc2UgdmFsdWVzIGFyZSBpbnRlbmRlZCB0byBhbHdheXMgYmUgZ2VuZXJhdGVkIGFzIHByb3BlcnR5IGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCByZW5kZXJBdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSwgaW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10sXG4gICAgICBvdXRwdXRzOiB0LkJvdW5kRXZlbnRbXSwgc3R5bGVzPzogU3R5bGluZ0J1aWxkZXIsXG4gICAgICB0ZW1wbGF0ZUF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10gPSBbXSxcbiAgICAgIGJvdW5kSTE4bkF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBhbHJlYWR5U2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGF0dHJFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgbmdQcm9qZWN0QXNBdHRyOiB0LlRleHRBdHRyaWJ1dGV8dW5kZWZpbmVkO1xuXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIHJlbmRlckF0dHJpYnV0ZXMpIHtcbiAgICAgIGlmIChhdHRyLm5hbWUgPT09IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FKSB7XG4gICAgICAgIG5nUHJvamVjdEFzQXR0ciA9IGF0dHI7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGUgdGhhdCBzdGF0aWMgaTE4biBhdHRyaWJ1dGVzIGFyZW4ndCBpbiB0aGUgaTE4biBhcnJheSxcbiAgICAgIC8vIGJlY2F1c2UgdGhleSdyZSB0cmVhdGVkIGluIHRoZSBzYW1lIHdheSBhcyByZWd1bGFyIGF0dHJpYnV0ZXMuXG4gICAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUoYXR0ci5pMThuIGFzIGkxOG4uTWVzc2FnZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goXG4gICAgICAgICAgICAuLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgdHJ1c3RlZENvbnN0QXR0cmlidXRlKGVsZW1lbnROYW1lLCBhdHRyKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gS2VlcCBuZ1Byb2plY3RBcyBuZXh0IHRvIHRoZSBvdGhlciBuYW1lLCB2YWx1ZSBwYWlycyBzbyB3ZSBjYW4gdmVyaWZ5IHRoYXQgd2UgbWF0Y2hcbiAgICAvLyBuZ1Byb2plY3RBcyBtYXJrZXIgaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHNsb3QuXG4gICAgaWYgKG5nUHJvamVjdEFzQXR0cikge1xuICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKG5nUHJvamVjdEFzQXR0cikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZEF0dHJFeHByKGtleTogc3RyaW5nfG51bWJlciwgdmFsdWU/OiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIWFscmVhZHlTZWVuLmhhcyhrZXkpKSB7XG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGtleSkpO1xuICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgYXR0ckV4cHJzLnB1c2godmFsdWUpO1xuICAgICAgICAgIGFscmVhZHlTZWVuLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoa2V5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaXQncyBpbXBvcnRhbnQgdGhhdCB0aGlzIG9jY3VycyBiZWZvcmUgQklORElOR1MgYW5kIFRFTVBMQVRFIGJlY2F1c2Ugb25jZSBgZWxlbWVudFN0YXJ0YFxuICAgIC8vIGNvbWVzIGFjcm9zcyB0aGUgQklORElOR1Mgb3IgVEVNUExBVEUgbWFya2VycyB0aGVuIGl0IHdpbGwgY29udGludWUgcmVhZGluZyBlYWNoIHZhbHVlIGFzXG4gICAgLy8gYXMgc2luZ2xlIHByb3BlcnR5IHZhbHVlIGNlbGwgYnkgY2VsbC5cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJFeHBycyk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzID0gYXR0ckV4cHJzLmxlbmd0aDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbaV07XG4gICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdGhlIGFuaW1hdGlvbiBhbmQgYXR0cmlidXRlIGJpbmRpbmdzIGluIHRoZVxuICAgICAgICAvLyBhdHRyaWJ1dGVzIGFycmF5IHNpbmNlIHRoZXkgYXJlbid0IHVzZWQgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAgICAgaWYgKGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbiAmJiBpbnB1dC50eXBlICE9PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihpbnB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG91dHB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1tpXTtcbiAgICAgICAgaWYgKG91dHB1dC50eXBlICE9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIob3V0cHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHRoaXMgaXMgYSBjaGVhcCB3YXkgb2YgYWRkaW5nIHRoZSBtYXJrZXIgb25seSBhZnRlciBhbGwgdGhlIGlucHV0L291dHB1dFxuICAgICAgLy8gdmFsdWVzIGhhdmUgYmVlbiBmaWx0ZXJlZCAoYnkgbm90IGluY2x1ZGluZyB0aGUgYW5pbWF0aW9uIG9uZXMpIGFuZCBhZGRlZFxuICAgICAgLy8gdG8gdGhlIGV4cHJlc3Npb25zLiBUaGUgbWFya2VyIGlzIGltcG9ydGFudCBiZWNhdXNlIGl0IHRlbGxzIHRoZSBydW50aW1lXG4gICAgICAvLyBjb2RlIHRoYXQgdGhpcyBpcyB3aGVyZSBhdHRyaWJ1dGVzIHdpdGhvdXQgdmFsdWVzIHN0YXJ0Li4uXG4gICAgICBpZiAoYXR0ckV4cHJzLmxlbmd0aCAhPT0gYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMpIHtcbiAgICAgICAgYXR0ckV4cHJzLnNwbGljZShhdHRyc0xlbmd0aEJlZm9yZUlucHV0cywgMCwgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlQXR0cnMubGVuZ3RoKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpKTtcbiAgICAgIHRlbXBsYXRlQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIGlmIChib3VuZEkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBib3VuZEkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJFeHBycztcbiAgfVxuXG4gIHByaXZhdGUgYWRkVG9Db25zdHMoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKTogby5MaXRlcmFsRXhwciB7XG4gICAgaWYgKG8uaXNOdWxsKGV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgY29uc3RzID0gdGhpcy5fY29uc3RhbnRzLmNvbnN0RXhwcmVzc2lvbnM7XG5cbiAgICAvLyBUcnkgdG8gcmV1c2UgYSBsaXRlcmFsIHRoYXQncyBhbHJlYWR5IGluIHRoZSBhcnJheSwgaWYgcG9zc2libGUuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25zdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb25zdHNbaV0uaXNFcXVpdmFsZW50KGV4cHJlc3Npb24pKSB7XG4gICAgICAgIHJldHVybiBvLmxpdGVyYWwoaSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG8ubGl0ZXJhbChjb25zdHMucHVzaChleHByZXNzaW9uKSAtIDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBdHRyc1RvQ29uc3RzKGF0dHJzOiBvLkV4cHJlc3Npb25bXSk6IG8uTGl0ZXJhbEV4cHIge1xuICAgIHJldHVybiBhdHRycy5sZW5ndGggPiAwID8gdGhpcy5hZGRUb0NvbnN0cyhvLmxpdGVyYWxBcnIoYXR0cnMpKSA6IG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc0FycmF5KHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IGZsYXR0ZW4ocmVmZXJlbmNlcy5tYXAocmVmZXJlbmNlID0+IHtcbiAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgICByZXRyaWV2YWxMZXZlbCwgcmVmZXJlbmNlLm5hbWUsIGxocyxcbiAgICAgICAgICBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIGUuZy4gbmV4dENvbnRleHQoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcmVmZXJlbmNlKDEpO1xuICAgICAgICAgICAgY29uc3QgcmVmRXhwciA9IGxocy5zZXQoby5pbXBvcnRFeHByKFIzLnJlZmVyZW5jZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgcmV0dXJuIFtyZWZlcmVuY2UubmFtZSwgcmVmZXJlbmNlLnZhbHVlXTtcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gYXNMaXRlcmFsKHJlZnNQYXJhbSk7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcih0YWdOYW1lOiBzdHJpbmcsIG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50LCBpbmRleDogbnVtYmVyKTpcbiAgICAgICgpID0+IG8uRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPSBvdXRwdXRBc3QubmFtZTtcbiAgICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBvdXRwdXRBc3QudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgICAgLy8gc3ludGhldGljIEBsaXN0ZW5lci5mb28gdmFsdWVzIGFyZSB0cmVhdGVkIHRoZSBleGFjdCBzYW1lIGFzIGFyZSBzdGFuZGFyZCBsaXN0ZW5lcnNcbiAgICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoZXZlbnROYW1lLCBvdXRwdXRBc3QucGhhc2UhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoXG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCwgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBGdW5jdGlvbkNhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQoXG4gICAgICAgIHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBwaXBlLm5hbWVTcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiksXG4gICAgICAgIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPSBpc1Zhckxlbmd0aCA/XG4gICAgICAgIHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIGFyZ3MpXSkgOlxuICAgICAgICB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgY29uc3QgcGlwZUJpbmRFeHByID0gbmV3IEZ1bmN0aW9uQ2FsbChwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgcHVyZUZ1bmN0aW9uU2xvdCksXG4gICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgIF0pO1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMucHVzaChwaXBlQmluZEV4cHIpO1xuICAgIHJldHVybiBwaXBlQmluZEV4cHI7XG4gIH1cblxuICB1cGRhdGVQaXBlU2xvdE9mZnNldHMoYmluZGluZ1Nsb3RzOiBudW1iZXIpIHtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLmZvckVhY2goKHBpcGU6IEZ1bmN0aW9uQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFycmF5LnNwYW4sIGFycmF5LnNvdXJjZVNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAgICAgLy8gdmFsdWVzLlxuICAgICAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIG1hcC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc3RhcnRTbG90KSwgbGl0ZXJhbEZhY3RvcnldO1xuXG4gIGlmIChpc1Zhckxlbmd0aCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIobGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhcmdzLnB1c2goLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKS5jYWxsRm4oYXJncyk7XG59XG5cbi8qKlxuICogR2V0cyBhbiBhcnJheSBvZiBsaXRlcmFscyB0aGF0IGNhbiBiZSBhZGRlZCB0byBhbiBleHByZXNzaW9uXG4gKiB0byByZXByZXNlbnQgdGhlIG5hbWUgYW5kIG5hbWVzcGFjZSBvZiBhbiBhdHRyaWJ1dGUuIEUuZy5cbiAqIGA6eGxpbms6aHJlZmAgdHVybnMgaW50byBgW0F0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkksICd4bGluaycsICdocmVmJ11gLlxuICpcbiAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGF0dHJpYnV0ZSwgaW5jbHVkaW5nIHRoZSBuYW1lc3BhY2UuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUpO1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lKTtcblxuICBpZiAoYXR0cmlidXRlTmFtZXNwYWNlKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IG5leHRDb250ZXh0KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgbG9jYWxSZWZgIGlzIHRydWUgaWYgd2UgYXJlIHN0b3JpbmcgYSBsb2NhbCByZWZlcmVuY2VcbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uRXhwcmVzc2lvbjtcbiAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjazsgZGVjbGFyZTogYm9vbGVhbjsgcHJpb3JpdHk6IG51bWJlcjtcbiAgbG9jYWxSZWY6IGJvb2xlYW47XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7XG4gIERFRkFVTFQgPSAwLFxuICBDT05URVhUID0gMSxcbiAgU0hBUkVEX0NPTlRFWFQgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHN0YXRpYyBjcmVhdGVSb290U2NvcGUoKTogQmluZGluZ1Njb3BlIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdTY29wZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgZ2xvYmFscz86IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKGdsb2JhbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGdsb2JhbHMpIHtcbiAgICAgICAgdGhpcy5zZXQoMCwgbmFtZSwgby52YXJpYWJsZShuYW1lKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5LFxuICAgICAgICAgICAgbG9jYWxSZWY6IHZhbHVlLmxvY2FsUmVmXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwsIHZhbHVlLmxvY2FsUmVmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9uLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgICBsb2NhbFJlZjogbG9jYWxSZWYgfHwgZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50ZWQgYXMgcGFydCBvZiBMb2NhbFJlc29sdmVyLlxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmJpbmRpbmdMZXZlbCAhPT0gMCkge1xuICAgICAgLy8gU2luY2UgdGhlIGltcGxpY2l0IHJlY2VpdmVyIGlzIGFjY2Vzc2VkIGluIGFuIGVtYmVkZGVkIHZpZXcsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGRlY2xhcmUgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgIC8vIGluIHRoZSB1cGRhdGUgdmFyaWFibGVzLlxuICAgICAgdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApIS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyLCBnbG9iYWxzPzogU2V0PHN0cmluZz4pOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcywgZ2xvYmFscyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpIS5saHMgYXMgby5SZWFkVmFyRXhwcjtcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyBhcyBvLlJlYWRWYXJFeHByIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUICYmXG4gICAgICAgIHZhbHVlLnJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwpIHtcbiAgICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyB2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICBpZiAoc2hhcmVkQ3R4T2JqKSB7XG4gICAgICAgIHNoYXJlZEN0eE9iai5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FICsgdGhpcy5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgdGhpcy5tYXAuc2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgIC8vIGNvbnN0IGN0eF9yMCA9IG5leHRDb250ZXh0KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFQsXG4gICAgICBsb2NhbFJlZjogZmFsc2VcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29tcG9uZW50VmFsdWUgPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgMCkhO1xuICAgIGNvbXBvbmVudFZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygwLCBmYWxzZSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBsb2NhbFJlZkxvb2t1cDogYm9vbGVhbikge1xuICAgIC8vIFdlIHdhbnQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGxpc3RlbmVyIGZucyBpZjpcbiAgICAvLyAxIC0gd2UgYXJlIGFjY2Vzc2luZyBhIHZhbHVlIGluIGEgcGFyZW50IHZpZXcsIHdoaWNoIHJlcXVpcmVzIHdhbGtpbmcgdGhlIHZpZXcgdHJlZSByYXRoZXJcbiAgICAvLyB0aGFuIHVzaW5nIHRoZSBjdHggYXJnLiBJbiB0aGlzIGNhc2UsIHRoZSByZXRyaWV2YWwgYW5kIGJpbmRpbmcgbGV2ZWwgd2lsbCBiZSBkaWZmZXJlbnQuXG4gICAgLy8gMiAtIHdlIGFyZSBsb29raW5nIHVwIGEgbG9jYWwgcmVmLCB3aGljaCByZXF1aXJlcyByZXN0b3JpbmcgdGhlIHZpZXcgd2hlcmUgdGhlIGxvY2FsXG4gICAgLy8gcmVmIGlzIHN0b3JlZFxuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpICYmIChyZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsIHx8IGxvY2FsUmVmTG9va3VwKSkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSA9IG8udmFyaWFibGUodGhpcy5wYXJlbnQhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJlc3RvcmVWaWV3KCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50ICYmIHRoaXMucGFyZW50LmJpbmRpbmdMZXZlbCA9PT0gdGhpcy5iaW5kaW5nTGV2ZWw7XG4gIH1cblxuICB2YXJpYWJsZURlY2xhcmF0aW9ucygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBsZXQgY3VycmVudENvbnRleHRMZXZlbCA9IDA7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5tYXAudmFsdWVzKCkpXG4gICAgICAgICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgICAgICAgICAucmVkdWNlKChzdG10czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IEJpbmRpbmdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9XG4gICAgICAgICAgICAgICAgICAgICB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgICAgICAgIGN1cnJlbnRDb250ZXh0TGV2ZWwgPSBsZXZlbERpZmY7XG4gICAgICAgICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3IoXG4gICAgZWxlbWVudE5hbWU6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICBjb25zdCBlbGVtZW50TmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbGVtZW50TmFtZU5vTnMpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCBuYW1lTm9OcyA9IHNwbGl0TnNOYW1lKG5hbWUpWzFdO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lTm9OcywgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgb3V0IG9mIGFuIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlc1xuICogd2hpY2ggY2FuIGJlIGFkZGVkIHRvIHRoZSBpbnN0cnVjdGlvbiBwYXJhbWV0ZXJzLlxuICovXG5mdW5jdGlvbiBnZXROZ1Byb2plY3RBc0xpdGVyYWwoYXR0cmlidXRlOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb25bXSB7XG4gIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IoYXR0cmlidXRlLnZhbHVlKVswXTtcbiAgcmV0dXJuIFtvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgYXNMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpXTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5XG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIGF0dHJpYnV0ZVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBPcHRpb25zIHRoYXQgY2FuIGJlIHVzZWQgdG8gbW9kaWZ5IGhvdyBhIHRlbXBsYXRlIGlzIHBhcnNlZCBieSBgcGFyc2VUZW1wbGF0ZSgpYC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZVRlbXBsYXRlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJbmNsdWRlIHdoaXRlc3BhY2Ugbm9kZXMgaW4gdGhlIHBhcnNlZCBvdXRwdXQuXG4gICAqL1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEhvdyB0byBwYXJzZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIFRoZSBzdGFydCBhbmQgZW5kIHBvaW50IG9mIHRoZSB0ZXh0IHRvIHBhcnNlIHdpdGhpbiB0aGUgYHNvdXJjZWAgc3RyaW5nLlxuICAgKiBUaGUgZW50aXJlIGBzb3VyY2VgIHN0cmluZyBpcyBwYXJzZWQgaWYgdGhpcyBpcyBub3QgcHJvdmlkZWQuXG4gICAqICovXG4gIHJhbmdlPzogTGV4ZXJSYW5nZTtcbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYSBKYXZhU2NyaXB0IHN0cmluZywgdGhlbiB3ZSBoYXZlIHRvIGRlYWwgd2l0aCBlc2NhcGUgc2VxdWVuY2VzLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMToqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFwiZGVmXFxuZ2hpXCJcbiAgICogYGBgXG4gICAqXG4gICAqIC0gVGhlIGBcXFwiYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBgXCJgLlxuICAgKiAtIFRoZSBgXFxuYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBhIG5ldyBsaW5lIGNoYXJhY3RlciBpbiBhIHRva2VuLFxuICAgKiAgIGJ1dCBpdCBzaG91bGQgbm90IGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICpcbiAgICogKipFeGFtcGxlIDI6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcbiAgICogIGRlZlwiXG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgbGluZSBjb250aW51YXRpb24gKGBcXGAgZm9sbG93ZWQgYnkgYSBuZXdsaW5lKSBzaG91bGQgYmUgcmVtb3ZlZCBmcm9tIGEgdG9rZW5cbiAgICogYnV0IHRoZSBuZXcgbGluZSBzaG91bGQgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKi9cbiAgZXNjYXBlZFN0cmluZz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBjaGFyYWN0ZXJzIHRoYXQgc2hvdWxkIGJlIGNvbnNpZGVyZWQgYXMgbGVhZGluZyB0cml2aWEuXG4gICAqIExlYWRpbmcgdHJpdmlhIGFyZSBjaGFyYWN0ZXJzIHRoYXQgYXJlIG5vdCBpbXBvcnRhbnQgdG8gdGhlIGRldmVsb3BlciwgYW5kIHNvIHNob3VsZCBub3QgYmVcbiAgICogaW5jbHVkZWQgaW4gc291cmNlLW1hcCBzZWdtZW50cy4gIEEgY29tbW9uIGV4YW1wbGUgaXMgd2hpdGVzcGFjZS5cbiAgICovXG4gIGxlYWRpbmdUcml2aWFDaGFycz86IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBSZW5kZXIgYCRsb2NhbGl6ZWAgbWVzc2FnZSBpZHMgd2l0aCBhZGRpdGlvbmFsIGxlZ2FjeSBtZXNzYWdlIGlkcy5cbiAgICpcbiAgICogVGhpcyBvcHRpb24gZGVmYXVsdHMgdG8gYHRydWVgIGJ1dCBpbiB0aGUgZnV0dXJlIHRoZSBkZWZhdWwgd2lsbCBiZSBmbGlwcGVkLlxuICAgKlxuICAgKiBGb3Igbm93IHNldCB0aGlzIG9wdGlvbiB0byBmYWxzZSBpZiB5b3UgaGF2ZSBtaWdyYXRlZCB0aGUgdHJhbnNsYXRpb24gZmlsZXMgdG8gdXNlIHRoZSBuZXdcbiAgICogYCRsb2NhbGl6ZWAgbWVzc2FnZSBpZCBmb3JtYXQgYW5kIHlvdSBhcmUgbm90IHVzaW5nIGNvbXBpbGUgdGltZSB0cmFuc2xhdGlvbiBtZXJnaW5nLlxuICAgKi9cbiAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGFuIGV4dGVybmFsIHRlbXBsYXRlIChlLmcuIHZpYSBgdGVtcGxhdGVVcmxgKSB0aGVuIHdlIG5lZWQgdG8gZGVjaWRlXG4gICAqIHdoZXRoZXIgb3Igbm90IHRvIG5vcm1hbGl6ZSB0aGUgbGluZS1lbmRpbmdzIChmcm9tIGBcXHJcXG5gIHRvIGBcXG5gKSB3aGVuIHByb2Nlc3NpbmcgSUNVXG4gICAqIGV4cHJlc3Npb25zLlxuICAgKlxuICAgKiBJZiBgdHJ1ZWAgdGhlbiB3ZSB3aWxsIG5vcm1hbGl6ZSBJQ1UgZXhwcmVzc2lvbiBsaW5lIGVuZGluZ3MuXG4gICAqIFRoZSBkZWZhdWx0IGlzIGBmYWxzZWAsIGJ1dCB0aGlzIHdpbGwgYmUgc3dpdGNoZWQgaW4gYSBmdXR1cmUgbWFqb3IgcmVsZWFzZS5cbiAgICovXG4gIGkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSBpbnRvIHJlbmRlcjMgYE5vZGVgcyBhbmQgYWRkaXRpb25hbCBtZXRhZGF0YSwgd2l0aCBubyBvdGhlciBkZXBlbmRlbmNpZXMuXG4gKlxuICogQHBhcmFtIHRlbXBsYXRlIHRleHQgb2YgdGhlIHRlbXBsYXRlIHRvIHBhcnNlXG4gKiBAcGFyYW0gdGVtcGxhdGVVcmwgVVJMIHRvIHVzZSBmb3Igc291cmNlIG1hcHBpbmcgb2YgdGhlIHBhcnNlZCB0ZW1wbGF0ZVxuICogQHBhcmFtIG9wdGlvbnMgb3B0aW9ucyB0byBtb2RpZnkgaG93IHRoZSB0ZW1wbGF0ZSBpcyBwYXJzZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgb3B0aW9uczogUGFyc2VUZW1wbGF0ZU9wdGlvbnMgPSB7fSk6IFBhcnNlZFRlbXBsYXRlIHtcbiAgY29uc3Qge2ludGVycG9sYXRpb25Db25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXMsIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXR9ID0gb3B0aW9ucztcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKFxuICAgICAgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLFxuICAgICAge2xlYWRpbmdUcml2aWFDaGFyczogTEVBRElOR19UUklWSUFfQ0hBUlMsIC4uLm9wdGlvbnMsIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWV9KTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgLy8gVE9ETyhheWF6aGFmaXopOiB3ZSBtYXkgbm90IGFsd2F5cyB3YW50IHRvIGJhaWwgb3V0IGF0IHRoaXMgcG9pbnQgKGUuZy4gaW5cbiAgICAvLyB0aGUgY29udGV4dCBvZiBhIGxhbmd1YWdlIHNlcnZpY2UpLlxuICAgIHJldHVybiB7XG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgIHRlbXBsYXRlLFxuICAgICAgZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgLy8gcHJvY2VzcyBpMThuIG1ldGEgaW5mb3JtYXRpb24gKHNjYW4gYXR0cmlidXRlcywgZ2VuZXJhdGUgaWRzKVxuICAvLyBiZWZvcmUgd2UgcnVuIHdoaXRlc3BhY2UgcmVtb3ZhbCBwcm9jZXNzLCBiZWNhdXNlIGV4aXN0aW5nIGkxOG5cbiAgLy8gZXh0cmFjdGlvbiBwcm9jZXNzIChuZyBleHRyYWN0LWkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIGNvbnN0IGkxOG5NZXRhVmlzaXRvciA9IG5ldyBJMThuTWV0YVZpc2l0b3IoXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovICFwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCk7XG4gIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwoaTE4bk1ldGFWaXNpdG9yLCByb290Tm9kZXMpO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3aGl0ZXNwYWNlcyBhcmUgcmVtb3ZlZCAoYmVjYXVzZSB0aGF0IG1pZ2h0IGFmZmVjdFxuICAgIC8vIGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudCkgYW5kIGZpcnN0IHBhc3MgaW5kaWNhdGVkIHRoYXQgaTE4biBjb250ZW50IGlzIHByZXNlbnQgaW4gYVxuICAgIC8vIHRlbXBsYXRlLiBEdXJpbmcgdGhpcyBwYXNzIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuXG4gICAgLy8gbWltaWMgZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyBleHRyYWN0LWkxOG4pXG4gICAgaWYgKGkxOG5NZXRhVmlzaXRvci5oYXNJMThuTWV0YSkge1xuICAgICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChcbiAgICAgICAgICBuZXcgSTE4bk1ldGFWaXNpdG9yKGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gZmFsc2UpLCByb290Tm9kZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgZXJyb3JzLCBzdHlsZVVybHMsIHN0eWxlcywgbmdDb250ZW50U2VsZWN0b3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG5cbiAgcmV0dXJuIHtcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgZXJyb3JzOiBlcnJvcnMubGVuZ3RoID4gMCA/IGVycm9ycyA6IG51bGwsXG4gICAgdGVtcGxhdGUsXG4gICAgbm9kZXMsXG4gICAgc3R5bGVVcmxzLFxuICAgIHN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnNcbiAgfTtcbn1cblxuY29uc3QgZWxlbWVudFJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IEl2eVBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIGVsZW1lbnRSZWdpc3RyeSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cnVzdGVkQ29uc3RBdHRyaWJ1dGUodGFnTmFtZTogc3RyaW5nLCBhdHRyOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZSA9IGFzTGl0ZXJhbChhdHRyLnZhbHVlKTtcbiAgc3dpdGNoIChlbGVtZW50UmVnaXN0cnkuc2VjdXJpdHlDb250ZXh0KHRhZ05hbWUsIGF0dHIubmFtZSwgLyogaXNBdHRyaWJ1dGUgKi8gdHJ1ZSkpIHtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRIdG1sKS5jYWxsRm4oW3ZhbHVlXSwgYXR0ci52YWx1ZVNwYW4pO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy50cnVzdENvbnN0YW50U2NyaXB0KS5jYWxsRm4oW3ZhbHVlXSwgYXR0ci52YWx1ZVNwYW4pO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy50cnVzdENvbnN0YW50UmVzb3VyY2VVcmwpLmNhbGxGbihbdmFsdWVdLCBhdHRyLnZhbHVlU3Bhbik7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuXG5pbnRlcmZhY2UgQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uIHtcbiAgbmFtZT86IHN0cmluZztcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHZhbHVlOiAoKSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXTtcbiAgcGFyYW1zPzogYW55W107XG59XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb24gKGUuZy5cbiAqIHBvc3QtcHJvY2Vzc2luZykuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lZCBhIGdpdmVuIHRyYW5zbGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSxcbiAgICAgICAgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyhcbiAgICAgICAgICAgIHZhcmlhYmxlLCBtZXNzYWdlLCBjbG9zdXJlVmFyLFxuICAgICAgICAgICAgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gdHJ1ZSkpLFxuICAgICAgICBjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHMoXG4gICAgICAgICAgICB2YXJpYWJsZSwgbWVzc2FnZSwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpKSksXG4gIF07XG5cbiAgaWYgKHRyYW5zZm9ybUZuKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KHRyYW5zZm9ybUZuKHZhcmlhYmxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBzdGF0ZW1lbnRzO1xufVxuXG4vKipcbiAqIENyZWF0ZSB0aGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgdXNlZCB0byBndWFyZCB0aGUgY2xvc3VyZSBtb2RlIGJsb2NrXG4gKiBJdCBpcyBlcXVpdmFsZW50IHRvOlxuICpcbiAqIGBgYFxuICogdHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGVcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCk6IG8uQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG8udHlwZW9mRXhwcihvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSlcbiAgICAgIC5ub3RJZGVudGljYWwoby5saXRlcmFsKCd1bmRlZmluZWQnLCBvLlNUUklOR19UWVBFKSlcbiAgICAgIC5hbmQoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB0ZW1wbGF0ZSB3aGljaCB3YXMgZXh0cmFjdGVkIGR1cmluZyBwYXJzaW5nLlxuICpcbiAqIFRoaXMgY29udGFpbnMgdGhlIGFjdHVhbCBwYXJzZWQgdGVtcGxhdGUgYXMgd2VsbCBhcyBhbnkgbWV0YWRhdGEgY29sbGVjdGVkIGR1cmluZyBpdHMgcGFyc2luZyxcbiAqIHNvbWUgb2Ygd2hpY2ggbWlnaHQgYmUgdXNlZnVsIGZvciByZS1wYXJzaW5nIHRoZSB0ZW1wbGF0ZSB3aXRoIGRpZmZlcmVudCBvcHRpb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFRlbXBsYXRlIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIFRoZSBzdHJpbmcgY29udGVudHMgb2YgdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGlzIHRoZSBcImxvZ2ljYWxcIiB0ZW1wbGF0ZSBzdHJpbmcsIGFmdGVyIGV4cGFuc2lvbiBvZiBhbnkgZXNjYXBlZCBjaGFyYWN0ZXJzIChmb3IgaW5saW5lXG4gICAqIHRlbXBsYXRlcykuIFRoaXMgbWF5IGRpZmZlciBmcm9tIHRoZSBhY3R1YWwgdGVtcGxhdGUgYnl0ZXMgYXMgdGhleSBhcHBlYXIgaW4gdGhlIC50cyBmaWxlLlxuICAgKi9cbiAgdGVtcGxhdGU6IHN0cmluZztcblxuICAvKipcbiAgICogQW55IGVycm9ycyBmcm9tIHBhcnNpbmcgdGhlIHRlbXBsYXRlIHRoZSBmaXJzdCB0aW1lLlxuICAgKlxuICAgKiBgbnVsbGAgaWYgdGhlcmUgYXJlIG5vIGVycm9ycy4gT3RoZXJ3aXNlLCB0aGUgYXJyYXkgb2YgZXJyb3JzIGlzIGd1YXJhbnRlZWQgdG8gYmUgbm9uLWVtcHR5LlxuICAgKi9cbiAgZXJyb3JzOiBQYXJzZUVycm9yW118bnVsbDtcblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIEFTVCwgcGFyc2VkIGZyb20gdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgbm9kZXM6IHQuTm9kZVtdO1xuXG4gIC8qKlxuICAgKiBBbnkgc3R5bGVVcmxzIGV4dHJhY3RlZCBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgICovXG4gIHN0eWxlVXJsczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEFueSBpbmxpbmUgc3R5bGVzIGV4dHJhY3RlZCBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgICovXG4gIHN0eWxlczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEFueSBuZy1jb250ZW50IHNlbGVjdG9ycyBleHRyYWN0ZWQgZnJvbSB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdO1xufVxuIl19