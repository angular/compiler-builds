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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBRSxpQ0FBaUMsRUFBRSxzQkFBc0IsRUFBZ0IsTUFBTSwwQ0FBMEMsQ0FBQztBQUVyTSxPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFtQixZQUFZLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUMzTixPQUFPLEVBQUMsS0FBSyxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDcEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RELE9BQU8sS0FBSyxJQUFJLE1BQU0scUJBQXFCLENBQUM7QUFDNUMsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sMEJBQTBCLENBQUM7QUFDM0YsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBRW5FLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFD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LENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsU0FBUyxzQkFBc0I7SUFDN0IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUNoRCxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ25ELEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QnVpbHRpbkZ1bmN0aW9uQ2FsbCwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRQdXJlQ29tcG9uZW50U2NvcGVGdW5jdGlvbiwgY29udmVydFVwZGF0ZUFyZ3VtZW50cywgTG9jYWxSZXNvbHZlcn0gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIENhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQge2lzVHJ1c3RlZFR5cGVzU2lua30gZnJvbSAnLi4vLi4vc2NoZW1hL3RydXN0ZWRfdHlwZXNfc2lua3MnO1xuaW1wb3J0IHtDc3NTZWxlY3Rvcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvciwgcGFydGl0aW9uQXJyYXl9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWV9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzRGVmZXJCbG9ja01ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0kxOG5Db250ZXh0fSBmcm9tICcuL2kxOG4vY29udGV4dCc7XG5pbXBvcnQge2NyZWF0ZUdvb2dsZUdldE1zZ1N0YXRlbWVudHN9IGZyb20gJy4vaTE4bi9nZXRfbXNnX3V0aWxzJztcbmltcG9ydCB7Y3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzfSBmcm9tICcuL2kxOG4vbG9jYWxpemVfdXRpbHMnO1xuaW1wb3J0IHtJMThuTWV0YVZpc2l0b3J9IGZyb20gJy4vaTE4bi9tZXRhJztcbmltcG9ydCB7YXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMsIGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nLCBkZWNsYXJlSTE4blZhcmlhYmxlLCBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lc0luTWFwLCBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4LCBoYXNJMThuTWV0YSwgSTE4Tl9JQ1VfTUFQUElOR19QUkVGSVgsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIENPTlRFWFRfTkFNRSwgRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFLCBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMsIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoLCBJTVBMSUNJVF9SRUZFUkVOQ0UsIEluc3RydWN0aW9uLCBJbnN0cnVjdGlvblBhcmFtcywgaW52YWxpZCwgaW52b2tlSW5zdHJ1Y3Rpb24sIE5PTl9CSU5EQUJMRV9BVFRSLCBSRUZFUkVOQ0VfUFJFRklYLCBSRU5ERVJfRkxBR1MsIFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FLCB0cmltVHJhaWxpbmdOdWxsc30gZnJvbSAnLi91dGlsJztcblxuXG5cbi8vIFNlbGVjdG9yIGF0dHJpYnV0ZSBuYW1lIG9mIGA8bmctY29udGVudD5gXG5jb25zdCBOR19DT05URU5UX1NFTEVDVF9BVFRSID0gJ3NlbGVjdCc7XG5cbi8vIEF0dHJpYnV0ZSBuYW1lIG9mIGBuZ1Byb2plY3RBc2AuXG5jb25zdCBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSA9ICduZ1Byb2plY3RBcyc7XG5cbi8vIEdsb2JhbCBzeW1ib2xzIGF2YWlsYWJsZSBvbmx5IGluc2lkZSBldmVudCBiaW5kaW5ncy5cbmNvbnN0IEVWRU5UX0JJTkRJTkdfU0NPUEVfR0xPQkFMUyA9IG5ldyBTZXQ8c3RyaW5nPihbJyRldmVudCddKTtcblxuLy8gVGFnIG5hbWUgb2YgdGhlIGBuZy10ZW1wbGF0ZWAgZWxlbWVudC5cbmNvbnN0IE5HX1RFTVBMQVRFX1RBR19OQU1FID0gJ25nLXRlbXBsYXRlJztcblxuLy8gTGlzdCBvZiBzdXBwb3J0ZWQgZ2xvYmFsIHRhcmdldHMgZm9yIGV2ZW50IGxpc3RlbmVyc1xuY29uc3QgR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMgPSBuZXcgTWFwPHN0cmluZywgby5FeHRlcm5hbFJlZmVyZW5jZT4oXG4gICAgW1snd2luZG93JywgUjMucmVzb2x2ZVdpbmRvd10sIFsnZG9jdW1lbnQnLCBSMy5yZXNvbHZlRG9jdW1lbnRdLCBbJ2JvZHknLCBSMy5yZXNvbHZlQm9keV1dKTtcblxuZXhwb3J0IGNvbnN0IExFQURJTkdfVFJJVklBX0NIQVJTID0gWycgJywgJ1xcbicsICdcXHInLCAnXFx0J107XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhcbiAgICBldmVudEFzdDogdC5Cb3VuZEV2ZW50LCBoYW5kbGVyTmFtZTogc3RyaW5nfG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHt0eXBlLCBuYW1lLCB0YXJnZXQsIHBoYXNlLCBoYW5kbGVyfSA9IGV2ZW50QXN0O1xuICBpZiAodGFyZ2V0ICYmICFHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5oYXModGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBnbG9iYWwgdGFyZ2V0ICcke3RhcmdldH0nIGRlZmluZWQgZm9yICcke25hbWV9JyBldmVudC5cbiAgICAgICAgU3VwcG9ydGVkIGxpc3Qgb2YgZ2xvYmFsIHRhcmdldHM6ICR7QXJyYXkuZnJvbShHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5rZXlzKCkpfS5gKTtcbiAgfVxuXG4gIGNvbnN0IGV2ZW50QXJndW1lbnROYW1lID0gJyRldmVudCc7XG4gIGNvbnN0IGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3NlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBpbXBsaWNpdFJlY2VpdmVyRXhwciA9IChzY29wZSA9PT0gbnVsbCB8fCBzY29wZS5iaW5kaW5nTGV2ZWwgPT09IDApID9cbiAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICBzY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIGNvbnN0IGJpbmRpbmdTdGF0ZW1lbnRzID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICBzY29wZSwgaW1wbGljaXRSZWNlaXZlckV4cHIsIGhhbmRsZXIsICdiJywgZXZlbnRBc3QuaGFuZGxlclNwYW4sIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3NlcyxcbiAgICAgIEVWRU5UX0JJTkRJTkdfU0NPUEVfR0xPQkFMUyk7XG4gIGNvbnN0IHN0YXRlbWVudHMgPSBbXTtcbiAgY29uc3QgdmFyaWFibGVEZWNsYXJhdGlvbnMgPSBzY29wZT8udmFyaWFibGVEZWNsYXJhdGlvbnMoKTtcbiAgY29uc3QgcmVzdG9yZVZpZXdTdGF0ZW1lbnQgPSBzY29wZT8ucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTtcblxuICBpZiAodmFyaWFibGVEZWNsYXJhdGlvbnMpIHtcbiAgICAvLyBgdmFyaWFibGVEZWNsYXJhdGlvbnNgIG5lZWRzIHRvIHJ1biBmaXJzdCwgYmVjYXVzZVxuICAgIC8vIGByZXN0b3JlVmlld1N0YXRlbWVudGAgZGVwZW5kcyBvbiB0aGUgcmVzdWx0LlxuICAgIHN0YXRlbWVudHMucHVzaCguLi52YXJpYWJsZURlY2xhcmF0aW9ucyk7XG4gIH1cblxuICBzdGF0ZW1lbnRzLnB1c2goLi4uYmluZGluZ1N0YXRlbWVudHMpO1xuXG4gIGlmIChyZXN0b3JlVmlld1N0YXRlbWVudCkge1xuICAgIHN0YXRlbWVudHMudW5zaGlmdChyZXN0b3JlVmlld1N0YXRlbWVudCk7XG5cbiAgICAvLyBJZiB0aGVyZSdzIGEgYHJlc3RvcmVWaWV3YCBjYWxsLCB3ZSBuZWVkIHRvIHJlc2V0IHRoZSB2aWV3IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RlbmVyXG4gICAgLy8gaW4gb3JkZXIgdG8gYXZvaWQgYSBsZWFrLiBJZiB0aGVyZSdzIGEgYHJldHVybmAgc3RhdGVtZW50IGFscmVhZHksIHdlIHdyYXAgaXQgaW4gdGhlXG4gICAgLy8gY2FsbCwgZS5nLiBgcmV0dXJuIHJlc2V0VmlldyhjdHguZm9vKCkpYC4gT3RoZXJ3aXNlIHdlIGFkZCB0aGUgY2FsbCBhcyB0aGUgbGFzdCBzdGF0ZW1lbnQuXG4gICAgY29uc3QgbGFzdFN0YXRlbWVudCA9IHN0YXRlbWVudHNbc3RhdGVtZW50cy5sZW5ndGggLSAxXTtcbiAgICBpZiAobGFzdFN0YXRlbWVudCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgICBzdGF0ZW1lbnRzW3N0YXRlbWVudHMubGVuZ3RoIC0gMV0gPSBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoXG4gICAgICAgICAgaW52b2tlSW5zdHJ1Y3Rpb24obGFzdFN0YXRlbWVudC52YWx1ZS5zb3VyY2VTcGFuLCBSMy5yZXNldFZpZXcsIFtsYXN0U3RhdGVtZW50LnZhbHVlXSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5yZXNldFZpZXcsIFtdKSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID1cbiAgICAgIHR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWUsIHBoYXNlISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3M6IG8uRm5QYXJhbVtdID0gW107XG5cbiAgaWYgKGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcy5oYXMoZXZlbnRBcmd1bWVudE5hbWUpKSB7XG4gICAgZm5BcmdzLnB1c2gobmV3IG8uRm5QYXJhbShldmVudEFyZ3VtZW50TmFtZSwgby5EWU5BTUlDX1RZUEUpKTtcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZXJGbiA9IG8uZm4oZm5BcmdzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZuTmFtZSk7XG4gIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGV2ZW50TmFtZSksIGhhbmRsZXJGbl07XG4gIGlmICh0YXJnZXQpIHtcbiAgICBwYXJhbXMucHVzaChcbiAgICAgICAgby5saXRlcmFsKGZhbHNlKSwgIC8vIGB1c2VDYXB0dXJlYCBmbGFnLCBkZWZhdWx0cyB0byBgZmFsc2VgXG4gICAgICAgIG8uaW1wb3J0RXhwcihHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5nZXQodGFyZ2V0KSEpKTtcbiAgfVxuICByZXR1cm4gcGFyYW1zO1xufVxuXG4vLyBDb2xsZWN0cyBpbmZvcm1hdGlvbiBuZWVkZWQgdG8gZ2VuZXJhdGUgYGNvbnN0c2AgZmllbGQgb2YgdGhlIENvbXBvbmVudERlZi5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgLyoqXG4gICAqIFdoZW4gYSBjb25zdGFudCByZXF1aXJlcyBzb21lIHByZS1wcm9jZXNzaW5nIChlLmcuIGkxOG4gdHJhbnNsYXRpb24gYmxvY2sgdGhhdCBpbmNsdWRlc1xuICAgKiBnb29nLmdldE1zZyBhbmQgJGxvY2FsaXplIGNhbGxzKSwgdGhlIGBwcmVwYXJlU3RhdGVtZW50c2Agc2VjdGlvbiBjb250YWlucyBjb3JyZXNwb25kaW5nXG4gICAqIHN0YXRlbWVudHMuXG4gICAqL1xuICBwcmVwYXJlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcblxuICAvKipcbiAgICogQWN0dWFsIGV4cHJlc3Npb25zIHRoYXQgcmVwcmVzZW50IGNvbnN0YW50cy5cbiAgICovXG4gIGNvbnN0RXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdO1xuXG4gIC8qKlxuICAgKiBDYWNoZSB0byBhdm9pZCBnZW5lcmF0aW5nIGR1cGxpY2F0ZWQgaTE4biB0cmFuc2xhdGlvbiBibG9ja3MuXG4gICAqL1xuICBpMThuVmFyUmVmc0NhY2hlOiBNYXA8aTE4bi5JMThuTWV0YSwgby5SZWFkVmFyRXhwcj47XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudERlZkNvbnN0cygpOiBDb21wb25lbnREZWZDb25zdHMge1xuICByZXR1cm4ge1xuICAgIHByZXBhcmVTdGF0ZW1lbnRzOiBbXSxcbiAgICBjb25zdEV4cHJlc3Npb25zOiBbXSxcbiAgICBpMThuVmFyUmVmc0NhY2hlOiBuZXcgTWFwKCksXG4gIH07XG59XG5cbmNsYXNzIFRlbXBsYXRlRGF0YSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgbmFtZTogc3RyaW5nLCByZWFkb25seSBpbmRleDogbnVtYmVyLCByZWFkb25seSBzY29wZTogQmluZGluZ1Njb3BlLFxuICAgICAgcHJpdmF0ZSB2aXNpdG9yOiBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7fVxuXG4gIGdldENvbnN0Q291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRvci5nZXRDb25zdENvdW50KCk7XG4gIH1cblxuICBnZXRWYXJDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdG9yLmdldFZhckNvdW50KCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaW1wbGVtZW50cyB0LlZpc2l0b3I8dm9pZD4sIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIF9kYXRhSW5kZXggPSAwO1xuICBwcml2YXRlIF9iaW5kaW5nQ29udGV4dCA9IDA7XG4gIHByaXZhdGUgX3ByZWZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgaW4gbGlzdGVuZXJzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgKiBUaGlzIGVuc3VyZXMgYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRpb25Db2RlRm5zOiBJbnN0cnVjdGlvbltdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6IEluc3RydWN0aW9uW10gPSBbXTtcblxuICAvKiogSW5kZXggb2YgdGhlIGN1cnJlbnRseS1zZWxlY3RlZCBub2RlLiAqL1xuICBwcml2YXRlIF9jdXJyZW50SW5kZXg6IG51bWJlciA9IDA7XG5cbiAgLyoqIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZ2VuZXJhdGVkIGZyb20gdmlzaXRpbmcgcGlwZXMsIGxpdGVyYWxzLCBldGMuICovXG4gIHByaXZhdGUgX3RlbXBWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICAvKipcbiAgICogVGVtcG9yYXJ5IHZhcmlhYmxlIHVzZWQgdG8gc3RvcmUgc3RhdGUgYmV0d2VlbiBjb250cm9sIGZsb3cgaW5zdHJ1Y3Rpb25zLlxuICAgKiBTaG91bGQgYmUgYWNjZXNzZWQgdmlhIHRoZSBgYWxsb2NhdGVDb250cm9sRmxvd1RlbXBWYXJpYWJsZWAgbWV0aG9kLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29udHJvbEZsb3dUZW1wVmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGJ1aWxkIG5lc3RlZCB0ZW1wbGF0ZXMuIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbFxuICAgKiBhZnRlciB0aGUgcGFyZW50IHRlbXBsYXRlIGhhcyBmaW5pc2hlZCB2aXNpdGluZyBhbGwgb2YgaXRzIG5vZGVzLiBUaGlzIGVuc3VyZXMgdGhhdCBhbGxcbiAgICogbG9jYWwgcmVmIGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgYXJlIGFibGUgdG8gZmluZCBsb2NhbCByZWYgdmFsdWVzIGlmIHRoZSByZWZzXG4gICAqIGFyZSBkZWZpbmVkIGFmdGVyIHRoZSB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgX25lc3RlZFRlbXBsYXRlRm5zOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAvKipcbiAgICogVGhpcyBzY29wZSBjb250YWlucyBsb2NhbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHVwZGF0ZSBtb2RlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICogKGUuZy4gcmVmcyBhbmQgY29udGV4dCB2YXJzIGluIGJpbmRpbmdzKVxuICAgKi9cbiAgcHJpdmF0ZSBfYmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGU7XG4gIHByaXZhdGUgX3ZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcblxuICAvLyBpMThuIGNvbnRleHQgbG9jYWwgdG8gdGhpcyB0ZW1wbGF0ZVxuICBwcml2YXRlIGkxOG46IEkxOG5Db250ZXh0fG51bGwgPSBudWxsO1xuXG4gIC8vIE51bWJlciBvZiBzbG90cyB0byByZXNlcnZlIGZvciBwdXJlRnVuY3Rpb25zXG4gIHByaXZhdGUgX3B1cmVGdW5jdGlvblNsb3RzID0gMDtcblxuICAvLyBOdW1iZXIgb2YgYmluZGluZyBzbG90c1xuICBwcml2YXRlIF9iaW5kaW5nU2xvdHMgPSAwO1xuXG4gIHByaXZhdGUgZmlsZUJhc2VkSTE4blN1ZmZpeDogc3RyaW5nO1xuXG4gIC8vIFByb2plY3Rpb24gc2xvdHMgZm91bmQgaW4gdGhlIHRlbXBsYXRlLiBQcm9qZWN0aW9uIHNsb3RzIGNhbiBkaXN0cmlidXRlIHByb2plY3RlZFxuICAvLyBub2RlcyBiYXNlZCBvbiBhIHNlbGVjdG9yLCBvciBjYW4ganVzdCB1c2UgdGhlIHdpbGRjYXJkIHNlbGVjdG9yIHRvIG1hdGNoXG4gIC8vIGFsbCBub2RlcyB3aGljaCBhcmVuJ3QgbWF0Y2hpbmcgYW55IHNlbGVjdG9yLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzOiAoc3RyaW5nfCcqJylbXSA9IFtdO1xuXG4gIC8vIE51bWJlciBvZiBub24tZGVmYXVsdCBzZWxlY3RvcnMgZm91bmQgaW4gYWxsIHBhcmVudCB0ZW1wbGF0ZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gV2UgbmVlZCB0b1xuICAvLyB0cmFjayBpdCB0byBwcm9wZXJseSBhZGp1c3QgcHJvamVjdGlvbiBzbG90IGluZGV4IGluIHRoZSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb24uXG4gIHByaXZhdGUgX25nQ29udGVudFNlbGVjdG9yc09mZnNldCA9IDA7XG5cbiAgLy8gRXhwcmVzc2lvbiB0aGF0IHNob3VsZCBiZSB1c2VkIGFzIGltcGxpY2l0IHJlY2VpdmVyIHdoZW4gY29udmVydGluZyB0ZW1wbGF0ZVxuICAvLyBleHByZXNzaW9ucyB0byBvdXRwdXQgQVNULlxuICBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyRXhwcjogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCxcbiAgICAgIHByaXZhdGUgY29udGV4dE5hbWU6IHN0cmluZ3xudWxsLCBwcml2YXRlIGkxOG5Db250ZXh0OiBJMThuQ29udGV4dHxudWxsLFxuICAgICAgcHJpdmF0ZSB0ZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgcHJpdmF0ZSB0ZW1wbGF0ZU5hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHJpdmF0ZSBfbmFtZXNwYWNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLFxuICAgICAgcHJpdmF0ZSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGRlZmVyQmxvY2tzOiBNYXA8dC5EZWZlcnJlZEJsb2NrLCBSM0RlZmVyQmxvY2tNZXRhZGF0YT4sXG4gICAgICBwcml2YXRlIGVsZW1lbnRMb2NhdGlvbnM6IE1hcDx0LkVsZW1lbnQsIHtpbmRleDogbnVtYmVyLCBsZXZlbDogbnVtYmVyfT4sXG4gICAgICBwcml2YXRlIF9jb25zdGFudHM6IENvbXBvbmVudERlZkNvbnN0cyA9IGNyZWF0ZUNvbXBvbmVudERlZkNvbnN0cygpKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQodGhpcy5sZXZlbCwgbG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnBpcGUsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChuYW1lKV0pO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIG5nQ29udGVudFNlbGVjdG9yc09mZnNldDogbnVtYmVyID0gMCxcbiAgICAgIGkxOG4/OiBpMThuLkkxOG5NZXRhLCB2YXJpYWJsZUFsaWFzZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogby5GdW5jdGlvbkV4cHIge1xuICAgIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCA9IG5nQ29udGVudFNlbGVjdG9yc09mZnNldDtcblxuICAgIGlmICh0aGlzLl9uYW1lc3BhY2UgIT09IFIzLm5hbWVzcGFjZUhUTUwpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCB0aGlzLl9uYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIHZhcmlhYmxlcy5mb3JFYWNoKHYgPT4ge1xuICAgICAgY29uc3QgYWxpYXMgPSB2YXJpYWJsZUFsaWFzZXM/Llt2Lm5hbWVdO1xuICAgICAgdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXModi5uYW1lLCB2LnZhbHVlKTtcbiAgICAgIGlmIChhbGlhcykge1xuICAgICAgICB0aGlzLnJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyhhbGlhcywgdi52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWF0ZSBpMThuIGNvbnRleHQgaW4gY2FzZTpcbiAgICAvLyAtIHRoaXMgdGVtcGxhdGUgaGFzIHBhcmVudCBpMThuIGNvbnRleHRcbiAgICAvLyAtIG9yIHRoZSB0ZW1wbGF0ZSBoYXMgaTE4biBtZXRhIGFzc29jaWF0ZWQgd2l0aCBpdCxcbiAgICAvLyAgIGJ1dCBpdCdzIG5vdCBpbml0aWF0ZWQgYnkgdGhlIEVsZW1lbnQgKGUuZy4gPG5nLXRlbXBsYXRlIGkxOG4+KVxuICAgIGNvbnN0IGluaXRJMThuQ29udGV4dCA9IHRoaXMuaTE4bkNvbnRleHQgfHxcbiAgICAgICAgKGlzSTE4blJvb3ROb2RlKGkxOG4pICYmICFpc1NpbmdsZUkxOG5JY3UoaTE4bikgJiZcbiAgICAgICAgICEoaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUobm9kZXMpICYmIG5vZGVzWzBdLmkxOG4gPT09IGkxOG4pKTtcbiAgICBjb25zdCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9IGhhc1RleHRDaGlsZHJlbk9ubHkobm9kZXMpO1xuICAgIGlmIChpbml0STE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGkxOG4hLCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyB0aGUgaW5pdGlhbCBwYXNzIHRocm91Z2ggdGhlIG5vZGVzIG9mIHRoaXMgdGVtcGxhdGUuIEluIHRoaXMgcGFzcywgd2VcbiAgICAvLyBxdWV1ZSBhbGwgY3JlYXRpb24gbW9kZSBhbmQgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIGZvciBnZW5lcmF0aW9uIGluIHRoZSBzZWNvbmRcbiAgICAvLyBwYXNzLiBJdCdzIG5lY2Vzc2FyeSB0byBzZXBhcmF0ZSB0aGUgcGFzc2VzIHRvIGVuc3VyZSBsb2NhbCByZWZzIGFyZSBkZWZpbmVkIGJlZm9yZVxuICAgIC8vIHJlc29sdmluZyBiaW5kaW5ncy4gV2UgYWxzbyBjb3VudCBiaW5kaW5ncyBpbiB0aGlzIHBhc3MgYXMgd2Ugd2FsayBib3VuZCBleHByZXNzaW9ucy5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIC8vIEFkZCB0b3RhbCBiaW5kaW5nIGNvdW50IHRvIHB1cmUgZnVuY3Rpb24gY291bnQgc28gcHVyZSBmdW5jdGlvbiBpbnN0cnVjdGlvbnMgYXJlXG4gICAgLy8gZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3Qgc2xvdCBvZmZzZXQgd2hlbiB1cGRhdGUgaW5zdHJ1Y3Rpb25zIGFyZSBwcm9jZXNzZWQuXG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gdGhpcy5fYmluZGluZ1Nsb3RzO1xuXG4gICAgLy8gUGlwZXMgYXJlIHdhbGtlZCBpbiB0aGUgZmlyc3QgcGFzcyAodG8gZW5xdWV1ZSBgcGlwZSgpYCBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYW5kXG4gICAgLy8gYHBpcGVCaW5kYCB1cGRhdGUgaW5zdHJ1Y3Rpb25zKSwgc28gd2UgaGF2ZSB0byB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0cyBtYW51YWxseVxuICAgIC8vIHRvIGFjY291bnQgZm9yIGJpbmRpbmdzLlxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyLnVwZGF0ZVBpcGVTbG90T2Zmc2V0cyh0aGlzLl9iaW5kaW5nU2xvdHMpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IGJlIHByb2Nlc3NlZCBiZWZvcmUgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIHNvIHRlbXBsYXRlKClcbiAgICAvLyBpbnN0cnVjdGlvbnMgY2FuIGJlIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IGludGVybmFsIGNvbnN0IGNvdW50LlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLmZvckVhY2goYnVpbGRUZW1wbGF0ZUZuID0+IGJ1aWxkVGVtcGxhdGVGbigpKTtcblxuICAgIC8vIE91dHB1dCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCB0YWdzIGFyZSBwcmVzZW50LlxuICAgIC8vIFRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gaXMgb25seSBlbWl0dGVkIGZvciB0aGUgY29tcG9uZW50IHRlbXBsYXRlIGFuZFxuICAgIC8vIGlzIHNraXBwZWQgZm9yIG5lc3RlZCB0ZW1wbGF0ZXMgKDxuZy10ZW1wbGF0ZT4gdGFncykuXG4gICAgaWYgKHRoaXMubGV2ZWwgPT09IDAgJiYgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgIC8vIEJ5IGRlZmF1bHQgdGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbnMgY3JlYXRlcyBvbmUgc2xvdCBmb3IgdGhlIHdpbGRjYXJkXG4gICAgICAvLyBzZWxlY3RvciBpZiBubyBwYXJhbWV0ZXJzIGFyZSBwYXNzZWQuIFRoZXJlZm9yZSB3ZSBvbmx5IHdhbnQgdG8gYWxsb2NhdGUgYSBuZXdcbiAgICAgIC8vIGFycmF5IGZvciB0aGUgcHJvamVjdGlvbiBzbG90cyBpZiB0aGUgZGVmYXVsdCBwcm9qZWN0aW9uIHNsb3QgaXMgbm90IHN1ZmZpY2llbnQuXG4gICAgICBpZiAodGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggPiAxIHx8IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHNbMF0gIT09ICcqJykge1xuICAgICAgICBjb25zdCByM1Jlc2VydmVkU2xvdHMgPSB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLm1hcChcbiAgICAgICAgICAgIHMgPT4gcyAhPT0gJyonID8gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpIDogcyk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHIzUmVzZXJ2ZWRTbG90cyksIHRydWUpKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2luY2Ugd2UgYWNjdW11bGF0ZSBuZ0NvbnRlbnQgc2VsZWN0b3JzIHdoaWxlIHByb2Nlc3NpbmcgdGVtcGxhdGUgZWxlbWVudHMsXG4gICAgICAvLyB3ZSAqcHJlcGVuZCogYHByb2plY3Rpb25EZWZgIHRvIGNyZWF0aW9uIGluc3RydWN0aW9ucyBibG9jaywgdG8gcHV0IGl0IGJlZm9yZVxuICAgICAgLy8gYW55IGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbnNcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5wcm9qZWN0aW9uRGVmLCBwYXJhbWV0ZXJzLCAvKiBwcmVwZW5kICovIHRydWUpO1xuICAgIH1cblxuICAgIGlmIChpbml0STE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4bkVuZChudWxsLCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIGJpbmRpbmdzIGluIGxpc3RlbmVycylcbiAgICBjb25zdCBjcmVhdGlvblN0YXRlbWVudHMgPSBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHModGhpcy5fY3JlYXRpb25Db2RlRm5zKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKHRoaXMuX3VwZGF0ZUNvZGVGbnMpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIG1heWJlUmVzdG9yZVZpZXcoKTogdm9pZCB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCB0aGlzLmkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpO1xuICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXIgY29uc3QgdG9cbiAgICAvLyBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgIGNvbnN0IGNsb3N1cmVWYXIgPSB0aGlzLmkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZS5pZCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzKG1lc3NhZ2UsIF9yZWYsIGNsb3N1cmVWYXIsIHBhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgIHRoaXMuX2NvbnN0YW50cy5wcmVwYXJlU3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbnRleHRWYXJpYWJsZXMobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgaXNEaXJlY3QgPSB2YWx1ZSA9PT0gRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFO1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUobmFtZSArIHNjb3BlZE5hbWUpO1xuXG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIG5hbWUsXG4gICAgICAgIHNjb3BlID0+IHtcbiAgICAgICAgICAvLyBJZiB3ZSdyZSBhdCB0aGUgdG9wIGxldmVsIGFuZCB3ZSdyZSByZWZlcnJpbmcgdG8gdGhlIGNvbnRleHQgdmFyaWFibGUgZGlyZWN0bHksIHdlXG4gICAgICAgICAgLy8gY2FuIGRvIHNvIHRocm91Z2ggdGhlIGltcGxpY2l0IHJlY2VpdmVyLCBpbnN0ZWFkIG9mIHJlbmFtaW5nIGl0LiBOb3RlIHRoYXQgdGhpcyBkb2VzXG4gICAgICAgICAgLy8gbm90IGFwcGx5IHRvIGxpc3RlbmVycywgYmVjYXVzZSB0aGV5IG5lZWQgdG8gcmVzdG9yZSB0aGUgY29udGV4dC5cbiAgICAgICAgICByZXR1cm4gaXNEaXJlY3QgJiYgc2NvcGUuYmluZGluZ0xldmVsID09PSByZXRyaWV2YWxMZXZlbCAmJiAhc2NvcGUuaXNMaXN0ZW5lclNjb3BlKCkgP1xuICAgICAgICAgICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgICAgICAgICBsaHM7XG4gICAgICAgIH0sXG4gICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCxcbiAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGxldCByaHM6IG8uRXhwcmVzc2lvbjtcblxuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICBpZiAoc2NvcGUuaXNMaXN0ZW5lclNjb3BlKCkgJiYgc2NvcGUuaGFzUmVzdG9yZVZpZXdWYXJpYWJsZSgpKSB7XG4gICAgICAgICAgICAgIC8vIGUuZy4gcmVzdG9yZWRDdHguXG4gICAgICAgICAgICAgIC8vIFdlIGhhdmUgdG8gZ2V0IHRoZSBjb250ZXh0IGZyb20gYSB2aWV3IHJlZmVyZW5jZSwgaWYgb25lIGlzIGF2YWlsYWJsZSwgYmVjYXVzZVxuICAgICAgICAgICAgICAvLyB0aGUgY29udGV4dCB0aGF0IHdhcyBwYXNzZWQgaW4gZHVyaW5nIGNyZWF0aW9uIG1heSBub3QgYmUgY29ycmVjdCBhbnltb3JlLlxuICAgICAgICAgICAgICAvLyBGb3IgbW9yZSBpbmZvcm1hdGlvbiBzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvcHVsbC80MDM2MC5cbiAgICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgICAgIHNjb3BlLm5vdGlmeVJlc3RvcmVkVmlld0NvbnRleHRVc2UoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNEaXJlY3QpIHtcbiAgICAgICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGRpcmVjdCByZWFkIG9mIHRoZSBjb250ZXh0IGF0IHRoZSB0b3AgbGV2ZWwgd2UgZG9uJ3QgbmVlZCB0b1xuICAgICAgICAgICAgICAvLyBkZWNsYXJlIGFueSB2YXJpYWJsZXMgYW5kIHdlIGNhbiByZWZlciB0byBpdCBkaXJlY3RseS5cbiAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gZS5nLiBjdHhcbiAgICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW1zJCA9IHgoMikgZm9yIGRpcmVjdCBjb250ZXh0IHJlZmVyZW5jZXMgYW5kXG4gICAgICAgICAgICAvLyBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdCBmb3IgaW5kaXJlY3Qgb25lcy5cbiAgICAgICAgICAgIGxocy5zZXQoaXNEaXJlY3QgPyByaHMgOiByaHMucHJvcCh2YWx1ZSB8fCBJTVBMSUNJVF9SRUZFUkVOQ0UpKS50b0NvbnN0RGVjbCgpXG4gICAgICAgICAgXTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9uczogQVNUW10pIHtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHRoaXMuaTE4biEuYXBwZW5kQmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpMThuQmluZFByb3BzKHByb3BzOiB7W2tleTogc3RyaW5nXTogdC5UZXh0fHQuQm91bmRUZXh0fSk6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259IHtcbiAgICBjb25zdCBib3VuZDoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IHByb3BzW2tleV07XG4gICAgICBpZiAocHJvcCBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKHByb3AudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnN9ID0gdmFsdWU7XG4gICAgICAgICAgY29uc3Qge2lkLCBiaW5kaW5nc30gPSB0aGlzLmkxOG4hO1xuICAgICAgICAgIGNvbnN0IGxhYmVsID0gYXNzZW1ibGVJMThuQm91bmRTdHJpbmcoc3RyaW5ncywgYmluZGluZ3Muc2l6ZSwgaWQpO1xuICAgICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zKTtcbiAgICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlcyB0b3AgbGV2ZWwgdmFycyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYGkxOG5fTmApLlxuICBwcml2YXRlIGkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpOiBvLlJlYWRWYXJFeHByIHtcbiAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlcyB2YXJzIHdpdGggQ2xvc3VyZS1zcGVjaWZpYyBuYW1lcyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYE1TR19YWFhgKS5cbiAgcHJpdmF0ZSBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKG1lc3NhZ2VJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMpIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgICAgY29uc3QgdW5pcXVlU3VmZml4ID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgICAgbmFtZSA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5VcGRhdGVSZWYoY29udGV4dDogSTE4bkNvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCB7aWN1cywgbWV0YSwgaXNSb290LCBpc1Jlc29sdmVkLCBpc0VtaXR0ZWR9ID0gY29udGV4dDtcbiAgICBpZiAoaXNSb290ICYmIGlzUmVzb2x2ZWQgJiYgIWlzRW1pdHRlZCAmJiAhaXNTaW5nbGVJMThuSWN1KG1ldGEpKSB7XG4gICAgICBjb250ZXh0LmlzRW1pdHRlZCA9IHRydWU7XG4gICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBjb250ZXh0LmdldFNlcmlhbGl6ZWRQbGFjZWhvbGRlcnMoKTtcbiAgICAgIGxldCBpY3VNYXBwaW5nOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICAgIGxldCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9XG4gICAgICAgICAgcGxhY2Vob2xkZXJzLnNpemUgPyBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnMpIDoge307XG4gICAgICBpZiAoaWN1cy5zaXplKSB7XG4gICAgICAgIGljdXMuZm9yRWFjaCgocmVmczogby5FeHByZXNzaW9uW10sIGtleTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgaWYgKHJlZnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIG9uZSBJQ1UgZGVmaW5lZCBmb3IgYSBnaXZlblxuICAgICAgICAgICAgLy8gcGxhY2Vob2xkZXIgLSBqdXN0IG91dHB1dCBpdHMgcmVmZXJlbmNlXG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IHJlZnNbMF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIC4uLiBvdGhlcndpc2Ugd2UgbmVlZCB0byBhY3RpdmF0ZSBwb3N0LXByb2Nlc3NpbmdcbiAgICAgICAgICAgIC8vIHRvIHJlcGxhY2UgSUNVIHBsYWNlaG9sZGVycyB3aXRoIHByb3BlciB2YWx1ZXNcbiAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyOiBzdHJpbmcgPSB3cmFwSTE4blBsYWNlaG9sZGVyKGAke0kxOE5fSUNVX01BUFBJTkdfUFJFRklYfSR7a2V5fWApO1xuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSBvLmxpdGVyYWwocGxhY2Vob2xkZXIpO1xuICAgICAgICAgICAgaWN1TWFwcGluZ1trZXldID0gby5saXRlcmFsQXJyKHJlZnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIHRyYW5zbGF0aW9uIHJlcXVpcmVzIHBvc3QgcHJvY2Vzc2luZyBpbiAyIGNhc2VzOlxuICAgICAgLy8gLSBpZiB3ZSBoYXZlIHBsYWNlaG9sZGVycyB3aXRoIG11bHRpcGxlIHZhbHVlcyAoZXguIGBTVEFSVF9ESVZgOiBb77+9IzHvv70sIO+/vSMy77+9LCAuLi5dKVxuICAgICAgLy8gLSBpZiB3ZSBoYXZlIG11bHRpcGxlIElDVXMgdGhhdCByZWZlciB0byB0aGUgc2FtZSBwbGFjZWhvbGRlciBuYW1lXG4gICAgICBjb25zdCBuZWVkc1Bvc3Rwcm9jZXNzaW5nID1cbiAgICAgICAgICBBcnJheS5mcm9tKHBsYWNlaG9sZGVycy52YWx1ZXMoKSkuc29tZSgodmFsdWU6IHN0cmluZ1tdKSA9PiB2YWx1ZS5sZW5ndGggPiAxKSB8fFxuICAgICAgICAgIE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aDtcblxuICAgICAgbGV0IHRyYW5zZm9ybUZuO1xuICAgICAgaWYgKG5lZWRzUG9zdHByb2Nlc3NpbmcpIHtcbiAgICAgICAgdHJhbnNmb3JtRm4gPSAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbcmF3XTtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoKSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobWFwTGl0ZXJhbChpY3VNYXBwaW5nLCB0cnVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5pMThuUG9zdHByb2Nlc3MsIGFyZ3MpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1ldGEgYXMgaTE4bi5NZXNzYWdlLCBwYXJhbXMsIGNvbnRleHQucmVmLCB0cmFuc2Zvcm1Gbik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpMThuU3RhcnQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBtZXRhOiBpMThuLkkxOG5NZXRhLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOlxuICAgICAgdm9pZCB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICB0aGlzLmkxOG4gPSB0aGlzLmkxOG5Db250ZXh0ID9cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dC5mb3JrQ2hpbGRDb250ZXh0KGluZGV4LCB0aGlzLnRlbXBsYXRlSW5kZXghLCBtZXRhKSA6XG4gICAgICAgIG5ldyBJMThuQ29udGV4dChpbmRleCwgdGhpcy5pMThuR2VuZXJhdGVNYWluQmxvY2tWYXIoKSwgMCwgdGhpcy50ZW1wbGF0ZUluZGV4LCBtZXRhKTtcblxuICAgIC8vIGdlbmVyYXRlIGkxOG5TdGFydCBpbnN0cnVjdGlvblxuICAgIGNvbnN0IHtpZCwgcmVmfSA9IHRoaXMuaTE4bjtcbiAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChpbmRleCksIHRoaXMuYWRkVG9Db25zdHMocmVmKV07XG4gICAgaWYgKGlkID4gMCkge1xuICAgICAgLy8gZG8gbm90IHB1c2ggM3JkIGFyZ3VtZW50IChzdWItYmxvY2sgaWQpXG4gICAgICAvLyBpbnRvIGkxOG5TdGFydCBjYWxsIGZvciB0b3AgbGV2ZWwgaTE4biBjb250ZXh0XG4gICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaWQpKTtcbiAgICB9XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIHNlbGZDbG9zaW5nID8gUjMuaTE4biA6IFIzLmkxOG5TdGFydCwgcGFyYW1zKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkVuZChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2kxOG5FbmQgaXMgZXhlY3V0ZWQgd2l0aCBubyBpMThuIGNvbnRleHQgcHJlc2VudCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5Db250ZXh0LnJlY29uY2lsZUNoaWxkQ29udGV4dCh0aGlzLmkxOG4pO1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bkNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuKTtcbiAgICB9XG5cbiAgICAvLyBzZXR1cCBhY2N1bXVsYXRlZCBiaW5kaW5nc1xuICAgIGNvbnN0IHtpbmRleCwgYmluZGluZ3N9ID0gdGhpcy5pMThuO1xuICAgIGlmIChiaW5kaW5ncy5zaXplKSB7XG4gICAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYmluZGluZ3MpIHtcbiAgICAgICAgLy8gZm9yIGkxOG4gYmxvY2ssIGFkdmFuY2UgdG8gdGhlIG1vc3QgcmVjZW50IGVsZW1lbnQgaW5kZXggKGJ5IHRha2luZyB0aGUgY3VycmVudCBudW1iZXIgb2ZcbiAgICAgICAgLy8gZWxlbWVudHMgYW5kIHN1YnRyYWN0aW5nIG9uZSkgYmVmb3JlIGludm9raW5nIGBpMThuRXhwYCBpbnN0cnVjdGlvbnMsIHRvIG1ha2Ugc3VyZSB0aGVcbiAgICAgICAgLy8gbmVjZXNzYXJ5IGxpZmVjeWNsZSBob29rcyBvZiBjb21wb25lbnRzL2RpcmVjdGl2ZXMgYXJlIHByb3Blcmx5IGZsdXNoZWQuXG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICAgIHRoaXMuZ2V0Q29uc3RDb3VudCgpIC0gMSwgc3BhbiwgUjMuaTE4bkV4cCwgKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJpbmRpbmcpKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzcGFuLCBSMy5pMThuQXBwbHksIFtvLmxpdGVyYWwoaW5kZXgpXSk7XG4gICAgfVxuICAgIGlmICghc2VsZkNsb3NpbmcpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5pMThuRW5kKTtcbiAgICB9XG4gICAgdGhpcy5pMThuID0gbnVsbDsgIC8vIHJlc2V0IGxvY2FsIGkxOG4gY29udGV4dFxuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIGF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHZvaWQge1xuICAgIGxldCBoYXNCaW5kaW5ncyA9IGZhbHNlO1xuICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGF0dHIuaTE4biEgYXMgaTE4bi5NZXNzYWdlO1xuICAgICAgY29uc3QgY29udmVydGVkID0gYXR0ci52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKGNvbnZlcnRlZCk7XG4gICAgICBpZiAoY29udmVydGVkIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgcGFyYW1zID0gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKTtcbiAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwYXJhbXMpKTtcbiAgICAgICAgY29udmVydGVkLmV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICAgICAgaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICAgICAgbm9kZUluZGV4LCBzb3VyY2VTcGFuLCBSMy5pMThuRXhwLCAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoaTE4bkF0dHJBcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGluZGV4OiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpO1xuICAgICAgY29uc3QgY29uc3RJbmRleCA9IHRoaXMuYWRkVG9Db25zdHMoby5saXRlcmFsQXJyKGkxOG5BdHRyQXJncykpO1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLmkxOG5BdHRyaWJ1dGVzLCBbaW5kZXgsIGNvbnN0SW5kZXhdKTtcbiAgICAgIGlmIChoYXNCaW5kaW5ncykge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXk6IHN0cmluZ3xudWxsKSB7XG4gICAgc3dpdGNoIChuYW1lc3BhY2VLZXkpIHtcbiAgICAgIGNhc2UgJ21hdGgnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlTWF0aE1MO1xuICAgICAgY2FzZSAnc3ZnJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZVNWRztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VIVE1MO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzXG4gICAqIGBwcm9wPVwie3t2YWx1ZX19XCJgIG9yIGBhdHRyLnRpdGxlPVwie3t2YWx1ZX19XCJgXG4gICAqL1xuICBwcml2YXRlIGludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnRJbmRleDogbnVtYmVyLCBhdHRyTmFtZTogc3RyaW5nLFxuICAgICAgaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIHZhbHVlOiBJbnRlcnBvbGF0aW9uLCBwYXJhbXM6IGFueVtdKSB7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICBlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLFxuICAgICAgICAoKSA9PiBbby5saXRlcmFsKGF0dHJOYW1lKSwgLi4udGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSksIC4uLnBhcmFtc10pO1xuICB9XG5cbiAgdmlzaXRDb250ZW50KG5nQ29udGVudDogdC5Db250ZW50KSB7XG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHByb2plY3Rpb25TbG90SWR4ID0gdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ICsgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcblxuICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaChuZ0NvbnRlbnQuc2VsZWN0b3IpO1xuXG4gICAgY29uc3Qgbm9uQ29udGVudFNlbGVjdEF0dHJpYnV0ZXMgPVxuICAgICAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5maWx0ZXIoYXR0ciA9PiBhdHRyLm5hbWUudG9Mb3dlckNhc2UoKSAhPT0gTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUik7XG4gICAgY29uc3QgYXR0cmlidXRlcyA9XG4gICAgICAgIHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMobmdDb250ZW50Lm5hbWUsIG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzLCBbXSwgW10pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCksIG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSk7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0aW9uU2xvdElkeCAhPT0gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFByb2plY3Rpb24obmdDb250ZW50LmkxOG4hLCBzbG90KTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgc3R5bGluZ0J1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIobnVsbCk7XG4gICAgdGhpcy5lbGVtZW50TG9jYXRpb25zLnNldChlbGVtZW50LCB7aW5kZXg6IGVsZW1lbnRJbmRleCwgbGV2ZWw6IHRoaXMubGV2ZWx9KTtcblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50OiBib29sZWFuID1cbiAgICAgICAgaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGVsZW1lbnQuaTE4bik7XG5cbiAgICBjb25zdCBvdXRwdXRBdHRyczogdC5UZXh0QXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuICAgIGNvbnN0IGlzTmdDb250YWluZXIgPSBjaGVja0lzTmdDb250YWluZXIoZWxlbWVudC5uYW1lKTtcblxuICAgIC8vIEhhbmRsZSBzdHlsaW5nLCBpMThuLCBuZ05vbkJpbmRhYmxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cjtcbiAgICAgIGlmIChuYW1lID09PSBOT05fQklOREFCTEVfQVRUUikge1xuICAgICAgICBpc05vbkJpbmRhYmxlTW9kZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzLnB1c2goYXR0cik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGFsbE90aGVySW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBib3VuZEkxOG5BdHRyczogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIGJvdW5kSTE4bkF0dHJzLnB1c2goaW5wdXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgYXR0cmlidXRlcyBmb3IgZGlyZWN0aXZlIGFuZCBwcm9qZWN0aW9uIG1hdGNoaW5nIHB1cnBvc2VzXG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgICBlbGVtZW50Lm5hbWUsIG91dHB1dEF0dHJzLCBhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzLCBzdHlsaW5nQnVpbGRlciwgW10sXG4gICAgICAgIGJvdW5kSTE4bkF0dHJzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJpYnV0ZXMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPGRpdiAjZm9vICNiYXI9XCJiYXpcIj4pXG4gICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheShlbGVtZW50LnJlZmVyZW5jZXMpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcblxuICAgIGNvbnN0IHdhc0luTmFtZXNwYWNlID0gdGhpcy5fbmFtZXNwYWNlO1xuICAgIGNvbnN0IGN1cnJlbnROYW1lc3BhY2UgPSB0aGlzLmdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleSk7XG5cbiAgICAvLyBJZiB0aGUgbmFtZXNwYWNlIGlzIGNoYW5naW5nIG5vdywgaW5jbHVkZSBhbiBpbnN0cnVjdGlvbiB0byBjaGFuZ2UgaXRcbiAgICAvLyBkdXJpbmcgZWxlbWVudCBjcmVhdGlvbi5cbiAgICBpZiAoY3VycmVudE5hbWVzcGFjZSAhPT0gd2FzSW5OYW1lc3BhY2UpIHtcbiAgICAgIHRoaXMuYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24oY3VycmVudE5hbWVzcGFjZSwgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuISwgZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZG8gbm90IGFwcGVuZCB0ZXh0IG5vZGUgaW5zdHJ1Y3Rpb25zIGFuZCBJQ1VzIGluc2lkZSBpMThuIHNlY3Rpb24sXG4gICAgLy8gc28gd2UgZXhjbHVkZSB0aGVtIHdoaWxlIGNhbGN1bGF0aW5nIHdoZXRoZXIgY3VycmVudCBlbGVtZW50IGhhcyBjaGlsZHJlblxuICAgIGNvbnN0IGhhc0NoaWxkcmVuID0gKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pID8gIWhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwO1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiA9ICFzdHlsaW5nQnVpbGRlci5oYXNCaW5kaW5nc1dpdGhQaXBlcyAmJlxuICAgICAgICBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwICYmIGJvdW5kSTE4bkF0dHJzLmxlbmd0aCA9PT0gMCAmJiAhaGFzQ2hpbGRyZW47XG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyIDogUjMuZWxlbWVudCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIFIzLmRpc2FibGVCaW5kaW5ncyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChib3VuZEkxOG5BdHRycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMuaTE4bkF0dHJpYnV0ZXNJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIGVsZW1lbnRJbmRleCwgYm91bmRJMThuQXR0cnMsIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICAgIGlmIChlbGVtZW50Lm91dHB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKGNvbnN0IG91dHB1dEFzdCBvZiBlbGVtZW50Lm91dHB1dHMpIHtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoZWxlbWVudC5uYW1lLCBvdXRwdXRBc3QsIGVsZW1lbnRJbmRleCkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGU6IGl0J3MgaW1wb3J0YW50IHRvIGtlZXAgaTE4bi9pMThuU3RhcnQgaW5zdHJ1Y3Rpb25zIGFmdGVyIGkxOG5BdHRyaWJ1dGVzIGFuZFxuICAgICAgLy8gbGlzdGVuZXJzLCB0byBtYWtlIHN1cmUgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24gdGFyZ2V0cyBjdXJyZW50IGVsZW1lbnQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5TdGFydChlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5pMThuISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBzdHlsZVByb3BgLFxuICAgIC8vIGBzdHlsZU1hcGAsIGBjbGFzc01hcGAsIGBjbGFzc1Byb3BgXG4gICAgLy8gYXJlIGFsbCBnZW5lcmF0ZWQgYW5kIGFzc2lnbmVkIGluIHRoZSBjb2RlIGJlbG93LlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbnMgPSBzdHlsaW5nQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBjb25zdCBsaW1pdCA9IHN0eWxpbmdJbnN0cnVjdGlvbnMubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IHN0eWxpbmdJbnN0cnVjdGlvbnNbaV07XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdGhpcy5wcm9jZXNzU3R5bGluZ1VwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIHRoZSByZWFzb24gd2h5IGB1bmRlZmluZWRgIGlzIHVzZWQgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgdW5kZXJzdGFuZHMgdGhpcyBhcyBhXG4gICAgLy8gc3BlY2lhbCB2YWx1ZSB0byBzeW1ib2xpemUgdGhhdCB0aGVyZSBpcyBubyBSSFMgdG8gdGhpcyBiaW5kaW5nXG4gICAgLy8gVE9ETyAobWF0c2tvKTogcmV2aXNpdCB0aGlzIG9uY2UgRlctOTU5IGlzIGFwcHJvYWNoZWRcbiAgICBjb25zdCBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uID0gby5saXRlcmFsKHVuZGVmaW5lZCk7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogT21pdDxJbnN0cnVjdGlvbiwgJ3JlZmVyZW5jZSc+W10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVCaW5kaW5nczogT21pdDxJbnN0cnVjdGlvbiwgJ3JlZmVyZW5jZSc+W10gPSBbXTtcblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IGlucHV0VHlwZSA9IGlucHV0LnR5cGU7XG4gICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIGFuaW1hdGlvbiBiaW5kaW5ncyBjYW4gYmUgcHJlc2VudGVkIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgLy8gMS4gW0BiaW5kaW5nXT1cImZvb0V4cFwiXG4gICAgICAgIC8vIDIuIFtAYmluZGluZ109XCJ7dmFsdWU6Zm9vRXhwLCBwYXJhbXM6ey4uLn19XCJcbiAgICAgICAgLy8gMy4gW0BiaW5kaW5nXVxuICAgICAgICAvLyA0LiBAYmluZGluZ1xuICAgICAgICAvLyBBbGwgZm9ybWF0cyB3aWxsIGJlIHZhbGlkIGZvciB3aGVuIGEgc3ludGhldGljIGJpbmRpbmcgaXMgY3JlYXRlZC5cbiAgICAgICAgLy8gVGhlIHJlYXNvbmluZyBmb3IgdGhpcyBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciBzaG91bGQgZ2V0IGVhY2hcbiAgICAgICAgLy8gc3ludGhldGljIGJpbmRpbmcgdmFsdWUgaW4gdGhlIG9yZGVyIG9mIHRoZSBhcnJheSB0aGF0IHRoZXkgYXJlXG4gICAgICAgIC8vIGRlZmluZWQgaW4uLi5cbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIExpdGVyYWxQcmltaXRpdmUgPyAhIXZhbHVlLnZhbHVlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICBzcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgIHBhcmFtc09yRm46IGdldEJpbmRpbmdGdW5jdGlvblBhcmFtcyhcbiAgICAgICAgICAgICAgKCkgPT4gaGFzVmFsdWUgPyB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpIDogZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvbixcbiAgICAgICAgICAgICAgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShpbnB1dC5uYW1lKSlcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBtdXN0IHNraXAgYXR0cmlidXRlcyB3aXRoIGFzc29jaWF0ZWQgaTE4biBjb250ZXh0LCBzaW5jZSB0aGVzZSBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkXG4gICAgICAgIC8vIHNlcGFyYXRlbHkgYW5kIGNvcnJlc3BvbmRpbmcgYGkxOG5FeHBgIGFuZCBgaTE4bkFwcGx5YCBpbnN0cnVjdGlvbnMgd2lsbCBiZSBnZW5lcmF0ZWRcbiAgICAgICAgaWYgKGlucHV0LmkxOG4pIHJldHVybjtcblxuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3QgW2F0dHJOYW1lc3BhY2UsIGF0dHJOYW1lXSA9IHNwbGl0TnNOYW1lKGlucHV0Lm5hbWUpO1xuICAgICAgICAgIGNvbnN0IGlzQXR0cmlidXRlQmluZGluZyA9IGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlO1xuICAgICAgICAgIGxldCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQuc2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZUJpbmRpbmcpO1xuICAgICAgICAgIGlmICghc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0XG4gICAgICAgICAgICAvLyBvZiBhbiBhdHRyaWJ1dGUvcHJvcGVydHkgLSBjaGVjayB3aGV0aGVyIHRoaXMgYXR0cmlidXRlL3Byb3BlcnR5IGlzXG4gICAgICAgICAgICAvLyBvbmUgb2YgdGhlIHNlY3VyaXR5LXNlbnNpdGl2ZSA8aWZyYW1lPiBhdHRyaWJ1dGVzIChhbmQgdGhhdCB0aGUgY3VycmVudFxuICAgICAgICAgICAgLy8gZWxlbWVudCBpcyBhY3R1YWxseSBhbiA8aWZyYW1lPikuXG4gICAgICAgICAgICBpZiAoaXNJZnJhbWVFbGVtZW50KGVsZW1lbnQubmFtZSkgJiYgaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIoaW5wdXQubmFtZSkpIHtcbiAgICAgICAgICAgICAgc2FuaXRpemF0aW9uUmVmID0gby5pbXBvcnRFeHByKFIzLnZhbGlkYXRlSWZyYW1lQXR0cmlidXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0ck5hbWVzcGFjZSk7XG5cbiAgICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiB0aGVyZSB3YXNuJ3QgYSBzYW5pdGl6YXRpb24gcmVmLCB3ZSBuZWVkIHRvIGFkZFxuICAgICAgICAgICAgICAvLyBhbiBleHRyYSBwYXJhbSBzbyB0aGF0IHdlIGNhbiBwYXNzIGluIHRoZSBuYW1lc3BhY2UuXG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSwgbmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgdGhlIHByb3BlcnRpZXMgc28gdGhhdCB3ZSBjYW4gY2hhaW4gaW50byBhIHNpbmdsZSBmdW5jdGlvbiBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIHNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgcGFyYW1zT3JGbjogZ2V0QmluZGluZ0Z1bmN0aW9uUGFyYW1zKFxuICAgICAgICAgICAgICAgICAgICAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpLCBhdHRyTmFtZSwgcGFyYW1zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uICYmIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKHZhbHVlKSA+IDEpIHtcbiAgICAgICAgICAgICAgLy8gYXR0ci5uYW1lPVwidGV4dHt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBib3VuZFZhbHVlID0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnNbMF0gOiB2YWx1ZTtcbiAgICAgICAgICAgICAgLy8gW2F0dHIubmFtZV09XCJ2YWx1ZVwiIG9yIGF0dHIubmFtZT1cInt7dmFsdWV9fVwiXG4gICAgICAgICAgICAgIC8vIENvbGxlY3QgdGhlIGF0dHJpYnV0ZSBiaW5kaW5ncyBzbyB0aGF0IHRoZXkgY2FuIGJlIGNoYWluZWQgYXQgdGhlIGVuZC5cbiAgICAgICAgICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgc3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICBwYXJhbXNPckZuOiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhib3VuZFZhbHVlKSwgYXR0ck5hbWUsIHBhcmFtcylcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsYXNzIHByb3BcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIFIzLmNsYXNzUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwoYXR0ck5hbWUpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpLFxuICAgICAgICAgICAgICAgIC4uLnBhcmFtc1xuICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHByb3BlcnR5QmluZGluZyBvZiBwcm9wZXJ0eUJpbmRpbmdzKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgZWxlbWVudEluZGV4LCBwcm9wZXJ0eUJpbmRpbmcuc3BhbiwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZy5wYXJhbXNPckZuKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmcgb2YgYXR0cmlidXRlQmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBlbGVtZW50SW5kZXgsIGF0dHJpYnV0ZUJpbmRpbmcuc3BhbiwgUjMuYXR0cmlidXRlLCBhdHRyaWJ1dGVCaW5kaW5nLnBhcmFtc09yRm4pO1xuICAgIH1cblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biEsIGVsZW1lbnRJbmRleCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGNvbnN0IHNwYW4gPSBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuO1xuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4bkVuZChzcGFuLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmVuYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgIGNoaWxkcmVuOiB0Lk5vZGVbXSwgY29udGV4dE5hbWVTdWZmaXg6IHN0cmluZywgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10gPSBbXSxcbiAgICAgIGkxOG5NZXRhPzogaTE4bi5JMThuTWV0YSwgdmFyaWFibGVBbGlhc2VzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBpZiAodGhpcy5pMThuICYmIGkxOG5NZXRhKSB7XG4gICAgICBpZiAoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJsb2NrKGkxOG5NZXRhLCBpbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kVGVtcGxhdGUoaTE4bk1ldGEsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9JHtjb250ZXh0TmFtZVN1ZmZpeH1fJHtpbmRleH1gO1xuICAgIGNvbnN0IG5hbWUgPSBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVgO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sIGluZGV4LCBuYW1lLFxuICAgICAgICB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsIHRoaXMuZGVmZXJCbG9ja3MsXG4gICAgICAgIHRoaXMuZWxlbWVudExvY2F0aW9ucywgdGhpcy5fY29uc3RhbnRzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+e3sgZm9vIH19PC9kaXY+ICA8ZGl2ICNmb28+PC9kaXY+XG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwciA9IHZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIGNoaWxkcmVuLCB2YXJpYWJsZXMsIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoICsgdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0LFxuICAgICAgICAgIGkxOG5NZXRhLCB2YXJpYWJsZUFsaWFzZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQobmFtZSkpO1xuICAgICAgaWYgKHZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaCguLi52aXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVEYXRhKG5hbWUsIGluZGV4LCB2aXNpdG9yLl9iaW5kaW5nU2NvcGUsIHZpc2l0b3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICB0YWdOYW1lOiBzdHJpbmd8bnVsbCwgY2hpbGRyZW46IHQuTm9kZVtdLCBjb250ZXh0TmFtZVN1ZmZpeDogc3RyaW5nLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdLCBhdHRyc0V4cHJzPzogby5FeHByZXNzaW9uW10sXG4gICAgICByZWZlcmVuY2VzPzogdC5SZWZlcmVuY2VbXSwgaTE4bj86IGkxOG4uSTE4bk1ldGEpOiBudW1iZXIge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLnByZXBhcmVFbWJlZGRlZFRlbXBsYXRlRm4oY2hpbGRyZW4sIGNvbnRleHROYW1lU3VmZml4LCB2YXJpYWJsZXMsIGkxOG4pO1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKGRhdGEuaW5kZXgpLFxuICAgICAgby52YXJpYWJsZShkYXRhLm5hbWUpLFxuICAgICAgby5saXRlcmFsKHRhZ05hbWUpLFxuICAgICAgdGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJzRXhwcnMgfHwgbnVsbCksXG4gICAgXTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmIChyZWZlcmVuY2VzICYmIHJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheShyZWZlcmVuY2VzKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmltcG9ydEV4cHIoUjMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgICB9XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoMiwgMCwgby5saXRlcmFsKGRhdGEuZ2V0Q29uc3RDb3VudCgpKSwgby5saXRlcmFsKGRhdGEuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRhdGEuaW5kZXg7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBhYm91dCB0aGUgdGFnJ3MgbmFtZXNwYWNlIGhlcmUsIGJlY2F1c2Ugd2UgaW5mZXJcbiAgICAvLyBpdCBiYXNlZCBvbiB0aGUgcGFyZW50IG5vZGVzIGluc2lkZSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uXG4gICAgY29uc3QgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPVxuICAgICAgICB0ZW1wbGF0ZS50YWdOYW1lID8gc3BsaXROc05hbWUodGVtcGxhdGUudGFnTmFtZSlbMV0gOiB0ZW1wbGF0ZS50YWdOYW1lO1xuICAgIGNvbnN0IGNvbnRleHROYW1lU3VmZml4ID0gdGVtcGxhdGUudGFnTmFtZSA/ICdfJyArIHNhbml0aXplSWRlbnRpZmllcih0ZW1wbGF0ZS50YWdOYW1lKSA6ICcnO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgICAgTkdfVEVNUExBVEVfVEFHX05BTUUsIHRlbXBsYXRlLmF0dHJpYnV0ZXMsIHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cyxcbiAgICAgICAgdW5kZWZpbmVkIC8qIHN0eWxlcyAqLywgdGVtcGxhdGUudGVtcGxhdGVBdHRycyk7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCB0ZW1wbGF0ZS5jaGlsZHJlbiwgY29udGV4dE5hbWVTdWZmaXgsIHRlbXBsYXRlLnNvdXJjZVNwYW4sXG4gICAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcywgYXR0cnNFeHBycywgdGVtcGxhdGUucmVmZXJlbmNlcywgdGVtcGxhdGUuaTE4bik7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgPG5nLXRlbXBsYXRlPiBlbGVtZW50cy5cbiAgICBpZiAodGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICBjb25zdCBbaTE4bklucHV0cywgaW5wdXRzXSA9XG4gICAgICAgICAgcGFydGl0aW9uQXJyYXk8dC5Cb3VuZEF0dHJpYnV0ZSwgdC5Cb3VuZEF0dHJpYnV0ZT4odGVtcGxhdGUuaW5wdXRzLCBoYXNJMThuTWV0YSk7XG5cbiAgICAgIC8vIEFkZCBpMThuIGF0dHJpYnV0ZXMgdGhhdCBtYXkgYWN0IGFzIGlucHV0cyB0byBkaXJlY3RpdmVzLiBJZiBzdWNoIGF0dHJpYnV0ZXMgYXJlIHByZXNlbnQsXG4gICAgICAvLyBnZW5lcmF0ZSBgaTE4bkF0dHJpYnV0ZXNgIGluc3RydWN0aW9uLiBOb3RlOiB3ZSBnZW5lcmF0ZSBpdCBvbmx5IGZvciBleHBsaWNpdCA8bmctdGVtcGxhdGU+XG4gICAgICAvLyBlbGVtZW50cywgaW4gY2FzZSBvZiBpbmxpbmUgdGVtcGxhdGVzLCBjb3JyZXNwb25kaW5nIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZCBpbiB0aGVcbiAgICAgIC8vIG5lc3RlZCB0ZW1wbGF0ZSBmdW5jdGlvbi5cbiAgICAgIGlmIChpMThuSW5wdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5pMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgICAgICAgdGVtcGxhdGVJbmRleCwgaTE4bklucHV0cywgdGVtcGxhdGUuc3RhcnRTb3VyY2VTcGFuID8/IHRlbXBsYXRlLnNvdXJjZVNwYW4pO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICBpZiAoaW5wdXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3ModGVtcGxhdGVJbmRleCwgaW5wdXRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICBmb3IgKGNvbnN0IG91dHB1dEFzdCBvZiB0ZW1wbGF0ZS5vdXRwdXRzKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKCduZ190ZW1wbGF0ZScsIG91dHB1dEFzdCwgdGVtcGxhdGVJbmRleCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXREZWZlcnJlZFRyaWdnZXIgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdERlZmVycmVkQmxvY2tFcnJvciA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0SWZCbG9ja0JyYW5jaCA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0U3dpdGNoQmxvY2tDYXNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRGb3JMb29wQmxvY2tFbXB0eSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VW5rbm93bkJsb2NrID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4hKTtcbiAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3ModmFsdWUuZXhwcmVzc2lvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgIG5vZGVJbmRleCwgdGV4dC5zb3VyY2VTcGFuLCBnZXRUZXh0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLFxuICAgICAgICAgICgpID0+IHRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3IoJ1RleHQgbm9kZXMgc2hvdWxkIGJlIGludGVycG9sYXRlZCBhbmQgbmV2ZXIgYm91bmQgZGlyZWN0bHkuJyk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIC8vIHdoZW4gYSB0ZXh0IGVsZW1lbnQgaXMgbG9jYXRlZCB3aXRoaW4gYSB0cmFuc2xhdGFibGVcbiAgICAvLyBibG9jaywgd2UgZXhjbHVkZSB0aGlzIHRleHQgZWxlbWVudCBmcm9tIGluc3RydWN0aW9ucyBzZXQsXG4gICAgLy8gc2luY2UgaXQgd2lsbCBiZSBjYXB0dXJlZCBpbiBpMThuIGNvbnRlbnQgYW5kIHByb2Nlc3NlZCBhdCBydW50aW1lXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCBvLmxpdGVyYWwodGV4dC52YWx1ZSldKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEljdShpY3U6IHQuSWN1KSB7XG4gICAgbGV0IGluaXRXYXNJbnZva2VkID0gZmFsc2U7XG5cbiAgICAvLyBpZiBhbiBJQ1Ugd2FzIGNyZWF0ZWQgb3V0c2lkZSBvZiBpMThuIGJsb2NrLCB3ZSBzdGlsbCB0cmVhdFxuICAgIC8vIGl0IGFzIGEgdHJhbnNsYXRhYmxlIGVudGl0eSBhbmQgaW52b2tlIGkxOG5TdGFydCBhbmQgaTE4bkVuZFxuICAgIC8vIHRvIGdlbmVyYXRlIGkxOG4gY29udGV4dCBhbmQgdGhlIG5lY2Vzc2FyeSBpbnN0cnVjdGlvbnNcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgaW5pdFdhc0ludm9rZWQgPSB0cnVlO1xuICAgICAgdGhpcy5pMThuU3RhcnQobnVsbCwgaWN1LmkxOG4hLCB0cnVlKTtcbiAgICB9XG5cbiAgICBjb25zdCBpMThuID0gdGhpcy5pMThuITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biEgYXMgaTE4bi5NZXNzYWdlO1xuXG4gICAgLy8gd2UgYWx3YXlzIG5lZWQgcG9zdC1wcm9jZXNzaW5nIGZ1bmN0aW9uIGZvciBJQ1VzLCB0byBtYWtlIHN1cmUgdGhhdDpcbiAgICAvLyAtIGFsbCBwbGFjZWhvbGRlcnMgaW4gYSBmb3JtIG9mIHtQTEFDRUhPTERFUn0gYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyAobm90ZTpcbiAgICAvLyBgZ29vZy5nZXRNc2dgIGRvZXMgbm90IHByb2Nlc3MgSUNVcyBhbmQgdXNlcyB0aGUgYHtQTEFDRUhPTERFUn1gIGZvcm1hdCBmb3IgcGxhY2Vob2xkZXJzXG4gICAgLy8gaW5zaWRlIElDVXMpXG4gICAgLy8gLSBhbGwgSUNVIHZhcnMgKHN1Y2ggYXMgYFZBUl9TRUxFQ1RgIG9yIGBWQVJfUExVUkFMYCkgYXJlIHJlcGxhY2VkIHdpdGggY29ycmVjdCB2YWx1ZXNcbiAgICBjb25zdCB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgIC8vIFNvcnQgdGhlIG1hcCBlbnRyaWVzIGluIHRoZSBjb21waWxlZCBvdXRwdXQuIFRoaXMgbWFrZXMgaXQgZWFzeSB0byBhY2hlaXZlIGlkZW50aWNhbCBvdXRwdXRcbiAgICAgIC8vIGluIHRoZSB0ZW1wbGF0ZSBwaXBlbGluZSBjb21waWxlci5cbiAgICAgIGNvbnN0IHBhcmFtcyA9IE9iamVjdC5mcm9tRW50cmllcyhPYmplY3QuZW50cmllcyh7Li4udmFycywgLi4ucGxhY2Vob2xkZXJzfSkuc29ydCgpKTtcbiAgICAgIGNvbnN0IGZvcm1hdHRlZCA9IGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpO1xuICAgICAgcmV0dXJuIGludm9rZUluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgW3JhdywgbWFwTGl0ZXJhbChmb3JtYXR0ZWQsIHRydWUpXSk7XG4gICAgfTtcblxuICAgIC8vIGluIGNhc2UgdGhlIHdob2xlIGkxOG4gbWVzc2FnZSBpcyBhIHNpbmdsZSBJQ1UgLSB3ZSBkbyBub3QgbmVlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHNlcGFyYXRlIHRvcC1sZXZlbCB0cmFuc2xhdGlvbiwgd2UgY2FuIHVzZSB0aGUgcm9vdCByZWYgaW5zdGVhZFxuICAgIC8vIGFuZCBtYWtlIHRoaXMgSUNVIGEgdG9wLWxldmVsIHRyYW5zbGF0aW9uXG4gICAgLy8gbm90ZTogSUNVIHBsYWNlaG9sZGVycyBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIGluIGBpMThuUG9zdHByb2Nlc3NgIGZ1bmN0aW9uXG4gICAgLy8gc2VwYXJhdGVseSwgc28gd2UgZG8gbm90IHBhc3MgcGxhY2Vob2xkZXJzIGludG8gYGkxOG5UcmFuc2xhdGVgIGZ1bmN0aW9uLlxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9XG4gICAgICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgLyogcmVmICovIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBvZiB0aGUgZXhwcmVzc2lvbi5cbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKG51bGwpO1xuXG4gICAgLy8gV2UgaGF2ZSB0byBwcm9jZXNzIHRoZSBibG9jayBpbiB0d28gc3RlcHM6IG9uY2UgaGVyZSBhbmQgYWdhaW4gaW4gdGhlIHVwZGF0ZSBpbnN0cnVjdGlvblxuICAgIC8vIGNhbGxiYWNrIGluIG9yZGVyIHRvIGdlbmVyYXRlIHRoZSBjb3JyZWN0IGV4cHJlc3Npb25zIHdoZW4gcGlwZXMgb3IgcHVyZSBmdW5jdGlvbnMgYXJlXG4gICAgLy8gdXNlZCBpbnNpZGUgdGhlIGJyYW5jaCBleHByZXNzaW9ucy5cbiAgICBjb25zdCBicmFuY2hEYXRhID0gYmxvY2suYnJhbmNoZXMubWFwKChicmFuY2gsIGJyYW5jaEluZGV4KSA9PiB7XG4gICAgICBjb25zdCB7ZXhwcmVzc2lvbiwgZXhwcmVzc2lvbkFsaWFzLCBjaGlsZHJlbiwgc291cmNlU3Bhbn0gPSBicmFuY2g7XG5cbiAgICAgIC8vIElmIHRoZSBicmFuY2ggaGFzIGFuIGFsaWFzLCBpdCdsbCBiZSBhc3NpZ25lZCBkaXJlY3RseSB0byB0aGUgY29udGFpbmVyJ3MgY29udGV4dC5cbiAgICAgIC8vIFdlIGRlZmluZSBhIHZhcmlhYmxlIHJlZmVycmluZyBkaXJlY3RseSB0byB0aGUgY29udGV4dCBzbyB0aGF0IGFueSBuZXN0ZWQgdXNhZ2VzIGNhbiBiZVxuICAgICAgLy8gcmV3cml0dGVuIHRvIHJlZmVyIHRvIGl0LlxuICAgICAgY29uc3QgdmFyaWFibGVzID0gZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsID9cbiAgICAgICAgICBbbmV3IHQuVmFyaWFibGUoXG4gICAgICAgICAgICAgIGV4cHJlc3Npb25BbGlhcy5uYW1lLCBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0UsIGV4cHJlc3Npb25BbGlhcy5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICBleHByZXNzaW9uQWxpYXMua2V5U3BhbildIDpcbiAgICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgICBsZXQgYXR0cnNFeHByczogby5FeHByZXNzaW9uW118dW5kZWZpbmVkO1xuXG4gICAgICAvLyBPbmx5IHRoZSBmaXJzdCBicmFuY2ggY2FuIGJlIHVzZWQgZm9yIHByb2plY3Rpb24sIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgICAvLyB1c2VzIHRoZSBjb250YWluZXIgb2YgdGhlIGZpcnN0IGJyYW5jaCBhcyB0aGUgaW5zZXJ0aW9uIHBvaW50IGZvciBhbGwgYnJhbmNoZXMuXG4gICAgICBpZiAoYnJhbmNoSW5kZXggPT09IDApIHtcbiAgICAgICAgY29uc3QgaW5mZXJyZWREYXRhID0gdGhpcy5pbmZlclByb2plY3Rpb25EYXRhRnJvbUluc2VydGlvblBvaW50KGJyYW5jaCk7XG4gICAgICAgIHRhZ05hbWUgPSBpbmZlcnJlZERhdGEudGFnTmFtZTtcbiAgICAgICAgYXR0cnNFeHBycyA9IGluZmVycmVkRGF0YS5hdHRyc0V4cHJzO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlOiB0aGUgdGVtcGxhdGUgbmVlZHMgdG8gYmUgY3JlYXRlZCAqYmVmb3JlKiB3ZSBwcm9jZXNzIHRoZSBleHByZXNzaW9uLFxuICAgICAgLy8gb3RoZXJ3aXNlIHBpcGVzIGluamVjdGluZyBzb21lIHN5bWJvbHMgd29uJ3Qgd29yayAoc2VlICM1MjEwMikuXG4gICAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgICAgdGFnTmFtZSwgY2hpbGRyZW4sICdfQ29uZGl0aW9uYWwnLCBzb3VyY2VTcGFuLCB2YXJpYWJsZXMsIGF0dHJzRXhwcnMsIHVuZGVmaW5lZCxcbiAgICAgICAgICBicmFuY2guaTE4bik7XG4gICAgICBjb25zdCBwcm9jZXNzZWRFeHByZXNzaW9uID1cbiAgICAgICAgICBleHByZXNzaW9uID09PSBudWxsID8gbnVsbCA6IGV4cHJlc3Npb24udmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgcmV0dXJuIHtpbmRleDogdGVtcGxhdGVJbmRleCwgZXhwcmVzc2lvbjogcHJvY2Vzc2VkRXhwcmVzc2lvbiwgYWxpYXM6IGV4cHJlc3Npb25BbGlhc307XG4gICAgfSk7XG5cbiAgICAvLyBVc2UgdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBibG9jayBhcyB0aGUgaW5kZXggZm9yIHRoZSBlbnRpcmUgY29udGFpbmVyLlxuICAgIGNvbnN0IGNvbnRhaW5lckluZGV4ID0gYnJhbmNoRGF0YVswXS5pbmRleDtcbiAgICBjb25zdCBwYXJhbXNDYWxsYmFjayA9ICgpID0+IHtcbiAgICAgIGxldCBjb250ZXh0VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gICAgICBjb25zdCBnZW5lcmF0ZUJyYW5jaCA9IChicmFuY2hJbmRleDogbnVtYmVyKTogby5FeHByZXNzaW9uID0+IHtcbiAgICAgICAgLy8gSWYgd2UndmUgZ29uZSBiZXlvbmQgdGhlIGxhc3QgYnJhbmNoLCByZXR1cm4gdGhlIHNwZWNpYWwgLTEgdmFsdWUgd2hpY2ggbWVhbnMgdGhhdCBub1xuICAgICAgICAvLyB2aWV3IHdpbGwgYmUgcmVuZGVyZWQuIE5vdGUgdGhhdCB3ZSBkb24ndCBuZWVkIHRvIHJlc2V0IHRoZSBjb250ZXh0IGhlcmUsIGJlY2F1c2UgLTFcbiAgICAgICAgLy8gd29uJ3QgcmVuZGVyIGEgdmlldyBzbyB0aGUgcGFzc2VkLWluIGNvbnRleHQgd29uJ3QgYmUgY2FwdHVyZWQuXG4gICAgICAgIGlmIChicmFuY2hJbmRleCA+IGJyYW5jaERhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHJldHVybiBvLmxpdGVyYWwoLTEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qge2luZGV4LCBleHByZXNzaW9uLCBhbGlhc30gPSBicmFuY2hEYXRhW2JyYW5jaEluZGV4XTtcblxuICAgICAgICAvLyBJZiB0aGUgYnJhbmNoIGhhcyBubyBleHByZXNzaW9uLCBpdCBtZWFucyB0aGF0IGl0J3MgdGhlIGZpbmFsIGBlbHNlYC5cbiAgICAgICAgLy8gUmV0dXJuIGl0cyBpbmRleCBhbmQgc3RvcCB0aGUgcmVjdXJzaW9uLiBBc3N1bWVzIHRoYXQgdGhlcmUncyBvbmx5IG9uZVxuICAgICAgICAvLyBgZWxzZWAgY29uZGl0aW9uIGFuZCB0aGF0IGl0J3MgdGhlIGxhc3QgYnJhbmNoLlxuICAgICAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBvLmxpdGVyYWwoaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNvbXBhcmlzb25UYXJnZXQ6IG8uRXhwcmVzc2lvbjtcblxuICAgICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgICAvLyBJZiB0aGUgYnJhbmNoIGlzIGFsaWFzZWQsIHdlIG5lZWQgdG8gYXNzaWduIHRoZSBleHByZXNzaW9uIHZhbHVlIHRvIHRoZSB0ZW1wb3JhcnlcbiAgICAgICAgICAvLyB2YXJpYWJsZSBhbmQgdGhlbiBwYXNzIGl0IGludG8gYGNvbmRpdGlvbmFsYC4gRS5nLiBmb3IgdGhlIGV4cHJlc3Npb246XG4gICAgICAgICAgLy8gYEBpZiAoZm9vKCk7IGFzIGFsaWFzKSB7Li4ufWAgd2UgaGF2ZSB0byBnZW5lcmF0ZTpcbiAgICAgICAgICAvLyBgYGBcbiAgICAgICAgICAvLyBsZXQgdGVtcDtcbiAgICAgICAgICAvLyBjb25kaXRpb25hbCgwLCAodGVtcCA9IGN0eC5mb28oKSkgPyAwIDogLTEsIHRlbXApO1xuICAgICAgICAgIC8vIGBgYFxuICAgICAgICAgIGNvbnRleHRWYXJpYWJsZSA9IHRoaXMuYWxsb2NhdGVDb250cm9sRmxvd1RlbXBWYXJpYWJsZSgpO1xuICAgICAgICAgIGNvbXBhcmlzb25UYXJnZXQgPSBjb250ZXh0VmFyaWFibGUuc2V0KHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29tcGFyaXNvblRhcmdldCA9IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhleHByZXNzaW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21wYXJpc29uVGFyZ2V0LmNvbmRpdGlvbmFsKG8ubGl0ZXJhbChpbmRleCksIGdlbmVyYXRlQnJhbmNoKGJyYW5jaEluZGV4ICsgMSkpO1xuICAgICAgfTtcblxuICAgICAgY29uc3QgcGFyYW1zID0gW28ubGl0ZXJhbChjb250YWluZXJJbmRleCksIGdlbmVyYXRlQnJhbmNoKDApXTtcblxuICAgICAgaWYgKGNvbnRleHRWYXJpYWJsZSAhPT0gbnVsbCkge1xuICAgICAgICBwYXJhbXMucHVzaChjb250ZXh0VmFyaWFibGUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH07XG5cbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGNvbnRhaW5lckluZGV4LCBibG9jay5icmFuY2hlc1swXS5zb3VyY2VTcGFuLCBSMy5jb25kaXRpb25hbCwgcGFyYW1zQ2FsbGJhY2spO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogdC5Td2l0Y2hCbG9jayk6IHZvaWQge1xuICAgIC8vIFdlIGhhdmUgdG8gcHJvY2VzcyB0aGUgYmxvY2sgaW4gdHdvIHN0ZXBzOiBvbmNlIGhlcmUgYW5kIGFnYWluIGluIHRoZSB1cGRhdGUgaW5zdHJ1Y3Rpb25cbiAgICAvLyBjYWxsYmFjayBpbiBvcmRlciB0byBnZW5lcmF0ZSB0aGUgY29ycmVjdCBleHByZXNzaW9ucyB3aGVuIHBpcGVzIG9yIHB1cmUgZnVuY3Rpb25zIGFyZSB1c2VkLlxuICAgIGNvbnN0IGNhc2VEYXRhID0gYmxvY2suY2FzZXMubWFwKGN1cnJlbnRDYXNlID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgICAgbnVsbCwgY3VycmVudENhc2UuY2hpbGRyZW4sICdfQ2FzZScsIGN1cnJlbnRDYXNlLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLFxuICAgICAgICAgIHVuZGVmaW5lZCwgY3VycmVudENhc2UuaTE4bik7XG4gICAgICBjb25zdCBleHByZXNzaW9uID0gY3VycmVudENhc2UuZXhwcmVzc2lvbiA9PT0gbnVsbCA/XG4gICAgICAgICAgbnVsbCA6XG4gICAgICAgICAgY3VycmVudENhc2UuZXhwcmVzc2lvbi52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICByZXR1cm4ge2luZGV4LCBleHByZXNzaW9ufTtcbiAgICB9KTtcblxuICAgIC8vIFVzZSB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IGJsb2NrIGFzIHRoZSBpbmRleCBmb3IgdGhlIGVudGlyZSBjb250YWluZXIuXG4gICAgY29uc3QgY29udGFpbmVySW5kZXggPSBjYXNlRGF0YVswXS5pbmRleDtcblxuICAgIC8vIE5vdGU6IHRoZSBleHByZXNzaW9uIG5lZWRzIHRvIGJlIHByb2Nlc3NlZCAqYWZ0ZXIqIHRoZSB0ZW1wbGF0ZSxcbiAgICAvLyBvdGhlcndpc2UgcGlwZXMgaW5qZWN0aW5nIHNvbWUgc3ltYm9scyB3b24ndCB3b3JrIChzZWUgIzUyMTAyKS5cbiAgICBjb25zdCBibG9ja0V4cHJlc3Npb24gPSBibG9jay5leHByZXNzaW9uLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKG51bGwpOyAgLy8gQWxsb2NhdGUgYSBzbG90IGZvciB0aGUgcHJpbWFyeSBibG9jayBleHByZXNzaW9uLlxuXG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKGNvbnRhaW5lckluZGV4LCBibG9jay5zb3VyY2VTcGFuLCBSMy5jb25kaXRpb25hbCwgKCkgPT4ge1xuICAgICAgY29uc3QgZ2VuZXJhdGVDYXNlcyA9IChjYXNlSW5kZXg6IG51bWJlcik6IG8uRXhwcmVzc2lvbiA9PiB7XG4gICAgICAgIC8vIElmIHdlJ3ZlIGdvbmUgYmV5b25kIHRoZSBsYXN0IGJyYW5jaCwgcmV0dXJuIHRoZSBzcGVjaWFsIC0xXG4gICAgICAgIC8vIHZhbHVlIHdoaWNoIG1lYW5zIHRoYXQgbm8gdmlldyB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAgICBpZiAoY2FzZUluZGV4ID4gY2FzZURhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHJldHVybiBvLmxpdGVyYWwoLTEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qge2luZGV4LCBleHByZXNzaW9ufSA9IGNhc2VEYXRhW2Nhc2VJbmRleF07XG5cbiAgICAgICAgLy8gSWYgdGhlIGNhc2UgaGFzIG5vIGV4cHJlc3Npb24sIGl0IG1lYW5zIHRoYXQgaXQncyB0aGUgYGRlZmF1bHRgIGNhc2UuXG4gICAgICAgIC8vIFJldHVybiBpdHMgaW5kZXggYW5kIHN0b3AgdGhlIHJlY3Vyc2lvbi4gQXNzdW1lcyB0aGF0IHRoZXJlJ3Mgb25seSBvbmVcbiAgICAgICAgLy8gYGRlZmF1bHRgIGNvbmRpdGlvbiBhbmQgdGhhdCBpdCdzIGRlZmluZWQgbGFzdC5cbiAgICAgICAgaWYgKGV4cHJlc3Npb24gPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gby5saXRlcmFsKGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoaXMgaXMgdGhlIHZlcnkgZmlyc3QgY29tcGFyaXNvbiwgd2UgbmVlZCB0byBhc3NpZ24gdGhlIHZhbHVlIG9mIHRoZSBwcmltYXJ5XG4gICAgICAgIC8vIGV4cHJlc3Npb24gYXMgYSBwYXJ0IG9mIHRoZSBjb21wYXJpc29uIHNvIHRoZSByZW1haW5pbmcgY2FzZXMgY2FuIHJldXNlIGl0LiBJbiBwcmFjdGljZVxuICAgICAgICAvLyB0aGlzIGxvb2tzIGFzIGZvbGxvd3M6XG4gICAgICAgIC8vIGBgYFxuICAgICAgICAvLyBsZXQgdGVtcDtcbiAgICAgICAgLy8gY29uZGl0aW9uYWwoMSwgKHRlbXAgPSBjdHguZm9vKSA9PT0gMSA/IDEgOiB0ZW1wID09PSAyID8gMiA6IHRlbXAgPT09IDMgPyAzIDogNCk7XG4gICAgICAgIC8vIGBgYFxuICAgICAgICBjb25zdCBjb21wYXJpc29uVGFyZ2V0ID0gY2FzZUluZGV4ID09PSAwID9cbiAgICAgICAgICAgIHRoaXMuYWxsb2NhdGVDb250cm9sRmxvd1RlbXBWYXJpYWJsZSgpLnNldChcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYmxvY2tFeHByZXNzaW9uKSkgOlxuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBhcmlzb25UYXJnZXQuaWRlbnRpY2FsKHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhleHByZXNzaW9uKSlcbiAgICAgICAgICAgIC5jb25kaXRpb25hbChvLmxpdGVyYWwoaW5kZXgpLCBnZW5lcmF0ZUNhc2VzKGNhc2VJbmRleCArIDEpKTtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBbby5saXRlcmFsKGNvbnRhaW5lckluZGV4KSwgZ2VuZXJhdGVDYXNlcygwKV07XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IHQuRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGNvbnN0IHtsb2FkaW5nLCBwbGFjZWhvbGRlciwgZXJyb3IsIHRyaWdnZXJzLCBwcmVmZXRjaFRyaWdnZXJzfSA9IGRlZmVycmVkO1xuICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5kZWZlckJsb2Nrcy5nZXQoZGVmZXJyZWQpO1xuXG4gICAgaWYgKCFtZXRhZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgcmVzb2x2ZSBgZGVmZXJgIGJsb2NrIG1ldGFkYXRhLiBCbG9jayBtYXkgbmVlZCB0byBiZSBhbmFseXplZC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmltYXJ5VGVtcGxhdGVJbmRleCA9IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICBudWxsLCBkZWZlcnJlZC5jaGlsZHJlbiwgJ19EZWZlcicsIGRlZmVycmVkLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgIGRlZmVycmVkLmkxOG4pO1xuICAgIGNvbnN0IGxvYWRpbmdJbmRleCA9IGxvYWRpbmcgPyB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsIGxvYWRpbmcuY2hpbGRyZW4sICdfRGVmZXJMb2FkaW5nJywgbG9hZGluZy5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbG9hZGluZy5pMThuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGw7XG4gICAgY29uc3QgbG9hZGluZ0NvbnN0cyA9IGxvYWRpbmcgP1xuICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhbby5saXRlcmFsKGxvYWRpbmcubWluaW11bVRpbWUpLCBvLmxpdGVyYWwobG9hZGluZy5hZnRlclRpbWUpXSkgOlxuICAgICAgICBudWxsO1xuXG4gICAgY29uc3QgcGxhY2Vob2xkZXJJbmRleCA9IHBsYWNlaG9sZGVyID9cbiAgICAgICAgdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgICAgICBudWxsLCBwbGFjZWhvbGRlci5jaGlsZHJlbiwgJ19EZWZlclBsYWNlaG9sZGVyJywgcGxhY2Vob2xkZXIuc291cmNlU3BhbiwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHBsYWNlaG9sZGVyLmkxOG4pIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBwbGFjZWhvbGRlckNvbnN0cyA9IHBsYWNlaG9sZGVyICYmIHBsYWNlaG9sZGVyLm1pbmltdW1UaW1lICE9PSBudWxsID9cbiAgICAgICAgLy8gVE9ETyhjcmlzYmV0byk6IHBvdGVudGlhbGx5IHBhc3MgdGhlIHRpbWUgZGlyZWN0bHkgaW5zdGVhZCBvZiBzdG9yaW5nIGl0IGluIHRoZSBgY29uc3RzYFxuICAgICAgICAvLyBzaW5jZSB0aGUgcGxhY2Vob2xkZXIgYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgcGFyYW1ldGVyP1xuICAgICAgICBvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChwbGFjZWhvbGRlci5taW5pbXVtVGltZSldKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBjb25zdCBlcnJvckluZGV4ID0gZXJyb3IgPyB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgZXJyb3IuY2hpbGRyZW4sICdfRGVmZXJFcnJvcicsIGVycm9yLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGVycm9yLmkxOG4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuXG4gICAgLy8gTm90ZTogd2UgZ2VuZXJhdGUgdGhpcyBsYXN0IHNvIHRoZSBpbmRleCBtYXRjaGVzIHRoZSBpbnN0cnVjdGlvbiBvcmRlci5cbiAgICBjb25zdCBkZWZlcnJlZEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgZGVwc0ZuTmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9X0RlZmVyXyR7ZGVmZXJyZWRJbmRleH1fRGVwc0ZuYDtcblxuICAgIC8vIGUuZy4gYGRlZmVyKDEsIDAsIE15Q29tcF9EZWZlcl8xX0RlcHNGbiwgLi4uKWBcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIGRlZmVycmVkLnNvdXJjZVNwYW4sIFIzLmRlZmVyLCB0cmltVHJhaWxpbmdOdWxscyhbXG4gICAgICAgICAgby5saXRlcmFsKGRlZmVycmVkSW5kZXgpLFxuICAgICAgICAgIG8ubGl0ZXJhbChwcmltYXJ5VGVtcGxhdGVJbmRleCksXG4gICAgICAgICAgdGhpcy5jcmVhdGVEZWZlcnJlZERlcHNGdW5jdGlvbihkZXBzRm5OYW1lLCBtZXRhZGF0YSksXG4gICAgICAgICAgby5saXRlcmFsKGxvYWRpbmdJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKHBsYWNlaG9sZGVySW5kZXgpLFxuICAgICAgICAgIG8ubGl0ZXJhbChlcnJvckluZGV4KSxcbiAgICAgICAgICBsb2FkaW5nQ29uc3RzPy5sZW5ndGggPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihsb2FkaW5nQ29uc3RzKSkgOiBvLlRZUEVEX05VTExfRVhQUixcbiAgICAgICAgICBwbGFjZWhvbGRlckNvbnN0cyA/IHRoaXMuYWRkVG9Db25zdHMocGxhY2Vob2xkZXJDb25zdHMpIDogby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgICAgICAgKGxvYWRpbmdDb25zdHM/Lmxlbmd0aCB8fCBwbGFjZWhvbGRlckNvbnN0cykgP1xuICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuZGVmZXJFbmFibGVUaW1lclNjaGVkdWxpbmcpIDpcbiAgICAgICAgICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgICAgIF0pKTtcblxuICAgIC8vIEFsbG9jYXRlIGFuIGV4dHJhIGRhdGEgc2xvdCByaWdodCBhZnRlciBhIGRlZmVyIGJsb2NrIHNsb3QgdG8gc3RvcmVcbiAgICAvLyBpbnN0YW5jZS1zcGVjaWZpYyBzdGF0ZSBvZiB0aGF0IGRlZmVyIGJsb2NrIGF0IHJ1bnRpbWUuXG4gICAgdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICAvLyBOb3RlOiB0aGUgdHJpZ2dlcnMgbmVlZCB0byBiZSBwcm9jZXNzZWQgKmFmdGVyKiB0aGUgdmFyaW91cyB0ZW1wbGF0ZXMsXG4gICAgLy8gb3RoZXJ3aXNlIHBpcGVzIGluamVjdGluZyBzb21lIHN5bWJvbHMgd29uJ3Qgd29yayAoc2VlICM1MjEwMikuXG4gICAgdGhpcy5jcmVhdGVEZWZlclRyaWdnZXJJbnN0cnVjdGlvbnMoZGVmZXJyZWRJbmRleCwgdHJpZ2dlcnMsIG1ldGFkYXRhLCBmYWxzZSk7XG4gICAgdGhpcy5jcmVhdGVEZWZlclRyaWdnZXJJbnN0cnVjdGlvbnMoZGVmZXJyZWRJbmRleCwgcHJlZmV0Y2hUcmlnZ2VycywgbWV0YWRhdGEsIHRydWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEZWZlcnJlZERlcHNGdW5jdGlvbihuYW1lOiBzdHJpbmcsIG1ldGFkYXRhOiBSM0RlZmVyQmxvY2tNZXRhZGF0YSkge1xuICAgIGlmIChtZXRhZGF0YS5kZXBzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZGVmZXIgYmxvY2sgaGFzIGRlcHMgZm9yIHdoaWNoIHdlIG5lZWQgdG8gZ2VuZXJhdGUgZHluYW1pYyBpbXBvcnRzLlxuICAgIGNvbnN0IGRlcGVuZGVuY3lFeHA6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGRlZmVycmVkRGVwIG9mIG1ldGFkYXRhLmRlcHMpIHtcbiAgICAgIGlmIChkZWZlcnJlZERlcC5pc0RlZmVycmFibGUpIHtcbiAgICAgICAgLy8gQ2FsbGJhY2sgZnVuY3Rpb24sIGUuZy4gYG0gKCkgPT4gbS5NeUNtcDtgLlxuICAgICAgICBjb25zdCBpbm5lckZuID0gby5hcnJvd0ZuKFxuICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oJ20nLCBvLkRZTkFNSUNfVFlQRSldLCBvLnZhcmlhYmxlKCdtJykucHJvcChkZWZlcnJlZERlcC5zeW1ib2xOYW1lKSk7XG5cbiAgICAgICAgLy8gRHluYW1pYyBpbXBvcnQsIGUuZy4gYGltcG9ydCgnLi9hJykudGhlbiguLi4pYC5cbiAgICAgICAgY29uc3QgaW1wb3J0RXhwciA9XG4gICAgICAgICAgICAobmV3IG8uRHluYW1pY0ltcG9ydEV4cHIoZGVmZXJyZWREZXAuaW1wb3J0UGF0aCEpKS5wcm9wKCd0aGVuJykuY2FsbEZuKFtpbm5lckZuXSk7XG4gICAgICAgIGRlcGVuZGVuY3lFeHAucHVzaChpbXBvcnRFeHByKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vbi1kZWZlcnJhYmxlIHN5bWJvbCwganVzdCB1c2UgYSByZWZlcmVuY2UgdG8gdGhlIHR5cGUuXG4gICAgICAgIGRlcGVuZGVuY3lFeHAucHVzaChkZWZlcnJlZERlcC50eXBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBkZXBzRm5FeHByID0gby5hcnJvd0ZuKFtdLCBvLmxpdGVyYWxBcnIoZGVwZW5kZW5jeUV4cCkpO1xuXG4gICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKGRlcHNGbkV4cHIudG9EZWNsU3RtdChuYW1lLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpO1xuXG4gICAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURlZmVyVHJpZ2dlckluc3RydWN0aW9ucyhcbiAgICAgIGRlZmVycmVkSW5kZXg6IG51bWJlciwgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCBtZXRhZGF0YTogUjNEZWZlckJsb2NrTWV0YWRhdGEsXG4gICAgICBwcmVmZXRjaDogYm9vbGVhbikge1xuICAgIGNvbnN0IHt3aGVuLCBpZGxlLCBpbW1lZGlhdGUsIHRpbWVyLCBob3ZlciwgaW50ZXJhY3Rpb24sIHZpZXdwb3J0fSA9IHRyaWdnZXJzO1xuXG4gICAgLy8gYGRlZmVyV2hlbihjdHguc29tZVZhbHVlKWBcbiAgICBpZiAod2hlbikge1xuICAgICAgY29uc3QgdmFsdWUgPSB3aGVuLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICAgIGRlZmVycmVkSW5kZXgsIHdoZW4uc291cmNlU3BhbiwgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoV2hlbiA6IFIzLmRlZmVyV2hlbixcbiAgICAgICAgICAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpKTtcbiAgICB9XG5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZ2VuZXJhdGUgYW4gaW1wbGljaXQgYG9uIGlkbGVgIGlmIHRoZSBgZGVmZXJyZWRgIGJsb2NrIGhhcyBubyB0cmlnZ2Vycy5cbiAgICAvLyBgZGVmZXJPbklkbGUoKWBcbiAgICBpZiAoaWRsZSB8fCAoIXByZWZldGNoICYmIE9iamVjdC5rZXlzKHRyaWdnZXJzKS5sZW5ndGggPT09IDApKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgaWRsZT8uc291cmNlU3BhbiB8fCBudWxsLCBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPbklkbGUgOiBSMy5kZWZlck9uSWRsZSk7XG4gICAgfVxuXG4gICAgLy8gYGRlZmVyT25JbW1lZGlhdGUoKWBcbiAgICBpZiAoaW1tZWRpYXRlKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgaW1tZWRpYXRlLnNvdXJjZVNwYW4sIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uSW1tZWRpYXRlIDogUjMuZGVmZXJPbkltbWVkaWF0ZSk7XG4gICAgfVxuXG4gICAgLy8gYGRlZmVyT25UaW1lcigxMzM3KWBcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICB0aW1lci5zb3VyY2VTcGFuLCBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPblRpbWVyIDogUjMuZGVmZXJPblRpbWVyLFxuICAgICAgICAgIFtvLmxpdGVyYWwodGltZXIuZGVsYXkpXSk7XG4gICAgfVxuXG4gICAgLy8gYGRlZmVyT25Ib3ZlcihpbmRleCwgd2Fsa1VwVGltZXMpYFxuICAgIGlmIChob3Zlcikge1xuICAgICAgdGhpcy5kb21Ob2RlQmFzZWRUcmlnZ2VyKFxuICAgICAgICAgICdob3ZlcicsIGhvdmVyLCBtZXRhZGF0YSwgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25Ib3ZlciA6IFIzLmRlZmVyT25Ib3Zlcik7XG4gICAgfVxuXG4gICAgLy8gYGRlZmVyT25JbnRlcmFjdGlvbihpbmRleCwgd2Fsa1VwVGltZXMpYFxuICAgIGlmIChpbnRlcmFjdGlvbikge1xuICAgICAgdGhpcy5kb21Ob2RlQmFzZWRUcmlnZ2VyKFxuICAgICAgICAgICdpbnRlcmFjdGlvbicsIGludGVyYWN0aW9uLCBtZXRhZGF0YSxcbiAgICAgICAgICBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPbkludGVyYWN0aW9uIDogUjMuZGVmZXJPbkludGVyYWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBgZGVmZXJPblZpZXdwb3J0KGluZGV4LCB3YWxrVXBUaW1lcylgXG4gICAgaWYgKHZpZXdwb3J0KSB7XG4gICAgICB0aGlzLmRvbU5vZGVCYXNlZFRyaWdnZXIoXG4gICAgICAgICAgJ3ZpZXdwb3J0Jywgdmlld3BvcnQsIG1ldGFkYXRhLFxuICAgICAgICAgIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uVmlld3BvcnQgOiBSMy5kZWZlck9uVmlld3BvcnQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZG9tTm9kZUJhc2VkVHJpZ2dlcihcbiAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgIHRyaWdnZXI6IHQuSW50ZXJhY3Rpb25EZWZlcnJlZFRyaWdnZXJ8dC5Ib3ZlckRlZmVycmVkVHJpZ2dlcnx0LlZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyLFxuICAgICAgbWV0YWRhdGE6IFIzRGVmZXJCbG9ja01ldGFkYXRhLCBpbnN0cnVjdGlvblJlZjogby5FeHRlcm5hbFJlZmVyZW5jZSkge1xuICAgIGNvbnN0IHRyaWdnZXJFbCA9IG1ldGFkYXRhLnRyaWdnZXJFbGVtZW50cy5nZXQodHJpZ2dlcik7XG5cbiAgICAvLyBEb24ndCBnZW5lcmF0ZSBhbnl0aGluZyBpZiBhIHRyaWdnZXIgY2Fubm90IGJlIHJlc29sdmVkLlxuICAgIC8vIFdlJ2xsIGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3MgdG8gc3VyZmFjZSB0aGVzZSB0byB1c2Vycy5cbiAgICBpZiAoIXRyaWdnZXJFbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0cmlnZ2VyLnNvdXJjZVNwYW4sIGluc3RydWN0aW9uUmVmLCAoKSA9PiB7XG4gICAgICBjb25zdCBsb2NhdGlvbiA9IHRoaXMuZWxlbWVudExvY2F0aW9ucy5nZXQodHJpZ2dlckVsKTtcblxuICAgICAgaWYgKCFsb2NhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQ291bGQgbm90IGRldGVybWluZSBsb2NhdGlvbiBvZiByZWZlcmVuY2UgcGFzc2VkIGludG8gYCArXG4gICAgICAgICAgICBgJyR7bmFtZX0nIHRyaWdnZXIuIFRlbXBsYXRlIG1heSBub3QgaGF2ZSBiZWVuIGZ1bGx5IGFuYWx5emVkLmApO1xuICAgICAgfVxuXG4gICAgICAvLyBBIG5lZ2F0aXZlIGRlcHRoIG1lYW5zIHRoYXQgdGhlIHRyaWdnZXIgaXMgaW5zaWRlIHRoZSBwbGFjZWhvbGRlci5cbiAgICAgIC8vIENhcCBpdCBhdCAtMSBzaW5jZSB3ZSBvbmx5IGNhcmUgd2hldGhlciBvciBub3QgaXQncyBuZWdhdGl2ZS5cbiAgICAgIGNvbnN0IGRlcHRoID0gTWF0aC5tYXgodGhpcy5sZXZlbCAtIGxvY2F0aW9uLmxldmVsLCAtMSk7XG4gICAgICBjb25zdCBwYXJhbXMgPSBbby5saXRlcmFsKGxvY2F0aW9uLmluZGV4KV07XG5cbiAgICAgIC8vIFRoZSBtb3N0IGNvbW1vbiBjYXNlIHNob3VsZCBiZSBhIHRyaWdnZXIgd2l0aGluIHRoZSB2aWV3IHNvIHdlIGNhbiBvbWl0IGEgZGVwdGggb2ZcbiAgICAgIC8vIHplcm8uIEZvciB0cmlnZ2VycyBpbiBwYXJlbnQgdmlld3MgYW5kIGluIHRoZSBwbGFjZWhvbGRlciB3ZSBuZWVkIHRvIHBhc3MgaXQgaW4uXG4gICAgICBpZiAoZGVwdGggIT09IDApIHtcbiAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGRlcHRoKSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSW5mZXJzIHRoZSBkYXRhIHVzZWQgZm9yIGNvbnRlbnQgcHJvamVjdGlvbiAodGFnIG5hbWUgYW5kIGF0dHJpYnV0ZXMpIGZyb20gdGhlIGNvbnRlbnQgb2YgYVxuICAgKiBub2RlLlxuICAgKiBAcGFyYW0gbm9kZSBOb2RlIGZvciB3aGljaCB0byBpbmZlciB0aGUgcHJvamVjdGlvbiBkYXRhLlxuICAgKi9cbiAgcHJpdmF0ZSBpbmZlclByb2plY3Rpb25EYXRhRnJvbUluc2VydGlvblBvaW50KG5vZGU6IHQuSWZCbG9ja0JyYW5jaHx0LkZvckxvb3BCbG9jaykge1xuICAgIGxldCByb290OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZXxudWxsID0gbnVsbDtcbiAgICBsZXQgdGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgIGxldCBhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXXx1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIC8vIFNraXAgb3ZlciBjb21tZW50IG5vZGVzLlxuICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICAgIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgICAgIHJvb3QgPSBudWxsO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiB0LkVsZW1lbnQgfHwgKGNoaWxkIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBjaGlsZC50YWdOYW1lICE9PSBudWxsKSkge1xuICAgICAgICByb290ID0gY2hpbGQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgd2UndmUgZm91bmQgYSBzaW5nbGUgcm9vdCBub2RlLCBpdHMgdGFnIG5hbWUgYW5kICpzdGF0aWMqIGF0dHJpYnV0ZXMgY2FuIGJlIGNvcGllZFxuICAgIC8vIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uIE5vdGUgdGhhdCBpdCdzIGltcG9ydGFudFxuICAgIC8vIHRoYXQgd2UgZG9uJ3QgY29weSBhbnkgYm91bmQgYXR0cmlidXRlcyBzaW5jZSB0aGV5IGRvbid0IHBhcnRpY2lwYXRlIGluIGNvbnRlbnQgcHJvamVjdGlvblxuICAgIC8vIGFuZCB0aGV5IGNhbiBiZSB1c2VkIGluIGRpcmVjdGl2ZSBtYXRjaGluZyAoaW4gdGhlIGNhc2Ugb2YgYFRlbXBsYXRlLnRlbXBsYXRlQXR0cnNgKS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgbmFtZSA9IHJvb3QgaW5zdGFuY2VvZiB0LkVsZW1lbnQgPyByb290Lm5hbWUgOiByb290LnRhZ05hbWU7XG4gICAgICAvLyBEb24ndCBwYXNzIGFsb25nIGBuZy10ZW1wbGF0ZWAgdGFnIG5hbWUgc2luY2UgaXQgZW5hYmxlcyBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgICB0YWdOYW1lID0gbmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUgPyBudWxsIDogbmFtZTtcbiAgICAgIGF0dHJzRXhwcnMgPVxuICAgICAgICAgIHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoTkdfVEVNUExBVEVfVEFHX05BTUUsIHJvb3QuYXR0cmlidXRlcywgcm9vdC5pbnB1dHMsIFtdKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge3RhZ05hbWUsIGF0dHJzRXhwcnN9O1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkge1xuICAgIHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKztcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHZvaWQge1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVwZWF0ZXIgbWV0YWRhdGEuIFRoZSBzbG90cyBmb3IgdGhlIHByaW1hcnkgYW5kIGVtcHR5IGJsb2NrXG4gICAgLy8gYXJlIGltcGxpY2l0bHkgaW5mZXJyZWQgYnkgdGhlIHJ1bnRpbWUgdG8gaW5kZXggKyAxIGFuZCBpbmRleCArIDIuXG4gICAgY29uc3QgYmxvY2tJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHt0YWdOYW1lLCBhdHRyc0V4cHJzfSA9IHRoaXMuaW5mZXJQcm9qZWN0aW9uRGF0YUZyb21JbnNlcnRpb25Qb2ludChibG9jayk7XG4gICAgY29uc3QgcHJpbWFyeURhdGEgPSB0aGlzLnByZXBhcmVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgIGJsb2NrLmNoaWxkcmVuLCAnX0ZvcicsXG4gICAgICAgIFtibG9jay5pdGVtLCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRpbmRleCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnRdLCBibG9jay5pMThuLCB7XG4gICAgICAgICAgLy8gV2UgbmVlZCB0byBwcm92aWRlIGxldmVsLXNwZWNpZmljIHZlcnNpb25zIG9mIGAkaW5kZXhgIGFuZCBgJGNvdW50YCwgYmVjYXVzZVxuICAgICAgICAgIC8vIHRoZXkncmUgdXNlZCB3aGVuIGRlcml2aW5nIHRoZSByZW1haW5pbmcgdmFyaWFibGVzIChgJG9kZGAsIGAkZXZlbmAgZXRjLikgd2hpbGUgYXQgdGhlXG4gICAgICAgICAgLy8gc2FtZSB0aW1lIGJlaW5nIGF2YWlsYWJsZSBpbXBsaWNpdGx5LiBXaXRob3V0IHRoZXNlIGFsaWFzZXMsIHdlIHdvdWxkbid0IGJlIGFibGUgdG9cbiAgICAgICAgICAvLyBhY2Nlc3MgdGhlIGAkaW5kZXhgIG9mIGEgcGFyZW50IGxvb3AgZnJvbSBpbnNpZGUgb2YgYSBuZXN0ZWQgbG9vcC5cbiAgICAgICAgICBbYmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZV06XG4gICAgICAgICAgICAgIHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY1ZhcmlhYmxlTmFtZSgnJGluZGV4JywgdGhpcy5sZXZlbCArIDEpLFxuICAgICAgICAgIFtibG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lXTpcbiAgICAgICAgICAgICAgdGhpcy5nZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKCckY291bnQnLCB0aGlzLmxldmVsICsgMSksXG4gICAgICAgIH0pO1xuICAgIGNvbnN0IHtleHByZXNzaW9uOiB0cmFja0J5RXhwcmVzc2lvbiwgdXNlc0NvbXBvbmVudEluc3RhbmNlOiB0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlfSA9XG4gICAgICAgIHRoaXMuY3JlYXRlVHJhY2tCeUZ1bmN0aW9uKGJsb2NrKTtcbiAgICBsZXQgZW1wdHlEYXRhOiBUZW1wbGF0ZURhdGF8bnVsbCA9IG51bGw7XG5cbiAgICBpZiAoYmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICAgIGVtcHR5RGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICBibG9jay5lbXB0eS5jaGlsZHJlbiwgJ19Gb3JFbXB0eScsIHVuZGVmaW5lZCwgYmxvY2suZW1wdHkuaTE4bik7XG4gICAgICAvLyBBbGxvY2F0ZSBhbiBleHRyYSBzbG90IGZvciB0aGUgZW1wdHkgYmxvY2sgdHJhY2tpbmcuXG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKG51bGwpO1xuICAgIH1cblxuICAgIHRoaXMucmVnaXN0ZXJDb21wdXRlZExvb3BWYXJpYWJsZXMoYmxvY2ssIHByaW1hcnlEYXRhLnNjb3BlKTtcblxuICAgIC8vIGByZXBlYXRlckNyZWF0ZSgwLCAuLi4pYFxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihibG9jay5zb3VyY2VTcGFuLCBSMy5yZXBlYXRlckNyZWF0ZSwgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gW1xuICAgICAgICBvLmxpdGVyYWwoYmxvY2tJbmRleCksXG4gICAgICAgIG8udmFyaWFibGUocHJpbWFyeURhdGEubmFtZSksXG4gICAgICAgIG8ubGl0ZXJhbChwcmltYXJ5RGF0YS5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICBvLmxpdGVyYWwocHJpbWFyeURhdGEuZ2V0VmFyQ291bnQoKSksXG4gICAgICAgIG8ubGl0ZXJhbCh0YWdOYW1lKSxcbiAgICAgICAgdGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJzRXhwcnMgfHwgbnVsbCksXG4gICAgICAgIHRyYWNrQnlFeHByZXNzaW9uLFxuICAgICAgXTtcblxuICAgICAgaWYgKGVtcHR5RGF0YSAhPT0gbnVsbCkge1xuICAgICAgICBwYXJhbXMucHVzaChcbiAgICAgICAgICAgIG8ubGl0ZXJhbCh0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlKSwgby52YXJpYWJsZShlbXB0eURhdGEubmFtZSksXG4gICAgICAgICAgICBvLmxpdGVyYWwoZW1wdHlEYXRhLmdldENvbnN0Q291bnQoKSksIG8ubGl0ZXJhbChlbXB0eURhdGEuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgfSBlbHNlIGlmICh0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlKSB7XG4gICAgICAgIC8vIElmIHRoZSB0cmFja2luZyBmdW5jdGlvbiBkb2Vzbid0IHVzZSB0aGUgY29tcG9uZW50IGluc3RhbmNlLCB3ZSBjYW4gb21pdCB0aGUgZmxhZy5cbiAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9KTtcblxuICAgIC8vIE5vdGU6IHRoZSBleHByZXNzaW9uIG5lZWRzIHRvIGJlIHByb2Nlc3NlZCAqYWZ0ZXIqIHRoZSB0ZW1wbGF0ZSxcbiAgICAvLyBvdGhlcndpc2UgcGlwZXMgaW5qZWN0aW5nIHNvbWUgc3ltYm9scyB3b24ndCB3b3JrIChzZWUgIzUyMTAyKS5cbiAgICAvLyBOb3RlOiB3ZSBkb24ndCBhbGxvY2F0ZSBiaW5kaW5nIHNsb3RzIGZvciB0aGlzIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSBpdHMgdmFsdWUgaXNuJ3Qgc3RvcmVkIGluIHRoZSBMVmlldy5cbiAgICBjb25zdCB2YWx1ZSA9IGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuXG4gICAgLy8gYGFkdmFuY2UoeCk7IHJlcGVhdGVyKGl0ZXJhYmxlKWBcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGJsb2NrSW5kZXgsIGJsb2NrLnNvdXJjZVNwYW4sIFIzLnJlcGVhdGVyLCAoKSA9PiBbdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKV0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbXB1dGVkTG9vcFZhcmlhYmxlcyhibG9jazogdC5Gb3JMb29wQmxvY2ssIGJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlKTogdm9pZCB7XG4gICAgY29uc3QgbGV2ZWwgPSBiaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoYmxvY2ssIHNjb3BlLCByZXRyaWV2YWxMZXZlbCwgJyRpbmRleCcpXG4gICAgICAgICAgLm1vZHVsbyhvLmxpdGVyYWwoMikpXG4gICAgICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuICAgIH0pO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCAoc2NvcGUsIHJldHJpZXZhbExldmVsKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKGJsb2NrLCBzY29wZSwgcmV0cmlldmFsTGV2ZWwsICckaW5kZXgnKVxuICAgICAgICAgIC5tb2R1bG8oby5saXRlcmFsKDIpKVxuICAgICAgICAgIC5pZGVudGljYWwoby5saXRlcmFsKDApKTtcbiAgICB9KTtcblxuICAgIGJpbmRpbmdTY29wZS5zZXQobGV2ZWwsIGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoYmxvY2ssIHNjb3BlLCByZXRyaWV2YWxMZXZlbCwgJyRpbmRleCcpXG4gICAgICAgICAgLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuICAgIH0pO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLCAoc2NvcGUsIHJldHJpZXZhbExldmVsKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGluZGV4Jyk7XG4gICAgICBjb25zdCBjb3VudCA9IHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGNvdW50Jyk7XG4gICAgICByZXR1cm4gaW5kZXguaWRlbnRpY2FsKGNvdW50Lm1pbnVzKG8ubGl0ZXJhbCgxKSkpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKG5hbWU6IHN0cmluZywgbGV2ZWw6IG51bWJlcik6IHN0cmluZyB7XG4gICAgLy8gV2UgdXNlIHRoZSBgybVgIGhlcmUgdG8gZW5zdXJlIHRoYXQgdGhlcmUgYXJlIG5vIG5hbWUgY29uZmxpY3RzIHdpdGggdXNlci1kZWZpbmVkIHZhcmlhYmxlcy5cbiAgICByZXR1cm4gYMm1JHtuYW1lfV8ke2xldmVsfWA7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgbmFtZSBvZiBhIGZvciBsb29wIHZhcmlhYmxlIGF0IGEgc3BlY2lmaWMgYmluZGluZyBsZXZlbC4gVGhpcyBhbGxvd3MgdXMgdG8gbG9va1xuICAgKiB1cCBpbXBsaWNpdGx5IHNoYWRvd2VkIHZhcmlhYmxlcyBsaWtlIGAkaW5kZXhgIGFuZCBgJGNvdW50YCBhdCBhIHNwZWNpZmljIGxldmVsLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKFxuICAgICAgYmxvY2s6IHQuRm9yTG9vcEJsb2NrLCBzY29wZTogQmluZGluZ1Njb3BlLCByZXRyaWV2YWxMZXZlbDogbnVtYmVyLFxuICAgICAgbmFtZToga2V5b2YgdC5Gb3JMb29wQmxvY2tDb250ZXh0KTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBzY29wZU5hbWUgPSBzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsID9cbiAgICAgICAgYmxvY2suY29udGV4dFZhcmlhYmxlc1tuYW1lXS5uYW1lIDpcbiAgICAgICAgdGhpcy5nZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKG5hbWUsIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2NvcGUuZ2V0KHNjb3BlTmFtZSkhO1xuICB9XG5cbiAgcHJpdmF0ZSBvcHRpbWl6ZVRyYWNrQnlGdW5jdGlvbihibG9jazogdC5Gb3JMb29wQmxvY2spIHtcbiAgICBjb25zdCBpbmRleExvY2FsTmFtZSA9IGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWU7XG4gICAgY29uc3QgaXRlbU5hbWUgPSBibG9jay5pdGVtLm5hbWU7XG4gICAgY29uc3QgYXN0ID0gYmxvY2sudHJhY2tCeS5hc3Q7XG5cbiAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIGAkaW5kZXhgIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJbmRleGAuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgIGFzdC5uYW1lID09PSBpbmRleExvY2FsTmFtZSkge1xuICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMucmVwZWF0ZXJUcmFja0J5SW5kZXgpLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IGZhbHNlfTtcbiAgICB9XG5cbiAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIHRoZSBpdGVtIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJZGVudGl0eWAuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgIGFzdC5uYW1lID09PSBpdGVtTmFtZSkge1xuICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMucmVwZWF0ZXJUcmFja0J5SWRlbnRpdHkpLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IGZhbHNlfTtcbiAgICB9XG5cbiAgICAvLyBUb3AtbGV2ZWwgY2FsbHMgaW4gdGhlIGZvcm0gb2YgYGZuKCRpbmRleCwgaXRlbSlgIGNhbiBiZSBwYXNzZWQgaW4gZGlyZWN0bHkuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIENhbGwgJiYgYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmXG4gICAgICAgIGFzdC5yZWNlaXZlci5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0LmFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICBjb25zdCBmaXJzdElzSW5kZXggPSBhc3QuYXJnc1swXSBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJlxuICAgICAgICAgIGFzdC5hcmdzWzBdLnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlciAmJiBhc3QuYXJnc1swXS5uYW1lID09PSBpbmRleExvY2FsTmFtZTtcbiAgICAgIGNvbnN0IHNlY29uZElzSXRlbSA9IGFzdC5hcmdzWzFdIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmXG4gICAgICAgICAgYXN0LmFyZ3NbMV0ucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmIGFzdC5hcmdzWzFdLm5hbWUgPT09IGl0ZW1OYW1lO1xuXG4gICAgICBpZiAoZmlyc3RJc0luZGV4ICYmIHNlY29uZElzSXRlbSkge1xuICAgICAgICAvLyBJZiB3ZSdyZSBpbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCwgd2UgY2FuIGFjY2VzcyBkaXJlY3RseSB0aHJvdWdoIGBjdHhgLFxuICAgICAgICAvLyBvdGhlcndpc2Ugd2UgaGF2ZSB0byBnZXQgYSBob2xkIG9mIHRoZSBjb21wb25lbnQgdGhyb3VnaCBgY29tcG9uZW50SW5zdGFuY2UoKWAuXG4gICAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5sZXZlbCA9PT0gMCA/IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBvLkV4dGVybmFsRXhwcihSMy5jb21wb25lbnRJbnN0YW5jZSkuY2FsbEZuKFtdKTtcbiAgICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiByZWNlaXZlci5wcm9wKGFzdC5yZWNlaXZlci5uYW1lKSwgdXNlc0NvbXBvbmVudEluc3RhbmNlOiBmYWxzZX07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVRyYWNrQnlGdW5jdGlvbihibG9jazogdC5Gb3JMb29wQmxvY2spOiB7XG4gICAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLFxuICAgIHVzZXNDb21wb25lbnRJbnN0YW5jZTogYm9vbGVhbixcbiAgfSB7XG4gICAgY29uc3Qgb3B0aW1pemVkRm4gPSB0aGlzLm9wdGltaXplVHJhY2tCeUZ1bmN0aW9uKGJsb2NrKTtcblxuICAgIC8vIElmIHRoZSB0cmFja2luZyBmdW5jdGlvbiBjYW4gYmUgb3B0aW1pemVkLCB3ZSBkb24ndCBuZWVkIGFueSBmdXJ0aGVyIHByb2Nlc3NpbmcuXG4gICAgaWYgKG9wdGltaXplZEZuICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gb3B0aW1pemVkRm47XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dFZhcnMgPSBibG9jay5jb250ZXh0VmFyaWFibGVzO1xuICAgIGNvbnN0IHNjb3BlID0gbmV3IFRyYWNrQnlCaW5kaW5nU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLCB7XG4gICAgICAvLyBBbGlhcyBgJGluZGV4YCBhbmQgdGhlIGl0ZW0gbmFtZSB0byBgJGluZGV4YCBhbmQgYCRpdGVtYCByZXNwZWN0aXZlbHkuXG4gICAgICAvLyBUaGlzIGFsbG93cyB1cyB0byByZXVzZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG1heSBoYXZlIGRpZmZlcmVudCBpdGVtIG5hbWVzLFxuICAgICAgLy8gYnV0IGFyZSBvdGhlcndpc2UgaWRlbnRpY2FsLlxuICAgICAgW2NvbnRleHRWYXJzLiRpbmRleC5uYW1lXTogJyRpbmRleCcsXG4gICAgICBbYmxvY2suaXRlbS5uYW1lXTogJyRpdGVtJyxcblxuICAgICAgLy8gQWNjZXNzaW5nIHRoZXNlIHZhcmlhYmxlcyBpbiBhIHRyYWNraW5nIGZ1bmN0aW9uIHdpbGwgcmVzdWx0IGluIGEgdGVtcGxhdGUgZGlhZ25vc3RpYy5cbiAgICAgIC8vIFdlIGRlZmluZSB0aGVtIGFzIGdsb2JhbHMgc28gdGhhdCB0aGVpciBhY2Nlc3NlcyBhcmUgcHJlc2VydmVkIHZlcmJhdGltIGluc3RlYWQgb2YgYmVpbmdcbiAgICAgIC8vIHJld3JpdHRlbiB0byB0aGUgYWN0dWFsIGFjY2Vzc2VzLlxuICAgICAgW2NvbnRleHRWYXJzLiRjb3VudC5uYW1lXTogY29udGV4dFZhcnMuJGNvdW50Lm5hbWUsXG4gICAgICBbY29udGV4dFZhcnMuJGZpcnN0Lm5hbWVdOiBjb250ZXh0VmFycy4kZmlyc3QubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kbGFzdC5uYW1lXTogY29udGV4dFZhcnMuJGxhc3QubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kZXZlbi5uYW1lXTogY29udGV4dFZhcnMuJGV2ZW4ubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kb2RkLm5hbWVdOiBjb250ZXh0VmFycy4kb2RkLm5hbWUsXG4gICAgfSk7XG4gICAgY29uc3QgcGFyYW1zID0gW25ldyBvLkZuUGFyYW0oJyRpbmRleCcpLCBuZXcgby5GblBhcmFtKCckaXRlbScpXTtcbiAgICBjb25zdCBzdG10cyA9IGNvbnZlcnRQdXJlQ29tcG9uZW50U2NvcGVGdW5jdGlvbihcbiAgICAgICAgYmxvY2sudHJhY2tCeS5hc3QsIHNjb3BlLCBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksICd0cmFjaycpO1xuICAgIGNvbnN0IHVzZXNDb21wb25lbnRJbnN0YW5jZSA9IHNjb3BlLmdldENvbXBvbmVudEFjY2Vzc0NvdW50KCkgPiAwO1xuICAgIGxldCBmbjogby5BcnJvd0Z1bmN0aW9uRXhwcnxvLkZ1bmN0aW9uRXhwcjtcblxuICAgIGlmICghdXNlc0NvbXBvbmVudEluc3RhbmNlICYmIHN0bXRzLmxlbmd0aCA9PT0gMSAmJiBzdG10c1swXSBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgICAgZm4gPSBvLmFycm93Rm4ocGFyYW1zLCBzdG10c1swXS5leHByKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIGxhc3Qgc3RhdGVtZW50IGlzIHJldHVybmVkIGltcGxpY2l0bHkuXG4gICAgICBpZiAoc3RtdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gc3RtdHNbc3RtdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIGlmIChsYXN0U3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgICAgICAgc3RtdHNbc3RtdHMubGVuZ3RoIC0gMV0gPSBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobGFzdFN0YXRlbWVudC5leHByKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gVGhpcyBoYXMgdG8gYmUgYSBmdW5jdGlvbiBleHByZXNzaW9uLCBiZWNhdXNlIGAuYmluZGAgZG9lc24ndCB3b3JrIG9uIGFycm93IGZ1bmN0aW9ucy5cbiAgICAgIGZuID0gby5mbihwYXJhbXMsIHN0bXRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZXhwcmVzc2lvbjogdGhpcy5jb25zdGFudFBvb2wuZ2V0U2hhcmVkRnVuY3Rpb25SZWZlcmVuY2UoZm4sICdfZm9yVHJhY2snKSxcbiAgICAgIHVzZXNDb21wb25lbnRJbnN0YW5jZSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGF0YUluZGV4O1xuICB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICB9XG5cbiAgZ2V0Q29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbnN0YW50cztcbiAgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gO1xuICB9XG5cbiAgcHJpdmF0ZSB0ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3MoXG4gICAgICB0ZW1wbGF0ZUluZGV4OiBudW1iZXIsIGF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10pIHtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBPbWl0PEluc3RydWN0aW9uLCAncmVmZXJlbmNlJz5bXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBpbnB1dCBvZiBhdHRycykge1xuICAgICAgaWYgKCEoaW5wdXQgaW5zdGFuY2VvZiB0LkJvdW5kQXR0cmlidXRlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIC8vIFBhcmFtcyB0eXBpY2FsbHkgY29udGFpbiBhdHRyaWJ1dGUgbmFtZXNwYWNlIGFuZCB2YWx1ZSBzYW5pdGl6ZXIsIHdoaWNoIGlzIGFwcGxpY2FibGVcbiAgICAgICAgLy8gZm9yIHJlZ3VsYXIgSFRNTCBlbGVtZW50cywgYnV0IG5vdCBhcHBsaWNhYmxlIGZvciA8bmctdGVtcGxhdGU+IChzaW5jZSBwcm9wcyBhY3QgYXNcbiAgICAgICAgLy8gaW5wdXRzIHRvIGRpcmVjdGl2ZXMpLCBzbyBrZWVwIHBhcmFtcyBhcnJheSBlbXB0eS5cbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBjYXNlXG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgdGVtcGxhdGVJbmRleCwgaW5wdXQubmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCIgY2FzZVxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIHNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgcGFyYW1zT3JGbjogZ2V0QmluZGluZ0Z1bmN0aW9uUGFyYW1zKCgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksIGlucHV0Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgcHJvcGVydHlCaW5kaW5nIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCBwcm9wZXJ0eUJpbmRpbmcuc3BhbiwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZy5wYXJhbXNPckZuKTtcbiAgICB9XG4gIH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiBJbnN0cnVjdGlvbltdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogSW5zdHJ1Y3Rpb25QYXJhbXMsIHByZXBlbmQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuICAgIGZuc1twcmVwZW5kID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSh7c3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZufSk7XG4gIH1cblxuICBwcml2YXRlIHByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBlbGVtZW50SW5kZXg6IG51bWJlciwgaW5zdHJ1Y3Rpb246IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsKSB7XG4gICAgbGV0IGFsbG9jYXRlQmluZGluZ1Nsb3RzID0gMDtcbiAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGZvciAoY29uc3QgY2FsbCBvZiBpbnN0cnVjdGlvbi5jYWxscykge1xuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90cyArPSBjYWxsLmFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgICBlbGVtZW50SW5kZXgsIGNhbGwuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgICAgKCkgPT4gY2FsbC5wYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gKGNhbGwuc3VwcG9ydHNJbnRlcnBvbGF0aW9uICYmIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkpIGFzIG8uRXhwcmVzc2lvbltdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgcGFyYW1zT3JGbj86IEluc3RydWN0aW9uUGFyYW1zLFxuICAgICAgcHJlcGVuZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10sIHByZXBlbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogSW5zdHJ1Y3Rpb25QYXJhbXMpIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleCwgc3Bhbik7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHBhcmFtc09yRm4/OiBJbnN0cnVjdGlvblBhcmFtcykge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBZHZhbmNlSW5zdHJ1Y3Rpb25JZk5lY2Vzc2FyeShub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBpZiAobm9kZUluZGV4ICE9PSB0aGlzLl9jdXJyZW50SW5kZXgpIHtcbiAgICAgIGNvbnN0IGRlbHRhID0gbm9kZUluZGV4IC0gdGhpcy5fY3VycmVudEluZGV4O1xuXG4gICAgICBpZiAoZGVsdGEgPCAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYWR2YW5jZSBpbnN0cnVjdGlvbiBjYW4gb25seSBnbyBmb3J3YXJkcycpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgUjMuYWR2YW5jZSwgW28ubGl0ZXJhbChkZWx0YSldKTtcbiAgICAgIHRoaXMuX2N1cnJlbnRJbmRleCA9IG5vZGVJbmRleDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3Qgb3JpZ2luYWxTbG90cyA9IHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IG51bVNsb3RzO1xuICAgIHJldHVybiBvcmlnaW5hbFNsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZTogQVNUfG51bGwpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gdGhlIGltcGxpY2l0IHJlY2VpdmVyLiBUaGUgaW1wbGljaXRcbiAgICogcmVjZWl2ZXIgaXMgYWx3YXlzIHRoZSByb290IGxldmVsIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIGdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGlmICh0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwcikge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwciA9IHRoaXMubGV2ZWwgPT09IDAgP1xuICAgICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9XG4gICAgICAgIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpKTtcbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuICAgIHJldHVybiB2YWxFeHByO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYSBsaXN0IG9mIGFyZ3VtZW50IGV4cHJlc3Npb25zIHRvIHBhc3MgdG8gYW4gdXBkYXRlIGluc3RydWN0aW9uIGV4cHJlc3Npb24uIEFsc28gdXBkYXRlc1xuICAgKiB0aGUgdGVtcCB2YXJpYWJsZXMgc3RhdGUgd2l0aCB0ZW1wIHZhcmlhYmxlcyB0aGF0IHdlcmUgaWRlbnRpZmllZCBhcyBuZWVkaW5nIHRvIGJlIGNyZWF0ZWRcbiAgICogd2hpbGUgdmlzaXRpbmcgdGhlIGFyZ3VtZW50cy5cbiAgICogQHBhcmFtIHZhbHVlIFRoZSBvcmlnaW5hbCBleHByZXNzaW9uIHdlIHdpbGwgYmUgcmVzb2x2aW5nIGFuIGFyZ3VtZW50cyBsaXN0IGZyb20uXG4gICAqL1xuICBwcml2YXRlIGdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlOiBJbnRlcnBvbGF0aW9uKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IHthcmdzLCBzdG10c30gPVxuICAgICAgICBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSk7XG5cbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uc3RtdHMpO1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSB2YXJpYWJsZSB0aGF0IGNhbiBiZSB1c2VkIHRvXG4gICAqIHN0b3JlIHRoZSBzdGF0ZSBiZXR3ZWVuIGNvbnRyb2wgZmxvdyBpbnN0cnVjdGlvbnMuXG4gICAqL1xuICBwcml2YXRlIGFsbG9jYXRlQ29udHJvbEZsb3dUZW1wVmFyaWFibGUoKTogby5SZWFkVmFyRXhwciB7XG4gICAgLy8gTm90ZTogdGhlIGFzc3VtcHRpb24gaGVyZSBpcyB0aGF0IHdlJ2xsIG9ubHkgbmVlZCBvbmUgdGVtcG9yYXJ5IHZhcmlhYmxlIGZvciBhbGwgY29udHJvbFxuICAgIC8vIGZsb3cgaW5zdHJ1Y3Rpb25zLiBJdCdzIGV4cGVjdGVkIHRoYXQgYW55IGluc3RydWN0aW9ucyB3aWxsIG92ZXJ3cml0ZSBpdCBiZWZvcmUgcGFzc2luZyBpdFxuICAgIC8vIGludG8gdGhlIHBhcmFtZXRlcnMuXG4gICAgaWYgKHRoaXMuX2NvbnRyb2xGbG93VGVtcFZhcmlhYmxlID09PSBudWxsKSB7XG4gICAgICBjb25zdCBuYW1lID0gYCR7dGhpcy5jb250ZXh0TmFtZX1fY29udEZsb3dUbXBgO1xuICAgICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKG5ldyBvLkRlY2xhcmVWYXJTdG10KG5hbWUpKTtcbiAgICAgIHRoaXMuX2NvbnRyb2xGbG93VGVtcFZhcmlhYmxlID0gby52YXJpYWJsZShuYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29udHJvbEZsb3dUZW1wVmFyaWFibGU7XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZXMgYWxsIGF0dHJpYnV0ZSBleHByZXNzaW9uIHZhbHVlcyBmb3IgdGhlIGBUQXR0cmlidXRlc2AgYXJyYXkuXG4gICAqXG4gICAqIFRoZSBwdXJwb3NlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gcHJvcGVybHkgY29uc3RydWN0IGFuIGF0dHJpYnV0ZXMgYXJyYXkgdGhhdFxuICAgKiBpcyBwYXNzZWQgaW50byB0aGUgYGVsZW1lbnRTdGFydGAgKG9yIGp1c3QgYGVsZW1lbnRgKSBmdW5jdGlvbnMuIEJlY2F1c2UgdGhlcmVcbiAgICogYXJlIG1hbnkgZGlmZmVyZW50IHR5cGVzIG9mIGF0dHJpYnV0ZXMsIHRoZSBhcnJheSBuZWVkcyB0byBiZSBjb25zdHJ1Y3RlZCBpbiBhXG4gICAqIHNwZWNpYWwgd2F5IHNvIHRoYXQgYGVsZW1lbnRTdGFydGAgY2FuIHByb3Blcmx5IGV2YWx1YXRlIHRoZW0uXG4gICAqXG4gICAqIFRoZSBmb3JtYXQgbG9va3MgbGlrZSB0aGlzOlxuICAgKlxuICAgKiBgYGBcbiAgICogYXR0cnMgPSBbcHJvcCwgdmFsdWUsIHByb3AyLCB2YWx1ZTIsXG4gICAqICAgUFJPSkVDVF9BUywgc2VsZWN0b3IsXG4gICAqICAgQ0xBU1NFUywgY2xhc3MxLCBjbGFzczIsXG4gICAqICAgU1RZTEVTLCBzdHlsZTEsIHZhbHVlMSwgc3R5bGUyLCB2YWx1ZTIsXG4gICAqICAgQklORElOR1MsIG5hbWUxLCBuYW1lMiwgbmFtZTMsXG4gICAqICAgVEVNUExBVEUsIG5hbWU0LCBuYW1lNSwgbmFtZTYsXG4gICAqICAgSTE4TiwgbmFtZTcsIG5hbWU4LCAuLi5dXG4gICAqIGBgYFxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBmdW5jdGlvbiB3aWxsIGZ1bGx5IGlnbm9yZSBhbGwgc3ludGhldGljIChAZm9vKSBhdHRyaWJ1dGUgdmFsdWVzXG4gICAqIGJlY2F1c2UgdGhvc2UgdmFsdWVzIGFyZSBpbnRlbmRlZCB0byBhbHdheXMgYmUgZ2VuZXJhdGVkIGFzIHByb3BlcnR5IGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCByZW5kZXJBdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSwgaW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10sXG4gICAgICBvdXRwdXRzOiB0LkJvdW5kRXZlbnRbXSwgc3R5bGVzPzogU3R5bGluZ0J1aWxkZXIsXG4gICAgICB0ZW1wbGF0ZUF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10gPSBbXSxcbiAgICAgIGJvdW5kSTE4bkF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBhbHJlYWR5U2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGF0dHJFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgbmdQcm9qZWN0QXNBdHRyOiB0LlRleHRBdHRyaWJ1dGV8dW5kZWZpbmVkO1xuXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIHJlbmRlckF0dHJpYnV0ZXMpIHtcbiAgICAgIGlmIChhdHRyLm5hbWUgPT09IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FKSB7XG4gICAgICAgIG5nUHJvamVjdEFzQXR0ciA9IGF0dHI7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGUgdGhhdCBzdGF0aWMgaTE4biBhdHRyaWJ1dGVzIGFyZW4ndCBpbiB0aGUgaTE4biBhcnJheSxcbiAgICAgIC8vIGJlY2F1c2UgdGhleSdyZSB0cmVhdGVkIGluIHRoZSBzYW1lIHdheSBhcyByZWd1bGFyIGF0dHJpYnV0ZXMuXG4gICAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICAgIC8vIFdoZW4gaTE4biBhdHRyaWJ1dGVzIGFyZSBwcmVzZW50IG9uIGVsZW1lbnRzIHdpdGggc3RydWN0dXJhbCBkaXJlY3RpdmVzXG4gICAgICAgIC8vIChlLmcuIGA8ZGl2ICpuZ0lmIHRpdGxlPVwiSGVsbG9cIiBpMThuLXRpdGxlPmApLCB3ZSB3YW50IHRvIGF2b2lkIGdlbmVyYXRpbmdcbiAgICAgICAgLy8gZHVwbGljYXRlIGkxOG4gdHJhbnNsYXRpb24gYmxvY2tzIGZvciBgybXJtXRlbXBsYXRlYCBhbmQgYMm1ybVlbGVtZW50YCBpbnN0cnVjdGlvblxuICAgICAgICAvLyBhdHRyaWJ1dGVzLiBTbyB3ZSBkbyBhIGNhY2hlIGxvb2t1cCB0byBzZWUgaWYgc3VpdGFibGUgaTE4biB0cmFuc2xhdGlvbiBibG9ja1xuICAgICAgICAvLyBhbHJlYWR5IGV4aXN0cy5cbiAgICAgICAgY29uc3Qge2kxOG5WYXJSZWZzQ2FjaGV9ID0gdGhpcy5fY29uc3RhbnRzO1xuICAgICAgICBsZXQgaTE4blZhclJlZjogby5SZWFkVmFyRXhwcjtcbiAgICAgICAgaWYgKGkxOG5WYXJSZWZzQ2FjaGUuaGFzKGF0dHIuaTE4bikpIHtcbiAgICAgICAgICBpMThuVmFyUmVmID0gaTE4blZhclJlZnNDYWNoZS5nZXQoYXR0ci5pMThuKSE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaTE4blZhclJlZiA9IHRoaXMuaTE4blRyYW5zbGF0ZShhdHRyLmkxOG4gYXMgaTE4bi5NZXNzYWdlKTtcbiAgICAgICAgICBpMThuVmFyUmVmc0NhY2hlLnNldChhdHRyLmkxOG4sIGkxOG5WYXJSZWYpO1xuICAgICAgICB9XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCBpMThuVmFyUmVmKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKFxuICAgICAgICAgICAgLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGF0dHIubmFtZSksIHRydXN0ZWRDb25zdEF0dHJpYnV0ZShlbGVtZW50TmFtZSwgYXR0cikpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEtlZXAgbmdQcm9qZWN0QXMgbmV4dCB0byB0aGUgb3RoZXIgbmFtZSwgdmFsdWUgcGFpcnMgc28gd2UgY2FuIHZlcmlmeSB0aGF0IHdlIG1hdGNoXG4gICAgLy8gbmdQcm9qZWN0QXMgbWFya2VyIGluIHRoZSBhdHRyaWJ1dGUgbmFtZSBzbG90LlxuICAgIGlmIChuZ1Byb2plY3RBc0F0dHIpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldE5nUHJvamVjdEFzTGl0ZXJhbChuZ1Byb2plY3RBc0F0dHIpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRBdHRyRXhwcihrZXk6IHN0cmluZ3xudW1iZXIsIHZhbHVlPzogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCFhbHJlYWR5U2Vlbi5oYXMoa2V5KSkge1xuICAgICAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhrZXkpKTtcbiAgICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIGF0dHJFeHBycy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICBhbHJlYWR5U2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGtleSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGl0J3MgaW1wb3J0YW50IHRoYXQgdGhpcyBvY2N1cnMgYmVmb3JlIEJJTkRJTkdTIGFuZCBURU1QTEFURSBiZWNhdXNlIG9uY2UgYGVsZW1lbnRTdGFydGBcbiAgICAvLyBjb21lcyBhY3Jvc3MgdGhlIEJJTkRJTkdTIG9yIFRFTVBMQVRFIG1hcmtlcnMgdGhlbiBpdCB3aWxsIGNvbnRpbnVlIHJlYWRpbmcgZWFjaCB2YWx1ZSBhc1xuICAgIC8vIGFzIHNpbmdsZSBwcm9wZXJ0eSB2YWx1ZSBjZWxsIGJ5IGNlbGwuXG4gICAgaWYgKHN0eWxlcykge1xuICAgICAgc3R5bGVzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyRXhwcnMpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dHMubGVuZ3RoIHx8IG91dHB1dHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBhdHRyc0xlbmd0aEJlZm9yZUlucHV0cyA9IGF0dHJFeHBycy5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzW2ldO1xuICAgICAgICAvLyBXZSBkb24ndCB3YW50IHRoZSBhbmltYXRpb24gYW5kIGF0dHJpYnV0ZSBiaW5kaW5ncyBpbiB0aGVcbiAgICAgICAgLy8gYXR0cmlidXRlcyBhcnJheSBzaW5jZSB0aGV5IGFyZW4ndCB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgICAgIGlmIChpbnB1dC50eXBlICE9PSBCaW5kaW5nVHlwZS5BbmltYXRpb24gJiYgaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQXR0cmlidXRlKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIoaW5wdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IG91dHB1dHNbaV07XG4gICAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKG91dHB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0aGlzIGlzIGEgY2hlYXAgd2F5IG9mIGFkZGluZyB0aGUgbWFya2VyIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpbnB1dC9vdXRwdXRcbiAgICAgIC8vIHZhbHVlcyBoYXZlIGJlZW4gZmlsdGVyZWQgKGJ5IG5vdCBpbmNsdWRpbmcgdGhlIGFuaW1hdGlvbiBvbmVzKSBhbmQgYWRkZWRcbiAgICAgIC8vIHRvIHRoZSBleHByZXNzaW9ucy4gVGhlIG1hcmtlciBpcyBpbXBvcnRhbnQgYmVjYXVzZSBpdCB0ZWxscyB0aGUgcnVudGltZVxuICAgICAgLy8gY29kZSB0aGF0IHRoaXMgaXMgd2hlcmUgYXR0cmlidXRlcyB3aXRob3V0IHZhbHVlcyBzdGFydC4uLlxuICAgICAgaWYgKGF0dHJFeHBycy5sZW5ndGggIT09IGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzKSB7XG4gICAgICAgIGF0dHJFeHBycy5zcGxpY2UoYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMsIDAsIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZW1wbGF0ZUF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSk7XG4gICAgICB0ZW1wbGF0ZUF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICBpZiAoYm91bmRJMThuQXR0cnMubGVuZ3RoKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuSTE4bikpO1xuICAgICAgYm91bmRJMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIGFkZFRvQ29uc3RzKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbEV4cHIge1xuICAgIGlmIChvLmlzTnVsbChleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnN0cyA9IHRoaXMuX2NvbnN0YW50cy5jb25zdEV4cHJlc3Npb25zO1xuXG4gICAgLy8gVHJ5IHRvIHJldXNlIGEgbGl0ZXJhbCB0aGF0J3MgYWxyZWFkeSBpbiB0aGUgYXJyYXksIGlmIHBvc3NpYmxlLlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29uc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoY29uc3RzW2ldLmlzRXF1aXZhbGVudChleHByZXNzaW9uKSkge1xuICAgICAgICByZXR1cm4gby5saXRlcmFsKGkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmxpdGVyYWwoY29uc3RzLnB1c2goZXhwcmVzc2lvbikgLSAxKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkQXR0cnNUb0NvbnN0cyhhdHRyczogby5FeHByZXNzaW9uW118bnVsbCk6IG8uTGl0ZXJhbEV4cHIge1xuICAgIHJldHVybiBhdHRycyAhPT0gbnVsbCAmJiBhdHRycy5sZW5ndGggPiAwID8gdGhpcy5hZGRUb0NvbnN0cyhvLmxpdGVyYWxBcnIoYXR0cnMpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLlRZUEVEX05VTExfRVhQUjtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVJlZnNBcnJheShyZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAoIXJlZmVyZW5jZXMgfHwgcmVmZXJlbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCByZWZzUGFyYW0gPSByZWZlcmVuY2VzLmZsYXRNYXAocmVmZXJlbmNlID0+IHtcbiAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgICByZXRyaWV2YWxMZXZlbCwgcmVmZXJlbmNlLm5hbWUsIGxocyxcbiAgICAgICAgICBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIGUuZy4gbmV4dENvbnRleHQoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcmVmZXJlbmNlKDEpO1xuICAgICAgICAgICAgY29uc3QgcmVmRXhwciA9IGxocy5zZXQoby5pbXBvcnRFeHByKFIzLnJlZmVyZW5jZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgIH0sIHRydWUpO1xuXG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGFzTGl0ZXJhbChyZWZzUGFyYW0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIodGFnTmFtZTogc3RyaW5nLCBvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCwgaW5kZXg6IG51bWJlcik6XG4gICAgICAoKSA9PiBvLkV4cHJlc3Npb25bXSB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID0gb3V0cHV0QXN0Lm5hbWU7XG4gICAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gb3V0cHV0QXN0LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICAgIC8vIHN5bnRoZXRpYyBAbGlzdGVuZXIuZm9vIHZhbHVlcyBhcmUgdHJlYXRlZCB0aGUgZXhhY3Qgc2FtZSBhcyBhcmUgc3RhbmRhcmQgbGlzdGVuZXJzXG4gICAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGV2ZW50TmFtZSwgb3V0cHV0QXN0LnBoYXNlISkgOlxuICAgICAgICAgIHNhbml0aXplSWRlbnRpZmllcihldmVudE5hbWUpO1xuICAgICAgY29uc3QgaGFuZGxlck5hbWUgPSBgJHt0aGlzLnRlbXBsYXRlTmFtZX1fJHt0YWdOYW1lfV8ke2JpbmRpbmdGbk5hbWV9XyR7aW5kZXh9X2xpc3RlbmVyYDtcbiAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5fYmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKFxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5iaW5kaW5nTGV2ZWwsIEVWRU5UX0JJTkRJTkdfU0NPUEVfR0xPQkFMUyk7XG4gICAgICByZXR1cm4gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKG91dHB1dEFzdCwgaGFuZGxlck5hbWUsIHNjb3BlKTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBfcGlwZUJpbmRFeHByczogQ2FsbFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgb3ZlcnJpZGUgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIG9uZSBzbG90IHBlciBwaXBlIGFyZ3VtZW50XG4gICAgY29uc3QgcHVyZUZ1bmN0aW9uU2xvdCA9IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cygyICsgcGlwZS5hcmdzLmxlbmd0aCk7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChcbiAgICAgICAgcGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHBpcGUubmFtZVNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuKSxcbiAgICAgICAgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcGlwZUJpbmRpbmdDYWxsSW5mbyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGlkZW50aWZpZXIpKTtcbiAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtwaXBlLmV4cCwgLi4ucGlwZS5hcmdzXTtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzOiBBU1RbXSA9IGlzVmFyTGVuZ3RoID9cbiAgICAgICAgdGhpcy52aXNpdEFsbChbbmV3IExpdGVyYWxBcnJheShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgYXJncyldKSA6XG4gICAgICAgIHRoaXMudmlzaXRBbGwoYXJncyk7XG5cbiAgICBjb25zdCBwaXBlQmluZEV4cHIgPSBuZXcgQ2FsbChcbiAgICAgICAgcGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHRhcmdldCxcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBzbG90KSxcbiAgICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgcHVyZUZ1bmN0aW9uU2xvdCksXG4gICAgICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICAgICAgXSxcbiAgICAgICAgbnVsbCEpO1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMucHVzaChwaXBlQmluZEV4cHIpO1xuICAgIHJldHVybiBwaXBlQmluZEV4cHI7XG4gIH1cblxuICB1cGRhdGVQaXBlU2xvdE9mZnNldHMoYmluZGluZ1Nsb3RzOiBudW1iZXIpIHtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLmZvckVhY2goKHBpcGU6IENhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhcnJheS5zcGFuLCBhcnJheS5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgICAgIC8vIHZhbHVlcy5cbiAgICAgICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCBtYXAuc291cmNlU3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG4vLyBlLmcuIHgoMik7XG5mdW5jdGlvbiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsRGlmZjogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5uZXh0Q29udGV4dClcbiAgICAgIC5jYWxsRm4ocmVsYXRpdmVMZXZlbERpZmYgPiAxID8gW28ubGl0ZXJhbChyZWxhdGl2ZUxldmVsRGlmZildIDogW10pO1xufVxuXG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByfG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzdGFydFNsb3QpLCBsaXRlcmFsRmFjdG9yeV07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG50eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4gby5TdGF0ZW1lbnRbXTtcblxuLyoqXG4gKiBGdW5jdGlvbiB0aGF0IGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZC4gSXQgYWxsb3dzIGZvciB0aGUgdmFyaWFibGUgdG8gYmVcbiAqIHJlbmFtZWQgZGVwZW5kaW5nIG9uIGl0cyBsb2NhdGlvbi5cbiAqL1xudHlwZSBMb2NhbFZhclJlZkNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJldHJpZXZhbExldmVsOiBudW1iZXIpID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqIFRoZSBwcmVmaXggdXNlZCB0byBnZXQgYSBzaGFyZWQgY29udGV4dCBpbiBCaW5kaW5nU2NvcGUncyBtYXAuICovXG5jb25zdCBTSEFSRURfQ09OVEVYVF9LRVkgPSAnJCRzaGFyZWRfY3R4JCQnO1xuXG4vKipcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSBuZXh0Q29udGV4dCgyKS4kaW1wbGljaXRgLlxuICogLSBrZXkgdG8gdGhlIG1hcCBpcyB0aGUgc3RyaW5nIGxpdGVyYWwgYFwiYWJjXCJgLlxuICogLSB2YWx1ZSBgcmV0cmlldmFsTGV2ZWxgIGlzIHRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZCwgd2hpY2ggaXMgMiBsZXZlbHNcbiAqIHVwIGluIGV4YW1wbGUuXG4gKiAtIHZhbHVlIGBsaHNgIGlzIHRoZSBsZWZ0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhYmNgLlxuICogLSB2YWx1ZSBgZGVjbGFyZUxvY2FsQ2FsbGJhY2tgIGlzIGEgY2FsbGJhY2sgdGhhdCBpcyBpbnZva2VkIHdoZW4gZGVjbGFyaW5nIHRoZSBsb2NhbC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVgIGlzIHRydWUgaWYgdGhpcyB2YWx1ZSBuZWVkcyB0byBiZSBkZWNsYXJlZC5cbiAqIC0gdmFsdWUgYGxvY2FsUmVmYCBpcyB0cnVlIGlmIHdlIGFyZSBzdG9yaW5nIGEgbG9jYWwgcmVmZXJlbmNlXG4gKiAtIHZhbHVlIGBwcmlvcml0eWAgZGljdGF0ZXMgdGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXIgZGVjbGFyYXRpb24gY29tcGFyZWRcbiAqIHRvIG90aGVyIHZhciBkZWNsYXJhdGlvbnMgb24gdGhlIHNhbWUgcmV0cmlldmFsIGxldmVsLiBGb3IgZXhhbXBsZSwgaWYgdGhlcmUgaXMgYVxuICogY29udGV4dCB2YXJpYWJsZSBhbmQgYSBsb2NhbCByZWYgYWNjZXNzaW5nIHRoZSBzYW1lIHBhcmVudCB2aWV3LCB0aGUgY29udGV4dCB2YXJcbiAqIGRlY2xhcmF0aW9uIHNob3VsZCBhbHdheXMgY29tZSBiZWZvcmUgdGhlIGxvY2FsIHJlZiBkZWNsYXJhdGlvbi5cbiAqL1xudHlwZSBCaW5kaW5nRGF0YSA9IHtcbiAgcmV0cmlldmFsTGV2ZWw6IG51bWJlcjsgbGhzOiBvLkV4cHJlc3Npb24gfCBMb2NhbFZhclJlZkNhbGxiYWNrO1xuICBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrOyBkZWNsYXJlOiBib29sZWFuOyBwcmlvcml0eTogbnVtYmVyO1xufTtcblxuLyoqXG4gKiBUaGUgc29ydGluZyBwcmlvcml0eSBvZiBhIGxvY2FsIHZhcmlhYmxlIGRlY2xhcmF0aW9uLiBIaWdoZXIgbnVtYmVyc1xuICogbWVhbiB0aGUgZGVjbGFyYXRpb24gd2lsbCBhcHBlYXIgZmlyc3QgaW4gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICovXG5jb25zdCBlbnVtIERlY2xhcmF0aW9uUHJpb3JpdHkge1xuICBERUZBVUxUID0gMCxcbiAgQ09OVEVYVCA9IDEsXG4gIFNIQVJFRF9DT05URVhUID0gMlxufVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHVzZXNSZXN0b3JlZFZpZXdDb250ZXh0ID0gZmFsc2U7XG4gIHN0YXRpYyBjcmVhdGVSb290U2NvcGUoKTogQmluZGluZ1Njb3BlIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdTY29wZSgpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGJpbmRpbmdMZXZlbDogbnVtYmVyID0gMCwgcmVhZG9ubHkgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwsXG4gICAgICBwdWJsaWMgZ2xvYmFscz86IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKGdsb2JhbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGdsb2JhbHMpIHtcbiAgICAgICAgdGhpcy5zZXQoMCwgbmFtZSwgby52YXJpYWJsZShuYW1lKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUubGhzID09PSAnZnVuY3Rpb24nID8gdmFsdWUubGhzKHRoaXMsIHZhbHVlLnJldHJpZXZhbExldmVsKSA6IHZhbHVlLmxocztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhpcyBwb2ludCwgd2UgYXJlIGxvb2tpbmcgZm9yIGEgcHJvcGVydHkgb24gdGhlIHRvcCBsZXZlbCBjb21wb25lbnRcbiAgICAvLyAtIElmIGxldmVsID09PSAwLCB3ZSBhcmUgb24gdGhlIHRvcCBhbmQgZG9uJ3QgbmVlZCB0byByZS1kZWNsYXJlIGBjdHhgLlxuICAgIC8vIC0gSWYgbGV2ZWwgPiAwLCB3ZSBhcmUgaW4gYW4gZW1iZWRkZWQgdmlldy4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAvLyBsb2NhbCB2YXIgd2UgdXNlZCB0byBzdG9yZSB0aGUgY29tcG9uZW50IGNvbnRleHQsIGUuZy4gY29uc3QgJGNvbXAkID0geCgpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdMZXZlbCA9PT0gMCA/IG51bGwgOiB0aGlzLmdldENvbXBvbmVudFByb3BlcnR5KG5hbWUpO1xuICB9XG5cbiAgLyoqIENoZWNrcyB3aGV0aGVyIGEgdmFyaWFibGUgZXhpc3RzIGxvY2FsbHkgb24gdGhlIGN1cnJlbnQgc2NvcGUuICovXG4gIGhhc0xvY2FsKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1hcC5oYXMobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqIEBwYXJhbSBsb2NhbFJlZiBXaGV0aGVyIG9yIG5vdCB0aGlzIGlzIGEgbG9jYWwgcmVmXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uRXhwcmVzc2lvbnxMb2NhbFZhclJlZkNhbGxiYWNrLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBJbXBsZW1lbnRlZCBhcyBwYXJ0IG9mIExvY2FsUmVzb2x2ZXIuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIHJldHVybiB0aGlzLmdldChuYW1lKTtcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSEuZGVjbGFyZSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlciwgZ2xvYmFscz86IFNldDxzdHJpbmc+KTogQmluZGluZ1Njb3BlIHtcbiAgICBjb25zdCBuZXdTY29wZSA9IG5ldyBCaW5kaW5nU2NvcGUobGV2ZWwsIHRoaXMsIGdsb2JhbHMpO1xuICAgIGlmIChsZXZlbCA+IDApIG5ld1Njb3BlLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgICByZXR1cm4gbmV3U2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBvciBjcmVhdGVzIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgYW5kIHJldHVybnMgaXRzIGV4cHJlc3Npb24uIE5vdGUgdGhhdFxuICAgKiB0aGlzIGRvZXMgbm90IG1lYW4gdGhhdCB0aGUgc2hhcmVkIHZhcmlhYmxlIHdpbGwgYmUgZGVjbGFyZWQuIFZhcmlhYmxlcyBpbiB0aGVcbiAgICogYmluZGluZyBzY29wZSB3aWxsIGJlIG9ubHkgZGVjbGFyZWQgaWYgdGhleSBhcmUgdXNlZC5cbiAgICovXG4gIGdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgYmluZGluZ0tleSA9IFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsO1xuICAgIGlmICghdGhpcy5tYXAuaGFzKGJpbmRpbmdLZXkpKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbCk7XG4gICAgfVxuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHRoaXMubWFwLmdldChiaW5kaW5nS2V5KSEubGhzIGFzIG8uUmVhZFZhckV4cHI7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgYXMgby5SZWFkVmFyRXhwciA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KCk7XG4gICAgY29uc3QgbGhzID0gdHlwZW9mIGNvbXBvbmVudFZhbHVlLmxocyA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGNvbXBvbmVudFZhbHVlLmxocyh0aGlzLCBjb21wb25lbnRWYWx1ZS5yZXRyaWV2YWxMZXZlbCkgOlxuICAgICAgICBjb21wb25lbnRWYWx1ZS5saHM7XG4gICAgcmV0dXJuIG5hbWUgPT09IERJUkVDVF9DT05URVhUX1JFRkVSRU5DRSA/IGxocyA6IGxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldygpIHtcbiAgICAvLyBWaWV3IHJlc3RvcmF0aW9uIGlzIHJlcXVpcmVkIGZvciBsaXN0ZW5lciBpbnN0cnVjdGlvbnMgaW5zaWRlIGVtYmVkZGVkIHZpZXdzLCBiZWNhdXNlXG4gICAgLy8gdGhleSBvbmx5IHJ1biBpbiBjcmVhdGlvbiBtb2RlIGFuZCB0aGV5IGNhbiBoYXZlIHJlZmVyZW5jZXMgdG8gdGhlIGNvbnRleHQgb2JqZWN0LlxuICAgIC8vIElmIHRoZSBjb250ZXh0IG9iamVjdCBjaGFuZ2VzIGluIHVwZGF0ZSBtb2RlLCB0aGUgcmVmZXJlbmNlIHdpbGwgYmUgaW5jb3JyZWN0LCBiZWNhdXNlXG4gICAgLy8gaXQgd2FzIGVzdGFibGlzaGVkIGR1cmluZyBjcmVhdGlvbi5cbiAgICBpZiAodGhpcy5pc0xpc3RlbmVyU2NvcGUoKSkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCEucmVzdG9yZVZpZXdWYXJpYWJsZSA9IG8udmFyaWFibGUodGhpcy5wYXJlbnQhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50fG51bGwge1xuICAgIGlmICh0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgIGNvbnN0IHJlc3RvcmVDYWxsID0gaW52b2tlSW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKTtcbiAgICAgIC8vIEVpdGhlciBgY29uc3QgcmVzdG9yZWRDdHggPSByZXN0b3JlVmlldygkc3RhdGUkKTtgIG9yIGByZXN0b3JlVmlldygkc3RhdGUkKTtgXG4gICAgICAvLyBkZXBlbmRpbmcgb24gd2hldGhlciBpdCBpcyBiZWluZyB1c2VkLlxuICAgICAgcmV0dXJuIHRoaXMudXNlc1Jlc3RvcmVkVmlld0NvbnRleHQgP1xuICAgICAgICAgIG8udmFyaWFibGUoUkVTVE9SRURfVklFV19DT05URVhUX05BTUUpLnNldChyZXN0b3JlQ2FsbCkudG9Db25zdERlY2woKSA6XG4gICAgICAgICAgcmVzdG9yZUNhbGwudG9TdG10KCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlld1NuYXBzaG90U3RhdGVtZW50cygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyBjb25zdCAkc3RhdGUkID0gZ2V0Q3VycmVudFZpZXcoKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW1xuICAgICAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZS5zZXQoaW52b2tlSW5zdHJ1Y3Rpb24obnVsbCwgUjMuZ2V0Q3VycmVudFZpZXcsIFtdKSkudG9Db25zdERlY2woKVxuICAgICAgICBdIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50ICYmIHRoaXMucGFyZW50LmJpbmRpbmdMZXZlbCA9PT0gdGhpcy5iaW5kaW5nTGV2ZWw7XG4gIH1cblxuICB2YXJpYWJsZURlY2xhcmF0aW9ucygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBsZXQgY3VycmVudENvbnRleHRMZXZlbCA9IDA7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5tYXAudmFsdWVzKCkpXG4gICAgICAgICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgICAgICAgICAucmVkdWNlKChzdG10czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IEJpbmRpbmdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9XG4gICAgICAgICAgICAgICAgICAgICB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgICAgICAgIGN1cnJlbnRDb250ZXh0TGV2ZWwgPSBsZXZlbERpZmY7XG4gICAgICAgICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG5cbiAgaGFzUmVzdG9yZVZpZXdWYXJpYWJsZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISF0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gIH1cblxuICBub3RpZnlSZXN0b3JlZFZpZXdDb250ZXh0VXNlKCk6IHZvaWQge1xuICAgIHRoaXMudXNlc1Jlc3RvcmVkVmlld0NvbnRleHQgPSB0cnVlO1xuICB9XG59XG5cbi8qKiBCaW5kaW5nIHNjb3BlIG9mIGEgYHRyYWNrYCBmdW5jdGlvbiBpbnNpZGUgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuY2xhc3MgVHJhY2tCeUJpbmRpbmdTY29wZSBleHRlbmRzIEJpbmRpbmdTY29wZSB7XG4gIHByaXZhdGUgY29tcG9uZW50QWNjZXNzQ291bnQgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHBhcmVudFNjb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgZ2xvYmFsT3ZlcnJpZGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG4gICAgc3VwZXIocGFyZW50U2NvcGUuYmluZGluZ0xldmVsICsgMSwgcGFyZW50U2NvcGUpO1xuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICAvLyBJbnRlcmNlcHQgYW55IG92ZXJyaWRkZW4gZ2xvYmFscy5cbiAgICBpZiAodGhpcy5nbG9iYWxPdmVycmlkZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKHRoaXMuZ2xvYmFsT3ZlcnJpZGVzW25hbWVdKTtcbiAgICB9XG5cbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzLnBhcmVudDtcblxuICAgIC8vIFByZXZlbnQgYWNjZXNzZXMgb2YgdGVtcGxhdGUgdmFyaWFibGVzIG91dHNpZGUgdGhlIGBmb3JgIGxvb3AuXG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGlmIChjdXJyZW50Lmhhc0xvY2FsKG5hbWUpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIFdoZW4gdGhlIGNvbXBvbmVudCBzY29wZSBpcyBhY2Nlc3NlZCwgd2UgcmVkaXJlY3QgaXQgdGhyb3VnaCBgdGhpc2AuXG4gICAgdGhpcy5jb21wb25lbnRBY2Nlc3NDb3VudCsrO1xuICAgIHJldHVybiBvLnZhcmlhYmxlKCd0aGlzJykucHJvcChuYW1lKTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBudW1iZXIgb2YgdGltZXMgdGhlIGhvc3QgY29tcG9uZW50IGhhcyBiZWVuIGFjY2Vzc2VkIHRocm91Z2ggdGhlIHNjb3BlLiAqL1xuICBnZXRDb21wb25lbnRBY2Nlc3NDb3VudCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudEFjY2Vzc0NvdW50O1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBleHByZXNzaW9ucyBvdXQgb2YgYW4gYG5nUHJvamVjdEFzYCBhdHRyaWJ1dGVzXG4gKiB3aGljaCBjYW4gYmUgYWRkZWQgdG8gdGhlIGluc3RydWN0aW9uIHBhcmFtZXRlcnMuXG4gKi9cbmZ1bmN0aW9uIGdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyaWJ1dGU6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihhdHRyaWJ1dGUudmFsdWUpWzBdO1xuICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBhc0xpdGVyYWwocGFyc2VkUjNTZWxlY3RvcildO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHlcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgYXR0cmlidXRlXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGludGVycG9sYXRlZCB0ZXh0LlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBtb2RpZnkgaG93IGEgdGVtcGxhdGUgaXMgcGFyc2VkIGJ5IGBwYXJzZVRlbXBsYXRlKClgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlVGVtcGxhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogUHJlc2VydmUgb3JpZ2luYWwgbGluZSBlbmRpbmdzIGluc3RlYWQgb2Ygbm9ybWFsaXppbmcgJ1xcclxcbicgZW5kaW5ncyB0byAnXFxuJy5cbiAgICovXG4gIHByZXNlcnZlTGluZUVuZGluZ3M/OiBib29sZWFuO1xuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGNoYXJhY3RlcnMgdGhhdCBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBsZWFkaW5nIHRyaXZpYS5cbiAgICogTGVhZGluZyB0cml2aWEgYXJlIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGltcG9ydGFudCB0byB0aGUgZGV2ZWxvcGVyLCBhbmQgc28gc2hvdWxkIG5vdCBiZVxuICAgKiBpbmNsdWRlZCBpbiBzb3VyY2UtbWFwIHNlZ21lbnRzLiAgQSBjb21tb24gZXhhbXBsZSBpcyB3aGl0ZXNwYWNlLlxuICAgKi9cbiAgbGVhZGluZ1RyaXZpYUNoYXJzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFJlbmRlciBgJGxvY2FsaXplYCBtZXNzYWdlIGlkcyB3aXRoIGFkZGl0aW9uYWwgbGVnYWN5IG1lc3NhZ2UgaWRzLlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBkZWZhdWx0cyB0byBgdHJ1ZWAgYnV0IGluIHRoZSBmdXR1cmUgdGhlIGRlZmF1bHQgd2lsbCBiZSBmbGlwcGVkLlxuICAgKlxuICAgKiBGb3Igbm93IHNldCB0aGlzIG9wdGlvbiB0byBmYWxzZSBpZiB5b3UgaGF2ZSBtaWdyYXRlZCB0aGUgdHJhbnNsYXRpb24gZmlsZXMgdG8gdXNlIHRoZSBuZXdcbiAgICogYCRsb2NhbGl6ZWAgbWVzc2FnZSBpZCBmb3JtYXQgYW5kIHlvdSBhcmUgbm90IHVzaW5nIGNvbXBpbGUgdGltZSB0cmFuc2xhdGlvbiBtZXJnaW5nLlxuICAgKi9cbiAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYW4gZXh0ZXJuYWwgdGVtcGxhdGUgKGUuZy4gdmlhIGB0ZW1wbGF0ZVVybGApIHRoZW4gd2UgbmVlZCB0byBkZWNpZGVcbiAgICogd2hldGhlciBvciBub3QgdG8gbm9ybWFsaXplIHRoZSBsaW5lLWVuZGluZ3MgKGZyb20gYFxcclxcbmAgdG8gYFxcbmApIHdoZW4gcHJvY2Vzc2luZyBJQ1VcbiAgICogZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIElmIGB0cnVlYCB0aGVuIHdlIHdpbGwgbm9ybWFsaXplIElDVSBleHByZXNzaW9uIGxpbmUgZW5kaW5ncy5cbiAgICogVGhlIGRlZmF1bHQgaXMgYGZhbHNlYCwgYnV0IHRoaXMgd2lsbCBiZSBzd2l0Y2hlZCBpbiBhIGZ1dHVyZSBtYWpvciByZWxlYXNlLlxuICAgKi9cbiAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0byBhbHdheXMgYXR0ZW1wdCB0byBjb252ZXJ0IHRoZSBwYXJzZWQgSFRNTCBBU1QgdG8gYW4gUjMgQVNULCBkZXNwaXRlIEhUTUwgb3IgaTE4blxuICAgKiBNZXRhIHBhcnNlIGVycm9ycy5cbiAgICpcbiAgICpcbiAgICogVGhpcyBvcHRpb24gaXMgdXNlZnVsIGluIHRoZSBjb250ZXh0IG9mIHRoZSBsYW5ndWFnZSBzZXJ2aWNlLCB3aGVyZSB3ZSB3YW50IHRvIGdldCBhcyBtdWNoXG4gICAqIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlLCBkZXNwaXRlIGFueSBlcnJvcnMgaW4gdGhlIEhUTUwuIEFzIGFuIGV4YW1wbGUsIGEgdXNlciBtYXkgYmUgYWRkaW5nXG4gICAqIGEgbmV3IHRhZyBhbmQgZXhwZWN0aW5nIGF1dG9jb21wbGV0ZSBvbiB0aGF0IHRhZy4gSW4gdGhpcyBzY2VuYXJpbywgdGhlIEhUTUwgaXMgaW4gYW4gZXJyb3JlZFxuICAgKiBzdGF0ZSwgYXMgdGhlcmUgaXMgYW4gaW5jb21wbGV0ZSBvcGVuIHRhZy4gSG93ZXZlciwgd2UncmUgc3RpbGwgYWJsZSB0byBjb252ZXJ0IHRoZSBIVE1MIEFTVFxuICAgKiBub2RlcyB0byBSMyBBU1Qgbm9kZXMgaW4gb3JkZXIgdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGxhbmd1YWdlIHNlcnZpY2UuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBldmVuIHdoZW4gYHRydWVgIHRoZSBIVE1MIHBhcnNlIGFuZCBpMThuIGVycm9ycyBhcmUgc3RpbGwgYXBwZW5kZWQgdG8gdGhlIGVycm9yc1xuICAgKiBvdXRwdXQsIGJ1dCB0aGlzIGlzIGRvbmUgYWZ0ZXIgY29udmVydGluZyB0aGUgSFRNTCBBU1QgdG8gUjMgQVNULlxuICAgKi9cbiAgYWx3YXlzQXR0ZW1wdEh0bWxUb1IzQXN0Q29udmVyc2lvbj86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEluY2x1ZGUgSFRNTCBDb21tZW50IG5vZGVzIGluIGEgdG9wLWxldmVsIGNvbW1lbnRzIGFycmF5IG9uIHRoZSByZXR1cm5lZCBSMyBBU1QuXG4gICAqXG4gICAqIFRoaXMgb3B0aW9uIGlzIHJlcXVpcmVkIGJ5IHRvb2xpbmcgdGhhdCBuZWVkcyB0byBrbm93IHRoZSBsb2NhdGlvbiBvZiBjb21tZW50IG5vZGVzIHdpdGhpbiB0aGVcbiAgICogQVNULiBBIGNvbmNyZXRlIGV4YW1wbGUgaXMgQGFuZ3VsYXItZXNsaW50IHdoaWNoIHJlcXVpcmVzIHRoaXMgaW4gb3JkZXIgdG8gZW5hYmxlXG4gICAqIFwiZXNsaW50LWRpc2FibGVcIiBjb21tZW50cyB3aXRoaW4gSFRNTCB0ZW1wbGF0ZXMsIHdoaWNoIHRoZW4gYWxsb3dzIHVzZXJzIHRvIHR1cm4gb2ZmIHNwZWNpZmljXG4gICAqIHJ1bGVzIG9uIGEgY2FzZSBieSBjYXNlIGJhc2lzLCBpbnN0ZWFkIG9mIGZvciB0aGVpciB3aG9sZSBwcm9qZWN0IHdpdGhpbiBhIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgICovXG4gIGNvbGxlY3RDb21tZW50Tm9kZXM/OiBib29sZWFuO1xuXG4gIC8qKiBXaGV0aGVyIHRoZSBAIGJsb2NrIHN5bnRheCBpcyBlbmFibGVkLiAqL1xuICBlbmFibGVCbG9ja1N5bnRheD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSBpbnRvIHJlbmRlcjMgYE5vZGVgcyBhbmQgYWRkaXRpb25hbCBtZXRhZGF0YSwgd2l0aCBubyBvdGhlciBkZXBlbmRlbmNpZXMuXG4gKlxuICogQHBhcmFtIHRlbXBsYXRlIHRleHQgb2YgdGhlIHRlbXBsYXRlIHRvIHBhcnNlXG4gKiBAcGFyYW0gdGVtcGxhdGVVcmwgVVJMIHRvIHVzZSBmb3Igc291cmNlIG1hcHBpbmcgb2YgdGhlIHBhcnNlZCB0ZW1wbGF0ZVxuICogQHBhcmFtIG9wdGlvbnMgb3B0aW9ucyB0byBtb2RpZnkgaG93IHRoZSB0ZW1wbGF0ZSBpcyBwYXJzZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgb3B0aW9uczogUGFyc2VUZW1wbGF0ZU9wdGlvbnMgPSB7fSk6IFBhcnNlZFRlbXBsYXRlIHtcbiAgY29uc3Qge2ludGVycG9sYXRpb25Db25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXMsIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXR9ID0gb3B0aW9ucztcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCwge1xuICAgIGxlYWRpbmdUcml2aWFDaGFyczogTEVBRElOR19UUklWSUFfQ0hBUlMsXG4gICAgLi4ub3B0aW9ucyxcbiAgICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlLFxuICAgIHRva2VuaXplQmxvY2tzOiBvcHRpb25zLmVuYWJsZUJsb2NrU3ludGF4ID8/IHRydWUsXG4gIH0pO1xuXG4gIGlmICghb3B0aW9ucy5hbHdheXNBdHRlbXB0SHRtbFRvUjNBc3RDb252ZXJzaW9uICYmIHBhcnNlUmVzdWx0LmVycm9ycyAmJlxuICAgICAgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBwYXJzZWRUZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUgPSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgIGVycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLFxuICAgICAgbm9kZXM6IFtdLFxuICAgICAgc3R5bGVVcmxzOiBbXSxcbiAgICAgIHN0eWxlczogW10sXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdXG4gICAgfTtcbiAgICBpZiAob3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzKSB7XG4gICAgICBwYXJzZWRUZW1wbGF0ZS5jb21tZW50Tm9kZXMgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZFRlbXBsYXRlO1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgLy8gcHJvY2VzcyBpMThuIG1ldGEgaW5mb3JtYXRpb24gKHNjYW4gYXR0cmlidXRlcywgZ2VuZXJhdGUgaWRzKVxuICAvLyBiZWZvcmUgd2UgcnVuIHdoaXRlc3BhY2UgcmVtb3ZhbCBwcm9jZXNzLCBiZWNhdXNlIGV4aXN0aW5nIGkxOG5cbiAgLy8gZXh0cmFjdGlvbiBwcm9jZXNzIChuZyBleHRyYWN0LWkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIGNvbnN0IGkxOG5NZXRhVmlzaXRvciA9IG5ldyBJMThuTWV0YVZpc2l0b3IoXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovICFwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCk7XG4gIGNvbnN0IGkxOG5NZXRhUmVzdWx0ID0gaTE4bk1ldGFWaXNpdG9yLnZpc2l0QWxsV2l0aEVycm9ycyhyb290Tm9kZXMpO1xuXG4gIGlmICghb3B0aW9ucy5hbHdheXNBdHRlbXB0SHRtbFRvUjNBc3RDb252ZXJzaW9uICYmIGkxOG5NZXRhUmVzdWx0LmVycm9ycyAmJlxuICAgICAgaTE4bk1ldGFSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBwYXJzZWRUZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUgPSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgIGVycm9yczogaTE4bk1ldGFSZXN1bHQuZXJyb3JzLFxuICAgICAgbm9kZXM6IFtdLFxuICAgICAgc3R5bGVVcmxzOiBbXSxcbiAgICAgIHN0eWxlczogW10sXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdXG4gICAgfTtcbiAgICBpZiAob3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzKSB7XG4gICAgICBwYXJzZWRUZW1wbGF0ZS5jb21tZW50Tm9kZXMgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZFRlbXBsYXRlO1xuICB9XG5cbiAgcm9vdE5vZGVzID0gaTE4bk1ldGFSZXN1bHQucm9vdE5vZGVzO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3aGl0ZXNwYWNlcyBhcmUgcmVtb3ZlZCAoYmVjYXVzZSB0aGF0IG1pZ2h0IGFmZmVjdFxuICAgIC8vIGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudCkgYW5kIGZpcnN0IHBhc3MgaW5kaWNhdGVkIHRoYXQgaTE4biBjb250ZW50IGlzIHByZXNlbnQgaW4gYVxuICAgIC8vIHRlbXBsYXRlLiBEdXJpbmcgdGhpcyBwYXNzIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuXG4gICAgLy8gbWltaWMgZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyBleHRyYWN0LWkxOG4pXG4gICAgaWYgKGkxOG5NZXRhVmlzaXRvci5oYXNJMThuTWV0YSkge1xuICAgICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChcbiAgICAgICAgICBuZXcgSTE4bk1ldGFWaXNpdG9yKGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gZmFsc2UpLCByb290Tm9kZXMpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgZXJyb3JzLCBzdHlsZVVybHMsIHN0eWxlcywgbmdDb250ZW50U2VsZWN0b3JzLCBjb21tZW50Tm9kZXN9ID0gaHRtbEFzdFRvUmVuZGVyM0FzdChcbiAgICAgIHJvb3ROb2RlcywgYmluZGluZ1BhcnNlciwge2NvbGxlY3RDb21tZW50Tm9kZXM6ICEhb3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzfSk7XG4gIGVycm9ycy5wdXNoKC4uLnBhcnNlUmVzdWx0LmVycm9ycywgLi4uaTE4bk1ldGFSZXN1bHQuZXJyb3JzKTtcblxuICBjb25zdCBwYXJzZWRUZW1wbGF0ZTogUGFyc2VkVGVtcGxhdGUgPSB7XG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgIGVycm9yczogZXJyb3JzLmxlbmd0aCA+IDAgPyBlcnJvcnMgOiBudWxsLFxuICAgIG5vZGVzLFxuICAgIHN0eWxlVXJscyxcbiAgICBzdHlsZXMsXG4gICAgbmdDb250ZW50U2VsZWN0b3JzXG4gIH07XG5cbiAgaWYgKG9wdGlvbnMuY29sbGVjdENvbW1lbnROb2Rlcykge1xuICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IGNvbW1lbnROb2RlcztcbiAgfVxuICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG59XG5cbmNvbnN0IGVsZW1lbnRSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKFxuICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQmluZGluZ1BhcnNlciB7XG4gIHJldHVybiBuZXcgQmluZGluZ1BhcnNlcihuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgaW50ZXJwb2xhdGlvbkNvbmZpZywgZWxlbWVudFJlZ2lzdHJ5LCBbXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU2FuaXRpemF0aW9uRm4oY29udGV4dDogY29yZS5TZWN1cml0eUNvbnRleHQsIGlzQXR0cmlidXRlPzogYm9vbGVhbikge1xuICBzd2l0Y2ggKGNvbnRleHQpIHtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplSHRtbCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TQ1JJUFQ6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU2NyaXB0KTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNUWUxFOlxuICAgICAgLy8gdGhlIGNvbXBpbGVyIGRvZXMgbm90IGZpbGwgaW4gYW4gaW5zdHJ1Y3Rpb24gZm9yIFtzdHlsZS5wcm9wP10gYmluZGluZ1xuICAgICAgLy8gdmFsdWVzIGJlY2F1c2UgdGhlIHN0eWxlIGFsZ29yaXRobSBrbm93cyBpbnRlcm5hbGx5IHdoYXQgcHJvcHMgYXJlIHN1YmplY3RcbiAgICAgIC8vIHRvIHNhbml0aXphdGlvbiAob25seSBbYXR0ci5zdHlsZV0gdmFsdWVzIGFyZSBleHBsaWNpdGx5IHNhbml0aXplZClcbiAgICAgIHJldHVybiBpc0F0dHJpYnV0ZSA/IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVN0eWxlKSA6IG51bGw7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVSZXNvdXJjZVVybCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRydXN0ZWRDb25zdEF0dHJpYnV0ZSh0YWdOYW1lOiBzdHJpbmcsIGF0dHI6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHZhbHVlID0gYXNMaXRlcmFsKGF0dHIudmFsdWUpO1xuICBpZiAoaXNUcnVzdGVkVHlwZXNTaW5rKHRhZ05hbWUsIGF0dHIubmFtZSkpIHtcbiAgICBzd2l0Y2ggKGVsZW1lbnRSZWdpc3RyeS5zZWN1cml0eUNvbnRleHQodGFnTmFtZSwgYXR0ci5uYW1lLCAvKiBpc0F0dHJpYnV0ZSAqLyB0cnVlKSkge1xuICAgICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgICByZXR1cm4gby50YWdnZWRUZW1wbGF0ZShcbiAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy50cnVzdENvbnN0YW50SHRtbCksXG4gICAgICAgICAgICBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQoYXR0ci52YWx1ZSldLCBbXSksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGF0dHIudmFsdWVTcGFuKTtcbiAgICAgIC8vIE5COiBubyBTZWN1cml0eUNvbnRleHQuU0NSSVBUIGhlcmUsIGFzIHRoZSBjb3JyZXNwb25kaW5nIHRhZ3MgYXJlIHN0cmlwcGVkIGJ5IHRoZSBjb21waWxlci5cbiAgICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgICByZXR1cm4gby50YWdnZWRUZW1wbGF0ZShcbiAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy50cnVzdENvbnN0YW50UmVzb3VyY2VVcmwpLFxuICAgICAgICAgICAgbmV3IG8uVGVtcGxhdGVMaXRlcmFsKFtuZXcgby5UZW1wbGF0ZUxpdGVyYWxFbGVtZW50KGF0dHIudmFsdWUpXSwgW10pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBhdHRyLnZhbHVlU3Bhbik7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaXNJZnJhbWVFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJztcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoXG4gICAgZGVmZXJyZWRQYXJhbXM6ICgpID0+IChvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXSksIG5hbWU/OiBzdHJpbmcsXG4gICAgZWFnZXJQYXJhbXM/OiBvLkV4cHJlc3Npb25bXSkge1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gZGVmZXJyZWRQYXJhbXMoKTtcbiAgICBjb25zdCBmblBhcmFtcyA9IEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbdmFsdWVdO1xuICAgIGlmIChlYWdlclBhcmFtcykge1xuICAgICAgZm5QYXJhbXMucHVzaCguLi5lYWdlclBhcmFtcyk7XG4gICAgfVxuICAgIGlmIChuYW1lKSB7XG4gICAgICAvLyBXZSB3YW50IHRoZSBwcm9wZXJ0eSBuYW1lIHRvIGFsd2F5cyBiZSB0aGUgZmlyc3QgZnVuY3Rpb24gcGFyYW1ldGVyLlxuICAgICAgZm5QYXJhbXMudW5zaGlmdChvLmxpdGVyYWwobmFtZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZm5QYXJhbXM7XG4gIH07XG59XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb24gKGUuZy5cbiAqIHBvc3QtcHJvY2Vzc2luZykuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lZCBhIGdpdmVuIHRyYW5zbGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIC8vIFNvcnQgdGhlIG1hcCBlbnRyaWVzIGluIHRoZSBjb21waWxlZCBvdXRwdXQuIFRoaXMgbWFrZXMgaXQgZWFzeSB0byBhY2hlaXZlIGlkZW50aWNhbCBvdXRwdXQgaW5cbiAgLy8gdGhlIHRlbXBsYXRlIHBpcGVsaW5lIGNvbXBpbGVyLlxuICBwYXJhbXMgPSBPYmplY3QuZnJvbUVudHJpZXMoT2JqZWN0LmVudHJpZXMocGFyYW1zKS5zb3J0KCkpO1xuXG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSxcbiAgICAgICAgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyh2YXJpYWJsZSwgbWVzc2FnZSwgY2xvc3VyZVZhciwgcGFyYW1zKSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWVzSW5NYXAocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpKSksXG4gIF07XG5cbiAgaWYgKHRyYW5zZm9ybUZuKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodmFyaWFibGUuc2V0KHRyYW5zZm9ybUZuKHZhcmlhYmxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBzdGF0ZW1lbnRzO1xufVxuXG4vKipcbiAqIENyZWF0ZSB0aGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgdXNlZCB0byBndWFyZCB0aGUgY2xvc3VyZSBtb2RlIGJsb2NrXG4gKiBJdCBpcyBlcXVpdmFsZW50IHRvOlxuICpcbiAqIGBgYFxuICogdHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGVcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zdXJlTW9kZUd1YXJkKCk6IG8uQmluYXJ5T3BlcmF0b3JFeHByIHtcbiAgcmV0dXJuIG8udHlwZW9mRXhwcihvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSlcbiAgICAgIC5ub3RJZGVudGljYWwoby5saXRlcmFsKCd1bmRlZmluZWQnLCBvLlNUUklOR19UWVBFKSlcbiAgICAgIC5hbmQoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB0ZW1wbGF0ZSB3aGljaCB3YXMgZXh0cmFjdGVkIGR1cmluZyBwYXJzaW5nLlxuICpcbiAqIFRoaXMgY29udGFpbnMgdGhlIGFjdHVhbCBwYXJzZWQgdGVtcGxhdGUgYXMgd2VsbCBhcyBhbnkgbWV0YWRhdGEgY29sbGVjdGVkIGR1cmluZyBpdHMgcGFyc2luZyxcbiAqIHNvbWUgb2Ygd2hpY2ggbWlnaHQgYmUgdXNlZnVsIGZvciByZS1wYXJzaW5nIHRoZSB0ZW1wbGF0ZSB3aXRoIGRpZmZlcmVudCBvcHRpb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFRlbXBsYXRlIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBBbnkgZXJyb3JzIGZyb20gcGFyc2luZyB0aGUgdGVtcGxhdGUgdGhlIGZpcnN0IHRpbWUuXG4gICAqXG4gICAqIGBudWxsYCBpZiB0aGVyZSBhcmUgbm8gZXJyb3JzLiBPdGhlcndpc2UsIHRoZSBhcnJheSBvZiBlcnJvcnMgaXMgZ3VhcmFudGVlZCB0byBiZSBub24tZW1wdHkuXG4gICAqL1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXXxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgdGVtcGxhdGUgQVNULCBwYXJzZWQgZnJvbSB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBub2RlczogdC5Ob2RlW107XG5cbiAgLyoqXG4gICAqIEFueSBzdHlsZVVybHMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IGlubGluZSBzdHlsZXMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEFueSBSMyBDb21tZW50IE5vZGVzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZSB3aGVuIHRoZSBgY29sbGVjdENvbW1lbnROb2Rlc2AgcGFyc2UgdGVtcGxhdGVcbiAgICogb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAqL1xuICBjb21tZW50Tm9kZXM/OiB0LkNvbW1lbnRbXTtcbn1cbiJdfQ==