/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../core';
import * as e from '../../../expression_parser/ast';
import * as i18n from '../../../i18n/i18n_ast';
import { splitNsName } from '../../../ml_parser/tags';
import * as o from '../../../output/output_ast';
import { ParseSourceSpan } from '../../../parse_util';
import * as t from '../../../render3/r3_ast';
import { icuFromI18nMessage } from '../../../render3/view/i18n/util';
import { DomElementSchemaRegistry } from '../../../schema/dom_element_schema_registry';
import * as ir from '../ir';
import { ComponentCompilationJob, HostBindingCompilationJob, } from './compilation';
import { BINARY_OPERATORS, namespaceForKey, prefixWithNamespace } from './conversion';
const compatibilityMode = ir.CompatibilityMode.TemplateDefinitionBuilder;
// Schema containing DOM elements and their properties.
const domSchema = new DomElementSchemaRegistry();
// Tag name of the `ng-template` element.
const NG_TEMPLATE_TAG_NAME = 'ng-template';
export function isI18nRootNode(meta) {
    return meta instanceof i18n.Message;
}
export function isSingleI18nIcu(meta) {
    return isI18nRootNode(meta) && meta.nodes.length === 1 && meta.nodes[0] instanceof i18n.Icu;
}
/**
 * Process a template AST and convert it into a `ComponentCompilation` in the intermediate
 * representation.
 * TODO: Refactor more of the ingestion code into phases.
 */
export function ingestComponent(componentName, template, constantPool, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn) {
    const job = new ComponentCompilationJob(componentName, constantPool, compatibilityMode, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn);
    ingestNodes(job.root, template);
    return job;
}
/**
 * Process a host binding AST and convert it into a `HostBindingCompilationJob` in the intermediate
 * representation.
 */
export function ingestHostBinding(input, bindingParser, constantPool) {
    const job = new HostBindingCompilationJob(input.componentName, constantPool, compatibilityMode);
    for (const property of input.properties ?? []) {
        let bindingKind = ir.BindingKind.Property;
        // TODO: this should really be handled in the parser.
        if (property.name.startsWith('attr.')) {
            property.name = property.name.substring('attr.'.length);
            bindingKind = ir.BindingKind.Attribute;
        }
        if (property.isAnimation) {
            bindingKind = ir.BindingKind.Animation;
        }
        const securityContexts = bindingParser
            .calcPossibleSecurityContexts(input.componentSelector, property.name, bindingKind === ir.BindingKind.Attribute)
            .filter((context) => context !== SecurityContext.NONE);
        ingestHostProperty(job, property, bindingKind, securityContexts);
    }
    for (const [name, expr] of Object.entries(input.attributes) ?? []) {
        const securityContexts = bindingParser
            .calcPossibleSecurityContexts(input.componentSelector, name, true)
            .filter((context) => context !== SecurityContext.NONE);
        ingestHostAttribute(job, name, expr, securityContexts);
    }
    for (const event of input.events ?? []) {
        ingestHostEvent(job, event);
    }
    return job;
}
// TODO: We should refactor the parser to use the same types and structures for host bindings as
// with ordinary components. This would allow us to share a lot more ingestion code.
export function ingestHostProperty(job, property, bindingKind, securityContexts) {
    let expression;
    const ast = property.expression.ast;
    if (ast instanceof e.Interpolation) {
        expression = new ir.Interpolation(ast.strings, ast.expressions.map((expr) => convertAst(expr, job, property.sourceSpan)), []);
    }
    else {
        expression = convertAst(ast, job, property.sourceSpan);
    }
    job.root.update.push(ir.createBindingOp(job.root.xref, bindingKind, property.name, expression, null, securityContexts, false, false, null, 
    /* TODO: How do Host bindings handle i18n attrs? */ null, property.sourceSpan));
}
export function ingestHostAttribute(job, name, value, securityContexts) {
    const attrBinding = ir.createBindingOp(job.root.xref, ir.BindingKind.Attribute, name, value, null, securityContexts, 
    /* Host attributes should always be extracted to const hostAttrs, even if they are not
     *strictly* text literals */
    true, false, null, 
    /* TODO */ null, 
    /** TODO: May be null? */ value.sourceSpan);
    job.root.update.push(attrBinding);
}
export function ingestHostEvent(job, event) {
    const [phase, target] = event.type !== e.ParsedEventType.Animation
        ? [null, event.targetOrPhase]
        : [event.targetOrPhase, null];
    const eventBinding = ir.createListenerOp(job.root.xref, new ir.SlotHandle(), event.name, null, makeListenerHandlerOps(job.root, event.handler, event.handlerSpan), phase, target, true, event.sourceSpan);
    job.root.create.push(eventBinding);
}
/**
 * Ingest the nodes of a template AST into the given `ViewCompilation`.
 */
function ingestNodes(unit, template) {
    for (const node of template) {
        if (node instanceof t.Element) {
            ingestElement(unit, node);
        }
        else if (node instanceof t.Template) {
            ingestTemplate(unit, node);
        }
        else if (node instanceof t.Content) {
            ingestContent(unit, node);
        }
        else if (node instanceof t.Text) {
            ingestText(unit, node, null);
        }
        else if (node instanceof t.BoundText) {
            ingestBoundText(unit, node, null);
        }
        else if (node instanceof t.IfBlock) {
            ingestIfBlock(unit, node);
        }
        else if (node instanceof t.SwitchBlock) {
            ingestSwitchBlock(unit, node);
        }
        else if (node instanceof t.DeferredBlock) {
            ingestDeferBlock(unit, node);
        }
        else if (node instanceof t.Icu) {
            ingestIcu(unit, node);
        }
        else if (node instanceof t.ForLoopBlock) {
            ingestForBlock(unit, node);
        }
        else {
            throw new Error(`Unsupported template node: ${node.constructor.name}`);
        }
    }
}
/**
 * Ingest an element AST from the template into the given `ViewCompilation`.
 */
function ingestElement(unit, element) {
    if (element.i18n !== undefined &&
        !(element.i18n instanceof i18n.Message || element.i18n instanceof i18n.TagPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for element: ${element.i18n.constructor.name}`);
    }
    const id = unit.job.allocateXrefId();
    const [namespaceKey, elementName] = splitNsName(element.name);
    const startOp = ir.createElementStartOp(elementName, id, namespaceForKey(namespaceKey), element.i18n instanceof i18n.TagPlaceholder ? element.i18n : undefined, element.startSourceSpan, element.sourceSpan);
    unit.create.push(startOp);
    ingestElementBindings(unit, startOp, element);
    ingestReferences(startOp, element);
    // Start i18n, if needed, goes after the element create and bindings, but before the nodes
    let i18nBlockId = null;
    if (element.i18n instanceof i18n.Message) {
        i18nBlockId = unit.job.allocateXrefId();
        unit.create.push(ir.createI18nStartOp(i18nBlockId, element.i18n, undefined, element.startSourceSpan));
    }
    ingestNodes(unit, element.children);
    // The source span for the end op is typically the element closing tag. However, if no closing tag
    // exists, such as in `<input>`, we use the start source span instead. Usually the start and end
    // instructions will be collapsed into one `element` instruction, negating the purpose of this
    // fallback, but in cases when it is not collapsed (such as an input with a binding), we still
    // want to map the end instruction to the main element.
    const endOp = ir.createElementEndOp(id, element.endSourceSpan ?? element.startSourceSpan);
    unit.create.push(endOp);
    // If there is an i18n message associated with this element, insert i18n start and end ops.
    if (i18nBlockId !== null) {
        ir.OpList.insertBefore(ir.createI18nEndOp(i18nBlockId, element.endSourceSpan ?? element.startSourceSpan), endOp);
    }
}
/**
 * Ingest an `ng-template` node from the AST into the given `ViewCompilation`.
 */
function ingestTemplate(unit, tmpl) {
    if (tmpl.i18n !== undefined &&
        !(tmpl.i18n instanceof i18n.Message || tmpl.i18n instanceof i18n.TagPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for template: ${tmpl.i18n.constructor.name}`);
    }
    const childView = unit.job.allocateView(unit.xref);
    let tagNameWithoutNamespace = tmpl.tagName;
    let namespacePrefix = '';
    if (tmpl.tagName) {
        [namespacePrefix, tagNameWithoutNamespace] = splitNsName(tmpl.tagName);
    }
    const i18nPlaceholder = tmpl.i18n instanceof i18n.TagPlaceholder ? tmpl.i18n : undefined;
    const namespace = namespaceForKey(namespacePrefix);
    const functionNameSuffix = tagNameWithoutNamespace === null ? '' : prefixWithNamespace(tagNameWithoutNamespace, namespace);
    const templateKind = isPlainTemplate(tmpl)
        ? ir.TemplateKind.NgTemplate
        : ir.TemplateKind.Structural;
    const templateOp = ir.createTemplateOp(childView.xref, templateKind, tagNameWithoutNamespace, functionNameSuffix, namespace, i18nPlaceholder, tmpl.startSourceSpan, tmpl.sourceSpan);
    unit.create.push(templateOp);
    ingestTemplateBindings(unit, templateOp, tmpl, templateKind);
    ingestReferences(templateOp, tmpl);
    ingestNodes(childView, tmpl.children);
    for (const { name, value } of tmpl.variables) {
        childView.contextVariables.set(name, value !== '' ? value : '$implicit');
    }
    // If this is a plain template and there is an i18n message associated with it, insert i18n start
    // and end ops. For structural directive templates, the i18n ops will be added when ingesting the
    // element/template the directive is placed on.
    if (templateKind === ir.TemplateKind.NgTemplate && tmpl.i18n instanceof i18n.Message) {
        const id = unit.job.allocateXrefId();
        ir.OpList.insertAfter(ir.createI18nStartOp(id, tmpl.i18n, undefined, tmpl.startSourceSpan), childView.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id, tmpl.endSourceSpan ?? tmpl.startSourceSpan), childView.create.tail);
    }
}
/**
 * Ingest a content node from the AST into the given `ViewCompilation`.
 */
function ingestContent(unit, content) {
    if (content.i18n !== undefined && !(content.i18n instanceof i18n.TagPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for element: ${content.i18n.constructor.name}`);
    }
    const id = unit.job.allocateXrefId();
    let fallbackView = null;
    // Don't capture default content that's only made up of empty text nodes and comments.
    if (content.children.some((child) => !(child instanceof t.Comment) &&
        (!(child instanceof t.Text) || child.value.trim().length > 0))) {
        fallbackView = unit.job.allocateView(unit.xref);
        ingestNodes(fallbackView, content.children);
    }
    const op = ir.createProjectionOp(id, content.selector, content.i18n, fallbackView?.xref ?? null, content.sourceSpan);
    for (const attr of content.attributes) {
        const securityContext = domSchema.securityContext(content.name, attr.name, true);
        unit.update.push(ir.createBindingOp(op.xref, ir.BindingKind.Attribute, attr.name, o.literal(attr.value), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
    }
    unit.create.push(op);
}
/**
 * Ingest a literal text node from the AST into the given `ViewCompilation`.
 */
function ingestText(unit, text, icuPlaceholder) {
    unit.create.push(ir.createTextOp(unit.job.allocateXrefId(), text.value, icuPlaceholder, text.sourceSpan));
}
/**
 * Ingest an interpolated text node from the AST into the given `ViewCompilation`.
 */
function ingestBoundText(unit, text, icuPlaceholder) {
    let value = text.value;
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (!(value instanceof e.Interpolation)) {
        throw new Error(`AssertionError: expected Interpolation for BoundText node, got ${value.constructor.name}`);
    }
    if (text.i18n !== undefined && !(text.i18n instanceof i18n.Container)) {
        throw Error(`Unhandled i18n metadata type for text interpolation: ${text.i18n?.constructor.name}`);
    }
    const i18nPlaceholders = text.i18n instanceof i18n.Container
        ? text.i18n.children
            .filter((node) => node instanceof i18n.Placeholder)
            .map((placeholder) => placeholder.name)
        : [];
    if (i18nPlaceholders.length > 0 && i18nPlaceholders.length !== value.expressions.length) {
        throw Error(`Unexpected number of i18n placeholders (${value.expressions.length}) for BoundText with ${value.expressions.length} expressions`);
    }
    const textXref = unit.job.allocateXrefId();
    unit.create.push(ir.createTextOp(textXref, '', icuPlaceholder, text.sourceSpan));
    // TemplateDefinitionBuilder does not generate source maps for sub-expressions inside an
    // interpolation. We copy that behavior in compatibility mode.
    // TODO: is it actually correct to generate these extra maps in modern mode?
    const baseSourceSpan = unit.job.compatibility ? null : text.sourceSpan;
    unit.update.push(ir.createInterpolateTextOp(textXref, new ir.Interpolation(value.strings, value.expressions.map((expr) => convertAst(expr, unit.job, baseSourceSpan)), i18nPlaceholders), text.sourceSpan));
}
/**
 * Ingest an `@if` block into the given `ViewCompilation`.
 */
function ingestIfBlock(unit, ifBlock) {
    let firstXref = null;
    let conditions = [];
    for (let i = 0; i < ifBlock.branches.length; i++) {
        const ifCase = ifBlock.branches[i];
        const cView = unit.job.allocateView(unit.xref);
        const tagName = ingestControlFlowInsertionPoint(unit, cView.xref, ifCase);
        if (ifCase.expressionAlias !== null) {
            cView.contextVariables.set(ifCase.expressionAlias.name, ir.CTX_REF);
        }
        let ifCaseI18nMeta = undefined;
        if (ifCase.i18n !== undefined) {
            if (!(ifCase.i18n instanceof i18n.BlockPlaceholder)) {
                throw Error(`Unhandled i18n metadata type for if block: ${ifCase.i18n?.constructor.name}`);
            }
            ifCaseI18nMeta = ifCase.i18n;
        }
        const templateOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, tagName, 'Conditional', ir.Namespace.HTML, ifCaseI18nMeta, ifCase.startSourceSpan, ifCase.sourceSpan);
        unit.create.push(templateOp);
        if (firstXref === null) {
            firstXref = cView.xref;
        }
        const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle, ifCase.expressionAlias);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, ifCase.children);
    }
    unit.update.push(ir.createConditionalOp(firstXref, null, conditions, ifBlock.sourceSpan));
}
/**
 * Ingest an `@switch` block into the given `ViewCompilation`.
 */
function ingestSwitchBlock(unit, switchBlock) {
    // Don't ingest empty switches since they won't render anything.
    if (switchBlock.cases.length === 0) {
        return;
    }
    let firstXref = null;
    let conditions = [];
    for (const switchCase of switchBlock.cases) {
        const cView = unit.job.allocateView(unit.xref);
        const tagName = ingestControlFlowInsertionPoint(unit, cView.xref, switchCase);
        let switchCaseI18nMeta = undefined;
        if (switchCase.i18n !== undefined) {
            if (!(switchCase.i18n instanceof i18n.BlockPlaceholder)) {
                throw Error(`Unhandled i18n metadata type for switch block: ${switchCase.i18n?.constructor.name}`);
            }
            switchCaseI18nMeta = switchCase.i18n;
        }
        const templateOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, tagName, 'Case', ir.Namespace.HTML, switchCaseI18nMeta, switchCase.startSourceSpan, switchCase.sourceSpan);
        unit.create.push(templateOp);
        if (firstXref === null) {
            firstXref = cView.xref;
        }
        const caseExpr = switchCase.expression
            ? convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan)
            : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, switchCase.children);
    }
    unit.update.push(ir.createConditionalOp(firstXref, convertAst(switchBlock.expression, unit.job, null), conditions, switchBlock.sourceSpan));
}
function ingestDeferView(unit, suffix, i18nMeta, children, sourceSpan) {
    if (i18nMeta !== undefined && !(i18nMeta instanceof i18n.BlockPlaceholder)) {
        throw Error('Unhandled i18n metadata type for defer block');
    }
    if (children === undefined) {
        return null;
    }
    const secondaryView = unit.job.allocateView(unit.xref);
    ingestNodes(secondaryView, children);
    const templateOp = ir.createTemplateOp(secondaryView.xref, ir.TemplateKind.Block, null, `Defer${suffix}`, ir.Namespace.HTML, i18nMeta, sourceSpan, sourceSpan);
    unit.create.push(templateOp);
    return templateOp;
}
function ingestDeferBlock(unit, deferBlock) {
    let ownResolverFn = null;
    if (unit.job.deferMeta.mode === 0 /* DeferBlockDepsEmitMode.PerBlock */) {
        if (!unit.job.deferMeta.blocks.has(deferBlock)) {
            throw new Error(`AssertionError: unable to find a dependency function for this deferred block`);
        }
        ownResolverFn = unit.job.deferMeta.blocks.get(deferBlock) ?? null;
    }
    // Generate the defer main view and all secondary views.
    const main = ingestDeferView(unit, '', deferBlock.i18n, deferBlock.children, deferBlock.sourceSpan);
    const loading = ingestDeferView(unit, 'Loading', deferBlock.loading?.i18n, deferBlock.loading?.children, deferBlock.loading?.sourceSpan);
    const placeholder = ingestDeferView(unit, 'Placeholder', deferBlock.placeholder?.i18n, deferBlock.placeholder?.children, deferBlock.placeholder?.sourceSpan);
    const error = ingestDeferView(unit, 'Error', deferBlock.error?.i18n, deferBlock.error?.children, deferBlock.error?.sourceSpan);
    // Create the main defer op, and ops for all secondary views.
    const deferXref = unit.job.allocateXrefId();
    const deferOp = ir.createDeferOp(deferXref, main.xref, main.handle, ownResolverFn, unit.job.allDeferrableDepsFn, deferBlock.sourceSpan);
    deferOp.placeholderView = placeholder?.xref ?? null;
    deferOp.placeholderSlot = placeholder?.handle ?? null;
    deferOp.loadingSlot = loading?.handle ?? null;
    deferOp.errorSlot = error?.handle ?? null;
    deferOp.placeholderMinimumTime = deferBlock.placeholder?.minimumTime ?? null;
    deferOp.loadingMinimumTime = deferBlock.loading?.minimumTime ?? null;
    deferOp.loadingAfterTime = deferBlock.loading?.afterTime ?? null;
    unit.create.push(deferOp);
    // Configure all defer `on` conditions.
    // TODO: refactor prefetch triggers to use a separate op type, with a shared superclass. This will
    // make it easier to refactor prefetch behavior in the future.
    let prefetch = false;
    let deferOnOps = [];
    let deferWhenOps = [];
    for (const triggers of [deferBlock.triggers, deferBlock.prefetchTriggers]) {
        if (triggers.idle !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Idle }, prefetch, triggers.idle.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.immediate !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Immediate }, prefetch, triggers.immediate.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.timer !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Timer, delay: triggers.timer.delay }, prefetch, triggers.timer.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.hover !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, {
                kind: ir.DeferTriggerKind.Hover,
                targetName: triggers.hover.reference,
                targetXref: null,
                targetSlot: null,
                targetView: null,
                targetSlotViewSteps: null,
            }, prefetch, triggers.hover.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.interaction !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, {
                kind: ir.DeferTriggerKind.Interaction,
                targetName: triggers.interaction.reference,
                targetXref: null,
                targetSlot: null,
                targetView: null,
                targetSlotViewSteps: null,
            }, prefetch, triggers.interaction.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.viewport !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, {
                kind: ir.DeferTriggerKind.Viewport,
                targetName: triggers.viewport.reference,
                targetXref: null,
                targetSlot: null,
                targetView: null,
                targetSlotViewSteps: null,
            }, prefetch, triggers.viewport.sourceSpan);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.when !== undefined) {
            if (triggers.when.value instanceof e.Interpolation) {
                // TemplateDefinitionBuilder supports this case, but it's very strange to me. What would it
                // even mean?
                throw new Error(`Unexpected interpolation in defer block when trigger`);
            }
            const deferOnOp = ir.createDeferWhenOp(deferXref, convertAst(triggers.when.value, unit.job, triggers.when.sourceSpan), prefetch, triggers.when.sourceSpan);
            deferWhenOps.push(deferOnOp);
        }
        // If no (non-prefetching) defer triggers were provided, default to `idle`.
        if (deferOnOps.length === 0 && deferWhenOps.length === 0) {
            deferOnOps.push(ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Idle }, false, null));
        }
        prefetch = true;
    }
    unit.create.push(deferOnOps);
    unit.update.push(deferWhenOps);
}
function ingestIcu(unit, icu) {
    if (icu.i18n instanceof i18n.Message && isSingleI18nIcu(icu.i18n)) {
        const xref = unit.job.allocateXrefId();
        unit.create.push(ir.createIcuStartOp(xref, icu.i18n, icuFromI18nMessage(icu.i18n).name, null));
        for (const [placeholder, text] of Object.entries({ ...icu.vars, ...icu.placeholders })) {
            if (text instanceof t.BoundText) {
                ingestBoundText(unit, text, placeholder);
            }
            else {
                ingestText(unit, text, placeholder);
            }
        }
        unit.create.push(ir.createIcuEndOp(xref));
    }
    else {
        throw Error(`Unhandled i18n metadata type for ICU: ${icu.i18n?.constructor.name}`);
    }
}
/**
 * Ingest an `@for` block into the given `ViewCompilation`.
 */
function ingestForBlock(unit, forBlock) {
    const repeaterView = unit.job.allocateView(unit.xref);
    // We copy TemplateDefinitionBuilder's scheme of creating names for `$count` and `$index`
    // that are suffixed with special information, to disambiguate which level of nested loop
    // the below aliases refer to.
    // TODO: We should refactor Template Pipeline's variable phases to gracefully handle
    // shadowing, and arbitrarily many levels of variables depending on each other.
    const indexName = `ɵ$index_${repeaterView.xref}`;
    const countName = `ɵ$count_${repeaterView.xref}`;
    const indexVarNames = new Set();
    // Set all the context variables and aliases available in the repeater.
    repeaterView.contextVariables.set(forBlock.item.name, forBlock.item.value);
    for (const variable of forBlock.contextVariables) {
        if (variable.value === '$index') {
            indexVarNames.add(variable.name);
        }
        if (variable.name === '$index') {
            repeaterView.contextVariables.set('$index', variable.value).set(indexName, variable.value);
        }
        else if (variable.name === '$count') {
            repeaterView.contextVariables.set('$count', variable.value).set(countName, variable.value);
        }
        else {
            repeaterView.aliases.add({
                kind: ir.SemanticVariableKind.Alias,
                name: null,
                identifier: variable.name,
                expression: getComputedForLoopVariableExpression(variable, indexName, countName),
            });
        }
    }
    const sourceSpan = convertSourceSpan(forBlock.trackBy.span, forBlock.sourceSpan);
    const track = convertAst(forBlock.trackBy, unit.job, sourceSpan);
    ingestNodes(repeaterView, forBlock.children);
    let emptyView = null;
    let emptyTagName = null;
    if (forBlock.empty !== null) {
        emptyView = unit.job.allocateView(unit.xref);
        ingestNodes(emptyView, forBlock.empty.children);
        emptyTagName = ingestControlFlowInsertionPoint(unit, emptyView.xref, forBlock.empty);
    }
    const varNames = {
        $index: indexVarNames,
        $implicit: forBlock.item.name,
    };
    if (forBlock.i18n !== undefined && !(forBlock.i18n instanceof i18n.BlockPlaceholder)) {
        throw Error('AssertionError: Unhandled i18n metadata type or @for');
    }
    if (forBlock.empty?.i18n !== undefined &&
        !(forBlock.empty.i18n instanceof i18n.BlockPlaceholder)) {
        throw Error('AssertionError: Unhandled i18n metadata type or @empty');
    }
    const i18nPlaceholder = forBlock.i18n;
    const emptyI18nPlaceholder = forBlock.empty?.i18n;
    const tagName = ingestControlFlowInsertionPoint(unit, repeaterView.xref, forBlock);
    const repeaterCreate = ir.createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, tagName, track, varNames, emptyTagName, i18nPlaceholder, emptyI18nPlaceholder, forBlock.startSourceSpan, forBlock.sourceSpan);
    unit.create.push(repeaterCreate);
    const expression = convertAst(forBlock.expression, unit.job, convertSourceSpan(forBlock.expression.span, forBlock.sourceSpan));
    const repeater = ir.createRepeaterOp(repeaterCreate.xref, repeaterCreate.handle, expression, forBlock.sourceSpan);
    unit.update.push(repeater);
}
/**
 * Gets an expression that represents a variable in an `@for` loop.
 * @param variable AST representing the variable.
 * @param indexName Loop-specific name for `$index`.
 * @param countName Loop-specific name for `$count`.
 */
function getComputedForLoopVariableExpression(variable, indexName, countName) {
    switch (variable.value) {
        case '$index':
            return new ir.LexicalReadExpr(indexName);
        case '$count':
            return new ir.LexicalReadExpr(countName);
        case '$first':
            return new ir.LexicalReadExpr(indexName).identical(o.literal(0));
        case '$last':
            return new ir.LexicalReadExpr(indexName).identical(new ir.LexicalReadExpr(countName).minus(o.literal(1)));
        case '$even':
            return new ir.LexicalReadExpr(indexName).modulo(o.literal(2)).identical(o.literal(0));
        case '$odd':
            return new ir.LexicalReadExpr(indexName).modulo(o.literal(2)).notIdentical(o.literal(0));
        default:
            throw new Error(`AssertionError: unknown @for loop variable ${variable.value}`);
    }
}
/**
 * Convert a template AST expression into an output AST expression.
 */
function convertAst(ast, job, baseSourceSpan) {
    if (ast instanceof e.ASTWithSource) {
        return convertAst(ast.ast, job, baseSourceSpan);
    }
    else if (ast instanceof e.PropertyRead) {
        const isThisReceiver = ast.receiver instanceof e.ThisReceiver;
        // Whether this is an implicit receiver, *excluding* explicit reads of `this`.
        const isImplicitReceiver = ast.receiver instanceof e.ImplicitReceiver && !(ast.receiver instanceof e.ThisReceiver);
        // Whether the  name of the read is a node that should be never retain its explicit this
        // receiver.
        const isSpecialNode = ast.name === '$any' || ast.name === '$event';
        // TODO: The most sensible condition here would be simply `isImplicitReceiver`, to convert only
        // actual implicit `this` reads, and not explicit ones. However, TemplateDefinitionBuilder (and
        // the Typecheck block!) both have the same bug, in which they also consider explicit `this`
        // reads to be implicit. This causes problems when the explicit `this` read is inside a
        // template with a context that also provides the variable name being read:
        // ```
        // <ng-template let-a>{{this.a}}</ng-template>
        // ```
        // The whole point of the explicit `this` was to access the class property, but TDB and the
        // current TCB treat the read as implicit, and give you the context property instead!
        //
        // For now, we emulate this old behvaior by aggressively converting explicit reads to to
        // implicit reads, except for the special cases that TDB and the current TCB protect. However,
        // it would be an improvement to fix this.
        //
        // See also the corresponding comment for the TCB, in `type_check_block.ts`.
        if (isImplicitReceiver || (isThisReceiver && !isSpecialNode)) {
            return new ir.LexicalReadExpr(ast.name);
        }
        else {
            return new o.ReadPropExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name, null, convertSourceSpan(ast.span, baseSourceSpan));
        }
    }
    else if (ast instanceof e.PropertyWrite) {
        if (ast.receiver instanceof e.ImplicitReceiver) {
            return new o.WritePropExpr(
            // TODO: Is it correct to always use the root context in place of the implicit receiver?
            new ir.ContextExpr(job.root.xref), ast.name, convertAst(ast.value, job, baseSourceSpan), null, convertSourceSpan(ast.span, baseSourceSpan));
        }
        return new o.WritePropExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name, convertAst(ast.value, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.KeyedWrite) {
        return new o.WriteKeyExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), convertAst(ast.value, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.Call) {
        if (ast.receiver instanceof e.ImplicitReceiver) {
            throw new Error(`Unexpected ImplicitReceiver`);
        }
        else {
            return new o.InvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map((arg) => convertAst(arg, job, baseSourceSpan)), undefined, convertSourceSpan(ast.span, baseSourceSpan));
        }
    }
    else if (ast instanceof e.LiteralPrimitive) {
        return o.literal(ast.value, undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.Unary) {
        switch (ast.operator) {
            case '+':
                return new o.UnaryOperatorExpr(o.UnaryOperator.Plus, convertAst(ast.expr, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
            case '-':
                return new o.UnaryOperatorExpr(o.UnaryOperator.Minus, convertAst(ast.expr, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
            default:
                throw new Error(`AssertionError: unknown unary operator ${ast.operator}`);
        }
    }
    else if (ast instanceof e.Binary) {
        const operator = BINARY_OPERATORS.get(ast.operation);
        if (operator === undefined) {
            throw new Error(`AssertionError: unknown binary operator ${ast.operation}`);
        }
        return new o.BinaryOperatorExpr(operator, convertAst(ast.left, job, baseSourceSpan), convertAst(ast.right, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.ThisReceiver) {
        // TODO: should context expressions have source maps?
        return new ir.ContextExpr(job.root.xref);
    }
    else if (ast instanceof e.KeyedRead) {
        return new o.ReadKeyExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.Chain) {
        throw new Error(`AssertionError: Chain in unknown context`);
    }
    else if (ast instanceof e.LiteralMap) {
        const entries = ast.keys.map((key, idx) => {
            const value = ast.values[idx];
            // TODO: should literals have source maps, or do we just map the whole surrounding
            // expression?
            return new o.LiteralMapEntry(key.key, convertAst(value, job, baseSourceSpan), key.quoted);
        });
        return new o.LiteralMapExpr(entries, undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.LiteralArray) {
        // TODO: should literals have source maps, or do we just map the whole surrounding expression?
        return new o.LiteralArrayExpr(ast.expressions.map((expr) => convertAst(expr, job, baseSourceSpan)));
    }
    else if (ast instanceof e.Conditional) {
        return new o.ConditionalExpr(convertAst(ast.condition, job, baseSourceSpan), convertAst(ast.trueExp, job, baseSourceSpan), convertAst(ast.falseExp, job, baseSourceSpan), undefined, convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.NonNullAssert) {
        // A non-null assertion shouldn't impact generated instructions, so we can just drop it.
        return convertAst(ast.expression, job, baseSourceSpan);
    }
    else if (ast instanceof e.BindingPipe) {
        // TODO: pipes should probably have source maps; figure out details.
        return new ir.PipeBindingExpr(job.allocateXrefId(), new ir.SlotHandle(), ast.name, [
            convertAst(ast.exp, job, baseSourceSpan),
            ...ast.args.map((arg) => convertAst(arg, job, baseSourceSpan)),
        ]);
    }
    else if (ast instanceof e.SafeKeyedRead) {
        return new ir.SafeKeyedReadExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.SafePropertyRead) {
        // TODO: source span
        return new ir.SafePropertyReadExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name);
    }
    else if (ast instanceof e.SafeCall) {
        // TODO: source span
        return new ir.SafeInvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map((a) => convertAst(a, job, baseSourceSpan)));
    }
    else if (ast instanceof e.EmptyExpr) {
        return new ir.EmptyExpr(convertSourceSpan(ast.span, baseSourceSpan));
    }
    else if (ast instanceof e.PrefixNot) {
        return o.not(convertAst(ast.expression, job, baseSourceSpan), convertSourceSpan(ast.span, baseSourceSpan));
    }
    else {
        throw new Error(`Unhandled expression type "${ast.constructor.name}" in file "${baseSourceSpan?.start.file.url}"`);
    }
}
function convertAstWithInterpolation(job, value, i18nMeta, sourceSpan) {
    let expression;
    if (value instanceof e.Interpolation) {
        expression = new ir.Interpolation(value.strings, value.expressions.map((e) => convertAst(e, job, sourceSpan ?? null)), Object.keys(asMessage(i18nMeta)?.placeholders ?? {}));
    }
    else if (value instanceof e.AST) {
        expression = convertAst(value, job, sourceSpan ?? null);
    }
    else {
        expression = o.literal(value);
    }
    return expression;
}
// TODO: Can we populate Template binding kinds in ingest?
const BINDING_KINDS = new Map([
    [e.BindingType.Property, ir.BindingKind.Property],
    [e.BindingType.TwoWay, ir.BindingKind.TwoWayProperty],
    [e.BindingType.Attribute, ir.BindingKind.Attribute],
    [e.BindingType.Class, ir.BindingKind.ClassName],
    [e.BindingType.Style, ir.BindingKind.StyleProperty],
    [e.BindingType.Animation, ir.BindingKind.Animation],
]);
/**
 * Checks whether the given template is a plain ng-template (as opposed to another kind of template
 * such as a structural directive template or control flow template). This is checked based on the
 * tagName. We can expect that only plain ng-templates will come through with a tagName of
 * 'ng-template'.
 *
 * Here are some of the cases we expect:
 *
 * | Angular HTML                       | Template tagName   |
 * | ---------------------------------- | ------------------ |
 * | `<ng-template>`                    | 'ng-template'      |
 * | `<div *ngIf="true">`               | 'div'              |
 * | `<svg><ng-template>`               | 'svg:ng-template'  |
 * | `@if (true) {`                     | 'Conditional'      |
 * | `<ng-template *ngIf>` (plain)      | 'ng-template'      |
 * | `<ng-template *ngIf>` (structural) | null               |
 */
function isPlainTemplate(tmpl) {
    return splitNsName(tmpl.tagName ?? '')[1] === NG_TEMPLATE_TAG_NAME;
}
/**
 * Ensures that the i18nMeta, if provided, is an i18n.Message.
 */
function asMessage(i18nMeta) {
    if (i18nMeta == null) {
        return null;
    }
    if (!(i18nMeta instanceof i18n.Message)) {
        throw Error(`Expected i18n meta to be a Message, but got: ${i18nMeta.constructor.name}`);
    }
    return i18nMeta;
}
/**
 * Process all of the bindings on an element in the template AST and convert them to their IR
 * representation.
 */
function ingestElementBindings(unit, op, element) {
    let bindings = new Array();
    let i18nAttributeBindingNames = new Set();
    for (const attr of element.attributes) {
        // Attribute literal bindings, such as `attr.foo="bar"`.
        const securityContext = domSchema.securityContext(element.name, attr.name, true);
        bindings.push(ir.createBindingOp(op.xref, ir.BindingKind.Attribute, attr.name, convertAstWithInterpolation(unit.job, attr.value, attr.i18n), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
        if (attr.i18n) {
            i18nAttributeBindingNames.add(attr.name);
        }
    }
    for (const input of element.inputs) {
        if (i18nAttributeBindingNames.has(input.name)) {
            console.error(`On component ${unit.job.componentName}, the binding ${input.name} is both an i18n attribute and a property. You may want to remove the property binding. This will become a compilation error in future versions of Angular.`);
        }
        // All dynamic bindings (both attribute and property bindings).
        bindings.push(ir.createBindingOp(op.xref, BINDING_KINDS.get(input.type), input.name, convertAstWithInterpolation(unit.job, astOf(input.value), input.i18n), input.unit, input.securityContext, false, false, null, asMessage(input.i18n) ?? null, input.sourceSpan));
    }
    unit.create.push(bindings.filter((b) => b?.kind === ir.OpKind.ExtractedAttribute));
    unit.update.push(bindings.filter((b) => b?.kind === ir.OpKind.Binding));
    for (const output of element.outputs) {
        if (output.type === e.ParsedEventType.Animation && output.phase === null) {
            throw Error('Animation listener should have a phase');
        }
        if (output.type === e.ParsedEventType.TwoWay) {
            unit.create.push(ir.createTwoWayListenerOp(op.xref, op.handle, output.name, op.tag, makeTwoWayListenerHandlerOps(unit, output.handler, output.handlerSpan), output.sourceSpan));
        }
        else {
            unit.create.push(ir.createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
        }
    }
    // If any of the bindings on this element have an i18n message, then an i18n attrs configuration
    // op is also required.
    if (bindings.some((b) => b?.i18nMessage) !== null) {
        unit.create.push(ir.createI18nAttributesOp(unit.job.allocateXrefId(), new ir.SlotHandle(), op.xref));
    }
}
/**
 * Process all of the bindings on a template in the template AST and convert them to their IR
 * representation.
 */
function ingestTemplateBindings(unit, op, template, templateKind) {
    let bindings = new Array();
    for (const attr of template.templateAttrs) {
        if (attr instanceof t.TextAttribute) {
            const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
            bindings.push(createTemplateBinding(unit, op.xref, e.BindingType.Attribute, attr.name, attr.value, null, securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
        }
        else {
            bindings.push(createTemplateBinding(unit, op.xref, attr.type, attr.name, astOf(attr.value), attr.unit, attr.securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
        }
    }
    for (const attr of template.attributes) {
        // Attribute literal bindings, such as `attr.foo="bar"`.
        const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
        bindings.push(createTemplateBinding(unit, op.xref, e.BindingType.Attribute, attr.name, attr.value, null, securityContext, false, templateKind, asMessage(attr.i18n), attr.sourceSpan));
    }
    for (const input of template.inputs) {
        // Dynamic bindings (both attribute and property bindings).
        bindings.push(createTemplateBinding(unit, op.xref, input.type, input.name, astOf(input.value), input.unit, input.securityContext, false, templateKind, asMessage(input.i18n), input.sourceSpan));
    }
    unit.create.push(bindings.filter((b) => b?.kind === ir.OpKind.ExtractedAttribute));
    unit.update.push(bindings.filter((b) => b?.kind === ir.OpKind.Binding));
    for (const output of template.outputs) {
        if (output.type === e.ParsedEventType.Animation && output.phase === null) {
            throw Error('Animation listener should have a phase');
        }
        if (templateKind === ir.TemplateKind.NgTemplate) {
            if (output.type === e.ParsedEventType.TwoWay) {
                unit.create.push(ir.createTwoWayListenerOp(op.xref, op.handle, output.name, op.tag, makeTwoWayListenerHandlerOps(unit, output.handler, output.handlerSpan), output.sourceSpan));
            }
            else {
                unit.create.push(ir.createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
            }
        }
        if (templateKind === ir.TemplateKind.Structural &&
            output.type !== e.ParsedEventType.Animation) {
            // Animation bindings are excluded from the structural template's const array.
            const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, output.name, false);
            unit.create.push(ir.createExtractedAttributeOp(op.xref, ir.BindingKind.Property, null, output.name, null, null, null, securityContext));
        }
    }
    // TODO: Perhaps we could do this in a phase? (It likely wouldn't change the slot indices.)
    if (bindings.some((b) => b?.i18nMessage) !== null) {
        unit.create.push(ir.createI18nAttributesOp(unit.job.allocateXrefId(), new ir.SlotHandle(), op.xref));
    }
}
/**
 * Helper to ingest an individual binding on a template, either an explicit `ng-template`, or an
 * implicit template created via structural directive.
 *
 * Bindings on templates are *extremely* tricky. I have tried to isolate all of the confusing edge
 * cases into this function, and to comment it well to document the behavior.
 *
 * Some of this behavior is intuitively incorrect, and we should consider changing it in the future.
 *
 * @param view The compilation unit for the view containing the template.
 * @param xref The xref of the template op.
 * @param type The binding type, according to the parser. This is fairly reasonable, e.g. both
 *     dynamic and static attributes have e.BindingType.Attribute.
 * @param name The binding's name.
 * @param value The bindings's value, which will either be an input AST expression, or a string
 *     literal. Note that the input AST expression may or may not be const -- it will only be a
 *     string literal if the parser considered it a text binding.
 * @param unit If the binding has a unit (e.g. `px` for style bindings), then this is the unit.
 * @param securityContext The security context of the binding.
 * @param isStructuralTemplateAttribute Whether this binding actually applies to the structural
 *     ng-template. For example, an `ngFor` would actually apply to the structural template. (Most
 *     bindings on structural elements target the inner element, not the template.)
 * @param templateKind Whether this is an explicit `ng-template` or an implicit template created by
 *     a structural directive. This should never be a block template.
 * @param i18nMessage The i18n metadata for the binding, if any.
 * @param sourceSpan The source span of the binding.
 * @returns An IR binding op, or null if the binding should be skipped.
 */
function createTemplateBinding(view, xref, type, name, value, unit, securityContext, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
    const isTextBinding = typeof value === 'string';
    // If this is a structural template, then several kinds of bindings should not result in an
    // update instruction.
    if (templateKind === ir.TemplateKind.Structural) {
        if (!isStructuralTemplateAttribute) {
            switch (type) {
                case e.BindingType.Property:
                case e.BindingType.Class:
                case e.BindingType.Style:
                    // Because this binding doesn't really target the ng-template, it must be a binding on an
                    // inner node of a structural template. We can't skip it entirely, because we still need
                    // it on the ng-template's consts (e.g. for the purposes of directive matching). However,
                    // we should not generate an update instruction for it.
                    return ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, null, name, null, null, i18nMessage, securityContext);
                case e.BindingType.TwoWay:
                    return ir.createExtractedAttributeOp(xref, ir.BindingKind.TwoWayProperty, null, name, null, null, i18nMessage, securityContext);
            }
        }
        if (!isTextBinding && (type === e.BindingType.Attribute || type === e.BindingType.Animation)) {
            // Again, this binding doesn't really target the ng-template; it actually targets the element
            // inside the structural template. In the case of non-text attribute or animation bindings,
            // the binding doesn't even show up on the ng-template const array, so we just skip it
            // entirely.
            return null;
        }
    }
    let bindingType = BINDING_KINDS.get(type);
    if (templateKind === ir.TemplateKind.NgTemplate) {
        // We know we are dealing with bindings directly on an explicit ng-template.
        // Static attribute bindings should be collected into the const array as k/v pairs. Property
        // bindings should result in a `property` instruction, and `AttributeMarker.Bindings` const
        // entries.
        //
        // The difficulty is with dynamic attribute, style, and class bindings. These don't really make
        // sense on an `ng-template` and should probably be parser errors. However,
        // TemplateDefinitionBuilder generates `property` instructions for them, and so we do that as
        // well.
        //
        // Note that we do have a slight behavior difference with TemplateDefinitionBuilder: although
        // TDB emits `property` instructions for dynamic attributes, styles, and classes, only styles
        // and classes also get const collected into the `AttributeMarker.Bindings` field. Dynamic
        // attribute bindings are missing from the consts entirely. We choose to emit them into the
        // consts field anyway, to avoid creating special cases for something so arcane and nonsensical.
        if (type === e.BindingType.Class ||
            type === e.BindingType.Style ||
            (type === e.BindingType.Attribute && !isTextBinding)) {
            // TODO: These cases should be parse errors.
            bindingType = ir.BindingKind.Property;
        }
    }
    return ir.createBindingOp(xref, bindingType, name, convertAstWithInterpolation(view.job, value, i18nMessage), unit, securityContext, isTextBinding, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan);
}
function makeListenerHandlerOps(unit, handler, handlerSpan) {
    handler = astOf(handler);
    const handlerOps = new Array();
    let handlerExprs = handler instanceof e.Chain ? handler.expressions : [handler];
    if (handlerExprs.length === 0) {
        throw new Error('Expected listener to have non-empty expression list.');
    }
    const expressions = handlerExprs.map((expr) => convertAst(expr, unit.job, handlerSpan));
    const returnExpr = expressions.pop();
    handlerOps.push(...expressions.map((e) => ir.createStatementOp(new o.ExpressionStatement(e, e.sourceSpan))));
    handlerOps.push(ir.createStatementOp(new o.ReturnStatement(returnExpr, returnExpr.sourceSpan)));
    return handlerOps;
}
function makeTwoWayListenerHandlerOps(unit, handler, handlerSpan) {
    handler = astOf(handler);
    const handlerOps = new Array();
    if (handler instanceof e.Chain) {
        if (handler.expressions.length === 1) {
            handler = handler.expressions[0];
        }
        else {
            // This is validated during parsing already, but we do it here just in case.
            throw new Error('Expected two-way listener to have a single expression.');
        }
    }
    const handlerExpr = convertAst(handler, unit.job, handlerSpan);
    const eventReference = new ir.LexicalReadExpr('$event');
    const twoWaySetExpr = new ir.TwoWayBindingSetExpr(handlerExpr, eventReference);
    handlerOps.push(ir.createStatementOp(new o.ExpressionStatement(twoWaySetExpr)));
    handlerOps.push(ir.createStatementOp(new o.ReturnStatement(eventReference)));
    return handlerOps;
}
function astOf(ast) {
    return ast instanceof e.ASTWithSource ? ast.ast : ast;
}
/**
 * Process all of the local references on an element-like structure in the template AST and
 * convert them to their IR representation.
 */
function ingestReferences(op, element) {
    assertIsArray(op.localRefs);
    for (const { name, value } of element.references) {
        op.localRefs.push({
            name,
            target: value,
        });
    }
}
/**
 * Assert that the given value is an array.
 */
function assertIsArray(value) {
    if (!Array.isArray(value)) {
        throw new Error(`AssertionError: expected an array`);
    }
}
/**
 * Creates an absolute `ParseSourceSpan` from the relative `ParseSpan`.
 *
 * `ParseSpan` objects are relative to the start of the expression.
 * This method converts these to full `ParseSourceSpan` objects that
 * show where the span is within the overall source file.
 *
 * @param span the relative span to convert.
 * @param baseSourceSpan a span corresponding to the base of the expression tree.
 * @returns a `ParseSourceSpan` for the given span or null if no `baseSourceSpan` was provided.
 */
function convertSourceSpan(span, baseSourceSpan) {
    if (baseSourceSpan === null) {
        return null;
    }
    const start = baseSourceSpan.start.moveBy(span.start);
    const end = baseSourceSpan.start.moveBy(span.end);
    const fullStart = baseSourceSpan.fullStart.moveBy(span.start);
    return new ParseSourceSpan(start, end, fullStart);
}
/**
 * With the directive-based control flow users were able to conditionally project content using
 * the `*` syntax. E.g. `<div *ngIf="expr" projectMe></div>` will be projected into
 * `<ng-content select="[projectMe]"/>`, because the attributes and tag name from the `div` are
 * copied to the template via the template creation instruction. With `@if` and `@for` that is
 * not the case, because the conditional is placed *around* elements, rather than *on* them.
 * The result is that content projection won't work in the same way if a user converts from
 * `*ngIf` to `@if`.
 *
 * This function aims to cover the most common case by doing the same copying when a control flow
 * node has *one and only one* root element or template node.
 *
 * This approach comes with some caveats:
 * 1. As soon as any other node is added to the root, the copying behavior won't work anymore.
 *    A diagnostic will be added to flag cases like this and to explain how to work around it.
 * 2. If `preserveWhitespaces` is enabled, it's very likely that indentation will break this
 *    workaround, because it'll include an additional text node as the first child. We can work
 *    around it here, but in a discussion it was decided not to, because the user explicitly opted
 *    into preserving the whitespace and we would have to drop it from the generated code.
 *    The diagnostic mentioned point #1 will flag such cases to users.
 *
 * @returns Tag name to be used for the control flow template.
 */
function ingestControlFlowInsertionPoint(unit, xref, node) {
    let root = null;
    for (const child of node.children) {
        // Skip over comment nodes.
        if (child instanceof t.Comment) {
            continue;
        }
        // We can only infer the tag name/attributes if there's a single root node.
        if (root !== null) {
            return null;
        }
        // Root nodes can only elements or templates with a tag name (e.g. `<div *foo></div>`).
        if (child instanceof t.Element || (child instanceof t.Template && child.tagName !== null)) {
            root = child;
        }
    }
    // If we've found a single root node, its tag name and attributes can be
    // copied to the surrounding template to be used for content projection.
    if (root !== null) {
        // Collect the static attributes for content projection purposes.
        for (const attr of root.attributes) {
            const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
            unit.update.push(ir.createBindingOp(xref, ir.BindingKind.Attribute, attr.name, o.literal(attr.value), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
        }
        // Also collect the inputs since they participate in content projection as well.
        // Note that TDB used to collect the outputs as well, but it wasn't passing them into
        // the template instruction. Here we just don't collect them.
        for (const attr of root.inputs) {
            if (attr.type !== e.BindingType.Animation && attr.type !== e.BindingType.Attribute) {
                const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
                unit.create.push(ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, null, attr.name, null, null, null, securityContext));
            }
        }
        const tagName = root instanceof t.Element ? root.name : root.tagName;
        // Don't pass along `ng-template` tag name since it enables directive matching.
        return tagName === NG_TEMPLATE_TAG_NAME ? null : tagName;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDbkUsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFFckYsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUVMLHVCQUF1QixFQUN2Qix5QkFBeUIsR0FHMUIsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFDLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVwRixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQztBQUV6RSx1REFBdUQ7QUFDdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSx3QkFBd0IsRUFBRSxDQUFDO0FBRWpELHlDQUF5QztBQUN6QyxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztBQUUzQyxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQW9CO0lB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RDtRQUM3RCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNuRixNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNkLEVBQUUsQ0FBQywwQkFBMEIsQ0FDM0IsSUFBSSxFQUNKLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUN2QixJQUFJLEVBQ0osSUFBSSxDQUFDLElBQUksRUFDVCxJQUFJLEVBQ0osSUFBSSxFQUNKLElBQUksRUFDSixlQUFlLENBQ2hCLENBQ0YsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFckUsK0VBQStFO1FBQy9FLE9BQU8sT0FBTyxLQUFLLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUMzRCxDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi8uLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIGUgZnJvbSAnLi4vLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19hc3QnO1xuaW1wb3J0IHtEZWZlckJsb2NrRGVwc0VtaXRNb2RlLCBSM0NvbXBvbmVudERlZmVyTWV0YWRhdGF9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge1xuICBDb21waWxhdGlvblVuaXQsXG4gIENvbXBvbmVudENvbXBpbGF0aW9uSm9iLFxuICBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLFxuICB0eXBlIENvbXBpbGF0aW9uSm9iLFxuICB0eXBlIFZpZXdDb21waWxhdGlvblVuaXQsXG59IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtCSU5BUllfT1BFUkFUT1JTLCBuYW1lc3BhY2VGb3JLZXksIHByZWZpeFdpdGhOYW1lc3BhY2V9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbmNvbnN0IGNvbXBhdGliaWxpdHlNb2RlID0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcjtcblxuLy8gU2NoZW1hIGNvbnRhaW5pbmcgRE9NIGVsZW1lbnRzIGFuZCB0aGVpciBwcm9wZXJ0aWVzLlxuY29uc3QgZG9tU2NoZW1hID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vLyBUYWcgbmFtZSBvZiB0aGUgYG5nLXRlbXBsYXRlYCBlbGVtZW50LlxuY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNJMThuUm9vdE5vZGUobWV0YT86IGkxOG4uSTE4bk1ldGEpOiBtZXRhIGlzIGkxOG4uTWVzc2FnZSB7XG4gIHJldHVybiBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaW5nbGVJMThuSWN1KG1ldGE/OiBpMThuLkkxOG5NZXRhKTogbWV0YSBpcyBpMThuLkkxOG5NZXRhICYge25vZGVzOiBbaTE4bi5JY3VdfSB7XG4gIHJldHVybiBpc0kxOG5Sb290Tm9kZShtZXRhKSAmJiBtZXRhLm5vZGVzLmxlbmd0aCA9PT0gMSAmJiBtZXRhLm5vZGVzWzBdIGluc3RhbmNlb2YgaTE4bi5JY3U7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYENvbXBvbmVudENvbXBpbGF0aW9uYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqIFRPRE86IFJlZmFjdG9yIG1vcmUgb2YgdGhlIGluZ2VzdGlvbiBjb2RlIGludG8gcGhhc2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0Q29tcG9uZW50KFxuICBjb21wb25lbnROYW1lOiBzdHJpbmcsXG4gIHRlbXBsYXRlOiB0Lk5vZGVbXSxcbiAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgZGVmZXJNZXRhOiBSM0NvbXBvbmVudERlZmVyTWV0YWRhdGEsXG4gIGFsbERlZmVycmFibGVEZXBzRm46IG8uUmVhZFZhckV4cHIgfCBudWxsLFxuKTogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IoXG4gICAgY29tcG9uZW50TmFtZSxcbiAgICBjb25zdGFudFBvb2wsXG4gICAgY29tcGF0aWJpbGl0eU1vZGUsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzLFxuICAgIGRlZmVyTWV0YSxcbiAgICBhbGxEZWZlcnJhYmxlRGVwc0ZuLFxuICApO1xuICBpbmdlc3ROb2Rlcyhqb2Iucm9vdCwgdGVtcGxhdGUpO1xuICByZXR1cm4gam9iO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhvc3RCaW5kaW5nSW5wdXQge1xuICBjb21wb25lbnROYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudFNlbGVjdG9yOiBzdHJpbmc7XG4gIHByb3BlcnRpZXM6IGUuUGFyc2VkUHJvcGVydHlbXSB8IG51bGw7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBldmVudHM6IGUuUGFyc2VkRXZlbnRbXSB8IG51bGw7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIGhvc3QgYmluZGluZyBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RCaW5kaW5nKFxuICBpbnB1dDogSG9zdEJpbmRpbmdJbnB1dCxcbiAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4pOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IoaW5wdXQuY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSk7XG4gIGZvciAoY29uc3QgcHJvcGVydHkgb2YgaW5wdXQucHJvcGVydGllcyA/PyBbXSkge1xuICAgIGxldCBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIHJlYWxseSBiZSBoYW5kbGVkIGluIHRoZSBwYXJzZXIuXG4gICAgaWYgKHByb3BlcnR5Lm5hbWUuc3RhcnRzV2l0aCgnYXR0ci4nKSkge1xuICAgICAgcHJvcGVydHkubmFtZSA9IHByb3BlcnR5Lm5hbWUuc3Vic3RyaW5nKCdhdHRyLicubGVuZ3RoKTtcbiAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlO1xuICAgIH1cbiAgICBpZiAocHJvcGVydHkuaXNBbmltYXRpb24pIHtcbiAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uO1xuICAgIH1cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID0gYmluZGluZ1BhcnNlclxuICAgICAgLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgIGlucHV0LmNvbXBvbmVudFNlbGVjdG9yLFxuICAgICAgICBwcm9wZXJ0eS5uYW1lLFxuICAgICAgICBiaW5kaW5nS2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLFxuICAgICAgKVxuICAgICAgLmZpbHRlcigoY29udGV4dCkgPT4gY29udGV4dCAhPT0gU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuICAgIGluZ2VzdEhvc3RQcm9wZXJ0eShqb2IsIHByb3BlcnR5LCBiaW5kaW5nS2luZCwgc2VjdXJpdHlDb250ZXh0cyk7XG4gIH1cbiAgZm9yIChjb25zdCBbbmFtZSwgZXhwcl0gb2YgT2JqZWN0LmVudHJpZXMoaW5wdXQuYXR0cmlidXRlcykgPz8gW10pIHtcbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID0gYmluZGluZ1BhcnNlclxuICAgICAgLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoaW5wdXQuY29tcG9uZW50U2VsZWN0b3IsIG5hbWUsIHRydWUpXG4gICAgICAuZmlsdGVyKChjb250ZXh0KSA9PiBjb250ZXh0ICE9PSBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgaW5nZXN0SG9zdEF0dHJpYnV0ZShqb2IsIG5hbWUsIGV4cHIsIHNlY3VyaXR5Q29udGV4dHMpO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgaW5wdXQuZXZlbnRzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEV2ZW50KGpvYiwgZXZlbnQpO1xuICB9XG4gIHJldHVybiBqb2I7XG59XG5cbi8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciB0aGUgcGFyc2VyIHRvIHVzZSB0aGUgc2FtZSB0eXBlcyBhbmQgc3RydWN0dXJlcyBmb3IgaG9zdCBiaW5kaW5ncyBhc1xuLy8gd2l0aCBvcmRpbmFyeSBjb21wb25lbnRzLiBUaGlzIHdvdWxkIGFsbG93IHVzIHRvIHNoYXJlIGEgbG90IG1vcmUgaW5nZXN0aW9uIGNvZGUuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdFByb3BlcnR5KFxuICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsXG4gIHByb3BlcnR5OiBlLlBhcnNlZFByb3BlcnR5LFxuICBiaW5kaW5nS2luZDogaXIuQmluZGluZ0tpbmQsXG4gIHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdLFxuKTogdm9pZCB7XG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24gfCBpci5JbnRlcnBvbGF0aW9uO1xuICBjb25zdCBhc3QgPSBwcm9wZXJ0eS5leHByZXNzaW9uLmFzdDtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgIGFzdC5zdHJpbmdzLFxuICAgICAgYXN0LmV4cHJlc3Npb25zLm1hcCgoZXhwcikgPT4gY29udmVydEFzdChleHByLCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pKSxcbiAgICAgIFtdLFxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoYXN0LCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pO1xuICB9XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKFxuICAgIGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsXG4gICAgICBiaW5kaW5nS2luZCxcbiAgICAgIHByb3BlcnR5Lm5hbWUsXG4gICAgICBleHByZXNzaW9uLFxuICAgICAgbnVsbCxcbiAgICAgIHNlY3VyaXR5Q29udGV4dHMsXG4gICAgICBmYWxzZSxcbiAgICAgIGZhbHNlLFxuICAgICAgbnVsbCxcbiAgICAgIC8qIFRPRE86IEhvdyBkbyBIb3N0IGJpbmRpbmdzIGhhbmRsZSBpMThuIGF0dHJzPyAqLyBudWxsLFxuICAgICAgcHJvcGVydHkuc291cmNlU3BhbixcbiAgICApLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEF0dHJpYnV0ZShcbiAgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLFxuICBuYW1lOiBzdHJpbmcsXG4gIHZhbHVlOiBvLkV4cHJlc3Npb24sXG4gIHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdLFxuKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgIGpvYi5yb290LnhyZWYsXG4gICAgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLFxuICAgIG5hbWUsXG4gICAgdmFsdWUsXG4gICAgbnVsbCxcbiAgICBzZWN1cml0eUNvbnRleHRzLFxuICAgIC8qIEhvc3QgYXR0cmlidXRlcyBzaG91bGQgYWx3YXlzIGJlIGV4dHJhY3RlZCB0byBjb25zdCBob3N0QXR0cnMsIGV2ZW4gaWYgdGhleSBhcmUgbm90XG4gICAgICpzdHJpY3RseSogdGV4dCBsaXRlcmFscyAqL1xuICAgIHRydWUsXG4gICAgZmFsc2UsXG4gICAgbnVsbCxcbiAgICAvKiBUT0RPICovIG51bGwsXG4gICAgLyoqIFRPRE86IE1heSBiZSBudWxsPyAqLyB2YWx1ZS5zb3VyY2VTcGFuISxcbiAgKTtcbiAgam9iLnJvb3QudXBkYXRlLnB1c2goYXR0ckJpbmRpbmcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEV2ZW50KGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgZXZlbnQ6IGUuUGFyc2VkRXZlbnQpIHtcbiAgY29uc3QgW3BoYXNlLCB0YXJnZXRdID1cbiAgICBldmVudC50eXBlICE9PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb25cbiAgICAgID8gW251bGwsIGV2ZW50LnRhcmdldE9yUGhhc2VdXG4gICAgICA6IFtldmVudC50YXJnZXRPclBoYXNlLCBudWxsXTtcbiAgY29uc3QgZXZlbnRCaW5kaW5nID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICBqb2Iucm9vdC54cmVmLFxuICAgIG5ldyBpci5TbG90SGFuZGxlKCksXG4gICAgZXZlbnQubmFtZSxcbiAgICBudWxsLFxuICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHMoam9iLnJvb3QsIGV2ZW50LmhhbmRsZXIsIGV2ZW50LmhhbmRsZXJTcGFuKSxcbiAgICBwaGFzZSxcbiAgICB0YXJnZXQsXG4gICAgdHJ1ZSxcbiAgICBldmVudC5zb3VyY2VTcGFuLFxuICApO1xuICBqb2Iucm9vdC5jcmVhdGUucHVzaChldmVudEJpbmRpbmcpO1xufVxuXG4vKipcbiAqIEluZ2VzdCB0aGUgbm9kZXMgb2YgYSB0ZW1wbGF0ZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdE5vZGVzKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRlbXBsYXRlOiB0Lk5vZGVbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IG5vZGUgb2YgdGVtcGxhdGUpIHtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgaW5nZXN0RWxlbWVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgICBpbmdlc3RUZW1wbGF0ZSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkNvbnRlbnQpIHtcbiAgICAgIGluZ2VzdENvbnRlbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBpbmdlc3RUZXh0KHVuaXQsIG5vZGUsIG51bGwpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgbm9kZSwgbnVsbCk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JZkJsb2NrKSB7XG4gICAgICBpbmdlc3RJZkJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuU3dpdGNoQmxvY2spIHtcbiAgICAgIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRGVmZXJyZWRCbG9jaykge1xuICAgICAgaW5nZXN0RGVmZXJCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkljdSkge1xuICAgICAgaW5nZXN0SWN1KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRm9yTG9vcEJsb2NrKSB7XG4gICAgICBpbmdlc3RGb3JCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB0ZW1wbGF0ZSBub2RlOiAke25vZGUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gZWxlbWVudCBBU1QgZnJvbSB0aGUgdGVtcGxhdGUgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGlmIChcbiAgICBlbGVtZW50LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICEoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpXG4gICkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2VsZW1lbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgIGVsZW1lbnROYW1lLFxuICAgIGlkLFxuICAgIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VLZXkpLFxuICAgIGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyBlbGVtZW50LmkxOG4gOiB1bmRlZmluZWQsXG4gICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sXG4gICAgZWxlbWVudC5zb3VyY2VTcGFuLFxuICApO1xuICB1bml0LmNyZWF0ZS5wdXNoKHN0YXJ0T3ApO1xuXG4gIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyh1bml0LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcblxuICAvLyBTdGFydCBpMThuLCBpZiBuZWVkZWQsIGdvZXMgYWZ0ZXIgdGhlIGVsZW1lbnQgY3JlYXRlIGFuZCBiaW5kaW5ncywgYnV0IGJlZm9yZSB0aGUgbm9kZXNcbiAgbGV0IGkxOG5CbG9ja0lkOiBpci5YcmVmSWQgfCBudWxsID0gbnVsbDtcbiAgaWYgKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGkxOG5CbG9ja0lkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaTE4bkJsb2NrSWQsIGVsZW1lbnQuaTE4biwgdW5kZWZpbmVkLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiksXG4gICAgKTtcbiAgfVxuXG4gIGluZ2VzdE5vZGVzKHVuaXQsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gIC8vIFRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGVuZCBvcCBpcyB0eXBpY2FsbHkgdGhlIGVsZW1lbnQgY2xvc2luZyB0YWcuIEhvd2V2ZXIsIGlmIG5vIGNsb3NpbmcgdGFnXG4gIC8vIGV4aXN0cywgc3VjaCBhcyBpbiBgPGlucHV0PmAsIHdlIHVzZSB0aGUgc3RhcnQgc291cmNlIHNwYW4gaW5zdGVhZC4gVXN1YWxseSB0aGUgc3RhcnQgYW5kIGVuZFxuICAvLyBpbnN0cnVjdGlvbnMgd2lsbCBiZSBjb2xsYXBzZWQgaW50byBvbmUgYGVsZW1lbnRgIGluc3RydWN0aW9uLCBuZWdhdGluZyB0aGUgcHVycG9zZSBvZiB0aGlzXG4gIC8vIGZhbGxiYWNrLCBidXQgaW4gY2FzZXMgd2hlbiBpdCBpcyBub3QgY29sbGFwc2VkIChzdWNoIGFzIGFuIGlucHV0IHdpdGggYSBiaW5kaW5nKSwgd2Ugc3RpbGxcbiAgLy8gd2FudCB0byBtYXAgdGhlIGVuZCBpbnN0cnVjdGlvbiB0byB0aGUgbWFpbiBlbGVtZW50LlxuICBjb25zdCBlbmRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRFbmRPcChpZCwgZWxlbWVudC5lbmRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChlbmRPcCk7XG5cbiAgLy8gSWYgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGVsZW1lbnQsIGluc2VydCBpMThuIHN0YXJ0IGFuZCBlbmQgb3BzLlxuICBpZiAoaTE4bkJsb2NrSWQgIT09IG51bGwpIHtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgIGlyLmNyZWF0ZUkxOG5FbmRPcChpMThuQmxvY2tJZCwgZWxlbWVudC5lbmRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKSxcbiAgICAgIGVuZE9wLFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBpZiAoXG4gICAgdG1wbC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAhKHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKVxuICApIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGVtcGxhdGU6ICR7dG1wbC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICBsZXQgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPSB0bXBsLnRhZ05hbWU7XG4gIGxldCBuYW1lc3BhY2VQcmVmaXg6IHN0cmluZyB8IG51bGwgPSAnJztcbiAgaWYgKHRtcGwudGFnTmFtZSkge1xuICAgIFtuYW1lc3BhY2VQcmVmaXgsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlXSA9IHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyID8gdG1wbC5pMThuIDogdW5kZWZpbmVkO1xuICBjb25zdCBuYW1lc3BhY2UgPSBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlUHJlZml4KTtcbiAgY29uc3QgZnVuY3Rpb25OYW1lU3VmZml4ID1cbiAgICB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gbnVsbCA/ICcnIDogcHJlZml4V2l0aE5hbWVzcGFjZSh0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgbmFtZXNwYWNlKTtcbiAgY29uc3QgdGVtcGxhdGVLaW5kID0gaXNQbGFpblRlbXBsYXRlKHRtcGwpXG4gICAgPyBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZVxuICAgIDogaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWw7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgIGNoaWxkVmlldy54cmVmLFxuICAgIHRlbXBsYXRlS2luZCxcbiAgICB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSxcbiAgICBmdW5jdGlvbk5hbWVTdWZmaXgsXG4gICAgbmFtZXNwYWNlLFxuICAgIGkxOG5QbGFjZWhvbGRlcixcbiAgICB0bXBsLnN0YXJ0U291cmNlU3BhbixcbiAgICB0bXBsLnNvdXJjZVNwYW4sXG4gICk7XG4gIHVuaXQuY3JlYXRlLnB1c2godGVtcGxhdGVPcCk7XG5cbiAgaW5nZXN0VGVtcGxhdGVCaW5kaW5ncyh1bml0LCB0ZW1wbGF0ZU9wLCB0bXBsLCB0ZW1wbGF0ZUtpbmQpO1xuICBpbmdlc3RSZWZlcmVuY2VzKHRlbXBsYXRlT3AsIHRtcGwpO1xuICBpbmdlc3ROb2RlcyhjaGlsZFZpZXcsIHRtcGwuY2hpbGRyZW4pO1xuXG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiB0bXBsLnZhcmlhYmxlcykge1xuICAgIGNoaWxkVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChuYW1lLCB2YWx1ZSAhPT0gJycgPyB2YWx1ZSA6ICckaW1wbGljaXQnKTtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSBwbGFpbiB0ZW1wbGF0ZSBhbmQgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCBpdCwgaW5zZXJ0IGkxOG4gc3RhcnRcbiAgLy8gYW5kIGVuZCBvcHMuIEZvciBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZXMsIHRoZSBpMThuIG9wcyB3aWxsIGJlIGFkZGVkIHdoZW4gaW5nZXN0aW5nIHRoZVxuICAvLyBlbGVtZW50L3RlbXBsYXRlIHRoZSBkaXJlY3RpdmUgaXMgcGxhY2VkIG9uLlxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSAmJiB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyKFxuICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biwgdW5kZWZpbmVkLCB0bXBsLnN0YXJ0U291cmNlU3BhbiksXG4gICAgICBjaGlsZFZpZXcuY3JlYXRlLmhlYWQsXG4gICAgKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKFxuICAgICAgaXIuY3JlYXRlSTE4bkVuZE9wKGlkLCB0bXBsLmVuZFNvdXJjZVNwYW4gPz8gdG1wbC5zdGFydFNvdXJjZVNwYW4pLFxuICAgICAgY2hpbGRWaWV3LmNyZWF0ZS50YWlsLFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBjb250ZW50IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBpZiAoY29udGVudC5pMThuICE9PSB1bmRlZmluZWQgJiYgIShjb250ZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2NvbnRlbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICBsZXQgZmFsbGJhY2tWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0IHwgbnVsbCA9IG51bGw7XG5cbiAgLy8gRG9uJ3QgY2FwdHVyZSBkZWZhdWx0IGNvbnRlbnQgdGhhdCdzIG9ubHkgbWFkZSB1cCBvZiBlbXB0eSB0ZXh0IG5vZGVzIGFuZCBjb21tZW50cy5cbiAgaWYgKFxuICAgIGNvbnRlbnQuY2hpbGRyZW4uc29tZShcbiAgICAgIChjaGlsZCkgPT5cbiAgICAgICAgIShjaGlsZCBpbnN0YW5jZW9mIHQuQ29tbWVudCkgJiZcbiAgICAgICAgKCEoY2hpbGQgaW5zdGFuY2VvZiB0LlRleHQpIHx8IGNoaWxkLnZhbHVlLnRyaW0oKS5sZW5ndGggPiAwKSxcbiAgICApXG4gICkge1xuICAgIGZhbGxiYWNrVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGluZ2VzdE5vZGVzKGZhbGxiYWNrVmlldywgY29udGVudC5jaGlsZHJlbik7XG4gIH1cblxuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcChcbiAgICBpZCxcbiAgICBjb250ZW50LnNlbGVjdG9yLFxuICAgIGNvbnRlbnQuaTE4bixcbiAgICBmYWxsYmFja1ZpZXc/LnhyZWYgPz8gbnVsbCxcbiAgICBjb250ZW50LnNvdXJjZVNwYW4sXG4gICk7XG4gIGZvciAoY29uc3QgYXR0ciBvZiBjb250ZW50LmF0dHJpYnV0ZXMpIHtcbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KGNvbnRlbnQubmFtZSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICB1bml0LnVwZGF0ZS5wdXNoKFxuICAgICAgaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLFxuICAgICAgICBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsXG4gICAgICAgIGF0dHIubmFtZSxcbiAgICAgICAgby5saXRlcmFsKGF0dHIudmFsdWUpLFxuICAgICAgICBudWxsLFxuICAgICAgICBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgIHRydWUsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICBudWxsLFxuICAgICAgICBhc01lc3NhZ2UoYXR0ci5pMThuKSxcbiAgICAgICAgYXR0ci5zb3VyY2VTcGFuLFxuICAgICAgKSxcbiAgICApO1xuICB9XG4gIHVuaXQuY3JlYXRlLnB1c2gob3ApO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhIGxpdGVyYWwgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGV4dCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZXh0OiB0LlRleHQsIGljdVBsYWNlaG9sZGVyOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIGljdVBsYWNlaG9sZGVyLCB0ZXh0LnNvdXJjZVNwYW4pLFxuICApO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LFxuICB0ZXh0OiB0LkJvdW5kVGV4dCxcbiAgaWN1UGxhY2Vob2xkZXI6IHN0cmluZyB8IG51bGwsXG4pOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBJbnRlcnBvbGF0aW9uIGZvciBCb3VuZFRleHQgbm9kZSwgZ290ICR7dmFsdWUuY29uc3RydWN0b3IubmFtZX1gLFxuICAgICk7XG4gIH1cbiAgaWYgKHRleHQuaTE4biAhPT0gdW5kZWZpbmVkICYmICEodGV4dC5pMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXJzID1cbiAgICB0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lclxuICAgICAgPyB0ZXh0LmkxOG4uY2hpbGRyZW5cbiAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgIC5tYXAoKHBsYWNlaG9sZGVyKSA9PiBwbGFjZWhvbGRlci5uYW1lKVxuICAgICAgOiBbXTtcbiAgaWYgKGkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoID4gMCAmJiBpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCAhPT0gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBgVW5leHBlY3RlZCBudW1iZXIgb2YgaTE4biBwbGFjZWhvbGRlcnMgKCR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2AsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHRleHRYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3AodGV4dFhyZWYsICcnLCBpY3VQbGFjZWhvbGRlciwgdGV4dC5zb3VyY2VTcGFuKSk7XG4gIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgZG9lcyBub3QgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1Yi1leHByZXNzaW9ucyBpbnNpZGUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbi4gV2UgY29weSB0aGF0IGJlaGF2aW9yIGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgLy8gVE9ETzogaXMgaXQgYWN0dWFsbHkgY29ycmVjdCB0byBnZW5lcmF0ZSB0aGVzZSBleHRyYSBtYXBzIGluIG1vZGVybiBtb2RlP1xuICBjb25zdCBiYXNlU291cmNlU3BhbiA9IHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPyBudWxsIDogdGV4dC5zb3VyY2VTcGFuO1xuICB1bml0LnVwZGF0ZS5wdXNoKFxuICAgIGlyLmNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgICAgdGV4dFhyZWYsXG4gICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncyxcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubWFwKChleHByKSA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICBpMThuUGxhY2Vob2xkZXJzLFxuICAgICAgKSxcbiAgICAgIHRleHQuc291cmNlU3BhbixcbiAgICApLFxuICApO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGlmYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0SWZCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpZkJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkIHwgbnVsbCA9IG51bGw7XG4gIGxldCBjb25kaXRpb25zOiBBcnJheTxpci5Db25kaXRpb25hbENhc2VFeHByPiA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGlmQmxvY2suYnJhbmNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpZkNhc2UgPSBpZkJsb2NrLmJyYW5jaGVzW2ldO1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgY1ZpZXcueHJlZiwgaWZDYXNlKTtcblxuICAgIGlmIChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICBjVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzLm5hbWUsIGlyLkNUWF9SRUYpO1xuICAgIH1cblxuICAgIGxldCBpZkNhc2VJMThuTWV0YTogaTE4bi5CbG9ja1BsYWNlaG9sZGVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChpZkNhc2UuaTE4biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIShpZkNhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGlmIGJsb2NrOiAke2lmQ2FzZS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgICAgfVxuICAgICAgaWZDYXNlSTE4bk1ldGEgPSBpZkNhc2UuaTE4bjtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgIGNWaWV3LnhyZWYsXG4gICAgICBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssXG4gICAgICB0YWdOYW1lLFxuICAgICAgJ0NvbmRpdGlvbmFsJyxcbiAgICAgIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgaWZDYXNlSTE4bk1ldGEsXG4gICAgICBpZkNhc2Uuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgaWZDYXNlLnNvdXJjZVNwYW4sXG4gICAgKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICB9XG5cbiAgICBjb25zdCBjYXNlRXhwciA9IGlmQ2FzZS5leHByZXNzaW9uID8gY29udmVydEFzdChpZkNhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIG51bGwpIDogbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID0gbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoXG4gICAgICBjYXNlRXhwcixcbiAgICAgIHRlbXBsYXRlT3AueHJlZixcbiAgICAgIHRlbXBsYXRlT3AuaGFuZGxlLFxuICAgICAgaWZDYXNlLmV4cHJlc3Npb25BbGlhcyxcbiAgICApO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgaWZDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoZmlyc3RYcmVmISwgbnVsbCwgY29uZGl0aW9ucywgaWZCbG9jay5zb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAc3dpdGNoYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0U3dpdGNoQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3dpdGNoQmxvY2s6IHQuU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgLy8gRG9uJ3QgaW5nZXN0IGVtcHR5IHN3aXRjaGVzIHNpbmNlIHRoZXkgd29uJ3QgcmVuZGVyIGFueXRoaW5nLlxuICBpZiAoc3dpdGNoQmxvY2suY2FzZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkIHwgbnVsbCA9IG51bGw7XG4gIGxldCBjb25kaXRpb25zOiBBcnJheTxpci5Db25kaXRpb25hbENhc2VFeHByPiA9IFtdO1xuICBmb3IgKGNvbnN0IHN3aXRjaENhc2Ugb2Ygc3dpdGNoQmxvY2suY2FzZXMpIHtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGNvbnN0IHRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIGNWaWV3LnhyZWYsIHN3aXRjaENhc2UpO1xuICAgIGxldCBzd2l0Y2hDYXNlSTE4bk1ldGE6IGkxOG4uQmxvY2tQbGFjZWhvbGRlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc3dpdGNoQ2FzZS5pMThuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghKHN3aXRjaENhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHN3aXRjaCBibG9jazogJHtzd2l0Y2hDYXNlLmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaENhc2VJMThuTWV0YSA9IHN3aXRjaENhc2UuaTE4bjtcbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBjVmlldy54cmVmLFxuICAgICAgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLFxuICAgICAgdGFnTmFtZSxcbiAgICAgICdDYXNlJyxcbiAgICAgIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgc3dpdGNoQ2FzZUkxOG5NZXRhLFxuICAgICAgc3dpdGNoQ2FzZS5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBzd2l0Y2hDYXNlLnNvdXJjZVNwYW4sXG4gICAgKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgfVxuICAgIGNvbnN0IGNhc2VFeHByID0gc3dpdGNoQ2FzZS5leHByZXNzaW9uXG4gICAgICA/IGNvbnZlcnRBc3Qoc3dpdGNoQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgc3dpdGNoQmxvY2suc3RhcnRTb3VyY2VTcGFuKVxuICAgICAgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPSBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihcbiAgICAgIGNhc2VFeHByLFxuICAgICAgdGVtcGxhdGVPcC54cmVmLFxuICAgICAgdGVtcGxhdGVPcC5oYW5kbGUsXG4gICAgKTtcbiAgICBjb25kaXRpb25zLnB1c2goY29uZGl0aW9uYWxDYXNlRXhwcik7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIHN3aXRjaENhc2UuY2hpbGRyZW4pO1xuICB9XG4gIHVuaXQudXBkYXRlLnB1c2goXG4gICAgaXIuY3JlYXRlQ29uZGl0aW9uYWxPcChcbiAgICAgIGZpcnN0WHJlZiEsXG4gICAgICBjb252ZXJ0QXN0KHN3aXRjaEJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSxcbiAgICAgIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuLFxuICAgICksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCxcbiAgc3VmZml4OiBzdHJpbmcsXG4gIGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhIHwgdW5kZWZpbmVkLFxuICBjaGlsZHJlbj86IHQuTm9kZVtdLFxuICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLFxuKTogaXIuVGVtcGxhdGVPcCB8IG51bGwge1xuICBpZiAoaTE4bk1ldGEgIT09IHVuZGVmaW5lZCAmJiAhKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBkZWZlciBibG9jaycpO1xuICB9XG4gIGlmIChjaGlsZHJlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc2Vjb25kYXJ5VmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICBpbmdlc3ROb2RlcyhzZWNvbmRhcnlWaWV3LCBjaGlsZHJlbik7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgIHNlY29uZGFyeVZpZXcueHJlZixcbiAgICBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssXG4gICAgbnVsbCxcbiAgICBgRGVmZXIke3N1ZmZpeH1gLFxuICAgIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgIGkxOG5NZXRhLFxuICAgIHNvdXJjZVNwYW4hLFxuICAgIHNvdXJjZVNwYW4hLFxuICApO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuICByZXR1cm4gdGVtcGxhdGVPcDtcbn1cblxuZnVuY3Rpb24gaW5nZXN0RGVmZXJCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBkZWZlckJsb2NrOiB0LkRlZmVycmVkQmxvY2spOiB2b2lkIHtcbiAgbGV0IG93blJlc29sdmVyRm46IG8uRXhwcmVzc2lvbiB8IG51bGwgPSBudWxsO1xuXG4gIGlmICh1bml0LmpvYi5kZWZlck1ldGEubW9kZSA9PT0gRGVmZXJCbG9ja0RlcHNFbWl0TW9kZS5QZXJCbG9jaykge1xuICAgIGlmICghdW5pdC5qb2IuZGVmZXJNZXRhLmJsb2Nrcy5oYXMoZGVmZXJCbG9jaykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gZmluZCBhIGRlcGVuZGVuY3kgZnVuY3Rpb24gZm9yIHRoaXMgZGVmZXJyZWQgYmxvY2tgLFxuICAgICAgKTtcbiAgICB9XG4gICAgb3duUmVzb2x2ZXJGbiA9IHVuaXQuam9iLmRlZmVyTWV0YS5ibG9ja3MuZ2V0KGRlZmVyQmxvY2spID8/IG51bGw7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgZGVmZXIgbWFpbiB2aWV3IGFuZCBhbGwgc2Vjb25kYXJ5IHZpZXdzLlxuICBjb25zdCBtYWluID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQsXG4gICAgJycsXG4gICAgZGVmZXJCbG9jay5pMThuLFxuICAgIGRlZmVyQmxvY2suY2hpbGRyZW4sXG4gICAgZGVmZXJCbG9jay5zb3VyY2VTcGFuLFxuICApITtcbiAgY29uc3QgbG9hZGluZyA9IGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0LFxuICAgICdMb2FkaW5nJyxcbiAgICBkZWZlckJsb2NrLmxvYWRpbmc/LmkxOG4sXG4gICAgZGVmZXJCbG9jay5sb2FkaW5nPy5jaGlsZHJlbixcbiAgICBkZWZlckJsb2NrLmxvYWRpbmc/LnNvdXJjZVNwYW4sXG4gICk7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQsXG4gICAgJ1BsYWNlaG9sZGVyJyxcbiAgICBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5pMThuLFxuICAgIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmNoaWxkcmVuLFxuICAgIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LnNvdXJjZVNwYW4sXG4gICk7XG4gIGNvbnN0IGVycm9yID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQsXG4gICAgJ0Vycm9yJyxcbiAgICBkZWZlckJsb2NrLmVycm9yPy5pMThuLFxuICAgIGRlZmVyQmxvY2suZXJyb3I/LmNoaWxkcmVuLFxuICAgIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4sXG4gICk7XG5cbiAgLy8gQ3JlYXRlIHRoZSBtYWluIGRlZmVyIG9wLCBhbmQgb3BzIGZvciBhbGwgc2Vjb25kYXJ5IHZpZXdzLlxuICBjb25zdCBkZWZlclhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICBjb25zdCBkZWZlck9wID0gaXIuY3JlYXRlRGVmZXJPcChcbiAgICBkZWZlclhyZWYsXG4gICAgbWFpbi54cmVmLFxuICAgIG1haW4uaGFuZGxlLFxuICAgIG93blJlc29sdmVyRm4sXG4gICAgdW5pdC5qb2IuYWxsRGVmZXJyYWJsZURlcHNGbixcbiAgICBkZWZlckJsb2NrLnNvdXJjZVNwYW4sXG4gICk7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJWaWV3ID0gcGxhY2Vob2xkZXI/LnhyZWYgPz8gbnVsbDtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlclNsb3QgPSBwbGFjZWhvbGRlcj8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ1Nsb3QgPSBsb2FkaW5nPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5lcnJvclNsb3QgPSBlcnJvcj8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/Lm1pbmltdW1UaW1lID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ01pbmltdW1UaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdBZnRlclRpbWUgPSBkZWZlckJsb2NrLmxvYWRpbmc/LmFmdGVyVGltZSA/PyBudWxsO1xuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT3ApO1xuXG4gIC8vIENvbmZpZ3VyZSBhbGwgZGVmZXIgYG9uYCBjb25kaXRpb25zLlxuICAvLyBUT0RPOiByZWZhY3RvciBwcmVmZXRjaCB0cmlnZ2VycyB0byB1c2UgYSBzZXBhcmF0ZSBvcCB0eXBlLCB3aXRoIGEgc2hhcmVkIHN1cGVyY2xhc3MuIFRoaXMgd2lsbFxuICAvLyBtYWtlIGl0IGVhc2llciB0byByZWZhY3RvciBwcmVmZXRjaCBiZWhhdmlvciBpbiB0aGUgZnV0dXJlLlxuICBsZXQgcHJlZmV0Y2ggPSBmYWxzZTtcbiAgbGV0IGRlZmVyT25PcHM6IGlyLkRlZmVyT25PcFtdID0gW107XG4gIGxldCBkZWZlcldoZW5PcHM6IGlyLkRlZmVyV2hlbk9wW10gPSBbXTtcbiAgZm9yIChjb25zdCB0cmlnZ2VycyBvZiBbZGVmZXJCbG9jay50cmlnZ2VycywgZGVmZXJCbG9jay5wcmVmZXRjaFRyaWdnZXJzXSkge1xuICAgIGlmICh0cmlnZ2Vycy5pZGxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgZGVmZXJYcmVmLFxuICAgICAgICB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSxcbiAgICAgICAgcHJlZmV0Y2gsXG4gICAgICAgIHRyaWdnZXJzLmlkbGUuc291cmNlU3BhbixcbiAgICAgICk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgIGRlZmVyWHJlZixcbiAgICAgICAge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlfSxcbiAgICAgICAgcHJlZmV0Y2gsXG4gICAgICAgIHRyaWdnZXJzLmltbWVkaWF0ZS5zb3VyY2VTcGFuLFxuICAgICAgKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMudGltZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICBkZWZlclhyZWYsXG4gICAgICAgIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LFxuICAgICAgICBwcmVmZXRjaCxcbiAgICAgICAgdHJpZ2dlcnMudGltZXIuc291cmNlU3BhbixcbiAgICAgICk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmhvdmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgZGVmZXJYcmVmLFxuICAgICAgICB7XG4gICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcixcbiAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5ob3Zlci5yZWZlcmVuY2UsXG4gICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgfSxcbiAgICAgICAgcHJlZmV0Y2gsXG4gICAgICAgIHRyaWdnZXJzLmhvdmVyLnNvdXJjZVNwYW4sXG4gICAgICApO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5pbnRlcmFjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgIGRlZmVyWHJlZixcbiAgICAgICAge1xuICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMuaW50ZXJhY3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgIH0sXG4gICAgICAgIHByZWZldGNoLFxuICAgICAgICB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5zb3VyY2VTcGFuLFxuICAgICAgKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMudmlld3BvcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICBkZWZlclhyZWYsXG4gICAgICAgIHtcbiAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLnZpZXdwb3J0LnJlZmVyZW5jZSxcbiAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICB9LFxuICAgICAgICBwcmVmZXRjaCxcbiAgICAgICAgdHJpZ2dlcnMudmlld3BvcnQuc291cmNlU3BhbixcbiAgICAgICk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLndoZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHRyaWdnZXJzLndoZW4udmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBzdXBwb3J0cyB0aGlzIGNhc2UsIGJ1dCBpdCdzIHZlcnkgc3RyYW5nZSB0byBtZS4gV2hhdCB3b3VsZCBpdFxuICAgICAgICAvLyBldmVuIG1lYW4/XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uIGluIGRlZmVyIGJsb2NrIHdoZW4gdHJpZ2dlcmApO1xuICAgICAgfVxuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJXaGVuT3AoXG4gICAgICAgIGRlZmVyWHJlZixcbiAgICAgICAgY29udmVydEFzdCh0cmlnZ2Vycy53aGVuLnZhbHVlLCB1bml0LmpvYiwgdHJpZ2dlcnMud2hlbi5zb3VyY2VTcGFuKSxcbiAgICAgICAgcHJlZmV0Y2gsXG4gICAgICAgIHRyaWdnZXJzLndoZW4uc291cmNlU3BhbixcbiAgICAgICk7XG4gICAgICBkZWZlcldoZW5PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cblxuICAgIC8vIElmIG5vIChub24tcHJlZmV0Y2hpbmcpIGRlZmVyIHRyaWdnZXJzIHdlcmUgcHJvdmlkZWQsIGRlZmF1bHQgdG8gYGlkbGVgLlxuICAgIGlmIChkZWZlck9uT3BzLmxlbmd0aCA9PT0gMCAmJiBkZWZlcldoZW5PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZURlZmVyT25PcChkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLklkbGV9LCBmYWxzZSwgbnVsbCEpLFxuICAgICAgKTtcbiAgICB9XG4gICAgcHJlZmV0Y2ggPSB0cnVlO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9uT3BzKTtcbiAgdW5pdC51cGRhdGUucHVzaChkZWZlcldoZW5PcHMpO1xufVxuXG5mdW5jdGlvbiBpbmdlc3RJY3UodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWN1OiB0LkljdSkge1xuICBpZiAoaWN1LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgJiYgaXNTaW5nbGVJMThuSWN1KGljdS5pMThuKSkge1xuICAgIGNvbnN0IHhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1U3RhcnRPcCh4cmVmLCBpY3UuaTE4biwgaWN1RnJvbUkxOG5NZXNzYWdlKGljdS5pMThuKS5uYW1lLCBudWxsISkpO1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCB0ZXh0XSBvZiBPYmplY3QuZW50cmllcyh7Li4uaWN1LnZhcnMsIC4uLmljdS5wbGFjZWhvbGRlcnN9KSkge1xuICAgICAgaWYgKHRleHQgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgdGV4dCwgcGxhY2Vob2xkZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0VGV4dCh1bml0LCB0ZXh0LCBwbGFjZWhvbGRlcik7XG4gICAgICB9XG4gICAgfVxuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1RW5kT3AoeHJlZikpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBJQ1U6ICR7aWN1LmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBmb3JgIGJsb2NrIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RGb3JCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBmb3JCbG9jazogdC5Gb3JMb29wQmxvY2spOiB2b2lkIHtcbiAgY29uc3QgcmVwZWF0ZXJWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgLy8gV2UgY29weSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyJ3Mgc2NoZW1lIG9mIGNyZWF0aW5nIG5hbWVzIGZvciBgJGNvdW50YCBhbmQgYCRpbmRleGBcbiAgLy8gdGhhdCBhcmUgc3VmZml4ZWQgd2l0aCBzcGVjaWFsIGluZm9ybWF0aW9uLCB0byBkaXNhbWJpZ3VhdGUgd2hpY2ggbGV2ZWwgb2YgbmVzdGVkIGxvb3BcbiAgLy8gdGhlIGJlbG93IGFsaWFzZXMgcmVmZXIgdG8uXG4gIC8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciBUZW1wbGF0ZSBQaXBlbGluZSdzIHZhcmlhYmxlIHBoYXNlcyB0byBncmFjZWZ1bGx5IGhhbmRsZVxuICAvLyBzaGFkb3dpbmcsIGFuZCBhcmJpdHJhcmlseSBtYW55IGxldmVscyBvZiB2YXJpYWJsZXMgZGVwZW5kaW5nIG9uIGVhY2ggb3RoZXIuXG4gIGNvbnN0IGluZGV4TmFtZSA9IGDJtSRpbmRleF8ke3JlcGVhdGVyVmlldy54cmVmfWA7XG4gIGNvbnN0IGNvdW50TmFtZSA9IGDJtSRjb3VudF8ke3JlcGVhdGVyVmlldy54cmVmfWA7XG4gIGNvbnN0IGluZGV4VmFyTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcblxuICBmb3IgKGNvbnN0IHZhcmlhYmxlIG9mIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMpIHtcbiAgICBpZiAodmFyaWFibGUudmFsdWUgPT09ICckaW5kZXgnKSB7XG4gICAgICBpbmRleFZhck5hbWVzLmFkZCh2YXJpYWJsZS5uYW1lKTtcbiAgICB9XG4gICAgaWYgKHZhcmlhYmxlLm5hbWUgPT09ICckaW5kZXgnKSB7XG4gICAgICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoJyRpbmRleCcsIHZhcmlhYmxlLnZhbHVlKS5zZXQoaW5kZXhOYW1lLCB2YXJpYWJsZS52YWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YXJpYWJsZS5uYW1lID09PSAnJGNvdW50Jykge1xuICAgICAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KCckY291bnQnLCB2YXJpYWJsZS52YWx1ZSkuc2V0KGNvdW50TmFtZSwgdmFyaWFibGUudmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXBlYXRlclZpZXcuYWxpYXNlcy5hZGQoe1xuICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgaWRlbnRpZmllcjogdmFyaWFibGUubmFtZSxcbiAgICAgICAgZXhwcmVzc2lvbjogZ2V0Q29tcHV0ZWRGb3JMb29wVmFyaWFibGVFeHByZXNzaW9uKHZhcmlhYmxlLCBpbmRleE5hbWUsIGNvdW50TmFtZSksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBzb3VyY2VTcGFuID0gY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2sudHJhY2tCeS5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgY29uc3QgdHJhY2sgPSBjb252ZXJ0QXN0KGZvckJsb2NrLnRyYWNrQnksIHVuaXQuam9iLCBzb3VyY2VTcGFuKTtcblxuICBpbmdlc3ROb2RlcyhyZXBlYXRlclZpZXcsIGZvckJsb2NrLmNoaWxkcmVuKTtcblxuICBsZXQgZW1wdHlWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0IHwgbnVsbCA9IG51bGw7XG4gIGxldCBlbXB0eVRhZ05hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgICBlbXB0eVRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIGVtcHR5Vmlldy54cmVmLCBmb3JCbG9jay5lbXB0eSk7XG4gIH1cblxuICBjb25zdCB2YXJOYW1lczogaXIuUmVwZWF0ZXJWYXJOYW1lcyA9IHtcbiAgICAkaW5kZXg6IGluZGV4VmFyTmFtZXMsXG4gICAgJGltcGxpY2l0OiBmb3JCbG9jay5pdGVtLm5hbWUsXG4gIH07XG5cbiAgaWYgKGZvckJsb2NrLmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKGZvckJsb2NrLmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBmb3InKTtcbiAgfVxuICBpZiAoXG4gICAgZm9yQmxvY2suZW1wdHk/LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICEoZm9yQmxvY2suZW1wdHkuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcilcbiAgKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBlbXB0eScpO1xuICB9XG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IGZvckJsb2NrLmkxOG47XG4gIGNvbnN0IGVtcHR5STE4blBsYWNlaG9sZGVyID0gZm9yQmxvY2suZW1wdHk/LmkxOG47XG5cbiAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgcmVwZWF0ZXJWaWV3LnhyZWYsIGZvckJsb2NrKTtcbiAgY29uc3QgcmVwZWF0ZXJDcmVhdGUgPSBpci5jcmVhdGVSZXBlYXRlckNyZWF0ZU9wKFxuICAgIHJlcGVhdGVyVmlldy54cmVmLFxuICAgIGVtcHR5Vmlldz8ueHJlZiA/PyBudWxsLFxuICAgIHRhZ05hbWUsXG4gICAgdHJhY2ssXG4gICAgdmFyTmFtZXMsXG4gICAgZW1wdHlUYWdOYW1lLFxuICAgIGkxOG5QbGFjZWhvbGRlcixcbiAgICBlbXB0eUkxOG5QbGFjZWhvbGRlcixcbiAgICBmb3JCbG9jay5zdGFydFNvdXJjZVNwYW4sXG4gICAgZm9yQmxvY2suc291cmNlU3BhbixcbiAgKTtcbiAgdW5pdC5jcmVhdGUucHVzaChyZXBlYXRlckNyZWF0ZSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoXG4gICAgZm9yQmxvY2suZXhwcmVzc2lvbixcbiAgICB1bml0LmpvYixcbiAgICBjb252ZXJ0U291cmNlU3Bhbihmb3JCbG9jay5leHByZXNzaW9uLnNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pLFxuICApO1xuICBjb25zdCByZXBlYXRlciA9IGlyLmNyZWF0ZVJlcGVhdGVyT3AoXG4gICAgcmVwZWF0ZXJDcmVhdGUueHJlZixcbiAgICByZXBlYXRlckNyZWF0ZS5oYW5kbGUsXG4gICAgZXhwcmVzc2lvbixcbiAgICBmb3JCbG9jay5zb3VyY2VTcGFuLFxuICApO1xuICB1bml0LnVwZGF0ZS5wdXNoKHJlcGVhdGVyKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGV4cHJlc3Npb24gdGhhdCByZXByZXNlbnRzIGEgdmFyaWFibGUgaW4gYW4gYEBmb3JgIGxvb3AuXG4gKiBAcGFyYW0gdmFyaWFibGUgQVNUIHJlcHJlc2VudGluZyB0aGUgdmFyaWFibGUuXG4gKiBAcGFyYW0gaW5kZXhOYW1lIExvb3Atc3BlY2lmaWMgbmFtZSBmb3IgYCRpbmRleGAuXG4gKiBAcGFyYW0gY291bnROYW1lIExvb3Atc3BlY2lmaWMgbmFtZSBmb3IgYCRjb3VudGAuXG4gKi9cbmZ1bmN0aW9uIGdldENvbXB1dGVkRm9yTG9vcFZhcmlhYmxlRXhwcmVzc2lvbihcbiAgdmFyaWFibGU6IHQuVmFyaWFibGUsXG4gIGluZGV4TmFtZTogc3RyaW5nLFxuICBjb3VudE5hbWU6IHN0cmluZyxcbik6IG8uRXhwcmVzc2lvbiB7XG4gIHN3aXRjaCAodmFyaWFibGUudmFsdWUpIHtcbiAgICBjYXNlICckaW5kZXgnOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKTtcblxuICAgIGNhc2UgJyRjb3VudCc6XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihjb3VudE5hbWUpO1xuXG4gICAgY2FzZSAnJGZpcnN0JzpcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGluZGV4TmFtZSkuaWRlbnRpY2FsKG8ubGl0ZXJhbCgwKSk7XG5cbiAgICBjYXNlICckbGFzdCc6XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihpbmRleE5hbWUpLmlkZW50aWNhbChcbiAgICAgICAgbmV3IGlyLkxleGljYWxSZWFkRXhwcihjb3VudE5hbWUpLm1pbnVzKG8ubGl0ZXJhbCgxKSksXG4gICAgICApO1xuXG4gICAgY2FzZSAnJGV2ZW4nOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5tb2R1bG8oby5saXRlcmFsKDIpKS5pZGVudGljYWwoby5saXRlcmFsKDApKTtcblxuICAgIGNhc2UgJyRvZGQnOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5tb2R1bG8oby5saXRlcmFsKDIpKS5ub3RJZGVudGljYWwoby5saXRlcmFsKDApKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIEBmb3IgbG9vcCB2YXJpYWJsZSAke3ZhcmlhYmxlLnZhbHVlfWApO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRlbXBsYXRlIEFTVCBleHByZXNzaW9uIGludG8gYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXN0KFxuICBhc3Q6IGUuQVNULFxuICBqb2I6IENvbXBpbGF0aW9uSm9iLFxuICBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCxcbik6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuYXN0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5UmVhZCkge1xuICAgIGNvbnN0IGlzVGhpc1JlY2VpdmVyID0gYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXI7XG4gICAgLy8gV2hldGhlciB0aGlzIGlzIGFuIGltcGxpY2l0IHJlY2VpdmVyLCAqZXhjbHVkaW5nKiBleHBsaWNpdCByZWFkcyBvZiBgdGhpc2AuXG4gICAgY29uc3QgaXNJbXBsaWNpdFJlY2VpdmVyID1cbiAgICAgIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlciAmJiAhKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKTtcbiAgICAvLyBXaGV0aGVyIHRoZSAgbmFtZSBvZiB0aGUgcmVhZCBpcyBhIG5vZGUgdGhhdCBzaG91bGQgYmUgbmV2ZXIgcmV0YWluIGl0cyBleHBsaWNpdCB0aGlzXG4gICAgLy8gcmVjZWl2ZXIuXG4gICAgY29uc3QgaXNTcGVjaWFsTm9kZSA9IGFzdC5uYW1lID09PSAnJGFueScgfHwgYXN0Lm5hbWUgPT09ICckZXZlbnQnO1xuICAgIC8vIFRPRE86IFRoZSBtb3N0IHNlbnNpYmxlIGNvbmRpdGlvbiBoZXJlIHdvdWxkIGJlIHNpbXBseSBgaXNJbXBsaWNpdFJlY2VpdmVyYCwgdG8gY29udmVydCBvbmx5XG4gICAgLy8gYWN0dWFsIGltcGxpY2l0IGB0aGlzYCByZWFkcywgYW5kIG5vdCBleHBsaWNpdCBvbmVzLiBIb3dldmVyLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIChhbmRcbiAgICAvLyB0aGUgVHlwZWNoZWNrIGJsb2NrISkgYm90aCBoYXZlIHRoZSBzYW1lIGJ1ZywgaW4gd2hpY2ggdGhleSBhbHNvIGNvbnNpZGVyIGV4cGxpY2l0IGB0aGlzYFxuICAgIC8vIHJlYWRzIHRvIGJlIGltcGxpY2l0LiBUaGlzIGNhdXNlcyBwcm9ibGVtcyB3aGVuIHRoZSBleHBsaWNpdCBgdGhpc2AgcmVhZCBpcyBpbnNpZGUgYVxuICAgIC8vIHRlbXBsYXRlIHdpdGggYSBjb250ZXh0IHRoYXQgYWxzbyBwcm92aWRlcyB0aGUgdmFyaWFibGUgbmFtZSBiZWluZyByZWFkOlxuICAgIC8vIGBgYFxuICAgIC8vIDxuZy10ZW1wbGF0ZSBsZXQtYT57e3RoaXMuYX19PC9uZy10ZW1wbGF0ZT5cbiAgICAvLyBgYGBcbiAgICAvLyBUaGUgd2hvbGUgcG9pbnQgb2YgdGhlIGV4cGxpY2l0IGB0aGlzYCB3YXMgdG8gYWNjZXNzIHRoZSBjbGFzcyBwcm9wZXJ0eSwgYnV0IFREQiBhbmQgdGhlXG4gICAgLy8gY3VycmVudCBUQ0IgdHJlYXQgdGhlIHJlYWQgYXMgaW1wbGljaXQsIGFuZCBnaXZlIHlvdSB0aGUgY29udGV4dCBwcm9wZXJ0eSBpbnN0ZWFkIVxuICAgIC8vXG4gICAgLy8gRm9yIG5vdywgd2UgZW11bGF0ZSB0aGlzIG9sZCBiZWh2YWlvciBieSBhZ2dyZXNzaXZlbHkgY29udmVydGluZyBleHBsaWNpdCByZWFkcyB0byB0b1xuICAgIC8vIGltcGxpY2l0IHJlYWRzLCBleGNlcHQgZm9yIHRoZSBzcGVjaWFsIGNhc2VzIHRoYXQgVERCIGFuZCB0aGUgY3VycmVudCBUQ0IgcHJvdGVjdC4gSG93ZXZlcixcbiAgICAvLyBpdCB3b3VsZCBiZSBhbiBpbXByb3ZlbWVudCB0byBmaXggdGhpcy5cbiAgICAvL1xuICAgIC8vIFNlZSBhbHNvIHRoZSBjb3JyZXNwb25kaW5nIGNvbW1lbnQgZm9yIHRoZSBUQ0IsIGluIGB0eXBlX2NoZWNrX2Jsb2NrLnRzYC5cbiAgICBpZiAoaXNJbXBsaWNpdFJlY2VpdmVyIHx8IChpc1RoaXNSZWNlaXZlciAmJiAhaXNTcGVjaWFsTm9kZSkpIHtcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlXcml0ZSkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgICAvLyBUT0RPOiBJcyBpdCBjb3JyZWN0IHRvIGFsd2F5cyB1c2UgdGhlIHJvb3QgY29udGV4dCBpbiBwbGFjZSBvZiB0aGUgaW1wbGljaXQgcmVjZWl2ZXI/XG4gICAgICAgIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKSxcbiAgICAgICAgYXN0Lm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgYXN0Lm5hbWUsXG4gICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlS2V5RXhwcihcbiAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DYWxsKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIEltcGxpY2l0UmVjZWl2ZXJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBhc3QuYXJncy5tYXAoKGFyZykgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5VbmFyeSkge1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdG9yKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgIG8uVW5hcnlPcGVyYXRvci5QbHVzLFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICApO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIHJldHVybiBuZXcgby5VbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICBvLlVuYXJ5T3BlcmF0b3IuTWludXMsXG4gICAgICAgICAgY29udmVydEFzdChhc3QuZXhwciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIHVuYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgIG9wZXJhdG9yLFxuICAgICAgY29udmVydEFzdChhc3QubGVmdCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICBjb252ZXJ0QXN0KGFzdC5yaWdodCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgY29udGV4dCBleHByZXNzaW9ucyBoYXZlIHNvdXJjZSBtYXBzP1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoXG4gICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgdW5kZWZpbmVkLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBDaGFpbiBpbiB1bmtub3duIGNvbnRleHRgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxNYXApIHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmtleXMubWFwKChrZXksIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWVzW2lkeF07XG4gICAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nXG4gICAgICAvLyBleHByZXNzaW9uP1xuICAgICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXkua2V5LCBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwga2V5LnF1b3RlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsQXJyYXkpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nIGV4cHJlc3Npb24/XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoXG4gICAgICBhc3QuZXhwcmVzc2lvbnMubWFwKChleHByKSA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgY29udmVydEFzdChhc3QuY29uZGl0aW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgIGNvbnZlcnRBc3QoYXN0LnRydWVFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgdW5kZWZpbmVkLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIC8vIFRPRE86IHBpcGVzIHNob3VsZCBwcm9iYWJseSBoYXZlIHNvdXJjZSBtYXBzOyBmaWd1cmUgb3V0IGRldGFpbHMuXG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIGFzdC5uYW1lLCBbXG4gICAgICBjb252ZXJ0QXN0KGFzdC5leHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgLi4uYXN0LmFyZ3MubWFwKChhcmcpID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgXSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihcbiAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVQcm9wZXJ0eVJlYWRFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUNhbGwpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZUludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgIGFzdC5hcmdzLm1hcCgoYSkgPT4gY29udmVydEFzdChhLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJlZml4Tm90KSB7XG4gICAgcmV0dXJuIG8ubm90KFxuICAgICAgY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGUgXCIke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfVwiIGluIGZpbGUgXCIke2Jhc2VTb3VyY2VTcGFuPy5zdGFydC5maWxlLnVybH1cImAsXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXN0V2l0aEludGVycG9sYXRpb24oXG4gIGpvYjogQ29tcGlsYXRpb25Kb2IsXG4gIHZhbHVlOiBlLkFTVCB8IHN0cmluZyxcbiAgaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGEgfCBudWxsIHwgdW5kZWZpbmVkLFxuICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLFxuKTogby5FeHByZXNzaW9uIHwgaXIuSW50ZXJwb2xhdGlvbiB7XG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24gfCBpci5JbnRlcnBvbGF0aW9uO1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICB2YWx1ZS5zdHJpbmdzLFxuICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubWFwKChlKSA9PiBjb252ZXJ0QXN0KGUsIGpvYiwgc291cmNlU3BhbiA/PyBudWxsKSksXG4gICAgICBPYmplY3Qua2V5cyhhc01lc3NhZ2UoaTE4bk1ldGEpPy5wbGFjZWhvbGRlcnMgPz8ge30pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVCkge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIHNvdXJjZVNwYW4gPz8gbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIGV4cHJlc3Npb247XG59XG5cbi8vIFRPRE86IENhbiB3ZSBwb3B1bGF0ZSBUZW1wbGF0ZSBiaW5kaW5nIGtpbmRzIGluIGluZ2VzdD9cbmNvbnN0IEJJTkRJTkdfS0lORFMgPSBuZXcgTWFwPGUuQmluZGluZ1R5cGUsIGlyLkJpbmRpbmdLaW5kPihbXG4gIFtlLkJpbmRpbmdUeXBlLlByb3BlcnR5LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLlR3b1dheSwgaXIuQmluZGluZ0tpbmQuVHdvV2F5UHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZV0sXG4gIFtlLkJpbmRpbmdUeXBlLkNsYXNzLCBpci5CaW5kaW5nS2luZC5DbGFzc05hbWVdLFxuICBbZS5CaW5kaW5nVHlwZS5TdHlsZSwgaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uXSxcbl0pO1xuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpcyBhIHBsYWluIG5nLXRlbXBsYXRlIChhcyBvcHBvc2VkIHRvIGFub3RoZXIga2luZCBvZiB0ZW1wbGF0ZVxuICogc3VjaCBhcyBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlIG9yIGNvbnRyb2wgZmxvdyB0ZW1wbGF0ZSkuIFRoaXMgaXMgY2hlY2tlZCBiYXNlZCBvbiB0aGVcbiAqIHRhZ05hbWUuIFdlIGNhbiBleHBlY3QgdGhhdCBvbmx5IHBsYWluIG5nLXRlbXBsYXRlcyB3aWxsIGNvbWUgdGhyb3VnaCB3aXRoIGEgdGFnTmFtZSBvZlxuICogJ25nLXRlbXBsYXRlJy5cbiAqXG4gKiBIZXJlIGFyZSBzb21lIG9mIHRoZSBjYXNlcyB3ZSBleHBlY3Q6XG4gKlxuICogfCBBbmd1bGFyIEhUTUwgICAgICAgICAgICAgICAgICAgICAgIHwgVGVtcGxhdGUgdGFnTmFtZSAgIHxcbiAqIHwgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8IC0tLS0tLS0tLS0tLS0tLS0tLSB8XG4gKiB8IGA8bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPGRpdiAqbmdJZj1cInRydWVcIj5gICAgICAgICAgICAgICAgfCAnZGl2JyAgICAgICAgICAgICAgfFxuICogfCBgPHN2Zz48bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgIHwgJ3N2ZzpuZy10ZW1wbGF0ZScgIHxcbiAqIHwgYEBpZiAodHJ1ZSkge2AgICAgICAgICAgICAgICAgICAgICB8ICdDb25kaXRpb25hbCcgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAocGxhaW4pICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHN0cnVjdHVyYWwpIHwgbnVsbCAgICAgICAgICAgICAgIHxcbiAqL1xuZnVuY3Rpb24gaXNQbGFpblRlbXBsYXRlKHRtcGw6IHQuVGVtcGxhdGUpIHtcbiAgcmV0dXJuIHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSA/PyAnJylbMV0gPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FO1xufVxuXG4vKipcbiAqIEVuc3VyZXMgdGhhdCB0aGUgaTE4bk1ldGEsIGlmIHByb3ZpZGVkLCBpcyBhbiBpMThuLk1lc3NhZ2UuXG4gKi9cbmZ1bmN0aW9uIGFzTWVzc2FnZShpMThuTWV0YTogaTE4bi5JMThuTWV0YSB8IG51bGwgfCB1bmRlZmluZWQpOiBpMThuLk1lc3NhZ2UgfCBudWxsIHtcbiAgaWYgKGkxOG5NZXRhID09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAoIShpMThuTWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkpIHtcbiAgICB0aHJvdyBFcnJvcihgRXhwZWN0ZWQgaTE4biBtZXRhIHRvIGJlIGEgTWVzc2FnZSwgYnV0IGdvdDogJHtpMThuTWV0YS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIHJldHVybiBpMThuTWV0YTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgYmluZGluZ3Mgb24gYW4gZWxlbWVudCBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IHRoZW0gdG8gdGhlaXIgSVJcbiAqIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RFbGVtZW50QmluZGluZ3MoXG4gIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsXG4gIG9wOiBpci5FbGVtZW50T3BCYXNlLFxuICBlbGVtZW50OiB0LkVsZW1lbnQsXG4pOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcCB8IGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wIHwgbnVsbD4oKTtcblxuICBsZXQgaTE4bkF0dHJpYnV0ZUJpbmRpbmdOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAvLyBBdHRyaWJ1dGUgbGl0ZXJhbCBiaW5kaW5ncywgc3VjaCBhcyBgYXR0ci5mb289XCJiYXJcImAuXG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChlbGVtZW50Lm5hbWUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgYmluZGluZ3MucHVzaChcbiAgICAgIGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgb3AueHJlZixcbiAgICAgICAgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLFxuICAgICAgICBhdHRyLm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3RXaXRoSW50ZXJwb2xhdGlvbih1bml0LmpvYiwgYXR0ci52YWx1ZSwgYXR0ci5pMThuKSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICB0cnVlLFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgYXNNZXNzYWdlKGF0dHIuaTE4biksXG4gICAgICAgIGF0dHIuc291cmNlU3BhbixcbiAgICAgICksXG4gICAgKTtcbiAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICBpMThuQXR0cmlidXRlQmluZGluZ05hbWVzLmFkZChhdHRyLm5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgZWxlbWVudC5pbnB1dHMpIHtcbiAgICBpZiAoaTE4bkF0dHJpYnV0ZUJpbmRpbmdOYW1lcy5oYXMoaW5wdXQubmFtZSkpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBPbiBjb21wb25lbnQgJHt1bml0LmpvYi5jb21wb25lbnROYW1lfSwgdGhlIGJpbmRpbmcgJHtpbnB1dC5uYW1lfSBpcyBib3RoIGFuIGkxOG4gYXR0cmlidXRlIGFuZCBhIHByb3BlcnR5LiBZb3UgbWF5IHdhbnQgdG8gcmVtb3ZlIHRoZSBwcm9wZXJ0eSBiaW5kaW5nLiBUaGlzIHdpbGwgYmVjb21lIGEgY29tcGlsYXRpb24gZXJyb3IgaW4gZnV0dXJlIHZlcnNpb25zIG9mIEFuZ3VsYXIuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIEFsbCBkeW5hbWljIGJpbmRpbmdzIChib3RoIGF0dHJpYnV0ZSBhbmQgcHJvcGVydHkgYmluZGluZ3MpLlxuICAgIGJpbmRpbmdzLnB1c2goXG4gICAgICBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgIG9wLnhyZWYsXG4gICAgICAgIEJJTkRJTkdfS0lORFMuZ2V0KGlucHV0LnR5cGUpISxcbiAgICAgICAgaW5wdXQubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhc3RPZihpbnB1dC52YWx1ZSksIGlucHV0LmkxOG4pLFxuICAgICAgICBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgYXNNZXNzYWdlKGlucHV0LmkxOG4pID8/IG51bGwsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgIGJpbmRpbmdzLmZpbHRlcigoYik6IGIgaXMgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSksXG4gICk7XG4gIHVuaXQudXBkYXRlLnB1c2goYmluZGluZ3MuZmlsdGVyKChiKTogYiBpcyBpci5CaW5kaW5nT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkJpbmRpbmcpKTtcblxuICBmb3IgKGNvbnN0IG91dHB1dCBvZiBlbGVtZW50Lm91dHB1dHMpIHtcbiAgICBpZiAob3V0cHV0LnR5cGUgPT09IGUuUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiAmJiBvdXRwdXQucGhhc2UgPT09IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKCdBbmltYXRpb24gbGlzdGVuZXIgc2hvdWxkIGhhdmUgYSBwaGFzZScpO1xuICAgIH1cblxuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuVHdvV2F5KSB7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVUd29XYXlMaXN0ZW5lck9wKFxuICAgICAgICAgIG9wLnhyZWYsXG4gICAgICAgICAgb3AuaGFuZGxlLFxuICAgICAgICAgIG91dHB1dC5uYW1lLFxuICAgICAgICAgIG9wLnRhZyxcbiAgICAgICAgICBtYWtlVHdvV2F5TGlzdGVuZXJIYW5kbGVyT3BzKHVuaXQsIG91dHB1dC5oYW5kbGVyLCBvdXRwdXQuaGFuZGxlclNwYW4pLFxuICAgICAgICAgIG91dHB1dC5zb3VyY2VTcGFuLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgICAgICBvcC54cmVmLFxuICAgICAgICAgIG9wLmhhbmRsZSxcbiAgICAgICAgICBvdXRwdXQubmFtZSxcbiAgICAgICAgICBvcC50YWcsXG4gICAgICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSxcbiAgICAgICAgICBvdXRwdXQucGhhc2UsXG4gICAgICAgICAgb3V0cHV0LnRhcmdldCxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgYW55IG9mIHRoZSBiaW5kaW5ncyBvbiB0aGlzIGVsZW1lbnQgaGF2ZSBhbiBpMThuIG1lc3NhZ2UsIHRoZW4gYW4gaTE4biBhdHRycyBjb25maWd1cmF0aW9uXG4gIC8vIG9wIGlzIGFsc28gcmVxdWlyZWQuXG4gIGlmIChiaW5kaW5ncy5zb21lKChiKSA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgaXIuY3JlYXRlSTE4bkF0dHJpYnV0ZXNPcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBvcC54cmVmKSxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGEgdGVtcGxhdGUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtIHRvIHRoZWlyIElSXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGVCaW5kaW5ncyhcbiAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCxcbiAgb3A6IGlyLkVsZW1lbnRPcEJhc2UsXG4gIHRlbXBsYXRlOiB0LlRlbXBsYXRlLFxuICB0ZW1wbGF0ZUtpbmQ6IGlyLlRlbXBsYXRlS2luZCB8IG51bGwsXG4pOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcCB8IGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wIHwgbnVsbD4oKTtcblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgdGVtcGxhdGUudGVtcGxhdGVBdHRycykge1xuICAgIGlmIChhdHRyIGluc3RhbmNlb2YgdC5UZXh0QXR0cmlidXRlKSB7XG4gICAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgICAgYmluZGluZ3MucHVzaChcbiAgICAgICAgY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsXG4gICAgICAgICAgb3AueHJlZixcbiAgICAgICAgICBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSxcbiAgICAgICAgICBhdHRyLm5hbWUsXG4gICAgICAgICAgYXR0ci52YWx1ZSxcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICAgIHRlbXBsYXRlS2luZCxcbiAgICAgICAgICBhc01lc3NhZ2UoYXR0ci5pMThuKSxcbiAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4sXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKFxuICAgICAgICBjcmVhdGVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgdW5pdCxcbiAgICAgICAgICBvcC54cmVmLFxuICAgICAgICAgIGF0dHIudHlwZSxcbiAgICAgICAgICBhdHRyLm5hbWUsXG4gICAgICAgICAgYXN0T2YoYXR0ci52YWx1ZSksXG4gICAgICAgICAgYXR0ci51bml0LFxuICAgICAgICAgIGF0dHIuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgdGVtcGxhdGVLaW5kLFxuICAgICAgICAgIGFzTWVzc2FnZShhdHRyLmkxOG4pLFxuICAgICAgICAgIGF0dHIuc291cmNlU3BhbixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBhdHRyIG9mIHRlbXBsYXRlLmF0dHJpYnV0ZXMpIHtcbiAgICAvLyBBdHRyaWJ1dGUgbGl0ZXJhbCBiaW5kaW5ncywgc3VjaCBhcyBgYXR0ci5mb289XCJiYXJcImAuXG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICBiaW5kaW5ncy5wdXNoKFxuICAgICAgY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICB1bml0LFxuICAgICAgICBvcC54cmVmLFxuICAgICAgICBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSxcbiAgICAgICAgYXR0ci5uYW1lLFxuICAgICAgICBhdHRyLnZhbHVlLFxuICAgICAgICBudWxsLFxuICAgICAgICBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsXG4gICAgICAgIGFzTWVzc2FnZShhdHRyLmkxOG4pLFxuICAgICAgICBhdHRyLnNvdXJjZVNwYW4sXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGlucHV0IG9mIHRlbXBsYXRlLmlucHV0cykge1xuICAgIC8vIER5bmFtaWMgYmluZGluZ3MgKGJvdGggYXR0cmlidXRlIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncykuXG4gICAgYmluZGluZ3MucHVzaChcbiAgICAgIGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgdW5pdCxcbiAgICAgICAgb3AueHJlZixcbiAgICAgICAgaW5wdXQudHlwZSxcbiAgICAgICAgaW5wdXQubmFtZSxcbiAgICAgICAgYXN0T2YoaW5wdXQudmFsdWUpLFxuICAgICAgICBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsXG4gICAgICAgIGFzTWVzc2FnZShpbnB1dC5pMThuKSxcbiAgICAgICAgaW5wdXQuc291cmNlU3BhbixcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgYmluZGluZ3MuZmlsdGVyKChiKTogYiBpcyBpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSxcbiAgKTtcbiAgdW5pdC51cGRhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoKGIpOiBiIGlzIGlyLkJpbmRpbmdPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuQmluZGluZykpO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIHRlbXBsYXRlLm91dHB1dHMpIHtcbiAgICBpZiAob3V0cHV0LnR5cGUgPT09IGUuUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiAmJiBvdXRwdXQucGhhc2UgPT09IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKCdBbmltYXRpb24gbGlzdGVuZXIgc2hvdWxkIGhhdmUgYSBwaGFzZScpO1xuICAgIH1cblxuICAgIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5OZ1RlbXBsYXRlKSB7XG4gICAgICBpZiAob3V0cHV0LnR5cGUgPT09IGUuUGFyc2VkRXZlbnRUeXBlLlR3b1dheSkge1xuICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICAgIGlyLmNyZWF0ZVR3b1dheUxpc3RlbmVyT3AoXG4gICAgICAgICAgICBvcC54cmVmLFxuICAgICAgICAgICAgb3AuaGFuZGxlLFxuICAgICAgICAgICAgb3V0cHV0Lm5hbWUsXG4gICAgICAgICAgICBvcC50YWcsXG4gICAgICAgICAgICBtYWtlVHdvV2F5TGlzdGVuZXJIYW5kbGVyT3BzKHVuaXQsIG91dHB1dC5oYW5kbGVyLCBvdXRwdXQuaGFuZGxlclNwYW4pLFxuICAgICAgICAgICAgb3V0cHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgICAgICAgIG9wLnhyZWYsXG4gICAgICAgICAgICBvcC5oYW5kbGUsXG4gICAgICAgICAgICBvdXRwdXQubmFtZSxcbiAgICAgICAgICAgIG9wLnRhZyxcbiAgICAgICAgICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksXG4gICAgICAgICAgICBvdXRwdXQucGhhc2UsXG4gICAgICAgICAgICBvdXRwdXQudGFyZ2V0LFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbixcbiAgICAgICAgICApLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoXG4gICAgICB0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsICYmXG4gICAgICBvdXRwdXQudHlwZSAhPT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uXG4gICAgKSB7XG4gICAgICAvLyBBbmltYXRpb24gYmluZGluZ3MgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUncyBjb25zdCBhcnJheS5cbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIG91dHB1dC5uYW1lLCBmYWxzZSk7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICBvcC54cmVmLFxuICAgICAgICAgIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgb3V0cHV0Lm5hbWUsXG4gICAgICAgICAgbnVsbCxcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPOiBQZXJoYXBzIHdlIGNvdWxkIGRvIHRoaXMgaW4gYSBwaGFzZT8gKEl0IGxpa2VseSB3b3VsZG4ndCBjaGFuZ2UgdGhlIHNsb3QgaW5kaWNlcy4pXG4gIGlmIChiaW5kaW5ncy5zb21lKChiKSA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgaXIuY3JlYXRlSTE4bkF0dHJpYnV0ZXNPcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBvcC54cmVmKSxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGluZ2VzdCBhbiBpbmRpdmlkdWFsIGJpbmRpbmcgb24gYSB0ZW1wbGF0ZSwgZWl0aGVyIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAsIG9yIGFuXG4gKiBpbXBsaWNpdCB0ZW1wbGF0ZSBjcmVhdGVkIHZpYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS5cbiAqXG4gKiBCaW5kaW5ncyBvbiB0ZW1wbGF0ZXMgYXJlICpleHRyZW1lbHkqIHRyaWNreS4gSSBoYXZlIHRyaWVkIHRvIGlzb2xhdGUgYWxsIG9mIHRoZSBjb25mdXNpbmcgZWRnZVxuICogY2FzZXMgaW50byB0aGlzIGZ1bmN0aW9uLCBhbmQgdG8gY29tbWVudCBpdCB3ZWxsIHRvIGRvY3VtZW50IHRoZSBiZWhhdmlvci5cbiAqXG4gKiBTb21lIG9mIHRoaXMgYmVoYXZpb3IgaXMgaW50dWl0aXZlbHkgaW5jb3JyZWN0LCBhbmQgd2Ugc2hvdWxkIGNvbnNpZGVyIGNoYW5naW5nIGl0IGluIHRoZSBmdXR1cmUuXG4gKlxuICogQHBhcmFtIHZpZXcgVGhlIGNvbXBpbGF0aW9uIHVuaXQgZm9yIHRoZSB2aWV3IGNvbnRhaW5pbmcgdGhlIHRlbXBsYXRlLlxuICogQHBhcmFtIHhyZWYgVGhlIHhyZWYgb2YgdGhlIHRlbXBsYXRlIG9wLlxuICogQHBhcmFtIHR5cGUgVGhlIGJpbmRpbmcgdHlwZSwgYWNjb3JkaW5nIHRvIHRoZSBwYXJzZXIuIFRoaXMgaXMgZmFpcmx5IHJlYXNvbmFibGUsIGUuZy4gYm90aFxuICogICAgIGR5bmFtaWMgYW5kIHN0YXRpYyBhdHRyaWJ1dGVzIGhhdmUgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUuXG4gKiBAcGFyYW0gbmFtZSBUaGUgYmluZGluZydzIG5hbWUuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGJpbmRpbmdzJ3MgdmFsdWUsIHdoaWNoIHdpbGwgZWl0aGVyIGJlIGFuIGlucHV0IEFTVCBleHByZXNzaW9uLCBvciBhIHN0cmluZ1xuICogICAgIGxpdGVyYWwuIE5vdGUgdGhhdCB0aGUgaW5wdXQgQVNUIGV4cHJlc3Npb24gbWF5IG9yIG1heSBub3QgYmUgY29uc3QgLS0gaXQgd2lsbCBvbmx5IGJlIGFcbiAqICAgICBzdHJpbmcgbGl0ZXJhbCBpZiB0aGUgcGFyc2VyIGNvbnNpZGVyZWQgaXQgYSB0ZXh0IGJpbmRpbmcuXG4gKiBAcGFyYW0gdW5pdCBJZiB0aGUgYmluZGluZyBoYXMgYSB1bml0IChlLmcuIGBweGAgZm9yIHN0eWxlIGJpbmRpbmdzKSwgdGhlbiB0aGlzIGlzIHRoZSB1bml0LlxuICogQHBhcmFtIHNlY3VyaXR5Q29udGV4dCBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAqIEBwYXJhbSBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSBXaGV0aGVyIHRoaXMgYmluZGluZyBhY3R1YWxseSBhcHBsaWVzIHRvIHRoZSBzdHJ1Y3R1cmFsXG4gKiAgICAgbmctdGVtcGxhdGUuIEZvciBleGFtcGxlLCBhbiBgbmdGb3JgIHdvdWxkIGFjdHVhbGx5IGFwcGx5IHRvIHRoZSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiAoTW9zdFxuICogICAgIGJpbmRpbmdzIG9uIHN0cnVjdHVyYWwgZWxlbWVudHMgdGFyZ2V0IHRoZSBpbm5lciBlbGVtZW50LCBub3QgdGhlIHRlbXBsYXRlLilcbiAqIEBwYXJhbSB0ZW1wbGF0ZUtpbmQgV2hldGhlciB0aGlzIGlzIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAgb3IgYW4gaW1wbGljaXQgdGVtcGxhdGUgY3JlYXRlZCBieVxuICogICAgIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUuIFRoaXMgc2hvdWxkIG5ldmVyIGJlIGEgYmxvY2sgdGVtcGxhdGUuXG4gKiBAcGFyYW0gaTE4bk1lc3NhZ2UgVGhlIGkxOG4gbWV0YWRhdGEgZm9yIHRoZSBiaW5kaW5nLCBpZiBhbnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBUaGUgc291cmNlIHNwYW4gb2YgdGhlIGJpbmRpbmcuXG4gKiBAcmV0dXJucyBBbiBJUiBiaW5kaW5nIG9wLCBvciBudWxsIGlmIHRoZSBiaW5kaW5nIHNob3VsZCBiZSBza2lwcGVkLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUZW1wbGF0ZUJpbmRpbmcoXG4gIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsXG4gIHhyZWY6IGlyLlhyZWZJZCxcbiAgdHlwZTogZS5CaW5kaW5nVHlwZSxcbiAgbmFtZTogc3RyaW5nLFxuICB2YWx1ZTogZS5BU1QgfCBzdHJpbmcsXG4gIHVuaXQ6IHN0cmluZyB8IG51bGwsXG4gIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTogYm9vbGVhbixcbiAgdGVtcGxhdGVLaW5kOiBpci5UZW1wbGF0ZUtpbmQgfCBudWxsLFxuICBpMThuTWVzc2FnZTogaTE4bi5NZXNzYWdlIHwgbnVsbCxcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuKTogaXIuQmluZGluZ09wIHwgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgfCBudWxsIHtcbiAgY29uc3QgaXNUZXh0QmluZGluZyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG4gIC8vIElmIHRoaXMgaXMgYSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLCB0aGVuIHNldmVyYWwga2luZHMgb2YgYmluZGluZ3Mgc2hvdWxkIG5vdCByZXN1bHQgaW4gYW5cbiAgLy8gdXBkYXRlIGluc3RydWN0aW9uLlxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbCkge1xuICAgIGlmICghaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUpIHtcbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIGUuQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICAgIC8vIEJlY2F1c2UgdGhpcyBiaW5kaW5nIGRvZXNuJ3QgcmVhbGx5IHRhcmdldCB0aGUgbmctdGVtcGxhdGUsIGl0IG11c3QgYmUgYSBiaW5kaW5nIG9uIGFuXG4gICAgICAgICAgLy8gaW5uZXIgbm9kZSBvZiBhIHN0cnVjdHVyYWwgdGVtcGxhdGUuIFdlIGNhbid0IHNraXAgaXQgZW50aXJlbHksIGJlY2F1c2Ugd2Ugc3RpbGwgbmVlZFxuICAgICAgICAgIC8vIGl0IG9uIHRoZSBuZy10ZW1wbGF0ZSdzIGNvbnN0cyAoZS5nLiBmb3IgdGhlIHB1cnBvc2VzIG9mIGRpcmVjdGl2ZSBtYXRjaGluZykuIEhvd2V2ZXIsXG4gICAgICAgICAgLy8gd2Ugc2hvdWxkIG5vdCBnZW5lcmF0ZSBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGl0LlxuICAgICAgICAgIHJldHVybiBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgIHhyZWYsXG4gICAgICAgICAgICBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBpMThuTWVzc2FnZSxcbiAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICApO1xuICAgICAgICBjYXNlIGUuQmluZGluZ1R5cGUuVHdvV2F5OlxuICAgICAgICAgIHJldHVybiBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgIHhyZWYsXG4gICAgICAgICAgICBpci5CaW5kaW5nS2luZC5Ud29XYXlQcm9wZXJ0eSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBpMThuTWVzc2FnZSxcbiAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaXNUZXh0QmluZGluZyAmJiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUgfHwgdHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BbmltYXRpb24pKSB7XG4gICAgICAvLyBBZ2FpbiwgdGhpcyBiaW5kaW5nIGRvZXNuJ3QgcmVhbGx5IHRhcmdldCB0aGUgbmctdGVtcGxhdGU7IGl0IGFjdHVhbGx5IHRhcmdldHMgdGhlIGVsZW1lbnRcbiAgICAgIC8vIGluc2lkZSB0aGUgc3RydWN0dXJhbCB0ZW1wbGF0ZS4gSW4gdGhlIGNhc2Ugb2Ygbm9uLXRleHQgYXR0cmlidXRlIG9yIGFuaW1hdGlvbiBiaW5kaW5ncyxcbiAgICAgIC8vIHRoZSBiaW5kaW5nIGRvZXNuJ3QgZXZlbiBzaG93IHVwIG9uIHRoZSBuZy10ZW1wbGF0ZSBjb25zdCBhcnJheSwgc28gd2UganVzdCBza2lwIGl0XG4gICAgICAvLyBlbnRpcmVseS5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGxldCBiaW5kaW5nVHlwZSA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcblxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSkge1xuICAgIC8vIFdlIGtub3cgd2UgYXJlIGRlYWxpbmcgd2l0aCBiaW5kaW5ncyBkaXJlY3RseSBvbiBhbiBleHBsaWNpdCBuZy10ZW1wbGF0ZS5cbiAgICAvLyBTdGF0aWMgYXR0cmlidXRlIGJpbmRpbmdzIHNob3VsZCBiZSBjb2xsZWN0ZWQgaW50byB0aGUgY29uc3QgYXJyYXkgYXMgay92IHBhaXJzLiBQcm9wZXJ0eVxuICAgIC8vIGJpbmRpbmdzIHNob3VsZCByZXN1bHQgaW4gYSBgcHJvcGVydHlgIGluc3RydWN0aW9uLCBhbmQgYEF0dHJpYnV0ZU1hcmtlci5CaW5kaW5nc2AgY29uc3RcbiAgICAvLyBlbnRyaWVzLlxuICAgIC8vXG4gICAgLy8gVGhlIGRpZmZpY3VsdHkgaXMgd2l0aCBkeW5hbWljIGF0dHJpYnV0ZSwgc3R5bGUsIGFuZCBjbGFzcyBiaW5kaW5ncy4gVGhlc2UgZG9uJ3QgcmVhbGx5IG1ha2VcbiAgICAvLyBzZW5zZSBvbiBhbiBgbmctdGVtcGxhdGVgIGFuZCBzaG91bGQgcHJvYmFibHkgYmUgcGFyc2VyIGVycm9ycy4gSG93ZXZlcixcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGdlbmVyYXRlcyBgcHJvcGVydHlgIGluc3RydWN0aW9ucyBmb3IgdGhlbSwgYW5kIHNvIHdlIGRvIHRoYXQgYXNcbiAgICAvLyB3ZWxsLlxuICAgIC8vXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIGhhdmUgYSBzbGlnaHQgYmVoYXZpb3IgZGlmZmVyZW5jZSB3aXRoIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI6IGFsdGhvdWdoXG4gICAgLy8gVERCIGVtaXRzIGBwcm9wZXJ0eWAgaW5zdHJ1Y3Rpb25zIGZvciBkeW5hbWljIGF0dHJpYnV0ZXMsIHN0eWxlcywgYW5kIGNsYXNzZXMsIG9ubHkgc3R5bGVzXG4gICAgLy8gYW5kIGNsYXNzZXMgYWxzbyBnZXQgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3NgIGZpZWxkLiBEeW5hbWljXG4gICAgLy8gYXR0cmlidXRlIGJpbmRpbmdzIGFyZSBtaXNzaW5nIGZyb20gdGhlIGNvbnN0cyBlbnRpcmVseS4gV2UgY2hvb3NlIHRvIGVtaXQgdGhlbSBpbnRvIHRoZVxuICAgIC8vIGNvbnN0cyBmaWVsZCBhbnl3YXksIHRvIGF2b2lkIGNyZWF0aW5nIHNwZWNpYWwgY2FzZXMgZm9yIHNvbWV0aGluZyBzbyBhcmNhbmUgYW5kIG5vbnNlbnNpY2FsLlxuICAgIGlmIChcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQ2xhc3MgfHxcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuU3R5bGUgfHxcbiAgICAgICh0eXBlID09PSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSAmJiAhaXNUZXh0QmluZGluZylcbiAgICApIHtcbiAgICAgIC8vIFRPRE86IFRoZXNlIGNhc2VzIHNob3VsZCBiZSBwYXJzZSBlcnJvcnMuXG4gICAgICBiaW5kaW5nVHlwZSA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgeHJlZixcbiAgICBiaW5kaW5nVHlwZSxcbiAgICBuYW1lLFxuICAgIGNvbnZlcnRBc3RXaXRoSW50ZXJwb2xhdGlvbih2aWV3LmpvYiwgdmFsdWUsIGkxOG5NZXNzYWdlKSxcbiAgICB1bml0LFxuICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICBpc1RleHRCaW5kaW5nLFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLFxuICAgIHRlbXBsYXRlS2luZCxcbiAgICBpMThuTWVzc2FnZSxcbiAgICBzb3VyY2VTcGFuLFxuICApO1xufVxuXG5mdW5jdGlvbiBtYWtlTGlzdGVuZXJIYW5kbGVyT3BzKFxuICB1bml0OiBDb21waWxhdGlvblVuaXQsXG4gIGhhbmRsZXI6IGUuQVNULFxuICBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuKTogaXIuVXBkYXRlT3BbXSB7XG4gIGhhbmRsZXIgPSBhc3RPZihoYW5kbGVyKTtcbiAgY29uc3QgaGFuZGxlck9wcyA9IG5ldyBBcnJheTxpci5VcGRhdGVPcD4oKTtcbiAgbGV0IGhhbmRsZXJFeHByczogZS5BU1RbXSA9IGhhbmRsZXIgaW5zdGFuY2VvZiBlLkNoYWluID8gaGFuZGxlci5leHByZXNzaW9ucyA6IFtoYW5kbGVyXTtcbiAgaWYgKGhhbmRsZXJFeHBycy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGxpc3RlbmVyIHRvIGhhdmUgbm9uLWVtcHR5IGV4cHJlc3Npb24gbGlzdC4nKTtcbiAgfVxuICBjb25zdCBleHByZXNzaW9ucyA9IGhhbmRsZXJFeHBycy5tYXAoKGV4cHIpID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGhhbmRsZXJTcGFuKSk7XG4gIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG4gIGhhbmRsZXJPcHMucHVzaChcbiAgICAuLi5leHByZXNzaW9ucy5tYXAoKGUpID0+XG4gICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4obmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChlLCBlLnNvdXJjZVNwYW4pKSxcbiAgICApLFxuICApO1xuICBoYW5kbGVyT3BzLnB1c2goaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KHJldHVybkV4cHIsIHJldHVybkV4cHIuc291cmNlU3BhbikpKTtcbiAgcmV0dXJuIGhhbmRsZXJPcHM7XG59XG5cbmZ1bmN0aW9uIG1ha2VUd29XYXlMaXN0ZW5lckhhbmRsZXJPcHMoXG4gIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCxcbiAgaGFuZGxlcjogZS5BU1QsXG4gIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4pOiBpci5VcGRhdGVPcFtdIHtcbiAgaGFuZGxlciA9IGFzdE9mKGhhbmRsZXIpO1xuICBjb25zdCBoYW5kbGVyT3BzID0gbmV3IEFycmF5PGlyLlVwZGF0ZU9wPigpO1xuXG4gIGlmIChoYW5kbGVyIGluc3RhbmNlb2YgZS5DaGFpbikge1xuICAgIGlmIChoYW5kbGVyLmV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXIuZXhwcmVzc2lvbnNbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoaXMgaXMgdmFsaWRhdGVkIGR1cmluZyBwYXJzaW5nIGFscmVhZHksIGJ1dCB3ZSBkbyBpdCBoZXJlIGp1c3QgaW4gY2FzZS5cbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdHdvLXdheSBsaXN0ZW5lciB0byBoYXZlIGEgc2luZ2xlIGV4cHJlc3Npb24uJyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaGFuZGxlckV4cHIgPSBjb252ZXJ0QXN0KGhhbmRsZXIsIHVuaXQuam9iLCBoYW5kbGVyU3Bhbik7XG4gIGNvbnN0IGV2ZW50UmVmZXJlbmNlID0gbmV3IGlyLkxleGljYWxSZWFkRXhwcignJGV2ZW50Jyk7XG4gIGNvbnN0IHR3b1dheVNldEV4cHIgPSBuZXcgaXIuVHdvV2F5QmluZGluZ1NldEV4cHIoaGFuZGxlckV4cHIsIGV2ZW50UmVmZXJlbmNlKTtcblxuICBoYW5kbGVyT3BzLnB1c2goaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQodHdvV2F5U2V0RXhwcikpKTtcbiAgaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChldmVudFJlZmVyZW5jZSkpKTtcbiAgcmV0dXJuIGhhbmRsZXJPcHM7XG59XG5cbmZ1bmN0aW9uIGFzdE9mKGFzdDogZS5BU1QgfCBlLkFTVFdpdGhTb3VyY2UpOiBlLkFTVCB7XG4gIHJldHVybiBhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UgPyBhc3QuYXN0IDogYXN0O1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBsb2NhbCByZWZlcmVuY2VzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmRcbiAqIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0UmVmZXJlbmNlcyhvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50IHwgdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICBzcGFuOiBlLlBhcnNlU3BhbixcbiAgYmFzZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGwsXG4pOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsIHtcbiAgaWYgKGJhc2VTb3VyY2VTcGFuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc3RhcnQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIGNvbnN0IGVuZCA9IGJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLmVuZCk7XG4gIGNvbnN0IGZ1bGxTdGFydCA9IGJhc2VTb3VyY2VTcGFuLmZ1bGxTdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQsIGZ1bGxTdGFydCk7XG59XG5cbi8qKlxuICogV2l0aCB0aGUgZGlyZWN0aXZlLWJhc2VkIGNvbnRyb2wgZmxvdyB1c2VycyB3ZXJlIGFibGUgdG8gY29uZGl0aW9uYWxseSBwcm9qZWN0IGNvbnRlbnQgdXNpbmdcbiAqIHRoZSBgKmAgc3ludGF4LiBFLmcuIGA8ZGl2ICpuZ0lmPVwiZXhwclwiIHByb2plY3RNZT48L2Rpdj5gIHdpbGwgYmUgcHJvamVjdGVkIGludG9cbiAqIGA8bmctY29udGVudCBzZWxlY3Q9XCJbcHJvamVjdE1lXVwiLz5gLCBiZWNhdXNlIHRoZSBhdHRyaWJ1dGVzIGFuZCB0YWcgbmFtZSBmcm9tIHRoZSBgZGl2YCBhcmVcbiAqIGNvcGllZCB0byB0aGUgdGVtcGxhdGUgdmlhIHRoZSB0ZW1wbGF0ZSBjcmVhdGlvbiBpbnN0cnVjdGlvbi4gV2l0aCBgQGlmYCBhbmQgYEBmb3JgIHRoYXQgaXNcbiAqIG5vdCB0aGUgY2FzZSwgYmVjYXVzZSB0aGUgY29uZGl0aW9uYWwgaXMgcGxhY2VkICphcm91bmQqIGVsZW1lbnRzLCByYXRoZXIgdGhhbiAqb24qIHRoZW0uXG4gKiBUaGUgcmVzdWx0IGlzIHRoYXQgY29udGVudCBwcm9qZWN0aW9uIHdvbid0IHdvcmsgaW4gdGhlIHNhbWUgd2F5IGlmIGEgdXNlciBjb252ZXJ0cyBmcm9tXG4gKiBgKm5nSWZgIHRvIGBAaWZgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gYWltcyB0byBjb3ZlciB0aGUgbW9zdCBjb21tb24gY2FzZSBieSBkb2luZyB0aGUgc2FtZSBjb3B5aW5nIHdoZW4gYSBjb250cm9sIGZsb3dcbiAqIG5vZGUgaGFzICpvbmUgYW5kIG9ubHkgb25lKiByb290IGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZS5cbiAqXG4gKiBUaGlzIGFwcHJvYWNoIGNvbWVzIHdpdGggc29tZSBjYXZlYXRzOlxuICogMS4gQXMgc29vbiBhcyBhbnkgb3RoZXIgbm9kZSBpcyBhZGRlZCB0byB0aGUgcm9vdCwgdGhlIGNvcHlpbmcgYmVoYXZpb3Igd29uJ3Qgd29yayBhbnltb3JlLlxuICogICAgQSBkaWFnbm9zdGljIHdpbGwgYmUgYWRkZWQgdG8gZmxhZyBjYXNlcyBsaWtlIHRoaXMgYW5kIHRvIGV4cGxhaW4gaG93IHRvIHdvcmsgYXJvdW5kIGl0LlxuICogMi4gSWYgYHByZXNlcnZlV2hpdGVzcGFjZXNgIGlzIGVuYWJsZWQsIGl0J3MgdmVyeSBsaWtlbHkgdGhhdCBpbmRlbnRhdGlvbiB3aWxsIGJyZWFrIHRoaXNcbiAqICAgIHdvcmthcm91bmQsIGJlY2F1c2UgaXQnbGwgaW5jbHVkZSBhbiBhZGRpdGlvbmFsIHRleHQgbm9kZSBhcyB0aGUgZmlyc3QgY2hpbGQuIFdlIGNhbiB3b3JrXG4gKiAgICBhcm91bmQgaXQgaGVyZSwgYnV0IGluIGEgZGlzY3Vzc2lvbiBpdCB3YXMgZGVjaWRlZCBub3QgdG8sIGJlY2F1c2UgdGhlIHVzZXIgZXhwbGljaXRseSBvcHRlZFxuICogICAgaW50byBwcmVzZXJ2aW5nIHRoZSB3aGl0ZXNwYWNlIGFuZCB3ZSB3b3VsZCBoYXZlIHRvIGRyb3AgaXQgZnJvbSB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKiAgICBUaGUgZGlhZ25vc3RpYyBtZW50aW9uZWQgcG9pbnQgIzEgd2lsbCBmbGFnIHN1Y2ggY2FzZXMgdG8gdXNlcnMuXG4gKlxuICogQHJldHVybnMgVGFnIG5hbWUgdG8gYmUgdXNlZCBmb3IgdGhlIGNvbnRyb2wgZmxvdyB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludChcbiAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCxcbiAgeHJlZjogaXIuWHJlZklkLFxuICBub2RlOiB0LklmQmxvY2tCcmFuY2ggfCB0LlN3aXRjaEJsb2NrQ2FzZSB8IHQuRm9yTG9vcEJsb2NrIHwgdC5Gb3JMb29wQmxvY2tFbXB0eSxcbik6IHN0cmluZyB8IG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50IHwgdC5UZW1wbGF0ZSB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgIC8vIFNraXAgb3ZlciBjb21tZW50IG5vZGVzLlxuICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuQ29tbWVudCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gV2UgY2FuIG9ubHkgaW5mZXIgdGhlIHRhZyBuYW1lL2F0dHJpYnV0ZXMgaWYgdGhlcmUncyBhIHNpbmdsZSByb290IG5vZGUuXG4gICAgaWYgKHJvb3QgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFJvb3Qgbm9kZXMgY2FuIG9ubHkgZWxlbWVudHMgb3IgdGVtcGxhdGVzIHdpdGggYSB0YWcgbmFtZSAoZS5nLiBgPGRpdiAqZm9vPjwvZGl2PmApLlxuICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuRWxlbWVudCB8fCAoY2hpbGQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGNoaWxkLnRhZ05hbWUgIT09IG51bGwpKSB7XG4gICAgICByb290ID0gY2hpbGQ7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgd2UndmUgZm91bmQgYSBzaW5nbGUgcm9vdCBub2RlLCBpdHMgdGFnIG5hbWUgYW5kIGF0dHJpYnV0ZXMgY2FuIGJlXG4gIC8vIGNvcGllZCB0byB0aGUgc3Vycm91bmRpbmcgdGVtcGxhdGUgdG8gYmUgdXNlZCBmb3IgY29udGVudCBwcm9qZWN0aW9uLlxuICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgIC8vIENvbGxlY3QgdGhlIHN0YXRpYyBhdHRyaWJ1dGVzIGZvciBjb250ZW50IHByb2plY3Rpb24gcHVycG9zZXMuXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIHJvb3QuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICAgIHVuaXQudXBkYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgICB4cmVmLFxuICAgICAgICAgIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSxcbiAgICAgICAgICBhdHRyLm5hbWUsXG4gICAgICAgICAgby5saXRlcmFsKGF0dHIudmFsdWUpLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgbnVsbCxcbiAgICAgICAgICBhc01lc3NhZ2UoYXR0ci5pMThuKSxcbiAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4sXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEFsc28gY29sbGVjdCB0aGUgaW5wdXRzIHNpbmNlIHRoZXkgcGFydGljaXBhdGUgaW4gY29udGVudCBwcm9qZWN0aW9uIGFzIHdlbGwuXG4gICAgLy8gTm90ZSB0aGF0IFREQiB1c2VkIHRvIGNvbGxlY3QgdGhlIG91dHB1dHMgYXMgd2VsbCwgYnV0IGl0IHdhc24ndCBwYXNzaW5nIHRoZW0gaW50b1xuICAgIC8vIHRoZSB0ZW1wbGF0ZSBpbnN0cnVjdGlvbi4gSGVyZSB3ZSBqdXN0IGRvbid0IGNvbGxlY3QgdGhlbS5cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygcm9vdC5pbnB1dHMpIHtcbiAgICAgIGlmIChhdHRyLnR5cGUgIT09IGUuQmluZGluZ1R5cGUuQW5pbWF0aW9uICYmIGF0dHIudHlwZSAhPT0gZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICAgICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgIHhyZWYsXG4gICAgICAgICAgICBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBhdHRyLm5hbWUsXG4gICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcblxuICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICByZXR1cm4gdGFnTmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUgPyBudWxsIDogdGFnTmFtZTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIl19