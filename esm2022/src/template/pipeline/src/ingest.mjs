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
import { icuFromI18nMessage, isSingleI18nIcu } from '../../../render3/view/i18n/util';
import { DomElementSchemaRegistry } from '../../../schema/dom_element_schema_registry';
import * as ir from '../ir';
import { ComponentCompilationJob, HostBindingCompilationJob } from './compilation';
import { BINARY_OPERATORS, namespaceForKey, prefixWithNamespace } from './conversion';
const compatibilityMode = ir.CompatibilityMode.TemplateDefinitionBuilder;
// Schema containing DOM elements and their properties.
const domSchema = new DomElementSchemaRegistry();
// Tag name of the `ng-template` element.
const NG_TEMPLATE_TAG_NAME = 'ng-template';
/**
 * Process a template AST and convert it into a `ComponentCompilation` in the intermediate
 * representation.
 * TODO: Refactor more of the ingestion code into phases.
 */
export function ingestComponent(componentName, template, constantPool, relativeContextFilePath, i18nUseExternalIds, deferBlocksMeta, allDeferrableDepsFn) {
    const job = new ComponentCompilationJob(componentName, constantPool, compatibilityMode, relativeContextFilePath, i18nUseExternalIds, deferBlocksMeta, allDeferrableDepsFn);
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
    const [phase, target] = event.type !== 1 /* e.ParsedEventType.Animation */ ? [null, event.targetOrPhase] :
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
    const op = ir.createProjectionOp(unit.job.allocateXrefId(), content.selector, content.i18n, content.sourceSpan);
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
        let tagName = null;
        // Only the first branch can be used for projection, because the conditional
        // uses the container of the first branch as the insertion point for all branches.
        if (i === 0) {
            tagName = ingestControlFlowInsertionPoint(unit, cView.xref, ifCase);
        }
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
        let switchCaseI18nMeta = undefined;
        if (switchCase.i18n !== undefined) {
            if (!(switchCase.i18n instanceof i18n.BlockPlaceholder)) {
                throw Error(`Unhandled i18n metadata type for switch block: ${switchCase.i18n?.constructor.name}`);
            }
            switchCaseI18nMeta = switchCase.i18n;
        }
        const templateOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, null, 'Case', ir.Namespace.HTML, switchCaseI18nMeta, switchCase.startSourceSpan, switchCase.sourceSpan);
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
    const blockMeta = unit.job.deferBlocksMeta.get(deferBlock);
    if (blockMeta === undefined) {
        throw new Error(`AssertionError: unable to find metadata for deferred block`);
    }
    // Generate the defer main view and all secondary views.
    const main = ingestDeferView(unit, '', deferBlock.i18n, deferBlock.children, deferBlock.sourceSpan);
    const loading = ingestDeferView(unit, 'Loading', deferBlock.loading?.i18n, deferBlock.loading?.children, deferBlock.loading?.sourceSpan);
    const placeholder = ingestDeferView(unit, 'Placeholder', deferBlock.placeholder?.i18n, deferBlock.placeholder?.children, deferBlock.placeholder?.sourceSpan);
    const error = ingestDeferView(unit, 'Error', deferBlock.error?.i18n, deferBlock.error?.children, deferBlock.error?.sourceSpan);
    // Create the main defer op, and ops for all secondary views.
    const deferXref = unit.job.allocateXrefId();
    const deferOp = ir.createDeferOp(deferXref, main.xref, main.handle, blockMeta, unit.job.allDeferrableDepsFn, deferBlock.sourceSpan);
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
        const icuNode = icu.i18n.nodes[0];
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
    // Set all the context variables and aliases available in the repeater.
    repeaterView.contextVariables.set(forBlock.item.name, forBlock.item.value);
    repeaterView.contextVariables.set(forBlock.contextVariables.$index.name, forBlock.contextVariables.$index.value);
    repeaterView.contextVariables.set(forBlock.contextVariables.$count.name, forBlock.contextVariables.$count.value);
    // We copy TemplateDefinitionBuilder's scheme of creating names for `$count` and `$index` that are
    // suffixed with special information, to disambiguate which level of nested loop the below aliases
    // refer to.
    // TODO: We should refactor Template Pipeline's variable phases to gracefully handle shadowing,
    // and arbitrarily many levels of variables depending on each other.
    const indexName = `ɵ${forBlock.contextVariables.$index.name}_${repeaterView.xref}`;
    const countName = `ɵ${forBlock.contextVariables.$count.name}_${repeaterView.xref}`;
    repeaterView.contextVariables.set(indexName, forBlock.contextVariables.$index.value);
    repeaterView.contextVariables.set(countName, forBlock.contextVariables.$count.value);
    repeaterView.aliases.add({
        kind: ir.SemanticVariableKind.Alias,
        name: null,
        identifier: forBlock.contextVariables.$first.name,
        expression: new ir.LexicalReadExpr(indexName).identical(o.literal(0))
    });
    repeaterView.aliases.add({
        kind: ir.SemanticVariableKind.Alias,
        name: null,
        identifier: forBlock.contextVariables.$last.name,
        expression: new ir.LexicalReadExpr(indexName).identical(new ir.LexicalReadExpr(countName).minus(o.literal(1)))
    });
    repeaterView.aliases.add({
        kind: ir.SemanticVariableKind.Alias,
        name: null,
        identifier: forBlock.contextVariables.$even.name,
        expression: new ir.LexicalReadExpr(indexName).modulo(o.literal(2)).identical(o.literal(0))
    });
    repeaterView.aliases.add({
        kind: ir.SemanticVariableKind.Alias,
        name: null,
        identifier: forBlock.contextVariables.$odd.name,
        expression: new ir.LexicalReadExpr(indexName).modulo(o.literal(2)).notIdentical(o.literal(0))
    });
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
        $index: forBlock.contextVariables.$index.name,
        $count: forBlock.contextVariables.$count.name,
        $first: forBlock.contextVariables.$first.name,
        $last: forBlock.contextVariables.$last.name,
        $even: forBlock.contextVariables.$even.name,
        $odd: forBlock.contextVariables.$odd.name,
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
    [0 /* e.BindingType.Property */, ir.BindingKind.Property],
    [5 /* e.BindingType.TwoWay */, ir.BindingKind.TwoWayProperty],
    [1 /* e.BindingType.Attribute */, ir.BindingKind.Attribute],
    [2 /* e.BindingType.Class */, ir.BindingKind.ClassName],
    [3 /* e.BindingType.Style */, ir.BindingKind.StyleProperty],
    [4 /* e.BindingType.Animation */, ir.BindingKind.Animation],
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
    for (const attr of element.attributes) {
        // Attribute literal bindings, such as `attr.foo="bar"`.
        const securityContext = domSchema.securityContext(element.name, attr.name, true);
        bindings.push(ir.createBindingOp(op.xref, ir.BindingKind.Attribute, attr.name, convertAstWithInterpolation(unit.job, attr.value, attr.i18n), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
    }
    for (const input of element.inputs) {
        // All dynamic bindings (both attribute and property bindings).
        bindings.push(ir.createBindingOp(op.xref, BINDING_KINDS.get(input.type), input.name, convertAstWithInterpolation(unit.job, astOf(input.value), input.i18n), input.unit, input.securityContext, false, false, null, asMessage(input.i18n) ?? null, input.sourceSpan));
    }
    unit.create.push(bindings.filter((b) => b?.kind === ir.OpKind.ExtractedAttribute));
    unit.update.push(bindings.filter((b) => b?.kind === ir.OpKind.Binding));
    for (const output of element.outputs) {
        if (output.type === 1 /* e.ParsedEventType.Animation */ && output.phase === null) {
            throw Error('Animation listener should have a phase');
        }
        if (output.type === 2 /* e.ParsedEventType.TwoWay */) {
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
            bindings.push(createTemplateBinding(unit, op.xref, 1 /* e.BindingType.Attribute */, attr.name, attr.value, null, securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
        }
        else {
            bindings.push(createTemplateBinding(unit, op.xref, attr.type, attr.name, astOf(attr.value), attr.unit, attr.securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
        }
    }
    for (const attr of template.attributes) {
        // Attribute literal bindings, such as `attr.foo="bar"`.
        const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
        bindings.push(createTemplateBinding(unit, op.xref, 1 /* e.BindingType.Attribute */, attr.name, attr.value, null, securityContext, false, templateKind, asMessage(attr.i18n), attr.sourceSpan));
    }
    for (const input of template.inputs) {
        // Dynamic bindings (both attribute and property bindings).
        bindings.push(createTemplateBinding(unit, op.xref, input.type, input.name, astOf(input.value), input.unit, input.securityContext, false, templateKind, asMessage(input.i18n), input.sourceSpan));
    }
    unit.create.push(bindings.filter((b) => b?.kind === ir.OpKind.ExtractedAttribute));
    unit.update.push(bindings.filter((b) => b?.kind === ir.OpKind.Binding));
    for (const output of template.outputs) {
        if (output.type === 1 /* e.ParsedEventType.Animation */ && output.phase === null) {
            throw Error('Animation listener should have a phase');
        }
        if (templateKind === ir.TemplateKind.NgTemplate) {
            if (output.type === 2 /* e.ParsedEventType.TwoWay */) {
                unit.create.push(ir.createTwoWayListenerOp(op.xref, op.handle, output.name, op.tag, makeTwoWayListenerHandlerOps(unit, output.handler, output.handlerSpan), output.sourceSpan));
            }
            else {
                unit.create.push(ir.createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
            }
        }
        if (templateKind === ir.TemplateKind.Structural &&
            output.type !== 1 /* e.ParsedEventType.Animation */) {
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
                case 0 /* e.BindingType.Property */:
                case 2 /* e.BindingType.Class */:
                case 3 /* e.BindingType.Style */:
                    // Because this binding doesn't really target the ng-template, it must be a binding on an
                    // inner node of a structural template. We can't skip it entirely, because we still need
                    // it on the ng-template's consts (e.g. for the purposes of directive matching). However,
                    // we should not generate an update instruction for it.
                    return ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, null, name, null, null, i18nMessage, securityContext);
                case 5 /* e.BindingType.TwoWay */:
                    return ir.createExtractedAttributeOp(xref, ir.BindingKind.TwoWayProperty, null, name, null, null, i18nMessage, securityContext);
            }
        }
        if (!isTextBinding && (type === 1 /* e.BindingType.Attribute */ || type === 4 /* e.BindingType.Animation */)) {
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
        if (type === 2 /* e.BindingType.Class */ || type === 3 /* e.BindingType.Style */ ||
            (type === 1 /* e.BindingType.Attribute */ && !isTextBinding)) {
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
    // If we've found a single root node, its tag name and *static* attributes can be copied
    // to the surrounding template to be used for content projection. Note that it's important
    // that we don't copy any bound attributes since they don't participate in content projection
    // and they can be used in directive matching (in the case of `Template.templateAttrs`).
    if (root !== null) {
        for (const attr of root.attributes) {
            const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
            unit.update.push(ir.createBindingOp(xref, ir.BindingKind.Attribute, attr.name, o.literal(attr.value), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
        }
        const tagName = root instanceof t.Element ? root.name : root.tagName;
        // Don't pass along `ng-template` tag name since it enables directive matching.
        return tagName === NG_TEMPLATE_TAG_NAME ? null : tagName;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBa0IsdUJBQXVCLEVBQUUseUJBQXlCLEVBQWdELE1BQU0sZUFBZSxDQUFDO0FBQ2pKLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFcEYsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUM7QUFFekUsdURBQXVEO0FBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksd0JBQXdCLEVBQUUsQ0FBQztBQUVqRCx5Q0FBeUM7QUFDekMsTUFBTSxvQkFBb0IsR0FBRyxhQUFhLENBQUM7QUFFM0M7Ozs7R0FJRztBQUNILE1BQU0s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O0lBQ3hGLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ2xCLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ25DLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6RixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUMvQixJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUN2RixJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUVyRSwrRUFBK0U7UUFDL0UsT0FBTyxPQUFPLEtBQUssb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQzNELENBQUM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgZSBmcm9tICcuLi8uLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQge1IzRGVmZXJCbG9ja01ldGFkYXRhfSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7aWN1RnJvbUkxOG5NZXNzYWdlLCBpc1NpbmdsZUkxOG5JY3V9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge0NvbXBpbGF0aW9uVW5pdCwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5pbXBvcnQge0JJTkFSWV9PUEVSQVRPUlMsIG5hbWVzcGFjZUZvcktleSwgcHJlZml4V2l0aE5hbWVzcGFjZX0gZnJvbSAnLi9jb252ZXJzaW9uJztcblxuY29uc3QgY29tcGF0aWJpbGl0eU1vZGUgPSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyO1xuXG4vLyBTY2hlbWEgY29udGFpbmluZyBET00gZWxlbWVudHMgYW5kIHRoZWlyIHByb3BlcnRpZXMuXG5jb25zdCBkb21TY2hlbWEgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbi8vIFRhZyBuYW1lIG9mIHRoZSBgbmctdGVtcGxhdGVgIGVsZW1lbnQuXG5jb25zdCBOR19URU1QTEFURV9UQUdfTkFNRSA9ICduZy10ZW1wbGF0ZSc7XG5cbi8qKlxuICogUHJvY2VzcyBhIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYENvbXBvbmVudENvbXBpbGF0aW9uYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqIFRPRE86IFJlZmFjdG9yIG1vcmUgb2YgdGhlIGluZ2VzdGlvbiBjb2RlIGludG8gcGhhc2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0Q29tcG9uZW50KFxuICAgIGNvbXBvbmVudE5hbWU6IHN0cmluZywgdGVtcGxhdGU6IHQuTm9kZVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLCBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4sXG4gICAgZGVmZXJCbG9ja3NNZXRhOiBNYXA8dC5EZWZlcnJlZEJsb2NrLCBSM0RlZmVyQmxvY2tNZXRhZGF0YT4sXG4gICAgYWxsRGVmZXJyYWJsZURlcHNGbjogby5SZWFkVmFyRXhwcnxudWxsKTogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IoXG4gICAgICBjb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgaTE4blVzZUV4dGVybmFsSWRzLFxuICAgICAgZGVmZXJCbG9ja3NNZXRhLCBhbGxEZWZlcnJhYmxlRGVwc0ZuKTtcbiAgaW5nZXN0Tm9kZXMoam9iLnJvb3QsIHRlbXBsYXRlKTtcbiAgcmV0dXJuIGpvYjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb3N0QmluZGluZ0lucHV0IHtcbiAgY29tcG9uZW50TmFtZTogc3RyaW5nO1xuICBjb21wb25lbnRTZWxlY3Rvcjogc3RyaW5nO1xuICBwcm9wZXJ0aWVzOiBlLlBhcnNlZFByb3BlcnR5W118bnVsbDtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGV2ZW50czogZS5QYXJzZWRFdmVudFtdfG51bGw7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIGhvc3QgYmluZGluZyBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgIGlucHV0OiBIb3N0QmluZGluZ0lucHV0LCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGpvYiA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKGlucHV0LmNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUpO1xuICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIGlucHV0LnByb3BlcnRpZXMgPz8gW10pIHtcbiAgICBsZXQgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eTtcbiAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCByZWFsbHkgYmUgaGFuZGxlZCBpbiB0aGUgcGFyc2VyLlxuICAgIGlmIChwcm9wZXJ0eS5uYW1lLnN0YXJ0c1dpdGgoJ2F0dHIuJykpIHtcbiAgICAgIHByb3BlcnR5Lm5hbWUgPSBwcm9wZXJ0eS5uYW1lLnN1YnN0cmluZygnYXR0ci4nLmxlbmd0aCk7XG4gICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZTtcbiAgICB9XG4gICAgaWYgKHByb3BlcnR5LmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbjtcbiAgICB9XG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXJcbiAgICAgICAgICAgIC5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgICAgICAgICAgICAgIGlucHV0LmNvbXBvbmVudFNlbGVjdG9yLCBwcm9wZXJ0eS5uYW1lLCBiaW5kaW5nS2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKVxuICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IFNlY3VyaXR5Q29udGV4dC5OT05FKTtcbiAgICBpbmdlc3RIb3N0UHJvcGVydHkoam9iLCBwcm9wZXJ0eSwgYmluZGluZ0tpbmQsIHNlY3VyaXR5Q29udGV4dHMpO1xuICB9XG4gIGZvciAoY29uc3QgW25hbWUsIGV4cHJdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0LmF0dHJpYnV0ZXMpID8/IFtdKSB7XG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhpbnB1dC5jb21wb25lbnRTZWxlY3RvciwgbmFtZSwgdHJ1ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgaW5nZXN0SG9zdEF0dHJpYnV0ZShqb2IsIG5hbWUsIGV4cHIsIHNlY3VyaXR5Q29udGV4dHMpO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgaW5wdXQuZXZlbnRzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEV2ZW50KGpvYiwgZXZlbnQpO1xuICB9XG4gIHJldHVybiBqb2I7XG59XG5cbi8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciB0aGUgcGFyc2VyIHRvIHVzZSB0aGUgc2FtZSB0eXBlcyBhbmQgc3RydWN0dXJlcyBmb3IgaG9zdCBiaW5kaW5ncyBhc1xuLy8gd2l0aCBvcmRpbmFyeSBjb21wb25lbnRzLiBUaGlzIHdvdWxkIGFsbG93IHVzIHRvIHNoYXJlIGEgbG90IG1vcmUgaW5nZXN0aW9uIGNvZGUuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdFByb3BlcnR5KFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgcHJvcGVydHk6IGUuUGFyc2VkUHJvcGVydHksIGJpbmRpbmdLaW5kOiBpci5CaW5kaW5nS2luZCxcbiAgICBzZWN1cml0eUNvbnRleHRzOiBTZWN1cml0eUNvbnRleHRbXSk6IHZvaWQge1xuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGNvbnN0IGFzdCA9IHByb3BlcnR5LmV4cHJlc3Npb24uYXN0O1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgZXhwcmVzc2lvbiA9IG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICBhc3Quc3RyaW5ncywgYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSksIFtdKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdChhc3QsIGpvYiwgcHJvcGVydHkuc291cmNlU3Bhbik7XG4gIH1cbiAgam9iLnJvb3QudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgYmluZGluZ0tpbmQsIHByb3BlcnR5Lm5hbWUsIGV4cHJlc3Npb24sIG51bGwsIHNlY3VyaXR5Q29udGV4dHMsIGZhbHNlLCBmYWxzZSxcbiAgICAgIG51bGwsIC8qIFRPRE86IEhvdyBkbyBIb3N0IGJpbmRpbmdzIGhhbmRsZSBpMThuIGF0dHJzPyAqLyBudWxsLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QXR0cmlidXRlKFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uLFxuICAgIHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBuYW1lLCB2YWx1ZSwgbnVsbCwgc2VjdXJpdHlDb250ZXh0cyxcbiAgICAgIC8qIEhvc3QgYXR0cmlidXRlcyBzaG91bGQgYWx3YXlzIGJlIGV4dHJhY3RlZCB0byBjb25zdCBob3N0QXR0cnMsIGV2ZW4gaWYgdGhleSBhcmUgbm90XG4gICAgICAgKnN0cmljdGx5KiB0ZXh0IGxpdGVyYWxzICovXG4gICAgICB0cnVlLCBmYWxzZSwgbnVsbCxcbiAgICAgIC8qIFRPRE8gKi8gbnVsbCxcbiAgICAgIC8qKiBUT0RPOiBNYXkgYmUgbnVsbD8gKi8gdmFsdWUuc291cmNlU3BhbiEpO1xuICBqb2Iucm9vdC51cGRhdGUucHVzaChhdHRyQmluZGluZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0RXZlbnQoam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBldmVudDogZS5QYXJzZWRFdmVudCkge1xuICBjb25zdCBbcGhhc2UsIHRhcmdldF0gPSBldmVudC50eXBlICE9PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gPyBbbnVsbCwgZXZlbnQudGFyZ2V0T3JQaGFzZV0gOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbZXZlbnQudGFyZ2V0T3JQaGFzZSwgbnVsbF07XG4gIGNvbnN0IGV2ZW50QmluZGluZyA9IGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBldmVudC5uYW1lLCBudWxsLFxuICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyhqb2Iucm9vdCwgZXZlbnQuaGFuZGxlciwgZXZlbnQuaGFuZGxlclNwYW4pLCBwaGFzZSwgdGFyZ2V0LCB0cnVlLFxuICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gIGpvYi5yb290LmNyZWF0ZS5wdXNoKGV2ZW50QmluZGluZyk7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQ29udGVudCkge1xuICAgICAgaW5nZXN0Q29udGVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGluZ2VzdFRleHQodW5pdCwgbm9kZSwgbnVsbCk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCBub2RlLCBudWxsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LklmQmxvY2spIHtcbiAgICAgIGluZ2VzdElmQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Td2l0Y2hCbG9jaykge1xuICAgICAgaW5nZXN0U3dpdGNoQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5EZWZlcnJlZEJsb2NrKSB7XG4gICAgICBpbmdlc3REZWZlckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWN1KSB7XG4gICAgICBpbmdlc3RJY3UodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Gb3JMb29wQmxvY2spIHtcbiAgICAgIGluZ2VzdEZvckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBlbGVtZW50IEFTVCBmcm9tIHRoZSB0ZW1wbGF0ZSBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBlbGVtZW50OiB0LkVsZW1lbnQpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCBlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2VsZW1lbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgICAgZWxlbWVudE5hbWUsIGlkLCBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlS2V5KSxcbiAgICAgIGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyBlbGVtZW50LmkxOG4gOiB1bmRlZmluZWQsXG4gICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChzdGFydE9wKTtcblxuICBpbmdlc3RFbGVtZW50QmluZGluZ3ModW5pdCwgc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG5cbiAgLy8gU3RhcnQgaTE4biwgaWYgbmVlZGVkLCBnb2VzIGFmdGVyIHRoZSBlbGVtZW50IGNyZWF0ZSBhbmQgYmluZGluZ3MsIGJ1dCBiZWZvcmUgdGhlIG5vZGVzXG4gIGxldCBpMThuQmxvY2tJZDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBpZiAoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgaTE4bkJsb2NrSWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5TdGFydE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmkxOG4sIHVuZGVmaW5lZCwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGluZ2VzdE5vZGVzKHVuaXQsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gIC8vIFRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGVuZCBvcCBpcyB0eXBpY2FsbHkgdGhlIGVsZW1lbnQgY2xvc2luZyB0YWcuIEhvd2V2ZXIsIGlmIG5vIGNsb3NpbmcgdGFnXG4gIC8vIGV4aXN0cywgc3VjaCBhcyBpbiBgPGlucHV0PmAsIHdlIHVzZSB0aGUgc3RhcnQgc291cmNlIHNwYW4gaW5zdGVhZC4gVXN1YWxseSB0aGUgc3RhcnQgYW5kIGVuZFxuICAvLyBpbnN0cnVjdGlvbnMgd2lsbCBiZSBjb2xsYXBzZWQgaW50byBvbmUgYGVsZW1lbnRgIGluc3RydWN0aW9uLCBuZWdhdGluZyB0aGUgcHVycG9zZSBvZiB0aGlzXG4gIC8vIGZhbGxiYWNrLCBidXQgaW4gY2FzZXMgd2hlbiBpdCBpcyBub3QgY29sbGFwc2VkIChzdWNoIGFzIGFuIGlucHV0IHdpdGggYSBiaW5kaW5nKSwgd2Ugc3RpbGxcbiAgLy8gd2FudCB0byBtYXAgdGhlIGVuZCBpbnN0cnVjdGlvbiB0byB0aGUgbWFpbiBlbGVtZW50LlxuICBjb25zdCBlbmRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRFbmRPcChpZCwgZWxlbWVudC5lbmRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChlbmRPcCk7XG5cbiAgLy8gSWYgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGVsZW1lbnQsIGluc2VydCBpMThuIHN0YXJ0IGFuZCBlbmQgb3BzLlxuICBpZiAoaTE4bkJsb2NrSWQgIT09IG51bGwpIHtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgaXIuY3JlYXRlSTE4bkVuZE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pLCBlbmRPcCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBpZiAodG1wbC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEodG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRlbXBsYXRlOiAke3RtcGwuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgbGV0IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID0gdG1wbC50YWdOYW1lO1xuICBsZXQgbmFtZXNwYWNlUHJlZml4OiBzdHJpbmd8bnVsbCA9ICcnO1xuICBpZiAodG1wbC50YWdOYW1lKSB7XG4gICAgW25hbWVzcGFjZVByZWZpeCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2VdID0gc3BsaXROc05hbWUodG1wbC50YWdOYW1lKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyB0bXBsLmkxOG4gOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5hbWVzcGFjZSA9IG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VQcmVmaXgpO1xuICBjb25zdCBmdW5jdGlvbk5hbWVTdWZmaXggPSB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gbnVsbCA/XG4gICAgICAnJyA6XG4gICAgICBwcmVmaXhXaXRoTmFtZXNwYWNlKHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBuYW1lc3BhY2UpO1xuICBjb25zdCB0ZW1wbGF0ZUtpbmQgPVxuICAgICAgaXNQbGFpblRlbXBsYXRlKHRtcGwpID8gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUgOiBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbDtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBjaGlsZFZpZXcueHJlZiwgdGVtcGxhdGVLaW5kLCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgZnVuY3Rpb25OYW1lU3VmZml4LCBuYW1lc3BhY2UsXG4gICAgICBpMThuUGxhY2Vob2xkZXIsIHRtcGwuc3RhcnRTb3VyY2VTcGFuLCB0bXBsLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gIGluZ2VzdFRlbXBsYXRlQmluZGluZ3ModW5pdCwgdGVtcGxhdGVPcCwgdG1wbCwgdGVtcGxhdGVLaW5kKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0ZW1wbGF0ZU9wLCB0bXBsKTtcbiAgaW5nZXN0Tm9kZXMoY2hpbGRWaWV3LCB0bXBsLmNoaWxkcmVuKTtcblxuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgdG1wbC52YXJpYWJsZXMpIHtcbiAgICBjaGlsZFZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQobmFtZSwgdmFsdWUgIT09ICcnID8gdmFsdWUgOiAnJGltcGxpY2l0Jyk7XG4gIH1cblxuICAvLyBJZiB0aGlzIGlzIGEgcGxhaW4gdGVtcGxhdGUgYW5kIHRoZXJlIGlzIGFuIGkxOG4gbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggaXQsIGluc2VydCBpMThuIHN0YXJ0XG4gIC8vIGFuZCBlbmQgb3BzLiBGb3Igc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGVzLCB0aGUgaTE4biBvcHMgd2lsbCBiZSBhZGRlZCB3aGVuIGluZ2VzdGluZyB0aGVcbiAgLy8gZWxlbWVudC90ZW1wbGF0ZSB0aGUgZGlyZWN0aXZlIGlzIHBsYWNlZCBvbi5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUgJiYgdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcihcbiAgICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biwgdW5kZWZpbmVkLCB0bXBsLnN0YXJ0U291cmNlU3BhbiksXG4gICAgICAgIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShcbiAgICAgICAgaXIuY3JlYXRlSTE4bkVuZE9wKGlkLCB0bXBsLmVuZFNvdXJjZVNwYW4gPz8gdG1wbC5zdGFydFNvdXJjZVNwYW4pLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgY29udGVudCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Q29udGVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBjb250ZW50OiB0LkNvbnRlbnQpOiB2b2lkIHtcbiAgaWYgKGNvbnRlbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmICEoY29udGVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgZWxlbWVudDogJHtjb250ZW50LmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcChcbiAgICAgIHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRlbnQuc2VsZWN0b3IsIGNvbnRlbnQuaTE4biwgY29udGVudC5zb3VyY2VTcGFuKTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGNvbnRlbnQuYXR0cmlidXRlcykge1xuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoY29udGVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgIHRydWUsIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cbiAgdW5pdC5jcmVhdGUucHVzaChvcCk7XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZXh0KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuVGV4dCwgaWN1UGxhY2Vob2xkZXI6IHN0cmluZ3xudWxsKTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICBpci5jcmVhdGVUZXh0T3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSwgaWN1UGxhY2Vob2xkZXIsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpY3VQbGFjZWhvbGRlcjogc3RyaW5nfG51bGwpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlcnMgPSB0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lciA/XG4gICAgICB0ZXh0LmkxOG4uY2hpbGRyZW5cbiAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgIC5tYXAocGxhY2Vob2xkZXIgPT4gcGxhY2Vob2xkZXIubmFtZSkgOlxuICAgICAgW107XG4gIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCA+IDAgJiYgaTE4blBsYWNlaG9sZGVycy5sZW5ndGggIT09IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIG51bWJlciBvZiBpMThuIHBsYWNlaG9sZGVycyAoJHtcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2ApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIGljdVBsYWNlaG9sZGVyLCB0ZXh0LnNvdXJjZVNwYW4pKTtcbiAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdCBnZW5lcmF0ZSBzb3VyY2UgbWFwcyBmb3Igc3ViLWV4cHJlc3Npb25zIGluc2lkZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLiBXZSBjb3B5IHRoYXQgYmVoYXZpb3IgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAvLyBUT0RPOiBpcyBpdCBhY3R1YWxseSBjb3JyZWN0IHRvIGdlbmVyYXRlIHRoZXNlIGV4dHJhIG1hcHMgaW4gbW9kZXJuIG1vZGU/XG4gIGNvbnN0IGJhc2VTb3VyY2VTcGFuID0gdW5pdC5qb2IuY29tcGF0aWJpbGl0eSA/IG51bGwgOiB0ZXh0LnNvdXJjZVNwYW47XG4gIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVUZXh0T3AoXG4gICAgICB0ZXh0WHJlZixcbiAgICAgIG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgICAgaTE4blBsYWNlaG9sZGVycyksXG4gICAgICB0ZXh0LnNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBpZmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdElmQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWZCbG9jazogdC5JZkJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaWZCbG9jay5icmFuY2hlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGlmQ2FzZSA9IGlmQmxvY2suYnJhbmNoZXNbaV07XG4gICAgY29uc3QgY1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBsZXQgdGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gICAgLy8gT25seSB0aGUgZmlyc3QgYnJhbmNoIGNhbiBiZSB1c2VkIGZvciBwcm9qZWN0aW9uLCBiZWNhdXNlIHRoZSBjb25kaXRpb25hbFxuICAgIC8vIHVzZXMgdGhlIGNvbnRhaW5lciBvZiB0aGUgZmlyc3QgYnJhbmNoIGFzIHRoZSBpbnNlcnRpb24gcG9pbnQgZm9yIGFsbCBicmFuY2hlcy5cbiAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgY1ZpZXcueHJlZiwgaWZDYXNlKTtcbiAgICB9XG4gICAgaWYgKGlmQ2FzZS5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGNWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGlmQ2FzZS5leHByZXNzaW9uQWxpYXMubmFtZSwgaXIuQ1RYX1JFRik7XG4gICAgfVxuXG4gICAgbGV0IGlmQ2FzZUkxOG5NZXRhID0gdW5kZWZpbmVkO1xuICAgIGlmIChpZkNhc2UuaTE4biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIShpZkNhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGlmIGJsb2NrOiAke2lmQ2FzZS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgICAgfVxuICAgICAgaWZDYXNlSTE4bk1ldGEgPSBpZkNhc2UuaTE4bjtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLCB0YWdOYW1lLCAnQ29uZGl0aW9uYWwnLCBpci5OYW1lc3BhY2UuSFRNTCxcbiAgICAgICAgaWZDYXNlSTE4bk1ldGEsIGlmQ2FzZS5zdGFydFNvdXJjZVNwYW4sIGlmQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRlbXBsYXRlT3AuaGFuZGxlO1xuICAgIH1cblxuICAgIGNvbnN0IGNhc2VFeHByID0gaWZDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KGlmQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCkgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPSBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihcbiAgICAgICAgY2FzZUV4cHIsIHRlbXBsYXRlT3AueHJlZiwgdGVtcGxhdGVPcC5oYW5kbGUsIGlmQ2FzZS5leHByZXNzaW9uQWxpYXMpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgaWZDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9XG4gICAgICBpci5jcmVhdGVDb25kaXRpb25hbE9wKGZpcnN0WHJlZiEsIGZpcnN0U2xvdEhhbmRsZSEsIG51bGwsIGNvbmRpdGlvbnMsIGlmQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQHN3aXRjaGAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIC8vIERvbid0IGluZ2VzdCBlbXB0eSBzd2l0Y2hlcyBzaW5jZSB0aGV5IHdvbid0IHJlbmRlciBhbnl0aGluZy5cbiAgaWYgKHN3aXRjaEJsb2NrLmNhc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3Qgc3dpdGNoQ2FzZSBvZiBzd2l0Y2hCbG9jay5jYXNlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgbGV0IHN3aXRjaENhc2VJMThuTWV0YSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc3dpdGNoQ2FzZS5pMThuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghKHN3aXRjaENhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3Igc3dpdGNoIGJsb2NrOiAke3N3aXRjaENhc2UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaENhc2VJMThuTWV0YSA9IHN3aXRjaENhc2UuaTE4bjtcbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgbnVsbCwgJ0Nhc2UnLCBpci5OYW1lc3BhY2UuSFRNTCwgc3dpdGNoQ2FzZUkxOG5NZXRhLFxuICAgICAgICBzd2l0Y2hDYXNlLnN0YXJ0U291cmNlU3Bhbiwgc3dpdGNoQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgICBmaXJzdFNsb3RIYW5kbGUgPSB0ZW1wbGF0ZU9wLmhhbmRsZTtcbiAgICB9XG4gICAgY29uc3QgY2FzZUV4cHIgPSBzd2l0Y2hDYXNlLmV4cHJlc3Npb24gP1xuICAgICAgICBjb252ZXJ0QXN0KHN3aXRjaENhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIHN3aXRjaEJsb2NrLnN0YXJ0U291cmNlU3BhbikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPVxuICAgICAgICBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdGVtcGxhdGVPcC54cmVmLCB0ZW1wbGF0ZU9wLmhhbmRsZSk7XG4gICAgY29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbmFsQ2FzZUV4cHIpO1xuICAgIGluZ2VzdE5vZGVzKGNWaWV3LCBzd2l0Y2hDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9IGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoXG4gICAgICBmaXJzdFhyZWYhLCBmaXJzdFNsb3RIYW5kbGUhLCBjb252ZXJ0QXN0KHN3aXRjaEJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSwgY29uZGl0aW9ucyxcbiAgICAgIHN3aXRjaEJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKGNvbmRpdGlvbmFsKTtcbn1cblxuZnVuY3Rpb24gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN1ZmZpeDogc3RyaW5nLCBpMThuTWV0YTogaTE4bi5JMThuTWV0YXx1bmRlZmluZWQsXG4gICAgY2hpbGRyZW4/OiB0Lk5vZGVbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IGlyLlRlbXBsYXRlT3B8bnVsbCB7XG4gIGlmIChpMThuTWV0YSAhPT0gdW5kZWZpbmVkICYmICEoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1VuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGRlZmVyIGJsb2NrJyk7XG4gIH1cbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgbnVsbCwgYERlZmVyJHtzdWZmaXh9YCwgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICBpMThuTWV0YSwgc291cmNlU3BhbiEsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IGJsb2NrTWV0YSA9IHVuaXQuam9iLmRlZmVyQmxvY2tzTWV0YS5nZXQoZGVmZXJCbG9jayk7XG4gIGlmIChibG9ja01ldGEgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVuYWJsZSB0byBmaW5kIG1ldGFkYXRhIGZvciBkZWZlcnJlZCBibG9ja2ApO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIGRlZmVyIG1haW4gdmlldyBhbmQgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgbWFpbiA9XG4gICAgICBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suaTE4biwgZGVmZXJCbG9jay5jaGlsZHJlbiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKSE7XG4gIGNvbnN0IGxvYWRpbmcgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnTG9hZGluZycsIGRlZmVyQmxvY2subG9hZGluZz8uaTE4biwgZGVmZXJCbG9jay5sb2FkaW5nPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2subG9hZGluZz8uc291cmNlU3Bhbik7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ1BsYWNlaG9sZGVyJywgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uaTE4biwgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnRXJyb3InLCBkZWZlckJsb2NrLmVycm9yPy5pMThuLCBkZWZlckJsb2NrLmVycm9yPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4pO1xuXG4gIC8vIENyZWF0ZSB0aGUgbWFpbiBkZWZlciBvcCwgYW5kIG9wcyBmb3IgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgZGVmZXJYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgY29uc3QgZGVmZXJPcCA9IGlyLmNyZWF0ZURlZmVyT3AoXG4gICAgICBkZWZlclhyZWYsIG1haW4ueHJlZiwgbWFpbi5oYW5kbGUsIGJsb2NrTWV0YSwgdW5pdC5qb2IuYWxsRGVmZXJyYWJsZURlcHNGbixcbiAgICAgIGRlZmVyQmxvY2suc291cmNlU3Bhbik7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJWaWV3ID0gcGxhY2Vob2xkZXI/LnhyZWYgPz8gbnVsbDtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlclNsb3QgPSBwbGFjZWhvbGRlcj8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ1Nsb3QgPSBsb2FkaW5nPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5lcnJvclNsb3QgPSBlcnJvcj8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/Lm1pbmltdW1UaW1lID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ01pbmltdW1UaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdBZnRlclRpbWUgPSBkZWZlckJsb2NrLmxvYWRpbmc/LmFmdGVyVGltZSA/PyBudWxsO1xuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT3ApO1xuXG4gIC8vIENvbmZpZ3VyZSBhbGwgZGVmZXIgYG9uYCBjb25kaXRpb25zLlxuICAvLyBUT0RPOiByZWZhY3RvciBwcmVmZXRjaCB0cmlnZ2VycyB0byB1c2UgYSBzZXBhcmF0ZSBvcCB0eXBlLCB3aXRoIGEgc2hhcmVkIHN1cGVyY2xhc3MuIFRoaXMgd2lsbFxuICAvLyBtYWtlIGl0IGVhc2llciB0byByZWZhY3RvciBwcmVmZXRjaCBiZWhhdmlvciBpbiB0aGUgZnV0dXJlLlxuICBsZXQgcHJlZmV0Y2ggPSBmYWxzZTtcbiAgbGV0IGRlZmVyT25PcHM6IGlyLkRlZmVyT25PcFtdID0gW107XG4gIGxldCBkZWZlcldoZW5PcHM6IGlyLkRlZmVyV2hlbk9wW10gPSBbXTtcbiAgZm9yIChjb25zdCB0cmlnZ2VycyBvZiBbZGVmZXJCbG9jay50cmlnZ2VycywgZGVmZXJCbG9jay5wcmVmZXRjaFRyaWdnZXJzXSkge1xuICAgIGlmICh0cmlnZ2Vycy5pZGxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLklkbGV9LCBwcmVmZXRjaCwgdHJpZ2dlcnMuaWRsZS5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaW1tZWRpYXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLkltbWVkaWF0ZX0sIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLmltbWVkaWF0ZS5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMudGltZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuVGltZXIsIGRlbGF5OiB0cmlnZ2Vycy50aW1lci5kZWxheX0sIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLnRpbWVyLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5ob3ZlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLkhvdmVyLFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMuaG92ZXIucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy5ob3Zlci5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaW50ZXJhY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmludGVyYWN0aW9uLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMuaW50ZXJhY3Rpb24uc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnZpZXdwb3J0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuVmlld3BvcnQsXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy52aWV3cG9ydC5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLnZpZXdwb3J0LnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy53aGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0cmlnZ2Vycy53aGVuLnZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgc3VwcG9ydHMgdGhpcyBjYXNlLCBidXQgaXQncyB2ZXJ5IHN0cmFuZ2UgdG8gbWUuIFdoYXQgd291bGQgaXRcbiAgICAgICAgLy8gZXZlbiBtZWFuP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbiBpbiBkZWZlciBibG9jayB3aGVuIHRyaWdnZXJgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyV2hlbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwgY29udmVydEFzdCh0cmlnZ2Vycy53aGVuLnZhbHVlLCB1bml0LmpvYiwgdHJpZ2dlcnMud2hlbi5zb3VyY2VTcGFuKSwgcHJlZmV0Y2gsXG4gICAgICAgICAgdHJpZ2dlcnMud2hlbi5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyV2hlbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gKG5vbi1wcmVmZXRjaGluZykgZGVmZXIgdHJpZ2dlcnMgd2VyZSBwcm92aWRlZCwgZGVmYXVsdCB0byBgaWRsZWAuXG4gICAgaWYgKGRlZmVyT25PcHMubGVuZ3RoID09PSAwICYmIGRlZmVyV2hlbk9wcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlZmVyT25PcHMucHVzaChcbiAgICAgICAgICBpci5jcmVhdGVEZWZlck9uT3AoZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSwgZmFsc2UsIG51bGwhKSk7XG4gICAgfVxuICAgIHByZWZldGNoID0gdHJ1ZTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goZGVmZXJPbk9wcyk7XG4gIHVuaXQudXBkYXRlLnB1c2goZGVmZXJXaGVuT3BzKTtcbn1cblxuZnVuY3Rpb24gaW5nZXN0SWN1KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGljdTogdC5JY3UpIHtcbiAgaWYgKGljdS5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlICYmIGlzU2luZ2xlSTE4bkljdShpY3UuaTE4bikpIHtcbiAgICBjb25zdCB4cmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBjb25zdCBpY3VOb2RlID0gaWN1LmkxOG4ubm9kZXNbMF07XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VTdGFydE9wKHhyZWYsIGljdS5pMThuLCBpY3VGcm9tSTE4bk1lc3NhZ2UoaWN1LmkxOG4pLm5hbWUsIG51bGwhKSk7XG4gICAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIHRleHRdIG9mIE9iamVjdC5lbnRyaWVzKHsuLi5pY3UudmFycywgLi4uaWN1LnBsYWNlaG9sZGVyc30pKSB7XG4gICAgICBpZiAodGV4dCBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCB0ZXh0LCBwbGFjZWhvbGRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RUZXh0KHVuaXQsIHRleHQsIHBsYWNlaG9sZGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VFbmRPcCh4cmVmKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIElDVTogJHtpY3UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGZvcmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEZvckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGZvckJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHZvaWQge1xuICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoXG4gICAgICBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG5cbiAgLy8gV2UgY29weSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyJ3Mgc2NoZW1lIG9mIGNyZWF0aW5nIG5hbWVzIGZvciBgJGNvdW50YCBhbmQgYCRpbmRleGAgdGhhdCBhcmVcbiAgLy8gc3VmZml4ZWQgd2l0aCBzcGVjaWFsIGluZm9ybWF0aW9uLCB0byBkaXNhbWJpZ3VhdGUgd2hpY2ggbGV2ZWwgb2YgbmVzdGVkIGxvb3AgdGhlIGJlbG93IGFsaWFzZXNcbiAgLy8gcmVmZXIgdG8uXG4gIC8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciBUZW1wbGF0ZSBQaXBlbGluZSdzIHZhcmlhYmxlIHBoYXNlcyB0byBncmFjZWZ1bGx5IGhhbmRsZSBzaGFkb3dpbmcsXG4gIC8vIGFuZCBhcmJpdHJhcmlseSBtYW55IGxldmVscyBvZiB2YXJpYWJsZXMgZGVwZW5kaW5nIG9uIGVhY2ggb3RoZXIuXG4gIGNvbnN0IGluZGV4TmFtZSA9IGDJtSR7Zm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZX1fJHtyZXBlYXRlclZpZXcueHJlZn1gO1xuICBjb25zdCBjb3VudE5hbWUgPSBgybUke2ZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWV9XyR7cmVwZWF0ZXJWaWV3LnhyZWZ9YDtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGluZGV4TmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoY291bnROYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG5cbiAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICBuYW1lOiBudWxsLFxuICAgIGlkZW50aWZpZXI6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsXG4gICAgZXhwcmVzc2lvbjogbmV3IGlyLkxleGljYWxSZWFkRXhwcihpbmRleE5hbWUpLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpXG4gIH0pO1xuICByZXBlYXRlclZpZXcuYWxpYXNlcy5hZGQoe1xuICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgIG5hbWU6IG51bGwsXG4gICAgaWRlbnRpZmllcjogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLFxuICAgIGV4cHJlc3Npb246IG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5pZGVudGljYWwoXG4gICAgICAgIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoY291bnROYW1lKS5taW51cyhvLmxpdGVyYWwoMSkpKVxuICB9KTtcbiAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICBuYW1lOiBudWxsLFxuICAgIGlkZW50aWZpZXI6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSxcbiAgICBleHByZXNzaW9uOiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGluZGV4TmFtZSkubW9kdWxvKG8ubGl0ZXJhbCgyKSkuaWRlbnRpY2FsKG8ubGl0ZXJhbCgwKSlcbiAgfSk7XG4gIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQWxpYXMsXG4gICAgbmFtZTogbnVsbCxcbiAgICBpZGVudGlmaWVyOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSxcbiAgICBleHByZXNzaW9uOiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGluZGV4TmFtZSkubW9kdWxvKG8ubGl0ZXJhbCgyKSkubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgwKSlcbiAgfSk7XG5cbiAgY29uc3Qgc291cmNlU3BhbiA9IGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLnRyYWNrQnkuc3BhbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIGNvbnN0IHRyYWNrID0gY29udmVydEFzdChmb3JCbG9jay50cmFja0J5LCB1bml0LmpvYiwgc291cmNlU3Bhbik7XG5cbiAgaW5nZXN0Tm9kZXMocmVwZWF0ZXJWaWV3LCBmb3JCbG9jay5jaGlsZHJlbik7XG5cbiAgbGV0IGVtcHR5VmlldzogVmlld0NvbXBpbGF0aW9uVW5pdHxudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5VGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgICBlbXB0eVRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIGVtcHR5Vmlldy54cmVmLCBmb3JCbG9jay5lbXB0eSk7XG4gIH1cblxuICBjb25zdCB2YXJOYW1lczogaXIuUmVwZWF0ZXJWYXJOYW1lcyA9IHtcbiAgICAkaW5kZXg6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsXG4gICAgJGNvdW50OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLFxuICAgICRmaXJzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSxcbiAgICAkbGFzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLFxuICAgICRldmVuOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRldmVuLm5hbWUsXG4gICAgJG9kZDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsXG4gICAgJGltcGxpY2l0OiBmb3JCbG9jay5pdGVtLm5hbWUsXG4gIH07XG5cbiAgaWYgKGZvckJsb2NrLmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKGZvckJsb2NrLmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBmb3InKTtcbiAgfVxuICBpZiAoZm9yQmxvY2suZW1wdHk/LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIShmb3JCbG9jay5lbXB0eS5pMThuIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBvciBAZW1wdHknKTtcbiAgfVxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSBmb3JCbG9jay5pMThuO1xuICBjb25zdCBlbXB0eUkxOG5QbGFjZWhvbGRlciA9IGZvckJsb2NrLmVtcHR5Py5pMThuO1xuXG4gIGNvbnN0IHRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIHJlcGVhdGVyVmlldy54cmVmLCBmb3JCbG9jayk7XG4gIGNvbnN0IHJlcGVhdGVyQ3JlYXRlID0gaXIuY3JlYXRlUmVwZWF0ZXJDcmVhdGVPcChcbiAgICAgIHJlcGVhdGVyVmlldy54cmVmLCBlbXB0eVZpZXc/LnhyZWYgPz8gbnVsbCwgdGFnTmFtZSwgdHJhY2ssIHZhck5hbWVzLCBlbXB0eVRhZ05hbWUsXG4gICAgICBpMThuUGxhY2Vob2xkZXIsIGVtcHR5STE4blBsYWNlaG9sZGVyLCBmb3JCbG9jay5zdGFydFNvdXJjZVNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHJlcGVhdGVyQ3JlYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gY29udmVydEFzdChcbiAgICAgIGZvckJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2suZXhwcmVzc2lvbi5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKSk7XG4gIGNvbnN0IHJlcGVhdGVyID0gaXIuY3JlYXRlUmVwZWF0ZXJPcChcbiAgICAgIHJlcGVhdGVyQ3JlYXRlLnhyZWYsIHJlcGVhdGVyQ3JlYXRlLmhhbmRsZSwgZXhwcmVzc2lvbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2gocmVwZWF0ZXIpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBBU1QgZXhwcmVzc2lvbiBpbnRvIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gY29udmVydEFzdChcbiAgICBhc3Q6IGUuQVNULCBqb2I6IENvbXBpbGF0aW9uSm9iLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmFzdCwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVJlYWQpIHtcbiAgICBjb25zdCBpc1RoaXNSZWNlaXZlciA9IGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyO1xuICAgIC8vIFdoZXRoZXIgdGhpcyBpcyBhbiBpbXBsaWNpdCByZWNlaXZlciwgKmV4Y2x1ZGluZyogZXhwbGljaXQgcmVhZHMgb2YgYHRoaXNgLlxuICAgIGNvbnN0IGlzSW1wbGljaXRSZWNlaXZlciA9XG4gICAgICAgIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlciAmJiAhKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKTtcbiAgICAvLyBXaGV0aGVyIHRoZSAgbmFtZSBvZiB0aGUgcmVhZCBpcyBhIG5vZGUgdGhhdCBzaG91bGQgYmUgbmV2ZXIgcmV0YWluIGl0cyBleHBsaWNpdCB0aGlzXG4gICAgLy8gcmVjZWl2ZXIuXG4gICAgY29uc3QgaXNTcGVjaWFsTm9kZSA9IGFzdC5uYW1lID09PSAnJGFueScgfHwgYXN0Lm5hbWUgPT09ICckZXZlbnQnO1xuICAgIC8vIFRPRE86IFRoZSBtb3N0IHNlbnNpYmxlIGNvbmRpdGlvbiBoZXJlIHdvdWxkIGJlIHNpbXBseSBgaXNJbXBsaWNpdFJlY2VpdmVyYCwgdG8gY29udmVydCBvbmx5XG4gICAgLy8gYWN0dWFsIGltcGxpY2l0IGB0aGlzYCByZWFkcywgYW5kIG5vdCBleHBsaWNpdCBvbmVzLiBIb3dldmVyLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIChhbmRcbiAgICAvLyB0aGUgVHlwZWNoZWNrIGJsb2NrISkgYm90aCBoYXZlIHRoZSBzYW1lIGJ1ZywgaW4gd2hpY2ggdGhleSBhbHNvIGNvbnNpZGVyIGV4cGxpY2l0IGB0aGlzYFxuICAgIC8vIHJlYWRzIHRvIGJlIGltcGxpY2l0LiBUaGlzIGNhdXNlcyBwcm9ibGVtcyB3aGVuIHRoZSBleHBsaWNpdCBgdGhpc2AgcmVhZCBpcyBpbnNpZGUgYVxuICAgIC8vIHRlbXBsYXRlIHdpdGggYSBjb250ZXh0IHRoYXQgYWxzbyBwcm92aWRlcyB0aGUgdmFyaWFibGUgbmFtZSBiZWluZyByZWFkOlxuICAgIC8vIGBgYFxuICAgIC8vIDxuZy10ZW1wbGF0ZSBsZXQtYT57e3RoaXMuYX19PC9uZy10ZW1wbGF0ZT5cbiAgICAvLyBgYGBcbiAgICAvLyBUaGUgd2hvbGUgcG9pbnQgb2YgdGhlIGV4cGxpY2l0IGB0aGlzYCB3YXMgdG8gYWNjZXNzIHRoZSBjbGFzcyBwcm9wZXJ0eSwgYnV0IFREQiBhbmQgdGhlXG4gICAgLy8gY3VycmVudCBUQ0IgdHJlYXQgdGhlIHJlYWQgYXMgaW1wbGljaXQsIGFuZCBnaXZlIHlvdSB0aGUgY29udGV4dCBwcm9wZXJ0eSBpbnN0ZWFkIVxuICAgIC8vXG4gICAgLy8gRm9yIG5vdywgd2UgZW11bGF0ZSB0aGlzIG9sZCBiZWh2YWlvciBieSBhZ2dyZXNzaXZlbHkgY29udmVydGluZyBleHBsaWNpdCByZWFkcyB0byB0b1xuICAgIC8vIGltcGxpY2l0IHJlYWRzLCBleGNlcHQgZm9yIHRoZSBzcGVjaWFsIGNhc2VzIHRoYXQgVERCIGFuZCB0aGUgY3VycmVudCBUQ0IgcHJvdGVjdC4gSG93ZXZlcixcbiAgICAvLyBpdCB3b3VsZCBiZSBhbiBpbXByb3ZlbWVudCB0byBmaXggdGhpcy5cbiAgICAvL1xuICAgIC8vIFNlZSBhbHNvIHRoZSBjb3JyZXNwb25kaW5nIGNvbW1lbnQgZm9yIHRoZSBUQ0IsIGluIGB0eXBlX2NoZWNrX2Jsb2NrLnRzYC5cbiAgICBpZiAoaXNJbXBsaWNpdFJlY2VpdmVyIHx8IChpc1RoaXNSZWNlaXZlciAmJiAhaXNTcGVjaWFsTm9kZSkpIHtcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lLCBudWxsLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5V3JpdGUpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihcbiAgICAgICAgICAvLyBUT0RPOiBJcyBpdCBjb3JyZWN0IHRvIGFsd2F5cyB1c2UgdGhlIHJvb3QgY29udGV4dCBpbiBwbGFjZSBvZiB0aGUgaW1wbGljaXQgcmVjZWl2ZXI/XG4gICAgICAgICAgbmV3IGlyLkNvbnRleHRFeHByKGpvYi5yb290LnhyZWYpLCBhc3QubmFtZSwgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIG51bGwsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRXcml0ZSkge1xuICAgIHJldHVybiBuZXcgby5Xcml0ZUtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2FsbCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBJbXBsaWNpdFJlY2VpdmVyYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSwgdW5kZWZpbmVkLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKGFzdC52YWx1ZSwgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlVuYXJ5KSB7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICByZXR1cm4gbmV3IG8uVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvLlVuYXJ5T3BlcmF0b3IuUGx1cywgY29udmVydEFzdChhc3QuZXhwciwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIHJldHVybiBuZXcgby5VbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG8uVW5hcnlPcGVyYXRvci5NaW51cywgY29udmVydEFzdChhc3QuZXhwciwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5rbm93biB1bmFyeSBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5hcnkpIHtcbiAgICBjb25zdCBvcGVyYXRvciA9IEJJTkFSWV9PUEVSQVRPUlMuZ2V0KGFzdC5vcGVyYXRpb24pO1xuICAgIGlmIChvcGVyYXRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIGJpbmFyeSBvcGVyYXRvciAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgIG9wZXJhdG9yLCBjb252ZXJ0QXN0KGFzdC5sZWZ0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QucmlnaHQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGNvbnRleHQgZXhwcmVzc2lvbnMgaGF2ZSBzb3VyY2UgbWFwcz9cbiAgICByZXR1cm4gbmV3IGlyLkNvbnRleHRFeHByKGpvYi5yb290LnhyZWYpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DaGFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IENoYWluIGluIHVua25vd24gY29udGV4dGApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbE1hcCkge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhc3Qua2V5cy5tYXAoKGtleSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZXNbaWR4XTtcbiAgICAgIC8vIFRPRE86IHNob3VsZCBsaXRlcmFscyBoYXZlIHNvdXJjZSBtYXBzLCBvciBkbyB3ZSBqdXN0IG1hcCB0aGUgd2hvbGUgc3Vycm91bmRpbmdcbiAgICAgIC8vIGV4cHJlc3Npb24/XG4gICAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KGtleS5rZXksIGNvbnZlcnRBc3QodmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBrZXkucXVvdGVkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxBcnJheSkge1xuICAgIC8vIFRPRE86IHNob3VsZCBsaXRlcmFscyBoYXZlIHNvdXJjZSBtYXBzLCBvciBkbyB3ZSBqdXN0IG1hcCB0aGUgd2hvbGUgc3Vycm91bmRpbmcgZXhwcmVzc2lvbj9cbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihcbiAgICAgICAgYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNvbmRpdGlvbmFsKSB7XG4gICAgcmV0dXJuIG5ldyBvLkNvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QuY29uZGl0aW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudHJ1ZUV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmZhbHNlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLk5vbk51bGxBc3NlcnQpIHtcbiAgICAvLyBBIG5vbi1udWxsIGFzc2VydGlvbiBzaG91bGRuJ3QgaW1wYWN0IGdlbmVyYXRlZCBpbnN0cnVjdGlvbnMsIHNvIHdlIGNhbiBqdXN0IGRyb3AgaXQuXG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluZGluZ1BpcGUpIHtcbiAgICAvLyBUT0RPOiBwaXBlcyBzaG91bGQgcHJvYmFibHkgaGF2ZSBzb3VyY2UgbWFwczsgZmlndXJlIG91dCBkZXRhaWxzLlxuICAgIHJldHVybiBuZXcgaXIuUGlwZUJpbmRpbmdFeHByKFxuICAgICAgICBqb2IuYWxsb2NhdGVYcmVmSWQoKSxcbiAgICAgICAgbmV3IGlyLlNsb3RIYW5kbGUoKSxcbiAgICAgICAgYXN0Lm5hbWUsXG4gICAgICAgIFtcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5leHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIC4uLmFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICAgICAgXSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUtleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgaXIuU2FmZUtleWVkUmVhZEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVQcm9wZXJ0eVJlYWRFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUNhbGwpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZUludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBhc3QuYXJncy5tYXAoYSA9PiBjb252ZXJ0QXN0KGEsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5FbXB0eUV4cHIpIHtcbiAgICByZXR1cm4gbmV3IGlyLkVtcHR5RXhwcihjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByZWZpeE5vdCkge1xuICAgIHJldHVybiBvLm5vdChcbiAgICAgICAgY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIGV4cHJlc3Npb24gdHlwZSBcIiR7YXN0LmNvbnN0cnVjdG9yLm5hbWV9XCIgaW4gZmlsZSBcIiR7XG4gICAgICAgIGJhc2VTb3VyY2VTcGFuPy5zdGFydC5maWxlLnVybH1cImApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBc3RXaXRoSW50ZXJwb2xhdGlvbihcbiAgICBqb2I6IENvbXBpbGF0aW9uSm9iLCB2YWx1ZTogZS5BU1R8c3RyaW5nLCBpMThuTWV0YTogaTE4bi5JMThuTWV0YXxudWxsfHVuZGVmaW5lZCxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb24ge1xuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGUgPT4gY29udmVydEFzdChlLCBqb2IsIHNvdXJjZVNwYW4gPz8gbnVsbCkpLFxuICAgICAgICBPYmplY3Qua2V5cyhhc01lc3NhZ2UoaTE4bk1ldGEpPy5wbGFjZWhvbGRlcnMgPz8ge30pKTtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUKSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QodmFsdWUsIGpvYiwgc291cmNlU3BhbiA/PyBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gby5saXRlcmFsKHZhbHVlKTtcbiAgfVxuICByZXR1cm4gZXhwcmVzc2lvbjtcbn1cblxuLy8gVE9ETzogQ2FuIHdlIHBvcHVsYXRlIFRlbXBsYXRlIGJpbmRpbmcga2luZHMgaW4gaW5nZXN0P1xuY29uc3QgQklORElOR19LSU5EUyA9IG5ldyBNYXA8ZS5CaW5kaW5nVHlwZSwgaXIuQmluZGluZ0tpbmQ+KFtcbiAgW2UuQmluZGluZ1R5cGUuUHJvcGVydHksIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuVHdvV2F5LCBpci5CaW5kaW5nS2luZC5Ud29XYXlQcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlXSxcbiAgW2UuQmluZGluZ1R5cGUuQ2xhc3MsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZV0sXG4gIFtlLkJpbmRpbmdUeXBlLlN0eWxlLCBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQW5pbWF0aW9uLCBpci5CaW5kaW5nS2luZC5BbmltYXRpb25dLFxuXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHRlbXBsYXRlIGlzIGEgcGxhaW4gbmctdGVtcGxhdGUgKGFzIG9wcG9zZWQgdG8gYW5vdGhlciBraW5kIG9mIHRlbXBsYXRlXG4gKiBzdWNoIGFzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGUgb3IgY29udHJvbCBmbG93IHRlbXBsYXRlKS4gVGhpcyBpcyBjaGVja2VkIGJhc2VkIG9uIHRoZVxuICogdGFnTmFtZS4gV2UgY2FuIGV4cGVjdCB0aGF0IG9ubHkgcGxhaW4gbmctdGVtcGxhdGVzIHdpbGwgY29tZSB0aHJvdWdoIHdpdGggYSB0YWdOYW1lIG9mXG4gKiAnbmctdGVtcGxhdGUnLlxuICpcbiAqIEhlcmUgYXJlIHNvbWUgb2YgdGhlIGNhc2VzIHdlIGV4cGVjdDpcbiAqXG4gKiB8IEFuZ3VsYXIgSFRNTCAgICAgICAgICAgICAgICAgICAgICAgfCBUZW1wbGF0ZSB0YWdOYW1lICAgfFxuICogfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHwgLS0tLS0tLS0tLS0tLS0tLS0tIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8ZGl2ICpuZ0lmPVwidHJ1ZVwiPmAgICAgICAgICAgICAgICB8ICdkaXYnICAgICAgICAgICAgICB8XG4gKiB8IGA8c3ZnPjxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgfCAnc3ZnOm5nLXRlbXBsYXRlJyAgfFxuICogfCBgQGlmICh0cnVlKSB7YCAgICAgICAgICAgICAgICAgICAgIHwgJ0NvbmRpdGlvbmFsJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChwbGFpbikgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAoc3RydWN0dXJhbCkgfCBudWxsICAgICAgICAgICAgICAgfFxuICovXG5mdW5jdGlvbiBpc1BsYWluVGVtcGxhdGUodG1wbDogdC5UZW1wbGF0ZSkge1xuICByZXR1cm4gc3BsaXROc05hbWUodG1wbC50YWdOYW1lID8/ICcnKVsxXSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUU7XG59XG5cbi8qKlxuICogRW5zdXJlcyB0aGF0IHRoZSBpMThuTWV0YSwgaWYgcHJvdmlkZWQsIGlzIGFuIGkxOG4uTWVzc2FnZS5cbiAqL1xuZnVuY3Rpb24gYXNNZXNzYWdlKGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfG51bGx8dW5kZWZpbmVkKTogaTE4bi5NZXNzYWdlfG51bGwge1xuICBpZiAoaTE4bk1ldGEgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmICghKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSkge1xuICAgIHRocm93IEVycm9yKGBFeHBlY3RlZCBpMThuIG1ldGEgdG8gYmUgYSBNZXNzYWdlLCBidXQgZ290OiAke2kxOG5NZXRhLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIGkxOG5NZXRhO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGxldCBiaW5kaW5ncyA9IG5ldyBBcnJheTxpci5CaW5kaW5nT3B8aXIuRXh0cmFjdGVkQXR0cmlidXRlT3B8bnVsbD4oKTtcblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gQXR0cmlidXRlIGxpdGVyYWwgYmluZGluZ3MsIHN1Y2ggYXMgYGF0dHIuZm9vPVwiYmFyXCJgLlxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoZWxlbWVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhdHRyLnZhbHVlLCBhdHRyLmkxOG4pLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIHRydWUsXG4gICAgICAgIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgLy8gQWxsIGR5bmFtaWMgYmluZGluZ3MgKGJvdGggYXR0cmlidXRlIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncykuXG4gICAgYmluZGluZ3MucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgIG9wLnhyZWYsIEJJTkRJTkdfS0lORFMuZ2V0KGlucHV0LnR5cGUpISwgaW5wdXQubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhc3RPZihpbnB1dC52YWx1ZSksIGlucHV0LmkxOG4pLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGlucHV0LmkxOG4pID8/IG51bGwsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goYmluZGluZ3MuZmlsdGVyKFxuICAgICAgKGIpOiBiIGlzIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUpKTtcbiAgdW5pdC51cGRhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoKGIpOiBiIGlzIGlyLkJpbmRpbmdPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuQmluZGluZykpO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dC50eXBlID09PSBlLlBhcnNlZEV2ZW50VHlwZS5Ud29XYXkpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVHdvV2F5TGlzdGVuZXJPcChcbiAgICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgICAgbWFrZVR3b1dheUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSxcbiAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICAgICAgb3AueHJlZiwgb3AuaGFuZGxlLCBvdXRwdXQubmFtZSwgb3AudGFnLFxuICAgICAgICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksIG91dHB1dC5waGFzZSxcbiAgICAgICAgICBvdXRwdXQudGFyZ2V0LCBmYWxzZSwgb3V0cHV0LnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBhbnkgb2YgdGhlIGJpbmRpbmdzIG9uIHRoaXMgZWxlbWVudCBoYXZlIGFuIGkxOG4gbWVzc2FnZSwgdGhlbiBhbiBpMThuIGF0dHJzIGNvbmZpZ3VyYXRpb25cbiAgLy8gb3AgaXMgYWxzbyByZXF1aXJlZC5cbiAgaWYgKGJpbmRpbmdzLnNvbWUoYiA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVJMThuQXR0cmlidXRlc09wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIG9wLnhyZWYpKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlQmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIHRlbXBsYXRlOiB0LlRlbXBsYXRlLFxuICAgIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwpOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcHxpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcHxudWxsPigpO1xuXG4gIGZvciAoY29uc3QgYXR0ciBvZiB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgdGVtcGxhdGVLaW5kLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIudHlwZSwgYXR0ci5uYW1lLCBhc3RPZihhdHRyLnZhbHVlKSwgYXR0ci51bml0LCBhdHRyLnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgdGVtcGxhdGUuYXR0cmlidXRlcykge1xuICAgIC8vIEF0dHJpYnV0ZSBsaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgdGVtcGxhdGUuaW5wdXRzKSB7XG4gICAgLy8gRHluYW1pYyBiaW5kaW5ncyAoYm90aCBhdHRyaWJ1dGUgYW5kIHByb3BlcnR5IGJpbmRpbmdzKS5cbiAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQudHlwZSwgaW5wdXQubmFtZSwgYXN0T2YoaW5wdXQudmFsdWUpLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShpbnB1dC5pMThuKSwgaW5wdXQuc291cmNlU3BhbikpO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoXG4gICAgICAoYik6IGIgaXMgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGJpbmRpbmdzLmZpbHRlcigoYik6IGIgaXMgaXIuQmluZGluZ09wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5CaW5kaW5nKSk7XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGVtcGxhdGUub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuVHdvV2F5KSB7XG4gICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVHdvV2F5TGlzdGVuZXJPcChcbiAgICAgICAgICAgIG9wLnhyZWYsIG9wLmhhbmRsZSwgb3V0cHV0Lm5hbWUsIG9wLnRhZyxcbiAgICAgICAgICAgIG1ha2VUd29XYXlMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksXG4gICAgICAgICAgICBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICAgICAgb3AueHJlZiwgb3AuaGFuZGxlLCBvdXRwdXQubmFtZSwgb3AudGFnLFxuICAgICAgICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSwgb3V0cHV0LnBoYXNlLFxuICAgICAgICAgICAgb3V0cHV0LnRhcmdldCwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsICYmXG4gICAgICAgIG91dHB1dC50eXBlICE9PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIC8vIEFuaW1hdGlvbiBiaW5kaW5ncyBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgc3RydWN0dXJhbCB0ZW1wbGF0ZSdzIGNvbnN0IGFycmF5LlxuICAgICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgb3V0cHV0Lm5hbWUsIGZhbHNlKTtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgb3AueHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIG91dHB1dC5uYW1lLCBudWxsLCBudWxsLCBudWxsLCBzZWN1cml0eUNvbnRleHQpKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPOiBQZXJoYXBzIHdlIGNvdWxkIGRvIHRoaXMgaW4gYSBwaGFzZT8gKEl0IGxpa2VseSB3b3VsZG4ndCBjaGFuZ2UgdGhlIHNsb3QgaW5kaWNlcy4pXG4gIGlmIChiaW5kaW5ncy5zb21lKGIgPT4gYj8uaTE4bk1lc3NhZ2UpICE9PSBudWxsKSB7XG4gICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgaXIuY3JlYXRlSTE4bkF0dHJpYnV0ZXNPcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBvcC54cmVmKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBIZWxwZXIgdG8gaW5nZXN0IGFuIGluZGl2aWR1YWwgYmluZGluZyBvbiBhIHRlbXBsYXRlLCBlaXRoZXIgYW4gZXhwbGljaXQgYG5nLXRlbXBsYXRlYCwgb3IgYW5cbiAqIGltcGxpY2l0IHRlbXBsYXRlIGNyZWF0ZWQgdmlhIHN0cnVjdHVyYWwgZGlyZWN0aXZlLlxuICpcbiAqIEJpbmRpbmdzIG9uIHRlbXBsYXRlcyBhcmUgKmV4dHJlbWVseSogdHJpY2t5LiBJIGhhdmUgdHJpZWQgdG8gaXNvbGF0ZSBhbGwgb2YgdGhlIGNvbmZ1c2luZyBlZGdlXG4gKiBjYXNlcyBpbnRvIHRoaXMgZnVuY3Rpb24sIGFuZCB0byBjb21tZW50IGl0IHdlbGwgdG8gZG9jdW1lbnQgdGhlIGJlaGF2aW9yLlxuICpcbiAqIFNvbWUgb2YgdGhpcyBiZWhhdmlvciBpcyBpbnR1aXRpdmVseSBpbmNvcnJlY3QsIGFuZCB3ZSBzaG91bGQgY29uc2lkZXIgY2hhbmdpbmcgaXQgaW4gdGhlIGZ1dHVyZS5cbiAqXG4gKiBAcGFyYW0gdmlldyBUaGUgY29tcGlsYXRpb24gdW5pdCBmb3IgdGhlIHZpZXcgY29udGFpbmluZyB0aGUgdGVtcGxhdGUuXG4gKiBAcGFyYW0geHJlZiBUaGUgeHJlZiBvZiB0aGUgdGVtcGxhdGUgb3AuXG4gKiBAcGFyYW0gdHlwZSBUaGUgYmluZGluZyB0eXBlLCBhY2NvcmRpbmcgdG8gdGhlIHBhcnNlci4gVGhpcyBpcyBmYWlybHkgcmVhc29uYWJsZSwgZS5nLiBib3RoXG4gKiAgICAgZHluYW1pYyBhbmQgc3RhdGljIGF0dHJpYnV0ZXMgaGF2ZSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZS5cbiAqIEBwYXJhbSBuYW1lIFRoZSBiaW5kaW5nJ3MgbmFtZS5cbiAqIEBwYXJhbSB2YWx1ZSBUaGUgYmluZGluZ3MncyB2YWx1ZSwgd2hpY2ggd2lsbCBlaXRoZXIgYmUgYW4gaW5wdXQgQVNUIGV4cHJlc3Npb24sIG9yIGEgc3RyaW5nXG4gKiAgICAgbGl0ZXJhbC4gTm90ZSB0aGF0IHRoZSBpbnB1dCBBU1QgZXhwcmVzc2lvbiBtYXkgb3IgbWF5IG5vdCBiZSBjb25zdCAtLSBpdCB3aWxsIG9ubHkgYmUgYVxuICogICAgIHN0cmluZyBsaXRlcmFsIGlmIHRoZSBwYXJzZXIgY29uc2lkZXJlZCBpdCBhIHRleHQgYmluZGluZy5cbiAqIEBwYXJhbSB1bml0IElmIHRoZSBiaW5kaW5nIGhhcyBhIHVuaXQgKGUuZy4gYHB4YCBmb3Igc3R5bGUgYmluZGluZ3MpLCB0aGVuIHRoaXMgaXMgdGhlIHVuaXQuXG4gKiBAcGFyYW0gc2VjdXJpdHlDb250ZXh0IFRoZSBzZWN1cml0eSBjb250ZXh0IG9mIHRoZSBiaW5kaW5nLlxuICogQHBhcmFtIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlIFdoZXRoZXIgdGhpcyBiaW5kaW5nIGFjdHVhbGx5IGFwcGxpZXMgdG8gdGhlIHN0cnVjdHVyYWxcbiAqICAgICBuZy10ZW1wbGF0ZS4gRm9yIGV4YW1wbGUsIGFuIGBuZ0ZvcmAgd291bGQgYWN0dWFsbHkgYXBwbHkgdG8gdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUuIChNb3N0XG4gKiAgICAgYmluZGluZ3Mgb24gc3RydWN0dXJhbCBlbGVtZW50cyB0YXJnZXQgdGhlIGlubmVyIGVsZW1lbnQsIG5vdCB0aGUgdGVtcGxhdGUuKVxuICogQHBhcmFtIHRlbXBsYXRlS2luZCBXaGV0aGVyIHRoaXMgaXMgYW4gZXhwbGljaXQgYG5nLXRlbXBsYXRlYCBvciBhbiBpbXBsaWNpdCB0ZW1wbGF0ZSBjcmVhdGVkIGJ5XG4gKiAgICAgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS4gVGhpcyBzaG91bGQgbmV2ZXIgYmUgYSBibG9jayB0ZW1wbGF0ZS5cbiAqIEBwYXJhbSBpMThuTWVzc2FnZSBUaGUgaTE4biBtZXRhZGF0YSBmb3IgdGhlIGJpbmRpbmcsIGlmIGFueS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIFRoZSBzb3VyY2Ugc3BhbiBvZiB0aGUgYmluZGluZy5cbiAqIEByZXR1cm5zIEFuIElSIGJpbmRpbmcgb3AsIG9yIG51bGwgaWYgdGhlIGJpbmRpbmcgc2hvdWxkIGJlIHNraXBwZWQuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB4cmVmOiBpci5YcmVmSWQsIHR5cGU6IGUuQmluZGluZ1R5cGUsIG5hbWU6IHN0cmluZyxcbiAgICB2YWx1ZTogZS5BU1R8c3RyaW5nLCB1bml0OiBzdHJpbmd8bnVsbCwgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW4sIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwsXG4gICAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5CaW5kaW5nT3B8XG4gICAgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3B8bnVsbCB7XG4gIGNvbnN0IGlzVGV4dEJpbmRpbmcgPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xuICAvLyBJZiB0aGlzIGlzIGEgc3RydWN0dXJhbCB0ZW1wbGF0ZSwgdGhlbiBzZXZlcmFsIGtpbmRzIG9mIGJpbmRpbmdzIHNob3VsZCBub3QgcmVzdWx0IGluIGFuXG4gIC8vIHVwZGF0ZSBpbnN0cnVjdGlvbi5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWwpIHtcbiAgICBpZiAoIWlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlKSB7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGUuQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgICAvLyBCZWNhdXNlIHRoaXMgYmluZGluZyBkb2Vzbid0IHJlYWxseSB0YXJnZXQgdGhlIG5nLXRlbXBsYXRlLCBpdCBtdXN0IGJlIGEgYmluZGluZyBvbiBhblxuICAgICAgICAgIC8vIGlubmVyIG5vZGUgb2YgYSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiBXZSBjYW4ndCBza2lwIGl0IGVudGlyZWx5LCBiZWNhdXNlIHdlIHN0aWxsIG5lZWRcbiAgICAgICAgICAvLyBpdCBvbiB0aGUgbmctdGVtcGxhdGUncyBjb25zdHMgKGUuZy4gZm9yIHRoZSBwdXJwb3NlcyBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcpLiBIb3dldmVyLFxuICAgICAgICAgIC8vIHdlIHNob3VsZCBub3QgZ2VuZXJhdGUgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBpdC5cbiAgICAgICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBuYW1lLCBudWxsLCBudWxsLCBpMThuTWVzc2FnZSwgc2VjdXJpdHlDb250ZXh0KTtcbiAgICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlR3b1dheTpcbiAgICAgICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLlR3b1dheVByb3BlcnR5LCBudWxsLCBuYW1lLCBudWxsLCBudWxsLCBpMThuTWVzc2FnZSxcbiAgICAgICAgICAgICAgc2VjdXJpdHlDb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWlzVGV4dEJpbmRpbmcgJiYgKHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQXR0cmlidXRlIHx8IHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQW5pbWF0aW9uKSkge1xuICAgICAgLy8gQWdhaW4sIHRoaXMgYmluZGluZyBkb2Vzbid0IHJlYWxseSB0YXJnZXQgdGhlIG5nLXRlbXBsYXRlOyBpdCBhY3R1YWxseSB0YXJnZXRzIHRoZSBlbGVtZW50XG4gICAgICAvLyBpbnNpZGUgdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUuIEluIHRoZSBjYXNlIG9mIG5vbi10ZXh0IGF0dHJpYnV0ZSBvciBhbmltYXRpb24gYmluZGluZ3MsXG4gICAgICAvLyB0aGUgYmluZGluZyBkb2Vzbid0IGV2ZW4gc2hvdyB1cCBvbiB0aGUgbmctdGVtcGxhdGUgY29uc3QgYXJyYXksIHNvIHdlIGp1c3Qgc2tpcCBpdFxuICAgICAgLy8gZW50aXJlbHkuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsZXQgYmluZGluZ1R5cGUgPSBCSU5ESU5HX0tJTkRTLmdldCh0eXBlKSE7XG5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAvLyBXZSBrbm93IHdlIGFyZSBkZWFsaW5nIHdpdGggYmluZGluZ3MgZGlyZWN0bHkgb24gYW4gZXhwbGljaXQgbmctdGVtcGxhdGUuXG4gICAgLy8gU3RhdGljIGF0dHJpYnV0ZSBiaW5kaW5ncyBzaG91bGQgYmUgY29sbGVjdGVkIGludG8gdGhlIGNvbnN0IGFycmF5IGFzIGsvdiBwYWlycy4gUHJvcGVydHlcbiAgICAvLyBiaW5kaW5ncyBzaG91bGQgcmVzdWx0IGluIGEgYHByb3BlcnR5YCBpbnN0cnVjdGlvbiwgYW5kIGBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3NgIGNvbnN0XG4gICAgLy8gZW50cmllcy5cbiAgICAvL1xuICAgIC8vIFRoZSBkaWZmaWN1bHR5IGlzIHdpdGggZHluYW1pYyBhdHRyaWJ1dGUsIHN0eWxlLCBhbmQgY2xhc3MgYmluZGluZ3MuIFRoZXNlIGRvbid0IHJlYWxseSBtYWtlXG4gICAgLy8gc2Vuc2Ugb24gYW4gYG5nLXRlbXBsYXRlYCBhbmQgc2hvdWxkIHByb2JhYmx5IGJlIHBhcnNlciBlcnJvcnMuIEhvd2V2ZXIsXG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBnZW5lcmF0ZXMgYHByb3BlcnR5YCBpbnN0cnVjdGlvbnMgZm9yIHRoZW0sIGFuZCBzbyB3ZSBkbyB0aGF0IGFzXG4gICAgLy8gd2VsbC5cbiAgICAvL1xuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBoYXZlIGEgc2xpZ2h0IGJlaGF2aW9yIGRpZmZlcmVuY2Ugd2l0aCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyOiBhbHRob3VnaFxuICAgIC8vIFREQiBlbWl0cyBgcHJvcGVydHlgIGluc3RydWN0aW9ucyBmb3IgZHluYW1pYyBhdHRyaWJ1dGVzLCBzdHlsZXMsIGFuZCBjbGFzc2VzLCBvbmx5IHN0eWxlc1xuICAgIC8vIGFuZCBjbGFzc2VzIGFsc28gZ2V0IGNvbnN0IGNvbGxlY3RlZCBpbnRvIHRoZSBgQXR0cmlidXRlTWFya2VyLkJpbmRpbmdzYCBmaWVsZC4gRHluYW1pY1xuICAgIC8vIGF0dHJpYnV0ZSBiaW5kaW5ncyBhcmUgbWlzc2luZyBmcm9tIHRoZSBjb25zdHMgZW50aXJlbHkuIFdlIGNob29zZSB0byBlbWl0IHRoZW0gaW50byB0aGVcbiAgICAvLyBjb25zdHMgZmllbGQgYW55d2F5LCB0byBhdm9pZCBjcmVhdGluZyBzcGVjaWFsIGNhc2VzIGZvciBzb21ldGhpbmcgc28gYXJjYW5lIGFuZCBub25zZW5zaWNhbC5cbiAgICBpZiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5DbGFzcyB8fCB0eXBlID09PSBlLkJpbmRpbmdUeXBlLlN0eWxlIHx8XG4gICAgICAgICh0eXBlID09PSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSAmJiAhaXNUZXh0QmluZGluZykpIHtcbiAgICAgIC8vIFRPRE86IFRoZXNlIGNhc2VzIHNob3VsZCBiZSBwYXJzZSBlcnJvcnMuXG4gICAgICBiaW5kaW5nVHlwZSA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICB4cmVmLCBiaW5kaW5nVHlwZSwgbmFtZSwgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHZpZXcuam9iLCB2YWx1ZSwgaTE4bk1lc3NhZ2UpLCB1bml0LFxuICAgICAgc2VjdXJpdHlDb250ZXh0LCBpc1RleHRCaW5kaW5nLCBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSwgdGVtcGxhdGVLaW5kLCBpMThuTWVzc2FnZSxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBtYWtlTGlzdGVuZXJIYW5kbGVyT3BzKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgaGFuZGxlcjogZS5BU1QsIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcFtdIHtcbiAgaGFuZGxlciA9IGFzdE9mKGhhbmRsZXIpO1xuICBjb25zdCBoYW5kbGVyT3BzID0gbmV3IEFycmF5PGlyLlVwZGF0ZU9wPigpO1xuICBsZXQgaGFuZGxlckV4cHJzOiBlLkFTVFtdID0gaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4gPyBoYW5kbGVyLmV4cHJlc3Npb25zIDogW2hhbmRsZXJdO1xuICBpZiAoaGFuZGxlckV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gaGF2ZSBub24tZW1wdHkgZXhwcmVzc2lvbiBsaXN0LicpO1xuICB9XG4gIGNvbnN0IGV4cHJlc3Npb25zID0gaGFuZGxlckV4cHJzLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGhhbmRsZXJTcGFuKSk7XG4gIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG4gIGhhbmRsZXJPcHMucHVzaCguLi5leHByZXNzaW9ucy5tYXAoXG4gICAgICBlID0+IGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGUsIGUuc291cmNlU3BhbikpKSk7XG4gIGhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwciwgcmV0dXJuRXhwci5zb3VyY2VTcGFuKSkpO1xuICByZXR1cm4gaGFuZGxlck9wcztcbn1cblxuZnVuY3Rpb24gbWFrZVR3b1dheUxpc3RlbmVySGFuZGxlck9wcyhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGhhbmRsZXI6IGUuQVNULCBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3BbXSB7XG4gIGhhbmRsZXIgPSBhc3RPZihoYW5kbGVyKTtcbiAgY29uc3QgaGFuZGxlck9wcyA9IG5ldyBBcnJheTxpci5VcGRhdGVPcD4oKTtcblxuICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICBpZiAoaGFuZGxlci5leHByZXNzaW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmV4cHJlc3Npb25zWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGlzIGlzIHZhbGlkYXRlZCBkdXJpbmcgcGFyc2luZyBhbHJlYWR5LCBidXQgd2UgZG8gaXQgaGVyZSBqdXN0IGluIGNhc2UuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHR3by13YXkgbGlzdGVuZXIgdG8gaGF2ZSBhIHNpbmdsZSBleHByZXNzaW9uLicpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGhhbmRsZXJFeHByID0gY29udmVydEFzdChoYW5kbGVyLCB1bml0LmpvYiwgaGFuZGxlclNwYW4pO1xuICBjb25zdCBldmVudFJlZmVyZW5jZSA9IG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoJyRldmVudCcpO1xuICBjb25zdCB0d29XYXlTZXRFeHByID0gbmV3IGlyLlR3b1dheUJpbmRpbmdTZXRFeHByKGhhbmRsZXJFeHByLCBldmVudFJlZmVyZW5jZSk7XG5cbiAgaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHR3b1dheVNldEV4cHIpKSk7XG4gIGhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZXZlbnRSZWZlcmVuY2UpKSk7XG4gIHJldHVybiBoYW5kbGVyT3BzO1xufVxuXG5mdW5jdGlvbiBhc3RPZihhc3Q6IGUuQVNUfGUuQVNUV2l0aFNvdXJjZSk6IGUuQVNUIHtcbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSA/IGFzdC5hc3QgOiBhc3Q7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICAgIHNwYW46IGUuUGFyc2VTcGFuLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gIGlmIChiYXNlU291cmNlU3BhbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICBjb25zdCBlbmQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICBjb25zdCBmdWxsU3RhcnQgPSBiYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kLCBmdWxsU3RhcnQpO1xufVxuXG4vKipcbiAqIFdpdGggdGhlIGRpcmVjdGl2ZS1iYXNlZCBjb250cm9sIGZsb3cgdXNlcnMgd2VyZSBhYmxlIHRvIGNvbmRpdGlvbmFsbHkgcHJvamVjdCBjb250ZW50IHVzaW5nXG4gKiB0aGUgYCpgIHN5bnRheC4gRS5nLiBgPGRpdiAqbmdJZj1cImV4cHJcIiBwcm9qZWN0TWU+PC9kaXY+YCB3aWxsIGJlIHByb2plY3RlZCBpbnRvXG4gKiBgPG5nLWNvbnRlbnQgc2VsZWN0PVwiW3Byb2plY3RNZV1cIi8+YCwgYmVjYXVzZSB0aGUgYXR0cmlidXRlcyBhbmQgdGFnIG5hbWUgZnJvbSB0aGUgYGRpdmAgYXJlXG4gKiBjb3BpZWQgdG8gdGhlIHRlbXBsYXRlIHZpYSB0aGUgdGVtcGxhdGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24uIFdpdGggYEBpZmAgYW5kIGBAZm9yYCB0aGF0IGlzXG4gKiBub3QgdGhlIGNhc2UsIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsIGlzIHBsYWNlZCAqYXJvdW5kKiBlbGVtZW50cywgcmF0aGVyIHRoYW4gKm9uKiB0aGVtLlxuICogVGhlIHJlc3VsdCBpcyB0aGF0IGNvbnRlbnQgcHJvamVjdGlvbiB3b24ndCB3b3JrIGluIHRoZSBzYW1lIHdheSBpZiBhIHVzZXIgY29udmVydHMgZnJvbVxuICogYCpuZ0lmYCB0byBgQGlmYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFpbXMgdG8gY292ZXIgdGhlIG1vc3QgY29tbW9uIGNhc2UgYnkgZG9pbmcgdGhlIHNhbWUgY29weWluZyB3aGVuIGEgY29udHJvbCBmbG93XG4gKiBub2RlIGhhcyAqb25lIGFuZCBvbmx5IG9uZSogcm9vdCBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUuXG4gKlxuICogVGhpcyBhcHByb2FjaCBjb21lcyB3aXRoIHNvbWUgY2F2ZWF0czpcbiAqIDEuIEFzIHNvb24gYXMgYW55IG90aGVyIG5vZGUgaXMgYWRkZWQgdG8gdGhlIHJvb3QsIHRoZSBjb3B5aW5nIGJlaGF2aW9yIHdvbid0IHdvcmsgYW55bW9yZS5cbiAqICAgIEEgZGlhZ25vc3RpYyB3aWxsIGJlIGFkZGVkIHRvIGZsYWcgY2FzZXMgbGlrZSB0aGlzIGFuZCB0byBleHBsYWluIGhvdyB0byB3b3JrIGFyb3VuZCBpdC5cbiAqIDIuIElmIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzYCBpcyBlbmFibGVkLCBpdCdzIHZlcnkgbGlrZWx5IHRoYXQgaW5kZW50YXRpb24gd2lsbCBicmVhayB0aGlzXG4gKiAgICB3b3JrYXJvdW5kLCBiZWNhdXNlIGl0J2xsIGluY2x1ZGUgYW4gYWRkaXRpb25hbCB0ZXh0IG5vZGUgYXMgdGhlIGZpcnN0IGNoaWxkLiBXZSBjYW4gd29ya1xuICogICAgYXJvdW5kIGl0IGhlcmUsIGJ1dCBpbiBhIGRpc2N1c3Npb24gaXQgd2FzIGRlY2lkZWQgbm90IHRvLCBiZWNhdXNlIHRoZSB1c2VyIGV4cGxpY2l0bHkgb3B0ZWRcbiAqICAgIGludG8gcHJlc2VydmluZyB0aGUgd2hpdGVzcGFjZSBhbmQgd2Ugd291bGQgaGF2ZSB0byBkcm9wIGl0IGZyb20gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICogICAgVGhlIGRpYWdub3N0aWMgbWVudGlvbmVkIHBvaW50ICMxIHdpbGwgZmxhZyBzdWNoIGNhc2VzIHRvIHVzZXJzLlxuICpcbiAqIEByZXR1cm5zIFRhZyBuYW1lIHRvIGJlIHVzZWQgZm9yIHRoZSBjb250cm9sIGZsb3cgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLFxuICAgIG5vZGU6IHQuSWZCbG9ja0JyYW5jaHx0LkZvckxvb3BCbG9ja3x0LkZvckxvb3BCbG9ja0VtcHR5KTogc3RyaW5nfG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50fHQuVGVtcGxhdGV8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5FbGVtZW50IHx8IChjaGlsZCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgY2hpbGQudGFnTmFtZSAhPT0gbnVsbCkpIHtcbiAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gIC8vIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uIE5vdGUgdGhhdCBpdCdzIGltcG9ydGFudFxuICAvLyB0aGF0IHdlIGRvbid0IGNvcHkgYW55IGJvdW5kIGF0dHJpYnV0ZXMgc2luY2UgdGhleSBkb24ndCBwYXJ0aWNpcGF0ZSBpbiBjb250ZW50IHByb2plY3Rpb25cbiAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiByb290LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgICB4cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgZmFsc2UsIG51bGwsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcblxuICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICByZXR1cm4gdGFnTmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUgPyBudWxsIDogdGFnTmFtZTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIl19