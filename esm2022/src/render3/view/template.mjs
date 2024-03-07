/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuiltinFunctionCall, convertActionBinding, convertAssignmentActionBinding, convertPropertyBinding, convertPureComponentScopeFunction, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, BindingType, Call, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, ParsedEventType, PropertyRead } from '../../expression_parser/ast';
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
    const bindingStatements = eventAst.type === ParsedEventType.TwoWay ?
        convertAssignmentActionBinding(scope, implicitReceiverExpr, handler, 'b', eventAst.handlerSpan, implicitReceiverAccesses, EVENT_BINDING_SCOPE_GLOBALS) :
        convertActionBinding(scope, implicitReceiverExpr, handler, 'b', eventAst.handlerSpan, implicitReceiverAccesses, EVENT_BINDING_SCOPE_GLOBALS);
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
    const eventName = type === ParsedEventType.Animation ? prepareSyntheticListenerName(name, phase) : name;
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
    constructor(constantPool, parentBindingScope, level = 0, contextName, i18nContext, templateIndex, templateName, _namespace, relativeContextFilePath, i18nUseExternalIds, deferBlocks, elementLocations, allDeferrableDepsFn, _constants = createComponentDefConsts()) {
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
        this.allDeferrableDepsFn = allDeferrableDepsFn;
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
                if ((input.type === BindingType.Property || input.type === BindingType.TwoWay) &&
                    input.i18n) {
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
                    this.creationInstruction(outputAst.sourceSpan, outputAst.type === ParsedEventType.TwoWay ? R3.twoWayListener : R3.listener, this.prepareListenerParameter(element.name, outputAst, elementIndex));
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
            if (inputType === BindingType.Animation) {
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
                    reference: R3.property,
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
                    const isAttributeBinding = inputType === BindingType.Attribute;
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
                    // Note: we don't separate two-way property bindings and regular ones,
                    // because their assignment order needs to be maintained.
                    if (inputType === BindingType.Property || inputType === BindingType.TwoWay) {
                        if (value instanceof Interpolation) {
                            // prop="{{value}}" and friends
                            this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value), elementIndex, attrName, input, value, params);
                        }
                        else {
                            // [prop]="value"
                            // Collect all the properties so that we can chain into a single function at the end.
                            propertyBindings.push({
                                span: input.sourceSpan,
                                reference: inputType === BindingType.TwoWay ? R3.twoWayProperty : R3.property,
                                paramsOrFn: getBindingFunctionParams(() => this.convertPropertyBinding(value), attrName, params)
                            });
                        }
                    }
                    else if (inputType === BindingType.Attribute) {
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
            this.updateInstructionWithAdvance(elementIndex, propertyBinding.span, propertyBinding.reference, propertyBinding.paramsOrFn);
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
        // Note: For the unique name, we don't include an unique suffix, unless really needed.
        // This keeps the generated output more clean as most of the time, we don't expect conflicts.
        const name = this.constantPool.uniqueName(`${contextName}_Template`, /** alwaysIncludeSuffix */ false);
        // Create the template function
        const visitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, index, name, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds, this.deferBlocks, this.elementLocations, this.allDeferrableDepsFn, this._constants);
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
                this.creationInstruction(outputAst.sourceSpan, outputAst.type === ParsedEventType.TwoWay ? R3.twoWayListener : R3.listener, this.prepareListenerParameter('ng_template', outputAst, templateIndex));
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
        if (block.cases.length === 0) {
            return;
        }
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
            this.allDeferrableDepsFn ?? this.createDeferredDepsFunction(depsFnName, metadata),
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
                const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], 
                // Default imports are always accessed through the `default` property.
                o.variable('m').prop(deferredDep.isDefaultImport ? 'default' : deferredDep.symbolName));
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
        let emptyTagName = null;
        let emptyAttrsExprs;
        if (block.empty !== null) {
            const emptyInferred = this.inferProjectionDataFromInsertionPoint(block.empty);
            emptyTagName = emptyInferred.tagName;
            emptyAttrsExprs = emptyInferred.attrsExprs;
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
                params.push(o.literal(trackByUsesComponentInstance), o.variable(emptyData.name), o.literal(emptyData.getConstCount()), o.literal(emptyData.getVarCount()), o.literal(emptyTagName), this.addAttrsToConsts(emptyAttrsExprs || null));
            }
            else if (trackByUsesComponentInstance) {
                // If the tracking function doesn't use the component instance, we can omit the flag.
                params.push(o.literal(trackByUsesComponentInstance));
            }
            return trimTrailingNulls(params);
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
            this.instructionFn(this._updateCodeFns, span, R3.advance, delta > 1 ? [o.literal(delta)] : []);
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
                if (input.type !== BindingType.Animation && input.type !== BindingType.Attribute) {
                    addAttrExpr(input.name);
                }
            }
            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                if (output.type !== ParsedEventType.Animation) {
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
            const bindingFnName = outputAst.type === ParsedEventType.Animation ?
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSw4QkFBOEIsRUFBRSxzQkFBc0IsRUFBRSxpQ0FBaUMsRUFBRSxzQkFBc0IsRUFBZ0IsTUFBTSwwQ0FBMEMsQ0FBQztBQUVyTyxPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQWUsV0FBVyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUMzTixPQUFPLEVBQUMsS0FBSyxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDcEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RELE9BQU8sS0FBSyxJQUFJLE1BQU0scUJBQXFCLENBQUM7QUFDNUMsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sMEJBQTBCLENBQUM7QUFDM0YsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBRW5FLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4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LFdBQWtEO0lBQ3BELGlHQUFpRztJQUNqRyxrQ0FBa0M7SUFDbEMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRTNELE1BQU0sVUFBVSxHQUFrQjtRQUNoQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUM7UUFDN0IsQ0FBQyxDQUFDLE1BQU0sQ0FDSixzQkFBc0IsRUFBRSxFQUN4Qiw0QkFBNEIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLENBQUMsRUFDbkUsd0JBQXdCLENBQ3BCLFFBQVEsRUFBRSxPQUFPLEVBQUUsK0JBQStCLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDL0YsQ0FBQztJQUVGLElBQUksV0FBVyxFQUFFLENBQUM7UUFDaEIsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLHNCQUFzQjtJQUM3QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ2hELFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDbkQsR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtCdWlsdGluRnVuY3Rpb25DYWxsLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydEFzc2lnbm1lbnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nLCBjb252ZXJ0UHVyZUNvbXBvbmVudFNjb3BlRnVuY3Rpb24sIGNvbnZlcnRVcGRhdGVBcmd1bWVudHMsIExvY2FsUmVzb2x2ZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBDYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFBhcnNlZEV2ZW50VHlwZSwgUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMZXhlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2RlZmF1bHRzJztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7V2hpdGVzcGFjZVZpc2l0b3J9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7TGV4ZXJSYW5nZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2xleGVyJztcbmltcG9ydCB7aXNOZ0NvbnRhaW5lciBhcyBjaGVja0lzTmdDb250YWluZXIsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge21hcExpdGVyYWx9IGZyb20gJy4uLy4uL291dHB1dC9tYXBfdXRpbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cn0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9zZWN1cml0eV9zY2hlbWEnO1xuaW1wb3J0IHtpc1RydXN0ZWRUeXBlc1Npbmt9IGZyb20gJy4uLy4uL3NjaGVtYS90cnVzdGVkX3R5cGVzX3NpbmtzJztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3IsIHBhcnRpdGlvbkFycmF5fSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0RlZmVyQmxvY2tNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtJMThuQ29udGV4dH0gZnJvbSAnLi9pMThuL2NvbnRleHQnO1xuaW1wb3J0IHtjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzfSBmcm9tICcuL2kxOG4vZ2V0X21zZ191dGlscyc7XG5pbXBvcnQge2NyZWF0ZUxvY2FsaXplU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7STE4bk1ldGFWaXNpdG9yfSBmcm9tICcuL2kxOG4vbWV0YSc7XG5pbXBvcnQge2Fzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzLCBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZywgZGVjbGFyZUkxOG5WYXJpYWJsZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcCwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeCwgaGFzSTE4bk1ldGEsIEkxOE5fSUNVX01BUFBJTkdfUFJFRklYLCBpY3VGcm9tSTE4bk1lc3NhZ2UsIGlzSTE4blJvb3ROb2RlLCBpc1NpbmdsZUkxOG5JY3UsIHBsYWNlaG9sZGVyc1RvUGFyYW1zLCBUUkFOU0xBVElPTl9WQVJfUFJFRklYLCB3cmFwSTE4blBsYWNlaG9sZGVyfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5pbXBvcnQge1N0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb259IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7YXNMaXRlcmFsLCBDT05URVhUX05BTUUsIERJUkVDVF9DT05URVhUX1JFRkVSRU5DRSwgZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzLCBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCwgSU1QTElDSVRfUkVGRVJFTkNFLCBJbnN0cnVjdGlvbiwgSW5zdHJ1Y3Rpb25QYXJhbXMsIGludmFsaWQsIGludm9rZUluc3RydWN0aW9uLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSwgdHJpbVRyYWlsaW5nTnVsbHN9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBHbG9iYWwgc3ltYm9scyBhdmFpbGFibGUgb25seSBpbnNpZGUgZXZlbnQgYmluZGluZ3MuXG5jb25zdCBFVkVOVF9CSU5ESU5HX1NDT1BFX0dMT0JBTFMgPSBuZXcgU2V0PHN0cmluZz4oWyckZXZlbnQnXSk7XG5cbi8vIFRhZyBuYW1lIG9mIHRoZSBgbmctdGVtcGxhdGVgIGVsZW1lbnQuXG5jb25zdCBOR19URU1QTEFURV9UQUdfTkFNRSA9ICduZy10ZW1wbGF0ZSc7XG5cbi8vIExpc3Qgb2Ygc3VwcG9ydGVkIGdsb2JhbCB0YXJnZXRzIGZvciBldmVudCBsaXN0ZW5lcnNcbmNvbnN0IEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTID0gbmV3IE1hcDxzdHJpbmcsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFxuICAgIFtbJ3dpbmRvdycsIFIzLnJlc29sdmVXaW5kb3ddLCBbJ2RvY3VtZW50JywgUjMucmVzb2x2ZURvY3VtZW50XSwgWydib2R5JywgUjMucmVzb2x2ZUJvZHldXSk7XG5cbmV4cG9ydCBjb25zdCBMRUFESU5HX1RSSVZJQV9DSEFSUyA9IFsnICcsICdcXG4nLCAnXFxyJywgJ1xcdCddO1xuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgaGFuZGxlck5hbWU6IHN0cmluZ3xudWxsID0gbnVsbCxcbiAgICBzY29wZTogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCB7dHlwZSwgbmFtZSwgdGFyZ2V0LCBwaGFzZSwgaGFuZGxlcn0gPSBldmVudEFzdDtcbiAgaWYgKHRhcmdldCAmJiAhR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuaGFzKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZ2xvYmFsIHRhcmdldCAnJHt0YXJnZXR9JyBkZWZpbmVkIGZvciAnJHtuYW1lfScgZXZlbnQuXG4gICAgICAgIFN1cHBvcnRlZCBsaXN0IG9mIGdsb2JhbCB0YXJnZXRzOiAke0FycmF5LmZyb20oR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMua2V5cygpKX0uYCk7XG4gIH1cblxuICBjb25zdCBldmVudEFyZ3VtZW50TmFtZSA9ICckZXZlbnQnO1xuICBjb25zdCBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckV4cHIgPSAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuYmluZGluZ0xldmVsID09PSAwKSA/XG4gICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgc2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICBjb25zdCBiaW5kaW5nU3RhdGVtZW50cyA9IGV2ZW50QXN0LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5Ud29XYXkgP1xuICAgICAgY29udmVydEFzc2lnbm1lbnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIHNjb3BlLCBpbXBsaWNpdFJlY2VpdmVyRXhwciwgaGFuZGxlciwgJ2InLCBldmVudEFzdC5oYW5kbGVyU3BhbiwgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLFxuICAgICAgICAgIEVWRU5UX0JJTkRJTkdfU0NPUEVfR0xPQkFMUykgOlxuICAgICAgY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgc2NvcGUsIGltcGxpY2l0UmVjZWl2ZXJFeHByLCBoYW5kbGVyLCAnYicsIGV2ZW50QXN0LmhhbmRsZXJTcGFuLCBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMsXG4gICAgICAgICAgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9ucyA9IHNjb3BlPy52YXJpYWJsZURlY2xhcmF0aW9ucygpO1xuICBjb25zdCByZXN0b3JlVmlld1N0YXRlbWVudCA9IHNjb3BlPy5yZXN0b3JlVmlld1N0YXRlbWVudCgpO1xuXG4gIGlmICh2YXJpYWJsZURlY2xhcmF0aW9ucykge1xuICAgIC8vIGB2YXJpYWJsZURlY2xhcmF0aW9uc2AgbmVlZHMgdG8gcnVuIGZpcnN0LCBiZWNhdXNlXG4gICAgLy8gYHJlc3RvcmVWaWV3U3RhdGVtZW50YCBkZXBlbmRzIG9uIHRoZSByZXN1bHQuXG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnZhcmlhYmxlRGVjbGFyYXRpb25zKTtcbiAgfVxuXG4gIHN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nU3RhdGVtZW50cyk7XG5cbiAgaWYgKHJlc3RvcmVWaWV3U3RhdGVtZW50KSB7XG4gICAgc3RhdGVtZW50cy51bnNoaWZ0KHJlc3RvcmVWaWV3U3RhdGVtZW50KTtcblxuICAgIC8vIElmIHRoZXJlJ3MgYSBgcmVzdG9yZVZpZXdgIGNhbGwsIHdlIG5lZWQgdG8gcmVzZXQgdGhlIHZpZXcgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdGVuZXJcbiAgICAvLyBpbiBvcmRlciB0byBhdm9pZCBhIGxlYWsuIElmIHRoZXJlJ3MgYSBgcmV0dXJuYCBzdGF0ZW1lbnQgYWxyZWFkeSwgd2Ugd3JhcCBpdCBpbiB0aGVcbiAgICAvLyBjYWxsLCBlLmcuIGByZXR1cm4gcmVzZXRWaWV3KGN0eC5mb28oKSlgLiBPdGhlcndpc2Ugd2UgYWRkIHRoZSBjYWxsIGFzIHRoZSBsYXN0IHN0YXRlbWVudC5cbiAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gc3RhdGVtZW50c1tzdGF0ZW1lbnRzLmxlbmd0aCAtIDFdO1xuICAgIGlmIChsYXN0U3RhdGVtZW50IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICAgIHN0YXRlbWVudHNbc3RhdGVtZW50cy5sZW5ndGggLSAxXSA9IG5ldyBvLlJldHVyblN0YXRlbWVudChcbiAgICAgICAgICBpbnZva2VJbnN0cnVjdGlvbihsYXN0U3RhdGVtZW50LnZhbHVlLnNvdXJjZVNwYW4sIFIzLnJlc2V0VmlldywgW2xhc3RTdGF0ZW1lbnQudmFsdWVdKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGludm9rZUluc3RydWN0aW9uKG51bGwsIFIzLnJlc2V0VmlldywgW10pKSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UhKSA6IG5hbWU7XG4gIGNvbnN0IGZuTmFtZSA9IGhhbmRsZXJOYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihoYW5kbGVyTmFtZSk7XG4gIGNvbnN0IGZuQXJnczogby5GblBhcmFtW10gPSBbXTtcblxuICBpZiAoaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLmhhcyhldmVudEFyZ3VtZW50TmFtZSkpIHtcbiAgICBmbkFyZ3MucHVzaChuZXcgby5GblBhcmFtKGV2ZW50QXJndW1lbnROYW1lLCBvLkRZTkFNSUNfVFlQRSkpO1xuICB9XG5cbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcbiAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZXZlbnROYW1lKSwgaGFuZGxlckZuXTtcbiAgaWYgKHRhcmdldCkge1xuICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoZmFsc2UpLCAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICAgICAgby5pbXBvcnRFeHByKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmdldCh0YXJnZXQpISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbi8vIENvbGxlY3RzIGluZm9ybWF0aW9uIG5lZWRlZCB0byBnZW5lcmF0ZSBgY29uc3RzYCBmaWVsZCBvZiB0aGUgQ29tcG9uZW50RGVmLlxuZXhwb3J0IGludGVyZmFjZSBDb21wb25lbnREZWZDb25zdHMge1xuICAvKipcbiAgICogV2hlbiBhIGNvbnN0YW50IHJlcXVpcmVzIHNvbWUgcHJlLXByb2Nlc3NpbmcgKGUuZy4gaTE4biB0cmFuc2xhdGlvbiBibG9jayB0aGF0IGluY2x1ZGVzXG4gICAqIGdvb2cuZ2V0TXNnIGFuZCAkbG9jYWxpemUgY2FsbHMpLCB0aGUgYHByZXBhcmVTdGF0ZW1lbnRzYCBzZWN0aW9uIGNvbnRhaW5zIGNvcnJlc3BvbmRpbmdcbiAgICogc3RhdGVtZW50cy5cbiAgICovXG4gIHByZXBhcmVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdO1xuXG4gIC8qKlxuICAgKiBBY3R1YWwgZXhwcmVzc2lvbnMgdGhhdCByZXByZXNlbnQgY29uc3RhbnRzLlxuICAgKi9cbiAgY29uc3RFeHByZXNzaW9uczogby5FeHByZXNzaW9uW107XG5cbiAgLyoqXG4gICAqIENhY2hlIHRvIGF2b2lkIGdlbmVyYXRpbmcgZHVwbGljYXRlZCBpMThuIHRyYW5zbGF0aW9uIGJsb2Nrcy5cbiAgICovXG4gIGkxOG5WYXJSZWZzQ2FjaGU6IE1hcDxpMThuLkkxOG5NZXRhLCBvLlJlYWRWYXJFeHByPjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50RGVmQ29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gIHJldHVybiB7XG4gICAgcHJlcGFyZVN0YXRlbWVudHM6IFtdLFxuICAgIGNvbnN0RXhwcmVzc2lvbnM6IFtdLFxuICAgIGkxOG5WYXJSZWZzQ2FjaGU6IG5ldyBNYXAoKSxcbiAgfTtcbn1cblxuY2xhc3MgVGVtcGxhdGVEYXRhIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSBuYW1lOiBzdHJpbmcsIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsIHJlYWRvbmx5IHNjb3BlOiBCaW5kaW5nU2NvcGUsXG4gICAgICBwcml2YXRlIHZpc2l0b3I6IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHt9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdG9yLmdldENvbnN0Q291bnQoKTtcbiAgfVxuXG4gIGdldFZhckNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0b3IuZ2V0VmFyQ291bnQoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gIC8qKiBJbmRleCBvZiB0aGUgY3VycmVudGx5LXNlbGVjdGVkIG5vZGUuICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRleDogbnVtYmVyID0gMDtcblxuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBUZW1wb3JhcnkgdmFyaWFibGUgdXNlZCB0byBzdG9yZSBzdGF0ZSBiZXR3ZWVuIGNvbnRyb2wgZmxvdyBpbnN0cnVjdGlvbnMuXG4gICAqIFNob3VsZCBiZSBhY2Nlc3NlZCB2aWEgdGhlIGBhbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlYCBtZXRob2QuXG4gICAqL1xuICBwcml2YXRlIF9jb250cm9sRmxvd1RlbXBWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZGVmZXJCbG9ja3M6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPixcbiAgICAgIHByaXZhdGUgZWxlbWVudExvY2F0aW9uczogTWFwPHQuRWxlbWVudCwge2luZGV4OiBudW1iZXIsIGxldmVsOiBudW1iZXJ9PixcbiAgICAgIHByaXZhdGUgYWxsRGVmZXJyYWJsZURlcHNGbjogby5SZWFkVmFyRXhwcnxudWxsLFxuICAgICAgcHJpdmF0ZSBfY29uc3RhbnRzOiBDb21wb25lbnREZWZDb25zdHMgPSBjcmVhdGVDb21wb25lbnREZWZDb25zdHMoKSkge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZSA9IHBhcmVudEJpbmRpbmdTY29wZS5uZXN0ZWRTY29wZShsZXZlbCk7XG5cbiAgICAvLyBUdXJuIHRoZSByZWxhdGl2ZSBjb250ZXh0IGZpbGUgcGF0aCBpbnRvIGFuIGlkZW50aWZpZXIgYnkgcmVwbGFjaW5nIG5vbi1hbHBoYW51bWVyaWNcbiAgICAvLyBjaGFyYWN0ZXJzIHdpdGggdW5kZXJzY29yZXMuXG4gICAgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4ID0gcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgucmVwbGFjZSgvW15BLVphLXowLTldL2csICdfJykgKyAnXyc7XG5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLCAoKSA9PiB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSxcbiAgICAgICAgKG51bVNsb3RzOiBudW1iZXIpID0+IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90cyksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ6IG51bWJlciA9IDAsXG4gICAgICBpMThuPzogaTE4bi5JMThuTWV0YSwgdmFyaWFibGVBbGlhc2VzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHtcbiAgICAgIGNvbnN0IGFsaWFzID0gdmFyaWFibGVBbGlhc2VzPy5bdi5uYW1lXTtcbiAgICAgIHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYubmFtZSwgdi52YWx1ZSk7XG4gICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXMoYWxpYXMsIHYudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhdGUgaTE4biBjb250ZXh0IGluIGNhc2U6XG4gICAgLy8gLSB0aGlzIHRlbXBsYXRlIGhhcyBwYXJlbnQgaTE4biBjb250ZXh0XG4gICAgLy8gLSBvciB0aGUgdGVtcGxhdGUgaGFzIGkxOG4gbWV0YSBhc3NvY2lhdGVkIHdpdGggaXQsXG4gICAgLy8gICBidXQgaXQncyBub3QgaW5pdGlhdGVkIGJ5IHRoZSBFbGVtZW50IChlLmcuIDxuZy10ZW1wbGF0ZSBpMThuPilcbiAgICBjb25zdCBpbml0STE4bkNvbnRleHQgPSB0aGlzLmkxOG5Db250ZXh0IHx8XG4gICAgICAgIChpc0kxOG5Sb290Tm9kZShpMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGkxOG4pICYmXG4gICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuISwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgdGhlIGluaXRpYWwgcGFzcyB0aHJvdWdoIHRoZSBub2RlcyBvZiB0aGlzIHRlbXBsYXRlLiBJbiB0aGlzIHBhc3MsIHdlXG4gICAgLy8gcXVldWUgYWxsIGNyZWF0aW9uIG1vZGUgYW5kIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyBmb3IgZ2VuZXJhdGlvbiBpbiB0aGUgc2Vjb25kXG4gICAgLy8gcGFzcy4gSXQncyBuZWNlc3NhcnkgdG8gc2VwYXJhdGUgdGhlIHBhc3NlcyB0byBlbnN1cmUgbG9jYWwgcmVmcyBhcmUgZGVmaW5lZCBiZWZvcmVcbiAgICAvLyByZXNvbHZpbmcgYmluZGluZ3MuIFdlIGFsc28gY291bnQgYmluZGluZ3MgaW4gdGhpcyBwYXNzIGFzIHdlIHdhbGsgYm91bmQgZXhwcmVzc2lvbnMuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICAvLyBBZGQgdG90YWwgYmluZGluZyBjb3VudCB0byBwdXJlIGZ1bmN0aW9uIGNvdW50IHNvIHB1cmUgZnVuY3Rpb24gaW5zdHJ1Y3Rpb25zIGFyZVxuICAgIC8vIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IHNsb3Qgb2Zmc2V0IHdoZW4gdXBkYXRlIGluc3RydWN0aW9ucyBhcmUgcHJvY2Vzc2VkLlxuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IHRoaXMuX2JpbmRpbmdTbG90cztcblxuICAgIC8vIFBpcGVzIGFyZSB3YWxrZWQgaW4gdGhlIGZpcnN0IHBhc3MgKHRvIGVucXVldWUgYHBpcGUoKWAgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGFuZFxuICAgIC8vIGBwaXBlQmluZGAgdXBkYXRlIGluc3RydWN0aW9ucyksIHNvIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBzbG90IG9mZnNldHMgbWFudWFsbHlcbiAgICAvLyB0byBhY2NvdW50IGZvciBiaW5kaW5ncy5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlci51cGRhdGVQaXBlU2xvdE9mZnNldHModGhpcy5fYmluZGluZ1Nsb3RzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBiZSBwcm9jZXNzZWQgYmVmb3JlIGNyZWF0aW9uIGluc3RydWN0aW9ucyBzbyB0ZW1wbGF0ZSgpXG4gICAgLy8gaW5zdHJ1Y3Rpb25zIGNhbiBiZSBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBpbnRlcm5hbCBjb25zdCBjb3VudC5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5mb3JFYWNoKGJ1aWxkVGVtcGxhdGVGbiA9PiBidWlsZFRlbXBsYXRlRm4oKSk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgdGFncyBhcmUgcHJlc2VudC5cbiAgICAvLyBUaGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIGlzIG9ubHkgZW1pdHRlZCBmb3IgdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZSBhbmRcbiAgICAvLyBpcyBza2lwcGVkIGZvciBuZXN0ZWQgdGVtcGxhdGVzICg8bmctdGVtcGxhdGU+IHRhZ3MpLlxuICAgIGlmICh0aGlzLmxldmVsID09PSAwICYmIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBCeSBkZWZhdWx0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb25zIGNyZWF0ZXMgb25lIHNsb3QgZm9yIHRoZSB3aWxkY2FyZFxuICAgICAgLy8gc2VsZWN0b3IgaWYgbm8gcGFyYW1ldGVycyBhcmUgcGFzc2VkLiBUaGVyZWZvcmUgd2Ugb25seSB3YW50IHRvIGFsbG9jYXRlIGEgbmV3XG4gICAgICAvLyBhcnJheSBmb3IgdGhlIHByb2plY3Rpb24gc2xvdHMgaWYgdGhlIGRlZmF1bHQgcHJvamVjdGlvbiBzbG90IGlzIG5vdCBzdWZmaWNpZW50LlxuICAgICAgaWYgKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID4gMSB8fCB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzWzBdICE9PSAnKicpIHtcbiAgICAgICAgY29uc3QgcjNSZXNlcnZlZFNsb3RzID0gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5tYXAoXG4gICAgICAgICAgICBzID0+IHMgIT09ICcqJyA/IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSA6IHMpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1Jlc2VydmVkU2xvdHMpLCB0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbmNlIHdlIGFjY3VtdWxhdGUgbmdDb250ZW50IHNlbGVjdG9ycyB3aGlsZSBwcm9jZXNzaW5nIHRlbXBsYXRlIGVsZW1lbnRzLFxuICAgICAgLy8gd2UgKnByZXBlbmQqIGBwcm9qZWN0aW9uRGVmYCB0byBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYmxvY2ssIHRvIHB1dCBpdCBiZWZvcmVcbiAgICAgIC8vIGFueSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb25zXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycywgLyogcHJlcGVuZCAqLyB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKHRoaXMuX2NyZWF0aW9uQ29kZUZucyk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IGdldEluc3RydWN0aW9uU3RhdGVtZW50cyh0aGlzLl91cGRhdGVDb2RlRm5zKTtcblxuICAgIC8vICBWYXJpYWJsZSBkZWNsYXJhdGlvbiBtdXN0IG9jY3VyIGFmdGVyIGJpbmRpbmcgcmVzb2x1dGlvbiBzbyB3ZSBjYW4gZ2VuZXJhdGUgY29udGV4dFxuICAgIC8vICBpbnN0cnVjdGlvbnMgdGhhdCBidWlsZCBvbiBlYWNoIG90aGVyLlxuICAgIC8vIGUuZy4gY29uc3QgYiA9IG5leHRDb250ZXh0KCkuJGltcGxpY2l0KCk7IGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpO1xuICAgIGNvbnN0IGNyZWF0aW9uVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTtcbiAgICBjb25zdCB1cGRhdGVWYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKS5jb25jYXQodGhpcy5fdGVtcFZhcmlhYmxlcyk7XG5cbiAgICBjb25zdCBjcmVhdGlvbkJsb2NrID0gY3JlYXRpb25TdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0aW9uVmFyaWFibGVzLmNvbmNhdChjcmVhdGlvblN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUJsb2NrID0gdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlVmFyaWFibGVzLmNvbmNhdCh1cGRhdGVTdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgLy8gaS5lLiAocmY6IFJlbmRlckZsYWdzLCBjdHg6IGFueSlcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgICAgW1xuICAgICAgICAgIC8vIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIHF1ZXJ5IHJlZnJlc2ggKGkuZS4gbGV0IF90OiBhbnk7KVxuICAgICAgICAgIC4uLnRoaXMuX3ByZWZpeENvZGUsXG4gICAgICAgICAgLy8gQ3JlYXRpbmcgbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5DcmVhdGUpIHsgLi4uIH0pXG4gICAgICAgICAgLi4uY3JlYXRpb25CbG9jayxcbiAgICAgICAgICAvLyBCaW5kaW5nIGFuZCByZWZyZXNoIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuVXBkYXRlKSB7Li4ufSlcbiAgICAgICAgICAuLi51cGRhdGVCbG9jayxcbiAgICAgICAgXSxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0aGlzLnRlbXBsYXRlTmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBtYXliZVJlc3RvcmVWaWV3KCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5tYXliZVJlc3RvcmVWaWV3KCk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5UcmFuc2xhdGUoXG4gICAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sIHJlZj86IG8uUmVhZFZhckV4cHIsXG4gICAgICB0cmFuc2Zvcm1Gbj86IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IG8uRXhwcmVzc2lvbik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IF9yZWYgPSByZWYgfHwgdGhpcy5pMThuR2VuZXJhdGVNYWluQmxvY2tWYXIoKTtcbiAgICAvLyBDbG9zdXJlIENvbXBpbGVyIHJlcXVpcmVzIGNvbnN0IG5hbWVzIHRvIHN0YXJ0IHdpdGggYE1TR19gIGJ1dCBkaXNhbGxvd3MgYW55IG90aGVyIGNvbnN0IHRvXG4gICAgLy8gc3RhcnQgd2l0aCBgTVNHX2AuIFdlIGRlZmluZSBhIHZhcmlhYmxlIHN0YXJ0aW5nIHdpdGggYE1TR19gIGp1c3QgZm9yIHRoZSBgZ29vZy5nZXRNc2dgIGNhbGxcbiAgICBjb25zdCBjbG9zdXJlVmFyID0gdGhpcy5pMThuR2VuZXJhdGVDbG9zdXJlVmFyKG1lc3NhZ2UuaWQpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhtZXNzYWdlLCBfcmVmLCBjbG9zdXJlVmFyLCBwYXJhbXMsIHRyYW5zZm9ybUZuKTtcbiAgICB0aGlzLl9jb25zdGFudHMucHJlcGFyZVN0YXRlbWVudHMucHVzaCguLi5zdGF0ZW1lbnRzKTtcbiAgICByZXR1cm4gX3JlZjtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgIGNvbnN0IGlzRGlyZWN0ID0gdmFsdWUgPT09IERJUkVDVF9DT05URVhUX1JFRkVSRU5DRTtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKG5hbWUgKyBzY29wZWROYW1lKTtcblxuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgIHJldHJpZXZhbExldmVsLCBuYW1lLFxuICAgICAgICBzY29wZSA9PiB7XG4gICAgICAgICAgLy8gSWYgd2UncmUgYXQgdGhlIHRvcCBsZXZlbCBhbmQgd2UncmUgcmVmZXJyaW5nIHRvIHRoZSBjb250ZXh0IHZhcmlhYmxlIGRpcmVjdGx5LCB3ZVxuICAgICAgICAgIC8vIGNhbiBkbyBzbyB0aHJvdWdoIHRoZSBpbXBsaWNpdCByZWNlaXZlciwgaW5zdGVhZCBvZiByZW5hbWluZyBpdC4gTm90ZSB0aGF0IHRoaXMgZG9lc1xuICAgICAgICAgIC8vIG5vdCBhcHBseSB0byBsaXN0ZW5lcnMsIGJlY2F1c2UgdGhleSBuZWVkIHRvIHJlc3RvcmUgdGhlIGNvbnRleHQuXG4gICAgICAgICAgcmV0dXJuIGlzRGlyZWN0ICYmIHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwgJiYgIXNjb3BlLmlzTGlzdGVuZXJTY29wZSgpID9cbiAgICAgICAgICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgICAgICAgICAgbGhzO1xuICAgICAgICB9LFxuICAgICAgICBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG5cbiAgICAgICAgICBpZiAoc2NvcGUuYmluZGluZ0xldmVsID09PSByZXRyaWV2YWxMZXZlbCkge1xuICAgICAgICAgICAgaWYgKHNjb3BlLmlzTGlzdGVuZXJTY29wZSgpICYmIHNjb3BlLmhhc1Jlc3RvcmVWaWV3VmFyaWFibGUoKSkge1xuICAgICAgICAgICAgICAvLyBlLmcuIHJlc3RvcmVkQ3R4LlxuICAgICAgICAgICAgICAvLyBXZSBoYXZlIHRvIGdldCB0aGUgY29udGV4dCBmcm9tIGEgdmlldyByZWZlcmVuY2UsIGlmIG9uZSBpcyBhdmFpbGFibGUsIGJlY2F1c2VcbiAgICAgICAgICAgICAgLy8gdGhlIGNvbnRleHQgdGhhdCB3YXMgcGFzc2VkIGluIGR1cmluZyBjcmVhdGlvbiBtYXkgbm90IGJlIGNvcnJlY3QgYW55bW9yZS5cbiAgICAgICAgICAgICAgLy8gRm9yIG1vcmUgaW5mb3JtYXRpb24gc2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL3B1bGwvNDAzNjAuXG4gICAgICAgICAgICAgIHJocyA9IG8udmFyaWFibGUoUkVTVE9SRURfVklFV19DT05URVhUX05BTUUpO1xuICAgICAgICAgICAgICBzY29wZS5ub3RpZnlSZXN0b3JlZFZpZXdDb250ZXh0VXNlKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzRGlyZWN0KSB7XG4gICAgICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBkaXJlY3QgcmVhZCBvZiB0aGUgY29udGV4dCBhdCB0aGUgdG9wIGxldmVsIHdlIGRvbid0IG5lZWQgdG9cbiAgICAgICAgICAgICAgLy8gZGVjbGFyZSBhbnkgdmFyaWFibGVzIGFuZCB3ZSBjYW4gcmVmZXIgdG8gaXQgZGlyZWN0bHkuXG4gICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICAgIHJocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkQ3R4VmFyID0gc2NvcGUuZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhfcjAgICBPUiAgeCgyKTtcbiAgICAgICAgICAgIHJocyA9IHNoYXJlZEN0eFZhciA/IHNoYXJlZEN0eFZhciA6IGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRpdGVtcyQgPSB4KDIpIGZvciBkaXJlY3QgY29udGV4dCByZWZlcmVuY2VzIGFuZFxuICAgICAgICAgICAgLy8gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQgZm9yIGluZGlyZWN0IG9uZXMuXG4gICAgICAgICAgICBsaHMuc2V0KGlzRGlyZWN0ID8gcmhzIDogcmhzLnByb3AodmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKVxuICAgICAgICAgIF07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnM6IEFTVFtdKSB7XG4gICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB0aGlzLmkxOG4hLmFwcGVuZEJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4bkJpbmRQcm9wcyhwcm9wczoge1trZXk6IHN0cmluZ106IHQuVGV4dHx0LkJvdW5kVGV4dH0pOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSB7XG4gICAgY29uc3QgYm91bmQ6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgT2JqZWN0LmtleXMocHJvcHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSBwcm9wc1trZXldO1xuICAgICAgaWYgKHByb3AgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChwcm9wLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgY29uc3Qge3N0cmluZ3MsIGV4cHJlc3Npb25zfSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnN0IHtpZCwgYmluZGluZ3N9ID0gdGhpcy5pMThuITtcbiAgICAgICAgICBjb25zdCBsYWJlbCA9IGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nKHN0cmluZ3MsIGJpbmRpbmdzLnNpemUsIGlkKTtcbiAgICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9ucyk7XG4gICAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChsYWJlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH1cblxuICAvLyBHZW5lcmF0ZXMgdG9wIGxldmVsIHZhcnMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBpMThuX05gKS5cbiAgcHJpdmF0ZSBpMThuR2VuZXJhdGVNYWluQmxvY2tWYXIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShUUkFOU0xBVElPTl9WQVJfUFJFRklYKSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZXMgdmFycyB3aXRoIENsb3N1cmUtc3BlY2lmaWMgbmFtZXMgZm9yIGkxOG4gYmxvY2tzIChpLmUuIGBNU0dfWFhYYCkuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW52b2tlSW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4blN0YXJ0KHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgbWV0YTogaTE4bi5JMThuTWV0YSwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTpcbiAgICAgIHZvaWQge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgdGhpcy5pMThuID0gdGhpcy5pMThuQ29udGV4dCA/XG4gICAgICAgIHRoaXMuaTE4bkNvbnRleHQuZm9ya0NoaWxkQ29udGV4dChpbmRleCwgdGhpcy50ZW1wbGF0ZUluZGV4ISwgbWV0YSkgOlxuICAgICAgICBuZXcgSTE4bkNvbnRleHQoaW5kZXgsIHRoaXMuaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCksIDAsIHRoaXMudGVtcGxhdGVJbmRleCwgbWV0YSk7XG5cbiAgICAvLyBnZW5lcmF0ZSBpMThuU3RhcnQgaW5zdHJ1Y3Rpb25cbiAgICBjb25zdCB7aWQsIHJlZn0gPSB0aGlzLmkxOG47XG4gICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoaW5kZXgpLCB0aGlzLmFkZFRvQ29uc3RzKHJlZildO1xuICAgIGlmIChpZCA+IDApIHtcbiAgICAgIC8vIGRvIG5vdCBwdXNoIDNyZCBhcmd1bWVudCAoc3ViLWJsb2NrIGlkKVxuICAgICAgLy8gaW50byBpMThuU3RhcnQgY2FsbCBmb3IgdG9wIGxldmVsIGkxOG4gY29udGV4dFxuICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlkKSk7XG4gICAgfVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBzZWxmQ2xvc2luZyA/IFIzLmkxOG4gOiBSMy5pMThuU3RhcnQsIHBhcmFtcyk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAgIC8vIGZvciBpMThuIGJsb2NrLCBhZHZhbmNlIHRvIHRoZSBtb3N0IHJlY2VudCBlbGVtZW50IGluZGV4IChieSB0YWtpbmcgdGhlIGN1cnJlbnQgbnVtYmVyIG9mXG4gICAgICAgIC8vIGVsZW1lbnRzIGFuZCBzdWJ0cmFjdGluZyBvbmUpIGJlZm9yZSBpbnZva2luZyBgaTE4bkV4cGAgaW5zdHJ1Y3Rpb25zLCB0byBtYWtlIHN1cmUgdGhlXG4gICAgICAgIC8vIG5lY2Vzc2FyeSBsaWZlY3ljbGUgaG9va3Mgb2YgY29tcG9uZW50cy9kaXJlY3RpdmVzIGFyZSBwcm9wZXJseSBmbHVzaGVkLlxuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgICB0aGlzLmdldENvbnN0Q291bnQoKSAtIDEsIHNwYW4sIFIzLmkxOG5FeHAsICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhiaW5kaW5nKSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkFwcGx5LCBbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIH1cbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkVuZCk7XG4gICAgfVxuICAgIHRoaXMuaTE4biA9IG51bGw7ICAvLyByZXNldCBsb2NhbCBpMThuIGNvbnRleHRcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkF0dHJpYnV0ZXNJbnN0cnVjdGlvbihcbiAgICAgIG5vZGVJbmRleDogbnVtYmVyLCBhdHRyczogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiB2b2lkIHtcbiAgICBsZXQgaGFzQmluZGluZ3MgPSBmYWxzZTtcbiAgICBjb25zdCBpMThuQXR0ckFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgYXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhdHRyLmkxOG4hIGFzIGkxOG4uTWVzc2FnZTtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IGF0dHIudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhjb252ZXJ0ZWQpO1xuICAgICAgaWYgKGNvbnZlcnRlZCBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMobWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycyk7XG4gICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGFyYW1zKSk7XG4gICAgICAgIGNvbnZlcnRlZC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgICAgIGhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgICAgIG5vZGVJbmRleCwgc291cmNlU3BhbiwgUjMuaTE4bkV4cCwgKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGkxOG5BdHRyQXJncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBpbmRleDogby5FeHByZXNzaW9uID0gby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKTtcbiAgICAgIGNvbnN0IGNvbnN0SW5kZXggPSB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihpMThuQXR0ckFyZ3MpKTtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzb3VyY2VTcGFuLCBSMy5pMThuQXR0cmlidXRlcywgW2luZGV4LCBjb25zdEluZGV4XSk7XG4gICAgICBpZiAoaGFzQmluZGluZ3MpIHtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzb3VyY2VTcGFuLCBSMy5pMThuQXBwbHksIFtpbmRleF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFkZE5hbWVzcGFjZUluc3RydWN0aW9uKG5zSW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIHRoaXMuX25hbWVzcGFjZSA9IG5zSW5zdHJ1Y3Rpb247XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5IG9yIGF0dHJpYnV0ZSwgc3VjaCBhc1xuICAgKiBgcHJvcD1cInt7dmFsdWV9fVwiYCBvciBgYXR0ci50aXRsZT1cInt7dmFsdWV9fVwiYFxuICAgKi9cbiAgcHJpdmF0ZSBpbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50SW5kZXg6IG51bWJlciwgYXR0ck5hbWU6IHN0cmluZyxcbiAgICAgIGlucHV0OiB0LkJvdW5kQXR0cmlidXRlLCB2YWx1ZTogSW50ZXJwb2xhdGlvbiwgcGFyYW1zOiBhbnlbXSkge1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbixcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChhdHRyTmFtZSksIC4uLnRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpLCAuLi5wYXJhbXNdKTtcbiAgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBwcm9qZWN0aW9uU2xvdElkeCA9IHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCArIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoO1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG5cbiAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKTtcblxuICAgIGNvbnN0IG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzID1cbiAgICAgICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZmlsdGVyKGF0dHIgPT4gYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPVxuICAgICAgICB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKG5nQ29udGVudC5uYW1lLCBub25Db250ZW50U2VsZWN0QXR0cmlidXRlcywgW10sIFtdKTtcblxuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpLCBvLmxpdGVyYWxBcnIoYXR0cmlidXRlcykpO1xuICAgIH0gZWxzZSBpZiAocHJvamVjdGlvblNsb3RJZHggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRQcm9qZWN0aW9uKG5nQ29udGVudC5pMThuISwgc2xvdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHN0eWxpbmdCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKG51bGwpO1xuICAgIHRoaXMuZWxlbWVudExvY2F0aW9ucy5zZXQoZWxlbWVudCwge2luZGV4OiBlbGVtZW50SW5kZXgsIGxldmVsOiB0aGlzLmxldmVsfSk7XG5cbiAgICBsZXQgaXNOb25CaW5kYWJsZU1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudDogYm9vbGVhbiA9XG4gICAgICAgIGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShlbGVtZW50LmkxOG4pO1xuXG4gICAgY29uc3Qgb3V0cHV0QXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBIYW5kbGUgc3R5bGluZywgaTE4biwgbmdOb25CaW5kYWJsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHI7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRycy5wdXNoKGF0dHIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlZ3VsYXIgZWxlbWVudCBvciBuZy1jb250YWluZXIgY3JlYXRpb24gbW9kZVxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChlbGVtZW50SW5kZXgpXTtcbiAgICBpZiAoIWlzTmdDb250YWluZXIpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoZWxlbWVudE5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBhbGxPdGhlcklucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgYm91bmRJMThuQXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQpO1xuICAgICAgaWYgKCFzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgICAgaWYgKChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSB8fCBpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5Ud29XYXkpICYmXG4gICAgICAgICAgICBpbnB1dC5pMThuKSB7XG4gICAgICAgICAgYm91bmRJMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICAgIGVsZW1lbnQubmFtZSwgb3V0cHV0QXR0cnMsIGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMsIHN0eWxpbmdCdWlsZGVyLCBbXSxcbiAgICAgICAgYm91bmRJMThuQXR0cnMpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cmlidXRlcykpO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8ZGl2ICNmb28gI2Jhcj1cImJhelwiPilcbiAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4hLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikgPyAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzV2l0aFBpcGVzICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgYm91bmRJMThuQXR0cnMubGVuZ3RoID09PSAwICYmICFoYXNDaGlsZHJlbjtcbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9XG4gICAgICAgICFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uICYmIGhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXIgOiBSMy5lbGVtZW50LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0IDogUjMuZWxlbWVudFN0YXJ0LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcblxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJvdW5kSTE4bkF0dHJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5pMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBib3VuZEkxOG5BdHRycywgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgaWYgKGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb3V0cHV0QXN0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgIG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuVHdvV2F5ID8gUjMudHdvV2F5TGlzdGVuZXIgOiBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoZWxlbWVudC5uYW1lLCBvdXRwdXRBc3QsIGVsZW1lbnRJbmRleCkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGU6IGl0J3MgaW1wb3J0YW50IHRvIGtlZXAgaTE4bi9pMThuU3RhcnQgaW5zdHJ1Y3Rpb25zIGFmdGVyIGkxOG5BdHRyaWJ1dGVzIGFuZFxuICAgICAgLy8gbGlzdGVuZXJzLCB0byBtYWtlIHN1cmUgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24gdGFyZ2V0cyBjdXJyZW50IGVsZW1lbnQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5TdGFydChlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5pMThuISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBzdHlsZVByb3BgLFxuICAgIC8vIGBzdHlsZU1hcGAsIGBjbGFzc01hcGAsIGBjbGFzc1Byb3BgXG4gICAgLy8gYXJlIGFsbCBnZW5lcmF0ZWQgYW5kIGFzc2lnbmVkIGluIHRoZSBjb2RlIGJlbG93LlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbnMgPSBzdHlsaW5nQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBjb25zdCBsaW1pdCA9IHN0eWxpbmdJbnN0cnVjdGlvbnMubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IHN0eWxpbmdJbnN0cnVjdGlvbnNbaV07XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdGhpcy5wcm9jZXNzU3R5bGluZ1VwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIHRoZSByZWFzb24gd2h5IGB1bmRlZmluZWRgIGlzIHVzZWQgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgdW5kZXJzdGFuZHMgdGhpcyBhcyBhXG4gICAgLy8gc3BlY2lhbCB2YWx1ZSB0byBzeW1ib2xpemUgdGhhdCB0aGVyZSBpcyBubyBSSFMgdG8gdGhpcyBiaW5kaW5nXG4gICAgLy8gVE9ETyAobWF0c2tvKTogcmV2aXNpdCB0aGlzIG9uY2UgRlctOTU5IGlzIGFwcHJvYWNoZWRcbiAgICBjb25zdCBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uID0gby5saXRlcmFsKHVuZGVmaW5lZCk7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBPbWl0PEluc3RydWN0aW9uLCAncmVmZXJlbmNlJz5bXSA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgaW5wdXRUeXBlID0gaW5wdXQudHlwZTtcbiAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gYW5pbWF0aW9uIGJpbmRpbmdzIGNhbiBiZSBwcmVzZW50ZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXRzOlxuICAgICAgICAvLyAxLiBbQGJpbmRpbmddPVwiZm9vRXhwXCJcbiAgICAgICAgLy8gMi4gW0BiaW5kaW5nXT1cInt2YWx1ZTpmb29FeHAsIHBhcmFtczp7Li4ufX1cIlxuICAgICAgICAvLyAzLiBbQGJpbmRpbmddXG4gICAgICAgIC8vIDQuIEBiaW5kaW5nXG4gICAgICAgIC8vIEFsbCBmb3JtYXRzIHdpbGwgYmUgdmFsaWQgZm9yIHdoZW4gYSBzeW50aGV0aWMgYmluZGluZyBpcyBjcmVhdGVkLlxuICAgICAgICAvLyBUaGUgcmVhc29uaW5nIGZvciB0aGlzIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHNob3VsZCBnZXQgZWFjaFxuICAgICAgICAvLyBzeW50aGV0aWMgYmluZGluZyB2YWx1ZSBpbiB0aGUgb3JkZXIgb2YgdGhlIGFycmF5IHRoYXQgdGhleSBhcmVcbiAgICAgICAgLy8gZGVmaW5lZCBpbi4uLlxuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgTGl0ZXJhbFByaW1pdGl2ZSA/ICEhdmFsdWUudmFsdWUgOiB0cnVlO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIHNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgcmVmZXJlbmNlOiBSMy5wcm9wZXJ0eSxcbiAgICAgICAgICBwYXJhbXNPckZuOiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoXG4gICAgICAgICAgICAgICgpID0+IGhhc1ZhbHVlID8gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSA6IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb24sXG4gICAgICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoaW5wdXQubmFtZSkpXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgbXVzdCBza2lwIGF0dHJpYnV0ZXMgd2l0aCBhc3NvY2lhdGVkIGkxOG4gY29udGV4dCwgc2luY2UgdGhlc2UgYXR0cmlidXRlcyBhcmUgaGFuZGxlZFxuICAgICAgICAvLyBzZXBhcmF0ZWx5IGFuZCBjb3JyZXNwb25kaW5nIGBpMThuRXhwYCBhbmQgYGkxOG5BcHBseWAgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICAgIGlmIChpbnB1dC5pMThuKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IFthdHRyTmFtZXNwYWNlLCBhdHRyTmFtZV0gPSBzcGxpdE5zTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBpc0F0dHJpYnV0ZUJpbmRpbmcgPSBpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTtcbiAgICAgICAgICBsZXQgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LnNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGVCaW5kaW5nKTtcbiAgICAgICAgICBpZiAoIXNhbml0aXphdGlvblJlZikge1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2FzIG5vIHNhbml0aXphdGlvbiBmdW5jdGlvbiBmb3VuZCBiYXNlZCBvbiB0aGUgc2VjdXJpdHkgY29udGV4dFxuICAgICAgICAgICAgLy8gb2YgYW4gYXR0cmlidXRlL3Byb3BlcnR5IC0gY2hlY2sgd2hldGhlciB0aGlzIGF0dHJpYnV0ZS9wcm9wZXJ0eSBpc1xuICAgICAgICAgICAgLy8gb25lIG9mIHRoZSBzZWN1cml0eS1zZW5zaXRpdmUgPGlmcmFtZT4gYXR0cmlidXRlcyAoYW5kIHRoYXQgdGhlIGN1cnJlbnRcbiAgICAgICAgICAgIC8vIGVsZW1lbnQgaXMgYWN0dWFsbHkgYW4gPGlmcmFtZT4pLlxuICAgICAgICAgICAgaWYgKGlzSWZyYW1lRWxlbWVudChlbGVtZW50Lm5hbWUpICYmIGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKGlucHV0Lm5hbWUpKSB7XG4gICAgICAgICAgICAgIHNhbml0aXphdGlvblJlZiA9IG8uaW1wb3J0RXhwcihSMy52YWxpZGF0ZUlmcmFtZUF0dHJpYnV0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VMaXRlcmFsID0gby5saXRlcmFsKGF0dHJOYW1lc3BhY2UpO1xuXG4gICAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2Fzbid0IGEgc2FuaXRpemF0aW9uIHJlZiwgd2UgbmVlZCB0byBhZGRcbiAgICAgICAgICAgICAgLy8gYW4gZXh0cmEgcGFyYW0gc28gdGhhdCB3ZSBjYW4gcGFzcyBpbiB0aGUgbmFtZXNwYWNlLlxuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCksIG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IHNlcGFyYXRlIHR3by13YXkgcHJvcGVydHkgYmluZGluZ3MgYW5kIHJlZ3VsYXIgb25lcyxcbiAgICAgICAgICAvLyBiZWNhdXNlIHRoZWlyIGFzc2lnbm1lbnQgb3JkZXIgbmVlZHMgdG8gYmUgbWFpbnRhaW5lZC5cbiAgICAgICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSB8fCBpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLlR3b1dheSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICAvLyBwcm9wPVwie3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIlxuICAgICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCB0aGUgcHJvcGVydGllcyBzbyB0aGF0IHdlIGNhbiBjaGFpbiBpbnRvIGEgc2luZ2xlIGZ1bmN0aW9uIGF0IHRoZSBlbmQuXG4gICAgICAgICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgc3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuVHdvV2F5ID8gUjMudHdvV2F5UHJvcGVydHkgOiBSMy5wcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICBwYXJhbXNPckZuOiBnZXRCaW5kaW5nRnVuY3Rpb25QYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksIGF0dHJOYW1lLCBwYXJhbXMpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgodmFsdWUpID4gMSkge1xuICAgICAgICAgICAgICAvLyBhdHRyLm5hbWU9XCJ0ZXh0e3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJvdW5kVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9uc1swXSA6IHZhbHVlO1xuICAgICAgICAgICAgICAvLyBbYXR0ci5uYW1lXT1cInZhbHVlXCIgb3IgYXR0ci5uYW1lPVwie3t2YWx1ZX19XCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCB0aGUgYXR0cmlidXRlIGJpbmRpbmdzIHNvIHRoYXQgdGhleSBjYW4gYmUgY2hhaW5lZCBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBzcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIHBhcmFtc09yRm46IGdldEJpbmRpbmdGdW5jdGlvblBhcmFtcyhcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJvdW5kVmFsdWUpLCBhdHRyTmFtZSwgcGFyYW1zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xhc3MgcHJvcFxuICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgcHJvcGVydHlCaW5kaW5nIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBlbGVtZW50SW5kZXgsIHByb3BlcnR5QmluZGluZy5zcGFuLCBwcm9wZXJ0eUJpbmRpbmcucmVmZXJlbmNlLFxuICAgICAgICAgIHByb3BlcnR5QmluZGluZy5wYXJhbXNPckZuKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmcgb2YgYXR0cmlidXRlQmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBlbGVtZW50SW5kZXgsIGF0dHJpYnV0ZUJpbmRpbmcuc3BhbiwgUjMuYXR0cmlidXRlLCBhdHRyaWJ1dGVCaW5kaW5nLnBhcmFtc09yRm4pO1xuICAgIH1cblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biEsIGVsZW1lbnRJbmRleCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGNvbnN0IHNwYW4gPSBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuO1xuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4bkVuZChzcGFuLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmVuYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgIGNoaWxkcmVuOiB0Lk5vZGVbXSwgY29udGV4dE5hbWVTdWZmaXg6IHN0cmluZywgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10gPSBbXSxcbiAgICAgIGkxOG5NZXRhPzogaTE4bi5JMThuTWV0YSwgdmFyaWFibGVBbGlhc2VzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBpZiAodGhpcy5pMThuICYmIGkxOG5NZXRhKSB7XG4gICAgICBpZiAoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJsb2NrKGkxOG5NZXRhLCBpbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kVGVtcGxhdGUoaTE4bk1ldGEsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9JHtjb250ZXh0TmFtZVN1ZmZpeH1fJHtpbmRleH1gO1xuICAgIC8vIE5vdGU6IEZvciB0aGUgdW5pcXVlIG5hbWUsIHdlIGRvbid0IGluY2x1ZGUgYW4gdW5pcXVlIHN1ZmZpeCwgdW5sZXNzIHJlYWxseSBuZWVkZWQuXG4gICAgLy8gVGhpcyBrZWVwcyB0aGUgZ2VuZXJhdGVkIG91dHB1dCBtb3JlIGNsZWFuIGFzIG1vc3Qgb2YgdGhlIHRpbWUsIHdlIGRvbid0IGV4cGVjdCBjb25mbGljdHMuXG4gICAgY29uc3QgbmFtZSA9XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYCwgLyoqIGFsd2F5c0luY2x1ZGVTdWZmaXggKi8gZmFsc2UpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sIGluZGV4LCBuYW1lLFxuICAgICAgICB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsIHRoaXMuZGVmZXJCbG9ja3MsXG4gICAgICAgIHRoaXMuZWxlbWVudExvY2F0aW9ucywgdGhpcy5hbGxEZWZlcnJhYmxlRGVwc0ZuLCB0aGlzLl9jb25zdGFudHMpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsIGFmdGVyIHRoZWlyIHBhcmVudCB0ZW1wbGF0ZXMgaGF2ZSBjb21wbGV0ZWRcbiAgICAvLyBwcm9jZXNzaW5nLCBzbyB0aGV5IGFyZSBxdWV1ZWQgaGVyZSB1bnRpbCBhZnRlciB0aGUgaW5pdGlhbCBwYXNzLiBPdGhlcndpc2UsIHdlIHdvdWxkbid0XG4gICAgLy8gYmUgYWJsZSB0byBzdXBwb3J0IGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgdG8gbG9jYWwgcmVmcyB0aGF0IG9jY3VyIGFmdGVyIHRoZVxuICAgIC8vIHRlbXBsYXRlIGRlZmluaXRpb24uIGUuZy4gPGRpdiAqbmdJZj1cInNob3dpbmdcIj57eyBmb28gfX08L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID0gdmlzaXRvci5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICAgICAgY2hpbGRyZW4sIHZhcmlhYmxlcywgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsXG4gICAgICAgICAgaTE4bk1ldGEsIHZhcmlhYmxlQWxpYXNlcyk7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdChuYW1lKSk7XG4gICAgICBpZiAodmlzaXRvci5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5wdXNoKC4uLnZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZURhdGEobmFtZSwgaW5kZXgsIHZpc2l0b3IuX2JpbmRpbmdTY29wZSwgdmlzaXRvcik7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgIHRhZ05hbWU6IHN0cmluZ3xudWxsLCBjaGlsZHJlbjogdC5Ob2RlW10sIGNvbnRleHROYW1lU3VmZml4OiBzdHJpbmcsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW10sIGF0dHJzRXhwcnM/OiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIHJlZmVyZW5jZXM/OiB0LlJlZmVyZW5jZVtdLCBpMThuPzogaTE4bi5JMThuTWV0YSk6IG51bWJlciB7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihjaGlsZHJlbiwgY29udGV4dE5hbWVTdWZmaXgsIHZhcmlhYmxlcywgaTE4bik7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoZGF0YS5pbmRleCksXG4gICAgICBvLnZhcmlhYmxlKGRhdGEubmFtZSksXG4gICAgICBvLmxpdGVyYWwodGFnTmFtZSksXG4gICAgICB0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cnNFeHBycyB8fCBudWxsKSxcbiAgICBdO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8bmctdGVtcGxhdGUgI2Zvbz4pXG4gICAgaWYgKHJlZmVyZW5jZXMgJiYgcmVmZXJlbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KHJlZmVyZW5jZXMpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZSgyLCAwLCBvLmxpdGVyYWwoZGF0YS5nZXRDb25zdENvdW50KCkpLCBvLmxpdGVyYWwoZGF0YS5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGF0YS5pbmRleDtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgIC8vIGl0IGJhc2VkIG9uIHRoZSBwYXJlbnQgbm9kZXMgaW5zaWRlIHRoZSB0ZW1wbGF0ZSBpbnN0cnVjdGlvbi5cbiAgICBjb25zdCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9XG4gICAgICAgIHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWU7XG4gICAgY29uc3QgY29udGV4dE5hbWVTdWZmaXggPSB0ZW1wbGF0ZS50YWdOYW1lID8gJ18nICsgc2FuaXRpemVJZGVudGlmaWVyKHRlbXBsYXRlLnRhZ05hbWUpIDogJyc7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgICBOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUuYXR0cmlidXRlcywgdGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzLFxuICAgICAgICB1bmRlZmluZWQgLyogc3R5bGVzICovLCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIHRlbXBsYXRlLmNoaWxkcmVuLCBjb250ZXh0TmFtZVN1ZmZpeCwgdGVtcGxhdGUuc291cmNlU3BhbixcbiAgICAgICAgdGVtcGxhdGUudmFyaWFibGVzLCBhdHRyc0V4cHJzLCB0ZW1wbGF0ZS5yZWZlcmVuY2VzLCB0ZW1wbGF0ZS5pMThuKTtcblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIMm1ybVwcm9wZXJ0eSgnbmdGb3JPZicsIGN0eC5pdGVtcyksIGV0IGFsO1xuICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMpO1xuXG4gICAgLy8gT25seSBhZGQgbm9ybWFsIGlucHV0L291dHB1dCBiaW5kaW5nIGluc3RydWN0aW9ucyBvbiBleHBsaWNpdCA8bmctdGVtcGxhdGU+IGVsZW1lbnRzLlxuICAgIGlmICh0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUpIHtcbiAgICAgIGNvbnN0IFtpMThuSW5wdXRzLCBpbnB1dHNdID1cbiAgICAgICAgICBwYXJ0aXRpb25BcnJheTx0LkJvdW5kQXR0cmlidXRlLCB0LkJvdW5kQXR0cmlidXRlPih0ZW1wbGF0ZS5pbnB1dHMsIGhhc0kxOG5NZXRhKTtcblxuICAgICAgLy8gQWRkIGkxOG4gYXR0cmlidXRlcyB0aGF0IG1heSBhY3QgYXMgaW5wdXRzIHRvIGRpcmVjdGl2ZXMuIElmIHN1Y2ggYXR0cmlidXRlcyBhcmUgcHJlc2VudCxcbiAgICAgIC8vIGdlbmVyYXRlIGBpMThuQXR0cmlidXRlc2AgaW5zdHJ1Y3Rpb24uIE5vdGU6IHdlIGdlbmVyYXRlIGl0IG9ubHkgZm9yIGV4cGxpY2l0IDxuZy10ZW1wbGF0ZT5cbiAgICAgIC8vIGVsZW1lbnRzLCBpbiBjYXNlIG9mIGlubGluZSB0ZW1wbGF0ZXMsIGNvcnJlc3BvbmRpbmcgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZVxuICAgICAgLy8gbmVzdGVkIHRlbXBsYXRlIGZ1bmN0aW9uLlxuICAgICAgaWYgKGkxOG5JbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmkxOG5BdHRyaWJ1dGVzSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCBpMThuSW5wdXRzLCB0ZW1wbGF0ZS5zdGFydFNvdXJjZVNwYW4gPz8gdGVtcGxhdGUuc291cmNlU3Bhbik7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgaW5wdXQgYmluZGluZ3NcbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCBpbnB1dHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBsaXN0ZW5lcnMgZm9yIGRpcmVjdGl2ZSBvdXRwdXRcbiAgICAgIGZvciAoY29uc3Qgb3V0cHV0QXN0IG9mIHRlbXBsYXRlLm91dHB1dHMpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBvdXRwdXRBc3QudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLlR3b1dheSA/IFIzLnR3b1dheUxpc3RlbmVyIDogUjMubGlzdGVuZXIsXG4gICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRUZXh0QXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRFdmVudCA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0RGVmZXJyZWRUcmlnZ2VyID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdElmQmxvY2tCcmFuY2ggPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFN3aXRjaEJsb2NrQ2FzZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFVua25vd25CbG9jayA9IGludmFsaWQ7XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogdC5Cb3VuZFRleHQpIHtcbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRoaXMuaTE4bi5hcHBlbmRCb3VuZFRleHQodGV4dC5pMThuISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBub2RlSW5kZXgsIHRleHQuc291cmNlU3BhbiwgZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSxcbiAgICAgICAgICAoKSA9PiB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdUZXh0IG5vZGVzIHNob3VsZCBiZSBpbnRlcnBvbGF0ZWQgYW5kIG5ldmVyIGJvdW5kIGRpcmVjdGx5LicpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuISwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4biA9IHRoaXMuaTE4biE7XG4gICAgY29uc3QgdmFycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UudmFycyk7XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS5wbGFjZWhvbGRlcnMpO1xuXG4gICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICBjb25zdCBtZXNzYWdlID0gaWN1LmkxOG4hIGFzIGkxOG4uTWVzc2FnZTtcblxuICAgIC8vIHdlIGFsd2F5cyBuZWVkIHBvc3QtcHJvY2Vzc2luZyBmdW5jdGlvbiBmb3IgSUNVcywgdG8gbWFrZSBzdXJlIHRoYXQ6XG4gICAgLy8gLSBhbGwgcGxhY2Vob2xkZXJzIGluIGEgZm9ybSBvZiB7UExBQ0VIT0xERVJ9IGFyZSByZXBsYWNlZCB3aXRoIGFjdHVhbCB2YWx1ZXMgKG5vdGU6XG4gICAgLy8gYGdvb2cuZ2V0TXNnYCBkb2VzIG5vdCBwcm9jZXNzIElDVXMgYW5kIHVzZXMgdGhlIGB7UExBQ0VIT0xERVJ9YCBmb3JtYXQgZm9yIHBsYWNlaG9sZGVyc1xuICAgIC8vIGluc2lkZSBJQ1VzKVxuICAgIC8vIC0gYWxsIElDVSB2YXJzIChzdWNoIGFzIGBWQVJfU0VMRUNUYCBvciBgVkFSX1BMVVJBTGApIGFyZSByZXBsYWNlZCB3aXRoIGNvcnJlY3QgdmFsdWVzXG4gICAgY29uc3QgdHJhbnNmb3JtRm4gPSAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAvLyBTb3J0IHRoZSBtYXAgZW50cmllcyBpbiB0aGUgY29tcGlsZWQgb3V0cHV0LiBUaGlzIG1ha2VzIGl0IGVhc3kgdG8gYWNoZWl2ZSBpZGVudGljYWwgb3V0cHV0XG4gICAgICAvLyBpbiB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgY29tcGlsZXIuXG4gICAgICBjb25zdCBwYXJhbXMgPSBPYmplY3QuZnJvbUVudHJpZXMoT2JqZWN0LmVudHJpZXMoey4uLnZhcnMsIC4uLnBsYWNlaG9sZGVyc30pLnNvcnQoKSk7XG4gICAgICBjb25zdCBmb3JtYXR0ZWQgPSBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lc0luTWFwKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKTtcbiAgICAgIHJldHVybiBpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5pMThuUG9zdHByb2Nlc3MsIFtyYXcsIG1hcExpdGVyYWwoZm9ybWF0dGVkLCB0cnVlKV0pO1xuICAgIH07XG5cbiAgICAvLyBpbiBjYXNlIHRoZSB3aG9sZSBpMThuIG1lc3NhZ2UgaXMgYSBzaW5nbGUgSUNVIC0gd2UgZG8gbm90IG5lZWQgdG9cbiAgICAvLyBjcmVhdGUgYSBzZXBhcmF0ZSB0b3AtbGV2ZWwgdHJhbnNsYXRpb24sIHdlIGNhbiB1c2UgdGhlIHJvb3QgcmVmIGluc3RlYWRcbiAgICAvLyBhbmQgbWFrZSB0aGlzIElDVSBhIHRvcC1sZXZlbCB0cmFuc2xhdGlvblxuICAgIC8vIG5vdGU6IElDVSBwbGFjZWhvbGRlcnMgYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyBpbiBgaTE4blBvc3Rwcm9jZXNzYCBmdW5jdGlvblxuICAgIC8vIHNlcGFyYXRlbHksIHNvIHdlIGRvIG5vdCBwYXNzIHBsYWNlaG9sZGVycyBpbnRvIGBpMThuVHJhbnNsYXRlYCBmdW5jdGlvbi5cbiAgICBpZiAoaXNTaW5nbGVJMThuSWN1KGkxOG4ubWV0YSkpIHtcbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCAvKiBwbGFjZWhvbGRlcnMgKi8ge30sIGkxOG4ucmVmLCB0cmFuc2Zvcm1Gbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgICBjb25zdCByZWYgPVxuICAgICAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCAvKiBwbGFjZWhvbGRlcnMgKi8ge30sIC8qIHJlZiAqLyB1bmRlZmluZWQsIHRyYW5zZm9ybUZuKTtcbiAgICAgIGkxOG4uYXBwZW5kSWN1KGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKS5uYW1lLCByZWYpO1xuICAgIH1cblxuICAgIGlmIChpbml0V2FzSW52b2tlZCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHRydWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogdC5JZkJsb2NrKTogdm9pZCB7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgb2YgdGhlIGV4cHJlc3Npb24uXG4gICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhudWxsKTtcblxuICAgIC8vIFdlIGhhdmUgdG8gcHJvY2VzcyB0aGUgYmxvY2sgaW4gdHdvIHN0ZXBzOiBvbmNlIGhlcmUgYW5kIGFnYWluIGluIHRoZSB1cGRhdGUgaW5zdHJ1Y3Rpb25cbiAgICAvLyBjYWxsYmFjayBpbiBvcmRlciB0byBnZW5lcmF0ZSB0aGUgY29ycmVjdCBleHByZXNzaW9ucyB3aGVuIHBpcGVzIG9yIHB1cmUgZnVuY3Rpb25zIGFyZVxuICAgIC8vIHVzZWQgaW5zaWRlIHRoZSBicmFuY2ggZXhwcmVzc2lvbnMuXG4gICAgY29uc3QgYnJhbmNoRGF0YSA9IGJsb2NrLmJyYW5jaGVzLm1hcCgoYnJhbmNoLCBicmFuY2hJbmRleCkgPT4ge1xuICAgICAgY29uc3Qge2V4cHJlc3Npb24sIGV4cHJlc3Npb25BbGlhcywgY2hpbGRyZW4sIHNvdXJjZVNwYW59ID0gYnJhbmNoO1xuXG4gICAgICAvLyBJZiB0aGUgYnJhbmNoIGhhcyBhbiBhbGlhcywgaXQnbGwgYmUgYXNzaWduZWQgZGlyZWN0bHkgdG8gdGhlIGNvbnRhaW5lcidzIGNvbnRleHQuXG4gICAgICAvLyBXZSBkZWZpbmUgYSB2YXJpYWJsZSByZWZlcnJpbmcgZGlyZWN0bHkgdG8gdGhlIGNvbnRleHQgc28gdGhhdCBhbnkgbmVzdGVkIHVzYWdlcyBjYW4gYmVcbiAgICAgIC8vIHJld3JpdHRlbiB0byByZWZlciB0byBpdC5cbiAgICAgIGNvbnN0IHZhcmlhYmxlcyA9IGV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCA/XG4gICAgICAgICAgW25ldyB0LlZhcmlhYmxlKFxuICAgICAgICAgICAgICBleHByZXNzaW9uQWxpYXMubmFtZSwgRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFLCBleHByZXNzaW9uQWxpYXMuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgZXhwcmVzc2lvbkFsaWFzLmtleVNwYW4pXSA6XG4gICAgICAgICAgdW5kZWZpbmVkO1xuXG4gICAgICBsZXQgdGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgICAgbGV0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdfHVuZGVmaW5lZDtcblxuICAgICAgLy8gT25seSB0aGUgZmlyc3QgYnJhbmNoIGNhbiBiZSB1c2VkIGZvciBwcm9qZWN0aW9uLCBiZWNhdXNlIHRoZSBjb25kaXRpb25hbFxuICAgICAgLy8gdXNlcyB0aGUgY29udGFpbmVyIG9mIHRoZSBmaXJzdCBicmFuY2ggYXMgdGhlIGluc2VydGlvbiBwb2ludCBmb3IgYWxsIGJyYW5jaGVzLlxuICAgICAgaWYgKGJyYW5jaEluZGV4ID09PSAwKSB7XG4gICAgICAgIGNvbnN0IGluZmVycmVkRGF0YSA9IHRoaXMuaW5mZXJQcm9qZWN0aW9uRGF0YUZyb21JbnNlcnRpb25Qb2ludChicmFuY2gpO1xuICAgICAgICB0YWdOYW1lID0gaW5mZXJyZWREYXRhLnRhZ05hbWU7XG4gICAgICAgIGF0dHJzRXhwcnMgPSBpbmZlcnJlZERhdGEuYXR0cnNFeHBycztcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZTogdGhlIHRlbXBsYXRlIG5lZWRzIHRvIGJlIGNyZWF0ZWQgKmJlZm9yZSogd2UgcHJvY2VzcyB0aGUgZXhwcmVzc2lvbixcbiAgICAgIC8vIG90aGVyd2lzZSBwaXBlcyBpbmplY3Rpbmcgc29tZSBzeW1ib2xzIHdvbid0IHdvcmsgKHNlZSAjNTIxMDIpLlxuICAgICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgIHRhZ05hbWUsIGNoaWxkcmVuLCAnX0NvbmRpdGlvbmFsJywgc291cmNlU3BhbiwgdmFyaWFibGVzLCBhdHRyc0V4cHJzLCB1bmRlZmluZWQsXG4gICAgICAgICAgYnJhbmNoLmkxOG4pO1xuICAgICAgY29uc3QgcHJvY2Vzc2VkRXhwcmVzc2lvbiA9XG4gICAgICAgICAgZXhwcmVzc2lvbiA9PT0gbnVsbCA/IG51bGwgOiBleHByZXNzaW9uLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHJldHVybiB7aW5kZXg6IHRlbXBsYXRlSW5kZXgsIGV4cHJlc3Npb246IHByb2Nlc3NlZEV4cHJlc3Npb24sIGFsaWFzOiBleHByZXNzaW9uQWxpYXN9O1xuICAgIH0pO1xuXG4gICAgLy8gVXNlIHRoZSBpbmRleCBvZiB0aGUgZmlyc3QgYmxvY2sgYXMgdGhlIGluZGV4IGZvciB0aGUgZW50aXJlIGNvbnRhaW5lci5cbiAgICBjb25zdCBjb250YWluZXJJbmRleCA9IGJyYW5jaERhdGFbMF0uaW5kZXg7XG4gICAgY29uc3QgcGFyYW1zQ2FsbGJhY2sgPSAoKSA9PiB7XG4gICAgICBsZXQgY29udGV4dFZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICAgICAgY29uc3QgZ2VuZXJhdGVCcmFuY2ggPSAoYnJhbmNoSW5kZXg6IG51bWJlcik6IG8uRXhwcmVzc2lvbiA9PiB7XG4gICAgICAgIC8vIElmIHdlJ3ZlIGdvbmUgYmV5b25kIHRoZSBsYXN0IGJyYW5jaCwgcmV0dXJuIHRoZSBzcGVjaWFsIC0xIHZhbHVlIHdoaWNoIG1lYW5zIHRoYXQgbm9cbiAgICAgICAgLy8gdmlldyB3aWxsIGJlIHJlbmRlcmVkLiBOb3RlIHRoYXQgd2UgZG9uJ3QgbmVlZCB0byByZXNldCB0aGUgY29udGV4dCBoZXJlLCBiZWNhdXNlIC0xXG4gICAgICAgIC8vIHdvbid0IHJlbmRlciBhIHZpZXcgc28gdGhlIHBhc3NlZC1pbiBjb250ZXh0IHdvbid0IGJlIGNhcHR1cmVkLlxuICAgICAgICBpZiAoYnJhbmNoSW5kZXggPiBicmFuY2hEYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICByZXR1cm4gby5saXRlcmFsKC0xKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHtpbmRleCwgZXhwcmVzc2lvbiwgYWxpYXN9ID0gYnJhbmNoRGF0YVticmFuY2hJbmRleF07XG5cbiAgICAgICAgLy8gSWYgdGhlIGJyYW5jaCBoYXMgbm8gZXhwcmVzc2lvbiwgaXQgbWVhbnMgdGhhdCBpdCdzIHRoZSBmaW5hbCBgZWxzZWAuXG4gICAgICAgIC8vIFJldHVybiBpdHMgaW5kZXggYW5kIHN0b3AgdGhlIHJlY3Vyc2lvbi4gQXNzdW1lcyB0aGF0IHRoZXJlJ3Mgb25seSBvbmVcbiAgICAgICAgLy8gYGVsc2VgIGNvbmRpdGlvbiBhbmQgdGhhdCBpdCdzIHRoZSBsYXN0IGJyYW5jaC5cbiAgICAgICAgaWYgKGV4cHJlc3Npb24gPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gby5saXRlcmFsKGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjb21wYXJpc29uVGFyZ2V0OiBvLkV4cHJlc3Npb247XG5cbiAgICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGJyYW5jaCBpcyBhbGlhc2VkLCB3ZSBuZWVkIHRvIGFzc2lnbiB0aGUgZXhwcmVzc2lvbiB2YWx1ZSB0byB0aGUgdGVtcG9yYXJ5XG4gICAgICAgICAgLy8gdmFyaWFibGUgYW5kIHRoZW4gcGFzcyBpdCBpbnRvIGBjb25kaXRpb25hbGAuIEUuZy4gZm9yIHRoZSBleHByZXNzaW9uOlxuICAgICAgICAgIC8vIGBAaWYgKGZvbygpOyBhcyBhbGlhcykgey4uLn1gIHdlIGhhdmUgdG8gZ2VuZXJhdGU6XG4gICAgICAgICAgLy8gYGBgXG4gICAgICAgICAgLy8gbGV0IHRlbXA7XG4gICAgICAgICAgLy8gY29uZGl0aW9uYWwoMCwgKHRlbXAgPSBjdHguZm9vKCkpID8gMCA6IC0xLCB0ZW1wKTtcbiAgICAgICAgICAvLyBgYGBcbiAgICAgICAgICBjb250ZXh0VmFyaWFibGUgPSB0aGlzLmFsbG9jYXRlQ29udHJvbEZsb3dUZW1wVmFyaWFibGUoKTtcbiAgICAgICAgICBjb21wYXJpc29uVGFyZ2V0ID0gY29udGV4dFZhcmlhYmxlLnNldCh0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXBhcmlzb25UYXJnZXQgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGFyaXNvblRhcmdldC5jb25kaXRpb25hbChvLmxpdGVyYWwoaW5kZXgpLCBnZW5lcmF0ZUJyYW5jaChicmFuY2hJbmRleCArIDEpKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBhcmFtcyA9IFtvLmxpdGVyYWwoY29udGFpbmVySW5kZXgpLCBnZW5lcmF0ZUJyYW5jaCgwKV07XG5cbiAgICAgIGlmIChjb250ZXh0VmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAgICAgcGFyYW1zLnB1c2goY29udGV4dFZhcmlhYmxlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9O1xuXG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICBjb250YWluZXJJbmRleCwgYmxvY2suYnJhbmNoZXNbMF0uc291cmNlU3BhbiwgUjMuY29uZGl0aW9uYWwsIHBhcmFtc0NhbGxiYWNrKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IHQuU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgICBpZiAoYmxvY2suY2FzZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gV2UgaGF2ZSB0byBwcm9jZXNzIHRoZSBibG9jayBpbiB0d28gc3RlcHM6IG9uY2UgaGVyZSBhbmQgYWdhaW4gaW4gdGhlIHVwZGF0ZSBpbnN0cnVjdGlvblxuICAgIC8vIGNhbGxiYWNrIGluIG9yZGVyIHRvIGdlbmVyYXRlIHRoZSBjb3JyZWN0IGV4cHJlc3Npb25zIHdoZW4gcGlwZXMgb3IgcHVyZSBmdW5jdGlvbnMgYXJlIHVzZWQuXG4gICAgY29uc3QgY2FzZURhdGEgPSBibG9jay5jYXNlcy5tYXAoY3VycmVudENhc2UgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICBudWxsLCBjdXJyZW50Q2FzZS5jaGlsZHJlbiwgJ19DYXNlJywgY3VycmVudENhc2Uuc291cmNlU3BhbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgICAgdW5kZWZpbmVkLCBjdXJyZW50Q2FzZS5pMThuKTtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjdXJyZW50Q2FzZS5leHByZXNzaW9uID09PSBudWxsID9cbiAgICAgICAgICBudWxsIDpcbiAgICAgICAgICBjdXJyZW50Q2FzZS5leHByZXNzaW9uLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHJldHVybiB7aW5kZXgsIGV4cHJlc3Npb259O1xuICAgIH0pO1xuXG4gICAgLy8gVXNlIHRoZSBpbmRleCBvZiB0aGUgZmlyc3QgYmxvY2sgYXMgdGhlIGluZGV4IGZvciB0aGUgZW50aXJlIGNvbnRhaW5lci5cbiAgICBjb25zdCBjb250YWluZXJJbmRleCA9IGNhc2VEYXRhWzBdLmluZGV4O1xuXG4gICAgLy8gTm90ZTogdGhlIGV4cHJlc3Npb24gbmVlZHMgdG8gYmUgcHJvY2Vzc2VkICphZnRlciogdGhlIHRlbXBsYXRlLFxuICAgIC8vIG90aGVyd2lzZSBwaXBlcyBpbmplY3Rpbmcgc29tZSBzeW1ib2xzIHdvbid0IHdvcmsgKHNlZSAjNTIxMDIpLlxuICAgIGNvbnN0IGJsb2NrRXhwcmVzc2lvbiA9IGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMobnVsbCk7ICAvLyBBbGxvY2F0ZSBhIHNsb3QgZm9yIHRoZSBwcmltYXJ5IGJsb2NrIGV4cHJlc3Npb24uXG5cbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoY29udGFpbmVySW5kZXgsIGJsb2NrLnNvdXJjZVNwYW4sIFIzLmNvbmRpdGlvbmFsLCAoKSA9PiB7XG4gICAgICBjb25zdCBnZW5lcmF0ZUNhc2VzID0gKGNhc2VJbmRleDogbnVtYmVyKTogby5FeHByZXNzaW9uID0+IHtcbiAgICAgICAgLy8gSWYgd2UndmUgZ29uZSBiZXlvbmQgdGhlIGxhc3QgYnJhbmNoLCByZXR1cm4gdGhlIHNwZWNpYWwgLTFcbiAgICAgICAgLy8gdmFsdWUgd2hpY2ggbWVhbnMgdGhhdCBubyB2aWV3IHdpbGwgYmUgcmVuZGVyZWQuXG4gICAgICAgIGlmIChjYXNlSW5kZXggPiBjYXNlRGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbCgtMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7aW5kZXgsIGV4cHJlc3Npb259ID0gY2FzZURhdGFbY2FzZUluZGV4XTtcblxuICAgICAgICAvLyBJZiB0aGUgY2FzZSBoYXMgbm8gZXhwcmVzc2lvbiwgaXQgbWVhbnMgdGhhdCBpdCdzIHRoZSBgZGVmYXVsdGAgY2FzZS5cbiAgICAgICAgLy8gUmV0dXJuIGl0cyBpbmRleCBhbmQgc3RvcCB0aGUgcmVjdXJzaW9uLiBBc3N1bWVzIHRoYXQgdGhlcmUncyBvbmx5IG9uZVxuICAgICAgICAvLyBgZGVmYXVsdGAgY29uZGl0aW9uIGFuZCB0aGF0IGl0J3MgZGVmaW5lZCBsYXN0LlxuICAgICAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBvLmxpdGVyYWwoaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgdGhpcyBpcyB0aGUgdmVyeSBmaXJzdCBjb21wYXJpc29uLCB3ZSBuZWVkIHRvIGFzc2lnbiB0aGUgdmFsdWUgb2YgdGhlIHByaW1hcnlcbiAgICAgICAgLy8gZXhwcmVzc2lvbiBhcyBhIHBhcnQgb2YgdGhlIGNvbXBhcmlzb24gc28gdGhlIHJlbWFpbmluZyBjYXNlcyBjYW4gcmV1c2UgaXQuIEluIHByYWN0aWNlXG4gICAgICAgIC8vIHRoaXMgbG9va3MgYXMgZm9sbG93czpcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIGxldCB0ZW1wO1xuICAgICAgICAvLyBjb25kaXRpb25hbCgxLCAodGVtcCA9IGN0eC5mb28pID09PSAxID8gMSA6IHRlbXAgPT09IDIgPyAyIDogdGVtcCA9PT0gMyA/IDMgOiA0KTtcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIGNvbnN0IGNvbXBhcmlzb25UYXJnZXQgPSBjYXNlSW5kZXggPT09IDAgP1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUNvbnRyb2xGbG93VGVtcFZhcmlhYmxlKCkuc2V0KFxuICAgICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhibG9ja0V4cHJlc3Npb24pKSA6XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlQ29udHJvbEZsb3dUZW1wVmFyaWFibGUoKTtcblxuICAgICAgICByZXR1cm4gY29tcGFyaXNvblRhcmdldC5pZGVudGljYWwodGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGV4cHJlc3Npb24pKVxuICAgICAgICAgICAgLmNvbmRpdGlvbmFsKG8ubGl0ZXJhbChpbmRleCksIGdlbmVyYXRlQ2FzZXMoY2FzZUluZGV4ICsgMSkpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIFtvLmxpdGVyYWwoY29udGFpbmVySW5kZXgpLCBnZW5lcmF0ZUNhc2VzKDApXTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gICAgY29uc3Qge2xvYWRpbmcsIHBsYWNlaG9sZGVyLCBlcnJvciwgdHJpZ2dlcnMsIHByZWZldGNoVHJpZ2dlcnN9ID0gZGVmZXJyZWQ7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmRlZmVyQmxvY2tzLmdldChkZWZlcnJlZCk7XG5cbiAgICBpZiAoIW1ldGFkYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCByZXNvbHZlIGBkZWZlcmAgYmxvY2sgbWV0YWRhdGEuIEJsb2NrIG1heSBuZWVkIHRvIGJlIGFuYWx5emVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IHByaW1hcnlUZW1wbGF0ZUluZGV4ID0gdGhpcy5jcmVhdGVFbWJlZGRlZFRlbXBsYXRlRm4oXG4gICAgICAgIG51bGwsIGRlZmVycmVkLmNoaWxkcmVuLCAnX0RlZmVyJywgZGVmZXJyZWQuc291cmNlU3BhbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgZGVmZXJyZWQuaTE4bik7XG4gICAgY29uc3QgbG9hZGluZ0luZGV4ID0gbG9hZGluZyA/IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgbG9hZGluZy5jaGlsZHJlbiwgJ19EZWZlckxvYWRpbmcnLCBsb2FkaW5nLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsb2FkaW5nLmkxOG4pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbDtcbiAgICBjb25zdCBsb2FkaW5nQ29uc3RzID0gbG9hZGluZyA/XG4gICAgICAgIHRyaW1UcmFpbGluZ051bGxzKFtvLmxpdGVyYWwobG9hZGluZy5taW5pbXVtVGltZSksIG8ubGl0ZXJhbChsb2FkaW5nLmFmdGVyVGltZSldKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBjb25zdCBwbGFjZWhvbGRlckluZGV4ID0gcGxhY2Vob2xkZXIgP1xuICAgICAgICB0aGlzLmNyZWF0ZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICAgIG51bGwsIHBsYWNlaG9sZGVyLmNoaWxkcmVuLCAnX0RlZmVyUGxhY2Vob2xkZXInLCBwbGFjZWhvbGRlci5zb3VyY2VTcGFuLCB1bmRlZmluZWQsXG4gICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcGxhY2Vob2xkZXIuaTE4bikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyQ29uc3RzID0gcGxhY2Vob2xkZXIgJiYgcGxhY2Vob2xkZXIubWluaW11bVRpbWUgIT09IG51bGwgP1xuICAgICAgICAvLyBUT0RPKGNyaXNiZXRvKTogcG90ZW50aWFsbHkgcGFzcyB0aGUgdGltZSBkaXJlY3RseSBpbnN0ZWFkIG9mIHN0b3JpbmcgaXQgaW4gdGhlIGBjb25zdHNgXG4gICAgICAgIC8vIHNpbmNlIHRoZSBwbGFjZWhvbGRlciBibG9jayBjYW4gb25seSBoYXZlIG9uZSBwYXJhbWV0ZXI/XG4gICAgICAgIG8ubGl0ZXJhbEFycihbby5saXRlcmFsKHBsYWNlaG9sZGVyLm1pbmltdW1UaW1lKV0pIDpcbiAgICAgICAgbnVsbDtcblxuICAgIGNvbnN0IGVycm9ySW5kZXggPSBlcnJvciA/IHRoaXMuY3JlYXRlRW1iZWRkZWRUZW1wbGF0ZUZuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLCBlcnJvci5jaGlsZHJlbiwgJ19EZWZlckVycm9yJywgZXJyb3Iuc291cmNlU3BhbiwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZXJyb3IuaTE4bikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGw7XG5cbiAgICAvLyBOb3RlOiB3ZSBnZW5lcmF0ZSB0aGlzIGxhc3Qgc28gdGhlIGluZGV4IG1hdGNoZXMgdGhlIGluc3RydWN0aW9uIG9yZGVyLlxuICAgIGNvbnN0IGRlZmVycmVkSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBkZXBzRm5OYW1lID0gYCR7dGhpcy5jb250ZXh0TmFtZX1fRGVmZXJfJHtkZWZlcnJlZEluZGV4fV9EZXBzRm5gO1xuXG4gICAgLy8gZS5nLiBgZGVmZXIoMSwgMCwgTXlDb21wX0RlZmVyXzFfRGVwc0ZuLCAuLi4pYFxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgZGVmZXJyZWQuc291cmNlU3BhbiwgUjMuZGVmZXIsIHRyaW1UcmFpbGluZ051bGxzKFtcbiAgICAgICAgICBvLmxpdGVyYWwoZGVmZXJyZWRJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKHByaW1hcnlUZW1wbGF0ZUluZGV4KSxcbiAgICAgICAgICB0aGlzLmFsbERlZmVycmFibGVEZXBzRm4gPz8gdGhpcy5jcmVhdGVEZWZlcnJlZERlcHNGdW5jdGlvbihkZXBzRm5OYW1lLCBtZXRhZGF0YSksXG4gICAgICAgICAgby5saXRlcmFsKGxvYWRpbmdJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKHBsYWNlaG9sZGVySW5kZXgpLFxuICAgICAgICAgIG8ubGl0ZXJhbChlcnJvckluZGV4KSxcbiAgICAgICAgICBsb2FkaW5nQ29uc3RzPy5sZW5ndGggPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihsb2FkaW5nQ29uc3RzKSkgOiBvLlRZUEVEX05VTExfRVhQUixcbiAgICAgICAgICBwbGFjZWhvbGRlckNvbnN0cyA/IHRoaXMuYWRkVG9Db25zdHMocGxhY2Vob2xkZXJDb25zdHMpIDogby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgICAgICAgKGxvYWRpbmdDb25zdHM/Lmxlbmd0aCB8fCBwbGFjZWhvbGRlckNvbnN0cykgP1xuICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuZGVmZXJFbmFibGVUaW1lclNjaGVkdWxpbmcpIDpcbiAgICAgICAgICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgICAgIF0pKTtcblxuICAgIC8vIEFsbG9jYXRlIGFuIGV4dHJhIGRhdGEgc2xvdCByaWdodCBhZnRlciBhIGRlZmVyIGJsb2NrIHNsb3QgdG8gc3RvcmVcbiAgICAvLyBpbnN0YW5jZS1zcGVjaWZpYyBzdGF0ZSBvZiB0aGF0IGRlZmVyIGJsb2NrIGF0IHJ1bnRpbWUuXG4gICAgdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICAvLyBOb3RlOiB0aGUgdHJpZ2dlcnMgbmVlZCB0byBiZSBwcm9jZXNzZWQgKmFmdGVyKiB0aGUgdmFyaW91cyB0ZW1wbGF0ZXMsXG4gICAgLy8gb3RoZXJ3aXNlIHBpcGVzIGluamVjdGluZyBzb21lIHN5bWJvbHMgd29uJ3Qgd29yayAoc2VlICM1MjEwMikuXG4gICAgdGhpcy5jcmVhdGVEZWZlclRyaWdnZXJJbnN0cnVjdGlvbnMoZGVmZXJyZWRJbmRleCwgdHJpZ2dlcnMsIG1ldGFkYXRhLCBmYWxzZSk7XG4gICAgdGhpcy5jcmVhdGVEZWZlclRyaWdnZXJJbnN0cnVjdGlvbnMoZGVmZXJyZWRJbmRleCwgcHJlZmV0Y2hUcmlnZ2VycywgbWV0YWRhdGEsIHRydWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEZWZlcnJlZERlcHNGdW5jdGlvbihuYW1lOiBzdHJpbmcsIG1ldGFkYXRhOiBSM0RlZmVyQmxvY2tNZXRhZGF0YSkge1xuICAgIGlmIChtZXRhZGF0YS5kZXBzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZGVmZXIgYmxvY2sgaGFzIGRlcHMgZm9yIHdoaWNoIHdlIG5lZWQgdG8gZ2VuZXJhdGUgZHluYW1pYyBpbXBvcnRzLlxuICAgIGNvbnN0IGRlcGVuZGVuY3lFeHA6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGRlZmVycmVkRGVwIG9mIG1ldGFkYXRhLmRlcHMpIHtcbiAgICAgIGlmIChkZWZlcnJlZERlcC5pc0RlZmVycmFibGUpIHtcbiAgICAgICAgLy8gQ2FsbGJhY2sgZnVuY3Rpb24sIGUuZy4gYG0gKCkgPT4gbS5NeUNtcDtgLlxuICAgICAgICBjb25zdCBpbm5lckZuID0gby5hcnJvd0ZuKFxuICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oJ20nLCBvLkRZTkFNSUNfVFlQRSldLFxuICAgICAgICAgICAgLy8gRGVmYXVsdCBpbXBvcnRzIGFyZSBhbHdheXMgYWNjZXNzZWQgdGhyb3VnaCB0aGUgYGRlZmF1bHRgIHByb3BlcnR5LlxuICAgICAgICAgICAgby52YXJpYWJsZSgnbScpLnByb3AoZGVmZXJyZWREZXAuaXNEZWZhdWx0SW1wb3J0ID8gJ2RlZmF1bHQnIDogZGVmZXJyZWREZXAuc3ltYm9sTmFtZSkpO1xuXG4gICAgICAgIC8vIER5bmFtaWMgaW1wb3J0LCBlLmcuIGBpbXBvcnQoJy4vYScpLnRoZW4oLi4uKWAuXG4gICAgICAgIGNvbnN0IGltcG9ydEV4cHIgPVxuICAgICAgICAgICAgKG5ldyBvLkR5bmFtaWNJbXBvcnRFeHByKGRlZmVycmVkRGVwLmltcG9ydFBhdGghKSkucHJvcCgndGhlbicpLmNhbGxGbihbaW5uZXJGbl0pO1xuICAgICAgICBkZXBlbmRlbmN5RXhwLnB1c2goaW1wb3J0RXhwcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOb24tZGVmZXJyYWJsZSBzeW1ib2wsIGp1c3QgdXNlIGEgcmVmZXJlbmNlIHRvIHRoZSB0eXBlLlxuICAgICAgICBkZXBlbmRlbmN5RXhwLnB1c2goZGVmZXJyZWREZXAudHlwZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZGVwc0ZuRXhwciA9IG8uYXJyb3dGbihbXSwgby5saXRlcmFsQXJyKGRlcGVuZGVuY3lFeHApKTtcblxuICAgIHRoaXMuY29uc3RhbnRQb29sLnN0YXRlbWVudHMucHVzaChkZXBzRm5FeHByLnRvRGVjbFN0bXQobmFtZSwgby5TdG10TW9kaWZpZXIuRmluYWwpKTtcblxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEZWZlclRyaWdnZXJJbnN0cnVjdGlvbnMoXG4gICAgICBkZWZlcnJlZEluZGV4OiBudW1iZXIsIHRyaWdnZXJzOiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgbWV0YWRhdGE6IFIzRGVmZXJCbG9ja01ldGFkYXRhLFxuICAgICAgcHJlZmV0Y2g6IGJvb2xlYW4pIHtcbiAgICBjb25zdCB7d2hlbiwgaWRsZSwgaW1tZWRpYXRlLCB0aW1lciwgaG92ZXIsIGludGVyYWN0aW9uLCB2aWV3cG9ydH0gPSB0cmlnZ2VycztcblxuICAgIC8vIGBkZWZlcldoZW4oY3R4LnNvbWVWYWx1ZSlgXG4gICAgaWYgKHdoZW4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd2hlbi52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBkZWZlcnJlZEluZGV4LCB3aGVuLnNvdXJjZVNwYW4sIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaFdoZW4gOiBSMy5kZWZlcldoZW4sXG4gICAgICAgICAgKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSk7XG4gICAgfVxuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGdlbmVyYXRlIGFuIGltcGxpY2l0IGBvbiBpZGxlYCBpZiB0aGUgYGRlZmVycmVkYCBibG9jayBoYXMgbm8gdHJpZ2dlcnMuXG4gICAgLy8gYGRlZmVyT25JZGxlKClgXG4gICAgaWYgKGlkbGUgfHwgKCFwcmVmZXRjaCAmJiBPYmplY3Qua2V5cyh0cmlnZ2VycykubGVuZ3RoID09PSAwKSkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGlkbGU/LnNvdXJjZVNwYW4gfHwgbnVsbCwgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25JZGxlIDogUjMuZGVmZXJPbklkbGUpO1xuICAgIH1cblxuICAgIC8vIGBkZWZlck9uSW1tZWRpYXRlKClgXG4gICAgaWYgKGltbWVkaWF0ZSkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGltbWVkaWF0ZS5zb3VyY2VTcGFuLCBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPbkltbWVkaWF0ZSA6IFIzLmRlZmVyT25JbW1lZGlhdGUpO1xuICAgIH1cblxuICAgIC8vIGBkZWZlck9uVGltZXIoMTMzNylgXG4gICAgaWYgKHRpbWVyKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGltZXIuc291cmNlU3BhbiwgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25UaW1lciA6IFIzLmRlZmVyT25UaW1lcixcbiAgICAgICAgICBbby5saXRlcmFsKHRpbWVyLmRlbGF5KV0pO1xuICAgIH1cblxuICAgIC8vIGBkZWZlck9uSG92ZXIoaW5kZXgsIHdhbGtVcFRpbWVzKWBcbiAgICBpZiAoaG92ZXIpIHtcbiAgICAgIHRoaXMuZG9tTm9kZUJhc2VkVHJpZ2dlcihcbiAgICAgICAgICAnaG92ZXInLCBob3ZlciwgbWV0YWRhdGEsIHByZWZldGNoID8gUjMuZGVmZXJQcmVmZXRjaE9uSG92ZXIgOiBSMy5kZWZlck9uSG92ZXIpO1xuICAgIH1cblxuICAgIC8vIGBkZWZlck9uSW50ZXJhY3Rpb24oaW5kZXgsIHdhbGtVcFRpbWVzKWBcbiAgICBpZiAoaW50ZXJhY3Rpb24pIHtcbiAgICAgIHRoaXMuZG9tTm9kZUJhc2VkVHJpZ2dlcihcbiAgICAgICAgICAnaW50ZXJhY3Rpb24nLCBpbnRlcmFjdGlvbiwgbWV0YWRhdGEsXG4gICAgICAgICAgcHJlZmV0Y2ggPyBSMy5kZWZlclByZWZldGNoT25JbnRlcmFjdGlvbiA6IFIzLmRlZmVyT25JbnRlcmFjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gYGRlZmVyT25WaWV3cG9ydChpbmRleCwgd2Fsa1VwVGltZXMpYFxuICAgIGlmICh2aWV3cG9ydCkge1xuICAgICAgdGhpcy5kb21Ob2RlQmFzZWRUcmlnZ2VyKFxuICAgICAgICAgICd2aWV3cG9ydCcsIHZpZXdwb3J0LCBtZXRhZGF0YSxcbiAgICAgICAgICBwcmVmZXRjaCA/IFIzLmRlZmVyUHJlZmV0Y2hPblZpZXdwb3J0IDogUjMuZGVmZXJPblZpZXdwb3J0KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGRvbU5vZGVCYXNlZFRyaWdnZXIoXG4gICAgICBuYW1lOiBzdHJpbmcsXG4gICAgICB0cmlnZ2VyOiB0LkludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyfHQuSG92ZXJEZWZlcnJlZFRyaWdnZXJ8dC5WaWV3cG9ydERlZmVycmVkVHJpZ2dlcixcbiAgICAgIG1ldGFkYXRhOiBSM0RlZmVyQmxvY2tNZXRhZGF0YSwgaW5zdHJ1Y3Rpb25SZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpIHtcbiAgICBjb25zdCB0cmlnZ2VyRWwgPSBtZXRhZGF0YS50cmlnZ2VyRWxlbWVudHMuZ2V0KHRyaWdnZXIpO1xuXG4gICAgLy8gRG9uJ3QgZ2VuZXJhdGUgYW55dGhpbmcgaWYgYSB0cmlnZ2VyIGNhbm5vdCBiZSByZXNvbHZlZC5cbiAgICAvLyBXZSdsbCBoYXZlIHRlbXBsYXRlIGRpYWdub3N0aWNzIHRvIHN1cmZhY2UgdGhlc2UgdG8gdXNlcnMuXG4gICAgaWYgKCF0cmlnZ2VyRWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odHJpZ2dlci5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvblJlZiwgKCkgPT4ge1xuICAgICAgY29uc3QgbG9jYXRpb24gPSB0aGlzLmVsZW1lbnRMb2NhdGlvbnMuZ2V0KHRyaWdnZXJFbCk7XG5cbiAgICAgIGlmICghbG9jYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYENvdWxkIG5vdCBkZXRlcm1pbmUgbG9jYXRpb24gb2YgcmVmZXJlbmNlIHBhc3NlZCBpbnRvIGAgK1xuICAgICAgICAgICAgYCcke25hbWV9JyB0cmlnZ2VyLiBUZW1wbGF0ZSBtYXkgbm90IGhhdmUgYmVlbiBmdWxseSBhbmFseXplZC5gKTtcbiAgICAgIH1cblxuICAgICAgLy8gQSBuZWdhdGl2ZSBkZXB0aCBtZWFucyB0aGF0IHRoZSB0cmlnZ2VyIGlzIGluc2lkZSB0aGUgcGxhY2Vob2xkZXIuXG4gICAgICAvLyBDYXAgaXQgYXQgLTEgc2luY2Ugd2Ugb25seSBjYXJlIHdoZXRoZXIgb3Igbm90IGl0J3MgbmVnYXRpdmUuXG4gICAgICBjb25zdCBkZXB0aCA9IE1hdGgubWF4KHRoaXMubGV2ZWwgLSBsb2NhdGlvbi5sZXZlbCwgLTEpO1xuICAgICAgY29uc3QgcGFyYW1zID0gW28ubGl0ZXJhbChsb2NhdGlvbi5pbmRleCldO1xuXG4gICAgICAvLyBUaGUgbW9zdCBjb21tb24gY2FzZSBzaG91bGQgYmUgYSB0cmlnZ2VyIHdpdGhpbiB0aGUgdmlldyBzbyB3ZSBjYW4gb21pdCBhIGRlcHRoIG9mXG4gICAgICAvLyB6ZXJvLiBGb3IgdHJpZ2dlcnMgaW4gcGFyZW50IHZpZXdzIGFuZCBpbiB0aGUgcGxhY2Vob2xkZXIgd2UgbmVlZCB0byBwYXNzIGl0IGluLlxuICAgICAgaWYgKGRlcHRoICE9PSAwKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChkZXB0aCkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEluZmVycyB0aGUgZGF0YSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24gKHRhZyBuYW1lIGFuZCBhdHRyaWJ1dGVzKSBmcm9tIHRoZSBjb250ZW50IG9mIGFcbiAgICogbm9kZS5cbiAgICogQHBhcmFtIG5vZGUgTm9kZSBmb3Igd2hpY2ggdG8gaW5mZXIgdGhlIHByb2plY3Rpb24gZGF0YS5cbiAgICovXG4gIHByaXZhdGUgaW5mZXJQcm9qZWN0aW9uRGF0YUZyb21JbnNlcnRpb25Qb2ludChub2RlOiB0LklmQmxvY2tCcmFuY2h8dC5Gb3JMb29wQmxvY2t8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0LkZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgbGV0IHJvb3Q6IHQuRWxlbWVudHx0LlRlbXBsYXRlfG51bGwgPSBudWxsO1xuICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdfHVuZGVmaW5lZDtcblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiB0LkNvbW1lbnQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGNhbiBvbmx5IGluZmVyIHRoZSB0YWcgbmFtZS9hdHRyaWJ1dGVzIGlmIHRoZXJlJ3MgYSBzaW5nbGUgcm9vdCBub2RlLlxuICAgICAgaWYgKHJvb3QgIT09IG51bGwpIHtcbiAgICAgICAgcm9vdCA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBSb290IG5vZGVzIGNhbiBvbmx5IGVsZW1lbnRzIG9yIHRlbXBsYXRlcyB3aXRoIGEgdGFnIG5hbWUgKGUuZy4gYDxkaXYgKmZvbz48L2Rpdj5gKS5cbiAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuRWxlbWVudCB8fCAoY2hpbGQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGNoaWxkLnRhZ05hbWUgIT09IG51bGwpKSB7XG4gICAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gICAgLy8gdG8gdGhlIHN1cnJvdW5kaW5nIHRlbXBsYXRlIHRvIGJlIHVzZWQgZm9yIGNvbnRlbnQgcHJvamVjdGlvbi4gTm90ZSB0aGF0IGl0J3MgaW1wb3J0YW50XG4gICAgLy8gdGhhdCB3ZSBkb24ndCBjb3B5IGFueSBib3VuZCBhdHRyaWJ1dGVzIHNpbmNlIHRoZXkgZG9uJ3QgcGFydGljaXBhdGUgaW4gY29udGVudCBwcm9qZWN0aW9uXG4gICAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICAgIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBuYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcbiAgICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAgIHRhZ05hbWUgPSBuYW1lID09PSBOR19URU1QTEFURV9UQUdfTkFNRSA/IG51bGwgOiBuYW1lO1xuICAgICAgYXR0cnNFeHBycyA9XG4gICAgICAgICAgdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhOR19URU1QTEFURV9UQUdfTkFNRSwgcm9vdC5hdHRyaWJ1dGVzLCByb290LmlucHV0cywgW10pO1xuICAgIH1cblxuICAgIHJldHVybiB7dGFnTmFtZSwgYXR0cnNFeHByc307XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXBlYXRlciBtZXRhZGF0YS4gVGhlIHNsb3RzIGZvciB0aGUgcHJpbWFyeSBhbmQgZW1wdHkgYmxvY2tcbiAgICAvLyBhcmUgaW1wbGljaXRseSBpbmZlcnJlZCBieSB0aGUgcnVudGltZSB0byBpbmRleCArIDEgYW5kIGluZGV4ICsgMi5cbiAgICBjb25zdCBibG9ja0luZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qge3RhZ05hbWUsIGF0dHJzRXhwcnN9ID0gdGhpcy5pbmZlclByb2plY3Rpb25EYXRhRnJvbUluc2VydGlvblBvaW50KGJsb2NrKTtcbiAgICBjb25zdCBwcmltYXJ5RGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgYmxvY2suY2hpbGRyZW4sICdfRm9yJyxcbiAgICAgICAgW2Jsb2NrLml0ZW0sIGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LCBibG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudF0sIGJsb2NrLmkxOG4sIHtcbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgbGV2ZWwtc3BlY2lmaWMgdmVyc2lvbnMgb2YgYCRpbmRleGAgYW5kIGAkY291bnRgLCBiZWNhdXNlXG4gICAgICAgICAgLy8gdGhleSdyZSB1c2VkIHdoZW4gZGVyaXZpbmcgdGhlIHJlbWFpbmluZyB2YXJpYWJsZXMgKGAkb2RkYCwgYCRldmVuYCBldGMuKSB3aGlsZSBhdCB0aGVcbiAgICAgICAgICAvLyBzYW1lIHRpbWUgYmVpbmcgYXZhaWxhYmxlIGltcGxpY2l0bHkuIFdpdGhvdXQgdGhlc2UgYWxpYXNlcywgd2Ugd291bGRuJ3QgYmUgYWJsZSB0b1xuICAgICAgICAgIC8vIGFjY2VzcyB0aGUgYCRpbmRleGAgb2YgYSBwYXJlbnQgbG9vcCBmcm9tIGluc2lkZSBvZiBhIG5lc3RlZCBsb29wLlxuICAgICAgICAgIFtibG9jay5jb250ZXh0VmFyaWFibGVzLiRpbmRleC5uYW1lXTpcbiAgICAgICAgICAgICAgdGhpcy5nZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKCckaW5kZXgnLCB0aGlzLmxldmVsICsgMSksXG4gICAgICAgICAgW2Jsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWVdOlxuICAgICAgICAgICAgICB0aGlzLmdldExldmVsU3BlY2lmaWNWYXJpYWJsZU5hbWUoJyRjb3VudCcsIHRoaXMubGV2ZWwgKyAxKSxcbiAgICAgICAgfSk7XG4gICAgY29uc3Qge2V4cHJlc3Npb246IHRyYWNrQnlFeHByZXNzaW9uLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2V9ID1cbiAgICAgICAgdGhpcy5jcmVhdGVUcmFja0J5RnVuY3Rpb24oYmxvY2spO1xuICAgIGxldCBlbXB0eURhdGE6IFRlbXBsYXRlRGF0YXxudWxsID0gbnVsbDtcbiAgICBsZXQgZW1wdHlUYWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IGVtcHR5QXR0cnNFeHByczogby5FeHByZXNzaW9uW118dW5kZWZpbmVkO1xuXG4gICAgaWYgKGJsb2NrLmVtcHR5ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBlbXB0eUluZmVycmVkID0gdGhpcy5pbmZlclByb2plY3Rpb25EYXRhRnJvbUluc2VydGlvblBvaW50KGJsb2NrLmVtcHR5KTtcbiAgICAgIGVtcHR5VGFnTmFtZSA9IGVtcHR5SW5mZXJyZWQudGFnTmFtZTtcbiAgICAgIGVtcHR5QXR0cnNFeHBycyA9IGVtcHR5SW5mZXJyZWQuYXR0cnNFeHBycztcbiAgICAgIGVtcHR5RGF0YSA9IHRoaXMucHJlcGFyZUVtYmVkZGVkVGVtcGxhdGVGbihcbiAgICAgICAgICBibG9jay5lbXB0eS5jaGlsZHJlbiwgJ19Gb3JFbXB0eScsIHVuZGVmaW5lZCwgYmxvY2suZW1wdHkuaTE4bik7XG4gICAgICAvLyBBbGxvY2F0ZSBhbiBleHRyYSBzbG90IGZvciB0aGUgZW1wdHkgYmxvY2sgdHJhY2tpbmcuXG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKG51bGwpO1xuICAgIH1cblxuICAgIHRoaXMucmVnaXN0ZXJDb21wdXRlZExvb3BWYXJpYWJsZXMoYmxvY2ssIHByaW1hcnlEYXRhLnNjb3BlKTtcblxuICAgIC8vIGByZXBlYXRlckNyZWF0ZSgwLCAuLi4pYFxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihibG9jay5zb3VyY2VTcGFuLCBSMy5yZXBlYXRlckNyZWF0ZSwgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gW1xuICAgICAgICBvLmxpdGVyYWwoYmxvY2tJbmRleCksXG4gICAgICAgIG8udmFyaWFibGUocHJpbWFyeURhdGEubmFtZSksXG4gICAgICAgIG8ubGl0ZXJhbChwcmltYXJ5RGF0YS5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICBvLmxpdGVyYWwocHJpbWFyeURhdGEuZ2V0VmFyQ291bnQoKSksXG4gICAgICAgIG8ubGl0ZXJhbCh0YWdOYW1lKSxcbiAgICAgICAgdGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJzRXhwcnMgfHwgbnVsbCksXG4gICAgICAgIHRyYWNrQnlFeHByZXNzaW9uLFxuICAgICAgXTtcblxuICAgICAgaWYgKGVtcHR5RGF0YSAhPT0gbnVsbCkge1xuICAgICAgICBwYXJhbXMucHVzaChcbiAgICAgICAgICAgIG8ubGl0ZXJhbCh0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlKSwgby52YXJpYWJsZShlbXB0eURhdGEubmFtZSksXG4gICAgICAgICAgICBvLmxpdGVyYWwoZW1wdHlEYXRhLmdldENvbnN0Q291bnQoKSksIG8ubGl0ZXJhbChlbXB0eURhdGEuZ2V0VmFyQ291bnQoKSksXG4gICAgICAgICAgICBvLmxpdGVyYWwoZW1wdHlUYWdOYW1lKSwgdGhpcy5hZGRBdHRyc1RvQ29uc3RzKGVtcHR5QXR0cnNFeHBycyB8fCBudWxsKSk7XG4gICAgICB9IGVsc2UgaWYgKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpIHtcbiAgICAgICAgLy8gSWYgdGhlIHRyYWNraW5nIGZ1bmN0aW9uIGRvZXNuJ3QgdXNlIHRoZSBjb21wb25lbnQgaW5zdGFuY2UsIHdlIGNhbiBvbWl0IHRoZSBmbGFnLlxuICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwodHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZSkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1zKTtcbiAgICB9KTtcblxuICAgIC8vIE5vdGU6IHRoZSBleHByZXNzaW9uIG5lZWRzIHRvIGJlIHByb2Nlc3NlZCAqYWZ0ZXIqIHRoZSB0ZW1wbGF0ZSxcbiAgICAvLyBvdGhlcndpc2UgcGlwZXMgaW5qZWN0aW5nIHNvbWUgc3ltYm9scyB3b24ndCB3b3JrIChzZWUgIzUyMTAyKS5cbiAgICAvLyBOb3RlOiB3ZSBkb24ndCBhbGxvY2F0ZSBiaW5kaW5nIHNsb3RzIGZvciB0aGlzIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSBpdHMgdmFsdWUgaXNuJ3Qgc3RvcmVkIGluIHRoZSBMVmlldy5cbiAgICBjb25zdCB2YWx1ZSA9IGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuXG4gICAgLy8gYGFkdmFuY2UoeCk7IHJlcGVhdGVyKGl0ZXJhYmxlKWBcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGJsb2NrSW5kZXgsIGJsb2NrLnNvdXJjZVNwYW4sIFIzLnJlcGVhdGVyLCAoKSA9PiBbdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKV0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbXB1dGVkTG9vcFZhcmlhYmxlcyhibG9jazogdC5Gb3JMb29wQmxvY2ssIGJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlKTogdm9pZCB7XG4gICAgY29uc3QgbGV2ZWwgPSBiaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoYmxvY2ssIHNjb3BlLCByZXRyaWV2YWxMZXZlbCwgJyRpbmRleCcpXG4gICAgICAgICAgLm1vZHVsbyhvLmxpdGVyYWwoMikpXG4gICAgICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuICAgIH0pO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCAoc2NvcGUsIHJldHJpZXZhbExldmVsKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKGJsb2NrLCBzY29wZSwgcmV0cmlldmFsTGV2ZWwsICckaW5kZXgnKVxuICAgICAgICAgIC5tb2R1bG8oby5saXRlcmFsKDIpKVxuICAgICAgICAgIC5pZGVudGljYWwoby5saXRlcmFsKDApKTtcbiAgICB9KTtcblxuICAgIGJpbmRpbmdTY29wZS5zZXQobGV2ZWwsIGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsIChzY29wZSwgcmV0cmlldmFsTGV2ZWwpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldExldmVsU3BlY2lmaWNGb3JMb29wVmFyaWFibGUoYmxvY2ssIHNjb3BlLCByZXRyaWV2YWxMZXZlbCwgJyRpbmRleCcpXG4gICAgICAgICAgLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuICAgIH0pO1xuXG4gICAgYmluZGluZ1Njb3BlLnNldChsZXZlbCwgYmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLCAoc2NvcGUsIHJldHJpZXZhbExldmVsKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGluZGV4Jyk7XG4gICAgICBjb25zdCBjb3VudCA9IHRoaXMuZ2V0TGV2ZWxTcGVjaWZpY0Zvckxvb3BWYXJpYWJsZShibG9jaywgc2NvcGUsIHJldHJpZXZhbExldmVsLCAnJGNvdW50Jyk7XG4gICAgICByZXR1cm4gaW5kZXguaWRlbnRpY2FsKGNvdW50Lm1pbnVzKG8ubGl0ZXJhbCgxKSkpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKG5hbWU6IHN0cmluZywgbGV2ZWw6IG51bWJlcik6IHN0cmluZyB7XG4gICAgLy8gV2UgdXNlIHRoZSBgybVgIGhlcmUgdG8gZW5zdXJlIHRoYXQgdGhlcmUgYXJlIG5vIG5hbWUgY29uZmxpY3RzIHdpdGggdXNlci1kZWZpbmVkIHZhcmlhYmxlcy5cbiAgICByZXR1cm4gYMm1JHtuYW1lfV8ke2xldmVsfWA7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgbmFtZSBvZiBhIGZvciBsb29wIHZhcmlhYmxlIGF0IGEgc3BlY2lmaWMgYmluZGluZyBsZXZlbC4gVGhpcyBhbGxvd3MgdXMgdG8gbG9va1xuICAgKiB1cCBpbXBsaWNpdGx5IHNoYWRvd2VkIHZhcmlhYmxlcyBsaWtlIGAkaW5kZXhgIGFuZCBgJGNvdW50YCBhdCBhIHNwZWNpZmljIGxldmVsLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRMZXZlbFNwZWNpZmljRm9yTG9vcFZhcmlhYmxlKFxuICAgICAgYmxvY2s6IHQuRm9yTG9vcEJsb2NrLCBzY29wZTogQmluZGluZ1Njb3BlLCByZXRyaWV2YWxMZXZlbDogbnVtYmVyLFxuICAgICAgbmFtZToga2V5b2YgdC5Gb3JMb29wQmxvY2tDb250ZXh0KTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBzY29wZU5hbWUgPSBzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsID9cbiAgICAgICAgYmxvY2suY29udGV4dFZhcmlhYmxlc1tuYW1lXS5uYW1lIDpcbiAgICAgICAgdGhpcy5nZXRMZXZlbFNwZWNpZmljVmFyaWFibGVOYW1lKG5hbWUsIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2NvcGUuZ2V0KHNjb3BlTmFtZSkhO1xuICB9XG5cbiAgcHJpdmF0ZSBvcHRpbWl6ZVRyYWNrQnlGdW5jdGlvbihibG9jazogdC5Gb3JMb29wQmxvY2spIHtcbiAgICBjb25zdCBpbmRleExvY2FsTmFtZSA9IGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWU7XG4gICAgY29uc3QgaXRlbU5hbWUgPSBibG9jay5pdGVtLm5hbWU7XG4gICAgY29uc3QgYXN0ID0gYmxvY2sudHJhY2tCeS5hc3Q7XG5cbiAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIGAkaW5kZXhgIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJbmRleGAuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgIGFzdC5uYW1lID09PSBpbmRleExvY2FsTmFtZSkge1xuICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMucmVwZWF0ZXJUcmFja0J5SW5kZXgpLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IGZhbHNlfTtcbiAgICB9XG5cbiAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIHRoZSBpdGVtIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJZGVudGl0eWAuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgIGFzdC5uYW1lID09PSBpdGVtTmFtZSkge1xuICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMucmVwZWF0ZXJUcmFja0J5SWRlbnRpdHkpLCB1c2VzQ29tcG9uZW50SW5zdGFuY2U6IGZhbHNlfTtcbiAgICB9XG5cbiAgICAvLyBUb3AtbGV2ZWwgY2FsbHMgaW4gdGhlIGZvcm0gb2YgYGZuKCRpbmRleCwgaXRlbSlgIGNhbiBiZSBwYXNzZWQgaW4gZGlyZWN0bHkuXG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIENhbGwgJiYgYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmXG4gICAgICAgIGFzdC5yZWNlaXZlci5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0LmFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICBjb25zdCBmaXJzdElzSW5kZXggPSBhc3QuYXJnc1swXSBpbnN0YW5jZW9mIFByb3BlcnR5UmVhZCAmJlxuICAgICAgICAgIGFzdC5hcmdzWzBdLnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlciAmJiBhc3QuYXJnc1swXS5uYW1lID09PSBpbmRleExvY2FsTmFtZTtcbiAgICAgIGNvbnN0IHNlY29uZElzSXRlbSA9IGFzdC5hcmdzWzFdIGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmXG4gICAgICAgICAgYXN0LmFyZ3NbMV0ucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyICYmIGFzdC5hcmdzWzFdLm5hbWUgPT09IGl0ZW1OYW1lO1xuXG4gICAgICBpZiAoZmlyc3RJc0luZGV4ICYmIHNlY29uZElzSXRlbSkge1xuICAgICAgICAvLyBJZiB3ZSdyZSBpbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCwgd2UgY2FuIGFjY2VzcyBkaXJlY3RseSB0aHJvdWdoIGBjdHhgLFxuICAgICAgICAvLyBvdGhlcndpc2Ugd2UgaGF2ZSB0byBnZXQgYSBob2xkIG9mIHRoZSBjb21wb25lbnQgdGhyb3VnaCBgY29tcG9uZW50SW5zdGFuY2UoKWAuXG4gICAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5sZXZlbCA9PT0gMCA/IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBvLkV4dGVybmFsRXhwcihSMy5jb21wb25lbnRJbnN0YW5jZSkuY2FsbEZuKFtdKTtcbiAgICAgICAgcmV0dXJuIHtleHByZXNzaW9uOiByZWNlaXZlci5wcm9wKGFzdC5yZWNlaXZlci5uYW1lKSwgdXNlc0NvbXBvbmVudEluc3RhbmNlOiBmYWxzZX07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVRyYWNrQnlGdW5jdGlvbihibG9jazogdC5Gb3JMb29wQmxvY2spOiB7XG4gICAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLFxuICAgIHVzZXNDb21wb25lbnRJbnN0YW5jZTogYm9vbGVhbixcbiAgfSB7XG4gICAgY29uc3Qgb3B0aW1pemVkRm4gPSB0aGlzLm9wdGltaXplVHJhY2tCeUZ1bmN0aW9uKGJsb2NrKTtcblxuICAgIC8vIElmIHRoZSB0cmFja2luZyBmdW5jdGlvbiBjYW4gYmUgb3B0aW1pemVkLCB3ZSBkb24ndCBuZWVkIGFueSBmdXJ0aGVyIHByb2Nlc3NpbmcuXG4gICAgaWYgKG9wdGltaXplZEZuICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gb3B0aW1pemVkRm47XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dFZhcnMgPSBibG9jay5jb250ZXh0VmFyaWFibGVzO1xuICAgIGNvbnN0IHNjb3BlID0gbmV3IFRyYWNrQnlCaW5kaW5nU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLCB7XG4gICAgICAvLyBBbGlhcyBgJGluZGV4YCBhbmQgdGhlIGl0ZW0gbmFtZSB0byBgJGluZGV4YCBhbmQgYCRpdGVtYCByZXNwZWN0aXZlbHkuXG4gICAgICAvLyBUaGlzIGFsbG93cyB1cyB0byByZXVzZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG1heSBoYXZlIGRpZmZlcmVudCBpdGVtIG5hbWVzLFxuICAgICAgLy8gYnV0IGFyZSBvdGhlcndpc2UgaWRlbnRpY2FsLlxuICAgICAgW2NvbnRleHRWYXJzLiRpbmRleC5uYW1lXTogJyRpbmRleCcsXG4gICAgICBbYmxvY2suaXRlbS5uYW1lXTogJyRpdGVtJyxcblxuICAgICAgLy8gQWNjZXNzaW5nIHRoZXNlIHZhcmlhYmxlcyBpbiBhIHRyYWNraW5nIGZ1bmN0aW9uIHdpbGwgcmVzdWx0IGluIGEgdGVtcGxhdGUgZGlhZ25vc3RpYy5cbiAgICAgIC8vIFdlIGRlZmluZSB0aGVtIGFzIGdsb2JhbHMgc28gdGhhdCB0aGVpciBhY2Nlc3NlcyBhcmUgcHJlc2VydmVkIHZlcmJhdGltIGluc3RlYWQgb2YgYmVpbmdcbiAgICAgIC8vIHJld3JpdHRlbiB0byB0aGUgYWN0dWFsIGFjY2Vzc2VzLlxuICAgICAgW2NvbnRleHRWYXJzLiRjb3VudC5uYW1lXTogY29udGV4dFZhcnMuJGNvdW50Lm5hbWUsXG4gICAgICBbY29udGV4dFZhcnMuJGZpcnN0Lm5hbWVdOiBjb250ZXh0VmFycy4kZmlyc3QubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kbGFzdC5uYW1lXTogY29udGV4dFZhcnMuJGxhc3QubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kZXZlbi5uYW1lXTogY29udGV4dFZhcnMuJGV2ZW4ubmFtZSxcbiAgICAgIFtjb250ZXh0VmFycy4kb2RkLm5hbWVdOiBjb250ZXh0VmFycy4kb2RkLm5hbWUsXG4gICAgfSk7XG4gICAgY29uc3QgcGFyYW1zID0gW25ldyBvLkZuUGFyYW0oJyRpbmRleCcpLCBuZXcgby5GblBhcmFtKCckaXRlbScpXTtcbiAgICBjb25zdCBzdG10cyA9IGNvbnZlcnRQdXJlQ29tcG9uZW50U2NvcGVGdW5jdGlvbihcbiAgICAgICAgYmxvY2sudHJhY2tCeS5hc3QsIHNjb3BlLCBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksICd0cmFjaycpO1xuICAgIGNvbnN0IHVzZXNDb21wb25lbnRJbnN0YW5jZSA9IHNjb3BlLmdldENvbXBvbmVudEFjY2Vzc0NvdW50KCkgPiAwO1xuICAgIGxldCBmbjogby5BcnJvd0Z1bmN0aW9uRXhwcnxvLkZ1bmN0aW9uRXhwcjtcblxuICAgIGlmICghdXNlc0NvbXBvbmVudEluc3RhbmNlICYmIHN0bXRzLmxlbmd0aCA9PT0gMSAmJiBzdG10c1swXSBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgICAgZm4gPSBvLmFycm93Rm4ocGFyYW1zLCBzdG10c1swXS5leHByKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIGxhc3Qgc3RhdGVtZW50IGlzIHJldHVybmVkIGltcGxpY2l0bHkuXG4gICAgICBpZiAoc3RtdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gc3RtdHNbc3RtdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIGlmIChsYXN0U3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgICAgICAgc3RtdHNbc3RtdHMubGVuZ3RoIC0gMV0gPSBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobGFzdFN0YXRlbWVudC5leHByKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gVGhpcyBoYXMgdG8gYmUgYSBmdW5jdGlvbiBleHByZXNzaW9uLCBiZWNhdXNlIGAuYmluZGAgZG9lc24ndCB3b3JrIG9uIGFycm93IGZ1bmN0aW9ucy5cbiAgICAgIGZuID0gby5mbihwYXJhbXMsIHN0bXRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZXhwcmVzc2lvbjogdGhpcy5jb25zdGFudFBvb2wuZ2V0U2hhcmVkRnVuY3Rpb25SZWZlcmVuY2UoZm4sICdfZm9yVHJhY2snKSxcbiAgICAgIHVzZXNDb21wb25lbnRJbnN0YW5jZSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGF0YUluZGV4O1xuICB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICB9XG5cbiAgZ2V0Q29uc3RzKCk6IENvbXBvbmVudERlZkNvbnN0cyB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbnN0YW50cztcbiAgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gO1xuICB9XG5cbiAgcHJpdmF0ZSB0ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3MoXG4gICAgICB0ZW1wbGF0ZUluZGV4OiBudW1iZXIsIGF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10pIHtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBPbWl0PEluc3RydWN0aW9uLCAncmVmZXJlbmNlJz5bXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBpbnB1dCBvZiBhdHRycykge1xuICAgICAgaWYgKCEoaW5wdXQgaW5zdGFuY2VvZiB0LkJvdW5kQXR0cmlidXRlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIC8vIFBhcmFtcyB0eXBpY2FsbHkgY29udGFpbiBhdHRyaWJ1dGUgbmFtZXNwYWNlIGFuZCB2YWx1ZSBzYW5pdGl6ZXIsIHdoaWNoIGlzIGFwcGxpY2FibGVcbiAgICAgICAgLy8gZm9yIHJlZ3VsYXIgSFRNTCBlbGVtZW50cywgYnV0IG5vdCBhcHBsaWNhYmxlIGZvciA8bmctdGVtcGxhdGU+IChzaW5jZSBwcm9wcyBhY3QgYXNcbiAgICAgICAgLy8gaW5wdXRzIHRvIGRpcmVjdGl2ZXMpLCBzbyBrZWVwIHBhcmFtcyBhcnJheSBlbXB0eS5cbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBjYXNlXG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgdGVtcGxhdGVJbmRleCwgaW5wdXQubmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCIgY2FzZVxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIHNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgcGFyYW1zT3JGbjogZ2V0QmluZGluZ0Z1bmN0aW9uUGFyYW1zKCgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksIGlucHV0Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgcHJvcGVydHlCaW5kaW5nIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCBwcm9wZXJ0eUJpbmRpbmcuc3BhbiwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZy5wYXJhbXNPckZuKTtcbiAgICB9XG4gIH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiBJbnN0cnVjdGlvbltdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogSW5zdHJ1Y3Rpb25QYXJhbXMsIHByZXBlbmQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuICAgIGZuc1twcmVwZW5kID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSh7c3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZufSk7XG4gIH1cblxuICBwcml2YXRlIHByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBlbGVtZW50SW5kZXg6IG51bWJlciwgaW5zdHJ1Y3Rpb246IFN0eWxpbmdJbnN0cnVjdGlvbnxudWxsKSB7XG4gICAgbGV0IGFsbG9jYXRlQmluZGluZ1Nsb3RzID0gMDtcbiAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGZvciAoY29uc3QgY2FsbCBvZiBpbnN0cnVjdGlvbi5jYWxscykge1xuICAgICAgICBhbGxvY2F0ZUJpbmRpbmdTbG90cyArPSBjYWxsLmFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgICAgICBlbGVtZW50SW5kZXgsIGNhbGwuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgICAgKCkgPT4gY2FsbC5wYXJhbXMoXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gKGNhbGwuc3VwcG9ydHNJbnRlcnBvbGF0aW9uICYmIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkpIGFzIG8uRXhwcmVzc2lvbltdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgcGFyYW1zT3JGbj86IEluc3RydWN0aW9uUGFyYW1zLFxuICAgICAgcHJlcGVuZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10sIHByZXBlbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogSW5zdHJ1Y3Rpb25QYXJhbXMpIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleCwgc3Bhbik7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHBhcmFtc09yRm4/OiBJbnN0cnVjdGlvblBhcmFtcykge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBZHZhbmNlSW5zdHJ1Y3Rpb25JZk5lY2Vzc2FyeShub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBpZiAobm9kZUluZGV4ICE9PSB0aGlzLl9jdXJyZW50SW5kZXgpIHtcbiAgICAgIGNvbnN0IGRlbHRhID0gbm9kZUluZGV4IC0gdGhpcy5fY3VycmVudEluZGV4O1xuXG4gICAgICBpZiAoZGVsdGEgPCAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYWR2YW5jZSBpbnN0cnVjdGlvbiBjYW4gb25seSBnbyBmb3J3YXJkcycpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmluc3RydWN0aW9uRm4oXG4gICAgICAgICAgdGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgUjMuYWR2YW5jZSwgZGVsdGEgPiAxID8gW28ubGl0ZXJhbChkZWx0YSldIDogW10pO1xuICAgICAgdGhpcy5fY3VycmVudEluZGV4ID0gbm9kZUluZGV4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlZmVycyB0byB0aGUgaW1wbGljaXQgcmVjZWl2ZXIuIFRoZSBpbXBsaWNpdFxuICAgKiByZWNlaXZlciBpcyBhbHdheXMgdGhlIHJvb3QgbGV2ZWwgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgaWYgKHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByID0gdGhpcy5sZXZlbCA9PT0gMCA/XG4gICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID1cbiAgICAgICAgY29udmVydFByb3BlcnR5QmluZGluZyh0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCkpO1xuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG4gICAgcmV0dXJuIHZhbEV4cHI7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGxpc3Qgb2YgYXJndW1lbnQgZXhwcmVzc2lvbnMgdG8gcGFzcyB0byBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbi4gQWxzbyB1cGRhdGVzXG4gICAqIHRoZSB0ZW1wIHZhcmlhYmxlcyBzdGF0ZSB3aXRoIHRlbXAgdmFyaWFibGVzIHRoYXQgd2VyZSBpZGVudGlmaWVkIGFzIG5lZWRpbmcgdG8gYmUgY3JlYXRlZFxuICAgKiB3aGlsZSB2aXNpdGluZyB0aGUgYXJndW1lbnRzLlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIG9yaWdpbmFsIGV4cHJlc3Npb24gd2Ugd2lsbCBiZSByZXNvbHZpbmcgYW4gYXJndW1lbnRzIGxpc3QgZnJvbS5cbiAgICovXG4gIHByaXZhdGUgZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWU6IEludGVycG9sYXRpb24pOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3Qge2FyZ3MsIHN0bXRzfSA9XG4gICAgICAgIGNvbnZlcnRVcGRhdGVBcmd1bWVudHModGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpKTtcblxuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIHZhcmlhYmxlIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogc3RvcmUgdGhlIHN0YXRlIGJldHdlZW4gY29udHJvbCBmbG93IGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgYWxsb2NhdGVDb250cm9sRmxvd1RlbXBWYXJpYWJsZSgpOiBvLlJlYWRWYXJFeHByIHtcbiAgICAvLyBOb3RlOiB0aGUgYXNzdW1wdGlvbiBoZXJlIGlzIHRoYXQgd2UnbGwgb25seSBuZWVkIG9uZSB0ZW1wb3JhcnkgdmFyaWFibGUgZm9yIGFsbCBjb250cm9sXG4gICAgLy8gZmxvdyBpbnN0cnVjdGlvbnMuIEl0J3MgZXhwZWN0ZWQgdGhhdCBhbnkgaW5zdHJ1Y3Rpb25zIHdpbGwgb3ZlcndyaXRlIGl0IGJlZm9yZSBwYXNzaW5nIGl0XG4gICAgLy8gaW50byB0aGUgcGFyYW1ldGVycy5cbiAgICBpZiAodGhpcy5fY29udHJvbEZsb3dUZW1wVmFyaWFibGUgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfV9jb250Rmxvd1RtcGA7XG4gICAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2gobmV3IG8uRGVjbGFyZVZhclN0bXQobmFtZSkpO1xuICAgICAgdGhpcy5fY29udHJvbEZsb3dUZW1wVmFyaWFibGUgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb250cm9sRmxvd1RlbXBWYXJpYWJsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBQUk9KRUNUX0FTLCBzZWxlY3RvcixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHJlbmRlckF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdLCBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIG91dHB1dHM6IHQuQm91bmRFdmVudFtdLCBzdHlsZXM/OiBTdHlsaW5nQnVpbGRlcixcbiAgICAgIHRlbXBsYXRlQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdLFxuICAgICAgYm91bmRJMThuQXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCBuZ1Byb2plY3RBc0F0dHI6IHQuVGV4dEF0dHJpYnV0ZXx1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgcmVuZGVyQXR0cmlidXRlcykge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgbmdQcm9qZWN0QXNBdHRyID0gYXR0cjtcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZSB0aGF0IHN0YXRpYyBpMThuIGF0dHJpYnV0ZXMgYXJlbid0IGluIHRoZSBpMThuIGFycmF5LFxuICAgICAgLy8gYmVjYXVzZSB0aGV5J3JlIHRyZWF0ZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHJlZ3VsYXIgYXR0cmlidXRlcy5cbiAgICAgIGlmIChhdHRyLmkxOG4pIHtcbiAgICAgICAgLy8gV2hlbiBpMThuIGF0dHJpYnV0ZXMgYXJlIHByZXNlbnQgb24gZWxlbWVudHMgd2l0aCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZXNcbiAgICAgICAgLy8gKGUuZy4gYDxkaXYgKm5nSWYgdGl0bGU9XCJIZWxsb1wiIGkxOG4tdGl0bGU+YCksIHdlIHdhbnQgdG8gYXZvaWQgZ2VuZXJhdGluZ1xuICAgICAgICAvLyBkdXBsaWNhdGUgaTE4biB0cmFuc2xhdGlvbiBibG9ja3MgZm9yIGDJtcm1dGVtcGxhdGVgIGFuZCBgybXJtWVsZW1lbnRgIGluc3RydWN0aW9uXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMuIFNvIHdlIGRvIGEgY2FjaGUgbG9va3VwIHRvIHNlZSBpZiBzdWl0YWJsZSBpMThuIHRyYW5zbGF0aW9uIGJsb2NrXG4gICAgICAgIC8vIGFscmVhZHkgZXhpc3RzLlxuICAgICAgICBjb25zdCB7aTE4blZhclJlZnNDYWNoZX0gPSB0aGlzLl9jb25zdGFudHM7XG4gICAgICAgIGxldCBpMThuVmFyUmVmOiBvLlJlYWRWYXJFeHByO1xuICAgICAgICBpZiAoaTE4blZhclJlZnNDYWNoZS5oYXMoYXR0ci5pMThuKSkge1xuICAgICAgICAgIGkxOG5WYXJSZWYgPSBpMThuVmFyUmVmc0NhY2hlLmdldChhdHRyLmkxOG4pITtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpMThuVmFyUmVmID0gdGhpcy5pMThuVHJhbnNsYXRlKGF0dHIuaTE4biBhcyBpMThuLk1lc3NhZ2UpO1xuICAgICAgICAgIGkxOG5WYXJSZWZzQ2FjaGUuc2V0KGF0dHIuaTE4biwgaTE4blZhclJlZik7XG4gICAgICAgIH1cbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIGkxOG5WYXJSZWYpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goXG4gICAgICAgICAgICAuLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgdHJ1c3RlZENvbnN0QXR0cmlidXRlKGVsZW1lbnROYW1lLCBhdHRyKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gS2VlcCBuZ1Byb2plY3RBcyBuZXh0IHRvIHRoZSBvdGhlciBuYW1lLCB2YWx1ZSBwYWlycyBzbyB3ZSBjYW4gdmVyaWZ5IHRoYXQgd2UgbWF0Y2hcbiAgICAvLyBuZ1Byb2plY3RBcyBtYXJrZXIgaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHNsb3QuXG4gICAgaWYgKG5nUHJvamVjdEFzQXR0cikge1xuICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKG5nUHJvamVjdEFzQXR0cikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZEF0dHJFeHByKGtleTogc3RyaW5nfG51bWJlciwgdmFsdWU/OiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIWFscmVhZHlTZWVuLmhhcyhrZXkpKSB7XG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGtleSkpO1xuICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgYXR0ckV4cHJzLnB1c2godmFsdWUpO1xuICAgICAgICAgIGFscmVhZHlTZWVuLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoa2V5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaXQncyBpbXBvcnRhbnQgdGhhdCB0aGlzIG9jY3VycyBiZWZvcmUgQklORElOR1MgYW5kIFRFTVBMQVRFIGJlY2F1c2Ugb25jZSBgZWxlbWVudFN0YXJ0YFxuICAgIC8vIGNvbWVzIGFjcm9zcyB0aGUgQklORElOR1Mgb3IgVEVNUExBVEUgbWFya2VycyB0aGVuIGl0IHdpbGwgY29udGludWUgcmVhZGluZyBlYWNoIHZhbHVlIGFzXG4gICAgLy8gYXMgc2luZ2xlIHByb3BlcnR5IHZhbHVlIGNlbGwgYnkgY2VsbC5cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJFeHBycyk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzID0gYXR0ckV4cHJzLmxlbmd0aDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbaV07XG4gICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdGhlIGFuaW1hdGlvbiBhbmQgYXR0cmlidXRlIGJpbmRpbmdzIGluIHRoZVxuICAgICAgICAvLyBhdHRyaWJ1dGVzIGFycmF5IHNpbmNlIHRoZXkgYXJlbid0IHVzZWQgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAgICAgaWYgKGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbiAmJiBpbnB1dC50eXBlICE9PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihpbnB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG91dHB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1tpXTtcbiAgICAgICAgaWYgKG91dHB1dC50eXBlICE9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIob3V0cHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHRoaXMgaXMgYSBjaGVhcCB3YXkgb2YgYWRkaW5nIHRoZSBtYXJrZXIgb25seSBhZnRlciBhbGwgdGhlIGlucHV0L291dHB1dFxuICAgICAgLy8gdmFsdWVzIGhhdmUgYmVlbiBmaWx0ZXJlZCAoYnkgbm90IGluY2x1ZGluZyB0aGUgYW5pbWF0aW9uIG9uZXMpIGFuZCBhZGRlZFxuICAgICAgLy8gdG8gdGhlIGV4cHJlc3Npb25zLiBUaGUgbWFya2VyIGlzIGltcG9ydGFudCBiZWNhdXNlIGl0IHRlbGxzIHRoZSBydW50aW1lXG4gICAgICAvLyBjb2RlIHRoYXQgdGhpcyBpcyB3aGVyZSBhdHRyaWJ1dGVzIHdpdGhvdXQgdmFsdWVzIHN0YXJ0Li4uXG4gICAgICBpZiAoYXR0ckV4cHJzLmxlbmd0aCAhPT0gYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMpIHtcbiAgICAgICAgYXR0ckV4cHJzLnNwbGljZShhdHRyc0xlbmd0aEJlZm9yZUlucHV0cywgMCwgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlQXR0cnMubGVuZ3RoKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuVGVtcGxhdGUpKTtcbiAgICAgIHRlbXBsYXRlQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIGlmIChib3VuZEkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBib3VuZEkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJFeHBycztcbiAgfVxuXG4gIHByaXZhdGUgYWRkVG9Db25zdHMoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKTogby5MaXRlcmFsRXhwciB7XG4gICAgaWYgKG8uaXNOdWxsKGV4cHJlc3Npb24pKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgY29uc3RzID0gdGhpcy5fY29uc3RhbnRzLmNvbnN0RXhwcmVzc2lvbnM7XG5cbiAgICAvLyBUcnkgdG8gcmV1c2UgYSBsaXRlcmFsIHRoYXQncyBhbHJlYWR5IGluIHRoZSBhcnJheSwgaWYgcG9zc2libGUuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25zdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb25zdHNbaV0uaXNFcXVpdmFsZW50KGV4cHJlc3Npb24pKSB7XG4gICAgICAgIHJldHVybiBvLmxpdGVyYWwoaSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG8ubGl0ZXJhbChjb25zdHMucHVzaChleHByZXNzaW9uKSAtIDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBdHRyc1RvQ29uc3RzKGF0dHJzOiBvLkV4cHJlc3Npb25bXXxudWxsKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzICE9PSBudWxsICYmIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc0FycmF5KHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IHJlZmVyZW5jZXMuZmxhdE1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXNMaXRlcmFsKHJlZnNQYXJhbSk7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcih0YWdOYW1lOiBzdHJpbmcsIG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50LCBpbmRleDogbnVtYmVyKTpcbiAgICAgICgpID0+IG8uRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPSBvdXRwdXRBc3QubmFtZTtcbiAgICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBvdXRwdXRBc3QudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgICAgLy8gc3ludGhldGljIEBsaXN0ZW5lci5mb28gdmFsdWVzIGFyZSB0cmVhdGVkIHRoZSBleGFjdCBzYW1lIGFzIGFyZSBzdGFuZGFyZCBsaXN0ZW5lcnNcbiAgICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoZXZlbnROYW1lLCBvdXRwdXRBc3QucGhhc2UhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoXG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCwgRVZFTlRfQklORElOR19TQ09QRV9HTE9CQUxTKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBDYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICBvdmVycmlkZSB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgcGlwZS5uYW1lU3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4pLFxuICAgICAgICBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID0gaXNWYXJMZW5ndGggP1xuICAgICAgICB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBhcmdzKV0pIDpcbiAgICAgICAgdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBDYWxsKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgdGFyZ2V0LFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHNsb3QpLFxuICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgICAgICBdLFxuICAgICAgICBudWxsISk7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5wdXNoKHBpcGVCaW5kRXhwcik7XG4gICAgcmV0dXJuIHBpcGVCaW5kRXhwcjtcbiAgfVxuXG4gIHVwZGF0ZVBpcGVTbG90T2Zmc2V0cyhiaW5kaW5nU2xvdHM6IG51bWJlcikge1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMuZm9yRWFjaCgocGlwZTogQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFycmF5LnNwYW4sIGFycmF5LnNvdXJjZVNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAgICAgLy8gdmFsdWVzLlxuICAgICAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIG1hcC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHJ8by5MaXRlcmFsTWFwRXhwcixcbiAgICBhbGxvY2F0ZVNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIC8vIEFsbG9jYXRlIDEgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIDEgcGVyIGFyZ3VtZW50XG4gIGNvbnN0IHN0YXJ0U2xvdCA9IGFsbG9jYXRlU2xvdHMoMSArIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHN0YXJ0U2xvdCksIGxpdGVyYWxGYWN0b3J5XTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbHMgdGhhdCBjYW4gYmUgYWRkZWQgdG8gYW4gZXhwcmVzc2lvblxuICogdG8gcmVwcmVzZW50IHRoZSBuYW1lIGFuZCBuYW1lc3BhY2Ugb2YgYW4gYXR0cmlidXRlLiBFLmcuXG4gKiBgOnhsaW5rOmhyZWZgIHR1cm5zIGludG8gYFtBdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJLCAneGxpbmsnLCAnaHJlZiddYC5cbiAqXG4gKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBhdHRyaWJ1dGUsIGluY2x1ZGluZyB0aGUgbmFtZXNwYWNlLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZTogc3RyaW5nKTogby5MaXRlcmFsRXhwcltdIHtcbiAgY29uc3QgW2F0dHJpYnV0ZU5hbWVzcGFjZSwgYXR0cmlidXRlTmFtZV0gPSBzcGxpdE5zTmFtZShuYW1lKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbnR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRoYXQgaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkLiBJdCBhbGxvd3MgZm9yIHRoZSB2YXJpYWJsZSB0byBiZVxuICogcmVuYW1lZCBkZXBlbmRpbmcgb24gaXRzIGxvY2F0aW9uLlxuICovXG50eXBlIExvY2FsVmFyUmVmQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmV0cmlldmFsTGV2ZWw6IG51bWJlcikgPT4gby5FeHByZXNzaW9uO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IG5leHRDb250ZXh0KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgbG9jYWxSZWZgIGlzIHRydWUgaWYgd2UgYXJlIHN0b3JpbmcgYSBsb2NhbCByZWZlcmVuY2VcbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uRXhwcmVzc2lvbiB8IExvY2FsVmFyUmVmQ2FsbGJhY2s7XG4gIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s7IGRlY2xhcmU6IGJvb2xlYW47IHByaW9yaXR5OiBudW1iZXI7XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7XG4gIERFRkFVTFQgPSAwLFxuICBDT05URVhUID0gMSxcbiAgU0hBUkVEX0NPTlRFWFQgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdXNlc1Jlc3RvcmVkVmlld0NvbnRleHQgPSBmYWxzZTtcbiAgc3RhdGljIGNyZWF0ZVJvb3RTY29wZSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIHJldHVybiBuZXcgQmluZGluZ1Njb3BlKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCByZWFkb25seSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCxcbiAgICAgIHB1YmxpYyBnbG9iYWxzPzogU2V0PHN0cmluZz4pIHtcbiAgICBpZiAoZ2xvYmFscyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgZ2xvYmFscykge1xuICAgICAgICB0aGlzLnNldCgwLCBuYW1lLCBvLnZhcmlhYmxlKG5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHlcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICYmICF2YWx1ZS5kZWNsYXJlKSB7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZS5saHMgPT09ICdmdW5jdGlvbicgPyB2YWx1ZS5saHModGhpcywgdmFsdWUucmV0cmlldmFsTGV2ZWwpIDogdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgYSB2YXJpYWJsZSBleGlzdHMgbG9jYWxseSBvbiB0aGUgY3VycmVudCBzY29wZS4gKi9cbiAgaGFzTG9jYWwobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhcyhuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9ufExvY2FsVmFyUmVmQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaywgbG9jYWxSZWY/OiB0cnVlKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAodGhpcy5tYXAuaGFzKG5hbWUpKSB7XG4gICAgICBpZiAobG9jYWxSZWYpIHtcbiAgICAgICAgLy8gRG8gbm90IHRocm93IGFuIGVycm9yIGlmIGl0J3MgYSBsb2NhbCByZWYgYW5kIGRvIG5vdCB1cGRhdGUgZXhpc3RpbmcgdmFsdWUsXG4gICAgICAgIC8vIHNvIHRoZSBmaXJzdCBkZWZpbmVkIHJlZiBpcyBhbHdheXMgcmV0dXJuZWQuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIH1cbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiBkZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50ZWQgYXMgcGFydCBvZiBMb2NhbFJlc29sdmVyLlxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmJpbmRpbmdMZXZlbCAhPT0gMCkge1xuICAgICAgLy8gU2luY2UgdGhlIGltcGxpY2l0IHJlY2VpdmVyIGlzIGFjY2Vzc2VkIGluIGFuIGVtYmVkZGVkIHZpZXcsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGRlY2xhcmUgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgIC8vIGluIHRoZSB1cGRhdGUgdmFyaWFibGVzLlxuICAgICAgdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApIS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyLCBnbG9iYWxzPzogU2V0PHN0cmluZz4pOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcywgZ2xvYmFscyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpIS5saHMgYXMgby5SZWFkVmFyRXhwcjtcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyBhcyBvLlJlYWRWYXJFeHByIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUICYmXG4gICAgICAgIHZhbHVlLnJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwpIHtcbiAgICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyB2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICBpZiAoc2hhcmVkQ3R4T2JqKSB7XG4gICAgICAgIHNoYXJlZEN0eE9iai5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FICsgdGhpcy5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgdGhpcy5tYXAuc2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgIC8vIGNvbnN0IGN0eF9yMCA9IG5leHRDb250ZXh0KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFQsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApITtcbiAgICBjb21wb25lbnRWYWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICBjb25zdCBsaHMgPSB0eXBlb2YgY29tcG9uZW50VmFsdWUubGhzID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgY29tcG9uZW50VmFsdWUubGhzKHRoaXMsIGNvbXBvbmVudFZhbHVlLnJldHJpZXZhbExldmVsKSA6XG4gICAgICAgIGNvbXBvbmVudFZhbHVlLmxocztcbiAgICByZXR1cm4gbmFtZSA9PT0gRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFID8gbGhzIDogbGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KCkge1xuICAgIC8vIFZpZXcgcmVzdG9yYXRpb24gaXMgcmVxdWlyZWQgZm9yIGxpc3RlbmVyIGluc3RydWN0aW9ucyBpbnNpZGUgZW1iZWRkZWQgdmlld3MsIGJlY2F1c2VcbiAgICAvLyB0aGV5IG9ubHkgcnVuIGluIGNyZWF0aW9uIG1vZGUgYW5kIHRoZXkgY2FuIGhhdmUgcmVmZXJlbmNlcyB0byB0aGUgY29udGV4dCBvYmplY3QuXG4gICAgLy8gSWYgdGhlIGNvbnRleHQgb2JqZWN0IGNoYW5nZXMgaW4gdXBkYXRlIG1vZGUsIHRoZSByZWZlcmVuY2Ugd2lsbCBiZSBpbmNvcnJlY3QsIGJlY2F1c2VcbiAgICAvLyBpdCB3YXMgZXN0YWJsaXNoZWQgZHVyaW5nIGNyZWF0aW9uLlxuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICAgIC8vIHBhcmVudCBzYXZlcyB2YXJpYWJsZSB0byBnZW5lcmF0ZSBhIHNoYXJlZCBgY29uc3QgJHMkID0gZ2V0Q3VycmVudFZpZXcoKTtgIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQhLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gICAgfVxuICB9XG5cbiAgcmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTogby5TdGF0ZW1lbnR8bnVsbCB7XG4gICAgaWYgKHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgY29uc3QgcmVzdG9yZUNhbGwgPSBpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5yZXN0b3JlVmlldywgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZV0pO1xuICAgICAgLy8gRWl0aGVyIGBjb25zdCByZXN0b3JlZEN0eCA9IHJlc3RvcmVWaWV3KCRzdGF0ZSQpO2Agb3IgYHJlc3RvcmVWaWV3KCRzdGF0ZSQpO2BcbiAgICAgIC8vIGRlcGVuZGluZyBvbiB3aGV0aGVyIGl0IGlzIGJlaW5nIHVzZWQuXG4gICAgICByZXR1cm4gdGhpcy51c2VzUmVzdG9yZWRWaWV3Q29udGV4dCA/XG4gICAgICAgICAgby52YXJpYWJsZShSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSkuc2V0KHJlc3RvcmVDYWxsKS50b0NvbnN0RGVjbCgpIDpcbiAgICAgICAgICByZXN0b3JlQ2FsbC50b1N0bXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnZXRDdXJyZW50VmlldygpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbXG4gICAgICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChpbnZva2VJbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pKS50b0NvbnN0RGVjbCgpXG4gICAgICAgIF0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIGlzTGlzdGVuZXJTY29wZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDtcbiAgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgICAgICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUuZGVjbGFyZSlcbiAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgY29uc3QgbGV2ZWxEaWZmID0gdGhpcy5iaW5kaW5nTGV2ZWwgLSB2YWx1ZS5yZXRyaWV2YWxMZXZlbDtcbiAgICAgICAgICAgICAgICAgY29uc3QgY3VyclN0bXRzID1cbiAgICAgICAgICAgICAgICAgICAgIHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICAgICAgICAgcmV0dXJuIHN0bXRzLmNvbmNhdChjdXJyU3RtdHMpO1xuICAgICAgICAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cblxuICBoYXNSZXN0b3JlVmlld1ZhcmlhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgfVxuXG4gIG5vdGlmeVJlc3RvcmVkVmlld0NvbnRleHRVc2UoKTogdm9pZCB7XG4gICAgdGhpcy51c2VzUmVzdG9yZWRWaWV3Q29udGV4dCA9IHRydWU7XG4gIH1cbn1cblxuLyoqIEJpbmRpbmcgc2NvcGUgb2YgYSBgdHJhY2tgIGZ1bmN0aW9uIGluc2lkZSBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5jbGFzcyBUcmFja0J5QmluZGluZ1Njb3BlIGV4dGVuZHMgQmluZGluZ1Njb3BlIHtcbiAgcHJpdmF0ZSBjb21wb25lbnRBY2Nlc3NDb3VudCA9IDA7XG5cbiAgY29uc3RydWN0b3IocGFyZW50U2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBnbG9iYWxPdmVycmlkZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgICBzdXBlcihwYXJlbnRTY29wZS5iaW5kaW5nTGV2ZWwgKyAxLCBwYXJlbnRTY29wZSk7XG4gIH1cblxuICBvdmVycmlkZSBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIC8vIEludGVyY2VwdCBhbnkgb3ZlcnJpZGRlbiBnbG9iYWxzLlxuICAgIGlmICh0aGlzLmdsb2JhbE92ZXJyaWRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nbG9iYWxPdmVycmlkZXNbbmFtZV0pO1xuICAgIH1cblxuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXMucGFyZW50O1xuXG4gICAgLy8gUHJldmVudCBhY2Nlc3NlcyBvZiB0ZW1wbGF0ZSB2YXJpYWJsZXMgb3V0c2lkZSB0aGUgYGZvcmAgbG9vcC5cbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgaWYgKGN1cnJlbnQuaGFzTG9jYWwobmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gV2hlbiB0aGUgY29tcG9uZW50IHNjb3BlIGlzIGFjY2Vzc2VkLCB3ZSByZWRpcmVjdCBpdCB0aHJvdWdoIGB0aGlzYC5cbiAgICB0aGlzLmNvbXBvbmVudEFjY2Vzc0NvdW50Kys7XG4gICAgcmV0dXJuIG8udmFyaWFibGUoJ3RoaXMnKS5wcm9wKG5hbWUpO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIG51bWJlciBvZiB0aW1lcyB0aGUgaG9zdCBjb21wb25lbnQgaGFzIGJlZW4gYWNjZXNzZWQgdGhyb3VnaCB0aGUgc2NvcGUuICovXG4gIGdldENvbXBvbmVudEFjY2Vzc0NvdW50KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50QWNjZXNzQ291bnQ7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIG91dCBvZiBhbiBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZXNcbiAqIHdoaWNoIGNhbiBiZSBhZGRlZCB0byB0aGUgaW5zdHJ1Y3Rpb24gcGFyYW1ldGVycy5cbiAqL1xuZnVuY3Rpb24gZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZTogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uW10ge1xuICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKGF0dHJpYnV0ZS52YWx1ZSlbMF07XG4gIHJldHVybiBbby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGFzTGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKV07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBhdHRyaWJ1dGVcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgaW50ZXJwb2xhdGVkIHRleHQuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRUZXh0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbik6IG8uRXh0ZXJuYWxSZWZlcmVuY2Uge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIG1vZGlmeSBob3cgYSB0ZW1wbGF0ZSBpcyBwYXJzZWQgYnkgYHBhcnNlVGVtcGxhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VUZW1wbGF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBQcmVzZXJ2ZSBvcmlnaW5hbCBsaW5lIGVuZGluZ3MgaW5zdGVhZCBvZiBub3JtYWxpemluZyAnXFxyXFxuJyBlbmRpbmdzIHRvICdcXG4nLlxuICAgKi9cbiAgcHJlc2VydmVMaW5lRW5kaW5ncz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xuICAvKipcbiAgICogQW4gYXJyYXkgb2YgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIGxlYWRpbmcgdHJpdmlhLlxuICAgKiBMZWFkaW5nIHRyaXZpYSBhcmUgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgaW1wb3J0YW50IHRvIHRoZSBkZXZlbG9wZXIsIGFuZCBzbyBzaG91bGQgbm90IGJlXG4gICAqIGluY2x1ZGVkIGluIHNvdXJjZS1tYXAgc2VnbWVudHMuICBBIGNvbW1vbiBleGFtcGxlIGlzIHdoaXRlc3BhY2UuXG4gICAqL1xuICBsZWFkaW5nVHJpdmlhQ2hhcnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogUmVuZGVyIGAkbG9jYWxpemVgIG1lc3NhZ2UgaWRzIHdpdGggYWRkaXRpb25hbCBsZWdhY3kgbWVzc2FnZSBpZHMuXG4gICAqXG4gICAqIFRoaXMgb3B0aW9uIGRlZmF1bHRzIHRvIGB0cnVlYCBidXQgaW4gdGhlIGZ1dHVyZSB0aGUgZGVmYXVsdCB3aWxsIGJlIGZsaXBwZWQuXG4gICAqXG4gICAqIEZvciBub3cgc2V0IHRoaXMgb3B0aW9uIHRvIGZhbHNlIGlmIHlvdSBoYXZlIG1pZ3JhdGVkIHRoZSB0cmFuc2xhdGlvbiBmaWxlcyB0byB1c2UgdGhlIG5ld1xuICAgKiBgJGxvY2FsaXplYCBtZXNzYWdlIGlkIGZvcm1hdCBhbmQgeW91IGFyZSBub3QgdXNpbmcgY29tcGlsZSB0aW1lIHRyYW5zbGF0aW9uIG1lcmdpbmcuXG4gICAqL1xuICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhbiBleHRlcm5hbCB0ZW1wbGF0ZSAoZS5nLiB2aWEgYHRlbXBsYXRlVXJsYCkgdGhlbiB3ZSBuZWVkIHRvIGRlY2lkZVxuICAgKiB3aGV0aGVyIG9yIG5vdCB0byBub3JtYWxpemUgdGhlIGxpbmUtZW5kaW5ncyAoZnJvbSBgXFxyXFxuYCB0byBgXFxuYCkgd2hlbiBwcm9jZXNzaW5nIElDVVxuICAgKiBleHByZXNzaW9ucy5cbiAgICpcbiAgICogSWYgYHRydWVgIHRoZW4gd2Ugd2lsbCBub3JtYWxpemUgSUNVIGV4cHJlc3Npb24gbGluZSBlbmRpbmdzLlxuICAgKiBUaGUgZGVmYXVsdCBpcyBgZmFsc2VgLCBidXQgdGhpcyB3aWxsIGJlIHN3aXRjaGVkIGluIGEgZnV0dXJlIG1ham9yIHJlbGVhc2UuXG4gICAqL1xuICBpMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGFsd2F5cyBhdHRlbXB0IHRvIGNvbnZlcnQgdGhlIHBhcnNlZCBIVE1MIEFTVCB0byBhbiBSMyBBU1QsIGRlc3BpdGUgSFRNTCBvciBpMThuXG4gICAqIE1ldGEgcGFyc2UgZXJyb3JzLlxuICAgKlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1c2VmdWwgaW4gdGhlIGNvbnRleHQgb2YgdGhlIGxhbmd1YWdlIHNlcnZpY2UsIHdoZXJlIHdlIHdhbnQgdG8gZ2V0IGFzIG11Y2hcbiAgICogaW5mb3JtYXRpb24gYXMgcG9zc2libGUsIGRlc3BpdGUgYW55IGVycm9ycyBpbiB0aGUgSFRNTC4gQXMgYW4gZXhhbXBsZSwgYSB1c2VyIG1heSBiZSBhZGRpbmdcbiAgICogYSBuZXcgdGFnIGFuZCBleHBlY3RpbmcgYXV0b2NvbXBsZXRlIG9uIHRoYXQgdGFnLiBJbiB0aGlzIHNjZW5hcmlvLCB0aGUgSFRNTCBpcyBpbiBhbiBlcnJvcmVkXG4gICAqIHN0YXRlLCBhcyB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIG9wZW4gdGFnLiBIb3dldmVyLCB3ZSdyZSBzdGlsbCBhYmxlIHRvIGNvbnZlcnQgdGhlIEhUTUwgQVNUXG4gICAqIG5vZGVzIHRvIFIzIEFTVCBub2RlcyBpbiBvcmRlciB0byBwcm92aWRlIGluZm9ybWF0aW9uIGZvciB0aGUgbGFuZ3VhZ2Ugc2VydmljZS5cbiAgICpcbiAgICogTm90ZSB0aGF0IGV2ZW4gd2hlbiBgdHJ1ZWAgdGhlIEhUTUwgcGFyc2UgYW5kIGkxOG4gZXJyb3JzIGFyZSBzdGlsbCBhcHBlbmRlZCB0byB0aGUgZXJyb3JzXG4gICAqIG91dHB1dCwgYnV0IHRoaXMgaXMgZG9uZSBhZnRlciBjb252ZXJ0aW5nIHRoZSBIVE1MIEFTVCB0byBSMyBBU1QuXG4gICAqL1xuICBhbHdheXNBdHRlbXB0SHRtbFRvUjNBc3RDb252ZXJzaW9uPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSW5jbHVkZSBIVE1MIENvbW1lbnQgbm9kZXMgaW4gYSB0b3AtbGV2ZWwgY29tbWVudHMgYXJyYXkgb24gdGhlIHJldHVybmVkIFIzIEFTVC5cbiAgICpcbiAgICogVGhpcyBvcHRpb24gaXMgcmVxdWlyZWQgYnkgdG9vbGluZyB0aGF0IG5lZWRzIHRvIGtub3cgdGhlIGxvY2F0aW9uIG9mIGNvbW1lbnQgbm9kZXMgd2l0aGluIHRoZVxuICAgKiBBU1QuIEEgY29uY3JldGUgZXhhbXBsZSBpcyBAYW5ndWxhci1lc2xpbnQgd2hpY2ggcmVxdWlyZXMgdGhpcyBpbiBvcmRlciB0byBlbmFibGVcbiAgICogXCJlc2xpbnQtZGlzYWJsZVwiIGNvbW1lbnRzIHdpdGhpbiBIVE1MIHRlbXBsYXRlcywgd2hpY2ggdGhlbiBhbGxvd3MgdXNlcnMgdG8gdHVybiBvZmYgc3BlY2lmaWNcbiAgICogcnVsZXMgb24gYSBjYXNlIGJ5IGNhc2UgYmFzaXMsIGluc3RlYWQgb2YgZm9yIHRoZWlyIHdob2xlIHByb2plY3Qgd2l0aGluIGEgY29uZmlndXJhdGlvbiBmaWxlLlxuICAgKi9cbiAgY29sbGVjdENvbW1lbnROb2Rlcz86IGJvb2xlYW47XG5cbiAgLyoqIFdoZXRoZXIgdGhlIEAgYmxvY2sgc3ludGF4IGlzIGVuYWJsZWQuICovXG4gIGVuYWJsZUJsb2NrU3ludGF4PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTogUGFyc2VkVGVtcGxhdGUge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlcywgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdH0gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UodGVtcGxhdGUsIHRlbXBsYXRlVXJsLCB7XG4gICAgbGVhZGluZ1RyaXZpYUNoYXJzOiBMRUFESU5HX1RSSVZJQV9DSEFSUyxcbiAgICAuLi5vcHRpb25zLFxuICAgIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWUsXG4gICAgdG9rZW5pemVCbG9ja3M6IG9wdGlvbnMuZW5hYmxlQmxvY2tTeW50YXggPz8gdHJ1ZSxcbiAgfSk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgcGFyc2VSZXN1bHQuZXJyb3JzICYmXG4gICAgICBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcblxuICAvLyBwcm9jZXNzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiAoc2NhbiBhdHRyaWJ1dGVzLCBnZW5lcmF0ZSBpZHMpXG4gIC8vIGJlZm9yZSB3ZSBydW4gd2hpdGVzcGFjZSByZW1vdmFsIHByb2Nlc3MsIGJlY2F1c2UgZXhpc3RpbmcgaTE4blxuICAvLyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgY29uc3QgaTE4bk1ldGFWaXNpdG9yID0gbmV3IEkxOG5NZXRhVmlzaXRvcihcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gIXByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0KTtcbiAgY29uc3QgaTE4bk1ldGFSZXN1bHQgPSBpMThuTWV0YVZpc2l0b3IudmlzaXRBbGxXaXRoRXJyb3JzKHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFvcHRpb25zLmFsd2F5c0F0dGVtcHRIdG1sVG9SM0FzdENvbnZlcnNpb24gJiYgaTE4bk1ldGFSZXN1bHQuZXJyb3JzICYmXG4gICAgICBpMThuTWV0YVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZXJyb3JzOiBpMThuTWV0YVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgc3R5bGVzOiBbXSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW11cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHBhcnNlZFRlbXBsYXRlLmNvbW1lbnROb2RlcyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkVGVtcGxhdGU7XG4gIH1cblxuICByb290Tm9kZXMgPSBpMThuTWV0YVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdoaXRlc3BhY2VzIGFyZSByZW1vdmVkIChiZWNhdXNlIHRoYXQgbWlnaHQgYWZmZWN0XG4gICAgLy8gZ2VuZXJhdGVkIGkxOG4gbWVzc2FnZSBjb250ZW50KSBhbmQgZmlyc3QgcGFzcyBpbmRpY2F0ZWQgdGhhdCBpMThuIGNvbnRlbnQgaXMgcHJlc2VudCBpbiBhXG4gICAgLy8gdGVtcGxhdGUuIER1cmluZyB0aGlzIHBhc3MgaTE4biBJRHMgZ2VuZXJhdGVkIGF0IHRoZSBmaXJzdCBwYXNzIHdpbGwgYmUgcHJlc2VydmVkLCBzbyB3ZSBjYW5cbiAgICAvLyBtaW1pYyBleGlzdGluZyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnMsIGNvbW1lbnROb2Rlc30gPSBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgICAgcm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyLCB7Y29sbGVjdENvbW1lbnROb2RlczogISFvcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXN9KTtcbiAgZXJyb3JzLnB1c2goLi4ucGFyc2VSZXN1bHQuZXJyb3JzLCAuLi5pMThuTWV0YVJlc3VsdC5lcnJvcnMpO1xuXG4gIGNvbnN0IHBhcnNlZFRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSA9IHtcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgZXJyb3JzOiBlcnJvcnMubGVuZ3RoID4gMCA/IGVycm9ycyA6IG51bGwsXG4gICAgbm9kZXMsXG4gICAgc3R5bGVVcmxzLFxuICAgIHN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnNcbiAgfTtcblxuICBpZiAob3B0aW9ucy5jb2xsZWN0Q29tbWVudE5vZGVzKSB7XG4gICAgcGFyc2VkVGVtcGxhdGUuY29tbWVudE5vZGVzID0gY29tbWVudE5vZGVzO1xuICB9XG4gIHJldHVybiBwYXJzZWRUZW1wbGF0ZTtcbn1cblxuY29uc3QgZWxlbWVudFJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKG5ldyBQYXJzZXIobmV3IExleGVyKCkpLCBpbnRlcnBvbGF0aW9uQ29uZmlnLCBlbGVtZW50UmVnaXN0cnksIFtdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25Gbihjb250ZXh0OiBjb3JlLlNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGU/OiBib29sZWFuKSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlzQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ1c3RlZENvbnN0QXR0cmlidXRlKHRhZ05hbWU6IHN0cmluZywgYXR0cjogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgdmFsdWUgPSBhc0xpdGVyYWwoYXR0ci52YWx1ZSk7XG4gIGlmIChpc1RydXN0ZWRUeXBlc1NpbmsodGFnTmFtZSwgYXR0ci5uYW1lKSkge1xuICAgIHN3aXRjaCAoZWxlbWVudFJlZ2lzdHJ5LnNlY3VyaXR5Q29udGV4dCh0YWdOYW1lLCBhdHRyLm5hbWUsIC8qIGlzQXR0cmlidXRlICovIHRydWUpKSB7XG4gICAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICAgIHJldHVybiBvLnRhZ2dlZFRlbXBsYXRlKFxuICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRIdG1sKSxcbiAgICAgICAgICAgIG5ldyBvLlRlbXBsYXRlTGl0ZXJhbChbbmV3IG8uVGVtcGxhdGVMaXRlcmFsRWxlbWVudChhdHRyLnZhbHVlKV0sIFtdKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYXR0ci52YWx1ZVNwYW4pO1xuICAgICAgLy8gTkI6IG5vIFNlY3VyaXR5Q29udGV4dC5TQ1JJUFQgaGVyZSwgYXMgdGhlIGNvcnJlc3BvbmRpbmcgdGFncyBhcmUgc3RyaXBwZWQgYnkgdGhlIGNvbXBpbGVyLlxuICAgICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICAgIHJldHVybiBvLnRhZ2dlZFRlbXBsYXRlKFxuICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRSZXNvdXJjZVVybCksXG4gICAgICAgICAgICBuZXcgby5UZW1wbGF0ZUxpdGVyYWwoW25ldyBvLlRlbXBsYXRlTGl0ZXJhbEVsZW1lbnQoYXR0ci52YWx1ZSldLCBbXSksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGF0dHIudmFsdWVTcGFuKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGNoaWxkcmVuIGlzW3QuRWxlbWVudF0ge1xuICByZXR1cm4gY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIGNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBpc1RleHROb2RlKG5vZGU6IHQuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIHQuVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuSWN1O1xufVxuXG5mdW5jdGlvbiBpc0lmcmFtZUVsZW1lbnQodGFnTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB0YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpZnJhbWUnO1xufVxuXG5mdW5jdGlvbiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4gY2hpbGRyZW4uZXZlcnkoaXNUZXh0Tm9kZSk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdGdW5jdGlvblBhcmFtcyhcbiAgICBkZWZlcnJlZFBhcmFtczogKCkgPT4gKG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdKSwgbmFtZT86IHN0cmluZyxcbiAgICBlYWdlclBhcmFtcz86IG8uRXhwcmVzc2lvbltdKSB7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBkZWZlcnJlZFBhcmFtcygpO1xuICAgIGNvbnN0IGZuUGFyYW1zID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFt2YWx1ZV07XG4gICAgaWYgKGVhZ2VyUGFyYW1zKSB7XG4gICAgICBmblBhcmFtcy5wdXNoKC4uLmVhZ2VyUGFyYW1zKTtcbiAgICB9XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIC8vIFdlIHdhbnQgdGhlIHByb3BlcnR5IG5hbWUgdG8gYWx3YXlzIGJlIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgICBmblBhcmFtcy51bnNoaWZ0KG8ubGl0ZXJhbChuYW1lKSk7XG4gICAgfVxuICAgIHJldHVybiBmblBhcmFtcztcbiAgfTtcbn1cblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lIGEgZ2l2ZW4gdHJhbnNsYXRpb24gbWVzc2FnZS5cbiAqXG4gKiBgYGBcbiAqIHZhciBJMThOXzE7XG4gKiBpZiAodHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGUpIHtcbiAqICAgICB2YXIgTVNHX0VYVEVSTkFMX1hYWCA9IGdvb2cuZ2V0TXNnKFxuICogICAgICAgICAgXCJTb21lIG1lc3NhZ2Ugd2l0aCB7JGludGVycG9sYXRpb259IVwiLFxuICogICAgICAgICAgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9XG4gKiAgICAgKTtcbiAqICAgICBJMThOXzEgPSBNU0dfRVhURVJOQUxfWFhYO1xuICogfVxuICogZWxzZSB7XG4gKiAgICAgSTE4Tl8xID0gJGxvY2FsaXplYFNvbWUgbWVzc2FnZSB3aXRoICR7J1xcdUZGRkQwXFx1RkZGRCd9IWA7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSBUaGUgb3JpZ2luYWwgaTE4biBBU1QgbWVzc2FnZSBub2RlXG4gKiBAcGFyYW0gdmFyaWFibGUgVGhlIHZhcmlhYmxlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0aGUgdHJhbnNsYXRpb24sIGUuZy4gYEkxOE5fMWAuXG4gKiBAcGFyYW0gY2xvc3VyZVZhciBUaGUgdmFyaWFibGUgZm9yIENsb3N1cmUgYGdvb2cuZ2V0TXNnYCBjYWxscywgZS5nLiBgTVNHX0VYVEVSTkFMX1hYWGAuXG4gKiBAcGFyYW0gcGFyYW1zIE9iamVjdCBtYXBwaW5nIHBsYWNlaG9sZGVyIG5hbWVzIHRvIHRoZWlyIHZhbHVlcyAoZS5nLlxuICogYHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfWApLlxuICogQHBhcmFtIHRyYW5zZm9ybUZuIE9wdGlvbmFsIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSB0cmFuc2xhdGlvbiAoZS5nLlxuICogcG9zdC1wcm9jZXNzaW5nKS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBkZWZpbmVkIGEgZ2l2ZW4gdHJhbnNsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhcbiAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBjbG9zdXJlVmFyOiBvLlJlYWRWYXJFeHByLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgLy8gU29ydCB0aGUgbWFwIGVudHJpZXMgaW4gdGhlIGNvbXBpbGVkIG91dHB1dC4gVGhpcyBtYWtlcyBpdCBlYXN5IHRvIGFjaGVpdmUgaWRlbnRpY2FsIG91dHB1dCBpblxuICAvLyB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgY29tcGlsZXIuXG4gIHBhcmFtcyA9IE9iamVjdC5mcm9tRW50cmllcyhPYmplY3QuZW50cmllcyhwYXJhbXMpLnNvcnQoKSk7XG5cbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtcbiAgICBkZWNsYXJlSTE4blZhcmlhYmxlKHZhcmlhYmxlKSxcbiAgICBvLmlmU3RtdChcbiAgICAgICAgY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpLFxuICAgICAgICBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKHZhcmlhYmxlLCBtZXNzYWdlLCBjbG9zdXJlVmFyLCBwYXJhbXMpLFxuICAgICAgICBjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHMoXG4gICAgICAgICAgICB2YXJpYWJsZSwgbWVzc2FnZSwgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZXNJbk1hcChwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGd1YXJkIHRoZSBjbG9zdXJlIG1vZGUgYmxvY2tcbiAqIEl0IGlzIGVxdWl2YWxlbnQgdG86XG4gKlxuICogYGBgXG4gKiB0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKTogby5CaW5hcnlPcGVyYXRvckV4cHIge1xuICByZXR1cm4gby50eXBlb2ZFeHByKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKVxuICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoJ3VuZGVmaW5lZCcsIG8uU1RSSU5HX1RZUEUpKVxuICAgICAgLmFuZChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSk7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHRlbXBsYXRlIHdoaWNoIHdhcyBleHRyYWN0ZWQgZHVyaW5nIHBhcnNpbmcuXG4gKlxuICogVGhpcyBjb250YWlucyB0aGUgYWN0dWFsIHBhcnNlZCB0ZW1wbGF0ZSBhcyB3ZWxsIGFzIGFueSBtZXRhZGF0YSBjb2xsZWN0ZWQgZHVyaW5nIGl0cyBwYXJzaW5nLFxuICogc29tZSBvZiB3aGljaCBtaWdodCBiZSB1c2VmdWwgZm9yIHJlLXBhcnNpbmcgdGhlIHRlbXBsYXRlIHdpdGggZGlmZmVyZW50IG9wdGlvbnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVGVtcGxhdGUge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEhvdyB0byBwYXJzZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIEFueSBlcnJvcnMgZnJvbSBwYXJzaW5nIHRoZSB0ZW1wbGF0ZSB0aGUgZmlyc3QgdGltZS5cbiAgICpcbiAgICogYG51bGxgIGlmIHRoZXJlIGFyZSBubyBlcnJvcnMuIE90aGVyd2lzZSwgdGhlIGFycmF5IG9mIGVycm9ycyBpcyBndWFyYW50ZWVkIHRvIGJlIG5vbi1lbXB0eS5cbiAgICovXG4gIGVycm9yczogUGFyc2VFcnJvcltdfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSB0ZW1wbGF0ZSBBU1QsIHBhcnNlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIG5vZGVzOiB0Lk5vZGVbXTtcblxuICAvKipcbiAgICogQW55IHN0eWxlVXJscyBleHRyYWN0ZWQgZnJvbSB0aGUgbWV0YWRhdGEuXG4gICAqL1xuICBzdHlsZVVybHM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbnkgaW5saW5lIHN0eWxlcyBleHRyYWN0ZWQgZnJvbSB0aGUgbWV0YWRhdGEuXG4gICAqL1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBBbnkgbmctY29udGVudCBzZWxlY3RvcnMgZXh0cmFjdGVkIGZyb20gdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IFIzIENvbW1lbnQgTm9kZXMgZXh0cmFjdGVkIGZyb20gdGhlIHRlbXBsYXRlIHdoZW4gdGhlIGBjb2xsZWN0Q29tbWVudE5vZGVzYCBwYXJzZSB0ZW1wbGF0ZVxuICAgKiBvcHRpb24gaXMgZW5hYmxlZC5cbiAgICovXG4gIGNvbW1lbnROb2Rlcz86IHQuQ29tbWVudFtdO1xufVxuIl19