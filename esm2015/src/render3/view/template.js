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
// Default selector used by `<ng-content>` if none specified
const DEFAULT_NG_CONTENT_SELECTOR = '*';
// Selector attribute name of `<ng-content>`
const NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
const NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
// List of supported global targets for event listeners
const GLOBAL_TARGET_RESOLVERS = new Map([['window', R3.resolveWindow], ['document', R3.resolveDocument], ['body', R3.resolveBody]]);
function mapBindingToInstruction(type) {
    switch (type) {
        case 0 /* Property */:
        case 4 /* Animation */:
            return R3.elementProperty;
        case 2 /* Class */:
            return R3.elementClassProp;
        case 1 /* Attribute */:
            return R3.elementAttribute;
        default:
            return undefined;
    }
}
//  if (rf & flags) { .. }
export function renderFlagCheckIfStmt(flags, statements) {
    return o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
}
export function prepareEventListenerParameters(eventAst, bindingContext, handlerName = null, scope = null) {
    const { type, name, target, phase, handler } = eventAst;
    if (target && !GLOBAL_TARGET_RESOLVERS.has(target)) {
        throw new Error(`Unexpected global target '${target}' defined for '${name}' event.
        Supported list of global targets: ${Array.from(GLOBAL_TARGET_RESOLVERS.keys())}.`);
    }
    const bindingExpr = convertActionBinding(scope, bindingContext, handler, 'b', () => error('Unexpected interpolation'), eventAst.handlerSpan);
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
        // Whether the template includes <ng-content> tags.
        this._hasNgContent = false;
        // Selectors found in the <ng-content> tags in the template.
        this._ngContentSelectors = [];
        // Number of non-default selectors found in all parent templates of this template. We need to
        // track it to properly adjust projection bucket index in the `projection` instruction.
        this._ngContentSelectorsOffset = 0;
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
        // Output the `projectionDef` instruction when some `<ng-content>` are present.
        // The `projectionDef` instruction only emitted for the component template and it is skipped for
        // nested templates (<ng-template> tags).
        if (this.level === 0 && this._hasNgContent) {
            const parameters = [];
            // Only selectors with a non-default value are generated
            if (this._ngContentSelectors.length) {
                const r3Selectors = this._ngContentSelectors.map(s => core.parseSelectorToR3Selector(s));
                parameters.push(this.constantPool.getConstLiteral(asLiteral(r3Selectors), true));
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
                this.updateInstruction(index, span, R3.i18nExp, () => [this.convertPropertyBinding(o.variable(CONTEXT_NAME), binding)]);
            });
            this.updateInstruction(index, span, R3.i18nApply, [o.literal(index)]);
        }
        if (!selfClosing) {
            this.creationInstruction(span, R3.i18nEnd);
        }
        this.i18n = null; // reset local i18n context
    }
    visitContent(ngContent) {
        this._hasNgContent = true;
        const slot = this.allocateDataSlot();
        let selectorIndex = ngContent.selector === DEFAULT_NG_CONTENT_SELECTOR ?
            0 :
            this._ngContentSelectors.push(ngContent.selector) + this._ngContentSelectorsOffset;
        const parameters = [o.literal(slot)];
        const attributes = [];
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
            parameters.push(o.literal(selectorIndex), o.literalArr(attributes));
        }
        else if (selectorIndex !== 0) {
            parameters.push(o.literal(selectorIndex));
        }
        this.creationInstruction(ngContent.sourceSpan, R3.projection, parameters);
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
                allOtherInputs.push(input);
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
        attributes.push(...this.prepareNonRenderAttrs(allOtherInputs, element.outputs, stylingBuilder));
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
        const implicit = o.variable(CONTEXT_NAME);
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
                                const binding = this.convertExpressionBinding(implicit, expression);
                                this.updateInstruction(elementIndex, element.sourceSpan, R3.i18nExp, [binding]);
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
            // code: creation and update. The creation code contains the `elementStyling` instructions
            // which will apply the collected binding values to the element. `elementStyling` is
            // designed to run inside of `elementStart` and `elementEnd`. The update instructions
            // (things like `elementStyleProp`, `elementClassProp`, etc..) are applied later on in this
            // file
            this.processStylingInstruction(implicit, stylingBuilder.buildElementStylingInstruction(element.sourceSpan, this.constantPool), true);
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
        // update block of the template function AOT code. Instructions like `elementStyleProp`,
        // `elementStylingMap`, `elementClassProp` and `elementStylingApply` are all generated
        // and assign in the code below.
        stylingBuilder.buildUpdateLevelInstructions(this._valueConverter).forEach(instruction => {
            this._bindingSlots += instruction.allocateBindingSlots;
            this.processStylingInstruction(implicit, instruction, false);
        });
        // the reason why `undefined` is used is because the renderer understands this as a
        // special value to symbolize that there is no RHS to this binding
        // TODO (matsko): revisit this once FW-959 is approached
        const emptyValueBindInstruction = o.importExpr(R3.bind).callFn([o.literal(undefined)]);
        // Generate element input bindings
        allOtherInputs.forEach((input) => {
            const instruction = mapBindingToInstruction(input.type);
            if (input.type === 4 /* Animation */) {
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
                const bindingName = prepareSyntheticPropertyName(input.name);
                this.updateInstruction(elementIndex, input.sourceSpan, R3.elementProperty, () => {
                    return [
                        o.literal(elementIndex), o.literal(bindingName),
                        (hasValue ? this.convertPropertyBinding(implicit, value) : emptyValueBindInstruction)
                    ];
                });
            }
            else if (instruction) {
                // we must skip attributes with associated i18n context, since these attributes are handled
                // separately and corresponding `i18nExp` and `i18nApply` instructions will be generated
                if (input.i18n)
                    return;
                const value = input.value.visit(this._valueConverter);
                if (value !== undefined) {
                    const params = [];
                    const [attrNamespace, attrName] = splitNsName(input.name);
                    const isAttributeBinding = input.type === 1 /* Attribute */;
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
                    this.updateInstruction(elementIndex, input.sourceSpan, instruction, () => {
                        return [
                            o.literal(elementIndex), o.literal(attrName),
                            this.convertPropertyBinding(implicit, value), ...params
                        ];
                    });
                }
            }
            else {
                this._unsupported(`binding type ${input.type}`);
            }
        });
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
        const contextName = `${tagName ? this.contextName + '_' + tagName : ''}_${templateIndex}`;
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
            const templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables, this._ngContentSelectors.length + this._ngContentSelectorsOffset, template.i18n);
            this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
            if (templateVisitor._hasNgContent) {
                this._hasNgContent = true;
                this._ngContentSelectors.push(...templateVisitor._ngContentSelectors);
            }
        });
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(template.sourceSpan, R3.templateCreate, () => {
            parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
            return trimTrailingNulls(parameters);
        });
        // handle property bindings e.g. ɵɵelementProperty(1, 'ngForOf', ɵɵbind(ctx.items));
        const context = o.variable(CONTEXT_NAME);
        this.templatePropertyBindings(template, templateIndex, context, template.templateAttrs);
        // Only add normal input/output binding instructions on explicit ng-template elements.
        if (template.tagName === NG_TEMPLATE_TAG_NAME) {
            // Add the input bindings
            this.templatePropertyBindings(template, templateIndex, context, template.inputs);
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
        this.updateInstruction(nodeIndex, text.sourceSpan, R3.textBinding, () => [o.literal(nodeIndex), this.convertPropertyBinding(o.variable(CONTEXT_NAME), value)]);
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
        return this._hasNgContent ?
            this.constantPool.getConstLiteral(asLiteral(this._ngContentSelectors), true) :
            null;
    }
    bindingContext() { return `${this._bindingContext++}`; }
    templatePropertyBindings(template, templateIndex, context, attrs) {
        attrs.forEach(input => {
            if (input instanceof t.BoundAttribute) {
                const value = input.value.visit(this._valueConverter);
                this.allocateBindingSlots(value);
                this.updateInstruction(templateIndex, template.sourceSpan, R3.elementProperty, () => {
                    return [
                        o.literal(templateIndex), o.literal(input.name),
                        this.convertPropertyBinding(context, value)
                    ];
                });
            }
        });
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
    processStylingInstruction(implicit, instruction, createMode) {
        if (instruction) {
            const paramsFn = () => instruction.buildParams(value => this.convertPropertyBinding(implicit, value, true));
            if (createMode) {
                this.creationInstruction(instruction.sourceSpan, instruction.reference, paramsFn);
            }
            else {
                this.updateInstruction(-1, instruction.sourceSpan, instruction.reference, paramsFn);
            }
        }
    }
    creationInstruction(span, reference, paramsOrFn, prepend) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
    }
    updateInstruction(nodeIndex, span, reference, paramsOrFn) {
        if (this._lastNodeIndexWithFlush < nodeIndex) {
            this.instructionFn(this._updateCodeFns, span, R3.select, [o.literal(nodeIndex)]);
            this._lastNodeIndexWithFlush = nodeIndex;
        }
        this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
    }
    allocatePureFunctionSlots(numSlots) {
        const originalSlots = this._pureFunctionSlots;
        this._pureFunctionSlots += numSlots;
        return originalSlots;
    }
    allocateBindingSlots(value) {
        this._bindingSlots += value instanceof Interpolation ? value.expressions.length : 1;
    }
    convertExpressionBinding(implicit, value) {
        const convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple);
        const valExpr = convertedPropertyBinding.currValExpr;
        return o.importExpr(R3.bind).callFn([valExpr]);
    }
    convertPropertyBinding(implicit, value, skipBindFn) {
        const interpolationFn = value instanceof Interpolation ? interpolate : () => error('Unexpected interpolation');
        const convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple, interpolationFn);
        this._tempVariables.push(...convertedPropertyBinding.stmts);
        const valExpr = convertedPropertyBinding.currValExpr;
        return value instanceof Interpolation || skipBindFn ? valExpr :
            o.importExpr(R3.bind).callFn([valExpr]);
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
     *   TEMPLATE, name4, name5, ...]
     * ```
     *
     * Note that this function will fully ignore all synthetic (@foo) attribute values
     * because those values are intended to always be generated as property instructions.
     */
    prepareNonRenderAttrs(inputs, outputs, styles, templateAttrs = []) {
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
            const context = o.variable(CONTEXT_NAME);
            return prepareEventListenerParameters(outputAst, context, handlerName, scope);
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
    getLocal(name) { return this.get(name); }
    nestedScope(level) {
        const newScope = new BindingScope(level, this);
        if (level > 0)
            newScope.generateSharedContextVar(0);
        return newScope;
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
    const parseResult = htmlParser.parse(template, templateUrl, Object.assign({}, options, { tokenizeExpansionForms: true }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRXZKLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQW1CLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ25PLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHNDQUFzQyxDQUFDO0FBRXZHLE9BQU8sRUFBQyxhQUFhLElBQUksa0JBQWtCLEVBQUUsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdEYsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sMENBQTBDLENB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T0FBTyxJQUFJLENBQUM7S0FDZjtBQUNILENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLFFBQWtCO0lBQ2pELE9BQU8sUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbkUsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLElBQVk7SUFDOUIsT0FBTyxJQUFJLFlBQVksQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFNBQVMsSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUN4RixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxRQUFrQjtJQUM3QyxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDcEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtJMThuQ29udGV4dH0gZnJvbSAnLi9pMThuL2NvbnRleHQnO1xuaW1wb3J0IHtJMThuTWV0YVZpc2l0b3J9IGZyb20gJy4vaTE4bi9tZXRhJztcbmltcG9ydCB7Z2V0U2VyaWFsaXplZEkxOG5Db250ZW50fSBmcm9tICcuL2kxOG4vc2VyaWFsaXplcic7XG5pbXBvcnQge0kxOE5fSUNVX01BUFBJTkdfUFJFRklYLCBUUkFOU0xBVElPTl9QUkVGSVgsIGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzLCBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZywgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZSwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeCwgZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgbWV0YUZyb21JMThuTWVzc2FnZSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7SW5zdHJ1Y3Rpb24sIFN0eWxpbmdCdWlsZGVyfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSU1QTElDSVRfUkVGRVJFTkNFLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBhc0xpdGVyYWwsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcsIGludmFsaWQsIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuLy8gRGVmYXVsdCBzZWxlY3RvciB1c2VkIGJ5IGA8bmctY29udGVudD5gIGlmIG5vbmUgc3BlY2lmaWVkXG5jb25zdCBERUZBVUxUX05HX0NPTlRFTlRfU0VMRUNUT1IgPSAnKic7XG5cbi8vIFNlbGVjdG9yIGF0dHJpYnV0ZSBuYW1lIG9mIGA8bmctY29udGVudD5gXG5jb25zdCBOR19DT05URU5UX1NFTEVDVF9BVFRSID0gJ3NlbGVjdCc7XG5cbi8vIEF0dHJpYnV0ZSBuYW1lIG9mIGBuZ1Byb2plY3RBc2AuXG5jb25zdCBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSA9ICduZ1Byb2plY3RBcyc7XG5cbi8vIExpc3Qgb2Ygc3VwcG9ydGVkIGdsb2JhbCB0YXJnZXRzIGZvciBldmVudCBsaXN0ZW5lcnNcbmNvbnN0IEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTID0gbmV3IE1hcDxzdHJpbmcsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFxuICAgIFtbJ3dpbmRvdycsIFIzLnJlc29sdmVXaW5kb3ddLCBbJ2RvY3VtZW50JywgUjMucmVzb2x2ZURvY3VtZW50XSwgWydib2R5JywgUjMucmVzb2x2ZUJvZHldXSk7XG5cbmZ1bmN0aW9uIG1hcEJpbmRpbmdUb0luc3RydWN0aW9uKHR5cGU6IEJpbmRpbmdUeXBlKTogby5FeHRlcm5hbFJlZmVyZW5jZXx1bmRlZmluZWQge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgIGNhc2UgQmluZGluZ1R5cGUuQW5pbWF0aW9uOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRQcm9wZXJ0eTtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRDbGFzc1Byb3A7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudEF0dHJpYnV0ZTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgYmluZGluZ0NvbnRleHQ6IG8uRXhwcmVzc2lvbiwgaGFuZGxlck5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGUgfCBudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgIHNjb3BlLCBiaW5kaW5nQ29udGV4dCwgaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyksXG4gICAgICBldmVudEFzdC5oYW5kbGVyU3Bhbik7XG5cbiAgY29uc3Qgc3RhdGVtZW50cyA9IFtdO1xuICBpZiAoc2NvcGUpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSk7XG4gICAgc3RhdGVtZW50cy5wdXNoKC4uLnNjb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkpO1xuICB9XG4gIHN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5yZW5kZXIzU3RtdHMpO1xuXG4gIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID1cbiAgICAgIHR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lKG5hbWUsIHBoYXNlICEpIDogbmFtZTtcbiAgY29uc3QgZm5OYW1lID0gaGFuZGxlck5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGhhbmRsZXJOYW1lKTtcbiAgY29uc3QgZm5BcmdzID0gW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV07XG4gIGNvbnN0IGhhbmRsZXJGbiA9IG8uZm4oZm5BcmdzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZuTmFtZSk7XG5cbiAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZXZlbnROYW1lKSwgaGFuZGxlckZuXTtcbiAgaWYgKHRhcmdldCkge1xuICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoZmFsc2UpLCAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICAgICAgby5pbXBvcnRFeHByKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmdldCh0YXJnZXQpICEpKTtcbiAgfVxuICByZXR1cm4gcGFyYW1zO1xufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuIFRoaXMgZW5zdXJlc1xuICAgKiBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIE1lbW9yaXplcyB0aGUgbGFzdCBub2RlIGluZGV4IGZvciB3aGljaCBhIHNlbGVjdCBpbnN0cnVjdGlvbiBoYXMgYmVlbiBnZW5lcmF0ZWQuXG4gICAqIFdlJ3JlIGluaXRpYWxpemluZyB0aGlzIHRvIC0xIHRvIGVuc3VyZSB0aGUgYHNlbGVjdCgwKWAgaW5zdHJ1Y3Rpb24gaXMgZ2VuZXJhdGVkIGJlZm9yZSBhbnlcbiAgICogcmVsZXZhbnQgdXBkYXRlIGluc3RydWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgX2xhc3ROb2RlSW5kZXhXaXRoRmx1c2g6IG51bWJlciA9IC0xO1xuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gV2hldGhlciB0aGUgdGVtcGxhdGUgaW5jbHVkZXMgPG5nLWNvbnRlbnQ+IHRhZ3MuXG4gIHByaXZhdGUgX2hhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIC8vIFNlbGVjdG9ycyBmb3VuZCBpbiB0aGUgPG5nLWNvbnRlbnQ+IHRhZ3MgaW4gdGhlIHRlbXBsYXRlLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIGJ1Y2tldCBpbmRleCBpbiB0aGUgYHByb2plY3Rpb25gIGluc3RydWN0aW9uLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHByaXZhdGUgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyxcbiAgICAgIHByaXZhdGUgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHZhcmlhYmxlOiB0LlZhcmlhYmxlKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZS5uYW1lICsgc2NvcGVkTmFtZSk7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHZhcmlhYmxlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIG5nQ29udGVudFNlbGVjdG9yc09mZnNldDogbnVtYmVyID0gMCxcbiAgICAgIGkxOG4/OiBpMThuLkFTVCk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID1cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dCB8fCAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuICEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIGFyZSBwcmVzZW50LlxuICAgIC8vIFRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gb25seSBlbWl0dGVkIGZvciB0aGUgY29tcG9uZW50IHRlbXBsYXRlIGFuZCBpdCBpcyBza2lwcGVkIGZvclxuICAgIC8vIG5lc3RlZCB0ZW1wbGF0ZXMgKDxuZy10ZW1wbGF0ZT4gdGFncykuXG4gICAgaWYgKHRoaXMubGV2ZWwgPT09IDAgJiYgdGhpcy5faGFzTmdDb250ZW50KSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBPbmx5IHNlbGVjdG9ycyB3aXRoIGEgbm9uLWRlZmF1bHQgdmFsdWUgYXJlIGdlbmVyYXRlZFxuICAgICAgaWYgKHRoaXMuX25nQ29udGVudFNlbGVjdG9ycy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNTZWxlY3RvcnMpLCB0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbmNlIHdlIGFjY3VtdWxhdGUgbmdDb250ZW50IHNlbGVjdG9ycyB3aGlsZSBwcm9jZXNzaW5nIHRlbXBsYXRlIGVsZW1lbnRzLFxuICAgICAgLy8gd2UgKnByZXBlbmQqIGBwcm9qZWN0aW9uRGVmYCB0byBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYmxvY2ssIHRvIHB1dCBpdCBiZWZvcmVcbiAgICAgIC8vIGFueSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb25zXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycywgLyogcHJlcGVuZCAqLyB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gdGhpcy5fdXBkYXRlQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyAgVmFyaWFibGUgZGVjbGFyYXRpb24gbXVzdCBvY2N1ciBhZnRlciBiaW5kaW5nIHJlc29sdXRpb24gc28gd2UgY2FuIGdlbmVyYXRlIGNvbnRleHRcbiAgICAvLyAgaW5zdHJ1Y3Rpb25zIHRoYXQgYnVpbGQgb24gZWFjaCBvdGhlci5cbiAgICAvLyBlLmcuIGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpLiRpbXBsaWNpdCgpOyBjb25zdCBiID0gbmV4dENvbnRleHQoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7IHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpOyB9XG5cbiAgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBfcGFyYW1zOiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICAgIGlmIChwYXJhbXMgJiYgT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhcmFtcykuZm9yRWFjaChrZXkgPT4gX3BhcmFtc1tmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lKGtleSldID0gcGFyYW1zW2tleV0pO1xuICAgIH1cbiAgICBjb25zdCBtZXRhID0gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlKTtcbiAgICBjb25zdCBjb250ZW50ID0gZ2V0U2VyaWFsaXplZEkxOG5Db250ZW50KG1lc3NhZ2UpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPVxuICAgICAgICBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhfcmVmLCBjbG9zdXJlVmFyLCBjb250ZW50LCBtZXRhLCBfcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zOiBBU1RbXSkge1xuICAgIGlmIChleHByZXNzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBleHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4gdGhpcy5pMThuICEuYXBwZW5kQmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgfVxuICB9XG5cbiAgaTE4bkJpbmRQcm9wcyhwcm9wczoge1trZXk6IHN0cmluZ106IHQuVGV4dCB8IHQuQm91bmRUZXh0fSk6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259IHtcbiAgICBjb25zdCBib3VuZDoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IHByb3BzW2tleV07XG4gICAgICBpZiAocHJvcCBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKHByb3AudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnN9ID0gdmFsdWU7XG4gICAgICAgICAgY29uc3Qge2lkLCBiaW5kaW5nc30gPSB0aGlzLmkxOG4gITtcbiAgICAgICAgICBjb25zdCBsYWJlbCA9IGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nKHN0cmluZ3MsIGJpbmRpbmdzLnNpemUsIGlkKTtcbiAgICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9ucyk7XG4gICAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChsYWJlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH1cblxuICBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKG1lc3NhZ2VJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMpIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgICAgY29uc3QgdW5pcXVlU3VmZml4ID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgICAgbmFtZSA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG4gIH1cblxuICBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIGkxOG5TdGFydChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIG1ldGE6IGkxOG4uQVNULCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG4gPSB0aGlzLmkxOG5Db250ZXh0LmZvcmtDaGlsZENvbnRleHQoaW5kZXgsIHRoaXMudGVtcGxhdGVJbmRleCAhLCBtZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVmID0gby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1BSRUZJWCkpO1xuICAgICAgdGhpcy5pMThuID0gbmV3IEkxOG5Db250ZXh0KGluZGV4LCByZWYsIDAsIHRoaXMudGVtcGxhdGVJbmRleCwgbWV0YSk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgaTE4blN0YXJ0IGluc3RydWN0aW9uXG4gICAgY29uc3Qge2lkLCByZWZ9ID0gdGhpcy5pMThuO1xuICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGluZGV4KSwgcmVmXTtcbiAgICBpZiAoaWQgPiAwKSB7XG4gICAgICAvLyBkbyBub3QgcHVzaCAzcmQgYXJndW1lbnQgKHN1Yi1ibG9jayBpZClcbiAgICAgIC8vIGludG8gaTE4blN0YXJ0IGNhbGwgZm9yIHRvcCBsZXZlbCBpMThuIGNvbnRleHRcbiAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpZCkpO1xuICAgIH1cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3Bhbiwgc2VsZkNsb3NpbmcgPyBSMy5pMThuIDogUjMuaTE4blN0YXJ0LCBwYXJhbXMpO1xuICB9XG5cbiAgaTE4bkVuZChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2kxOG5FbmQgaXMgZXhlY3V0ZWQgd2l0aCBubyBpMThuIGNvbnRleHQgcHJlc2VudCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5Db250ZXh0LnJlY29uY2lsZUNoaWxkQ29udGV4dCh0aGlzLmkxOG4pO1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bkNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuKTtcbiAgICB9XG5cbiAgICAvLyBzZXR1cCBhY2N1bXVsYXRlZCBiaW5kaW5nc1xuICAgIGNvbnN0IHtpbmRleCwgYmluZGluZ3N9ID0gdGhpcy5pMThuO1xuICAgIGlmIChiaW5kaW5ncy5zaXplKSB7XG4gICAgICBiaW5kaW5ncy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgaW5kZXgsIHNwYW4sIFIzLmkxOG5FeHAsXG4gICAgICAgICAgICAoKSA9PiBbdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgYmluZGluZyldKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbmRleCwgc3BhbiwgUjMuaTE4bkFwcGx5LCBbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIH1cbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkVuZCk7XG4gICAgfVxuICAgIHRoaXMuaTE4biA9IG51bGw7ICAvLyByZXNldCBsb2NhbCBpMThuIGNvbnRleHRcbiAgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIHRoaXMuX2hhc05nQ29udGVudCA9IHRydWU7XG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGxldCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9yID09PSBERUZBVUxUX05HX0NPTlRFTlRfU0VMRUNUT1IgP1xuICAgICAgICAwIDpcbiAgICAgICAgdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKSArIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5mb3JFYWNoKChhdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IHtuYW1lLCB2YWx1ZX0gPSBhdHRyaWJ1dGU7XG4gICAgICBpZiAobmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKC4uLmdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyaWJ1dGUpKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS50b0xvd2VyQ2FzZSgpICE9PSBOR19DT05URU5UX1NFTEVDVF9BVFRSKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwobmFtZSksIG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChzZWxlY3RvckluZGV4KSwgby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gIH1cblxuXG4gIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzdHlsaW5nQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgbnVsbCk7XG5cbiAgICBsZXQgaXNOb25CaW5kYWJsZU1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudDogYm9vbGVhbiA9XG4gICAgICAgIGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShlbGVtZW50LmkxOG4pO1xuXG4gICAgaWYgKGlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG5BdHRyczogKHQuVGV4dEF0dHJpYnV0ZSB8IHQuQm91bmRBdHRyaWJ1dGUpW10gPSBbXTtcbiAgICBjb25zdCBvdXRwdXRBdHRyczogdC5UZXh0QXR0cmlidXRlW10gPSBbXTtcblxuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gSGFuZGxlIHN0eWxpbmcsIGkxOG4sIG5nTm9uQmluZGFibGUgYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHtuYW1lLCB2YWx1ZX0gPSBhdHRyO1xuICAgICAgaWYgKG5hbWUgPT09IE5PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICAgIGlzTm9uQmluZGFibGVNb2RlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGF0dHIuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXRBdHRycy5wdXNoKGF0dHIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBhbGxPdGhlcklucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID0gc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJCb3VuZElucHV0KGlucHV0KTtcbiAgICAgIGlmICghc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJiBpbnB1dC5pMThuKSB7XG4gICAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBpbnRvIGEgc2VwYXJhdGUgYXJyYXkgZm9yIGkxOG4gcHJvY2Vzc2luZywgYnV0IGFsc28ga2VlcCBzdWNoXG4gICAgICAgICAgLy8gYXR0cmlidXRlcyBpbiB0aGUgbWFpbiBsaXN0IHRvIG1ha2UgdGhlbSBhdmFpbGFibGUgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBhdCBydW50aW1lLlxuICAgICAgICAgIC8vIFRPRE8oRlctMTI0OCk6IHByZXZlbnQgYXR0cmlidXRlcyBkdXBsaWNhdGlvbiBpbiBgaTE4bkF0dHJpYnV0ZXNgIGFuZCBgZWxlbWVudFN0YXJ0YFxuICAgICAgICAgIC8vIGFyZ3VtZW50c1xuICAgICAgICAgIGkxOG5BdHRycy5wdXNoKGlucHV0KTtcbiAgICAgICAgfVxuICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG91dHB1dEF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBpZiAoYXR0ci5uYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgby5saXRlcmFsKGF0dHIudmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBhdHRyaWJ1dGVzLnB1c2goLi4udGhpcy5wcmVwYXJlTm9uUmVuZGVyQXR0cnMoYWxsT3RoZXJJbnB1dHMsIGVsZW1lbnQub3V0cHV0cywgc3R5bGluZ0J1aWxkZXIpKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy50b0F0dHJzUGFyYW0oYXR0cmlidXRlcykpO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8ZGl2ICNmb28gI2Jhcj1cImJhelwiPilcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcihlbGVtZW50LnJlZmVyZW5jZXMpKTtcblxuICAgIGNvbnN0IHdhc0luTmFtZXNwYWNlID0gdGhpcy5fbmFtZXNwYWNlO1xuICAgIGNvbnN0IGN1cnJlbnROYW1lc3BhY2UgPSB0aGlzLmdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleSk7XG5cbiAgICAvLyBJZiB0aGUgbmFtZXNwYWNlIGlzIGNoYW5naW5nIG5vdywgaW5jbHVkZSBhbiBpbnN0cnVjdGlvbiB0byBjaGFuZ2UgaXRcbiAgICAvLyBkdXJpbmcgZWxlbWVudCBjcmVhdGlvbi5cbiAgICBpZiAoY3VycmVudE5hbWVzcGFjZSAhPT0gd2FzSW5OYW1lc3BhY2UpIHtcbiAgICAgIHRoaXMuYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24oY3VycmVudE5hbWVzcGFjZSwgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1wbGljaXQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4gISwgZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICBjb25zdCBoYXNDaGlsZHJlbiA9ICgpID0+IHtcbiAgICAgIGlmICghaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICAgIC8vIHdlIGRvIG5vdCBhcHBlbmQgdGV4dCBub2RlIGluc3RydWN0aW9ucyBhbmQgSUNVcyBpbnNpZGUgaTE4biBzZWN0aW9uLFxuICAgICAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgICAgIHJldHVybiAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgfTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhc3R5bGluZ0J1aWxkZXIuaGFzQmluZGluZ3MgJiYgIWlzTmdDb250YWluZXIgJiZcbiAgICAgICAgZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA9PT0gMCAmJiBpMThuQXR0cnMubGVuZ3RoID09PSAwICYmICFoYXNDaGlsZHJlbigpO1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJlxuICAgICAgICAhc3R5bGluZ0J1aWxkZXIuaGFzQmluZGluZ3MgJiYgaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKTtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50LCB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcHJvY2VzcyBpMThuIGVsZW1lbnQgYXR0cmlidXRlc1xuICAgICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgaTE4bkF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF0dHIuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuICAgICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgdC5UZXh0QXR0cmlidXRlKSB7XG4gICAgICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgY29udmVydGVkID0gYXR0ci52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKGNvbnZlcnRlZCk7XG4gICAgICAgICAgICBpZiAoY29udmVydGVkIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKTtcbiAgICAgICAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwYXJhbXMpKTtcbiAgICAgICAgICAgICAgY29udmVydGVkLmV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICAgICAgICAgICAgaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpbmRpbmcgPSB0aGlzLmNvbnZlcnRFeHByZXNzaW9uQmluZGluZyhpbXBsaWNpdCwgZXhwcmVzc2lvbik7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihlbGVtZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkV4cCwgW2JpbmRpbmddKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGkxOG5BdHRyQXJncy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBpbmRleDogby5FeHByZXNzaW9uID0gby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKTtcbiAgICAgICAgICBjb25zdCBhcmdzID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpMThuQXR0ckFyZ3MpLCB0cnVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5pMThuQXR0cmlidXRlcywgW2luZGV4LCBhcmdzXSk7XG4gICAgICAgICAgaWYgKGhhc0JpbmRpbmdzKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5pMThuQXBwbHksIFtpbmRleF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaGUgc3R5bGUgYmluZGluZ3MgY29kZSBpcyBwbGFjZWQgaW50byB0d28gZGlzdGluY3QgYmxvY2tzIHdpdGhpbiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UXG4gICAgICAvLyBjb2RlOiBjcmVhdGlvbiBhbmQgdXBkYXRlLiBUaGUgY3JlYXRpb24gY29kZSBjb250YWlucyB0aGUgYGVsZW1lbnRTdHlsaW5nYCBpbnN0cnVjdGlvbnNcbiAgICAgIC8vIHdoaWNoIHdpbGwgYXBwbHkgdGhlIGNvbGxlY3RlZCBiaW5kaW5nIHZhbHVlcyB0byB0aGUgZWxlbWVudC4gYGVsZW1lbnRTdHlsaW5nYCBpc1xuICAgICAgLy8gZGVzaWduZWQgdG8gcnVuIGluc2lkZSBvZiBgZWxlbWVudFN0YXJ0YCBhbmQgYGVsZW1lbnRFbmRgLiBUaGUgdXBkYXRlIGluc3RydWN0aW9uc1xuICAgICAgLy8gKHRoaW5ncyBsaWtlIGBlbGVtZW50U3R5bGVQcm9wYCwgYGVsZW1lbnRDbGFzc1Byb3BgLCBldGMuLikgYXJlIGFwcGxpZWQgbGF0ZXIgb24gaW4gdGhpc1xuICAgICAgLy8gZmlsZVxuICAgICAgdGhpcy5wcm9jZXNzU3R5bGluZ0luc3RydWN0aW9uKFxuICAgICAgICAgIGltcGxpY2l0LFxuICAgICAgICAgIHN0eWxpbmdCdWlsZGVyLmJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIHRoaXMuY29uc3RhbnRQb29sKSxcbiAgICAgICAgICB0cnVlKTtcblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKGVsZW1lbnQubmFtZSwgb3V0cHV0QXN0LCBlbGVtZW50SW5kZXgpKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3RlOiBpdCdzIGltcG9ydGFudCB0byBrZWVwIGkxOG4vaTE4blN0YXJ0IGluc3RydWN0aW9ucyBhZnRlciBpMThuQXR0cmlidXRlcyBhbmRcbiAgICAgIC8vIGxpc3RlbmVycywgdG8gbWFrZSBzdXJlIGkxOG5BdHRyaWJ1dGVzIGluc3RydWN0aW9uIHRhcmdldHMgY3VycmVudCBlbGVtZW50IGF0IHJ1bnRpbWUuXG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuU3RhcnQoZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4gISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBlbGVtZW50U3R5bGVQcm9wYCxcbiAgICAvLyBgZWxlbWVudFN0eWxpbmdNYXBgLCBgZWxlbWVudENsYXNzUHJvcGAgYW5kIGBlbGVtZW50U3R5bGluZ0FwcGx5YCBhcmUgYWxsIGdlbmVyYXRlZFxuICAgIC8vIGFuZCBhc3NpZ24gaW4gdGhlIGNvZGUgYmVsb3cuXG4gICAgc3R5bGluZ0J1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh0aGlzLl92YWx1ZUNvbnZlcnRlcikuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gaW5zdHJ1Y3Rpb24uYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICB0aGlzLnByb2Nlc3NTdHlsaW5nSW5zdHJ1Y3Rpb24oaW1wbGljaXQsIGluc3RydWN0aW9uLCBmYWxzZSk7XG4gICAgfSk7XG5cbiAgICAvLyB0aGUgcmVhc29uIHdoeSBgdW5kZWZpbmVkYCBpcyB1c2VkIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHVuZGVyc3RhbmRzIHRoaXMgYXMgYVxuICAgIC8vIHNwZWNpYWwgdmFsdWUgdG8gc3ltYm9saXplIHRoYXQgdGhlcmUgaXMgbm8gUkhTIHRvIHRoaXMgYmluZGluZ1xuICAgIC8vIFRPRE8gKG1hdHNrbyk6IHJldmlzaXQgdGhpcyBvbmNlIEZXLTk1OSBpcyBhcHByb2FjaGVkXG4gICAgY29uc3QgZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvbiA9IG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW28ubGl0ZXJhbCh1bmRlZmluZWQpXSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgYWxsT3RoZXJJbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcblxuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBtYXBCaW5kaW5nVG9JbnN0cnVjdGlvbihpbnB1dC50eXBlKTtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIGFuaW1hdGlvbiBiaW5kaW5ncyBjYW4gYmUgcHJlc2VudGVkIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgLy8gMS4gW0BiaW5kaW5nXT1cImZvb0V4cFwiXG4gICAgICAgIC8vIDIuIFtAYmluZGluZ109XCJ7dmFsdWU6Zm9vRXhwLCBwYXJhbXM6ey4uLn19XCJcbiAgICAgICAgLy8gMy4gW0BiaW5kaW5nXVxuICAgICAgICAvLyA0LiBAYmluZGluZ1xuICAgICAgICAvLyBBbGwgZm9ybWF0cyB3aWxsIGJlIHZhbGlkIGZvciB3aGVuIGEgc3ludGhldGljIGJpbmRpbmcgaXMgY3JlYXRlZC5cbiAgICAgICAgLy8gVGhlIHJlYXNvbmluZyBmb3IgdGhpcyBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciBzaG91bGQgZ2V0IGVhY2hcbiAgICAgICAgLy8gc3ludGhldGljIGJpbmRpbmcgdmFsdWUgaW4gdGhlIG9yZGVyIG9mIHRoZSBhcnJheSB0aGF0IHRoZXkgYXJlXG4gICAgICAgIC8vIGRlZmluZWQgaW4uLi5cbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIExpdGVyYWxQcmltaXRpdmUgPyAhIXZhbHVlLnZhbHVlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdOYW1lID0gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRQcm9wZXJ0eSwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGJpbmRpbmdOYW1lKSxcbiAgICAgICAgICAgIChoYXNWYWx1ZSA/IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUpIDogZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvbilcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgLy8gd2UgbXVzdCBza2lwIGF0dHJpYnV0ZXMgd2l0aCBhc3NvY2lhdGVkIGkxOG4gY29udGV4dCwgc2luY2UgdGhlc2UgYXR0cmlidXRlcyBhcmUgaGFuZGxlZFxuICAgICAgICAvLyBzZXBhcmF0ZWx5IGFuZCBjb3JyZXNwb25kaW5nIGBpMThuRXhwYCBhbmQgYGkxOG5BcHBseWAgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICAgIGlmIChpbnB1dC5pMThuKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IFthdHRyTmFtZXNwYWNlLCBhdHRyTmFtZV0gPSBzcGxpdE5zTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBpc0F0dHJpYnV0ZUJpbmRpbmcgPSBpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LnNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGVCaW5kaW5nKTtcbiAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VMaXRlcmFsID0gby5saXRlcmFsKGF0dHJOYW1lc3BhY2UpO1xuXG4gICAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2Fzbid0IGEgc2FuaXRpemF0aW9uIHJlZiwgd2UgbmVlZCB0byBhZGRcbiAgICAgICAgICAgICAgLy8gYW4gZXh0cmEgcGFyYW0gc28gdGhhdCB3ZSBjYW4gcGFzcyBpbiB0aGUgbmFtZXNwYWNlLlxuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCksIG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwoYXR0ck5hbWUpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91bnN1cHBvcnRlZChgYmluZGluZyB0eXBlICR7aW5wdXQudHlwZX1gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICBjb25zdCBzcGFuID0gZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5FbmQoc3BhbiwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZSh0ZW1wbGF0ZS5pMThuICEsIHRlbXBsYXRlSW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSB8fCAnJyk7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0YWdOYW1lID8gdGhpcy5jb250ZXh0TmFtZSArICdfJyArIHRhZ05hbWUgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuXG4gICAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgICAgLy8gaXQgYmFzZWQgb24gdGhlIHBhcmVudCBub2RlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLlxuICAgICAgby5saXRlcmFsKHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWUpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKFxuICAgICAgICAoYTogdC5UZXh0QXR0cmlidXRlKSA9PiB7IGF0dHJzRXhwcnMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKGEudmFsdWUpKTsgfSk7XG4gICAgYXR0cnNFeHBycy5wdXNoKC4uLnRoaXMucHJlcGFyZU5vblJlbmRlckF0dHJzKFxuICAgICAgICB0ZW1wbGF0ZS5pbnB1dHMsIHRlbXBsYXRlLm91dHB1dHMsIHVuZGVmaW5lZCwgdGVtcGxhdGUudGVtcGxhdGVBdHRycykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIodGVtcGxhdGUucmVmZXJlbmNlcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sXG4gICAgICAgIHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlTmFtZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsXG4gICAgICAgIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LCB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCArIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCwgdGVtcGxhdGUuaTE4bik7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdCh0ZW1wbGF0ZU5hbWUsIG51bGwpKTtcbiAgICAgIGlmICh0ZW1wbGF0ZVZpc2l0b3IuX2hhc05nQ29udGVudCkge1xuICAgICAgICB0aGlzLl9oYXNOZ0NvbnRlbnQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnMucHVzaCguLi50ZW1wbGF0ZVZpc2l0b3IuX25nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoXG4gICAgICAgICAgMiwgMCwgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuXG4gICAgLy8gaGFuZGxlIHByb3BlcnR5IGJpbmRpbmdzIGUuZy4gybXJtWVsZW1lbnRQcm9wZXJ0eSgxLCAnbmdGb3JPZicsIMm1ybViaW5kKGN0eC5pdGVtcykpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgdGhpcy50ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3ModGVtcGxhdGUsIHRlbXBsYXRlSW5kZXgsIGNvbnRleHQsIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMpO1xuXG4gICAgLy8gT25seSBhZGQgbm9ybWFsIGlucHV0L291dHB1dCBiaW5kaW5nIGluc3RydWN0aW9ucyBvbiBleHBsaWNpdCBuZy10ZW1wbGF0ZSBlbGVtZW50cy5cbiAgICBpZiAodGVtcGxhdGUudGFnTmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUpIHtcbiAgICAgIC8vIEFkZCB0aGUgaW5wdXQgYmluZGluZ3NcbiAgICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlLCB0ZW1wbGF0ZUluZGV4LCBjb250ZXh0LCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICB0ZW1wbGF0ZS5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKCduZ190ZW1wbGF0ZScsIG91dHB1dEFzdCwgdGVtcGxhdGVJbmRleCkpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0aGlzLmkxOG4uYXBwZW5kQm91bmRUZXh0KHRleHQuaTE4biAhKTtcbiAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3ModmFsdWUuZXhwcmVzc2lvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgIG5vZGVJbmRleCwgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0QmluZGluZyxcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChub2RlSW5kZXgpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoby52YXJpYWJsZShDT05URVhUX05BTUUpLCB2YWx1ZSldKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuICEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4gITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuICAgIGNvbnN0IHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT5cbiAgICAgICAgaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBbcmF3LCBtYXBMaXRlcmFsKHZhcnMsIHRydWUpXSk7XG5cbiAgICAvLyBpbiBjYXNlIHRoZSB3aG9sZSBpMThuIG1lc3NhZ2UgaXMgYSBzaW5nbGUgSUNVIC0gd2UgZG8gbm90IG5lZWQgdG9cbiAgICAvLyBjcmVhdGUgYSBzZXBhcmF0ZSB0b3AtbGV2ZWwgdHJhbnNsYXRpb24sIHdlIGNhbiB1c2UgdGhlIHJvb3QgcmVmIGluc3RlYWRcbiAgICAvLyBhbmQgbWFrZSB0aGlzIElDVSBhIHRvcC1sZXZlbCB0cmFuc2xhdGlvblxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBsYWNlaG9sZGVycywgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9IHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwbGFjZWhvbGRlcnMsIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc05nQ29udGVudCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwodGhpcy5fbmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIHByaXZhdGUgdGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGU6IHQuVGVtcGxhdGUsIHRlbXBsYXRlSW5kZXg6IG51bWJlciwgY29udGV4dDogby5SZWFkVmFyRXhwcixcbiAgICAgIGF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10pIHtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRQcm9wZXJ0eSwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhjb250ZXh0LCB2YWx1ZSlcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm46IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuICAgIGZuc1twcmVwZW5kID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSgoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHBhcmFtc09yRm4pID8gcGFyYW1zT3JGbiA6IHBhcmFtc09yRm4oKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtcykudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByb2Nlc3NTdHlsaW5nSW5zdHJ1Y3Rpb24oXG4gICAgICBpbXBsaWNpdDogYW55LCBpbnN0cnVjdGlvbjogSW5zdHJ1Y3Rpb258bnVsbCwgY3JlYXRlTW9kZTogYm9vbGVhbikge1xuICAgIGlmIChpbnN0cnVjdGlvbikge1xuICAgICAgY29uc3QgcGFyYW1zRm4gPSAoKSA9PlxuICAgICAgICAgIGluc3RydWN0aW9uLmJ1aWxkUGFyYW1zKHZhbHVlID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUsIHRydWUpKTtcbiAgICAgIGlmIChjcmVhdGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihpbnN0cnVjdGlvbi5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIHBhcmFtc0ZuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oLTEsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLnJlZmVyZW5jZSwgcGFyYW1zRm4pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSwgcHJlcGVuZD86IGJvb2xlYW4pIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10sIHByZXBlbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICBpZiAodGhpcy5fbGFzdE5vZGVJbmRleFdpdGhGbHVzaCA8IG5vZGVJbmRleCkge1xuICAgICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIFIzLnNlbGVjdCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG4gICAgICB0aGlzLl9sYXN0Tm9kZUluZGV4V2l0aEZsdXNoID0gbm9kZUluZGV4O1xuICAgIH1cbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0RXhwcmVzc2lvbkJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID1cbiAgICAgICAgY29udmVydFByb3BlcnR5QmluZGluZyh0aGlzLCBpbXBsaWNpdCwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKTtcbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFt2YWxFeHByXSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCwgc2tpcEJpbmRGbj86IGJvb2xlYW4pOlxuICAgICAgby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uRm4gPVxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyBpbnRlcnBvbGF0ZSA6ICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKTtcblxuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIGltcGxpY2l0LCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsIGludGVycG9sYXRpb25Gbik7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG5cbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gfHwgc2tpcEJpbmRGbiA/IHZhbEV4cHIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW3ZhbEV4cHJdKTtcbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hEaXJlY3RpdmVzKHRhZ05hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKHRhZ05hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbCkpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKFxuICAgICAgICAgIHNlbGVjdG9yLCAoY3NzU2VsZWN0b3IsIHN0YXRpY1R5cGUpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmVzIGFsbCBhdHRyaWJ1dGUgZXhwcmVzc2lvbiB2YWx1ZXMgZm9yIHRoZSBgVEF0dHJpYnV0ZXNgIGFycmF5LlxuICAgKlxuICAgKiBUaGUgcHVycG9zZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRvIHByb3Blcmx5IGNvbnN0cnVjdCBhbiBhdHRyaWJ1dGVzIGFycmF5IHRoYXRcbiAgICogaXMgcGFzc2VkIGludG8gdGhlIGBlbGVtZW50U3RhcnRgIChvciBqdXN0IGBlbGVtZW50YCkgZnVuY3Rpb25zLiBCZWNhdXNlIHRoZXJlXG4gICAqIGFyZSBtYW55IGRpZmZlcmVudCB0eXBlcyBvZiBhdHRyaWJ1dGVzLCB0aGUgYXJyYXkgbmVlZHMgdG8gYmUgY29uc3RydWN0ZWQgaW4gYVxuICAgKiBzcGVjaWFsIHdheSBzbyB0aGF0IGBlbGVtZW50U3RhcnRgIGNhbiBwcm9wZXJseSBldmFsdWF0ZSB0aGVtLlxuICAgKlxuICAgKiBUaGUgZm9ybWF0IGxvb2tzIGxpa2UgdGhpczpcbiAgICpcbiAgICogYGBgXG4gICAqIGF0dHJzID0gW3Byb3AsIHZhbHVlLCBwcm9wMiwgdmFsdWUyLFxuICAgKiAgIENMQVNTRVMsIGNsYXNzMSwgY2xhc3MyLFxuICAgKiAgIFNUWUxFUywgc3R5bGUxLCB2YWx1ZTEsIHN0eWxlMiwgdmFsdWUyLFxuICAgKiAgIEJJTkRJTkdTLCBuYW1lMSwgbmFtZTIsIG5hbWUzLFxuICAgKiAgIFRFTVBMQVRFLCBuYW1lNCwgbmFtZTUsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBwcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sIHN0eWxlcz86IFN0eWxpbmdCdWlsZGVyLFxuICAgICAgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgYWxyZWFkeVNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBhdHRyRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBmdW5jdGlvbiBhZGRBdHRyRXhwcihrZXk6IHN0cmluZyB8IG51bWJlciwgdmFsdWU/OiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIWFscmVhZHlTZWVuLmhhcyhrZXkpKSB7XG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGtleSkpO1xuICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgYXR0ckV4cHJzLnB1c2godmFsdWUpO1xuICAgICAgICAgIGFscmVhZHlTZWVuLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoa2V5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaXQncyBpbXBvcnRhbnQgdGhhdCB0aGlzIG9jY3VycyBiZWZvcmUgQklORElOR1MgYW5kIFRFTVBMQVRFIGJlY2F1c2Ugb25jZSBgZWxlbWVudFN0YXJ0YFxuICAgIC8vIGNvbWVzIGFjcm9zcyB0aGUgQklORElOR1Mgb3IgVEVNUExBVEUgbWFya2VycyB0aGVuIGl0IHdpbGwgY29udGludWUgcmVhZGluZyBlYWNoIHZhbHVlIGFzXG4gICAgLy8gYXMgc2luZ2xlIHByb3BlcnR5IHZhbHVlIGNlbGwgYnkgY2VsbC5cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJFeHBycyk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHJzU3RhcnRJbmRleCA9IGF0dHJFeHBycy5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzW2ldO1xuICAgICAgICBpZiAoaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIoaW5wdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IG91dHB1dHNbaV07XG4gICAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKG91dHB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0aGlzIGlzIGEgY2hlYXAgd2F5IG9mIGFkZGluZyB0aGUgbWFya2VyIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpbnB1dC9vdXRwdXRcbiAgICAgIC8vIHZhbHVlcyBoYXZlIGJlZW4gZmlsdGVyZWQgKGJ5IG5vdCBpbmNsdWRpbmcgdGhlIGFuaW1hdGlvbiBvbmVzKSBhbmQgYWRkZWRcbiAgICAgIC8vIHRvIHRoZSBleHByZXNzaW9ucy4gVGhlIG1hcmtlciBpcyBpbXBvcnRhbnQgYmVjYXVzZSBpdCB0ZWxscyB0aGUgcnVudGltZVxuICAgICAgLy8gY29kZSB0aGF0IHRoaXMgaXMgd2hlcmUgYXR0cmlidXRlcyB3aXRob3V0IHZhbHVlcyBzdGFydC4uLlxuICAgICAgaWYgKGF0dHJFeHBycy5sZW5ndGgpIHtcbiAgICAgICAgYXR0ckV4cHJzLnNwbGljZShhdHRyc1N0YXJ0SW5kZXgsIDAsIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZW1wbGF0ZUF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSk7XG4gICAgICB0ZW1wbGF0ZUF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ckV4cHJzO1xuICB9XG5cbiAgcHJpdmF0ZSB0b0F0dHJzUGFyYW0oYXR0cnNFeHByczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIHJldHVybiBhdHRyc0V4cHJzLmxlbmd0aCA+IDAgP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJzRXhwcnMpLCB0cnVlKSA6XG4gICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc1BhcmFtZXRlcihyZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAoIXJlZmVyZW5jZXMgfHwgcmVmZXJlbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCByZWZzUGFyYW0gPSBmbGF0dGVuKHJlZmVyZW5jZXMubWFwKHJlZmVyZW5jZSA9PiB7XG4gICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGVOYW1lKTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHJlZmVyZW5jZS5uYW1lLCBsaHMsXG4gICAgICAgICAgRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULCAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAvLyBlLmcuIG5leHRDb250ZXh0KDIpO1xuICAgICAgICAgICAgY29uc3QgbmV4dENvbnRleHRTdG10ID1cbiAgICAgICAgICAgICAgICByZWxhdGl2ZUxldmVsID4gMCA/IFtnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKS50b1N0bXQoKV0gOiBbXTtcblxuICAgICAgICAgICAgLy8gZS5nLiBjb25zdCAkZm9vJCA9IHJlZmVyZW5jZSgxKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZkV4cHIgPSBsaHMuc2V0KG8uaW1wb3J0RXhwcihSMy5yZWZlcmVuY2UpLmNhbGxGbihbby5saXRlcmFsKHNsb3QpXSkpO1xuICAgICAgICAgICAgcmV0dXJuIG5leHRDb250ZXh0U3RtdC5jb25jYXQocmVmRXhwci50b0NvbnN0RGVjbCgpKTtcbiAgICAgICAgICB9LCB0cnVlKTtcbiAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmc1BhcmFtKSwgdHJ1ZSk7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcih0YWdOYW1lOiBzdHJpbmcsIG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50LCBpbmRleDogbnVtYmVyKTpcbiAgICAgICgpID0+IG8uRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPSBvdXRwdXRBc3QubmFtZTtcbiAgICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBvdXRwdXRBc3QudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgICAgLy8gc3ludGhldGljIEBsaXN0ZW5lci5mb28gdmFsdWVzIGFyZSB0cmVhdGVkIHRoZSBleGFjdCBzYW1lIGFzIGFyZSBzdGFuZGFyZCBsaXN0ZW5lcnNcbiAgICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoZXZlbnROYW1lLCBvdXRwdXRBc3QucGhhc2UgISkgOlxuICAgICAgICAgIHNhbml0aXplSWRlbnRpZmllcihldmVudE5hbWUpO1xuICAgICAgY29uc3QgaGFuZGxlck5hbWUgPSBgJHt0aGlzLnRlbXBsYXRlTmFtZX1fJHt0YWdOYW1lfV8ke2JpbmRpbmdGbk5hbWV9XyR7aW5kZXh9X2xpc3RlbmVyYDtcbiAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5fYmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKHRoaXMuX2JpbmRpbmdTY29wZS5iaW5kaW5nTGV2ZWwpO1xuICAgICAgY29uc3QgY29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBjb250ZXh0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBGdW5jdGlvbkNhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQocGlwZS5zcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4pLCBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID1cbiAgICAgICAgaXNWYXJMZW5ndGggPyB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgYXJncyldKSA6IHRoaXMudmlzaXRBbGwoYXJncyk7XG5cbiAgICBjb25zdCBwaXBlQmluZEV4cHIgPSBuZXcgRnVuY3Rpb25DYWxsKHBpcGUuc3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgIC4uLmNvbnZlcnRlZEFyZ3MsXG4gICAgXSk7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5wdXNoKHBpcGVCaW5kRXhwcik7XG4gICAgcmV0dXJuIHBpcGVCaW5kRXhwcjtcbiAgfVxuXG4gIHVwZGF0ZVBpcGVTbG90T2Zmc2V0cyhiaW5kaW5nU2xvdHM6IG51bWJlcikge1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMuZm9yRWFjaCgocGlwZTogRnVuY3Rpb25DYWxsKSA9PiB7XG4gICAgICAvLyB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0IGFyZyAoaW5kZXggMSkgdG8gYWNjb3VudCBmb3IgYmluZGluZyBzbG90c1xuICAgICAgY29uc3Qgc2xvdE9mZnNldCA9IHBpcGUuYXJnc1sxXSBhcyBMaXRlcmFsUHJpbWl0aXZlO1xuICAgICAgKHNsb3RPZmZzZXQudmFsdWUgYXMgbnVtYmVyKSArPSBiaW5kaW5nU2xvdHM7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChhcnJheS5zcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucGlwZUJpbmRWLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5cbmZ1bmN0aW9uIHB1cmVGdW5jdGlvbkNhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5wdXJlRnVuY3Rpb25WLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHIgfCBvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoID4gMCB8fCBlcnJvcihgRXhwZWN0ZWQgYXJndW1lbnRzIHRvIGEgbGl0ZXJhbCBmYWN0b3J5IGZ1bmN0aW9uYCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHN0YXJ0U2xvdCksXG4gICAgbGl0ZXJhbEZhY3RvcnksXG4gIF07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gbmV4dENvbnRleHQoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBsb2NhbFJlZmAgaXMgdHJ1ZSBpZiB3ZSBhcmUgc3RvcmluZyBhIGxvY2FsIHJlZmVyZW5jZVxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5SZWFkVmFyRXhwcjsgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaztcbiAgZGVjbGFyZTogYm9vbGVhbjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgbG9jYWxSZWY6IGJvb2xlYW47XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7IERFRkFVTFQgPSAwLCBDT05URVhUID0gMSwgU0hBUkVEX0NPTlRFWFQgPSAyIH1cblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdTY29wZSBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICAvKiogS2VlcHMgYSBtYXAgZnJvbSBsb2NhbCB2YXJpYWJsZXMgdG8gdGhlaXIgQmluZGluZ0RhdGEuICovXG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdEYXRhPigpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG4gIHByaXZhdGUgcmVzdG9yZVZpZXdWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgX1JPT1RfU0NPUEU6IEJpbmRpbmdTY29wZTtcblxuICBzdGF0aWMgZ2V0IFJPT1RfU0NPUEUoKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAoIUJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRSkge1xuICAgICAgQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuICAgIH1cbiAgICByZXR1cm4gQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCBwcml2YXRlIHBhcmVudDogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKSB7fVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgbGV0IHZhbHVlID0gY3VycmVudC5tYXAuZ2V0KG5hbWUpO1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IHRoaXMpIHtcbiAgICAgICAgICAvLyBtYWtlIGEgbG9jYWwgY29weSBhbmQgcmVzZXQgdGhlIGBkZWNsYXJlYCBzdGF0ZVxuICAgICAgICAgIHZhbHVlID0ge1xuICAgICAgICAgICAgcmV0cmlldmFsTGV2ZWw6IHZhbHVlLnJldHJpZXZhbExldmVsLFxuICAgICAgICAgICAgbGhzOiB2YWx1ZS5saHMsXG4gICAgICAgICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICAgICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiB2YWx1ZS5wcmlvcml0eSxcbiAgICAgICAgICAgIGxvY2FsUmVmOiB2YWx1ZS5sb2NhbFJlZlxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBDYWNoZSB0aGUgdmFsdWUgbG9jYWxseS5cbiAgICAgICAgICB0aGlzLm1hcC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICAgIC8vIFBvc3NpYmx5IGdlbmVyYXRlIGEgc2hhcmVkIGNvbnRleHQgdmFyXG4gICAgICAgICAgdGhpcy5tYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KHZhbHVlLnJldHJpZXZhbExldmVsLCB2YWx1ZS5sb2NhbFJlZik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqIEBwYXJhbSBsb2NhbFJlZiBXaGV0aGVyIG9yIG5vdCB0aGlzIGlzIGEgbG9jYWwgcmVmXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaywgbG9jYWxSZWY/OiB0cnVlKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAodGhpcy5tYXAuaGFzKG5hbWUpKSB7XG4gICAgICBpZiAobG9jYWxSZWYpIHtcbiAgICAgICAgLy8gRG8gbm90IHRocm93IGFuIGVycm9yIGlmIGl0J3MgYSBsb2NhbCByZWYgYW5kIGRvIG5vdCB1cGRhdGUgZXhpc3RpbmcgdmFsdWUsXG4gICAgICAgIC8vIHNvIHRoZSBmaXJzdCBkZWZpbmVkIHJlZiBpcyBhbHdheXMgcmV0dXJuZWQuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIH1cbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiBkZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICAgIGxvY2FsUmVmOiBsb2NhbFJlZiB8fCBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIG5lc3RlZFNjb3BlKGxldmVsOiBudW1iZXIpOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgOiBudWxsO1xuICB9XG5cbiAgbWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWU6IEJpbmRpbmdEYXRhKSB7XG4gICAgaWYgKHZhbHVlLnByaW9yaXR5ID09PSBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQgJiZcbiAgICAgICAgdmFsdWUucmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIGlmIChzaGFyZWRDdHhPYmopIHtcbiAgICAgICAgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUgKyB0aGlzLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICB0aGlzLm1hcC5zZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgLy8gY29uc3QgY3R4X3IwID0gbmV4dENvbnRleHQoMik7XG4gICAgICAgIHJldHVybiBbbGhzLnNldChnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKSkudG9Db25zdERlY2woKV07XG4gICAgICB9LFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBwcmlvcml0eTogRGVjbGFyYXRpb25Qcmlvcml0eS5TSEFSRURfQ09OVEVYVCxcbiAgICAgIGxvY2FsUmVmOiBmYWxzZVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhO1xuICAgIGNvbXBvbmVudFZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygwLCBmYWxzZSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBsb2NhbFJlZkxvb2t1cDogYm9vbGVhbikge1xuICAgIC8vIFdlIHdhbnQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGxpc3RlbmVyIGZucyBpZjpcbiAgICAvLyAxIC0gd2UgYXJlIGFjY2Vzc2luZyBhIHZhbHVlIGluIGEgcGFyZW50IHZpZXcsIHdoaWNoIHJlcXVpcmVzIHdhbGtpbmcgdGhlIHZpZXcgdHJlZSByYXRoZXJcbiAgICAvLyB0aGFuIHVzaW5nIHRoZSBjdHggYXJnLiBJbiB0aGlzIGNhc2UsIHRoZSByZXRyaWV2YWwgYW5kIGJpbmRpbmcgbGV2ZWwgd2lsbCBiZSBkaWZmZXJlbnQuXG4gICAgLy8gMiAtIHdlIGFyZSBsb29raW5nIHVwIGEgbG9jYWwgcmVmLCB3aGljaCByZXF1aXJlcyByZXN0b3JpbmcgdGhlIHZpZXcgd2hlcmUgdGhlIGxvY2FsXG4gICAgLy8gcmVmIGlzIHN0b3JlZFxuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpICYmIChyZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsIHx8IGxvY2FsUmVmTG9va3VwKSkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgICAgLy8gcGFyZW50IHNhdmVzIHZhcmlhYmxlIHRvIGdlbmVyYXRlIGEgc2hhcmVkIGBjb25zdCAkcyQgPSBnZXRDdXJyZW50VmlldygpO2AgaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCAhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgICB9XG4gIH1cblxuICByZXN0b3JlVmlld1N0YXRlbWVudCgpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyByZXN0b3JlVmlldygkc3RhdGUkKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW2luc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSkudG9TdG10KCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnZXRDdXJyZW50VmlldygpO1xuICAgIGNvbnN0IGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uKS50b0NvbnN0RGVjbCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgaXNMaXN0ZW5lclNjb3BlKCkgeyByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDsgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5kZWNsYXJlKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICBjb25zdCBsZXZlbERpZmYgPSB0aGlzLmJpbmRpbmdMZXZlbCAtIHZhbHVlLnJldHJpZXZhbExldmVsO1xuICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICByZXR1cm4gc3RtdHMuY29uY2F0KGN1cnJTdG10cyk7XG4gICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIGV4cHJlc3Npb25zIG91dCBvZiBhbiBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZXNcbiAqIHdoaWNoIGNhbiBiZSBhZGRlZCB0byB0aGUgaW5zdHJ1Y3Rpb24gcGFyYW1ldGVycy5cbiAqL1xuZnVuY3Rpb24gZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZTogdC5UZXh0QXR0cmlidXRlKTogby5FeHByZXNzaW9uW10ge1xuICAvLyBQYXJzZSB0aGUgYXR0cmlidXRlIHZhbHVlIGludG8gYSBDc3NTZWxlY3Rvckxpc3QuIE5vdGUgdGhhdCB3ZSBvbmx5IHRha2UgdGhlXG4gIC8vIGZpcnN0IHNlbGVjdG9yLCBiZWNhdXNlIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgc2VsZWN0b3JzIGluIG5nUHJvamVjdEFzLlxuICBjb25zdCBwYXJzZWRSM1NlbGVjdG9yID0gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKGF0dHJpYnV0ZS52YWx1ZSlbMF07XG4gIHJldHVybiBbby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlByb2plY3RBcyksIGFzTGl0ZXJhbChwYXJzZWRSM1NlbGVjdG9yKV07XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG5cbi8qKlxuICogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIG1vZGlmeSBob3cgYSB0ZW1wbGF0ZSBpcyBwYXJzZWQgYnkgYHBhcnNlVGVtcGxhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VUZW1wbGF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqIEBwYXJhbSBvcHRpb25zIG9wdGlvbnMgdG8gbW9kaWZ5IGhvdyB0aGUgdGVtcGxhdGUgaXMgcGFyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IFBhcnNlVGVtcGxhdGVPcHRpb25zID0ge30pOlxuICAgIHtlcnJvcnM/OiBQYXJzZUVycm9yW10sIG5vZGVzOiB0Lk5vZGVbXSwgc3R5bGVVcmxzOiBzdHJpbmdbXSwgc3R5bGVzOiBzdHJpbmdbXX0ge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlc30gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9XG4gICAgICBodG1sUGFyc2VyLnBhcnNlKHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCwgey4uLm9wdGlvbnMsIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWV9KTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIGxldCByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gcGFyc2VSZXN1bHQucm9vdE5vZGVzO1xuXG4gIC8vIHByb2Nlc3MgaTE4biBtZXRhIGluZm9ybWF0aW9uIChzY2FuIGF0dHJpYnV0ZXMsIGdlbmVyYXRlIGlkcylcbiAgLy8gYmVmb3JlIHdlIHJ1biB3aGl0ZXNwYWNlIHJlbW92YWwgcHJvY2VzcywgYmVjYXVzZSBleGlzdGluZyBpMThuXG4gIC8vIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIHJvb3ROb2RlcyA9XG4gICAgICBodG1sLnZpc2l0QWxsKG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgIXByZXNlcnZlV2hpdGVzcGFjZXMpLCByb290Tm9kZXMpO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3ZSByZW1vdmUgd2hpdGVzcGFjZXMsIGJlY2F1c2VcbiAgICAvLyB0aGF0IG1pZ2h0IGFmZmVjdCBnZW5lcmF0ZWQgaTE4biBtZXNzYWdlIGNvbnRlbnQuIER1cmluZyB0aGlzIHBhc3NcbiAgICAvLyBpMThuIElEcyBnZW5lcmF0ZWQgYXQgdGhlIGZpcnN0IHBhc3Mgd2lsbCBiZSBwcmVzZXJ2ZWQsIHNvIHdlIGNhbiBtaW1pY1xuICAgIC8vIGV4aXN0aW5nIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pXG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChcbiAgICAgICAgbmV3IEkxOG5NZXRhVmlzaXRvcihpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovIGZhbHNlKSwgcm9vdE5vZGVzKTtcbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgZXJyb3JzLCBzdHlsZVVybHMsIHN0eWxlc30gPSBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIHN0eWxlVXJscywgc3R5bGVzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKFxuICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQmluZGluZ1BhcnNlciB7XG4gIHJldHVybiBuZXcgQmluZGluZ1BhcnNlcihcbiAgICAgIG5ldyBQYXJzZXIobmV3IExleGVyKCkpLCBpbnRlcnBvbGF0aW9uQ29uZmlnLCBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCksIG51bGwsIFtdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25Gbihjb250ZXh0OiBjb3JlLlNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGU/OiBib29sZWFuKSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlzQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUoY2hpbGRyZW46IHQuTm9kZVtdKTogY2hpbGRyZW4gaXNbdC5FbGVtZW50XSB7XG4gIHJldHVybiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LkVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGlzVGV4dE5vZGUobm9kZTogdC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgdC5UZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5JY3U7XG59XG5cbmZ1bmN0aW9uIGhhc1RleHRDaGlsZHJlbk9ubHkoY2hpbGRyZW46IHQuTm9kZVtdKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGlsZHJlbi5ldmVyeShpc1RleHROb2RlKTtcbn1cbiJdfQ==