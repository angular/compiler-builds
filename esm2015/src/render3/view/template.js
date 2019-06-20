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
import { I18nMetaVisitor } from './i18n/meta';
import { getSerializedI18nContent } from './i18n/serializer';
import { I18N_ICU_MAPPING_PREFIX, TRANSLATION_PREFIX, assembleBoundTextPlaceholders, assembleI18nBoundString, formatI18nPlaceholderName, getTranslationConstPrefix, getTranslationDeclStmts, icuFromI18nMessage, isI18nRootNode, isSingleI18nIcu, metaFromI18nMessage, placeholdersToParams, wrapI18nPlaceholder } from './i18n/util';
import { StylingBuilder } from './styling_builder';
import { CONTEXT_NAME, IMPLICIT_REFERENCE, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, getAttrsForDirectiveMatching, invalid, trimTrailingNulls, unsupported } from './util';
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
    constructor(constantPool, parentBindingScope, level = 0, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds) {
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
        this.relativeContextFilePath = relativeContextFilePath;
        this.i18nUseExternalIds = i18nUseExternalIds;
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
        /**
         * Memorizes the last node index for which a select instruction has been generated.
         * We're initializing this to -1 to ensure the `select(0)` instruction is generated before any
         * relevant update instructions.
         */
        this._lastNodeIndexWithFlush = -1;
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
        const _params = {};
        if (params && Object.keys(params).length) {
            Object.keys(params).forEach(key => _params[formatI18nPlaceholderName(key)] = params[key]);
        }
        const meta = metaFromI18nMessage(message);
        const content = getSerializedI18nContent(message);
        const statements = getTranslationDeclStmts(_ref, closureVar, content, meta, _params, transformFn);
        this.constantPool.statements.push(...statements);
        return _ref;
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
            bindings.forEach(binding => {
                this.updateInstruction(index, span, R3.i18nExp, () => [this.convertPropertyBinding(binding, /* skipBindFn */ true)]);
            });
            this.updateInstruction(index, span, R3.i18nApply, [o.literal(index)]);
        }
        if (!selfClosing) {
            this.creationInstruction(span, R3.i18nEnd);
        }
        this.i18n = null; // reset local i18n context
    }
    visitContent(ngContent) {
        const slot = this.allocateDataSlot();
        const projectionSlotIdx = this._ngContentSelectorsOffset + this._ngContentReservedSlots.length;
        const parameters = [o.literal(slot)];
        const attributes = [];
        this._ngContentReservedSlots.push(ngContent.selector);
        ngContent.attributes.forEach((attribute) => {
            const { name, value } = attribute;
            if (name === NG_PROJECT_AS_ATTR_NAME) {
                attributes.push(...getNgProjectAsLiteral(attribute));
            }
            else if (name.toLowerCase() !== NG_CONTENT_SELECT_ATTR) {
                attributes.push(o.literal(name), o.literal(value));
            }
        });
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
    visitElement(element) {
        const elementIndex = this.allocateDataSlot();
        const stylingBuilder = new StylingBuilder(o.literal(elementIndex), null);
        let isNonBindableMode = false;
        const isI18nRootElement = isI18nRootNode(element.i18n) && !isSingleI18nIcu(element.i18n);
        if (isI18nRootElement && this.i18n) {
            throw new Error(`Could not mark an element as translatable inside of a translatable section`);
        }
        const i18nAttrs = [];
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
            if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                attributes.push(...getNgProjectAsLiteral(attr));
            }
            else {
                attributes.push(...getAttributeNameLiterals(attr.name), o.literal(attr.value));
            }
        });
        // add attributes for directive and projection matching purposes
        attributes.push(...this.prepareNonRenderAttrs(allOtherInputs, element.outputs, stylingBuilder, [], i18nAttrs));
        parameters.push(this.toAttrsParam(attributes));
        // local refs (ex.: <div #foo #bar="baz">)
        parameters.push(this.prepareRefsParameter(element.references));
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
        const hasChildren = () => {
            if (!isI18nRootElement && this.i18n) {
                // we do not append text node instructions and ICUs inside i18n section,
                // so we exclude them while calculating whether current element has children
                return !hasTextChildrenOnly(element.children);
            }
            return element.children.length > 0;
        };
        const createSelfClosingInstruction = !stylingBuilder.hasBindings && !isNgContainer &&
            element.outputs.length === 0 && i18nAttrs.length === 0 && !hasChildren();
        const createSelfClosingI18nInstruction = !createSelfClosingInstruction &&
            !stylingBuilder.hasBindings && hasTextChildrenOnly(element.children);
        if (createSelfClosingInstruction) {
            this.creationInstruction(element.sourceSpan, R3.element, trimTrailingNulls(parameters));
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
                                this.updateInstruction(elementIndex, element.sourceSpan, R3.i18nExp, () => [this.convertExpressionBinding(expression, /* skipBindFn */ true)]);
                            });
                        }
                    }
                });
                if (i18nAttrArgs.length) {
                    const index = o.literal(this.allocateDataSlot());
                    const args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs), true);
                    this.creationInstruction(element.sourceSpan, R3.i18nAttributes, [index, args]);
                    if (hasBindings) {
                        this.updateInstruction(elementIndex, element.sourceSpan, R3.i18nApply, [index]);
                    }
                }
            }
            // The style bindings code is placed into two distinct blocks within the template function AOT
            // code: creation and update. The creation code contains the `styling` instructions
            // which will apply the collected binding values to the element. `styling` is
            // designed to run inside of `elementStart` and `elementEnd`. The update instructions
            // (things like `styleProp`, `classProp`, etc..) are applied later on in this
            // file
            this.processStylingInstruction(elementIndex, stylingBuilder.buildStylingInstruction(element.sourceSpan, this.constantPool), true);
            // Generate Listeners (outputs)
            element.outputs.forEach((outputAst) => {
                this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter(element.name, outputAst, elementIndex));
            });
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
            this._bindingSlots += instruction.allocateBindingSlots;
            this.processStylingInstruction(elementIndex, instruction, false);
        }
        // the reason why `undefined` is used is because the renderer understands this as a
        // special value to symbolize that there is no RHS to this binding
        // TODO (matsko): revisit this once FW-959 is approached
        const emptyValueBindInstruction = o.literal(undefined);
        const propertyBindings = [];
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
                    input,
                    value: () => hasValue ? this.convertPropertyBinding(value, /* skipBindFn */ true) :
                        emptyValueBindInstruction
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
                                input,
                                value: () => this.convertPropertyBinding(value, true), params
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
                            this.boundUpdateInstruction(R3.attribute, elementIndex, attrName, input, boundValue, params);
                        }
                    }
                    else {
                        // class prop
                        this.updateInstruction(elementIndex, input.sourceSpan, R3.classProp, () => {
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
            this.propertyInstructionChain(elementIndex, propertyBindings);
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
    /**
     * Adds an update instruction for a bound property or attribute, such as `[prop]="value"` or
     * `[attr.title]="value"`
     */
    boundUpdateInstruction(instruction, elementIndex, attrName, input, value, params) {
        this.updateInstruction(elementIndex, input.sourceSpan, instruction, () => {
            return [
                o.literal(attrName), this.convertPropertyBinding(value, /* skipBindFn */ true), ...params
            ];
        });
    }
    /**
     * Adds an update instruction for an interpolated property or attribute, such as
     * `prop="{{value}}"` or `attr.title="{{value}}"`
     */
    interpolatedUpdateInstruction(instruction, elementIndex, attrName, input, value, params) {
        this.updateInstruction(elementIndex, input.sourceSpan, instruction, () => [o.literal(attrName), ...this.getUpdateInstructionArguments(value), ...params]);
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
        parameters.push(this.toAttrsParam(attrsExprs));
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            parameters.push(this.prepareRefsParameter(template.references));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // Create the template function
        const templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, templateIndex, templateName, this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds);
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
            template.outputs.forEach((outputAst) => {
                this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter('ng_template', outputAst, templateIndex));
            });
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
            this.updateInstruction(nodeIndex, text.sourceSpan, getTextInterpolationExpression(value), () => this.getUpdateInstructionArguments(value));
        }
        else {
            this.updateInstruction(nodeIndex, text.sourceSpan, R3.textBinding, () => [this.convertPropertyBinding(value)]);
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
        const transformFn = (raw) => instruction(null, R3.i18nPostprocess, [raw, mapLiteral(vars, true)]);
        // in case the whole i18n message is a single ICU - we do not need to
        // create a separate top-level translation, we can use the root ref instead
        // and make this ICU a top-level translation
        if (isSingleI18nIcu(i18n.meta)) {
            this.i18nTranslate(message, placeholders, i18n.ref, transformFn);
        }
        else {
            // output ICU directly and keep ICU reference in context
            const ref = this.i18nTranslate(message, placeholders, undefined, transformFn);
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
                        input,
                        value: () => this.convertPropertyBinding(value, /* skipBindFn */ true)
                    });
                }
            }
        });
        if (propertyBindings.length > 0) {
            this.propertyInstructionChain(templateIndex, propertyBindings);
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
    processStylingInstruction(elementIndex, instruction, createMode) {
        if (instruction) {
            const paramsFn = () => instruction.buildParams(value => this.convertPropertyBinding(value, /* skipBindFn */ true));
            if (createMode) {
                this.creationInstruction(instruction.sourceSpan, instruction.reference, paramsFn);
            }
            else {
                this.updateInstruction(elementIndex, instruction.sourceSpan, instruction.reference, paramsFn);
            }
        }
    }
    creationInstruction(span, reference, paramsOrFn, prepend) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
    }
    updateInstruction(nodeIndex, span, reference, paramsOrFn) {
        this.addSelectInstructionIfNecessary(nodeIndex, span);
        this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
    }
    updateInstructionChain(nodeIndex, span, reference, callsOrFn) {
        this.addSelectInstructionIfNecessary(nodeIndex, span);
        this._updateCodeFns.push(() => {
            const calls = typeof callsOrFn === 'function' ? callsOrFn() : callsOrFn;
            return chainedInstruction(span, reference, calls || []).toStmt();
        });
    }
    propertyInstructionChain(nodeIndex, propertyBindings) {
        this.updateInstructionChain(nodeIndex, propertyBindings.length ? propertyBindings[0].input.sourceSpan : null, R3.property, () => {
            return propertyBindings.map(property => [o.literal(property.name), property.value(), ...(property.params || [])]);
        });
    }
    addSelectInstructionIfNecessary(nodeIndex, span) {
        if (this._lastNodeIndexWithFlush < nodeIndex) {
            if (nodeIndex > 0) {
                this.instructionFn(this._updateCodeFns, span, R3.select, [o.literal(nodeIndex)]);
            }
            this._lastNodeIndexWithFlush = nodeIndex;
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
    convertExpressionBinding(value, skipBindFn) {
        const convertedPropertyBinding = convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), BindingForm.TrySimple);
        const valExpr = convertedPropertyBinding.currValExpr;
        return skipBindFn ? valExpr : o.importExpr(R3.bind).callFn([valExpr]);
    }
    convertPropertyBinding(value, skipBindFn) {
        const interpolationFn = value instanceof Interpolation ? interpolate : () => error('Unexpected interpolation');
        const convertedPropertyBinding = convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), BindingForm.TrySimple, interpolationFn);
        const valExpr = convertedPropertyBinding.currValExpr;
        this._tempVariables.push(...convertedPropertyBinding.stmts);
        return value instanceof Interpolation || skipBindFn ? valExpr :
            o.importExpr(R3.bind).callFn([valExpr]);
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
    matchDirectives(tagName, elOrTpl) {
        if (this.directiveMatcher) {
            const selector = createCssSelector(tagName, getAttrsForDirectiveMatching(elOrTpl));
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
     *   I18N, name7, name8, ...]
     * ```
     *
     * Note that this function will fully ignore all synthetic (@foo) attribute values
     * because those values are intended to always be generated as property instructions.
     */
    prepareNonRenderAttrs(inputs, outputs, styles, templateAttrs = [], i18nAttrs = []) {
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
            const attrsStartIndex = attrExprs.length;
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                if (input.type !== 4 /* Animation */) {
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
            if (attrExprs.length) {
                attrExprs.splice(attrsStartIndex, 0, o.literal(3 /* Bindings */));
            }
        }
        if (templateAttrs.length) {
            attrExprs.push(o.literal(4 /* Template */));
            templateAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        if (i18nAttrs.length) {
            attrExprs.push(o.literal(6 /* I18n */));
            i18nAttrs.forEach(attr => addAttrExpr(attr.name));
        }
        return attrExprs;
    }
    toAttrsParam(attrsExprs) {
        return attrsExprs.length > 0 ?
            this.constantPool.getConstLiteral(o.literalArr(attrsExprs), true) :
            o.TYPED_NULL_EXPR;
    }
    prepareRefsParameter(references) {
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
        return this.constantPool.getConstLiteral(asLiteral(refsParam), true);
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
        const target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        const { identifier, isVarLength } = pipeBindingCallInfo(pipe.args);
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
        const args = [pipe.exp, ...pipe.args];
        const convertedArgs = isVarLength ? this.visitAll([new LiteralArray(pipe.span, args)]) : this.visitAll(args);
        const pipeBindExpr = new FunctionCall(pipe.span, target, [
            new LiteralPrimitive(pipe.span, slot),
            new LiteralPrimitive(pipe.span, pureFunctionSlot),
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
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), values => {
            // If the literal has calculated (non-literal) elements transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const literal = o.literalArr(values);
            return values.every(a => a.isConstant()) ?
                this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.constantPool, literal, this.allocatePureFunctionSlots);
        });
    }
    visitLiteralMap(map, context) {
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), values => {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const literal = o.literalMap(values.map((value, index) => ({ key: map.keys[index].key, value, quoted: map.keys[index].quoted })));
            return values.every(a => a.isConstant()) ?
                this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.constantPool, literal, this.allocatePureFunctionSlots);
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
function chainedInstruction(span, reference, calls) {
    let expression = o.importExpr(reference, null, span);
    if (calls.length > 0) {
        for (let i = 0; i < calls.length; i++) {
            expression = expression.callFn(calls[i], span);
        }
    }
    else {
        // Add a blank invocation, in case the `calls` array is empty.
        expression = expression.callFn([], span);
    }
    return expression;
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
    literalFactoryArguments.length > 0 || error(`Expected arguments to a literal factory function`);
    const { identifier, isVarLength } = pureFunctionCallInfo(literalFactoryArguments);
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    const args = [
        o.literal(startSlot),
        literalFactory,
    ];
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
        return this.map.get(bindingKey).lhs;
    }
    getSharedContextName(retrievalLevel) {
        const sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + retrievalLevel);
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
function createCssSelector(tag, attributes) {
    const cssSelector = new CssSelector();
    cssSelector.setElement(tag);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const value = attributes[name];
        cssSelector.addAttribute(name, value);
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
 * Gets the number of arguments expected to be passed to a generated instruction in the case of
 * interpolation instructions.
 * @param interpolation An interpolation ast
 */
function getInterpolationArgsLength(interpolation) {
    const { expressions, strings } = interpolation;
    if (expressions.length === 1 && strings.length === 2 && strings[0] === '' && strings[1] === '') {
        // If the interpolation has one interpolated value, but the prefix and suffix are both empty
        // strings, we only pass one argument, to a special instruction like `propertyInterpolate` or
        // `textInterpolate`.
        return 1;
    }
    else {
        return expressions.length + strings.length;
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
    const { interpolationConfig, preserveWhitespaces } = options;
    const bindingParser = makeBindingParser(interpolationConfig);
    const htmlParser = new HtmlParser();
    const parseResult = htmlParser.parse(template, templateUrl, Object.assign({}, options, { tokenizeExpansionForms: true, leadingTriviaChars: LEADING_TRIVIA_CHARS }));
    if (parseResult.errors && parseResult.errors.length > 0) {
        return { errors: parseResult.errors, nodes: [], styleUrls: [], styles: [] };
    }
    let rootNodes = parseResult.rootNodes;
    // process i18n meta information (scan attributes, generate ids)
    // before we run whitespace removal process, because existing i18n
    // extraction process (ng xi18n) relies on a raw content to generate
    // message ids
    rootNodes =
        html.visitAll(new I18nMetaVisitor(interpolationConfig, !preserveWhitespaces), rootNodes);
    if (!preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
        // run i18n meta visitor again in case we remove whitespaces, because
        // that might affect generated i18n message content. During this pass
        // i18n IDs generated at the first pass will be preserved, so we can mimic
        // existing extraction process (ng xi18n)
        rootNodes = html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRS9LLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQW1CLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ25PLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHNDQUFzQyxDQUFDO0FBRXZHLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1B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Q0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZO1lBQ3BDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUM5QztZQUNFLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7QUFDSCxDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxRQUFrQjtJQUNqRCxPQUFPLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ25FLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxJQUFZO0lBQzlCLE9BQU8sSUFBSSxZQUFZLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxTQUFTLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDeEYsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsUUFBa0I7SUFDN0MsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZmxhdHRlbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIExvY2FsUmVzb2x2ZXIsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nLCBjb252ZXJ0VXBkYXRlQXJndW1lbnRzfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFBhcnNlZEV2ZW50VHlwZSwgUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMZXhlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7V2hpdGVzcGFjZVZpc2l0b3J9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7TGV4ZXJSYW5nZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2xleGVyJztcbmltcG9ydCB7aXNOZ0NvbnRhaW5lciBhcyBjaGVja0lzTmdDb250YWluZXIsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge21hcExpdGVyYWx9IGZyb20gJy4uLy4uL291dHB1dC9tYXBfdXRpbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7STE4bkNvbnRleHR9IGZyb20gJy4vaTE4bi9jb250ZXh0JztcbmltcG9ydCB7STE4bk1ldGFWaXNpdG9yfSBmcm9tICcuL2kxOG4vbWV0YSc7XG5pbXBvcnQge2dldFNlcmlhbGl6ZWRJMThuQ29udGVudH0gZnJvbSAnLi9pMThuL3NlcmlhbGl6ZXInO1xuaW1wb3J0IHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCwgVFJBTlNMQVRJT05fUFJFRklYLCBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgYXNzZW1ibGVJMThuQm91bmRTdHJpbmcsIGZvcm1hdEkxOG5QbGFjZWhvbGRlck5hbWUsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgsIGdldFRyYW5zbGF0aW9uRGVjbFN0bXRzLCBpY3VGcm9tSTE4bk1lc3NhZ2UsIGlzSTE4blJvb3ROb2RlLCBpc1NpbmdsZUkxOG5JY3UsIG1ldGFGcm9tSTE4bk1lc3NhZ2UsIHBsYWNlaG9sZGVyc1RvUGFyYW1zLCB3cmFwSTE4blBsYWNlaG9sZGVyfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5pbXBvcnQge0luc3RydWN0aW9uLCBTdHlsaW5nQnVpbGRlcn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIElNUExJQ0lUX1JFRkVSRU5DRSwgTk9OX0JJTkRBQkxFX0FUVFIsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgYXNMaXRlcmFsLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nLCBpbnZhbGlkLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cblxuLy8gU2VsZWN0b3IgYXR0cmlidXRlIG5hbWUgb2YgYDxuZy1jb250ZW50PmBcbmNvbnN0IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIgPSAnc2VsZWN0JztcblxuLy8gQXR0cmlidXRlIG5hbWUgb2YgYG5nUHJvamVjdEFzYC5cbmNvbnN0IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FID0gJ25nUHJvamVjdEFzJztcblxuLy8gTGlzdCBvZiBzdXBwb3J0ZWQgZ2xvYmFsIHRhcmdldHMgZm9yIGV2ZW50IGxpc3RlbmVyc1xuY29uc3QgR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMgPSBuZXcgTWFwPHN0cmluZywgby5FeHRlcm5hbFJlZmVyZW5jZT4oXG4gICAgW1snd2luZG93JywgUjMucmVzb2x2ZVdpbmRvd10sIFsnZG9jdW1lbnQnLCBSMy5yZXNvbHZlRG9jdW1lbnRdLCBbJ2JvZHknLCBSMy5yZXNvbHZlQm9keV1dKTtcblxuY29uc3QgTEVBRElOR19UUklWSUFfQ0hBUlMgPSBbJyAnLCAnXFxuJywgJ1xccicsICdcXHQnXTtcblxuLy8gIGlmIChyZiAmIGZsYWdzKSB7IC4uIH1cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgZmxhZ3M6IGNvcmUuUmVuZGVyRmxhZ3MsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLklmU3RtdCB7XG4gIHJldHVybiBvLmlmU3RtdChvLnZhcmlhYmxlKFJFTkRFUl9GTEFHUykuYml0d2lzZUFuZChvLmxpdGVyYWwoZmxhZ3MpLCBudWxsLCBmYWxzZSksIHN0YXRlbWVudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKFxuICAgIGV2ZW50QXN0OiB0LkJvdW5kRXZlbnQsIGhhbmRsZXJOYW1lOiBzdHJpbmcgfCBudWxsID0gbnVsbCxcbiAgICBzY29wZTogQmluZGluZ1Njb3BlIHwgbnVsbCA9IG51bGwpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHt0eXBlLCBuYW1lLCB0YXJnZXQsIHBoYXNlLCBoYW5kbGVyfSA9IGV2ZW50QXN0O1xuICBpZiAodGFyZ2V0ICYmICFHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5oYXModGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBnbG9iYWwgdGFyZ2V0ICcke3RhcmdldH0nIGRlZmluZWQgZm9yICcke25hbWV9JyBldmVudC5cbiAgICAgICAgU3VwcG9ydGVkIGxpc3Qgb2YgZ2xvYmFsIHRhcmdldHM6ICR7QXJyYXkuZnJvbShHTE9CQUxfVEFSR0VUX1JFU09MVkVSUy5rZXlzKCkpfS5gKTtcbiAgfVxuXG4gIGNvbnN0IGltcGxpY2l0UmVjZWl2ZXJFeHByID0gKHNjb3BlID09PSBudWxsIHx8IHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gMCkgP1xuICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgIHNjb3BlLmdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgIHNjb3BlLCBpbXBsaWNpdFJlY2VpdmVyRXhwciwgaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyksXG4gICAgICBldmVudEFzdC5oYW5kbGVyU3Bhbik7XG5cbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBpZiAoc2NvcGUpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSk7XG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnNjb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkpO1xuICB9XG4gIHN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5yZW5kZXIzU3RtdHMpO1xuXG4gIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID1cbiAgICAgIHR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWUsIHBoYXNlICEpIDogbmFtZTtcbiAgY29uc3QgZm5OYW1lID0gaGFuZGxlck5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGhhbmRsZXJOYW1lKTtcbiAgY29uc3QgZm5BcmdzID0gW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV07XG4gIGNvbnN0IGhhbmRsZXJGbiA9IG8uZm4oZm5BcmdzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZuTmFtZSk7XG5cbiAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZXZlbnROYW1lKSwgaGFuZGxlckZuXTtcbiAgaWYgKHRhcmdldCkge1xuICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoZmFsc2UpLCAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICAgICAgby5pbXBvcnRFeHByKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmdldCh0YXJnZXQpICEpKTtcbiAgfVxuICByZXR1cm4gcGFyYW1zO1xufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuIFRoaXMgZW5zdXJlc1xuICAgKiBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIE1lbW9yaXplcyB0aGUgbGFzdCBub2RlIGluZGV4IGZvciB3aGljaCBhIHNlbGVjdCBpbnN0cnVjdGlvbiBoYXMgYmVlbiBnZW5lcmF0ZWQuXG4gICAqIFdlJ3JlIGluaXRpYWxpemluZyB0aGlzIHRvIC0xIHRvIGVuc3VyZSB0aGUgYHNlbGVjdCgwKWAgaW5zdHJ1Y3Rpb24gaXMgZ2VuZXJhdGVkIGJlZm9yZSBhbnlcbiAgICogcmVsZXZhbnQgdXBkYXRlIGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgX2xhc3ROb2RlSW5kZXhXaXRoRmx1c2g6IG51bWJlciA9IC0xO1xuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHByaXZhdGUgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyxcbiAgICAgIHByaXZhdGUgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHZhcmlhYmxlOiB0LlZhcmlhYmxlKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZS5uYW1lICsgc2NvcGVkTmFtZSk7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHZhcmlhYmxlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIG5nQ29udGVudFNlbGVjdG9yc09mZnNldDogbnVtYmVyID0gMCxcbiAgICAgIGkxOG4/OiBpMThuLkFTVCk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID1cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dCB8fCAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuICEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHsgdGhpcy5fYmluZGluZ1Njb3BlLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTsgfVxuXG4gIGkxOG5UcmFuc2xhdGUoXG4gICAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sIHJlZj86IG8uUmVhZFZhckV4cHIsXG4gICAgICB0cmFuc2Zvcm1Gbj86IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IG8uRXhwcmVzc2lvbik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IF9yZWYgPSByZWYgfHwgby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1BSRUZJWCkpO1xuICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXIgY29uc3QgdG9cbiAgICAvLyBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgIGNvbnN0IGNsb3N1cmVWYXIgPSB0aGlzLmkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZS5pZCk7XG4gICAgY29uc3QgX3BhcmFtczoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBpZiAocGFyYW1zICYmIE9iamVjdC5rZXlzKHBhcmFtcykubGVuZ3RoKSB7XG4gICAgICBPYmplY3Qua2V5cyhwYXJhbXMpLmZvckVhY2goa2V5ID0+IF9wYXJhbXNbZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShrZXkpXSA9IHBhcmFtc1trZXldKTtcbiAgICB9XG4gICAgY29uc3QgbWV0YSA9IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgY29uc3QgY29udGVudCA9IGdldFNlcmlhbGl6ZWRJMThuQ29udGVudChtZXNzYWdlKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID1cbiAgICAgICAgZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoX3JlZiwgY2xvc3VyZVZhciwgY29udGVudCwgbWV0YSwgX3BhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgIHRoaXMuY29uc3RhbnRQb29sLnN0YXRlbWVudHMucHVzaCguLi5zdGF0ZW1lbnRzKTtcbiAgICByZXR1cm4gX3JlZjtcbiAgfVxuXG4gIGkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9uczogQVNUW10pIHtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHRoaXMuaTE4biAhLmFwcGVuZEJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgIH1cbiAgfVxuXG4gIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHQgfCB0LkJvdW5kVGV4dH0pOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSB7XG4gICAgY29uc3QgYm91bmQ6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgT2JqZWN0LmtleXMocHJvcHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSBwcm9wc1trZXldO1xuICAgICAgaWYgKHByb3AgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChwcm9wLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgY29uc3Qge3N0cmluZ3MsIGV4cHJlc3Npb25zfSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnN0IHtpZCwgYmluZGluZ3N9ID0gdGhpcy5pMThuICE7XG4gICAgICAgICAgY29uc3QgbGFiZWwgPSBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZyhzdHJpbmdzLCBiaW5kaW5ncy5zaXplLCBpZCk7XG4gICAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnMpO1xuICAgICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwobGFiZWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9XG5cbiAgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgaTE4blVwZGF0ZVJlZihjb250ZXh0OiBJMThuQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IHtpY3VzLCBtZXRhLCBpc1Jvb3QsIGlzUmVzb2x2ZWQsIGlzRW1pdHRlZH0gPSBjb250ZXh0O1xuICAgIGlmIChpc1Jvb3QgJiYgaXNSZXNvbHZlZCAmJiAhaXNFbWl0dGVkICYmICFpc1NpbmdsZUkxOG5JY3UobWV0YSkpIHtcbiAgICAgIGNvbnRleHQuaXNFbWl0dGVkID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGNvbnRleHQuZ2V0U2VyaWFsaXplZFBsYWNlaG9sZGVycygpO1xuICAgICAgbGV0IGljdU1hcHBpbmc6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgICAgbGV0IHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID1cbiAgICAgICAgICBwbGFjZWhvbGRlcnMuc2l6ZSA/IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycykgOiB7fTtcbiAgICAgIGlmIChpY3VzLnNpemUpIHtcbiAgICAgICAgaWN1cy5mb3JFYWNoKChyZWZzOiBvLkV4cHJlc3Npb25bXSwga2V5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgb25lIElDVSBkZWZpbmVkIGZvciBhIGdpdmVuXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciAtIGp1c3Qgb3V0cHV0IGl0cyByZWZlcmVuY2VcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gcmVmc1swXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gLi4uIG90aGVyd2lzZSB3ZSBuZWVkIHRvIGFjdGl2YXRlIHBvc3QtcHJvY2Vzc2luZ1xuICAgICAgICAgICAgLy8gdG8gcmVwbGFjZSBJQ1UgcGxhY2Vob2xkZXJzIHdpdGggcHJvcGVyIHZhbHVlc1xuICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZyA9IHdyYXBJMThuUGxhY2Vob2xkZXIoYCR7STE4Tl9JQ1VfTUFQUElOR19QUkVGSVh9JHtrZXl9YCk7XG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IG8ubGl0ZXJhbChwbGFjZWhvbGRlcik7XG4gICAgICAgICAgICBpY3VNYXBwaW5nW2tleV0gPSBvLmxpdGVyYWxBcnIocmVmcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJhbnNsYXRpb24gcmVxdWlyZXMgcG9zdCBwcm9jZXNzaW5nIGluIDIgY2FzZXM6XG4gICAgICAvLyAtIGlmIHdlIGhhdmUgcGxhY2Vob2xkZXJzIHdpdGggbXVsdGlwbGUgdmFsdWVzIChleC4gYFNUQVJUX0RJVmA6IFvvv70jMe+/vSwg77+9IzLvv70sIC4uLl0pXG4gICAgICAvLyAtIGlmIHdlIGhhdmUgbXVsdGlwbGUgSUNVcyB0aGF0IHJlZmVyIHRvIHRoZSBzYW1lIHBsYWNlaG9sZGVyIG5hbWVcbiAgICAgIGNvbnN0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPVxuICAgICAgICAgIEFycmF5LmZyb20ocGxhY2Vob2xkZXJzLnZhbHVlcygpKS5zb21lKCh2YWx1ZTogc3RyaW5nW10pID0+IHZhbHVlLmxlbmd0aCA+IDEpIHx8XG4gICAgICAgICAgT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoO1xuXG4gICAgICBsZXQgdHJhbnNmb3JtRm47XG4gICAgICBpZiAobmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgICAgICB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtyYXddO1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFyZ3MucHVzaChtYXBMaXRlcmFsKGljdU1hcHBpbmcsIHRydWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWV0YSBhcyBpMThuLk1lc3NhZ2UsIHBhcmFtcywgY29udGV4dC5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9XG4gIH1cblxuICBpMThuU3RhcnQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBtZXRhOiBpMThuLkFTVCwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuID0gdGhpcy5pMThuQ29udGV4dC5mb3JrQ2hpbGRDb250ZXh0KGluZGV4LCB0aGlzLnRlbXBsYXRlSW5kZXggISwgbWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlZiA9IG8udmFyaWFibGUodGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShUUkFOU0xBVElPTl9QUkVGSVgpKTtcbiAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuQ29udGV4dChpbmRleCwgcmVmLCAwLCB0aGlzLnRlbXBsYXRlSW5kZXgsIG1ldGEpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlIGkxOG5TdGFydCBpbnN0cnVjdGlvblxuICAgIGNvbnN0IHtpZCwgcmVmfSA9IHRoaXMuaTE4bjtcbiAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChpbmRleCksIHJlZl07XG4gICAgaWYgKGlkID4gMCkge1xuICAgICAgLy8gZG8gbm90IHB1c2ggM3JkIGFyZ3VtZW50IChzdWItYmxvY2sgaWQpXG4gICAgICAvLyBpbnRvIGkxOG5TdGFydCBjYWxsIGZvciB0b3AgbGV2ZWwgaTE4biBjb250ZXh0XG4gICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaWQpKTtcbiAgICB9XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIHNlbGZDbG9zaW5nID8gUjMuaTE4biA6IFIzLmkxOG5TdGFydCwgcGFyYW1zKTtcbiAgfVxuXG4gIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgYmluZGluZ3MuZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIGluZGV4LCBzcGFuLCBSMy5pMThuRXhwLFxuICAgICAgICAgICAgKCkgPT4gW3RoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhiaW5kaW5nLCAvKiBza2lwQmluZEZuICovIHRydWUpXSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5kZXgsIHNwYW4sIFIzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChpbmRleCldKTtcbiAgICB9XG4gICAgaWYgKCFzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5FbmQpO1xuICAgIH1cbiAgICB0aGlzLmkxOG4gPSBudWxsOyAgLy8gcmVzZXQgbG9jYWwgaTE4biBjb250ZXh0XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcHJvamVjdGlvblNsb3RJZHggPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgKyB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICAgIGlmIChuYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZSkpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSwgby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSwgby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpKTtcbiAgICB9IGVsc2UgaWYgKHByb2plY3Rpb25TbG90SWR4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG5nQ29udGVudC5zb3VyY2VTcGFuLCBSMy5wcm9qZWN0aW9uLCBwYXJhbWV0ZXJzKTtcbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kUHJvamVjdGlvbihuZ0NvbnRlbnQuaTE4biAhLCBzbG90KTtcbiAgICB9XG4gIH1cblxuXG4gIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzdHlsaW5nQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgbnVsbCk7XG5cbiAgICBsZXQgaXNOb25CaW5kYWJsZU1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudDogYm9vbGVhbiA9XG4gICAgICAgIGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShlbGVtZW50LmkxOG4pO1xuXG4gICAgaWYgKGlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG5BdHRyczogKHQuVGV4dEF0dHJpYnV0ZSB8IHQuQm91bmRBdHRyaWJ1dGUpW10gPSBbXTtcbiAgICBjb25zdCBvdXRwdXRBdHRyczogdC5UZXh0QXR0cmlidXRlW10gPSBbXTtcblxuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gSGFuZGxlIHN0eWxpbmcsIGkxOG4sIG5nTm9uQmluZGFibGUgYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHtuYW1lLCB2YWx1ZX0gPSBhdHRyO1xuICAgICAgaWYgKG5hbWUgPT09IE5PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICAgIGlzTm9uQmluZGFibGVNb2RlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGF0dHIuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvdXRwdXRBdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgdGhpcy5tYXRjaERpcmVjdGl2ZXMoZWxlbWVudC5uYW1lLCBlbGVtZW50KTtcblxuICAgIC8vIFJlZ3VsYXIgZWxlbWVudCBvciBuZy1jb250YWluZXIgY3JlYXRpb24gbW9kZVxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChlbGVtZW50SW5kZXgpXTtcbiAgICBpZiAoIWlzTmdDb250YWluZXIpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoZWxlbWVudE5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGFsbE90aGVySW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckJvdW5kSW5wdXQoaW5wdXQpO1xuICAgICAgaWYgKCFzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgICAgaWYgKGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5ICYmIGlucHV0LmkxOG4pIHtcbiAgICAgICAgICAvLyBQbGFjZSBhdHRyaWJ1dGVzIGludG8gYSBzZXBhcmF0ZSBhcnJheSBmb3IgaTE4biBwcm9jZXNzaW5nLCBidXQgYWxzbyBrZWVwIHN1Y2hcbiAgICAgICAgICAvLyBhdHRyaWJ1dGVzIGluIHRoZSBtYWluIGxpc3QgdG8gbWFrZSB0aGVtIGF2YWlsYWJsZSBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nIGF0IHJ1bnRpbWUuXG4gICAgICAgICAgLy8gVE9ETyhGVy0xMjQ4KTogcHJldmVudCBhdHRyaWJ1dGVzIGR1cGxpY2F0aW9uIGluIGBpMThuQXR0cmlidXRlc2AgYW5kIGBlbGVtZW50U3RhcnRgXG4gICAgICAgICAgLy8gYXJndW1lbnRzXG4gICAgICAgICAgaTE4bkF0dHJzLnB1c2goaW5wdXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBvdXRwdXRBdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKC4uLmdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGF0dHIubmFtZSksIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgYXR0cmlidXRlcyBmb3IgZGlyZWN0aXZlIGFuZCBwcm9qZWN0aW9uIG1hdGNoaW5nIHB1cnBvc2VzXG4gICAgYXR0cmlidXRlcy5wdXNoKC4uLnRoaXMucHJlcGFyZU5vblJlbmRlckF0dHJzKFxuICAgICAgICBhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzLCBzdHlsaW5nQnVpbGRlciwgW10sIGkxOG5BdHRycykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnByZXBhcmVSZWZzUGFyYW1ldGVyKGVsZW1lbnQucmVmZXJlbmNlcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4gISwgZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICBjb25zdCBoYXNDaGlsZHJlbiA9ICgpID0+IHtcbiAgICAgIGlmICghaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICAgIC8vIHdlIGRvIG5vdCBhcHBlbmQgdGV4dCBub2RlIGluc3RydWN0aW9ucyBhbmQgSUNVcyBpbnNpZGUgaTE4biBzZWN0aW9uLFxuICAgICAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgICAgIHJldHVybiAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgfTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhc3R5bGluZ0J1aWxkZXIuaGFzQmluZGluZ3MgJiYgIWlzTmdDb250YWluZXIgJiZcbiAgICAgICAgZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA9PT0gMCAmJiBpMThuQXR0cnMubGVuZ3RoID09PSAwICYmICFoYXNDaGlsZHJlbigpO1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJlxuICAgICAgICAhc3R5bGluZ0J1aWxkZXIuaGFzQmluZGluZ3MgJiYgaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKTtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50LCB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcHJvY2VzcyBpMThuIGVsZW1lbnQgYXR0cmlidXRlc1xuICAgICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgaTE4bkF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF0dHIuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuICAgICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgdC5UZXh0QXR0cmlidXRlKSB7XG4gICAgICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgY29udmVydGVkID0gYXR0ci52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKGNvbnZlcnRlZCk7XG4gICAgICAgICAgICBpZiAoY29udmVydGVkIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKTtcbiAgICAgICAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwYXJhbXMpKTtcbiAgICAgICAgICAgICAgY29udmVydGVkLmV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICAgICAgICAgICAgaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5pMThuRXhwLFxuICAgICAgICAgICAgICAgICAgICAoKSA9PiBbdGhpcy5jb252ZXJ0RXhwcmVzc2lvbkJpbmRpbmcoZXhwcmVzc2lvbiwgLyogc2tpcEJpbmRGbiAqLyB0cnVlKV0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaTE4bkF0dHJBcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IGluZGV4OiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpO1xuICAgICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGkxOG5BdHRyQXJncyksIHRydWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BdHRyaWJ1dGVzLCBbaW5kZXgsIGFyZ3NdKTtcbiAgICAgICAgICBpZiAoaGFzQmluZGluZ3MpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBzdHlsZSBiaW5kaW5ncyBjb2RlIGlzIHBsYWNlZCBpbnRvIHR3byBkaXN0aW5jdCBibG9ja3Mgd2l0aGluIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1RcbiAgICAgIC8vIGNvZGU6IGNyZWF0aW9uIGFuZCB1cGRhdGUuIFRoZSBjcmVhdGlvbiBjb2RlIGNvbnRhaW5zIHRoZSBgc3R5bGluZ2AgaW5zdHJ1Y3Rpb25zXG4gICAgICAvLyB3aGljaCB3aWxsIGFwcGx5IHRoZSBjb2xsZWN0ZWQgYmluZGluZyB2YWx1ZXMgdG8gdGhlIGVsZW1lbnQuIGBzdHlsaW5nYCBpc1xuICAgICAgLy8gZGVzaWduZWQgdG8gcnVuIGluc2lkZSBvZiBgZWxlbWVudFN0YXJ0YCBhbmQgYGVsZW1lbnRFbmRgLiBUaGUgdXBkYXRlIGluc3RydWN0aW9uc1xuICAgICAgLy8gKHRoaW5ncyBsaWtlIGBzdHlsZVByb3BgLCBgY2xhc3NQcm9wYCwgZXRjLi4pIGFyZSBhcHBsaWVkIGxhdGVyIG9uIGluIHRoaXNcbiAgICAgIC8vIGZpbGVcbiAgICAgIHRoaXMucHJvY2Vzc1N0eWxpbmdJbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50SW5kZXgsXG4gICAgICAgICAgc3R5bGluZ0J1aWxkZXIuYnVpbGRTdHlsaW5nSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCB0aGlzLmNvbnN0YW50UG9vbCksIHRydWUpO1xuXG4gICAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLFxuICAgICAgICAgICAgdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoZWxlbWVudC5uYW1lLCBvdXRwdXRBc3QsIGVsZW1lbnRJbmRleCkpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIE5vdGU6IGl0J3MgaW1wb3J0YW50IHRvIGtlZXAgaTE4bi9pMThuU3RhcnQgaW5zdHJ1Y3Rpb25zIGFmdGVyIGkxOG5BdHRyaWJ1dGVzIGFuZFxuICAgICAgLy8gbGlzdGVuZXJzLCB0byBtYWtlIHN1cmUgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24gdGFyZ2V0cyBjdXJyZW50IGVsZW1lbnQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5TdGFydChlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4biAhLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGNvZGUgaGVyZSB3aWxsIGNvbGxlY3QgYWxsIHVwZGF0ZS1sZXZlbCBzdHlsaW5nIGluc3RydWN0aW9ucyBhbmQgYWRkIHRoZW0gdG8gdGhlXG4gICAgLy8gdXBkYXRlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1QgY29kZS4gSW5zdHJ1Y3Rpb25zIGxpa2UgYHN0eWxlUHJvcGAsXG4gICAgLy8gYHN0eWxlTWFwYCwgYGNsYXNzTWFwYCwgYGNsYXNzUHJvcGAgYW5kIGBzdHlsaW5nQXBwbHlgXG4gICAgLy8gYXJlIGFsbCBnZW5lcmF0ZWQgYW5kIGFzc2lnbmVkIGluIHRoZSBjb2RlIGJlbG93LlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbnMgPSBzdHlsaW5nQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBjb25zdCBsaW1pdCA9IHN0eWxpbmdJbnN0cnVjdGlvbnMubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IHN0eWxpbmdJbnN0cnVjdGlvbnNbaV07XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gaW5zdHJ1Y3Rpb24uYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICB0aGlzLnByb2Nlc3NTdHlsaW5nSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIHRoZSByZWFzb24gd2h5IGB1bmRlZmluZWRgIGlzIHVzZWQgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgdW5kZXJzdGFuZHMgdGhpcyBhcyBhXG4gICAgLy8gc3BlY2lhbCB2YWx1ZSB0byBzeW1ib2xpemUgdGhhdCB0aGVyZSBpcyBubyBSSFMgdG8gdGhpcyBiaW5kaW5nXG4gICAgLy8gVE9ETyAobWF0c2tvKTogcmV2aXNpdCB0aGlzIG9uY2UgRlctOTU5IGlzIGFwcHJvYWNoZWRcbiAgICBjb25zdCBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uID0gby5saXRlcmFsKHVuZGVmaW5lZCk7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlUHJvcGVydHlCaW5kaW5nW10gPSBbXTtcblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgaW5wdXRUeXBlID0gaW5wdXQudHlwZTtcbiAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gYW5pbWF0aW9uIGJpbmRpbmdzIGNhbiBiZSBwcmVzZW50ZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXRzOlxuICAgICAgICAvLyAxLiBbQGJpbmRpbmddPVwiZm9vRXhwXCJcbiAgICAgICAgLy8gMi4gW0BiaW5kaW5nXT1cInt2YWx1ZTpmb29FeHAsIHBhcmFtczp7Li4ufX1cIlxuICAgICAgICAvLyAzLiBbQGJpbmRpbmddXG4gICAgICAgIC8vIDQuIEBiaW5kaW5nXG4gICAgICAgIC8vIEFsbCBmb3JtYXRzIHdpbGwgYmUgdmFsaWQgZm9yIHdoZW4gYSBzeW50aGV0aWMgYmluZGluZyBpcyBjcmVhdGVkLlxuICAgICAgICAvLyBUaGUgcmVhc29uaW5nIGZvciB0aGlzIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHNob3VsZCBnZXQgZWFjaFxuICAgICAgICAvLyBzeW50aGV0aWMgYmluZGluZyB2YWx1ZSBpbiB0aGUgb3JkZXIgb2YgdGhlIGFycmF5IHRoYXQgdGhleSBhcmVcbiAgICAgICAgLy8gZGVmaW5lZCBpbi4uLlxuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgTGl0ZXJhbFByaW1pdGl2ZSA/ICEhdmFsdWUudmFsdWUgOiB0cnVlO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoaW5wdXQubmFtZSksXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgdmFsdWU6ICgpID0+IGhhc1ZhbHVlID8gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlLCAvKiBza2lwQmluZEZuICovIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgbXVzdCBza2lwIGF0dHJpYnV0ZXMgd2l0aCBhc3NvY2lhdGVkIGkxOG4gY29udGV4dCwgc2luY2UgdGhlc2UgYXR0cmlidXRlcyBhcmUgaGFuZGxlZFxuICAgICAgICAvLyBzZXBhcmF0ZWx5IGFuZCBjb3JyZXNwb25kaW5nIGBpMThuRXhwYCBhbmQgYGkxOG5BcHBseWAgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICAgIGlmIChpbnB1dC5pMThuKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IFthdHRyTmFtZXNwYWNlLCBhdHRyTmFtZV0gPSBzcGxpdE5zTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBpc0F0dHJpYnV0ZUJpbmRpbmcgPSBpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQuc2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZUJpbmRpbmcpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG4gICAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0ck5hbWVzcGFjZSk7XG5cbiAgICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiB0aGVyZSB3YXNuJ3QgYSBzYW5pdGl6YXRpb24gcmVmLCB3ZSBuZWVkIHRvIGFkZFxuICAgICAgICAgICAgICAvLyBhbiBleHRyYSBwYXJhbSBzbyB0aGF0IHdlIGNhbiBwYXNzIGluIHRoZSBuYW1lc3BhY2UuXG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSwgbmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgdGhlIHByb3BlcnRpZXMgc28gdGhhdCB3ZSBjYW4gY2hhaW4gaW50byBhIHNpbmdsZSBmdW5jdGlvbiBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IGF0dHJOYW1lLFxuICAgICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUsIHRydWUpLCBwYXJhbXNcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiAmJiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCh2YWx1ZSkgPiAxKSB7XG4gICAgICAgICAgICAgIC8vIGF0dHIubmFtZT1cInRleHR7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYm91bmRWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IHZhbHVlLmV4cHJlc3Npb25zWzBdIDogdmFsdWU7XG4gICAgICAgICAgICAgIC8vIFthdHRyLm5hbWVdPVwidmFsdWVcIiBvciBhdHRyLm5hbWU9XCJ7e3ZhbHVlfX1cIlxuICAgICAgICAgICAgICB0aGlzLmJvdW5kVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBSMy5hdHRyaWJ1dGUsIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCBib3VuZFZhbHVlLCBwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGFzcyBwcm9wXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChwcm9wZXJ0eUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMucHJvcGVydHlJbnN0cnVjdGlvbkNoYWluKGVsZW1lbnRJbmRleCwgcHJvcGVydHlCaW5kaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuICEsIGVsZW1lbnRJbmRleCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGNvbnN0IHNwYW4gPSBlbGVtZW50LmVuZFNvdXJjZVNwYW4gfHwgZWxlbWVudC5zb3VyY2VTcGFuO1xuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4bkVuZChzcGFuLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmVuYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgYSBib3VuZCBwcm9wZXJ0eSBvciBhdHRyaWJ1dGUsIHN1Y2ggYXMgYFtwcm9wXT1cInZhbHVlXCJgIG9yXG4gICAqIGBbYXR0ci50aXRsZV09XCJ2YWx1ZVwiYFxuICAgKi9cbiAgYm91bmRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50SW5kZXg6IG51bWJlciwgYXR0ck5hbWU6IHN0cmluZyxcbiAgICAgIGlucHV0OiB0LkJvdW5kQXR0cmlidXRlLCB2YWx1ZTogYW55LCBwYXJhbXM6IGFueVtdKSB7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLCAoKSA9PiB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBvLmxpdGVyYWwoYXR0ck5hbWUpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUsIC8qIHNraXBCaW5kRm4gKi8gdHJ1ZSksIC4uLnBhcmFtc1xuICAgICAgXTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5IG9yIGF0dHJpYnV0ZSwgc3VjaCBhc1xuICAgKiBgcHJvcD1cInt7dmFsdWV9fVwiYCBvciBgYXR0ci50aXRsZT1cInt7dmFsdWV9fVwiYFxuICAgKi9cbiAgaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgdmFsdWU6IGFueSwgcGFyYW1zOiBhbnlbXSkge1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgIGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwoYXR0ck5hbWUpLCAuLi50aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSwgLi4ucGFyYW1zXSk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZSh0ZW1wbGF0ZS5pMThuICEsIHRlbXBsYXRlSW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSB8fCAnJyk7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfSR7dGFnTmFtZSA/ICdfJyArIHRhZ05hbWUgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuXG4gICAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgICAgLy8gaXQgYmFzZWQgb24gdGhlIHBhcmVudCBub2RlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLlxuICAgICAgby5saXRlcmFsKHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWUpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKFxuICAgICAgICAoYTogdC5UZXh0QXR0cmlidXRlKSA9PiB7IGF0dHJzRXhwcnMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKGEudmFsdWUpKTsgfSk7XG4gICAgYXR0cnNFeHBycy5wdXNoKC4uLnRoaXMucHJlcGFyZU5vblJlbmRlckF0dHJzKFxuICAgICAgICB0ZW1wbGF0ZS5pbnB1dHMsIHRlbXBsYXRlLm91dHB1dHMsIHVuZGVmaW5lZCwgdGVtcGxhdGUudGVtcGxhdGVBdHRycykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIodGVtcGxhdGUucmVmZXJlbmNlcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sXG4gICAgICAgIHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlTmFtZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsXG4gICAgICAgIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LCB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgbmctdGVtcGxhdGUgZWxlbWVudHMuXG4gICAgaWYgKHRlbXBsYXRlLnRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICB0ZW1wbGF0ZS5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKCduZ190ZW1wbGF0ZScsIG91dHB1dEFzdCwgdGVtcGxhdGVJbmRleCkpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kQm91bmRUZXh0KHRleHQuaTE4biAhKTtcbiAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3ModmFsdWUuZXhwcmVzc2lvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICBub2RlSW5kZXgsIHRleHQuc291cmNlU3BhbiwgZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSxcbiAgICAgICAgICAoKSA9PiB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHRCaW5kaW5nLCAoKSA9PiBbdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKV0pO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuICEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4gITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuICAgIGNvbnN0IHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT5cbiAgICAgICAgaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBbcmF3LCBtYXBMaXRlcmFsKHZhcnMsIHRydWUpXSk7XG5cbiAgICAvLyBpbiBjYXNlIHRoZSB3aG9sZSBpMThuIG1lc3NhZ2UgaXMgYSBzaW5nbGUgSUNVIC0gd2UgZG8gbm90IG5lZWQgdG9cbiAgICAvLyBjcmVhdGUgYSBzZXBhcmF0ZSB0b3AtbGV2ZWwgdHJhbnNsYXRpb24sIHdlIGNhbiB1c2UgdGhlIHJvb3QgcmVmIGluc3RlYWRcbiAgICAvLyBhbmQgbWFrZSB0aGlzIElDVSBhIHRvcC1sZXZlbCB0cmFuc2xhdGlvblxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBsYWNlaG9sZGVycywgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9IHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwbGFjZWhvbGRlcnMsIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIHByaXZhdGUgdGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBhdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdKSB7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlUHJvcGVydHlCaW5kaW5nW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogaW5wdXQubmFtZSxcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSwgLyogc2tpcEJpbmRGbiAqLyB0cnVlKVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnByb3BlcnR5SW5zdHJ1Y3Rpb25DaGFpbih0ZW1wbGF0ZUluZGV4LCBwcm9wZXJ0eUJpbmRpbmdzKTtcbiAgICB9XG4gIH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcbiAgICBmbnNbcHJlcGVuZCA/ICd1bnNoaWZ0JyA6ICdwdXNoJ10oKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcm9jZXNzU3R5bGluZ0luc3RydWN0aW9uKFxuICAgICAgZWxlbWVudEluZGV4OiBudW1iZXIsIGluc3RydWN0aW9uOiBJbnN0cnVjdGlvbnxudWxsLCBjcmVhdGVNb2RlOiBib29sZWFuKSB7XG4gICAgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICBjb25zdCBwYXJhbXNGbiA9ICgpID0+IGluc3RydWN0aW9uLmJ1aWxkUGFyYW1zKFxuICAgICAgICAgIHZhbHVlID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSwgLyogc2tpcEJpbmRGbiAqLyB0cnVlKSk7XG4gICAgICBpZiAoY3JlYXRlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb24uc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBwYXJhbXNGbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIHBhcmFtc0ZuKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ/OiBib29sZWFuKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdLCBwcmVwZW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5hZGRTZWxlY3RJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleCwgc3Bhbik7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uQ2hhaW4oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIGNhbGxzT3JGbj86IG8uRXhwcmVzc2lvbltdW118KCgpID0+IG8uRXhwcmVzc2lvbltdW10pKSB7XG4gICAgdGhpcy5hZGRTZWxlY3RJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleCwgc3Bhbik7XG4gICAgdGhpcy5fdXBkYXRlQ29kZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGxzID0gdHlwZW9mIGNhbGxzT3JGbiA9PT0gJ2Z1bmN0aW9uJyA/IGNhbGxzT3JGbigpIDogY2FsbHNPckZuO1xuICAgICAgcmV0dXJuIGNoYWluZWRJbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIGNhbGxzIHx8IFtdKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvcGVydHlJbnN0cnVjdGlvbkNoYWluKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHByb3BlcnR5QmluZGluZ3M6IENoYWluYWJsZVByb3BlcnR5QmluZGluZ1tdKSB7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluKFxuICAgICAgICBub2RlSW5kZXgsIHByb3BlcnR5QmluZGluZ3MubGVuZ3RoID8gcHJvcGVydHlCaW5kaW5nc1swXS5pbnB1dC5zb3VyY2VTcGFuIDogbnVsbCxcbiAgICAgICAgUjMucHJvcGVydHksICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gcHJvcGVydHlCaW5kaW5ncy5tYXAoXG4gICAgICAgICAgICAgIHByb3BlcnR5ID0+IFtvLmxpdGVyYWwocHJvcGVydHkubmFtZSksIHByb3BlcnR5LnZhbHVlKCksIC4uLihwcm9wZXJ0eS5wYXJhbXMgfHwgW10pXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRTZWxlY3RJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIGlmICh0aGlzLl9sYXN0Tm9kZUluZGV4V2l0aEZsdXNoIDwgbm9kZUluZGV4KSB7XG4gICAgICBpZiAobm9kZUluZGV4ID4gMCkge1xuICAgICAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgUjMuc2VsZWN0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xhc3ROb2RlSW5kZXhXaXRoRmx1c2ggPSBub2RlSW5kZXg7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG9yaWdpbmFsU2xvdHMgPSB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cztcbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSBudW1TbG90cztcbiAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWU6IEFTVHxudWxsKSB7XG4gICAgdGhpcy5fYmluZGluZ1Nsb3RzICs9IHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCA6IDE7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbiBleHByZXNzaW9uIHRoYXQgcmVmZXJzIHRvIHRoZSBpbXBsaWNpdCByZWNlaXZlci4gVGhlIGltcGxpY2l0XG4gICAqIHJlY2VpdmVyIGlzIGFsd2F5cyB0aGUgcm9vdCBsZXZlbCBjb250ZXh0LlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBpZiAodGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHIpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwcjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHIgPSB0aGlzLmxldmVsID09PSAwID9cbiAgICAgICAgby52YXJpYWJsZShDT05URVhUX05BTUUpIDpcbiAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLmdldE9yQ3JlYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydEV4cHJlc3Npb25CaW5kaW5nKHZhbHVlOiBBU1QsIHNraXBCaW5kRm4/OiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICB0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSk7XG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcblxuICAgIHJldHVybiBza2lwQmluZEZuID8gdmFsRXhwciA6IG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW3ZhbEV4cHJdKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZTogQVNULCBza2lwQmluZEZuPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkZuID1cbiAgICAgICAgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gaW50ZXJwb2xhdGUgOiAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyk7XG5cbiAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICB0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgaW50ZXJwb2xhdGlvbkZuKTtcbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuXG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiB8fCBza2lwQmluZEZuID8gdmFsRXhwciA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbdmFsRXhwcl0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYSBsaXN0IG9mIGFyZ3VtZW50IGV4cHJlc3Npb25zIHRvIHBhc3MgdG8gYW4gdXBkYXRlIGluc3RydWN0aW9uIGV4cHJlc3Npb24uIEFsc28gdXBkYXRlc1xuICAgKiB0aGUgdGVtcCB2YXJpYWJsZXMgc3RhdGUgd2l0aCB0ZW1wIHZhcmlhYmxlcyB0aGF0IHdlcmUgaWRlbnRpZmllZCBhcyBuZWVkaW5nIHRvIGJlIGNyZWF0ZWRcbiAgICogd2hpbGUgdmlzaXRpbmcgdGhlIGFyZ3VtZW50cy5cbiAgICogQHBhcmFtIHZhbHVlIFRoZSBvcmlnaW5hbCBleHByZXNzaW9uIHdlIHdpbGwgYmUgcmVzb2x2aW5nIGFuIGFyZ3VtZW50cyBsaXN0IGZyb20uXG4gICAqL1xuICBwcml2YXRlIGdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3Qge2FyZ3MsIHN0bXRzfSA9XG4gICAgICAgIGNvbnZlcnRVcGRhdGVBcmd1bWVudHModGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpKTtcblxuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBwcml2YXRlIG1hdGNoRGlyZWN0aXZlcyh0YWdOYW1lOiBzdHJpbmcsIGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKSB7XG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3Rvcih0YWdOYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBwcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sIHN0eWxlcz86IFN0eWxpbmdCdWlsZGVyLFxuICAgICAgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10sXG4gICAgICBpMThuQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgZnVuY3Rpb24gYWRkQXR0ckV4cHIoa2V5OiBzdHJpbmcgfCBudW1iZXIsIHZhbHVlPzogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCFhbHJlYWR5U2Vlbi5oYXMoa2V5KSkge1xuICAgICAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhrZXkpKTtcbiAgICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIGF0dHJFeHBycy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICBhbHJlYWR5U2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGtleSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGl0J3MgaW1wb3J0YW50IHRoYXQgdGhpcyBvY2N1cnMgYmVmb3JlIEJJTkRJTkdTIGFuZCBURU1QTEFURSBiZWNhdXNlIG9uY2UgYGVsZW1lbnRTdGFydGBcbiAgICAvLyBjb21lcyBhY3Jvc3MgdGhlIEJJTkRJTkdTIG9yIFRFTVBMQVRFIG1hcmtlcnMgdGhlbiBpdCB3aWxsIGNvbnRpbnVlIHJlYWRpbmcgZWFjaCB2YWx1ZSBhc1xuICAgIC8vIGFzIHNpbmdsZSBwcm9wZXJ0eSB2YWx1ZSBjZWxsIGJ5IGNlbGwuXG4gICAgaWYgKHN0eWxlcykge1xuICAgICAgc3R5bGVzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyRXhwcnMpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dHMubGVuZ3RoIHx8IG91dHB1dHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBhdHRyc1N0YXJ0SW5kZXggPSBhdHRyRXhwcnMubGVuZ3RoO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1tpXTtcbiAgICAgICAgaWYgKGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKGlucHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2ldO1xuICAgICAgICBpZiAob3V0cHV0LnR5cGUgIT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihvdXRwdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhIGNoZWFwIHdheSBvZiBhZGRpbmcgdGhlIG1hcmtlciBvbmx5IGFmdGVyIGFsbCB0aGUgaW5wdXQvb3V0cHV0XG4gICAgICAvLyB2YWx1ZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIChieSBub3QgaW5jbHVkaW5nIHRoZSBhbmltYXRpb24gb25lcykgYW5kIGFkZGVkXG4gICAgICAvLyB0byB0aGUgZXhwcmVzc2lvbnMuIFRoZSBtYXJrZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaXQgdGVsbHMgdGhlIHJ1bnRpbWVcbiAgICAgIC8vIGNvZGUgdGhhdCB0aGlzIGlzIHdoZXJlIGF0dHJpYnV0ZXMgd2l0aG91dCB2YWx1ZXMgc3RhcnQuLi5cbiAgICAgIGlmIChhdHRyRXhwcnMubGVuZ3RoKSB7XG4gICAgICAgIGF0dHJFeHBycy5zcGxpY2UoYXR0cnNTdGFydEluZGV4LCAwLCBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVtcGxhdGVBdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSkpO1xuICAgICAgdGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBpMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIHRvQXR0cnNQYXJhbShhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIGF0dHJzRXhwcnMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cnNFeHBycyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzUGFyYW1ldGVyKHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IGZsYXR0ZW4ocmVmZXJlbmNlcy5tYXAocmVmZXJlbmNlID0+IHtcbiAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgICByZXRyaWV2YWxMZXZlbCwgcmVmZXJlbmNlLm5hbWUsIGxocyxcbiAgICAgICAgICBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIGUuZy4gbmV4dENvbnRleHQoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcmVmZXJlbmNlKDEpO1xuICAgICAgICAgICAgY29uc3QgcmVmRXhwciA9IGxocy5zZXQoby5pbXBvcnRFeHByKFIzLnJlZmVyZW5jZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgcmV0dXJuIFtyZWZlcmVuY2UubmFtZSwgcmVmZXJlbmNlLnZhbHVlXTtcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyZWZzUGFyYW0pLCB0cnVlKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSAhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG4gICAgICByZXR1cm4gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKG91dHB1dEFzdCwgaGFuZGxlck5hbWUsIHNjb3BlKTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBfcGlwZUJpbmRFeHByczogRnVuY3Rpb25DYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKHBpcGUuc3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuKSwgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcGlwZUJpbmRpbmdDYWxsSW5mbyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGlkZW50aWZpZXIpKTtcbiAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtwaXBlLmV4cCwgLi4ucGlwZS5hcmdzXTtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzOiBBU1RbXSA9XG4gICAgICAgIGlzVmFyTGVuZ3RoID8gdGhpcy52aXNpdEFsbChbbmV3IExpdGVyYWxBcnJheShwaXBlLnNwYW4sIGFyZ3MpXSkgOiB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgY29uc3QgcGlwZUJpbmRFeHByID0gbmV3IEZ1bmN0aW9uQ2FsbChwaXBlLnNwYW4sIHRhcmdldCwgW1xuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBzbG90KSxcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3BhbiwgcHVyZUZ1bmN0aW9uU2xvdCksXG4gICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgIF0pO1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMucHVzaChwaXBlQmluZEV4cHIpO1xuICAgIHJldHVybiBwaXBlQmluZEV4cHI7XG4gIH1cblxuICB1cGRhdGVQaXBlU2xvdE9mZnNldHMoYmluZGluZ1Nsb3RzOiBudW1iZXIpIHtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLmZvckVhY2goKHBpcGU6IEZ1bmN0aW9uQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoYXJyYXkuc3BhbiwgdGhpcy52aXNpdEFsbChhcnJheS5leHByZXNzaW9ucyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIHRoaXMudmlzaXRBbGwobWFwLnZhbHVlcyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzICB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbE1hcCh2YWx1ZXMubWFwKFxuICAgICAgICAgICh2YWx1ZSwgaW5kZXgpID0+ICh7a2V5OiBtYXAua2V5c1tpbmRleF0ua2V5LCB2YWx1ZSwgcXVvdGVkOiBtYXAua2V5c1tpbmRleF0ucXVvdGVkfSkpKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pO1xufVxuXG5mdW5jdGlvbiBjaGFpbmVkSW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBjYWxsczogby5FeHByZXNzaW9uW11bXSkge1xuICBsZXQgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pIGFzIG8uRXhwcmVzc2lvbjtcblxuICBpZiAoY2FsbHMubGVuZ3RoID4gMCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHJlc3Npb24gPSBleHByZXNzaW9uLmNhbGxGbihjYWxsc1tpXSwgc3Bhbik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEFkZCBhIGJsYW5rIGludm9jYXRpb24sIGluIGNhc2UgdGhlIGBjYWxsc2AgYXJyYXkgaXMgZW1wdHkuXG4gICAgZXhwcmVzc2lvbiA9IGV4cHJlc3Npb24uY2FsbEZuKFtdLCBzcGFuKTtcbiAgfVxuXG4gIHJldHVybiBleHByZXNzaW9uO1xufVxuXG4vLyBlLmcuIHgoMik7XG5mdW5jdGlvbiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsRGlmZjogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5uZXh0Q29udGV4dClcbiAgICAgIC5jYWxsRm4ocmVsYXRpdmVMZXZlbERpZmYgPiAxID8gW28ubGl0ZXJhbChyZWxhdGl2ZUxldmVsRGlmZildIDogW10pO1xufVxuXG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByIHwgby5MaXRlcmFsTWFwRXhwcixcbiAgICBhbGxvY2F0ZVNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIC8vIEFsbG9jYXRlIDEgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIDEgcGVyIGFyZ3VtZW50XG4gIGNvbnN0IHN0YXJ0U2xvdCA9IGFsbG9jYXRlU2xvdHMoMSArIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCk7XG4gIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCA+IDAgfHwgZXJyb3IoYEV4cGVjdGVkIGFyZ3VtZW50cyB0byBhIGxpdGVyYWwgZmFjdG9yeSBmdW5jdGlvbmApO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW1xuICAgIG8ubGl0ZXJhbChzdGFydFNsb3QpLFxuICAgIGxpdGVyYWxGYWN0b3J5LFxuICBdO1xuXG4gIGlmIChpc1Zhckxlbmd0aCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIobGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhcmdzLnB1c2goLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKS5jYWxsRm4oYXJncyk7XG59XG5cbi8qKlxuICogR2V0cyBhbiBhcnJheSBvZiBsaXRlcmFscyB0aGF0IGNhbiBiZSBhZGRlZCB0byBhbiBleHByZXNzaW9uXG4gKiB0byByZXByZXNlbnQgdGhlIG5hbWUgYW5kIG5hbWVzcGFjZSBvZiBhbiBhdHRyaWJ1dGUuIEUuZy5cbiAqIGA6eGxpbms6aHJlZmAgdHVybnMgaW50byBgW0F0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkksICd4bGluaycsICdocmVmJ11gLlxuICpcbiAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGF0dHJpYnV0ZSwgaW5jbHVkaW5nIHRoZSBuYW1lc3BhY2UuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUpO1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lKTtcblxuICBpZiAoYXR0cmlidXRlTmFtZXNwYWNlKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IG5leHRDb250ZXh0KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgbG9jYWxSZWZgIGlzIHRydWUgaWYgd2UgYXJlIHN0b3JpbmcgYSBsb2NhbCByZWZlcmVuY2VcbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uUmVhZFZhckV4cHI7IGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s7XG4gIGRlY2xhcmU6IGJvb2xlYW47XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGxvY2FsUmVmOiBib29sZWFuO1xufTtcblxuLyoqXG4gKiBUaGUgc29ydGluZyBwcmlvcml0eSBvZiBhIGxvY2FsIHZhcmlhYmxlIGRlY2xhcmF0aW9uLiBIaWdoZXIgbnVtYmVyc1xuICogbWVhbiB0aGUgZGVjbGFyYXRpb24gd2lsbCBhcHBlYXIgZmlyc3QgaW4gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICovXG5jb25zdCBlbnVtIERlY2xhcmF0aW9uUHJpb3JpdHkgeyBERUZBVUxUID0gMCwgQ09OVEVYVCA9IDEsIFNIQVJFRF9DT05URVhUID0gMiB9XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdGljIF9ST09UX1NDT1BFOiBCaW5kaW5nU2NvcGU7XG5cbiAgc3RhdGljIGdldCBST09UX1NDT1BFKCk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKCFCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUpIHtcbiAgICAgIEJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRSA9IG5ldyBCaW5kaW5nU2NvcGUoKS5zZXQoMCwgJyRldmVudCcsIG8udmFyaWFibGUoJyRldmVudCcpKTtcbiAgICB9XG4gICAgcmV0dXJuIEJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRTtcbiAgfVxuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocHVibGljIGJpbmRpbmdMZXZlbDogbnVtYmVyID0gMCwgcHJpdmF0ZSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCkge31cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHksXG4gICAgICAgICAgICBsb2NhbFJlZjogdmFsdWUubG9jYWxSZWZcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldyh2YWx1ZS5yZXRyaWV2YWxMZXZlbCwgdmFsdWUubG9jYWxSZWYpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICYmICF2YWx1ZS5kZWNsYXJlKSB7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlLmxocztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhpcyBwb2ludCwgd2UgYXJlIGxvb2tpbmcgZm9yIGEgcHJvcGVydHkgb24gdGhlIHRvcCBsZXZlbCBjb21wb25lbnRcbiAgICAvLyAtIElmIGxldmVsID09PSAwLCB3ZSBhcmUgb24gdGhlIHRvcCBhbmQgZG9uJ3QgbmVlZCB0byByZS1kZWNsYXJlIGBjdHhgLlxuICAgIC8vIC0gSWYgbGV2ZWwgPiAwLCB3ZSBhcmUgaW4gYW4gZW1iZWRkZWQgdmlldy4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAvLyBsb2NhbCB2YXIgd2UgdXNlZCB0byBzdG9yZSB0aGUgY29tcG9uZW50IGNvbnRleHQsIGUuZy4gY29uc3QgJGNvbXAkID0geCgpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdMZXZlbCA9PT0gMCA/IG51bGwgOiB0aGlzLmdldENvbXBvbmVudFByb3BlcnR5KG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxvY2FsIHZhcmlhYmxlIGZvciBsYXRlciByZWZlcmVuY2UuXG4gICAqXG4gICAqIEBwYXJhbSByZXRyaWV2YWxMZXZlbCBUaGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWRcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgdmFyaWFibGUuXG4gICAqIEBwYXJhbSBsaHMgQVNUIHJlcHJlc2VudGluZyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuXG4gICAqIEBwYXJhbSBwcmlvcml0eSBUaGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhclxuICAgKiBAcGFyYW0gZGVjbGFyZUxvY2FsQ2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIGludm9rZSB3aGVuIGRlY2xhcmluZyB0aGlzIGxvY2FsIHZhclxuICAgKiBAcGFyYW0gbG9jYWxSZWYgV2hldGhlciBvciBub3QgdGhpcyBpcyBhIGxvY2FsIHJlZlxuICAgKi9cbiAgc2V0KHJldHJpZXZhbExldmVsOiBudW1iZXIsIG5hbWU6IHN0cmluZywgbGhzOiBvLlJlYWRWYXJFeHByLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgICBsb2NhbFJlZjogbG9jYWxSZWYgfHwgZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhLmRlY2xhcmUgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIG5lc3RlZFNjb3BlKGxldmVsOiBudW1iZXIpOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubWFwLmdldChiaW5kaW5nS2V5KSAhLmxocztcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgOiBudWxsO1xuICB9XG5cbiAgbWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWU6IEJpbmRpbmdEYXRhKSB7XG4gICAgaWYgKHZhbHVlLnByaW9yaXR5ID09PSBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQgJiZcbiAgICAgICAgdmFsdWUucmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIGlmIChzaGFyZWRDdHhPYmopIHtcbiAgICAgICAgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUgKyB0aGlzLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICB0aGlzLm1hcC5zZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgLy8gY29uc3QgY3R4X3IwID0gbmV4dENvbnRleHQoMik7XG4gICAgICAgIHJldHVybiBbbGhzLnNldChnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKSkudG9Db25zdERlY2woKV07XG4gICAgICB9LFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBwcmlvcml0eTogRGVjbGFyYXRpb25Qcmlvcml0eS5TSEFSRURfQ09OVEVYVCxcbiAgICAgIGxvY2FsUmVmOiBmYWxzZVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhO1xuICAgIGNvbXBvbmVudFZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygwLCBmYWxzZSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBsb2NhbFJlZkxvb2t1cDogYm9vbGVhbikge1xuICAgIC8vIFdlIHdhbnQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGxpc3RlbmVyIGZucyBpZjpcbiAgICAvLyAxIC0gd2UgYXJlIGFjY2Vzc2luZyBhIHZhbHVlIGluIGEgcGFyZW50IHZpZXcsIHdoaWNoIHJlcXVpcmVzIHdhbGtpbmcgdGhlIHZpZXcgdHJlZSByYXRoZXJcbiAgICAvLyB0aGFuIHVzaW5nIHRoZSBjdHggYXJnLiBJbiB0aGlzIGNhc2UsIHRoZSByZXRyaWV2YWwgYW5kIGJpbmRpbmcgbGV2ZWwgd2lsbCBiZSBkaWZmZXJlbnQuXG4gICAgLy8gMiAtIHdlIGFyZSBsb29raW5nIHVwIGEgbG9jYWwgcmVmLCB3aGljaCByZXF1aXJlcyByZXN0b3JpbmcgdGhlIHZpZXcgd2hlcmUgdGhlIGxvY2FsXG4gICAgLy8gcmVmIGlzIHN0b3JlZFxuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpICYmIChyZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsIHx8IGxvY2FsUmVmTG9va3VwKSkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgICAgLy8gcGFyZW50IHNhdmVzIHZhcmlhYmxlIHRvIGdlbmVyYXRlIGEgc2hhcmVkIGBjb25zdCAkcyQgPSBnZXRDdXJyZW50VmlldygpO2AgaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCAhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgICB9XG4gIH1cblxuICByZXN0b3JlVmlld1N0YXRlbWVudCgpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyByZXN0b3JlVmlldygkc3RhdGUkKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW2luc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSkudG9TdG10KCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnZXRDdXJyZW50VmlldygpO1xuICAgIGNvbnN0IGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uKS50b0NvbnN0RGVjbCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgaXNMaXN0ZW5lclNjb3BlKCkgeyByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDsgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5kZWNsYXJlKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICBjb25zdCBsZXZlbERpZmYgPSB0aGlzLmJpbmRpbmdMZXZlbCAtIHZhbHVlLnJldHJpZXZhbExldmVsO1xuICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICByZXR1cm4gc3RtdHMuY29uY2F0KGN1cnJTdG10cyk7XG4gICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIG91dCBvZiBhbiBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZXNcbiAqIHdoaWNoIGNhbiBiZSBhZGRlZCB0byB0aGUgaW5zdHJ1Y3Rpb24gcGFyYW1ldGVycy5cbiAqL1xuZnVuY3Rpb24gZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZTogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uW10ge1xuICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKGF0dHJpYnV0ZS52YWx1ZSlbMF07XG4gIHJldHVybiBbby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGFzTGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKV07XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGFuIGludGVycG9sYXRlZCBhdHRyaWJ1dGVcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgaW50ZXJwb2xhdGVkIHRleHQuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRUZXh0SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbik6IG8uRXh0ZXJuYWxSZWZlcmVuY2Uge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyBleHBlY3RlZCB0byBiZSBwYXNzZWQgdG8gYSBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb24gaW4gdGhlIGNhc2Ugb2ZcbiAqIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gaW50ZXJwb2xhdGlvbiBhc3RcbiAqL1xuZnVuY3Rpb24gZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBjb25zdCB7ZXhwcmVzc2lvbnMsIHN0cmluZ3N9ID0gaW50ZXJwb2xhdGlvbjtcbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzLmxlbmd0aCA9PT0gMiAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIC8vIElmIHRoZSBpbnRlcnBvbGF0aW9uIGhhcyBvbmUgaW50ZXJwb2xhdGVkIHZhbHVlLCBidXQgdGhlIHByZWZpeCBhbmQgc3VmZml4IGFyZSBib3RoIGVtcHR5XG4gICAgLy8gc3RyaW5ncywgd2Ugb25seSBwYXNzIG9uZSBhcmd1bWVudCwgdG8gYSBzcGVjaWFsIGluc3RydWN0aW9uIGxpa2UgYHByb3BlcnR5SW50ZXJwb2xhdGVgIG9yXG4gICAgLy8gYHRleHRJbnRlcnBvbGF0ZWAuXG4gICAgcmV0dXJuIDE7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25zLmxlbmd0aCArIHN0cmluZ3MubGVuZ3RoO1xuICB9XG59XG4vKipcbiAqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBtb2RpZnkgaG93IGEgdGVtcGxhdGUgaXMgcGFyc2VkIGJ5IGBwYXJzZVRlbXBsYXRlKClgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlVGVtcGxhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTpcbiAgICB7ZXJyb3JzPzogUGFyc2VFcnJvcltdLCBub2RlczogdC5Ob2RlW10sIHN0eWxlVXJsczogc3RyaW5nW10sIHN0eWxlczogc3RyaW5nW119IHtcbiAgY29uc3Qge2ludGVycG9sYXRpb25Db25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXN9ID0gb3B0aW9ucztcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKFxuICAgICAgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLFxuICAgICAgey4uLm9wdGlvbnMsIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWUsIGxlYWRpbmdUcml2aWFDaGFyczogTEVBRElOR19UUklWSUFfQ0hBUlN9KTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIGxldCByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gcGFyc2VSZXN1bHQucm9vdE5vZGVzO1xuXG4gIC8vIHByb2Nlc3MgaTE4biBtZXRhIGluZm9ybWF0aW9uIChzY2FuIGF0dHJpYnV0ZXMsIGdlbmVyYXRlIGlkcylcbiAgLy8gYmVmb3JlIHdlIHJ1biB3aGl0ZXNwYWNlIHJlbW92YWwgcHJvY2VzcywgYmVjYXVzZSBleGlzdGluZyBpMThuXG4gIC8vIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIHJvb3ROb2RlcyA9XG4gICAgICBodG1sLnZpc2l0QWxsKG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgIXByZXNlcnZlV2hpdGVzcGFjZXMpLCByb290Tm9kZXMpO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3ZSByZW1vdmUgd2hpdGVzcGFjZXMsIGJlY2F1c2VcbiAgICAvLyB0aGF0IG1pZ2h0IGFmZmVjdCBnZW5lcmF0ZWQgaTE4biBtZXNzYWdlIGNvbnRlbnQuIER1cmluZyB0aGlzIHBhc3NcbiAgICAvLyBpMThuIElEcyBnZW5lcmF0ZWQgYXQgdGhlIGZpcnN0IHBhc3Mgd2lsbCBiZSBwcmVzZXJ2ZWQsIHNvIHdlIGNhbiBtaW1pY1xuICAgIC8vIGV4aXN0aW5nIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pXG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChcbiAgICAgICAgbmV3IEkxOG5NZXRhVmlzaXRvcihpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovIGZhbHNlKSwgcm9vdE5vZGVzKTtcbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgZXJyb3JzLCBzdHlsZVVybHMsIHN0eWxlc30gPSBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIHN0eWxlVXJscywgc3R5bGVzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKFxuICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQmluZGluZ1BhcnNlciB7XG4gIHJldHVybiBuZXcgQmluZGluZ1BhcnNlcihcbiAgICAgIG5ldyBQYXJzZXIobmV3IExleGVyKCkpLCBpbnRlcnBvbGF0aW9uQ29uZmlnLCBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCksIG51bGwsIFtdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25Gbihjb250ZXh0OiBjb3JlLlNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGU/OiBib29sZWFuKSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlzQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUoY2hpbGRyZW46IHQuTm9kZVtdKTogY2hpbGRyZW4gaXNbdC5FbGVtZW50XSB7XG4gIHJldHVybiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LkVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGlzVGV4dE5vZGUobm9kZTogdC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgdC5UZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5JY3U7XG59XG5cbmZ1bmN0aW9uIGhhc1RleHRDaGlsZHJlbk9ubHkoY2hpbGRyZW46IHQuTm9kZVtdKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGlsZHJlbi5ldmVyeShpc1RleHROb2RlKTtcbn1cblxuaW50ZXJmYWNlIENoYWluYWJsZVByb3BlcnR5QmluZGluZyB7XG4gIG5hbWU6IHN0cmluZztcbiAgaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGU7XG4gIHZhbHVlOiAoKSA9PiBvLkV4cHJlc3Npb247XG4gIHBhcmFtcz86IGFueVtdO1xufVxuIl19