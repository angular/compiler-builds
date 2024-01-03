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
        ir.OpList.insertAfter(ir.createI18nStartOp(id, tmpl.i18n), childView.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id), childView.create.tail);
    }
}
/**
 * Ingest a content node from the AST into the given `ViewCompilation`.
 */
function ingestContent(unit, content) {
    if (content.i18n !== undefined && !(content.i18n instanceof i18n.TagPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for element: ${content.i18n.constructor.name}`);
    }
    const attrs = content.attributes.flatMap(a => [a.name, a.value]);
    const op = ir.createProjectionOp(unit.job.allocateXrefId(), content.selector, content.i18n, attrs, content.sourceSpan);
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
    const repeaterCreate = ir.createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, tagName, track, varNames, i18nPlaceholder, emptyI18nPlaceholder, forBlock.startSourceSpan, forBlock.sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBa0IsdUJBQXVCLEVBQUUseUJBQXlCLEVBQWdELE1BQU0sZUFBZSxDQUFDO0FBQ2pKLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFcEYsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUM7QUFFekUsdURBQXVEO0FBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksd0JBQXdCLEVBQUUsQ0FBQztBQUVqRCx5Q0FBeUM7QUFDekMsTUFBTSxvQkFBb0IsR0FBRyxhQUFhLENBQUM7QUFFM0M7Ozs7R0FJRztBQUNILE1BQU0s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QU0sSUFBSSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDbEMsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQy9CLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQ3ZGLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDaEU7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUVyRSwrRUFBK0U7UUFDL0UsT0FBTyxPQUFPLEtBQUssb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0tBQzFEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi8uLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIGUgZnJvbSAnLi4vLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19hc3QnO1xuaW1wb3J0IHtSM0RlZmVyQmxvY2tNZXRhZGF0YX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQge2ljdUZyb21JMThuTWVzc2FnZSwgaXNTaW5nbGVJMThuSWN1fSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3ZpZXcvaTE4bi91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuaW1wb3J0IHtDb21waWxhdGlvblVuaXQsIENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtCSU5BUllfT1BFUkFUT1JTLCBuYW1lc3BhY2VGb3JLZXksIHByZWZpeFdpdGhOYW1lc3BhY2V9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbmNvbnN0IGNvbXBhdGliaWxpdHlNb2RlID0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcjtcblxuLy8gU2NoZW1hIGNvbnRhaW5pbmcgRE9NIGVsZW1lbnRzIGFuZCB0aGVpciBwcm9wZXJ0aWVzLlxuY29uc3QgZG9tU2NoZW1hID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4vLyBUYWcgbmFtZSBvZiB0aGUgYG5nLXRlbXBsYXRlYCBlbGVtZW50LlxuY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuXG4vKipcbiAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBDb21wb25lbnRDb21waWxhdGlvbmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKiBUT0RPOiBSZWZhY3RvciBtb3JlIG9mIHRoZSBpbmdlc3Rpb24gY29kZSBpbnRvIHBoYXNlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdENvbXBvbmVudChcbiAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHRlbXBsYXRlOiB0Lk5vZGVbXSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZywgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuLFxuICAgIGRlZmVyQmxvY2tzTWV0YTogTWFwPHQuRGVmZXJyZWRCbG9jaywgUjNEZWZlckJsb2NrTWV0YWRhdGE+KTogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IoXG4gICAgICBjb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgaTE4blVzZUV4dGVybmFsSWRzLFxuICAgICAgZGVmZXJCbG9ja3NNZXRhKTtcbiAgaW5nZXN0Tm9kZXMoam9iLnJvb3QsIHRlbXBsYXRlKTtcbiAgcmV0dXJuIGpvYjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb3N0QmluZGluZ0lucHV0IHtcbiAgY29tcG9uZW50TmFtZTogc3RyaW5nO1xuICBjb21wb25lbnRTZWxlY3Rvcjogc3RyaW5nO1xuICBwcm9wZXJ0aWVzOiBlLlBhcnNlZFByb3BlcnR5W118bnVsbDtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGV2ZW50czogZS5QYXJzZWRFdmVudFtdfG51bGw7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIGhvc3QgYmluZGluZyBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgIGlucHV0OiBIb3N0QmluZGluZ0lucHV0LCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGpvYiA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKGlucHV0LmNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUpO1xuICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIGlucHV0LnByb3BlcnRpZXMgPz8gW10pIHtcbiAgICBsZXQgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eTtcbiAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCByZWFsbHkgYmUgaGFuZGxlZCBpbiB0aGUgcGFyc2VyLlxuICAgIGlmIChwcm9wZXJ0eS5uYW1lLnN0YXJ0c1dpdGgoJ2F0dHIuJykpIHtcbiAgICAgIHByb3BlcnR5Lm5hbWUgPSBwcm9wZXJ0eS5uYW1lLnN1YnN0cmluZygnYXR0ci4nLmxlbmd0aCk7XG4gICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZTtcbiAgICB9XG4gICAgaWYgKHByb3BlcnR5LmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbjtcbiAgICB9XG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXJcbiAgICAgICAgICAgIC5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgICAgICAgICAgICAgIGlucHV0LmNvbXBvbmVudFNlbGVjdG9yLCBwcm9wZXJ0eS5uYW1lLCBiaW5kaW5nS2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlKVxuICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IFNlY3VyaXR5Q29udGV4dC5OT05FKTtcbiAgICBpbmdlc3RIb3N0UHJvcGVydHkoam9iLCBwcm9wZXJ0eSwgYmluZGluZ0tpbmQsIHNlY3VyaXR5Q29udGV4dHMpO1xuICB9XG4gIGZvciAoY29uc3QgW25hbWUsIGV4cHJdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0LmF0dHJpYnV0ZXMpID8/IFtdKSB7XG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhpbnB1dC5jb21wb25lbnRTZWxlY3RvciwgbmFtZSwgdHJ1ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgaW5nZXN0SG9zdEF0dHJpYnV0ZShqb2IsIG5hbWUsIGV4cHIsIHNlY3VyaXR5Q29udGV4dHMpO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgaW5wdXQuZXZlbnRzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEV2ZW50KGpvYiwgZXZlbnQpO1xuICB9XG4gIHJldHVybiBqb2I7XG59XG5cbi8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciB0aGUgcGFyc2VyIHRvIHVzZSB0aGUgc2FtZSB0eXBlcyBhbmQgc3RydWN0dXJlcyBmb3IgaG9zdCBiaW5kaW5ncyBhc1xuLy8gd2l0aCBvcmRpbmFyeSBjb21wb25lbnRzLiBUaGlzIHdvdWxkIGFsbG93IHVzIHRvIHNoYXJlIGEgbG90IG1vcmUgaW5nZXN0aW9uIGNvZGUuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdFByb3BlcnR5KFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgcHJvcGVydHk6IGUuUGFyc2VkUHJvcGVydHksIGJpbmRpbmdLaW5kOiBpci5CaW5kaW5nS2luZCxcbiAgICBzZWN1cml0eUNvbnRleHRzOiBTZWN1cml0eUNvbnRleHRbXSk6IHZvaWQge1xuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGNvbnN0IGFzdCA9IHByb3BlcnR5LmV4cHJlc3Npb24uYXN0O1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgZXhwcmVzc2lvbiA9IG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICBhc3Quc3RyaW5ncywgYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSksIFtdKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdChhc3QsIGpvYiwgcHJvcGVydHkuc291cmNlU3Bhbik7XG4gIH1cbiAgam9iLnJvb3QudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgYmluZGluZ0tpbmQsIHByb3BlcnR5Lm5hbWUsIGV4cHJlc3Npb24sIG51bGwsIHNlY3VyaXR5Q29udGV4dHMsIGZhbHNlLCBmYWxzZSxcbiAgICAgIG51bGwsIC8qIFRPRE86IEhvdyBkbyBIb3N0IGJpbmRpbmdzIGhhbmRsZSBpMThuIGF0dHJzPyAqLyBudWxsLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QXR0cmlidXRlKFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uLFxuICAgIHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBuYW1lLCB2YWx1ZSwgbnVsbCwgc2VjdXJpdHlDb250ZXh0cyxcbiAgICAgIC8qIEhvc3QgYXR0cmlidXRlcyBzaG91bGQgYWx3YXlzIGJlIGV4dHJhY3RlZCB0byBjb25zdCBob3N0QXR0cnMsIGV2ZW4gaWYgdGhleSBhcmUgbm90XG4gICAgICAgKnN0cmljdGx5KiB0ZXh0IGxpdGVyYWxzICovXG4gICAgICB0cnVlLCBmYWxzZSwgbnVsbCxcbiAgICAgIC8qIFRPRE8gKi8gbnVsbCxcbiAgICAgIC8qKiBUT0RPOiBNYXkgYmUgbnVsbD8gKi8gdmFsdWUuc291cmNlU3BhbiEpO1xuICBqb2Iucm9vdC51cGRhdGUucHVzaChhdHRyQmluZGluZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0RXZlbnQoam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBldmVudDogZS5QYXJzZWRFdmVudCkge1xuICBjb25zdCBbcGhhc2UsIHRhcmdldF0gPSBldmVudC50eXBlID09PSBlLlBhcnNlZEV2ZW50VHlwZS5SZWd1bGFyID8gW251bGwsIGV2ZW50LnRhcmdldE9yUGhhc2VdIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtldmVudC50YXJnZXRPclBoYXNlLCBudWxsXTtcbiAgY29uc3QgZXZlbnRCaW5kaW5nID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIG5ldyBpci5TbG90SGFuZGxlKCksIGV2ZW50Lm5hbWUsIG51bGwsXG4gICAgICBtYWtlTGlzdGVuZXJIYW5kbGVyT3BzKGpvYi5yb290LCBldmVudC5oYW5kbGVyLCBldmVudC5oYW5kbGVyU3BhbiksIHBoYXNlLCB0YXJnZXQsIHRydWUsXG4gICAgICBldmVudC5zb3VyY2VTcGFuKTtcbiAgam9iLnJvb3QuY3JlYXRlLnB1c2goZXZlbnRCaW5kaW5nKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgdGhlIG5vZGVzIG9mIGEgdGVtcGxhdGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3ROb2Rlcyh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZW1wbGF0ZTogdC5Ob2RlW10pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBub2RlIG9mIHRlbXBsYXRlKSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIGluZ2VzdEVsZW1lbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgICAgaW5nZXN0VGVtcGxhdGUodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Db250ZW50KSB7XG4gICAgICBpbmdlc3RDb250ZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgaW5nZXN0VGV4dCh1bml0LCBub2RlLCBudWxsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIG5vZGUsIG51bGwpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWZCbG9jaykge1xuICAgICAgaW5nZXN0SWZCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlN3aXRjaEJsb2NrKSB7XG4gICAgICBpbmdlc3RTd2l0Y2hCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkRlZmVycmVkQmxvY2spIHtcbiAgICAgIGluZ2VzdERlZmVyQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JY3UpIHtcbiAgICAgIGluZ2VzdEljdSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkZvckxvb3BCbG9jaykge1xuICAgICAgaW5nZXN0Rm9yQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZTogJHtub2RlLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGVsZW1lbnQgQVNUIGZyb20gdGhlIHRlbXBsYXRlIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RFbGVtZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGVsZW1lbnQ6IHQuRWxlbWVudCk6IHZvaWQge1xuICBpZiAoZWxlbWVudC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGVsZW1lbnQ6ICR7ZWxlbWVudC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG5cbiAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcblxuICBjb25zdCBzdGFydE9wID0gaXIuY3JlYXRlRWxlbWVudFN0YXJ0T3AoXG4gICAgICBlbGVtZW50TmFtZSwgaWQsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VLZXkpLFxuICAgICAgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IGVsZW1lbnQuaTE4biA6IHVuZGVmaW5lZCxcbiAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHN0YXJ0T3ApO1xuXG4gIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyh1bml0LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcblxuICAvLyBTdGFydCBpMThuLCBpZiBuZWVkZWQsIGdvZXMgYWZ0ZXIgdGhlIGVsZW1lbnQgY3JlYXRlIGFuZCBiaW5kaW5ncywgYnV0IGJlZm9yZSB0aGUgbm9kZXNcbiAgbGV0IGkxOG5CbG9ja0lkOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGlmIChlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBpMThuQmxvY2tJZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuU3RhcnRPcChpMThuQmxvY2tJZCwgZWxlbWVudC5pMThuKSk7XG4gIH1cblxuICBpbmdlc3ROb2Rlcyh1bml0LCBlbGVtZW50LmNoaWxkcmVuKTtcblxuICAvLyBUaGUgc291cmNlIHNwYW4gZm9yIHRoZSBlbmQgb3AgaXMgdHlwaWNhbGx5IHRoZSBlbGVtZW50IGNsb3NpbmcgdGFnLiBIb3dldmVyLCBpZiBubyBjbG9zaW5nIHRhZ1xuICAvLyBleGlzdHMsIHN1Y2ggYXMgaW4gYDxpbnB1dD5gLCB3ZSB1c2UgdGhlIHN0YXJ0IHNvdXJjZSBzcGFuIGluc3RlYWQuIFVzdWFsbHkgdGhlIHN0YXJ0IGFuZCBlbmRcbiAgLy8gaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgY29sbGFwc2VkIGludG8gb25lIGBlbGVtZW50YCBpbnN0cnVjdGlvbiwgbmVnYXRpbmcgdGhlIHB1cnBvc2Ugb2YgdGhpc1xuICAvLyBmYWxsYmFjaywgYnV0IGluIGNhc2VzIHdoZW4gaXQgaXMgbm90IGNvbGxhcHNlZCAoc3VjaCBhcyBhbiBpbnB1dCB3aXRoIGEgYmluZGluZyksIHdlIHN0aWxsXG4gIC8vIHdhbnQgdG8gbWFwIHRoZSBlbmQgaW5zdHJ1Y3Rpb24gdG8gdGhlIG1haW4gZWxlbWVudC5cbiAgY29uc3QgZW5kT3AgPSBpci5jcmVhdGVFbGVtZW50RW5kT3AoaWQsIGVsZW1lbnQuZW5kU291cmNlU3BhbiA/PyBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goZW5kT3ApO1xuXG4gIC8vIElmIHRoZXJlIGlzIGFuIGkxOG4gbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBlbGVtZW50LCBpbnNlcnQgaTE4biBzdGFydCBhbmQgZW5kIG9wcy5cbiAgaWYgKGkxOG5CbG9ja0lkICE9PSBudWxsKSB7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oaXIuY3JlYXRlSTE4bkVuZE9wKGkxOG5CbG9ja0lkKSwgZW5kT3ApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBuZy10ZW1wbGF0ZWAgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRtcGw6IHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKHRtcGwuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciB0ZW1wbGF0ZTogJHt0bXBsLmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGxldCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9IHRtcGwudGFnTmFtZTtcbiAgbGV0IG5hbWVzcGFjZVByZWZpeDogc3RyaW5nfG51bGwgPSAnJztcbiAgaWYgKHRtcGwudGFnTmFtZSkge1xuICAgIFtuYW1lc3BhY2VQcmVmaXgsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlXSA9IHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyID8gdG1wbC5pMThuIDogdW5kZWZpbmVkO1xuICBjb25zdCBuYW1lc3BhY2UgPSBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlUHJlZml4KTtcbiAgY29uc3QgZnVuY3Rpb25OYW1lU3VmZml4ID0gdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPT09IG51bGwgP1xuICAgICAgJycgOlxuICAgICAgcHJlZml4V2l0aE5hbWVzcGFjZSh0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgbmFtZXNwYWNlKTtcbiAgY29uc3QgdGVtcGxhdGVLaW5kID1cbiAgICAgIGlzUGxhaW5UZW1wbGF0ZSh0bXBsKSA/IGlyLlRlbXBsYXRlS2luZC5OZ1RlbXBsYXRlIDogaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWw7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgY2hpbGRWaWV3LnhyZWYsIHRlbXBsYXRlS2luZCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIGZ1bmN0aW9uTmFtZVN1ZmZpeCwgbmFtZXNwYWNlLFxuICAgICAgaTE4blBsYWNlaG9sZGVyLCB0bXBsLnN0YXJ0U291cmNlU3BhbiwgdG1wbC5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcblxuICBpbmdlc3RUZW1wbGF0ZUJpbmRpbmdzKHVuaXQsIHRlbXBsYXRlT3AsIHRtcGwsIHRlbXBsYXRlS2luZCk7XG4gIGluZ2VzdFJlZmVyZW5jZXModGVtcGxhdGVPcCwgdG1wbCk7XG4gIGluZ2VzdE5vZGVzKGNoaWxkVmlldywgdG1wbC5jaGlsZHJlbik7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIHRtcGwudmFyaWFibGVzKSB7XG4gICAgY2hpbGRWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KG5hbWUsIHZhbHVlICE9PSAnJyA/IHZhbHVlIDogJyRpbXBsaWNpdCcpO1xuICB9XG5cbiAgLy8gSWYgdGhpcyBpcyBhIHBsYWluIHRlbXBsYXRlIGFuZCB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIGl0LCBpbnNlcnQgaTE4biBzdGFydFxuICAvLyBhbmQgZW5kIG9wcy4gRm9yIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlcywgdGhlIGkxOG4gb3BzIHdpbGwgYmUgYWRkZWQgd2hlbiBpbmdlc3RpbmcgdGhlXG4gIC8vIGVsZW1lbnQvdGVtcGxhdGUgdGhlIGRpcmVjdGl2ZSBpcyBwbGFjZWQgb24uXG4gIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5OZ1RlbXBsYXRlICYmIHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biksIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgY29udGVudCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Q29udGVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBjb250ZW50OiB0LkNvbnRlbnQpOiB2b2lkIHtcbiAgaWYgKGNvbnRlbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmICEoY29udGVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgZWxlbWVudDogJHtjb250ZW50LmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICBjb25zdCBhdHRycyA9IGNvbnRlbnQuYXR0cmlidXRlcy5mbGF0TWFwKGEgPT4gW2EubmFtZSwgYS52YWx1ZV0pO1xuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcChcbiAgICAgIHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRlbnQuc2VsZWN0b3IsIGNvbnRlbnQuaTE4biwgYXR0cnMsIGNvbnRlbnQuc291cmNlU3Bhbik7XG4gIGZvciAoY29uc3QgYXR0ciBvZiBjb250ZW50LmF0dHJpYnV0ZXMpIHtcbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KGNvbnRlbnQubmFtZSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgICAgb3AueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgbnVsbCwgc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICB0cnVlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGF0dHIuaTE4biksIGF0dHIuc291cmNlU3BhbikpO1xuICB9XG4gIHVuaXQuY3JlYXRlLnB1c2gob3ApO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhIGxpdGVyYWwgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGV4dCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZXh0OiB0LlRleHQsIGljdVBsYWNlaG9sZGVyOiBzdHJpbmd8bnVsbCk6IHZvaWQge1xuICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIGljdVBsYWNlaG9sZGVyLCB0ZXh0LnNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gaW50ZXJwb2xhdGVkIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEJvdW5kVGV4dChcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZXh0OiB0LkJvdW5kVGV4dCwgaWN1UGxhY2Vob2xkZXI6IHN0cmluZ3xudWxsKTogdm9pZCB7XG4gIGxldCB2YWx1ZSA9IHRleHQudmFsdWU7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHZhbHVlID0gdmFsdWUuYXN0O1xuICB9XG4gIGlmICghKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBJbnRlcnBvbGF0aW9uIGZvciBCb3VuZFRleHQgbm9kZSwgZ290ICR7dmFsdWUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICBpZiAodGV4dC5pMThuICE9PSB1bmRlZmluZWQgJiYgISh0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lcikpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRleHQgaW50ZXJwb2xhdGlvbjogJHt0ZXh0LmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXJzID0gdGV4dC5pMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIgP1xuICAgICAgdGV4dC5pMThuLmNoaWxkcmVuXG4gICAgICAgICAgLmZpbHRlcigobm9kZSk6IG5vZGUgaXMgaTE4bi5QbGFjZWhvbGRlciA9PiBub2RlIGluc3RhbmNlb2YgaTE4bi5QbGFjZWhvbGRlcilcbiAgICAgICAgICAubWFwKHBsYWNlaG9sZGVyID0+IHBsYWNlaG9sZGVyLm5hbWUpIDpcbiAgICAgIFtdO1xuICBpZiAoaTE4blBsYWNlaG9sZGVycy5sZW5ndGggPiAwICYmIGkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoICE9PSB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGgpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5leHBlY3RlZCBudW1iZXIgb2YgaTE4biBwbGFjZWhvbGRlcnMgKCR7XG4gICAgICAgIHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aH0pIGZvciBCb3VuZFRleHQgd2l0aCAke3ZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aH0gZXhwcmVzc2lvbnNgKTtcbiAgfVxuXG4gIGNvbnN0IHRleHRYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3AodGV4dFhyZWYsICcnLCBpY3VQbGFjZWhvbGRlciwgdGV4dC5zb3VyY2VTcGFuKSk7XG4gIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgZG9lcyBub3QgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1Yi1leHByZXNzaW9ucyBpbnNpZGUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbi4gV2UgY29weSB0aGF0IGJlaGF2aW9yIGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgLy8gVE9ETzogaXMgaXQgYWN0dWFsbHkgY29ycmVjdCB0byBnZW5lcmF0ZSB0aGVzZSBleHRyYSBtYXBzIGluIG1vZGVybiBtb2RlP1xuICBjb25zdCBiYXNlU291cmNlU3BhbiA9IHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPyBudWxsIDogdGV4dC5zb3VyY2VTcGFuO1xuICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgICAgdGV4dFhyZWYsXG4gICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgICB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICAgIGkxOG5QbGFjZWhvbGRlcnMpLFxuICAgICAgdGV4dC5zb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAaWZgIGJsb2NrIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RJZkJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGlmQmxvY2s6IHQuSWZCbG9jayk6IHZvaWQge1xuICBsZXQgZmlyc3RYcmVmOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGxldCBmaXJzdFNsb3RIYW5kbGU6IGlyLlNsb3RIYW5kbGV8bnVsbCA9IG51bGw7XG4gIGxldCBjb25kaXRpb25zOiBBcnJheTxpci5Db25kaXRpb25hbENhc2VFeHByPiA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGlmQmxvY2suYnJhbmNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpZkNhc2UgPSBpZkJsb2NrLmJyYW5jaGVzW2ldO1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgbGV0IHRhZ05hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICAgIC8vIE9ubHkgdGhlIGZpcnN0IGJyYW5jaCBjYW4gYmUgdXNlZCBmb3IgcHJvamVjdGlvbiwgYmVjYXVzZSB0aGUgY29uZGl0aW9uYWxcbiAgICAvLyB1c2VzIHRoZSBjb250YWluZXIgb2YgdGhlIGZpcnN0IGJyYW5jaCBhcyB0aGUgaW5zZXJ0aW9uIHBvaW50IGZvciBhbGwgYnJhbmNoZXMuXG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHRhZ05hbWUgPSBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KHVuaXQsIGNWaWV3LnhyZWYsIGlmQ2FzZSk7XG4gICAgfVxuICAgIGlmIChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICBjVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzLm5hbWUsIGlyLkNUWF9SRUYpO1xuICAgIH1cblxuICAgIGxldCBpZkNhc2VJMThuTWV0YSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoaWZDYXNlLmkxOG4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKCEoaWZDYXNlLmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBpZiBibG9jazogJHtpZkNhc2UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIGlmQ2FzZUkxOG5NZXRhID0gaWZDYXNlLmkxOG47XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsIGlyLlRlbXBsYXRlS2luZC5CbG9jaywgdGFnTmFtZSwgJ0NvbmRpdGlvbmFsJywgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICAgIGlmQ2FzZUkxOG5NZXRhLCBpZkNhc2Uuc3RhcnRTb3VyY2VTcGFuLCBpZkNhc2Uuc291cmNlU3Bhbik7XG4gICAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcblxuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgICBmaXJzdFNsb3RIYW5kbGUgPSB0ZW1wbGF0ZU9wLmhhbmRsZTtcbiAgICB9XG5cbiAgICBjb25zdCBjYXNlRXhwciA9IGlmQ2FzZS5leHByZXNzaW9uID8gY29udmVydEFzdChpZkNhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIG51bGwpIDogbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID0gbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoXG4gICAgICAgIGNhc2VFeHByLCB0ZW1wbGF0ZU9wLnhyZWYsIHRlbXBsYXRlT3AuaGFuZGxlLCBpZkNhc2UuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICBjb25kaXRpb25zLnB1c2goY29uZGl0aW9uYWxDYXNlRXhwcik7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIGlmQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPVxuICAgICAgaXIuY3JlYXRlQ29uZGl0aW9uYWxPcChmaXJzdFhyZWYhLCBmaXJzdFNsb3RIYW5kbGUhLCBudWxsLCBjb25kaXRpb25zLCBpZkJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKGNvbmRpdGlvbmFsKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBzd2l0Y2hgIGJsb2NrIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RTd2l0Y2hCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzd2l0Y2hCbG9jazogdC5Td2l0Y2hCbG9jayk6IHZvaWQge1xuICAvLyBEb24ndCBpbmdlc3QgZW1wdHkgc3dpdGNoZXMgc2luY2UgdGhleSB3b24ndCByZW5kZXIgYW55dGhpbmcuXG4gIGlmIChzd2l0Y2hCbG9jay5jYXNlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZmlyc3RYcmVmOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGxldCBmaXJzdFNsb3RIYW5kbGU6IGlyLlNsb3RIYW5kbGV8bnVsbCA9IG51bGw7XG4gIGxldCBjb25kaXRpb25zOiBBcnJheTxpci5Db25kaXRpb25hbENhc2VFeHByPiA9IFtdO1xuICBmb3IgKGNvbnN0IHN3aXRjaENhc2Ugb2Ygc3dpdGNoQmxvY2suY2FzZXMpIHtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGxldCBzd2l0Y2hDYXNlSTE4bk1ldGEgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHN3aXRjaENhc2UuaTE4biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIShzd2l0Y2hDYXNlLmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHN3aXRjaCBibG9jazogJHtzd2l0Y2hDYXNlLmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgICB9XG4gICAgICBzd2l0Y2hDYXNlSTE4bk1ldGEgPSBzd2l0Y2hDYXNlLmkxOG47XG4gICAgfVxuICAgIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgICBjVmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIG51bGwsICdDYXNlJywgaXIuTmFtZXNwYWNlLkhUTUwsIHN3aXRjaENhc2VJMThuTWV0YSxcbiAgICAgICAgc3dpdGNoQ2FzZS5zdGFydFNvdXJjZVNwYW4sIHN3aXRjaENhc2Uuc291cmNlU3Bhbik7XG4gICAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgICAgZmlyc3RTbG90SGFuZGxlID0gdGVtcGxhdGVPcC5oYW5kbGU7XG4gICAgfVxuICAgIGNvbnN0IGNhc2VFeHByID0gc3dpdGNoQ2FzZS5leHByZXNzaW9uID9cbiAgICAgICAgY29udmVydEFzdChzd2l0Y2hDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBzd2l0Y2hCbG9jay5zdGFydFNvdXJjZVNwYW4pIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID1cbiAgICAgICAgbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoY2FzZUV4cHIsIHRlbXBsYXRlT3AueHJlZiwgdGVtcGxhdGVPcC5oYW5kbGUpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgc3dpdGNoQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKFxuICAgICAgZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCksIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWZmaXg6IHN0cmluZywgaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGF8dW5kZWZpbmVkLFxuICAgIGNoaWxkcmVuPzogdC5Ob2RlW10sIHNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBpci5UZW1wbGF0ZU9wfG51bGwge1xuICBpZiAoaTE4bk1ldGEgIT09IHVuZGVmaW5lZCAmJiAhKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKCdVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBkZWZlciBibG9jaycpO1xuICB9XG4gIGlmIChjaGlsZHJlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc2Vjb25kYXJ5VmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICBpbmdlc3ROb2RlcyhzZWNvbmRhcnlWaWV3LCBjaGlsZHJlbik7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgc2Vjb25kYXJ5Vmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIG51bGwsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgaTE4bk1ldGEsIHNvdXJjZVNwYW4hLCBzb3VyY2VTcGFuISk7XG4gIHVuaXQuY3JlYXRlLnB1c2godGVtcGxhdGVPcCk7XG4gIHJldHVybiB0ZW1wbGF0ZU9wO1xufVxuXG5mdW5jdGlvbiBpbmdlc3REZWZlckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGRlZmVyQmxvY2s6IHQuRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICBjb25zdCBibG9ja01ldGEgPSB1bml0LmpvYi5kZWZlckJsb2Nrc01ldGEuZ2V0KGRlZmVyQmxvY2spO1xuICBpZiAoYmxvY2tNZXRhID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gZmluZCBtZXRhZGF0YSBmb3IgZGVmZXJyZWQgYmxvY2tgKTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIHRoZSBkZWZlciBtYWluIHZpZXcgYW5kIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IG1haW4gPVxuICAgICAgaW5nZXN0RGVmZXJWaWV3KHVuaXQsICcnLCBkZWZlckJsb2NrLmkxOG4sIGRlZmVyQmxvY2suY2hpbGRyZW4sIGRlZmVyQmxvY2suc291cmNlU3BhbikhO1xuICBjb25zdCBsb2FkaW5nID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ0xvYWRpbmcnLCBkZWZlckJsb2NrLmxvYWRpbmc/LmkxOG4sIGRlZmVyQmxvY2subG9hZGluZz8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLmxvYWRpbmc/LnNvdXJjZVNwYW4pO1xuICBjb25zdCBwbGFjZWhvbGRlciA9IGluZ2VzdERlZmVyVmlldyhcbiAgICAgIHVuaXQsICdQbGFjZWhvbGRlcicsIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmkxOG4sIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmNoaWxkcmVuLFxuICAgICAgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uc291cmNlU3Bhbik7XG4gIGNvbnN0IGVycm9yID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ0Vycm9yJywgZGVmZXJCbG9jay5lcnJvcj8uaTE4biwgZGVmZXJCbG9jay5lcnJvcj8uY2hpbGRyZW4sXG4gICAgICBkZWZlckJsb2NrLmVycm9yPy5zb3VyY2VTcGFuKTtcblxuICAvLyBDcmVhdGUgdGhlIG1haW4gZGVmZXIgb3AsIGFuZCBvcHMgZm9yIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IGRlZmVyWHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gIGNvbnN0IGRlZmVyT3AgPVxuICAgICAgaXIuY3JlYXRlRGVmZXJPcChkZWZlclhyZWYsIG1haW4ueHJlZiwgbWFpbi5oYW5kbGUsIGJsb2NrTWV0YSwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKTtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlclZpZXcgPSBwbGFjZWhvbGRlcj8ueHJlZiA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyU2xvdCA9IHBsYWNlaG9sZGVyPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nU2xvdCA9IGxvYWRpbmc/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmVycm9yU2xvdCA9IGVycm9yPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlck1pbmltdW1UaW1lID0gZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLmxvYWRpbmc/Lm1pbmltdW1UaW1lID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ0FmdGVyVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8uYWZ0ZXJUaW1lID8/IG51bGw7XG4gIHVuaXQuY3JlYXRlLnB1c2goZGVmZXJPcCk7XG5cbiAgLy8gQ29uZmlndXJlIGFsbCBkZWZlciBgb25gIGNvbmRpdGlvbnMuXG4gIC8vIFRPRE86IHJlZmFjdG9yIHByZWZldGNoIHRyaWdnZXJzIHRvIHVzZSBhIHNlcGFyYXRlIG9wIHR5cGUsIHdpdGggYSBzaGFyZWQgc3VwZXJjbGFzcy4gVGhpcyB3aWxsXG4gIC8vIG1ha2UgaXQgZWFzaWVyIHRvIHJlZmFjdG9yIHByZWZldGNoIGJlaGF2aW9yIGluIHRoZSBmdXR1cmUuXG4gIGxldCBwcmVmZXRjaCA9IGZhbHNlO1xuICBsZXQgZGVmZXJPbk9wczogaXIuRGVmZXJPbk9wW10gPSBbXTtcbiAgbGV0IGRlZmVyV2hlbk9wczogaXIuRGVmZXJXaGVuT3BbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHRyaWdnZXJzIG9mIFtkZWZlckJsb2NrLnRyaWdnZXJzLCBkZWZlckJsb2NrLnByZWZldGNoVHJpZ2dlcnNdKSB7XG4gICAgaWYgKHRyaWdnZXJzLmlkbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIHByZWZldGNoLCB0cmlnZ2Vycy5pZGxlLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5pbW1lZGlhdGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlfSwgcHJlZmV0Y2gsXG4gICAgICAgICAgdHJpZ2dlcnMuaW1tZWRpYXRlLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy50aW1lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5UaW1lciwgZGVsYXk6IHRyaWdnZXJzLnRpbWVyLmRlbGF5fSwgcHJlZmV0Y2gsXG4gICAgICAgICAgdHJpZ2dlcnMudGltZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmhvdmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXIsXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5ob3Zlci5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmhvdmVyLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5pbnRlcmFjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLkludGVyYWN0aW9uLFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMuaW50ZXJhY3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMudmlld3BvcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5WaWV3cG9ydCxcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLnZpZXdwb3J0LnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMudmlld3BvcnQuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLndoZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHRyaWdnZXJzLndoZW4udmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBzdXBwb3J0cyB0aGlzIGNhc2UsIGJ1dCBpdCdzIHZlcnkgc3RyYW5nZSB0byBtZS4gV2hhdCB3b3VsZCBpdFxuICAgICAgICAvLyBldmVuIG1lYW4/XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uIGluIGRlZmVyIGJsb2NrIHdoZW4gdHJpZ2dlcmApO1xuICAgICAgfVxuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJXaGVuT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCBjb252ZXJ0QXN0KHRyaWdnZXJzLndoZW4udmFsdWUsIHVuaXQuam9iLCB0cmlnZ2Vycy53aGVuLnNvdXJjZVNwYW4pLCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy53aGVuLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJXaGVuT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyAobm9uLXByZWZldGNoaW5nKSBkZWZlciB0cmlnZ2VycyB3ZXJlIHByb3ZpZGVkLCBkZWZhdWx0IHRvIGBpZGxlYC5cbiAgICBpZiAoZGVmZXJPbk9wcy5sZW5ndGggPT09IDAgJiYgZGVmZXJXaGVuT3BzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKFxuICAgICAgICAgIGlyLmNyZWF0ZURlZmVyT25PcChkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLklkbGV9LCBmYWxzZSwgbnVsbCEpKTtcbiAgICB9XG4gICAgcHJlZmV0Y2ggPSB0cnVlO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9uT3BzKTtcbiAgdW5pdC51cGRhdGUucHVzaChkZWZlcldoZW5PcHMpO1xufVxuXG5mdW5jdGlvbiBpbmdlc3RJY3UodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWN1OiB0LkljdSkge1xuICBpZiAoaWN1LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgJiYgaXNTaW5nbGVJMThuSWN1KGljdS5pMThuKSkge1xuICAgIGNvbnN0IHhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGNvbnN0IGljdU5vZGUgPSBpY3UuaTE4bi5ub2Rlc1swXTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdVN0YXJ0T3AoeHJlZiwgaWN1LmkxOG4sIGljdUZyb21JMThuTWVzc2FnZShpY3UuaTE4bikubmFtZSwgbnVsbCEpKTtcbiAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgdGV4dF0gb2YgT2JqZWN0LmVudHJpZXMoey4uLmljdS52YXJzLCAuLi5pY3UucGxhY2Vob2xkZXJzfSkpIHtcbiAgICAgIGlmICh0ZXh0IGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIHRleHQsIHBsYWNlaG9sZGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluZ2VzdFRleHQodW5pdCwgdGV4dCwgcGxhY2Vob2xkZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdUVuZE9wKHhyZWYpKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgSUNVOiAke2ljdS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAZm9yYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Rm9yQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZm9yQmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGNvbnN0IGNyZWF0ZVJlcGVhdGVyQWxpYXMgPSAoaWRlbnQ6IHN0cmluZywgcmVwZWF0ZXJWYXI6IGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5KSA9PiB7XG4gICAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGlkZW50aWZpZXI6IGlkZW50LFxuICAgICAgZXhwcmVzc2lvbjogbmV3IGlyLkRlcml2ZWRSZXBlYXRlclZhckV4cHIocmVwZWF0ZXJWaWV3LnhyZWYsIHJlcGVhdGVyVmFyKSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoXG4gICAgICBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRmlyc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuTGFzdCk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eS5FdmVuKTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuT2RkKTtcblxuICBjb25zdCBzb3VyY2VTcGFuID0gY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2sudHJhY2tCeS5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgY29uc3QgdHJhY2sgPSBjb252ZXJ0QXN0KGZvckJsb2NrLnRyYWNrQnksIHVuaXQuam9iLCBzb3VyY2VTcGFuKTtcblxuICBpbmdlc3ROb2RlcyhyZXBlYXRlclZpZXcsIGZvckJsb2NrLmNoaWxkcmVuKTtcblxuICBsZXQgZW1wdHlWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0fG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgfVxuXG4gIGNvbnN0IHZhck5hbWVzOiBpci5SZXBlYXRlclZhck5hbWVzID0ge1xuICAgICRpbmRleDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSxcbiAgICAkY291bnQ6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWUsXG4gICAgJGZpcnN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRmaXJzdC5uYW1lLFxuICAgICRsYXN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsXG4gICAgJGV2ZW46IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSxcbiAgICAkb2RkOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSxcbiAgICAkaW1wbGljaXQ6IGZvckJsb2NrLml0ZW0ubmFtZSxcbiAgfTtcblxuICBpZiAoZm9yQmxvY2suaTE4biAhPT0gdW5kZWZpbmVkICYmICEoZm9yQmxvY2suaTE4biBpbnN0YW5jZW9mIGkxOG4uQmxvY2tQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgb3IgQGZvcicpO1xuICB9XG4gIGlmIChmb3JCbG9jay5lbXB0eT8uaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGZvckJsb2NrLmVtcHR5LmkxOG4gaW5zdGFuY2VvZiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIG9yIEBlbXB0eScpO1xuICB9XG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IGZvckJsb2NrLmkxOG47XG4gIGNvbnN0IGVtcHR5STE4blBsYWNlaG9sZGVyID0gZm9yQmxvY2suZW1wdHk/LmkxOG47XG5cbiAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgcmVwZWF0ZXJWaWV3LnhyZWYsIGZvckJsb2NrKTtcbiAgY29uc3QgcmVwZWF0ZXJDcmVhdGUgPSBpci5jcmVhdGVSZXBlYXRlckNyZWF0ZU9wKFxuICAgICAgcmVwZWF0ZXJWaWV3LnhyZWYsIGVtcHR5Vmlldz8ueHJlZiA/PyBudWxsLCB0YWdOYW1lLCB0cmFjaywgdmFyTmFtZXMsIGkxOG5QbGFjZWhvbGRlcixcbiAgICAgIGVtcHR5STE4blBsYWNlaG9sZGVyLCBmb3JCbG9jay5zdGFydFNvdXJjZVNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHJlcGVhdGVyQ3JlYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gY29udmVydEFzdChcbiAgICAgIGZvckJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2suZXhwcmVzc2lvbi5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKSk7XG4gIGNvbnN0IHJlcGVhdGVyID0gaXIuY3JlYXRlUmVwZWF0ZXJPcChcbiAgICAgIHJlcGVhdGVyQ3JlYXRlLnhyZWYsIHJlcGVhdGVyQ3JlYXRlLmhhbmRsZSwgZXhwcmVzc2lvbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2gocmVwZWF0ZXIpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBBU1QgZXhwcmVzc2lvbiBpbnRvIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gY29udmVydEFzdChcbiAgICBhc3Q6IGUuQVNULCBqb2I6IENvbXBpbGF0aW9uSm9iLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmFzdCwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVJlYWQpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyICYmICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSwgbnVsbCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgICAgLy8gVE9ETzogSXMgaXQgY29ycmVjdCB0byBhbHdheXMgdXNlIHRoZSByb290IGNvbnRleHQgaW4gcGxhY2Ugb2YgdGhlIGltcGxpY2l0IHJlY2VpdmVyP1xuICAgICAgICAgIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKSwgYXN0Lm5hbWUsIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBudWxsLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkV3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNhbGwpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgSW1wbGljaXRSZWNlaXZlcmApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBhc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5VbmFyeSkge1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdG9yKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgby5VbmFyeU9wZXJhdG9yLlBsdXMsIGNvbnZlcnRBc3QoYXN0LmV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICByZXR1cm4gbmV3IG8uVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvLlVuYXJ5T3BlcmF0b3IuTWludXMsIGNvbnZlcnRBc3QoYXN0LmV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gdW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0b3J9YCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluYXJ5KSB7XG4gICAgY29uc3Qgb3BlcmF0b3IgPSBCSU5BUllfT1BFUkFUT1JTLmdldChhc3Qub3BlcmF0aW9uKTtcbiAgICBpZiAob3BlcmF0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5rbm93biBiaW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICBvcGVyYXRvciwgY29udmVydEFzdChhc3QubGVmdCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJpZ2h0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikge1xuICAgIC8vIFRPRE86IHNob3VsZCBjb250ZXh0IGV4cHJlc3Npb25zIGhhdmUgc291cmNlIG1hcHM/XG4gICAgcmV0dXJuIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgby5SZWFkS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBDaGFpbiBpbiB1bmtub3duIGNvbnRleHRgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxNYXApIHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmtleXMubWFwKChrZXksIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWVzW2lkeF07XG4gICAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nXG4gICAgICAvLyBleHByZXNzaW9uP1xuICAgICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXkua2V5LCBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwga2V5LnF1b3RlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsQXJyYXkpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nIGV4cHJlc3Npb24/XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Db25kaXRpb25hbCkge1xuICAgIHJldHVybiBuZXcgby5Db25kaXRpb25hbEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmNvbmRpdGlvbiwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnRydWVFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5mYWxzZUV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Ob25OdWxsQXNzZXJ0KSB7XG4gICAgLy8gQSBub24tbnVsbCBhc3NlcnRpb24gc2hvdWxkbid0IGltcGFjdCBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb25zLCBzbyB3ZSBjYW4ganVzdCBkcm9wIGl0LlxuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmRpbmdQaXBlKSB7XG4gICAgLy8gVE9ETzogcGlwZXMgc2hvdWxkIHByb2JhYmx5IGhhdmUgc291cmNlIG1hcHM7IGZpZ3VyZSBvdXQgZGV0YWlscy5cbiAgICByZXR1cm4gbmV3IGlyLlBpcGVCaW5kaW5nRXhwcihcbiAgICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksXG4gICAgICAgIG5ldyBpci5TbG90SGFuZGxlKCksXG4gICAgICAgIGFzdC5uYW1lLFxuICAgICAgICBbXG4gICAgICAgICAgY29udmVydEFzdChhc3QuZXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICAuLi5hc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgIF0sXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVLZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVLZXllZFJlYWRFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlUHJvcGVydHlSZWFkRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVDYWxsKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgYXN0LmFyZ3MubWFwKGEgPT4gY29udmVydEFzdChhLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuRW1wdHlFeHByKSB7XG4gICAgcmV0dXJuIG5ldyBpci5FbXB0eUV4cHIoY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5QcmVmaXhOb3QpIHtcbiAgICByZXR1cm4gby5ub3QoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGUgXCIke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfVwiIGluIGZpbGUgXCIke1xuICAgICAgICBiYXNlU291cmNlU3Bhbj8uc3RhcnQuZmlsZS51cmx9XCJgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXN0V2l0aEludGVycG9sYXRpb24oXG4gICAgam9iOiBDb21waWxhdGlvbkpvYiwgdmFsdWU6IGUuQVNUfHN0cmluZywgaTE4bk1ldGE6IGkxOG4uSTE4bk1ldGF8bnVsbHx1bmRlZmluZWQsXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChlID0+IGNvbnZlcnRBc3QoZSwgam9iLCBzb3VyY2VTcGFuID8/IG51bGwpKSxcbiAgICAgICAgT2JqZWN0LmtleXMoYXNNZXNzYWdlKGkxOG5NZXRhKT8ucGxhY2Vob2xkZXJzID8/IHt9KSk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVCkge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIHNvdXJjZVNwYW4gPz8gbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIGV4cHJlc3Npb247XG59XG5cbi8vIFRPRE86IENhbiB3ZSBwb3B1bGF0ZSBUZW1wbGF0ZSBiaW5kaW5nIGtpbmRzIGluIGluZ2VzdD9cbmNvbnN0IEJJTkRJTkdfS0lORFMgPSBuZXcgTWFwPGUuQmluZGluZ1R5cGUsIGlyLkJpbmRpbmdLaW5kPihbXG4gIFtlLkJpbmRpbmdUeXBlLlByb3BlcnR5LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlXSxcbiAgW2UuQmluZGluZ1R5cGUuQ2xhc3MsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZV0sXG4gIFtlLkJpbmRpbmdUeXBlLlN0eWxlLCBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQW5pbWF0aW9uLCBpci5CaW5kaW5nS2luZC5BbmltYXRpb25dLFxuXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHRlbXBsYXRlIGlzIGEgcGxhaW4gbmctdGVtcGxhdGUgKGFzIG9wcG9zZWQgdG8gYW5vdGhlciBraW5kIG9mIHRlbXBsYXRlXG4gKiBzdWNoIGFzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGUgb3IgY29udHJvbCBmbG93IHRlbXBsYXRlKS4gVGhpcyBpcyBjaGVja2VkIGJhc2VkIG9uIHRoZVxuICogdGFnTmFtZS4gV2UgY2FuIGV4cGVjdCB0aGF0IG9ubHkgcGxhaW4gbmctdGVtcGxhdGVzIHdpbGwgY29tZSB0aHJvdWdoIHdpdGggYSB0YWdOYW1lIG9mXG4gKiAnbmctdGVtcGxhdGUnLlxuICpcbiAqIEhlcmUgYXJlIHNvbWUgb2YgdGhlIGNhc2VzIHdlIGV4cGVjdDpcbiAqXG4gKiB8IEFuZ3VsYXIgSFRNTCAgICAgICAgICAgICAgICAgICAgICAgfCBUZW1wbGF0ZSB0YWdOYW1lICAgfFxuICogfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHwgLS0tLS0tLS0tLS0tLS0tLS0tIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8ZGl2ICpuZ0lmPVwidHJ1ZVwiPmAgICAgICAgICAgICAgICB8ICdkaXYnICAgICAgICAgICAgICB8XG4gKiB8IGA8c3ZnPjxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgfCAnc3ZnOm5nLXRlbXBsYXRlJyAgfFxuICogfCBgQGlmICh0cnVlKSB7YCAgICAgICAgICAgICAgICAgICAgIHwgJ0NvbmRpdGlvbmFsJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChwbGFpbikgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAoc3RydWN0dXJhbCkgfCBudWxsICAgICAgICAgICAgICAgfFxuICovXG5mdW5jdGlvbiBpc1BsYWluVGVtcGxhdGUodG1wbDogdC5UZW1wbGF0ZSkge1xuICByZXR1cm4gc3BsaXROc05hbWUodG1wbC50YWdOYW1lID8/ICcnKVsxXSA9PT0gTkdfVEVNUExBVEVfVEFHX05BTUU7XG59XG5cbi8qKlxuICogRW5zdXJlcyB0aGF0IHRoZSBpMThuTWV0YSwgaWYgcHJvdmlkZWQsIGlzIGFuIGkxOG4uTWVzc2FnZS5cbiAqL1xuZnVuY3Rpb24gYXNNZXNzYWdlKGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfG51bGx8dW5kZWZpbmVkKTogaTE4bi5NZXNzYWdlfG51bGwge1xuICBpZiAoaTE4bk1ldGEgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmICghKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSkge1xuICAgIHRocm93IEVycm9yKGBFeHBlY3RlZCBpMThuIG1ldGEgdG8gYmUgYSBNZXNzYWdlLCBidXQgZ290OiAke2kxOG5NZXRhLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIGkxOG5NZXRhO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnRCaW5kaW5ncyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGxldCBiaW5kaW5ncyA9IG5ldyBBcnJheTxpci5CaW5kaW5nT3B8aXIuRXh0cmFjdGVkQXR0cmlidXRlT3B8bnVsbD4oKTtcblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gQXR0cmlidXRlIGxpdGVyYWwgYmluZGluZ3MsIHN1Y2ggYXMgYGF0dHIuZm9vPVwiYmFyXCJgLlxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoZWxlbWVudC5uYW1lLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICBvcC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIGF0dHIubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhdHRyLnZhbHVlLCBhdHRyLmkxOG4pLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIHRydWUsXG4gICAgICAgIGZhbHNlLCBudWxsLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgLy8gQWxsIGR5bmFtaWMgYmluZGluZ3MgKGJvdGggYXR0cmlidXRlIGFuZCBwcm9wZXJ0eSBiaW5kaW5ncykuXG4gICAgYmluZGluZ3MucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICAgIG9wLnhyZWYsIEJJTkRJTkdfS0lORFMuZ2V0KGlucHV0LnR5cGUpISwgaW5wdXQubmFtZSxcbiAgICAgICAgY29udmVydEFzdFdpdGhJbnRlcnBvbGF0aW9uKHVuaXQuam9iLCBhc3RPZihpbnB1dC52YWx1ZSksIGlucHV0LmkxOG4pLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGlucHV0LmkxOG4pID8/IG51bGwsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHVuaXQuY3JlYXRlLnB1c2goYmluZGluZ3MuZmlsdGVyKFxuICAgICAgKGIpOiBiIGlzIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUpKTtcbiAgdW5pdC51cGRhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoKGIpOiBiIGlzIGlyLkJpbmRpbmdPcCA9PiBiPy5raW5kID09PSBpci5PcEtpbmQuQmluZGluZykpO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHModW5pdCwgb3V0cHV0LmhhbmRsZXIsIG91dHB1dC5oYW5kbGVyU3BhbiksIG91dHB1dC5waGFzZSxcbiAgICAgICAgb3V0cHV0LnRhcmdldCwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICAvLyBJZiBhbnkgb2YgdGhlIGJpbmRpbmdzIG9uIHRoaXMgZWxlbWVudCBoYXZlIGFuIGkxOG4gbWVzc2FnZSwgdGhlbiBhbiBpMThuIGF0dHJzIGNvbmZpZ3VyYXRpb25cbiAgLy8gb3AgaXMgYWxzbyByZXF1aXJlZC5cbiAgaWYgKGJpbmRpbmdzLnNvbWUoYiA9PiBiPy5pMThuTWVzc2FnZSkgIT09IG51bGwpIHtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICBpci5jcmVhdGVJMThuQXR0cmlidXRlc09wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG5ldyBpci5TbG90SGFuZGxlKCksIG9wLnhyZWYpKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUlxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlQmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIHRlbXBsYXRlOiB0LlRlbXBsYXRlLFxuICAgIHRlbXBsYXRlS2luZDogaXIuVGVtcGxhdGVLaW5kfG51bGwpOiB2b2lkIHtcbiAgbGV0IGJpbmRpbmdzID0gbmV3IEFycmF5PGlyLkJpbmRpbmdPcHxpci5FeHRyYWN0ZWRBdHRyaWJ1dGVPcHxudWxsPigpO1xuXG4gIGZvciAoY29uc3QgYXR0ciBvZiB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIGF0dHIubmFtZSwgdHJ1ZSk7XG4gICAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgdHJ1ZSwgdGVtcGxhdGVLaW5kLCBhc01lc3NhZ2UoYXR0ci5pMThuKSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIudHlwZSwgYXR0ci5uYW1lLCBhc3RPZihhdHRyLnZhbHVlKSwgYXR0ci51bml0LCBhdHRyLnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgdGVtcGxhdGUuYXR0cmlidXRlcykge1xuICAgIC8vIEF0dHJpYnV0ZSBsaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHQgPSBkb21TY2hlbWEuc2VjdXJpdHlDb250ZXh0KE5HX1RFTVBMQVRFX1RBR19OQU1FLCBhdHRyLm5hbWUsIHRydWUpO1xuICAgIGJpbmRpbmdzLnB1c2goY3JlYXRlVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBudWxsLCBzZWN1cml0eUNvbnRleHQsIGZhbHNlLFxuICAgICAgICB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShhdHRyLmkxOG4pLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgdGVtcGxhdGUuaW5wdXRzKSB7XG4gICAgLy8gRHluYW1pYyBiaW5kaW5ncyAoYm90aCBhdHRyaWJ1dGUgYW5kIHByb3BlcnR5IGJpbmRpbmdzKS5cbiAgICBiaW5kaW5ncy5wdXNoKGNyZWF0ZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQudHlwZSwgaW5wdXQubmFtZSwgYXN0T2YoaW5wdXQudmFsdWUpLCBpbnB1dC51bml0LFxuICAgICAgICBpbnB1dC5zZWN1cml0eUNvbnRleHQsIGZhbHNlLCB0ZW1wbGF0ZUtpbmQsIGFzTWVzc2FnZShpbnB1dC5pMThuKSwgaW5wdXQuc291cmNlU3BhbikpO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChiaW5kaW5ncy5maWx0ZXIoXG4gICAgICAoYik6IGIgaXMgaXIuRXh0cmFjdGVkQXR0cmlidXRlT3AgPT4gYj8ua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGJpbmRpbmdzLmZpbHRlcigoYik6IGIgaXMgaXIuQmluZGluZ09wID0+IGI/LmtpbmQgPT09IGlyLk9wS2luZC5CaW5kaW5nKSk7XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGVtcGxhdGUub3V0cHV0cykge1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uICYmIG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsXG4gICAgICAgICAgbWFrZUxpc3RlbmVySGFuZGxlck9wcyh1bml0LCBvdXRwdXQuaGFuZGxlciwgb3V0cHV0LmhhbmRsZXJTcGFuKSwgb3V0cHV0LnBoYXNlLFxuICAgICAgICAgIG91dHB1dC50YXJnZXQsIGZhbHNlLCBvdXRwdXQuc291cmNlU3BhbikpO1xuICAgIH1cbiAgICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbCAmJlxuICAgICAgICBvdXRwdXQudHlwZSAhPT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAvLyBBbmltYXRpb24gYmluZGluZ3MgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIHN0cnVjdHVyYWwgdGVtcGxhdGUncyBjb25zdCBhcnJheS5cbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dCA9IGRvbVNjaGVtYS5zZWN1cml0eUNvbnRleHQoTkdfVEVNUExBVEVfVEFHX05BTUUsIG91dHB1dC5uYW1lLCBmYWxzZSk7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgIG9wLnhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBvdXRwdXQubmFtZSwgbnVsbCwgbnVsbCwgbnVsbCwgc2VjdXJpdHlDb250ZXh0KSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETzogUGVyaGFwcyB3ZSBjb3VsZCBkbyB0aGlzIGluIGEgcGhhc2U/IChJdCBsaWtlbHkgd291bGRuJ3QgY2hhbmdlIHRoZSBzbG90IGluZGljZXMuKVxuICBpZiAoYmluZGluZ3Muc29tZShiID0+IGI/LmkxOG5NZXNzYWdlKSAhPT0gbnVsbCkge1xuICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5BdHRyaWJ1dGVzT3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgbmV3IGlyLlNsb3RIYW5kbGUoKSwgb3AueHJlZikpO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGluZ2VzdCBhbiBpbmRpdmlkdWFsIGJpbmRpbmcgb24gYSB0ZW1wbGF0ZSwgZWl0aGVyIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAsIG9yIGFuXG4gKiBpbXBsaWNpdCB0ZW1wbGF0ZSBjcmVhdGVkIHZpYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS5cbiAqXG4gKiBCaW5kaW5ncyBvbiB0ZW1wbGF0ZXMgYXJlICpleHRyZW1lbHkqIHRyaWNreS4gSSBoYXZlIHRyaWVkIHRvIGlzb2xhdGUgYWxsIG9mIHRoZSBjb25mdXNpbmcgZWRnZVxuICogY2FzZXMgaW50byB0aGlzIGZ1bmN0aW9uLCBhbmQgdG8gY29tbWVudCBpdCB3ZWxsIHRvIGRvY3VtZW50IHRoZSBiZWhhdmlvci5cbiAqXG4gKiBTb21lIG9mIHRoaXMgYmVoYXZpb3IgaXMgaW50dWl0aXZlbHkgaW5jb3JyZWN0LCBhbmQgd2Ugc2hvdWxkIGNvbnNpZGVyIGNoYW5naW5nIGl0IGluIHRoZSBmdXR1cmUuXG4gKlxuICogQHBhcmFtIHZpZXcgVGhlIGNvbXBpbGF0aW9uIHVuaXQgZm9yIHRoZSB2aWV3IGNvbnRhaW5pbmcgdGhlIHRlbXBsYXRlLlxuICogQHBhcmFtIHhyZWYgVGhlIHhyZWYgb2YgdGhlIHRlbXBsYXRlIG9wLlxuICogQHBhcmFtIHR5cGUgVGhlIGJpbmRpbmcgdHlwZSwgYWNjb3JkaW5nIHRvIHRoZSBwYXJzZXIuIFRoaXMgaXMgZmFpcmx5IHJlYXNvbmFibGUsIGUuZy4gYm90aFxuICogICAgIGR5bmFtaWMgYW5kIHN0YXRpYyBhdHRyaWJ1dGVzIGhhdmUgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUuXG4gKiBAcGFyYW0gbmFtZSBUaGUgYmluZGluZydzIG5hbWUuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGJpbmRpbmdzJ3MgdmFsdWUsIHdoaWNoIHdpbGwgZWl0aGVyIGJlIGFuIGlucHV0IEFTVCBleHByZXNzaW9uLCBvciBhIHN0cmluZ1xuICogICAgIGxpdGVyYWwuIE5vdGUgdGhhdCB0aGUgaW5wdXQgQVNUIGV4cHJlc3Npb24gbWF5IG9yIG1heSBub3QgYmUgY29uc3QgLS0gaXQgd2lsbCBvbmx5IGJlIGFcbiAqICAgICBzdHJpbmcgbGl0ZXJhbCBpZiB0aGUgcGFyc2VyIGNvbnNpZGVyZWQgaXQgYSB0ZXh0IGJpbmRpbmcuXG4gKiBAcGFyYW0gdW5pdCBJZiB0aGUgYmluZGluZyBoYXMgYSB1bml0IChlLmcuIGBweGAgZm9yIHN0eWxlIGJpbmRpbmdzKSwgdGhlbiB0aGlzIGlzIHRoZSB1bml0LlxuICogQHBhcmFtIHNlY3VyaXR5Q29udGV4dCBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAqIEBwYXJhbSBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSBXaGV0aGVyIHRoaXMgYmluZGluZyBhY3R1YWxseSBhcHBsaWVzIHRvIHRoZSBzdHJ1Y3R1cmFsXG4gKiAgICAgbmctdGVtcGxhdGUuIEZvciBleGFtcGxlLCBhbiBgbmdGb3JgIHdvdWxkIGFjdHVhbGx5IGFwcGx5IHRvIHRoZSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiAoTW9zdFxuICogICAgIGJpbmRpbmdzIG9uIHN0cnVjdHVyYWwgZWxlbWVudHMgdGFyZ2V0IHRoZSBpbm5lciBlbGVtZW50LCBub3QgdGhlIHRlbXBsYXRlLilcbiAqIEBwYXJhbSB0ZW1wbGF0ZUtpbmQgV2hldGhlciB0aGlzIGlzIGFuIGV4cGxpY2l0IGBuZy10ZW1wbGF0ZWAgb3IgYW4gaW1wbGljaXQgdGVtcGxhdGUgY3JlYXRlZCBieVxuICogICAgIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUuIFRoaXMgc2hvdWxkIG5ldmVyIGJlIGEgYmxvY2sgdGVtcGxhdGUuXG4gKiBAcGFyYW0gaTE4bk1lc3NhZ2UgVGhlIGkxOG4gbWV0YWRhdGEgZm9yIHRoZSBiaW5kaW5nLCBpZiBhbnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBUaGUgc291cmNlIHNwYW4gb2YgdGhlIGJpbmRpbmcuXG4gKiBAcmV0dXJucyBBbiBJUiBiaW5kaW5nIG9wLCBvciBudWxsIGlmIHRoZSBiaW5kaW5nIHNob3VsZCBiZSBza2lwcGVkLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLCB0eXBlOiBlLkJpbmRpbmdUeXBlLCBuYW1lOiBzdHJpbmcsXG4gICAgdmFsdWU6IGUuQVNUfHN0cmluZywgdW5pdDogc3RyaW5nfG51bGwsIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuLCB0ZW1wbGF0ZUtpbmQ6IGlyLlRlbXBsYXRlS2luZHxudWxsLFxuICAgIGkxOG5NZXNzYWdlOiBpMThuLk1lc3NhZ2V8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQmluZGluZ09wfFxuICAgIGlyLkV4dHJhY3RlZEF0dHJpYnV0ZU9wfG51bGwge1xuICBjb25zdCBpc1RleHRCaW5kaW5nID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbiAgLy8gSWYgdGhpcyBpcyBhIHN0cnVjdHVyYWwgdGVtcGxhdGUsIHRoZW4gc2V2ZXJhbCBraW5kcyBvZiBiaW5kaW5ncyBzaG91bGQgbm90IHJlc3VsdCBpbiBhblxuICAvLyB1cGRhdGUgaW5zdHJ1Y3Rpb24uXG4gIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsKSB7XG4gICAgaWYgKCFpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSAmJlxuICAgICAgICAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eSB8fCB0eXBlID09PSBlLkJpbmRpbmdUeXBlLkNsYXNzIHx8XG4gICAgICAgICB0eXBlID09PSBlLkJpbmRpbmdUeXBlLlN0eWxlKSkge1xuICAgICAgLy8gQmVjYXVzZSB0aGlzIGJpbmRpbmcgZG9lc24ndCByZWFsbHkgdGFyZ2V0IHRoZSBuZy10ZW1wbGF0ZSwgaXQgbXVzdCBiZSBhIGJpbmRpbmcgb24gYW5cbiAgICAgIC8vIGlubmVyIG5vZGUgb2YgYSBzdHJ1Y3R1cmFsIHRlbXBsYXRlLiBXZSBjYW4ndCBza2lwIGl0IGVudGlyZWx5LCBiZWNhdXNlIHdlIHN0aWxsIG5lZWQgaXQgb25cbiAgICAgIC8vIHRoZSBuZy10ZW1wbGF0ZSdzIGNvbnN0cyAoZS5nLiBmb3IgdGhlIHB1cnBvc2VzIG9mIGRpcmVjdGl2ZSBtYXRjaGluZykuIEhvd2V2ZXIsIHdlIHNob3VsZFxuICAgICAgLy8gbm90IGdlbmVyYXRlIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgaXQuXG4gICAgICByZXR1cm4gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgeHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIG5hbWUsIG51bGwsIG51bGwsIGkxOG5NZXNzYWdlLCBzZWN1cml0eUNvbnRleHQpO1xuICAgIH1cblxuICAgIGlmICghaXNUZXh0QmluZGluZyAmJiAodHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUgfHwgdHlwZSA9PT0gZS5CaW5kaW5nVHlwZS5BbmltYXRpb24pKSB7XG4gICAgICAvLyBBZ2FpbiwgdGhpcyBiaW5kaW5nIGRvZXNuJ3QgcmVhbGx5IHRhcmdldCB0aGUgbmctdGVtcGxhdGU7IGl0IGFjdHVhbGx5IHRhcmdldHMgdGhlIGVsZW1lbnRcbiAgICAgIC8vIGluc2lkZSB0aGUgc3RydWN0dXJhbCB0ZW1wbGF0ZS4gSW4gdGhlIGNhc2Ugb2Ygbm9uLXRleHQgYXR0cmlidXRlIG9yIGFuaW1hdGlvbiBiaW5kaW5ncyxcbiAgICAgIC8vIHRoZSBiaW5kaW5nIGRvZXNuJ3QgZXZlbiBzaG93IHVwIG9uIHRoZSBuZy10ZW1wbGF0ZSBjb25zdCBhcnJheSwgc28gd2UganVzdCBza2lwIGl0XG4gICAgICAvLyBlbnRpcmVseS5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGxldCBiaW5kaW5nVHlwZSA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcblxuICBpZiAodGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuTmdUZW1wbGF0ZSkge1xuICAgIC8vIFdlIGtub3cgd2UgYXJlIGRlYWxpbmcgd2l0aCBiaW5kaW5ncyBkaXJlY3RseSBvbiBhbiBleHBsaWNpdCBuZy10ZW1wbGF0ZS5cbiAgICAvLyBTdGF0aWMgYXR0cmlidXRlIGJpbmRpbmdzIHNob3VsZCBiZSBjb2xsZWN0ZWQgaW50byB0aGUgY29uc3QgYXJyYXkgYXMgay92IHBhaXJzLiBQcm9wZXJ0eVxuICAgIC8vIGJpbmRpbmdzIHNob3VsZCByZXN1bHQgaW4gYSBgcHJvcGVydHlgIGluc3RydWN0aW9uLCBhbmQgYEF0dHJpYnV0ZU1hcmtlci5CaW5kaW5nc2AgY29uc3RcbiAgICAvLyBlbnRyaWVzLlxuICAgIC8vXG4gICAgLy8gVGhlIGRpZmZpY3VsdHkgaXMgd2l0aCBkeW5hbWljIGF0dHJpYnV0ZSwgc3R5bGUsIGFuZCBjbGFzcyBiaW5kaW5ncy4gVGhlc2UgZG9uJ3QgcmVhbGx5IG1ha2VcbiAgICAvLyBzZW5zZSBvbiBhbiBgbmctdGVtcGxhdGVgIGFuZCBzaG91bGQgcHJvYmFibHkgYmUgcGFyc2VyIGVycm9ycy4gSG93ZXZlcixcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGdlbmVyYXRlcyBgcHJvcGVydHlgIGluc3RydWN0aW9ucyBmb3IgdGhlbSwgYW5kIHNvIHdlIGRvIHRoYXQgYXNcbiAgICAvLyB3ZWxsLlxuICAgIC8vXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIGhhdmUgYSBzbGlnaHQgYmVoYXZpb3IgZGlmZmVyZW5jZSB3aXRoIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI6IGFsdGhvdWdoXG4gICAgLy8gVERCIGVtaXRzIGBwcm9wZXJ0eWAgaW5zdHJ1Y3Rpb25zIGZvciBkeW5hbWljIGF0dHJpYnV0ZXMsIHN0eWxlcywgYW5kIGNsYXNzZXMsIG9ubHkgc3R5bGVzXG4gICAgLy8gYW5kIGNsYXNzZXMgYWxzbyBnZXQgY29uc3QgY29sbGVjdGVkIGludG8gdGhlIGBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3NgIGZpZWxkLiBEeW5hbWljXG4gICAgLy8gYXR0cmlidXRlIGJpbmRpbmdzIGFyZSBtaXNzaW5nIGZyb20gdGhlIGNvbnN0cyBlbnRpcmVseS4gV2UgY2hvb3NlIHRvIGVtaXQgdGhlbSBpbnRvIHRoZVxuICAgIC8vIGNvbnN0cyBmaWVsZCBhbnl3YXksIHRvIGF2b2lkIGNyZWF0aW5nIHNwZWNpYWwgY2FzZXMgZm9yIHNvbWV0aGluZyBzbyBhcmNhbmUgYW5kIG5vbnNlbnNpY2FsLlxuICAgIGlmICh0eXBlID09PSBlLkJpbmRpbmdUeXBlLkNsYXNzIHx8IHR5cGUgPT09IGUuQmluZGluZ1R5cGUuU3R5bGUgfHxcbiAgICAgICAgKHR5cGUgPT09IGUuQmluZGluZ1R5cGUuQXR0cmlidXRlICYmICFpc1RleHRCaW5kaW5nKSkge1xuICAgICAgLy8gVE9ETzogVGhlc2UgY2FzZXMgc2hvdWxkIGJlIHBhcnNlIGVycm9ycy5cbiAgICAgIGJpbmRpbmdUeXBlID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIHhyZWYsIGJpbmRpbmdUeXBlLCBuYW1lLCBjb252ZXJ0QXN0V2l0aEludGVycG9sYXRpb24odmlldy5qb2IsIHZhbHVlLCBpMThuTWVzc2FnZSksIHVuaXQsXG4gICAgICBzZWN1cml0eUNvbnRleHQsIGlzVGV4dEJpbmRpbmcsIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLCB0ZW1wbGF0ZUtpbmQsIGkxOG5NZXNzYWdlLFxuICAgICAgc291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIG1ha2VMaXN0ZW5lckhhbmRsZXJPcHMoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBoYW5kbGVyOiBlLkFTVCwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wW10ge1xuICBoYW5kbGVyID0gYXN0T2YoaGFuZGxlcik7XG4gIGNvbnN0IGhhbmRsZXJPcHMgPSBuZXcgQXJyYXk8aXIuVXBkYXRlT3A+KCk7XG4gIGxldCBoYW5kbGVyRXhwcnM6IGUuQVNUW10gPSBoYW5kbGVyIGluc3RhbmNlb2YgZS5DaGFpbiA/IGhhbmRsZXIuZXhwcmVzc2lvbnMgOiBbaGFuZGxlcl07XG4gIGlmIChoYW5kbGVyRXhwcnMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gIH1cbiAgY29uc3QgZXhwcmVzc2lvbnMgPSBoYW5kbGVyRXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgaGFuZGxlclNwYW4pKTtcbiAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcbiAgaGFuZGxlck9wcy5wdXNoKC4uLmV4cHJlc3Npb25zLm1hcChcbiAgICAgIGUgPT4gaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZSwgZS5zb3VyY2VTcGFuKSkpKTtcbiAgaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChyZXR1cm5FeHByLCByZXR1cm5FeHByLnNvdXJjZVNwYW4pKSk7XG4gIHJldHVybiBoYW5kbGVyT3BzO1xufVxuXG5mdW5jdGlvbiBhc3RPZihhc3Q6IGUuQVNUfGUuQVNUV2l0aFNvdXJjZSk6IGUuQVNUIHtcbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSA/IGFzdC5hc3QgOiBhc3Q7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICAgIHNwYW46IGUuUGFyc2VTcGFuLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gIGlmIChiYXNlU291cmNlU3BhbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICBjb25zdCBlbmQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICBjb25zdCBmdWxsU3RhcnQgPSBiYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kLCBmdWxsU3RhcnQpO1xufVxuXG4vKipcbiAqIFdpdGggdGhlIGRpcmVjdGl2ZS1iYXNlZCBjb250cm9sIGZsb3cgdXNlcnMgd2VyZSBhYmxlIHRvIGNvbmRpdGlvbmFsbHkgcHJvamVjdCBjb250ZW50IHVzaW5nXG4gKiB0aGUgYCpgIHN5bnRheC4gRS5nLiBgPGRpdiAqbmdJZj1cImV4cHJcIiBwcm9qZWN0TWU+PC9kaXY+YCB3aWxsIGJlIHByb2plY3RlZCBpbnRvXG4gKiBgPG5nLWNvbnRlbnQgc2VsZWN0PVwiW3Byb2plY3RNZV1cIi8+YCwgYmVjYXVzZSB0aGUgYXR0cmlidXRlcyBhbmQgdGFnIG5hbWUgZnJvbSB0aGUgYGRpdmAgYXJlXG4gKiBjb3BpZWQgdG8gdGhlIHRlbXBsYXRlIHZpYSB0aGUgdGVtcGxhdGUgY3JlYXRpb24gaW5zdHJ1Y3Rpb24uIFdpdGggYEBpZmAgYW5kIGBAZm9yYCB0aGF0IGlzXG4gKiBub3QgdGhlIGNhc2UsIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsIGlzIHBsYWNlZCAqYXJvdW5kKiBlbGVtZW50cywgcmF0aGVyIHRoYW4gKm9uKiB0aGVtLlxuICogVGhlIHJlc3VsdCBpcyB0aGF0IGNvbnRlbnQgcHJvamVjdGlvbiB3b24ndCB3b3JrIGluIHRoZSBzYW1lIHdheSBpZiBhIHVzZXIgY29udmVydHMgZnJvbVxuICogYCpuZ0lmYCB0byBgQGlmYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFpbXMgdG8gY292ZXIgdGhlIG1vc3QgY29tbW9uIGNhc2UgYnkgZG9pbmcgdGhlIHNhbWUgY29weWluZyB3aGVuIGEgY29udHJvbCBmbG93XG4gKiBub2RlIGhhcyAqb25lIGFuZCBvbmx5IG9uZSogcm9vdCBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUuXG4gKlxuICogVGhpcyBhcHByb2FjaCBjb21lcyB3aXRoIHNvbWUgY2F2ZWF0czpcbiAqIDEuIEFzIHNvb24gYXMgYW55IG90aGVyIG5vZGUgaXMgYWRkZWQgdG8gdGhlIHJvb3QsIHRoZSBjb3B5aW5nIGJlaGF2aW9yIHdvbid0IHdvcmsgYW55bW9yZS5cbiAqICAgIEEgZGlhZ25vc3RpYyB3aWxsIGJlIGFkZGVkIHRvIGZsYWcgY2FzZXMgbGlrZSB0aGlzIGFuZCB0byBleHBsYWluIGhvdyB0byB3b3JrIGFyb3VuZCBpdC5cbiAqIDIuIElmIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzYCBpcyBlbmFibGVkLCBpdCdzIHZlcnkgbGlrZWx5IHRoYXQgaW5kZW50YXRpb24gd2lsbCBicmVhayB0aGlzXG4gKiAgICB3b3JrYXJvdW5kLCBiZWNhdXNlIGl0J2xsIGluY2x1ZGUgYW4gYWRkaXRpb25hbCB0ZXh0IG5vZGUgYXMgdGhlIGZpcnN0IGNoaWxkLiBXZSBjYW4gd29ya1xuICogICAgYXJvdW5kIGl0IGhlcmUsIGJ1dCBpbiBhIGRpc2N1c3Npb24gaXQgd2FzIGRlY2lkZWQgbm90IHRvLCBiZWNhdXNlIHRoZSB1c2VyIGV4cGxpY2l0bHkgb3B0ZWRcbiAqICAgIGludG8gcHJlc2VydmluZyB0aGUgd2hpdGVzcGFjZSBhbmQgd2Ugd291bGQgaGF2ZSB0byBkcm9wIGl0IGZyb20gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICogICAgVGhlIGRpYWdub3N0aWMgbWVudGlvbmVkIHBvaW50ICMxIHdpbGwgZmxhZyBzdWNoIGNhc2VzIHRvIHVzZXJzLlxuICpcbiAqIEByZXR1cm5zIFRhZyBuYW1lIHRvIGJlIHVzZWQgZm9yIHRoZSBjb250cm9sIGZsb3cgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLCBub2RlOiB0LklmQmxvY2tCcmFuY2h8dC5Gb3JMb29wQmxvY2spOiBzdHJpbmd8bnVsbCB7XG4gIGxldCByb290OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZXxudWxsID0gbnVsbDtcblxuICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAvLyBTa2lwIG92ZXIgY29tbWVudCBub2Rlcy5cbiAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiB0LkNvbW1lbnQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFdlIGNhbiBvbmx5IGluZmVyIHRoZSB0YWcgbmFtZS9hdHRyaWJ1dGVzIGlmIHRoZXJlJ3MgYSBzaW5nbGUgcm9vdCBub2RlLlxuICAgIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBSb290IG5vZGVzIGNhbiBvbmx5IGVsZW1lbnRzIG9yIHRlbXBsYXRlcyB3aXRoIGEgdGFnIG5hbWUgKGUuZy4gYDxkaXYgKmZvbz48L2Rpdj5gKS5cbiAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiB0LkVsZW1lbnQgfHwgKGNoaWxkIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBjaGlsZC50YWdOYW1lICE9PSBudWxsKSkge1xuICAgICAgcm9vdCA9IGNoaWxkO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIHdlJ3ZlIGZvdW5kIGEgc2luZ2xlIHJvb3Qgbm9kZSwgaXRzIHRhZyBuYW1lIGFuZCAqc3RhdGljKiBhdHRyaWJ1dGVzIGNhbiBiZSBjb3BpZWRcbiAgLy8gdG8gdGhlIHN1cnJvdW5kaW5nIHRlbXBsYXRlIHRvIGJlIHVzZWQgZm9yIGNvbnRlbnQgcHJvamVjdGlvbi4gTm90ZSB0aGF0IGl0J3MgaW1wb3J0YW50XG4gIC8vIHRoYXQgd2UgZG9uJ3QgY29weSBhbnkgYm91bmQgYXR0cmlidXRlcyBzaW5jZSB0aGV5IGRvbid0IHBhcnRpY2lwYXRlIGluIGNvbnRlbnQgcHJvamVjdGlvblxuICAvLyBhbmQgdGhleSBjYW4gYmUgdXNlZCBpbiBkaXJlY3RpdmUgbWF0Y2hpbmcgKGluIHRoZSBjYXNlIG9mIGBUZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzYCkuXG4gIGlmIChyb290ICE9PSBudWxsKSB7XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIHJvb3QuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0ID0gZG9tU2NoZW1hLnNlY3VyaXR5Q29udGV4dChOR19URU1QTEFURV9UQUdfTkFNRSwgYXR0ci5uYW1lLCB0cnVlKTtcbiAgICAgIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgICAgIHhyZWYsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIG51bGwsIHNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICB0cnVlLCBmYWxzZSwgbnVsbCwgYXNNZXNzYWdlKGF0dHIuaTE4biksIGF0dHIuc291cmNlU3BhbikpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSByb290IGluc3RhbmNlb2YgdC5FbGVtZW50ID8gcm9vdC5uYW1lIDogcm9vdC50YWdOYW1lO1xuXG4gICAgLy8gRG9uJ3QgcGFzcyBhbG9uZyBgbmctdGVtcGxhdGVgIHRhZyBuYW1lIHNpbmNlIGl0IGVuYWJsZXMgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIHJldHVybiB0YWdOYW1lID09PSBOR19URU1QTEFURV9UQUdfTkFNRSA/IG51bGwgOiB0YWdOYW1lO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG4iXX0=