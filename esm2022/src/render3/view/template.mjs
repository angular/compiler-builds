/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuiltinFunctionCall, convertActionBinding, convertPropertyBinding, convertPureComponentScopeFunction, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, Call, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { Parser } from '../../expression_parser/parser';
import * as i18n from '../../i18n/i18n_ast';
import * as html from '../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/defaults';
import { HtmlParser } from '../../ml_parser/html_parser';
import { WhitespaceVisitor } from '../../ml_parser/html_whitespaces';
import { isNgContainer as checkIsNgContainer, splitNsName } from '../../ml_parser/tags';
import { mapLiteral } from '../../output/map_util';
import * as o from '../../output/output_ast';
import { sanitizeIdentifier } from '../../parse_util';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { isIframeSecuritySensitiveAttr } from '../../schema/dom_security_schema';
import { isTrustedTypesSink } from '../../schema/trusted_types_sinks';
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
import { assembleBoundTextPlaceholders, assembleI18nBoundString, declareI18nVariable, formatI18nPlaceholderNamesInMap, getTranslationConstPrefix, hasI18nMeta, I18N_ICU_MAPPING_PREFIX, icuFromI18nMessage, isI18nRootNode, isSingleI18nIcu, placeholdersToParams, TRANSLATION_VAR_PREFIX, wrapI18nPlaceholder } from './i18n/util';
import { StylingBuilder } from './styling_builder';
import { asLiteral, CONTEXT_NAME, DIRECT_CONTEXT_REFERENCE, getInstructionStatements, getInterpolationArgsLength, IMPLICIT_REFERENCE, invalid, invokeInstruction, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, RESTORED_VIEW_CONTEXT_NAME, trimTrailingNulls } from './util';
// Selector attribute name of `<ng-content>`
const NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
const NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
// Global symbols available only inside event bindings.
const EVENT_BINDING_SCOPE_GLOBALS = new Set(['$event']);
// Tag name of the `ng-template` element.
const NG_TEMPLATE_TAG_NAME = 'ng-template';
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
    const bindingStatements = convertActionBinding(scope, implicitReceiverExpr, handler, 'b', eventAst.handlerSpan, implicitReceiverAccesses, EVENT_BINDING_SCOPE_GLOBALS);
    const statements = [];
    const variableDeclarations = scope?.variableDeclarations();
    const restoreViewStatement = scope?.restoreViewStatement();
    if (variableDeclarations) {
        // `variableDeclarations` needs to run first, because
        // `restoreViewStatement` depends on the result.
        statements.push(...variableDeclarations);
    }
    statements.push(...bindingStatements);
    if (restoreViewStatement) {
        statements.unshift(restoreViewStatement);
        // If there's a `restoreView` call, we need to reset the view at the end of the listener
        // in order to avoid a leak. If there's a `return` statement already, we wrap it in the
        // call, e.g. `return resetView(ctx.foo())`. Otherwise we add the call as the last statement.
        const lastStatement = statements[statements.length - 1];
        if (lastStatement instanceof o.ReturnStatement) {
            statements[statements.length - 1] = new o.ReturnStatement(invokeInstruction(lastStatement.value.sourceSpan, R3.resetView, [lastStatement.value]));
        }
        else {
            statements.push(new o.ExpressionStatement(invokeInstruction(null, R3.resetView, [])));
        }
    }
    const eventName = type === 1 /* ParsedEventType.Animation */ ? prepareSyntheticListenerName(name, phase) : name;
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
class TemplateData {
    constructor(name, index, scope, visitor) {
        this.name = name;
        this.index = index;
        this.scope = scope;
        this.visitor = visitor;
    }
    getConstCount() {
        return this.visitor.getConstCount();
    }
    getVarCount() {
        return this.visitor.getVarCount();
    }
}
export class TemplateDefinitionBuilder {
    constructor(constantPool, parentBindingScope, level = 0, contextName, i18nContext, templateIndex, templateName, _namespace, relativeContextFilePath, i18nUseExternalIds, deferBlocks, elementLocations, _constants = createComponentDefConsts()) {
        this.constantPool = constantPool;
        this.level = level;
        this.contextName = contextName;
        this.i18nContext = i18nContext;
        this.templateIndex = templateIndex;
        this.templateName = templateName;
        this._namespace = _namespace;
        this.i18nUseExternalIds = i18nUseExternalIds;
        this.deferBlocks = deferBlocks;
        this.elementLocations = elementLocations;
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
         * Temporary variable used to store state between control flow instructions.
         * Should be accessed via the `allocateControlFlowTempVariable` method.
         */
        this._controlFlowTempVariable = null;
        /**
         * List of callbacks to build nested templates. Nested templates must not be visited until
         * after the parent template has finished visiting all of its nodes. This ensures that all
         * local ref bindings in nested templates are able to find local ref values if the refs
         * are defined after the template declaration.
         */
        this._nestedTemplateFns = [];
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
        this.visitDeferredTrigger = invalid;
        this.visitDeferredBlockError = invalid;
        this.visitDeferredBlockLoading = invalid;
        this.visitDeferredBlockPlaceholder = invalid;
        this.visitIfBlockBranch = invalid;
        this.visitSwitchBlockCase = invalid;
        this.visitForLoopBlockEmpty = invalid;
        this.visitUnknownBlock = invalid;
        this._bindingScope = parentBindingScope.nestedScope(level);
        // Turn the relative context file path into an identifier by replacing non-alphanumeric
        // characters with underscores.
        this.fileBasedI18nSuffix = relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_') + '_';
        this._valueConverter = new ValueConverter(constantPool, () => this.allocateDataSlot(), (numSlots) => this.allocatePureFunctionSlots(numSlots), (name, localName, slot, value) => {
            this._bindingScope.set(this.level, localName, value);
            this.creationInstruction(null, R3.pipe, [o.literal(slot), o.literal(name)]);
        });
    }
    buildTemplateFunction(nodes, variables, ngContentSelectorsOffset = 0, i18n, variableAliases) {
        this._ngContentSelectorsOffset = ngContentSelectorsOffset;
        if (this._namespace !== R3.namespaceHTML) {
            this.creationInstruction(null, this._namespace);
        }
        // Create variable bindings
        variables.forEach(v => {
            const alias = variableAliases?.[v.name];
            this.registerContextVariables(v.name, v.value);
            if (alias) {
                this.registerContextVariables(alias, v.value);
            }
        });
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
        const creationStatements = getInstructionStatements(this._creationCodeFns);
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        const updateStatements = getInstructionStatements(this._updateCodeFns);
        //  Variable declaration must occur after binding resolution so we can generate context
        //  instructions that build on each other.
        // e.g. const b = nextContext().$implicit(); const b = nextContext();
        const creationVariables = this._bindingScope.viewSnapshotStatements();
        const updateVariables = this._bindingScope.variableDeclarations().concat(this._tempVariables);
        const creationBlock = creationStatements.length > 0 ?
            [renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, creationVariables.concat(creationStatements))] :
            [];
        const updateBlock = updateStatements.length > 0 ?
            [renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateVariables.concat(updateStatements))] :
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
    registerContextVariables(name, value) {
        const scopedName = this._bindingScope.freshReferenceName();
        const retrievalLevel = this.level;
        const isDirect = value === DIRECT_CONTEXT_REFERENCE;
        const lhs = o.variable(name + scopedName);
        this._bindingScope.set(retrievalLevel, name, scope => {
            // If we're at the top level and we're referring to the context variable directly, we
            // can do so through the implicit receiver, instead of renaming it. Note that this does
            // not apply to listeners, because they need to restore the context.
            return isDirect && scope.bindingLevel === retrievalLevel && !scope.isListenerScope() ?
                o.variable(CONTEXT_NAME) :
                lhs;
        }, 1 /* DeclarationPriority.CONTEXT */, (scope, relativeLevel) => {
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
                else if (isDirect) {
                    // If we have a direct read of the context at the top level we don't need to
                    // declare any variables and we can refer to it directly.
                    return [];
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
            return [
                // e.g. const $items$ = x(2) for direct context references and
                // const $item$ = x(2).$implicit for indirect ones.
                lhs.set(isDirect ? rhs : rhs.prop(value || IMPLICIT_REFERENCE)).toConstDecl()
            ];
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
                    return invokeInstruction(null, R3.i18nPostprocess, args);
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
            for (const binding of bindings) {
                // for i18n block, advance to the most recent element index (by taking the current number of
                // elements and subtracting one) before invoking `i18nExp` instructions, to make sure the
                // necessary lifecycle hooks of components/directives are properly flushed.
                this.updateInstructionWithAdvance(this.getConstCount() - 1, span, R3.i18nExp, () => this.convertPropertyBinding(binding));
            }
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
                    this.updateInstructionWithAdvance(nodeIndex, sourceSpan, R3.i18nExp, () => this.convertPropertyBinding(expression));
                });
            }
        });
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
        const elementIndex = this.allocateDataSlot();
        const stylingBuilder = new StylingBuilder(null);
        this.elementLocations.set(element, { index: elementIndex, level: this.level });
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
                if (input.type === 0 /* BindingType.Property */ && input.i18n) {
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
                this.i18nAttributesInstruction(elementIndex, boundI18nAttrs, element.startSourceSpan ?? element.sourceSpan);
            }
            // Generate Listeners (outputs)
            if (element.outputs.length > 0) {
                for (const outputAst of element.outputs) {
                    this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter(element.name, outputAst, elementIndex));
                }
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
            if (inputType === 4 /* BindingType.Animation */) {
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
                    span: input.sourceSpan,
                    paramsOrFn: getBindingFunctionParams(() => hasValue ? this.convertPropertyBinding(value) : emptyValueBindInstruction, prepareSyntheticPropertyName(input.name))
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
                    const isAttributeBinding = inputType === 1 /* BindingType.Attribute */;
                    let sanitizationRef = resolveSanitizationFn(input.securityContext, isAttributeBinding);
                    if (!sanitizationRef) {
                        // If there was no sanitization function found based on the security context
                        // of an attribute/property - check whether this attribute/property is
                        // one of the security-sensitive <iframe> attributes (and that the current
                        // element is actually an <iframe>).
                        if (isIframeElement(element.name) && isIframeSecuritySensitiveAttr(input.name)) {
                            sanitizationRef = o.importExpr(R3.validateIframeAttribute);
                        }
                    }
                    if (sanitizationRef) {
                        params.push(sanitizationRef);
                    }
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
                    if (inputType === 0 /* BindingType.Property */) {
                        if (value instanceof Interpolation) {
                            // prop="{{value}}" and friends
                            this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value), elementIndex, attrName, input, value, params);
                        }
                        else {
                            // [prop]="value"
                            // Collect all the properties so that we can chain into a single function at the end.
                            propertyBindings.push({
                                span: input.sourceSpan,
                                paramsOrFn: getBindingFunctionParams(() => this.convertPropertyBinding(value), attrName, params)
                            });
                        }
                    }
                    else if (inputType === 1 /* BindingType.Attribute */) {
                        if (value instanceof Interpolation && getInterpolationArgsLength(value) > 1) {
                            // attr.name="text{{value}}" and friends
                            this.interpolatedUpdateInstruction(getAttributeInterpolationExpression(value), elementIndex, attrName, input, value, params);
                        }
                        else {
                            const boundValue = value instanceof Interpolation ? value.expressions[0] : value;
                            // [attr.name]="value" or attr.name="{{value}}"
                            // Collect the attribute bindings so that they can be chained at the end.
                            attributeBindings.push({
                                span: input.sourceSpan,
                                paramsOrFn: getBindingFunctionParams(() => this.convertPropertyBinding(boundValue), attrName, params)
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
        for (const propertyBinding of propertyBindings) {
            this.updateInstructionWithAdvance(elementIndex, propertyBinding.span, R3.property, propertyBinding.paramsOrFn);
        }
        for (const attributeBinding of attributeBindings) {
            this.updateInstructionWithAdvance(elementIndex, attributeBinding.span, R3.attribute, attributeBinding.paramsOrFn);
        }
        // Traverse element child nodes
        t.visitAll(this, element.children);
        if (!isI18nRootElement && this.i18n) {
            this.i18n.appendElement(element.i18n, elementIndex, true);
        }
        if (!createSelfClosingInstruction) {
            // Finish element construction mode.
            const span = element.endSourceSpan ?? element.sourceSpan;
            if (isI18nRootElement) {
                this.i18nEnd(span, createSelfClosingI18nInstruction);
            }
            if (isNonBindableMode) {
                this.creationInstruction(span, R3.enableBindings);
            }
            this.creationInstruction(span, isNgContainer ? R3.elementContainerEnd : R3.elementEnd);
        }
    }
    prepareEmbeddedTemplateFn(children, contextNameSuffix, variables = [], i18nMeta, variableAliases) {
        const index = this.allocateDataSlot();
        if (this.i18n && i18nMeta) {
            if (i18nMeta instanceof i18n.BlockPlaceholder) {
                this.i18n.appendBlock(i18nMeta, index);
            }
            else {
                this.i18n.appendTemplate(i18nMeta, index);
            }
        }
        const contextName = `${this.contextName}${contextNameSuffix}_${index}`;
        const name = `${contextName}_Template`;
        // Create the template function
        const visitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, index, name, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds, this.deferBlocks, this.elementLocations, this._constants);
        // Nested templates must not be visited until after their parent templates have completed
        // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
        // be able to support bindings in nested templates to local refs that occur after the
        // template definition. e.g. <div *ngIf="showing">{{ foo }}</div>  <div #foo></div>
        this._nestedTemplateFns.push(() => {
            const templateFunctionExpr = visitor.buildTemplateFunction(children, variables, this._ngContentReservedSlots.length + this._ngContentSelectorsOffset, i18nMeta, variableAliases);
            this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(name));
            if (visitor._ngContentReservedSlots.length) {
                this._ngContentReservedSlots.push(...visitor._ngContentReservedSlots);
            }
        });
        return new TemplateData(name, index, visitor._bindingScope, visitor);
    }
    createEmbeddedTemplateFn(tagName, children, contextNameSuffix, sourceSpan, variables = [], attrsExprs, references, i18n) {
        const data = this.prepareEmbeddedTemplateFn(children, contextNameSuffix, variables, i18n);
        const parameters = [
            o.literal(data.index),
            o.variable(data.name),
            o.literal(tagName),
            this.addAttrsToConsts(attrsExprs || null),
        ];
        // local refs (ex.: <ng-template #foo>)
        if (references && references.length > 0) {
            const refs = this.prepareRefsArray(references);
            parameters.push(this.addToConsts(refs));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(sourceSpan, R3.templateCreate, () => {
            parameters.splice(2, 0, o.literal(data.getConstCount()), o.literal(data.getVarCount()));
            return trimTrailingNulls(parameters);
        });
        return data.index;
    }
    visitTemplate(template) {
        // We don't care about the tag's namespace here, because we infer
        // it based on the parent nodes inside the template instruction.
        const tagNameWithoutNamespace = template.tagName ? splitNsName(template.tagName)[1] : template.tagName;
        const contextNameSuffix = template.tagName ? '_' + sanitizeIdentifier(template.tagName) : '';
        // prepare attributes parameter (including attributes used for directive matching)
        const attrsExprs = this.getAttributeExpressions(NG_TEMPLATE_TAG_NAME, template.attributes, template.inputs, template.outputs, undefined /* styles */, template.templateAttrs);
        const templateIndex = this.createEmbeddedTemplateFn(tagNameWithoutNamespace, template.children, contextNameSuffix, template.sourceSpan, template.variables, attrsExprs, template.references, template.i18n);
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
                this.i18nAttributesInstruction(templateIndex, i18nInputs, template.startSourceSpan ?? template.sourceSpan);
            }
            // Add the input bindings
            if (inputs.length > 0) {
                this.templatePropertyBindings(templateIndex, inputs);
            }
            // Generate listeners for directive output
            for (const outputAst of template.outputs) {
                this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter('ng_template', outputAst, templateIndex));
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
            // Sort the map entries in the compiled output. This makes it easy to acheive identical output
            // in the template pipeline compiler.
            const params = Object.fromEntries(Object.entries({ ...vars, ...placeholders }).sort());
            const formatted = formatI18nPlaceholderNamesInMap(params, /* useCamelCase */ false);
            return invokeInstruction(null, R3.i18nPostprocess, [raw, mapLiteral(formatted, true)]);
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
    visitIfBlock(block) {
        // Allocate one slot for the result of the expression.
        this.allocateBindingSlots(null);
        // We have to process the block in two steps: once here and again in the update instruction
        // callback in order to generate the correct expressions when pipes or pure functions are
        // used inside the branch expressions.
        const branchData = block.branches.map((branch, branchIndex) => {
            const { expression, expressionAlias, children, sourceSpan } = branch;
            // If the branch has an alias, it'll be assigned directly to the container's context.
            // We define a variable referring directly to the context so that any nested usages can be
            // rewritten to refer to it.
            const variables = expressionAlias !== null ?
                [new t.Variable(expressionAlias.name, DIRECT_CONTEXT_REFERENCE, expressionAlias.sourceSpan, expressionAlias.keySpan)] :
                undefined;
            let tagName = null;
            let attrsExprs;
            // Only the first branch can be used for projection, because the conditional
            // uses the container of the first branch as the insertion point for all branches.
            if (branchIndex === 0) {
                const inferredData = this.inferProjectionDataFromInsertionPoint(branch);
                tagName = inferredData.tagName;
                attrsExprs = inferredData.attrsExprs;
            }
            // Note: the template needs to be created *before* we process the expression,
            // otherwise pipes injecting some symbols won't work (see #52102).
            const templateIndex = this.createEmbeddedTemplateFn(tagName, children, '_Conditional', sourceSpan, variables, attrsExprs, undefined, branch.i18n);
            const processedExpression = expression === null ? null : expression.visit(this._valueConverter);
            return { index: templateIndex, expression: processedExpression, alias: expressionAlias };
        });
        // Use the index of the first block as the index for the entire container.
        const containerIndex = branchData[0].index;
        const paramsCallback = () => {
            let contextVariable = null;
            const generateBranch = (branchIndex) => {
                // If we've gone beyond the last branch, return the special -1 value which means that no
                // view will be rendered. Note that we don't need to reset the context here, because -1
                // won't render a view so the passed-in context won't be captured.
                if (branchIndex > branchData.length - 1) {
                    return o.literal(-1);
                }
                const { index, expression, alias } = branchData[branchIndex];
                // If the branch has no expression, it means that it's the final `else`.
                // Return its index and stop the recursion. Assumes that there's only one
                // `else` condition and that it's the last branch.
                if (expression === null) {
                    return o.literal(index);
                }
                let comparisonTarget;
                if (alias) {
                    // If the branch is aliased, we need to assign the expression value to the temporary
                    // variable and then pass it into `conditional`. E.g. for the expression:
                    // `@if (foo(); as alias) {...}` we have to generate:
                    // ```
                    // let temp;
                    // conditional(0, (temp = ctx.foo()) ? 0 : -1, temp);
                    // ```
                    contextVariable = this.allocateControlFlowTempVariable();
                    comparisonTarget = contextVariable.set(this.convertPropertyBinding(expression));
                }
                else {
                    comparisonTarget = this.convertPropertyBinding(expression);
                }
                return comparisonTarget.conditional(o.literal(index), generateBranch(branchIndex + 1));
            };
            const params = [o.literal(containerIndex), generateBranch(0)];
            if (contextVariable !== null) {
                params.push(contextVariable);
            }
            return params;
        };
        this.updateInstructionWithAdvance(containerIndex, block.branches[0].sourceSpan, R3.conditional, paramsCallback);
    }
    visitSwitchBlock(block) {
        // We have to process the block in two steps: once here and again in the update instruction
        // callback in order to generate the correct expressions when pipes or pure functions are used.
        const caseData = block.cases.map(currentCase => {
            const index = this.createEmbeddedTemplateFn(null, currentCase.children, '_Case', currentCase.sourceSpan, undefined, undefined, undefined, currentCase.i18n);
            const expression = currentCase.expression === null ?
                null :
                currentCase.expression.visit(this._valueConverter);
            return { index, expression };
        });
        // Use the index of the first block as the index for the entire container.
        const containerIndex = caseData[0].index;
        // Note: the expression needs to be processed *after* the template,
        // otherwise pipes injecting some symbols won't work (see #52102).
        const blockExpression = block.expression.visit(this._valueConverter);
        this.allocateBindingSlots(null); // Allocate a slot for the primary block expression.
        this.updateInstructionWithAdvance(containerIndex, block.sourceSpan, R3.conditional, () => {
            const generateCases = (caseIndex) => {
                // If we've gone beyond the last branch, return the special -1
                // value which means that no view will be rendered.
                if (caseIndex > caseData.length - 1) {
                    return o.literal(-1);
                }
                const { index, expression } = caseData[caseIndex];
                // If the case has no expression, it means that it's the `default` case.
                // Return its index and stop the recursion. Assumes that there's only one
                // `default` condition and that it's defined last.
                if (expression === null) {
                    return o.literal(index);
                }
                // If this is the very first comparison, we need to assign the value of the primary
                // expression as a part of the comparison so the remaining cases can reuse it. In practice
                // this looks as follows:
                // ```
                // let temp;
                // conditional(1, (temp = ctx.foo) === 1 ? 1 : temp === 2 ? 2 : temp === 3 ? 3 : 4);
                // ```
                const comparisonTarget = caseIndex === 0 ?
                    this.allocateControlFlowTempVariable().set(this.convertPropertyBinding(blockExpression)) :
                    this.allocateControlFlowTempVariable();
                return comparisonTarget.identical(this.convertPropertyBinding(expression))
                    .conditional(o.literal(index), generateCases(caseIndex + 1));
            };
            return [o.literal(containerIndex), generateCases(0)];
        });
    }
    visitDeferredBlock(deferred) {
        const { loading, placeholder, error, triggers, prefetchTriggers } = deferred;
        const metadata = this.deferBlocks.get(deferred);
        if (!metadata) {
            throw new Error('Could not resolve `defer` block metadata. Block may need to be analyzed.');
        }
        const primaryTemplateIndex = this.createEmbeddedTemplateFn(null, deferred.children, '_Defer', deferred.sourceSpan, undefined, undefined, undefined, deferred.i18n);
        const loadingIndex = loading ? this.createEmbeddedTemplateFn(null, loading.children, '_DeferLoading', loading.sourceSpan, undefined, undefined, undefined, loading.i18n) :
            null;
        const loadingConsts = loading ?
            trimTrailingNulls([o.literal(loading.minimumTime), o.literal(loading.afterTime)]) :
            null;
        const placeholderIndex = placeholder ?
            this.createEmbeddedTemplateFn(null, placeholder.children, '_DeferPlaceholder', placeholder.sourceSpan, undefined, undefined, undefined, placeholder.i18n) :
            null;
        const placeholderConsts = placeholder && placeholder.minimumTime !== null ?
            // TODO(crisbeto): potentially pass the time directly instead of storing it in the `consts`
            // since the placeholder block can only have one parameter?
            o.literalArr([o.literal(placeholder.minimumTime)]) :
            null;
        const errorIndex = error ? this.createEmbeddedTemplateFn(null, error.children, '_DeferError', error.sourceSpan, undefined, undefined, undefined, error.i18n) :
            null;
        // Note: we generate this last so the index matches the instruction order.
        const deferredIndex = this.allocateDataSlot();
        const depsFnName = `${this.contextName}_Defer_${deferredIndex}_DepsFn`;
        // e.g. `defer(1, 0, MyComp_Defer_1_DepsFn, ...)`
        this.creationInstruction(deferred.sourceSpan, R3.defer, trimTrailingNulls([
            o.literal(deferredIndex),
            o.literal(primaryTemplateIndex),
            this.createDeferredDepsFunction(depsFnName, metadata),
            o.literal(loadingIndex),
            o.literal(placeholderIndex),
            o.literal(errorIndex),
            loadingConsts?.length ? this.addToConsts(o.literalArr(loadingConsts)) : o.TYPED_NULL_EXPR,
            placeholderConsts ? this.addToConsts(placeholderConsts) : o.TYPED_NULL_EXPR,
            (loadingConsts?.length || placeholderConsts) ?
                o.importExpr(R3.deferEnableTimerScheduling) :
                o.TYPED_NULL_EXPR,
        ]));
        // Allocate an extra data slot right after a defer block slot to store
        // instance-specific state of that defer block at runtime.
        this.allocateDataSlot();
        // Note: the triggers need to be processed *after* the various templates,
        // otherwise pipes injecting some symbols won't work (see #52102).
        this.createDeferTriggerInstructions(deferredIndex, triggers, metadata, false);
        this.createDeferTriggerInstructions(deferredIndex, prefetchTriggers, metadata, true);
    }
    createDeferredDepsFunction(name, metadata) {
        if (metadata.deps.length === 0) {
            return o.TYPED_NULL_EXPR;
        }
        // This defer block has deps for which we need to generate dynamic imports.
        const dependencyExp = [];
        for (const deferredDep of metadata.deps) {
            if (deferredDep.isDeferrable) {
                // Callback function, e.g. `m () => m.MyCmp;`.
                const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], o.variable('m').prop(deferredDep.symbolName));
                // Dynamic import, e.g. `import('./a').then(...)`.
                const importExpr = (new o.DynamicImportExpr(deferredDep.importPath)).prop('then').callFn([innerFn]);
                dependencyExp.push(importExpr);
            }
            else {
                // Non-deferrable symbol, just use a reference to the type.
                dependencyExp.push(deferredDep.type);
            }
        }
        const depsFnExpr = o.arrowFn([], o.literalArr(dependencyExp));
        this.constantPool.statements.push(depsFnExpr.toDeclStmt(name, o.StmtModifier.Final));
        return o.variable(name);
    }
    createDeferTriggerInstructions(deferredIndex, triggers, metadata, prefetch) {
        const { when, idle, immediate, timer, hover, interaction, viewport } = triggers;
        // `deferWhen(ctx.someValue)`
        if (when) {
            const value = when.value.visit(this._valueConverter);
            this.allocateBindingSlots(value);
            this.updateInstructionWithAdvance(deferredIndex, when.sourceSpan, prefetch ? R3.deferPrefetchWhen : R3.deferWhen, () => this.convertPropertyBinding(value));
        }
        // Note that we generate an implicit `on idle` if the `deferred` block has no triggers.
        // `deferOnIdle()`
        if (idle || (!prefetch && Object.keys(triggers).length === 0)) {
            this.creationInstruction(idle?.sourceSpan || null, prefetch ? R3.deferPrefetchOnIdle : R3.deferOnIdle);
        }
        // `deferOnImmediate()`
        if (immediate) {
            this.creationInstruction(immediate.sourceSpan, prefetch ? R3.deferPrefetchOnImmediate : R3.deferOnImmediate);
        }
        // `deferOnTimer(1337)`
        if (timer) {
            this.creationInstruction(timer.sourceSpan, prefetch ? R3.deferPrefetchOnTimer : R3.deferOnTimer, [o.literal(timer.delay)]);
        }
        // `deferOnHover(index, walkUpTimes)`
        if (hover) {
            this.domNodeBasedTrigger('hover', hover, metadata, prefetch ? R3.deferPrefetchOnHover : R3.deferOnHover);
        }
        // `deferOnInteraction(index, walkUpTimes)`
        if (interaction) {
            this.domNodeBasedTrigger('interaction', interaction, metadata, prefetch ? R3.deferPrefetchOnInteraction : R3.deferOnInteraction);
        }
        // `deferOnViewport(index, walkUpTimes)`
        if (viewport) {
            this.domNodeBasedTrigger('viewport', viewport, metadata, prefetch ? R3.deferPrefetchOnViewport : R3.deferOnViewport);
        }
    }
    domNodeBasedTrigger(name, trigger, metadata, instructionRef) {
        const triggerEl = metadata.triggerElements.get(trigger);
        // Don't generate anything if a trigger cannot be resolved.
        // We'll have template diagnostics to surface these to users.
        if (!triggerEl) {
            return;
        }
        this.creationInstruction(trigger.sourceSpan, instructionRef, () => {
            const location = this.elementLocations.get(triggerEl);
            if (!location) {
                throw new Error(`Could not determine location of reference passed into ` +
                    `'${name}' trigger. Template may not have been fully analyzed.`);
            }
            // A negative depth means that the trigger is inside the placeholder.
            // Cap it at -1 since we only care whether or not it's negative.
            const depth = Math.max(this.level - location.level, -1);
            const params = [o.literal(location.index)];
            // The most common case should be a trigger within the view so we can omit a depth of
            // zero. For triggers in parent views and in the placeholder we need to pass it in.
            if (depth !== 0) {
                params.push(o.literal(depth));
            }
            return params;
        });
    }
    /**
     * Infers the data used for content projection (tag name and attributes) from the content of a
     * node.
     * @param node Node for which to infer the projection data.
     */
    inferProjectionDataFromInsertionPoint(node) {
        let root = null;
        let tagName = null;
        let attrsExprs;
        for (const child of node.children) {
            // Skip over comment nodes.
            if (child instanceof t.Comment) {
                continue;
            }
            // We can only infer the tag name/attributes if there's a single root node.
            if (root !== null) {
                root = null;
                break;
            }
            // Root nodes can only elements or templates with a tag name (e.g. `<div *foo></div>`).
            if (child instanceof t.Element || (child instanceof t.Template && child.tagName !== null)) {
                root = child;
            }
        }
        // If we've found a single root node, its tag name and *static* attributes can be copied
        // to the surrounding template to be used for content projection. Note that it's important
        // that we don't copy any bound attributes since they don't participate in content projection
        // and they can be used in directive matching (in the case of `Template.templateAttrs`).
        if (root !== null) {
            const name = root instanceof t.Element ? root.name : root.tagName;
            // Don't pass along `ng-template` tag name since it enables directive matching.
            tagName = name === NG_TEMPLATE_TAG_NAME ? null : name;
            attrsExprs =
                this.getAttributeExpressions(NG_TEMPLATE_TAG_NAME, root.attributes, root.inputs, []);
        }
        return { tagName, attrsExprs };
    }
    allocateDataSlot() {
        return this._dataIndex++;
    }
    visitForLoopBlock(block) {
        // Allocate one slot for the repeater metadata. The slots for the primary and empty block
        // are implicitly inferred by the runtime to index + 1 and index + 2.
        const blockIndex = this.allocateDataSlot();
        const { tagName, attrsExprs } = this.inferProjectionDataFromInsertionPoint(block);
        const primaryData = this.prepareEmbeddedTemplateFn(block.children, '_For', [block.item, block.contextVariables.$index, block.contextVariables.$count], block.i18n, {
            // We need to provide level-specific versions of `$index` and `$count`, because
            // they're used when deriving the remaining variables (`$odd`, `$even` etc.) while at the
            // same time being available implicitly. Without these aliases, we wouldn't be able to
            // access the `$index` of a parent loop from inside of a nested loop.
            [block.contextVariables.$index.name]: this.getLevelSpecificVariableName('$index', this.level + 1),
            [block.contextVariables.$count.name]: this.getLevelSpecificVariableName('$count', this.level + 1),
        });
        const { expression: trackByExpression, usesComponentInstance: trackByUsesComponentInstance } = this.createTrackByFunction(block);
        let emptyData = null;
        if (block.empty !== null) {
            emptyData = this.prepareEmbeddedTemplateFn(block.empty.children, '_ForEmpty', undefined, block.empty.i18n);
            // Allocate an extra slot for the empty block tracking.
            this.allocateBindingSlots(null);
        }
        this.registerComputedLoopVariables(block, primaryData.scope);
        // `repeaterCreate(0, ...)`
        this.creationInstruction(block.sourceSpan, R3.repeaterCreate, () => {
            const params = [
                o.literal(blockIndex),
                o.variable(primaryData.name),
                o.literal(primaryData.getConstCount()),
                o.literal(primaryData.getVarCount()),
                o.literal(tagName),
                this.addAttrsToConsts(attrsExprs || null),
                trackByExpression,
            ];
            if (emptyData !== null) {
                params.push(o.literal(trackByUsesComponentInstance), o.variable(emptyData.name), o.literal(emptyData.getConstCount()), o.literal(emptyData.getVarCount()));
            }
            else if (trackByUsesComponentInstance) {
                // If the tracking function doesn't use the component instance, we can omit the flag.
                params.push(o.literal(trackByUsesComponentInstance));
            }
            return params;
        });
        // Note: the expression needs to be processed *after* the template,
        // otherwise pipes injecting some symbols won't work (see #52102).
        // Note: we don't allocate binding slots for this expression,
        // because its value isn't stored in the LView.
        const value = block.expression.visit(this._valueConverter);
        // `advance(x); repeater(iterable)`
        this.updateInstructionWithAdvance(blockIndex, block.sourceSpan, R3.repeater, () => [this.convertPropertyBinding(value)]);
    }
    registerComputedLoopVariables(block, bindingScope) {
        const level = bindingScope.bindingLevel;
        bindingScope.set(level, block.contextVariables.$odd.name, (scope, retrievalLevel) => {
            return this.getLevelSpecificForLoopVariable(block, scope, retrievalLevel, '$index')
                .modulo(o.literal(2))
                .notIdentical(o.literal(0));
        });
        bindingScope.set(level, block.contextVariables.$even.name, (scope, retrievalLevel) => {
            return this.getLevelSpecificForLoopVariable(block, scope, retrievalLevel, '$index')
                .modulo(o.literal(2))
                .identical(o.literal(0));
        });
        bindingScope.set(level, block.contextVariables.$first.name, (scope, retrievalLevel) => {
            return this.getLevelSpecificForLoopVariable(block, scope, retrievalLevel, '$index')
                .identical(o.literal(0));
        });
        bindingScope.set(level, block.contextVariables.$last.name, (scope, retrievalLevel) => {
            const index = this.getLevelSpecificForLoopVariable(block, scope, retrievalLevel, '$index');
            const count = this.getLevelSpecificForLoopVariable(block, scope, retrievalLevel, '$count');
            return index.identical(count.minus(o.literal(1)));
        });
    }
    getLevelSpecificVariableName(name, level) {
        // We use the `ɵ` here to ensure that there are no name conflicts with user-defined variables.
        return `ɵ${name}_${level}`;
    }
    /**
     * Gets the name of a for loop variable at a specific binding level. This allows us to look
     * up implicitly shadowed variables like `$index` and `$count` at a specific level.
     */
    getLevelSpecificForLoopVariable(block, scope, retrievalLevel, name) {
        const scopeName = scope.bindingLevel === retrievalLevel ?
            block.contextVariables[name].name :
            this.getLevelSpecificVariableName(name, retrievalLevel);
        return scope.get(scopeName);
    }
    optimizeTrackByFunction(block) {
        const indexLocalName = block.contextVariables.$index.name;
        const itemName = block.item.name;
        const ast = block.trackBy.ast;
        // Top-level access of `$index` uses the built in `repeaterTrackByIndex`.
        if (ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver &&
            ast.name === indexLocalName) {
            return { expression: o.importExpr(R3.repeaterTrackByIndex), usesComponentInstance: false };
        }
        // Top-level access of the item uses the built in `repeaterTrackByIdentity`.
        if (ast instanceof PropertyRead && ast.receiver instanceof ImplicitReceiver &&
            ast.name === itemName) {
            return { expression: o.importExpr(R3.repeaterTrackByIdentity), usesComponentInstance: false };
        }
        // Top-level calls in the form of `fn($index, item)` can be passed in directly.
        if (ast instanceof Call && ast.receiver instanceof PropertyRead &&
            ast.receiver.receiver instanceof ImplicitReceiver && ast.args.length === 2) {
            const firstIsIndex = ast.args[0] instanceof PropertyRead &&
                ast.args[0].receiver instanceof ImplicitReceiver && ast.args[0].name === indexLocalName;
            const secondIsItem = ast.args[1] instanceof PropertyRead &&
                ast.args[1].receiver instanceof ImplicitReceiver && ast.args[1].name === itemName;
            if (firstIsIndex && secondIsItem) {
                // If we're in the top-level component, we can access directly through `ctx`,
                // otherwise we have to get a hold of the component through `componentInstance()`.
                const receiver = this.level === 0 ? o.variable(CONTEXT_NAME) :
                    new o.ExternalExpr(R3.componentInstance).callFn([]);
                return { expression: receiver.prop(ast.receiver.name), usesComponentInstance: false };
            }
        }
        return null;
    }
    createTrackByFunction(block) {
        const optimizedFn = this.optimizeTrackByFunction(block);
        // If the tracking function can be optimized, we don't need any further processing.
        if (optimizedFn !== null) {
            return optimizedFn;
        }
        const contextVars = block.contextVariables;
        const scope = new TrackByBindingScope(this._bindingScope, {
            // Alias `$index` and the item name to `$index` and `$item` respectively.
            // This allows us to reuse pure functions that may have different item names,
            // but are otherwise identical.
            [contextVars.$index.name]: '$index',
            [block.item.name]: '$item',
            // Accessing these variables in a tracking function will result in a template diagnostic.
            // We define them as globals so that their accesses are preserved verbatim instead of being
            // rewritten to the actual accesses.
            [contextVars.$count.name]: contextVars.$count.name,
            [contextVars.$first.name]: contextVars.$first.name,
            [contextVars.$last.name]: contextVars.$last.name,
            [contextVars.$even.name]: contextVars.$even.name,
            [contextVars.$odd.name]: contextVars.$odd.name,
        });
        const params = [new o.FnParam('$index'), new o.FnParam('$item')];
        const stmts = convertPureComponentScopeFunction(block.trackBy.ast, scope, o.variable(CONTEXT_NAME), 'track');
        const usesComponentInstance = scope.getComponentAccessCount() > 0;
        let fn;
        if (!usesComponentInstance && stmts.length === 1 && stmts[0] instanceof o.ExpressionStatement) {
            fn = o.arrowFn(params, stmts[0].expr);
        }
        else {
            // The last statement is returned implicitly.
            if (stmts.length > 0) {
                const lastStatement = stmts[stmts.length - 1];
                if (lastStatement instanceof o.ExpressionStatement) {
                    stmts[stmts.length - 1] = new o.ReturnStatement(lastStatement.expr);
                }
            }
            // This has to be a function expression, because `.bind` doesn't work on arrow functions.
            fn = o.fn(params, stmts);
        }
        return {
            expression: this.constantPool.getSharedFunctionReference(fn, '_forTrack'),
            usesComponentInstance,
        };
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
        for (const input of attrs) {
            if (!(input instanceof t.BoundAttribute)) {
                continue;
            }
            const value = input.value.visit(this._valueConverter);
            if (value === undefined) {
                continue;
            }
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
                    span: input.sourceSpan,
                    paramsOrFn: getBindingFunctionParams(() => this.convertPropertyBinding(value), input.name)
                });
            }
        }
        for (const propertyBinding of propertyBindings) {
            this.updateInstructionWithAdvance(templateIndex, propertyBinding.span, R3.property, propertyBinding.paramsOrFn);
        }
    }
    // Bindings must only be resolved after all local refs have been visited, so all
    // instructions are queued in callbacks that execute once the initial pass has completed.
    // Otherwise, we wouldn't be able to support local refs that are defined after their
    // bindings. e.g. {{ foo }} <div #foo></div>
    instructionFn(fns, span, reference, paramsOrFn, prepend = false) {
        fns[prepend ? 'unshift' : 'push']({ span, reference, paramsOrFn });
    }
    processStylingUpdateInstruction(elementIndex, instruction) {
        let allocateBindingSlots = 0;
        if (instruction) {
            for (const call of instruction.calls) {
                allocateBindingSlots += call.allocateBindingSlots;
                this.updateInstructionWithAdvance(elementIndex, call.sourceSpan, instruction.reference, () => call.params(value => (call.supportsInterpolation && value instanceof Interpolation) ?
                    this.getUpdateInstructionArguments(value) :
                    this.convertPropertyBinding(value)));
            }
        }
        return allocateBindingSlots;
    }
    creationInstruction(span, reference, paramsOrFn, prepend) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
    }
    updateInstructionWithAdvance(nodeIndex, span, reference, paramsOrFn) {
        this.addAdvanceInstructionIfNecessary(nodeIndex, span);
        this.updateInstruction(span, reference, paramsOrFn);
    }
    updateInstruction(span, reference, paramsOrFn) {
        this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
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
        const convertedPropertyBinding = convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext());
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
    /**
     * Creates and returns a variable that can be used to
     * store the state between control flow instructions.
     */
    allocateControlFlowTempVariable() {
        // Note: the assumption here is that we'll only need one temporary variable for all control
        // flow instructions. It's expected that any instructions will overwrite it before passing it
        // into the parameters.
        if (this._controlFlowTempVariable === null) {
            const name = `${this.contextName}_contFlowTmp`;
            this._tempVariables.push(new o.DeclareVarStmt(name));
            this._controlFlowTempVariable = o.variable(name);
        }
        return this._controlFlowTempVariable;
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
                if (input.type !== 4 /* BindingType.Animation */ && input.type !== 1 /* BindingType.Attribute */) {
                    addAttrExpr(input.name);
                }
            }
            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                if (output.type !== 1 /* ParsedEventType.Animation */) {
                    addAttrExpr(output.name);
                }
            }
            // this is a cheap way of adding the marker only after all the input/output
            // values have been filtered (by not including the animation ones) and added
            // to the expressions. The marker is important because it tells the runtime
            // code that this is where attributes without values start...
            if (attrExprs.length !== attrsLengthBeforeInputs) {
                attrExprs.splice(attrsLengthBeforeInputs, 0, o.literal(3 /* core.AttributeMarker.Bindings */));
            }
        }
        if (templateAttrs.length) {
            attrExprs.push(o.literal(4 /* core.AttributeMarker.Template */));
            templateAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        if (boundI18nAttrs.length) {
            attrExprs.push(o.literal(6 /* core.AttributeMarker.I18n */));
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
        return attrs !== null && attrs.length > 0 ? this.addToConsts(o.literalArr(attrs)) :
            o.TYPED_NULL_EXPR;
    }
    prepareRefsArray(references) {
        if (!references || references.length === 0) {
            return o.TYPED_NULL_EXPR;
        }
        const refsParam = references.flatMap(reference => {
            const slot = this.allocateDataSlot();
            // Generate the update temporary.
            const variableName = this._bindingScope.freshReferenceName();
            const retrievalLevel = this.level;
            const lhs = o.variable(variableName);
            this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DeclarationPriority.DEFAULT */, (scope, relativeLevel) => {
                // e.g. nextContext(2);
                const nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                // e.g. const $foo$ = reference(1);
                const refExpr = lhs.set(o.importExpr(R3.reference).callFn([o.literal(slot)]));
                return nextContextStmt.concat(refExpr.toConstDecl());
            }, true);
            return [reference.name, reference.value];
        });
        return asLiteral(refsParam);
    }
    prepareListenerParameter(tagName, outputAst, index) {
        return () => {
            const eventName = outputAst.name;
            const bindingFnName = outputAst.type === 1 /* ParsedEventType.Animation */ ?
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
            o.literal(0 /* core.AttributeMarker.NamespaceURI */), o.literal(attributeNamespace), nameLiteral
        ];
    }
    return [nameLiteral];
}
/** The prefix used to get a shared context in BindingScope's map. */
const SHARED_CONTEXT_KEY = '$$shared_ctx$$';
export class BindingScope {
    static createRootScope() {
        return new BindingScope();
    }
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
                return typeof value.lhs === 'function' ? value.lhs(this, value.retrievalLevel) : value.lhs;
            }
            current = current.parent;
        }
        // If we get to this point, we are looking for a property on the top level component
        // - If level === 0, we are on the top and don't need to re-declare `ctx`.
        // - If level > 0, we are in an embedded view. We need to retrieve the name of the
        // local var we used to store the component context, e.g. const $comp$ = x();
        return this.bindingLevel === 0 ? null : this.getComponentProperty(name);
    }
    /** Checks whether a variable exists locally on the current scope. */
    hasLocal(name) {
        return this.map.has(name);
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
    set(retrievalLevel, name, lhs, priority = 0 /* DeclarationPriority.DEFAULT */, declareLocalCallback, localRef) {
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
        if (value.priority === 1 /* DeclarationPriority.CONTEXT */ &&
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
            priority: 2 /* DeclarationPriority.SHARED_CONTEXT */,
        });
    }
    getComponentProperty(name) {
        const componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
        componentValue.declare = true;
        this.maybeRestoreView();
        const lhs = typeof componentValue.lhs === 'function' ?
            componentValue.lhs(this, componentValue.retrievalLevel) :
            componentValue.lhs;
        return name === DIRECT_CONTEXT_REFERENCE ? lhs : lhs.prop(name);
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
        if (this.restoreViewVariable) {
            const restoreCall = invokeInstruction(null, R3.restoreView, [this.restoreViewVariable]);
            // Either `const restoredCtx = restoreView($state$);` or `restoreView($state$);`
            // depending on whether it is being used.
            return this.usesRestoredViewContext ?
                o.variable(RESTORED_VIEW_CONTEXT_NAME).set(restoreCall).toConstDecl() :
                restoreCall.toStmt();
        }
        return null;
    }
    viewSnapshotStatements() {
        // const $state$ = getCurrentView();
        return this.restoreViewVariable ?
            [
                this.restoreViewVariable.set(invokeInstruction(null, R3.getCurrentView, [])).toConstDecl()
            ] :
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
/** Binding scope of a `track` function inside a `for` loop block. */
class TrackByBindingScope extends BindingScope {
    constructor(parentScope, globalOverrides) {
        super(parentScope.bindingLevel + 1, parentScope);
        this.globalOverrides = globalOverrides;
        this.componentAccessCount = 0;
    }
    get(name) {
        // Intercept any overridden globals.
        if (this.globalOverrides.hasOwnProperty(name)) {
            return o.variable(this.globalOverrides[name]);
        }
        let current = this.parent;
        // Prevent accesses of template variables outside the `for` loop.
        while (current) {
            if (current.hasLocal(name)) {
                return null;
            }
            current = current.parent;
        }
        // When the component scope is accessed, we redirect it through `this`.
        this.componentAccessCount++;
        return o.variable('this').prop(name);
    }
    /** Gets the number of times the host component has been accessed through the scope. */
    getComponentAccessCount() {
        return this.componentAccessCount;
    }
}
/**
 * Creates an array of expressions out of an `ngProjectAs` attributes
 * which can be added to the instruction parameters.
 */
function getNgProjectAsLiteral(attribute) {
    // Parse the attribute value into a CssSelectorList. Note that we only take the
    // first selector, because we don't support multiple selectors in ngProjectAs.
    const parsedR3Selector = core.parseSelectorToR3Selector(attribute.value)[0];
    return [o.literal(5 /* core.AttributeMarker.ProjectAs */), asLiteral(parsedR3Selector)];
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
    const parseResult = htmlParser.parse(template, templateUrl, {
        leadingTriviaChars: LEADING_TRIVIA_CHARS,
        ...options,
        tokenizeExpansionForms: true,
        tokenizeBlocks: options.enableBlockSyntax ?? true,
    });
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
    return new BindingParser(new Parser(new Lexer()), interpolationConfig, elementRegistry, []);
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
function isIframeElement(tagName) {
    return tagName.toLowerCase() === 'iframe';
}
function hasTextChildrenOnly(children) {
    return children.every(isTextNode);
}
function getBindingFunctionParams(deferredParams, name, eagerParams) {
    return () => {
        const value = deferredParams();
        const fnParams = Array.isArray(value) ? value : [value];
        if (eagerParams) {
            fnParams.push(...eagerParams);
        }
        if (name) {
            // We want the property name to always be the first function parameter.
            fnParams.unshift(o.literal(name));
        }
        return fnParams;
    };
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
    // Sort the map entries in the compiled output. This makes it easy to acheive identical output in
    // the template pipeline compiler.
    params = Object.fromEntries(Object.entries(params).sort());
    const statements = [
        declareI18nVariable(variable),
        o.ifStmt(createClosureModeGuard(), createGoogleGetMsgStatements(variable, message, closureVar, params), createLocalizeStatements(variable, message, formatI18nPlaceholderNamesInMap(params, /* useCamelCase */ false))),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBRSxpQ0FBaUMsRUFBRSxzQkFBc0IsRUFBZ0IsTUFBTSwwQ0FBMEMsQ0FBQztBQUVyTSxPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFtQixZQUFZLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUMzTixPQUFPLEVBQUMsS0FBSyxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDcEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RELE9BQU8sS0FBSyxJQUFJLE1BQU0scUJBQXFCLENBQUM7QUFDNUMsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sMEJBQTBCLENBQUM7QUFDM0YsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBRW5FLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFD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RSxRQUF1QixFQUFFLFVBQXlCLEVBQ3pFLFNBQXlDLEVBQUUsRUFDM0MsV0FBa0Q7SUFDcEQsaUdBQWlHO0lBQ2pHLGtDQUFrQztJQUNsQyxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFFM0QsTUFBTSxVQUFVLEdBQWtCO1FBQ2hDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztRQUM3QixDQUFDLENBQUMsTUFBTSxDQUNKLHNCQUFzQixFQUFFLEVBQ3hCLDRCQUE0QixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxFQUNuRSx3QkFBd0IsQ0FDcEIsUUFBUSxFQUFFLE9BQU8sRUFBRSwrQkFBK0IsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUMvRixDQUFDO0lBRUYsSUFBSSxXQUFXLEVBQUU7UUFDZixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pGO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLHNCQUFzQjtJQUM3QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ2hELFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDbkQsR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtCdWlsdGluRnVuY3Rpb25DYWxsLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZywgY29udmVydFB1cmVDb21wb25lbnRTY29wZUZ1bmN0aW9uLCBjb252ZXJ0VXBkYXRlQXJndW1lbnRzLCBMb2NhbFJlc29sdmVyfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQYXJzZWRFdmVudFR5cGUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGV4ZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9kZWZhdWx0cyc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0xleGVyUmFuZ2V9IGZyb20gJy4uLy4uL21sX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge2lzTmdDb250YWluZXIgYXMgY2hlY2tJc05nQ29udGFpbmVyLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHttYXBMaXRlcmFsfSBmcm9tICcuLi8uLi9vdXRwdXQvbWFwX3V0aWwnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7aXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHJ9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCB7aXNUcnVzdGVkVHlwZXNTaW5rfSBmcm9tICcuLi8uLi9zY2hlbWEvdHJ1c3RlZF90eXBlc19zaW5rcyc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yLCBwYXJ0aXRpb25BcnJheX0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNEZWZlckJsb2NrTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7STE4bkNvbnRleHR9IGZyb20gJy4vaTE4bi9jb250ZXh0JztcbmltcG9ydCB7Y3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4vaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge0kxOG5NZXRhVmlzaXRvcn0gZnJvbSAnLi9pMThuL21ldGEnO1xuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgYXNzZW1ibGVJMThuQm91bmRTdHJpbmcsIGRlY2xhcmVJMThuVmFyaWFibGUsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgsIGhhc0kxOG5NZXRhLCBJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCwgaWN1RnJvbUkxOG5NZXNzYWdlLCBpc0kxOG5Sb290Tm9kZSwgaXNTaW5nbGVJMThuSWN1LCBwbGFjZWhvbGRlcnNUb1BhcmFtcywgVFJBTlNMQVRJT05fVkFSX1BSRUZJWCwgd3JhcEkxOG5QbGFjZWhvbGRlcn0gZnJvbSAnLi9pMThuL3V0aWwnO1xuaW1wb3J0IHtTdHlsaW5nQnVpbGRlciwgU3R5bGluZ0luc3RydWN0aW9ufSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgQ09OVEVYVF9OQU1FLCBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0UsIGdldEluc3RydWN0aW9uU3RhdGVtZW50cywgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgsIElNUExJQ0lUX1JFRkVSRU5DRSwgSW5zdHJ1Y3Rpb24sIEluc3RydWN0aW9uUGFyYW1zLCBpbnZhbGlkLCBpbnZva2VJbnN0cnVjdGlvbiwgTk9OX0JJTkRBQkxFX0FUVFIsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgUkVTVE9SRURfVklFV19DT05URVhUX05BTUUsIHRyaW1UcmFpbGluZ051bGxzfSBmcm9tICcuL3V0aWwnO1xuXG5cblxuLy8gU2VsZWN0b3IgYXR0cmlidXRlIG5hbWUgb2YgYDxuZy1jb250ZW50PmBcbmNvbnN0IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIgPSAnc2VsZWN0JztcblxuLy8gQXR0cmlidXRlIG5hbWUgb2YgYG5nUHJvamVjdEFzYC5cbmNvbnN0IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FID0gJ25nUHJvamVjdEFzJztcblxuLy8gR2xvYmFsIHN5bWJvbHMgYXZhaWxhYmxlIG9ubHkgaW5zaWRlIGV2ZW50IGJpbmRpbmdzLlxuY29uc3QgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTID0gbmV3IFNldDxzdHJpbmc+KFsnJGV2ZW50J10pO1xuXG4vLyBUYWcgbmFtZSBvZiB0aGUgYG5nLXRlbXBsYXRlYCBlbGVtZW50LlxuY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5leHBvcnQgY29uc3QgTEVBRElOR19UUklWSUFfQ0hBUlMgPSBbJyAnLCAnXFxuJywgJ1xccicsICdcXHQnXTtcblxuLy8gIGlmIChyZiAmIGZsYWdzKSB7IC4uIH1cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgZmxhZ3M6IGNvcmUuUmVuZGVyRmxhZ3MsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLklmU3RtdCB7XG4gIHJldHVybiBvLmlmU3RtdChvLnZhcmlhYmxlKFJFTkRFUl9GTEFHUykuYml0d2lzZUFuZChvLmxpdGVyYWwoZmxhZ3MpLCBudWxsLCBmYWxzZSksIHN0YXRlbWVudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKFxuICAgIGV2ZW50QXN0OiB0LkJvdW5kRXZlbnQsIGhhbmRsZXJOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGwsXG4gICAgc2NvcGU6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgZXZlbnRBcmd1bWVudE5hbWUgPSAnJGV2ZW50JztcbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IGltcGxpY2l0UmVjZWl2ZXJFeHByID0gKHNjb3BlID09PSBudWxsIHx8IHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gMCkgP1xuICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgIHNjb3BlLmdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgY29uc3QgYmluZGluZ1N0YXRlbWVudHMgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgIHNjb3BlLCBpbXBsaWNpdFJlY2VpdmVyRXhwciwgaGFuZGxlciwgJ2InLCBldmVudEFzdC5oYW5kbGVyU3BhbiwgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLFxuICAgICAgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9ucyA9IHNjb3BlPy52YXJpYWJsZURlY2xhcmF0aW9ucygpO1xuICBjb25zdCByZXN0b3JlVmlld1N0YXRlbWVudCA9IHNjb3BlPy5yZXN0b3JlVmlld1N0YXRlbWVudCgpO1xuXG4gIGlmICh2YXJpYWJsZURlY2xhcmF0aW9ucykge1xuICAgIC8vIGB2YXJpYWJsZURlY2xhcmF0aW9uc2AgbmVlZHMgdG8gcnVuIGZpcnN0LCBiZWNhdXNlXG4gICAgLy8gYHJlc3RvcmVWaWV3U3RhdGVtZW50YCBkZXBlbmRzIG9uIHRoZSByZXN1bHQuXG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnZhcmlhYmxlRGVjbGFyYXRpb25zKTtcbiAgfVxuXG4gIHN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nU3RhdGVtZW50cyk7XG5cbiAgaWYgKHJlc3RvcmVWaWV3U3RhdGVtZW50KSB7XG4gICAgc3RhdGVtZW50cy51bnNoaWZ0KHJlc3RvcmVWaWV3U3RhdGVtZW50KTtcblxuICAgIC8vIElmIHRoZXJlJ3MgYSBgcmVzdG9yZVZpZXdgIGNhbGwsIHdlIG5lZWQgdG8gcmVzZXQgdGhlIHZpZXcgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdGVuZXJcbiAgICAvLyBpbiBvcmRlciB0byBhdm9pZCBhIGxlYWsuIElmIHRoZXJlJ3MgYSBgcmV0dXJuYCBzdGF0ZW1lbnQgYWxyZWFkeSwgd2Ugd3JhcCBpdCBpbiB0aGVcbiAgICAvLyBjYWxsLCBlLmcuIGByZXR1cm4gcmVzZXRWaWV3KGN0eC5mb28oKSlgLiBPdGhlcndpc2Ugd2UgYWRkIHRoZSBjYWxsIGFzIHRoZSBsYXN0IHN0YXRlbWVudC5cbiAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gc3RhdGVtZW50c1tzdGF0ZW1lbnRzLmxlbmd0aCAtIDFdO1xuICAgIGlmIChsYXN0U3RhdGVtZW50IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICAgIHN0YXRlbWVudHNbc3RhdGVtZW50cy5sZW5ndGggLSAxXSA9IG5ldyBvLlJldHVyblN0YXRlbWVudChcbiAgICAgICAgICBpbnZva2VJbnN0cnVjdGlvbihsYXN0U3RhdGVtZW50LnZhbHVlLnNvdXJjZVNwYW4sIFIzLnJlc2V0VmlldywgW2xhc3RTdGF0ZW1lbnQudmFsdWVdKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGludm9rZUluc3RydWN0aW9uKG51bGwsIFIzLnJlc2V0VmlldywgW10pKSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UhKSA6IG5hbWU7XG4gIGNvbnN0IGZuTmFtZSA9IGhhbmRsZXJOYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihoYW5kbGVyTmFtZSk7XG4gIGNvbnN0IGZuQXJnczogby5GblBhcmFtW10gPSBbXTtcblxuICBpZiAoaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLmhhcyhldmVudEFyZ3VtZW50TmFtZSkpIHtcbiAgICBmbkFyZ3MucHVzaChuZXcgby5GblBhcmFtKGV2ZW50QXJndW1lbnROYW1lLCBvLkRZTkFNSUNfVFlQRSkpO1xuICB9XG5cbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcbiAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZXZlbnROYW1lKSwgaGFuZGxlckZuXTtcbiAgaWYgKHRhcmdldCkge1xuICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoZmFsc2UpLCAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICAgICAgby5pbXBvcnRFeHByKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmdldCh0YXJnZXQpISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbi8vIENvbGxlY3RzIGluZm9ybWF0aW9uIG5lZWRlZCB0byBnZW5lcmF0ZSBgY29uc3RzYCBmaWVsZCBvZiB0aGUgQ29tcG9uZW50RGVmLlxuZXhwb3J0IGludGVyZmFjZSBDb21wb25lbnREZWZDb25zdHMge1xuICAvKipcbiAgICogV2hlbiBhIGNvbnN0YW50IHJlcXVpcmVzIHNvbWUgcHJlLXByb2Nlc3NpbmcgKGUuZy4gaTE4biB0cmFuc2xhdGlvbiBibG9jayB0aGF0IGluY2x1ZGVzXG4gICAqIGdvb2cuZ2V0TXNnIGFuZCAkbG9jYWxpemUgY2FsbHMpLCB0aGUgYHByZXBhcmVTdGF0ZW1lbnRzYCBzZWN0aW9uIGNvbnRhaW5zIGNvcnJlc3BvbmRpbmdcbiAgICogc3RhdGVtZW50cy5cbiAgICovXG4gIHByZXBhcmVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xuXG4gIC8qKlxuICAgKiBBY3R1YWwgZXhwcmVzc2lvbnMgdGhhdCByZXByZXNlbnQgY29uc3RhbnRzLlxuICAgKi9cbiAgY29uc3RFeHByZXNzaW9uczogby5FeHByZXNzaW9uW107XG5cbiAgLyoqXG4gICAqIENhY2hlIHRvIGF2b2lkIGdlbmVyYXRpbmcgZHVwbGljYXRlZCBpMThuIHRyYW5zbGF0aW9uIGJsb2Nrcy5cbiAgICovXG4gIGkxOG5WYXJSZWZzQ2FjaGU6IE1hcDxpMThuLkkxOG5NZXRhLCBvLlJlYWRWYXJFeHByPjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50RGVmQ29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gIHJldHVybiB7XG4gICAgcHJlcGFyZVN0YXRlbWVudHM6IFtdLFxuICAgIGNvbnN0RXhwcmVzc2lvbnM6IFtdLFxuICAgIGkxOG5WYXJSZWZzQ2FjaGU6IG5ldyBNYXAoKSxcbiAgfTtcbn1cblxuY2xhc3MgVGVtcGxhdGVEYXRhIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBuYW1lOiBzdHJpbmcsIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsIHJlYWRvbmx5IHNjb3BlOiBCaW5kaW5nU2NvcGUsXG4gICAgICBwcml2YXRlIHZpc2l0b3I6IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHt9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdG9yLmdldENvbnN0Q291bnQoKTtcbiAgfVxuXG4gIGdldFZhckNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0b3IuZ2V0VmFyQ291bnQoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gIC8qKiBJbmRleCBvZiB0aGUgY3VycmVudGx5LXNlbGVjdGVkIG5vZGUuICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRleDogbnVtYmVyID0gMDtcblxuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBUZW1wb3JhcnkgdmFyaWFibGUgdXNlZCB0byBzdG9yZSBzdGF0ZSBiZXR3ZWVuIGNvbnRyb2wgZmxvdyBpbnN0cnVjdGlvbnMuXG4gICAqIFNob3VsZCBiZSBhY2Nlc3NlZCB2aWEgdGhlIGBhbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlYCBtZXRob2QuXG4gICAqL1xuICBwcml2YXRlIF9jb250cm9sRmxvd1RlbXBWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZGVmZXJCbG9ja3M6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPixcbiAgICAgIHByaXZhdGUgZWxlbWVudExvY2F0aW9uczogTWFwPHQuRWxlbWVudCwge2luZGV4OiBudW1iZXIsIGxldmVsOiBudW1iZXJ9PixcbiAgICAgIHByaXZhdGUgX2NvbnN0YW50czogQ29tcG9uZW50RGVmQ29uc3RzID0gY3JlYXRlQ29tcG9uZW50RGVmQ29uc3RzKCkpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPSBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUobGV2ZWwpO1xuXG4gICAgLy8gVHVybiB0aGUgcmVsYXRpdmUgY29udGV4dCBmaWxlIHBhdGggaW50byBhbiBpZGVudGlmaWVyIGJ5IHJlcGxhY2luZyBub24tYWxwaGFudW1lcmljXG4gICAgLy8gY2hhcmFjdGVycyB3aXRoIHVuZGVyc2NvcmVzLlxuICAgIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCA9IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpICsgJ18nO1xuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChudW1TbG90czogbnVtYmVyKSA9PiB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHMpLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgbm9kZXM6IHQuTm9kZVtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSwgbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0OiBudW1iZXIgPSAwLFxuICAgICAgaTE4bj86IGkxOG4uSTE4bk1ldGEsIHZhcmlhYmxlQWxpYXNlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBvLkZ1bmN0aW9uRXhwciB7XG4gICAgdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0O1xuXG4gICAgaWYgKHRoaXMuX25hbWVzcGFjZSAhPT0gUjMubmFtZXNwYWNlSFRNTCkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIHRoaXMuX25hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHZhcmlhYmxlIGJpbmRpbmdzXG4gICAgdmFyaWFibGVzLmZvckVhY2godiA9PiB7XG4gICAgICBjb25zdCBhbGlhcyA9IHZhcmlhYmxlQWxpYXNlcz8uW3YubmFtZV07XG4gICAgICB0aGlzLnJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2Lm5hbWUsIHYudmFsdWUpO1xuICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKGFsaWFzLCB2LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID0gdGhpcy5pMThuQ29udGV4dCB8fFxuICAgICAgICAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgIShpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShub2RlcykgJiYgbm9kZXNbMF0uaTE4biA9PT0gaTE4bikpO1xuICAgIGNvbnN0IHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uID0gaGFzVGV4dENoaWxkcmVuT25seShub2Rlcyk7XG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuU3RhcnQobnVsbCwgaTE4biEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IGdldEluc3RydWN0aW9uU3RhdGVtZW50cyh0aGlzLl9jcmVhdGlvbkNvZGVGbnMpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBwcm9wZXJ0eSBvciB0ZXh0IGJpbmRpbmdzKVxuICAgIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHMgPSBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHModGhpcy5fdXBkYXRlQ29kZUZucyk7XG5cbiAgICAvLyAgVmFyaWFibGUgZGVjbGFyYXRpb24gbXVzdCBvY2N1ciBhZnRlciBiaW5kaW5nIHJlc29sdXRpb24gc28gd2UgY2FuIGdlbmVyYXRlIGNvbnRleHRcbiAgICAvLyAgaW5zdHJ1Y3Rpb25zIHRoYXQgYnVpbGQgb24gZWFjaCBvdGhlci5cbiAgICAvLyBlLmcuIGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpLiRpbXBsaWNpdCgpOyBjb25zdCBiID0gbmV4dENvbnRleHQoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdTY29wZS5nZXQobmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbWF5YmVSZXN0b3JlVmlldygpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUubWF5YmVSZXN0b3JlVmlldygpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVHJhbnNsYXRlKFxuICAgICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LCByZWY/OiBvLlJlYWRWYXJFeHByLFxuICAgICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBfcmVmID0gcmVmIHx8IHRoaXMuaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMobWVzc2FnZSwgX3JlZiwgY2xvc3VyZVZhciwgcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5fY29uc3RhbnRzLnByZXBhcmVTdGF0ZW1lbnRzLnB1c2goLi4uc3RhdGVtZW50cyk7XG4gICAgcmV0dXJuIF9yZWY7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyhuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBpc0RpcmVjdCA9IHZhbHVlID09PSBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0U7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShuYW1lICsgc2NvcGVkTmFtZSk7XG5cbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgbmFtZSxcbiAgICAgICAgc2NvcGUgPT4ge1xuICAgICAgICAgIC8vIElmIHdlJ3JlIGF0IHRoZSB0b3AgbGV2ZWwgYW5kIHdlJ3JlIHJlZmVycmluZyB0byB0aGUgY29udGV4dCB2YXJpYWJsZSBkaXJlY3RseSwgd2VcbiAgICAgICAgICAvLyBjYW4gZG8gc28gdGhyb3VnaCB0aGUgaW1wbGljaXQgcmVjZWl2ZXIsIGluc3RlYWQgb2YgcmVuYW1pbmcgaXQuIE5vdGUgdGhhdCB0aGlzIGRvZXNcbiAgICAgICAgICAvLyBub3QgYXBwbHkgdG8gbGlzdGVuZXJzLCBiZWNhdXNlIHRoZXkgbmVlZCB0byByZXN0b3JlIHRoZSBjb250ZXh0LlxuICAgICAgICAgIHJldHVybiBpc0RpcmVjdCAmJiBzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsICYmICFzY29wZS5pc0xpc3RlbmVyU2NvcGUoKSA/XG4gICAgICAgICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgICAgICAgIGxocztcbiAgICAgICAgfSxcbiAgICAgICAgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuXG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIGlmIChzY29wZS5pc0xpc3RlbmVyU2NvcGUoKSAmJiBzY29wZS5oYXNSZXN0b3JlVmlld1ZhcmlhYmxlKCkpIHtcbiAgICAgICAgICAgICAgLy8gZS5nLiByZXN0b3JlZEN0eC5cbiAgICAgICAgICAgICAgLy8gV2UgaGF2ZSB0byBnZXQgdGhlIGNvbnRleHQgZnJvbSBhIHZpZXcgcmVmZXJlbmNlLCBpZiBvbmUgaXMgYXZhaWxhYmxlLCBiZWNhdXNlXG4gICAgICAgICAgICAgIC8vIHRoZSBjb250ZXh0IHRoYXQgd2FzIHBhc3NlZCBpbiBkdXJpbmcgY3JlYXRpb24gbWF5IG5vdCBiZSBjb3JyZWN0IGFueW1vcmUuXG4gICAgICAgICAgICAgIC8vIEZvciBtb3JlIGluZm9ybWF0aW9uIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzQwMzYwLlxuICAgICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICAgICAgc2NvcGUubm90aWZ5UmVzdG9yZWRWaWV3Q29udGV4dFVzZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0RpcmVjdCkge1xuICAgICAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGEgZGlyZWN0IHJlYWQgb2YgdGhlIGNvbnRleHQgYXQgdGhlIHRvcCBsZXZlbCB3ZSBkb24ndCBuZWVkIHRvXG4gICAgICAgICAgICAgIC8vIGRlY2xhcmUgYW55IHZhcmlhYmxlcyBhbmQgd2UgY2FuIHJlZmVyIHRvIGl0IGRpcmVjdGx5LlxuICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbXMkID0geCgyKSBmb3IgZGlyZWN0IGNvbnRleHQgcmVmZXJlbmNlcyBhbmRcbiAgICAgICAgICAgIC8vIGNvbnN0ICRpdGVtJCA9IHgoMikuJGltcGxpY2l0IGZvciBpbmRpcmVjdCBvbmVzLlxuICAgICAgICAgICAgbGhzLnNldChpc0RpcmVjdCA/IHJocyA6IHJocy5wcm9wKHZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKClcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zOiBBU1RbXSkge1xuICAgIGlmIChleHByZXNzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBleHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4gdGhpcy5pMThuIS5hcHBlbmRCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHR8dC5Cb3VuZFRleHR9KToge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0ge1xuICAgIGNvbnN0IGJvdW5kOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHByb3BzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gcHJvcHNba2V5XTtcbiAgICAgIGlmIChwcm9wIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwocHJvcC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3AudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9uc30gPSB2YWx1ZTtcbiAgICAgICAgICBjb25zdCB7aWQsIGJpbmRpbmdzfSA9IHRoaXMuaTE4biE7XG4gICAgICAgICAgY29uc3QgbGFiZWwgPSBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZyhzdHJpbmdzLCBiaW5kaW5ncy5zaXplLCBpZCk7XG4gICAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnMpO1xuICAgICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwobGFiZWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9XG5cbiAgLy8gR2VuZXJhdGVzIHRvcCBsZXZlbCB2YXJzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgaTE4bl9OYCkuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCk6IG8uUmVhZFZhckV4cHIge1xuICAgIHJldHVybiBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fVkFSX1BSRUZJWCkpO1xuICB9XG5cbiAgLy8gR2VuZXJhdGVzIHZhcnMgd2l0aCBDbG9zdXJlLXNwZWNpZmljIG5hbWVzIGZvciBpMThuIGJsb2NrcyAoaS5lLiBgTVNHX1hYWGApLlxuICBwcml2YXRlIGkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZUlkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBsZXQgbmFtZTogc3RyaW5nO1xuICAgIGNvbnN0IHN1ZmZpeCA9IHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeC50b1VwcGVyQ2FzZSgpO1xuICAgIGlmICh0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcykge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChgRVhURVJOQUxfYCk7XG4gICAgICBjb25zdCB1bmlxdWVTdWZmaXggPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHN1ZmZpeCk7XG4gICAgICBuYW1lID0gYCR7cHJlZml4fSR7c2FuaXRpemVJZGVudGlmaWVyKG1lc3NhZ2VJZCl9JCQke3VuaXF1ZVN1ZmZpeH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KHN1ZmZpeCk7XG4gICAgICBuYW1lID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShwcmVmaXgpO1xuICAgIH1cbiAgICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4blVwZGF0ZVJlZihjb250ZXh0OiBJMThuQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IHtpY3VzLCBtZXRhLCBpc1Jvb3QsIGlzUmVzb2x2ZWQsIGlzRW1pdHRlZH0gPSBjb250ZXh0O1xuICAgIGlmIChpc1Jvb3QgJiYgaXNSZXNvbHZlZCAmJiAhaXNFbWl0dGVkICYmICFpc1NpbmdsZUkxOG5JY3UobWV0YSkpIHtcbiAgICAgIGNvbnRleHQuaXNFbWl0dGVkID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGNvbnRleHQuZ2V0U2VyaWFsaXplZFBsYWNlaG9sZGVycygpO1xuICAgICAgbGV0IGljdU1hcHBpbmc6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgICAgbGV0IHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID1cbiAgICAgICAgICBwbGFjZWhvbGRlcnMuc2l6ZSA/IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycykgOiB7fTtcbiAgICAgIGlmIChpY3VzLnNpemUpIHtcbiAgICAgICAgaWN1cy5mb3JFYWNoKChyZWZzOiBvLkV4cHJlc3Npb25bXSwga2V5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgb25lIElDVSBkZWZpbmVkIGZvciBhIGdpdmVuXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciAtIGp1c3Qgb3V0cHV0IGl0cyByZWZlcmVuY2VcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gcmVmc1swXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gLi4uIG90aGVyd2lzZSB3ZSBuZWVkIHRvIGFjdGl2YXRlIHBvc3QtcHJvY2Vzc2luZ1xuICAgICAgICAgICAgLy8gdG8gcmVwbGFjZSBJQ1UgcGxhY2Vob2xkZXJzIHdpdGggcHJvcGVyIHZhbHVlc1xuICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZyA9IHdyYXBJMThuUGxhY2Vob2xkZXIoYCR7STE4Tl9JQ1VfTUFQUElOR19QUkVGSVh9JHtrZXl9YCk7XG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IG8ubGl0ZXJhbChwbGFjZWhvbGRlcik7XG4gICAgICAgICAgICBpY3VNYXBwaW5nW2tleV0gPSBvLmxpdGVyYWxBcnIocmVmcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJhbnNsYXRpb24gcmVxdWlyZXMgcG9zdCBwcm9jZXNzaW5nIGluIDIgY2FzZXM6XG4gICAgICAvLyAtIGlmIHdlIGhhdmUgcGxhY2Vob2xkZXJzIHdpdGggbXVsdGlwbGUgdmFsdWVzIChleC4gYFNUQVJUX0RJVmA6IFvvv70jMe+/vSwg77+9IzLvv70sIC4uLl0pXG4gICAgICAvLyAtIGlmIHdlIGhhdmUgbXVsdGlwbGUgSUNVcyB0aGF0IHJlZmVyIHRvIHRoZSBzYW1lIHBsYWNlaG9sZGVyIG5hbWVcbiAgICAgIGNvbnN0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPVxuICAgICAgICAgIEFycmF5LmZyb20ocGxhY2Vob2xkZXJzLnZhbHVlcygpKS5zb21lKCh2YWx1ZTogc3RyaW5nW10pID0+IHZhbHVlLmxlbmd0aCA+IDEpIHx8XG4gICAgICAgICAgT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoO1xuXG4gICAgICBsZXQgdHJhbnNmb3JtRm47XG4gICAgICBpZiAobmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgICAgICB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtyYXddO1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFyZ3MucHVzaChtYXBMaXRlcmFsKGljdU1hcHBpbmcsIHRydWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGludm9rZUluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWV0YSBhcyBpMThuLk1lc3NhZ2UsIHBhcmFtcywgY29udGV4dC5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5TdGFydChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIG1ldGE6IGkxOG4uSTE4bk1ldGEsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIHRoaXMuaTE4biA9IHRoaXMuaTE4bkNvbnRleHQgP1xuICAgICAgICB0aGlzLmkxOG5Db250ZXh0LmZvcmtDaGlsZENvbnRleHQoaW5kZXgsIHRoaXMudGVtcGxhdGVJbmRleCEsIG1ldGEpIDpcbiAgICAgICAgbmV3IEkxOG5Db250ZXh0KGluZGV4LCB0aGlzLmkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpLCAwLCB0aGlzLnRlbXBsYXRlSW5kZXgsIG1ldGEpO1xuXG4gICAgLy8gZ2VuZXJhdGUgaTE4blN0YXJ0IGluc3RydWN0aW9uXG4gICAgY29uc3Qge2lkLCByZWZ9ID0gdGhpcy5pMThuO1xuICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGluZGV4KSwgdGhpcy5hZGRUb0NvbnN0cyhyZWYpXTtcbiAgICBpZiAoaWQgPiAwKSB7XG4gICAgICAvLyBkbyBub3QgcHVzaCAzcmQgYXJndW1lbnQgKHN1Yi1ibG9jayBpZClcbiAgICAgIC8vIGludG8gaTE4blN0YXJ0IGNhbGwgZm9yIHRvcCBsZXZlbCBpMThuIGNvbnRleHRcbiAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpZCkpO1xuICAgIH1cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3Bhbiwgc2VsZkNsb3NpbmcgPyBSMy5pMThuIDogUjMuaTE4blN0YXJ0LCBwYXJhbXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuRW5kKHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaTE4bkVuZCBpcyBleGVjdXRlZCB3aXRoIG5vIGkxOG4gY29udGV4dCBwcmVzZW50Jyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4bkNvbnRleHQucmVjb25jaWxlQ2hpbGRDb250ZXh0KHRoaXMuaTE4bik7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuQ29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG4pO1xuICAgIH1cblxuICAgIC8vIHNldHVwIGFjY3VtdWxhdGVkIGJpbmRpbmdzXG4gICAgY29uc3Qge2luZGV4LCBiaW5kaW5nc30gPSB0aGlzLmkxOG47XG4gICAgaWYgKGJpbmRpbmdzLnNpemUpIHtcbiAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgICAvLyBmb3IgaTE4biBibG9jaywgYWR2YW5jZSB0byB0aGUgbW9zdCByZWNlbnQgZWxlbWVudCBpbmRleCAoYnkgdGFraW5nIHRoZSBjdXJyZW50IG51bWJlciBvZlxuICAgICAgICAvLyBlbGVtZW50cyBhbmQgc3VidHJhY3Rpbmcgb25lKSBiZWZvcmUgaW52b2tpbmcgYGkxOG5FeHBgIGluc3RydWN0aW9ucywgdG8gbWFrZSBzdXJlIHRoZVxuICAgICAgICAvLyBuZWNlc3NhcnkgbGlmZWN5Y2xlIGhvb2tzIG9mIGNvbXBvbmVudHMvZGlyZWN0aXZlcyBhcmUgcHJvcGVybHkgZmx1c2hlZC5cbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgICAgdGhpcy5nZXRDb25zdENvdW50KCkgLSAxLCBzcGFuLCBSMy5pMThuRXhwLCAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYmluZGluZykpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChpbmRleCldKTtcbiAgICB9XG4gICAgaWYgKCFzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5FbmQpO1xuICAgIH1cbiAgICB0aGlzLmkxOG4gPSBudWxsOyAgLy8gcmVzZXQgbG9jYWwgaTE4biBjb250ZXh0XG4gIH1cblxuICBwcml2YXRlIGkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgYXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gICAgbGV0IGhhc0JpbmRpbmdzID0gZmFsc2U7XG4gICAgY29uc3QgaTE4bkF0dHJBcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gYXR0ci5pMThuISBhcyBpMThuLk1lc3NhZ2U7XG4gICAgICBjb25zdCBjb252ZXJ0ZWQgPSBhdHRyLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMoY29udmVydGVkKTtcbiAgICAgIGlmIChjb252ZXJ0ZWQgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzKG1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnMpO1xuICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBhcmFtcykpO1xuICAgICAgICBjb252ZXJ0ZWQuZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHtcbiAgICAgICAgICBoYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgICAgICBub2RlSW5kZXgsIHNvdXJjZVNwYW4sIFIzLmkxOG5FeHAsICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChpMThuQXR0ckFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgaW5kZXg6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSk7XG4gICAgICBjb25zdCBjb25zdEluZGV4ID0gdGhpcy5hZGRUb0NvbnN0cyhvLmxpdGVyYWxBcnIoaTE4bkF0dHJBcmdzKSk7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc291cmNlU3BhbiwgUjMuaTE4bkF0dHJpYnV0ZXMsIFtpbmRleCwgY29uc3RJbmRleF0pO1xuICAgICAgaWYgKGhhc0JpbmRpbmdzKSB7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc291cmNlU3BhbiwgUjMuaTE4bkFwcGx5LCBbaW5kZXhdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgbnNJbnN0cnVjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eSBvciBhdHRyaWJ1dGUsIHN1Y2ggYXNcbiAgICogYHByb3A9XCJ7e3ZhbHVlfX1cImAgb3IgYGF0dHIudGl0bGU9XCJ7e3ZhbHVlfX1cImBcbiAgICovXG4gIHByaXZhdGUgaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgdmFsdWU6IEludGVycG9sYXRpb24sIHBhcmFtczogYW55W10pIHtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwoYXR0ck5hbWUpLCAuLi50aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSwgLi4ucGFyYW1zXSk7XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcHJvamVjdGlvblNsb3RJZHggPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgKyB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuXG4gICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5wdXNoKG5nQ29udGVudC5zZWxlY3Rvcik7XG5cbiAgICBjb25zdCBub25Db250ZW50U2VsZWN0QXR0cmlidXRlcyA9XG4gICAgICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+IGF0dHIubmFtZS50b0xvd2VyQ2FzZSgpICE9PSBOR19DT05URU5UX1NFTEVDVF9BVFRSKTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID1cbiAgICAgICAgdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhuZ0NvbnRlbnQubmFtZSwgbm9uQ29udGVudFNlbGVjdEF0dHJpYnV0ZXMsIFtdLCBbXSk7XG5cbiAgICBpZiAoYXR0cmlidXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSwgby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpKTtcbiAgICB9IGVsc2UgaWYgKHByb2plY3Rpb25TbG90SWR4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG5nQ29udGVudC5zb3VyY2VTcGFuLCBSMy5wcm9qZWN0aW9uLCBwYXJhbWV0ZXJzKTtcbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kUHJvamVjdGlvbihuZ0NvbnRlbnQuaTE4biEsIHNsb3QpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzdHlsaW5nQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihudWxsKTtcbiAgICB0aGlzLmVsZW1lbnRMb2NhdGlvbnMuc2V0KGVsZW1lbnQsIHtpbmRleDogZWxlbWVudEluZGV4LCBsZXZlbDogdGhpcy5sZXZlbH0pO1xuXG4gICAgbGV0IGlzTm9uQmluZGFibGVNb2RlOiBib29sZWFuID0gZmFsc2U7XG4gICAgY29uc3QgaXNJMThuUm9vdEVsZW1lbnQ6IGJvb2xlYW4gPVxuICAgICAgICBpc0kxOG5Sb290Tm9kZShlbGVtZW50LmkxOG4pICYmICFpc1NpbmdsZUkxOG5JY3UoZWxlbWVudC5pMThuKTtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gSGFuZGxlIHN0eWxpbmcsIGkxOG4sIG5nTm9uQmluZGFibGUgYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHtuYW1lLCB2YWx1ZX0gPSBhdHRyO1xuICAgICAgaWYgKG5hbWUgPT09IE5PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICAgIGlzTm9uQmluZGFibGVNb2RlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0QXR0cnMucHVzaChhdHRyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kSTE4bkF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID0gc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJCb3VuZElucHV0KGlucHV0KTtcbiAgICAgIGlmICghc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJiBpbnB1dC5pMThuKSB7XG4gICAgICAgICAgYm91bmRJMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICAgIGVsZW1lbnQubmFtZSwgb3V0cHV0QXR0cnMsIGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMsIHN0eWxpbmdCdWlsZGVyLCBbXSxcbiAgICAgICAgYm91bmRJMThuQXR0cnMpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cmlidXRlcykpO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8ZGl2ICNmb28gI2Jhcj1cImJhelwiPilcbiAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4hLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikgPyAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzV2l0aFBpcGVzICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgYm91bmRJMThuQXR0cnMubGVuZ3RoID09PSAwICYmICFoYXNDaGlsZHJlbjtcbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9XG4gICAgICAgICFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uICYmIGhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXIgOiBSMy5lbGVtZW50LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0IDogUjMuZWxlbWVudFN0YXJ0LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcblxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJvdW5kSTE4bkF0dHJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5pMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBib3VuZEkxOG5BdHRycywgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgaWYgKGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb3V0cHV0QXN0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLFxuICAgICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcihlbGVtZW50Lm5hbWUsIG91dHB1dEFzdCwgZWxlbWVudEluZGV4KSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gTm90ZTogaXQncyBpbXBvcnRhbnQgdG8ga2VlcCBpMThuL2kxOG5TdGFydCBpbnN0cnVjdGlvbnMgYWZ0ZXIgaTE4bkF0dHJpYnV0ZXMgYW5kXG4gICAgICAvLyBsaXN0ZW5lcnMsIHRvIG1ha2Ugc3VyZSBpMThuQXR0cmlidXRlcyBpbnN0cnVjdGlvbiB0YXJnZXRzIGN1cnJlbnQgZWxlbWVudCBhdCBydW50aW1lLlxuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4blN0YXJ0KGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4hLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGNvZGUgaGVyZSB3aWxsIGNvbGxlY3QgYWxsIHVwZGF0ZS1sZXZlbCBzdHlsaW5nIGluc3RydWN0aW9ucyBhbmQgYWRkIHRoZW0gdG8gdGhlXG4gICAgLy8gdXBkYXRlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1QgY29kZS4gSW5zdHJ1Y3Rpb25zIGxpa2UgYHN0eWxlUHJvcGAsXG4gICAgLy8gYHN0eWxlTWFwYCwgYGNsYXNzTWFwYCwgYGNsYXNzUHJvcGBcbiAgICAvLyBhcmUgYWxsIGdlbmVyYXRlZCBhbmQgYXNzaWduZWQgaW4gdGhlIGNvZGUgYmVsb3cuXG4gICAgY29uc3Qgc3R5bGluZ0luc3RydWN0aW9ucyA9IHN0eWxpbmdCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIGNvbnN0IGxpbWl0ID0gc3R5bGluZ0luc3RydWN0aW9ucy5sZW5ndGggLSAxO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gc3R5bGluZ0luc3RydWN0aW9uc1tpXTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB0aGlzLnByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gdGhlIHJlYXNvbiB3aHkgYHVuZGVmaW5lZGAgaXMgdXNlZCBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciB1bmRlcnN0YW5kcyB0aGlzIGFzIGFcbiAgICAvLyBzcGVjaWFsIHZhbHVlIHRvIHN5bWJvbGl6ZSB0aGF0IHRoZXJlIGlzIG5vIFJIUyB0byB0aGlzIGJpbmRpbmdcbiAgICAvLyBUT0RPIChtYXRza28pOiByZXZpc2l0IHRoaXMgb25jZSBGVy05NTkgaXMgYXBwcm9hY2hlZFxuICAgIGNvbnN0IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb24gPSBvLmxpdGVyYWwodW5kZWZpbmVkKTtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBPbWl0PEluc3RydWN0aW9uLCAncmVmZXJlbmNlJz5bXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBPbWl0PEluc3RydWN0aW9uLCAncmVmZXJlbmNlJz5bXSA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgaW5wdXRUeXBlID0gaW5wdXQudHlwZTtcbiAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gYW5pbWF0aW9uIGJpbmRpbmdzIGNhbiBiZSBwcmVzZW50ZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXRzOlxuICAgICAgICAvLyAxLiBbQGJpbmRpbmddPVwiZm9vRXhwXCJcbiAgICAgICAgLy8gMi4gW0BiaW5kaW5nXT1cInt2YWx1ZTpmb29FeHAsIHBhcmFtczp7Li4ufX1cIlxuICAgICAgICAvLyAzLiBbQGJpbmRpbmddXG4gICAgICAgIC8vIDQuIEBiaW5kaW5nXG4gICAgICAgIC8vIEFsbCBmb3JtYXRzIHdpbGwgYmUgdmFsaWQgZm9yIHdoZW4gYSBzeW50aGV0aWMgYmluZGluZyBpcyBjcmVhdGVkLlxuICAgICAgICAvLyBUaGUgcmVhc29uaW5nIGZvciB0aGlzIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHNob3VsZCBnZXQgZWFjaFxuICAgICAgICAvLyBzeW50aGV0aWMgYmluZGluZyB2YWx1ZSBpbiB0aGUgb3JkZXIgb2YgdGhlIGFycmF5IHRoYXQgdGhleSBhcmVcbiAgICAgICAgLy8gZGVmaW5lZCBpbi4uLlxuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgTGl0ZXJhbFByaW1pdGl2ZSA/ICEhdmFsdWUudmFsdWUgOiB0cnVlO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIHNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgcGFyYW1zT3JGbjogZ2V0QmluZGluZ0Z1bmN0aW9uUGFyYW1zKFxuICAgICAgICAgICAgICAoKSA9PiBoYXNWYWx1ZSA/IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkgOiBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uLFxuICAgICAgICAgICAgICBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGlucHV0Lm5hbWUpKVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIG11c3Qgc2tpcCBhdHRyaWJ1dGVzIHdpdGggYXNzb2NpYXRlZCBpMThuIGNvbnRleHQsIHNpbmNlIHRoZXNlIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWRcbiAgICAgICAgLy8gc2VwYXJhdGVseSBhbmQgY29ycmVzcG9uZGluZyBgaTE4bkV4cGAgYW5kIGBpMThuQXBwbHlgIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAgICBpZiAoaW5wdXQuaTE4bikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBbYXR0ck5hbWVzcGFjZSwgYXR0ck5hbWVdID0gc3BsaXROc05hbWUoaW5wdXQubmFtZSk7XG4gICAgICAgICAgY29uc3QgaXNBdHRyaWJ1dGVCaW5kaW5nID0gaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICAgICAgbGV0IHNhbml0aXphdGlvblJlZiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dC5zZWN1cml0eUNvbnRleHQsIGlzQXR0cmlidXRlQmluZGluZyk7XG4gICAgICAgICAgaWYgKCFzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIHdhcyBubyBzYW5pdGl6YXRpb24gZnVuY3Rpb24gZm91bmQgYmFzZWQgb24gdGhlIHNlY3VyaXR5IGNvbnRleHRcbiAgICAgICAgICAgIC8vIG9mIGFuIGF0dHJpYnV0ZS9wcm9wZXJ0eSAtIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXNcbiAgICAgICAgICAgIC8vIG9uZSBvZiB0aGUgc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMgKGFuZCB0aGF0IHRoZSBjdXJyZW50XG4gICAgICAgICAgICAvLyBlbGVtZW50IGlzIGFjdHVhbGx5IGFuIDxpZnJhbWU+KS5cbiAgICAgICAgICAgIGlmIChpc0lmcmFtZUVsZW1lbnQoZWxlbWVudC5uYW1lKSAmJiBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cihpbnB1dC5uYW1lKSkge1xuICAgICAgICAgICAgICBzYW5pdGl6YXRpb25SZWYgPSBvLmltcG9ydEV4cHIoUjMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZXNwYWNlTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyTmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoZXJlIHdhc24ndCBhIHNhbml0aXphdGlvbiByZWYsIHdlIG5lZWQgdG8gYWRkXG4gICAgICAgICAgICAgIC8vIGFuIGV4dHJhIHBhcmFtIHNvIHRoYXQgd2UgY2FuIHBhc3MgaW4gdGhlIG5hbWVzcGFjZS5cbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKG51bGwpLCBuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICAvLyBwcm9wPVwie3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIlxuICAgICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCB0aGUgcHJvcGVydGllcyBzbyB0aGF0IHdlIGNhbiBjaGFpbiBpbnRvIGEgc2luZ2xlIGZ1bmN0aW9uIGF0IHRoZSBlbmQuXG4gICAgICAgICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgc3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICBwYXJhbXNPckZuOiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksIGF0dHJOYW1lLCBwYXJhbXMpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgodmFsdWUpID4gMSkge1xuICAgICAgICAgICAgICAvLyBhdHRyLm5hbWU9XCJ0ZXh0e3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJvdW5kVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9uc1swXSA6IHZhbHVlO1xuICAgICAgICAgICAgICAvLyBbYXR0ci5uYW1lXT1cInZhbHVlXCIgb3IgYXR0ci5uYW1lPVwie3t2YWx1ZX19XCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCB0aGUgYXR0cmlidXRlIGJpbmRpbmdzIHNvIHRoYXQgdGhleSBjYW4gYmUgY2hhaW5lZCBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBzcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIHBhcmFtc09yRm46IGdldEJpbmRpbmdGdW5jdGlvblBhcmFtcyhcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJvdW5kVmFsdWUpLCBhdHRyTmFtZSwgcGFyYW1zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xhc3MgcHJvcFxuICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgcHJvcGVydHlCaW5kaW5nIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBlbGVtZW50SW5kZXgsIHByb3BlcnR5QmluZGluZy5zcGFuLCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5nLnBhcmFtc09yRm4pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgYXR0cmlidXRlQmluZGluZyBvZiBhdHRyaWJ1dGVCaW5kaW5ncykge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgIGVsZW1lbnRJbmRleCwgYXR0cmlidXRlQmluZGluZy5zcGFuLCBSMy5hdHRyaWJ1dGUsIGF0dHJpYnV0ZUJpbmRpbmcucGFyYW1zT3JGbik7XG4gICAgfVxuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuISwgZWxlbWVudEluZGV4LCB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgICAgY29uc3Qgc3BhbiA9IGVsZW1lbnQuZW5kU291cmNlU3BhbiA/PyBlbGVtZW50LnNvdXJjZVNwYW47XG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuRW5kKHNwYW4sIGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuZW5hYmxlQmluZGluZ3MpO1xuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyRW5kIDogUjMuZWxlbWVudEVuZCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgY2hpbGRyZW46IHQuTm9kZVtdLCBjb250ZXh0TmFtZVN1ZmZpeDogc3RyaW5nLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdLFxuICAgICAgaTE4bk1ldGE/OiBpMThuLkkxOG5NZXRhLCB2YXJpYWJsZUFsaWFzZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4gJiYgaTE4bk1ldGEpIHtcbiAgICAgIGlmIChpMThuTWV0YSBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kQmxvY2soaTE4bk1ldGEsIGluZGV4KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZShpMThuTWV0YSwgaW5kZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbnRleHROYW1lID0gYCR7dGhpcy5jb250ZXh0TmFtZX0ke2NvbnRleHROYW1lU3VmZml4fV8ke2luZGV4fWA7XG4gICAgY29uc3QgbmFtZSA9IGAke2NvbnRleHROYW1lfV9UZW1wbGF0ZWA7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdmlzaXRvciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbCwgdGhpcy5fYmluZGluZ1Njb3BlLCB0aGlzLmxldmVsICsgMSwgY29udGV4dE5hbWUsIHRoaXMuaTE4biwgaW5kZXgsIG5hbWUsXG4gICAgICAgIHRoaXMuX25hbWVzcGFjZSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LCB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcywgdGhpcy5kZWZlckJsb2NrcyxcbiAgICAgICAgdGhpcy5lbGVtZW50TG9jYXRpb25zLCB0aGlzLl9jb25zdGFudHMpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsIGFmdGVyIHRoZWlyIHBhcmVudCB0ZW1wbGF0ZXMgaGF2ZSBjb21wbGV0ZWRcbiAgICAvLyBwcm9jZXNzaW5nLCBzbyB0aGV5IGFyZSBxdWV1ZWQgaGVyZSB1bnRpbCBhZnRlciB0aGUgaW5pdGlhbCBwYXNzLiBPdGhlcndpc2UsIHdlIHdvdWxkbid0XG4gICAgLy8gYmUgYWJsZSB0byBzdXBwb3J0IGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgdG8gbG9jYWwgcmVmcyB0aGF0IG9jY3VyIGFmdGVyIHRoZVxuICAgIC8vIHRlbXBsYXRlIGRlZmluaXRpb24uIGUuZy4gPGRpdiAqbmdJZj1cInNob3dpbmdcIj57eyBmb28gfX08L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID0gdmlzaXRvci5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICAgICAgY2hpbGRyZW4sIHZhcmlhYmxlcywgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsXG4gICAgICAgICAgaTE4bk1ldGEsIHZhcmlhYmxlQWxpYXNlcyk7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdChuYW1lKSk7XG4gICAgICBpZiAodmlzaXRvci5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5wdXNoKC4uLnZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZURhdGEobmFtZSwgaW5kZXgsIHZpc2l0b3IuX2JpbmRpbmdTY29wZSwgdmlzaXRvcik7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgIHRhZ05hbWU6IHN0cmluZ3xudWxsLCBjaGlsZHJlbjogdC5Ob2RlW10sIGNvbnRleHROYW1lU3VmZml4OiBzdHJpbmcsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW10sIGF0dHJzRXhwcnM/OiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIHJlZmVyZW5jZXM/OiB0LlJlZmVyZW5jZVtdLCBpMThuPzogaTE4bi5JMThuTWV0YSk6IG51bWJlciB7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihjaGlsZHJlbiwgY29udGV4dE5hbWVTdWZmaXgsIHZhcmlhYmxlcywgaTE4bik7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoZGF0YS5pbmRleCksXG4gICAgICBvLnZhcmlhYmxlKGRhdGEubmFtZSksXG4gICAgICBvLmxpdGVyYWwodGFnTmFtZSksXG4gICAgICB0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cnNFeHBycyB8fCBudWxsKSxcbiAgICBdO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8bmctdGVtcGxhdGUgI2Zvbz4pXG4gICAgaWYgKHJlZmVyZW5jZXMgJiYgcmVmZXJlbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KHJlZmVyZW5jZXMpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZSgyLCAwLCBvLmxpdGVyYWwoZGF0YS5nZXRDb25zdENvdW50KCkpLCBvLmxpdGVyYWwoZGF0YS5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGF0YS5pbmRleDtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgIC8vIGl0IGJhc2VkIG9uIHRoZSBwYXJlbnQgbm9kZXMgaW5zaWRlIHRoZSB0ZW1wbGF0ZSBpbnN0cnVjdGlvbi5cbiAgICBjb25zdCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9XG4gICAgICAgIHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWU7XG4gICAgY29uc3QgY29udGV4dE5hbWVTdWZmaXggPSB0ZW1wbGF0ZS50YWdOYW1lID8gJ18nICsgc2FuaXRpemVJZGVudGlmaWVyKHRlbXBsYXRlLnRhZ05hbWUpIDogJyc7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgICBOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUuYXR0cmlidXRlcywgdGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzLFxuICAgICAgICB1bmRlZmluZWQgLyogc3R5bGVzICovLCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIHRlbXBsYXRlLmNoaWxkcmVuLCBjb250ZXh0TmFtZVN1ZmZpeCwgdGVtcGxhdGUuc291cmNlU3BhbixcbiAgICAgICAgdGVtcGxhdGUudmFyaWFibGVzLCBhdHRyc0V4cHJzLCB0ZW1wbGF0ZS5yZWZlcmVuY2VzLCB0ZW1wbGF0ZS5pMThuKTtcblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIMm1ybVwcm9wZXJ0eSgnbmdGb3JPZicsIGN0eC5pdGVtcyksIGV0IGFsO1xuICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMpO1xuXG4gICAgLy8gT25seSBhZGQgbm9ybWFsIGlucHV0L291dHB1dCBiaW5kaW5nIGluc3RydWN0aW9ucyBvbiBleHBsaWNpdCA8bmctdGVtcGxhdGU+IGVsZW1lbnRzLlxuICAgIGlmICh0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUpIHtcbiAgICAgIGNvbnN0IFtpMThuSW5wdXRzLCBpbnB1dHNdID1cbiAgICAgICAgICBwYXJ0aXRpb25BcnJheTx0LkJvdW5kQXR0cmlidXRlLCB0LkJvdW5kQXR0cmlidXRlPih0ZW1wbGF0ZS5pbnB1dHMsIGhhc0kxOG5NZXRhKTtcblxuICAgICAgLy8gQWRkIGkxOG4gYXR0cmlidXRlcyB0aGF0IG1heSBhY3QgYXMgaW5wdXRzIHRvIGRpcmVjdGl2ZXMuIElmIHN1Y2ggYXR0cmlidXRlcyBhcmUgcHJlc2VudCxcbiAgICAgIC8vIGdlbmVyYXRlIGBpMThuQXR0cmlidXRlc2AgaW5zdHJ1Y3Rpb24uIE5vdGU6IHdlIGdlbmVyYXRlIGl0IG9ubHkgZm9yIGV4cGxpY2l0IDxuZy10ZW1wbGF0ZT5cbiAgICAgIC8vIGVsZW1lbnRzLCBpbiBjYXNlIG9mIGlubGluZSB0ZW1wbGF0ZXMsIGNvcnJlc3BvbmRpbmcgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZVxuICAgICAgLy8gbmVzdGVkIHRlbXBsYXRlIGZ1bmN0aW9uLlxuICAgICAgaWYgKGkxOG5JbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCBpMThuSW5wdXRzLCB0ZW1wbGF0ZS5zdGFydFNvdXJjZVNwYW4gPz8gdGVtcGxhdGUuc291cmNlU3Bhbik7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgaW5wdXQgYmluZGluZ3NcbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCBpbnB1dHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBsaXN0ZW5lcnMgZm9yIGRpcmVjdGl2ZSBvdXRwdXRcbiAgICAgIGZvciAoY29uc3Qgb3V0cHV0QXN0IG9mIHRlbXBsYXRlLm91dHB1dHMpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLFxuICAgICAgICAgICAgdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoJ25nX3RlbXBsYXRlJywgb3V0cHV0QXN0LCB0ZW1wbGF0ZUluZGV4KSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdERlZmVycmVkVHJpZ2dlciA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRJZkJsb2NrQnJhbmNoID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEZvckxvb3BCbG9ja0VtcHR5ID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRVbmtub3duQmxvY2sgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kQm91bmRUZXh0KHRleHQuaTE4biEpO1xuICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyh2YWx1ZS5leHByZXNzaW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcblxuICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksXG4gICAgICAgICAgKCkgPT4gdGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvcignVGV4dCBub2RlcyBzaG91bGQgYmUgaW50ZXJwb2xhdGVkIGFuZCBuZXZlciBib3VuZCBkaXJlY3RseS4nKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgLy8gd2hlbiBhIHRleHQgZWxlbWVudCBpcyBsb2NhdGVkIHdpdGhpbiBhIHRyYW5zbGF0YWJsZVxuICAgIC8vIGJsb2NrLCB3ZSBleGNsdWRlIHRoaXMgdGV4dCBlbGVtZW50IGZyb20gaW5zdHJ1Y3Rpb25zIHNldCxcbiAgICAvLyBzaW5jZSBpdCB3aWxsIGJlIGNhcHR1cmVkIGluIGkxOG4gY29udGVudCBhbmQgcHJvY2Vzc2VkIGF0IHJ1bnRpbWVcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogdC5JY3UpIHtcbiAgICBsZXQgaW5pdFdhc0ludm9rZWQgPSBmYWxzZTtcblxuICAgIC8vIGlmIGFuIElDVSB3YXMgY3JlYXRlZCBvdXRzaWRlIG9mIGkxOG4gYmxvY2ssIHdlIHN0aWxsIHRyZWF0XG4gICAgLy8gaXQgYXMgYSB0cmFuc2xhdGFibGUgZW50aXR5IGFuZCBpbnZva2UgaTE4blN0YXJ0IGFuZCBpMThuRW5kXG4gICAgLy8gdG8gZ2VuZXJhdGUgaTE4biBjb250ZXh0IGFuZCB0aGUgbmVjZXNzYXJ5IGluc3RydWN0aW9uc1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICBpbml0V2FzSW52b2tlZCA9IHRydWU7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpY3UuaTE4biEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4hO1xuICAgIGNvbnN0IHZhcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnZhcnMpO1xuICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UucGxhY2Vob2xkZXJzKTtcblxuICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgY29uc3QgbWVzc2FnZSA9IGljdS5pMThuISBhcyBpMThuLk1lc3NhZ2U7XG5cbiAgICAvLyB3ZSBhbHdheXMgbmVlZCBwb3N0LXByb2Nlc3NpbmcgZnVuY3Rpb24gZm9yIElDVXMsIHRvIG1ha2Ugc3VyZSB0aGF0OlxuICAgIC8vIC0gYWxsIHBsYWNlaG9sZGVycyBpbiBhIGZvcm0gb2Yge1BMQUNFSE9MREVSfSBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIChub3RlOlxuICAgIC8vIGBnb29nLmdldE1zZ2AgZG9lcyBub3QgcHJvY2VzcyBJQ1VzIGFuZCB1c2VzIHRoZSBge1BMQUNFSE9MREVSfWAgZm9ybWF0IGZvciBwbGFjZWhvbGRlcnNcbiAgICAvLyBpbnNpZGUgSUNVcylcbiAgICAvLyAtIGFsbCBJQ1UgdmFycyAoc3VjaCBhcyBgVkFSX1NFTEVDVGAgb3IgYFZBUl9QTFVSQUxgKSBhcmUgcmVwbGFjZWQgd2l0aCBjb3JyZWN0IHZhbHVlc1xuICAgIGNvbnN0IHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgLy8gU29ydCB0aGUgbWFwIGVudHJpZXMgaW4gdGhlIGNvbXBpbGVkIG91dHB1dC4gVGhpcyBtYWtlcyBpdCBlYXN5IHRvIGFjaGVpdmUgaWRlbnRpY2FsIG91dHB1dFxuICAgICAgLy8gaW4gdGhlIHRlbXBsYXRlIHBpcGVsaW5lIGNvbXBpbGVyLlxuICAgICAgY29uc3QgcGFyYW1zID0gT2JqZWN0LmZyb21FbnRyaWVzKE9iamVjdC5lbnRyaWVzKHsuLi52YXJzLCAuLi5wbGFjZWhvbGRlcnN9KS5zb3J0KCkpO1xuICAgICAgY29uc3QgZm9ybWF0dGVkID0gZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSk7XG4gICAgICByZXR1cm4gaW52b2tlSW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBbcmF3LCBtYXBMaXRlcmFsKGZvcm1hdHRlZCwgdHJ1ZSldKTtcbiAgICB9O1xuXG4gICAgLy8gaW4gY2FzZSB0aGUgd2hvbGUgaTE4biBtZXNzYWdlIGlzIGEgc2luZ2xlIElDVSAtIHdlIGRvIG5vdCBuZWVkIHRvXG4gICAgLy8gY3JlYXRlIGEgc2VwYXJhdGUgdG9wLWxldmVsIHRyYW5zbGF0aW9uLCB3ZSBjYW4gdXNlIHRoZSByb290IHJlZiBpbnN0ZWFkXG4gICAgLy8gYW5kIG1ha2UgdGhpcyBJQ1UgYSB0b3AtbGV2ZWwgdHJhbnNsYXRpb25cbiAgICAvLyBub3RlOiBJQ1UgcGxhY2Vob2xkZXJzIGFyZSByZXBsYWNlZCB3aXRoIGFjdHVhbCB2YWx1ZXMgaW4gYGkxOG5Qb3N0cHJvY2Vzc2AgZnVuY3Rpb25cbiAgICAvLyBzZXBhcmF0ZWx5LCBzbyB3ZSBkbyBub3QgcGFzcyBwbGFjZWhvbGRlcnMgaW50byBgaTE4blRyYW5zbGF0ZWAgZnVuY3Rpb24uXG4gICAgaWYgKGlzU2luZ2xlSTE4bkljdShpMThuLm1ldGEpKSB7XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgLyogcGxhY2Vob2xkZXJzICovIHt9LCBpMThuLnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgICAgY29uc3QgcmVmID1cbiAgICAgICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgLyogcGxhY2Vob2xkZXJzICovIHt9LCAvKiByZWYgKi8gdW5kZWZpbmVkLCB0cmFuc2Zvcm1Gbik7XG4gICAgICBpMThuLmFwcGVuZEljdShpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSkubmFtZSwgcmVmKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdFdhc0ludm9rZWQpIHtcbiAgICAgIHRoaXMuaTE4bkVuZChudWxsLCB0cnVlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IHQuSWZCbG9jayk6IHZvaWQge1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IG9mIHRoZSBleHByZXNzaW9uLlxuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMobnVsbCk7XG5cbiAgICAvLyBXZSBoYXZlIHRvIHByb2Nlc3MgdGhlIGJsb2NrIGluIHR3byBzdGVwczogb25jZSBoZXJlIGFuZCBhZ2FpbiBpbiB0aGUgdXBkYXRlIGluc3RydWN0aW9uXG4gICAgLy8gY2FsbGJhY2sgaW4gb3JkZXIgdG8gZ2VuZXJhdGUgdGhlIGNvcnJlY3QgZXhwcmVzc2lvbnMgd2hlbiBwaXBlcyBvciBwdXJlIGZ1bmN0aW9ucyBhcmVcbiAgICAvLyB1c2VkIGluc2lkZSB0aGUgYnJhbmNoIGV4cHJlc3Npb25zLlxuICAgIGNvbnN0IGJyYW5jaERhdGEgPSBibG9jay5icmFuY2hlcy5tYXAoKGJyYW5jaCwgYnJhbmNoSW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHtleHByZXNzaW9uLCBleHByZXNzaW9uQWxpYXMsIGNoaWxkcmVuLCBzb3VyY2VTcGFufSA9IGJyYW5jaDtcblxuICAgICAgLy8gSWYgdGhlIGJyYW5jaCBoYXMgYW4gYWxpYXMsIGl0J2xsIGJlIGFzc2lnbmVkIGRpcmVjdGx5IHRvIHRoZSBjb250YWluZXIncyBjb250ZXh0LlxuICAgICAgLy8gV2UgZGVmaW5lIGEgdmFyaWFibGUgcmVmZXJyaW5nIGRpcmVjdGx5IHRvIHRoZSBjb250ZXh0IHNvIHRoYXQgYW55IG5lc3RlZCB1c2FnZXMgY2FuIGJlXG4gICAgICAvLyByZXdyaXR0ZW4gdG8gcmVmZXIgdG8gaXQuXG4gICAgICBjb25zdCB2YXJpYWJsZXMgPSBleHByZXNzaW9uQWxpYXMgIT09IG51bGwgP1xuICAgICAgICAgIFtuZXcgdC5WYXJpYWJsZShcbiAgICAgICAgICAgICAgZXhwcmVzc2lvbkFsaWFzLm5hbWUsIERJUkVDVF9DT05URVhUX1JFRkVSRU5DRSwgZXhwcmVzc2lvbkFsaWFzLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgIGV4cHJlc3Npb25BbGlhcy5rZXlTcGFuKV0gOlxuICAgICAgICAgIHVuZGVmaW5lZDtcblxuICAgICAgbGV0IHRhZ05hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICAgIGxldCBhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXXx1bmRlZmluZWQ7XG5cbiAgICAgIC8vIE9ubHkgdGhlIGZpcnN0IGJyYW5jaCBjYW4gYmUgdXNlZCBmb3IgcHJvamVjdGlvbiwgYmVjYXVzZSB0aGUgY29uZGl0aW9uYWxcbiAgICAgIC8vIHVzZXMgdGhlIGNvbnRhaW5lciBvZiB0aGUgZmlyc3QgYnJhbmNoIGFzIHRoZSBpbnNlcnRpb24gcG9pbnQgZm9yIGFsbCBicmFuY2hlcy5cbiAgICAgIGlmIChicmFuY2hJbmRleCA9PT0gMCkge1xuICAgICAgICBjb25zdCBpbmZlcnJlZERhdGEgPSB0aGlzLmluZmVyUHJvamVjdGlvbkRhdGFGcm9tSW5zZXJ0aW9uUG9pbnQoYnJhbmNoKTtcbiAgICAgICAgdGFnTmFtZSA9IGluZmVycmVkRGF0YS50YWdOYW1lO1xuICAgICAgICBhdHRyc0V4cHJzID0gaW5mZXJyZWREYXRhLmF0dHJzRXhwcnM7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGU6IHRoZSB0ZW1wbGF0ZSBuZWVkcyB0byBiZSBjcmVhdGVkICpiZWZvcmUqIHdlIHByb2Nlc3MgdGhlIGV4cHJlc3Npb24sXG4gICAgICAvLyBvdGhlcndpc2UgcGlwZXMgaW5qZWN0aW5nIHNvbWUgc3ltYm9scyB3b24ndCB3b3JrIChzZWUgIzUyMTAyKS5cbiAgICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICB0YWdOYW1lLCBjaGlsZHJlbiwgJ19Db25kaXRpb25hbCcsIHNvdXJjZVNwYW4sIHZhcmlhYmxlcywgYXR0cnNFeHBycywgdW5kZWZpbmVkLFxuICAgICAgICAgIGJyYW5jaC5pMThuKTtcbiAgICAgIGNvbnN0IHByb2Nlc3NlZEV4cHJlc3Npb24gPVxuICAgICAgICAgIGV4cHJlc3Npb24gPT09IG51bGwgPyBudWxsIDogZXhwcmVzc2lvbi52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICByZXR1cm4ge2luZGV4OiB0ZW1wbGF0ZUluZGV4LCBleHByZXNzaW9uOiBwcm9jZXNzZWRFeHByZXNzaW9uLCBhbGlhczogZXhwcmVzc2lvbkFsaWFzfTtcbiAgICB9KTtcblxuICAgIC8vIFVzZSB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IGJsb2NrIGFzIHRoZSBpbmRleCBmb3IgdGhlIGVudGlyZSBjb250YWluZXIuXG4gICAgY29uc3QgY29udGFpbmVySW5kZXggPSBicmFuY2hEYXRhWzBdLmluZGV4O1xuICAgIGNvbnN0IHBhcmFtc0NhbGxiYWNrID0gKCkgPT4ge1xuICAgICAgbGV0IGNvbnRleHRWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgICAgIGNvbnN0IGdlbmVyYXRlQnJhbmNoID0gKGJyYW5jaEluZGV4OiBudW1iZXIpOiBvLkV4cHJlc3Npb24gPT4ge1xuICAgICAgICAvLyBJZiB3ZSd2ZSBnb25lIGJleW9uZCB0aGUgbGFzdCBicmFuY2gsIHJldHVybiB0aGUgc3BlY2lhbCAtMSB2YWx1ZSB3aGljaCBtZWFucyB0aGF0IG5vXG4gICAgICAgIC8vIHZpZXcgd2lsbCBiZSByZW5kZXJlZC4gTm90ZSB0aGF0IHdlIGRvbid0IG5lZWQgdG8gcmVzZXQgdGhlIGNvbnRleHQgaGVyZSwgYmVjYXVzZSAtMVxuICAgICAgICAvLyB3b24ndCByZW5kZXIgYSB2aWV3IHNvIHRoZSBwYXNzZWQtaW4gY29udGV4dCB3b24ndCBiZSBjYXB0dXJlZC5cbiAgICAgICAgaWYgKGJyYW5jaEluZGV4ID4gYnJhbmNoRGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbCgtMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7aW5kZXgsIGV4cHJlc3Npb24sIGFsaWFzfSA9IGJyYW5jaERhdGFbYnJhbmNoSW5kZXhdO1xuXG4gICAgICAgIC8vIElmIHRoZSBicmFuY2ggaGFzIG5vIGV4cHJlc3Npb24sIGl0IG1lYW5zIHRoYXQgaXQncyB0aGUgZmluYWwgYGVsc2VgLlxuICAgICAgICAvLyBSZXR1cm4gaXRzIGluZGV4IGFuZCBzdG9wIHRoZSByZWN1cnNpb24uIEFzc3VtZXMgdGhhdCB0aGVyZSdzIG9ubHkgb25lXG4gICAgICAgIC8vIGBlbHNlYCBjb25kaXRpb24gYW5kIHRoYXQgaXQncyB0aGUgbGFzdCBicmFuY2guXG4gICAgICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbChpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY29tcGFyaXNvblRhcmdldDogby5FeHByZXNzaW9uO1xuXG4gICAgICAgIGlmIChhbGlhcykge1xuICAgICAgICAgIC8vIElmIHRoZSBicmFuY2ggaXMgYWxpYXNlZCwgd2UgbmVlZCB0byBhc3NpZ24gdGhlIGV4cHJlc3Npb24gdmFsdWUgdG8gdGhlIHRlbXBvcmFyeVxuICAgICAgICAgIC8vIHZhcmlhYmxlIGFuZCB0aGVuIHBhc3MgaXQgaW50byBgY29uZGl0aW9uYWxgLiBFLmcuIGZvciB0aGUgZXhwcmVzc2lvbjpcbiAgICAgICAgICAvLyBgQGlmIChmb28oKTsgYXMgYWxpYXMpIHsuLi59YCB3ZSBoYXZlIHRvIGdlbmVyYXRlOlxuICAgICAgICAgIC8vIGBgYFxuICAgICAgICAgIC8vIGxldCB0ZW1wO1xuICAgICAgICAgIC8vIGNvbmRpdGlvbmFsKDAsICh0ZW1wID0gY3R4LmZvbygpKSA/IDAgOiAtMSwgdGVtcCk7XG4gICAgICAgICAgLy8gYGBgXG4gICAgICAgICAgY29udGV4dFZhcmlhYmxlID0gdGhpcy5hbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlKCk7XG4gICAgICAgICAgY29tcGFyaXNvblRhcmdldCA9IGNvbnRleHRWYXJpYWJsZS5zZXQodGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb21wYXJpc29uVGFyZ2V0ID0gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbXBhcmlzb25UYXJnZXQuY29uZGl0aW9uYWwoby5saXRlcmFsKGluZGV4KSwgZ2VuZXJhdGVCcmFuY2goYnJhbmNoSW5kZXggKyAxKSk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBwYXJhbXMgPSBbby5saXRlcmFsKGNvbnRhaW5lckluZGV4KSwgZ2VuZXJhdGVCcmFuY2goMCldO1xuXG4gICAgICBpZiAoY29udGV4dFZhcmlhYmxlICE9PSBudWxsKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKGNvbnRleHRWYXJpYWJsZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfTtcblxuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgY29udGFpbmVySW5kZXgsIGJsb2NrLmJyYW5jaGVzWzBdLnNvdXJjZVNwYW4sIFIzLmNvbmRpdGlvbmFsLCBwYXJhbXNDYWxsYmFjayk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gICAgLy8gV2UgaGF2ZSB0byBwcm9jZXNzIHRoZSBibG9jayBpbiB0d28gc3RlcHM6IG9uY2UgaGVyZSBhbmQgYWdhaW4gaW4gdGhlIHVwZGF0ZSBpbnN0cnVjdGlvblxuICAgIC8vIGNhbGxiYWNrIGluIG9yZGVyIHRvIGdlbmVyYXRlIHRoZSBjb3JyZWN0IGV4cHJlc3Npb25zIHdoZW4gcGlwZXMgb3IgcHVyZSBmdW5jdGlvbnMgYXJlIHVzZWQuXG4gICAgY29uc3QgY2FzZURhdGEgPSBibG9jay5jYXNlcy5tYXAoY3VycmVudENhc2UgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICBudWxsLCBjdXJyZW50Q2FzZS5jaGlsZHJlbiwgJ19DYXNlJywgY3VycmVudENhc2Uuc291cmNlU3BhbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgICAgdW5kZWZpbmVkLCBjdXJyZW50Q2FzZS5pMThuKTtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjdXJyZW50Q2FzZS5leHByZXNzaW9uID09PSBudWxsID9cbiAgICAgICAgICBudWxsIDpcbiAgICAgICAgICBjdXJyZW50Q2FzZS5leHByZXNzaW9uLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHJldHVybiB7aW5kZXgsIGV4cHJlc3Npb259O1xuICAgIH0pO1xuXG4gICAgLy8gVXNlIHRoZSBpbmRleCBvZiB0aGUgZmlyc3QgYmxvY2sgYXMgdGhlIGluZGV4IGZvciB0aGUgZW50aXJlIGNvbnRhaW5lci5cbiAgICBjb25zdCBjb250YWluZXJJbmRleCA9IGNhc2VEYXRhWzBdLmluZGV4O1xuXG4gICAgLy8gTm90ZTogdGhlIGV4cHJlc3Npb24gbmVlZHMgdG8gYmUgcHJvY2Vzc2VkICphZnRlciogdGhlIHRlbXBsYXRlLFxuICAgIC8vIG90aGVyd2lzZSBwaXBlcyBpbmplY3Rpbmcgc29tZSBzeW1ib2xzIHdvbid0IHdvcmsgKHNlZSAjNTIxMDIpLlxuICAgIGNvbnN0IGJsb2NrRXhwcmVzc2lvbiA9IGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMobnVsbCk7ICAvLyBBbGxvY2F0ZSBhIHNsb3QgZm9yIHRoZSBwcmltYXJ5IGJsb2NrIGV4cHJlc3Npb24uXG5cbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoY29udGFpbmVySW5kZXgsIGJsb2NrLnNvdXJjZVNwYW4sIFIzLmNvbmRpdGlvbmFsLCAoKSA9PiB7XG4gICAgICBjb25zdCBnZW5lcmF0ZUNhc2VzID0gKGNhc2VJbmRleDogbnVtYmVyKTogby5FeHByZXNzaW9uID0+IHtcbiAgICAgICAgLy8gSWYgd2UndmUgZ29uZSBiZXlvbmQgdGhlIGxhc3QgYnJhbmNoLCByZXR1cm4gdGhlIHNwZWNpYWwgLTFcbiAgICAgICAgLy8gdmFsdWUgd2hpY2ggbWVhbnMgdGhhdCBubyB2aWV3IHdpbGwgYmUgcmVuZGVyZWQuXG4gICAgICAgIGlmIChjYXNlSW5kZXggPiBjYXNlRGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbCgtMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7aW5kZXgsIGV4cHJlc3Npb259ID0gY2FzZURhdGFbY2FzZUluZGV4XTtcblxuICAgICAgICAvLyBJZiB0aGUgY2FzZSBoYXMgbm8gZXhwcmVzc2lvbiwgaXQgbWVhbnMgdGhhdCBpdCdzIHRoZSBgZGVmYXVsdGAgY2FzZS5cbiAgICAgICAgLy8gUmV0dXJuIGl0cyBpbmRleCBhbmQgc3RvcCB0aGUgcmVjdXJzaW9uLiBBc3N1bWVzIHRoYXQgdGhlcmUncyBvbmx5IG9uZVxuICAgICAgICAvLyBgZGVmYXVsdGAgY29uZGl0aW9uIGFuZCB0aGF0IGl0J3MgZGVmaW5lZCBsYXN0LlxuICAgICAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBvLmxpdGVyYWwoaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgdGhpcyBpcyB0aGUgdmVyeSBmaXJzdCBjb21wYXJpc29uLCB3ZSBuZWVkIHRvIGFzc2lnbiB0aGUgdmFsdWUgb2YgdGhlIHByaW1hcnlcbiAgICAgICAgLy8gZXhwcmVzc2lvbiBhcyBhIHBhcnQgb2YgdGhlIGNvbXBhcmlzb24gc28gdGhlIHJlbWFpbmluZyBjYXNlcyBjYW4gcmV1c2UgaXQuIEluIHByYWN0aWNlXG4gICAgICAgIC8vIHRoaXMgbG9va3MgYXMgZm9sbG93czpcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIGxldCB0ZW1wO1xuICAgICAgICAvLyBjb25kaXRpb25hbCgxLCAodGVtcCA9IGN0eC5mb28pID09PSAxID8gMSA6IHRlbXAgPT09IDIgPyAyIDogdGVtcCA9PT0gMyA/IDMgOiA0KTtcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIGNvbnN0IGNvbXBhcmlzb25UYXJnZXQgPSBjYXNlSW5kZXggPT09IDAgP1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlKCkuc2V0KFxuICAgICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhibG9ja0V4cHJlc3Npb24pKSA6XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlQ29udHJvbEZsb3dUZW1wVmFyaWFibGUoKTtcblxuICAgICAgICByZXR1cm4gY29tcGFyaXNvblRhcmdldC5pZGVudGljYWwodGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pKVxuICAgICAgICAgICAgLmNvbmRpdGlvbmFsKG8ubGl0ZXJhbChpbmRleCksIGdlbmVyYXRlQ2FzZXMoY2FzZUluZGV4ICsgMSkpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIFtvLmxpdGVyYWwoY29udGFpbmVySW5kZXgpLCBnZW5lcmF0ZUNhc2VzKDApXTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gICAgY29uc3Qge2xvYWRpbmcsIHBsYWNlaG9sZGVyLCBlcnJvciwgdHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9ID0gZGVmZXJyZWQ7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmRlZmVyQmxvY2tzLmdldChkZWZlcnJlZCk7XG5cbiAgICBpZiAoIW1ldGFkYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCByZXNvbHZlIGBkZWZlcmAgYmxvY2sgbWV0YWRhdGEuIEJsb2NrIG1heSBuZWVkIHRvIGJlIGFuYWx5emVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IHByaW1hcnlUZW1wbGF0ZUluZGV4ID0gdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgIG51bGwsIGRlZmVycmVkLmNoaWxkcmVuLCAnX0RlZmVyJywgZGVmZXJyZWQuc291cmNlU3BhbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgZGVmZXJyZWQuaTE4bik7XG4gICAgY29uc3QgbG9hZGluZ0luZGV4ID0gbG9hZGluZyA/IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgbG9hZGluZy5jaGlsZHJlbiwgJ19EZWZlckxvYWRpbmcnLCBsb2FkaW5nLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsb2FkaW5nLmkxOG4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbDtcbiAgICBjb25zdCBsb2FkaW5nQ29uc3RzID0gbG9hZGluZyA/XG4gICAgICAgIHRyaW1UcmFpbGluZ051bGxzKFtvLmxpdGVyYWwobG9hZGluZy5taW5pbXVtVGltZSksIG8ubGl0ZXJhbChsb2FkaW5nLmFmdGVyVGltZSldKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBjb25zdCBwbGFjZWhvbGRlckluZGV4ID0gcGxhY2Vob2xkZXIgP1xuICAgICAgICB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICAgIG51bGwsIHBsYWNlaG9sZGVyLmNoaWxkcmVuLCAnX0RlZmVyUGxhY2Vob2xkZXInLCBwbGFjZWhvbGRlci5zb3VyY2VTcGFuLCB1bmRlZmluZWQsXG4gICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcGxhY2Vob2xkZXIuaTE4bikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyQ29uc3RzID0gcGxhY2Vob2xkZXIgJiYgcGxhY2Vob2xkZXIubWluaW11bVRpbWUgIT09IG51bGwgP1xuICAgICAgICAvLyBUT0RPKGNyaXNiZXRvKTogcG90ZW50aWFsbHkgcGFzcyB0aGUgdGltZSBkaXJlY3RseSBpbnN0ZWFkIG9mIHN0b3JpbmcgaXQgaW4gdGhlIGBjb25zdHNgXG4gICAgICAgIC8vIHNpbmNlIHRoZSBwbGFjZWhvbGRlciBibG9jayBjYW4gb25seSBoYXZlIG9uZSBwYXJhbWV0ZXI/XG4gICAgICAgIG8ubGl0ZXJhbEFycihbby5saXRlcmFsKHBsYWNlaG9sZGVyLm1pbmltdW1UaW1lKV0pIDpcbiAgICAgICAgbnVsbDtcblxuICAgIGNvbnN0IGVycm9ySW5kZXggPSBlcnJvciA/IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLCBlcnJvci5jaGlsZHJlbiwgJ19EZWZlckVycm9yJywgZXJyb3Iuc291cmNlU3BhbiwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZXJyb3IuaTE4bikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGw7XG5cbiAgICAvLyBOb3RlOiB3ZSBnZW5lcmF0ZSB0aGlzIGxhc3Qgc28gdGhlIGluZGV4IG1hdGNoZXMgdGhlIGluc3RydWN0aW9uIG9yZGVyLlxuICAgIGNvbnN0IGRlZmVycmVkSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBkZXBzRm5OYW1lID0gYCR7dGhpcy5jb250ZXh0TmFtZX1fRGVmZXJfJHtkZWZlcnJlZEluZGV4fV9EZXBzRm5gO1xuXG4gICAgLy8gZS5nLiBgZGVmZXIoMSwgMCwgTXlDb21wX0RlZmVyXzFfRGVwc0ZuLCAuLi4pYFxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgZGVmZXJyZWQuc291cmNlU3BhbiwgUjMuZGVmZXIsIHRyaW1UcmFpbGluZ051bGxzKFtcbiAgICAgICAgICBvLmxpdGVyYWwoZGVmZXJyZWRJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKHByaW1hcnlUZW1wbGF0ZUluZGV4KSxcbiAgICAgICAgICB0aGlzLmNyZWF0ZURlZmVycmVkRGVwc0Z1bmN0aW9uKGRlcHNGbk5hbWUsIG1ldGFkYXRhKSxcbiAgICAgICAgICBvLmxpdGVyYWwobG9hZGluZ0luZGV4KSxcbiAgICAgICAgICBvLmxpdGVyYWwocGxhY2Vob2xkZXJJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKGVycm9ySW5kZXgpLFxuICAgICAgICAgIGxvYWRpbmdDb25zdHM/Lmxlbmd0aCA/IHRoaXMuYWRkVG9Db25zdHMoby5saXRlcmFsQXJyKGxvYWRpbmdDb25zdHMpKSA6IG8uVFlQRURfTlVMTF9FWFBSLFxuICAgICAgICAgIHBsYWNlaG9sZGVyQ29uc3RzID8gdGhpcy5hZGRUb0NvbnN0cyhwbGFjZWhvbGRlckNvbnN0cykgOiBvLlRZUEVEX05VTExfRVhQUixcbiAgICAgICAgICAobG9hZGluZ0NvbnN0cz8ubGVuZ3RoIHx8IHBsYWNlaG9sZGVyQ29uc3RzKSA/XG4gICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZlckVuYWJsZVRpbWVyU2NoZWR1bGluZykgOlxuICAgICAgICAgICAgICBvLlRZUEVEX05VTExfRVhQUixcbiAgICAgICAgXSkpO1xuXG4gICAgLy8gQWxsb2NhdGUgYW4gZXh0cmEgZGF0YSBzbG90IHJpZ2h0IGFmdGVyIGEgZGVmZXIgYmxvY2sgc2xvdCB0byBzdG9yZVxuICAgIC8vIGluc3RhbmNlLXNwZWNpZmljIHN0YXRlIG9mIHRoYXQgZGVmZXIgYmxvY2sgYXQgcnVudGltZS5cbiAgICB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIC8vIE5vdGU6IHRoZSB0cmlnZ2VycyBuZWVkIHRvIGJlIHByb2Nlc3NlZCAqYWZ0ZXIqIHRoZSB2YXJpb3VzIHRlbXBsYXRlcyxcbiAgICAvLyBvdGhlcndpc2UgcGlwZXMgaW5qZWN0aW5nIHNvbWUgc3ltYm9scyB3b24ndCB3b3JrIChzZWUgIzUyMTAyKS5cbiAgICB0aGlzLmNyZWF0ZURlZmVyVHJpZ2dlckluc3RydWN0aW9ucyhkZWZlcnJlZEluZGV4LCB0cmlnZ2VycywgbWV0YWRhdGEsIGZhbHNlKTtcbiAgICB0aGlzLmNyZWF0ZURlZmVyVHJpZ2dlckluc3RydWN0aW9ucyhkZWZlcnJlZEluZGV4LCBwcmVmZXRjaFRyaWdnZXJzLCBtZXRhZGF0YSwgdHJ1ZSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURlZmVycmVkRGVwc0Z1bmN0aW9uKG5hbWU6IHN0cmluZywgbWV0YWRhdGE6IFIzRGVmZXJCbG9ja01ldGFkYXRhKSB7XG4gICAgaWYgKG1ldGFkYXRhLmRlcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBkZWZlciBibG9jayBoYXMgZGVwcyBmb3Igd2hpY2ggd2UgbmVlZCB0byBnZW5lcmF0ZSBkeW5hbWljIGltcG9ydHMuXG4gICAgY29uc3QgZGVwZW5kZW5jeUV4cDogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgZGVmZXJyZWREZXAgb2YgbWV0YWRhdGEuZGVwcykge1xuICAgICAgaWYgKGRlZmVycmVkRGVwLmlzRGVmZXJyYWJsZSkge1xuICAgICAgICAvLyBDYWxsYmFjayBmdW5jdGlvbiwgZS5nLiBgbSAoKSA9PiBtLk15Q21wO2AuXG4gICAgICAgIGNvbnN0IGlubmVyRm4gPSBvLmFycm93Rm4oXG4gICAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnbScsIG8uRFlOQU1JQ19UWVBFKV0sIG8udmFyaWFibGUoJ20nKS5wcm9wKGRlZmVycmVkRGVwLnN5bWJvbE5hbWUpKTtcblxuICAgICAgICAvLyBEeW5hbWljIGltcG9ydCwgZS5nLiBgaW1wb3J0KCcuL2EnKS50aGVuKC4uLilgLlxuICAgICAgICBjb25zdCBpbXBvcnRFeHByID1cbiAgICAgICAgICAgIChuZXcgby5EeW5hbWljSW1wb3J0RXhwcihkZWZlcnJlZERlcC5pbXBvcnRQYXRoISkpLnByb3AoJ3RoZW4nKS5jYWxsRm4oW2lubmVyRm5dKTtcbiAgICAgICAgZGVwZW5kZW5jeUV4cC5wdXNoKGltcG9ydEV4cHIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm9uLWRlZmVycmFibGUgc3ltYm9sLCBqdXN0IHVzZSBhIHJlZmVyZW5jZSB0byB0aGUgdHlwZS5cbiAgICAgICAgZGVwZW5kZW5jeUV4cC5wdXNoKGRlZmVycmVkRGVwLnR5cGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRlcHNGbkV4cHIgPSBvLmFycm93Rm4oW10sIG8ubGl0ZXJhbEFycihkZXBlbmRlbmN5RXhwKSk7XG5cbiAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2goZGVwc0ZuRXhwci50b0RlY2xTdG10KG5hbWUsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSk7XG5cbiAgICByZXR1cm4gby52YXJpYWJsZShuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRGVmZXJUcmlnZ2VySW5zdHJ1Y3Rpb25zKFxuICAgICAgZGVmZXJyZWRJbmRleDogbnVtYmVyLCB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIG1ldGFkYXRhOiBSM0RlZmVyQmxvY2tNZXRhZGF0YSxcbiAgICAgIHByZWZldGNoOiBib29sZWFuKSB7XG4gICAgY29uc3Qge3doZW4sIGlkbGUsIGltbWVkaWF0ZSwgdGltZXIsIGhvdmVyLCBpbnRlcmFjdGlvbiwgdmlld3BvcnR9ID0gdHJpZ2dlcnM7XG5cbiAgICAvLyBgZGVmZXJXaGVuKGN0eC5zb21lVmFsdWUpYFxuICAgIGlmICh3aGVuKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdoZW4udmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgZGVmZXJyZWRJbmRleCwgd2hlbi5zb3VyY2VTcGFuLCBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hXaGVuIDogUjMuZGVmZXJXaGVuLFxuICAgICAgICAgICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBnZW5lcmF0ZSBhbiBpbXBsaWNpdCBgb24gaWRsZWAgaWYgdGhlIGBkZWZlcnJlZGAgYmxvY2sgaGFzIG5vIHRyaWdnZXJzLlxuICAgIC8vIGBkZWZlck9uSWRsZSgpYFxuICAgIGlmIChpZGxlIHx8ICghcHJlZmV0Y2ggJiYgT2JqZWN0LmtleXModHJpZ2dlcnMpLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBpZGxlPy5zb3VyY2VTcGFuIHx8IG51bGwsIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uSWRsZSA6IFIzLmRlZmVyT25JZGxlKTtcbiAgICB9XG5cbiAgICAvLyBgZGVmZXJPbkltbWVkaWF0ZSgpYFxuICAgIGlmIChpbW1lZGlhdGUpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBpbW1lZGlhdGUuc291cmNlU3BhbiwgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25JbW1lZGlhdGUgOiBSMy5kZWZlck9uSW1tZWRpYXRlKTtcbiAgICB9XG5cbiAgICAvLyBgZGVmZXJPblRpbWVyKDEzMzcpYFxuICAgIGlmICh0aW1lcikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIHRpbWVyLnNvdXJjZVNwYW4sIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uVGltZXIgOiBSMy5kZWZlck9uVGltZXIsXG4gICAgICAgICAgW28ubGl0ZXJhbCh0aW1lci5kZWxheSldKTtcbiAgICB9XG5cbiAgICAvLyBgZGVmZXJPbkhvdmVyKGluZGV4LCB3YWxrVXBUaW1lcylgXG4gICAgaWYgKGhvdmVyKSB7XG4gICAgICB0aGlzLmRvbU5vZGVCYXNlZFRyaWdnZXIoXG4gICAgICAgICAgJ2hvdmVyJywgaG92ZXIsIG1ldGFkYXRhLCBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPbkhvdmVyIDogUjMuZGVmZXJPbkhvdmVyKTtcbiAgICB9XG5cbiAgICAvLyBgZGVmZXJPbkludGVyYWN0aW9uKGluZGV4LCB3YWxrVXBUaW1lcylgXG4gICAgaWYgKGludGVyYWN0aW9uKSB7XG4gICAgICB0aGlzLmRvbU5vZGVCYXNlZFRyaWdnZXIoXG4gICAgICAgICAgJ2ludGVyYWN0aW9uJywgaW50ZXJhY3Rpb24sIG1ldGFkYXRhLFxuICAgICAgICAgIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uSW50ZXJhY3Rpb24gOiBSMy5kZWZlck9uSW50ZXJhY3Rpb24pO1xuICAgIH1cblxuICAgIC8vIGBkZWZlck9uVmlld3BvcnQoaW5kZXgsIHdhbGtVcFRpbWVzKWBcbiAgICBpZiAodmlld3BvcnQpIHtcbiAgICAgIHRoaXMuZG9tTm9kZUJhc2VkVHJpZ2dlcihcbiAgICAgICAgICAndmlld3BvcnQnLCB2aWV3cG9ydCwgbWV0YWRhdGEsXG4gICAgICAgICAgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25WaWV3cG9ydCA6IFIzLmRlZmVyT25WaWV3cG9ydCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBkb21Ob2RlQmFzZWRUcmlnZ2VyKFxuICAgICAgbmFtZTogc3RyaW5nLFxuICAgICAgdHJpZ2dlcjogdC5JbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcnx0LkhvdmVyRGVmZXJyZWRUcmlnZ2VyfHQuVmlld3BvcnREZWZlcnJlZFRyaWdnZXIsXG4gICAgICBtZXRhZGF0YTogUjNEZWZlckJsb2NrTWV0YWRhdGEsIGluc3RydWN0aW9uUmVmOiBvLkV4dGVybmFsUmVmZXJlbmNlKSB7XG4gICAgY29uc3QgdHJpZ2dlckVsID0gbWV0YWRhdGEudHJpZ2dlckVsZW1lbnRzLmdldCh0cmlnZ2VyKTtcblxuICAgIC8vIERvbid0IGdlbmVyYXRlIGFueXRoaW5nIGlmIGEgdHJpZ2dlciBjYW5ub3QgYmUgcmVzb2x2ZWQuXG4gICAgLy8gV2UnbGwgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljcyB0byBzdXJmYWNlIHRoZXNlIHRvIHVzZXJzLlxuICAgIGlmICghdHJpZ2dlckVsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRyaWdnZXIuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb25SZWYsICgpID0+IHtcbiAgICAgIGNvbnN0IGxvY2F0aW9uID0gdGhpcy5lbGVtZW50TG9jYXRpb25zLmdldCh0cmlnZ2VyRWwpO1xuXG4gICAgICBpZiAoIWxvY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBDb3VsZCBub3QgZGV0ZXJtaW5lIGxvY2F0aW9uIG9mIHJlZmVyZW5jZSBwYXNzZWQgaW50byBgICtcbiAgICAgICAgICAgIGAnJHtuYW1lfScgdHJpZ2dlci4gVGVtcGxhdGUgbWF5IG5vdCBoYXZlIGJlZW4gZnVsbHkgYW5hbHl6ZWQuYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEEgbmVnYXRpdmUgZGVwdGggbWVhbnMgdGhhdCB0aGUgdHJpZ2dlciBpcyBpbnNpZGUgdGhlIHBsYWNlaG9sZGVyLlxuICAgICAgLy8gQ2FwIGl0IGF0IC0xIHNpbmNlIHdlIG9ubHkgY2FyZSB3aGV0aGVyIG9yIG5vdCBpdCdzIG5lZ2F0aXZlLlxuICAgICAgY29uc3QgZGVwdGggPSBNYXRoLm1heCh0aGlzLmxldmVsIC0gbG9jYXRpb24ubGV2ZWwsIC0xKTtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IFtvLmxpdGVyYWwobG9jYXRpb24uaW5kZXgpXTtcblxuICAgICAgLy8gVGhlIG1vc3QgY29tbW9uIGNhc2Ugc2hvdWxkIGJlIGEgdHJpZ2dlciB3aXRoaW4gdGhlIHZpZXcgc28gd2UgY2FuIG9taXQgYSBkZXB0aCBvZlxuICAgICAgLy8gemVyby4gRm9yIHRyaWdnZXJzIGluIHBhcmVudCB2aWV3cyBhbmQgaW4gdGhlIHBsYWNlaG9sZGVyIHdlIG5lZWQgdG8gcGFzcyBpdCBpbi5cbiAgICAgIGlmIChkZXB0aCAhPT0gMCkge1xuICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoZGVwdGgpKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmZlcnMgdGhlIGRhdGEgdXNlZCBmb3IgY29udGVudCBwcm9qZWN0aW9uICh0YWcgbmFtZSBhbmQgYXR0cmlidXRlcykgZnJvbSB0aGUgY29udGVudCBvZiBhXG4gICAqIG5vZGUuXG4gICAqIEBwYXJhbSBub2RlIE5vZGUgZm9yIHdoaWNoIHRvIGluZmVyIHRoZSBwcm9qZWN0aW9uIGRhdGEuXG4gICAqL1xuICBwcml2YXRlIGluZmVyUHJvamVjdGlvbkRhdGFGcm9tSW5zZXJ0aW9uUG9pbnQobm9kZTogdC5JZkJsb2NrQnJhbmNofHQuRm9yTG9vcEJsb2NrKSB7XG4gICAgbGV0IHJvb3Q6IHQuRWxlbWVudHx0LlRlbXBsYXRlfG51bGwgPSBudWxsO1xuICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdfHVuZGVmaW5lZDtcblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiB0LkNvbW1lbnQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGNhbiBvbmx5IGluZmVyIHRoZSB0YWcgbmFtZS9hdHRyaWJ1dGVzIGlmIHRoZXJlJ3MgYSBzaW5nbGUgcm9vdCBub2RlLlxuICAgICAgaWYgKHJvb3QgIT09IG51bGwpIHtcbiAgICAgICAgcm9vdCA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBSb290IG5vZGVzIGNhbiBvbmx5IGVsZW1lbnRzIG9yIHRlbXBsYXRlcyB3aXRoIGEgdGFnIG5hbWUgKGUuZy4gYDxkaXYgKmZvbz48L2Rpdj5gKS5cbiAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuRWxlbWVudCB8fCAoY2hpbGQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGNoaWxkLnRhZ05hbWUgIT09IG51bGwpKSB7XG4gICAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gICAgLy8gdG8gdGhlIHN1cnJvdW5kaW5nIHRlbXBsYXRlIHRvIGJlIHVzZWQgZm9yIGNvbnRlbnQgcHJvamVjdGlvbi4gTm90ZSB0aGF0IGl0J3MgaW1wb3J0YW50XG4gICAgLy8gdGhhdCB3ZSBkb24ndCBjb3B5IGFueSBib3VuZCBhdHRyaWJ1dGVzIHNpbmNlIHRoZXkgZG9uJ3QgcGFydGljaXBhdGUgaW4gY29udGVudCBwcm9qZWN0aW9uXG4gICAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICAgIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBuYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcbiAgICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAgIHRhZ05hbWUgPSBuYW1lID09PSBOR19URU1QTEFURV9UQUdfTkFNRSA/IG51bGwgOiBuYW1lO1xuICAgICAgYXR0cnNFeHBycyA9XG4gICAgICAgICAgdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhOR19URU1QTEFURV9UQUdfTkFNRSwgcm9vdC5hdHRyaWJ1dGVzLCByb290LmlucHV0cywgW10pO1xuICAgIH1cblxuICAgIHJldHVybiB7dGFnTmFtZSwgYXR0cnNFeHByc307XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXBlYXRlciBtZXRhZGF0YS4gVGhlIHNsb3RzIGZvciB0aGUgcHJpbWFyeSBhbmQgZW1wdHkgYmxvY2tcbiAgICAvLyBhcmUgaW1wbGljaXRseSBpbmZlcnJlZCBieSB0aGUgcnVudGltZSB0byBpbmRleCArIDEgYW5kIGluZGV4ICsgMi5cbiAgICBjb25zdCBibG9ja0luZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qge3RhZ05hbWUsIGF0dHJzRXhwcnN9ID0gdGhpcy5pbmZlclByb2plY3Rpb25EYXRhRnJvbUluc2VydGlvblBvaW50KGJsb2NrKTtcbiAgICBjb25zdCBwcmltYXJ5RGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgYmxvY2suY2hpbGRyZW4sICdfRm9yJyxcbiAgICAgICAgW2Jsb2NrLml0ZW0sIGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudF0sIGJsb2NrLmkxOG4sIHtcbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgbGV2ZWwtc3BlY2lmaWMgdmVyc2lvbnMgb2YgYCRpbmRleGAgYW5kIGAkY291bnRgLCBiZWNhdXNlXG4gICAgICAgICAgLy8gdGhleSdyZSB1c2VkIHdoZW4gZGVyaXZpbmcgdGhlIHJlbWFpbmluZyB2YXJpYWJsZXMgKGAkb2RkYCwgYCRldmVuYCBldGMuKSB3aGlsZSBhdCB0aGVcbiAgICAgICAgICAvLyBzYW1lIHRpbWUgYmVpbmcgYXZhaWxhYmxlIGltcGxpY2l0bHkuIFdpdGhvdXQgdGhlc2UgYWxpYXNlcywgd2Ugd291bGRuJ3QgYmUgYWJsZSB0b1xuICAgICAgICAgIC8vIGFjY2VzcyB0aGUgYCRpbmRleGAgb2YgYSBwYXJlbnQgbG9vcCBmcm9tIGluc2lkZSBvZiBhIG5lc3RlZCBsb29wLlxuICAgICAgICAgIFtibG9jay5jb250ZXh0VmFyaWFibGVzLiRpbmRleC5uYW1lXTpcbiAgICAgICAgICAgICAgdGhpcy5nZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKCckaW5kZXgnLCB0aGlzLmxldmVsICsgMSksXG4gICAgICAgICAgW2Jsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWVdOlxuICAgICAgICAgICAgICB0aGlzLmdldExldmVsU3BlY2lmaWNWYXJpYWJsZU5hbWUoJyRjb3VudCcsIHRoaXMubGV2ZWwgKyAxKSxcbiAgICAgICAgfSk7XG4gICAgY29uc3Qge2V4cHJlc3Npb246IHRyYWNrQnlFeHByZXNzaW9uLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2V9ID1cbiAgICAgICAgdGhpcy5jcmVhdGVUcmFja0J5RnVuY3Rpb24oYmxvY2spO1xuICAgIGxldCBlbXB0eURhdGE6IFRlbXBsYXRlRGF0YXxudWxsID0gbnVsbDtcblxuICAgIGlmIChibG9jay5lbXB0eSAhPT0gbnVsbCkge1xuICAgICAgZW1wdHlEYXRhID0gdGhpcy5wcmVwYXJlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgIGJsb2NrLmVtcHR5LmNoaWxkcmVuLCAnX0ZvckVtcHR5JywgdW5kZWZpbmVkLCBibG9jay5lbXB0eS5pMThuKTtcbiAgICAgIC8vIEFsbG9jYXRlIGFuIGV4dHJhIHNsb3QgZm9yIHRoZSBlbXB0eSBibG9jayB0cmFja2luZy5cbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMobnVsbCk7XG4gICAgfVxuXG4gICAgdGhpcy5yZWdpc3RlckNvbXB1dGVkTG9vcFZhcmlhYmxlcyhibG9jaywgcHJpbWFyeURhdGEuc2NvcGUpO1xuXG4gICAgLy8gYHJlcGVhdGVyQ3JlYXRlKDAsIC4uLilgXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGJsb2NrLnNvdXJjZVNwYW4sIFIzLnJlcGVhdGVyQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBbXG4gICAgICAgIG8ubGl0ZXJhbChibG9ja0luZGV4KSxcbiAgICAgICAgby52YXJpYWJsZShwcmltYXJ5RGF0YS5uYW1lKSxcbiAgICAgICAgby5saXRlcmFsKHByaW1hcnlEYXRhLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgIG8ubGl0ZXJhbChwcmltYXJ5RGF0YS5nZXRWYXJDb3VudCgpKSxcbiAgICAgICAgby5saXRlcmFsKHRhZ05hbWUpLFxuICAgICAgICB0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cnNFeHBycyB8fCBudWxsKSxcbiAgICAgICAgdHJhY2tCeUV4cHJlc3Npb24sXG4gICAgICBdO1xuXG4gICAgICBpZiAoZW1wdHlEYXRhICE9PSBudWxsKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICAgICAgby5saXRlcmFsKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpLCBvLnZhcmlhYmxlKGVtcHR5RGF0YS5uYW1lKSxcbiAgICAgICAgICAgIG8ubGl0ZXJhbChlbXB0eURhdGEuZ2V0Q29uc3RDb3VudCgpKSwgby5saXRlcmFsKGVtcHR5RGF0YS5nZXRWYXJDb3VudCgpKSk7XG4gICAgICB9IGVsc2UgaWYgKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpIHtcbiAgICAgICAgLy8gSWYgdGhlIHRyYWNraW5nIGZ1bmN0aW9uIGRvZXNuJ3QgdXNlIHRoZSBjb21wb25lbnQgaW5zdGFuY2UsIHdlIGNhbiBvbWl0IHRoZSBmbGFnLlxuICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwodHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZSkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH0pO1xuXG4gICAgLy8gTm90ZTogdGhlIGV4cHJlc3Npb24gbmVlZHMgdG8gYmUgcHJvY2Vzc2VkICphZnRlciogdGhlIHRlbXBsYXRlLFxuICAgIC8vIG90aGVyd2lzZSBwaXBlcyBpbmplY3Rpbmcgc29tZSBzeW1ib2xzIHdvbid0IHdvcmsgKHNlZSAjNTIxMDIpLlxuICAgIC8vIE5vdGU6IHdlIGRvbid0IGFsbG9jYXRlIGJpbmRpbmcgc2xvdHMgZm9yIHRoaXMgZXhwcmVzc2lvbixcbiAgICAvLyBiZWNhdXNlIGl0cyB2YWx1ZSBpc24ndCBzdG9yZWQgaW4gdGhlIExWaWV3LlxuICAgIGNvbnN0IHZhbHVlID0gYmxvY2suZXhwcmVzc2lvbi52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAvLyBgYWR2YW5jZSh4KTsgcmVwZWF0ZXIoaXRlcmFibGUpYFxuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgYmxvY2tJbmRleCwgYmxvY2suc291cmNlU3BhbiwgUjMucmVwZWF0ZXIsICgpID0+IFt0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpXSk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyQ29tcHV0ZWRMb29wVmFyaWFibGVzKGJsb2NrOiB0LkZvckxvb3BCbG9jaywgYmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUpOiB2b2lkIHtcbiAgICBjb25zdCBsZXZlbCA9IGJpbmRpbmdTY29wZS5iaW5kaW5nTGV2ZWw7XG5cbiAgICBiaW5kaW5nU2NvcGUuc2V0KGxldmVsLCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSwgKHNjb3BlLCByZXRyaWV2YWxMZXZlbCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGluZGV4JylcbiAgICAgICAgICAubW9kdWxvKG8ubGl0ZXJhbCgyKSlcbiAgICAgICAgICAubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgwKSk7XG4gICAgfSk7XG5cbiAgICBiaW5kaW5nU2NvcGUuc2V0KGxldmVsLCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRldmVuLm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoYmxvY2ssIHNjb3BlLCByZXRyaWV2YWxMZXZlbCwgJyRpbmRleCcpXG4gICAgICAgICAgLm1vZHVsbyhvLmxpdGVyYWwoMikpXG4gICAgICAgICAgLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuICAgIH0pO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSwgKHNjb3BlLCByZXRyaWV2YWxMZXZlbCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGluZGV4JylcbiAgICAgICAgICAuaWRlbnRpY2FsKG8ubGl0ZXJhbCgwKSk7XG4gICAgfSk7XG5cbiAgICBiaW5kaW5nU2NvcGUuc2V0KGxldmVsLCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKGJsb2NrLCBzY29wZSwgcmV0cmlldmFsTGV2ZWwsICckaW5kZXgnKTtcbiAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5nZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKGJsb2NrLCBzY29wZSwgcmV0cmlldmFsTGV2ZWwsICckY291bnQnKTtcbiAgICAgIHJldHVybiBpbmRleC5pZGVudGljYWwoY291bnQubWludXMoby5saXRlcmFsKDEpKSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldExldmVsU3BlY2lmaWNWYXJpYWJsZU5hbWUobmFtZTogc3RyaW5nLCBsZXZlbDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAvLyBXZSB1c2UgdGhlIGDJtWAgaGVyZSB0byBlbnN1cmUgdGhhdCB0aGVyZSBhcmUgbm8gbmFtZSBjb25mbGljdHMgd2l0aCB1c2VyLWRlZmluZWQgdmFyaWFibGVzLlxuICAgIHJldHVybiBgybUke25hbWV9XyR7bGV2ZWx9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBuYW1lIG9mIGEgZm9yIGxvb3AgdmFyaWFibGUgYXQgYSBzcGVjaWZpYyBiaW5kaW5nIGxldmVsLiBUaGlzIGFsbG93cyB1cyB0byBsb29rXG4gICAqIHVwIGltcGxpY2l0bHkgc2hhZG93ZWQgdmFyaWFibGVzIGxpa2UgYCRpbmRleGAgYW5kIGAkY291bnRgIGF0IGEgc3BlY2lmaWMgbGV2ZWwuXG4gICAqL1xuICBwcml2YXRlIGdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoXG4gICAgICBibG9jazogdC5Gb3JMb29wQmxvY2ssIHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJldHJpZXZhbExldmVsOiBudW1iZXIsXG4gICAgICBuYW1lOiBrZXlvZiB0LkZvckxvb3BCbG9ja0NvbnRleHQpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHNjb3BlTmFtZSA9IHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwgP1xuICAgICAgICBibG9jay5jb250ZXh0VmFyaWFibGVzW25hbWVdLm5hbWUgOlxuICAgICAgICB0aGlzLmdldExldmVsU3BlY2lmaWNWYXJpYWJsZU5hbWUobmFtZSwgcmV0cmlldmFsTGV2ZWwpO1xuICAgIHJldHVybiBzY29wZS5nZXQoc2NvcGVOYW1lKSE7XG4gIH1cblxuICBwcml2YXRlIG9wdGltaXplVHJhY2tCeUZ1bmN0aW9uKGJsb2NrOiB0LkZvckxvb3BCbG9jaykge1xuICAgIGNvbnN0IGluZGV4TG9jYWxOYW1lID0gYmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZTtcbiAgICBjb25zdCBpdGVtTmFtZSA9IGJsb2NrLml0ZW0ubmFtZTtcbiAgICBjb25zdCBhc3QgPSBibG9jay50cmFja0J5LmFzdDtcblxuICAgIC8vIFRvcC1sZXZlbCBhY2Nlc3Mgb2YgYCRpbmRleGAgdXNlcyB0aGUgYnVpbHQgaW4gYHJlcGVhdGVyVHJhY2tCeUluZGV4YC5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgYXN0Lm5hbWUgPT09IGluZGV4TG9jYWxOYW1lKSB7XG4gICAgICByZXR1cm4ge2V4cHJlc3Npb246IG8uaW1wb3J0RXhwcihSMy5yZXBlYXRlclRyYWNrQnlJbmRleCksIHVzZXNDb21wb25lbnRJbnN0YW5jZTogZmFsc2V9O1xuICAgIH1cblxuICAgIC8vIFRvcC1sZXZlbCBhY2Nlc3Mgb2YgdGhlIGl0ZW0gdXNlcyB0aGUgYnVpbHQgaW4gYHJlcGVhdGVyVHJhY2tCeUlkZW50aXR5YC5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgYXN0Lm5hbWUgPT09IGl0ZW1OYW1lKSB7XG4gICAgICByZXR1cm4ge2V4cHJlc3Npb246IG8uaW1wb3J0RXhwcihSMy5yZXBlYXRlclRyYWNrQnlJZGVudGl0eSksIHVzZXNDb21wb25lbnRJbnN0YW5jZTogZmFsc2V9O1xuICAgIH1cblxuICAgIC8vIFRvcC1sZXZlbCBjYWxscyBpbiB0aGUgZm9ybSBvZiBgZm4oJGluZGV4LCBpdGVtKWAgY2FuIGJlIHBhc3NlZCBpbiBkaXJlY3RseS5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgQ2FsbCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBQcm9wZXJ0eVJlYWQgJiZcbiAgICAgICAgYXN0LnJlY2VpdmVyLnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlciAmJiBhc3QuYXJncy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGNvbnN0IGZpcnN0SXNJbmRleCA9IGFzdC5hcmdzWzBdIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmXG4gICAgICAgICAgYXN0LmFyZ3NbMF0ucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmIGFzdC5hcmdzWzBdLm5hbWUgPT09IGluZGV4TG9jYWxOYW1lO1xuICAgICAgY29uc3Qgc2Vjb25kSXNJdGVtID0gYXN0LmFyZ3NbMV0gaW5zdGFuY2VvZiBQcm9wZXJ0eVJlYWQgJiZcbiAgICAgICAgICBhc3QuYXJnc1sxXS5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0LmFyZ3NbMV0ubmFtZSA9PT0gaXRlbU5hbWU7XG5cbiAgICAgIGlmIChmaXJzdElzSW5kZXggJiYgc2Vjb25kSXNJdGVtKSB7XG4gICAgICAgIC8vIElmIHdlJ3JlIGluIHRoZSB0b3AtbGV2ZWwgY29tcG9uZW50LCB3ZSBjYW4gYWNjZXNzIGRpcmVjdGx5IHRocm91Z2ggYGN0eGAsXG4gICAgICAgIC8vIG90aGVyd2lzZSB3ZSBoYXZlIHRvIGdldCBhIGhvbGQgb2YgdGhlIGNvbXBvbmVudCB0aHJvdWdoIGBjb21wb25lbnRJbnN0YW5jZSgpYC5cbiAgICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLmxldmVsID09PSAwID8gby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IG8uRXh0ZXJuYWxFeHByKFIzLmNvbXBvbmVudEluc3RhbmNlKS5jYWxsRm4oW10pO1xuICAgICAgICByZXR1cm4ge2V4cHJlc3Npb246IHJlY2VpdmVyLnByb3AoYXN0LnJlY2VpdmVyLm5hbWUpLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IGZhbHNlfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlVHJhY2tCeUZ1bmN0aW9uKGJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHtcbiAgICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sXG4gICAgdXNlc0NvbXBvbmVudEluc3RhbmNlOiBib29sZWFuLFxuICB9IHtcbiAgICBjb25zdCBvcHRpbWl6ZWRGbiA9IHRoaXMub3B0aW1pemVUcmFja0J5RnVuY3Rpb24oYmxvY2spO1xuXG4gICAgLy8gSWYgdGhlIHRyYWNraW5nIGZ1bmN0aW9uIGNhbiBiZSBvcHRpbWl6ZWQsIHdlIGRvbid0IG5lZWQgYW55IGZ1cnRoZXIgcHJvY2Vzc2luZy5cbiAgICBpZiAob3B0aW1pemVkRm4gIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBvcHRpbWl6ZWRGbjtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0VmFycyA9IGJsb2NrLmNvbnRleHRWYXJpYWJsZXM7XG4gICAgY29uc3Qgc2NvcGUgPSBuZXcgVHJhY2tCeUJpbmRpbmdTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUsIHtcbiAgICAgIC8vIEFsaWFzIGAkaW5kZXhgIGFuZCB0aGUgaXRlbSBuYW1lIHRvIGAkaW5kZXhgIGFuZCBgJGl0ZW1gIHJlc3BlY3RpdmVseS5cbiAgICAgIC8vIFRoaXMgYWxsb3dzIHVzIHRvIHJldXNlIHB1cmUgZnVuY3Rpb25zIHRoYXQgbWF5IGhhdmUgZGlmZmVyZW50IGl0ZW0gbmFtZXMsXG4gICAgICAvLyBidXQgYXJlIG90aGVyd2lzZSBpZGVudGljYWwuXG4gICAgICBbY29udGV4dFZhcnMuJGluZGV4Lm5hbWVdOiAnJGluZGV4JyxcbiAgICAgIFtibG9jay5pdGVtLm5hbWVdOiAnJGl0ZW0nLFxuXG4gICAgICAvLyBBY2Nlc3NpbmcgdGhlc2UgdmFyaWFibGVzIGluIGEgdHJhY2tpbmcgZnVuY3Rpb24gd2lsbCByZXN1bHQgaW4gYSB0ZW1wbGF0ZSBkaWFnbm9zdGljLlxuICAgICAgLy8gV2UgZGVmaW5lIHRoZW0gYXMgZ2xvYmFscyBzbyB0aGF0IHRoZWlyIGFjY2Vzc2VzIGFyZSBwcmVzZXJ2ZWQgdmVyYmF0aW0gaW5zdGVhZCBvZiBiZWluZ1xuICAgICAgLy8gcmV3cml0dGVuIHRvIHRoZSBhY3R1YWwgYWNjZXNzZXMuXG4gICAgICBbY29udGV4dFZhcnMuJGNvdW50Lm5hbWVdOiBjb250ZXh0VmFycy4kY291bnQubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kZmlyc3QubmFtZV06IGNvbnRleHRWYXJzLiRmaXJzdC5uYW1lLFxuICAgICAgW2NvbnRleHRWYXJzLiRsYXN0Lm5hbWVdOiBjb250ZXh0VmFycy4kbGFzdC5uYW1lLFxuICAgICAgW2NvbnRleHRWYXJzLiRldmVuLm5hbWVdOiBjb250ZXh0VmFycy4kZXZlbi5uYW1lLFxuICAgICAgW2NvbnRleHRWYXJzLiRvZGQubmFtZV06IGNvbnRleHRWYXJzLiRvZGQubmFtZSxcbiAgICB9KTtcbiAgICBjb25zdCBwYXJhbXMgPSBbbmV3IG8uRm5QYXJhbSgnJGluZGV4JyksIG5ldyBvLkZuUGFyYW0oJyRpdGVtJyldO1xuICAgIGNvbnN0IHN0bXRzID0gY29udmVydFB1cmVDb21wb25lbnRTY29wZUZ1bmN0aW9uKFxuICAgICAgICBibG9jay50cmFja0J5LmFzdCwgc2NvcGUsIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgJ3RyYWNrJyk7XG4gICAgY29uc3QgdXNlc0NvbXBvbmVudEluc3RhbmNlID0gc2NvcGUuZ2V0Q29tcG9uZW50QWNjZXNzQ291bnQoKSA+IDA7XG4gICAgbGV0IGZuOiBvLkFycm93RnVuY3Rpb25FeHByfG8uRnVuY3Rpb25FeHByO1xuXG4gICAgaWYgKCF1c2VzQ29tcG9uZW50SW5zdGFuY2UgJiYgc3RtdHMubGVuZ3RoID09PSAxICYmIHN0bXRzWzBdIGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgICBmbiA9IG8uYXJyb3dGbihwYXJhbXMsIHN0bXRzWzBdLmV4cHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgbGFzdCBzdGF0ZW1lbnQgaXMgcmV0dXJuZWQgaW1wbGljaXRseS5cbiAgICAgIGlmIChzdG10cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPSBzdG10c1tzdG10cy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKGxhc3RTdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpIHtcbiAgICAgICAgICBzdG10c1tzdG10cy5sZW5ndGggLSAxXSA9IG5ldyBvLlJldHVyblN0YXRlbWVudChsYXN0U3RhdGVtZW50LmV4cHIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBUaGlzIGhhcyB0byBiZSBhIGZ1bmN0aW9uIGV4cHJlc3Npb24sIGJlY2F1c2UgYC5iaW5kYCBkb2Vzbid0IHdvcmsgb24gYXJyb3cgZnVuY3Rpb25zLlxuICAgICAgZm4gPSBvLmZuKHBhcmFtcywgc3RtdHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBleHByZXNzaW9uOiB0aGlzLmNvbnN0YW50UG9vbC5nZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShmbiwgJ19mb3JUcmFjaycpLFxuICAgICAgdXNlc0NvbXBvbmVudEluc3RhbmNlLFxuICAgIH07XG4gIH1cblxuICBnZXRDb25zdENvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9kYXRhSW5kZXg7XG4gIH1cblxuICBnZXRWYXJDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gIH1cblxuICBnZXRDb25zdHMoKTogQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgICByZXR1cm4gdGhpcy5fY29uc3RhbnRzO1xuICB9XG5cbiAgZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMpLCB0cnVlKSA6XG4gICAgICAgIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGJpbmRpbmdDb250ZXh0KCkge1xuICAgIHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7XG4gIH1cblxuICBwcml2YXRlIHRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlSW5kZXg6IG51bWJlciwgYXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSkge1xuICAgIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IE9taXQ8SW5zdHJ1Y3Rpb24sICdyZWZlcmVuY2UnPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGlucHV0IG9mIGF0dHJzKSB7XG4gICAgICBpZiAoIShpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgLy8gUGFyYW1zIHR5cGljYWxseSBjb250YWluIGF0dHJpYnV0ZSBuYW1lc3BhY2UgYW5kIHZhbHVlIHNhbml0aXplciwgd2hpY2ggaXMgYXBwbGljYWJsZVxuICAgICAgICAvLyBmb3IgcmVndWxhciBIVE1MIGVsZW1lbnRzLCBidXQgbm90IGFwcGxpY2FibGUgZm9yIDxuZy10ZW1wbGF0ZT4gKHNpbmNlIHByb3BzIGFjdCBhc1xuICAgICAgICAvLyBpbnB1dHMgdG8gZGlyZWN0aXZlcyksIHNvIGtlZXAgcGFyYW1zIGFycmF5IGVtcHR5LlxuICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGNhc2VcbiAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCB0ZW1wbGF0ZUluZGV4LCBpbnB1dC5uYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIiBjYXNlXG4gICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgc3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICBwYXJhbXNPckZuOiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSwgaW5wdXQubmFtZSlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBwcm9wZXJ0eUJpbmRpbmcgb2YgcHJvcGVydHlCaW5kaW5ncykge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgIHRlbXBsYXRlSW5kZXgsIHByb3BlcnR5QmluZGluZy5zcGFuLCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5nLnBhcmFtc09yRm4pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6IEluc3RydWN0aW9uW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBJbnN0cnVjdGlvblBhcmFtcywgcHJlcGVuZDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgZm5zW3ByZXBlbmQgPyAndW5zaGlmdCcgOiAncHVzaCddKHtzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm59KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGVsZW1lbnRJbmRleDogbnVtYmVyLCBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9ufG51bGwpIHtcbiAgICBsZXQgYWxsb2NhdGVCaW5kaW5nU2xvdHMgPSAwO1xuICAgIGlmIChpbnN0cnVjdGlvbikge1xuICAgICAgZm9yIChjb25zdCBjYWxsIG9mIGluc3RydWN0aW9uLmNhbGxzKSB7XG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzICs9IGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICAgIGVsZW1lbnRJbmRleCwgY2FsbC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsXG4gICAgICAgICAgICAoKSA9PiBjYWxsLnBhcmFtcyhcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiAoY2FsbC5zdXBwb3J0c0ludGVycG9sYXRpb24gJiYgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSkgYXMgby5FeHByZXNzaW9uW10pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBwYXJhbXNPckZuPzogSW5zdHJ1Y3Rpb25QYXJhbXMsXG4gICAgICBwcmVwZW5kPzogYm9vbGVhbikge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl9jcmVhdGlvbkNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSwgcHJlcGVuZCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBJbnN0cnVjdGlvblBhcmFtcykge1xuICAgIHRoaXMuYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3Nhcnkobm9kZUluZGV4LCBzcGFuKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbik7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgcGFyYW1zT3JGbj86IEluc3RydWN0aW9uUGFyYW1zKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIGFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIGlmIChub2RlSW5kZXggIT09IHRoaXMuX2N1cnJlbnRJbmRleCkge1xuICAgICAgY29uc3QgZGVsdGEgPSBub2RlSW5kZXggLSB0aGlzLl9jdXJyZW50SW5kZXg7XG5cbiAgICAgIGlmIChkZWx0YSA8IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZHZhbmNlIGluc3RydWN0aW9uIGNhbiBvbmx5IGdvIGZvcndhcmRzJyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5hZHZhbmNlLCBbby5saXRlcmFsKGRlbHRhKV0pO1xuICAgICAgdGhpcy5fY3VycmVudEluZGV4ID0gbm9kZUluZGV4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlZmVycyB0byB0aGUgaW1wbGljaXQgcmVjZWl2ZXIuIFRoZSBpbXBsaWNpdFxuICAgKiByZWNlaXZlciBpcyBhbHdheXMgdGhlIHJvb3QgbGV2ZWwgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgaWYgKHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByID0gdGhpcy5sZXZlbCA9PT0gMCA/XG4gICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID1cbiAgICAgICAgY29udmVydFByb3BlcnR5QmluZGluZyh0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCkpO1xuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG4gICAgcmV0dXJuIHZhbEV4cHI7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGxpc3Qgb2YgYXJndW1lbnQgZXhwcmVzc2lvbnMgdG8gcGFzcyB0byBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbi4gQWxzbyB1cGRhdGVzXG4gICAqIHRoZSB0ZW1wIHZhcmlhYmxlcyBzdGF0ZSB3aXRoIHRlbXAgdmFyaWFibGVzIHRoYXQgd2VyZSBpZGVudGlmaWVkIGFzIG5lZWRpbmcgdG8gYmUgY3JlYXRlZFxuICAgKiB3aGlsZSB2aXNpdGluZyB0aGUgYXJndW1lbnRzLlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIG9yaWdpbmFsIGV4cHJlc3Npb24gd2Ugd2lsbCBiZSByZXNvbHZpbmcgYW4gYXJndW1lbnRzIGxpc3QgZnJvbS5cbiAgICovXG4gIHByaXZhdGUgZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWU6IEludGVycG9sYXRpb24pOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3Qge2FyZ3MsIHN0bXRzfSA9XG4gICAgICAgIGNvbnZlcnRVcGRhdGVBcmd1bWVudHModGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpKTtcblxuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIHZhcmlhYmxlIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogc3RvcmUgdGhlIHN0YXRlIGJldHdlZW4gY29udHJvbCBmbG93IGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgYWxsb2NhdGVDb250cm9sRmxvd1RlbXBWYXJpYWJsZSgpOiBvLlJlYWRWYXJFeHByIHtcbiAgICAvLyBOb3RlOiB0aGUgYXNzdW1wdGlvbiBoZXJlIGlzIHRoYXQgd2UnbGwgb25seSBuZWVkIG9uZSB0ZW1wb3JhcnkgdmFyaWFibGUgZm9yIGFsbCBjb250cm9sXG4gICAgLy8gZmxvdyBpbnN0cnVjdGlvbnMuIEl0J3MgZXhwZWN0ZWQgdGhhdCBhbnkgaW5zdHJ1Y3Rpb25zIHdpbGwgb3ZlcndyaXRlIGl0IGJlZm9yZSBwYXNzaW5nIGl0XG4gICAgLy8gaW50byB0aGUgcGFyYW1ldGVycy5cbiAgICBpZiAodGhpcy5fY29udHJvbEZsb3dUZW1wVmFyaWFibGUgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfV9jb250Rmxvd1RtcGA7XG4gICAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2gobmV3IG8uRGVjbGFyZVZhclN0bXQobmFtZSkpO1xuICAgICAgdGhpcy5fY29udHJvbEZsb3dUZW1wVmFyaWFibGUgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb250cm9sRmxvd1RlbXBWYXJpYWJsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBQUk9KRUNUX0FTLCBzZWxlY3RvcixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHJlbmRlckF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdLCBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIG91dHB1dHM6IHQuQm91bmRFdmVudFtdLCBzdHlsZXM/OiBTdHlsaW5nQnVpbGRlcixcbiAgICAgIHRlbXBsYXRlQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdLFxuICAgICAgYm91bmRJMThuQXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCBuZ1Byb2plY3RBc0F0dHI6IHQuVGV4dEF0dHJpYnV0ZXx1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgcmVuZGVyQXR0cmlidXRlcykge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgbmdQcm9qZWN0QXNBdHRyID0gYXR0cjtcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZSB0aGF0IHN0YXRpYyBpMThuIGF0dHJpYnV0ZXMgYXJlbid0IGluIHRoZSBpMThuIGFycmF5LFxuICAgICAgLy8gYmVjYXVzZSB0aGV5J3JlIHRyZWF0ZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHJlZ3VsYXIgYXR0cmlidXRlcy5cbiAgICAgIGlmIChhdHRyLmkxOG4pIHtcbiAgICAgICAgLy8gV2hlbiBpMThuIGF0dHJpYnV0ZXMgYXJlIHByZXNlbnQgb24gZWxlbWVudHMgd2l0aCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZXNcbiAgICAgICAgLy8gKGUuZy4gYDxkaXYgKm5nSWYgdGl0bGU9XCJIZWxsb1wiIGkxOG4tdGl0bGU+YCksIHdlIHdhbnQgdG8gYXZvaWQgZ2VuZXJhdGluZ1xuICAgICAgICAvLyBkdXBsaWNhdGUgaTE4biB0cmFuc2xhdGlvbiBibG9ja3MgZm9yIGDJtcm1dGVtcGxhdGVgIGFuZCBgybXJtWVsZW1lbnRgIGluc3RydWN0aW9uXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMuIFNvIHdlIGRvIGEgY2FjaGUgbG9va3VwIHRvIHNlZSBpZiBzdWl0YWJsZSBpMThuIHRyYW5zbGF0aW9uIGJsb2NrXG4gICAgICAgIC8vIGFscmVhZHkgZXhpc3RzLlxuICAgICAgICBjb25zdCB7aTE4blZhclJlZnNDYWNoZX0gPSB0aGlzLl9jb25zdGFudHM7XG4gICAgICAgIGxldCBpMThuVmFyUmVmOiBvLlJlYWRWYXJFeHByO1xuICAgICAgICBpZiAoaTE4blZhclJlZnNDYWNoZS5oYXMoYXR0ci5pMThuKSkge1xuICAgICAgICAgIGkxOG5WYXJSZWYgPSBpMThuVmFyUmVmc0NhY2hlLmdldChhdHRyLmkxOG4pITtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpMThuVmFyUmVmID0gdGhpcy5pMThuVHJhbnNsYXRlKGF0dHIuaTE4biBhcyBpMThuLk1lc3NhZ2UpO1xuICAgICAgICAgIGkxOG5WYXJSZWZzQ2FjaGUuc2V0KGF0dHIuaTE4biwgaTE4blZhclJlZik7XG4gICAgICAgIH1cbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIGkxOG5WYXJSZWYpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goXG4gICAgICAgICAgICAuLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgdHJ1c3RlZENvbnN0QXR0cmlidXRlKGVsZW1lbnROYW1lLCBhdHRyKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gS2VlcCBuZ1Byb2plY3RBcyBuZXh0IHRvIHRoZSBvdGhlciBuYW1lLCB2YWx1ZSBwYWlycyBzbyB3ZSBjYW4gdmVyaWZ5IHRoYXQgd2UgbWF0Y2hcbiAgICAvLyBuZ1Byb2plY3RBcyBtYXJrZXIgaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHNsb3QuXG4gICAgaWYgKG5nUHJvamVjdEFzQXR0cikge1xuICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKG5nUHJvamVjdEFzQXR0cikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZEF0dHJFeHByKGtleTogc3RyaW5nfG51bWJlciwgdmFsdWU/OiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIWFscmVhZHlTZWVuLmhhcyhrZXkpKSB7XG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGtleSkpO1xuICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgYXR0ckV4cHJzLnB1c2godmFsdWUpO1xuICAgICAgICAgIGFscmVhZHlTZWVuLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoa2V5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaXQncyBpbXBvcnRhbnQgdGhhdCB0aGlzIG9jY3VycyBiZWZvcmUgQklORElOR1MgYW5kIFRFTVBMQVRFIGJlY2F1c2Ugb25jZSBgZWxlbWVudFN0YXJ0YFxuICAgIC8vIGNvbWVzIGFjcm9zcyB0aGUgQklORElOR1Mgb3IgVEVNUExBVEUgbWFya2VycyB0aGVuIGl0IHdpbGwgY29udGludWUgcmVhZGluZyBlYWNoIHZhbHVlIGFzXG4gICAgLy8gYXMgc2luZ2xlIHByb3BlcnR5IHZhbHVlIGNlbGwgYnkgY2VsbC5cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJFeHBycyk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzID0gYXR0ckV4cHJzLmxlbmd0aDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbaV07XG4gICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdGhlIGFuaW1hdGlvbiBhbmQgYXR0cmlidXRlIGJpbmRpbmdzIGluIHRoZVxuICAgICAgICAvLyBhdHRyaWJ1dGVzIGFycmF5IHNpbmNlIHRoZXkgYXJlbid0IHVzZWQgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAgICAgaWYgKGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbiAmJiBpbnB1dC50eXBlICE9PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihpbnB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG91dHB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1tpXTtcbiAgICAgICAgaWYgKG91dHB1dC50eXBlICE9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIob3V0cHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHRoaXMgaXMgYSBjaGVhcCB3YXkgb2YgYWRkaW5nIHRoZSBtYXJrZXIgb25seSBhZnRlciBhbGwgdGhlIGlucHV0L291dHB1dFxuICAgICAgLy8gdmFsdWVzIGhhdmUgYmVlbiBmaWx0ZXJlZCAoYnkgbm90IGluY2x1ZGluZyB0aGUgYW5pbWF0aW9uIG9uZXMpIGFuZCBhZGRlZFxuICAgICAgLy8gdG8gdGhlIGV4cHJlc3Npb25zLiBUaGUgbWFya2VyIGlzIGltcG9ydGFudCBiZWNhdXNlIGl0IHRlbGxzIHRoZSBydW50aW1lXG4gICAgICAvLyBjb2RlIHRoYXQgdGhpcyBpcyB3aGVyZSBhdHRyaWJ1dGVzIHdpdGhvdXQgdmFsdWVzIHN0YXJ0Li4uXG4gICAgICBpZiAoYXR0ckV4cHJzLmxlbmd0aCAhPT0gYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMpIHtcbiAgICAgICAgYXR0ckV4cHJzLnNwbGljZShhdHRyc0xlbmd0aEJlZm9yZUlucHV0cywgMCwgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlQXR0cnMubGVuZ3RoKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpKTtcbiAgICAgIHRlbXBsYXRlQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIGlmIChib3VuZEkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBib3VuZEkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJFeHBycztcbiAgfVxuXG4gIHByaXZhdGUgYWRkVG9Db25zdHMoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKTogby5MaXRlcmFsRXhwciB7XG4gICAgaWYgKG8uaXNOdWxsKGV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgY29uc3RzID0gdGhpcy5fY29uc3RhbnRzLmNvbnN0RXhwcmVzc2lvbnM7XG5cbiAgICAvLyBUcnkgdG8gcmV1c2UgYSBsaXRlcmFsIHRoYXQncyBhbHJlYWR5IGluIHRoZSBhcnJheSwgaWYgcG9zc2libGUuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25zdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb25zdHNbaV0uaXNFcXVpdmFsZW50KGV4cHJlc3Npb24pKSB7XG4gICAgICAgIHJldHVybiBvLmxpdGVyYWwoaSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG8ubGl0ZXJhbChjb25zdHMucHVzaChleHByZXNzaW9uKSAtIDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBdHRyc1RvQ29uc3RzKGF0dHJzOiBvLkV4cHJlc3Npb25bXXxudWxsKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzICE9PSBudWxsICYmIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc0FycmF5KHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IHJlZmVyZW5jZXMuZmxhdE1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXNMaXRlcmFsKHJlZnNQYXJhbSk7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcih0YWdOYW1lOiBzdHJpbmcsIG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50LCBpbmRleDogbnVtYmVyKTpcbiAgICAgICgpID0+IG8uRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPSBvdXRwdXRBc3QubmFtZTtcbiAgICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBvdXRwdXRBc3QudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgICAgLy8gc3ludGhldGljIEBsaXN0ZW5lci5mb28gdmFsdWVzIGFyZSB0cmVhdGVkIHRoZSBleGFjdCBzYW1lIGFzIGFyZSBzdGFuZGFyZCBsaXN0ZW5lcnNcbiAgICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoZXZlbnROYW1lLCBvdXRwdXRBc3QucGhhc2UhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoXG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCwgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBDYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICBvdmVycmlkZSB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgcGlwZS5uYW1lU3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4pLFxuICAgICAgICBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID0gaXNWYXJMZW5ndGggP1xuICAgICAgICB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBhcmdzKV0pIDpcbiAgICAgICAgdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBDYWxsKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgdGFyZ2V0LFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHNsb3QpLFxuICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgICAgICBdLFxuICAgICAgICBudWxsISk7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5wdXNoKHBpcGVCaW5kRXhwcik7XG4gICAgcmV0dXJuIHBpcGVCaW5kRXhwcjtcbiAgfVxuXG4gIHVwZGF0ZVBpcGVTbG90T2Zmc2V0cyhiaW5kaW5nU2xvdHM6IG51bWJlcikge1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMuZm9yRWFjaCgocGlwZTogQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFycmF5LnNwYW4sIGFycmF5LnNvdXJjZVNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAgICAgLy8gdmFsdWVzLlxuICAgICAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIG1hcC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHJ8by5MaXRlcmFsTWFwRXhwcixcbiAgICBhbGxvY2F0ZVNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIC8vIEFsbG9jYXRlIDEgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIDEgcGVyIGFyZ3VtZW50XG4gIGNvbnN0IHN0YXJ0U2xvdCA9IGFsbG9jYXRlU2xvdHMoMSArIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHN0YXJ0U2xvdCksIGxpdGVyYWxGYWN0b3J5XTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbHMgdGhhdCBjYW4gYmUgYWRkZWQgdG8gYW4gZXhwcmVzc2lvblxuICogdG8gcmVwcmVzZW50IHRoZSBuYW1lIGFuZCBuYW1lc3BhY2Ugb2YgYW4gYXR0cmlidXRlLiBFLmcuXG4gKiBgOnhsaW5rOmhyZWZgIHR1cm5zIGludG8gYFtBdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJLCAneGxpbmsnLCAnaHJlZiddYC5cbiAqXG4gKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBhdHRyaWJ1dGUsIGluY2x1ZGluZyB0aGUgbmFtZXNwYWNlLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZTogc3RyaW5nKTogby5MaXRlcmFsRXhwcltdIHtcbiAgY29uc3QgW2F0dHJpYnV0ZU5hbWVzcGFjZSwgYXR0cmlidXRlTmFtZV0gPSBzcGxpdE5zTmFtZShuYW1lKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbnR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRoYXQgaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkLiBJdCBhbGxvd3MgZm9yIHRoZSB2YXJpYWJsZSB0byBiZVxuICogcmVuYW1lZCBkZXBlbmRpbmcgb24gaXRzIGxvY2F0aW9uLlxuICovXG50eXBlIExvY2FsVmFyUmVmQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmV0cmlldmFsTGV2ZWw6IG51bWJlcikgPT4gby5FeHByZXNzaW9uO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IG5leHRDb250ZXh0KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgbG9jYWxSZWZgIGlzIHRydWUgaWYgd2UgYXJlIHN0b3JpbmcgYSBsb2NhbCByZWZlcmVuY2VcbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uRXhwcmVzc2lvbiB8IExvY2FsVmFyUmVmQ2FsbGJhY2s7XG4gIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s7IGRlY2xhcmU6IGJvb2xlYW47IHByaW9yaXR5OiBudW1iZXI7XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7XG4gIERFRkFVTFQgPSAwLFxuICBDT05URVhUID0gMSxcbiAgU0hBUkVEX0NPTlRFWFQgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdXNlc1Jlc3RvcmVkVmlld0NvbnRleHQgPSBmYWxzZTtcbiAgc3RhdGljIGNyZWF0ZVJvb3RTY29wZSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIHJldHVybiBuZXcgQmluZGluZ1Njb3BlKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCByZWFkb25seSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCxcbiAgICAgIHB1YmxpYyBnbG9iYWxzPzogU2V0PHN0cmluZz4pIHtcbiAgICBpZiAoZ2xvYmFscyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgZ2xvYmFscykge1xuICAgICAgICB0aGlzLnNldCgwLCBuYW1lLCBvLnZhcmlhYmxlKG5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHlcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICYmICF2YWx1ZS5kZWNsYXJlKSB7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZS5saHMgPT09ICdmdW5jdGlvbicgPyB2YWx1ZS5saHModGhpcywgdmFsdWUucmV0cmlldmFsTGV2ZWwpIDogdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgYSB2YXJpYWJsZSBleGlzdHMgbG9jYWxseSBvbiB0aGUgY3VycmVudCBzY29wZS4gKi9cbiAgaGFzTG9jYWwobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhcyhuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9ufExvY2FsVmFyUmVmQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaywgbG9jYWxSZWY/OiB0cnVlKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAodGhpcy5tYXAuaGFzKG5hbWUpKSB7XG4gICAgICBpZiAobG9jYWxSZWYpIHtcbiAgICAgICAgLy8gRG8gbm90IHRocm93IGFuIGVycm9yIGlmIGl0J3MgYSBsb2NhbCByZWYgYW5kIGRvIG5vdCB1cGRhdGUgZXhpc3RpbmcgdmFsdWUsXG4gICAgICAgIC8vIHNvIHRoZSBmaXJzdCBkZWZpbmVkIHJlZiBpcyBhbHdheXMgcmV0dXJuZWQuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIH1cbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiBkZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50ZWQgYXMgcGFydCBvZiBMb2NhbFJlc29sdmVyLlxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmJpbmRpbmdMZXZlbCAhPT0gMCkge1xuICAgICAgLy8gU2luY2UgdGhlIGltcGxpY2l0IHJlY2VpdmVyIGlzIGFjY2Vzc2VkIGluIGFuIGVtYmVkZGVkIHZpZXcsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGRlY2xhcmUgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgIC8vIGluIHRoZSB1cGRhdGUgdmFyaWFibGVzLlxuICAgICAgdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApIS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyLCBnbG9iYWxzPzogU2V0PHN0cmluZz4pOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcywgZ2xvYmFscyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpIS5saHMgYXMgby5SZWFkVmFyRXhwcjtcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyBhcyBvLlJlYWRWYXJFeHByIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUICYmXG4gICAgICAgIHZhbHVlLnJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwpIHtcbiAgICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyB2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICBpZiAoc2hhcmVkQ3R4T2JqKSB7XG4gICAgICAgIHNoYXJlZEN0eE9iai5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FICsgdGhpcy5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgdGhpcy5tYXAuc2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgIC8vIGNvbnN0IGN0eF9yMCA9IG5leHRDb250ZXh0KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFQsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApITtcbiAgICBjb21wb25lbnRWYWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICBjb25zdCBsaHMgPSB0eXBlb2YgY29tcG9uZW50VmFsdWUubGhzID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgY29tcG9uZW50VmFsdWUubGhzKHRoaXMsIGNvbXBvbmVudFZhbHVlLnJldHJpZXZhbExldmVsKSA6XG4gICAgICAgIGNvbXBvbmVudFZhbHVlLmxocztcbiAgICByZXR1cm4gbmFtZSA9PT0gRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFID8gbGhzIDogbGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KCkge1xuICAgIC8vIFZpZXcgcmVzdG9yYXRpb24gaXMgcmVxdWlyZWQgZm9yIGxpc3RlbmVyIGluc3RydWN0aW9ucyBpbnNpZGUgZW1iZWRkZWQgdmlld3MsIGJlY2F1c2VcbiAgICAvLyB0aGV5IG9ubHkgcnVuIGluIGNyZWF0aW9uIG1vZGUgYW5kIHRoZXkgY2FuIGhhdmUgcmVmZXJlbmNlcyB0byB0aGUgY29udGV4dCBvYmplY3QuXG4gICAgLy8gSWYgdGhlIGNvbnRleHQgb2JqZWN0IGNoYW5nZXMgaW4gdXBkYXRlIG1vZGUsIHRoZSByZWZlcmVuY2Ugd2lsbCBiZSBpbmNvcnJlY3QsIGJlY2F1c2VcbiAgICAvLyBpdCB3YXMgZXN0YWJsaXNoZWQgZHVyaW5nIGNyZWF0aW9uLlxuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICAgIC8vIHBhcmVudCBzYXZlcyB2YXJpYWJsZSB0byBnZW5lcmF0ZSBhIHNoYXJlZCBgY29uc3QgJHMkID0gZ2V0Q3VycmVudFZpZXcoKTtgIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQhLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gICAgfVxuICB9XG5cbiAgcmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTogby5TdGF0ZW1lbnR8bnVsbCB7XG4gICAgaWYgKHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgY29uc3QgcmVzdG9yZUNhbGwgPSBpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5yZXN0b3JlVmlldywgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZV0pO1xuICAgICAgLy8gRWl0aGVyIGBjb25zdCByZXN0b3JlZEN0eCA9IHJlc3RvcmVWaWV3KCRzdGF0ZSQpO2Agb3IgYHJlc3RvcmVWaWV3KCRzdGF0ZSQpO2BcbiAgICAgIC8vIGRlcGVuZGluZyBvbiB3aGV0aGVyIGl0IGlzIGJlaW5nIHVzZWQuXG4gICAgICByZXR1cm4gdGhpcy51c2VzUmVzdG9yZWRWaWV3Q29udGV4dCA/XG4gICAgICAgICAgby52YXJpYWJsZShSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSkuc2V0KHJlc3RvcmVDYWxsKS50b0NvbnN0RGVjbCgpIDpcbiAgICAgICAgICByZXN0b3JlQ2FsbC50b1N0bXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnZXRDdXJyZW50VmlldygpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbXG4gICAgICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pKS50b0NvbnN0RGVjbCgpXG4gICAgICAgIF0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIGlzTGlzdGVuZXJTY29wZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDtcbiAgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgICAgICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUuZGVjbGFyZSlcbiAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgY29uc3QgbGV2ZWxEaWZmID0gdGhpcy5iaW5kaW5nTGV2ZWwgLSB2YWx1ZS5yZXRyaWV2YWxMZXZlbDtcbiAgICAgICAgICAgICAgICAgY29uc3QgY3VyclN0bXRzID1cbiAgICAgICAgICAgICAgICAgICAgIHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICAgICAgICAgcmV0dXJuIHN0bXRzLmNvbmNhdChjdXJyU3RtdHMpO1xuICAgICAgICAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cblxuICBoYXNSZXN0b3JlVmlld1ZhcmlhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgfVxuXG4gIG5vdGlmeVJlc3RvcmVkVmlld0NvbnRleHRVc2UoKTogdm9pZCB7XG4gICAgdGhpcy51c2VzUmVzdG9yZWRWaWV3Q29udGV4dCA9IHRydWU7XG4gIH1cbn1cblxuLyoqIEJpbmRpbmcgc2NvcGUgb2YgYSBgdHJhY2tgIGZ1bmN0aW9uIGluc2lkZSBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5jbGFzcyBUcmFja0J5QmluZGluZ1Njb3BlIGV4dGVuZHMgQmluZGluZ1Njb3BlIHtcbiAgcHJpdmF0ZSBjb21wb25lbnRBY2Nlc3NDb3VudCA9IDA7XG5cbiAgY29uc3RydWN0b3IocGFyZW50U2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBnbG9iYWxPdmVycmlkZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgICBzdXBlcihwYXJlbnRTY29wZS5iaW5kaW5nTGV2ZWwgKyAxLCBwYXJlbnRTY29wZSk7XG4gIH1cblxuICBvdmVycmlkZSBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIC8vIEludGVyY2VwdCBhbnkgb3ZlcnJpZGRlbiBnbG9iYWxzLlxuICAgIGlmICh0aGlzLmdsb2JhbE92ZXJyaWRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nbG9iYWxPdmVycmlkZXNbbmFtZV0pO1xuICAgIH1cblxuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXMucGFyZW50O1xuXG4gICAgLy8gUHJldmVudCBhY2Nlc3NlcyBvZiB0ZW1wbGF0ZSB2YXJpYWJsZXMgb3V0c2lkZSB0aGUgYGZvcmAgbG9vcC5cbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgaWYgKGN1cnJlbnQuaGFzTG9jYWwobmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gV2hlbiB0aGUgY29tcG9uZW50IHNjb3BlIGlzIGFjY2Vzc2VkLCB3ZSByZWRpcmVjdCBpdCB0aHJvdWdoIGB0aGlzYC5cbiAgICB0aGlzLmNvbXBvbmVudEFjY2Vzc0NvdW50Kys7XG4gICAgcmV0dXJuIG8udmFyaWFibGUoJ3RoaXMnKS5wcm9wKG5hbWUpO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIG51bWJlciBvZiB0aW1lcyB0aGUgaG9zdCBjb21wb25lbnQgaGFzIGJlZW4gYWNjZXNzZWQgdGhyb3VnaCB0aGUgc2NvcGUuICovXG4gIGdldENvbXBvbmVudEFjY2Vzc0NvdW50KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50QWNjZXNzQ291bnQ7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIG91dCBvZiBhbiBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZXNcbiAqIHdoaWNoIGNhbiBiZSBhZGRlZCB0byB0aGUgaW5zdHJ1Y3Rpb24gcGFyYW1ldGVycy5cbiAqL1xuZnVuY3Rpb24gZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZTogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uW10ge1xuICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKGF0dHJpYnV0ZS52YWx1ZSlbMF07XG4gIHJldHVybiBbby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGFzTGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKV07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBhdHRyaWJ1dGVcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgaW50ZXJwb2xhdGVkIHRleHQuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRUZXh0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbik6IG8uRXh0ZXJuYWxSZWZlcmVuY2Uge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIG1vZGlmeSBob3cgYSB0ZW1wbGF0ZSBpcyBwYXJzZWQgYnkgYHBhcnNlVGVtcGxhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VUZW1wbGF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBQcmVzZXJ2ZSBvcmlnaW5hbCBsaW5lIGVuZGluZ3MgaW5zdGVhZCBvZiBub3JtYWxpemluZyAnXFxyXFxuJyBlbmRpbmdzIHRvICdcXG4nLlxuICAgKi9cbiAgcHJlc2VydmVMaW5lRW5kaW5ncz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xuICAvKipcbiAgICogQW4gYXJyYXkgb2YgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIGxlYWRpbmcgdHJpdmlhLlxuICAgKiBMZWFkaW5nIHRyaXZpYSBhcmUgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgaW1wb3J0YW50IHRvIHRoZSBkZXZlbG9wZXIsIGFuZCBzbyBzaG91bGQgbm90IGJlXG4gICAqIGluY2x1ZGVkIGluIHNvdXJjZS1tYXAgc2VnbWVudHMuICBBIGNvbW1vbiBleGFtcGxlIGlzIHdoaXRlc3BhY2UuXG4gICAqL1xuICBsZWFkaW5nVHJpdmlhQ2hhcnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogUmVuZGVyIGAkbG9jYWxpemVgIG1lc3NhZ2UgaWRzIHdpdGggYWRkaXRpb25hbCBsZWdhY3kgbWVzc2FnZSBpZHMuXG4gICAqXG4gICAqIFRoaXMgb3B0aW9uIGRlZmF1bHRzIHRvIGB0cnVlYCBidXQgaW4gdGhlIGZ1dHVyZSB0aGUgZGVmYXVsdCB3aWxsIGJlIGZsaXBwZWQuXG4gICAqXG4gICAqIEZvciBub3cgc2V0IHRoaXMgb3B0aW9uIHRvIGZhbHNlIGlmIHlvdSBoYXZlIG1pZ3JhdGVkIHRoZSB0cmFuc2xhdGlvbiBmaWxlcyB0byB1c2UgdGhlIG5ld1xuICAgKiBgJGxvY2FsaXplYCBtZXNzYWdlIGlkIGZvcm1hdCBhbmQgeW91IGFyZSBub3QgdXNpbmcgY29tcGlsZSB0aW1lIHRyYW5zbGF0aW9uIG1lcmdpbmcuXG4gICAqL1xuICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhbiBleHRlcm5hbCB0ZW1wbGF0ZSAoZS5nLiB2aWEgYHRlbXBsYXRlVXJsYCkgdGhlbiB3ZSBuZWVkIHRvIGRlY2lkZVxuICAgKiB3aGV0aGVyIG9yIG5vdCB0byBub3JtYWxpemUgdGhlIGxpbmUtZW5kaW5ncyAoZnJvbSBgXFxyXFxuYCB0byBgXFxuYCkgd2hlbiBwcm9jZXNzaW5nIElDVVxuICAgKiBleHByZXNzaW9ucy5cbiAgICpcbiAgICogSWYgYHRydWVgIHRoZW4gd2Ugd2lsbCBub3JtYWxpemUgSUNVIGV4cHJlc3Npb24gbGluZSBlbmRpbmdzLlxuICAgKiBUaGUgZGVmYXVsdCBpcyBgZmFsc2VgLCBidXQgdGhpcyB3aWxsIGJlIHN3aXRjaGVkIGluIGEgZnV0dXJlIG1ham9yIHJlbGVhc2UuXG4gICAqL1xuICBpMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGFsd2F5cyBhdHRlbXB0IHRvIGNvbnZlcnQgdGhlIHBhcnNlZCBIVE1MIEFTVCB0byBhbiBSMyBBU1QsIGRlc3BpdGUgSFRNTCBvciBpMThuXG4gICAqIE1ldGEgcGFyc2UgZXJyb3JzLlxuICAgKlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1c2VmdWwgaW4gdGhlIGNvbnRleHQgb2YgdGhlIGxhbmd1YWdlIHNlcnZpY2UsIHdoZXJlIHdlIHdhbnQgdG8gZ2V0IGFzIG11Y2hcbiAgICogaW5mb3JtYXRpb24gYXMgcG9zc2libGUsIGRlc3BpdGUgYW55IGVycm9ycyBpbiB0aGUgSFRNTC4gQXMgYW4gZXhhbXBsZSwgYSB1c2VyIG1heSBiZSBhZGRpbmdcbiAgICogYSBuZXcgdGFnIGFuZCBleHBlY3RpbmcgYXV0b2NvbXBsZXRlIG9uIHRoYXQgdGFnLiBJbiB0aGlzIHNjZW5hcmlvLCB0aGUgSFRNTCBpcyBpbiBhbiBlcnJvcmVkXG4gICAqIHN0YXRlLCBhcyB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIG9wZW4gdGFnLiBIb3dldmVyLCB3ZSdyZSBzdGlsbCBhYmxlIHRvIGNvbnZlcnQgdGhlIEhUTUwgQVNUXG4gICAqIG5vZGVzIHRvIFIzIEFTVCBub2RlcyBpbiBvcmRlciB0byBwcm92aWRlIGluZm9ybWF0aW9uIGZvciB0aGUgbGFuZ3VhZ2Ugc2VydmljZS5cbiAgICpcbiAgICogTm90ZSB0aGF0IGV2ZW4gd2hlbiBgdHJ1ZWAgdGhlIEhUTUwgcGFyc2UgYW5kIGkxOG4gZXJyb3JzIGFyZSBzdGlsbCBhcHBlbmRlZCB0byB0aGUgZXJyb3JzXG4gICAqIG91dHB1dCwgYnV0IHRoaXMgaXMgZG9uZSBhZnRlciBjb252ZXJ0aW5nIHRoZSBIVE1MIEFTVCB0byBSMyBBU1QuXG4gICAqL1xuICBhbHdheXNBdHRlbXB0SHRtbFRvUjNBc3RDb252ZXJzaW9uPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSW5jbHVkZSBIVE1MIENvbW1lbnQgbm9kZXMgaW4gYSB0b3AtbGV2ZWwgY29tbWVudHMgYXJyYXkgb24gdGhlIHJldHVybmVkIFIzIEFTVC5cbiAgICpcbiAgICogVGhpcyBvcHRpb24gaXMgcmVxdWlyZWQgYnkgdG9vbGluZyB0aGF0IG5lZWRzIHRvIGtub3cgdGhlIGxvY2F0aW9uIG9mIGNvbW1lbnQgbm9kZXMgd2l0aGluIHRoZVxuICAgKiBBU1QuIEEgY29uY3JldGUgZXhhbXBsZSBpcyBAYW5ndWxhci1lc2xpbnQgd2hpY2ggcmVxdWlyZXMgdGhpcyBpbiBvcmRlciB0byBlbmFibGVcbiAgICogXCJlc2xpbnQtZGlzYWJsZVwiIGNvbW1lbnRzIHdpdGhpbiBIVE1MIHRlbXBsYXRlcywgd2hpY2ggdGhlbiBhbGxvd3MgdXNlcnMgdG8gdHVybiBvZmYgc3BlY2lmaWNcbiAgICogcnVsZXMgb24gYSBjYXNlIGJ5IGNhc2UgYmFzaXMsIGluc3RlYWQgb2YgZm9yIHRoZWlyIHdob2xlIHByb2plY3Qgd2l0aGluIGEgY29uZmlndXJhdGlvbiBmaWxlLlxuICAgKi9cbiAgY29sbGVjdENvbW1lbnROb2Rlcz86IGJvb2xlYW47XG5cbiAgLyoqIFdoZXRoZXIgdGhlIEAgYmxvY2sgc3ludGF4IGlzIGVuYWJsZWQuICovXG4gIGVuYWJsZUJsb2NrU3ludGF4PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTogUGFyc2VkVGVtcGxhdGUge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlcywgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdH0gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UodGVtcGxhdGUsIHRlbXBsYXRlVXJsLCB7XG4gICAgbGVhZGluZ1RyaXZpYUNoYXJzOiBMRUFESU5HX1RSSVZJQV9DSEFSUyxcbiAgICAuLi5vcHRpb25zLFxuICAgIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWUsXG4gICAgdG9rZW5pemVCbG9ja3M6IG9wdGlvbnMuZW5hYmxlQmxvY2tTeW50YXggPz8gdHJ1ZSxcbiAgfSk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgcGFyc2VSZXN1bHQuZXJyb3JzICYmXG4gICAgICBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcblxuICAvLyBwcm9jZXNzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiAoc2NhbiBhdHRyaWJ1dGVzLCBnZW5lcmF0ZSBpZHMpXG4gIC8vIGJlZm9yZSB3ZSBydW4gd2hpdGVzcGFjZSByZW1vdmFsIHByb2Nlc3MsIGJlY2F1c2UgZXhpc3RpbmcgaTE4blxuICAvLyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgY29uc3QgaTE4bk1ldGFWaXNpdG9yID0gbmV3IEkxOG5NZXRhVmlzaXRvcihcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gIXByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0KTtcbiAgY29uc3QgaTE4bk1ldGFSZXN1bHQgPSBpMThuTWV0YVZpc2l0b3IudmlzaXRBbGxXaXRoRXJyb3JzKHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgaTE4bk1ldGFSZXN1bHQuZXJyb3JzICYmXG4gICAgICBpMThuTWV0YVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBpMThuTWV0YVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICByb290Tm9kZXMgPSBpMThuTWV0YVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdoaXRlc3BhY2VzIGFyZSByZW1vdmVkIChiZWNhdXNlIHRoYXQgbWlnaHQgYWZmZWN0XG4gICAgLy8gZ2VuZXJhdGVkIGkxOG4gbWVzc2FnZSBjb250ZW50KSBhbmQgZmlyc3QgcGFzcyBpbmRpY2F0ZWQgdGhhdCBpMThuIGNvbnRlbnQgaXMgcHJlc2VudCBpbiBhXG4gICAgLy8gdGVtcGxhdGUuIER1cmluZyB0aGlzIHBhc3MgaTE4biBJRHMgZ2VuZXJhdGVkIGF0IHRoZSBmaXJzdCBwYXNzIHdpbGwgYmUgcHJlc2VydmVkLCBzbyB3ZSBjYW5cbiAgICAvLyBtaW1pYyBleGlzdGluZyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnMsIGNvbW1lbnROb2Rlc30gPSBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgICAgcm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyLCB7Y29sbGVjdENvbW1lbnROb2RlczogISFvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXN9KTtcbiAgZXJyb3JzLnB1c2goLi4ucGFyc2VSZXN1bHQuZXJyb3JzLCAuLi5pMThuTWV0YVJlc3VsdC5lcnJvcnMpO1xuXG4gIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgZXJyb3JzOiBlcnJvcnMubGVuZ3RoID4gMCA/IGVycm9ycyA6IG51bGwsXG4gICAgbm9kZXMsXG4gICAgc3R5bGVVcmxzLFxuICAgIHN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnNcbiAgfTtcblxuICBpZiAob3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzKSB7XG4gICAgcGFyc2VkVGVtcGxhdGUuY29tbWVudE5vZGVzID0gY29tbWVudE5vZGVzO1xuICB9XG4gIHJldHVybiBwYXJzZWRUZW1wbGF0ZTtcbn1cblxuY29uc3QgZWxlbWVudFJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKG5ldyBQYXJzZXIobmV3IExleGVyKCkpLCBpbnRlcnBvbGF0aW9uQ29uZmlnLCBlbGVtZW50UmVnaXN0cnksIFtdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25Gbihjb250ZXh0OiBjb3JlLlNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGU/OiBib29sZWFuKSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlzQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ1c3RlZENvbnN0QXR0cmlidXRlKHRhZ05hbWU6IHN0cmluZywgYXR0cjogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgdmFsdWUgPSBhc0xpdGVyYWwoYXR0ci52YWx1ZSk7XG4gIGlmIChpc1RydXN0ZWRUeXBlc1NpbmsodGFnTmFtZSwgYXR0ci5uYW1lKSkge1xuICAgIHN3aXRjaCAoZWxlbWVudFJlZ2lzdHJ5LnNlY3VyaXR5Q29udGV4dCh0YWdOYW1lLCBhdHRyLm5hbWUsIC8qIGlzQXR0cmlidXRlICovIHRydWUpKSB7XG4gICAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICAgIHJldHVybiBvLnRhZ2dlZFRlbXBsYXRlKFxuICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRIdG1sKSxcbiAgICAgICAgICAgIG5ldyBvLlRlbXBsYXRlTGl0ZXJhbChbbmV3IG8uVGVtcGxhdGVMaXRlcmFsRWxlbWVudChhdHRyLnZhbHVlKV0sIFtdKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYXR0ci52YWx1ZVNwYW4pO1xuICAgICAgLy8gTkI6IG5vIFNlY3VyaXR5Q29udGV4dC5TQ1JJUFQgaGVyZSwgYXMgdGhlIGNvcnJlc3BvbmRpbmcgdGFncyBhcmUgc3RyaXBwZWQgYnkgdGhlIGNvbXBpbGVyLlxuICAgICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICAgIHJldHVybiBvLnRhZ2dlZFRlbXBsYXRlKFxuICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRSZXNvdXJjZVVybCksXG4gICAgICAgICAgICBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQoYXR0ci52YWx1ZSldLCBbXSksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGF0dHIudmFsdWVTcGFuKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGNoaWxkcmVuIGlzW3QuRWxlbWVudF0ge1xuICByZXR1cm4gY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIGNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBpc1RleHROb2RlKG5vZGU6IHQuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIHQuVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuSWN1O1xufVxuXG5mdW5jdGlvbiBpc0lmcmFtZUVsZW1lbnQodGFnTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB0YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpZnJhbWUnO1xufVxuXG5mdW5jdGlvbiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4gY2hpbGRyZW4uZXZlcnkoaXNUZXh0Tm9kZSk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdGdW5jdGlvblBhcmFtcyhcbiAgICBkZWZlcnJlZFBhcmFtczogKCkgPT4gKG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSwgbmFtZT86IHN0cmluZyxcbiAgICBlYWdlclBhcmFtcz86IG8uRXhwcmVzc2lvbltdKSB7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBkZWZlcnJlZFBhcmFtcygpO1xuICAgIGNvbnN0IGZuUGFyYW1zID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFt2YWx1ZV07XG4gICAgaWYgKGVhZ2VyUGFyYW1zKSB7XG4gICAgICBmblBhcmFtcy5wdXNoKC4uLmVhZ2VyUGFyYW1zKTtcbiAgICB9XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIC8vIFdlIHdhbnQgdGhlIHByb3BlcnR5IG5hbWUgdG8gYWx3YXlzIGJlIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgICBmblBhcmFtcy51bnNoaWZ0KG8ubGl0ZXJhbChuYW1lKSk7XG4gICAgfVxuICAgIHJldHVybiBmblBhcmFtcztcbiAgfTtcbn1cblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lIGEgZ2l2ZW4gdHJhbnNsYXRpb24gbWVzc2FnZS5cbiAqXG4gKiBgYGBcbiAqIHZhciBJMThOXzE7XG4gKiBpZiAodHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGUpIHtcbiAqICAgICB2YXIgTVNHX0VYVEVSTkFMX1hYWCA9IGdvb2cuZ2V0TXNnKFxuICogICAgICAgICAgXCJTb21lIG1lc3NhZ2Ugd2l0aCB7JGludGVycG9sYXRpb259IVwiLFxuICogICAgICAgICAgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9XG4gKiAgICAgKTtcbiAqICAgICBJMThOXzEgPSBNU0dfRVhURVJOQUxfWFhYO1xuICogfVxuICogZWxzZSB7XG4gKiAgICAgSTE4Tl8xID0gJGxvY2FsaXplYFNvbWUgbWVzc2FnZSB3aXRoICR7J1xcdUZGRkQwXFx1RkZGRCd9IWA7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSBUaGUgb3JpZ2luYWwgaTE4biBBU1QgbWVzc2FnZSBub2RlXG4gKiBAcGFyYW0gdmFyaWFibGUgVGhlIHZhcmlhYmxlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0aGUgdHJhbnNsYXRpb24sIGUuZy4gYEkxOE5fMWAuXG4gKiBAcGFyYW0gY2xvc3VyZVZhciBUaGUgdmFyaWFibGUgZm9yIENsb3N1cmUgYGdvb2cuZ2V0TXNnYCBjYWxscywgZS5nLiBgTVNHX0VYVEVSTkFMX1hYWGAuXG4gKiBAcGFyYW0gcGFyYW1zIE9iamVjdCBtYXBwaW5nIHBsYWNlaG9sZGVyIG5hbWVzIHRvIHRoZWlyIHZhbHVlcyAoZS5nLlxuICogYHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfWApLlxuICogQHBhcmFtIHRyYW5zZm9ybUZuIE9wdGlvbmFsIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSB0cmFuc2xhdGlvbiAoZS5nLlxuICogcG9zdC1wcm9jZXNzaW5nKS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBkZWZpbmVkIGEgZ2l2ZW4gdHJhbnNsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhcbiAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBjbG9zdXJlVmFyOiBvLlJlYWRWYXJFeHByLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgLy8gU29ydCB0aGUgbWFwIGVudHJpZXMgaW4gdGhlIGNvbXBpbGVkIG91dHB1dC4gVGhpcyBtYWtlcyBpdCBlYXN5IHRvIGFjaGVpdmUgaWRlbnRpY2FsIG91dHB1dCBpblxuICAvLyB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgY29tcGlsZXIuXG4gIHBhcmFtcyA9IE9iamVjdC5mcm9tRW50cmllcyhPYmplY3QuZW50cmllcyhwYXJhbXMpLnNvcnQoKSk7XG5cbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtcbiAgICBkZWNsYXJlSTE4blZhcmlhYmxlKHZhcmlhYmxlKSxcbiAgICBvLmlmU3RtdChcbiAgICAgICAgY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpLFxuICAgICAgICBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKHZhcmlhYmxlLCBtZXNzYWdlLCBjbG9zdXJlVmFyLCBwYXJhbXMpLFxuICAgICAgICBjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHMoXG4gICAgICAgICAgICB2YXJpYWJsZSwgbWVzc2FnZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGd1YXJkIHRoZSBjbG9zdXJlIG1vZGUgYmxvY2tcbiAqIEl0IGlzIGVxdWl2YWxlbnQgdG86XG4gKlxuICogYGBgXG4gKiB0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKTogby5CaW5hcnlPcGVyYXRvckV4cHIge1xuICByZXR1cm4gby50eXBlb2ZFeHByKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKVxuICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoJ3VuZGVmaW5lZCcsIG8uU1RSSU5HX1RZUEUpKVxuICAgICAgLmFuZChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSk7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHRlbXBsYXRlIHdoaWNoIHdhcyBleHRyYWN0ZWQgZHVyaW5nIHBhcnNpbmcuXG4gKlxuICogVGhpcyBjb250YWlucyB0aGUgYWN0dWFsIHBhcnNlZCB0ZW1wbGF0ZSBhcyB3ZWxsIGFzIGFueSBtZXRhZGF0YSBjb2xsZWN0ZWQgZHVyaW5nIGl0cyBwYXJzaW5nLFxuICogc29tZSBvZiB3aGljaCBtaWdodCBiZSB1c2VmdWwgZm9yIHJlLXBhcnNpbmcgdGhlIHRlbXBsYXRlIHdpdGggZGlmZmVyZW50IG9wdGlvbnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVGVtcGxhdGUge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEhvdyB0byBwYXJzZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIEFueSBlcnJvcnMgZnJvbSBwYXJzaW5nIHRoZSB0ZW1wbGF0ZSB0aGUgZmlyc3QgdGltZS5cbiAgICpcbiAgICogYG51bGxgIGlmIHRoZXJlIGFyZSBubyBlcnJvcnMuIE90aGVyd2lzZSwgdGhlIGFycmF5IG9mIGVycm9ycyBpcyBndWFyYW50ZWVkIHRvIGJlIG5vbi1lbXB0eS5cbiAgICovXG4gIGVycm9yczogUGFyc2VFcnJvcltdfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSB0ZW1wbGF0ZSBBU1QsIHBhcnNlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIG5vZGVzOiB0Lk5vZGVbXTtcblxuICAvKipcbiAgICogQW55IHN0eWxlVXJscyBleHRyYWN0ZWQgZnJvbSB0aGUgbWV0YWRhdGEuXG4gICAqL1xuICBzdHlsZVVybHM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbnkgaW5saW5lIHN0eWxlcyBleHRyYWN0ZWQgZnJvbSB0aGUgbWV0YWRhdGEuXG4gICAqL1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbnkgbmctY29udGVudCBzZWxlY3RvcnMgZXh0cmFjdGVkIGZyb20gdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IFIzIENvbW1lbnQgTm9kZXMgZXh0cmFjdGVkIGZyb20gdGhlIHRlbXBsYXRlIHdoZW4gdGhlIGBjb2xsZWN0Q29tbWVudE5vZGVzYCBwYXJzZSB0ZW1wbGF0ZVxuICAgKiBvcHRpb24gaXMgZW5hYmxlZC5cbiAgICovXG4gIGNvbW1lbnROb2Rlcz86IHQuQ29tbWVudFtdO1xufVxuIl19