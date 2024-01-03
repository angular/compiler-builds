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
export function ingestComponent(componentName, template, constantPool, relativeContextFilePath, i18nUseExternalIds, deferBlocksMeta) {
    const job = new ComponentCompilationJob(componentName, constantPool, compatibilityMode, relativeContextFilePath, i18nUseExternalIds, deferBlocksMeta);
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
    const [phase, target] = event.type === 0 /* e.ParsedEventType.Regular */ ? [null, event.targetOrPhase] :
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
    const deferOp = ir.createDeferOp(deferXref, main.xref, main.handle, blockMeta, deferBlock.sourceSpan);
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
        unit.create.push(ir.createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
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
            unit.create.push(ir.createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
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
        if (!isStructuralTemplateAttribute &&
            (type === 0 /* e.BindingType.Property */ || type === 2 /* e.BindingType.Class */ ||
                type === 3 /* e.BindingType.Style */)) {
            // Because this binding doesn't really target the ng-template, it must be a binding on an
            // inner node of a structural template. We can't skip it entirely, because we still need it on
            // the ng-template's consts (e.g. for the purposes of directive matching). However, we should
            // not generate an update instruction for it.
            return ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, null, name, null, null, i18nMessage, securityContext);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBa0IsdUJBQXVCLEVBQUUseUJBQXlCLEVBQWdELE1BQU0sZUFBZSxDQUFDO0FBQ2pKLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFcEYsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUM7QUFFekUsdURBQXVEO0FBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksd0JBQXdCLEVBQUUsQ0FBQztBQUVqRCx5Q0FBeUM7QUFDekMsTUFBTSxvQkFBb0IsR0FBRyxhQUFhLENBQUM7QUFFM0M7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQzNCLGFBQXFCLEVBQUUsUUFBa0IsRUFBRSxZQUEwQixFQUNyRSx1QkFBK0IsRUFBRSxrQkFBMkIsRUFDNUQsZUFBMkQ7SUFDN0QsTUFBTSxHQUFHLEdBQUcsSUFBSSx1QkFBdUIsQ0FDbkMsYUFBYSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxrQkFBa0IsRUFDM0YsZUFBZSxDQUFDLENBQUM7SUFDckIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDaEMsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBVUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUM3QixLQUF1QixFQUFFLGFBQTRCLEVBQ3JELFlBQTBCO0lBQzVCLE1BQU0sR0FBRyxHQUFHLElBQUkseUJBQXlCLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUNoRyxLQUFLLE1BQU0sUUFBUSxJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksRUFBRSxFQUFFLENBQUM7UUFDOUMsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDMUMscURBQXFEO1FBQ3JELElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN0QyxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN4RCxXQUFXLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7UUFDekMsQ0FBQztRQUNELElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3pCLFdBQVcsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztRQUN6QyxDQUFDO1FBQ0QsTUFBTSxnQkFBZ0IsR0FDbEIsYUFBYTthQUNSLDRCQUE0QixDQUN6QixLQUFLLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxXQUFXLEtBQUssRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7YUFDcEYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxLQUFLLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3RCxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDbEUsTUFBTSxnQkFBZ0IsR0FDbEIsYUFBYSxDQUFDLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO2FBQzFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sS0FBSyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0QsbUJBQW1CLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQ0QsS0FBSyxNQUFNLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ3ZDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELGdHQUFnRztBQUNoRyxvRkFBb0Y7QUFDcEYsTUFBTSxVQUFVLGtCQUFrQixDQUM5QixHQUE4QixFQUFFLFFBQTBCLEVBQUUsV0FBMkIsRUFDdkYsZ0JBQW1DO0lBQ3JDLElBQUksVUFBeUMsQ0FBQztJQUM5QyxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztJQUNwQyxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDbkMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FDN0IsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2hHLENBQUM7U0FBTSxDQUFDO1FBQ04sVUFBVSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFDM0YsSUFBSSxFQUFFLG1EQUFtRCxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUM1RixDQUFDO0FBRUQsTUFBTSxVQUFVLG1CQUFtQixDQUMvQixHQUE4QixFQUFFLElBQVksRUFBRSxLQUFtQixFQUNqRSxnQkFBbUM7SUFDckMsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDbEMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsZ0JBQWdCO0lBQzVFO2dDQUM0QjtJQUM1QixJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDakIsVUFBVSxDQUFDLElBQUk7SUFDZix5QkFBeUIsQ0FBQyxLQUFLLENBQUMsVUFBVyxDQUFDLENBQUM7SUFDakQsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLEdBQThCLEVBQUUsS0FBb0I7SUFDbEYsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxzQ0FBOEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDN0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9GLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDcEMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQ3BELHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQ3ZGLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN0QixHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxXQUFXLENBQUMsSUFBeUIsRUFBRSxRQUFrQjtJQUNoRSxLQUFLLE1BQU0sSUFBSSxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQzVCLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUM5QixhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVCLENBQUM7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM3QixDQUFDO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUIsQ0FBQzthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvQixDQUFDO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3ZDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BDLENBQUM7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDckMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1QixDQUFDO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3pDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzNDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvQixDQUFDO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2pDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEIsQ0FBQzthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMxQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdCLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxhQUFhLENBQUMsSUFBeUIsRUFBRSxPQUFrQjtJQUNsRSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUztRQUMxQixDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7UUFDM0YsTUFBTSxLQUFLLENBQUMsNkNBQTZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7SUFFckMsTUFBTSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTlELE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxvQkFBb0IsQ0FDbkMsV0FBVyxFQUFFLEVBQUUsRUFBRSxlQUFlLENBQUMsWUFBWSxDQUFDLEVBQzlDLE9BQU8sQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUN0RSxPQUFPLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUxQixxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVuQywwRkFBMEY7SUFDMUYsSUFBSSxXQUFXLEdBQW1CLElBQUksQ0FBQztJQUN2QyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNaLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDM0YsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXBDLGtHQUFrRztJQUNsRyxnR0FBZ0c7SUFDaEcsOEZBQThGO0lBQzlGLDhGQUE4RjtJQUM5Rix1REFBdUQ7SUFDdkQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsYUFBYSxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMxRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUV4QiwyRkFBMkY7SUFDM0YsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDekIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQ2xCLEVBQUUsQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxhQUFhLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2hHLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGNBQWMsQ0FBQyxJQUF5QixFQUFFLElBQWdCO0lBQ2pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQ3ZCLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztRQUNyRixNQUFNLEtBQUssQ0FBQyw4Q0FBOEMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRW5ELElBQUksdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUMzQyxJQUFJLGVBQWUsR0FBZ0IsRUFBRSxDQUFDO0lBQ3RDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2pCLENBQUMsZUFBZSxFQUFFLHVCQUF1QixDQUFDLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDekYsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ25ELE1BQU0sa0JBQWtCLEdBQUcsdUJBQXVCLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDekQsRUFBRSxDQUFDLENBQUM7UUFDSixtQkFBbUIsQ0FBQyx1QkFBdUIsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM1RCxNQUFNLFlBQVksR0FDZCxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQztJQUNwRixNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQ2xDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLHVCQUF1QixFQUFFLGtCQUFrQixFQUFFLFNBQVMsRUFDcEYsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRTdCLHNCQUFzQixDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzdELGdCQUFnQixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNuQyxXQUFXLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV0QyxLQUFLLE1BQU0sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQzNDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELGlHQUFpRztJQUNqRyxpR0FBaUc7SUFDakcsK0NBQStDO0lBQy9DLElBQUksWUFBWSxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3JGLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDckMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUNwRSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNCLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pHLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FBQyxJQUF5QixFQUFFLE9BQWtCO0lBQ2xFLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7UUFDakYsTUFBTSxLQUFLLENBQUMsNkNBQTZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUNELE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FDNUIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25GLEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQy9CLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUMxRixJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN2QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFVBQVUsQ0FBQyxJQUF5QixFQUFFLElBQVksRUFBRSxjQUEyQjtJQUN0RixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDWixFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDL0YsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxlQUFlLENBQ3BCLElBQXlCLEVBQUUsSUFBaUIsRUFBRSxjQUEyQjtJQUMzRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3ZCLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNyQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUNwQixDQUFDO0lBQ0QsSUFBSSxDQUFDLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO1FBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQ1gsa0VBQWtFLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBQ0QsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztRQUN0RSxNQUFNLEtBQUssQ0FDUCx3REFBd0QsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBRUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7YUFDYixNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQTRCLEVBQUUsQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQzthQUM1RSxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQyxFQUFFLENBQUM7SUFDUCxJQUFJLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDeEYsTUFBTSxLQUFLLENBQUMsMkNBQ1IsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLHdCQUF3QixLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sY0FBYyxDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDM0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUNqRix3RkFBd0Y7SUFDeEYsOERBQThEO0lBQzlELDRFQUE0RTtJQUM1RSxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3ZFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyx1QkFBdUIsQ0FDdkMsUUFBUSxFQUNSLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FDaEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQyxFQUN4RixnQkFBZ0IsQ0FBQyxFQUNyQixJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FBQyxJQUF5QixFQUFFLE9BQWtCO0lBQ2xFLElBQUksU0FBUyxHQUFtQixJQUFJLENBQUM7SUFDckMsSUFBSSxlQUFlLEdBQXVCLElBQUksQ0FBQztJQUMvQyxJQUFJLFVBQVUsR0FBa0MsRUFBRSxDQUFDO0lBQ25ELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ2pELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksT0FBTyxHQUFnQixJQUFJLENBQUM7UUFFaEMsNEVBQTRFO1FBQzVFLGtGQUFrRjtRQUNsRixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNaLE9BQU8sR0FBRywrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQ0QsSUFBSSxNQUFNLENBQUMsZUFBZSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3BDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFFRCxJQUFJLGNBQWMsR0FBRyxTQUFTLENBQUM7UUFDL0IsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxLQUFLLENBQUMsOENBQThDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDN0YsQ0FBQztZQUNELGNBQWMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQy9CLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQ2xDLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksRUFDNUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9ELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTdCLElBQUksU0FBUyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3ZCLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLGVBQWUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO1FBQ3RDLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDMUYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FDbEQsUUFBUSxFQUFFLFVBQVUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDMUUsVUFBVSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3JDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFDRCxNQUFNLFdBQVcsR0FDYixFQUFFLENBQUMsbUJBQW1CLENBQUMsU0FBVSxFQUFFLGVBQWdCLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDL0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJ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QUMxRixJQUFJLEdBQUcsS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7SUFFRCx3RkFBd0Y7SUFDeEYsMEZBQTBGO0lBQzFGLDZGQUE2RjtJQUM3Rix3RkFBd0Y7SUFDeEYsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDbEIsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbkMsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQy9CLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQ3ZGLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakUsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBRXJFLCtFQUErRTtRQUMvRSxPQUFPLE9BQU8sS0FBSyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDM0QsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBlIGZyb20gJy4uLy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7UjNEZWZlckJsb2NrTWV0YWRhdGF9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtpY3VGcm9tSTE4bk1lc3NhZ2UsIGlzU2luZ2xlSTE4bkljdX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmltcG9ydCB7Q29tcGlsYXRpb25Vbml0LCBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7QklOQVJZX09QRVJBVE9SUywgbmFtZXNwYWNlRm9yS2V5LCBwcmVmaXhXaXRoTmFtZXNwYWNlfSBmcm9tICcuL2NvbnZlcnNpb24nO1xuXG5jb25zdCBjb21wYXRpYmlsaXR5TW9kZSA9IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI7XG5cbi8vIFNjaGVtYSBjb250YWluaW5nIERPTSBlbGVtZW50cyBhbmQgdGhlaXIgcHJvcGVydGllcy5cbmNvbnN0IGRvbVNjaGVtYSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuLy8gVGFnIG5hbWUgb2YgdGhlIGBuZy10ZW1wbGF0ZWAgZWxlbWVudC5cbmNvbnN0IE5HX1RFTVBMQVRFX1RBR19OQU1FID0gJ25nLXRlbXBsYXRlJztcblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICogVE9ETzogUmVmYWN0b3IgbW9yZSBvZiB0aGUgaW5nZXN0aW9uIGNvZGUgaW50byBwaGFzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RDb21wb25lbnQoXG4gICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCB0ZW1wbGF0ZTogdC5Ob2RlW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICBkZWZlckJsb2Nrc01ldGE6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPik6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKFxuICAgICAgY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIGkxOG5Vc2VFeHRlcm5hbElkcyxcbiAgICAgIGRlZmVyQmxvY2tzTWV0YSk7XG4gIGluZ2VzdE5vZGVzKGpvYi5yb290LCB0ZW1wbGF0ZSk7XG4gIHJldHVybiBqb2I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9zdEJpbmRpbmdJbnB1dCB7XG4gIGNvbXBvbmVudE5hbWU6IHN0cmluZztcbiAgY29tcG9uZW50U2VsZWN0b3I6IHN0cmluZztcbiAgcHJvcGVydGllczogZS5QYXJzZWRQcm9wZXJ0eVtdfG51bGw7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBldmVudHM6IGUuUGFyc2VkRXZlbnRbXXxudWxsO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBob3N0IGJpbmRpbmcgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QmluZGluZyhcbiAgICBpbnB1dDogSG9zdEJpbmRpbmdJbnB1dCwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYihpbnB1dC5jb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlKTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBpbnB1dC5wcm9wZXJ0aWVzID8/IFtdKSB7XG4gICAgbGV0IGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gICAgLy8gVE9ETzogdGhpcyBzaG91bGQgcmVhbGx5IGJlIGhhbmRsZWQgaW4gdGhlIHBhcnNlci5cbiAgICBpZiAocHJvcGVydHkubmFtZS5zdGFydHNXaXRoKCdhdHRyLicpKSB7XG4gICAgICBwcm9wZXJ0eS5uYW1lID0gcHJvcGVydHkubmFtZS5zdWJzdHJpbmcoJ2F0dHIuJy5sZW5ndGgpO1xuICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGU7XG4gICAgfVxuICAgIGlmIChwcm9wZXJ0eS5pc0FuaW1hdGlvbikge1xuICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5BbmltYXRpb247XG4gICAgfVxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICBiaW5kaW5nUGFyc2VyXG4gICAgICAgICAgICAuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICAgICAgICBpbnB1dC5jb21wb25lbnRTZWxlY3RvciwgcHJvcGVydHkubmFtZSwgYmluZGluZ0tpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgaW5nZXN0SG9zdFByb3BlcnR5KGpvYiwgcHJvcGVydHksIGJpbmRpbmdLaW5kLCBzZWN1cml0eUNvbnRleHRzKTtcbiAgfVxuICBmb3IgKGNvbnN0IFtuYW1lLCBleHByXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dC5hdHRyaWJ1dGVzKSA/PyBbXSkge1xuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoaW5wdXQuY29tcG9uZW50U2VsZWN0b3IsIG5hbWUsIHRydWUpXG4gICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuICAgIGluZ2VzdEhvc3RBdHRyaWJ1dGUoam9iLCBuYW1lLCBleHByLCBzZWN1cml0eUNvbnRleHRzKTtcbiAgfVxuICBmb3IgKGNvbnN0IGV2ZW50IG9mIGlucHV0LmV2ZW50cyA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RFdmVudChqb2IsIGV2ZW50KTtcbiAgfVxuICByZXR1cm4gam9iO1xufVxuXG4vLyBUT0RPOiBXZSBzaG91bGQgcmVmYWN0b3IgdGhlIHBhcnNlciB0byB1c2UgdGhlIHNhbWUgdHlwZXMgYW5kIHN0cnVjdHVyZXMgZm9yIGhvc3QgYmluZGluZ3MgYXNcbi8vIHdpdGggb3JkaW5hcnkgY29tcG9uZW50cy4gVGhpcyB3b3VsZCBhbGxvdyB1cyB0byBzaGFyZSBhIGxvdCBtb3JlIGluZ2VzdGlvbiBjb2RlLlxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RQcm9wZXJ0eShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHByb3BlcnR5OiBlLlBhcnNlZFByb3BlcnR5LCBiaW5kaW5nS2luZDogaXIuQmluZGluZ0tpbmQsXG4gICAgc2VjdXJpdHlDb250ZXh0czogU2VjdXJpdHlDb250ZXh0W10pOiB2b2lkIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBjb25zdCBhc3QgPSBwcm9wZXJ0eS5leHByZXNzaW9uLmFzdDtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgYXN0LnN0cmluZ3MsIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgcHJvcGVydHkuc291cmNlU3BhbikpLCBbXSk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoYXN0LCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pO1xuICB9XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGJpbmRpbmdLaW5kLCBwcm9wZXJ0eS5uYW1lLCBleHByZXNzaW9uLCBudWxsLCBzZWN1cml0eUNvbnRleHRzLCBmYWxzZSwgZmFsc2UsXG4gICAgICBudWxsLCAvKiBUT0RPOiBIb3cgZG8gSG9zdCBiaW5kaW5ncyBoYW5kbGUgaTE4biBhdHRycz8gKi8gbnVsbCwgcHJvcGVydHkuc291cmNlU3BhbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEF0dHJpYnV0ZShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIG5hbWU6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbixcbiAgICBzZWN1cml0eUNvbnRleHRzOiBTZWN1cml0eUNvbnRleHRbXSk6IHZvaWQge1xuICBjb25zdCBhdHRyQmluZGluZyA9IGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgbmFtZSwgdmFsdWUsIG51bGwsIHNlY3VyaXR5Q29udGV4dHMsXG4gICAgICAvKiBIb3N0IGF0dHJpYnV0ZXMgc2hvdWxkIGFsd2F5cyBiZSBleHRyYWN0ZWQgdG8gY29uc3QgaG9zdEF0dHJzLCBldmVuIGlmIHRoZXkgYXJlIG5vdFxuICAgICAgICpzdHJpY3RseSogdGV4dCBsaXRlcmFscyAqL1xuICAgICAgdHJ1ZSwgZmFsc2UsIG51bGwsXG4gICAgICAvKiBUT0RPICovIG51bGwsXG4gICAgICAvKiogVE9ETzogTWF5IGJlIG51bGw/ICovIHZhbHVlLnNvdXJjZVNwYW4hKTtcbiAgam9iLnJvb3QudXBkYXRlLnB1c2goYXR0ckJpbmRpbmcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEV2ZW50KGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgZXZlbnQ6IGUuUGFyc2VkRXZlbnQpIHtcbiAgY29uc3QgW3BoYXNlLCB0YXJnZXRdID0gZXZlbnQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuUmVndWxhciA/IFtudWxsLCBldmVudC50YXJnZXRPclBoYXNlXSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbZXZlbnQudGFyZ2V0T3JQaGFzZSwgbnVsbF07XG4gIGNvbnN0IGV2ZW50QmluZGluZyA9IGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBldmVudC5uYW1lLCBudWxsLFxuICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyhqb2Iucm9vdCwgZXZlbnQuaGFuZGxlciwgZXZlbnQuaGFuZGxlclNwYW4pLCBwaGFzZSwgdGFyZ2V0LCB0cnVlLFxuICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gIGpvYi5yb290LmNyZWF0ZS5wdXNoKGV2ZW50QmluZGluZyk7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQ29udGVudCkge1xuICAgICAgaW5nZXN0Q29udGVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGluZ2VzdFRleHQodW5pdCwgbm9kZSwgbnVsbCk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCBub2RlLCBudWxsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LklmQmxvY2spIHtcbiAgICAgIGluZ2VzdElmQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Td2l0Y2hCbG9jaykge1xuICAgICAgaW5nZXN0U3dpdGNoQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5EZWZlcnJlZEJsb2NrKSB7XG4gICAgICBpbmdlc3REZWZlckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWN1KSB7XG4gICAgICBpbmdlc3RJY3UodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Gb3JMb29wQmxvY2spIHtcbiAgICAgIGluZ2VzdEZvckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBlbGVtZW50IEFTVCBmcm9tIHRoZSB0ZW1wbGF0ZSBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBlbGVtZW50OiB0LkVsZW1lbnQpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCBlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2VsZW1lbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgICAgZWxlbWVudE5hbWUsIGlkLCBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlS2V5KSxcbiAgICAgIGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyBlbGVtZW50LmkxOG4gOiB1bmRlZmluZWQsXG4gICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChzdGFydE9wKTtcblxuICBpbmdlc3RFbGVtZW50QmluZGluZ3ModW5pdCwgc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG5cbiAgLy8gU3RhcnQgaTE4biwgaWYgbmVlZGVkLCBnb2VzIGFmdGVyIHRoZSBlbGVtZW50IGNyZWF0ZSBhbmQgYmluZGluZ3MsIGJ1dCBiZWZvcmUgdGhlIG5vZGVzXG4gIGxldCBpMThuQmxvY2tJZDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBpZiAoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgaTE4bkJsb2NrSWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5TdGFydE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmkxOG4sIHVuZGVmaW5lZCwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGluZ2VzdE5vZGVzKHVuaXQsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gIC8vIFRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGVuZCBvcCBpcyB0eXBpY2FsbHkgdGhlIGVsZW1lbnQgY2xvc2luZyB0YWcuIEhvd2V2ZXIsIGlmIG5vIGNsb3NpbmcgdGFnXG4gIC8vIGV4aXN0cywgc3VjaCBhcyBpbiBgPGlucHV0PmAsIHdlIHVzZSB0aGUgc3RhcnQgc291cmNlIHNwYW4gaW5zdGVhZC4gVXN1YWxseSB0aGUgc3RhcnQgYW5kIGVuZFxuICAvLyBpbnN0cnVjdGlvbnMgd2lsbCBiZSBjb2xsYXBzZWQgaW50byBvbmUgYGVsZW1lbnRgIGluc3RydWN0aW9uLCBuZWdhdGluZyB0aGUgcHVycG9zZSBvZiB0aGlzXG4gIC8vIGZhbGxiYWNrLCBidXQgaW4gY2FzZXMgd2hlbiBpdCBpcyBub3QgY29sbGFwc2VkIChzdWNoIGFzIGFuIGlucHV0IHdpdGggYSBiaW5kaW5nKSwgd2Ugc3RpbGxcbiAgLy8gd2FudCB0byBtYXAgdGhlIGVuZCBpbnN0cnVjdGlvbiB0byB0aGUgbWFpbiBlbGVtZW50LlxuICBjb25zdCBlbmRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRFbmRPcChpZCwgZWxlbWVudC5lbmRTb3VyY2VTcGFuID8/IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChlbmRPcCk7XG5cbiAgLy8gSWYgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGVsZW1lbnQsIGluc2VydCBpMThuIHN0YXJ0IGFuZCBlbmQgb3BzLlxuICBpZiAoaTE4bkJsb2NrSWQgIT09IG51bGwpIHtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgaXIuY3JlYXRlSTE4bkVuZE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pLCBlbmRPcCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBpZiAodG1wbC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEodG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRlbXBsYXRlOiAke3RtcGwuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgbGV0IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID0gdG1wbC50YWdOYW1lO1xuICBsZXQgbmFtZXNwYWNlUHJlZml4OiBzdHJpbmd8bnVsbCA9ICcnO1xuICBpZiAodG1wbC50YWdOYW1lKSB7XG4gICAgW25hbWVzcGFjZVByZWZpeCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2VdID0gc3BsaXROc05hbWUodG1wbC50YWdOYW1lKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyB0bXBsLmkxOG4gOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5hbWVzcGFjZSA9IG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VQcmVmaXgpO1xuICBjb25zdCBmdW5jdGlvbk5hbWVTdWZmaXggPSB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gbnVsbCA/XG4gICAgICAnJyA6XG4gICAgICBwcmVmaXhXaXRoTmFtZXNwYWNlKHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBuYW1lc3BhY2UpO1xuICBjb25zdCB0ZW1wbGF0ZUtpbmQgPVxuICAgICAgaXNQbGFpblRlbXBsYXRlKHRtcGwpID8gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUgOiBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbDtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBjaGlsZFZpZXcueHJlZiwgdGVtcGxhdGVLaW5kLCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgZnVuY3Rpb25OYW1lU3VmZml4LCBuYW1lc3BhY2UsXG4gICAgICBpMThuUGxhY2Vob2xkZXIsIHRtcGwuc3RhcnRTb3VyY2VTcGFuLCB0bXBsLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gIGluZ2VzdFRlbXBsYXRlQmluZGluZ3ModW5pdCwgdGVtcGxhdGVPcCwgdG1wbCwgdGVtcGxhdGVLaW5kKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0ZW1wbGF0ZU9wLCB0bXBsKTtcbiAgaW5nZXN0Tm9kZXMoY2hpbGRWaWV3LCB0bXBsLmNoaWxkcmVuKTtcblxuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgdG1wbC52YXJpYWJsZXMpIHtcbiAgICBjaGlsZFZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQobmFtZSwgdmFsdWUgIT09ICcnID8gdmFsdWUgOiAnJGltcGxpY2l0Jyk7XG4gIH1cblxuICAvLyBJZiB0aGlzIGlzIGEgcGxhaW4gdGVtcGxhdGUgYW5kIHRoZXJlIGlzIGFuIGkxOG4gbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggaXQsIGluc2VydCBpMThuIHN0YXJ0XG4gIC8vIGFuZCBlbmQgb3BzLiBGb3Igc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGVzLCB0aGUgaTE4biBvcHMgd2lsbCBiZSBhZGRlZCB3aGVuIGluZ2VzdGluZyB0aGVcbiAgLy8gZWxlbWVudC90ZW1wbGF0ZSB0aGUgZGlyZWN0aXZlIGlzIHBsYWNlZCBvbi5cbiAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUgJiYgdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcihcbiAgICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biwgdW5kZWZpbmVkLCB0bXBsLnN0YXJ0U291cmNlU3BhbiksXG4gICAgICAgIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShcbiAgICAgICAgaXIuY3JlYXRlSTE4bkVuZE9wKGlkLCB0bXBsLmVuZFNvdXJjZVNwYW4gPz8gdG1wbC5zdGFydFNvdXJjZVNwYW4pLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgY29udGVudCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Q29udGVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBjb250ZW50OiB0LkNvbnRlbnQpOiB2b2lkIHtcbiAgaWYgKGNvbnRlbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmICEoY29udGVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgZWxlbWVudDogJHtjb250ZW50LmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcChcbiAgICAgIHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRlbnQuc2VsZWN0b3IsIGNvbnRlbnQuaTE4biwgY29udGVudC5zb3VyY2VTcGFuKTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGNvbnRlbnQuYXR0cmlidXRlcykge1xuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoY29udGVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgIHRydWUsIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cbiAgdW5pdC5jcmVhdGUucHVzaChvcCk7XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZXh0KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuVGV4dCwgaWN1UGxhY2Vob2xkZXI6IHN0cmluZ3xudWxsKTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICBpci5jcmVhdGVUZXh0T3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSwgaWN1UGxhY2Vob2xkZXIsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpY3VQbGFjZWhvbGRlcjogc3RyaW5nfG51bGwpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlcnMgPSB0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lciA/XG4gICAgICB0ZXh0LmkxOG4uY2hpbGRyZW5cbiAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgIC5tYXAocGxhY2Vob2xkZXIgPT4gcGxhY2Vob2xkZXIubmFtZSkgOlxuICAgICAgW107XG4gIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCA+IDAgJiYgaTE4blBsYWNlaG9sZGVycy5sZW5ndGggIT09IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIG51bWJlciBvZiBpMThuIHBsYWNlaG9sZGVycyAoJHtcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2ApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIGljdVBsYWNlaG9sZGVyLCB0ZXh0LnNvdXJjZVNwYW4pKTtcbiAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdCBnZW5lcmF0ZSBzb3VyY2UgbWFwcyBmb3Igc3ViLWV4cHJlc3Npb25zIGluc2lkZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLiBXZSBjb3B5IHRoYXQgYmVoYXZpb3IgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAvLyBUT0RPOiBpcyBpdCBhY3R1YWxseSBjb3JyZWN0IHRvIGdlbmVyYXRlIHRoZXNlIGV4dHJhIG1hcHMgaW4gbW9kZXJuIG1vZGU/XG4gIGNvbnN0IGJhc2VTb3VyY2VTcGFuID0gdW5pdC5qb2IuY29tcGF0aWJpbGl0eSA/IG51bGwgOiB0ZXh0LnNvdXJjZVNwYW47XG4gIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVUZXh0T3AoXG4gICAgICB0ZXh0WHJlZixcbiAgICAgIG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgICAgaTE4blBsYWNlaG9sZGVycyksXG4gICAgICB0ZXh0LnNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBpZmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdElmQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWZCbG9jazogdC5JZkJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaWZCbG9jay5icmFuY2hlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGlmQ2FzZSA9IGlmQmxvY2suYnJhbmNoZXNbaV07XG4gICAgY29uc3QgY1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBsZXQgdGFnTmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gICAgLy8gT25seSB0aGUgZmlyc3QgYnJhbmNoIGNhbiBiZSB1c2VkIGZvciBwcm9qZWN0aW9uLCBiZWNhdXNlIHRoZSBjb25kaXRpb25hbFxuICAgIC8vIHVzZXMgdGhlIGNvbnRhaW5lciBvZiB0aGUgZmlyc3QgYnJhbmNoIGFzIHRoZSBpbnNlcnRpb24gcG9pbnQgZm9yIGFsbCBicmFuY2hlcy5cbiAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgY1ZpZXcueHJlZiwgaWZDYXNlKTtcbiAgICB9XG4gICAgaWYgKGlmQ2FzZS5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGNWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGlmQ2FzZS5leHByZXNzaW9uQWxpYXMubmFtZSwgaXIuQ1RYX1JFRik7XG4gICAgfVxuXG4gICAgbGV0IGlmQ2FzZUkxOG5NZXRhID0gdW5kZWZpbmVkO1xuICAgIGlmIChpZkNhc2UuaTE4biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIShpZkNhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGlmIGJsb2NrOiAke2lmQ2FzZS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgICAgfVxuICAgICAgaWZDYXNlSTE4bk1ldGEgPSBpZkNhc2UuaTE4bjtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLCB0YWdOYW1lLCAnQ29uZGl0aW9uYWwnLCBpci5OYW1lc3BhY2UuSFRNTCxcbiAgICAgICAgaWZDYXNlSTE4bk1ldGEsIGlmQ2FzZS5zdGFydFNvdXJjZVNwYW4sIGlmQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRlbXBsYXRlT3AuaGFuZGxlO1xuICAgIH1cblxuICAgIGNvbnN0IGNhc2VFeHByID0gaWZDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KGlmQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCkgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPSBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihcbiAgICAgICAgY2FzZUV4cHIsIHRlbXBsYXRlT3AueHJlZiwgdGVtcGxhdGVPcC5oYW5kbGUsIGlmQ2FzZS5leHByZXNzaW9uQWxpYXMpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgaWZDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9XG4gICAgICBpci5jcmVhdGVDb25kaXRpb25hbE9wKGZpcnN0WHJlZiEsIGZpcnN0U2xvdEhhbmRsZSEsIG51bGwsIGNvbmRpdGlvbnMsIGlmQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQHN3aXRjaGAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIC8vIERvbid0IGluZ2VzdCBlbXB0eSBzd2l0Y2hlcyBzaW5jZSB0aGV5IHdvbid0IHJlbmRlciBhbnl0aGluZy5cbiAgaWYgKHN3aXRjaEJsb2NrLmNhc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3Qgc3dpdGNoQ2FzZSBvZiBzd2l0Y2hCbG9jay5jYXNlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgbGV0IHN3aXRjaENhc2VJMThuTWV0YSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc3dpdGNoQ2FzZS5pMThuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghKHN3aXRjaENhc2UuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3Igc3dpdGNoIGJsb2NrOiAke3N3aXRjaENhc2UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaENhc2VJMThuTWV0YSA9IHN3aXRjaENhc2UuaTE4bjtcbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgbnVsbCwgJ0Nhc2UnLCBpci5OYW1lc3BhY2UuSFRNTCwgc3dpdGNoQ2FzZUkxOG5NZXRhLFxuICAgICAgICBzd2l0Y2hDYXNlLnN0YXJ0U291cmNlU3Bhbiwgc3dpdGNoQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgICBmaXJzdFNsb3RIYW5kbGUgPSB0ZW1wbGF0ZU9wLmhhbmRsZTtcbiAgICB9XG4gICAgY29uc3QgY2FzZUV4cHIgPSBzd2l0Y2hDYXNlLmV4cHJlc3Npb24gP1xuICAgICAgICBjb252ZXJ0QXN0KHN3aXRjaENhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIHN3aXRjaEJsb2NrLnN0YXJ0U291cmNlU3BhbikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPVxuICAgICAgICBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdGVtcGxhdGVPcC54cmVmLCB0ZW1wbGF0ZU9wLmhhbmRsZSk7XG4gICAgY29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbmFsQ2FzZUV4cHIpO1xuICAgIGluZ2VzdE5vZGVzKGNWaWV3LCBzd2l0Y2hDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9IGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoXG4gICAgICBmaXJzdFhyZWYhLCBmaXJzdFNsb3RIYW5kbGUhLCBjb252ZXJ0QXN0KHN3aXRjaEJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSwgY29uZGl0aW9ucyxcbiAgICAgIHN3aXRjaEJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKGNvbmRpdGlvbmFsKTtcbn1cblxuZnVuY3Rpb24gaW5nZXN0RGVmZXJWaWV3KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN1ZmZpeDogc3RyaW5nLCBpMThuTWV0YTogaTE4bi5JMThuTWV0YXx1bmRlZmluZWQsXG4gICAgY2hpbGRyZW4/OiB0Lk5vZGVbXSwgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IGlyLlRlbXBsYXRlT3B8bnVsbCB7XG4gIGlmIChpMThuTWV0YSAhPT0gdW5kZWZpbmVkICYmICEoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1VuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGRlZmVyIGJsb2NrJyk7XG4gIH1cbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgbnVsbCwgYERlZmVyJHtzdWZmaXh9YCwgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICBpMThuTWV0YSwgc291cmNlU3BhbiEsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IGJsb2NrTWV0YSA9IHVuaXQuam9iLmRlZmVyQmxvY2tzTWV0YS5nZXQoZGVmZXJCbG9jayk7XG4gIGlmIChibG9ja01ldGEgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVuYWJsZSB0byBmaW5kIG1ldGFkYXRhIGZvciBkZWZlcnJlZCBibG9ja2ApO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIGRlZmVyIG1haW4gdmlldyBhbmQgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgbWFpbiA9XG4gICAgICBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suaTE4biwgZGVmZXJCbG9jay5jaGlsZHJlbiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKSE7XG4gIGNvbnN0IGxvYWRpbmcgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnTG9hZGluZycsIGRlZmVyQmxvY2subG9hZGluZz8uaTE4biwgZGVmZXJCbG9jay5sb2FkaW5nPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2subG9hZGluZz8uc291cmNlU3Bhbik7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ1BsYWNlaG9sZGVyJywgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uaTE4biwgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnRXJyb3InLCBkZWZlckJsb2NrLmVycm9yPy5pMThuLCBkZWZlckJsb2NrLmVycm9yPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4pO1xuXG4gIC8vIENyZWF0ZSB0aGUgbWFpbiBkZWZlciBvcCwgYW5kIG9wcyBmb3IgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgZGVmZXJYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgY29uc3QgZGVmZXJPcCA9XG4gICAgICBpci5jcmVhdGVEZWZlck9wKGRlZmVyWHJlZiwgbWFpbi54cmVmLCBtYWluLmhhbmRsZSwgYmxvY2tNZXRhLCBkZWZlckJsb2NrLnNvdXJjZVNwYW4pO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyVmlldyA9IHBsYWNlaG9sZGVyPy54cmVmID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJTbG90ID0gcGxhY2Vob2xkZXI/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdTbG90ID0gbG9hZGluZz8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AuZXJyb3JTbG90ID0gZXJyb3I/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nQWZ0ZXJUaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5hZnRlclRpbWUgPz8gbnVsbDtcbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wKTtcblxuICAvLyBDb25maWd1cmUgYWxsIGRlZmVyIGBvbmAgY29uZGl0aW9ucy5cbiAgLy8gVE9ETzogcmVmYWN0b3IgcHJlZmV0Y2ggdHJpZ2dlcnMgdG8gdXNlIGEgc2VwYXJhdGUgb3AgdHlwZSwgd2l0aCBhIHNoYXJlZCBzdXBlcmNsYXNzLiBUaGlzIHdpbGxcbiAgLy8gbWFrZSBpdCBlYXNpZXIgdG8gcmVmYWN0b3IgcHJlZmV0Y2ggYmVoYXZpb3IgaW4gdGhlIGZ1dHVyZS5cbiAgbGV0IHByZWZldGNoID0gZmFsc2U7XG4gIGxldCBkZWZlck9uT3BzOiBpci5EZWZlck9uT3BbXSA9IFtdO1xuICBsZXQgZGVmZXJXaGVuT3BzOiBpci5EZWZlcldoZW5PcFtdID0gW107XG4gIGZvciAoY29uc3QgdHJpZ2dlcnMgb2YgW2RlZmVyQmxvY2sudHJpZ2dlcnMsIGRlZmVyQmxvY2sucHJlZmV0Y2hUcmlnZ2Vyc10pIHtcbiAgICBpZiAodHJpZ2dlcnMuaWRsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSwgcHJlZmV0Y2gsIHRyaWdnZXJzLmlkbGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGV9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy5pbW1lZGlhdGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnRpbWVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy50aW1lci5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaG92ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmhvdmVyLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMuaG92ZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmludGVyYWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmludGVyYWN0aW9uLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy52aWV3cG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMudmlld3BvcnQucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy52aWV3cG9ydC5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMud2hlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodHJpZ2dlcnMud2hlbi52YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIHN1cHBvcnRzIHRoaXMgY2FzZSwgYnV0IGl0J3MgdmVyeSBzdHJhbmdlIHRvIG1lLiBXaGF0IHdvdWxkIGl0XG4gICAgICAgIC8vIGV2ZW4gbWVhbj9cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGludGVycG9sYXRpb24gaW4gZGVmZXIgYmxvY2sgd2hlbiB0cmlnZ2VyYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlcldoZW5PcChcbiAgICAgICAgICBkZWZlclhyZWYsIGNvbnZlcnRBc3QodHJpZ2dlcnMud2hlbi52YWx1ZSwgdW5pdC5qb2IsIHRyaWdnZXJzLndoZW4uc291cmNlU3BhbiksIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLndoZW4uc291cmNlU3Bhbik7XG4gICAgICBkZWZlcldoZW5PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cblxuICAgIC8vIElmIG5vIChub24tcHJlZmV0Y2hpbmcpIGRlZmVyIHRyaWdnZXJzIHdlcmUgcHJvdmlkZWQsIGRlZmF1bHQgdG8gYGlkbGVgLlxuICAgIGlmIChkZWZlck9uT3BzLmxlbmd0aCA9PT0gMCAmJiBkZWZlcldoZW5PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIGZhbHNlLCBudWxsISkpO1xuICAgIH1cbiAgICBwcmVmZXRjaCA9IHRydWU7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT25PcHMpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGRlZmVyV2hlbk9wcyk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdEljdSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpY3U6IHQuSWN1KSB7XG4gIGlmIChpY3UuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBpc1NpbmdsZUkxOG5JY3UoaWN1LmkxOG4pKSB7XG4gICAgY29uc3QgeHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgY29uc3QgaWN1Tm9kZSA9IGljdS5pMThuLm5vZGVzWzBdO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1U3RhcnRPcCh4cmVmLCBpY3UuaTE4biwgaWN1RnJvbUkxOG5NZXNzYWdlKGljdS5pMThuKS5uYW1lLCBudWxsISkpO1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCB0ZXh0XSBvZiBPYmplY3QuZW50cmllcyh7Li4uaWN1LnZhcnMsIC4uLmljdS5wbGFjZWhvbGRlcnN9KSkge1xuICAgICAgaWYgKHRleHQgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgdGV4dCwgcGxhY2Vob2xkZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0VGV4dCh1bml0LCB0ZXh0LCBwbGFjZWhvbGRlcik7XG4gICAgICB9XG4gICAgfVxuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1RW5kT3AoeHJlZikpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBJQ1U6ICR7aWN1LmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBmb3JgIGJsb2NrIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RGb3JCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBmb3JCbG9jazogdC5Gb3JMb29wQmxvY2spOiB2b2lkIHtcbiAgY29uc3QgcmVwZWF0ZXJWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgLy8gU2V0IGFsbCB0aGUgY29udGV4dCB2YXJpYWJsZXMgYW5kIGFsaWFzZXMgYXZhaWxhYmxlIGluIHRoZSByZXBlYXRlci5cbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGZvckJsb2NrLml0ZW0ubmFtZSwgZm9yQmxvY2suaXRlbS52YWx1ZSk7XG4gIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChcbiAgICAgIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQudmFsdWUpO1xuXG4gIC8vIFdlIGNvcHkgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcidzIHNjaGVtZSBvZiBjcmVhdGluZyBuYW1lcyBmb3IgYCRjb3VudGAgYW5kIGAkaW5kZXhgIHRoYXQgYXJlXG4gIC8vIHN1ZmZpeGVkIHdpdGggc3BlY2lhbCBpbmZvcm1hdGlvbiwgdG8gZGlzYW1iaWd1YXRlIHdoaWNoIGxldmVsIG9mIG5lc3RlZCBsb29wIHRoZSBiZWxvdyBhbGlhc2VzXG4gIC8vIHJlZmVyIHRvLlxuICAvLyBUT0RPOiBXZSBzaG91bGQgcmVmYWN0b3IgVGVtcGxhdGUgUGlwZWxpbmUncyB2YXJpYWJsZSBwaGFzZXMgdG8gZ3JhY2VmdWxseSBoYW5kbGUgc2hhZG93aW5nLFxuICAvLyBhbmQgYXJiaXRyYXJpbHkgbWFueSBsZXZlbHMgb2YgdmFyaWFibGVzIGRlcGVuZGluZyBvbiBlYWNoIG90aGVyLlxuICBjb25zdCBpbmRleE5hbWUgPSBgybUke2ZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWV9XyR7cmVwZWF0ZXJWaWV3LnhyZWZ9YDtcbiAgY29uc3QgY291bnROYW1lID0gYMm1JHtmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lfV8ke3JlcGVhdGVyVmlldy54cmVmfWA7XG4gIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChpbmRleE5hbWUsIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGNvdW50TmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQudmFsdWUpO1xuXG4gIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQWxpYXMsXG4gICAgbmFtZTogbnVsbCxcbiAgICBpZGVudGlmaWVyOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRmaXJzdC5uYW1lLFxuICAgIGV4cHJlc3Npb246IG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoaW5kZXhOYW1lKS5pZGVudGljYWwoby5saXRlcmFsKDApKVxuICB9KTtcbiAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICBuYW1lOiBudWxsLFxuICAgIGlkZW50aWZpZXI6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSxcbiAgICBleHByZXNzaW9uOiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGluZGV4TmFtZSkuaWRlbnRpY2FsKFxuICAgICAgICBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGNvdW50TmFtZSkubWludXMoby5saXRlcmFsKDEpKSlcbiAgfSk7XG4gIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQWxpYXMsXG4gICAgbmFtZTogbnVsbCxcbiAgICBpZGVudGlmaWVyOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRldmVuLm5hbWUsXG4gICAgZXhwcmVzc2lvbjogbmV3IGlyLkxleGljYWxSZWFkRXhwcihpbmRleE5hbWUpLm1vZHVsbyhvLmxpdGVyYWwoMikpLmlkZW50aWNhbChvLmxpdGVyYWwoMCkpXG4gIH0pO1xuICByZXBlYXRlclZpZXcuYWxpYXNlcy5hZGQoe1xuICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgIG5hbWU6IG51bGwsXG4gICAgaWRlbnRpZmllcjogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsXG4gICAgZXhwcmVzc2lvbjogbmV3IGlyLkxleGljYWxSZWFkRXhwcihpbmRleE5hbWUpLm1vZHVsbyhvLmxpdGVyYWwoMikpLm5vdElkZW50aWNhbChvLmxpdGVyYWwoMCkpXG4gIH0pO1xuXG4gIGNvbnN0IHNvdXJjZVNwYW4gPSBjb252ZXJ0U291cmNlU3Bhbihmb3JCbG9jay50cmFja0J5LnNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICBjb25zdCB0cmFjayA9IGNvbnZlcnRBc3QoZm9yQmxvY2sudHJhY2tCeSwgdW5pdC5qb2IsIHNvdXJjZVNwYW4pO1xuXG4gIGluZ2VzdE5vZGVzKHJlcGVhdGVyVmlldywgZm9yQmxvY2suY2hpbGRyZW4pO1xuXG4gIGxldCBlbXB0eVZpZXc6IFZpZXdDb21waWxhdGlvblVuaXR8bnVsbCA9IG51bGw7XG4gIGxldCBlbXB0eVRhZ05hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgaWYgKGZvckJsb2NrLmVtcHR5ICE9PSBudWxsKSB7XG4gICAgZW1wdHlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgaW5nZXN0Tm9kZXMoZW1wdHlWaWV3LCBmb3JCbG9jay5lbXB0eS5jaGlsZHJlbik7XG4gICAgZW1wdHlUYWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCBlbXB0eVZpZXcueHJlZiwgZm9yQmxvY2suZW1wdHkpO1xuICB9XG5cbiAgY29uc3QgdmFyTmFtZXM6IGlyLlJlcGVhdGVyVmFyTmFtZXMgPSB7XG4gICAgJGluZGV4OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRpbmRleC5uYW1lLFxuICAgICRjb3VudDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQubmFtZSxcbiAgICAkZmlyc3Q6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsXG4gICAgJGxhc3Q6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSxcbiAgICAkZXZlbjogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLFxuICAgICRvZGQ6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJG9kZC5uYW1lLFxuICAgICRpbXBsaWNpdDogZm9yQmxvY2suaXRlbS5uYW1lLFxuICB9O1xuXG4gIGlmIChmb3JCbG9jay5pMThuICE9PSB1bmRlZmluZWQgJiYgIShmb3JCbG9jay5pMThuIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBvciBAZm9yJyk7XG4gIH1cbiAgaWYgKGZvckJsb2NrLmVtcHR5Py5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEoZm9yQmxvY2suZW1wdHkuaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgb3IgQGVtcHR5Jyk7XG4gIH1cbiAgY29uc3QgaTE4blBsYWNlaG9sZGVyID0gZm9yQmxvY2suaTE4bjtcbiAgY29uc3QgZW1wdHlJMThuUGxhY2Vob2xkZXIgPSBmb3JCbG9jay5lbXB0eT8uaTE4bjtcblxuICBjb25zdCB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCByZXBlYXRlclZpZXcueHJlZiwgZm9yQmxvY2spO1xuICBjb25zdCByZXBlYXRlckNyZWF0ZSA9IGlyLmNyZWF0ZVJlcGVhdGVyQ3JlYXRlT3AoXG4gICAgICByZXBlYXRlclZpZXcueHJlZiwgZW1wdHlWaWV3Py54cmVmID8/IG51bGwsIHRhZ05hbWUsIHRyYWNrLCB2YXJOYW1lcywgZW1wdHlUYWdOYW1lLFxuICAgICAgaTE4blBsYWNlaG9sZGVyLCBlbXB0eUkxOG5QbGFjZWhvbGRlciwgZm9yQmxvY2suc3RhcnRTb3VyY2VTcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChyZXBlYXRlckNyZWF0ZSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoXG4gICAgICBmb3JCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYixcbiAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLmV4cHJlc3Npb24uc3BhbiwgZm9yQmxvY2suc291cmNlU3BhbikpO1xuICBjb25zdCByZXBlYXRlciA9IGlyLmNyZWF0ZVJlcGVhdGVyT3AoXG4gICAgICByZXBlYXRlckNyZWF0ZS54cmVmLCByZXBlYXRlckNyZWF0ZS5oYW5kbGUsIGV4cHJlc3Npb24sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKHJlcGVhdGVyKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGVtcGxhdGUgQVNUIGV4cHJlc3Npb24gaW50byBhbiBvdXRwdXQgQVNUIGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRBc3QoXG4gICAgYXN0OiBlLkFTVCwgam9iOiBDb21waWxhdGlvbkpvYiwgYmFzZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5hc3QsIGpvYiwgYmFzZVNvdXJjZVNwYW4pO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlSZWFkKSB7XG4gICAgY29uc3QgaXNUaGlzUmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcjtcbiAgICAvLyBXaGV0aGVyIHRoaXMgaXMgYW4gaW1wbGljaXQgcmVjZWl2ZXIsICpleGNsdWRpbmcqIGV4cGxpY2l0IHJlYWRzIG9mIGB0aGlzYC5cbiAgICBjb25zdCBpc0ltcGxpY2l0UmVjZWl2ZXIgPVxuICAgICAgICBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIgJiYgIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcik7XG4gICAgLy8gV2hldGhlciB0aGUgIG5hbWUgb2YgdGhlIHJlYWQgaXMgYSBub2RlIHRoYXQgc2hvdWxkIGJlIG5ldmVyIHJldGFpbiBpdHMgZXhwbGljaXQgdGhpc1xuICAgIC8vIHJlY2VpdmVyLlxuICAgIGNvbnN0IGlzU3BlY2lhbE5vZGUgPSBhc3QubmFtZSA9PT0gJyRhbnknIHx8IGFzdC5uYW1lID09PSAnJGV2ZW50JztcbiAgICAvLyBUT0RPOiBUaGUgbW9zdCBzZW5zaWJsZSBjb25kaXRpb24gaGVyZSB3b3VsZCBiZSBzaW1wbHkgYGlzSW1wbGljaXRSZWNlaXZlcmAsIHRvIGNvbnZlcnQgb25seVxuICAgIC8vIGFjdHVhbCBpbXBsaWNpdCBgdGhpc2AgcmVhZHMsIGFuZCBub3QgZXhwbGljaXQgb25lcy4gSG93ZXZlciwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciAoYW5kXG4gICAgLy8gdGhlIFR5cGVjaGVjayBibG9jayEpIGJvdGggaGF2ZSB0aGUgc2FtZSBidWcsIGluIHdoaWNoIHRoZXkgYWxzbyBjb25zaWRlciBleHBsaWNpdCBgdGhpc2BcbiAgICAvLyByZWFkcyB0byBiZSBpbXBsaWNpdC4gVGhpcyBjYXVzZXMgcHJvYmxlbXMgd2hlbiB0aGUgZXhwbGljaXQgYHRoaXNgIHJlYWQgaXMgaW5zaWRlIGFcbiAgICAvLyB0ZW1wbGF0ZSB3aXRoIGEgY29udGV4dCB0aGF0IGFsc28gcHJvdmlkZXMgdGhlIHZhcmlhYmxlIG5hbWUgYmVpbmcgcmVhZDpcbiAgICAvLyBgYGBcbiAgICAvLyA8bmctdGVtcGxhdGUgbGV0LWE+e3t0aGlzLmF9fTwvbmctdGVtcGxhdGU+XG4gICAgLy8gYGBgXG4gICAgLy8gVGhlIHdob2xlIHBvaW50IG9mIHRoZSBleHBsaWNpdCBgdGhpc2Agd2FzIHRvIGFjY2VzcyB0aGUgY2xhc3MgcHJvcGVydHksIGJ1dCBUREIgYW5kIHRoZVxuICAgIC8vIGN1cnJlbnQgVENCIHRyZWF0IHRoZSByZWFkIGFzIGltcGxpY2l0LCBhbmQgZ2l2ZSB5b3UgdGhlIGNvbnRleHQgcHJvcGVydHkgaW5zdGVhZCFcbiAgICAvL1xuICAgIC8vIEZvciBub3csIHdlIGVtdWxhdGUgdGhpcyBvbGQgYmVodmFpb3IgYnkgYWdncmVzc2l2ZWx5IGNvbnZlcnRpbmcgZXhwbGljaXQgcmVhZHMgdG8gdG9cbiAgICAvLyBpbXBsaWNpdCByZWFkcywgZXhjZXB0IGZvciB0aGUgc3BlY2lhbCBjYXNlcyB0aGF0IFREQiBhbmQgdGhlIGN1cnJlbnQgVENCIHByb3RlY3QuIEhvd2V2ZXIsXG4gICAgLy8gaXQgd291bGQgYmUgYW4gaW1wcm92ZW1lbnQgdG8gZml4IHRoaXMuXG4gICAgLy9cbiAgICAvLyBTZWUgYWxzbyB0aGUgY29ycmVzcG9uZGluZyBjb21tZW50IGZvciB0aGUgVENCLCBpbiBgdHlwZV9jaGVja19ibG9jay50c2AuXG4gICAgaWYgKGlzSW1wbGljaXRSZWNlaXZlciB8fCAoaXNUaGlzUmVjZWl2ZXIgJiYgIWlzU3BlY2lhbE5vZGUpKSB7XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSwgbnVsbCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgICAgLy8gVE9ETzogSXMgaXQgY29ycmVjdCB0byBhbHdheXMgdXNlIHRoZSByb290IGNvbnRleHQgaW4gcGxhY2Ugb2YgdGhlIGltcGxpY2l0IHJlY2VpdmVyP1xuICAgICAgICAgIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKSwgYXN0Lm5hbWUsIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBudWxsLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkV3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNhbGwpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgSW1wbGljaXRSZWNlaXZlcmApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBhc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5VbmFyeSkge1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdG9yKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgby5VbmFyeU9wZXJhdG9yLlBsdXMsIGNvbnZlcnRBc3QoYXN0LmV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICByZXR1cm4gbmV3IG8uVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvLlVuYXJ5T3BlcmF0b3IuTWludXMsIGNvbnZlcnRBc3QoYXN0LmV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gdW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0b3J9YCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluYXJ5KSB7XG4gICAgY29uc3Qgb3BlcmF0b3IgPSBCSU5BUllfT1BFUkFUT1JTLmdldChhc3Qub3BlcmF0aW9uKTtcbiAgICBpZiAob3BlcmF0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5rbm93biBiaW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICBvcGVyYXRvciwgY29udmVydEFzdChhc3QubGVmdCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJpZ2h0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikge1xuICAgIC8vIFRPRE86IHNob3VsZCBjb250ZXh0IGV4cHJlc3Npb25zIGhhdmUgc291cmNlIG1hcHM/XG4gICAgcmV0dXJuIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgby5SZWFkS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBDaGFpbiBpbiB1bmtub3duIGNvbnRleHRgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxNYXApIHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmtleXMubWFwKChrZXksIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWVzW2lkeF07XG4gICAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nXG4gICAgICAvLyBleHByZXNzaW9uP1xuICAgICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXkua2V5LCBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwga2V5LnF1b3RlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsQXJyYXkpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nIGV4cHJlc3Npb24/XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Db25kaXRpb25hbCkge1xuICAgIHJldHVybiBuZXcgby5Db25kaXRpb25hbEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmNvbmRpdGlvbiwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnRydWVFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5mYWxzZUV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Ob25OdWxsQXNzZXJ0KSB7XG4gICAgLy8gQSBub24tbnVsbCBhc3NlcnRpb24gc2hvdWxkbid0IGltcGFjdCBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb25zLCBzbyB3ZSBjYW4ganVzdCBkcm9wIGl0LlxuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmRpbmdQaXBlKSB7XG4gICAgLy8gVE9ETzogcGlwZXMgc2hvdWxkIHByb2JhYmx5IGhhdmUgc291cmNlIG1hcHM7IGZpZ3VyZSBvdXQgZGV0YWlscy5cbiAgICByZXR1cm4gbmV3IGlyLlBpcGVCaW5kaW5nRXhwcihcbiAgICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksXG4gICAgICAgIG5ldyBpci5TbG90SGFuZGxlKCksXG4gICAgICAgIGFzdC5uYW1lLFxuICAgICAgICBbXG4gICAgICAgICAgY29udmVydEFzdChhc3QuZXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICAuLi5hc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgIF0sXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVLZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVLZXllZFJlYWRFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlUHJvcGVydHlSZWFkRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVDYWxsKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgYXN0LmFyZ3MubWFwKGEgPT4gY29udmVydEFzdChhLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuRW1wdHlFeHByKSB7XG4gICAgcmV0dXJuIG5ldyBpci5FbXB0eUV4cHIoY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5QcmVmaXhOb3QpIHtcbiAgICByZXR1cm4gby5ub3QoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGUgXCIke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfVwiIGluIGZpbGUgXCIke1xuICAgICAgICBiYXNlU291cmNlU3Bhbj8uc3RhcnQuZmlsZS51cmx9XCJgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXN0V2l0aEludGVycG9sYXRpb24oXG4gICAgam9iOiBDb21waWxhdGlvbkpvYiwgdmFsdWU6IGUuQVNUfHN0cmluZywgaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGF8bnVsbHx1bmRlZmluZWQsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChlID0+IGNvbnZlcnRBc3QoZSwgam9iLCBzb3VyY2VTcGFuID8/IG51bGwpKSxcbiAgICAgICAgT2JqZWN0LmtleXMoYXNNZXNzYWdlKGkxOG5NZXRhKT8ucGxhY2Vob2xkZXJzID8/IHt9KSk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVCkge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIHNvdXJjZVNwYW4gPz8gbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIGV4cHJlc3Npb247XG59XG5cbi8vIFRPRE86IENhbiB3ZSBwb3B1bGF0ZSBUZW1wbGF0ZSBiaW5kaW5nIGtpbmRzIGluIGluZ2VzdD9cbmNvbnN0IEJJTkRJTkdfS0lORFMgPSBuZXcgTWFwPGUuQmluZGluZ1R5cGUsIGlyLkJpbmRpbmdLaW5kPihbXG4gIFtlLkJpbmRpbmdUeXBlLlByb3BlcnR5LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlXSxcbiAgW2UuQmluZGluZ1R5cGUuQ2xhc3MsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZV0sXG4gIFtlLkJpbmRpbmdUeXBlLlN0eWxlLCBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQW5pbWF0aW9uLCBpci5CaW5kaW5nS2luZC5BbmltYXRpb25dLFxuXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHRlbXBsYXRlIGlzIGEgcGxhaW4gbmctdGVtcGxhdGUgKGFzIG9wcG9zZWQgdG8gYW5vdGhlciBraW5kIG9mIHRlbXBsYXRlXG4gKiBzdWNoIGFzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGUgb3IgY29udHJvbCBmbG93IHRlbXBsYXRlKS4gVGhpcyBpcyBjaGVja2VkIGJhc2VkIG9uIHRoZVxuICogdGFnTmFtZS4gV2UgY2FuIGV4cGVjdCB0aGF0IG9ubHkgcGxhaW4gbmctdGVtcGxhdGVzIHdpbGwgY29tZSB0aHJvdWdoIHdpdGggYSB0YWdOYW1lIG9mXG4gKiAnbmctdGVtcGxhdGUnLlxuICpcbiAqIEhlcmUgYXJlIHNvbWUgb2YgdGhlIGNhc2VzIHdlIGV4cGVjdDpcbiAqXG4gKiB8IEFuZ3VsYXIgSFRNTCAgICAgICAgICAgICAgICAgICAgICAgfCBUZW1wbGF0ZSB0YWdOYW1lICAgfFxuICogfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHwgLS0tLS0tLS0tLS0tLS0tLS0tIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8ZGl2ICpuZ0lmPVwidHJ1ZVwiPmAgICAgICAgICAgICAgICB8ICdkaXYnICAgICAgICAgICAgICB8XG4gKiB8IGA8c3ZnPjxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgfCAnc3ZnOm5nLXRlbXBsYXRlJyAgfFxuICogfCBgQGlmICh0cnVlKSB7YCAgICAgICAgICAgICAgICAgICAgIHwgJ0NvbmRpdGlvbmFsJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChwbGFpbikgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAoc3RydWN0dXJhbCkgfCBudWxsICAgICAgICAgICAgICAgfFxuICovXG5mdW5jdGlvbiBpc1BsYWluVGVtcGxhdGUodG1wbDogdC5UZW1wbGF0ZSkge1xuICByZXR1cm4gc3BsaXROc05hbWUodG1wbC50YWdOYW1lID8/ICcnKVsxXSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUU7XG59XG5cbi8qKlxuICogRW5zdXJlcyB0aGF0IHRoZSBpMThuTWV0YSwgaWYgcHJvdmlkZWQsIGlzIGFuIGkxOG4uTWVzc2FnZS5cbiAqL1xuZnVuY3Rpb24gYXNNZXNzYWdlKGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfG51bGx8dW5kZWZpbmVkKTogaTE4bi5NZXNzYWdlfG51bGwge1xuICBpZiAoaTE4bk1ldGEgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmICghKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSkge1xuICAgIHRocm93IEVycm9yKGBFeHBlY3RlZCBpMThuIG1ldGEgdG8gYmUgYSBNZXNzYWdlLCBidXQgZ290OiAke2kxOG5NZXRhLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIGkxOG5NZXRhO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGxldCBiaW5kaW5ncyA9IG5ldyBBcnJheTxpci5CaW5kaW5nT3B8aXIuRXh0cmFjdGVkQXR0cmlidXRlT3B8bnVsbD4oKTtcblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gQXR0cmlidXRlIGxpdGVyYWwgYmluZGluZ3MsIHN1Y2ggYXMgYGF0dHIuZm9vPVwiYmFyXCJgLlxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoZWxlbWVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhdHRyLnZhbHVlLCBhdHRyLmkxOG4pLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIHRydWUsXG4gICAgICAgIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgLy8gQWxsIGR5bmFtaWMgYmluZGluZ3MgKGJvdGggYXR0cmlidXRlIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncykuXG4gICAgYmluZGluZ3MucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgIG9wLnhyZWYsIEJJTkRJTkdfS0lORFMuZ2V0KGlucHV0LnR5cGUpISwgaW5wdXQubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhc3RPZihpbnB1dC52YWx1ZSksIGlucHV0LmkxOG4pLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGlucHV0LmkxOG4pID8/IG51bGwsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goYmluZGluZ3MuZmlsdGVyKFxuICAgICAgKGIpOiBiIGlzIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUpKTtcbiAgdW5pdC51cGRhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoKGIpOiBiIGlzIGlyLkJpbmRpbmdPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuQmluZGluZykpO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksIG91dHB1dC5waGFzZSxcbiAgICAgICAgb3V0cHV0LnRhcmdldCwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICAvLyBJZiBhbnkgb2YgdGhlIGJpbmRpbmdzIG9uIHRoaXMgZWxlbWVudCBoYXZlIGFuIGkxOG4gbWVzc2FnZSwgdGhlbiBhbiBpMThuIGF0dHJzIGNvbmZpZ3VyYXRpb25cbiAgLy8gb3AgaXMgYWxzbyByZXF1aXJlZC5cbiAgaWYgKGJpbmRpbmdzLnNvbWUoYiA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVJMThuQXR0cmlidXRlc09wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIG9wLnhyZWYpKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlQmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIHRlbXBsYXRlOiB0LlRlbXBsYXRlLFxuICAgIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwpOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcHxpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcHxudWxsPigpO1xuXG4gIGZvciAoY29uc3QgYXR0ciBvZiB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgdGVtcGxhdGVLaW5kLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIudHlwZSwgYXR0ci5uYW1lLCBhc3RPZihhdHRyLnZhbHVlKSwgYXR0ci51bml0LCBhdHRyLnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgdGVtcGxhdGUuYXR0cmlidXRlcykge1xuICAgIC8vIEF0dHJpYnV0ZSBsaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgdGVtcGxhdGUuaW5wdXRzKSB7XG4gICAgLy8gRHluYW1pYyBiaW5kaW5ncyAoYm90aCBhdHRyaWJ1dGUgYW5kIHByb3BlcnR5IGJpbmRpbmdzKS5cbiAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQudHlwZSwgaW5wdXQubmFtZSwgYXN0T2YoaW5wdXQudmFsdWUpLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShpbnB1dC5pMThuKSwgaW5wdXQuc291cmNlU3BhbikpO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoXG4gICAgICAoYik6IGIgaXMgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGJpbmRpbmdzLmZpbHRlcigoYik6IGIgaXMgaXIuQmluZGluZ09wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5CaW5kaW5nKSk7XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGVtcGxhdGUub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSwgb3V0cHV0LnBoYXNlLFxuICAgICAgICAgIG91dHB1dC50YXJnZXQsIGZhbHNlLCBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgIH1cbiAgICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbCAmJlxuICAgICAgICBvdXRwdXQudHlwZSAhPT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAvLyBBbmltYXRpb24gYmluZGluZ3MgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUncyBjb25zdCBhcnJheS5cbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIG91dHB1dC5uYW1lLCBmYWxzZSk7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgIG9wLnhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBvdXRwdXQubmFtZSwgbnVsbCwgbnVsbCwgbnVsbCwgc2VjdXJpdHlDb250ZXh0KSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETzogUGVyaGFwcyB3ZSBjb3VsZCBkbyB0aGlzIGluIGEgcGhhc2U/IChJdCBsaWtlbHkgd291bGRuJ3QgY2hhbmdlIHRoZSBzbG90IGluZGljZXMuKVxuICBpZiAoYmluZGluZ3Muc29tZShiID0+IGI/LmkxOG5NZXNzYWdlKSAhPT0gbnVsbCkge1xuICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5BdHRyaWJ1dGVzT3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgbmV3IGlyLlNsb3RIYW5kbGUoKSwgb3AueHJlZikpO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGluZ2VzdCBhbiBpbmRpdmlkdWFsIGJpbmRpbmcgb24gYSB0ZW1wbGF0ZSwgZWl0aGVyIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAsIG9yIGFuXG4gKiBpbXBsaWNpdCB0ZW1wbGF0ZSBjcmVhdGVkIHZpYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS5cbiAqXG4gKiBCaW5kaW5ncyBvbiB0ZW1wbGF0ZXMgYXJlICpleHRyZW1lbHkqIHRyaWNreS4gSSBoYXZlIHRyaWVkIHRvIGlzb2xhdGUgYWxsIG9mIHRoZSBjb25mdXNpbmcgZWRnZVxuICogY2FzZXMgaW50byB0aGlzIGZ1bmN0aW9uLCBhbmQgdG8gY29tbWVudCBpdCB3ZWxsIHRvIGRvY3VtZW50IHRoZSBiZWhhdmlvci5cbiAqXG4gKiBTb21lIG9mIHRoaXMgYmVoYXZpb3IgaXMgaW50dWl0aXZlbHkgaW5jb3JyZWN0LCBhbmQgd2Ugc2hvdWxkIGNvbnNpZGVyIGNoYW5naW5nIGl0IGluIHRoZSBmdXR1cmUuXG4gKlxuICogQHBhcmFtIHZpZXcgVGhlIGNvbXBpbGF0aW9uIHVuaXQgZm9yIHRoZSB2aWV3IGNvbnRhaW5pbmcgdGhlIHRlbXBsYXRlLlxuICogQHBhcmFtIHhyZWYgVGhlIHhyZWYgb2YgdGhlIHRlbXBsYXRlIG9wLlxuICogQHBhcmFtIHR5cGUgVGhlIGJpbmRpbmcgdHlwZSwgYWNjb3JkaW5nIHRvIHRoZSBwYXJzZXIuIFRoaXMgaXMgZmFpcmx5IHJlYXNvbmFibGUsIGUuZy4gYm90aFxuICogICAgIGR5bmFtaWMgYW5kIHN0YXRpYyBhdHRyaWJ1dGVzIGhhdmUgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUuXG4gKiBAcGFyYW0gbmFtZSBUaGUgYmluZGluZydzIG5hbWUuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGJpbmRpbmdzJ3MgdmFsdWUsIHdoaWNoIHdpbGwgZWl0aGVyIGJlIGFuIGlucHV0IEFTVCBleHByZXNzaW9uLCBvciBhIHN0cmluZ1xuICogICAgIGxpdGVyYWwuIE5vdGUgdGhhdCB0aGUgaW5wdXQgQVNUIGV4cHJlc3Npb24gbWF5IG9yIG1heSBub3QgYmUgY29uc3QgLS0gaXQgd2lsbCBvbmx5IGJlIGFcbiAqICAgICBzdHJpbmcgbGl0ZXJhbCBpZiB0aGUgcGFyc2VyIGNvbnNpZGVyZWQgaXQgYSB0ZXh0IGJpbmRpbmcuXG4gKiBAcGFyYW0gdW5pdCBJZiB0aGUgYmluZGluZyBoYXMgYSB1bml0IChlLmcuIGBweGAgZm9yIHN0eWxlIGJpbmRpbmdzKSwgdGhlbiB0aGlzIGlzIHRoZSB1bml0LlxuICogQHBhcmFtIHNlY3VyaXR5Q29udGV4dCBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAqIEBwYXJhbSBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSBXaGV0aGVyIHRoaXMgYmluZGluZyBhY3R1YWxseSBhcHBsaWVzIHRvIHRoZSBzdHJ1Y3R1cmFsXG4gKiAgICAgbmctdGVtcGxhdGUuIEZvciBleGFtcGxlLCBhbiBgbmdGb3JgIHdvdWxkIGFjdHVhbGx5IGFwcGx5IHRvIHRoZSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiAoTW9zdFxuICogICAgIGJpbmRpbmdzIG9uIHN0cnVjdHVyYWwgZWxlbWVudHMgdGFyZ2V0IHRoZSBpbm5lciBlbGVtZW50LCBub3QgdGhlIHRlbXBsYXRlLilcbiAqIEBwYXJhbSB0ZW1wbGF0ZUtpbmQgV2hldGhlciB0aGlzIGlzIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAgb3IgYW4gaW1wbGljaXQgdGVtcGxhdGUgY3JlYXRlZCBieVxuICogICAgIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUuIFRoaXMgc2hvdWxkIG5ldmVyIGJlIGEgYmxvY2sgdGVtcGxhdGUuXG4gKiBAcGFyYW0gaTE4bk1lc3NhZ2UgVGhlIGkxOG4gbWV0YWRhdGEgZm9yIHRoZSBiaW5kaW5nLCBpZiBhbnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBUaGUgc291cmNlIHNwYW4gb2YgdGhlIGJpbmRpbmcuXG4gKiBAcmV0dXJucyBBbiBJUiBiaW5kaW5nIG9wLCBvciBudWxsIGlmIHRoZSBiaW5kaW5nIHNob3VsZCBiZSBza2lwcGVkLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLCB0eXBlOiBlLkJpbmRpbmdUeXBlLCBuYW1lOiBzdHJpbmcsXG4gICAgdmFsdWU6IGUuQVNUfHN0cmluZywgdW5pdDogc3RyaW5nfG51bGwsIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuLCB0ZW1wbGF0ZUtpbmQ6IGlyLlRlbXBsYXRlS2luZHxudWxsLFxuICAgIGkxOG5NZXNzYWdlOiBpMThuLk1lc3NhZ2V8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQmluZGluZ09wfFxuICAgIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wfG51bGwge1xuICBjb25zdCBpc1RleHRCaW5kaW5nID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbiAgLy8gSWYgdGhpcyBpcyBhIHN0cnVjdHVyYWwgdGVtcGxhdGUsIHRoZW4gc2V2ZXJhbCBraW5kcyBvZiBiaW5kaW5ncyBzaG91bGQgbm90IHJlc3VsdCBpbiBhblxuICAvLyB1cGRhdGUgaW5zdHJ1Y3Rpb24uXG4gIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsKSB7XG4gICAgaWYgKCFpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSAmJlxuICAgICAgICAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eSB8fCB0eXBlID09PSBlLkJpbmRpbmdUeXBlLkNsYXNzIHx8XG4gICAgICAgICB0eXBlID09PSBlLkJpbmRpbmdUeXBlLlN0eWxlKSkge1xuICAgICAgLy8gQmVjYXVzZSB0aGlzIGJpbmRpbmcgZG9lc24ndCByZWFsbHkgdGFyZ2V0IHRoZSBuZy10ZW1wbGF0ZSwgaXQgbXVzdCBiZSBhIGJpbmRpbmcgb24gYW5cbiAgICAgIC8vIGlubmVyIG5vZGUgb2YgYSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiBXZSBjYW4ndCBza2lwIGl0IGVudGlyZWx5LCBiZWNhdXNlIHdlIHN0aWxsIG5lZWQgaXQgb25cbiAgICAgIC8vIHRoZSBuZy10ZW1wbGF0ZSdzIGNvbnN0cyAoZS5nLiBmb3IgdGhlIHB1cnBvc2VzIG9mIGRpcmVjdGl2ZSBtYXRjaGluZykuIEhvd2V2ZXIsIHdlIHNob3VsZFxuICAgICAgLy8gbm90IGdlbmVyYXRlIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgaXQuXG4gICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgeHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIG5hbWUsIG51bGwsIG51bGwsIGkxOG5NZXNzYWdlLCBzZWN1cml0eUNvbnRleHQpO1xuICAgIH1cblxuICAgIGlmICghaXNUZXh0QmluZGluZyAmJiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUgfHwgdHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BbmltYXRpb24pKSB7XG4gICAgICAvLyBBZ2FpbiwgdGhpcyBiaW5kaW5nIGRvZXNuJ3QgcmVhbGx5IHRhcmdldCB0aGUgbmctdGVtcGxhdGU7IGl0IGFjdHVhbGx5IHRhcmdldHMgdGhlIGVsZW1lbnRcbiAgICAgIC8vIGluc2lkZSB0aGUgc3RydWN0dXJhbCB0ZW1wbGF0ZS4gSW4gdGhlIGNhc2Ugb2Ygbm9uLXRleHQgYXR0cmlidXRlIG9yIGFuaW1hdGlvbiBiaW5kaW5ncyxcbiAgICAgIC8vIHRoZSBiaW5kaW5nIGRvZXNuJ3QgZXZlbiBzaG93IHVwIG9uIHRoZSBuZy10ZW1wbGF0ZSBjb25zdCBhcnJheSwgc28gd2UganVzdCBza2lwIGl0XG4gICAgICAvLyBlbnRpcmVseS5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGxldCBiaW5kaW5nVHlwZSA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcblxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSkge1xuICAgIC8vIFdlIGtub3cgd2UgYXJlIGRlYWxpbmcgd2l0aCBiaW5kaW5ncyBkaXJlY3RseSBvbiBhbiBleHBsaWNpdCBuZy10ZW1wbGF0ZS5cbiAgICAvLyBTdGF0aWMgYXR0cmlidXRlIGJpbmRpbmdzIHNob3VsZCBiZSBjb2xsZWN0ZWQgaW50byB0aGUgY29uc3QgYXJyYXkgYXMgay92IHBhaXJzLiBQcm9wZXJ0eVxuICAgIC8vIGJpbmRpbmdzIHNob3VsZCByZXN1bHQgaW4gYSBgcHJvcGVydHlgIGluc3RydWN0aW9uLCBhbmQgYEF0dHJpYnV0ZU1hcmtlci5CaW5kaW5nc2AgY29uc3RcbiAgICAvLyBlbnRyaWVzLlxuICAgIC8vXG4gICAgLy8gVGhlIGRpZmZpY3VsdHkgaXMgd2l0aCBkeW5hbWljIGF0dHJpYnV0ZSwgc3R5bGUsIGFuZCBjbGFzcyBiaW5kaW5ncy4gVGhlc2UgZG9uJ3QgcmVhbGx5IG1ha2VcbiAgICAvLyBzZW5zZSBvbiBhbiBgbmctdGVtcGxhdGVgIGFuZCBzaG91bGQgcHJvYmFibHkgYmUgcGFyc2VyIGVycm9ycy4gSG93ZXZlcixcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGdlbmVyYXRlcyBgcHJvcGVydHlgIGluc3RydWN0aW9ucyBmb3IgdGhlbSwgYW5kIHNvIHdlIGRvIHRoYXQgYXNcbiAgICAvLyB3ZWxsLlxuICAgIC8vXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIGhhdmUgYSBzbGlnaHQgYmVoYXZpb3IgZGlmZmVyZW5jZSB3aXRoIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI6IGFsdGhvdWdoXG4gICAgLy8gVERCIGVtaXRzIGBwcm9wZXJ0eWAgaW5zdHJ1Y3Rpb25zIGZvciBkeW5hbWljIGF0dHJpYnV0ZXMsIHN0eWxlcywgYW5kIGNsYXNzZXMsIG9ubHkgc3R5bGVzXG4gICAgLy8gYW5kIGNsYXNzZXMgYWxzbyBnZXQgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3NgIGZpZWxkLiBEeW5hbWljXG4gICAgLy8gYXR0cmlidXRlIGJpbmRpbmdzIGFyZSBtaXNzaW5nIGZyb20gdGhlIGNvbnN0cyBlbnRpcmVseS4gV2UgY2hvb3NlIHRvIGVtaXQgdGhlbSBpbnRvIHRoZVxuICAgIC8vIGNvbnN0cyBmaWVsZCBhbnl3YXksIHRvIGF2b2lkIGNyZWF0aW5nIHNwZWNpYWwgY2FzZXMgZm9yIHNvbWV0aGluZyBzbyBhcmNhbmUgYW5kIG5vbnNlbnNpY2FsLlxuICAgIGlmICh0eXBlID09PSBlLkJpbmRpbmdUeXBlLkNsYXNzIHx8IHR5cGUgPT09IGUuQmluZGluZ1R5cGUuU3R5bGUgfHxcbiAgICAgICAgKHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQXR0cmlidXRlICYmICFpc1RleHRCaW5kaW5nKSkge1xuICAgICAgLy8gVE9ETzogVGhlc2UgY2FzZXMgc2hvdWxkIGJlIHBhcnNlIGVycm9ycy5cbiAgICAgIGJpbmRpbmdUeXBlID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIHhyZWYsIGJpbmRpbmdUeXBlLCBuYW1lLCBjb252ZXJ0QXN0V2l0aEludGVycG9sYXRpb24odmlldy5qb2IsIHZhbHVlLCBpMThuTWVzc2FnZSksIHVuaXQsXG4gICAgICBzZWN1cml0eUNvbnRleHQsIGlzVGV4dEJpbmRpbmcsIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLCB0ZW1wbGF0ZUtpbmQsIGkxOG5NZXNzYWdlLFxuICAgICAgc291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHMoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBoYW5kbGVyOiBlLkFTVCwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wW10ge1xuICBoYW5kbGVyID0gYXN0T2YoaGFuZGxlcik7XG4gIGNvbnN0IGhhbmRsZXJPcHMgPSBuZXcgQXJyYXk8aXIuVXBkYXRlT3A+KCk7XG4gIGxldCBoYW5kbGVyRXhwcnM6IGUuQVNUW10gPSBoYW5kbGVyIGluc3RhbmNlb2YgZS5DaGFpbiA/IGhhbmRsZXIuZXhwcmVzc2lvbnMgOiBbaGFuZGxlcl07XG4gIGlmIChoYW5kbGVyRXhwcnMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gIH1cbiAgY29uc3QgZXhwcmVzc2lvbnMgPSBoYW5kbGVyRXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgaGFuZGxlclNwYW4pKTtcbiAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcbiAgaGFuZGxlck9wcy5wdXNoKC4uLmV4cHJlc3Npb25zLm1hcChcbiAgICAgIGUgPT4gaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZSwgZS5zb3VyY2VTcGFuKSkpKTtcbiAgaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChyZXR1cm5FeHByLCByZXR1cm5FeHByLnNvdXJjZVNwYW4pKSk7XG4gIHJldHVybiBoYW5kbGVyT3BzO1xufVxuXG5mdW5jdGlvbiBhc3RPZihhc3Q6IGUuQVNUfGUuQVNUV2l0aFNvdXJjZSk6IGUuQVNUIHtcbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSA/IGFzdC5hc3QgOiBhc3Q7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICAgIHNwYW46IGUuUGFyc2VTcGFuLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gIGlmIChiYXNlU291cmNlU3BhbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICBjb25zdCBlbmQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICBjb25zdCBmdWxsU3RhcnQgPSBiYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kLCBmdWxsU3RhcnQpO1xufVxuXG4vKipcbiAqIFdpdGggdGhlIGRpcmVjdGl2ZS1iYXNlZCBjb250cm9sIGZsb3cgdXNlcnMgd2VyZSBhYmxlIHRvIGNvbmRpdGlvbmFsbHkgcHJvamVjdCBjb250ZW50IHVzaW5nXG4gKiB0aGUgYCpgIHN5bnRheC4gRS5nLiBgPGRpdiAqbmdJZj1cImV4cHJcIiBwcm9qZWN0TWU+PC9kaXY+YCB3aWxsIGJlIHByb2plY3RlZCBpbnRvXG4gKiBgPG5nLWNvbnRlbnQgc2VsZWN0PVwiW3Byb2plY3RNZV1cIi8+YCwgYmVjYXVzZSB0aGUgYXR0cmlidXRlcyBhbmQgdGFnIG5hbWUgZnJvbSB0aGUgYGRpdmAgYXJlXG4gKiBjb3BpZWQgdG8gdGhlIHRlbXBsYXRlIHZpYSB0aGUgdGVtcGxhdGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24uIFdpdGggYEBpZmAgYW5kIGBAZm9yYCB0aGF0IGlzXG4gKiBub3QgdGhlIGNhc2UsIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsIGlzIHBsYWNlZCAqYXJvdW5kKiBlbGVtZW50cywgcmF0aGVyIHRoYW4gKm9uKiB0aGVtLlxuICogVGhlIHJlc3VsdCBpcyB0aGF0IGNvbnRlbnQgcHJvamVjdGlvbiB3b24ndCB3b3JrIGluIHRoZSBzYW1lIHdheSBpZiBhIHVzZXIgY29udmVydHMgZnJvbVxuICogYCpuZ0lmYCB0byBgQGlmYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFpbXMgdG8gY292ZXIgdGhlIG1vc3QgY29tbW9uIGNhc2UgYnkgZG9pbmcgdGhlIHNhbWUgY29weWluZyB3aGVuIGEgY29udHJvbCBmbG93XG4gKiBub2RlIGhhcyAqb25lIGFuZCBvbmx5IG9uZSogcm9vdCBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUuXG4gKlxuICogVGhpcyBhcHByb2FjaCBjb21lcyB3aXRoIHNvbWUgY2F2ZWF0czpcbiAqIDEuIEFzIHNvb24gYXMgYW55IG90aGVyIG5vZGUgaXMgYWRkZWQgdG8gdGhlIHJvb3QsIHRoZSBjb3B5aW5nIGJlaGF2aW9yIHdvbid0IHdvcmsgYW55bW9yZS5cbiAqICAgIEEgZGlhZ25vc3RpYyB3aWxsIGJlIGFkZGVkIHRvIGZsYWcgY2FzZXMgbGlrZSB0aGlzIGFuZCB0byBleHBsYWluIGhvdyB0byB3b3JrIGFyb3VuZCBpdC5cbiAqIDIuIElmIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzYCBpcyBlbmFibGVkLCBpdCdzIHZlcnkgbGlrZWx5IHRoYXQgaW5kZW50YXRpb24gd2lsbCBicmVhayB0aGlzXG4gKiAgICB3b3JrYXJvdW5kLCBiZWNhdXNlIGl0J2xsIGluY2x1ZGUgYW4gYWRkaXRpb25hbCB0ZXh0IG5vZGUgYXMgdGhlIGZpcnN0IGNoaWxkLiBXZSBjYW4gd29ya1xuICogICAgYXJvdW5kIGl0IGhlcmUsIGJ1dCBpbiBhIGRpc2N1c3Npb24gaXQgd2FzIGRlY2lkZWQgbm90IHRvLCBiZWNhdXNlIHRoZSB1c2VyIGV4cGxpY2l0bHkgb3B0ZWRcbiAqICAgIGludG8gcHJlc2VydmluZyB0aGUgd2hpdGVzcGFjZSBhbmQgd2Ugd291bGQgaGF2ZSB0byBkcm9wIGl0IGZyb20gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICogICAgVGhlIGRpYWdub3N0aWMgbWVudGlvbmVkIHBvaW50ICMxIHdpbGwgZmxhZyBzdWNoIGNhc2VzIHRvIHVzZXJzLlxuICpcbiAqIEByZXR1cm5zIFRhZyBuYW1lIHRvIGJlIHVzZWQgZm9yIHRoZSBjb250cm9sIGZsb3cgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLFxuICAgIG5vZGU6IHQuSWZCbG9ja0JyYW5jaHx0LkZvckxvb3BCbG9ja3x0LkZvckxvb3BCbG9ja0VtcHR5KTogc3RyaW5nfG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50fHQuVGVtcGxhdGV8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5FbGVtZW50IHx8IChjaGlsZCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgY2hpbGQudGFnTmFtZSAhPT0gbnVsbCkpIHtcbiAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gIC8vIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uIE5vdGUgdGhhdCBpdCdzIGltcG9ydGFudFxuICAvLyB0aGF0IHdlIGRvbid0IGNvcHkgYW55IGJvdW5kIGF0dHJpYnV0ZXMgc2luY2UgdGhleSBkb24ndCBwYXJ0aWNpcGF0ZSBpbiBjb250ZW50IHByb2plY3Rpb25cbiAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiByb290LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgICB4cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgZmFsc2UsIG51bGwsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcblxuICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICByZXR1cm4gdGFnTmFtZSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUUgPyBudWxsIDogdGFnTmFtZTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIl19