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
import * as o from '../../output/output_ast';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { CssSelector } from '../../selector';
import { BindingParser } from '../../template_parser/binding_parser';
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { parseStyle } from './styling';
import { CONTEXT_NAME, I18N_ATTR, I18N_ATTR_PREFIX, ID_SEPARATOR, IMPLICIT_REFERENCE, MEANING_SEPARATOR, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, getAttrsForDirectiveMatching, invalid, mapToExpression, trimTrailingNulls, unsupported } from './util';
function mapBindingToInstruction(type) {
    switch (type) {
        case 0 /* Property */:
            return R3.elementProperty;
        case 2 /* Class */:
            return R3.elementClassProp;
        case 1 /* Attribute */:
        case 4 /* Animation */:
            return R3.elementAttribute;
        default:
            return undefined;
    }
}
//  if (rf & flags) { .. }
export function renderFlagCheckIfStmt(flags, statements) {
    return o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
}
export class TemplateDefinitionBuilder {
    constructor(constantPool, parentBindingScope, level = 0, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath) {
        this.constantPool = constantPool;
        this.level = level;
        this.contextName = contextName;
        this.templateName = templateName;
        this.viewQueries = viewQueries;
        this.directiveMatcher = directiveMatcher;
        this.directives = directives;
        this.pipeTypeByName = pipeTypeByName;
        this.pipes = pipes;
        this._namespace = _namespace;
        this.relativeContextFilePath = relativeContextFilePath;
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
        // Whether we are inside a translatable element (`<p i18n>... somewhere here ... </p>)
        this._inI18nSection = false;
        this._i18nSectionIndex = -1;
        // Maps of placeholder to node indexes for each of the i18n section
        this._phToNodeIdxes = [{}];
        // Number of slots to reserve for pureFunctions
        this._pureFunctionSlots = 0;
        // Number of binding slots
        this._bindingSlots = 0;
        // These should be handled in the template or element directly.
        this.visitReference = invalid;
        this.visitVariable = invalid;
        this.visitTextAttribute = invalid;
        this.visitBoundAttribute = invalid;
        this.visitBoundEvent = invalid;
        // view queries can take up space in data and allocation happens earlier (in the "viewQuery"
        // function)
        this._dataIndex = viewQueries.length;
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
    buildTemplateFunction(nodes, variables, hasNgContent = false, ngContentSelectors = []) {
        if (this._namespace !== R3.namespaceHTML) {
            this.creationInstruction(null, this._namespace);
        }
        // Create variable bindings
        variables.forEach(v => this.registerContextVariables(v));
        // Output a `ProjectionDef` instruction when some `<ng-content>` are present
        if (hasNgContent) {
            const parameters = [];
            // Only selectors with a non-default value are generated
            if (ngContentSelectors.length > 1) {
                const r3Selectors = ngContentSelectors.map(s => core.parseSelectorToR3Selector(s));
                // `projectionDef` needs both the parsed and raw value of the selectors
                const parsed = this.constantPool.getConstLiteral(asLiteral(r3Selectors), true);
                const unParsed = this.constantPool.getConstLiteral(asLiteral(ngContentSelectors), true);
                parameters.push(parsed, unParsed);
            }
            this.creationInstruction(null, R3.projectionDef, parameters);
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
        // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
        const creationStatements = this._creationCodeFns.map((fn) => fn());
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        const updateStatements = this._updateCodeFns.map((fn) => fn());
        //  Variable declaration must occur after binding resolution so we can generate context
        //  instructions that build on each other. e.g. const b = x().$implicit(); const b = x();
        const creationVariables = this._bindingScope.viewSnapshotStatements();
        const updateVariables = this._bindingScope.variableDeclarations().concat(this._tempVariables);
        const creationBlock = creationStatements.length > 0 ?
            [renderFlagCheckIfStmt(1 /* Create */, creationVariables.concat(creationStatements))] :
            [];
        const updateBlock = updateStatements.length > 0 ?
            [renderFlagCheckIfStmt(2 /* Update */, updateVariables.concat(updateStatements))] :
            [];
        // Generate maps of placeholder name to node indexes
        // TODO(vicb): This is a WIP, not fully supported yet
        for (const phToNodeIdx of this._phToNodeIdxes) {
            if (Object.keys(phToNodeIdx).length > 0) {
                const scopedName = this._bindingScope.freshReferenceName();
                const phMap = o.variable(scopedName).set(mapToExpression(phToNodeIdx, true)).toConstDecl();
                this._prefixCode.push(phMap);
            }
        }
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
    visitContent(ngContent) {
        const slot = this.allocateDataSlot();
        const selectorIndex = ngContent.selectorIndex;
        const parameters = [o.literal(slot)];
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
        const wasInI18nSection = this._inI18nSection;
        const outputAttrs = {};
        const attrI18nMetas = {};
        let i18nMeta = '';
        const [namespaceKey, elementName] = splitNsName(element.name);
        const isNgContainer = checkIsNgContainer(element.name);
        // Elements inside i18n sections are replaced with placeholders
        // TODO(vicb): nested elements are a WIP in this phase
        if (this._inI18nSection) {
            const phName = element.name.toLowerCase();
            if (!this._phToNodeIdxes[this._i18nSectionIndex][phName]) {
                this._phToNodeIdxes[this._i18nSectionIndex][phName] = [];
            }
            this._phToNodeIdxes[this._i18nSectionIndex][phName].push(elementIndex);
        }
        let isNonBindableMode = false;
        // Handle i18n attributes
        for (const attr of element.attributes) {
            const name = attr.name;
            const value = attr.value;
            if (name === NON_BINDABLE_ATTR) {
                isNonBindableMode = true;
            }
            else if (name === I18N_ATTR) {
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
        this.matchDirectives(element.name, element);
        // Regular element or ng-container creation mode
        const parameters = [o.literal(elementIndex)];
        if (!isNgContainer) {
            parameters.push(o.literal(elementName));
        }
        // Add the attributes
        const attributes = [];
        const initialStyleDeclarations = [];
        const initialClassDeclarations = [];
        const styleInputs = [];
        const classInputs = [];
        const allOtherInputs = [];
        element.inputs.forEach((input) => {
            switch (input.type) {
                // [attr.style] or [attr.class] should not be treated as styling-based
                // bindings since they are intended to be written directly to the attr
                // and therefore will skip all style/class resolution that is present
                // with style="", [style]="" and [style.prop]="", class="",
                // [class.prop]="". [class]="" assignments
                case 0 /* Property */:
                    if (input.name == 'style') {
                        // this should always go first in the compilation (for [style])
                        styleInputs.splice(0, 0, input);
                    }
                    else if (isClassBinding(input)) {
                        // this should always go first in the compilation (for [class])
                        classInputs.splice(0, 0, input);
                    }
                    else {
                        allOtherInputs.push(input);
                    }
                    break;
                case 3 /* Style */:
                    styleInputs.push(input);
                    break;
                case 2 /* Class */:
                    classInputs.push(input);
                    break;
                default:
                    allOtherInputs.push(input);
                    break;
            }
        });
        let currStyleIndex = 0;
        let currClassIndex = 0;
        let staticStylesMap = null;
        let staticClassesMap = null;
        const stylesIndexMap = {};
        const classesIndexMap = {};
        Object.getOwnPropertyNames(outputAttrs).forEach(name => {
            const value = outputAttrs[name];
            if (name == 'style') {
                staticStylesMap = parseStyle(value);
                Object.keys(staticStylesMap).forEach(prop => { stylesIndexMap[prop] = currStyleIndex++; });
            }
            else if (name == 'class') {
                staticClassesMap = {};
                value.split(/\s+/g).forEach(className => {
                    classesIndexMap[className] = currClassIndex++;
                    staticClassesMap[className] = true;
                });
            }
            else {
                attributes.push(o.literal(name));
                if (attrI18nMetas.hasOwnProperty(name)) {
                    const meta = parseI18nMeta(attrI18nMetas[name]);
                    const variable = this.constantPool.getTranslation(value, meta, this.fileBasedI18nSuffix);
                    attributes.push(variable);
                }
                else {
                    attributes.push(o.literal(value));
                }
            }
        });
        let hasMapBasedStyling = false;
        for (let i = 0; i < styleInputs.length; i++) {
            const input = styleInputs[i];
            const isMapBasedStyleBinding = i === 0 && input.name === 'style';
            if (isMapBasedStyleBinding) {
                hasMapBasedStyling = true;
            }
            else if (!stylesIndexMap.hasOwnProperty(input.name)) {
                stylesIndexMap[input.name] = currStyleIndex++;
            }
        }
        for (let i = 0; i < classInputs.length; i++) {
            const input = classInputs[i];
            const isMapBasedClassBinding = i === 0 && isClassBinding(input);
            if (!isMapBasedClassBinding && !stylesIndexMap.hasOwnProperty(input.name)) {
                classesIndexMap[input.name] = currClassIndex++;
            }
        }
        // in the event that a [style] binding is used then sanitization will
        // always be imported because it is not possible to know ahead of time
        // whether style bindings will use or not use any sanitizable properties
        // that isStyleSanitizable() will detect
        let useDefaultStyleSanitizer = hasMapBasedStyling;
        // this will build the instructions so that they fall into the following syntax
        // => [prop1, prop2, prop3, 0, prop1, value1, prop2, value2]
        Object.keys(stylesIndexMap).forEach(prop => {
            useDefaultStyleSanitizer = useDefaultStyleSanitizer || isStyleSanitizable(prop);
            initialStyleDeclarations.push(o.literal(prop));
        });
        if (staticStylesMap) {
            initialStyleDeclarations.push(o.literal(1 /* VALUES_MODE */));
            Object.keys(staticStylesMap).forEach(prop => {
                initialStyleDeclarations.push(o.literal(prop));
                const value = staticStylesMap[prop];
                initialStyleDeclarations.push(o.literal(value));
            });
        }
        Object.keys(classesIndexMap).forEach(prop => {
            initialClassDeclarations.push(o.literal(prop));
        });
        if (staticClassesMap) {
            initialClassDeclarations.push(o.literal(1 /* VALUES_MODE */));
            Object.keys(staticClassesMap).forEach(className => {
                initialClassDeclarations.push(o.literal(className));
                initialClassDeclarations.push(o.literal(true));
            });
        }
        const hasStylingInstructions = initialStyleDeclarations.length || styleInputs.length ||
            initialClassDeclarations.length || classInputs.length;
        // add attributes for directive matching purposes
        attributes.push(...this.prepareSyntheticAndSelectOnlyAttrs(allOtherInputs, element.outputs));
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
        const createSelfClosingInstruction = !hasStylingInstructions && !isNgContainer &&
            element.children.length === 0 && element.outputs.length === 0;
        if (createSelfClosingInstruction) {
            this.creationInstruction(element.sourceSpan, R3.element, trimTrailingNulls(parameters));
        }
        else {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainerStart : R3.elementStart, trimTrailingNulls(parameters));
            if (isNonBindableMode) {
                this.creationInstruction(element.sourceSpan, R3.disableBindings);
            }
            // initial styling for static style="..." attributes
            if (hasStylingInstructions) {
                const paramsList = [];
                if (initialClassDeclarations.length) {
                    // the template compiler handles initial class styling (e.g. class="foo") values
                    // in a special command called `elementClass` so that the initial class
                    // can be processed during runtime. These initial class values are bound to
                    // a constant because the inital class values do not change (since they're static).
                    paramsList.push(this.constantPool.getConstLiteral(o.literalArr(initialClassDeclarations), true));
                }
                else if (initialStyleDeclarations.length || useDefaultStyleSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    paramsList.push(o.NULL_EXPR);
                }
                if (initialStyleDeclarations.length) {
                    // the template compiler handles initial style (e.g. style="foo") values
                    // in a special command called `elementStyle` so that the initial styles
                    // can be processed during runtime. These initial styles values are bound to
                    // a constant because the inital style values do not change (since they're static).
                    paramsList.push(this.constantPool.getConstLiteral(o.literalArr(initialStyleDeclarations), true));
                }
                else if (useDefaultStyleSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    paramsList.push(o.NULL_EXPR);
                }
                if (useDefaultStyleSanitizer) {
                    paramsList.push(o.importExpr(R3.defaultStyleSanitizer));
                }
                this.creationInstruction(null, R3.elementStyling, paramsList);
            }
            // Generate Listeners (outputs)
            element.outputs.forEach((outputAst) => {
                this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter(element.name, outputAst));
            });
        }
        if ((styleInputs.length || classInputs.length) && hasStylingInstructions) {
            const indexLiteral = o.literal(elementIndex);
            const firstStyle = styleInputs[0];
            const mapBasedStyleInput = firstStyle && firstStyle.name == 'style' ? firstStyle : null;
            const firstClass = classInputs[0];
            const mapBasedClassInput = firstClass && isClassBinding(firstClass) ? firstClass : null;
            const stylingInput = mapBasedStyleInput || mapBasedClassInput;
            if (stylingInput) {
                this.updateInstruction(stylingInput.sourceSpan, R3.elementStylingMap, () => {
                    const params = [indexLiteral];
                    if (mapBasedClassInput) {
                        const mapBasedClassValue = mapBasedClassInput.value.visit(this._valueConverter);
                        params.push(this.convertPropertyBinding(implicit, mapBasedClassValue, true));
                    }
                    else if (mapBasedStyleInput) {
                        params.push(o.NULL_EXPR);
                    }
                    if (mapBasedStyleInput) {
                        const mapBasedStyleValue = mapBasedStyleInput.value.visit(this._valueConverter);
                        params.push(this.convertPropertyBinding(implicit, mapBasedStyleValue, true));
                    }
                    return params;
                });
            }
            let lastInputCommand = null;
            if (styleInputs.length) {
                let i = mapBasedStyleInput ? 1 : 0;
                for (i; i < styleInputs.length; i++) {
                    const input = styleInputs[i];
                    const params = [];
                    const sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                    if (sanitizationRef)
                        params.push(sanitizationRef);
                    const key = input.name;
                    const styleIndex = stylesIndexMap[key];
                    const value = input.value.visit(this._valueConverter);
                    this.updateInstruction(input.sourceSpan, R3.elementStyleProp, () => {
                        return [
                            indexLiteral, o.literal(styleIndex),
                            this.convertPropertyBinding(implicit, value, true), ...params
                        ];
                    });
                }
                lastInputCommand = styleInputs[styleInputs.length - 1];
            }
            if (classInputs.length) {
                let i = mapBasedClassInput ? 1 : 0;
                for (i; i < classInputs.length; i++) {
                    const input = classInputs[i];
                    const params = [];
                    const sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                    if (sanitizationRef)
                        params.push(sanitizationRef);
                    const key = input.name;
                    const classIndex = classesIndexMap[key];
                    const value = input.value.visit(this._valueConverter);
                    this.updateInstruction(input.sourceSpan, R3.elementClassProp, () => {
                        return [
                            indexLiteral, o.literal(classIndex),
                            this.convertPropertyBinding(implicit, value, true), ...params
                        ];
                    });
                }
                lastInputCommand = classInputs[classInputs.length - 1];
            }
            this.updateInstruction(lastInputCommand.sourceSpan, R3.elementStylingApply, [indexLiteral]);
        }
        // Generate element input bindings
        allOtherInputs.forEach((input) => {
            const instruction = mapBindingToInstruction(input.type);
            if (input.type === 4 /* Animation */) {
                const value = input.value.visit(this._valueConverter);
                // setAttribute without a value doesn't make any sense
                if (value.name || value.value) {
                    const name = prepareSyntheticAttributeName(input.name);
                    this.updateInstruction(input.sourceSpan, R3.elementAttribute, () => {
                        return [
                            o.literal(elementIndex), o.literal(name), this.convertPropertyBinding(implicit, value)
                        ];
                    });
                }
            }
            else if (instruction) {
                const params = [];
                const sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                if (sanitizationRef)
                    params.push(sanitizationRef);
                // TODO(chuckj): runtime: security context
                const value = input.value.visit(this._valueConverter);
                this.allocateBindingSlots(value);
                this.updateInstruction(input.sourceSpan, instruction, () => {
                    return [
                        o.literal(elementIndex), o.literal(input.name),
                        this.convertPropertyBinding(implicit, value), ...params
                    ];
                });
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
        if (!createSelfClosingInstruction) {
            // Finish element construction mode.
            if (isNonBindableMode) {
                this.creationInstruction(element.endSourceSpan || element.sourceSpan, R3.enableBindings);
            }
            this.creationInstruction(element.endSourceSpan || element.sourceSpan, isNgContainer ? R3.elementContainerEnd : R3.elementEnd);
        }
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
        const parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            o.TYPED_NULL_EXPR,
        ];
        // find directives matching on a given <ng-template> node
        this.matchDirectives('ng-template', template);
        // prepare attributes parameter (including attributes used for directive matching)
        const attrsExprs = [];
        template.attributes.forEach((a) => { attrsExprs.push(asLiteral(a.name), asLiteral(a.value)); });
        attrsExprs.push(...this.prepareSyntheticAndSelectOnlyAttrs(template.inputs, template.outputs));
        parameters.push(this.toAttrsParam(attrsExprs));
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            parameters.push(this.prepareRefsParameter(template.references));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // handle property bindings e.g. p(1, 'forOf', ɵbind(ctx.items));
        const context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(input => {
            const value = input.value.visit(this._valueConverter);
            this.allocateBindingSlots(value);
            this.updateInstruction(template.sourceSpan, R3.elementProperty, () => {
                return [
                    o.literal(templateIndex), o.literal(input.name),
                    this.convertPropertyBinding(context, value)
                ];
            });
        });
        // Create the template function
        const templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix);
        // Nested templates must not be visited until after their parent templates have completed
        // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
        // be able to support bindings in nested templates to local refs that occur after the
        // template definition. e.g. <div *ngIf="showing"> {{ foo }} </div>  <div #foo></div>
        this._nestedTemplateFns.push(() => {
            const templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
            this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
        });
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(template.sourceSpan, R3.templateCreate, () => {
            parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
            return trimTrailingNulls(parameters);
        });
        // Generate listeners for directive output
        template.outputs.forEach((outputAst) => {
            this.creationInstruction(outputAst.sourceSpan, R3.listener, this.prepareListenerParameter('ng_template', outputAst));
        });
    }
    visitBoundText(text) {
        const nodeIndex = this.allocateDataSlot();
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(nodeIndex)]);
        const value = text.value.visit(this._valueConverter);
        this.allocateBindingSlots(value);
        this.updateInstruction(text.sourceSpan, R3.textBinding, () => [o.literal(nodeIndex), this.convertPropertyBinding(o.variable(CONTEXT_NAME), value)]);
    }
    visitText(text) {
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
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
    // i0.ɵtext(1, MSG_XYZ);
    // ```
    visitSingleI18nTextChild(text, i18nMeta) {
        const meta = parseI18nMeta(i18nMeta);
        const variable = this.constantPool.getTranslation(text.value, meta, this.fileBasedI18nSuffix);
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), variable]);
    }
    allocateDataSlot() { return this._dataIndex++; }
    getConstCount() { return this._dataIndex; }
    getVarCount() { return this._pureFunctionSlots; }
    bindingContext() { return `${this._bindingContext++}`; }
    // Bindings must only be resolved after all local refs have been visited, so all
    // instructions are queued in callbacks that execute once the initial pass has completed.
    // Otherwise, we wouldn't be able to support local refs that are defined after their
    // bindings. e.g. {{ foo }} <div #foo></div>
    instructionFn(fns, span, reference, paramsOrFn) {
        fns.push(() => {
            const params = Array.isArray(paramsOrFn) ? paramsOrFn : paramsOrFn();
            return instruction(span, reference, params).toStmt();
        });
    }
    creationInstruction(span, reference, paramsOrFn) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || []);
    }
    updateInstruction(span, reference, paramsOrFn) {
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
    prepareSyntheticAndSelectOnlyAttrs(inputs, outputs) {
        const attrExprs = [];
        const nonSyntheticInputs = [];
        if (inputs.length) {
            const EMPTY_STRING_EXPR = asLiteral('');
            inputs.forEach(input => {
                if (input.type === 4 /* Animation */) {
                    // @attributes are for Renderer2 animation @triggers, but this feature
                    // may be supported differently in future versions of angular. However,
                    // @triggers should always just be treated as regular attributes (it's up
                    // to the renderer to detect and use them in a special way).
                    attrExprs.push(asLiteral(prepareSyntheticAttributeName(input.name)), EMPTY_STRING_EXPR);
                }
                else {
                    nonSyntheticInputs.push(input);
                }
            });
        }
        if (nonSyntheticInputs.length || outputs.length) {
            attrExprs.push(o.literal(1 /* SelectOnly */));
            nonSyntheticInputs.forEach((i) => attrExprs.push(asLiteral(i.name)));
            outputs.forEach((o) => attrExprs.push(asLiteral(o.name)));
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
                // e.g. x(2);
                const nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                // e.g. const $foo$ = r(1);
                const refExpr = lhs.set(o.importExpr(R3.reference).callFn([o.literal(slot)]));
                return nextContextStmt.concat(refExpr.toConstDecl());
            });
            return [reference.name, reference.value];
        }));
        return this.constantPool.getConstLiteral(asLiteral(refsParam), true);
    }
    prepareListenerParameter(tagName, outputAst) {
        const evNameSanitized = sanitizeIdentifier(outputAst.name);
        const tagNameSanitized = sanitizeIdentifier(tagName);
        const functionName = `${this.templateName}_${tagNameSanitized}_${evNameSanitized}_listener`;
        return () => {
            const listenerScope = this._bindingScope.nestedScope(this._bindingScope.bindingLevel);
            const bindingExpr = convertActionBinding(listenerScope, o.variable(CONTEXT_NAME), outputAst.handler, 'b', () => error('Unexpected interpolation'));
            const statements = [
                ...listenerScope.restoreViewStatement(), ...listenerScope.variableDeclarations(),
                ...bindingExpr.render3Stmts
            ];
            const handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], statements, o.INFERRED_TYPE, null, functionName);
            return [o.literal(outputAst.name), handler];
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
                        priority: value.priority
                    };
                    // Cache the value locally.
                    this.map.set(name, value);
                    // Possibly generate a shared context var
                    this.maybeGenerateSharedContextVar(value);
                    this.maybeRestoreView(value.retrievalLevel);
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
     */
    set(retrievalLevel, name, lhs, priority = 0 /* DEFAULT */, declareLocalCallback) {
        !this.map.has(name) ||
            error(`The name ${name} is already defined in scope to be ${this.map.get(name)}`);
        this.map.set(name, {
            retrievalLevel: retrievalLevel,
            lhs: lhs,
            declare: false,
            declareLocalCallback: declareLocalCallback,
            priority: priority
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
        if (value.priority === 1 /* CONTEXT */) {
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
                // const ctx_r0 = x(2);
                return [lhs.set(generateNextContextExpr(relativeLevel)).toConstDecl()];
            },
            declare: false,
            priority: 2 /* SHARED_CONTEXT */
        });
    }
    getComponentProperty(name) {
        const componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
        componentValue.declare = true;
        this.maybeRestoreView(0);
        return componentValue.lhs.prop(name);
    }
    maybeRestoreView(retrievalLevel) {
        if (this.isListenerScope() && retrievalLevel < this.bindingLevel) {
            if (!this.parent.restoreViewVariable) {
                // parent saves variable to generate a shared `const $s$ = gV();` instruction
                this.parent.restoreViewVariable = o.variable(this.parent.freshReferenceName());
            }
            this.restoreViewVariable = this.parent.restoreViewVariable;
        }
    }
    restoreViewStatement() {
        // rV($state$);
        return this.restoreViewVariable ?
            [instruction(null, R3.restoreView, [this.restoreViewVariable]).toStmt()] :
            [];
    }
    viewSnapshotStatements() {
        // const $state$ = gV();
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
/**
 * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
 *
 * @param template text of the template to parse
 * @param templateUrl URL to use for source mapping of the parsed template
 */
export function parseTemplate(template, templateUrl, options = {}, relativeContextFilePath) {
    const bindingParser = makeBindingParser();
    const htmlParser = new HtmlParser();
    const parseResult = htmlParser.parse(template, templateUrl);
    if (parseResult.errors && parseResult.errors.length > 0) {
        return {
            errors: parseResult.errors,
            nodes: [],
            hasNgContent: false,
            ngContentSelectors: [], relativeContextFilePath
        };
    }
    let rootNodes = parseResult.rootNodes;
    if (!options.preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
    }
    const { nodes, hasNgContent, ngContentSelectors, errors } = htmlAstToRender3Ast(rootNodes, bindingParser);
    if (errors && errors.length > 0) {
        return {
            errors,
            nodes: [],
            hasNgContent: false,
            ngContentSelectors: [], relativeContextFilePath
        };
    }
    return { nodes, hasNgContent, ngContentSelectors, relativeContextFilePath };
}
/**
 * Construct a `BindingParser` with a default configuration.
 */
export function makeBindingParser() {
    return new BindingParser(new Parser(new Lexer()), DEFAULT_INTERPOLATION_CONFIG, new DomElementSchemaRegistry(), null, []);
}
function isClassBinding(input) {
    return input.name == 'className' || input.name == 'class';
}
function resolveSanitizationFn(input, context) {
    switch (context) {
        case core.SecurityContext.HTML:
            return o.importExpr(R3.sanitizeHtml);
        case core.SecurityContext.SCRIPT:
            return o.importExpr(R3.sanitizeScript);
        case core.SecurityContext.STYLE:
            // the compiler does not fill in an instruction for [style.prop?] binding
            // values because the style algorithm knows internally what props are subject
            // to sanitization (only [attr.style] values are explicitly sanitized)
            return input.type === 1 /* Attribute */ ? o.importExpr(R3.sanitizeStyle) : null;
        case core.SecurityContext.URL:
            return o.importExpr(R3.sanitizeUrl);
        case core.SecurityContext.RESOURCE_URL:
            return o.importExpr(R3.sanitizeResourceUrl);
        default:
            return null;
    }
}
function isStyleSanitizable(prop) {
    switch (prop) {
        case 'background-image':
        case 'background':
        case 'border-image':
        case 'filter':
        case 'list-style':
        case 'list-style-image':
            return true;
    }
    return false;
}
function prepareSyntheticAttributeName(name) {
    return '@' + name;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRXZKLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQWMsZ0JBQWdCLEVBQUUsWUFBWSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDbE4sT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN0RCxPQUFPLEtBQUssSUFBSSxNQUFNLHFCQUFxQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RCxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRSxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRixPQUFPLEVBQUMsYUFBYSxJQUFJLGtCQUFrQixFQUFFLFdBQVcsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3RGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFDbEYsT0FBTyxFQUFDLFdBQVcsRUFBa0IsTUFBTSxnQkFBZ0IsQ0FB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Q0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLElBQW9CO0lBQ3ZDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsNkNBQTZDO0lBQ3BFLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNuQixLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN2RDtJ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SyxDQUFDLElBQUksc0JBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDdEYsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUc7WUFDM0IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN0QyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWTtZQUNwQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDOUM7WUFDRSxPQUFPLElBQUksQ0FBQztLQUNmO0FBQ0gsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBWTtJQUN0QyxRQUFRLElBQUksRUFBRTtRQUNaLEtBQUssa0JBQWtCLENBQUM7UUFDeEIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLFlBQVksQ0FBQztRQUNsQixLQUFLLGtCQUFrQjtZQUNyQixPQUFPLElBQUksQ0FBQztLQUNmO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyw2QkFBNkIsQ0FBQyxJQUFZO0lBQ2pELE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2lzTmdDb250YWluZXIgYXMgY2hlY2tJc05nQ29udGFpbmVyLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxpbmcnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIEkxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgSURfU0VQQVJBVE9SLCBJTVBMSUNJVF9SRUZFUkVOQ0UsIE1FQU5JTkdfU0VQQVJBVE9SLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBhc0xpdGVyYWwsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcsIGludmFsaWQsIGlzSTE4TkF0dHJpYnV0ZSwgbWFwVG9FeHByZXNzaW9uLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cbmZ1bmN0aW9uIG1hcEJpbmRpbmdUb0luc3RydWN0aW9uKHR5cGU6IEJpbmRpbmdUeXBlKTogby5FeHRlcm5hbFJlZmVyZW5jZXx1bmRlZmluZWQge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRQcm9wZXJ0eTtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRDbGFzc1Byb3A7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU6XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5BbmltYXRpb246XG4gICAgICByZXR1cm4gUjMuZWxlbWVudEF0dHJpYnV0ZTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIFdoZXRoZXIgd2UgYXJlIGluc2lkZSBhIHRyYW5zbGF0YWJsZSBlbGVtZW50IChgPHAgaTE4bj4uLi4gc29tZXdoZXJlIGhlcmUgLi4uIDwvcD4pXG4gIHByaXZhdGUgX2luSTE4blNlY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaTE4blNlY3Rpb25JbmRleCA9IC0xO1xuICAvLyBNYXBzIG9mIHBsYWNlaG9sZGVyIHRvIG5vZGUgaW5kZXhlcyBmb3IgZWFjaCBvZiB0aGUgaTE4biBzZWN0aW9uXG4gIHByaXZhdGUgX3BoVG9Ob2RlSWR4ZXM6IHtbcGhOYW1lOiBzdHJpbmddOiBudW1iZXJbXX1bXSA9IFt7fV07XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwYXJlbnRCaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBsZXZlbCA9IDAsXG4gICAgICBwcml2YXRlIGNvbnRleHROYW1lOiBzdHJpbmd8bnVsbCwgcHJpdmF0ZSB0ZW1wbGF0ZU5hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHJpdmF0ZSB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LCBwcml2YXRlIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgX25hbWVzcGFjZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHByaXZhdGUgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZykge1xuICAgIC8vIHZpZXcgcXVlcmllcyBjYW4gdGFrZSB1cCBzcGFjZSBpbiBkYXRhIGFuZCBhbGxvY2F0aW9uIGhhcHBlbnMgZWFybGllciAoaW4gdGhlIFwidmlld1F1ZXJ5XCJcbiAgICAvLyBmdW5jdGlvbilcbiAgICB0aGlzLl9kYXRhSW5kZXggPSB2aWV3UXVlcmllcy5sZW5ndGg7XG5cbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPSBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUobGV2ZWwpO1xuXG4gICAgLy8gVHVybiB0aGUgcmVsYXRpdmUgY29udGV4dCBmaWxlIHBhdGggaW50byBhbiBpZGVudGlmaWVyIGJ5IHJlcGxhY2luZyBub24tYWxwaGFudW1lcmljXG4gICAgLy8gY2hhcmFjdGVycyB3aXRoIHVuZGVyc2NvcmVzLlxuICAgIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCA9IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpICsgJ18nO1xuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChudW1TbG90czogbnVtYmVyKSA9PiB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHMpLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgbm9kZXM6IHQuTm9kZVtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSwgaGFzTmdDb250ZW50OiBib29sZWFuID0gZmFsc2UsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdID0gW10pOiBvLkZ1bmN0aW9uRXhwciB7XG4gICAgaWYgKHRoaXMuX25hbWVzcGFjZSAhPT0gUjMubmFtZXNwYWNlSFRNTCkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIHRoaXMuX25hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHZhcmlhYmxlIGJpbmRpbmdzXG4gICAgdmFyaWFibGVzLmZvckVhY2godiA9PiB0aGlzLnJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2KSk7XG5cbiAgICAvLyBPdXRwdXQgYSBgUHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIGFyZSBwcmVzZW50XG4gICAgaWYgKGhhc05nQ29udGVudCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gT25seSBzZWxlY3RvcnMgd2l0aCBhIG5vbi1kZWZhdWx0IHZhbHVlIGFyZSBnZW5lcmF0ZWRcbiAgICAgIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCByM1NlbGVjdG9ycyA9IG5nQ29udGVudFNlbGVjdG9ycy5tYXAocyA9PiBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykpO1xuICAgICAgICAvLyBgcHJvamVjdGlvbkRlZmAgbmVlZHMgYm90aCB0aGUgcGFyc2VkIGFuZCByYXcgdmFsdWUgb2YgdGhlIHNlbGVjdG9yc1xuICAgICAgICBjb25zdCBwYXJzZWQgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHIzU2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IHVuUGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChuZ0NvbnRlbnRTZWxlY3RvcnMpLCB0cnVlKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHBhcnNlZCwgdW5QYXJzZWQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycyk7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyB0aGUgaW5pdGlhbCBwYXNzIHRocm91Z2ggdGhlIG5vZGVzIG9mIHRoaXMgdGVtcGxhdGUuIEluIHRoaXMgcGFzcywgd2VcbiAgICAvLyBxdWV1ZSBhbGwgY3JlYXRpb24gbW9kZSBhbmQgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIGZvciBnZW5lcmF0aW9uIGluIHRoZSBzZWNvbmRcbiAgICAvLyBwYXNzLiBJdCdzIG5lY2Vzc2FyeSB0byBzZXBhcmF0ZSB0aGUgcGFzc2VzIHRvIGVuc3VyZSBsb2NhbCByZWZzIGFyZSBkZWZpbmVkIGJlZm9yZVxuICAgIC8vIHJlc29sdmluZyBiaW5kaW5ncy4gV2UgYWxzbyBjb3VudCBiaW5kaW5ncyBpbiB0aGlzIHBhc3MgYXMgd2Ugd2FsayBib3VuZCBleHByZXNzaW9ucy5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIC8vIEFkZCB0b3RhbCBiaW5kaW5nIGNvdW50IHRvIHB1cmUgZnVuY3Rpb24gY291bnQgc28gcHVyZSBmdW5jdGlvbiBpbnN0cnVjdGlvbnMgYXJlXG4gICAgLy8gZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3Qgc2xvdCBvZmZzZXQgd2hlbiB1cGRhdGUgaW5zdHJ1Y3Rpb25zIGFyZSBwcm9jZXNzZWQuXG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gdGhpcy5fYmluZGluZ1Nsb3RzO1xuXG4gICAgLy8gUGlwZXMgYXJlIHdhbGtlZCBpbiB0aGUgZmlyc3QgcGFzcyAodG8gZW5xdWV1ZSBgcGlwZSgpYCBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYW5kXG4gICAgLy8gYHBpcGVCaW5kYCB1cGRhdGUgaW5zdHJ1Y3Rpb25zKSwgc28gd2UgaGF2ZSB0byB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0cyBtYW51YWxseVxuICAgIC8vIHRvIGFjY291bnQgZm9yIGJpbmRpbmdzLlxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyLnVwZGF0ZVBpcGVTbG90T2Zmc2V0cyh0aGlzLl9iaW5kaW5nU2xvdHMpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IGJlIHByb2Nlc3NlZCBiZWZvcmUgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIHNvIHRlbXBsYXRlKClcbiAgICAvLyBpbnN0cnVjdGlvbnMgY2FuIGJlIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IGludGVybmFsIGNvbnN0IGNvdW50LlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLmZvckVhY2goYnVpbGRUZW1wbGF0ZUZuID0+IGJ1aWxkVGVtcGxhdGVGbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gdGhpcy5fdXBkYXRlQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyAgVmFyaWFibGUgZGVjbGFyYXRpb24gbXVzdCBvY2N1ciBhZnRlciBiaW5kaW5nIHJlc29sdXRpb24gc28gd2UgY2FuIGdlbmVyYXRlIGNvbnRleHRcbiAgICAvLyAgaW5zdHJ1Y3Rpb25zIHRoYXQgYnVpbGQgb24gZWFjaCBvdGhlci4gZS5nLiBjb25zdCBiID0geCgpLiRpbXBsaWNpdCgpOyBjb25zdCBiID0geCgpO1xuICAgIGNvbnN0IGNyZWF0aW9uVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTtcbiAgICBjb25zdCB1cGRhdGVWYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKS5jb25jYXQodGhpcy5fdGVtcFZhcmlhYmxlcyk7XG5cbiAgICBjb25zdCBjcmVhdGlvbkJsb2NrID0gY3JlYXRpb25TdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0aW9uVmFyaWFibGVzLmNvbmNhdChjcmVhdGlvblN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUJsb2NrID0gdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlVmFyaWFibGVzLmNvbmNhdCh1cGRhdGVTdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICAvLyBHZW5lcmF0ZSBtYXBzIG9mIHBsYWNlaG9sZGVyIG5hbWUgdG8gbm9kZSBpbmRleGVzXG4gICAgLy8gVE9ETyh2aWNiKTogVGhpcyBpcyBhIFdJUCwgbm90IGZ1bGx5IHN1cHBvcnRlZCB5ZXRcbiAgICBmb3IgKGNvbnN0IHBoVG9Ob2RlSWR4IG9mIHRoaXMuX3BoVG9Ob2RlSWR4ZXMpIHtcbiAgICAgIGlmIChPYmplY3Qua2V5cyhwaFRvTm9kZUlkeCkubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgICBjb25zdCBwaE1hcCA9IG8udmFyaWFibGUoc2NvcGVkTmFtZSkuc2V0KG1hcFRvRXhwcmVzc2lvbihwaFRvTm9kZUlkeCwgdHJ1ZSkpLnRvQ29uc3REZWNsKCk7XG5cbiAgICAgICAgdGhpcy5fcHJlZml4Q29kZS5wdXNoKHBoTWFwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgLy8gaS5lLiAocmY6IFJlbmRlckZsYWdzLCBjdHg6IGFueSlcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgICAgW1xuICAgICAgICAgIC8vIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIHF1ZXJ5IHJlZnJlc2ggKGkuZS4gbGV0IF90OiBhbnk7KVxuICAgICAgICAgIC4uLnRoaXMuX3ByZWZpeENvZGUsXG4gICAgICAgICAgLy8gQ3JlYXRpbmcgbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5DcmVhdGUpIHsgLi4uIH0pXG4gICAgICAgICAgLi4uY3JlYXRpb25CbG9jayxcbiAgICAgICAgICAvLyBCaW5kaW5nIGFuZCByZWZyZXNoIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuVXBkYXRlKSB7Li4ufSlcbiAgICAgICAgICAuLi51cGRhdGVCbG9jayxcbiAgICAgICAgXSxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0aGlzLnRlbXBsYXRlTmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHsgcmV0dXJuIHRoaXMuX2JpbmRpbmdTY29wZS5nZXQobmFtZSk7IH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgc2VsZWN0b3JJbmRleCA9IG5nQ29udGVudC5zZWxlY3RvckluZGV4O1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG5cbiAgICBjb25zdCBhdHRyaWJ1dGVBc0xpc3Q6IHN0cmluZ1tdID0gW107XG5cbiAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5mb3JFYWNoKChhdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyaWJ1dGUubmFtZTtcbiAgICAgIGlmIChuYW1lICE9PSAnc2VsZWN0Jykge1xuICAgICAgICBhdHRyaWJ1dGVBc0xpc3QucHVzaChuYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZUFzTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpLCBhc0xpdGVyYWwoYXR0cmlidXRlQXNMaXN0KSk7XG4gICAgfSBlbHNlIGlmIChzZWxlY3RvckluZGV4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICB9XG5cblxuICBnZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXk6IHN0cmluZ3xudWxsKSB7XG4gICAgc3dpdGNoIChuYW1lc3BhY2VLZXkpIHtcbiAgICAgIGNhc2UgJ21hdGgnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlTWF0aE1MO1xuICAgICAgY2FzZSAnc3ZnJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZVNWRztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VIVE1MO1xuICAgIH1cbiAgfVxuXG4gIGFkZE5hbWVzcGFjZUluc3RydWN0aW9uKG5zSW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIHRoaXMuX25hbWVzcGFjZSA9IG5zSW5zdHJ1Y3Rpb247XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgbnNJbnN0cnVjdGlvbik7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgd2FzSW5JMThuU2VjdGlvbiA9IHRoaXMuX2luSTE4blNlY3Rpb247XG5cbiAgICBjb25zdCBvdXRwdXRBdHRyczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgYXR0ckkxOG5NZXRhczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgbGV0IGkxOG5NZXRhOiBzdHJpbmcgPSAnJztcblxuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gRWxlbWVudHMgaW5zaWRlIGkxOG4gc2VjdGlvbnMgYXJlIHJlcGxhY2VkIHdpdGggcGxhY2Vob2xkZXJzXG4gICAgLy8gVE9ETyh2aWNiKTogbmVzdGVkIGVsZW1lbnRzIGFyZSBhIFdJUCBpbiB0aGlzIHBoYXNlXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgIGNvbnN0IHBoTmFtZSA9IGVsZW1lbnQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCF0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0pIHtcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0ucHVzaChlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgLy8gSGFuZGxlIGkxOG4gYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyLm5hbWU7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB0cnVlO1xuICAgICAgICB0aGlzLl9pMThuU2VjdGlvbkluZGV4Kys7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF0gPSB7fTtcbiAgICAgICAgaTE4bk1ldGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIGF0dHJJMThuTWV0YXNbbmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCldID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgY29uc3Qgc3R5bGVJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGNsYXNzSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBhbGxPdGhlcklucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgc3dpdGNoIChpbnB1dC50eXBlKSB7XG4gICAgICAgIC8vIFthdHRyLnN0eWxlXSBvciBbYXR0ci5jbGFzc10gc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIHN0eWxpbmctYmFzZWRcbiAgICAgICAgLy8gYmluZGluZ3Mgc2luY2UgdGhleSBhcmUgaW50ZW5kZWQgdG8gYmUgd3JpdHRlbiBkaXJlY3RseSB0byB0aGUgYXR0clxuICAgICAgICAvLyBhbmQgdGhlcmVmb3JlIHdpbGwgc2tpcCBhbGwgc3R5bGUvY2xhc3MgcmVzb2x1dGlvbiB0aGF0IGlzIHByZXNlbnRcbiAgICAgICAgLy8gd2l0aCBzdHlsZT1cIlwiLCBbc3R5bGVdPVwiXCIgYW5kIFtzdHlsZS5wcm9wXT1cIlwiLCBjbGFzcz1cIlwiLFxuICAgICAgICAvLyBbY2xhc3MucHJvcF09XCJcIi4gW2NsYXNzXT1cIlwiIGFzc2lnbm1lbnRzXG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgICAgaWYgKGlucHV0Lm5hbWUgPT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIGdvIGZpcnN0IGluIHRoZSBjb21waWxhdGlvbiAoZm9yIFtzdHlsZV0pXG4gICAgICAgICAgICBzdHlsZUlucHV0cy5zcGxpY2UoMCwgMCwgaW5wdXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNDbGFzc0JpbmRpbmcoaW5wdXQpKSB7XG4gICAgICAgICAgICAvLyB0aGlzIHNob3VsZCBhbHdheXMgZ28gZmlyc3QgaW4gdGhlIGNvbXBpbGF0aW9uIChmb3IgW2NsYXNzXSlcbiAgICAgICAgICAgIGNsYXNzSW5wdXRzLnNwbGljZSgwLCAwLCBpbnB1dCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBCaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgICBzdHlsZUlucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgICBjbGFzc0lucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGxldCBjdXJyU3R5bGVJbmRleCA9IDA7XG4gICAgbGV0IGN1cnJDbGFzc0luZGV4ID0gMDtcbiAgICBsZXQgc3RhdGljU3R5bGVzTWFwOiB7W2tleTogc3RyaW5nXTogYW55fXxudWxsID0gbnVsbDtcbiAgICBsZXQgc3RhdGljQ2xhc3Nlc01hcDoge1trZXk6IHN0cmluZ106IGJvb2xlYW59fG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHN0eWxlc0luZGV4TWFwOiB7W2tleTogc3RyaW5nXTogbnVtYmVyfSA9IHt9O1xuICAgIGNvbnN0IGNsYXNzZXNJbmRleE1hcDoge1trZXk6IHN0cmluZ106IG51bWJlcn0gPSB7fTtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvdXRwdXRBdHRycykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gb3V0cHV0QXR0cnNbbmFtZV07XG4gICAgICBpZiAobmFtZSA9PSAnc3R5bGUnKSB7XG4gICAgICAgIHN0YXRpY1N0eWxlc01hcCA9IHBhcnNlU3R5bGUodmFsdWUpO1xuICAgICAgICBPYmplY3Qua2V5cyhzdGF0aWNTdHlsZXNNYXApLmZvckVhY2gocHJvcCA9PiB7IHN0eWxlc0luZGV4TWFwW3Byb3BdID0gY3VyclN0eWxlSW5kZXgrKzsgfSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT0gJ2NsYXNzJykge1xuICAgICAgICBzdGF0aWNDbGFzc2VzTWFwID0ge307XG4gICAgICAgIHZhbHVlLnNwbGl0KC9cXHMrL2cpLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgICBjbGFzc2VzSW5kZXhNYXBbY2xhc3NOYW1lXSA9IGN1cnJDbGFzc0luZGV4Kys7XG4gICAgICAgICAgc3RhdGljQ2xhc3Nlc01hcCAhW2NsYXNzTmFtZV0gPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwobmFtZSkpO1xuICAgICAgICBpZiAoYXR0ckkxOG5NZXRhcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBwYXJzZUkxOG5NZXRhKGF0dHJJMThuTWV0YXNbbmFtZV0pO1xuICAgICAgICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odmFsdWUsIG1ldGEsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCk7XG4gICAgICAgICAgYXR0cmlidXRlcy5wdXNoKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGxldCBoYXNNYXBCYXNlZFN0eWxpbmcgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0eWxlSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IHN0eWxlSW5wdXRzW2ldO1xuICAgICAgY29uc3QgaXNNYXBCYXNlZFN0eWxlQmluZGluZyA9IGkgPT09IDAgJiYgaW5wdXQubmFtZSA9PT0gJ3N0eWxlJztcbiAgICAgIGlmIChpc01hcEJhc2VkU3R5bGVCaW5kaW5nKSB7XG4gICAgICAgIGhhc01hcEJhc2VkU3R5bGluZyA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKCFzdHlsZXNJbmRleE1hcC5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICBzdHlsZXNJbmRleE1hcFtpbnB1dC5uYW1lXSA9IGN1cnJTdHlsZUluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0lucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5wdXQgPSBjbGFzc0lucHV0c1tpXTtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWRDbGFzc0JpbmRpbmcgPSBpID09PSAwICYmIGlzQ2xhc3NCaW5kaW5nKGlucHV0KTtcbiAgICAgIGlmICghaXNNYXBCYXNlZENsYXNzQmluZGluZyAmJiAhc3R5bGVzSW5kZXhNYXAuaGFzT3duUHJvcGVydHkoaW5wdXQubmFtZSkpIHtcbiAgICAgICAgY2xhc3Nlc0luZGV4TWFwW2lucHV0Lm5hbWVdID0gY3VyckNsYXNzSW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCBhIFtzdHlsZV0gYmluZGluZyBpcyB1c2VkIHRoZW4gc2FuaXRpemF0aW9uIHdpbGxcbiAgICAvLyBhbHdheXMgYmUgaW1wb3J0ZWQgYmVjYXVzZSBpdCBpcyBub3QgcG9zc2libGUgdG8ga25vdyBhaGVhZCBvZiB0aW1lXG4gICAgLy8gd2hldGhlciBzdHlsZSBiaW5kaW5ncyB3aWxsIHVzZSBvciBub3QgdXNlIGFueSBzYW5pdGl6YWJsZSBwcm9wZXJ0aWVzXG4gICAgLy8gdGhhdCBpc1N0eWxlU2FuaXRpemFibGUoKSB3aWxsIGRldGVjdFxuICAgIGxldCB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgPSBoYXNNYXBCYXNlZFN0eWxpbmc7XG5cbiAgICAvLyB0aGlzIHdpbGwgYnVpbGQgdGhlIGluc3RydWN0aW9ucyBzbyB0aGF0IHRoZXkgZmFsbCBpbnRvIHRoZSBmb2xsb3dpbmcgc3ludGF4XG4gICAgLy8gPT4gW3Byb3AxLCBwcm9wMiwgcHJvcDMsIDAsIHByb3AxLCB2YWx1ZTEsIHByb3AyLCB2YWx1ZTJdXG4gICAgT2JqZWN0LmtleXMoc3R5bGVzSW5kZXhNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgPSB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKHByb3ApO1xuICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICB9KTtcblxuICAgIGlmIChzdGF0aWNTdHlsZXNNYXApIHtcbiAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChjb3JlLkluaXRpYWxTdHlsaW5nRmxhZ3MuVkFMVUVTX01PREUpKTtcblxuICAgICAgT2JqZWN0LmtleXMoc3RhdGljU3R5bGVzTWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHN0YXRpY1N0eWxlc01hcCAhW3Byb3BdO1xuICAgICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGNsYXNzZXNJbmRleE1hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgfSk7XG5cbiAgICBpZiAoc3RhdGljQ2xhc3Nlc01hcCkge1xuICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNvcmUuSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuXG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNDbGFzc2VzTWFwKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChjbGFzc05hbWUpKTtcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMgPSBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IHN0eWxlSW5wdXRzLmxlbmd0aCB8fFxuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IGNsYXNzSW5wdXRzLmxlbmd0aDtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBhdHRyaWJ1dGVzLnB1c2goLi4udGhpcy5wcmVwYXJlU3ludGhldGljQW5kU2VsZWN0T25seUF0dHJzKGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMpKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy50b0F0dHJzUGFyYW0oYXR0cmlidXRlcykpO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8ZGl2ICNmb28gI2Jhcj1cImJhelwiPilcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcihlbGVtZW50LnJlZmVyZW5jZXMpKTtcblxuICAgIGNvbnN0IHdhc0luTmFtZXNwYWNlID0gdGhpcy5fbmFtZXNwYWNlO1xuICAgIGNvbnN0IGN1cnJlbnROYW1lc3BhY2UgPSB0aGlzLmdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleSk7XG5cbiAgICAvLyBJZiB0aGUgbmFtZXNwYWNlIGlzIGNoYW5naW5nIG5vdywgaW5jbHVkZSBhbiBpbnN0cnVjdGlvbiB0byBjaGFuZ2UgaXRcbiAgICAvLyBkdXJpbmcgZWxlbWVudCBjcmVhdGlvbi5cbiAgICBpZiAoY3VycmVudE5hbWVzcGFjZSAhPT0gd2FzSW5OYW1lc3BhY2UpIHtcbiAgICAgIHRoaXMuYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24oY3VycmVudE5hbWVzcGFjZSwgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1wbGljaXQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIWhhc1N0eWxpbmdJbnN0cnVjdGlvbnMgJiYgIWlzTmdDb250YWluZXIgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT09IDAgJiYgZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA9PT0gMDtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50LCB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gaW5pdGlhbCBzdHlsaW5nIGZvciBzdGF0aWMgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGVzXG4gICAgICBpZiAoaGFzU3R5bGluZ0luc3RydWN0aW9ucykge1xuICAgICAgICBjb25zdCBwYXJhbXNMaXN0OiAoby5FeHByZXNzaW9uKVtdID0gW107XG5cbiAgICAgICAgaWYgKGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIGNsYXNzIHN0eWxpbmcgKGUuZy4gY2xhc3M9XCJmb29cIikgdmFsdWVzXG4gICAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50Q2xhc3NgIHNvIHRoYXQgdGhlIGluaXRpYWwgY2xhc3NcbiAgICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIGNsYXNzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBjbGFzcyB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChcbiAgICAgICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMpLCB0cnVlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLmxlbmd0aCB8fCB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAvLyBubyBwb2ludCBpbiBoYXZpbmcgYW4gZXh0cmEgYG51bGxgIHZhbHVlIHVubGVzcyB0aGVyZSBhcmUgZm9sbG93LXVwIHBhcmFtc1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgc3R5bGUgKGUuZy4gc3R5bGU9XCJmb29cIikgdmFsdWVzXG4gICAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50U3R5bGVgIHNvIHRoYXQgdGhlIGluaXRpYWwgc3R5bGVzXG4gICAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBzdHlsZXMgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIHN0eWxlIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKFxuICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucyksIHRydWUpKTtcbiAgICAgICAgfSBlbHNlIGlmICh1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAvLyBubyBwb2ludCBpbiBoYXZpbmcgYW4gZXh0cmEgYG51bGxgIHZhbHVlIHVubGVzcyB0aGVyZSBhcmUgZm9sbG93LXVwIHBhcmFtc1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5lbGVtZW50U3R5bGluZywgcGFyYW1zTGlzdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICAgIGVsZW1lbnQub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBvdXRwdXRBc3Quc291cmNlU3BhbiwgUjMubGlzdGVuZXIsXG4gICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcihlbGVtZW50Lm5hbWUsIG91dHB1dEFzdCkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKChzdHlsZUlucHV0cy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoKSAmJiBoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zKSB7XG4gICAgICBjb25zdCBpbmRleExpdGVyYWwgPSBvLmxpdGVyYWwoZWxlbWVudEluZGV4KTtcblxuICAgICAgY29uc3QgZmlyc3RTdHlsZSA9IHN0eWxlSW5wdXRzWzBdO1xuICAgICAgY29uc3QgbWFwQmFzZWRTdHlsZUlucHV0ID0gZmlyc3RTdHlsZSAmJiBmaXJzdFN0eWxlLm5hbWUgPT0gJ3N0eWxlJyA/IGZpcnN0U3R5bGUgOiBudWxsO1xuXG4gICAgICBjb25zdCBmaXJzdENsYXNzID0gY2xhc3NJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzSW5wdXQgPSBmaXJzdENsYXNzICYmIGlzQ2xhc3NCaW5kaW5nKGZpcnN0Q2xhc3MpID8gZmlyc3RDbGFzcyA6IG51bGw7XG5cbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IG1hcEJhc2VkU3R5bGVJbnB1dCB8fCBtYXBCYXNlZENsYXNzSW5wdXQ7XG4gICAgICBpZiAoc3R5bGluZ0lucHV0KSB7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRTdHlsaW5nTWFwLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtpbmRleExpdGVyYWxdO1xuXG4gICAgICAgICAgaWYgKG1hcEJhc2VkQ2xhc3NJbnB1dCkge1xuICAgICAgICAgICAgY29uc3QgbWFwQmFzZWRDbGFzc1ZhbHVlID0gbWFwQmFzZWRDbGFzc0lucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgbWFwQmFzZWRDbGFzc1ZhbHVlLCB0cnVlKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtYXBCYXNlZFN0eWxlSW5wdXQpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRTdHlsZUlucHV0KSB7XG4gICAgICAgICAgICBjb25zdCBtYXBCYXNlZFN0eWxlVmFsdWUgPSBtYXBCYXNlZFN0eWxlSW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCBtYXBCYXNlZFN0eWxlVmFsdWUsIHRydWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGV0IGxhc3RJbnB1dENvbW1hbmQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG4gICAgICBpZiAoc3R5bGVJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRTdHlsZUlucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IHN0eWxlSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBzdHlsZUlucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHN0eWxlSW5kZXg6IG51bWJlciA9IHN0eWxlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRTdHlsZVByb3AsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIGluZGV4TGl0ZXJhbCwgby5saXRlcmFsKHN0eWxlSW5kZXgpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IHN0eWxlSW5wdXRzW3N0eWxlSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2xhc3NJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRDbGFzc0lucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBjbGFzc0lucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IGNsYXNzSW5kZXg6IG51bWJlciA9IGNsYXNzZXNJbmRleE1hcFtrZXldICE7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50Q2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICBpbmRleExpdGVyYWwsIG8ubGl0ZXJhbChjbGFzc0luZGV4KSxcbiAgICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgdHJ1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgICAgXTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxhc3RJbnB1dENvbW1hbmQgPSBjbGFzc0lucHV0c1tjbGFzc0lucHV0cy5sZW5ndGggLSAxXTtcbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihsYXN0SW5wdXRDb21tYW5kICEuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdBcHBseSwgW2luZGV4TGl0ZXJhbF0pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBtYXBCaW5kaW5nVG9JbnN0cnVjdGlvbihpbnB1dC50eXBlKTtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIHNldEF0dHJpYnV0ZSB3aXRob3V0IGEgdmFsdWUgZG9lc24ndCBtYWtlIGFueSBzZW5zZVxuICAgICAgICBpZiAodmFsdWUubmFtZSB8fCB2YWx1ZS52YWx1ZSkge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBwcmVwYXJlU3ludGhldGljQXR0cmlidXRlTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRBdHRyaWJ1dGUsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwobmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUpXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuXG4gICAgICAgIC8vIFRPRE8oY2h1Y2tqKTogcnVudGltZTogc2VjdXJpdHkgY29udGV4dFxuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGlucHV0Lm5hbWUpLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgIF07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoYGJpbmRpbmcgdHlwZSAke2lucHV0LnR5cGV9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT0gMSAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5jaGlsZHJlblswXSBhcyB0LlRleHQ7XG4gICAgICB0aGlzLnZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0LCBpMThuTWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZW5hYmxlQmluZGluZ3MpO1xuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBlbGVtZW50LnNvdXJjZVNwYW4sXG4gICAgICAgICAgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG5cbiAgICAvLyBSZXN0b3JlIHRoZSBzdGF0ZSBiZWZvcmUgZXhpdGluZyB0aGlzIG5vZGVcbiAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gd2FzSW5JMThuU2VjdGlvbjtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBsZXQgZWxOYW1lID0gJyc7XG4gICAgaWYgKHRlbXBsYXRlLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0ZW1wbGF0ZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgLy8gV2hlbiB0aGUgdGVtcGxhdGUgYXMgYSBzaW5nbGUgY2hpbGQsIGRlcml2ZSB0aGUgY29udGV4dCBuYW1lIGZyb20gdGhlIHRhZ1xuICAgICAgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKCh0ZW1wbGF0ZS5jaGlsZHJlblswXSBhcyB0LkVsZW1lbnQpLm5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRleHROYW1lID0gZWxOYW1lID8gYCR7dGhpcy5jb250ZXh0TmFtZX1fJHtlbE5hbWV9YCA6ICcnO1xuXG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID1cbiAgICAgICAgY29udGV4dE5hbWUgPyBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWAgOiBgVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWA7XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgIG8udmFyaWFibGUodGVtcGxhdGVOYW1lKSxcbiAgICAgIG8uVFlQRURfTlVMTF9FWFBSLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICB0ZW1wbGF0ZS5hdHRyaWJ1dGVzLmZvckVhY2goXG4gICAgICAgIChhOiB0LlRleHRBdHRyaWJ1dGUpID0+IHsgYXR0cnNFeHBycy5wdXNoKGFzTGl0ZXJhbChhLm5hbWUpLCBhc0xpdGVyYWwoYS52YWx1ZSkpOyB9KTtcbiAgICBhdHRyc0V4cHJzLnB1c2goLi4udGhpcy5wcmVwYXJlU3ludGhldGljQW5kU2VsZWN0T25seUF0dHJzKHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIodGVtcGxhdGUucmVmZXJlbmNlcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIHAoMSwgJ2Zvck9mJywgybViaW5kKGN0eC5pdGVtcykpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24odGVtcGxhdGUuc291cmNlU3BhbiwgUjMuZWxlbWVudFByb3BlcnR5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLCBvLmxpdGVyYWwoaW5wdXQubmFtZSksXG4gICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGNvbnRleHQsIHZhbHVlKVxuICAgICAgICBdO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGVtcGxhdGVOYW1lLCBbXSxcbiAgICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSxcbiAgICAgICAgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4KTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+IHt7IGZvbyB9fSA8L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgfSk7XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoXG4gICAgICAgICAgMiwgMCwgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuXG4gICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dEJpbmRpbmcsXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwobm9kZUluZGV4KSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgdmFsdWUpXSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCBvLmxpdGVyYWwodGV4dC52YWx1ZSldKTtcbiAgfVxuXG4gIC8vIFdoZW4gdGhlIGNvbnRlbnQgb2YgdGhlIGVsZW1lbnQgaXMgYSBzaW5nbGUgdGV4dCBub2RlIHRoZSB0cmFuc2xhdGlvbiBjYW4gYmUgaW5saW5lZDpcbiAgLy9cbiAgLy8gYDxwIGkxOG49XCJkZXNjfG1lYW5cIj5zb21lIGNvbnRlbnQ8L3A+YFxuICAvLyBjb21waWxlcyB0b1xuICAvLyBgYGBcbiAgLy8gLyoqXG4gIC8vICogQGRlc2MgZGVzY1xuICAvLyAqIEBtZWFuaW5nIG1lYW5cbiAgLy8gKi9cbiAgLy8gY29uc3QgTVNHX1hZWiA9IGdvb2cuZ2V0TXNnKCdzb21lIGNvbnRlbnQnKTtcbiAgLy8gaTAuybV0ZXh0KDEsIE1TR19YWVopO1xuICAvLyBgYGBcbiAgdmlzaXRTaW5nbGVJMThuVGV4dENoaWxkKHRleHQ6IHQuVGV4dCwgaTE4bk1ldGE6IHN0cmluZykge1xuICAgIGNvbnN0IG1ldGEgPSBwYXJzZUkxOG5NZXRhKGkxOG5NZXRhKTtcbiAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHRleHQudmFsdWUsIG1ldGEsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCk7XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCB2YXJpYWJsZV0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKTogdm9pZCB7XG4gICAgZm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1QpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdDogby5FeHByZXNzaW9uLCB2YWx1ZTogQVNULCBza2lwQmluZEZuPzogYm9vbGVhbik6XG4gICAgICBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGludGVycG9sYXRpb25GbiA9XG4gICAgICAgIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IGludGVycG9sYXRlIDogKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpO1xuXG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgaW1wbGljaXQsIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgaW50ZXJwb2xhdGlvbkZuKTtcbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcblxuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiB8fCBza2lwQmluZEZuID8gdmFsRXhwciA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbdmFsRXhwcl0pO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaERpcmVjdGl2ZXModGFnTmFtZTogc3RyaW5nLCBlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSkge1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IodGFnTmFtZSwgZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsKSk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChjc3NTZWxlY3Rvciwgc3RhdGljVHlwZSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVTeW50aGV0aWNBbmRTZWxlY3RPbmx5QXR0cnMoaW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10sIG91dHB1dHM6IHQuQm91bmRFdmVudFtdKTpcbiAgICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBhdHRyRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3Qgbm9uU3ludGhldGljSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGlmIChpbnB1dHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBFTVBUWV9TVFJJTkdfRVhQUiA9IGFzTGl0ZXJhbCgnJyk7XG4gICAgICBpbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICAvLyBAYXR0cmlidXRlcyBhcmUgZm9yIFJlbmRlcmVyMiBhbmltYXRpb24gQHRyaWdnZXJzLCBidXQgdGhpcyBmZWF0dXJlXG4gICAgICAgICAgLy8gbWF5IGJlIHN1cHBvcnRlZCBkaWZmZXJlbnRseSBpbiBmdXR1cmUgdmVyc2lvbnMgb2YgYW5ndWxhci4gSG93ZXZlcixcbiAgICAgICAgICAvLyBAdHJpZ2dlcnMgc2hvdWxkIGFsd2F5cyBqdXN0IGJlIHRyZWF0ZWQgYXMgcmVndWxhciBhdHRyaWJ1dGVzIChpdCdzIHVwXG4gICAgICAgICAgLy8gdG8gdGhlIHJlbmRlcmVyIHRvIGRldGVjdCBhbmQgdXNlIHRoZW0gaW4gYSBzcGVjaWFsIHdheSkuXG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goYXNMaXRlcmFsKHByZXBhcmVTeW50aGV0aWNBdHRyaWJ1dGVOYW1lKGlucHV0Lm5hbWUpKSwgRU1QVFlfU1RSSU5HX0VYUFIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5vblN5bnRoZXRpY0lucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKG5vblN5bnRoZXRpY0lucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5TZWxlY3RPbmx5KSk7XG4gICAgICBub25TeW50aGV0aWNJbnB1dHMuZm9yRWFjaCgoaTogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4gYXR0ckV4cHJzLnB1c2goYXNMaXRlcmFsKGkubmFtZSkpKTtcbiAgICAgIG91dHB1dHMuZm9yRWFjaCgobzogdC5Cb3VuZEV2ZW50KSA9PiBhdHRyRXhwcnMucHVzaChhc0xpdGVyYWwoby5uYW1lKSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIHRvQXR0cnNQYXJhbShhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIGF0dHJzRXhwcnMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cnNFeHBycyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzUGFyYW1ldGVyKHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IGZsYXR0ZW4ocmVmZXJlbmNlcy5tYXAocmVmZXJlbmNlID0+IHtcbiAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgICByZXRyaWV2YWxMZXZlbCwgcmVmZXJlbmNlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIGUuZy4geCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByKDEpO1xuICAgICAgICAgICAgY29uc3QgcmVmRXhwciA9IGxocy5zZXQoby5pbXBvcnRFeHByKFIzLnJlZmVyZW5jZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgcmV0dXJuIFtyZWZlcmVuY2UubmFtZSwgcmVmZXJlbmNlLnZhbHVlXTtcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyZWZzUGFyYW0pLCB0cnVlKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpOiAoKSA9PiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgZXZOYW1lU2FuaXRpemVkID0gc2FuaXRpemVJZGVudGlmaWVyKG91dHB1dEFzdC5uYW1lKTtcbiAgICBjb25zdCB0YWdOYW1lU2FuaXRpemVkID0gc2FuaXRpemVJZGVudGlmaWVyKHRhZ05hbWUpO1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWVTYW5pdGl6ZWR9XyR7ZXZOYW1lU2FuaXRpemVkfV9saXN0ZW5lcmA7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuXG4gICAgICBjb25zdCBsaXN0ZW5lclNjb3BlID0gdGhpcy5fYmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKHRoaXMuX2JpbmRpbmdTY29wZS5iaW5kaW5nTGV2ZWwpO1xuXG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIGxpc3RlbmVyU2NvcGUsIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgb3V0cHV0QXN0LmhhbmRsZXIsICdiJyxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuXG4gICAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgICAuLi5saXN0ZW5lclNjb3BlLnJlc3RvcmVWaWV3U3RhdGVtZW50KCksIC4uLmxpc3RlbmVyU2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSxcbiAgICAgICAgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXG4gICAgICBdO1xuXG4gICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLFxuICAgICAgICAgIGZ1bmN0aW9uTmFtZSk7XG5cbiAgICAgIHJldHVybiBbby5saXRlcmFsKG91dHB1dEFzdC5uYW1lKSwgaGFuZGxlcl07XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVDb252ZXJ0ZXIgZXh0ZW5kcyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciB7XG4gIHByaXZhdGUgX3BpcGVCaW5kRXhwcnM6IEZ1bmN0aW9uQ2FsbFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIG9uZSBzbG90IHBlciBwaXBlIGFyZ3VtZW50XG4gICAgY29uc3QgcHVyZUZ1bmN0aW9uU2xvdCA9IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cygyICsgcGlwZS5hcmdzLmxlbmd0aCk7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChwaXBlLnNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiksIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPVxuICAgICAgICBpc1Zhckxlbmd0aCA/IHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBhcmdzKV0pIDogdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCB0YXJnZXQsIFtcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBGdW5jdGlvbkNhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGggPiAwIHx8IGVycm9yKGBFeHBlY3RlZCBhcmd1bWVudHMgdG8gYSBsaXRlcmFsIGZhY3RvcnkgZnVuY3Rpb25gKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc3RhcnRTbG90KSxcbiAgICBsaXRlcmFsRmFjdG9yeSxcbiAgXTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4gby5TdGF0ZW1lbnRbXTtcblxuLyoqIFRoZSBwcmVmaXggdXNlZCB0byBnZXQgYSBzaGFyZWQgY29udGV4dCBpbiBCaW5kaW5nU2NvcGUncyBtYXAuICovXG5jb25zdCBTSEFSRURfQ09OVEVYVF9LRVkgPSAnJCRzaGFyZWRfY3R4JCQnO1xuXG4vKipcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSB4KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5SZWFkVmFyRXhwcjsgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaztcbiAgZGVjbGFyZTogYm9vbGVhbjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyBfUk9PVF9TQ09QRTogQmluZGluZ1Njb3BlO1xuXG4gIHN0YXRpYyBnZXQgUk9PVF9TQ09QRSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICghQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFKSB7XG4gICAgICBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KDAsICckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG4gICAgfVxuICAgIHJldHVybiBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEU7XG4gIH1cblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICYmICF2YWx1ZS5kZWNsYXJlKSB7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlLmxocztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhpcyBwb2ludCwgd2UgYXJlIGxvb2tpbmcgZm9yIGEgcHJvcGVydHkgb24gdGhlIHRvcCBsZXZlbCBjb21wb25lbnRcbiAgICAvLyAtIElmIGxldmVsID09PSAwLCB3ZSBhcmUgb24gdGhlIHRvcCBhbmQgZG9uJ3QgbmVlZCB0byByZS1kZWNsYXJlIGBjdHhgLlxuICAgIC8vIC0gSWYgbGV2ZWwgPiAwLCB3ZSBhcmUgaW4gYW4gZW1iZWRkZWQgdmlldy4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAvLyBsb2NhbCB2YXIgd2UgdXNlZCB0byBzdG9yZSB0aGUgY29tcG9uZW50IGNvbnRleHQsIGUuZy4gY29uc3QgJGNvbXAkID0geCgpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdMZXZlbCA9PT0gMCA/IG51bGwgOiB0aGlzLmdldENvbXBvbmVudFByb3BlcnR5KG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxvY2FsIHZhcmlhYmxlIGZvciBsYXRlciByZWZlcmVuY2UuXG4gICAqXG4gICAqIEBwYXJhbSByZXRyaWV2YWxMZXZlbCBUaGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWRcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgdmFyaWFibGUuXG4gICAqIEBwYXJhbSBsaHMgQVNUIHJlcHJlc2VudGluZyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuXG4gICAqIEBwYXJhbSBwcmlvcml0eSBUaGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhclxuICAgKiBAcGFyYW0gZGVjbGFyZUxvY2FsQ2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIGludm9rZSB3aGVuIGRlY2xhcmluZyB0aGlzIGxvY2FsIHZhclxuICAgKi9cbiAgc2V0KHJldHJpZXZhbExldmVsOiBudW1iZXIsIG5hbWU6IHN0cmluZywgbGhzOiBvLlJlYWRWYXJFeHByLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2spOiBCaW5kaW5nU2NvcGUge1xuICAgICF0aGlzLm1hcC5oYXMobmFtZSkgfHxcbiAgICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIHRoaXMubWFwLnNldChuYW1lLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IGRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgcHJpb3JpdHk6IHByaW9yaXR5XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlcik6IEJpbmRpbmdTY29wZSB7XG4gICAgY29uc3QgbmV3U2NvcGUgPSBuZXcgQmluZGluZ1Njb3BlKGxldmVsLCB0aGlzKTtcbiAgICBpZiAobGV2ZWwgPiAwKSBuZXdTY29wZS5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gICAgcmV0dXJuIG5ld1Njb3BlO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHJ8bnVsbCB7XG4gICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCkge1xuICAgICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIGlmIChzaGFyZWRDdHhPYmopIHtcbiAgICAgICAgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUgKyB0aGlzLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICB0aGlzLm1hcC5zZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgLy8gY29uc3QgY3R4X3IwID0geCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhUXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDApO1xuICAgIHJldHVybiBjb21wb25lbnRWYWx1ZS5saHMucHJvcChuYW1lKTtcbiAgfVxuXG4gIG1heWJlUmVzdG9yZVZpZXcocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpICYmIHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwpIHtcbiAgICAgIGlmICghdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICAgIC8vIHBhcmVudCBzYXZlcyB2YXJpYWJsZSB0byBnZW5lcmF0ZSBhIHNoYXJlZCBgY29uc3QgJHMkID0gZ1YoKTtgIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSA9IG8udmFyaWFibGUodGhpcy5wYXJlbnQgIS5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgPSB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gICAgfVxuICB9XG5cbiAgcmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gclYoJHN0YXRlJCk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFtpbnN0cnVjdGlvbihudWxsLCBSMy5yZXN0b3JlVmlldywgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZV0pLnRvU3RtdCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgdmlld1NuYXBzaG90U3RhdGVtZW50cygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyBjb25zdCAkc3RhdGUkID0gZ1YoKTtcbiAgICBjb25zdCBnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uID0gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuZ2V0Q3VycmVudFZpZXcsIFtdKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZS5zZXQoZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbikudG9Db25zdERlY2woKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIGlzTGlzdGVuZXJTY29wZSgpIHsgcmV0dXJuIHRoaXMucGFyZW50ICYmIHRoaXMucGFyZW50LmJpbmRpbmdMZXZlbCA9PT0gdGhpcy5iaW5kaW5nTGV2ZWw7IH1cblxuICB2YXJpYWJsZURlY2xhcmF0aW9ucygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBsZXQgY3VycmVudENvbnRleHRMZXZlbCA9IDA7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5tYXAudmFsdWVzKCkpXG4gICAgICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUuZGVjbGFyZSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIucmV0cmlldmFsTGV2ZWwgLSBhLnJldHJpZXZhbExldmVsIHx8IGIucHJpb3JpdHkgLSBhLnByaW9yaXR5KVxuICAgICAgICAucmVkdWNlKChzdG10czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IEJpbmRpbmdEYXRhKSA9PiB7XG4gICAgICAgICAgY29uc3QgbGV2ZWxEaWZmID0gdGhpcy5iaW5kaW5nTGV2ZWwgLSB2YWx1ZS5yZXRyaWV2YWxMZXZlbDtcbiAgICAgICAgICBjb25zdCBjdXJyU3RtdHMgPSB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAhKHRoaXMsIGxldmVsRGlmZiAtIGN1cnJlbnRDb250ZXh0TGV2ZWwpO1xuICAgICAgICAgIGN1cnJlbnRDb250ZXh0TGV2ZWwgPSBsZXZlbERpZmY7XG4gICAgICAgICAgcmV0dXJuIHN0bXRzLmNvbmNhdChjdXJyU3RtdHMpO1xuICAgICAgICB9LCBbXSkgYXMgby5TdGF0ZW1lbnRbXTtcbiAgfVxuXG5cbiAgZnJlc2hSZWZlcmVuY2VOYW1lKCk6IHN0cmluZyB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZSA9IHRoaXM7XG4gICAgLy8gRmluZCB0aGUgdG9wIHNjb3BlIGFzIGl0IG1haW50YWlucyB0aGUgZ2xvYmFsIHJlZmVyZW5jZSBjb3VudFxuICAgIHdoaWxlIChjdXJyZW50LnBhcmVudCkgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIGNvbnN0IHJlZiA9IGAke1JFRkVSRU5DRV9QUkVGSVh9JHtjdXJyZW50LnJlZmVyZW5jZU5hbWVJbmRleCsrfWA7XG4gICAgcmV0dXJuIHJlZjtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ3NzU2VsZWN0b3JgIGdpdmVuIGEgdGFnIG5hbWUgYW5kIGEgbWFwIG9mIGF0dHJpYnV0ZXNcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3IodGFnOiBzdHJpbmcsIGF0dHJpYnV0ZXM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KHRhZyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vLyBQYXJzZSBpMThuIG1ldGFzIGxpa2U6XG4vLyAtIFwiQEBpZFwiLFxuLy8gLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4vLyAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG5mdW5jdGlvbiBwYXJzZUkxOG5NZXRhKGkxOG4/OiBzdHJpbmcpOiB7ZGVzY3JpcHRpb24/OiBzdHJpbmcsIGlkPzogc3RyaW5nLCBtZWFuaW5nPzogc3RyaW5nfSB7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBpZDogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAoaTE4bikge1xuICAgIC8vIFRPRE8odmljYik6IGZpZ3VyZSBvdXQgaG93IHRvIGZvcmNlIGEgbWVzc2FnZSBJRCB3aXRoIGNsb3N1cmUgP1xuICAgIGNvbnN0IGlkSW5kZXggPSBpMThuLmluZGV4T2YoSURfU0VQQVJBVE9SKTtcblxuICAgIGNvbnN0IGRlc2NJbmRleCA9IGkxOG4uaW5kZXhPZihNRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBpZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFtpMThuLnNsaWNlKDAsIGlkSW5kZXgpLCBpMThuLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbaTE4biwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtkZXNjcmlwdGlvbiwgaWQsIG1lYW5pbmd9O1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZShhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGFyZ3MgPSBhcmdzLnNsaWNlKDEpOyAgLy8gSWdub3JlIHRoZSBsZW5ndGggcHJlZml4IGFkZGVkIGZvciByZW5kZXIyXG4gIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24xKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjMpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb240KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjUpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb243KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjgpLmNhbGxGbihhcmdzKTtcbiAgfVxuICAoYXJncy5sZW5ndGggPj0gMTkgJiYgYXJncy5sZW5ndGggJSAyID09IDEpIHx8XG4gICAgICBlcnJvcihgSW52YWxpZCBpbnRlcnBvbGF0aW9uIGFyZ3VtZW50IGxlbmd0aCAke2FyZ3MubGVuZ3RofWApO1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb25WKS5jYWxsRm4oW28ubGl0ZXJhbEFycihhcmdzKV0pO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgb3B0aW9uczoge3ByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFufSA9IHt9LFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcpOiB7XG4gIGVycm9ycz86IFBhcnNlRXJyb3JbXSxcbiAgbm9kZXM6IHQuTm9kZVtdLFxuICBoYXNOZ0NvbnRlbnQ6IGJvb2xlYW4sXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10sXG4gIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmdcbn0ge1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG4gIGNvbnN0IHBhcnNlUmVzdWx0ID0gaHRtbFBhcnNlci5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwpO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBoYXNOZ0NvbnRlbnQ6IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBbXSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGhcbiAgICB9O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG4gIGlmICghb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgaGFzTmdDb250ZW50LCBuZ0NvbnRlbnRTZWxlY3RvcnMsIGVycm9yc30gPVxuICAgICAgaHRtbEFzdFRvUmVuZGVyM0FzdChyb290Tm9kZXMsIGJpbmRpbmdQYXJzZXIpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGhhc05nQ29udGVudDogZmFsc2UsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aFxuICAgIH07XG4gIH1cblxuICByZXR1cm4ge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGh9O1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoKTogQmluZGluZ1BhcnNlciB7XG4gIHJldHVybiBuZXcgQmluZGluZ1BhcnNlcihcbiAgICAgIG5ldyBQYXJzZXIobmV3IExleGVyKCkpLCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCksIG51bGwsXG4gICAgICBbXSk7XG59XG5cbmZ1bmN0aW9uIGlzQ2xhc3NCaW5kaW5nKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbnB1dC5uYW1lID09ICdjbGFzc05hbWUnIHx8IGlucHV0Lm5hbWUgPT0gJ2NsYXNzJztcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlLCBjb250ZXh0OiBjb3JlLlNlY3VyaXR5Q29udGV4dCkge1xuICBzd2l0Y2ggKGNvbnRleHQpIHtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplSHRtbCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TQ1JJUFQ6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU2NyaXB0KTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNUWUxFOlxuICAgICAgLy8gdGhlIGNvbXBpbGVyIGRvZXMgbm90IGZpbGwgaW4gYW4gaW5zdHJ1Y3Rpb24gZm9yIFtzdHlsZS5wcm9wP10gYmluZGluZ1xuICAgICAgLy8gdmFsdWVzIGJlY2F1c2UgdGhlIHN0eWxlIGFsZ29yaXRobSBrbm93cyBpbnRlcm5hbGx5IHdoYXQgcHJvcHMgYXJlIHN1YmplY3RcbiAgICAgIC8vIHRvIHNhbml0aXphdGlvbiAob25seSBbYXR0ci5zdHlsZV0gdmFsdWVzIGFyZSBleHBsaWNpdGx5IHNhbml0aXplZClcbiAgICAgIHJldHVybiBpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0eWxlU2FuaXRpemFibGUocHJvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHN3aXRjaCAocHJvcCkge1xuICAgIGNhc2UgJ2JhY2tncm91bmQtaW1hZ2UnOlxuICAgIGNhc2UgJ2JhY2tncm91bmQnOlxuICAgIGNhc2UgJ2JvcmRlci1pbWFnZSc6XG4gICAgY2FzZSAnZmlsdGVyJzpcbiAgICBjYXNlICdsaXN0LXN0eWxlJzpcbiAgICBjYXNlICdsaXN0LXN0eWxlLWltYWdlJzpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVN5bnRoZXRpY0F0dHJpYnV0ZU5hbWUobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiAnQCcgKyBuYW1lO1xufVxuIl19