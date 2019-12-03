/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { flatten, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { Parser } from '../../expression_parser/parser';
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
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { prepareSyntheticListenerFunctionName, prepareSyntheticListenerName, prepareSyntheticPropertyName } from '../util';
import { I18nContext } from './i18n/context';
import { createGoogleGetMsgStatements } from './i18n/get_msg_utils';
import { createLocalizeStatements } from './i18n/localize_utils';
import { I18nMetaVisitor } from './i18n/meta';
import { I18N_ICU_MAPPING_PREFIX, TRANSLATION_PREFIX, assembleBoundTextPlaceholders, assembleI18nBoundString, declareI18nVariable, getTranslationConstPrefix, i18nFormatPlaceholderNames, icuFromI18nMessage, isI18nRootNode, isSingleI18nIcu, placeholdersToParams, wrapI18nPlaceholder } from './i18n/util';
import { StylingBuilder } from './styling_builder';
import { CONTEXT_NAME, IMPLICIT_REFERENCE, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, chainedInstruction, getAttrsForDirectiveMatching, getInterpolationArgsLength, invalid, trimTrailingNulls, unsupported } from './util';
// Selector attribute name of `<ng-content>`
const NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
const NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
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
    const implicitReceiverExpr = (scope === null || scope.bindingLevel === 0) ?
        o.variable(CONTEXT_NAME) :
        scope.getOrCreateSharedContextVar(0);
    const bindingExpr = convertActionBinding(scope, implicitReceiverExpr, handler, 'b', () => error('Unexpected interpolation'), eventAst.handlerSpan);
    const statements = [];
    if (scope) {
        statements.push(...scope.restoreViewStatement());
        statements.push(...scope.variableDeclarations());
    }
    statements.push(...bindingExpr.render3Stmts);
    const eventName = type === 1 /* Animation */ ? prepareSyntheticListenerName(name, phase) : name;
    const fnName = handlerName && sanitizeIdentifier(handlerName);
    const fnArgs = [new o.FnParam('$event', o.DYNAMIC_TYPE)];
    const handlerFn = o.fn(fnArgs, statements, o.INFERRED_TYPE, null, fnName);
    const params = [o.literal(eventName), handlerFn];
    if (target) {
        params.push(o.literal(false), // `useCapture` flag, defaults to `false`
        o.importExpr(GLOBAL_TARGET_RESOLVERS.get(target)));
    }
    return params;
}
export class TemplateDefinitionBuilder {
    constructor(constantPool, parentBindingScope, level = 0, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds, _constants = []) {
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
        const initI18nContext = this.i18nContext || (isI18nRootNode(i18n) && !isSingleI18nIcu(i18n) &&
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
    getLocal(name) { return this._bindingScope.get(name); }
    // LocalResolver
    notifyImplicitReceiverUse() { this._bindingScope.notifyImplicitReceiverUse(); }
    i18nTranslate(message, params = {}, ref, transformFn) {
        const _ref = ref || o.variable(this.constantPool.uniqueName(TRANSLATION_PREFIX));
        // Closure Compiler requires const names to start with `MSG_` but disallows any other const to
        // start with `MSG_`. We define a variable starting with `MSG_` just for the `goog.getMsg` call
        const closureVar = this.i18nGenerateClosureVar(message.id);
        const statements = getTranslationDeclStmts(message, _ref, closureVar, params, transformFn);
        this.constantPool.statements.push(...statements);
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
        if (this.i18nContext) {
            this.i18n = this.i18nContext.forkChildContext(index, this.templateIndex, meta);
        }
        else {
            const ref = o.variable(this.constantPool.uniqueName(TRANSLATION_PREFIX));
            this.i18n = new I18nContext(index, ref, 0, this.templateIndex, meta);
        }
        // generate i18nStart instruction
        const { id, ref } = this.i18n;
        const params = [o.literal(index), ref];
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
            this.updateInstructionChain(R3.i18nExp, chainBindings);
            this.updateInstruction(span, R3.i18nApply, [o.literal(index)]);
        }
        if (!selfClosing) {
            this.creationInstruction(span, R3.i18nEnd);
        }
        this.i18n = null; // reset local i18n context
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
        this.creationInstruction(element.sourceSpan, nsInstruction);
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
        const attributes = [];
        let ngProjectAsAttr;
        this._ngContentReservedSlots.push(ngContent.selector);
        ngContent.attributes.forEach((attribute) => {
            const { name, value } = attribute;
            if (name === NG_PROJECT_AS_ATTR_NAME) {
                ngProjectAsAttr = attribute;
            }
            if (name.toLowerCase() !== NG_CONTENT_SELECT_ATTR) {
                attributes.push(o.literal(name), o.literal(value));
            }
        });
        if (ngProjectAsAttr) {
            attributes.push(...getNgProjectAsLiteral(ngProjectAsAttr));
        }
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
        const stylingBuilder = new StylingBuilder(o.literal(elementIndex), null);
        let isNonBindableMode = false;
        const isI18nRootElement = isI18nRootNode(element.i18n) && !isSingleI18nIcu(element.i18n);
        const i18nAttrs = [];
        const outputAttrs = [];
        let ngProjectAsAttr;
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
                if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                    ngProjectAsAttr = attr;
                }
                if (attr.i18n) {
                    // Place attributes into a separate array for i18n processing, but also keep such
                    // attributes in the main list to make them available for directive matching at runtime.
                    // TODO(FW-1248): prevent attributes duplication in `i18nAttributes` and `elementStart`
                    // arguments
                    i18nAttrs.push(attr);
                }
                else {
                    outputAttrs.push(attr);
                }
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
        const attributes = [];
        const allOtherInputs = [];
        element.inputs.forEach((input) => {
            const stylingInputWasSet = stylingBuilder.registerBoundInput(input);
            if (!stylingInputWasSet) {
                if (input.type === 0 /* Property */ && input.i18n) {
                    // Place attributes into a separate array for i18n processing, but also keep such
                    // attributes in the main list to make them available for directive matching at runtime.
                    // TODO(FW-1248): prevent attributes duplication in `i18nAttributes` and `elementStart`
                    // arguments
                    i18nAttrs.push(input);
                }
                else {
                    allOtherInputs.push(input);
                }
            }
        });
        outputAttrs.forEach(attr => {
            attributes.push(...getAttributeNameLiterals(attr.name), o.literal(attr.value));
        });
        // add attributes for directive and projection matching purposes
        attributes.push(...this.prepareNonRenderAttrs(allOtherInputs, element.outputs, stylingBuilder, [], i18nAttrs, ngProjectAsAttr));
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
            element.outputs.length === 0 && i18nAttrs.length === 0 && !hasChildren;
        const createSelfClosingI18nInstruction = !createSelfClosingInstruction && hasTextChildrenOnly(element.children);
        if (createSelfClosingInstruction) {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainer : R3.element, trimTrailingNulls(parameters));
        }
        else {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainerStart : R3.elementStart, trimTrailingNulls(parameters));
            if (isNonBindableMode) {
                this.creationInstruction(element.sourceSpan, R3.disableBindings);
            }
            // process i18n element attributes
            if (i18nAttrs.length) {
                let hasBindings = false;
                const i18nAttrArgs = [];
                const bindings = [];
                i18nAttrs.forEach(attr => {
                    const message = attr.i18n;
                    if (attr instanceof t.TextAttribute) {
                        i18nAttrArgs.push(o.literal(attr.name), this.i18nTranslate(message));
                    }
                    else {
                        const converted = attr.value.visit(this._valueConverter);
                        this.allocateBindingSlots(converted);
                        if (converted instanceof Interpolation) {
                            const placeholders = assembleBoundTextPlaceholders(message);
                            const params = placeholdersToParams(placeholders);
                            i18nAttrArgs.push(o.literal(attr.name), this.i18nTranslate(message, params));
                            converted.expressions.forEach(expression => {
                                hasBindings = true;
                                bindings.push({
                                    sourceSpan: element.sourceSpan,
                                    value: () => this.convertPropertyBinding(expression)
                                });
                            });
                        }
                    }
                });
                if (bindings.length) {
                    this.updateInstructionChain(R3.i18nExp, bindings);
                }
                if (i18nAttrArgs.length) {
                    const index = o.literal(this.allocateDataSlot());
                    const args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs), true);
                    this.creationInstruction(element.sourceSpan, R3.i18nAttributes, [index, args]);
                    if (hasBindings) {
                        this.updateInstruction(element.sourceSpan, R3.i18nApply, [index]);
                    }
                }
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
                this.i18nStart(element.sourceSpan, element.i18n, createSelfClosingI18nInstruction);
            }
        }
        // the code here will collect all update-level styling instructions and add them to the
        // update block of the template function AOT code. Instructions like `styleProp`,
        // `styleMap`, `classMap`, `classProp` and `stylingApply`
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
        allOtherInputs.forEach((input) => {
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
                                value: () => this.convertPropertyBinding(value), params
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
                                value: () => this.convertPropertyBinding(boundValue), params
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
            const span = element.endSourceSpan || element.sourceSpan;
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
        const attrsExprs = [];
        template.attributes.forEach((a) => { attrsExprs.push(asLiteral(a.name), asLiteral(a.value)); });
        attrsExprs.push(...this.prepareNonRenderAttrs(template.inputs, template.outputs, undefined, template.templateAttrs));
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
            this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
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
        // Only add normal input/output binding instructions on explicit ng-template elements.
        if (template.tagName === NG_TEMPLATE_TAG_NAME) {
            // Add the input bindings
            this.templatePropertyBindings(templateIndex, template.inputs);
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
    allocateDataSlot() { return this._dataIndex++; }
    getConstCount() { return this._dataIndex; }
    getVarCount() { return this._pureFunctionSlots; }
    getConsts() { return this._constants; }
    getNgContentSelectors() {
        return this._ngContentReservedSlots.length ?
            this.constantPool.getConstLiteral(asLiteral(this._ngContentReservedSlots), true) :
            null;
    }
    bindingContext() { return `${this._bindingContext++}`; }
    templatePropertyBindings(templateIndex, attrs) {
        const propertyBindings = [];
        attrs.forEach(input => {
            if (input instanceof t.BoundAttribute) {
                const value = input.value.visit(this._valueConverter);
                if (value !== undefined) {
                    this.allocateBindingSlots(value);
                    propertyBindings.push({
                        name: input.name,
                        sourceSpan: input.sourceSpan,
                        value: () => this.convertPropertyBinding(value)
                    });
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
                        return call
                            .params(value => (call.supportsInterpolation && value instanceof Interpolation) ?
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
        const convertedPropertyBinding = convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), BindingForm.TrySimple, () => error('Unexpected interpolation'));
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
            this.directiveMatcher.match(selector, (cssSelector, staticType) => { this.directives.add(staticType); });
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
     *   CLASSES, class1, class2,
     *   STYLES, style1, value1, style2, value2,
     *   BINDINGS, name1, name2, name3,
     *   TEMPLATE, name4, name5, name6,
     *   PROJECT_AS, selector,
     *   I18N, name7, name8, ...]
     * ```
     *
     * Note that this function will fully ignore all synthetic (@foo) attribute values
     * because those values are intended to always be generated as property instructions.
     */
    prepareNonRenderAttrs(inputs, outputs, styles, templateAttrs = [], i18nAttrs = [], ngProjectAsAttr) {
        const alreadySeen = new Set();
        const attrExprs = [];
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
        if (ngProjectAsAttr) {
            attrExprs.push(...getNgProjectAsLiteral(ngProjectAsAttr));
        }
        if (i18nAttrs.length) {
            attrExprs.push(o.literal(6 /* I18n */));
            i18nAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        return attrExprs;
    }
    addToConsts(expression) {
        if (o.isNull(expression)) {
            return o.TYPED_NULL_EXPR;
        }
        // Try to reuse a literal that's already in the array, if possible.
        for (let i = 0; i < this._constants.length; i++) {
            if (this._constants[i].isEquivalent(expression)) {
                return o.literal(i);
            }
        }
        return o.literal(this._constants.push(expression) - 1);
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
            const scope = this._bindingScope.nestedScope(this._bindingScope.bindingLevel);
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
        const target = new PropertyRead(pipe.span, pipe.sourceSpan, new ImplicitReceiver(pipe.span, pipe.sourceSpan), slotPseudoLocal);
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
    constructor(bindingLevel = 0, parent = null) {
        this.bindingLevel = bindingLevel;
        this.parent = parent;
        /** Keeps a map from local variables to their BindingData. */
        this.map = new Map();
        this.referenceNameIndex = 0;
        this.restoreViewVariable = null;
    }
    static get ROOT_SCOPE() {
        if (!BindingScope._ROOT_SCOPE) {
            BindingScope._ROOT_SCOPE = new BindingScope().set(0, '$event', o.variable('$event'));
        }
        return BindingScope._ROOT_SCOPE;
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
    getLocal(name) { return this.get(name); }
    // Implemented as part of LocalResolver.
    notifyImplicitReceiverUse() {
        if (this.bindingLevel !== 0) {
            // Since the implicit receiver is accessed in an embedded view, we need to
            // ensure that we declare a shared context variable for the current template
            // in the update variables.
            this.map.get(SHARED_CONTEXT_KEY + 0).declare = true;
        }
    }
    nestedScope(level) {
        const newScope = new BindingScope(level, this);
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
    isListenerScope() { return this.parent && this.parent.bindingLevel === this.bindingLevel; }
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
        return { errors: parseResult.errors, nodes: [], styleUrls: [], styles: [] };
    }
    let rootNodes = parseResult.rootNodes;
    // process i18n meta information (scan attributes, generate ids)
    // before we run whitespace removal process, because existing i18n
    // extraction process (ng xi18n) relies on a raw content to generate
    // message ids
    const i18nMetaVisitor = new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ !preserveWhitespaces, enableI18nLegacyMessageIdFormat);
    rootNodes = html.visitAll(i18nMetaVisitor, rootNodes);
    if (!preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
        // run i18n meta visitor again in case whitespaces are removed (because that might affect
        // generated i18n message content) and first pass indicated that i18n content is present in a
        // template. During this pass i18n IDs generated at the first pass will be preserved, so we can
        // mimic existing extraction process (ng xi18n)
        if (i18nMetaVisitor.hasI18nMeta) {
            rootNodes = html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
        }
    }
    const { nodes, errors, styleUrls, styles } = htmlAstToRender3Ast(rootNodes, bindingParser);
    if (errors && errors.length > 0) {
        return { errors, nodes: [], styleUrls: [], styles: [] };
    }
    return { nodes, styleUrls, styles };
}
/**
 * Construct a `BindingParser` with a default configuration.
 */
export function makeBindingParser(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    return new BindingParser(new Parser(new Lexer()), interpolationConfig, new DomElementSchemaRegistry(), null, []);
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
 * if (ngI18nClosureMode) {
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
        o.ifStmt(o.variable(NG_I18N_CLOSURE_MODE), createGoogleGetMsgStatements(variable, message, closureVar, i18nFormatPlaceholderNames(params, /* useCamelCase */ true)), createLocalizeStatements(variable, message, i18nFormatPlaceholderNames(params, /* useCamelCase */ false))),
    ];
    if (transformFn) {
        statements.push(new o.ExpressionStatement(variable.set(transformFn(variable))));
    }
    return statements;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRS9LLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQW1CLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ25PLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHNDQUFzQyxDQUFDO0FBRXZHLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1B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LDBCQUEwQixDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUNoRSx3QkFBd0IsQ0FDcEIsUUFBUSxFQUFFLE9BQU8sRUFBRSwwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUMxRixDQUFDO0lBRUYsSUFBSSxXQUFXLEVBQUU7UUFDZixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pGO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRVcGRhdGVBcmd1bWVudHN9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtJMThuQ29udGV4dH0gZnJvbSAnLi9pMThuL2NvbnRleHQnO1xuaW1wb3J0IHtjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzfSBmcm9tICcuL2kxOG4vZ2V0X21zZ191dGlscyc7XG5pbXBvcnQge2NyZWF0ZUxvY2FsaXplU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7STE4bk1ldGFWaXNpdG9yfSBmcm9tICcuL2kxOG4vbWV0YSc7XG5pbXBvcnQge0kxOE5fSUNVX01BUFBJTkdfUFJFRklYLCBUUkFOU0xBVElPTl9QUkVGSVgsIGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzLCBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZywgZGVjbGFyZUkxOG5WYXJpYWJsZSwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeCwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIElNUExJQ0lUX1JFRkVSRU5DRSwgTk9OX0JJTkRBQkxFX0FUVFIsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgYXNMaXRlcmFsLCBjaGFpbmVkSW5zdHJ1Y3Rpb24sIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcsIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoLCBpbnZhbGlkLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5jb25zdCBMRUFESU5HX1RSSVZJQV9DSEFSUyA9IFsnICcsICdcXG4nLCAnXFxyJywgJ1xcdCddO1xuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgaGFuZGxlck5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGUgfCBudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckV4cHIgPSAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuYmluZGluZ0xldmVsID09PSAwKSA/XG4gICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgc2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgc2NvcGUsIGltcGxpY2l0UmVjZWl2ZXJFeHByLCBoYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSxcbiAgICAgIGV2ZW50QXN0LmhhbmRsZXJTcGFuKTtcblxuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSk7XG4gIH1cbiAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10cyk7XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UgISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3MgPSBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXTtcbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcblxuICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChldmVudE5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAodGFyZ2V0KSB7XG4gICAgcGFyYW1zLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChmYWxzZSksICAvLyBgdXNlQ2FwdHVyZWAgZmxhZywgZGVmYXVsdHMgdG8gYGZhbHNlYFxuICAgICAgICBvLmltcG9ydEV4cHIoR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KHRhcmdldCkgISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuXG4gIC8qKiBJbmRleCBvZiB0aGUgY3VycmVudGx5LXNlbGVjdGVkIG5vZGUuICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRleDogbnVtYmVyID0gMDtcblxuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbiwgcHJpdmF0ZSBfY29uc3RhbnRzOiBvLkV4cHJlc3Npb25bXSA9IFtdKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ6IG51bWJlciA9IDAsXG4gICAgICBpMThuPzogaTE4bi5JMThuTWV0YSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID1cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dCB8fCAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuICEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHsgdGhpcy5fYmluZGluZ1Njb3BlLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTsgfVxuXG4gIHByaXZhdGUgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMobWVzc2FnZSwgX3JlZiwgY2xvc3VyZVZhciwgcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnM6IEFTVFtdKSB7XG4gICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB0aGlzLmkxOG4gIS5hcHBlbmRCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHQgfCB0LkJvdW5kVGV4dH0pOlxuICAgICAge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0ge1xuICAgIGNvbnN0IGJvdW5kOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHByb3BzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gcHJvcHNba2V5XTtcbiAgICAgIGlmIChwcm9wIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwocHJvcC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3AudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9uc30gPSB2YWx1ZTtcbiAgICAgICAgICBjb25zdCB7aWQsIGJpbmRpbmdzfSA9IHRoaXMuaTE4biAhO1xuICAgICAgICAgIGNvbnN0IGxhYmVsID0gYXNzZW1ibGVJMThuQm91bmRTdHJpbmcoc3RyaW5ncywgYmluZGluZ3Muc2l6ZSwgaWQpO1xuICAgICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zKTtcbiAgICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4blN0YXJ0KHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgbWV0YTogaTE4bi5JMThuTWV0YSwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTpcbiAgICAgIHZvaWQge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgaWYgKHRoaXMuaTE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4biA9IHRoaXMuaTE4bkNvbnRleHQuZm9ya0NoaWxkQ29udGV4dChpbmRleCwgdGhpcy50ZW1wbGF0ZUluZGV4ICEsIG1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCByZWYgPSBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgICB0aGlzLmkxOG4gPSBuZXcgSTE4bkNvbnRleHQoaW5kZXgsIHJlZiwgMCwgdGhpcy50ZW1wbGF0ZUluZGV4LCBtZXRhKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBpMThuU3RhcnQgaW5zdHJ1Y3Rpb25cbiAgICBjb25zdCB7aWQsIHJlZn0gPSB0aGlzLmkxOG47XG4gICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoaW5kZXgpLCByZWZdO1xuICAgIGlmIChpZCA+IDApIHtcbiAgICAgIC8vIGRvIG5vdCBwdXNoIDNyZCBhcmd1bWVudCAoc3ViLWJsb2NrIGlkKVxuICAgICAgLy8gaW50byBpMThuU3RhcnQgY2FsbCBmb3IgdG9wIGxldmVsIGkxOG4gY29udGV4dFxuICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlkKSk7XG4gICAgfVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBzZWxmQ2xvc2luZyA/IFIzLmkxOG4gOiBSMy5pMThuU3RhcnQsIHBhcmFtcyk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgY29uc3QgY2hhaW5CaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICAgIGJpbmRpbmdzLmZvckVhY2goYmluZGluZyA9PiB7XG4gICAgICAgIGNoYWluQmluZGluZ3MucHVzaCh7c291cmNlU3Bhbjogc3BhbiwgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhiaW5kaW5nKX0pO1xuICAgICAgfSk7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW4oUjMuaTE4bkV4cCwgY2hhaW5CaW5kaW5ncyk7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChpbmRleCldKTtcbiAgICB9XG4gICAgaWYgKCFzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5FbmQpO1xuICAgIH1cbiAgICB0aGlzLmkxOG4gPSBudWxsOyAgLy8gcmVzZXQgbG9jYWwgaTE4biBjb250ZXh0XG4gIH1cblxuICBwcml2YXRlIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzXG4gICAqIGBwcm9wPVwie3t2YWx1ZX19XCJgIG9yIGBhdHRyLnRpdGxlPVwie3t2YWx1ZX19XCJgXG4gICAqL1xuICBwcml2YXRlIGludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnRJbmRleDogbnVtYmVyLCBhdHRyTmFtZTogc3RyaW5nLFxuICAgICAgaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIHZhbHVlOiBhbnksIHBhcmFtczogYW55W10pIHtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoXG4gICAgICAgIGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwoYXR0ck5hbWUpLCAuLi50aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSwgLi4ucGFyYW1zXSk7XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcHJvamVjdGlvblNsb3RJZHggPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgKyB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IG5nUHJvamVjdEFzQXR0cjogdC5UZXh0QXR0cmlidXRlfHVuZGVmaW5lZDtcblxuICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaChuZ0NvbnRlbnQuc2VsZWN0b3IpO1xuXG4gICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cmlidXRlO1xuICAgICAgaWYgKG5hbWUgPT09IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FKSB7XG4gICAgICAgIG5nUHJvamVjdEFzQXR0ciA9IGF0dHJpYnV0ZTtcbiAgICAgIH1cbiAgICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSwgby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmdQcm9qZWN0QXNBdHRyKSB7XG4gICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKG5nUHJvamVjdEFzQXR0cikpO1xuICAgIH1cblxuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpLCBvLmxpdGVyYWxBcnIoYXR0cmlidXRlcykpO1xuICAgIH0gZWxzZSBpZiAocHJvamVjdGlvblNsb3RJZHggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRQcm9qZWN0aW9uKG5nQ29udGVudC5pMThuICEsIHNsb3QpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzdHlsaW5nQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgbnVsbCk7XG5cbiAgICBsZXQgaXNOb25CaW5kYWJsZU1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudDogYm9vbGVhbiA9XG4gICAgICAgIGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShlbGVtZW50LmkxOG4pO1xuXG4gICAgY29uc3QgaTE4bkF0dHJzOiAodC5UZXh0QXR0cmlidXRlIHwgdC5Cb3VuZEF0dHJpYnV0ZSlbXSA9IFtdO1xuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGxldCBuZ1Byb2plY3RBc0F0dHI6IHQuVGV4dEF0dHJpYnV0ZXx1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuICAgIGNvbnN0IGlzTmdDb250YWluZXIgPSBjaGVja0lzTmdDb250YWluZXIoZWxlbWVudC5uYW1lKTtcblxuICAgIC8vIEhhbmRsZSBzdHlsaW5nLCBpMThuLCBuZ05vbkJpbmRhYmxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cjtcbiAgICAgIGlmIChuYW1lID09PSBOT05fQklOREFCTEVfQVRUUikge1xuICAgICAgICBpc05vbkJpbmRhYmxlTW9kZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChhdHRyLm5hbWUgPT09IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FKSB7XG4gICAgICAgICAgbmdQcm9qZWN0QXNBdHRyID0gYXR0cjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBpbnRvIGEgc2VwYXJhdGUgYXJyYXkgZm9yIGkxOG4gcHJvY2Vzc2luZywgYnV0IGFsc28ga2VlcCBzdWNoXG4gICAgICAgICAgLy8gYXR0cmlidXRlcyBpbiB0aGUgbWFpbiBsaXN0IHRvIG1ha2UgdGhlbSBhdmFpbGFibGUgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBhdCBydW50aW1lLlxuICAgICAgICAgIC8vIFRPRE8oRlctMTI0OCk6IHByZXZlbnQgYXR0cmlidXRlcyBkdXBsaWNhdGlvbiBpbiBgaTE4bkF0dHJpYnV0ZXNgIGFuZCBgZWxlbWVudFN0YXJ0YFxuICAgICAgICAgIC8vIGFyZ3VtZW50c1xuICAgICAgICAgIGkxOG5BdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dEF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG91dHB1dEF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGF0dHIubmFtZSksIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSk7XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgYXR0cmlidXRlcyBmb3IgZGlyZWN0aXZlIGFuZCBwcm9qZWN0aW9uIG1hdGNoaW5nIHB1cnBvc2VzXG4gICAgYXR0cmlidXRlcy5wdXNoKC4uLnRoaXMucHJlcGFyZU5vblJlbmRlckF0dHJzKFxuICAgICAgICBhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzLCBzdHlsaW5nQnVpbGRlciwgW10sIGkxOG5BdHRycywgbmdQcm9qZWN0QXNBdHRyKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIGNvbnN0IHJlZnMgPSB0aGlzLnByZXBhcmVSZWZzQXJyYXkoZWxlbWVudC5yZWZlcmVuY2VzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRUb0NvbnN0cyhyZWZzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikgPyAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzV2l0aFBpcGVzICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgaTE4bkF0dHJzLmxlbmd0aCA9PT0gMCAmJiAhaGFzQ2hpbGRyZW47XG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyIDogUjMuZWxlbWVudCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcHJvY2VzcyBpMThuIGVsZW1lbnQgYXR0cmlidXRlc1xuICAgICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgY29uc3QgYmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgICAgIGkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhdHRyLmkxOG4gIWFzIGkxOG4uTWVzc2FnZTtcbiAgICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IGF0dHIudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhjb252ZXJ0ZWQpO1xuICAgICAgICAgICAgaWYgKGNvbnZlcnRlZCBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMobWVzc2FnZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycyk7XG4gICAgICAgICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGFyYW1zKSk7XG4gICAgICAgICAgICAgIGNvbnZlcnRlZC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgICAgICAgICAgIGhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBiaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVNwYW46IGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbilcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCkge1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbihSMy5pMThuRXhwLCBiaW5kaW5ncyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkxOG5BdHRyQXJncy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBpbmRleDogby5FeHByZXNzaW9uID0gby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKTtcbiAgICAgICAgICBjb25zdCBhcmdzID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpMThuQXR0ckFyZ3MpLCB0cnVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5pMThuQXR0cmlidXRlcywgW2luZGV4LCBhcmdzXSk7XG4gICAgICAgICAgaWYgKGhhc0JpbmRpbmdzKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkFwcGx5LCBbaW5kZXhdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgaWYgKGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGVsZW1lbnQub3V0cHV0cy5tYXAoXG4gICAgICAgICAgICAob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+ICh7XG4gICAgICAgICAgICAgIHNvdXJjZVNwYW46IG91dHB1dEFzdC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICBwYXJhbXM6IHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKGVsZW1lbnQubmFtZSwgb3V0cHV0QXN0LCBlbGVtZW50SW5kZXgpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlOiBpdCdzIGltcG9ydGFudCB0byBrZWVwIGkxOG4vaTE4blN0YXJ0IGluc3RydWN0aW9ucyBhZnRlciBpMThuQXR0cmlidXRlcyBhbmRcbiAgICAgIC8vIGxpc3RlbmVycywgdG8gbWFrZSBzdXJlIGkxOG5BdHRyaWJ1dGVzIGluc3RydWN0aW9uIHRhcmdldHMgY3VycmVudCBlbGVtZW50IGF0IHJ1bnRpbWUuXG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuU3RhcnQoZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4gISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBzdHlsZVByb3BgLFxuICAgIC8vIGBzdHlsZU1hcGAsIGBjbGFzc01hcGAsIGBjbGFzc1Byb3BgIGFuZCBgc3R5bGluZ0FwcGx5YFxuICAgIC8vIGFyZSBhbGwgZ2VuZXJhdGVkIGFuZCBhc3NpZ25lZCBpbiB0aGUgY29kZSBiZWxvdy5cbiAgICBjb25zdCBzdHlsaW5nSW5zdHJ1Y3Rpb25zID0gc3R5bGluZ0J1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgY29uc3QgbGltaXQgPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zLmxlbmd0aCAtIDE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zW2ldO1xuICAgICAgdGhpcy5fYmluZGluZ1Nsb3RzICs9IHRoaXMucHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihlbGVtZW50SW5kZXgsIGluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyB0aGUgcmVhc29uIHdoeSBgdW5kZWZpbmVkYCBpcyB1c2VkIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHVuZGVyc3RhbmRzIHRoaXMgYXMgYVxuICAgIC8vIHNwZWNpYWwgdmFsdWUgdG8gc3ltYm9saXplIHRoYXQgdGhlcmUgaXMgbm8gUkhTIHRvIHRoaXMgYmluZGluZ1xuICAgIC8vIFRPRE8gKG1hdHNrbyk6IHJldmlzaXQgdGhpcyBvbmNlIEZXLTk1OSBpcyBhcHByb2FjaGVkXG4gICAgY29uc3QgZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvbiA9IG8ubGl0ZXJhbCh1bmRlZmluZWQpO1xuICAgIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgYWxsT3RoZXJJbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IGlucHV0VHlwZSA9IGlucHV0LnR5cGU7XG4gICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIGFuaW1hdGlvbiBiaW5kaW5ncyBjYW4gYmUgcHJlc2VudGVkIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgLy8gMS4gW0BiaW5kaW5nXT1cImZvb0V4cFwiXG4gICAgICAgIC8vIDIuIFtAYmluZGluZ109XCJ7dmFsdWU6Zm9vRXhwLCBwYXJhbXM6ey4uLn19XCJcbiAgICAgICAgLy8gMy4gW0BiaW5kaW5nXVxuICAgICAgICAvLyA0LiBAYmluZGluZ1xuICAgICAgICAvLyBBbGwgZm9ybWF0cyB3aWxsIGJlIHZhbGlkIGZvciB3aGVuIGEgc3ludGhldGljIGJpbmRpbmcgaXMgY3JlYXRlZC5cbiAgICAgICAgLy8gVGhlIHJlYXNvbmluZyBmb3IgdGhpcyBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciBzaG91bGQgZ2V0IGVhY2hcbiAgICAgICAgLy8gc3ludGhldGljIGJpbmRpbmcgdmFsdWUgaW4gdGhlIG9yZGVyIG9mIHRoZSBhcnJheSB0aGF0IHRoZXkgYXJlXG4gICAgICAgIC8vIGRlZmluZWQgaW4uLi5cbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIExpdGVyYWxQcmltaXRpdmUgPyAhIXZhbHVlLnZhbHVlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGlucHV0Lm5hbWUpLFxuICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgdmFsdWU6ICgpID0+IGhhc1ZhbHVlID8gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSA6IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb25cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBtdXN0IHNraXAgYXR0cmlidXRlcyB3aXRoIGFzc29jaWF0ZWQgaTE4biBjb250ZXh0LCBzaW5jZSB0aGVzZSBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkXG4gICAgICAgIC8vIHNlcGFyYXRlbHkgYW5kIGNvcnJlc3BvbmRpbmcgYGkxOG5FeHBgIGFuZCBgaTE4bkFwcGx5YCBpbnN0cnVjdGlvbnMgd2lsbCBiZSBnZW5lcmF0ZWRcbiAgICAgICAgaWYgKGlucHV0LmkxOG4pIHJldHVybjtcblxuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3QgW2F0dHJOYW1lc3BhY2UsIGF0dHJOYW1lXSA9IHNwbGl0TnNOYW1lKGlucHV0Lm5hbWUpO1xuICAgICAgICAgIGNvbnN0IGlzQXR0cmlidXRlQmluZGluZyA9IGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlO1xuICAgICAgICAgIGNvbnN0IHNhbml0aXphdGlvblJlZiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dC5zZWN1cml0eUNvbnRleHQsIGlzQXR0cmlidXRlQmluZGluZyk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcbiAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZXNwYWNlTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyTmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikge1xuICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoZXJlIHdhc24ndCBhIHNhbml0aXphdGlvbiByZWYsIHdlIG5lZWQgdG8gYWRkXG4gICAgICAgICAgICAgIC8vIGFuIGV4dHJhIHBhcmFtIHNvIHRoYXQgd2UgY2FuIHBhc3MgaW4gdGhlIG5hbWVzcGFjZS5cbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKG51bGwpLCBuYW1lc3BhY2VMaXRlcmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICAvLyBwcm9wPVwie3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIlxuICAgICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCB0aGUgcHJvcGVydGllcyBzbyB0aGF0IHdlIGNhbiBjaGFpbiBpbnRvIGEgc2luZ2xlIGZ1bmN0aW9uIGF0IHRoZSBlbmQuXG4gICAgICAgICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXR0ck5hbWUsXG4gICAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSwgcGFyYW1zXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgodmFsdWUpID4gMSkge1xuICAgICAgICAgICAgICAvLyBhdHRyLm5hbWU9XCJ0ZXh0e3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJvdW5kVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9uc1swXSA6IHZhbHVlO1xuICAgICAgICAgICAgICAvLyBbYXR0ci5uYW1lXT1cInZhbHVlXCIgb3IgYXR0ci5uYW1lPVwie3t2YWx1ZX19XCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCB0aGUgYXR0cmlidXRlIGJpbmRpbmdzIHNvIHRoYXQgdGhleSBjYW4gYmUgY2hhaW5lZCBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhdHRyTmFtZSxcbiAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYm91bmRWYWx1ZSksIHBhcmFtc1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xhc3MgcHJvcFxuICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChwcm9wZXJ0eUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgUjMucHJvcGVydHksIHByb3BlcnR5QmluZGluZ3MpO1xuICAgIH1cblxuICAgIGlmIChhdHRyaWJ1dGVCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIFIzLmF0dHJpYnV0ZSwgYXR0cmlidXRlQmluZGluZ3MpO1xuICAgIH1cblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICBjb25zdCBzcGFuID0gZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5FbmQoc3BhbiwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG4gIH1cblxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCBOR19URU1QTEFURV9UQUdfTkFNRSA9ICduZy10ZW1wbGF0ZSc7XG4gICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFRlbXBsYXRlKHRlbXBsYXRlLmkxOG4gISwgdGVtcGxhdGVJbmRleCk7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcih0ZW1wbGF0ZS50YWdOYW1lIHx8ICcnKTtcbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9JHt0YWdOYW1lID8gJ18nICsgdGFnTmFtZSA6ICcnfV8ke3RlbXBsYXRlSW5kZXh9YDtcbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVgO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICBvLnZhcmlhYmxlKHRlbXBsYXRlTmFtZSksXG5cbiAgICAgIC8vIFdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHRhZydzIG5hbWVzcGFjZSBoZXJlLCBiZWNhdXNlIHdlIGluZmVyXG4gICAgICAvLyBpdCBiYXNlZCBvbiB0aGUgcGFyZW50IG5vZGVzIGluc2lkZSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGUudGFnTmFtZSA/IHNwbGl0TnNOYW1lKHRlbXBsYXRlLnRhZ05hbWUpWzFdIDogdGVtcGxhdGUudGFnTmFtZSksXG4gICAgXTtcblxuICAgIC8vIGZpbmQgZGlyZWN0aXZlcyBtYXRjaGluZyBvbiBhIGdpdmVuIDxuZy10ZW1wbGF0ZT4gbm9kZVxuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKE5HX1RFTVBMQVRFX1RBR19OQU1FLCB0ZW1wbGF0ZSk7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICB0ZW1wbGF0ZS5hdHRyaWJ1dGVzLmZvckVhY2goXG4gICAgICAgIChhOiB0LlRleHRBdHRyaWJ1dGUpID0+IHsgYXR0cnNFeHBycy5wdXNoKGFzTGl0ZXJhbChhLm5hbWUpLCBhc0xpdGVyYWwoYS52YWx1ZSkpOyB9KTtcbiAgICBhdHRyc0V4cHJzLnB1c2goLi4udGhpcy5wcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICAgIHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cywgdW5kZWZpbmVkLCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheSh0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmltcG9ydEV4cHIoUjMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGhpcy5pMThuLFxuICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZU5hbWUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlciwgdGhpcy5kaXJlY3RpdmVzLCB0aGlzLnBpcGVUeXBlQnlOYW1lLFxuICAgICAgICB0aGlzLnBpcGVzLCB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgICAgIHRoaXMuX2NvbnN0YW50cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgbmctdGVtcGxhdGUgZWxlbWVudHMuXG4gICAgaWYgKHRlbXBsYXRlLnRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICBpZiAodGVtcGxhdGUub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRlbXBsYXRlLm91dHB1dHMubWFwKFxuICAgICAgICAgICAgKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiAoe1xuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBvdXRwdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgcGFyYW1zOiB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4gISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBub2RlSW5kZXgsIHRleHQuc291cmNlU3BhbiwgZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSxcbiAgICAgICAgICAoKSA9PiB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdUZXh0IG5vZGVzIHNob3VsZCBiZSBpbnRlcnBvbGF0ZWQgYW5kIG5ldmVyIGJvdW5kIGRpcmVjdGx5LicpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuICEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4gITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuXG4gICAgLy8gd2UgYWx3YXlzIG5lZWQgcG9zdC1wcm9jZXNzaW5nIGZ1bmN0aW9uIGZvciBJQ1VzLCB0byBtYWtlIHN1cmUgdGhhdDpcbiAgICAvLyAtIGFsbCBwbGFjZWhvbGRlcnMgaW4gYSBmb3JtIG9mIHtQTEFDRUhPTERFUn0gYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyAobm90ZTpcbiAgICAvLyBgZ29vZy5nZXRNc2dgIGRvZXMgbm90IHByb2Nlc3MgSUNVcyBhbmQgdXNlcyB0aGUgYHtQTEFDRUhPTERFUn1gIGZvcm1hdCBmb3IgcGxhY2Vob2xkZXJzXG4gICAgLy8gaW5zaWRlIElDVXMpXG4gICAgLy8gLSBhbGwgSUNVIHZhcnMgKHN1Y2ggYXMgYFZBUl9TRUxFQ1RgIG9yIGBWQVJfUExVUkFMYCkgYXJlIHJlcGxhY2VkIHdpdGggY29ycmVjdCB2YWx1ZXNcbiAgICBjb25zdCB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHsuLi52YXJzLCAuLi5wbGFjZWhvbGRlcnN9O1xuICAgICAgY29uc3QgZm9ybWF0dGVkID0gaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgW3JhdywgbWFwTGl0ZXJhbChmb3JtYXR0ZWQsIHRydWUpXSk7XG4gICAgfTtcblxuICAgIC8vIGluIGNhc2UgdGhlIHdob2xlIGkxOG4gbWVzc2FnZSBpcyBhIHNpbmdsZSBJQ1UgLSB3ZSBkbyBub3QgbmVlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHNlcGFyYXRlIHRvcC1sZXZlbCB0cmFuc2xhdGlvbiwgd2UgY2FuIHVzZSB0aGUgcm9vdCByZWYgaW5zdGVhZFxuICAgIC8vIGFuZCBtYWtlIHRoaXMgSUNVIGEgdG9wLWxldmVsIHRyYW5zbGF0aW9uXG4gICAgLy8gbm90ZTogSUNVIHBsYWNlaG9sZGVycyBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIGluIGBpMThuUG9zdHByb2Nlc3NgIGZ1bmN0aW9uXG4gICAgLy8gc2VwYXJhdGVseSwgc28gd2UgZG8gbm90IHBhc3MgcGxhY2Vob2xkZXJzIGludG8gYGkxOG5UcmFuc2xhdGVgIGZ1bmN0aW9uLlxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9XG4gICAgICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgLyogcmVmICovIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIGdldENvbnN0cygpIHsgcmV0dXJuIHRoaXMuX2NvbnN0YW50czsgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIHByaXZhdGUgdGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBhdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdKSB7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogaW5wdXQubmFtZSxcbiAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZSh0ZW1wbGF0ZUluZGV4LCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5ncyk7XG4gICAgfVxuICB9XG5cbiAgLy8gQmluZGluZ3MgbXVzdCBvbmx5IGJlIHJlc29sdmVkIGFmdGVyIGFsbCBsb2NhbCByZWZzIGhhdmUgYmVlbiB2aXNpdGVkLCBzbyBhbGxcbiAgLy8gaW5zdHJ1Y3Rpb25zIGFyZSBxdWV1ZWQgaW4gY2FsbGJhY2tzIHRoYXQgZXhlY3V0ZSBvbmNlIHRoZSBpbml0aWFsIHBhc3MgaGFzIGNvbXBsZXRlZC5cbiAgLy8gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndCBiZSBhYmxlIHRvIHN1cHBvcnQgbG9jYWwgcmVmcyB0aGF0IGFyZSBkZWZpbmVkIGFmdGVyIHRoZWlyXG4gIC8vIGJpbmRpbmdzLiBlLmcuIHt7IGZvbyB9fSA8ZGl2ICNmb28+PC9kaXY+XG4gIHByaXZhdGUgaW5zdHJ1Y3Rpb25GbihcbiAgICAgIGZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSwgcHJlcGVuZDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgZm5zW3ByZXBlbmQgPyAndW5zaGlmdCcgOiAncHVzaCddKCgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IEFycmF5LmlzQXJyYXkocGFyYW1zT3JGbikgPyBwYXJhbXNPckZuIDogcGFyYW1zT3JGbigpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGVsZW1lbnRJbmRleDogbnVtYmVyLCBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9ufG51bGwpIHtcbiAgICBsZXQgYWxsb2NhdGVCaW5kaW5nU2xvdHMgPSAwO1xuICAgIGlmIChpbnN0cnVjdGlvbikge1xuICAgICAgY29uc3QgY2FsbHM6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICAgIGluc3RydWN0aW9uLmNhbGxzLmZvckVhY2goY2FsbCA9PiB7XG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzICs9IGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICAgIGNhbGxzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZVNwYW46IGNhbGwuc291cmNlU3BhbixcbiAgICAgICAgICB2YWx1ZTogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxcbiAgICAgICAgICAgICAgICAucGFyYW1zKFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiAoY2FsbC5zdXBwb3J0c0ludGVycG9sYXRpb24gJiYgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpKSBhcyBvLkV4cHJlc3Npb25bXTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBjYWxscyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kPzogYm9vbGVhbikge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl9jcmVhdGlvbkNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSwgcHJlcGVuZCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihyZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGNhbGxzOiB7XG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCxcbiAgICBwYXJhbXM6ICgpID0+IG8uRXhwcmVzc2lvbltdXG4gIH1bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBjYWxscy5sZW5ndGggPyBjYWxsc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcbiAgICB0aGlzLl9jcmVhdGlvbkNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMubWFwKGNhbGwgPT4gY2FsbC5wYXJhbXMoKSksIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3Nhcnkobm9kZUluZGV4LCBzcGFuKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbik7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uQ2hhaW4oXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBiaW5kaW5ncy5sZW5ndGggPyBiaW5kaW5nc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcblxuICAgIHRoaXMuX3VwZGF0ZUNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCBjYWxscyA9IGJpbmRpbmdzLm1hcChwcm9wZXJ0eSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcGVydHkudmFsdWUoKTtcbiAgICAgICAgY29uc3QgZm5QYXJhbXMgPSBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlIDogW3ZhbHVlXTtcbiAgICAgICAgaWYgKHByb3BlcnR5LnBhcmFtcykge1xuICAgICAgICAgIGZuUGFyYW1zLnB1c2goLi4ucHJvcGVydHkucGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydHkubmFtZSkge1xuICAgICAgICAgIC8vIFdlIHdhbnQgdGhlIHByb3BlcnR5IG5hbWUgdG8gYWx3YXlzIGJlIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgICAgICAgZm5QYXJhbXMudW5zaGlmdChvLmxpdGVyYWwocHJvcGVydHkubmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmblBhcmFtcztcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMsIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBiaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10pIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KFxuICAgICAgICBub2RlSW5kZXgsIGJpbmRpbmdzLmxlbmd0aCA/IGJpbmRpbmdzWzBdLnNvdXJjZVNwYW4gOiBudWxsKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW4ocmVmZXJlbmNlLCBiaW5kaW5ncyk7XG4gIH1cblxuICBwcml2YXRlIGFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIGlmIChub2RlSW5kZXggIT09IHRoaXMuX2N1cnJlbnRJbmRleCkge1xuICAgICAgY29uc3QgZGVsdGEgPSBub2RlSW5kZXggLSB0aGlzLl9jdXJyZW50SW5kZXg7XG5cbiAgICAgIGlmIChkZWx0YSA8IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZHZhbmNlIGluc3RydWN0aW9uIGNhbiBvbmx5IGdvIGZvcndhcmRzJyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5hZHZhbmNlLCBbby5saXRlcmFsKGRlbHRhKV0pO1xuICAgICAgdGhpcy5fY3VycmVudEluZGV4ID0gbm9kZUluZGV4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlZmVycyB0byB0aGUgaW1wbGljaXQgcmVjZWl2ZXIuIFRoZSBpbXBsaWNpdFxuICAgKiByZWNlaXZlciBpcyBhbHdheXMgdGhlIHJvb3QgbGV2ZWwgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgaWYgKHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByID0gdGhpcy5sZXZlbCA9PT0gMCA/XG4gICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsXG4gICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcbiAgICByZXR1cm4gdmFsRXhwcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGEgbGlzdCBvZiBhcmd1bWVudCBleHByZXNzaW9ucyB0byBwYXNzIHRvIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBleHByZXNzaW9uLiBBbHNvIHVwZGF0ZXNcbiAgICogdGhlIHRlbXAgdmFyaWFibGVzIHN0YXRlIHdpdGggdGVtcCB2YXJpYWJsZXMgdGhhdCB3ZXJlIGlkZW50aWZpZWQgYXMgbmVlZGluZyB0byBiZSBjcmVhdGVkXG4gICAqIHdoaWxlIHZpc2l0aW5nIHRoZSBhcmd1bWVudHMuXG4gICAqIEBwYXJhbSB2YWx1ZSBUaGUgb3JpZ2luYWwgZXhwcmVzc2lvbiB3ZSB3aWxsIGJlIHJlc29sdmluZyBhbiBhcmd1bWVudHMgbGlzdCBmcm9tLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZTogQVNUKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IHthcmdzLCBzdG10c30gPVxuICAgICAgICBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSk7XG5cbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uc3RtdHMpO1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaERpcmVjdGl2ZXMoZWxlbWVudE5hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKGVsZW1lbnROYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBQUk9KRUNUX0FTLCBzZWxlY3RvcixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBwcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sIHN0eWxlcz86IFN0eWxpbmdCdWlsZGVyLFxuICAgICAgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10sXG4gICAgICBpMThuQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdLFxuICAgICAgbmdQcm9qZWN0QXNBdHRyPzogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgZnVuY3Rpb24gYWRkQXR0ckV4cHIoa2V5OiBzdHJpbmcgfCBudW1iZXIsIHZhbHVlPzogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCFhbHJlYWR5U2Vlbi5oYXMoa2V5KSkge1xuICAgICAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhrZXkpKTtcbiAgICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIGF0dHJFeHBycy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICBhbHJlYWR5U2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGtleSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGl0J3MgaW1wb3J0YW50IHRoYXQgdGhpcyBvY2N1cnMgYmVmb3JlIEJJTkRJTkdTIGFuZCBURU1QTEFURSBiZWNhdXNlIG9uY2UgYGVsZW1lbnRTdGFydGBcbiAgICAvLyBjb21lcyBhY3Jvc3MgdGhlIEJJTkRJTkdTIG9yIFRFTVBMQVRFIG1hcmtlcnMgdGhlbiBpdCB3aWxsIGNvbnRpbnVlIHJlYWRpbmcgZWFjaCB2YWx1ZSBhc1xuICAgIC8vIGFzIHNpbmdsZSBwcm9wZXJ0eSB2YWx1ZSBjZWxsIGJ5IGNlbGwuXG4gICAgaWYgKHN0eWxlcykge1xuICAgICAgc3R5bGVzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyRXhwcnMpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dHMubGVuZ3RoIHx8IG91dHB1dHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBhdHRyc0xlbmd0aEJlZm9yZUlucHV0cyA9IGF0dHJFeHBycy5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzW2ldO1xuICAgICAgICAvLyBXZSBkb24ndCB3YW50IHRoZSBhbmltYXRpb24gYW5kIGF0dHJpYnV0ZSBiaW5kaW5ncyBpbiB0aGVcbiAgICAgICAgLy8gYXR0cmlidXRlcyBhcnJheSBzaW5jZSB0aGV5IGFyZW4ndCB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgICAgIGlmIChpbnB1dC50eXBlICE9PSBCaW5kaW5nVHlwZS5BbmltYXRpb24gJiYgaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQXR0cmlidXRlKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIoaW5wdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IG91dHB1dHNbaV07XG4gICAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKG91dHB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0aGlzIGlzIGEgY2hlYXAgd2F5IG9mIGFkZGluZyB0aGUgbWFya2VyIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpbnB1dC9vdXRwdXRcbiAgICAgIC8vIHZhbHVlcyBoYXZlIGJlZW4gZmlsdGVyZWQgKGJ5IG5vdCBpbmNsdWRpbmcgdGhlIGFuaW1hdGlvbiBvbmVzKSBhbmQgYWRkZWRcbiAgICAgIC8vIHRvIHRoZSBleHByZXNzaW9ucy4gVGhlIG1hcmtlciBpcyBpbXBvcnRhbnQgYmVjYXVzZSBpdCB0ZWxscyB0aGUgcnVudGltZVxuICAgICAgLy8gY29kZSB0aGF0IHRoaXMgaXMgd2hlcmUgYXR0cmlidXRlcyB3aXRob3V0IHZhbHVlcyBzdGFydC4uLlxuICAgICAgaWYgKGF0dHJFeHBycy5sZW5ndGggIT09IGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzKSB7XG4gICAgICAgIGF0dHJFeHBycy5zcGxpY2UoYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMsIDAsIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZW1wbGF0ZUF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSk7XG4gICAgICB0ZW1wbGF0ZUF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICBpZiAobmdQcm9qZWN0QXNBdHRyKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXROZ1Byb2plY3RBc0xpdGVyYWwobmdQcm9qZWN0QXNBdHRyKSk7XG4gICAgfVxuXG4gICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBpMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIGFkZFRvQ29uc3RzKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbEV4cHIge1xuICAgIGlmIChvLmlzTnVsbChleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIC8vIFRyeSB0byByZXVzZSBhIGxpdGVyYWwgdGhhdCdzIGFscmVhZHkgaW4gdGhlIGFycmF5LCBpZiBwb3NzaWJsZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NvbnN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuX2NvbnN0YW50c1tpXS5pc0VxdWl2YWxlbnQoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsKHRoaXMuX2NvbnN0YW50cy5wdXNoKGV4cHJlc3Npb24pIC0gMSk7XG4gIH1cblxuICBwcml2YXRlIGFkZEF0dHJzVG9Db25zdHMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDogby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzQXJyYXkocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiBhc0xpdGVyYWwocmVmc1BhcmFtKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSAhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG4gICAgICByZXR1cm4gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKG91dHB1dEFzdCwgaGFuZGxlck5hbWUsIHNjb3BlKTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBfcGlwZUJpbmRFeHByczogRnVuY3Rpb25DYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4pLFxuICAgICAgICBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID0gaXNWYXJMZW5ndGggP1xuICAgICAgICB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBhcmdzKV0pIDpcbiAgICAgICAgdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHRhcmdldCwgW1xuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBGdW5jdGlvbkNhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhcnJheS5zcGFuLCBhcnJheS5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgICAgIC8vIHZhbHVlcy5cbiAgICAgICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCBtYXAuc291cmNlU3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzdGFydFNsb3QpLCBsaXRlcmFsRmFjdG9yeV07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gbmV4dENvbnRleHQoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBsb2NhbFJlZmAgaXMgdHJ1ZSBpZiB3ZSBhcmUgc3RvcmluZyBhIGxvY2FsIHJlZmVyZW5jZVxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5FeHByZXNzaW9uOyBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrO1xuICBkZWNsYXJlOiBib29sZWFuO1xuICBwcmlvcml0eTogbnVtYmVyO1xuICBsb2NhbFJlZjogYm9vbGVhbjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyBfUk9PVF9TQ09QRTogQmluZGluZ1Njb3BlO1xuXG4gIHN0YXRpYyBnZXQgUk9PVF9TQ09QRSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICghQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFKSB7XG4gICAgICBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KDAsICckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG4gICAgfVxuICAgIHJldHVybiBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEU7XG4gIH1cblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5LFxuICAgICAgICAgICAgbG9jYWxSZWY6IHZhbHVlLmxvY2FsUmVmXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwsIHZhbHVlLmxvY2FsUmVmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9uLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgICBsb2NhbFJlZjogbG9jYWxSZWYgfHwgZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhLmRlY2xhcmUgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIG5lc3RlZFNjb3BlKGxldmVsOiBudW1iZXIpOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpICEubGhzIGFzIG8uUmVhZFZhckV4cHI7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgYXMgby5SZWFkVmFyRXhwciA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgICAgbG9jYWxSZWY6IGZhbHNlXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDAsIGZhbHNlKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKSB7XG4gICAgLy8gV2Ugd2FudCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gbGlzdGVuZXIgZm5zIGlmOlxuICAgIC8vIDEgLSB3ZSBhcmUgYWNjZXNzaW5nIGEgdmFsdWUgaW4gYSBwYXJlbnQgdmlldywgd2hpY2ggcmVxdWlyZXMgd2Fsa2luZyB0aGUgdmlldyB0cmVlIHJhdGhlclxuICAgIC8vIHRoYW4gdXNpbmcgdGhlIGN0eCBhcmcuIEluIHRoaXMgY2FzZSwgdGhlIHJldHJpZXZhbCBhbmQgYmluZGluZyBsZXZlbCB3aWxsIGJlIGRpZmZlcmVudC5cbiAgICAvLyAyIC0gd2UgYXJlIGxvb2tpbmcgdXAgYSBsb2NhbCByZWYsIHdoaWNoIHJlcXVpcmVzIHJlc3RvcmluZyB0aGUgdmlldyB3aGVyZSB0aGUgbG9jYWxcbiAgICAvLyByZWYgaXMgc3RvcmVkXG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgKHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwgfHwgbG9jYWxSZWZMb29rdXApKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUgPSBvLnZhcmlhYmxlKHRoaXMucGFyZW50ICEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJlc3RvcmVWaWV3KCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7IHJldHVybiB0aGlzLnBhcmVudCAmJiB0aGlzLnBhcmVudC5iaW5kaW5nTGV2ZWwgPT09IHRoaXMuYmluZGluZ0xldmVsOyB9XG5cbiAgdmFyaWFibGVEZWNsYXJhdGlvbnMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgbGV0IGN1cnJlbnRDb250ZXh0TGV2ZWwgPSAwO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFwLnZhbHVlcygpKVxuICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgLnJlZHVjZSgoc3RtdHM6IG8uU3RhdGVtZW50W10sIHZhbHVlOiBCaW5kaW5nRGF0YSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgY29uc3QgY3VyclN0bXRzID0gdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICBjdXJyZW50Q29udGV4dExldmVsID0gbGV2ZWxEaWZmO1xuICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsZW1lbnROYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsZW1lbnROYW1lTm9Ocyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IG5hbWVOb05zID0gc3BsaXROc05hbWUobmFtZSlbMV07XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWVOb05zLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBleHByZXNzaW9ucyBvdXQgb2YgYW4gYG5nUHJvamVjdEFzYCBhdHRyaWJ1dGVzXG4gKiB3aGljaCBjYW4gYmUgYWRkZWQgdG8gdGhlIGluc3RydWN0aW9uIHBhcmFtZXRlcnMuXG4gKi9cbmZ1bmN0aW9uIGdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyaWJ1dGU6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihhdHRyaWJ1dGUudmFsdWUpWzBdO1xuICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBhc0xpdGVyYWwocGFyc2VkUjNTZWxlY3RvcildO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHlcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgYXR0cmlidXRlXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGludGVycG9sYXRlZCB0ZXh0LlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBtb2RpZnkgaG93IGEgdGVtcGxhdGUgaXMgcGFyc2VkIGJ5IGBwYXJzZVRlbXBsYXRlKClgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlVGVtcGxhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGNoYXJhY3RlcnMgdGhhdCBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBsZWFkaW5nIHRyaXZpYS5cbiAgICogTGVhZGluZyB0cml2aWEgYXJlIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGltcG9ydGFudCB0byB0aGUgZGV2ZWxvcGVyLCBhbmQgc28gc2hvdWxkIG5vdCBiZVxuICAgKiBpbmNsdWRlZCBpbiBzb3VyY2UtbWFwIHNlZ21lbnRzLiAgQSBjb21tb24gZXhhbXBsZSBpcyB3aGl0ZXNwYWNlLlxuICAgKi9cbiAgbGVhZGluZ1RyaXZpYUNoYXJzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFJlbmRlciBgJGxvY2FsaXplYCBtZXNzYWdlIGlkcyB3aXRoIGFkZGl0aW9uYWwgbGVnYWN5IG1lc3NhZ2UgaWRzLlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBkZWZhdWx0cyB0byBgdHJ1ZWAgYnV0IGluIHRoZSBmdXR1cmUgdGhlIGRlZmF1bCB3aWxsIGJlIGZsaXBwZWQuXG4gICAqXG4gICAqIEZvciBub3cgc2V0IHRoaXMgb3B0aW9uIHRvIGZhbHNlIGlmIHlvdSBoYXZlIG1pZ3JhdGVkIHRoZSB0cmFuc2xhdGlvbiBmaWxlcyB0byB1c2UgdGhlIG5ld1xuICAgKiBgJGxvY2FsaXplYCBtZXNzYWdlIGlkIGZvcm1hdCBhbmQgeW91IGFyZSBub3QgdXNpbmcgY29tcGlsZSB0aW1lIHRyYW5zbGF0aW9uIG1lcmdpbmcuXG4gICAqL1xuICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTpcbiAgICB7ZXJyb3JzPzogUGFyc2VFcnJvcltdLCBub2RlczogdC5Ob2RlW10sIHN0eWxlVXJsczogc3RyaW5nW10sIHN0eWxlczogc3RyaW5nW119IHtcbiAgY29uc3Qge2ludGVycG9sYXRpb25Db25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXMsIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXR9ID0gb3B0aW9ucztcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKFxuICAgICAgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLFxuICAgICAge2xlYWRpbmdUcml2aWFDaGFyczogTEVBRElOR19UUklWSUFfQ0hBUlMsIC4uLm9wdGlvbnMsIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWV9KTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIGxldCByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gcGFyc2VSZXN1bHQucm9vdE5vZGVzO1xuXG4gIC8vIHByb2Nlc3MgaTE4biBtZXRhIGluZm9ybWF0aW9uIChzY2FuIGF0dHJpYnV0ZXMsIGdlbmVyYXRlIGlkcylcbiAgLy8gYmVmb3JlIHdlIHJ1biB3aGl0ZXNwYWNlIHJlbW92YWwgcHJvY2VzcywgYmVjYXVzZSBleGlzdGluZyBpMThuXG4gIC8vIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIGNvbnN0IGkxOG5NZXRhVmlzaXRvciA9IG5ldyBJMThuTWV0YVZpc2l0b3IoXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovICFwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCk7XG4gIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwoaTE4bk1ldGFWaXNpdG9yLCByb290Tm9kZXMpO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3aGl0ZXNwYWNlcyBhcmUgcmVtb3ZlZCAoYmVjYXVzZSB0aGF0IG1pZ2h0IGFmZmVjdFxuICAgIC8vIGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudCkgYW5kIGZpcnN0IHBhc3MgaW5kaWNhdGVkIHRoYXQgaTE4biBjb250ZW50IGlzIHByZXNlbnQgaW4gYVxuICAgIC8vIHRlbXBsYXRlLiBEdXJpbmcgdGhpcyBwYXNzIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuXG4gICAgLy8gbWltaWMgZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzfSA9IGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgcmV0dXJuIHtub2Rlcywgc3R5bGVVcmxzLCBzdHlsZXN9O1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuXG5pbnRlcmZhY2UgQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uIHtcbiAgbmFtZT86IHN0cmluZztcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHZhbHVlOiAoKSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXTtcbiAgcGFyYW1zPzogYW55W107XG59XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb24gKGUuZy5cbiAqIHBvc3QtcHJvY2Vzc2luZykuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lZCBhIGdpdmVuIHRyYW5zbGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpLFxuICAgICAgICBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGNsb3N1cmVWYXIsXG4gICAgICAgICAgICBpMThuRm9ybWF0UGxhY2Vob2xkZXJOYW1lcyhwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyB0cnVlKSksXG4gICAgICAgIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICAgICAgICAgIHZhcmlhYmxlLCBtZXNzYWdlLCBpMThuRm9ybWF0UGxhY2Vob2xkZXJOYW1lcyhwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG4iXX0=