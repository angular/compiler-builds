/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { flatten } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, Call, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { IvyParser } from '../../expression_parser/parser';
import * as html from '../../ml_parser/ast';
import { HtmlParser } from '../../ml_parser/html_parser';
import { WhitespaceVisitor } from '../../ml_parser/html_whitespaces';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import { isNgContainer as checkIsNgContainer, splitNsName } from '../../ml_parser/tags';
import { mapLiteral } from '../../output/map_util';
import * as o from '../../output/output_ast';
import { sanitizeIdentifier } from '../../parse_util';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { isTrustedTypesSink } from '../../schema/trusted_types_sinks';
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
import { asLiteral, chainedInstruction, CONTEXT_NAME, getAttrsForDirectiveMatching, getInterpolationArgsLength, IMPLICIT_REFERENCE, invalid, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, RESTORED_VIEW_CONTEXT_NAME, trimTrailingNulls, unsupported } from './util';
// Selector attribute name of `<ng-content>`
const NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
const NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
// Global symbols available only inside event bindings.
const EVENT_BINDING_SCOPE_GLOBALS = new Set(['$event']);
// List of supported global targets for event listeners
const GLOBAL_TARGET_RESOLVERS = new Map([['window', R3.resolveWindow], ['document', R3.resolveDocument], ['body', R3.resolveBody]]);
export const LEADING_TRIVIA_CHARS = [' ', '\n', '\r', '\t'];
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
        // `variableDeclarations` needs to run first, because
        // `restoreViewStatement` depends on the result.
        statements.push(...scope.variableDeclarations());
        statements.unshift(...scope.restoreViewStatement());
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
    return {
        prepareStatements: [],
        constExpressions: [],
        i18nVarRefsCache: new Map(),
    };
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
    // LocalResolver
    maybeRestoreView() {
        this._bindingScope.maybeRestoreView();
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
                if (scope.isListenerScope() && scope.hasRestoreViewVariable()) {
                    // e.g. restoredCtx.
                    // We have to get the context from a view reference, if one is available, because
                    // the context that was passed in during creation may not be correct anymore.
                    // For more information see: https://github.com/angular/angular/pull/40360.
                    rhs = o.variable(RESTORED_VIEW_CONTEXT_NAME);
                    scope.notifyRestoredViewContextUse();
                }
                else {
                    // e.g. ctx
                    rhs = o.variable(CONTEXT_NAME);
                }
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
        const tagNameWithoutNamespace = template.tagName ? splitNsName(template.tagName)[1] : template.tagName;
        const contextName = `${this.contextName}${template.tagName ? '_' + sanitizeIdentifier(template.tagName) : ''}_${templateIndex}`;
        const templateName = `${contextName}_Template`;
        const parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            // We don't care about the tag's namespace here, because we infer
            // it based on the parent nodes inside the template instruction.
            o.literal(tagNameWithoutNamespace),
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
        if (tagNameWithoutNamespace === NG_TEMPLATE_TAG_NAME) {
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
                // When i18n attributes are present on elements with structural directives
                // (e.g. `<div *ngIf title="Hello" i18n-title>`), we want to avoid generating
                // duplicate i18n translation blocks for `ɵɵtemplate` and `ɵɵelement` instruction
                // attributes. So we do a cache lookup to see if suitable i18n translation block
                // already exists.
                const { i18nVarRefsCache } = this._constants;
                let i18nVarRef;
                if (i18nVarRefsCache.has(attr.i18n)) {
                    i18nVarRef = i18nVarRefsCache.get(attr.i18n);
                }
                else {
                    i18nVarRef = this.i18nTranslate(attr.i18n);
                    i18nVarRefsCache.set(attr.i18n, i18nVarRef);
                }
                attrExprs.push(o.literal(attr.name), i18nVarRef);
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
        const pipeBindExpr = new Call(pipe.span, pipe.sourceSpan, target, [
            new LiteralPrimitive(pipe.span, pipe.sourceSpan, slot),
            new LiteralPrimitive(pipe.span, pipe.sourceSpan, pureFunctionSlot),
            ...convertedArgs,
        ], null);
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
        this.usesRestoredViewContext = false;
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
                        priority: value.priority
                    };
                    // Cache the value locally.
                    this.map.set(name, value);
                    // Possibly generate a shared context var
                    this.maybeGenerateSharedContextVar(value);
                    this.maybeRestoreView();
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
        });
    }
    getComponentProperty(name) {
        const componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
        componentValue.declare = true;
        this.maybeRestoreView();
        return componentValue.lhs.prop(name);
    }
    maybeRestoreView() {
        // View restoration is required for listener instructions inside embedded views, because
        // they only run in creation mode and they can have references to the context object.
        // If the context object changes in update mode, the reference will be incorrect, because
        // it was established during creation.
        if (this.isListenerScope()) {
            if (!this.parent.restoreViewVariable) {
                // parent saves variable to generate a shared `const $s$ = getCurrentView();` instruction
                this.parent.restoreViewVariable = o.variable(this.parent.freshReferenceName());
            }
            this.restoreViewVariable = this.parent.restoreViewVariable;
        }
    }
    restoreViewStatement() {
        const statements = [];
        if (this.restoreViewVariable) {
            const restoreCall = instruction(null, R3.restoreView, [this.restoreViewVariable]);
            // Either `const restoredCtx = restoreView($state$);` or `restoreView($state$);`
            // depending on whether it is being used.
            statements.push(this.usesRestoredViewContext ?
                o.variable(RESTORED_VIEW_CONTEXT_NAME).set(restoreCall).toConstDecl() :
                restoreCall.toStmt());
        }
        return statements;
    }
    viewSnapshotStatements() {
        // const $state$ = getCurrentView();
        return this.restoreViewVariable ?
            [this.restoreViewVariable.set(instruction(null, R3.getCurrentView, [])).toConstDecl()] :
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
    hasRestoreViewVariable() {
        return !!this.restoreViewVariable;
    }
    notifyRestoredViewContextUse() {
        this.usesRestoredViewContext = true;
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
    if (!options.alwaysAttemptHtmlToR3AstConversion && parseResult.errors &&
        parseResult.errors.length > 0) {
        const parsedTemplate = {
            interpolationConfig,
            preserveWhitespaces,
            errors: parseResult.errors,
            nodes: [],
            styleUrls: [],
            styles: [],
            ngContentSelectors: []
        };
        if (options.collectCommentNodes) {
            parsedTemplate.commentNodes = [];
        }
        return parsedTemplate;
    }
    let rootNodes = parseResult.rootNodes;
    // process i18n meta information (scan attributes, generate ids)
    // before we run whitespace removal process, because existing i18n
    // extraction process (ng extract-i18n) relies on a raw content to generate
    // message ids
    const i18nMetaVisitor = new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ !preserveWhitespaces, enableI18nLegacyMessageIdFormat);
    const i18nMetaResult = i18nMetaVisitor.visitAllWithErrors(rootNodes);
    if (!options.alwaysAttemptHtmlToR3AstConversion && i18nMetaResult.errors &&
        i18nMetaResult.errors.length > 0) {
        const parsedTemplate = {
            interpolationConfig,
            preserveWhitespaces,
            errors: i18nMetaResult.errors,
            nodes: [],
            styleUrls: [],
            styles: [],
            ngContentSelectors: []
        };
        if (options.collectCommentNodes) {
            parsedTemplate.commentNodes = [];
        }
        return parsedTemplate;
    }
    rootNodes = i18nMetaResult.rootNodes;
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
    const { nodes, errors, styleUrls, styles, ngContentSelectors, commentNodes } = htmlAstToRender3Ast(rootNodes, bindingParser, { collectCommentNodes: !!options.collectCommentNodes });
    errors.push(...parseResult.errors, ...i18nMetaResult.errors);
    const parsedTemplate = {
        interpolationConfig,
        preserveWhitespaces,
        errors: errors.length > 0 ? errors : null,
        nodes,
        styleUrls,
        styles,
        ngContentSelectors
    };
    if (options.collectCommentNodes) {
        parsedTemplate.commentNodes = commentNodes;
    }
    return parsedTemplate;
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
    if (isTrustedTypesSink(tagName, attr.name)) {
        switch (elementRegistry.securityContext(tagName, attr.name, /* isAttribute */ true)) {
            case core.SecurityContext.HTML:
                return o.taggedTemplate(o.importExpr(R3.trustConstantHtml), new o.TemplateLiteral([new o.TemplateLiteralElement(attr.value)], []), undefined, attr.valueSpan);
            // NB: no SecurityContext.SCRIPT here, as the corresponding tags are stripped by the compiler.
            case core.SecurityContext.RESOURCE_URL:
                return o.taggedTemplate(o.importExpr(R3.trustConstantResourceUrl), new o.TemplateLiteral([new o.TemplateLiteralElement(attr.value)], []), undefined, attr.valueSpan);
            default:
                return value;
        }
    }
    else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUFnQixNQUFNLDBDQUEwQyxDQUFDO0FBRS9LLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsSUFBSSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQW1CLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQzNOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFekQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHNDQUFzQyxDQUFDO0FBRXZHLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixD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QkFBc0I7SUFDN0IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUNoRCxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ25ELEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZmxhdHRlbn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZywgY29udmVydFVwZGF0ZUFyZ3VtZW50cywgTG9jYWxSZXNvbHZlcn0gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIENhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge0l2eVBhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge2lzVHJ1c3RlZFR5cGVzU2lua30gZnJvbSAnLi4vLi4vc2NoZW1hL3RydXN0ZWRfdHlwZXNfc2lua3MnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yLCBwYXJ0aXRpb25BcnJheX0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7STE4bkNvbnRleHR9IGZyb20gJy4vaTE4bi9jb250ZXh0JztcbmltcG9ydCB7Y3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4vaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge0kxOG5NZXRhVmlzaXRvcn0gZnJvbSAnLi9pMThuL21ldGEnO1xuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgYXNzZW1ibGVJMThuQm91bmRTdHJpbmcsIGRlY2xhcmVJMThuVmFyaWFibGUsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgsIGhhc0kxOG5NZXRhLCBJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNoYWluZWRJbnN0cnVjdGlvbiwgQ09OVEVYVF9OQU1FLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nLCBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCwgSU1QTElDSVRfUkVGRVJFTkNFLCBpbnZhbGlkLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSwgdHJpbVRyYWlsaW5nTnVsbHMsIHVuc3VwcG9ydGVkfSBmcm9tICcuL3V0aWwnO1xuXG5cblxuLy8gU2VsZWN0b3IgYXR0cmlidXRlIG5hbWUgb2YgYDxuZy1jb250ZW50PmBcbmNvbnN0IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIgPSAnc2VsZWN0JztcblxuLy8gQXR0cmlidXRlIG5hbWUgb2YgYG5nUHJvamVjdEFzYC5cbmNvbnN0IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FID0gJ25nUHJvamVjdEFzJztcblxuLy8gR2xvYmFsIHN5bWJvbHMgYXZhaWxhYmxlIG9ubHkgaW5zaWRlIGV2ZW50IGJpbmRpbmdzLlxuY29uc3QgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTID0gbmV3IFNldDxzdHJpbmc+KFsnJGV2ZW50J10pO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5leHBvcnQgY29uc3QgTEVBRElOR19UUklWSUFfQ0hBUlMgPSBbJyAnLCAnXFxuJywgJ1xccicsICdcXHQnXTtcblxuLy8gIGlmIChyZiAmIGZsYWdzKSB7IC4uIH1cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgZmxhZ3M6IGNvcmUuUmVuZGVyRmxhZ3MsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLklmU3RtdCB7XG4gIHJldHVybiBvLmlmU3RtdChvLnZhcmlhYmxlKFJFTkRFUl9GTEFHUykuYml0d2lzZUFuZChvLmxpdGVyYWwoZmxhZ3MpLCBudWxsLCBmYWxzZSksIHN0YXRlbWVudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKFxuICAgIGV2ZW50QXN0OiB0LkJvdW5kRXZlbnQsIGhhbmRsZXJOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGwsXG4gICAgc2NvcGU6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgZXZlbnRBcmd1bWVudE5hbWUgPSAnJGV2ZW50JztcbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IGltcGxpY2l0UmVjZWl2ZXJFeHByID0gKHNjb3BlID09PSBudWxsIHx8IHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gMCkgP1xuICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgIHNjb3BlLmdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgIHNjb3BlLCBpbXBsaWNpdFJlY2VpdmVyRXhwciwgaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyksXG4gICAgICBldmVudEFzdC5oYW5kbGVyU3BhbiwgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLCBFVkVOVF9CSU5ESU5HX1NDT1BFX0dMT0JBTFMpO1xuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIC8vIGB2YXJpYWJsZURlY2xhcmF0aW9uc2AgbmVlZHMgdG8gcnVuIGZpcnN0LCBiZWNhdXNlXG4gICAgLy8gYHJlc3RvcmVWaWV3U3RhdGVtZW50YCBkZXBlbmRzIG9uIHRoZSByZXN1bHQuXG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnNjb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkpO1xuICAgIHN0YXRlbWVudHMudW5zaGlmdCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgfVxuICBzdGF0ZW1lbnRzLnB1c2goLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzKTtcblxuICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9XG4gICAgICB0eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZShuYW1lLCBwaGFzZSEpIDogbmFtZTtcbiAgY29uc3QgZm5OYW1lID0gaGFuZGxlck5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGhhbmRsZXJOYW1lKTtcbiAgY29uc3QgZm5BcmdzOiBvLkZuUGFyYW1bXSA9IFtdO1xuXG4gIGlmIChpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMuaGFzKGV2ZW50QXJndW1lbnROYW1lKSkge1xuICAgIGZuQXJncy5wdXNoKG5ldyBvLkZuUGFyYW0oZXZlbnRBcmd1bWVudE5hbWUsIG8uRFlOQU1JQ19UWVBFKSk7XG4gIH1cblxuICBjb25zdCBoYW5kbGVyRm4gPSBvLmZuKGZuQXJncywgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBmbk5hbWUpO1xuICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChldmVudE5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAodGFyZ2V0KSB7XG4gICAgcGFyYW1zLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChmYWxzZSksICAvLyBgdXNlQ2FwdHVyZWAgZmxhZywgZGVmYXVsdHMgdG8gYGZhbHNlYFxuICAgICAgICBvLmltcG9ydEV4cHIoR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KHRhcmdldCkhKSk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtcztcbn1cblxuLy8gQ29sbGVjdHMgaW5mb3JtYXRpb24gbmVlZGVkIHRvIGdlbmVyYXRlIGBjb25zdHNgIGZpZWxkIG9mIHRoZSBDb21wb25lbnREZWYuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBvbmVudERlZkNvbnN0cyB7XG4gIC8qKlxuICAgKiBXaGVuIGEgY29uc3RhbnQgcmVxdWlyZXMgc29tZSBwcmUtcHJvY2Vzc2luZyAoZS5nLiBpMThuIHRyYW5zbGF0aW9uIGJsb2NrIHRoYXQgaW5jbHVkZXNcbiAgICogZ29vZy5nZXRNc2cgYW5kICRsb2NhbGl6ZSBjYWxscyksIHRoZSBgcHJlcGFyZVN0YXRlbWVudHNgIHNlY3Rpb24gY29udGFpbnMgY29ycmVzcG9uZGluZ1xuICAgKiBzdGF0ZW1lbnRzLlxuICAgKi9cbiAgcHJlcGFyZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG5cbiAgLyoqXG4gICAqIEFjdHVhbCBleHByZXNzaW9ucyB0aGF0IHJlcHJlc2VudCBjb25zdGFudHMuXG4gICAqL1xuICBjb25zdEV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXTtcblxuICAvKipcbiAgICogQ2FjaGUgdG8gYXZvaWQgZ2VuZXJhdGluZyBkdXBsaWNhdGVkIGkxOG4gdHJhbnNsYXRpb24gYmxvY2tzLlxuICAgKi9cbiAgaTE4blZhclJlZnNDYWNoZTogTWFwPGkxOG4uSTE4bk1ldGEsIG8uUmVhZFZhckV4cHI+O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZDb25zdHMoKTogQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgcmV0dXJuIHtcbiAgICBwcmVwYXJlU3RhdGVtZW50czogW10sXG4gICAgY29uc3RFeHByZXNzaW9uczogW10sXG4gICAgaTE4blZhclJlZnNDYWNoZTogbmV3IE1hcCgpLFxuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuIFRoaXMgZW5zdXJlc1xuICAgKiBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcblxuICAvKiogSW5kZXggb2YgdGhlIGN1cnJlbnRseS1zZWxlY3RlZCBub2RlLiAqL1xuICBwcml2YXRlIF9jdXJyZW50SW5kZXg6IG51bWJlciA9IDA7XG5cbiAgLyoqIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZ2VuZXJhdGVkIGZyb20gdmlzaXRpbmcgcGlwZXMsIGxpdGVyYWxzLCBldGMuICovXG4gIHByaXZhdGUgX3RlbXBWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGJ1aWxkIG5lc3RlZCB0ZW1wbGF0ZXMuIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbFxuICAgKiBhZnRlciB0aGUgcGFyZW50IHRlbXBsYXRlIGhhcyBmaW5pc2hlZCB2aXNpdGluZyBhbGwgb2YgaXRzIG5vZGVzLiBUaGlzIGVuc3VyZXMgdGhhdCBhbGxcbiAgICogbG9jYWwgcmVmIGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgYXJlIGFibGUgdG8gZmluZCBsb2NhbCByZWYgdmFsdWVzIGlmIHRoZSByZWZzXG4gICAqIGFyZSBkZWZpbmVkIGFmdGVyIHRoZSB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgX25lc3RlZFRlbXBsYXRlRm5zOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAvKipcbiAgICogVGhpcyBzY29wZSBjb250YWlucyBsb2NhbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHVwZGF0ZSBtb2RlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICogKGUuZy4gcmVmcyBhbmQgY29udGV4dCB2YXJzIGluIGJpbmRpbmdzKVxuICAgKi9cbiAgcHJpdmF0ZSBfYmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGU7XG4gIHByaXZhdGUgX3ZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgcHJpdmF0ZSBfdW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcblxuICAvLyBpMThuIGNvbnRleHQgbG9jYWwgdG8gdGhpcyB0ZW1wbGF0ZVxuICBwcml2YXRlIGkxOG46IEkxOG5Db250ZXh0fG51bGwgPSBudWxsO1xuXG4gIC8vIE51bWJlciBvZiBzbG90cyB0byByZXNlcnZlIGZvciBwdXJlRnVuY3Rpb25zXG4gIHByaXZhdGUgX3B1cmVGdW5jdGlvblNsb3RzID0gMDtcblxuICAvLyBOdW1iZXIgb2YgYmluZGluZyBzbG90c1xuICBwcml2YXRlIF9iaW5kaW5nU2xvdHMgPSAwO1xuXG4gIHByaXZhdGUgZmlsZUJhc2VkSTE4blN1ZmZpeDogc3RyaW5nO1xuXG4gIC8vIFByb2plY3Rpb24gc2xvdHMgZm91bmQgaW4gdGhlIHRlbXBsYXRlLiBQcm9qZWN0aW9uIHNsb3RzIGNhbiBkaXN0cmlidXRlIHByb2plY3RlZFxuICAvLyBub2RlcyBiYXNlZCBvbiBhIHNlbGVjdG9yLCBvciBjYW4ganVzdCB1c2UgdGhlIHdpbGRjYXJkIHNlbGVjdG9yIHRvIG1hdGNoXG4gIC8vIGFsbCBub2RlcyB3aGljaCBhcmVuJ3QgbWF0Y2hpbmcgYW55IHNlbGVjdG9yLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzOiAoc3RyaW5nfCcqJylbXSA9IFtdO1xuXG4gIC8vIE51bWJlciBvZiBub24tZGVmYXVsdCBzZWxlY3RvcnMgZm91bmQgaW4gYWxsIHBhcmVudCB0ZW1wbGF0ZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gV2UgbmVlZCB0b1xuICAvLyB0cmFjayBpdCB0byBwcm9wZXJseSBhZGp1c3QgcHJvamVjdGlvbiBzbG90IGluZGV4IGluIHRoZSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb24uXG4gIHByaXZhdGUgX25nQ29udGVudFNlbGVjdG9yc09mZnNldCA9IDA7XG5cbiAgLy8gRXhwcmVzc2lvbiB0aGF0IHNob3VsZCBiZSB1c2VkIGFzIGltcGxpY2l0IHJlY2VpdmVyIHdoZW4gY29udmVydGluZyB0ZW1wbGF0ZVxuICAvLyBleHByZXNzaW9ucyB0byBvdXRwdXQgQVNULlxuICBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyRXhwcjogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCxcbiAgICAgIHByaXZhdGUgY29udGV4dE5hbWU6IHN0cmluZ3xudWxsLCBwcml2YXRlIGkxOG5Db250ZXh0OiBJMThuQ29udGV4dHxudWxsLFxuICAgICAgcHJpdmF0ZSB0ZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgcHJpdmF0ZSB0ZW1wbGF0ZU5hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBTZXQ8by5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgcGlwZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBfbmFtZXNwYWNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLFxuICAgICAgcHJpdmF0ZSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIF9jb25zdGFudHM6IENvbXBvbmVudERlZkNvbnN0cyA9IGNyZWF0ZUNvbXBvbmVudERlZkNvbnN0cygpKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ6IG51bWJlciA9IDAsXG4gICAgICBpMThuPzogaTE4bi5JMThuTWV0YSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID0gdGhpcy5pMThuQ29udGV4dCB8fFxuICAgICAgICAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgIShpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShub2RlcykgJiYgbm9kZXNbMF0uaTE4biA9PT0gaTE4bikpO1xuICAgIGNvbnN0IHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uID0gaGFzVGV4dENoaWxkcmVuT25seShub2Rlcyk7XG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuU3RhcnQobnVsbCwgaTE4biEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIG1heWJlUmVzdG9yZVZpZXcoKTogdm9pZCB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCB0aGlzLmkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpO1xuICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXIgY29uc3QgdG9cbiAgICAvLyBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgIGNvbnN0IGNsb3N1cmVWYXIgPSB0aGlzLmkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZS5pZCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKG1lc3NhZ2UsIF9yZWYsIGNsb3N1cmVWYXIsIHBhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgIHRoaXMuX2NvbnN0YW50cy5wcmVwYXJlU3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIGlmIChzY29wZS5pc0xpc3RlbmVyU2NvcGUoKSAmJiBzY29wZS5oYXNSZXN0b3JlVmlld1ZhcmlhYmxlKCkpIHtcbiAgICAgICAgICAgICAgLy8gZS5nLiByZXN0b3JlZEN0eC5cbiAgICAgICAgICAgICAgLy8gV2UgaGF2ZSB0byBnZXQgdGhlIGNvbnRleHQgZnJvbSBhIHZpZXcgcmVmZXJlbmNlLCBpZiBvbmUgaXMgYXZhaWxhYmxlLCBiZWNhdXNlXG4gICAgICAgICAgICAgIC8vIHRoZSBjb250ZXh0IHRoYXQgd2FzIHBhc3NlZCBpbiBkdXJpbmcgY3JlYXRpb24gbWF5IG5vdCBiZSBjb3JyZWN0IGFueW1vcmUuXG4gICAgICAgICAgICAgIC8vIEZvciBtb3JlIGluZm9ybWF0aW9uIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzQwMzYwLlxuICAgICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICAgICAgc2NvcGUubm90aWZ5UmVzdG9yZWRWaWV3Q29udGV4dFVzZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gZS5nLiBjdHhcbiAgICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zOiBBU1RbXSkge1xuICAgIGlmIChleHByZXNzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBleHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4gdGhpcy5pMThuIS5hcHBlbmRCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHR8dC5Cb3VuZFRleHR9KToge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0ge1xuICAgIGNvbnN0IGJvdW5kOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHByb3BzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gcHJvcHNba2V5XTtcbiAgICAgIGlmIChwcm9wIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwocHJvcC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3AudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9uc30gPSB2YWx1ZTtcbiAgICAgICAgICBjb25zdCB7aWQsIGJpbmRpbmdzfSA9IHRoaXMuaTE4biE7XG4gICAgICAgICAgY29uc3QgbGFiZWwgPSBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZyhzdHJpbmdzLCBiaW5kaW5ncy5zaXplLCBpZCk7XG4gICAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnMpO1xuICAgICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwobGFiZWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9XG5cbiAgLy8gR2VuZXJhdGVzIHRvcCBsZXZlbCB2YXJzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgaTE4bl9OYCkuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCk6IG8uUmVhZFZhckV4cHIge1xuICAgIHJldHVybiBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fVkFSX1BSRUZJWCkpO1xuICB9XG5cbiAgLy8gR2VuZXJhdGVzIHZhcnMgd2l0aCBDbG9zdXJlLXNwZWNpZmljIG5hbWVzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgTVNHX1hYWGApLlxuICBwcml2YXRlIGkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZUlkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBsZXQgbmFtZTogc3RyaW5nO1xuICAgIGNvbnN0IHN1ZmZpeCA9IHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeC50b1VwcGVyQ2FzZSgpO1xuICAgIGlmICh0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcykge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChgRVhURVJOQUxfYCk7XG4gICAgICBjb25zdCB1bmlxdWVTdWZmaXggPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHN1ZmZpeCk7XG4gICAgICBuYW1lID0gYCR7cHJlZml4fSR7c2FuaXRpemVJZGVudGlmaWVyKG1lc3NhZ2VJZCl9JCQke3VuaXF1ZVN1ZmZpeH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KHN1ZmZpeCk7XG4gICAgICBuYW1lID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShwcmVmaXgpO1xuICAgIH1cbiAgICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4blVwZGF0ZVJlZihjb250ZXh0OiBJMThuQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IHtpY3VzLCBtZXRhLCBpc1Jvb3QsIGlzUmVzb2x2ZWQsIGlzRW1pdHRlZH0gPSBjb250ZXh0O1xuICAgIGlmIChpc1Jvb3QgJiYgaXNSZXNvbHZlZCAmJiAhaXNFbWl0dGVkICYmICFpc1NpbmdsZUkxOG5JY3UobWV0YSkpIHtcbiAgICAgIGNvbnRleHQuaXNFbWl0dGVkID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGNvbnRleHQuZ2V0U2VyaWFsaXplZFBsYWNlaG9sZGVycygpO1xuICAgICAgbGV0IGljdU1hcHBpbmc6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgICAgbGV0IHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID1cbiAgICAgICAgICBwbGFjZWhvbGRlcnMuc2l6ZSA/IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycykgOiB7fTtcbiAgICAgIGlmIChpY3VzLnNpemUpIHtcbiAgICAgICAgaWN1cy5mb3JFYWNoKChyZWZzOiBvLkV4cHJlc3Npb25bXSwga2V5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgb25lIElDVSBkZWZpbmVkIGZvciBhIGdpdmVuXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciAtIGp1c3Qgb3V0cHV0IGl0cyByZWZlcmVuY2VcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gcmVmc1swXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gLi4uIG90aGVyd2lzZSB3ZSBuZWVkIHRvIGFjdGl2YXRlIHBvc3QtcHJvY2Vzc2luZ1xuICAgICAgICAgICAgLy8gdG8gcmVwbGFjZSBJQ1UgcGxhY2Vob2xkZXJzIHdpdGggcHJvcGVyIHZhbHVlc1xuICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZyA9IHdyYXBJMThuUGxhY2Vob2xkZXIoYCR7STE4Tl9JQ1VfTUFQUElOR19QUkVGSVh9JHtrZXl9YCk7XG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IG8ubGl0ZXJhbChwbGFjZWhvbGRlcik7XG4gICAgICAgICAgICBpY3VNYXBwaW5nW2tleV0gPSBvLmxpdGVyYWxBcnIocmVmcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJhbnNsYXRpb24gcmVxdWlyZXMgcG9zdCBwcm9jZXNzaW5nIGluIDIgY2FzZXM6XG4gICAgICAvLyAtIGlmIHdlIGhhdmUgcGxhY2Vob2xkZXJzIHdpdGggbXVsdGlwbGUgdmFsdWVzIChleC4gYFNUQVJUX0RJVmA6IFvvv70jMe+/vSwg77+9IzLvv70sIC4uLl0pXG4gICAgICAvLyAtIGlmIHdlIGhhdmUgbXVsdGlwbGUgSUNVcyB0aGF0IHJlZmVyIHRvIHRoZSBzYW1lIHBsYWNlaG9sZGVyIG5hbWVcbiAgICAgIGNvbnN0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPVxuICAgICAgICAgIEFycmF5LmZyb20ocGxhY2Vob2xkZXJzLnZhbHVlcygpKS5zb21lKCh2YWx1ZTogc3RyaW5nW10pID0+IHZhbHVlLmxlbmd0aCA+IDEpIHx8XG4gICAgICAgICAgT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoO1xuXG4gICAgICBsZXQgdHJhbnNmb3JtRm47XG4gICAgICBpZiAobmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgICAgICB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtyYXddO1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFyZ3MucHVzaChtYXBMaXRlcmFsKGljdU1hcHBpbmcsIHRydWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWV0YSBhcyBpMThuLk1lc3NhZ2UsIHBhcmFtcywgY29udGV4dC5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5TdGFydChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIG1ldGE6IGkxOG4uSTE4bk1ldGEsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIHRoaXMuaTE4biA9IHRoaXMuaTE4bkNvbnRleHQgP1xuICAgICAgICB0aGlzLmkxOG5Db250ZXh0LmZvcmtDaGlsZENvbnRleHQoaW5kZXgsIHRoaXMudGVtcGxhdGVJbmRleCEsIG1ldGEpIDpcbiAgICAgICAgbmV3IEkxOG5Db250ZXh0KGluZGV4LCB0aGlzLmkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpLCAwLCB0aGlzLnRlbXBsYXRlSW5kZXgsIG1ldGEpO1xuXG4gICAgLy8gZ2VuZXJhdGUgaTE4blN0YXJ0IGluc3RydWN0aW9uXG4gICAgY29uc3Qge2lkLCByZWZ9ID0gdGhpcy5pMThuO1xuICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGluZGV4KSwgdGhpcy5hZGRUb0NvbnN0cyhyZWYpXTtcbiAgICBpZiAoaWQgPiAwKSB7XG4gICAgICAvLyBkbyBub3QgcHVzaCAzcmQgYXJndW1lbnQgKHN1Yi1ibG9jayBpZClcbiAgICAgIC8vIGludG8gaTE4blN0YXJ0IGNhbGwgZm9yIHRvcCBsZXZlbCBpMThuIGNvbnRleHRcbiAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpZCkpO1xuICAgIH1cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3Bhbiwgc2VsZkNsb3NpbmcgPyBSMy5pMThuIDogUjMuaTE4blN0YXJ0LCBwYXJhbXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuRW5kKHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaTE4bkVuZCBpcyBleGVjdXRlZCB3aXRoIG5vIGkxOG4gY29udGV4dCBwcmVzZW50Jyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4bkNvbnRleHQucmVjb25jaWxlQ2hpbGRDb250ZXh0KHRoaXMuaTE4bik7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuQ29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG4pO1xuICAgIH1cblxuICAgIC8vIHNldHVwIGFjY3VtdWxhdGVkIGJpbmRpbmdzXG4gICAgY29uc3Qge2luZGV4LCBiaW5kaW5nc30gPSB0aGlzLmkxOG47XG4gICAgaWYgKGJpbmRpbmdzLnNpemUpIHtcbiAgICAgIGNvbnN0IGNoYWluQmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgICBiaW5kaW5ncy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgICBjaGFpbkJpbmRpbmdzLnB1c2goe3NvdXJjZVNwYW46IHNwYW4sIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYmluZGluZyl9KTtcbiAgICAgIH0pO1xuICAgICAgLy8gZm9yIGkxOG4gYmxvY2ssIGFkdmFuY2UgdG8gdGhlIG1vc3QgcmVjZW50IGVsZW1lbnQgaW5kZXggKGJ5IHRha2luZyB0aGUgY3VycmVudCBudW1iZXIgb2ZcbiAgICAgIC8vIGVsZW1lbnRzIGFuZCBzdWJ0cmFjdGluZyBvbmUpIGJlZm9yZSBpbnZva2luZyBgaTE4bkV4cGAgaW5zdHJ1Y3Rpb25zLCB0byBtYWtlIHN1cmUgdGhlXG4gICAgICAvLyBuZWNlc3NhcnkgbGlmZWN5Y2xlIGhvb2tzIG9mIGNvbXBvbmVudHMvZGlyZWN0aXZlcyBhcmUgcHJvcGVybHkgZmx1c2hlZC5cbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKHRoaXMuZ2V0Q29uc3RDb3VudCgpIC0gMSwgUjMuaTE4bkV4cCwgY2hhaW5CaW5kaW5ncyk7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChpbmRleCldKTtcbiAgICB9XG4gICAgaWYgKCFzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5FbmQpO1xuICAgIH1cbiAgICB0aGlzLmkxOG4gPSBudWxsOyAgLy8gcmVzZXQgbG9jYWwgaTE4biBjb250ZXh0XG4gIH1cblxuICBwcml2YXRlIGkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgYXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgY29uc3QgaTE4bkF0dHJBcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gYXR0ci5pMThuISBhcyBpMThuLk1lc3NhZ2U7XG4gICAgICBjb25zdCBjb252ZXJ0ZWQgPSBhdHRyLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMoY29udmVydGVkKTtcbiAgICAgIGlmIChjb252ZXJ0ZWQgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzKG1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnMpO1xuICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBhcmFtcykpO1xuICAgICAgICBjb252ZXJ0ZWQuZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHtcbiAgICAgICAgICBoYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgICAgICAgYmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhleHByZXNzaW9uKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKG5vZGVJbmRleCwgUjMuaTE4bkV4cCwgYmluZGluZ3MpO1xuICAgIH1cbiAgICBpZiAoaTE4bkF0dHJBcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGluZGV4OiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpO1xuICAgICAgY29uc3QgY29uc3RJbmRleCA9IHRoaXMuYWRkVG9Db25zdHMoby5saXRlcmFsQXJyKGkxOG5BdHRyQXJncykpO1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLmkxOG5BdHRyaWJ1dGVzLCBbaW5kZXgsIGNvbnN0SW5kZXhdKTtcbiAgICAgIGlmIChoYXNCaW5kaW5ncykge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXk6IHN0cmluZ3xudWxsKSB7XG4gICAgc3dpdGNoIChuYW1lc3BhY2VLZXkpIHtcbiAgICAgIGNhc2UgJ21hdGgnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlTWF0aE1MO1xuICAgICAgY2FzZSAnc3ZnJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZVNWRztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VIVE1MO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzXG4gICAqIGBwcm9wPVwie3t2YWx1ZX19XCJgIG9yIGBhdHRyLnRpdGxlPVwie3t2YWx1ZX19XCJgXG4gICAqL1xuICBwcml2YXRlIGludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnRJbmRleDogbnVtYmVyLCBhdHRyTmFtZTogc3RyaW5nLFxuICAgICAgaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIHZhbHVlOiBhbnksIHBhcmFtczogYW55W10pIHtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwoYXR0ck5hbWUpLCAuLi50aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSwgLi4ucGFyYW1zXSk7XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcHJvamVjdGlvblNsb3RJZHggPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgKyB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuXG4gICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5wdXNoKG5nQ29udGVudC5zZWxlY3Rvcik7XG5cbiAgICBjb25zdCBub25Db250ZW50U2VsZWN0QXR0cmlidXRlcyA9XG4gICAgICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+IGF0dHIubmFtZS50b0xvd2VyQ2FzZSgpICE9PSBOR19DT05URU5UX1NFTEVDVF9BVFRSKTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID1cbiAgICAgICAgdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhuZ0NvbnRlbnQubmFtZSwgbm9uQ29udGVudFNlbGVjdEF0dHJpYnV0ZXMsIFtdLCBbXSk7XG5cbiAgICBpZiAoYXR0cmlidXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSwgby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpKTtcbiAgICB9IGVsc2UgaWYgKHByb2plY3Rpb25TbG90SWR4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG5nQ29udGVudC5zb3VyY2VTcGFuLCBSMy5wcm9qZWN0aW9uLCBwYXJhbWV0ZXJzKTtcbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kUHJvamVjdGlvbihuZ0NvbnRlbnQuaTE4biEsIHNsb3QpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzdHlsaW5nQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihudWxsKTtcblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50OiBib29sZWFuID1cbiAgICAgICAgaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGVsZW1lbnQuaTE4bik7XG5cbiAgICBjb25zdCBvdXRwdXRBdHRyczogdC5UZXh0QXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuICAgIGNvbnN0IGlzTmdDb250YWluZXIgPSBjaGVja0lzTmdDb250YWluZXIoZWxlbWVudC5uYW1lKTtcblxuICAgIC8vIEhhbmRsZSBzdHlsaW5nLCBpMThuLCBuZ05vbkJpbmRhYmxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cjtcbiAgICAgIGlmIChuYW1lID09PSBOT05fQklOREFCTEVfQVRUUikge1xuICAgICAgICBpc05vbkJpbmRhYmxlTW9kZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzLnB1c2goYXR0cik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgdGhpcy5tYXRjaERpcmVjdGl2ZXMoZWxlbWVudC5uYW1lLCBlbGVtZW50KTtcblxuICAgIC8vIFJlZ3VsYXIgZWxlbWVudCBvciBuZy1jb250YWluZXIgY3JlYXRpb24gbW9kZVxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChlbGVtZW50SW5kZXgpXTtcbiAgICBpZiAoIWlzTmdDb250YWluZXIpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoZWxlbWVudE5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBhbGxPdGhlcklucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgYm91bmRJMThuQXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQpO1xuICAgICAgaWYgKCFzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgICAgaWYgKGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5ICYmIGlucHV0LmkxOG4pIHtcbiAgICAgICAgICBib3VuZEkxOG5BdHRycy5wdXNoKGlucHV0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gYWRkIGF0dHJpYnV0ZXMgZm9yIGRpcmVjdGl2ZSBhbmQgcHJvamVjdGlvbiBtYXRjaGluZyBwdXJwb3Nlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgICAgZWxlbWVudC5uYW1lLCBvdXRwdXRBdHRycywgYWxsT3RoZXJJbnB1dHMsIGVsZW1lbnQub3V0cHV0cywgc3R5bGluZ0J1aWxkZXIsIFtdLFxuICAgICAgICBib3VuZEkxOG5BdHRycyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIGNvbnN0IHJlZnMgPSB0aGlzLnByZXBhcmVSZWZzQXJyYXkoZWxlbWVudC5yZWZlcmVuY2VzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRUb0NvbnN0cyhyZWZzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biEsIGVsZW1lbnRJbmRleCk7XG4gICAgfVxuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIG5vdCBhcHBlbmQgdGV4dCBub2RlIGluc3RydWN0aW9ucyBhbmQgSUNVcyBpbnNpZGUgaTE4biBzZWN0aW9uLFxuICAgIC8vIHNvIHdlIGV4Y2x1ZGUgdGhlbSB3aGlsZSBjYWxjdWxhdGluZyB3aGV0aGVyIGN1cnJlbnQgZWxlbWVudCBoYXMgY2hpbGRyZW5cbiAgICBjb25zdCBoYXNDaGlsZHJlbiA9ICghaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSA/ICFoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMDtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhc3R5bGluZ0J1aWxkZXIuaGFzQmluZGluZ3NXaXRoUGlwZXMgJiZcbiAgICAgICAgZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA9PT0gMCAmJiBib3VuZEkxOG5BdHRycy5sZW5ndGggPT09IDAgJiYgIWhhc0NoaWxkcmVuO1xuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uID1cbiAgICAgICAgIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gJiYgaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKTtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lciA6IFIzLmVsZW1lbnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBSMy5kaXNhYmxlQmluZGluZ3MpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYm91bmRJMThuQXR0cnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBlbGVtZW50SW5kZXgsIGJvdW5kSTE4bkF0dHJzLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiA/PyBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgICBpZiAoZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gZWxlbWVudC5vdXRwdXRzLm1hcChcbiAgICAgICAgICAgIChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4gKHtcbiAgICAgICAgICAgICAgc291cmNlU3Bhbjogb3V0cHV0QXN0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgIHBhcmFtczogdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoZWxlbWVudC5uYW1lLCBvdXRwdXRBc3QsIGVsZW1lbnRJbmRleClcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uQ2hhaW4oUjMubGlzdGVuZXIsIGxpc3RlbmVycyk7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGU6IGl0J3MgaW1wb3J0YW50IHRvIGtlZXAgaTE4bi9pMThuU3RhcnQgaW5zdHJ1Y3Rpb25zIGFmdGVyIGkxOG5BdHRyaWJ1dGVzIGFuZFxuICAgICAgLy8gbGlzdGVuZXJzLCB0byBtYWtlIHN1cmUgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24gdGFyZ2V0cyBjdXJyZW50IGVsZW1lbnQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5TdGFydChlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5pMThuISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBzdHlsZVByb3BgLFxuICAgIC8vIGBzdHlsZU1hcGAsIGBjbGFzc01hcGAsIGBjbGFzc1Byb3BgXG4gICAgLy8gYXJlIGFsbCBnZW5lcmF0ZWQgYW5kIGFzc2lnbmVkIGluIHRoZSBjb2RlIGJlbG93LlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbnMgPSBzdHlsaW5nQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBjb25zdCBsaW1pdCA9IHN0eWxpbmdJbnN0cnVjdGlvbnMubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IHN0eWxpbmdJbnN0cnVjdGlvbnNbaV07XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdGhpcy5wcm9jZXNzU3R5bGluZ1VwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIHRoZSByZWFzb24gd2h5IGB1bmRlZmluZWRgIGlzIHVzZWQgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgdW5kZXJzdGFuZHMgdGhpcyBhcyBhXG4gICAgLy8gc3BlY2lhbCB2YWx1ZSB0byBzeW1ib2xpemUgdGhhdCB0aGVyZSBpcyBubyBSSFMgdG8gdGhpcyBiaW5kaW5nXG4gICAgLy8gVE9ETyAobWF0c2tvKTogcmV2aXNpdCB0aGlzIG9uY2UgRlctOTU5IGlzIGFwcHJvYWNoZWRcbiAgICBjb25zdCBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uID0gby5saXRlcmFsKHVuZGVmaW5lZCk7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVCaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IGlucHV0VHlwZSA9IGlucHV0LnR5cGU7XG4gICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIGFuaW1hdGlvbiBiaW5kaW5ncyBjYW4gYmUgcHJlc2VudGVkIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgLy8gMS4gW0BiaW5kaW5nXT1cImZvb0V4cFwiXG4gICAgICAgIC8vIDIuIFtAYmluZGluZ109XCJ7dmFsdWU6Zm9vRXhwLCBwYXJhbXM6ey4uLn19XCJcbiAgICAgICAgLy8gMy4gW0BiaW5kaW5nXVxuICAgICAgICAvLyA0LiBAYmluZGluZ1xuICAgICAgICAvLyBBbGwgZm9ybWF0cyB3aWxsIGJlIHZhbGlkIGZvciB3aGVuIGEgc3ludGhldGljIGJpbmRpbmcgaXMgY3JlYXRlZC5cbiAgICAgICAgLy8gVGhlIHJlYXNvbmluZyBmb3IgdGhpcyBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciBzaG91bGQgZ2V0IGVhY2hcbiAgICAgICAgLy8gc3ludGhldGljIGJpbmRpbmcgdmFsdWUgaW4gdGhlIG9yZGVyIG9mIHRoZSBhcnJheSB0aGF0IHRoZXkgYXJlXG4gICAgICAgIC8vIGRlZmluZWQgaW4uLi5cbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIExpdGVyYWxQcmltaXRpdmUgPyAhIXZhbHVlLnZhbHVlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGlucHV0Lm5hbWUpLFxuICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgdmFsdWU6ICgpID0+IGhhc1ZhbHVlID8gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSA6IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb25cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBtdXN0IHNraXAgYXR0cmlidXRlcyB3aXRoIGFzc29jaWF0ZWQgaTE4biBjb250ZXh0LCBzaW5jZSB0aGVzZSBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkXG4gICAgICAgIC8vIHNlcGFyYXRlbHkgYW5kIGNvcnJlc3BvbmRpbmcgYGkxOG5FeHBgIGFuZCBgaTE4bkFwcGx5YCBpbnN0cnVjdGlvbnMgd2lsbCBiZSBnZW5lcmF0ZWRcbiAgICAgICAgaWYgKGlucHV0LmkxOG4pIHJldHVybjtcblxuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3QgW2F0dHJOYW1lc3BhY2UsIGF0dHJOYW1lXSA9IHNwbGl0TnNOYW1lKGlucHV0Lm5hbWUpO1xuICAgICAgICAgIGNvbnN0IGlzQXR0cmlidXRlQmluZGluZyA9IGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlO1xuICAgICAgICAgIGNvbnN0IHNhbml0aXphdGlvblJlZiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dC5zZWN1cml0eUNvbnRleHQsIGlzQXR0cmlidXRlQmluZGluZyk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcbiAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZXNwYWNlTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyTmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoZXJlIHdhc24ndCBhIHNhbml0aXphdGlvbiByZWYsIHdlIG5lZWQgdG8gYWRkXG4gICAgICAgICAgICAgIC8vIGFuIGV4dHJhIHBhcmFtIHNvIHRoYXQgd2UgY2FuIHBhc3MgaW4gdGhlIG5hbWVzcGFjZS5cbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKG51bGwpLCBuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICAvLyBwcm9wPVwie3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIlxuICAgICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCB0aGUgcHJvcGVydGllcyBzbyB0aGF0IHdlIGNhbiBjaGFpbiBpbnRvIGEgc2luZ2xlIGZ1bmN0aW9uIGF0IHRoZSBlbmQuXG4gICAgICAgICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXR0ck5hbWUsXG4gICAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSxcbiAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiAmJiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCh2YWx1ZSkgPiAxKSB7XG4gICAgICAgICAgICAgIC8vIGF0dHIubmFtZT1cInRleHR7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYm91bmRWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IHZhbHVlLmV4cHJlc3Npb25zWzBdIDogdmFsdWU7XG4gICAgICAgICAgICAgIC8vIFthdHRyLm5hbWVdPVwidmFsdWVcIiBvciBhdHRyLm5hbWU9XCJ7e3ZhbHVlfX1cIlxuICAgICAgICAgICAgICAvLyBDb2xsZWN0IHRoZSBhdHRyaWJ1dGUgYmluZGluZ3Mgc28gdGhhdCB0aGV5IGNhbiBiZSBjaGFpbmVkIGF0IHRoZSBlbmQuXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IGF0dHJOYW1lLFxuICAgICAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhib3VuZFZhbHVlKSxcbiAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsYXNzIHByb3BcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIFIzLmNsYXNzUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwoYXR0ck5hbWUpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpLFxuICAgICAgICAgICAgICAgIC4uLnBhcmFtc1xuICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIFIzLnByb3BlcnR5LCBwcm9wZXJ0eUJpbmRpbmdzKTtcbiAgICB9XG5cbiAgICBpZiAoYXR0cmlidXRlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoZWxlbWVudEluZGV4LCBSMy5hdHRyaWJ1dGUsIGF0dHJpYnV0ZUJpbmRpbmdzKTtcbiAgICB9XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgdC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcblxuICAgIGlmICghaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4hLCBlbGVtZW50SW5kZXgsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICBjb25zdCBzcGFuID0gZWxlbWVudC5lbmRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5FbmQoc3BhbiwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG4gIH1cblxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCBOR19URU1QTEFURV9UQUdfTkFNRSA9ICduZy10ZW1wbGF0ZSc7XG4gICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFRlbXBsYXRlKHRlbXBsYXRlLmkxOG4hLCB0ZW1wbGF0ZUluZGV4KTtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9XG4gICAgICAgIHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWU7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfSR7XG4gICAgICAgIHRlbXBsYXRlLnRhZ05hbWUgPyAnXycgKyBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSkgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgIG8udmFyaWFibGUodGVtcGxhdGVOYW1lKSxcbiAgICAgIC8vIFdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHRhZydzIG5hbWVzcGFjZSBoZXJlLCBiZWNhdXNlIHdlIGluZmVyXG4gICAgICAvLyBpdCBiYXNlZCBvbiB0aGUgcGFyZW50IG5vZGVzIGluc2lkZSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uXG4gICAgICBvLmxpdGVyYWwodGFnTmFtZVdpdGhvdXROYW1lc3BhY2UpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgICAgTkdfVEVNUExBVEVfVEFHX05BTUUsIHRlbXBsYXRlLmF0dHJpYnV0ZXMsIHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cyxcbiAgICAgICAgdW5kZWZpbmVkIC8qIHN0eWxlcyAqLywgdGVtcGxhdGUudGVtcGxhdGVBdHRycyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheSh0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmltcG9ydEV4cHIoUjMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGhpcy5pMThuLFxuICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZU5hbWUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlciwgdGhpcy5kaXJlY3RpdmVzLCB0aGlzLnBpcGVUeXBlQnlOYW1lLFxuICAgICAgICB0aGlzLnBpcGVzLCB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgICAgIHRoaXMuX2NvbnN0YW50cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgPG5nLXRlbXBsYXRlPiBlbGVtZW50cy5cbiAgICBpZiAodGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICBjb25zdCBbaTE4bklucHV0cywgaW5wdXRzXSA9XG4gICAgICAgICAgcGFydGl0aW9uQXJyYXk8dC5Cb3VuZEF0dHJpYnV0ZSwgdC5Cb3VuZEF0dHJpYnV0ZT4odGVtcGxhdGUuaW5wdXRzLCBoYXNJMThuTWV0YSk7XG5cbiAgICAgIC8vIEFkZCBpMThuIGF0dHJpYnV0ZXMgdGhhdCBtYXkgYWN0IGFzIGlucHV0cyB0byBkaXJlY3RpdmVzLiBJZiBzdWNoIGF0dHJpYnV0ZXMgYXJlIHByZXNlbnQsXG4gICAgICAvLyBnZW5lcmF0ZSBgaTE4bkF0dHJpYnV0ZXNgIGluc3RydWN0aW9uLiBOb3RlOiB3ZSBnZW5lcmF0ZSBpdCBvbmx5IGZvciBleHBsaWNpdCA8bmctdGVtcGxhdGU+XG4gICAgICAvLyBlbGVtZW50cywgaW4gY2FzZSBvZiBpbmxpbmUgdGVtcGxhdGVzLCBjb3JyZXNwb25kaW5nIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZCBpbiB0aGVcbiAgICAgIC8vIG5lc3RlZCB0ZW1wbGF0ZSBmdW5jdGlvbi5cbiAgICAgIGlmIChpMThuSW5wdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5pMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgICAgICAgdGVtcGxhdGVJbmRleCwgaTE4bklucHV0cywgdGVtcGxhdGUuc3RhcnRTb3VyY2VTcGFuID8/IHRlbXBsYXRlLnNvdXJjZVNwYW4pO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICBpZiAoaW5wdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3ModGVtcGxhdGVJbmRleCwgaW5wdXRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICBpZiAodGVtcGxhdGUub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRlbXBsYXRlLm91dHB1dHMubWFwKFxuICAgICAgICAgICAgKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiAoe1xuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBvdXRwdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgcGFyYW1zOiB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4hKTtcbiAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3ModmFsdWUuZXhwcmVzc2lvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgIG5vZGVJbmRleCwgdGV4dC5zb3VyY2VTcGFuLCBnZXRUZXh0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLFxuICAgICAgICAgICgpID0+IHRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3IoJ1RleHQgbm9kZXMgc2hvdWxkIGJlIGludGVycG9sYXRlZCBhbmQgbmV2ZXIgYm91bmQgZGlyZWN0bHkuJyk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIC8vIHdoZW4gYSB0ZXh0IGVsZW1lbnQgaXMgbG9jYXRlZCB3aXRoaW4gYSB0cmFuc2xhdGFibGVcbiAgICAvLyBibG9jaywgd2UgZXhjbHVkZSB0aGlzIHRleHQgZWxlbWVudCBmcm9tIGluc3RydWN0aW9ucyBzZXQsXG4gICAgLy8gc2luY2UgaXQgd2lsbCBiZSBjYXB0dXJlZCBpbiBpMThuIGNvbnRlbnQgYW5kIHByb2Nlc3NlZCBhdCBydW50aW1lXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCBvLmxpdGVyYWwodGV4dC52YWx1ZSldKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEljdShpY3U6IHQuSWN1KSB7XG4gICAgbGV0IGluaXRXYXNJbnZva2VkID0gZmFsc2U7XG5cbiAgICAvLyBpZiBhbiBJQ1Ugd2FzIGNyZWF0ZWQgb3V0c2lkZSBvZiBpMThuIGJsb2NrLCB3ZSBzdGlsbCB0cmVhdFxuICAgIC8vIGl0IGFzIGEgdHJhbnNsYXRhYmxlIGVudGl0eSBhbmQgaW52b2tlIGkxOG5TdGFydCBhbmQgaTE4bkVuZFxuICAgIC8vIHRvIGdlbmVyYXRlIGkxOG4gY29udGV4dCBhbmQgdGhlIG5lY2Vzc2FyeSBpbnN0cnVjdGlvbnNcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgaW5pdFdhc0ludm9rZWQgPSB0cnVlO1xuICAgICAgdGhpcy5pMThuU3RhcnQobnVsbCwgaWN1LmkxOG4hLCB0cnVlKTtcbiAgICB9XG5cbiAgICBjb25zdCBpMThuID0gdGhpcy5pMThuITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biEgYXMgaTE4bi5NZXNzYWdlO1xuXG4gICAgLy8gd2UgYWx3YXlzIG5lZWQgcG9zdC1wcm9jZXNzaW5nIGZ1bmN0aW9uIGZvciBJQ1VzLCB0byBtYWtlIHN1cmUgdGhhdDpcbiAgICAvLyAtIGFsbCBwbGFjZWhvbGRlcnMgaW4gYSBmb3JtIG9mIHtQTEFDRUhPTERFUn0gYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyAobm90ZTpcbiAgICAvLyBgZ29vZy5nZXRNc2dgIGRvZXMgbm90IHByb2Nlc3MgSUNVcyBhbmQgdXNlcyB0aGUgYHtQTEFDRUhPTERFUn1gIGZvcm1hdCBmb3IgcGxhY2Vob2xkZXJzXG4gICAgLy8gaW5zaWRlIElDVXMpXG4gICAgLy8gLSBhbGwgSUNVIHZhcnMgKHN1Y2ggYXMgYFZBUl9TRUxFQ1RgIG9yIGBWQVJfUExVUkFMYCkgYXJlIHJlcGxhY2VkIHdpdGggY29ycmVjdCB2YWx1ZXNcbiAgICBjb25zdCB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHsuLi52YXJzLCAuLi5wbGFjZWhvbGRlcnN9O1xuICAgICAgY29uc3QgZm9ybWF0dGVkID0gaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgW3JhdywgbWFwTGl0ZXJhbChmb3JtYXR0ZWQsIHRydWUpXSk7XG4gICAgfTtcblxuICAgIC8vIGluIGNhc2UgdGhlIHdob2xlIGkxOG4gbWVzc2FnZSBpcyBhIHNpbmdsZSBJQ1UgLSB3ZSBkbyBub3QgbmVlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHNlcGFyYXRlIHRvcC1sZXZlbCB0cmFuc2xhdGlvbiwgd2UgY2FuIHVzZSB0aGUgcm9vdCByZWYgaW5zdGVhZFxuICAgIC8vIGFuZCBtYWtlIHRoaXMgSUNVIGEgdG9wLWxldmVsIHRyYW5zbGF0aW9uXG4gICAgLy8gbm90ZTogSUNVIHBsYWNlaG9sZGVycyBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIGluIGBpMThuUG9zdHByb2Nlc3NgIGZ1bmN0aW9uXG4gICAgLy8gc2VwYXJhdGVseSwgc28gd2UgZG8gbm90IHBhc3MgcGxhY2Vob2xkZXJzIGludG8gYGkxOG5UcmFuc2xhdGVgIGZ1bmN0aW9uLlxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9XG4gICAgICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgLyogcmVmICovIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkge1xuICAgIHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKztcbiAgfVxuXG4gIGdldENvbnN0Q291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RhdGFJbmRleDtcbiAgfVxuXG4gIGdldFZhckNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cztcbiAgfVxuXG4gIGdldENvbnN0cygpOiBDb21wb25lbnREZWZDb25zdHMge1xuICAgIHJldHVybiB0aGlzLl9jb25zdGFudHM7XG4gIH1cblxuICBnZXROZ0NvbnRlbnRTZWxlY3RvcnMoKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIHJldHVybiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwodGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cyksIHRydWUpIDpcbiAgICAgICAgbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDtcbiAgfVxuXG4gIHByaXZhdGUgdGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBhdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdKSB7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAvLyBQYXJhbXMgdHlwaWNhbGx5IGNvbnRhaW4gYXR0cmlidXRlIG5hbWVzcGFjZSBhbmQgdmFsdWUgc2FuaXRpemVyLCB3aGljaCBpcyBhcHBsaWNhYmxlXG4gICAgICAgICAgICAvLyBmb3IgcmVndWxhciBIVE1MIGVsZW1lbnRzLCBidXQgbm90IGFwcGxpY2FibGUgZm9yIDxuZy10ZW1wbGF0ZT4gKHNpbmNlIHByb3BzIGFjdCBhc1xuICAgICAgICAgICAgLy8gaW5wdXRzIHRvIGRpcmVjdGl2ZXMpLCBzbyBrZWVwIHBhcmFtcyBhcnJheSBlbXB0eS5cbiAgICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGNhc2VcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIHRlbXBsYXRlSW5kZXgsIGlucHV0Lm5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBbcHJvcF09XCJ2YWx1ZVwiIGNhc2VcbiAgICAgICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgIG5hbWU6IGlucHV0Lm5hbWUsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChwcm9wZXJ0eUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKHRlbXBsYXRlSW5kZXgsIFIzLnByb3BlcnR5LCBwcm9wZXJ0eUJpbmRpbmdzKTtcbiAgICB9XG4gIH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcbiAgICBmbnNbcHJlcGVuZCA/ICd1bnNoaWZ0JyA6ICdwdXNoJ10oKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcm9jZXNzU3R5bGluZ1VwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgZWxlbWVudEluZGV4OiBudW1iZXIsIGluc3RydWN0aW9uOiBTdHlsaW5nSW5zdHJ1Y3Rpb258bnVsbCkge1xuICAgIGxldCBhbGxvY2F0ZUJpbmRpbmdTbG90cyA9IDA7XG4gICAgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICBjb25zdCBjYWxsczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcblxuICAgICAgaW5zdHJ1Y3Rpb24uY2FsbHMuZm9yRWFjaChjYWxsID0+IHtcbiAgICAgICAgYWxsb2NhdGVCaW5kaW5nU2xvdHMgKz0gY2FsbC5hbGxvY2F0ZUJpbmRpbmdTbG90cztcbiAgICAgICAgY2FsbHMucHVzaCh7XG4gICAgICAgICAgc291cmNlU3BhbjogY2FsbC5zb3VyY2VTcGFuLFxuICAgICAgICAgIHZhbHVlOiAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbC5wYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0+IChjYWxsLnN1cHBvcnRzSW50ZXJwb2xhdGlvbiAmJiB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkpIGFzIG8uRXhwcmVzc2lvbltdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIGNhbGxzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ/OiBib29sZWFuKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdLCBwcmVwZW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgY2FsbHM6IHtcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICBwYXJhbXM6ICgpID0+IG8uRXhwcmVzc2lvbltdXG4gIH1bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBjYWxscy5sZW5ndGggPyBjYWxsc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcbiAgICB0aGlzLl9jcmVhdGlvbkNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMubWFwKGNhbGwgPT4gY2FsbC5wYXJhbXMoKSksIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3Nhcnkobm9kZUluZGV4LCBzcGFuKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbik7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uQ2hhaW4oXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBiaW5kaW5ncy5sZW5ndGggPyBiaW5kaW5nc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcblxuICAgIHRoaXMuX3VwZGF0ZUNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCBjYWxscyA9IGJpbmRpbmdzLm1hcChwcm9wZXJ0eSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcGVydHkudmFsdWUoKTtcbiAgICAgICAgY29uc3QgZm5QYXJhbXMgPSBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlIDogW3ZhbHVlXTtcbiAgICAgICAgaWYgKHByb3BlcnR5LnBhcmFtcykge1xuICAgICAgICAgIGZuUGFyYW1zLnB1c2goLi4ucHJvcGVydHkucGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydHkubmFtZSkge1xuICAgICAgICAgIC8vIFdlIHdhbnQgdGhlIHByb3BlcnR5IG5hbWUgdG8gYWx3YXlzIGJlIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgICAgICAgZm5QYXJhbXMudW5zaGlmdChvLmxpdGVyYWwocHJvcGVydHkubmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmblBhcmFtcztcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMsIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBiaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10pIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KFxuICAgICAgICBub2RlSW5kZXgsIGJpbmRpbmdzLmxlbmd0aCA/IGJpbmRpbmdzWzBdLnNvdXJjZVNwYW4gOiBudWxsKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW4ocmVmZXJlbmNlLCBiaW5kaW5ncyk7XG4gIH1cblxuICBwcml2YXRlIGFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIGlmIChub2RlSW5kZXggIT09IHRoaXMuX2N1cnJlbnRJbmRleCkge1xuICAgICAgY29uc3QgZGVsdGEgPSBub2RlSW5kZXggLSB0aGlzLl9jdXJyZW50SW5kZXg7XG5cbiAgICAgIGlmIChkZWx0YSA8IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZHZhbmNlIGluc3RydWN0aW9uIGNhbiBvbmx5IGdvIGZvcndhcmRzJyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5hZHZhbmNlLCBbby5saXRlcmFsKGRlbHRhKV0pO1xuICAgICAgdGhpcy5fY3VycmVudEluZGV4ID0gbm9kZUluZGV4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlZmVycyB0byB0aGUgaW1wbGljaXQgcmVjZWl2ZXIuIFRoZSBpbXBsaWNpdFxuICAgKiByZWNlaXZlciBpcyBhbHdheXMgdGhlIHJvb3QgbGV2ZWwgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgaWYgKHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByID0gdGhpcy5sZXZlbCA9PT0gMCA/XG4gICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5FeHByZXNzaW9uLFxuICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG4gICAgcmV0dXJuIHZhbEV4cHI7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGxpc3Qgb2YgYXJndW1lbnQgZXhwcmVzc2lvbnMgdG8gcGFzcyB0byBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbi4gQWxzbyB1cGRhdGVzXG4gICAqIHRoZSB0ZW1wIHZhcmlhYmxlcyBzdGF0ZSB3aXRoIHRlbXAgdmFyaWFibGVzIHRoYXQgd2VyZSBpZGVudGlmaWVkIGFzIG5lZWRpbmcgdG8gYmUgY3JlYXRlZFxuICAgKiB3aGlsZSB2aXNpdGluZyB0aGUgYXJndW1lbnRzLlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIG9yaWdpbmFsIGV4cHJlc3Npb24gd2Ugd2lsbCBiZSByZXNvbHZpbmcgYW4gYXJndW1lbnRzIGxpc3QgZnJvbS5cbiAgICovXG4gIHByaXZhdGUgZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCB7YXJncywgc3RtdHN9ID1cbiAgICAgICAgY29udmVydFVwZGF0ZUFyZ3VtZW50cyh0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCkpO1xuXG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLnN0bXRzKTtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnROYW1lOiBzdHJpbmcsIGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKSB7XG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3RvcihlbGVtZW50TmFtZSwgZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsKSk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goc2VsZWN0b3IsIChjc3NTZWxlY3Rvciwgc3RhdGljVHlwZSkgPT4ge1xuICAgICAgICB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmVzIGFsbCBhdHRyaWJ1dGUgZXhwcmVzc2lvbiB2YWx1ZXMgZm9yIHRoZSBgVEF0dHJpYnV0ZXNgIGFycmF5LlxuICAgKlxuICAgKiBUaGUgcHVycG9zZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRvIHByb3Blcmx5IGNvbnN0cnVjdCBhbiBhdHRyaWJ1dGVzIGFycmF5IHRoYXRcbiAgICogaXMgcGFzc2VkIGludG8gdGhlIGBlbGVtZW50U3RhcnRgIChvciBqdXN0IGBlbGVtZW50YCkgZnVuY3Rpb25zLiBCZWNhdXNlIHRoZXJlXG4gICAqIGFyZSBtYW55IGRpZmZlcmVudCB0eXBlcyBvZiBhdHRyaWJ1dGVzLCB0aGUgYXJyYXkgbmVlZHMgdG8gYmUgY29uc3RydWN0ZWQgaW4gYVxuICAgKiBzcGVjaWFsIHdheSBzbyB0aGF0IGBlbGVtZW50U3RhcnRgIGNhbiBwcm9wZXJseSBldmFsdWF0ZSB0aGVtLlxuICAgKlxuICAgKiBUaGUgZm9ybWF0IGxvb2tzIGxpa2UgdGhpczpcbiAgICpcbiAgICogYGBgXG4gICAqIGF0dHJzID0gW3Byb3AsIHZhbHVlLCBwcm9wMiwgdmFsdWUyLFxuICAgKiAgIFBST0pFQ1RfQVMsIHNlbGVjdG9yLFxuICAgKiAgIENMQVNTRVMsIGNsYXNzMSwgY2xhc3MyLFxuICAgKiAgIFNUWUxFUywgc3R5bGUxLCB2YWx1ZTEsIHN0eWxlMiwgdmFsdWUyLFxuICAgKiAgIEJJTkRJTkdTLCBuYW1lMSwgbmFtZTIsIG5hbWUzLFxuICAgKiAgIFRFTVBMQVRFLCBuYW1lNCwgbmFtZTUsIG5hbWU2LFxuICAgKiAgIEkxOE4sIG5hbWU3LCBuYW1lOCwgLi4uXVxuICAgKiBgYGBcbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgZnVuY3Rpb24gd2lsbCBmdWxseSBpZ25vcmUgYWxsIHN5bnRoZXRpYyAoQGZvbykgYXR0cmlidXRlIHZhbHVlc1xuICAgKiBiZWNhdXNlIHRob3NlIHZhbHVlcyBhcmUgaW50ZW5kZWQgdG8gYWx3YXlzIGJlIGdlbmVyYXRlZCBhcyBwcm9wZXJ0eSBpbnN0cnVjdGlvbnMuXG4gICAqL1xuICBwcml2YXRlIGdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgZWxlbWVudE5hbWU6IHN0cmluZywgcmVuZGVyQXR0cmlidXRlczogdC5UZXh0QXR0cmlidXRlW10sIGlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdLFxuICAgICAgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sIHN0eWxlcz86IFN0eWxpbmdCdWlsZGVyLFxuICAgICAgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10sXG4gICAgICBib3VuZEkxOG5BdHRyczogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgYWxyZWFkeVNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBhdHRyRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IG5nUHJvamVjdEFzQXR0cjogdC5UZXh0QXR0cmlidXRlfHVuZGVmaW5lZDtcblxuICAgIGZvciAoY29uc3QgYXR0ciBvZiByZW5kZXJBdHRyaWJ1dGVzKSB7XG4gICAgICBpZiAoYXR0ci5uYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBuZ1Byb2plY3RBc0F0dHIgPSBhdHRyO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlIHRoYXQgc3RhdGljIGkxOG4gYXR0cmlidXRlcyBhcmVuJ3QgaW4gdGhlIGkxOG4gYXJyYXksXG4gICAgICAvLyBiZWNhdXNlIHRoZXkncmUgdHJlYXRlZCBpbiB0aGUgc2FtZSB3YXkgYXMgcmVndWxhciBhdHRyaWJ1dGVzLlxuICAgICAgaWYgKGF0dHIuaTE4bikge1xuICAgICAgICAvLyBXaGVuIGkxOG4gYXR0cmlidXRlcyBhcmUgcHJlc2VudCBvbiBlbGVtZW50cyB3aXRoIHN0cnVjdHVyYWwgZGlyZWN0aXZlc1xuICAgICAgICAvLyAoZS5nLiBgPGRpdiAqbmdJZiB0aXRsZT1cIkhlbGxvXCIgaTE4bi10aXRsZT5gKSwgd2Ugd2FudCB0byBhdm9pZCBnZW5lcmF0aW5nXG4gICAgICAgIC8vIGR1cGxpY2F0ZSBpMThuIHRyYW5zbGF0aW9uIGJsb2NrcyBmb3IgYMm1ybV0ZW1wbGF0ZWAgYW5kIGDJtcm1ZWxlbWVudGAgaW5zdHJ1Y3Rpb25cbiAgICAgICAgLy8gYXR0cmlidXRlcy4gU28gd2UgZG8gYSBjYWNoZSBsb29rdXAgdG8gc2VlIGlmIHN1aXRhYmxlIGkxOG4gdHJhbnNsYXRpb24gYmxvY2tcbiAgICAgICAgLy8gYWxyZWFkeSBleGlzdHMuXG4gICAgICAgIGNvbnN0IHtpMThuVmFyUmVmc0NhY2hlfSA9IHRoaXMuX2NvbnN0YW50cztcbiAgICAgICAgbGV0IGkxOG5WYXJSZWY6IG8uUmVhZFZhckV4cHI7XG4gICAgICAgIGlmIChpMThuVmFyUmVmc0NhY2hlLmhhcyhhdHRyLmkxOG4pKSB7XG4gICAgICAgICAgaTE4blZhclJlZiA9IGkxOG5WYXJSZWZzQ2FjaGUuZ2V0KGF0dHIuaTE4bikhO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGkxOG5WYXJSZWYgPSB0aGlzLmkxOG5UcmFuc2xhdGUoYXR0ci5pMThuIGFzIGkxOG4uTWVzc2FnZSk7XG4gICAgICAgICAgaTE4blZhclJlZnNDYWNoZS5zZXQoYXR0ci5pMThuLCBpMThuVmFyUmVmKTtcbiAgICAgICAgfVxuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgaTE4blZhclJlZik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChcbiAgICAgICAgICAgIC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhhdHRyLm5hbWUpLCB0cnVzdGVkQ29uc3RBdHRyaWJ1dGUoZWxlbWVudE5hbWUsIGF0dHIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBLZWVwIG5nUHJvamVjdEFzIG5leHQgdG8gdGhlIG90aGVyIG5hbWUsIHZhbHVlIHBhaXJzIHNvIHdlIGNhbiB2ZXJpZnkgdGhhdCB3ZSBtYXRjaFxuICAgIC8vIG5nUHJvamVjdEFzIG1hcmtlciBpbiB0aGUgYXR0cmlidXRlIG5hbWUgc2xvdC5cbiAgICBpZiAobmdQcm9qZWN0QXNBdHRyKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXROZ1Byb2plY3RBc0xpdGVyYWwobmdQcm9qZWN0QXNBdHRyKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkQXR0ckV4cHIoa2V5OiBzdHJpbmd8bnVtYmVyLCB2YWx1ZT86IG8uRXhwcmVzc2lvbik6IHZvaWQge1xuICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghYWxyZWFkeVNlZW4uaGFzKGtleSkpIHtcbiAgICAgICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoa2V5KSk7XG4gICAgICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJiBhdHRyRXhwcnMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgYWxyZWFkeVNlZW4uYWRkKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChrZXkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpdCdzIGltcG9ydGFudCB0aGF0IHRoaXMgb2NjdXJzIGJlZm9yZSBCSU5ESU5HUyBhbmQgVEVNUExBVEUgYmVjYXVzZSBvbmNlIGBlbGVtZW50U3RhcnRgXG4gICAgLy8gY29tZXMgYWNyb3NzIHRoZSBCSU5ESU5HUyBvciBURU1QTEFURSBtYXJrZXJzIHRoZW4gaXQgd2lsbCBjb250aW51ZSByZWFkaW5nIGVhY2ggdmFsdWUgYXNcbiAgICAvLyBhcyBzaW5nbGUgcHJvcGVydHkgdmFsdWUgY2VsbCBieSBjZWxsLlxuICAgIGlmIChzdHlsZXMpIHtcbiAgICAgIHN0eWxlcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0ckV4cHJzKTtcbiAgICB9XG5cbiAgICBpZiAoaW5wdXRzLmxlbmd0aCB8fCBvdXRwdXRzLmxlbmd0aCkge1xuICAgICAgY29uc3QgYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMgPSBhdHRyRXhwcnMubGVuZ3RoO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1tpXTtcbiAgICAgICAgLy8gV2UgZG9uJ3Qgd2FudCB0aGUgYW5pbWF0aW9uIGFuZCBhdHRyaWJ1dGUgYmluZGluZ3MgaW4gdGhlXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMgYXJyYXkgc2luY2UgdGhleSBhcmVuJ3QgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgICAgICBpZiAoaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uICYmIGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgIGFkZEF0dHJFeHByKGlucHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2ldO1xuICAgICAgICBpZiAob3V0cHV0LnR5cGUgIT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihvdXRwdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhIGNoZWFwIHdheSBvZiBhZGRpbmcgdGhlIG1hcmtlciBvbmx5IGFmdGVyIGFsbCB0aGUgaW5wdXQvb3V0cHV0XG4gICAgICAvLyB2YWx1ZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIChieSBub3QgaW5jbHVkaW5nIHRoZSBhbmltYXRpb24gb25lcykgYW5kIGFkZGVkXG4gICAgICAvLyB0byB0aGUgZXhwcmVzc2lvbnMuIFRoZSBtYXJrZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaXQgdGVsbHMgdGhlIHJ1bnRpbWVcbiAgICAgIC8vIGNvZGUgdGhhdCB0aGlzIGlzIHdoZXJlIGF0dHJpYnV0ZXMgd2l0aG91dCB2YWx1ZXMgc3RhcnQuLi5cbiAgICAgIGlmIChhdHRyRXhwcnMubGVuZ3RoICE9PSBhdHRyc0xlbmd0aEJlZm9yZUlucHV0cykge1xuICAgICAgICBhdHRyRXhwcnMuc3BsaWNlKGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzLCAwLCBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVtcGxhdGVBdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSkpO1xuICAgICAgdGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKGJvdW5kSTE4bkF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pKTtcbiAgICAgIGJvdW5kSTE4bkF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ckV4cHJzO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRUb0NvbnN0cyhleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBvLkxpdGVyYWxFeHByIHtcbiAgICBpZiAoby5pc051bGwoZXhwcmVzc2lvbikpIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHMgPSB0aGlzLl9jb25zdGFudHMuY29uc3RFeHByZXNzaW9ucztcblxuICAgIC8vIFRyeSB0byByZXVzZSBhIGxpdGVyYWwgdGhhdCdzIGFscmVhZHkgaW4gdGhlIGFycmF5LCBpZiBwb3NzaWJsZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGNvbnN0c1tpXS5pc0VxdWl2YWxlbnQoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsKGNvbnN0cy5wdXNoKGV4cHJlc3Npb24pIC0gMSk7XG4gIH1cblxuICBwcml2YXRlIGFkZEF0dHJzVG9Db25zdHMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDogby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzQXJyYXkocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiBhc0xpdGVyYWwocmVmc1BhcmFtKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSEpIDpcbiAgICAgICAgICBzYW5pdGl6ZUlkZW50aWZpZXIoZXZlbnROYW1lKTtcbiAgICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gYCR7dGhpcy50ZW1wbGF0ZU5hbWV9XyR7dGFnTmFtZX1fJHtiaW5kaW5nRm5OYW1lfV8ke2luZGV4fV9saXN0ZW5lcmA7XG4gICAgICBjb25zdCBzY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZShcbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsLCBFVkVOVF9CSU5ESU5HX1NDT1BFX0dMT0JBTFMpO1xuICAgICAgcmV0dXJuIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhvdXRwdXRBc3QsIGhhbmRsZXJOYW1lLCBzY29wZSk7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVDb252ZXJ0ZXIgZXh0ZW5kcyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciB7XG4gIHByaXZhdGUgX3BpcGVCaW5kRXhwcnM6IENhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIG92ZXJyaWRlIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQoXG4gICAgICAgIHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBwaXBlLm5hbWVTcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiksXG4gICAgICAgIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPSBpc1Zhckxlbmd0aCA/XG4gICAgICAgIHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIGFyZ3MpXSkgOlxuICAgICAgICB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgY29uc3QgcGlwZUJpbmRFeHByID0gbmV3IENhbGwoXG4gICAgICAgIHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCB0YXJnZXQsXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3Bhbiwgc2xvdCksXG4gICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgICAgIC4uLmNvbnZlcnRlZEFyZ3MsXG4gICAgICAgIF0sXG4gICAgICAgIG51bGwhKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBDYWxsKSA9PiB7XG4gICAgICAvLyB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0IGFyZyAoaW5kZXggMSkgdG8gYWNjb3VudCBmb3IgYmluZGluZyBzbG90c1xuICAgICAgY29uc3Qgc2xvdE9mZnNldCA9IHBpcGUuYXJnc1sxXSBhcyBMaXRlcmFsUHJpbWl0aXZlO1xuICAgICAgKHNsb3RPZmZzZXQudmFsdWUgYXMgbnVtYmVyKSArPSBiaW5kaW5nU2xvdHM7XG4gICAgfSk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXJyYXkuc3BhbiwgYXJyYXkuc291cmNlU3BhbiwgdGhpcy52aXNpdEFsbChhcnJheS5leHByZXNzaW9ucyksIHZhbHVlcyA9PiB7XG4gICAgICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgICAgICAvLyB2YWx1ZXMuXG4gICAgICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgICAgIHJldHVybiBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgbWFwLnNvdXJjZVNwYW4sIHRoaXMudmlzaXRBbGwobWFwLnZhbHVlcyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzICB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbE1hcCh2YWx1ZXMubWFwKFxuICAgICAgICAgICh2YWx1ZSwgaW5kZXgpID0+ICh7a2V5OiBtYXAua2V5c1tpbmRleF0ua2V5LCB2YWx1ZSwgcXVvdGVkOiBtYXAua2V5c1tpbmRleF0ucXVvdGVkfSkpKTtcbiAgICAgIHJldHVybiBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucGlwZUJpbmRWLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5cbmZ1bmN0aW9uIHB1cmVGdW5jdGlvbkNhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5wdXJlRnVuY3Rpb25WLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pO1xufVxuXG4vLyBlLmcuIHgoMik7XG5mdW5jdGlvbiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsRGlmZjogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5uZXh0Q29udGV4dClcbiAgICAgIC5jYWxsRm4ocmVsYXRpdmVMZXZlbERpZmYgPiAxID8gW28ubGl0ZXJhbChyZWxhdGl2ZUxldmVsRGlmZildIDogW10pO1xufVxuXG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByfG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzdGFydFNsb3QpLCBsaXRlcmFsRmFjdG9yeV07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gbmV4dENvbnRleHQoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBsb2NhbFJlZmAgaXMgdHJ1ZSBpZiB3ZSBhcmUgc3RvcmluZyBhIGxvY2FsIHJlZmVyZW5jZVxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5FeHByZXNzaW9uO1xuICBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrOyBkZWNsYXJlOiBib29sZWFuOyBwcmlvcml0eTogbnVtYmVyO1xufTtcblxuLyoqXG4gKiBUaGUgc29ydGluZyBwcmlvcml0eSBvZiBhIGxvY2FsIHZhcmlhYmxlIGRlY2xhcmF0aW9uLiBIaWdoZXIgbnVtYmVyc1xuICogbWVhbiB0aGUgZGVjbGFyYXRpb24gd2lsbCBhcHBlYXIgZmlyc3QgaW4gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICovXG5jb25zdCBlbnVtIERlY2xhcmF0aW9uUHJpb3JpdHkge1xuICBERUZBVUxUID0gMCxcbiAgQ09OVEVYVCA9IDEsXG4gIFNIQVJFRF9DT05URVhUID0gMlxufVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHVzZXNSZXN0b3JlZFZpZXdDb250ZXh0ID0gZmFsc2U7XG4gIHN0YXRpYyBjcmVhdGVSb290U2NvcGUoKTogQmluZGluZ1Njb3BlIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdTY29wZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgZ2xvYmFscz86IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKGdsb2JhbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGdsb2JhbHMpIHtcbiAgICAgICAgdGhpcy5zZXQoMCwgbmFtZSwgby52YXJpYWJsZShuYW1lKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9uLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBJbXBsZW1lbnRlZCBhcyBwYXJ0IG9mIExvY2FsUmVzb2x2ZXIuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIHJldHVybiB0aGlzLmdldChuYW1lKTtcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSEuZGVjbGFyZSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlciwgZ2xvYmFscz86IFNldDxzdHJpbmc+KTogQmluZGluZ1Njb3BlIHtcbiAgICBjb25zdCBuZXdTY29wZSA9IG5ldyBCaW5kaW5nU2NvcGUobGV2ZWwsIHRoaXMsIGdsb2JhbHMpO1xuICAgIGlmIChsZXZlbCA+IDApIG5ld1Njb3BlLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgICByZXR1cm4gbmV3U2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBvciBjcmVhdGVzIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgYW5kIHJldHVybnMgaXRzIGV4cHJlc3Npb24uIE5vdGUgdGhhdFxuICAgKiB0aGlzIGRvZXMgbm90IG1lYW4gdGhhdCB0aGUgc2hhcmVkIHZhcmlhYmxlIHdpbGwgYmUgZGVjbGFyZWQuIFZhcmlhYmxlcyBpbiB0aGVcbiAgICogYmluZGluZyBzY29wZSB3aWxsIGJlIG9ubHkgZGVjbGFyZWQgaWYgdGhleSBhcmUgdXNlZC5cbiAgICovXG4gIGdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgYmluZGluZ0tleSA9IFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsO1xuICAgIGlmICghdGhpcy5tYXAuaGFzKGJpbmRpbmdLZXkpKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbCk7XG4gICAgfVxuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHRoaXMubWFwLmdldChiaW5kaW5nS2V5KSEubGhzIGFzIG8uUmVhZFZhckV4cHI7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgYXMgby5SZWFkVmFyRXhwciA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldygpIHtcbiAgICAvLyBWaWV3IHJlc3RvcmF0aW9uIGlzIHJlcXVpcmVkIGZvciBsaXN0ZW5lciBpbnN0cnVjdGlvbnMgaW5zaWRlIGVtYmVkZGVkIHZpZXdzLCBiZWNhdXNlXG4gICAgLy8gdGhleSBvbmx5IHJ1biBpbiBjcmVhdGlvbiBtb2RlIGFuZCB0aGV5IGNhbiBoYXZlIHJlZmVyZW5jZXMgdG8gdGhlIGNvbnRleHQgb2JqZWN0LlxuICAgIC8vIElmIHRoZSBjb250ZXh0IG9iamVjdCBjaGFuZ2VzIGluIHVwZGF0ZSBtb2RlLCB0aGUgcmVmZXJlbmNlIHdpbGwgYmUgaW5jb3JyZWN0LCBiZWNhdXNlXG4gICAgLy8gaXQgd2FzIGVzdGFibGlzaGVkIGR1cmluZyBjcmVhdGlvbi5cbiAgICBpZiAodGhpcy5pc0xpc3RlbmVyU2NvcGUoKSkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSA9IG8udmFyaWFibGUodGhpcy5wYXJlbnQhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAodGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICBjb25zdCByZXN0b3JlQ2FsbCA9IGluc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSk7XG4gICAgICAvLyBFaXRoZXIgYGNvbnN0IHJlc3RvcmVkQ3R4ID0gcmVzdG9yZVZpZXcoJHN0YXRlJCk7YCBvciBgcmVzdG9yZVZpZXcoJHN0YXRlJCk7YFxuICAgICAgLy8gZGVwZW5kaW5nIG9uIHdoZXRoZXIgaXQgaXMgYmVpbmcgdXNlZC5cbiAgICAgIHN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICB0aGlzLnVzZXNSZXN0b3JlZFZpZXdDb250ZXh0ID9cbiAgICAgICAgICAgICAgby52YXJpYWJsZShSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSkuc2V0KHJlc3RvcmVDYWxsKS50b0NvbnN0RGVjbCgpIDpcbiAgICAgICAgICAgICAgcmVzdG9yZUNhbGwudG9TdG10KCkpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGVtZW50cztcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSkpLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50ICYmIHRoaXMucGFyZW50LmJpbmRpbmdMZXZlbCA9PT0gdGhpcy5iaW5kaW5nTGV2ZWw7XG4gIH1cblxuICB2YXJpYWJsZURlY2xhcmF0aW9ucygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBsZXQgY3VycmVudENvbnRleHRMZXZlbCA9IDA7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5tYXAudmFsdWVzKCkpXG4gICAgICAgICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgICAgICAgICAucmVkdWNlKChzdG10czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IEJpbmRpbmdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9XG4gICAgICAgICAgICAgICAgICAgICB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgICAgICAgIGN1cnJlbnRDb250ZXh0TGV2ZWwgPSBsZXZlbERpZmY7XG4gICAgICAgICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG5cbiAgaGFzUmVzdG9yZVZpZXdWYXJpYWJsZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISF0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gIH1cblxuICBub3RpZnlSZXN0b3JlZFZpZXdDb250ZXh0VXNlKCk6IHZvaWQge1xuICAgIHRoaXMudXNlc1Jlc3RvcmVkVmlld0NvbnRleHQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3IoXG4gICAgZWxlbWVudE5hbWU6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICBjb25zdCBlbGVtZW50TmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbGVtZW50TmFtZU5vTnMpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCBuYW1lTm9OcyA9IHNwbGl0TnNOYW1lKG5hbWUpWzFdO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lTm9OcywgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgb3V0IG9mIGFuIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlc1xuICogd2hpY2ggY2FuIGJlIGFkZGVkIHRvIHRoZSBpbnN0cnVjdGlvbiBwYXJhbWV0ZXJzLlxuICovXG5mdW5jdGlvbiBnZXROZ1Byb2plY3RBc0xpdGVyYWwoYXR0cmlidXRlOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb25bXSB7XG4gIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IoYXR0cmlidXRlLnZhbHVlKVswXTtcbiAgcmV0dXJuIFtvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgYXNMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpXTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5XG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIGF0dHJpYnV0ZVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBPcHRpb25zIHRoYXQgY2FuIGJlIHVzZWQgdG8gbW9kaWZ5IGhvdyBhIHRlbXBsYXRlIGlzIHBhcnNlZCBieSBgcGFyc2VUZW1wbGF0ZSgpYC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZVRlbXBsYXRlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJbmNsdWRlIHdoaXRlc3BhY2Ugbm9kZXMgaW4gdGhlIHBhcnNlZCBvdXRwdXQuXG4gICAqL1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFByZXNlcnZlIG9yaWdpbmFsIGxpbmUgZW5kaW5ncyBpbnN0ZWFkIG9mIG5vcm1hbGl6aW5nICdcXHJcXG4nIGVuZGluZ3MgdG8gJ1xcbicuXG4gICAqL1xuICBwcmVzZXJ2ZUxpbmVFbmRpbmdzPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEhvdyB0byBwYXJzZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIFRoZSBzdGFydCBhbmQgZW5kIHBvaW50IG9mIHRoZSB0ZXh0IHRvIHBhcnNlIHdpdGhpbiB0aGUgYHNvdXJjZWAgc3RyaW5nLlxuICAgKiBUaGUgZW50aXJlIGBzb3VyY2VgIHN0cmluZyBpcyBwYXJzZWQgaWYgdGhpcyBpcyBub3QgcHJvdmlkZWQuXG4gICAqICovXG4gIHJhbmdlPzogTGV4ZXJSYW5nZTtcbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYSBKYXZhU2NyaXB0IHN0cmluZywgdGhlbiB3ZSBoYXZlIHRvIGRlYWwgd2l0aCBlc2NhcGUgc2VxdWVuY2VzLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMToqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFwiZGVmXFxuZ2hpXCJcbiAgICogYGBgXG4gICAqXG4gICAqIC0gVGhlIGBcXFwiYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBgXCJgLlxuICAgKiAtIFRoZSBgXFxuYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBhIG5ldyBsaW5lIGNoYXJhY3RlciBpbiBhIHRva2VuLFxuICAgKiAgIGJ1dCBpdCBzaG91bGQgbm90IGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICpcbiAgICogKipFeGFtcGxlIDI6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcbiAgICogIGRlZlwiXG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgbGluZSBjb250aW51YXRpb24gKGBcXGAgZm9sbG93ZWQgYnkgYSBuZXdsaW5lKSBzaG91bGQgYmUgcmVtb3ZlZCBmcm9tIGEgdG9rZW5cbiAgICogYnV0IHRoZSBuZXcgbGluZSBzaG91bGQgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKi9cbiAgZXNjYXBlZFN0cmluZz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBjaGFyYWN0ZXJzIHRoYXQgc2hvdWxkIGJlIGNvbnNpZGVyZWQgYXMgbGVhZGluZyB0cml2aWEuXG4gICAqIExlYWRpbmcgdHJpdmlhIGFyZSBjaGFyYWN0ZXJzIHRoYXQgYXJlIG5vdCBpbXBvcnRhbnQgdG8gdGhlIGRldmVsb3BlciwgYW5kIHNvIHNob3VsZCBub3QgYmVcbiAgICogaW5jbHVkZWQgaW4gc291cmNlLW1hcCBzZWdtZW50cy4gIEEgY29tbW9uIGV4YW1wbGUgaXMgd2hpdGVzcGFjZS5cbiAgICovXG4gIGxlYWRpbmdUcml2aWFDaGFycz86IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBSZW5kZXIgYCRsb2NhbGl6ZWAgbWVzc2FnZSBpZHMgd2l0aCBhZGRpdGlvbmFsIGxlZ2FjeSBtZXNzYWdlIGlkcy5cbiAgICpcbiAgICogVGhpcyBvcHRpb24gZGVmYXVsdHMgdG8gYHRydWVgIGJ1dCBpbiB0aGUgZnV0dXJlIHRoZSBkZWZhdWwgd2lsbCBiZSBmbGlwcGVkLlxuICAgKlxuICAgKiBGb3Igbm93IHNldCB0aGlzIG9wdGlvbiB0byBmYWxzZSBpZiB5b3UgaGF2ZSBtaWdyYXRlZCB0aGUgdHJhbnNsYXRpb24gZmlsZXMgdG8gdXNlIHRoZSBuZXdcbiAgICogYCRsb2NhbGl6ZWAgbWVzc2FnZSBpZCBmb3JtYXQgYW5kIHlvdSBhcmUgbm90IHVzaW5nIGNvbXBpbGUgdGltZSB0cmFuc2xhdGlvbiBtZXJnaW5nLlxuICAgKi9cbiAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYW4gZXh0ZXJuYWwgdGVtcGxhdGUgKGUuZy4gdmlhIGB0ZW1wbGF0ZVVybGApIHRoZW4gd2UgbmVlZCB0byBkZWNpZGVcbiAgICogd2hldGhlciBvciBub3QgdG8gbm9ybWFsaXplIHRoZSBsaW5lLWVuZGluZ3MgKGZyb20gYFxcclxcbmAgdG8gYFxcbmApIHdoZW4gcHJvY2Vzc2luZyBJQ1VcbiAgICogZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIElmIGB0cnVlYCB0aGVuIHdlIHdpbGwgbm9ybWFsaXplIElDVSBleHByZXNzaW9uIGxpbmUgZW5kaW5ncy5cbiAgICogVGhlIGRlZmF1bHQgaXMgYGZhbHNlYCwgYnV0IHRoaXMgd2lsbCBiZSBzd2l0Y2hlZCBpbiBhIGZ1dHVyZSBtYWpvciByZWxlYXNlLlxuICAgKi9cbiAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0byBhbHdheXMgYXR0ZW1wdCB0byBjb252ZXJ0IHRoZSBwYXJzZWQgSFRNTCBBU1QgdG8gYW4gUjMgQVNULCBkZXNwaXRlIEhUTUwgb3IgaTE4blxuICAgKiBNZXRhIHBhcnNlIGVycm9ycy5cbiAgICpcbiAgICpcbiAgICogVGhpcyBvcHRpb24gaXMgdXNlZnVsIGluIHRoZSBjb250ZXh0IG9mIHRoZSBsYW5ndWFnZSBzZXJ2aWNlLCB3aGVyZSB3ZSB3YW50IHRvIGdldCBhcyBtdWNoXG4gICAqIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlLCBkZXNwaXRlIGFueSBlcnJvcnMgaW4gdGhlIEhUTUwuIEFzIGFuIGV4YW1wbGUsIGEgdXNlciBtYXkgYmUgYWRkaW5nXG4gICAqIGEgbmV3IHRhZyBhbmQgZXhwZWN0aW5nIGF1dG9jb21wbGV0ZSBvbiB0aGF0IHRhZy4gSW4gdGhpcyBzY2VuYXJpbywgdGhlIEhUTUwgaXMgaW4gYW4gZXJyb3JlZFxuICAgKiBzdGF0ZSwgYXMgdGhlcmUgaXMgYW4gaW5jb21wbGV0ZSBvcGVuIHRhZy4gSG93ZXZlciwgd2UncmUgc3RpbGwgYWJsZSB0byBjb252ZXJ0IHRoZSBIVE1MIEFTVFxuICAgKiBub2RlcyB0byBSMyBBU1Qgbm9kZXMgaW4gb3JkZXIgdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGxhbmd1YWdlIHNlcnZpY2UuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBldmVuIHdoZW4gYHRydWVgIHRoZSBIVE1MIHBhcnNlIGFuZCBpMThuIGVycm9ycyBhcmUgc3RpbGwgYXBwZW5kZWQgdG8gdGhlIGVycm9yc1xuICAgKiBvdXRwdXQsIGJ1dCB0aGlzIGlzIGRvbmUgYWZ0ZXIgY29udmVydGluZyB0aGUgSFRNTCBBU1QgdG8gUjMgQVNULlxuICAgKi9cbiAgYWx3YXlzQXR0ZW1wdEh0bWxUb1IzQXN0Q29udmVyc2lvbj86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEluY2x1ZGUgSFRNTCBDb21tZW50IG5vZGVzIGluIGEgdG9wLWxldmVsIGNvbW1lbnRzIGFycmF5IG9uIHRoZSByZXR1cm5lZCBSMyBBU1QuXG4gICAqXG4gICAqIFRoaXMgb3B0aW9uIGlzIHJlcXVpcmVkIGJ5IHRvb2xpbmcgdGhhdCBuZWVkcyB0byBrbm93IHRoZSBsb2NhdGlvbiBvZiBjb21tZW50IG5vZGVzIHdpdGhpbiB0aGVcbiAgICogQVNULiBBIGNvbmNyZXRlIGV4YW1wbGUgaXMgQGFuZ3VsYXItZXNsaW50IHdoaWNoIHJlcXVpcmVzIHRoaXMgaW4gb3JkZXIgdG8gZW5hYmxlXG4gICAqIFwiZXNsaW50LWRpc2FibGVcIiBjb21tZW50cyB3aXRoaW4gSFRNTCB0ZW1wbGF0ZXMsIHdoaWNoIHRoZW4gYWxsb3dzIHVzZXJzIHRvIHR1cm4gb2ZmIHNwZWNpZmljXG4gICAqIHJ1bGVzIG9uIGEgY2FzZSBieSBjYXNlIGJhc2lzLCBpbnN0ZWFkIG9mIGZvciB0aGVpciB3aG9sZSBwcm9qZWN0IHdpdGhpbiBhIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgICovXG4gIGNvbGxlY3RDb21tZW50Tm9kZXM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqIEBwYXJhbSBvcHRpb25zIG9wdGlvbnMgdG8gbW9kaWZ5IGhvdyB0aGUgdGVtcGxhdGUgaXMgcGFyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IFBhcnNlVGVtcGxhdGVPcHRpb25zID0ge30pOiBQYXJzZWRUZW1wbGF0ZSB7XG4gIGNvbnN0IHtpbnRlcnBvbGF0aW9uQ29uZmlnLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzLCBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0fSA9IG9wdGlvbnM7XG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcihpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG4gIGNvbnN0IHBhcnNlUmVzdWx0ID0gaHRtbFBhcnNlci5wYXJzZShcbiAgICAgIHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCxcbiAgICAgIHtsZWFkaW5nVHJpdmlhQ2hhcnM6IExFQURJTkdfVFJJVklBX0NIQVJTLCAuLi5vcHRpb25zLCB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlfSk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgcGFyc2VSZXN1bHQuZXJyb3JzICYmXG4gICAgICBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcblxuICAvLyBwcm9jZXNzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiAoc2NhbiBhdHRyaWJ1dGVzLCBnZW5lcmF0ZSBpZHMpXG4gIC8vIGJlZm9yZSB3ZSBydW4gd2hpdGVzcGFjZSByZW1vdmFsIHByb2Nlc3MsIGJlY2F1c2UgZXhpc3RpbmcgaTE4blxuICAvLyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgY29uc3QgaTE4bk1ldGFWaXNpdG9yID0gbmV3IEkxOG5NZXRhVmlzaXRvcihcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gIXByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0KTtcbiAgY29uc3QgaTE4bk1ldGFSZXN1bHQgPSBpMThuTWV0YVZpc2l0b3IudmlzaXRBbGxXaXRoRXJyb3JzKHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgaTE4bk1ldGFSZXN1bHQuZXJyb3JzICYmXG4gICAgICBpMThuTWV0YVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBpMThuTWV0YVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICByb290Tm9kZXMgPSBpMThuTWV0YVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdoaXRlc3BhY2VzIGFyZSByZW1vdmVkIChiZWNhdXNlIHRoYXQgbWlnaHQgYWZmZWN0XG4gICAgLy8gZ2VuZXJhdGVkIGkxOG4gbWVzc2FnZSBjb250ZW50KSBhbmQgZmlyc3QgcGFzcyBpbmRpY2F0ZWQgdGhhdCBpMThuIGNvbnRlbnQgaXMgcHJlc2VudCBpbiBhXG4gICAgLy8gdGVtcGxhdGUuIER1cmluZyB0aGlzIHBhc3MgaTE4biBJRHMgZ2VuZXJhdGVkIGF0IHRoZSBmaXJzdCBwYXNzIHdpbGwgYmUgcHJlc2VydmVkLCBzbyB3ZSBjYW5cbiAgICAvLyBtaW1pYyBleGlzdGluZyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnMsIGNvbW1lbnROb2Rlc30gPSBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgICAgcm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyLCB7Y29sbGVjdENvbW1lbnROb2RlczogISFvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXN9KTtcbiAgZXJyb3JzLnB1c2goLi4ucGFyc2VSZXN1bHQuZXJyb3JzLCAuLi5pMThuTWV0YVJlc3VsdC5lcnJvcnMpO1xuXG4gIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgZXJyb3JzOiBlcnJvcnMubGVuZ3RoID4gMCA/IGVycm9ycyA6IG51bGwsXG4gICAgbm9kZXMsXG4gICAgc3R5bGVVcmxzLFxuICAgIHN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnNcbiAgfTtcblxuICBpZiAob3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzKSB7XG4gICAgcGFyc2VkVGVtcGxhdGUuY29tbWVudE5vZGVzID0gY29tbWVudE5vZGVzO1xuICB9XG4gIHJldHVybiBwYXJzZWRUZW1wbGF0ZTtcbn1cblxuY29uc3QgZWxlbWVudFJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IEl2eVBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIGVsZW1lbnRSZWdpc3RyeSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cnVzdGVkQ29uc3RBdHRyaWJ1dGUodGFnTmFtZTogc3RyaW5nLCBhdHRyOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB2YWx1ZSA9IGFzTGl0ZXJhbChhdHRyLnZhbHVlKTtcbiAgaWYgKGlzVHJ1c3RlZFR5cGVzU2luayh0YWdOYW1lLCBhdHRyLm5hbWUpKSB7XG4gICAgc3dpdGNoIChlbGVtZW50UmVnaXN0cnkuc2VjdXJpdHlDb250ZXh0KHRhZ05hbWUsIGF0dHIubmFtZSwgLyogaXNBdHRyaWJ1dGUgKi8gdHJ1ZSkpIHtcbiAgICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgICAgcmV0dXJuIG8udGFnZ2VkVGVtcGxhdGUoXG4gICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMudHJ1c3RDb25zdGFudEh0bWwpLFxuICAgICAgICAgICAgbmV3IG8uVGVtcGxhdGVMaXRlcmFsKFtuZXcgby5UZW1wbGF0ZUxpdGVyYWxFbGVtZW50KGF0dHIudmFsdWUpXSwgW10pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBhdHRyLnZhbHVlU3Bhbik7XG4gICAgICAvLyBOQjogbm8gU2VjdXJpdHlDb250ZXh0LlNDUklQVCBoZXJlLCBhcyB0aGUgY29ycmVzcG9uZGluZyB0YWdzIGFyZSBzdHJpcHBlZCBieSB0aGUgY29tcGlsZXIuXG4gICAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTDpcbiAgICAgICAgcmV0dXJuIG8udGFnZ2VkVGVtcGxhdGUoXG4gICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMudHJ1c3RDb25zdGFudFJlc291cmNlVXJsKSxcbiAgICAgICAgICAgIG5ldyBvLlRlbXBsYXRlTGl0ZXJhbChbbmV3IG8uVGVtcGxhdGVMaXRlcmFsRWxlbWVudChhdHRyLnZhbHVlKV0sIFtdKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYXR0ci52YWx1ZVNwYW4pO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUoY2hpbGRyZW46IHQuTm9kZVtdKTogY2hpbGRyZW4gaXNbdC5FbGVtZW50XSB7XG4gIHJldHVybiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LkVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGlzVGV4dE5vZGUobm9kZTogdC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgdC5UZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5JY3U7XG59XG5cbmZ1bmN0aW9uIGhhc1RleHRDaGlsZHJlbk9ubHkoY2hpbGRyZW46IHQuTm9kZVtdKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGlsZHJlbi5ldmVyeShpc1RleHROb2RlKTtcbn1cblxuaW50ZXJmYWNlIENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbiB7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICB2YWx1ZTogKCkgPT4gby5FeHByZXNzaW9uIHwgby5FeHByZXNzaW9uW107XG4gIHBhcmFtcz86IGFueVtdO1xufVxuXG4vKiogTmFtZSBvZiB0aGUgZ2xvYmFsIHZhcmlhYmxlIHRoYXQgaXMgdXNlZCB0byBkZXRlcm1pbmUgaWYgd2UgdXNlIENsb3N1cmUgdHJhbnNsYXRpb25zIG9yIG5vdCAqL1xuY29uc3QgTkdfSTE4Tl9DTE9TVVJFX01PREUgPSAnbmdJMThuQ2xvc3VyZU1vZGUnO1xuXG4vKipcbiAqIEdlbmVyYXRlIHN0YXRlbWVudHMgdGhhdCBkZWZpbmUgYSBnaXZlbiB0cmFuc2xhdGlvbiBtZXNzYWdlLlxuICpcbiAqIGBgYFxuICogdmFyIEkxOE5fMTtcbiAqIGlmICh0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZSkge1xuICogICAgIHZhciBNU0dfRVhURVJOQUxfWFhYID0gZ29vZy5nZXRNc2coXG4gKiAgICAgICAgICBcIlNvbWUgbWVzc2FnZSB3aXRoIHskaW50ZXJwb2xhdGlvbn0hXCIsXG4gKiAgICAgICAgICB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1cbiAqICAgICApO1xuICogICAgIEkxOE5fMSA9IE1TR19FWFRFUk5BTF9YWFg7XG4gKiB9XG4gKiBlbHNlIHtcbiAqICAgICBJMThOXzEgPSAkbG9jYWxpemVgU29tZSBtZXNzYWdlIHdpdGggJHsnXFx1RkZGRDBcXHVGRkZEJ30hYDtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBvcmlnaW5hbCBpMThuIEFTVCBtZXNzYWdlIG5vZGVcbiAqIEBwYXJhbSB2YXJpYWJsZSBUaGUgdmFyaWFibGUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRoZSB0cmFuc2xhdGlvbiwgZS5nLiBgSTE4Tl8xYC5cbiAqIEBwYXJhbSBjbG9zdXJlVmFyIFRoZSB2YXJpYWJsZSBmb3IgQ2xvc3VyZSBgZ29vZy5nZXRNc2dgIGNhbGxzLCBlLmcuIGBNU0dfRVhURVJOQUxfWFhYYC5cbiAqIEBwYXJhbSBwYXJhbXMgT2JqZWN0IG1hcHBpbmcgcGxhY2Vob2xkZXIgbmFtZXMgdG8gdGhlaXIgdmFsdWVzIChlLmcuXG4gKiBgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9YCkuXG4gKiBAcGFyYW0gdHJhbnNmb3JtRm4gT3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHRyYW5zbGF0aW9uIChlLmcuXG4gKiBwb3N0LXByb2Nlc3NpbmcpLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3RhdGVtZW50cyB0aGF0IGRlZmluZWQgYSBnaXZlbiB0cmFuc2xhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKFxuICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgdmFyaWFibGU6IG8uUmVhZFZhckV4cHIsIGNsb3N1cmVWYXI6IG8uUmVhZFZhckV4cHIsXG4gICAgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSxcbiAgICB0cmFuc2Zvcm1Gbj86IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IG8uRXhwcmVzc2lvbik6IG8uU3RhdGVtZW50W10ge1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW1xuICAgIGRlY2xhcmVJMThuVmFyaWFibGUodmFyaWFibGUpLFxuICAgIG8uaWZTdG10KFxuICAgICAgICBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCksXG4gICAgICAgIGNyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHMoXG4gICAgICAgICAgICB2YXJpYWJsZSwgbWVzc2FnZSwgY2xvc3VyZVZhcixcbiAgICAgICAgICAgIGkxOG5Gb3JtYXRQbGFjZWhvbGRlck5hbWVzKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIHRydWUpKSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGkxOG5Gb3JtYXRQbGFjZWhvbGRlck5hbWVzKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKSkpLFxuICBdO1xuXG4gIGlmICh0cmFuc2Zvcm1Gbikge1xuICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHZhcmlhYmxlLnNldCh0cmFuc2Zvcm1Gbih2YXJpYWJsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGUgdGhlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHVzZWQgdG8gZ3VhcmQgdGhlIGNsb3N1cmUgbW9kZSBibG9ja1xuICogSXQgaXMgZXF1aXZhbGVudCB0bzpcbiAqXG4gKiBgYGBcbiAqIHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlXG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpOiBvLkJpbmFyeU9wZXJhdG9yRXhwciB7XG4gIHJldHVybiBvLnR5cGVvZkV4cHIoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpXG4gICAgICAubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgndW5kZWZpbmVkJywgby5TVFJJTkdfVFlQRSkpXG4gICAgICAuYW5kKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKTtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgdGVtcGxhdGUgd2hpY2ggd2FzIGV4dHJhY3RlZCBkdXJpbmcgcGFyc2luZy5cbiAqXG4gKiBUaGlzIGNvbnRhaW5zIHRoZSBhY3R1YWwgcGFyc2VkIHRlbXBsYXRlIGFzIHdlbGwgYXMgYW55IG1ldGFkYXRhIGNvbGxlY3RlZCBkdXJpbmcgaXRzIHBhcnNpbmcsXG4gKiBzb21lIG9mIHdoaWNoIG1pZ2h0IGJlIHVzZWZ1bCBmb3IgcmUtcGFyc2luZyB0aGUgdGVtcGxhdGUgd2l0aCBkaWZmZXJlbnQgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRUZW1wbGF0ZSB7XG4gIC8qKlxuICAgKiBJbmNsdWRlIHdoaXRlc3BhY2Ugbm9kZXMgaW4gdGhlIHBhcnNlZCBvdXRwdXQuXG4gICAqL1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogQW55IGVycm9ycyBmcm9tIHBhcnNpbmcgdGhlIHRlbXBsYXRlIHRoZSBmaXJzdCB0aW1lLlxuICAgKlxuICAgKiBgbnVsbGAgaWYgdGhlcmUgYXJlIG5vIGVycm9ycy4gT3RoZXJ3aXNlLCB0aGUgYXJyYXkgb2YgZXJyb3JzIGlzIGd1YXJhbnRlZWQgdG8gYmUgbm9uLWVtcHR5LlxuICAgKi9cbiAgZXJyb3JzOiBQYXJzZUVycm9yW118bnVsbDtcblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIEFTVCwgcGFyc2VkIGZyb20gdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgbm9kZXM6IHQuTm9kZVtdO1xuXG4gIC8qKlxuICAgKiBBbnkgc3R5bGVVcmxzIGV4dHJhY3RlZCBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgICovXG4gIHN0eWxlVXJsczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEFueSBpbmxpbmUgc3R5bGVzIGV4dHJhY3RlZCBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgICovXG4gIHN0eWxlczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEFueSBuZy1jb250ZW50IHNlbGVjdG9ycyBleHRyYWN0ZWQgZnJvbSB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbnkgUjMgQ29tbWVudCBOb2RlcyBleHRyYWN0ZWQgZnJvbSB0aGUgdGVtcGxhdGUgd2hlbiB0aGUgYGNvbGxlY3RDb21tZW50Tm9kZXNgIHBhcnNlIHRlbXBsYXRlXG4gICAqIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgKi9cbiAgY29tbWVudE5vZGVzPzogdC5Db21tZW50W107XG59XG4iXX0=