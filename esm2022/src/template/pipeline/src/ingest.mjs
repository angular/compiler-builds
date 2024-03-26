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
import { ComponentCompilationJob, HostBindingCompilationJob } from './compilation';
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
            .filter(context => context !== SecurityContext.NONE);
        ingestHostProperty(job, property, bindingKind, securityContexts);
    }
    for (const [name, expr] of Object.entries(input.attributes) ?? []) {
        const securityContexts = bindingParser.calcPossibleSecurityContexts(input.componentSelector, name, true)
            .filter(context => context !== SecurityContext.NONE);
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
        expression = new ir.Interpolation(ast.strings, ast.expressions.map(expr => convertAst(expr, job, property.sourceSpan)), []);
    }
    else {
        expression = convertAst(ast, job, property.sourceSpan);
    }
    job.root.update.push(ir.createBindingOp(job.root.xref, bindingKind, property.name, expression, null, securityContexts, false, false, null, /* TODO: How do Host bindings handle i18n attrs? */ null, property.sourceSpan));
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
    const [phase, target] = event.type !== e.ParsedEventType.Animation ? [null, event.targetOrPhase] :
        [event.targetOrPhase, null];
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
    const functionNameSuffix = tagNameWithoutNamespace === null ?
        '' :
        prefixWithNamespace(tagNameWithoutNamespace, namespace);
    const templateKind = isPlainTemplate(tmpl) ? ir.TemplateKind.NgTemplate : ir.TemplateKind.Structural;
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
    if (content.children.some(child => !(child instanceof t.Comment) &&
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
    const i18nPlaceholders = text.i18n instanceof i18n.Container ?
        text.i18n.children
            .filter((node) => node instanceof i18n.Placeholder)
            .map(placeholder => placeholder.name) :
        [];
    if (i18nPlaceholders.length > 0 && i18nPlaceholders.length !== value.expressions.length) {
        throw Error(`Unexpected number of i18n placeholders (${value.expressions.length}) for BoundText with ${value.expressions.length} expressions`);
    }
    const textXref = unit.job.allocateXrefId();
    unit.create.push(ir.createTextOp(textXref, '', icuPlaceholder, text.sourceSpan));
    // TemplateDefinitionBuilder does not generate source maps for sub-expressions inside an
    // interpolation. We copy that behavior in compatibility mode.
    // TODO: is it actually correct to generate these extra maps in modern mode?
    const baseSourceSpan = unit.job.compatibility ? null : text.sourceSpan;
    unit.update.push(ir.createInterpolateTextOp(textXref, new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, unit.job, baseSourceSpan)), i18nPlaceholders), text.sourceSpan));
}
/**
 * Ingest an `@if` block into the given `ViewCompilation`.
 */
function ingestIfBlock(unit, ifBlock) {
    let firstXref = null;
    let firstSlotHandle = null;
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
            firstSlotHandle = templateOp.handle;
        }
        const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle, ifCase.expressionAlias);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, ifCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, firstSlotHandle, null, conditions, ifBlock.sourceSpan);
    unit.update.push(conditional);
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
    let firstSlotHandle = null;
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
            firstSlotHandle = templateOp.handle;
        }
        const caseExpr = switchCase.expression ?
            convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan) :
            null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, switchCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, firstSlotHandle, convertAst(switchBlock.expression, unit.job, null), conditions, switchBlock.sourceSpan);
    unit.update.push(conditional);
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
                expression: getComputedForLoopVariableExpression(variable, indexName, countName)
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
            return new o.InvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map(arg => convertAst(arg, job, baseSourceSpan)), undefined, convertSourceSpan(ast.span, baseSourceSpan));
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
        return new o.LiteralArrayExpr(ast.expressions.map(expr => convertAst(expr, job, baseSourceSpan)));
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
            ...ast.args.map(arg => convertAst(arg, job, baseSourceSpan)),
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
        return new ir.SafeInvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map(a => convertAst(a, job, baseSourceSpan)));
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
        expression = new ir.Interpolation(value.strings, value.expressions.map(e => convertAst(e, job, sourceSpan ?? null)), Object.keys(asMessage(i18nMeta)?.placeholders ?? {}));
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
            console.error(`On component ${unit.job.componentName}, the binding ${input
                .name} is both an i18n attribute and a property. You may want to remove the property binding. This will become a compilation error in future versions of Angular.`);
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
    if (bindings.some(b => b?.i18nMessage) !== null) {
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
    if (bindings.some(b => b?.i18nMessage) !== null) {
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
        if (type === e.BindingType.Class || type === e.BindingType.Style ||
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
    const expressions = handlerExprs.map(expr => convertAst(expr, unit.job, handlerSpan));
    const returnExpr = expressions.pop();
    handlerOps.push(...expressions.map(e => ir.createStatementOp(new o.ExpressionStatement(e, e.sourceSpan))));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDbkUsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFFckYsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFrQix1QkFBdUIsRUFBRSx5QkFBeUIsRUFBZ0QsTUFBTSxlQUFlLENBQUM7QUFDakosT0FBTyxFQUFDLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVwRixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQztBQUV6RSx1REFBdUQ7QUFDdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSx3QkFBd0IsRUFBRSxDQUFDO0FBRWpELHlDQUF5QztBQUN6QyxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztBQUUzQyxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQW9CO0lB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QyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFFRCxnRkFBZ0Y7UUFDaEYscUZBQXFGO1FBQ3JGLDZEQUE2RDtRQUM3RCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNuRixNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQywwQkFBMEIsQ0FDMUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7WUFDMUYsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUVyRSwrRUFBK0U7UUFDL0UsT0FBTyxPQUFPLEtBQUssb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQzNELENBQUM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgZSBmcm9tICcuLi8uLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQge0RlZmVyQmxvY2tEZXBzRW1pdE1vZGUsIFIzQ29tcG9uZW50RGVmZXJNZXRhZGF0YX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQge2ljdUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmltcG9ydCB7Q29tcGlsYXRpb25Vbml0LCBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7QklOQVJZX09QRVJBVE9SUywgbmFtZXNwYWNlRm9yS2V5LCBwcmVmaXhXaXRoTmFtZXNwYWNlfSBmcm9tICcuL2NvbnZlcnNpb24nO1xuXG5jb25zdCBjb21wYXRpYmlsaXR5TW9kZSA9IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI7XG5cbi8vIFNjaGVtYSBjb250YWluaW5nIERPTSBlbGVtZW50cyBhbmQgdGhlaXIgcHJvcGVydGllcy5cbmNvbnN0IGRvbVNjaGVtYSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuLy8gVGFnIG5hbWUgb2YgdGhlIGBuZy10ZW1wbGF0ZWAgZWxlbWVudC5cbmNvbnN0IE5HX1RFTVBMQVRFX1RBR19OQU1FID0gJ25nLXRlbXBsYXRlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSTE4blJvb3ROb2RlKG1ldGE/OiBpMThuLkkxOG5NZXRhKTogbWV0YSBpcyBpMThuLk1lc3NhZ2Uge1xuICByZXR1cm4gbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2luZ2xlSTE4bkljdShtZXRhPzogaTE4bi5JMThuTWV0YSk6IG1ldGEgaXMgaTE4bi5JMThuTWV0YSZ7bm9kZXM6IFtpMThuLkljdV19IHtcbiAgcmV0dXJuIGlzSTE4blJvb3ROb2RlKG1ldGEpICYmIG1ldGEubm9kZXMubGVuZ3RoID09PSAxICYmIG1ldGEubm9kZXNbMF0gaW5zdGFuY2VvZiBpMThuLkljdTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICogVE9ETzogUmVmYWN0b3IgbW9yZSBvZiB0aGUgaW5nZXN0aW9uIGNvZGUgaW50byBwaGFzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RDb21wb25lbnQoXG4gICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCB0ZW1wbGF0ZTogdC5Ob2RlW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICBkZWZlck1ldGE6IFIzQ29tcG9uZW50RGVmZXJNZXRhZGF0YSxcbiAgICBhbGxEZWZlcnJhYmxlRGVwc0ZuOiBvLlJlYWRWYXJFeHByfG51bGwpOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGpvYiA9IG5ldyBDb21wb25lbnRDb21waWxhdGlvbkpvYihcbiAgICAgIGNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBpMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgICBkZWZlck1ldGEsIGFsbERlZmVycmFibGVEZXBzRm4pO1xuICBpbmdlc3ROb2Rlcyhqb2Iucm9vdCwgdGVtcGxhdGUpO1xuICByZXR1cm4gam9iO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhvc3RCaW5kaW5nSW5wdXQge1xuICBjb21wb25lbnROYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudFNlbGVjdG9yOiBzdHJpbmc7XG4gIHByb3BlcnRpZXM6IGUuUGFyc2VkUHJvcGVydHlbXXxudWxsO1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcbiAgZXZlbnRzOiBlLlBhcnNlZEV2ZW50W118bnVsbDtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgaG9zdCBiaW5kaW5nIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2JgIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEJpbmRpbmcoXG4gICAgaW5wdXQ6IEhvc3RCaW5kaW5nSW5wdXQsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IoaW5wdXQuY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSk7XG4gIGZvciAoY29uc3QgcHJvcGVydHkgb2YgaW5wdXQucHJvcGVydGllcyA/PyBbXSkge1xuICAgIGxldCBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIHJlYWxseSBiZSBoYW5kbGVkIGluIHRoZSBwYXJzZXIuXG4gICAgaWYgKHByb3BlcnR5Lm5hbWUuc3RhcnRzV2l0aCgnYXR0ci4nKSkge1xuICAgICAgcHJvcGVydHkubmFtZSA9IHByb3BlcnR5Lm5hbWUuc3Vic3RyaW5nKCdhdHRyLicubGVuZ3RoKTtcbiAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlO1xuICAgIH1cbiAgICBpZiAocHJvcGVydHkuaXNBbmltYXRpb24pIHtcbiAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uO1xuICAgIH1cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgYmluZGluZ1BhcnNlclxuICAgICAgICAgICAgLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgICAgICAgICAgaW5wdXQuY29tcG9uZW50U2VsZWN0b3IsIHByb3BlcnR5Lm5hbWUsIGJpbmRpbmdLaW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUpXG4gICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuICAgIGluZ2VzdEhvc3RQcm9wZXJ0eShqb2IsIHByb3BlcnR5LCBiaW5kaW5nS2luZCwgc2VjdXJpdHlDb250ZXh0cyk7XG4gIH1cbiAgZm9yIChjb25zdCBbbmFtZSwgZXhwcl0gb2YgT2JqZWN0LmVudHJpZXMoaW5wdXQuYXR0cmlidXRlcykgPz8gW10pIHtcbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgYmluZGluZ1BhcnNlci5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKGlucHV0LmNvbXBvbmVudFNlbGVjdG9yLCBuYW1lLCB0cnVlKVxuICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IFNlY3VyaXR5Q29udGV4dC5OT05FKTtcbiAgICBpbmdlc3RIb3N0QXR0cmlidXRlKGpvYiwgbmFtZSwgZXhwciwgc2VjdXJpdHlDb250ZXh0cyk7XG4gIH1cbiAgZm9yIChjb25zdCBldmVudCBvZiBpbnB1dC5ldmVudHMgPz8gW10pIHtcbiAgICBpbmdlc3RIb3N0RXZlbnQoam9iLCBldmVudCk7XG4gIH1cbiAgcmV0dXJuIGpvYjtcbn1cblxuLy8gVE9ETzogV2Ugc2hvdWxkIHJlZmFjdG9yIHRoZSBwYXJzZXIgdG8gdXNlIHRoZSBzYW1lIHR5cGVzIGFuZCBzdHJ1Y3R1cmVzIGZvciBob3N0IGJpbmRpbmdzIGFzXG4vLyB3aXRoIG9yZGluYXJ5IGNvbXBvbmVudHMuIFRoaXMgd291bGQgYWxsb3cgdXMgdG8gc2hhcmUgYSBsb3QgbW9yZSBpbmdlc3Rpb24gY29kZS5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0UHJvcGVydHkoXG4gICAgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBwcm9wZXJ0eTogZS5QYXJzZWRQcm9wZXJ0eSwgYmluZGluZ0tpbmQ6IGlyLkJpbmRpbmdLaW5kLFxuICAgIHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdKTogdm9pZCB7XG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258aXIuSW50ZXJwb2xhdGlvbjtcbiAgY29uc3QgYXN0ID0gcHJvcGVydHkuZXhwcmVzc2lvbi5hc3Q7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIGFzdC5zdHJpbmdzLCBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pKSwgW10pO1xuICB9IGVsc2Uge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KGFzdCwgam9iLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKTtcbiAgfVxuICBqb2Iucm9vdC51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBiaW5kaW5nS2luZCwgcHJvcGVydHkubmFtZSwgZXhwcmVzc2lvbiwgbnVsbCwgc2VjdXJpdHlDb250ZXh0cywgZmFsc2UsIGZhbHNlLFxuICAgICAgbnVsbCwgLyogVE9ETzogSG93IGRvIEhvc3QgYmluZGluZ3MgaGFuZGxlIGkxOG4gYXR0cnM/ICovIG51bGwsIHByb3BlcnR5LnNvdXJjZVNwYW4pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RBdHRyaWJ1dGUoXG4gICAgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb24sXG4gICAgc2VjdXJpdHlDb250ZXh0czogU2VjdXJpdHlDb250ZXh0W10pOiB2b2lkIHtcbiAgY29uc3QgYXR0ckJpbmRpbmcgPSBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIG5hbWUsIHZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHRzLFxuICAgICAgLyogSG9zdCBhdHRyaWJ1dGVzIHNob3VsZCBhbHdheXMgYmUgZXh0cmFjdGVkIHRvIGNvbnN0IGhvc3RBdHRycywgZXZlbiBpZiB0aGV5IGFyZSBub3RcbiAgICAgICAqc3RyaWN0bHkqIHRleHQgbGl0ZXJhbHMgKi9cbiAgICAgIHRydWUsIGZhbHNlLCBudWxsLFxuICAgICAgLyogVE9ETyAqLyBudWxsLFxuICAgICAgLyoqIFRPRE86IE1heSBiZSBudWxsPyAqLyB2YWx1ZS5zb3VyY2VTcGFuISk7XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGF0dHJCaW5kaW5nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RFdmVudChqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIGV2ZW50OiBlLlBhcnNlZEV2ZW50KSB7XG4gIGNvbnN0IFtwaGFzZSwgdGFyZ2V0XSA9IGV2ZW50LnR5cGUgIT09IGUuUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IFtudWxsLCBldmVudC50YXJnZXRPclBoYXNlXSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtldmVudC50YXJnZXRPclBoYXNlLCBudWxsXTtcbiAgY29uc3QgZXZlbnRCaW5kaW5nID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIG5ldyBpci5TbG90SGFuZGxlKCksIGV2ZW50Lm5hbWUsIG51bGwsXG4gICAgICBtYWtlTGlzdGVuZXJIYW5kbGVyT3BzKGpvYi5yb290LCBldmVudC5oYW5kbGVyLCBldmVudC5oYW5kbGVyU3BhbiksIHBoYXNlLCB0YXJnZXQsIHRydWUsXG4gICAgICBldmVudC5zb3VyY2VTcGFuKTtcbiAgam9iLnJvb3QuY3JlYXRlLnB1c2goZXZlbnRCaW5kaW5nKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgdGhlIG5vZGVzIG9mIGEgdGVtcGxhdGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3ROb2Rlcyh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZW1wbGF0ZTogdC5Ob2RlW10pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBub2RlIG9mIHRlbXBsYXRlKSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIGluZ2VzdEVsZW1lbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgICAgaW5nZXN0VGVtcGxhdGUodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Db250ZW50KSB7XG4gICAgICBpbmdlc3RDb250ZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgaW5nZXN0VGV4dCh1bml0LCBub2RlLCBudWxsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIG5vZGUsIG51bGwpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWZCbG9jaykge1xuICAgICAgaW5nZXN0SWZCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlN3aXRjaEJsb2NrKSB7XG4gICAgICBpbmdlc3RTd2l0Y2hCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkRlZmVycmVkQmxvY2spIHtcbiAgICAgIGluZ2VzdERlZmVyQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JY3UpIHtcbiAgICAgIGluZ2VzdEljdSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkZvckxvb3BCbG9jaykge1xuICAgICAgaW5nZXN0Rm9yQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZTogJHtub2RlLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGVsZW1lbnQgQVNUIGZyb20gdGhlIHRlbXBsYXRlIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RFbGVtZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGVsZW1lbnQ6IHQuRWxlbWVudCk6IHZvaWQge1xuICBpZiAoZWxlbWVudC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGVsZW1lbnQ6ICR7ZWxlbWVudC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG5cbiAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcblxuICBjb25zdCBzdGFydE9wID0gaXIuY3JlYXRlRWxlbWVudFN0YXJ0T3AoXG4gICAgICBlbGVtZW50TmFtZSwgaWQsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VLZXkpLFxuICAgICAgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IGVsZW1lbnQuaTE4biA6IHVuZGVmaW5lZCxcbiAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHN0YXJ0T3ApO1xuXG4gIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyh1bml0LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcblxuICAvLyBTdGFydCBpMThuLCBpZiBuZWVkZWQsIGdvZXMgYWZ0ZXIgdGhlIGVsZW1lbnQgY3JlYXRlIGFuZCBiaW5kaW5ncywgYnV0IGJlZm9yZSB0aGUgbm9kZXNcbiAgbGV0IGkxOG5CbG9ja0lkOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGlmIChlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBpMThuQmxvY2tJZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaTE4bkJsb2NrSWQsIGVsZW1lbnQuaTE4biwgdW5kZWZpbmVkLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbikpO1xuICB9XG5cbiAgaW5nZXN0Tm9kZXModW5pdCwgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgLy8gVGhlIHNvdXJjZSBzcGFuIGZvciB0aGUgZW5kIG9wIGlzIHR5cGljYWxseSB0aGUgZWxlbWVudCBjbG9zaW5nIHRhZy4gSG93ZXZlciwgaWYgbm8gY2xvc2luZyB0YWdcbiAgLy8gZXhpc3RzLCBzdWNoIGFzIGluIGA8aW5wdXQ+YCwgd2UgdXNlIHRoZSBzdGFydCBzb3VyY2Ugc3BhbiBpbnN0ZWFkLiBVc3VhbGx5IHRoZSBzdGFydCBhbmQgZW5kXG4gIC8vIGluc3RydWN0aW9ucyB3aWxsIGJlIGNvbGxhcHNlZCBpbnRvIG9uZSBgZWxlbWVudGAgaW5zdHJ1Y3Rpb24sIG5lZ2F0aW5nIHRoZSBwdXJwb3NlIG9mIHRoaXNcbiAgLy8gZmFsbGJhY2ssIGJ1dCBpbiBjYXNlcyB3aGVuIGl0IGlzIG5vdCBjb2xsYXBzZWQgKHN1Y2ggYXMgYW4gaW5wdXQgd2l0aCBhIGJpbmRpbmcpLCB3ZSBzdGlsbFxuICAvLyB3YW50IHRvIG1hcCB0aGUgZW5kIGluc3RydWN0aW9uIHRvIHRoZSBtYWluIGVsZW1lbnQuXG4gIGNvbnN0IGVuZE9wID0gaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKGVuZE9wKTtcblxuICAvLyBJZiB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudCwgaW5zZXJ0IGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gIGlmIChpMThuQmxvY2tJZCAhPT0gbnVsbCkge1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICBpci5jcmVhdGVJMThuRW5kT3AoaTE4bkJsb2NrSWQsIGVsZW1lbnQuZW5kU291cmNlU3BhbiA/PyBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiksIGVuZE9wKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgbmctdGVtcGxhdGVgIG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZW1wbGF0ZSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0bXBsOiB0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGlmICh0bXBsLmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgISh0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgfHwgdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGVtcGxhdGU6ICR7dG1wbC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICBsZXQgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPSB0bXBsLnRhZ05hbWU7XG4gIGxldCBuYW1lc3BhY2VQcmVmaXg6IHN0cmluZ3xudWxsID0gJyc7XG4gIGlmICh0bXBsLnRhZ05hbWUpIHtcbiAgICBbbmFtZXNwYWNlUHJlZml4LCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZV0gPSBzcGxpdE5zTmFtZSh0bXBsLnRhZ05hbWUpO1xuICB9XG5cbiAgY29uc3QgaTE4blBsYWNlaG9sZGVyID0gdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IHRtcGwuaTE4biA6IHVuZGVmaW5lZDtcbiAgY29uc3QgbmFtZXNwYWNlID0gbmFtZXNwYWNlRm9yS2V5KG5hbWVzcGFjZVByZWZpeCk7XG4gIGNvbnN0IGZ1bmN0aW9uTmFtZVN1ZmZpeCA9IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID09PSBudWxsID9cbiAgICAgICcnIDpcbiAgICAgIHByZWZpeFdpdGhOYW1lc3BhY2UodGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIG5hbWVzcGFjZSk7XG4gIGNvbnN0IHRlbXBsYXRlS2luZCA9XG4gICAgICBpc1BsYWluVGVtcGxhdGUodG1wbCkgPyBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSA6IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsO1xuICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgIGNoaWxkVmlldy54cmVmLCB0ZW1wbGF0ZUtpbmQsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBmdW5jdGlvbk5hbWVTdWZmaXgsIG5hbWVzcGFjZSxcbiAgICAgIGkxOG5QbGFjZWhvbGRlciwgdG1wbC5zdGFydFNvdXJjZVNwYW4sIHRtcGwuc291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2godGVtcGxhdGVPcCk7XG5cbiAgaW5nZXN0VGVtcGxhdGVCaW5kaW5ncyh1bml0LCB0ZW1wbGF0ZU9wLCB0bXBsLCB0ZW1wbGF0ZUtpbmQpO1xuICBpbmdlc3RSZWZlcmVuY2VzKHRlbXBsYXRlT3AsIHRtcGwpO1xuICBpbmdlc3ROb2RlcyhjaGlsZFZpZXcsIHRtcGwuY2hpbGRyZW4pO1xuXG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiB0bXBsLnZhcmlhYmxlcykge1xuICAgIGNoaWxkVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChuYW1lLCB2YWx1ZSAhPT0gJycgPyB2YWx1ZSA6ICckaW1wbGljaXQnKTtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSBwbGFpbiB0ZW1wbGF0ZSBhbmQgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCBpdCwgaW5zZXJ0IGkxOG4gc3RhcnRcbiAgLy8gYW5kIGVuZCBvcHMuIEZvciBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZXMsIHRoZSBpMThuIG9wcyB3aWxsIGJlIGFkZGVkIHdoZW4gaW5nZXN0aW5nIHRoZVxuICAvLyBlbGVtZW50L3RlbXBsYXRlIHRoZSBkaXJlY3RpdmUgaXMgcGxhY2VkIG9uLlxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSAmJiB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyKFxuICAgICAgICBpci5jcmVhdGVJMThuU3RhcnRPcChpZCwgdG1wbC5pMThuLCB1bmRlZmluZWQsIHRtcGwuc3RhcnRTb3VyY2VTcGFuKSxcbiAgICAgICAgY2hpbGRWaWV3LmNyZWF0ZS5oZWFkKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKFxuICAgICAgICBpci5jcmVhdGVJMThuRW5kT3AoaWQsIHRtcGwuZW5kU291cmNlU3BhbiA/PyB0bXBsLnN0YXJ0U291cmNlU3BhbiksIGNoaWxkVmlldy5jcmVhdGUudGFpbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBjb250ZW50IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBpZiAoY29udGVudC5pMThuICE9PSB1bmRlZmluZWQgJiYgIShjb250ZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2NvbnRlbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICBsZXQgZmFsbGJhY2tWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0fG51bGwgPSBudWxsO1xuXG4gIC8vIERvbid0IGNhcHR1cmUgZGVmYXVsdCBjb250ZW50IHRoYXQncyBvbmx5IG1hZGUgdXAgb2YgZW1wdHkgdGV4dCBub2RlcyBhbmQgY29tbWVudHMuXG4gIGlmIChjb250ZW50LmNoaWxkcmVuLnNvbWUoXG4gICAgICAgICAgY2hpbGQgPT4gIShjaGlsZCBpbnN0YW5jZW9mIHQuQ29tbWVudCkgJiZcbiAgICAgICAgICAgICAgKCEoY2hpbGQgaW5zdGFuY2VvZiB0LlRleHQpIHx8IGNoaWxkLnZhbHVlLnRyaW0oKS5sZW5ndGggPiAwKSkpIHtcbiAgICBmYWxsYmFja1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhmYWxsYmFja1ZpZXcsIGNvbnRlbnQuY2hpbGRyZW4pO1xuICB9XG5cbiAgY29uc3Qgb3AgPSBpci5jcmVhdGVQcm9qZWN0aW9uT3AoXG4gICAgICBpZCwgY29udGVudC5zZWxlY3RvciwgY29udGVudC5pMThuLCBmYWxsYmFja1ZpZXc/LnhyZWYgPz8gbnVsbCwgY29udGVudC5zb3VyY2VTcGFuKTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGNvbnRlbnQuYXR0cmlidXRlcykge1xuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoY29udGVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgIHRydWUsIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cbiAgdW5pdC5jcmVhdGUucHVzaChvcCk7XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZXh0KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuVGV4dCwgaWN1UGxhY2Vob2xkZXI6IHN0cmluZ3xudWxsKTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICBpci5jcmVhdGVUZXh0T3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSwgaWN1UGxhY2Vob2xkZXIsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpY3VQbGFjZWhvbGRlcjogc3RyaW5nfG51bGwpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlcnMgPSB0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lciA/XG4gICAgICB0ZXh0LmkxOG4uY2hpbGRyZW5cbiAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgIC5tYXAocGxhY2Vob2xkZXIgPT4gcGxhY2Vob2xkZXIubmFtZSkgOlxuICAgICAgW107XG4gIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCA+IDAgJiYgaTE4blBsYWNlaG9sZGVycy5sZW5ndGggIT09IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIG51bWJlciBvZiBpMThuIHBsYWNlaG9sZGVycyAoJHtcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2ApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIGljdVBsYWNlaG9sZGVyLCB0ZXh0LnNvdXJjZVNwYW4pKTtcbiAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdCBnZW5lcmF0ZSBzb3VyY2UgbWFwcyBmb3Igc3ViLWV4cHJlc3Npb25zIGluc2lkZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLiBXZSBjb3B5IHRoYXQgYmVoYXZpb3IgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAvLyBUT0RPOiBpcyBpdCBhY3R1YWxseSBjb3JyZWN0IHRvIGdlbmVyYXRlIHRoZXNlIGV4dHJhIG1hcHMgaW4gbW9kZXJuIG1vZGU/XG4gIGNvbnN0IGJhc2VTb3VyY2VTcGFuID0gdW5pdC5qb2IuY29tcGF0aWJpbGl0eSA/IG51bGwgOiB0ZXh0LnNvdXJjZVNwYW47XG4gIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVUZXh0T3AoXG4gICAgICB0ZXh0WHJlZixcbiAgICAgIG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgICAgaTE4blBsYWNlaG9sZGVycyksXG4gICAgICB0ZXh0LnNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBpZmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdElmQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWZCbG9jazogdC5JZkJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaWZCbG9jay5icmFuY2hlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGlmQ2FzZSA9IGlmQmxvY2suYnJhbmNoZXNbaV07XG4gICAgY29uc3QgY1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBjb25zdCB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCBjVmlldy54cmVmLCBpZkNhc2UpO1xuXG4gICAgaWYgKGlmQ2FzZS5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGNWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGlmQ2FzZS5leHByZXNzaW9uQWxpYXMubmFtZSwgaXIuQ1RYX1JFRik7XG4gICAgfVxuXG4gICAgbGV0IGlmQ2FzZUkxOG5NZXRhOiBpMThuLkJsb2NrUGxhY2Vob2xkZXJ8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChpZkNhc2UuaTE4biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIShpZkNhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGlmIGJsb2NrOiAke2lmQ2FzZS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgICAgfVxuICAgICAgaWZDYXNlSTE4bk1ldGEgPSBpZkNhc2UuaTE4bjtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLCB0YWdOYW1lLCAnQ29uZGl0aW9uYWwnLCBpci5OYW1lc3BhY2UuSFRNTCxcbiAgICAgICAgaWZDYXNlSTE4bk1ldGEsIGlmQ2FzZS5zdGFydFNvdXJjZVNwYW4sIGlmQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRlbXBsYXRlT3AuaGFuZGxlO1xuICAgIH1cblxuICAgIGNvbnN0IGNhc2VFeHByID0gaWZDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KGlmQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCkgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPSBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihcbiAgICAgICAgY2FzZUV4cHIsIHRlbXBsYXRlT3AueHJlZiwgdGVtcGxhdGVPcC5oYW5kbGUsIGlmQ2FzZS5leHByZXNzaW9uQWxpYXMpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgaWZDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9XG4gICAgICBpci5jcmVhdGVDb25kaXRpb25hbE9wKGZpcnN0WHJlZiEsIGZpcnN0U2xvdEhhbmRsZSEsIG51bGwsIGNvbmRpdGlvbnMsIGlmQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQHN3aXRjaGAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIC8vIERvbid0IGluZ2VzdCBlbXB0eSBzd2l0Y2hlcyBzaW5jZSB0aGV5IHdvbid0IHJlbmRlciBhbnl0aGluZy5cbiAgaWYgKHN3aXRjaEJsb2NrLmNhc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3Qgc3dpdGNoQ2FzZSBvZiBzd2l0Y2hCbG9jay5jYXNlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgY1ZpZXcueHJlZiwgc3dpdGNoQ2FzZSk7XG4gICAgbGV0IHN3aXRjaENhc2VJMThuTWV0YTogaTE4bi5CbG9ja1BsYWNlaG9sZGVyfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc3dpdGNoQ2FzZS5pMThuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghKHN3aXRjaENhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3Igc3dpdGNoIGJsb2NrOiAke3N3aXRjaENhc2UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaENhc2VJMThuTWV0YSA9IHN3aXRjaENhc2UuaTE4bjtcbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgdGFnTmFtZSwgJ0Nhc2UnLCBpci5OYW1lc3BhY2UuSFRNTCwgc3dpdGNoQ2FzZUkxOG5NZXRhLFxuICAgICAgICBzd2l0Y2hDYXNlLnN0YXJ0U291cmNlU3Bhbiwgc3dpdGNoQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgICBmaXJzdFNsb3RIYW5kbGUgPSB0ZW1wbGF0ZU9wLmhhbmRsZTtcbiAgICB9XG4gICAgY29uc3QgY2FzZUV4cHIgPSBzd2l0Y2hDYXNlLmV4cHJlc3Npb24gP1xuICAgICAgICBjb252ZXJ0QXN0KHN3aXRjaENhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIHN3aXRjaEJsb2NrLnN0YXJ0U291cmNlU3BhbikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPVxuICAgICAgICBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdGVtcGxhdGVPcC54cmVmLCB0ZW1wbGF0ZU9wLmhhbmRsZSk7XG4gICAgY29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbmFsQ2FzZUV4cHIpO1xuICAgIGluZ2VzdE5vZGVzKGNWaWV3LCBzd2l0Y2hDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9IGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoXG4gICAgICBmaXJzdFhyZWYhLCBmaXJzdFNsb3RIYW5kbGUhLCBjb252ZXJ0QXN0KHN3aXRjaEJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSwgY29uZGl0aW9ucyxcbiAgICAgIHN3aXRjaEJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKGNvbmRpdGlvbmFsKTtcbn1cblxuZnVuY3Rpb24gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN1ZmZpeDogc3RyaW5nLCBpMThuTWV0YTogaTE4bi5JMThuTWV0YXx1bmRlZmluZWQsXG4gICAgY2hpbGRyZW4/OiB0Lk5vZGVbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IGlyLlRlbXBsYXRlT3B8bnVsbCB7XG4gIGlmIChpMThuTWV0YSAhPT0gdW5kZWZpbmVkICYmICEoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1VuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGRlZmVyIGJsb2NrJyk7XG4gIH1cbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgbnVsbCwgYERlZmVyJHtzdWZmaXh9YCwgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICBpMThuTWV0YSwgc291cmNlU3BhbiEsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIGxldCBvd25SZXNvbHZlckZuOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgaWYgKHVuaXQuam9iLmRlZmVyTWV0YS5tb2RlID09PSBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLlBlckJsb2NrKSB7XG4gICAgaWYgKCF1bml0LmpvYi5kZWZlck1ldGEuYmxvY2tzLmhhcyhkZWZlckJsb2NrKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5hYmxlIHRvIGZpbmQgYSBkZXBlbmRlbmN5IGZ1bmN0aW9uIGZvciB0aGlzIGRlZmVycmVkIGJsb2NrYCk7XG4gICAgfVxuICAgIG93blJlc29sdmVyRm4gPSB1bml0LmpvYi5kZWZlck1ldGEuYmxvY2tzLmdldChkZWZlckJsb2NrKSA/PyBudWxsO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIGRlZmVyIG1haW4gdmlldyBhbmQgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgbWFpbiA9XG4gICAgICBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suaTE4biwgZGVmZXJCbG9jay5jaGlsZHJlbiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKSE7XG4gIGNvbnN0IGxvYWRpbmcgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnTG9hZGluZycsIGRlZmVyQmxvY2subG9hZGluZz8uaTE4biwgZGVmZXJCbG9jay5sb2FkaW5nPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2subG9hZGluZz8uc291cmNlU3Bhbik7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ1BsYWNlaG9sZGVyJywgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uaTE4biwgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnRXJyb3InLCBkZWZlckJsb2NrLmVycm9yPy5pMThuLCBkZWZlckJsb2NrLmVycm9yPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4pO1xuXG4gIC8vIENyZWF0ZSB0aGUgbWFpbiBkZWZlciBvcCwgYW5kIG9wcyBmb3IgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgZGVmZXJYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgY29uc3QgZGVmZXJPcCA9IGlyLmNyZWF0ZURlZmVyT3AoXG4gICAgICBkZWZlclhyZWYsIG1haW4ueHJlZiwgbWFpbi5oYW5kbGUsIG93blJlc29sdmVyRm4sIHVuaXQuam9iLmFsbERlZmVycmFibGVEZXBzRm4sXG4gICAgICBkZWZlckJsb2NrLnNvdXJjZVNwYW4pO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyVmlldyA9IHBsYWNlaG9sZGVyPy54cmVmID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJTbG90ID0gcGxhY2Vob2xkZXI/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdTbG90ID0gbG9hZGluZz8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AuZXJyb3JTbG90ID0gZXJyb3I/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nQWZ0ZXJUaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5hZnRlclRpbWUgPz8gbnVsbDtcbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wKTtcblxuICAvLyBDb25maWd1cmUgYWxsIGRlZmVyIGBvbmAgY29uZGl0aW9ucy5cbiAgLy8gVE9ETzogcmVmYWN0b3IgcHJlZmV0Y2ggdHJpZ2dlcnMgdG8gdXNlIGEgc2VwYXJhdGUgb3AgdHlwZSwgd2l0aCBhIHNoYXJlZCBzdXBlcmNsYXNzLiBUaGlzIHdpbGxcbiAgLy8gbWFrZSBpdCBlYXNpZXIgdG8gcmVmYWN0b3IgcHJlZmV0Y2ggYmVoYXZpb3IgaW4gdGhlIGZ1dHVyZS5cbiAgbGV0IHByZWZldGNoID0gZmFsc2U7XG4gIGxldCBkZWZlck9uT3BzOiBpci5EZWZlck9uT3BbXSA9IFtdO1xuICBsZXQgZGVmZXJXaGVuT3BzOiBpci5EZWZlcldoZW5PcFtdID0gW107XG4gIGZvciAoY29uc3QgdHJpZ2dlcnMgb2YgW2RlZmVyQmxvY2sudHJpZ2dlcnMsIGRlZmVyQmxvY2sucHJlZmV0Y2hUcmlnZ2Vyc10pIHtcbiAgICBpZiAodHJpZ2dlcnMuaWRsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSwgcHJlZmV0Y2gsIHRyaWdnZXJzLmlkbGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGV9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy5pbW1lZGlhdGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnRpbWVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy50aW1lci5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaG92ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmhvdmVyLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMuaG92ZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmludGVyYWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmludGVyYWN0aW9uLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy52aWV3cG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMudmlld3BvcnQucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy52aWV3cG9ydC5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMud2hlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodHJpZ2dlcnMud2hlbi52YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIHN1cHBvcnRzIHRoaXMgY2FzZSwgYnV0IGl0J3MgdmVyeSBzdHJhbmdlIHRvIG1lLiBXaGF0IHdvdWxkIGl0XG4gICAgICAgIC8vIGV2ZW4gbWVhbj9cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGludGVycG9sYXRpb24gaW4gZGVmZXIgYmxvY2sgd2hlbiB0cmlnZ2VyYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlcldoZW5PcChcbiAgICAgICAgICBkZWZlclhyZWYsIGNvbnZlcnRBc3QodHJpZ2dlcnMud2hlbi52YWx1ZSwgdW5pdC5qb2IsIHRyaWdnZXJzLndoZW4uc291cmNlU3BhbiksIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLndoZW4uc291cmNlU3Bhbik7XG4gICAgICBkZWZlcldoZW5PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cblxuICAgIC8vIElmIG5vIChub24tcHJlZmV0Y2hpbmcpIGRlZmVyIHRyaWdnZXJzIHdlcmUgcHJvdmlkZWQsIGRlZmF1bHQgdG8gYGlkbGVgLlxuICAgIGlmIChkZWZlck9uT3BzLmxlbmd0aCA9PT0gMCAmJiBkZWZlcldoZW5PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIGZhbHNlLCBudWxsISkpO1xuICAgIH1cbiAgICBwcmVmZXRjaCA9IHRydWU7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT25PcHMpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGRlZmVyV2hlbk9wcyk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdEljdSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpY3U6IHQuSWN1KSB7XG4gIGlmIChpY3UuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBpc1NpbmdsZUkxOG5JY3UoaWN1LmkxOG4pKSB7XG4gICAgY29uc3QgeHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VTdGFydE9wKHhyZWYsIGljdS5pMThuLCBpY3VGcm9tSTE4bk1lc3NhZ2UoaWN1LmkxOG4pLm5hbWUsIG51bGwhKSk7XG4gICAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIHRleHRdIG9mIE9iamVjdC5lbnRyaWVzKHsuLi5pY3UudmFycywgLi4uaWN1LnBsYWNlaG9sZGVyc30pKSB7XG4gICAgICBpZiAodGV4dCBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCB0ZXh0LCBwbGFjZWhvbGRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RUZXh0KHVuaXQsIHRleHQsIHBsYWNlaG9sZGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VFbmRPcCh4cmVmKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIElDVTogJHtpY3UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGZvcmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEZvckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGZvckJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHZvaWQge1xuICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICAvLyBXZSBjb3B5IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIncyBzY2hlbWUgb2YgY3JlYXRpbmcgbmFtZXMgZm9yIGAkY291bnRgIGFuZCBgJGluZGV4YFxuICAvLyB0aGF0IGFyZSBzdWZmaXhlZCB3aXRoIHNwZWNpYWwgaW5mb3JtYXRpb24sIHRvIGRpc2FtYmlndWF0ZSB3aGljaCBsZXZlbCBvZiBuZXN0ZWQgbG9vcFxuICAvLyB0aGUgYmVsb3cgYWxpYXNlcyByZWZlciB0by5cbiAgLy8gVE9ETzogV2Ugc2hvdWxkIHJlZmFjdG9yIFRlbXBsYXRlIFBpcGVsaW5lJ3MgdmFyaWFibGUgcGhhc2VzIHRvIGdyYWNlZnVsbHkgaGFuZGxlXG4gIC8vIHNoYWRvd2luZywgYW5kIGFyYml0cmFyaWx5IG1hbnkgbGV2ZWxzIG9mIHZhcmlhYmxlcyBkZXBlbmRpbmcgb24gZWFjaCBvdGhlci5cbiAgY29uc3QgaW5kZXhOYW1lID0gYMm1JGluZGV4XyR7cmVwZWF0ZXJWaWV3LnhyZWZ9YDtcbiAgY29uc3QgY291bnROYW1lID0gYMm1JGNvdW50XyR7cmVwZWF0ZXJWaWV3LnhyZWZ9YDtcbiAgY29uc3QgaW5kZXhWYXJOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8vIFNldCBhbGwgdGhlIGNvbnRleHQgdmFyaWFibGVzIGFuZCBhbGlhc2VzIGF2YWlsYWJsZSBpbiB0aGUgcmVwZWF0ZXIuXG4gIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChmb3JCbG9jay5pdGVtLm5hbWUsIGZvckJsb2NrLml0ZW0udmFsdWUpO1xuXG4gIGZvciAoY29uc3QgdmFyaWFibGUgb2YgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcykge1xuICAgIGlmICh2YXJpYWJsZS52YWx1ZSA9PT0gJyRpbmRleCcpIHtcbiAgICAgIGluZGV4VmFyTmFtZXMuYWRkKHZhcmlhYmxlLm5hbWUpO1xuICAgIH1cbiAgICBpZiAodmFyaWFibGUubmFtZSA9PT0gJyRpbmRleCcpIHtcbiAgICAgIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldCgnJGluZGV4JywgdmFyaWFibGUudmFsdWUpLnNldChpbmRleE5hbWUsIHZhcmlhYmxlLnZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKHZhcmlhYmxlLm5hbWUgPT09ICckY291bnQnKSB7XG4gICAgICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoJyRjb3VudCcsIHZhcmlhYmxlLnZhbHVlKS5zZXQoY291bnROYW1lLCB2YXJpYWJsZS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICBpZGVudGlmaWVyOiB2YXJpYWJsZS5uYW1lLFxuICAgICAgICBleHByZXNzaW9uOiBnZXRDb21wdXRlZEZvckxvb3BWYXJpYWJsZUV4cHJlc3Npb24odmFyaWFibGUsIGluZGV4TmFtZSwgY291bnROYW1lKVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc291cmNlU3BhbiA9IGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLnRyYWNrQnkuc3BhbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIGNvbnN0IHRyYWNrID0gY29udmVydEFzdChmb3JCbG9jay50cmFja0J5LCB1bml0LmpvYiwgc291cmNlU3Bhbik7XG5cbiAgaW5nZXN0Tm9kZXMocmVwZWF0ZXJWaWV3LCBmb3JCbG9jay5jaGlsZHJlbik7XG5cbiAgbGV0IGVtcHR5VmlldzogVmlld0NvbXBpbGF0aW9uVW5pdHxudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5VGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgICBlbXB0eVRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIGVtcHR5Vmlldy54cmVmLCBmb3JCbG9jay5lbXB0eSk7XG4gIH1cblxuICBjb25zdCB2YXJOYW1lczogaXIuUmVwZWF0ZXJWYXJOYW1lcyA9IHtcbiAgICAkaW5kZXg6IGluZGV4VmFyTmFtZXMsXG4gICAgJGltcGxpY2l0OiBmb3JCbG9jay5pdGVtLm5hbWUsXG4gIH07XG5cbiAgaWYgKGZvckJsb2NrLmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKGZvckJsb2NrLmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBmb3InKTtcbiAgfVxuICBpZiAoZm9yQmxvY2suZW1wdHk/LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIShmb3JCbG9jay5lbXB0eS5pMThuIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBvciBAZW1wdHknKTtcbiAgfVxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSBmb3JCbG9jay5pMThuO1xuICBjb25zdCBlbXB0eUkxOG5QbGFjZWhvbGRlciA9IGZvckJsb2NrLmVtcHR5Py5pMThuO1xuXG4gIGNvbnN0IHRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIHJlcGVhdGVyVmlldy54cmVmLCBmb3JCbG9jayk7XG4gIGNvbnN0IHJlcGVhdGVyQ3JlYXRlID0gaXIuY3JlYXRlUmVwZWF0ZXJDcmVhdGVPcChcbiAgICAgIHJlcGVhdGVyVmlldy54cmVmLCBlbXB0eVZpZXc/LnhyZWYgPz8gbnVsbCwgdGFnTmFtZSwgdHJhY2ssIHZhck5hbWVzLCBlbXB0eVRhZ05hbWUsXG4gICAgICBpMThuUGxhY2Vob2xkZXIsIGVtcHR5STE4blBsYWNlaG9sZGVyLCBmb3JCbG9jay5zdGFydFNvdXJjZVNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHJlcGVhdGVyQ3JlYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gY29udmVydEFzdChcbiAgICAgIGZvckJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2suZXhwcmVzc2lvbi5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKSk7XG4gIGNvbnN0IHJlcGVhdGVyID0gaXIuY3JlYXRlUmVwZWF0ZXJPcChcbiAgICAgIHJlcGVhdGVyQ3JlYXRlLnhyZWYsIHJlcGVhdGVyQ3JlYXRlLmhhbmRsZSwgZXhwcmVzc2lvbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2gocmVwZWF0ZXIpO1xufVxuXG4vKipcbiAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlcHJlc2VudHMgYSB2YXJpYWJsZSBpbiBhbiBgQGZvcmAgbG9vcC5cbiAqIEBwYXJhbSB2YXJpYWJsZSBBU1QgcmVwcmVzZW50aW5nIHRoZSB2YXJpYWJsZS5cbiAqIEBwYXJhbSBpbmRleE5hbWUgTG9vcC1zcGVjaWZpYyBuYW1lIGZvciBgJGluZGV4YC5cbiAqIEBwYXJhbSBjb3VudE5hbWUgTG9vcC1zcGVjaWZpYyBuYW1lIGZvciBgJGNvdW50YC5cbiAqL1xuZnVuY3Rpb24gZ2V0Q29tcHV0ZWRGb3JMb29wVmFyaWFibGVFeHByZXNzaW9uKFxuICAgIHZhcmlhYmxlOiB0LlZhcmlhYmxlLCBpbmRleE5hbWU6IHN0cmluZywgY291bnROYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICBzd2l0Y2ggKHZhcmlhYmxlLnZhbHVlKSB7XG4gICAgY2FzZSAnJGluZGV4JzpcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGluZGV4TmFtZSk7XG5cbiAgICBjYXNlICckY291bnQnOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoY291bnROYW1lKTtcblxuICAgIGNhc2UgJyRmaXJzdCc6XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihpbmRleE5hbWUpLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpO1xuXG4gICAgY2FzZSAnJGxhc3QnOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5pZGVudGljYWwoXG4gICAgICAgICAgbmV3IGlyLkxleGljYWxSZWFkRXhwcihjb3VudE5hbWUpLm1pbnVzKG8ubGl0ZXJhbCgxKSkpO1xuXG4gICAgY2FzZSAnJGV2ZW4nOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5tb2R1bG8oby5saXRlcmFsKDIpKS5pZGVudGljYWwoby5saXRlcmFsKDApKTtcblxuICAgIGNhc2UgJyRvZGQnOlxuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5tb2R1bG8oby5saXRlcmFsKDIpKS5ub3RJZGVudGljYWwoby5saXRlcmFsKDApKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIEBmb3IgbG9vcCB2YXJpYWJsZSAke3ZhcmlhYmxlLnZhbHVlfWApO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRlbXBsYXRlIEFTVCBleHByZXNzaW9uIGludG8gYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXN0KFxuICAgIGFzdDogZS5BU1QsIGpvYjogQ29tcGlsYXRpb25Kb2IsIGJhc2VTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuYXN0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5UmVhZCkge1xuICAgIGNvbnN0IGlzVGhpc1JlY2VpdmVyID0gYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXI7XG4gICAgLy8gV2hldGhlciB0aGlzIGlzIGFuIGltcGxpY2l0IHJlY2VpdmVyLCAqZXhjbHVkaW5nKiBleHBsaWNpdCByZWFkcyBvZiBgdGhpc2AuXG4gICAgY29uc3QgaXNJbXBsaWNpdFJlY2VpdmVyID1cbiAgICAgICAgYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyICYmICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpO1xuICAgIC8vIFdoZXRoZXIgdGhlICBuYW1lIG9mIHRoZSByZWFkIGlzIGEgbm9kZSB0aGF0IHNob3VsZCBiZSBuZXZlciByZXRhaW4gaXRzIGV4cGxpY2l0IHRoaXNcbiAgICAvLyByZWNlaXZlci5cbiAgICBjb25zdCBpc1NwZWNpYWxOb2RlID0gYXN0Lm5hbWUgPT09ICckYW55JyB8fCBhc3QubmFtZSA9PT0gJyRldmVudCc7XG4gICAgLy8gVE9ETzogVGhlIG1vc3Qgc2Vuc2libGUgY29uZGl0aW9uIGhlcmUgd291bGQgYmUgc2ltcGx5IGBpc0ltcGxpY2l0UmVjZWl2ZXJgLCB0byBjb252ZXJ0IG9ubHlcbiAgICAvLyBhY3R1YWwgaW1wbGljaXQgYHRoaXNgIHJlYWRzLCBhbmQgbm90IGV4cGxpY2l0IG9uZXMuIEhvd2V2ZXIsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgKGFuZFxuICAgIC8vIHRoZSBUeXBlY2hlY2sgYmxvY2shKSBib3RoIGhhdmUgdGhlIHNhbWUgYnVnLCBpbiB3aGljaCB0aGV5IGFsc28gY29uc2lkZXIgZXhwbGljaXQgYHRoaXNgXG4gICAgLy8gcmVhZHMgdG8gYmUgaW1wbGljaXQuIFRoaXMgY2F1c2VzIHByb2JsZW1zIHdoZW4gdGhlIGV4cGxpY2l0IGB0aGlzYCByZWFkIGlzIGluc2lkZSBhXG4gICAgLy8gdGVtcGxhdGUgd2l0aCBhIGNvbnRleHQgdGhhdCBhbHNvIHByb3ZpZGVzIHRoZSB2YXJpYWJsZSBuYW1lIGJlaW5nIHJlYWQ6XG4gICAgLy8gYGBgXG4gICAgLy8gPG5nLXRlbXBsYXRlIGxldC1hPnt7dGhpcy5hfX08L25nLXRlbXBsYXRlPlxuICAgIC8vIGBgYFxuICAgIC8vIFRoZSB3aG9sZSBwb2ludCBvZiB0aGUgZXhwbGljaXQgYHRoaXNgIHdhcyB0byBhY2Nlc3MgdGhlIGNsYXNzIHByb3BlcnR5LCBidXQgVERCIGFuZCB0aGVcbiAgICAvLyBjdXJyZW50IFRDQiB0cmVhdCB0aGUgcmVhZCBhcyBpbXBsaWNpdCwgYW5kIGdpdmUgeW91IHRoZSBjb250ZXh0IHByb3BlcnR5IGluc3RlYWQhXG4gICAgLy9cbiAgICAvLyBGb3Igbm93LCB3ZSBlbXVsYXRlIHRoaXMgb2xkIGJlaHZhaW9yIGJ5IGFnZ3Jlc3NpdmVseSBjb252ZXJ0aW5nIGV4cGxpY2l0IHJlYWRzIHRvIHRvXG4gICAgLy8gaW1wbGljaXQgcmVhZHMsIGV4Y2VwdCBmb3IgdGhlIHNwZWNpYWwgY2FzZXMgdGhhdCBUREIgYW5kIHRoZSBjdXJyZW50IFRDQiBwcm90ZWN0LiBIb3dldmVyLFxuICAgIC8vIGl0IHdvdWxkIGJlIGFuIGltcHJvdmVtZW50IHRvIGZpeCB0aGlzLlxuICAgIC8vXG4gICAgLy8gU2VlIGFsc28gdGhlIGNvcnJlc3BvbmRpbmcgY29tbWVudCBmb3IgdGhlIFRDQiwgaW4gYHR5cGVfY2hlY2tfYmxvY2sudHNgLlxuICAgIGlmIChpc0ltcGxpY2l0UmVjZWl2ZXIgfHwgKGlzVGhpc1JlY2VpdmVyICYmICFpc1NwZWNpYWxOb2RlKSkge1xuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoYXN0Lm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsIG51bGwsXG4gICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlXcml0ZSkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgICAgIC8vIFRPRE86IElzIGl0IGNvcnJlY3QgdG8gYWx3YXlzIHVzZSB0aGUgcm9vdCBjb250ZXh0IGluIHBsYWNlIG9mIHRoZSBpbXBsaWNpdCByZWNlaXZlcj9cbiAgICAgICAgICBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZiksIGFzdC5uYW1lLCBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgbnVsbCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DYWxsKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIEltcGxpY2l0UmVjZWl2ZXJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLCB1bmRlZmluZWQsXG4gICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgIHJldHVybiBvLmxpdGVyYWwoYXN0LnZhbHVlLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuVW5hcnkpIHtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIHJldHVybiBuZXcgby5VbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG8uVW5hcnlPcGVyYXRvci5QbHVzLCBjb252ZXJ0QXN0KGFzdC5leHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgby5VbmFyeU9wZXJhdG9yLk1pbnVzLCBjb252ZXJ0QXN0KGFzdC5leHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIHVuYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgb3BlcmF0b3IsIGNvbnZlcnRBc3QoYXN0LmxlZnQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yaWdodCwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgY29udGV4dCBleHByZXNzaW9ucyBoYXZlIHNvdXJjZSBtYXBzP1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQ2hhaW4gaW4gdW5rbm93biBjb250ZXh0YCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsTWFwKSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5rZXlzLm1hcCgoa2V5LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlc1tpZHhdO1xuICAgICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZ1xuICAgICAgLy8gZXhwcmVzc2lvbj9cbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LmtleSwgY29udmVydEFzdCh2YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIGtleS5xdW90ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRXhwcihlbnRyaWVzLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbEFycmF5KSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZyBleHByZXNzaW9uP1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFxuICAgICAgICBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5jb25kaXRpb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC50cnVlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIC8vIFRPRE86IHBpcGVzIHNob3VsZCBwcm9iYWJseSBoYXZlIHNvdXJjZSBtYXBzOyBmaWd1cmUgb3V0IGRldGFpbHMuXG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoXG4gICAgICAgIGpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBuZXcgaXIuU2xvdEhhbmRsZSgpLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgW1xuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgLi4uYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICBdLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZVByb3BlcnR5UmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlQ2FsbCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGFzdC5hcmdzLm1hcChhID0+IGNvbnZlcnRBc3QoYSwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJlZml4Tm90KSB7XG4gICAgcmV0dXJuIG8ubm90KFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgZXhwcmVzc2lvbiB0eXBlIFwiJHthc3QuY29uc3RydWN0b3IubmFtZX1cIiBpbiBmaWxlIFwiJHtcbiAgICAgICAgYmFzZVNvdXJjZVNwYW4/LnN0YXJ0LmZpbGUudXJsfVwiYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgIGpvYjogQ29tcGlsYXRpb25Kb2IsIHZhbHVlOiBlLkFTVHxzdHJpbmcsIGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfG51bGx8dW5kZWZpbmVkLFxuICAgIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBvLkV4cHJlc3Npb258aXIuSW50ZXJwb2xhdGlvbiB7XG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258aXIuSW50ZXJwb2xhdGlvbjtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgZXhwcmVzc2lvbiA9IG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZSA9PiBjb252ZXJ0QXN0KGUsIGpvYiwgc291cmNlU3BhbiA/PyBudWxsKSksXG4gICAgICAgIE9iamVjdC5rZXlzKGFzTWVzc2FnZShpMThuTWV0YSk/LnBsYWNlaG9sZGVycyA/PyB7fSkpO1xuICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1QpIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdCh2YWx1ZSwgam9iLCBzb3VyY2VTcGFuID8/IG51bGwpO1xuICB9IGVsc2Uge1xuICAgIGV4cHJlc3Npb24gPSBvLmxpdGVyYWwodmFsdWUpO1xuICB9XG4gIHJldHVybiBleHByZXNzaW9uO1xufVxuXG4vLyBUT0RPOiBDYW4gd2UgcG9wdWxhdGUgVGVtcGxhdGUgYmluZGluZyBraW5kcyBpbiBpbmdlc3Q/XG5jb25zdCBCSU5ESU5HX0tJTkRTID0gbmV3IE1hcDxlLkJpbmRpbmdUeXBlLCBpci5CaW5kaW5nS2luZD4oW1xuICBbZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eSwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5Ud29XYXksIGlyLkJpbmRpbmdLaW5kLlR3b1dheVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGVdLFxuICBbZS5CaW5kaW5nVHlwZS5DbGFzcywgaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lXSxcbiAgW2UuQmluZGluZ1R5cGUuU3R5bGUsIGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BbmltYXRpb24sIGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbl0sXG5dKTtcblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gdGVtcGxhdGUgaXMgYSBwbGFpbiBuZy10ZW1wbGF0ZSAoYXMgb3Bwb3NlZCB0byBhbm90aGVyIGtpbmQgb2YgdGVtcGxhdGVcbiAqIHN1Y2ggYXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZSBvciBjb250cm9sIGZsb3cgdGVtcGxhdGUpLiBUaGlzIGlzIGNoZWNrZWQgYmFzZWQgb24gdGhlXG4gKiB0YWdOYW1lLiBXZSBjYW4gZXhwZWN0IHRoYXQgb25seSBwbGFpbiBuZy10ZW1wbGF0ZXMgd2lsbCBjb21lIHRocm91Z2ggd2l0aCBhIHRhZ05hbWUgb2ZcbiAqICduZy10ZW1wbGF0ZScuXG4gKlxuICogSGVyZSBhcmUgc29tZSBvZiB0aGUgY2FzZXMgd2UgZXhwZWN0OlxuICpcbiAqIHwgQW5ndWxhciBIVE1MICAgICAgICAgICAgICAgICAgICAgICB8IFRlbXBsYXRlIHRhZ05hbWUgICB8XG4gKiB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCBgPG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxkaXYgKm5nSWY9XCJ0cnVlXCI+YCAgICAgICAgICAgICAgIHwgJ2RpdicgICAgICAgICAgICAgIHxcbiAqIHwgYDxzdmc+PG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICB8ICdzdmc6bmctdGVtcGxhdGUnICB8XG4gKiB8IGBAaWYgKHRydWUpIHtgICAgICAgICAgICAgICAgICAgICAgfCAnQ29uZGl0aW9uYWwnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHBsYWluKSAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChzdHJ1Y3R1cmFsKSB8IG51bGwgICAgICAgICAgICAgICB8XG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5UZW1wbGF0ZSh0bXBsOiB0LlRlbXBsYXRlKSB7XG4gIHJldHVybiBzcGxpdE5zTmFtZSh0bXBsLnRhZ05hbWUgPz8gJycpWzFdID09PSBOR19URU1QTEFURV9UQUdfTkFNRTtcbn1cblxuLyoqXG4gKiBFbnN1cmVzIHRoYXQgdGhlIGkxOG5NZXRhLCBpZiBwcm92aWRlZCwgaXMgYW4gaTE4bi5NZXNzYWdlLlxuICovXG5mdW5jdGlvbiBhc01lc3NhZ2UoaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGF8bnVsbHx1bmRlZmluZWQpOiBpMThuLk1lc3NhZ2V8bnVsbCB7XG4gIGlmIChpMThuTWV0YSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKCEoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpKSB7XG4gICAgdGhyb3cgRXJyb3IoYEV4cGVjdGVkIGkxOG4gbWV0YSB0byBiZSBhIE1lc3NhZ2UsIGJ1dCBnb3Q6ICR7aTE4bk1ldGEuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICByZXR1cm4gaTE4bk1ldGE7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtIHRvIHRoZWlyIElSXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudEJpbmRpbmdzKFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnQpOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcHxpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcHxudWxsPigpO1xuXG4gIGxldCBpMThuQXR0cmlidXRlQmluZGluZ05hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIC8vIEF0dHJpYnV0ZSBsaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KGVsZW1lbnQubmFtZSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICBiaW5kaW5ncy5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgb3AueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBhdHRyLm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3RXaXRoSW50ZXJwb2xhdGlvbih1bml0LmpvYiwgYXR0ci52YWx1ZSwgYXR0ci5pMThuKSwgbnVsbCwgc2VjdXJpdHlDb250ZXh0LCB0cnVlLFxuICAgICAgICBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGF0dHIuaTE4biksIGF0dHIuc291cmNlU3BhbikpO1xuICAgIGlmIChhdHRyLmkxOG4pIHtcbiAgICAgIGkxOG5BdHRyaWJ1dGVCaW5kaW5nTmFtZXMuYWRkKGF0dHIubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBpbnB1dCBvZiBlbGVtZW50LmlucHV0cykge1xuICAgIGlmIChpMThuQXR0cmlidXRlQmluZGluZ05hbWVzLmhhcyhpbnB1dC5uYW1lKSkge1xuICAgICAgY29uc29sZS5lcnJvcihgT24gY29tcG9uZW50ICR7dW5pdC5qb2IuY29tcG9uZW50TmFtZX0sIHRoZSBiaW5kaW5nICR7XG4gICAgICAgICAgaW5wdXRcbiAgICAgICAgICAgICAgLm5hbWV9IGlzIGJvdGggYW4gaTE4biBhdHRyaWJ1dGUgYW5kIGEgcHJvcGVydHkuIFlvdSBtYXkgd2FudCB0byByZW1vdmUgdGhlIHByb3BlcnR5IGJpbmRpbmcuIFRoaXMgd2lsbCBiZWNvbWUgYSBjb21waWxhdGlvbiBlcnJvciBpbiBmdXR1cmUgdmVyc2lvbnMgb2YgQW5ndWxhci5gKTtcbiAgICB9XG4gICAgLy8gQWxsIGR5bmFtaWMgYmluZGluZ3MgKGJvdGggYXR0cmlidXRlIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncykuXG4gICAgYmluZGluZ3MucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgIG9wLnhyZWYsIEJJTkRJTkdfS0lORFMuZ2V0KGlucHV0LnR5cGUpISwgaW5wdXQubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhc3RPZihpbnB1dC52YWx1ZSksIGlucHV0LmkxOG4pLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGlucHV0LmkxOG4pID8/IG51bGwsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goYmluZGluZ3MuZmlsdGVyKFxuICAgICAgKGIpOiBiIGlzIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUpKTtcbiAgdW5pdC51cGRhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoKGIpOiBiIGlzIGlyLkJpbmRpbmdPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuQmluZGluZykpO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dC50eXBlID09PSBlLlBhcnNlZEV2ZW50VHlwZS5Ud29XYXkpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVHdvV2F5TGlzdGVuZXJPcChcbiAgICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgICAgbWFrZVR3b1dheUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSxcbiAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICAgICAgb3AueHJlZiwgb3AuaGFuZGxlLCBvdXRwdXQubmFtZSwgb3AudGFnLFxuICAgICAgICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksIG91dHB1dC5waGFzZSxcbiAgICAgICAgICBvdXRwdXQudGFyZ2V0LCBmYWxzZSwgb3V0cHV0LnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBhbnkgb2YgdGhlIGJpbmRpbmdzIG9uIHRoaXMgZWxlbWVudCBoYXZlIGFuIGkxOG4gbWVzc2FnZSwgdGhlbiBhbiBpMThuIGF0dHJzIGNvbmZpZ3VyYXRpb25cbiAgLy8gb3AgaXMgYWxzbyByZXF1aXJlZC5cbiAgaWYgKGJpbmRpbmdzLnNvbWUoYiA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVJMThuQXR0cmlidXRlc09wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIG9wLnhyZWYpKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlQmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIHRlbXBsYXRlOiB0LlRlbXBsYXRlLFxuICAgIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwpOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcHxpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcHxudWxsPigpO1xuXG4gIGZvciAoY29uc3QgYXR0ciBvZiB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgdGVtcGxhdGVLaW5kLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIudHlwZSwgYXR0ci5uYW1lLCBhc3RPZihhdHRyLnZhbHVlKSwgYXR0ci51bml0LCBhdHRyLnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgdGVtcGxhdGUuYXR0cmlidXRlcykge1xuICAgIC8vIEF0dHJpYnV0ZSBsaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgdGVtcGxhdGUuaW5wdXRzKSB7XG4gICAgLy8gRHluYW1pYyBiaW5kaW5ncyAoYm90aCBhdHRyaWJ1dGUgYW5kIHByb3BlcnR5IGJpbmRpbmdzKS5cbiAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQudHlwZSwgaW5wdXQubmFtZSwgYXN0T2YoaW5wdXQudmFsdWUpLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShpbnB1dC5pMThuKSwgaW5wdXQuc291cmNlU3BhbikpO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoXG4gICAgICAoYik6IGIgaXMgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGJpbmRpbmdzLmZpbHRlcigoYik6IGIgaXMgaXIuQmluZGluZ09wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5CaW5kaW5nKSk7XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGVtcGxhdGUub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuVHdvV2F5KSB7XG4gICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVHdvV2F5TGlzdGVuZXJPcChcbiAgICAgICAgICAgIG9wLnhyZWYsIG9wLmhhbmRsZSwgb3V0cHV0Lm5hbWUsIG9wLnRhZyxcbiAgICAgICAgICAgIG1ha2VUd29XYXlMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksXG4gICAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICAgICAgb3AueHJlZiwgb3AuaGFuZGxlLCBvdXRwdXQubmFtZSwgb3AudGFnLFxuICAgICAgICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSwgb3V0cHV0LnBoYXNlLFxuICAgICAgICAgICAgb3V0cHV0LnRhcmdldCwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsICYmXG4gICAgICAgIG91dHB1dC50eXBlICE9PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIC8vIEFuaW1hdGlvbiBiaW5kaW5ncyBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgc3RydWN0dXJhbCB0ZW1wbGF0ZSdzIGNvbnN0IGFycmF5LlxuICAgICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgb3V0cHV0Lm5hbWUsIGZhbHNlKTtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgb3AueHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIG91dHB1dC5uYW1lLCBudWxsLCBudWxsLCBudWxsLCBzZWN1cml0eUNvbnRleHQpKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPOiBQZXJoYXBzIHdlIGNvdWxkIGRvIHRoaXMgaW4gYSBwaGFzZT8gKEl0IGxpa2VseSB3b3VsZG4ndCBjaGFuZ2UgdGhlIHNsb3QgaW5kaWNlcy4pXG4gIGlmIChiaW5kaW5ncy5zb21lKGIgPT4gYj8uaTE4bk1lc3NhZ2UpICE9PSBudWxsKSB7XG4gICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgaXIuY3JlYXRlSTE4bkF0dHJpYnV0ZXNPcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBvcC54cmVmKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBIZWxwZXIgdG8gaW5nZXN0IGFuIGluZGl2aWR1YWwgYmluZGluZyBvbiBhIHRlbXBsYXRlLCBlaXRoZXIgYW4gZXhwbGljaXQgYG5nLXRlbXBsYXRlYCwgb3IgYW5cbiAqIGltcGxpY2l0IHRlbXBsYXRlIGNyZWF0ZWQgdmlhIHN0cnVjdHVyYWwgZGlyZWN0aXZlLlxuICpcbiAqIEJpbmRpbmdzIG9uIHRlbXBsYXRlcyBhcmUgKmV4dHJlbWVseSogdHJpY2t5LiBJIGhhdmUgdHJpZWQgdG8gaXNvbGF0ZSBhbGwgb2YgdGhlIGNvbmZ1c2luZyBlZGdlXG4gKiBjYXNlcyBpbnRvIHRoaXMgZnVuY3Rpb24sIGFuZCB0byBjb21tZW50IGl0IHdlbGwgdG8gZG9jdW1lbnQgdGhlIGJlaGF2aW9yLlxuICpcbiAqIFNvbWUgb2YgdGhpcyBiZWhhdmlvciBpcyBpbnR1aXRpdmVseSBpbmNvcnJlY3QsIGFuZCB3ZSBzaG91bGQgY29uc2lkZXIgY2hhbmdpbmcgaXQgaW4gdGhlIGZ1dHVyZS5cbiAqXG4gKiBAcGFyYW0gdmlldyBUaGUgY29tcGlsYXRpb24gdW5pdCBmb3IgdGhlIHZpZXcgY29udGFpbmluZyB0aGUgdGVtcGxhdGUuXG4gKiBAcGFyYW0geHJlZiBUaGUgeHJlZiBvZiB0aGUgdGVtcGxhdGUgb3AuXG4gKiBAcGFyYW0gdHlwZSBUaGUgYmluZGluZyB0eXBlLCBhY2NvcmRpbmcgdG8gdGhlIHBhcnNlci4gVGhpcyBpcyBmYWlybHkgcmVhc29uYWJsZSwgZS5nLiBib3RoXG4gKiAgICAgZHluYW1pYyBhbmQgc3RhdGljIGF0dHJpYnV0ZXMgaGF2ZSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZS5cbiAqIEBwYXJhbSBuYW1lIFRoZSBiaW5kaW5nJ3MgbmFtZS5cbiAqIEBwYXJhbSB2YWx1ZSBUaGUgYmluZGluZ3MncyB2YWx1ZSwgd2hpY2ggd2lsbCBlaXRoZXIgYmUgYW4gaW5wdXQgQVNUIGV4cHJlc3Npb24sIG9yIGEgc3RyaW5nXG4gKiAgICAgbGl0ZXJhbC4gTm90ZSB0aGF0IHRoZSBpbnB1dCBBU1QgZXhwcmVzc2lvbiBtYXkgb3IgbWF5IG5vdCBiZSBjb25zdCAtLSBpdCB3aWxsIG9ubHkgYmUgYVxuICogICAgIHN0cmluZyBsaXRlcmFsIGlmIHRoZSBwYXJzZXIgY29uc2lkZXJlZCBpdCBhIHRleHQgYmluZGluZy5cbiAqIEBwYXJhbSB1bml0IElmIHRoZSBiaW5kaW5nIGhhcyBhIHVuaXQgKGUuZy4gYHB4YCBmb3Igc3R5bGUgYmluZGluZ3MpLCB0aGVuIHRoaXMgaXMgdGhlIHVuaXQuXG4gKiBAcGFyYW0gc2VjdXJpdHlDb250ZXh0IFRoZSBzZWN1cml0eSBjb250ZXh0IG9mIHRoZSBiaW5kaW5nLlxuICogQHBhcmFtIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlIFdoZXRoZXIgdGhpcyBiaW5kaW5nIGFjdHVhbGx5IGFwcGxpZXMgdG8gdGhlIHN0cnVjdHVyYWxcbiAqICAgICBuZy10ZW1wbGF0ZS4gRm9yIGV4YW1wbGUsIGFuIGBuZ0ZvcmAgd291bGQgYWN0dWFsbHkgYXBwbHkgdG8gdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUuIChNb3N0XG4gKiAgICAgYmluZGluZ3Mgb24gc3RydWN0dXJhbCBlbGVtZW50cyB0YXJnZXQgdGhlIGlubmVyIGVsZW1lbnQsIG5vdCB0aGUgdGVtcGxhdGUuKVxuICogQHBhcmFtIHRlbXBsYXRlS2luZCBXaGV0aGVyIHRoaXMgaXMgYW4gZXhwbGljaXQgYG5nLXRlbXBsYXRlYCBvciBhbiBpbXBsaWNpdCB0ZW1wbGF0ZSBjcmVhdGVkIGJ5XG4gKiAgICAgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS4gVGhpcyBzaG91bGQgbmV2ZXIgYmUgYSBibG9jayB0ZW1wbGF0ZS5cbiAqIEBwYXJhbSBpMThuTWVzc2FnZSBUaGUgaTE4biBtZXRhZGF0YSBmb3IgdGhlIGJpbmRpbmcsIGlmIGFueS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIFRoZSBzb3VyY2Ugc3BhbiBvZiB0aGUgYmluZGluZy5cbiAqIEByZXR1cm5zIEFuIElSIGJpbmRpbmcgb3AsIG9yIG51bGwgaWYgdGhlIGJpbmRpbmcgc2hvdWxkIGJlIHNraXBwZWQuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB4cmVmOiBpci5YcmVmSWQsIHR5cGU6IGUuQmluZGluZ1R5cGUsIG5hbWU6IHN0cmluZyxcbiAgICB2YWx1ZTogZS5BU1R8c3RyaW5nLCB1bml0OiBzdHJpbmd8bnVsbCwgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW4sIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwsXG4gICAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5CaW5kaW5nT3B8XG4gICAgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3B8bnVsbCB7XG4gIGNvbnN0IGlzVGV4dEJpbmRpbmcgPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xuICAvLyBJZiB0aGlzIGlzIGEgc3RydWN0dXJhbCB0ZW1wbGF0ZSwgdGhlbiBzZXZlcmFsIGtpbmRzIG9mIGJpbmRpbmdzIHNob3VsZCBub3QgcmVzdWx0IGluIGFuXG4gIC8vIHVwZGF0ZSBpbnN0cnVjdGlvbi5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWwpIHtcbiAgICBpZiAoIWlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlKSB7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGUuQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgICAvLyBCZWNhdXNlIHRoaXMgYmluZGluZyBkb2Vzbid0IHJlYWxseSB0YXJnZXQgdGhlIG5nLXRlbXBsYXRlLCBpdCBtdXN0IGJlIGEgYmluZGluZyBvbiBhblxuICAgICAgICAgIC8vIGlubmVyIG5vZGUgb2YgYSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiBXZSBjYW4ndCBza2lwIGl0IGVudGlyZWx5LCBiZWNhdXNlIHdlIHN0aWxsIG5lZWRcbiAgICAgICAgICAvLyBpdCBvbiB0aGUgbmctdGVtcGxhdGUncyBjb25zdHMgKGUuZy4gZm9yIHRoZSBwdXJwb3NlcyBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcpLiBIb3dldmVyLFxuICAgICAgICAgIC8vIHdlIHNob3VsZCBub3QgZ2VuZXJhdGUgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBpdC5cbiAgICAgICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBuYW1lLCBudWxsLCBudWxsLCBpMThuTWVzc2FnZSwgc2VjdXJpdHlDb250ZXh0KTtcbiAgICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlR3b1dheTpcbiAgICAgICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLlR3b1dheVByb3BlcnR5LCBudWxsLCBuYW1lLCBudWxsLCBudWxsLCBpMThuTWVzc2FnZSxcbiAgICAgICAgICAgICAgc2VjdXJpdHlDb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWlzVGV4dEJpbmRpbmcgJiYgKHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQXR0cmlidXRlIHx8IHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQW5pbWF0aW9uKSkge1xuICAgICAgLy8gQWdhaW4sIHRoaXMgYmluZGluZyBkb2Vzbid0IHJlYWxseSB0YXJnZXQgdGhlIG5nLXRlbXBsYXRlOyBpdCBhY3R1YWxseSB0YXJnZXRzIHRoZSBlbGVtZW50XG4gICAgICAvLyBpbnNpZGUgdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUuIEluIHRoZSBjYXNlIG9mIG5vbi10ZXh0IGF0dHJpYnV0ZSBvciBhbmltYXRpb24gYmluZGluZ3MsXG4gICAgICAvLyB0aGUgYmluZGluZyBkb2Vzbid0IGV2ZW4gc2hvdyB1cCBvbiB0aGUgbmctdGVtcGxhdGUgY29uc3QgYXJyYXksIHNvIHdlIGp1c3Qgc2tpcCBpdFxuICAgICAgLy8gZW50aXJlbHkuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsZXQgYmluZGluZ1R5cGUgPSBCSU5ESU5HX0tJTkRTLmdldCh0eXBlKSE7XG5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAvLyBXZSBrbm93IHdlIGFyZSBkZWFsaW5nIHdpdGggYmluZGluZ3MgZGlyZWN0bHkgb24gYW4gZXhwbGljaXQgbmctdGVtcGxhdGUuXG4gICAgLy8gU3RhdGljIGF0dHJpYnV0ZSBiaW5kaW5ncyBzaG91bGQgYmUgY29sbGVjdGVkIGludG8gdGhlIGNvbnN0IGFycmF5IGFzIGsvdiBwYWlycy4gUHJvcGVydHlcbiAgICAvLyBiaW5kaW5ncyBzaG91bGQgcmVzdWx0IGluIGEgYHByb3BlcnR5YCBpbnN0cnVjdGlvbiwgYW5kIGBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3NgIGNvbnN0XG4gICAgLy8gZW50cmllcy5cbiAgICAvL1xuICAgIC8vIFRoZSBkaWZmaWN1bHR5IGlzIHdpdGggZHluYW1pYyBhdHRyaWJ1dGUsIHN0eWxlLCBhbmQgY2xhc3MgYmluZGluZ3MuIFRoZXNlIGRvbid0IHJlYWxseSBtYWtlXG4gICAgLy8gc2Vuc2Ugb24gYW4gYG5nLXRlbXBsYXRlYCBhbmQgc2hvdWxkIHByb2JhYmx5IGJlIHBhcnNlciBlcnJvcnMuIEhvd2V2ZXIsXG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBnZW5lcmF0ZXMgYHByb3BlcnR5YCBpbnN0cnVjdGlvbnMgZm9yIHRoZW0sIGFuZCBzbyB3ZSBkbyB0aGF0IGFzXG4gICAgLy8gd2VsbC5cbiAgICAvL1xuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBoYXZlIGEgc2xpZ2h0IGJlaGF2aW9yIGRpZmZlcmVuY2Ugd2l0aCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyOiBhbHRob3VnaFxuICAgIC8vIFREQiBlbWl0cyBgcHJvcGVydHlgIGluc3RydWN0aW9ucyBmb3IgZHluYW1pYyBhdHRyaWJ1dGVzLCBzdHlsZXMsIGFuZCBjbGFzc2VzLCBvbmx5IHN0eWxlc1xuICAgIC8vIGFuZCBjbGFzc2VzIGFsc28gZ2V0IGNvbnN0IGNvbGxlY3RlZCBpbnRvIHRoZSBgQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzYCBmaWVsZC4gRHluYW1pY1xuICAgIC8vIGF0dHJpYnV0ZSBiaW5kaW5ncyBhcmUgbWlzc2luZyBmcm9tIHRoZSBjb25zdHMgZW50aXJlbHkuIFdlIGNob29zZSB0byBlbWl0IHRoZW0gaW50byB0aGVcbiAgICAvLyBjb25zdHMgZmllbGQgYW55d2F5LCB0byBhdm9pZCBjcmVhdGluZyBzcGVjaWFsIGNhc2VzIGZvciBzb21ldGhpbmcgc28gYXJjYW5lIGFuZCBub25zZW5zaWNhbC5cbiAgICBpZiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5DbGFzcyB8fCB0eXBlID09PSBlLkJpbmRpbmdUeXBlLlN0eWxlIHx8XG4gICAgICAgICh0eXBlID09PSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSAmJiAhaXNUZXh0QmluZGluZykpIHtcbiAgICAgIC8vIFRPRE86IFRoZXNlIGNhc2VzIHNob3VsZCBiZSBwYXJzZSBlcnJvcnMuXG4gICAgICBiaW5kaW5nVHlwZSA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICB4cmVmLCBiaW5kaW5nVHlwZSwgbmFtZSwgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHZpZXcuam9iLCB2YWx1ZSwgaTE4bk1lc3NhZ2UpLCB1bml0LFxuICAgICAgc2VjdXJpdHlDb250ZXh0LCBpc1RleHRCaW5kaW5nLCBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSwgdGVtcGxhdGVLaW5kLCBpMThuTWVzc2FnZSxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBtYWtlTGlzdGVuZXJIYW5kbGVyT3BzKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgaGFuZGxlcjogZS5BU1QsIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcFtdIHtcbiAgaGFuZGxlciA9IGFzdE9mKGhhbmRsZXIpO1xuICBjb25zdCBoYW5kbGVyT3BzID0gbmV3IEFycmF5PGlyLlVwZGF0ZU9wPigpO1xuICBsZXQgaGFuZGxlckV4cHJzOiBlLkFTVFtdID0gaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4gPyBoYW5kbGVyLmV4cHJlc3Npb25zIDogW2hhbmRsZXJdO1xuICBpZiAoaGFuZGxlckV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gaGF2ZSBub24tZW1wdHkgZXhwcmVzc2lvbiBsaXN0LicpO1xuICB9XG4gIGNvbnN0IGV4cHJlc3Npb25zID0gaGFuZGxlckV4cHJzLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGhhbmRsZXJTcGFuKSk7XG4gIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG4gIGhhbmRsZXJPcHMucHVzaCguLi5leHByZXNzaW9ucy5tYXAoXG4gICAgICBlID0+IGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGUsIGUuc291cmNlU3BhbikpKSk7XG4gIGhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwciwgcmV0dXJuRXhwci5zb3VyY2VTcGFuKSkpO1xuICByZXR1cm4gaGFuZGxlck9wcztcbn1cblxuZnVuY3Rpb24gbWFrZVR3b1dheUxpc3RlbmVySGFuZGxlck9wcyhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGhhbmRsZXI6IGUuQVNULCBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3BbXSB7XG4gIGhhbmRsZXIgPSBhc3RPZihoYW5kbGVyKTtcbiAgY29uc3QgaGFuZGxlck9wcyA9IG5ldyBBcnJheTxpci5VcGRhdGVPcD4oKTtcblxuICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICBpZiAoaGFuZGxlci5leHByZXNzaW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmV4cHJlc3Npb25zWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGlzIGlzIHZhbGlkYXRlZCBkdXJpbmcgcGFyc2luZyBhbHJlYWR5LCBidXQgd2UgZG8gaXQgaGVyZSBqdXN0IGluIGNhc2UuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHR3by13YXkgbGlzdGVuZXIgdG8gaGF2ZSBhIHNpbmdsZSBleHByZXNzaW9uLicpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGhhbmRsZXJFeHByID0gY29udmVydEFzdChoYW5kbGVyLCB1bml0LmpvYiwgaGFuZGxlclNwYW4pO1xuICBjb25zdCBldmVudFJlZmVyZW5jZSA9IG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoJyRldmVudCcpO1xuICBjb25zdCB0d29XYXlTZXRFeHByID0gbmV3IGlyLlR3b1dheUJpbmRpbmdTZXRFeHByKGhhbmRsZXJFeHByLCBldmVudFJlZmVyZW5jZSk7XG5cbiAgaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHR3b1dheVNldEV4cHIpKSk7XG4gIGhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZXZlbnRSZWZlcmVuY2UpKSk7XG4gIHJldHVybiBoYW5kbGVyT3BzO1xufVxuXG5mdW5jdGlvbiBhc3RPZihhc3Q6IGUuQVNUfGUuQVNUV2l0aFNvdXJjZSk6IGUuQVNUIHtcbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSA/IGFzdC5hc3QgOiBhc3Q7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICAgIHNwYW46IGUuUGFyc2VTcGFuLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gIGlmIChiYXNlU291cmNlU3BhbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICBjb25zdCBlbmQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICBjb25zdCBmdWxsU3RhcnQgPSBiYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kLCBmdWxsU3RhcnQpO1xufVxuXG4vKipcbiAqIFdpdGggdGhlIGRpcmVjdGl2ZS1iYXNlZCBjb250cm9sIGZsb3cgdXNlcnMgd2VyZSBhYmxlIHRvIGNvbmRpdGlvbmFsbHkgcHJvamVjdCBjb250ZW50IHVzaW5nXG4gKiB0aGUgYCpgIHN5bnRheC4gRS5nLiBgPGRpdiAqbmdJZj1cImV4cHJcIiBwcm9qZWN0TWU+PC9kaXY+YCB3aWxsIGJlIHByb2plY3RlZCBpbnRvXG4gKiBgPG5nLWNvbnRlbnQgc2VsZWN0PVwiW3Byb2plY3RNZV1cIi8+YCwgYmVjYXVzZSB0aGUgYXR0cmlidXRlcyBhbmQgdGFnIG5hbWUgZnJvbSB0aGUgYGRpdmAgYXJlXG4gKiBjb3BpZWQgdG8gdGhlIHRlbXBsYXRlIHZpYSB0aGUgdGVtcGxhdGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24uIFdpdGggYEBpZmAgYW5kIGBAZm9yYCB0aGF0IGlzXG4gKiBub3QgdGhlIGNhc2UsIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsIGlzIHBsYWNlZCAqYXJvdW5kKiBlbGVtZW50cywgcmF0aGVyIHRoYW4gKm9uKiB0aGVtLlxuICogVGhlIHJlc3VsdCBpcyB0aGF0IGNvbnRlbnQgcHJvamVjdGlvbiB3b24ndCB3b3JrIGluIHRoZSBzYW1lIHdheSBpZiBhIHVzZXIgY29udmVydHMgZnJvbVxuICogYCpuZ0lmYCB0byBgQGlmYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFpbXMgdG8gY292ZXIgdGhlIG1vc3QgY29tbW9uIGNhc2UgYnkgZG9pbmcgdGhlIHNhbWUgY29weWluZyB3aGVuIGEgY29udHJvbCBmbG93XG4gKiBub2RlIGhhcyAqb25lIGFuZCBvbmx5IG9uZSogcm9vdCBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUuXG4gKlxuICogVGhpcyBhcHByb2FjaCBjb21lcyB3aXRoIHNvbWUgY2F2ZWF0czpcbiAqIDEuIEFzIHNvb24gYXMgYW55IG90aGVyIG5vZGUgaXMgYWRkZWQgdG8gdGhlIHJvb3QsIHRoZSBjb3B5aW5nIGJlaGF2aW9yIHdvbid0IHdvcmsgYW55bW9yZS5cbiAqICAgIEEgZGlhZ25vc3RpYyB3aWxsIGJlIGFkZGVkIHRvIGZsYWcgY2FzZXMgbGlrZSB0aGlzIGFuZCB0byBleHBsYWluIGhvdyB0byB3b3JrIGFyb3VuZCBpdC5cbiAqIDIuIElmIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzYCBpcyBlbmFibGVkLCBpdCdzIHZlcnkgbGlrZWx5IHRoYXQgaW5kZW50YXRpb24gd2lsbCBicmVhayB0aGlzXG4gKiAgICB3b3JrYXJvdW5kLCBiZWNhdXNlIGl0J2xsIGluY2x1ZGUgYW4gYWRkaXRpb25hbCB0ZXh0IG5vZGUgYXMgdGhlIGZpcnN0IGNoaWxkLiBXZSBjYW4gd29ya1xuICogICAgYXJvdW5kIGl0IGhlcmUsIGJ1dCBpbiBhIGRpc2N1c3Npb24gaXQgd2FzIGRlY2lkZWQgbm90IHRvLCBiZWNhdXNlIHRoZSB1c2VyIGV4cGxpY2l0bHkgb3B0ZWRcbiAqICAgIGludG8gcHJlc2VydmluZyB0aGUgd2hpdGVzcGFjZSBhbmQgd2Ugd291bGQgaGF2ZSB0byBkcm9wIGl0IGZyb20gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICogICAgVGhlIGRpYWdub3N0aWMgbWVudGlvbmVkIHBvaW50ICMxIHdpbGwgZmxhZyBzdWNoIGNhc2VzIHRvIHVzZXJzLlxuICpcbiAqIEByZXR1cm5zIFRhZyBuYW1lIHRvIGJlIHVzZWQgZm9yIHRoZSBjb250cm9sIGZsb3cgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLFxuICAgIG5vZGU6IHQuSWZCbG9ja0JyYW5jaHx0LlN3aXRjaEJsb2NrQ2FzZXx0LkZvckxvb3BCbG9ja3x0LkZvckxvb3BCbG9ja0VtcHR5KTogc3RyaW5nfG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50fHQuVGVtcGxhdGV8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5FbGVtZW50IHx8IChjaGlsZCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgY2hpbGQudGFnTmFtZSAhPT0gbnVsbCkpIHtcbiAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgYXR0cmlidXRlcyBjYW4gYmVcbiAgLy8gY29waWVkIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uXG4gIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgLy8gQ29sbGVjdCB0aGUgc3RhdGljIGF0dHJpYnV0ZXMgZm9yIGNvbnRlbnQgcHJvamVjdGlvbiBwdXJwb3Nlcy5cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygcm9vdC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgICAgdW5pdC51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgICAgeHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgbnVsbCwgc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgIHRydWUsIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgfVxuXG4gICAgLy8gQWxzbyBjb2xsZWN0IHRoZSBpbnB1dHMgc2luY2UgdGhleSBwYXJ0aWNpcGF0ZSBpbiBjb250ZW50IHByb2plY3Rpb24gYXMgd2VsbC5cbiAgICAvLyBOb3RlIHRoYXQgVERCIHVzZWQgdG8gY29sbGVjdCB0aGUgb3V0cHV0cyBhcyB3ZWxsLCBidXQgaXQgd2Fzbid0IHBhc3NpbmcgdGhlbSBpbnRvXG4gICAgLy8gdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLiBIZXJlIHdlIGp1c3QgZG9uJ3QgY29sbGVjdCB0aGVtLlxuICAgIGZvciAoY29uc3QgYXR0ciBvZiByb290LmlucHV0cykge1xuICAgICAgaWYgKGF0dHIudHlwZSAhPT0gZS5CaW5kaW5nVHlwZS5BbmltYXRpb24gJiYgYXR0ci50eXBlICE9PSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgeHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIGF0dHIubmFtZSwgbnVsbCwgbnVsbCwgbnVsbCwgc2VjdXJpdHlDb250ZXh0KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZSA9IHJvb3QgaW5zdGFuY2VvZiB0LkVsZW1lbnQgPyByb290Lm5hbWUgOiByb290LnRhZ05hbWU7XG5cbiAgICAvLyBEb24ndCBwYXNzIGFsb25nIGBuZy10ZW1wbGF0ZWAgdGFnIG5hbWUgc2luY2UgaXQgZW5hYmxlcyBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgcmV0dXJuIHRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FID8gbnVsbCA6IHRhZ05hbWU7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==