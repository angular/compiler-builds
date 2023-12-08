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
import * as ir from '../ir';
import { ComponentCompilationJob, HostBindingCompilationJob } from './compilation';
import { BINARY_OPERATORS, namespaceForKey, prefixWithNamespace } from './conversion';
const compatibilityMode = ir.CompatibilityMode.TemplateDefinitionBuilder;
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
        ingestHostProperty(job, property, false);
    }
    for (const [name, expr] of Object.entries(input.attributes) ?? []) {
        ingestHostAttribute(job, name, expr);
    }
    for (const event of input.events ?? []) {
        ingestHostEvent(job, event);
    }
    return job;
}
// TODO: We should refactor the parser to use the same types and structures for host bindings as
// with ordinary components. This would allow us to share a lot more ingestion code.
export function ingestHostProperty(job, property, isTextAttribute) {
    let expression;
    const ast = property.expression.ast;
    if (ast instanceof e.Interpolation) {
        expression = new ir.Interpolation(ast.strings, ast.expressions.map(expr => convertAst(expr, job, property.sourceSpan)), []);
    }
    else {
        expression = convertAst(ast, job, property.sourceSpan);
    }
    let bindingKind = ir.BindingKind.Property;
    // TODO: this should really be handled in the parser.
    if (property.name.startsWith('attr.')) {
        property.name = property.name.substring('attr.'.length);
        bindingKind = ir.BindingKind.Attribute;
    }
    if (property.isAnimation) {
        bindingKind = ir.BindingKind.Animation;
    }
    job.root.update.push(ir.createBindingOp(job.root.xref, bindingKind, property.name, expression, null, SecurityContext
        .NONE /* TODO: what should we pass as security context? Passing NONE for now. */, isTextAttribute, false, null, /* TODO: How do Host bindings handle i18n attrs? */ null, property.sourceSpan));
}
export function ingestHostAttribute(job, name, value) {
    const attrBinding = ir.createBindingOp(job.root.xref, ir.BindingKind.Attribute, name, value, null, SecurityContext.NONE, true, false, null, 
    /* TODO */ null, 
    /* TODO: host attribute source spans */ null);
    job.root.update.push(attrBinding);
}
export function ingestHostEvent(job, event) {
    const eventBinding = ir.createListenerOp(job.root.xref, new ir.SlotHandle(), event.name, null, event.targetOrPhase, true, event.sourceSpan);
    // TODO: Can this be a chain?
    eventBinding.handlerOps.push(ir.createStatementOp(new o.ReturnStatement(convertAst(event.handler.ast, job, event.sourceSpan), event.handlerSpan)));
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
            ingestText(unit, node);
        }
        else if (node instanceof t.BoundText) {
            ingestBoundText(unit, node);
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
    const startOp = ir.createElementStartOp(elementName, id, namespaceForKey(namespaceKey), element.i18n instanceof i18n.TagPlaceholder ? element.i18n : undefined, element.startSourceSpan);
    unit.create.push(startOp);
    ingestBindings(unit, startOp, element, null);
    ingestReferences(startOp, element);
    // Start i18n, if needed, goes after the element create and bindings, but before the nodes
    let i18nBlockId = null;
    if (element.i18n instanceof i18n.Message) {
        i18nBlockId = unit.job.allocateXrefId();
        unit.create.push(ir.createI18nStartOp(i18nBlockId, element.i18n));
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
        ir.OpList.insertBefore(ir.createI18nEndOp(i18nBlockId), endOp);
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
    const templateOp = ir.createTemplateOp(childView.xref, templateKind, tagNameWithoutNamespace, functionNameSuffix, namespace, i18nPlaceholder, tmpl.startSourceSpan);
    unit.create.push(templateOp);
    ingestBindings(unit, templateOp, tmpl, templateKind);
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
        ir.OpList.insertAfter(ir.createI18nStartOp(id, tmpl.i18n), childView.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id), childView.create.tail);
    }
}
/**
 * Ingest a literal text node from the AST into the given `ViewCompilation`.
 */
function ingestContent(unit, content) {
    if (content.i18n !== undefined && !(content.i18n instanceof i18n.TagPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for element: ${content.i18n.constructor.name}`);
    }
    const attrs = content.attributes.flatMap(a => [a.name, a.value]);
    const op = ir.createProjectionOp(unit.job.allocateXrefId(), content.selector, content.i18n, attrs, content.sourceSpan);
    for (const attr of content.attributes) {
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue, null, attr.i18n);
    }
    unit.create.push(op);
}
/**
 * Ingest a literal text node from the AST into the given `ViewCompilation`.
 */
function ingestText(unit, text) {
    unit.create.push(ir.createTextOp(unit.job.allocateXrefId(), text.value, text.sourceSpan));
}
/**
 * Ingest an interpolated text node from the AST into the given `ViewCompilation`.
 */
function ingestBoundText(unit, text, i18nPlaceholders) {
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
    if (i18nPlaceholders === undefined) {
        // TODO: We probably can just use the placeholders field, instead of walking the AST.
        i18nPlaceholders = text.i18n instanceof i18n.Container ?
            text.i18n.children
                .filter((node) => node instanceof i18n.Placeholder)
                .map(placeholder => placeholder.name) :
            [];
    }
    if (i18nPlaceholders.length > 0 && i18nPlaceholders.length !== value.expressions.length) {
        throw Error(`Unexpected number of i18n placeholders (${value.expressions.length}) for BoundText with ${value.expressions.length} expressions`);
    }
    const textXref = unit.job.allocateXrefId();
    unit.create.push(ir.createTextOp(textXref, '', text.sourceSpan));
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
        const templateOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, tagName, 'Conditional', ir.Namespace.HTML, ifCaseI18nMeta, ifCase.sourceSpan);
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
        const templateOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, null, 'Case', ir.Namespace.HTML, switchCaseI18nMeta, switchCase.sourceSpan);
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
    const templateOp = ir.createTemplateOp(secondaryView.xref, ir.TemplateKind.Block, null, `Defer${suffix}`, ir.Namespace.HTML, i18nMeta, sourceSpan);
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
                ingestBoundText(unit, text, [placeholder]);
            }
            else {
                ingestText(unit, text);
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
    const createRepeaterAlias = (ident, repeaterVar) => {
        repeaterView.aliases.add({
            kind: ir.SemanticVariableKind.Alias,
            name: null,
            identifier: ident,
            expression: new ir.DerivedRepeaterVarExpr(repeaterView.xref, repeaterVar),
        });
    };
    // Set all the context variables and aliases available in the repeater.
    repeaterView.contextVariables.set(forBlock.item.name, forBlock.item.value);
    repeaterView.contextVariables.set(forBlock.contextVariables.$index.name, forBlock.contextVariables.$index.value);
    repeaterView.contextVariables.set(forBlock.contextVariables.$count.name, forBlock.contextVariables.$count.value);
    createRepeaterAlias(forBlock.contextVariables.$first.name, ir.DerivedRepeaterVarIdentity.First);
    createRepeaterAlias(forBlock.contextVariables.$last.name, ir.DerivedRepeaterVarIdentity.Last);
    createRepeaterAlias(forBlock.contextVariables.$even.name, ir.DerivedRepeaterVarIdentity.Even);
    createRepeaterAlias(forBlock.contextVariables.$odd.name, ir.DerivedRepeaterVarIdentity.Odd);
    const sourceSpan = convertSourceSpan(forBlock.trackBy.span, forBlock.sourceSpan);
    const track = convertAst(forBlock.trackBy, unit.job, sourceSpan);
    ingestNodes(repeaterView, forBlock.children);
    let emptyView = null;
    if (forBlock.empty !== null) {
        emptyView = unit.job.allocateView(unit.xref);
        ingestNodes(emptyView, forBlock.empty.children);
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
    const repeaterCreate = ir.createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, tagName, track, varNames, i18nPlaceholder, emptyI18nPlaceholder, forBlock.sourceSpan);
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
        if (ast.receiver instanceof e.ImplicitReceiver && !(ast.receiver instanceof e.ThisReceiver)) {
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
    return splitNsName(tmpl.tagName ?? '')[1] === 'ng-template';
}
/**
 * Process all of the bindings on an element-like structure in the template AST and convert them
 * to their IR representation.
 */
function ingestBindings(unit, op, element, templateKind) {
    let flags = BindingFlags.None;
    let hasI18nAttributes = false;
    if (element instanceof t.Template) {
        flags |= BindingFlags.OnNgTemplateElement;
        if (isPlainTemplate(element)) {
            flags |= BindingFlags.BindingTargetsTemplate;
        }
        const templateAttrFlags = flags | BindingFlags.BindingTargetsTemplate | BindingFlags.IsStructuralTemplateAttribute;
        for (const attr of element.templateAttrs) {
            if (attr instanceof t.TextAttribute) {
                ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, templateAttrFlags | BindingFlags.TextValue, templateKind, attr.i18n);
                hasI18nAttributes ||= attr.i18n !== undefined;
            }
            else {
                ingestBinding(unit, op.xref, attr.name, attr.value, attr.type, attr.unit, attr.securityContext, attr.sourceSpan, templateAttrFlags, templateKind, attr.i18n);
                hasI18nAttributes ||= attr.i18n !== undefined;
            }
        }
    }
    for (const attr of element.attributes) {
        // This is only attribute TextLiteral bindings, such as `attr.foo="bar"`. This can never be
        // `[attr.foo]="bar"` or `attr.foo="{{bar}}"`, both of which will be handled as inputs with
        // `BindingType.Attribute`.
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, flags | BindingFlags.TextValue, templateKind, attr.i18n);
        hasI18nAttributes ||= attr.i18n !== undefined;
    }
    for (const input of element.inputs) {
        ingestBinding(unit, op.xref, input.name, input.value, input.type, input.unit, input.securityContext, input.sourceSpan, flags, templateKind, input.i18n);
        hasI18nAttributes ||= input.i18n !== undefined;
    }
    for (const output of element.outputs) {
        let listenerOp;
        if (output.type === 1 /* e.ParsedEventType.Animation */) {
            if (output.phase === null) {
                throw Error('Animation listener should have a phase');
            }
        }
        if (element instanceof t.Template && !isPlainTemplate(element)) {
            unit.create.push(ir.createExtractedAttributeOp(op.xref, ir.BindingKind.Property, output.name, null, null, null));
            continue;
        }
        listenerOp = ir.createListenerOp(op.xref, op.handle, output.name, op.tag, output.phase, false, output.sourceSpan);
        // if output.handler is a chain, then push each statement from the chain separately, and
        // return the last one?
        let handlerExprs;
        let handler = output.handler;
        if (handler instanceof e.ASTWithSource) {
            handler = handler.ast;
        }
        if (handler instanceof e.Chain) {
            handlerExprs = handler.expressions;
        }
        else {
            handlerExprs = [handler];
        }
        if (handlerExprs.length === 0) {
            throw new Error('Expected listener to have non-empty expression list.');
        }
        const expressions = handlerExprs.map(expr => convertAst(expr, unit.job, output.handlerSpan));
        const returnExpr = expressions.pop();
        for (const expr of expressions) {
            const stmtOp = ir.createStatementOp(new o.ExpressionStatement(expr, expr.sourceSpan));
            listenerOp.handlerOps.push(stmtOp);
        }
        listenerOp.handlerOps.push(ir.createStatementOp(new o.ReturnStatement(returnExpr, returnExpr.sourceSpan)));
        unit.create.push(listenerOp);
    }
    // TODO: Perhaps we could do this in a phase? (It likely wouldn't change the slot indices.)
    if (hasI18nAttributes) {
        unit.create.push(ir.createI18nAttributesOp(unit.job.allocateXrefId(), new ir.SlotHandle(), op.xref));
    }
}
const BINDING_KINDS = new Map([
    [0 /* e.BindingType.Property */, ir.BindingKind.Property],
    [1 /* e.BindingType.Attribute */, ir.BindingKind.Attribute],
    [2 /* e.BindingType.Class */, ir.BindingKind.ClassName],
    [3 /* e.BindingType.Style */, ir.BindingKind.StyleProperty],
    [4 /* e.BindingType.Animation */, ir.BindingKind.Animation],
]);
var BindingFlags;
(function (BindingFlags) {
    BindingFlags[BindingFlags["None"] = 0] = "None";
    /**
     * The binding is to a static text literal and not to an expression.
     */
    BindingFlags[BindingFlags["TextValue"] = 1] = "TextValue";
    /**
     * The binding belongs to the `<ng-template>` side of a `t.Template`.
     */
    BindingFlags[BindingFlags["BindingTargetsTemplate"] = 2] = "BindingTargetsTemplate";
    /**
     * The binding is on a structural directive.
     */
    BindingFlags[BindingFlags["IsStructuralTemplateAttribute"] = 4] = "IsStructuralTemplateAttribute";
    /**
     * The binding is on a `t.Template`.
     */
    BindingFlags[BindingFlags["OnNgTemplateElement"] = 8] = "OnNgTemplateElement";
})(BindingFlags || (BindingFlags = {}));
function ingestBinding(view, xref, name, value, type, unit, securityContext, sourceSpan, flags, templateKind, i18nMeta) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (i18nMeta !== undefined && !(i18nMeta instanceof i18n.Message)) {
        throw Error(`Unhandled i18n metadata type for binding: ${i18nMeta.constructor.name}`);
    }
    if (flags & BindingFlags.OnNgTemplateElement && !(flags & BindingFlags.BindingTargetsTemplate) &&
        type === 0 /* e.BindingType.Property */) {
        // This binding only exists for later const extraction, and is not an actual binding to be
        // created.
        view.create.push(ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, name, null, null, i18nMeta ?? null));
        return;
    }
    let expression;
    // TODO: We could easily generate source maps for subexpressions in these cases, but
    // TemplateDefinitionBuilder does not. Should we do so?
    if (value instanceof e.Interpolation) {
        let i18nPlaceholders = [];
        if (i18nMeta !== undefined) {
            i18nPlaceholders = Object.keys(i18nMeta.placeholders);
        }
        expression = new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, view.job, null)), i18nPlaceholders);
    }
    else if (value instanceof e.AST) {
        expression = convertAst(value, view.job, null);
    }
    else {
        expression = value;
    }
    if (type === 1 /* e.BindingType.Attribute */ && !(flags & BindingFlags.TextValue) &&
        templateKind === ir.TemplateKind.Structural) {
        // TODO: big comment about why this is stupid.
        return;
    }
    const kind = BINDING_KINDS.get(type);
    view.update.push(ir.createBindingOp(xref, kind, name, expression, unit, securityContext, !!(flags & BindingFlags.TextValue), !!(flags & BindingFlags.IsStructuralTemplateAttribute), templateKind, i18nMeta ?? null, sourceSpan));
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
            ingestBinding(unit, xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue, ir.TemplateKind.Block, attr.i18n);
        }
        const tagName = root instanceof t.Element ? root.name : root.tagName;
        // Don't pass along `ng-template` tag name since it enables directive matching.
        return tagName === 'ng-template' ? null : tagName;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBRXBGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBZ0QsTUFBTSxlQUFlLENBQUM7QUFDaEksT0FBTyxFQUFDLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVwRixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQztBQUV6RTs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FDM0IsYUFBcUIsRUFBRSxRQUFrQixFQUFFLFlBQTBCLEVBQ3JFLHVCQUErQixFQUFFLGtCQUEyQixFQUM1RCxlQUEyRDtJQUM3RCxNQUFNLEdBQUcsR0FBRyxJQUFJLHVCQUF1QixDQUNuQyxhQUFhLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixF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QUMsWUFBWSxDQUFDLEtBQUssRUFDcEYsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2hCO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFckUsK0VBQStFO1FBQy9FLE9BQU8sT0FBTyxLQUFLLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7S0FDbkQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgZSBmcm9tICcuLi8uLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQge1IzRGVmZXJCbG9ja01ldGFkYXRhfSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7aWN1RnJvbUkxOG5NZXNzYWdlLCBpc1NpbmdsZUkxOG5JY3V9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtCSU5BUllfT1BFUkFUT1JTLCBuYW1lc3BhY2VGb3JLZXksIHByZWZpeFdpdGhOYW1lc3BhY2V9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbmNvbnN0IGNvbXBhdGliaWxpdHlNb2RlID0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcjtcblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICogVE9ETzogUmVmYWN0b3IgbW9yZSBvZiB0aGUgaW5nZXN0aW9uIGNvZGUgaW50byBwaGFzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RDb21wb25lbnQoXG4gICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCB0ZW1wbGF0ZTogdC5Ob2RlW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICBkZWZlckJsb2Nrc01ldGE6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPik6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKFxuICAgICAgY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIGkxOG5Vc2VFeHRlcm5hbElkcyxcbiAgICAgIGRlZmVyQmxvY2tzTWV0YSk7XG4gIGluZ2VzdE5vZGVzKGpvYi5yb290LCB0ZW1wbGF0ZSk7XG4gIHJldHVybiBqb2I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9zdEJpbmRpbmdJbnB1dCB7XG4gIGNvbXBvbmVudE5hbWU6IHN0cmluZztcbiAgcHJvcGVydGllczogZS5QYXJzZWRQcm9wZXJ0eVtdfG51bGw7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBldmVudHM6IGUuUGFyc2VkRXZlbnRbXXxudWxsO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBob3N0IGJpbmRpbmcgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QmluZGluZyhcbiAgICBpbnB1dDogSG9zdEJpbmRpbmdJbnB1dCwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYihpbnB1dC5jb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlKTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBpbnB1dC5wcm9wZXJ0aWVzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdFByb3BlcnR5KGpvYiwgcHJvcGVydHksIGZhbHNlKTtcbiAgfVxuICBmb3IgKGNvbnN0IFtuYW1lLCBleHByXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dC5hdHRyaWJ1dGVzKSA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RBdHRyaWJ1dGUoam9iLCBuYW1lLCBleHByKTtcbiAgfVxuICBmb3IgKGNvbnN0IGV2ZW50IG9mIGlucHV0LmV2ZW50cyA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RFdmVudChqb2IsIGV2ZW50KTtcbiAgfVxuICByZXR1cm4gam9iO1xufVxuXG4vLyBUT0RPOiBXZSBzaG91bGQgcmVmYWN0b3IgdGhlIHBhcnNlciB0byB1c2UgdGhlIHNhbWUgdHlwZXMgYW5kIHN0cnVjdHVyZXMgZm9yIGhvc3QgYmluZGluZ3MgYXNcbi8vIHdpdGggb3JkaW5hcnkgY29tcG9uZW50cy4gVGhpcyB3b3VsZCBhbGxvdyB1cyB0byBzaGFyZSBhIGxvdCBtb3JlIGluZ2VzdGlvbiBjb2RlLlxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RQcm9wZXJ0eShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHByb3BlcnR5OiBlLlBhcnNlZFByb3BlcnR5LCBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBjb25zdCBhc3QgPSBwcm9wZXJ0eS5leHByZXNzaW9uLmFzdDtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgYXN0LnN0cmluZ3MsIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgcHJvcGVydHkuc291cmNlU3BhbikpLCBbXSk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoYXN0LCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pO1xuICB9XG4gIGxldCBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAvLyBUT0RPOiB0aGlzIHNob3VsZCByZWFsbHkgYmUgaGFuZGxlZCBpbiB0aGUgcGFyc2VyLlxuICBpZiAocHJvcGVydHkubmFtZS5zdGFydHNXaXRoKCdhdHRyLicpKSB7XG4gICAgcHJvcGVydHkubmFtZSA9IHByb3BlcnR5Lm5hbWUuc3Vic3RyaW5nKCdhdHRyLicubGVuZ3RoKTtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZTtcbiAgfVxuICBpZiAocHJvcGVydHkuaXNBbmltYXRpb24pIHtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbjtcbiAgfVxuICBqb2Iucm9vdC51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBiaW5kaW5nS2luZCwgcHJvcGVydHkubmFtZSwgZXhwcmVzc2lvbiwgbnVsbCxcbiAgICAgIFNlY3VyaXR5Q29udGV4dFxuICAgICAgICAgIC5OT05FIC8qIFRPRE86IHdoYXQgc2hvdWxkIHdlIHBhc3MgYXMgc2VjdXJpdHkgY29udGV4dD8gUGFzc2luZyBOT05FIGZvciBub3cuICovLFxuICAgICAgaXNUZXh0QXR0cmlidXRlLCBmYWxzZSwgbnVsbCwgLyogVE9ETzogSG93IGRvIEhvc3QgYmluZGluZ3MgaGFuZGxlIGkxOG4gYXR0cnM/ICovIG51bGwsXG4gICAgICBwcm9wZXJ0eS5zb3VyY2VTcGFuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QXR0cmlidXRlKFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBuYW1lLCB2YWx1ZSwgbnVsbCwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIHRydWUsIGZhbHNlLFxuICAgICAgbnVsbCxcbiAgICAgIC8qIFRPRE8gKi8gbnVsbCxcbiAgICAgIC8qIFRPRE86IGhvc3QgYXR0cmlidXRlIHNvdXJjZSBzcGFucyAqLyBudWxsISk7XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGF0dHJCaW5kaW5nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RFdmVudChqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIGV2ZW50OiBlLlBhcnNlZEV2ZW50KSB7XG4gIGNvbnN0IGV2ZW50QmluZGluZyA9IGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBldmVudC5uYW1lLCBudWxsLCBldmVudC50YXJnZXRPclBoYXNlLCB0cnVlLFxuICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gIC8vIFRPRE86IENhbiB0aGlzIGJlIGEgY2hhaW4/XG4gIGV2ZW50QmluZGluZy5oYW5kbGVyT3BzLnB1c2goaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KFxuICAgICAgY29udmVydEFzdChldmVudC5oYW5kbGVyLmFzdCwgam9iLCBldmVudC5zb3VyY2VTcGFuKSwgZXZlbnQuaGFuZGxlclNwYW4pKSk7XG4gIGpvYi5yb290LmNyZWF0ZS5wdXNoKGV2ZW50QmluZGluZyk7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQ29udGVudCkge1xuICAgICAgaW5nZXN0Q29udGVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGluZ2VzdFRleHQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LklmQmxvY2spIHtcbiAgICAgIGluZ2VzdElmQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Td2l0Y2hCbG9jaykge1xuICAgICAgaW5nZXN0U3dpdGNoQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5EZWZlcnJlZEJsb2NrKSB7XG4gICAgICBpbmdlc3REZWZlckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWN1KSB7XG4gICAgICBpbmdlc3RJY3UodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Gb3JMb29wQmxvY2spIHtcbiAgICAgIGluZ2VzdEZvckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBlbGVtZW50IEFTVCBmcm9tIHRoZSB0ZW1wbGF0ZSBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBlbGVtZW50OiB0LkVsZW1lbnQpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCBlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2VsZW1lbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgICAgZWxlbWVudE5hbWUsIGlkLCBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlS2V5KSxcbiAgICAgIGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyBlbGVtZW50LmkxOG4gOiB1bmRlZmluZWQsXG4gICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goc3RhcnRPcCk7XG5cbiAgaW5nZXN0QmluZGluZ3ModW5pdCwgc3RhcnRPcCwgZWxlbWVudCwgbnVsbCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG5cbiAgLy8gU3RhcnQgaTE4biwgaWYgbmVlZGVkLCBnb2VzIGFmdGVyIHRoZSBlbGVtZW50IGNyZWF0ZSBhbmQgYmluZGluZ3MsIGJ1dCBiZWZvcmUgdGhlIG5vZGVzXG4gIGxldCBpMThuQmxvY2tJZDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBpZiAoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgaTE4bkJsb2NrSWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSTE4blN0YXJ0T3AoaTE4bkJsb2NrSWQsIGVsZW1lbnQuaTE4bikpO1xuICB9XG5cbiAgaW5nZXN0Tm9kZXModW5pdCwgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgLy8gVGhlIHNvdXJjZSBzcGFuIGZvciB0aGUgZW5kIG9wIGlzIHR5cGljYWxseSB0aGUgZWxlbWVudCBjbG9zaW5nIHRhZy4gSG93ZXZlciwgaWYgbm8gY2xvc2luZyB0YWdcbiAgLy8gZXhpc3RzLCBzdWNoIGFzIGluIGA8aW5wdXQ+YCwgd2UgdXNlIHRoZSBzdGFydCBzb3VyY2Ugc3BhbiBpbnN0ZWFkLiBVc3VhbGx5IHRoZSBzdGFydCBhbmQgZW5kXG4gIC8vIGluc3RydWN0aW9ucyB3aWxsIGJlIGNvbGxhcHNlZCBpbnRvIG9uZSBgZWxlbWVudGAgaW5zdHJ1Y3Rpb24sIG5lZ2F0aW5nIHRoZSBwdXJwb3NlIG9mIHRoaXNcbiAgLy8gZmFsbGJhY2ssIGJ1dCBpbiBjYXNlcyB3aGVuIGl0IGlzIG5vdCBjb2xsYXBzZWQgKHN1Y2ggYXMgYW4gaW5wdXQgd2l0aCBhIGJpbmRpbmcpLCB3ZSBzdGlsbFxuICAvLyB3YW50IHRvIG1hcCB0aGUgZW5kIGluc3RydWN0aW9uIHRvIHRoZSBtYWluIGVsZW1lbnQuXG4gIGNvbnN0IGVuZE9wID0gaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKGVuZE9wKTtcblxuICAvLyBJZiB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudCwgaW5zZXJ0IGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gIGlmIChpMThuQmxvY2tJZCAhPT0gbnVsbCkge1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUkxOG5FbmRPcChpMThuQmxvY2tJZCksIGVuZE9wKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgbmctdGVtcGxhdGVgIG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZW1wbGF0ZSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0bXBsOiB0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGlmICh0bXBsLmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgISh0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgfHwgdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGVtcGxhdGU6ICR7dG1wbC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICBsZXQgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPSB0bXBsLnRhZ05hbWU7XG4gIGxldCBuYW1lc3BhY2VQcmVmaXg6IHN0cmluZ3xudWxsID0gJyc7XG4gIGlmICh0bXBsLnRhZ05hbWUpIHtcbiAgICBbbmFtZXNwYWNlUHJlZml4LCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZV0gPSBzcGxpdE5zTmFtZSh0bXBsLnRhZ05hbWUpO1xuICB9XG5cbiAgY29uc3QgaTE4blBsYWNlaG9sZGVyID0gdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IHRtcGwuaTE4biA6IHVuZGVmaW5lZDtcbiAgY29uc3QgbmFtZXNwYWNlID0gbmFtZXNwYWNlRm9yS2V5KG5hbWVzcGFjZVByZWZpeCk7XG4gIGNvbnN0IGZ1bmN0aW9uTmFtZVN1ZmZpeCA9IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID09PSBudWxsID9cbiAgICAgICcnIDpcbiAgICAgIHByZWZpeFdpdGhOYW1lc3BhY2UodGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIG5hbWVzcGFjZSk7XG4gIGNvbnN0IHRlbXBsYXRlS2luZCA9XG4gICAgICBpc1BsYWluVGVtcGxhdGUodG1wbCkgPyBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSA6IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsO1xuICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgIGNoaWxkVmlldy54cmVmLCB0ZW1wbGF0ZUtpbmQsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBmdW5jdGlvbk5hbWVTdWZmaXgsIG5hbWVzcGFjZSxcbiAgICAgIGkxOG5QbGFjZWhvbGRlciwgdG1wbC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRlbXBsYXRlT3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHVuaXQsIHRlbXBsYXRlT3AsIHRtcGwsIHRlbXBsYXRlS2luZCk7XG4gIGluZ2VzdFJlZmVyZW5jZXModGVtcGxhdGVPcCwgdG1wbCk7XG4gIGluZ2VzdE5vZGVzKGNoaWxkVmlldywgdG1wbC5jaGlsZHJlbik7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIHRtcGwudmFyaWFibGVzKSB7XG4gICAgY2hpbGRWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KG5hbWUsIHZhbHVlICE9PSAnJyA/IHZhbHVlIDogJyRpbXBsaWNpdCcpO1xuICB9XG5cbiAgLy8gSWYgdGhpcyBpcyBhIHBsYWluIHRlbXBsYXRlIGFuZCB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIGl0LCBpbnNlcnQgaTE4biBzdGFydFxuICAvLyBhbmQgZW5kIG9wcy4gRm9yIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlcywgdGhlIGkxOG4gb3BzIHdpbGwgYmUgYWRkZWQgd2hlbiBpbmdlc3RpbmcgdGhlXG4gIC8vIGVsZW1lbnQvdGVtcGxhdGUgdGhlIGRpcmVjdGl2ZSBpcyBwbGFjZWQgb24uXG4gIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5OZ1RlbXBsYXRlICYmIHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biksIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBpZiAoY29udGVudC5pMThuICE9PSB1bmRlZmluZWQgJiYgIShjb250ZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2NvbnRlbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGNvbnN0IGF0dHJzID0gY29udGVudC5hdHRyaWJ1dGVzLmZsYXRNYXAoYSA9PiBbYS5uYW1lLCBhLnZhbHVlXSk7XG4gIGNvbnN0IG9wID0gaXIuY3JlYXRlUHJvamVjdGlvbk9wKFxuICAgICAgdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgY29udGVudC5zZWxlY3RvciwgY29udGVudC5pMThuLCBhdHRycywgY29udGVudC5zb3VyY2VTcGFuKTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGNvbnRlbnQuYXR0cmlidXRlcykge1xuICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSwgbnVsbCwgYXR0ci5pMThuKTtcbiAgfVxuICB1bml0LmNyZWF0ZS5wdXNoKG9wKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5UZXh0KTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpMThuUGxhY2Vob2xkZXJzPzogc3RyaW5nW10pOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGlmIChpMThuUGxhY2Vob2xkZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBUT0RPOiBXZSBwcm9iYWJseSBjYW4ganVzdCB1c2UgdGhlIHBsYWNlaG9sZGVycyBmaWVsZCwgaW5zdGVhZCBvZiB3YWxraW5nIHRoZSBBU1QuXG4gICAgaTE4blBsYWNlaG9sZGVycyA9IHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyID9cbiAgICAgICAgdGV4dC5pMThuLmNoaWxkcmVuXG4gICAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgICAgLm1hcChwbGFjZWhvbGRlciA9PiBwbGFjZWhvbGRlci5uYW1lKSA6XG4gICAgICAgIFtdO1xuICB9XG4gIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCA+IDAgJiYgaTE4blBsYWNlaG9sZGVycy5sZW5ndGggIT09IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIG51bWJlciBvZiBpMThuIHBsYWNlaG9sZGVycyAoJHtcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2ApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIHRleHQuc291cmNlU3BhbikpO1xuICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90IGdlbmVyYXRlIHNvdXJjZSBtYXBzIGZvciBzdWItZXhwcmVzc2lvbnMgaW5zaWRlIGFuXG4gIC8vIGludGVycG9sYXRpb24uIFdlIGNvcHkgdGhhdCBiZWhhdmlvciBpbiBjb21wYXRpYmlsaXR5IG1vZGUuXG4gIC8vIFRPRE86IGlzIGl0IGFjdHVhbGx5IGNvcnJlY3QgdG8gZ2VuZXJhdGUgdGhlc2UgZXh0cmEgbWFwcyBpbiBtb2Rlcm4gbW9kZT9cbiAgY29uc3QgYmFzZVNvdXJjZVNwYW4gPSB1bml0LmpvYi5jb21wYXRpYmlsaXR5ID8gbnVsbCA6IHRleHQuc291cmNlU3BhbjtcbiAgdW5pdC51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVRleHRPcChcbiAgICAgIHRleHRYcmVmLFxuICAgICAgbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICAgICAgICBpMThuUGxhY2Vob2xkZXJzKSxcbiAgICAgIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGlmYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0SWZCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpZkJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZkJsb2NrLmJyYW5jaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaWZDYXNlID0gaWZCbG9jay5icmFuY2hlc1tpXTtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHRoZSBmaXJzdCBicmFuY2ggY2FuIGJlIHVzZWQgZm9yIHByb2plY3Rpb24sIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgLy8gdXNlcyB0aGUgY29udGFpbmVyIG9mIHRoZSBmaXJzdCBicmFuY2ggYXMgdGhlIGluc2VydGlvbiBwb2ludCBmb3IgYWxsIGJyYW5jaGVzLlxuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCBjVmlldy54cmVmLCBpZkNhc2UpO1xuICAgIH1cbiAgICBpZiAoaWZDYXNlLmV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgY1ZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoaWZDYXNlLmV4cHJlc3Npb25BbGlhcy5uYW1lLCBpci5DVFhfUkVGKTtcbiAgICB9XG5cbiAgICBsZXQgaWZDYXNlSTE4bk1ldGEgPSB1bmRlZmluZWQ7XG4gICAgaWYgKGlmQ2FzZS5pMThuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghKGlmQ2FzZS5pMThuIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgaWYgYmxvY2s6ICR7aWZDYXNlLmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgICB9XG4gICAgICBpZkNhc2VJMThuTWV0YSA9IGlmQ2FzZS5pMThuO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgICBjVmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIHRhZ05hbWUsICdDb25kaXRpb25hbCcsIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgICBpZkNhc2VJMThuTWV0YSwgaWZDYXNlLnNvdXJjZVNwYW4pO1xuICAgIHVuaXQuY3JlYXRlLnB1c2godGVtcGxhdGVPcCk7XG5cbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgICAgZmlyc3RTbG90SGFuZGxlID0gdGVtcGxhdGVPcC5oYW5kbGU7XG4gICAgfVxuXG4gICAgY29uc3QgY2FzZUV4cHIgPSBpZkNhc2UuZXhwcmVzc2lvbiA/IGNvbnZlcnRBc3QoaWZDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSA6IG51bGw7XG4gICAgY29uc3QgY29uZGl0aW9uYWxDYXNlRXhwciA9IG5ldyBpci5Db25kaXRpb25hbENhc2VFeHByKFxuICAgICAgICBjYXNlRXhwciwgdGVtcGxhdGVPcC54cmVmLCB0ZW1wbGF0ZU9wLmhhbmRsZSwgaWZDYXNlLmV4cHJlc3Npb25BbGlhcyk7XG4gICAgY29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbmFsQ2FzZUV4cHIpO1xuICAgIGluZ2VzdE5vZGVzKGNWaWV3LCBpZkNhc2UuY2hpbGRyZW4pO1xuICB9XG4gIGNvbnN0IGNvbmRpdGlvbmFsID1cbiAgICAgIGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgbnVsbCwgY29uZGl0aW9ucywgaWZCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAc3dpdGNoYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0U3dpdGNoQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3dpdGNoQmxvY2s6IHQuU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChjb25zdCBzd2l0Y2hDYXNlIG9mIHN3aXRjaEJsb2NrLmNhc2VzKSB7XG4gICAgY29uc3QgY1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBsZXQgc3dpdGNoQ2FzZUkxOG5NZXRhID0gdW5kZWZpbmVkO1xuICAgIGlmIChzd2l0Y2hDYXNlLmkxOG4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKCEoc3dpdGNoQ2FzZS5pMThuIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgIGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBzd2l0Y2ggYmxvY2s6ICR7c3dpdGNoQ2FzZS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgICAgfVxuICAgICAgc3dpdGNoQ2FzZUkxOG5NZXRhID0gc3dpdGNoQ2FzZS5pMThuO1xuICAgIH1cbiAgICBjb25zdCB0ZW1wbGF0ZU9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLCBudWxsLCAnQ2FzZScsIGlyLk5hbWVzcGFjZS5IVE1MLCBzd2l0Y2hDYXNlSTE4bk1ldGEsXG4gICAgICAgIHN3aXRjaENhc2Uuc291cmNlU3Bhbik7XG4gICAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgICAgZmlyc3RTbG90SGFuZGxlID0gdGVtcGxhdGVPcC5oYW5kbGU7XG4gICAgfVxuICAgIGNvbnN0IGNhc2VFeHByID0gc3dpdGNoQ2FzZS5leHByZXNzaW9uID9cbiAgICAgICAgY29udmVydEFzdChzd2l0Y2hDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBzd2l0Y2hCbG9jay5zdGFydFNvdXJjZVNwYW4pIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID1cbiAgICAgICAgbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoY2FzZUV4cHIsIHRlbXBsYXRlT3AueHJlZiwgdGVtcGxhdGVPcC5oYW5kbGUpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgc3dpdGNoQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKFxuICAgICAgZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCksIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWZmaXg6IHN0cmluZywgaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGF8dW5kZWZpbmVkLFxuICAgIGNoaWxkcmVuPzogdC5Ob2RlW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBpci5UZW1wbGF0ZU9wfG51bGwge1xuICBpZiAoaTE4bk1ldGEgIT09IHVuZGVmaW5lZCAmJiAhKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBkZWZlciBibG9jaycpO1xuICB9XG4gIGlmIChjaGlsZHJlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc2Vjb25kYXJ5VmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICBpbmdlc3ROb2RlcyhzZWNvbmRhcnlWaWV3LCBjaGlsZHJlbik7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgc2Vjb25kYXJ5Vmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIG51bGwsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgaTE4bk1ldGEsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IGJsb2NrTWV0YSA9IHVuaXQuam9iLmRlZmVyQmxvY2tzTWV0YS5nZXQoZGVmZXJCbG9jayk7XG4gIGlmIChibG9ja01ldGEgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVuYWJsZSB0byBmaW5kIG1ldGFkYXRhIGZvciBkZWZlcnJlZCBibG9ja2ApO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIGRlZmVyIG1haW4gdmlldyBhbmQgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgbWFpbiA9XG4gICAgICBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suaTE4biwgZGVmZXJCbG9jay5jaGlsZHJlbiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKSE7XG4gIGNvbnN0IGxvYWRpbmcgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnTG9hZGluZycsIGRlZmVyQmxvY2subG9hZGluZz8uaTE4biwgZGVmZXJCbG9jay5sb2FkaW5nPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2subG9hZGluZz8uc291cmNlU3Bhbik7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ1BsYWNlaG9sZGVyJywgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uaTE4biwgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnRXJyb3InLCBkZWZlckJsb2NrLmVycm9yPy5pMThuLCBkZWZlckJsb2NrLmVycm9yPy5jaGlsZHJlbixcbiAgICAgIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4pO1xuXG4gIC8vIENyZWF0ZSB0aGUgbWFpbiBkZWZlciBvcCwgYW5kIG9wcyBmb3IgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgZGVmZXJYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgY29uc3QgZGVmZXJPcCA9XG4gICAgICBpci5jcmVhdGVEZWZlck9wKGRlZmVyWHJlZiwgbWFpbi54cmVmLCBtYWluLmhhbmRsZSwgYmxvY2tNZXRhLCBkZWZlckJsb2NrLnNvdXJjZVNwYW4pO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyVmlldyA9IHBsYWNlaG9sZGVyPy54cmVmID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJTbG90ID0gcGxhY2Vob2xkZXI/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdTbG90ID0gbG9hZGluZz8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AuZXJyb3JTbG90ID0gZXJyb3I/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nQWZ0ZXJUaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5hZnRlclRpbWUgPz8gbnVsbDtcbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wKTtcblxuICAvLyBDb25maWd1cmUgYWxsIGRlZmVyIGBvbmAgY29uZGl0aW9ucy5cbiAgLy8gVE9ETzogcmVmYWN0b3IgcHJlZmV0Y2ggdHJpZ2dlcnMgdG8gdXNlIGEgc2VwYXJhdGUgb3AgdHlwZSwgd2l0aCBhIHNoYXJlZCBzdXBlcmNsYXNzLiBUaGlzIHdpbGxcbiAgLy8gbWFrZSBpdCBlYXNpZXIgdG8gcmVmYWN0b3IgcHJlZmV0Y2ggYmVoYXZpb3IgaW4gdGhlIGZ1dHVyZS5cbiAgbGV0IHByZWZldGNoID0gZmFsc2U7XG4gIGxldCBkZWZlck9uT3BzOiBpci5EZWZlck9uT3BbXSA9IFtdO1xuICBsZXQgZGVmZXJXaGVuT3BzOiBpci5EZWZlcldoZW5PcFtdID0gW107XG4gIGZvciAoY29uc3QgdHJpZ2dlcnMgb2YgW2RlZmVyQmxvY2sudHJpZ2dlcnMsIGRlZmVyQmxvY2sucHJlZmV0Y2hUcmlnZ2Vyc10pIHtcbiAgICBpZiAodHJpZ2dlcnMuaWRsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSwgcHJlZmV0Y2gsIHRyaWdnZXJzLmlkbGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGV9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy5pbW1lZGlhdGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnRpbWVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy50aW1lci5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaG92ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmhvdmVyLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMuaG92ZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmludGVyYWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmludGVyYWN0aW9uLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy52aWV3cG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMudmlld3BvcnQucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy52aWV3cG9ydC5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMud2hlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlcldoZW5PcChcbiAgICAgICAgICBkZWZlclhyZWYsIGNvbnZlcnRBc3QodHJpZ2dlcnMud2hlbi52YWx1ZSwgdW5pdC5qb2IsIHRyaWdnZXJzLndoZW4uc291cmNlU3BhbiksIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLndoZW4uc291cmNlU3Bhbik7XG4gICAgICBkZWZlcldoZW5PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cblxuICAgIC8vIElmIG5vIChub24tcHJlZmV0Y2hpbmcpIGRlZmVyIHRyaWdnZXJzIHdlcmUgcHJvdmlkZWQsIGRlZmF1bHQgdG8gYGlkbGVgLlxuICAgIGlmIChkZWZlck9uT3BzLmxlbmd0aCA9PT0gMCAmJiBkZWZlcldoZW5PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIGZhbHNlLCBudWxsISkpO1xuICAgIH1cbiAgICBwcmVmZXRjaCA9IHRydWU7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT25PcHMpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGRlZmVyV2hlbk9wcyk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdEljdSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpY3U6IHQuSWN1KSB7XG4gIGlmIChpY3UuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBpc1NpbmdsZUkxOG5JY3UoaWN1LmkxOG4pKSB7XG4gICAgY29uc3QgeHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgY29uc3QgaWN1Tm9kZSA9IGljdS5pMThuLm5vZGVzWzBdO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1U3RhcnRPcCh4cmVmLCBpY3UuaTE4biwgaWN1RnJvbUkxOG5NZXNzYWdlKGljdS5pMThuKS5uYW1lLCBudWxsISkpO1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCB0ZXh0XSBvZiBPYmplY3QuZW50cmllcyh7Li4uaWN1LnZhcnMsIC4uLmljdS5wbGFjZWhvbGRlcnN9KSkge1xuICAgICAgaWYgKHRleHQgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgdGV4dCwgW3BsYWNlaG9sZGVyXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RUZXh0KHVuaXQsIHRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdUVuZE9wKHhyZWYpKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgSUNVOiAke2ljdS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAZm9yYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Rm9yQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZm9yQmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGNvbnN0IGNyZWF0ZVJlcGVhdGVyQWxpYXMgPSAoaWRlbnQ6IHN0cmluZywgcmVwZWF0ZXJWYXI6IGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5KSA9PiB7XG4gICAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGlkZW50aWZpZXI6IGlkZW50LFxuICAgICAgZXhwcmVzc2lvbjogbmV3IGlyLkRlcml2ZWRSZXBlYXRlclZhckV4cHIocmVwZWF0ZXJWaWV3LnhyZWYsIHJlcGVhdGVyVmFyKSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoXG4gICAgICBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRmlyc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuTGFzdCk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eS5FdmVuKTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuT2RkKTtcblxuICBjb25zdCBzb3VyY2VTcGFuID0gY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2sudHJhY2tCeS5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgY29uc3QgdHJhY2sgPSBjb252ZXJ0QXN0KGZvckJsb2NrLnRyYWNrQnksIHVuaXQuam9iLCBzb3VyY2VTcGFuKTtcblxuICBpbmdlc3ROb2RlcyhyZXBlYXRlclZpZXcsIGZvckJsb2NrLmNoaWxkcmVuKTtcblxuICBsZXQgZW1wdHlWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0fG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgfVxuXG4gIGNvbnN0IHZhck5hbWVzOiBpci5SZXBlYXRlclZhck5hbWVzID0ge1xuICAgICRpbmRleDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSxcbiAgICAkY291bnQ6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWUsXG4gICAgJGZpcnN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRmaXJzdC5uYW1lLFxuICAgICRsYXN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsXG4gICAgJGV2ZW46IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSxcbiAgICAkb2RkOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSxcbiAgICAkaW1wbGljaXQ6IGZvckJsb2NrLml0ZW0ubmFtZSxcbiAgfTtcblxuICBpZiAoZm9yQmxvY2suaTE4biAhPT0gdW5kZWZpbmVkICYmICEoZm9yQmxvY2suaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgb3IgQGZvcicpO1xuICB9XG4gIGlmIChmb3JCbG9jay5lbXB0eT8uaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGZvckJsb2NrLmVtcHR5LmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBlbXB0eScpO1xuICB9XG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IGZvckJsb2NrLmkxOG47XG4gIGNvbnN0IGVtcHR5STE4blBsYWNlaG9sZGVyID0gZm9yQmxvY2suZW1wdHk/LmkxOG47XG5cbiAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgcmVwZWF0ZXJWaWV3LnhyZWYsIGZvckJsb2NrKTtcbiAgY29uc3QgcmVwZWF0ZXJDcmVhdGUgPSBpci5jcmVhdGVSZXBlYXRlckNyZWF0ZU9wKFxuICAgICAgcmVwZWF0ZXJWaWV3LnhyZWYsIGVtcHR5Vmlldz8ueHJlZiA/PyBudWxsLCB0YWdOYW1lLCB0cmFjaywgdmFyTmFtZXMsIGkxOG5QbGFjZWhvbGRlcixcbiAgICAgIGVtcHR5STE4blBsYWNlaG9sZGVyLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChyZXBlYXRlckNyZWF0ZSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoXG4gICAgICBmb3JCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYixcbiAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLmV4cHJlc3Npb24uc3BhbiwgZm9yQmxvY2suc291cmNlU3BhbikpO1xuICBjb25zdCByZXBlYXRlciA9IGlyLmNyZWF0ZVJlcGVhdGVyT3AoXG4gICAgICByZXBlYXRlckNyZWF0ZS54cmVmLCByZXBlYXRlckNyZWF0ZS5oYW5kbGUsIGV4cHJlc3Npb24sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKHJlcGVhdGVyKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGVtcGxhdGUgQVNUIGV4cHJlc3Npb24gaW50byBhbiBvdXRwdXQgQVNUIGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRBc3QoXG4gICAgYXN0OiBlLkFTVCwgam9iOiBDb21waWxhdGlvbkpvYiwgYmFzZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5hc3QsIGpvYiwgYmFzZVNvdXJjZVNwYW4pO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlSZWFkKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlciAmJiAhKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKSkge1xuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoYXN0Lm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsIG51bGwsXG4gICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlXcml0ZSkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgICAgIC8vIFRPRE86IElzIGl0IGNvcnJlY3QgdG8gYWx3YXlzIHVzZSB0aGUgcm9vdCBjb250ZXh0IGluIHBsYWNlIG9mIHRoZSBpbXBsaWNpdCByZWNlaXZlcj9cbiAgICAgICAgICBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZiksIGFzdC5uYW1lLCBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgbnVsbCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DYWxsKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIEltcGxpY2l0UmVjZWl2ZXJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLCB1bmRlZmluZWQsXG4gICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgIHJldHVybiBvLmxpdGVyYWwoYXN0LnZhbHVlLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuVW5hcnkpIHtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIHJldHVybiBuZXcgby5VbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG8uVW5hcnlPcGVyYXRvci5QbHVzLCBjb252ZXJ0QXN0KGFzdC5leHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgby5VbmFyeU9wZXJhdG9yLk1pbnVzLCBjb252ZXJ0QXN0KGFzdC5leHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIHVuYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgb3BlcmF0b3IsIGNvbnZlcnRBc3QoYXN0LmxlZnQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yaWdodCwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgY29udGV4dCBleHByZXNzaW9ucyBoYXZlIHNvdXJjZSBtYXBzP1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQ2hhaW4gaW4gdW5rbm93biBjb250ZXh0YCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsTWFwKSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5rZXlzLm1hcCgoa2V5LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlc1tpZHhdO1xuICAgICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZ1xuICAgICAgLy8gZXhwcmVzc2lvbj9cbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LmtleSwgY29udmVydEFzdCh2YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIGtleS5xdW90ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRXhwcihlbnRyaWVzLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbEFycmF5KSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZyBleHByZXNzaW9uP1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFxuICAgICAgICBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5jb25kaXRpb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC50cnVlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIC8vIFRPRE86IHBpcGVzIHNob3VsZCBwcm9iYWJseSBoYXZlIHNvdXJjZSBtYXBzOyBmaWd1cmUgb3V0IGRldGFpbHMuXG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoXG4gICAgICAgIGpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBuZXcgaXIuU2xvdEhhbmRsZSgpLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgW1xuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgLi4uYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICBdLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZVByb3BlcnR5UmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlQ2FsbCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGFzdC5hcmdzLm1hcChhID0+IGNvbnZlcnRBc3QoYSwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJlZml4Tm90KSB7XG4gICAgcmV0dXJuIG8ubm90KFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgZXhwcmVzc2lvbiB0eXBlIFwiJHthc3QuY29uc3RydWN0b3IubmFtZX1cIiBpbiBmaWxlIFwiJHtcbiAgICAgICAgYmFzZVNvdXJjZVNwYW4/LnN0YXJ0LmZpbGUudXJsfVwiYCk7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gdGVtcGxhdGUgaXMgYSBwbGFpbiBuZy10ZW1wbGF0ZSAoYXMgb3Bwb3NlZCB0byBhbm90aGVyIGtpbmQgb2YgdGVtcGxhdGVcbiAqIHN1Y2ggYXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZSBvciBjb250cm9sIGZsb3cgdGVtcGxhdGUpLiBUaGlzIGlzIGNoZWNrZWQgYmFzZWQgb24gdGhlXG4gKiB0YWdOYW1lLiBXZSBjYW4gZXhwZWN0IHRoYXQgb25seSBwbGFpbiBuZy10ZW1wbGF0ZXMgd2lsbCBjb21lIHRocm91Z2ggd2l0aCBhIHRhZ05hbWUgb2ZcbiAqICduZy10ZW1wbGF0ZScuXG4gKlxuICogSGVyZSBhcmUgc29tZSBvZiB0aGUgY2FzZXMgd2UgZXhwZWN0OlxuICpcbiAqIHwgQW5ndWxhciBIVE1MICAgICAgICAgICAgICAgICAgICAgICB8IFRlbXBsYXRlIHRhZ05hbWUgICB8XG4gKiB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCBgPG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxkaXYgKm5nSWY9XCJ0cnVlXCI+YCAgICAgICAgICAgICAgIHwgJ2RpdicgICAgICAgICAgICAgIHxcbiAqIHwgYDxzdmc+PG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICB8ICdzdmc6bmctdGVtcGxhdGUnICB8XG4gKiB8IGBAaWYgKHRydWUpIHtgICAgICAgICAgICAgICAgICAgICAgfCAnQ29uZGl0aW9uYWwnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHBsYWluKSAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChzdHJ1Y3R1cmFsKSB8IG51bGwgICAgICAgICAgICAgICB8XG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5UZW1wbGF0ZSh0bXBsOiB0LlRlbXBsYXRlKSB7XG4gIHJldHVybiBzcGxpdE5zTmFtZSh0bXBsLnRhZ05hbWUgPz8gJycpWzFdID09PSAnbmctdGVtcGxhdGUnO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50LWxpa2Ugc3RydWN0dXJlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbVxuICogdG8gdGhlaXIgSVIgcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEJpbmRpbmdzKFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSxcbiAgICB0ZW1wbGF0ZUtpbmQ6IGlyLlRlbXBsYXRlS2luZHxudWxsKTogdm9pZCB7XG4gIGxldCBmbGFnczogQmluZGluZ0ZsYWdzID0gQmluZGluZ0ZsYWdzLk5vbmU7XG4gIGxldCBoYXNJMThuQXR0cmlidXRlcyA9IGZhbHNlO1xuXG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50O1xuICAgIGlmIChpc1BsYWluVGVtcGxhdGUoZWxlbWVudCkpIHtcbiAgICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5CaW5kaW5nVGFyZ2V0c1RlbXBsYXRlO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlQXR0ckZsYWdzID1cbiAgICAgICAgZmxhZ3MgfCBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSB8IEJpbmRpbmdGbGFncy5Jc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgdGVtcGxhdGVBdHRyRmxhZ3MgfCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlLFxuICAgICAgICAgICAgdGVtcGxhdGVLaW5kLCBhdHRyLmkxOG4pO1xuICAgICAgICBoYXNJMThuQXR0cmlidXRlcyB8fD0gYXR0ci5pMThuICE9PSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBhdHRyLnR5cGUsIGF0dHIudW5pdCwgYXR0ci5zZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4sIHRlbXBsYXRlQXR0ckZsYWdzLCB0ZW1wbGF0ZUtpbmQsIGF0dHIuaTE4bik7XG4gICAgICAgIGhhc0kxOG5BdHRyaWJ1dGVzIHx8PSBhdHRyLmkxOG4gIT09IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gVGhpcyBpcyBvbmx5IGF0dHJpYnV0ZSBUZXh0TGl0ZXJhbCBiaW5kaW5ncywgc3VjaCBhcyBgYXR0ci5mb289XCJiYXJcImAuIFRoaXMgY2FuIG5ldmVyIGJlXG4gICAgLy8gYFthdHRyLmZvb109XCJiYXJcImAgb3IgYGF0dHIuZm9vPVwie3tiYXJ9fVwiYCwgYm90aCBvZiB3aGljaCB3aWxsIGJlIGhhbmRsZWQgYXMgaW5wdXRzIHdpdGhcbiAgICAvLyBgQmluZGluZ1R5cGUuQXR0cmlidXRlYC5cbiAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIG51bGwsXG4gICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIGZsYWdzIHwgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSwgdGVtcGxhdGVLaW5kLFxuICAgICAgICBhdHRyLmkxOG4pO1xuICAgIGhhc0kxOG5BdHRyaWJ1dGVzIHx8PSBhdHRyLmkxOG4gIT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgZWxlbWVudC5pbnB1dHMpIHtcbiAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBpbnB1dC5uYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQudHlwZSwgaW5wdXQudW5pdCwgaW5wdXQuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICBpbnB1dC5zb3VyY2VTcGFuLCBmbGFncywgdGVtcGxhdGVLaW5kLCBpbnB1dC5pMThuKTtcbiAgICBoYXNJMThuQXR0cmlidXRlcyB8fD0gaW5wdXQuaTE4biAhPT0gdW5kZWZpbmVkO1xuICB9XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgZWxlbWVudC5vdXRwdXRzKSB7XG4gICAgbGV0IGxpc3RlbmVyT3A6IGlyLkxpc3RlbmVyT3A7XG4gICAgaWYgKG91dHB1dC50eXBlID09PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIGlmIChvdXRwdXQucGhhc2UgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmICFpc1BsYWluVGVtcGxhdGUoZWxlbWVudCkpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgb3AueHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG91dHB1dC5uYW1lLCBudWxsLCBudWxsLCBudWxsKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lck9wID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgICAgb3AueHJlZiwgb3AuaGFuZGxlLCBvdXRwdXQubmFtZSwgb3AudGFnLCBvdXRwdXQucGhhc2UsIGZhbHNlLCBvdXRwdXQuc291cmNlU3Bhbik7XG5cbiAgICAvLyBpZiBvdXRwdXQuaGFuZGxlciBpcyBhIGNoYWluLCB0aGVuIHB1c2ggZWFjaCBzdGF0ZW1lbnQgZnJvbSB0aGUgY2hhaW4gc2VwYXJhdGVseSwgYW5kXG4gICAgLy8gcmV0dXJuIHRoZSBsYXN0IG9uZT9cbiAgICBsZXQgaGFuZGxlckV4cHJzOiBlLkFTVFtdO1xuICAgIGxldCBoYW5kbGVyOiBlLkFTVCA9IG91dHB1dC5oYW5kbGVyO1xuICAgIGlmIChoYW5kbGVyIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgICBoYW5kbGVyID0gaGFuZGxlci5hc3Q7XG4gICAgfVxuXG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgICBoYW5kbGVyRXhwcnMgPSBoYW5kbGVyLmV4cHJlc3Npb25zO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVyRXhwcnMgPSBbaGFuZGxlcl07XG4gICAgfVxuXG4gICAgaWYgKGhhbmRsZXJFeHBycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gaGF2ZSBub24tZW1wdHkgZXhwcmVzc2lvbiBsaXN0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gaGFuZGxlckV4cHJzLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIG91dHB1dC5oYW5kbGVyU3BhbikpO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG5cbiAgICBmb3IgKGNvbnN0IGV4cHIgb2YgZXhwcmVzc2lvbnMpIHtcbiAgICAgIGNvbnN0IHN0bXRPcCA9XG4gICAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwciwgZXhwci5zb3VyY2VTcGFuKSk7XG4gICAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChzdG10T3ApO1xuICAgIH1cbiAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChcbiAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KHJldHVybkV4cHIsIHJldHVybkV4cHIuc291cmNlU3BhbikpKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKGxpc3RlbmVyT3ApO1xuICB9XG5cbiAgLy8gVE9ETzogUGVyaGFwcyB3ZSBjb3VsZCBkbyB0aGlzIGluIGEgcGhhc2U/IChJdCBsaWtlbHkgd291bGRuJ3QgY2hhbmdlIHRoZSBzbG90IGluZGljZXMuKVxuICBpZiAoaGFzSTE4bkF0dHJpYnV0ZXMpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVJMThuQXR0cmlidXRlc09wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIG9wLnhyZWYpKTtcbiAgfVxufVxuXG5jb25zdCBCSU5ESU5HX0tJTkRTID0gbmV3IE1hcDxlLkJpbmRpbmdUeXBlLCBpci5CaW5kaW5nS2luZD4oW1xuICBbZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eSwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZV0sXG4gIFtlLkJpbmRpbmdUeXBlLkNsYXNzLCBpci5CaW5kaW5nS2luZC5DbGFzc05hbWVdLFxuICBbZS5CaW5kaW5nVHlwZS5TdHlsZSwgaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uXSxcbl0pO1xuXG5lbnVtIEJpbmRpbmdGbGFncyB7XG4gIE5vbmUgPSAwYjAwMCxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgaXMgdG8gYSBzdGF0aWMgdGV4dCBsaXRlcmFsIGFuZCBub3QgdG8gYW4gZXhwcmVzc2lvbi5cbiAgICovXG4gIFRleHRWYWx1ZSA9IDBiMDAwMSxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgYmVsb25ncyB0byB0aGUgYDxuZy10ZW1wbGF0ZT5gIHNpZGUgb2YgYSBgdC5UZW1wbGF0ZWAuXG4gICAqL1xuICBCaW5kaW5nVGFyZ2V0c1RlbXBsYXRlID0gMGIwMDEwLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBpcyBvbiBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlLlxuICAgKi9cbiAgSXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUgPSAwYjAxMDAsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGlzIG9uIGEgYHQuVGVtcGxhdGVgLlxuICAgKi9cbiAgT25OZ1RlbXBsYXRlRWxlbWVudCA9IDBiMTAwMCxcbn1cblxuZnVuY3Rpb24gaW5nZXN0QmluZGluZyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB4cmVmOiBpci5YcmVmSWQsIG5hbWU6IHN0cmluZywgdmFsdWU6IGUuQVNUfG8uRXhwcmVzc2lvbixcbiAgICB0eXBlOiBlLkJpbmRpbmdUeXBlLCB1bml0OiBzdHJpbmd8bnVsbCwgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHQsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBmbGFnczogQmluZGluZ0ZsYWdzLCB0ZW1wbGF0ZUtpbmQ6IGlyLlRlbXBsYXRlS2luZHxudWxsLFxuICAgIGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfHVuZGVmaW5lZCk6IHZvaWQge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmFzdDtcbiAgfVxuXG4gIGlmIChpMThuTWV0YSAhPT0gdW5kZWZpbmVkICYmICEoaTE4bk1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGJpbmRpbmc6ICR7aTE4bk1ldGEuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGlmIChmbGFncyAmIEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50ICYmICEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSkgJiZcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAvLyBUaGlzIGJpbmRpbmcgb25seSBleGlzdHMgZm9yIGxhdGVyIGNvbnN0IGV4dHJhY3Rpb24sIGFuZCBpcyBub3QgYW4gYWN0dWFsIGJpbmRpbmcgdG8gYmVcbiAgICAvLyBjcmVhdGVkLlxuICAgIHZpZXcuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBuYW1lLCBudWxsLCBudWxsLCBpMThuTWV0YSA/PyBudWxsKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICAvLyBUT0RPOiBXZSBjb3VsZCBlYXNpbHkgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1YmV4cHJlc3Npb25zIGluIHRoZXNlIGNhc2VzLCBidXRcbiAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdC4gU2hvdWxkIHdlIGRvIHNvP1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBsZXQgaTE4blBsYWNlaG9sZGVyczogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoaTE4bk1ldGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaTE4blBsYWNlaG9sZGVycyA9IE9iamVjdC5rZXlzKGkxOG5NZXRhLnBsYWNlaG9sZGVycyk7XG4gICAgfVxuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LmpvYiwgbnVsbCkpLFxuICAgICAgICBpMThuUGxhY2Vob2xkZXJzKTtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUKSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QodmFsdWUsIHZpZXcuam9iLCBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gdmFsdWU7XG4gIH1cblxuICBpZiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUgJiYgIShmbGFncyAmIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpICYmXG4gICAgICB0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsKSB7XG4gICAgLy8gVE9ETzogYmlnIGNvbW1lbnQgYWJvdXQgd2h5IHRoaXMgaXMgc3R1cGlkLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGtpbmQ6IGlyLkJpbmRpbmdLaW5kID0gQklORElOR19LSU5EUy5nZXQodHlwZSkhO1xuICB2aWV3LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIHhyZWYsIGtpbmQsIG5hbWUsIGV4cHJlc3Npb24sIHVuaXQsIHNlY3VyaXR5Q29udGV4dCwgISEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKSxcbiAgICAgICEhKGZsYWdzICYgQmluZGluZ0ZsYWdzLklzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlKSwgdGVtcGxhdGVLaW5kLCBpMThuTWV0YSA/PyBudWxsLFxuICAgICAgc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBsb2NhbCByZWZlcmVuY2VzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmRcbiAqIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0UmVmZXJlbmNlcyhvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgYXNzZXJ0SXNBcnJheTxpci5Mb2NhbFJlZj4ob3AubG9jYWxSZWZzKTtcbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIGVsZW1lbnQucmVmZXJlbmNlcykge1xuICAgIG9wLmxvY2FsUmVmcy5wdXNoKHtcbiAgICAgIG5hbWUsXG4gICAgICB0YXJnZXQ6IHZhbHVlLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgdGhlIGdpdmVuIHZhbHVlIGlzIGFuIGFycmF5LlxuICovXG5mdW5jdGlvbiBhc3NlcnRJc0FycmF5PFQ+KHZhbHVlOiBhbnkpOiBhc3NlcnRzIHZhbHVlIGlzIEFycmF5PFQ+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGFuIGFycmF5YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFic29sdXRlIGBQYXJzZVNvdXJjZVNwYW5gIGZyb20gdGhlIHJlbGF0aXZlIGBQYXJzZVNwYW5gLlxuICpcbiAqIGBQYXJzZVNwYW5gIG9iamVjdHMgYXJlIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgZXhwcmVzc2lvbi5cbiAqIFRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZXNlIHRvIGZ1bGwgYFBhcnNlU291cmNlU3BhbmAgb2JqZWN0cyB0aGF0XG4gKiBzaG93IHdoZXJlIHRoZSBzcGFuIGlzIHdpdGhpbiB0aGUgb3ZlcmFsbCBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcGFyYW0gc3BhbiB0aGUgcmVsYXRpdmUgc3BhbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGJhc2VTb3VyY2VTcGFuIGEgc3BhbiBjb3JyZXNwb25kaW5nIHRvIHRoZSBiYXNlIG9mIHRoZSBleHByZXNzaW9uIHRyZWUuXG4gKiBAcmV0dXJucyBhIGBQYXJzZVNvdXJjZVNwYW5gIGZvciB0aGUgZ2l2ZW4gc3BhbiBvciBudWxsIGlmIG5vIGBiYXNlU291cmNlU3BhbmAgd2FzIHByb3ZpZGVkLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0U291cmNlU3BhbihcbiAgICBzcGFuOiBlLlBhcnNlU3BhbiwgYmFzZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICBpZiAoYmFzZVNvdXJjZVNwYW4gPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzdGFydCA9IGJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgY29uc3QgZW5kID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uZW5kKTtcbiAgY29uc3QgZnVsbFN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uZnVsbFN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCwgZnVsbFN0YXJ0KTtcbn1cblxuLyoqXG4gKiBXaXRoIHRoZSBkaXJlY3RpdmUtYmFzZWQgY29udHJvbCBmbG93IHVzZXJzIHdlcmUgYWJsZSB0byBjb25kaXRpb25hbGx5IHByb2plY3QgY29udGVudCB1c2luZ1xuICogdGhlIGAqYCBzeW50YXguIEUuZy4gYDxkaXYgKm5nSWY9XCJleHByXCIgcHJvamVjdE1lPjwvZGl2PmAgd2lsbCBiZSBwcm9qZWN0ZWQgaW50b1xuICogYDxuZy1jb250ZW50IHNlbGVjdD1cIltwcm9qZWN0TWVdXCIvPmAsIGJlY2F1c2UgdGhlIGF0dHJpYnV0ZXMgYW5kIHRhZyBuYW1lIGZyb20gdGhlIGBkaXZgIGFyZVxuICogY29waWVkIHRvIHRoZSB0ZW1wbGF0ZSB2aWEgdGhlIHRlbXBsYXRlIGNyZWF0aW9uIGluc3RydWN0aW9uLiBXaXRoIGBAaWZgIGFuZCBgQGZvcmAgdGhhdCBpc1xuICogbm90IHRoZSBjYXNlLCBiZWNhdXNlIHRoZSBjb25kaXRpb25hbCBpcyBwbGFjZWQgKmFyb3VuZCogZWxlbWVudHMsIHJhdGhlciB0aGFuICpvbiogdGhlbS5cbiAqIFRoZSByZXN1bHQgaXMgdGhhdCBjb250ZW50IHByb2plY3Rpb24gd29uJ3Qgd29yayBpbiB0aGUgc2FtZSB3YXkgaWYgYSB1c2VyIGNvbnZlcnRzIGZyb21cbiAqIGAqbmdJZmAgdG8gYEBpZmAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBhaW1zIHRvIGNvdmVyIHRoZSBtb3N0IGNvbW1vbiBjYXNlIGJ5IGRvaW5nIHRoZSBzYW1lIGNvcHlpbmcgd2hlbiBhIGNvbnRyb2wgZmxvd1xuICogbm9kZSBoYXMgKm9uZSBhbmQgb25seSBvbmUqIHJvb3QgZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLlxuICpcbiAqIFRoaXMgYXBwcm9hY2ggY29tZXMgd2l0aCBzb21lIGNhdmVhdHM6XG4gKiAxLiBBcyBzb29uIGFzIGFueSBvdGhlciBub2RlIGlzIGFkZGVkIHRvIHRoZSByb290LCB0aGUgY29weWluZyBiZWhhdmlvciB3b24ndCB3b3JrIGFueW1vcmUuXG4gKiAgICBBIGRpYWdub3N0aWMgd2lsbCBiZSBhZGRlZCB0byBmbGFnIGNhc2VzIGxpa2UgdGhpcyBhbmQgdG8gZXhwbGFpbiBob3cgdG8gd29yayBhcm91bmQgaXQuXG4gKiAyLiBJZiBgcHJlc2VydmVXaGl0ZXNwYWNlc2AgaXMgZW5hYmxlZCwgaXQncyB2ZXJ5IGxpa2VseSB0aGF0IGluZGVudGF0aW9uIHdpbGwgYnJlYWsgdGhpc1xuICogICAgd29ya2Fyb3VuZCwgYmVjYXVzZSBpdCdsbCBpbmNsdWRlIGFuIGFkZGl0aW9uYWwgdGV4dCBub2RlIGFzIHRoZSBmaXJzdCBjaGlsZC4gV2UgY2FuIHdvcmtcbiAqICAgIGFyb3VuZCBpdCBoZXJlLCBidXQgaW4gYSBkaXNjdXNzaW9uIGl0IHdhcyBkZWNpZGVkIG5vdCB0bywgYmVjYXVzZSB0aGUgdXNlciBleHBsaWNpdGx5IG9wdGVkXG4gKiAgICBpbnRvIHByZXNlcnZpbmcgdGhlIHdoaXRlc3BhY2UgYW5kIHdlIHdvdWxkIGhhdmUgdG8gZHJvcCBpdCBmcm9tIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqICAgIFRoZSBkaWFnbm9zdGljIG1lbnRpb25lZCBwb2ludCAjMSB3aWxsIGZsYWcgc3VjaCBjYXNlcyB0byB1c2Vycy5cbiAqXG4gKiBAcmV0dXJucyBUYWcgbmFtZSB0byBiZSB1c2VkIGZvciB0aGUgY29udHJvbCBmbG93IHRlbXBsYXRlLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHhyZWY6IGlyLlhyZWZJZCwgbm9kZTogdC5JZkJsb2NrQnJhbmNofHQuRm9yTG9vcEJsb2NrKTogc3RyaW5nfG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50fHQuVGVtcGxhdGV8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5FbGVtZW50IHx8IChjaGlsZCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgY2hpbGQudGFnTmFtZSAhPT0gbnVsbCkpIHtcbiAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gIC8vIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uIE5vdGUgdGhhdCBpdCdzIGltcG9ydGFudFxuICAvLyB0aGF0IHdlIGRvbid0IGNvcHkgYW55IGJvdW5kIGF0dHJpYnV0ZXMgc2luY2UgdGhleSBkb24ndCBwYXJ0aWNpcGF0ZSBpbiBjb250ZW50IHByb2plY3Rpb25cbiAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiByb290LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgICAgdW5pdCwgeHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUsIGlyLlRlbXBsYXRlS2luZC5CbG9jayxcbiAgICAgICAgICBhdHRyLmkxOG4pO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSByb290IGluc3RhbmNlb2YgdC5FbGVtZW50ID8gcm9vdC5uYW1lIDogcm9vdC50YWdOYW1lO1xuXG4gICAgLy8gRG9uJ3QgcGFzcyBhbG9uZyBgbmctdGVtcGxhdGVgIHRhZyBuYW1lIHNpbmNlIGl0IGVuYWJsZXMgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIHJldHVybiB0YWdOYW1lID09PSAnbmctdGVtcGxhdGUnID8gbnVsbCA6IHRhZ05hbWU7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==