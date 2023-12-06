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
        .NONE /* TODO: what should we pass as security context? Passing NONE for now. */, isTextAttribute, false, /* TODO: How do Host bindings handle i18n attrs? */ null, property.sourceSpan));
}
export function ingestHostAttribute(job, name, value) {
    const attrBinding = ir.createBindingOp(job.root.xref, ir.BindingKind.Attribute, name, value, null, SecurityContext.NONE, true, false, 
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
    ingestBindings(unit, startOp, element);
    ingestReferences(startOp, element);
    ingestNodes(unit, element.children);
    // The source span for the end op is typically the element closing tag. However, if no closing tag
    // exists, such as in `<input>`, we use the start source span instead. Usually the start and end
    // instructions will be collapsed into one `element` instruction, negating the purpose of this
    // fallback, but in cases when it is not collapsed (such as an input with a binding), we still
    // want to map the end instruction to the main element.
    const endOp = ir.createElementEndOp(id, element.endSourceSpan ?? element.startSourceSpan);
    unit.create.push(endOp);
    // If there is an i18n message associated with this element, insert i18n start and end ops.
    if (element.i18n instanceof i18n.Message) {
        const i18nBlockId = unit.job.allocateXrefId();
        ir.OpList.insertAfter(ir.createI18nStartOp(i18nBlockId, element.i18n), startOp);
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
    const tplOp = ir.createTemplateOp(childView.xref, templateKind, tagNameWithoutNamespace, functionNameSuffix, namespace, i18nPlaceholder, tmpl.startSourceSpan);
    unit.create.push(tplOp);
    ingestBindings(unit, tplOp, tmpl);
    ingestReferences(tplOp, tmpl);
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
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue, attr.i18n);
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
        const tmplOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, tagName, 'Conditional', ir.Namespace.HTML, undefined /* TODO: figure out how i18n works with new control flow */, ifCase.sourceSpan);
        unit.create.push(tmplOp);
        if (firstXref === null) {
            firstXref = cView.xref;
            firstSlotHandle = tmplOp.handle;
        }
        const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, tmplOp.xref, tmplOp.handle, ifCase.expressionAlias);
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
        const tmplOp = ir.createTemplateOp(cView.xref, ir.TemplateKind.Block, null, 'Case', ir.Namespace.HTML, undefined /* TODO: figure out how i18n works with new control flow */, switchCase.sourceSpan);
        unit.create.push(tmplOp);
        if (firstXref === null) {
            firstXref = cView.xref;
            firstSlotHandle = tmplOp.handle;
        }
        const caseExpr = switchCase.expression ?
            convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan) :
            null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, tmplOp.xref, tmplOp.handle);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, switchCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, firstSlotHandle, convertAst(switchBlock.expression, unit.job, null), conditions, switchBlock.sourceSpan);
    unit.update.push(conditional);
}
function ingestDeferView(unit, suffix, children, sourceSpan) {
    if (children === undefined) {
        return null;
    }
    const secondaryView = unit.job.allocateView(unit.xref);
    ingestNodes(secondaryView, children);
    const templateOp = ir.createTemplateOp(secondaryView.xref, ir.TemplateKind.Block, null, `Defer${suffix}`, ir.Namespace.HTML, undefined, sourceSpan);
    unit.create.push(templateOp);
    return templateOp;
}
function ingestDeferBlock(unit, deferBlock) {
    const blockMeta = unit.job.deferBlocksMeta.get(deferBlock);
    if (blockMeta === undefined) {
        throw new Error(`AssertionError: unable to find metadata for deferred block`);
    }
    // Generate the defer main view and all secondary views.
    const main = ingestDeferView(unit, '', deferBlock.children, deferBlock.sourceSpan);
    const loading = ingestDeferView(unit, 'Loading', deferBlock.loading?.children, deferBlock.loading?.sourceSpan);
    const placeholder = ingestDeferView(unit, 'Placeholder', deferBlock.placeholder?.children, deferBlock.placeholder?.sourceSpan);
    const error = ingestDeferView(unit, 'Error', deferBlock.error?.children, deferBlock.error?.sourceSpan);
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
    const tagName = ingestControlFlowInsertionPoint(unit, repeaterView.xref, forBlock);
    const repeaterCreate = ir.createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, tagName, track, varNames, forBlock.sourceSpan);
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
        throw new Error('TODO: Support unary operations, which extend binary ops');
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
function ingestBindings(unit, op, element) {
    let flags = BindingFlags.None;
    let hasI18nAttributes = false;
    if (element instanceof t.Template) {
        flags |= BindingFlags.OnNgTemplateElement;
        if (element instanceof t.Template && isPlainTemplate(element)) {
            flags |= BindingFlags.BindingTargetsTemplate;
        }
        const templateAttrFlags = flags | BindingFlags.BindingTargetsTemplate | BindingFlags.IsStructuralTemplateAttribute;
        for (const attr of element.templateAttrs) {
            if (attr instanceof t.TextAttribute) {
                ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, templateAttrFlags | BindingFlags.TextValue, attr.i18n);
                hasI18nAttributes ||= attr.i18n !== undefined;
            }
            else {
                ingestBinding(unit, op.xref, attr.name, attr.value, attr.type, attr.unit, attr.securityContext, attr.sourceSpan, templateAttrFlags, attr.i18n);
                hasI18nAttributes ||= attr.i18n !== undefined;
            }
        }
    }
    for (const attr of element.attributes) {
        // This is only attribute TextLiteral bindings, such as `attr.foo="bar"`. This can never be
        // `[attr.foo]="bar"` or `attr.foo="{{bar}}"`, both of which will be handled as inputs with
        // `BindingType.Attribute`.
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, flags | BindingFlags.TextValue, attr.i18n);
        hasI18nAttributes ||= attr.i18n !== undefined;
    }
    for (const input of element.inputs) {
        ingestBinding(unit, op.xref, input.name, input.value, input.type, input.unit, input.securityContext, input.sourceSpan, flags, input.i18n);
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
            unit.create.push(ir.createExtractedAttributeOp(op.xref, ir.BindingKind.Property, output.name, null, null));
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
function ingestBinding(view, xref, name, value, type, unit, securityContext, sourceSpan, flags, i18nMeta) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    let i18nContext = null;
    if (i18nMeta !== undefined) {
        if (!(i18nMeta instanceof i18n.Message)) {
            throw Error(`Unhandled i18n metadata type for binding: ${i18nMeta.constructor.name}`);
        }
        i18nContext = view.job.allocateXrefId();
        view.create.push(ir.createI18nContextOp(ir.I18nContextKind.Attr, i18nContext, null, i18nMeta, null));
    }
    if (flags & BindingFlags.OnNgTemplateElement && !(flags & BindingFlags.BindingTargetsTemplate) &&
        type === 0 /* e.BindingType.Property */) {
        // This binding only exists for later const extraction, and is not an actual binding to be
        // created.
        view.create.push(ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, name, null, i18nContext));
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
    const kind = BINDING_KINDS.get(type);
    view.update.push(ir.createBindingOp(xref, kind, name, expression, unit, securityContext, !!(flags & BindingFlags.TextValue), !!(flags & BindingFlags.IsStructuralTemplateAttribute), i18nContext, sourceSpan));
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
            ingestBinding(unit, xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue, attr.i18n);
        }
        const tagName = root instanceof t.Element ? root.name : root.tagName;
        // Don't pass along `ng-template` tag name since it enables directive matching.
        return tagName === 'ng-template' ? null : tagName;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBRXBGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBZ0QsTUFBTSxlQUFlLENBQUM7QUFDaEksT0FBTyxFQUFDLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVwRixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQztBQUV6RTs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FDM0IsYUFBcUIsRUFBRSxRQUFrQixFQUFFLFlBQTBCLEVBQ3JFLHVCQUErQixFQUFFLGtCQUEyQixFQUM1RCxlQUEyRDtJQUM3RCxNQUFNLEdBQUcsR0FBRyxJQUFJLHVCQUF1QixDQUNuQyxhQUFhLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixF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Q3hGLDBGQUEwRjtJQUMxRiw2RkFBNkY7SUFDN0Ysd0ZBQXdGO0lBQ3hGLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ2xCLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ25DLGFBQWEsQ0FDVCxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLG1DQUEyQixJQUFJLEVBQzNFLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRixDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFckUsK0VBQStFO1FBQy9FLE9BQU8sT0FBTyxLQUFLLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDcEQsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBlIGZyb20gJy4uLy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7UjNEZWZlckJsb2NrTWV0YWRhdGF9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtpY3VGcm9tSTE4bk1lc3NhZ2UsIGlzU2luZ2xlSTE4bkljdX0gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy92aWV3L2kxOG4vdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5pbXBvcnQge0JJTkFSWV9PUEVSQVRPUlMsIG5hbWVzcGFjZUZvcktleSwgcHJlZml4V2l0aE5hbWVzcGFjZX0gZnJvbSAnLi9jb252ZXJzaW9uJztcblxuY29uc3QgY29tcGF0aWJpbGl0eU1vZGUgPSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyO1xuXG4vKipcbiAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBDb21wb25lbnRDb21waWxhdGlvbmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKiBUT0RPOiBSZWZhY3RvciBtb3JlIG9mIHRoZSBpbmdlc3Rpb24gY29kZSBpbnRvIHBoYXNlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdENvbXBvbmVudChcbiAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHRlbXBsYXRlOiB0Lk5vZGVbXSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZywgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuLFxuICAgIGRlZmVyQmxvY2tzTWV0YTogTWFwPHQuRGVmZXJyZWRCbG9jaywgUjNEZWZlckJsb2NrTWV0YWRhdGE+KTogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IoXG4gICAgICBjb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgaTE4blVzZUV4dGVybmFsSWRzLFxuICAgICAgZGVmZXJCbG9ja3NNZXRhKTtcbiAgaW5nZXN0Tm9kZXMoam9iLnJvb3QsIHRlbXBsYXRlKTtcbiAgcmV0dXJuIGpvYjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb3N0QmluZGluZ0lucHV0IHtcbiAgY29tcG9uZW50TmFtZTogc3RyaW5nO1xuICBwcm9wZXJ0aWVzOiBlLlBhcnNlZFByb3BlcnR5W118bnVsbDtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGV2ZW50czogZS5QYXJzZWRFdmVudFtdfG51bGw7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIGhvc3QgYmluZGluZyBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgIGlucHV0OiBIb3N0QmluZGluZ0lucHV0LCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGpvYiA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKGlucHV0LmNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUpO1xuICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIGlucHV0LnByb3BlcnRpZXMgPz8gW10pIHtcbiAgICBpbmdlc3RIb3N0UHJvcGVydHkoam9iLCBwcm9wZXJ0eSwgZmFsc2UpO1xuICB9XG4gIGZvciAoY29uc3QgW25hbWUsIGV4cHJdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0LmF0dHJpYnV0ZXMpID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEF0dHJpYnV0ZShqb2IsIG5hbWUsIGV4cHIpO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgaW5wdXQuZXZlbnRzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEV2ZW50KGpvYiwgZXZlbnQpO1xuICB9XG4gIHJldHVybiBqb2I7XG59XG5cbi8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciB0aGUgcGFyc2VyIHRvIHVzZSB0aGUgc2FtZSB0eXBlcyBhbmQgc3RydWN0dXJlcyBmb3IgaG9zdCBiaW5kaW5ncyBhc1xuLy8gd2l0aCBvcmRpbmFyeSBjb21wb25lbnRzLiBUaGlzIHdvdWxkIGFsbG93IHVzIHRvIHNoYXJlIGEgbG90IG1vcmUgaW5nZXN0aW9uIGNvZGUuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdFByb3BlcnR5KFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgcHJvcGVydHk6IGUuUGFyc2VkUHJvcGVydHksIGlzVGV4dEF0dHJpYnV0ZTogYm9vbGVhbik6IHZvaWQge1xuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGNvbnN0IGFzdCA9IHByb3BlcnR5LmV4cHJlc3Npb24uYXN0O1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgZXhwcmVzc2lvbiA9IG5ldyBpci5JbnRlcnBvbGF0aW9uKFxuICAgICAgICBhc3Quc3RyaW5ncywgYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSksIFtdKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdChhc3QsIGpvYiwgcHJvcGVydHkuc291cmNlU3Bhbik7XG4gIH1cbiAgbGV0IGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gIC8vIFRPRE86IHRoaXMgc2hvdWxkIHJlYWxseSBiZSBoYW5kbGVkIGluIHRoZSBwYXJzZXIuXG4gIGlmIChwcm9wZXJ0eS5uYW1lLnN0YXJ0c1dpdGgoJ2F0dHIuJykpIHtcbiAgICBwcm9wZXJ0eS5uYW1lID0gcHJvcGVydHkubmFtZS5zdWJzdHJpbmcoJ2F0dHIuJy5sZW5ndGgpO1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlO1xuICB9XG4gIGlmIChwcm9wZXJ0eS5pc0FuaW1hdGlvbikge1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uO1xuICB9XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGJpbmRpbmdLaW5kLCBwcm9wZXJ0eS5uYW1lLCBleHByZXNzaW9uLCBudWxsLFxuICAgICAgU2VjdXJpdHlDb250ZXh0XG4gICAgICAgICAgLk5PTkUgLyogVE9ETzogd2hhdCBzaG91bGQgd2UgcGFzcyBhcyBzZWN1cml0eSBjb250ZXh0PyBQYXNzaW5nIE5PTkUgZm9yIG5vdy4gKi8sXG4gICAgICBpc1RleHRBdHRyaWJ1dGUsIGZhbHNlLCAvKiBUT0RPOiBIb3cgZG8gSG9zdCBiaW5kaW5ncyBoYW5kbGUgaTE4biBhdHRycz8gKi8gbnVsbCxcbiAgICAgIHByb3BlcnR5LnNvdXJjZVNwYW4pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RBdHRyaWJ1dGUoXG4gICAgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgY29uc3QgYXR0ckJpbmRpbmcgPSBpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsIG5hbWUsIHZhbHVlLCBudWxsLCBTZWN1cml0eUNvbnRleHQuTk9ORSwgdHJ1ZSwgZmFsc2UsXG4gICAgICAvKiBUT0RPICovIG51bGwsXG4gICAgICAvKiBUT0RPOiBob3N0IGF0dHJpYnV0ZSBzb3VyY2Ugc3BhbnMgKi8gbnVsbCEpO1xuICBqb2Iucm9vdC51cGRhdGUucHVzaChhdHRyQmluZGluZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0RXZlbnQoam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBldmVudDogZS5QYXJzZWRFdmVudCkge1xuICBjb25zdCBldmVudEJpbmRpbmcgPSBpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgam9iLnJvb3QueHJlZiwgbmV3IGlyLlNsb3RIYW5kbGUoKSwgZXZlbnQubmFtZSwgbnVsbCwgZXZlbnQudGFyZ2V0T3JQaGFzZSwgdHJ1ZSxcbiAgICAgIGV2ZW50LnNvdXJjZVNwYW4pO1xuICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBhIGNoYWluP1xuICBldmVudEJpbmRpbmcuaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChcbiAgICAgIGNvbnZlcnRBc3QoZXZlbnQuaGFuZGxlci5hc3QsIGpvYiwgZXZlbnQuc291cmNlU3BhbiksIGV2ZW50LmhhbmRsZXJTcGFuKSkpO1xuICBqb2Iucm9vdC5jcmVhdGUucHVzaChldmVudEJpbmRpbmcpO1xufVxuXG4vKipcbiAqIEluZ2VzdCB0aGUgbm9kZXMgb2YgYSB0ZW1wbGF0ZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdE5vZGVzKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRlbXBsYXRlOiB0Lk5vZGVbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IG5vZGUgb2YgdGVtcGxhdGUpIHtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgaW5nZXN0RWxlbWVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgICBpbmdlc3RUZW1wbGF0ZSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkNvbnRlbnQpIHtcbiAgICAgIGluZ2VzdENvbnRlbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBpbmdlc3RUZXh0KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JZkJsb2NrKSB7XG4gICAgICBpbmdlc3RJZkJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuU3dpdGNoQmxvY2spIHtcbiAgICAgIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRGVmZXJyZWRCbG9jaykge1xuICAgICAgaW5nZXN0RGVmZXJCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkljdSkge1xuICAgICAgaW5nZXN0SWN1KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRm9yTG9vcEJsb2NrKSB7XG4gICAgICBpbmdlc3RGb3JCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB0ZW1wbGF0ZSBub2RlOiAke25vZGUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gZWxlbWVudCBBU1QgZnJvbSB0aGUgdGVtcGxhdGUgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGlmIChlbGVtZW50LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIShlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgfHwgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgZWxlbWVudDogJHtlbGVtZW50LmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcblxuICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuXG4gIGNvbnN0IHN0YXJ0T3AgPSBpci5jcmVhdGVFbGVtZW50U3RhcnRPcChcbiAgICAgIGVsZW1lbnROYW1lLCBpZCwgbmFtZXNwYWNlRm9yS2V5KG5hbWVzcGFjZUtleSksXG4gICAgICBlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyID8gZWxlbWVudC5pMThuIDogdW5kZWZpbmVkLFxuICAgICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHN0YXJ0T3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHVuaXQsIHN0YXJ0T3AsIGVsZW1lbnQpO1xuICBpbmdlc3RSZWZlcmVuY2VzKHN0YXJ0T3AsIGVsZW1lbnQpO1xuICBpbmdlc3ROb2Rlcyh1bml0LCBlbGVtZW50LmNoaWxkcmVuKTtcblxuICAvLyBUaGUgc291cmNlIHNwYW4gZm9yIHRoZSBlbmQgb3AgaXMgdHlwaWNhbGx5IHRoZSBlbGVtZW50IGNsb3NpbmcgdGFnLiBIb3dldmVyLCBpZiBubyBjbG9zaW5nIHRhZ1xuICAvLyBleGlzdHMsIHN1Y2ggYXMgaW4gYDxpbnB1dD5gLCB3ZSB1c2UgdGhlIHN0YXJ0IHNvdXJjZSBzcGFuIGluc3RlYWQuIFVzdWFsbHkgdGhlIHN0YXJ0IGFuZCBlbmRcbiAgLy8gaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgY29sbGFwc2VkIGludG8gb25lIGBlbGVtZW50YCBpbnN0cnVjdGlvbiwgbmVnYXRpbmcgdGhlIHB1cnBvc2Ugb2YgdGhpc1xuICAvLyBmYWxsYmFjaywgYnV0IGluIGNhc2VzIHdoZW4gaXQgaXMgbm90IGNvbGxhcHNlZCAoc3VjaCBhcyBhbiBpbnB1dCB3aXRoIGEgYmluZGluZyksIHdlIHN0aWxsXG4gIC8vIHdhbnQgdG8gbWFwIHRoZSBlbmQgaW5zdHJ1Y3Rpb24gdG8gdGhlIG1haW4gZWxlbWVudC5cbiAgY29uc3QgZW5kT3AgPSBpci5jcmVhdGVFbGVtZW50RW5kT3AoaWQsIGVsZW1lbnQuZW5kU291cmNlU3BhbiA/PyBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goZW5kT3ApO1xuXG4gIC8vIElmIHRoZXJlIGlzIGFuIGkxOG4gbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBlbGVtZW50LCBpbnNlcnQgaTE4biBzdGFydCBhbmQgZW5kIG9wcy5cbiAgaWYgKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGkxOG5CbG9ja0lkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUkxOG5TdGFydE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmkxOG4pLCBzdGFydE9wKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVJMThuRW5kT3AoaTE4bkJsb2NrSWQpLCBlbmRPcCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBpZiAodG1wbC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEodG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRlbXBsYXRlOiAke3RtcGwuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgbGV0IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID0gdG1wbC50YWdOYW1lO1xuICBsZXQgbmFtZXNwYWNlUHJlZml4OiBzdHJpbmd8bnVsbCA9ICcnO1xuICBpZiAodG1wbC50YWdOYW1lKSB7XG4gICAgW25hbWVzcGFjZVByZWZpeCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2VdID0gc3BsaXROc05hbWUodG1wbC50YWdOYW1lKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyB0bXBsLmkxOG4gOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5hbWVzcGFjZSA9IG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VQcmVmaXgpO1xuICBjb25zdCBmdW5jdGlvbk5hbWVTdWZmaXggPSB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9PT0gbnVsbCA/XG4gICAgICAnJyA6XG4gICAgICBwcmVmaXhXaXRoTmFtZXNwYWNlKHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBuYW1lc3BhY2UpO1xuICBjb25zdCB0ZW1wbGF0ZUtpbmQgPVxuICAgICAgaXNQbGFpblRlbXBsYXRlKHRtcGwpID8gaXIuVGVtcGxhdGVLaW5kLk5nVGVtcGxhdGUgOiBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbDtcbiAgY29uc3QgdHBsT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgY2hpbGRWaWV3LnhyZWYsIHRlbXBsYXRlS2luZCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIGZ1bmN0aW9uTmFtZVN1ZmZpeCwgbmFtZXNwYWNlLFxuICAgICAgaTE4blBsYWNlaG9sZGVyLCB0bXBsLnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2godHBsT3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHVuaXQsIHRwbE9wLCB0bXBsKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0cGxPcCwgdG1wbCk7XG4gIGluZ2VzdE5vZGVzKGNoaWxkVmlldywgdG1wbC5jaGlsZHJlbik7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIHRtcGwudmFyaWFibGVzKSB7XG4gICAgY2hpbGRWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KG5hbWUsIHZhbHVlICE9PSAnJyA/IHZhbHVlIDogJyRpbXBsaWNpdCcpO1xuICB9XG5cbiAgLy8gSWYgdGhpcyBpcyBhIHBsYWluIHRlbXBsYXRlIGFuZCB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIGl0LCBpbnNlcnQgaTE4biBzdGFydFxuICAvLyBhbmQgZW5kIG9wcy4gRm9yIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlcywgdGhlIGkxOG4gb3BzIHdpbGwgYmUgYWRkZWQgd2hlbiBpbmdlc3RpbmcgdGhlXG4gIC8vIGVsZW1lbnQvdGVtcGxhdGUgdGhlIGRpcmVjdGl2ZSBpcyBwbGFjZWQgb24uXG4gIGlmICh0ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5OZ1RlbXBsYXRlICYmIHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biksIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBpZiAoY29udGVudC5pMThuICE9PSB1bmRlZmluZWQgJiYgIShjb250ZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2NvbnRlbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGNvbnN0IGF0dHJzID0gY29udGVudC5hdHRyaWJ1dGVzLmZsYXRNYXAoYSA9PiBbYS5uYW1lLCBhLnZhbHVlXSk7XG4gIGNvbnN0IG9wID0gaXIuY3JlYXRlUHJvamVjdGlvbk9wKFxuICAgICAgdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgY29udGVudC5zZWxlY3RvciwgY29udGVudC5pMThuLCBhdHRycywgY29udGVudC5zb3VyY2VTcGFuKTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGNvbnRlbnQuYXR0cmlidXRlcykge1xuICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSwgYXR0ci5pMThuKTtcbiAgfVxuICB1bml0LmNyZWF0ZS5wdXNoKG9wKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5UZXh0KTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpMThuUGxhY2Vob2xkZXJzPzogc3RyaW5nW10pOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGlmIChpMThuUGxhY2Vob2xkZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBUT0RPOiBXZSBwcm9iYWJseSBjYW4ganVzdCB1c2UgdGhlIHBsYWNlaG9sZGVycyBmaWVsZCwgaW5zdGVhZCBvZiB3YWxraW5nIHRoZSBBU1QuXG4gICAgaTE4blBsYWNlaG9sZGVycyA9IHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyID9cbiAgICAgICAgdGV4dC5pMThuLmNoaWxkcmVuXG4gICAgICAgICAgICAuZmlsdGVyKChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKVxuICAgICAgICAgICAgLm1hcChwbGFjZWhvbGRlciA9PiBwbGFjZWhvbGRlci5uYW1lKSA6XG4gICAgICAgIFtdO1xuICB9XG4gIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCA+IDAgJiYgaTE4blBsYWNlaG9sZGVycy5sZW5ndGggIT09IHZhbHVlLmV4cHJlc3Npb25zLmxlbmd0aCkge1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIG51bWJlciBvZiBpMThuIHBsYWNlaG9sZGVycyAoJHtcbiAgICAgICAgdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSkgZm9yIEJvdW5kVGV4dCB3aXRoICR7dmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RofSBleHByZXNzaW9uc2ApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIHRleHQuc291cmNlU3BhbikpO1xuICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90IGdlbmVyYXRlIHNvdXJjZSBtYXBzIGZvciBzdWItZXhwcmVzc2lvbnMgaW5zaWRlIGFuXG4gIC8vIGludGVycG9sYXRpb24uIFdlIGNvcHkgdGhhdCBiZWhhdmlvciBpbiBjb21wYXRpYmlsaXR5IG1vZGUuXG4gIC8vIFRPRE86IGlzIGl0IGFjdHVhbGx5IGNvcnJlY3QgdG8gZ2VuZXJhdGUgdGhlc2UgZXh0cmEgbWFwcyBpbiBtb2Rlcm4gbW9kZT9cbiAgY29uc3QgYmFzZVNvdXJjZVNwYW4gPSB1bml0LmpvYi5jb21wYXRpYmlsaXR5ID8gbnVsbCA6IHRleHQuc291cmNlU3BhbjtcbiAgdW5pdC51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVRleHRPcChcbiAgICAgIHRleHRYcmVmLFxuICAgICAgbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICAgICAgICBpMThuUGxhY2Vob2xkZXJzKSxcbiAgICAgIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGlmYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0SWZCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpZkJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZkJsb2NrLmJyYW5jaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaWZDYXNlID0gaWZCbG9jay5icmFuY2hlc1tpXTtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHRoZSBmaXJzdCBicmFuY2ggY2FuIGJlIHVzZWQgZm9yIHByb2plY3Rpb24sIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgLy8gdXNlcyB0aGUgY29udGFpbmVyIG9mIHRoZSBmaXJzdCBicmFuY2ggYXMgdGhlIGluc2VydGlvbiBwb2ludCBmb3IgYWxsIGJyYW5jaGVzLlxuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCBjVmlldy54cmVmLCBpZkNhc2UpO1xuICAgIH1cbiAgICBpZiAoaWZDYXNlLmV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgY1ZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoaWZDYXNlLmV4cHJlc3Npb25BbGlhcy5uYW1lLCBpci5DVFhfUkVGKTtcbiAgICB9XG4gICAgY29uc3QgdG1wbE9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgaXIuVGVtcGxhdGVLaW5kLkJsb2NrLCB0YWdOYW1lLCAnQ29uZGl0aW9uYWwnLCBpci5OYW1lc3BhY2UuSFRNTCxcbiAgICAgICAgdW5kZWZpbmVkIC8qIFRPRE86IGZpZ3VyZSBvdXQgaG93IGkxOG4gd29ya3Mgd2l0aCBuZXcgY29udHJvbCBmbG93ICovLCBpZkNhc2Uuc291cmNlU3Bhbik7XG4gICAgdW5pdC5jcmVhdGUucHVzaCh0bXBsT3ApO1xuXG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRtcGxPcC5oYW5kbGU7XG4gICAgfVxuXG4gICAgY29uc3QgY2FzZUV4cHIgPSBpZkNhc2UuZXhwcmVzc2lvbiA/IGNvbnZlcnRBc3QoaWZDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSA6IG51bGw7XG4gICAgY29uc3QgY29uZGl0aW9uYWxDYXNlRXhwciA9XG4gICAgICAgIG5ldyBpci5Db25kaXRpb25hbENhc2VFeHByKGNhc2VFeHByLCB0bXBsT3AueHJlZiwgdG1wbE9wLmhhbmRsZSwgaWZDYXNlLmV4cHJlc3Npb25BbGlhcyk7XG4gICAgY29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbmFsQ2FzZUV4cHIpO1xuICAgIGluZ2VzdE5vZGVzKGNWaWV3LCBpZkNhc2UuY2hpbGRyZW4pO1xuICB9XG4gIGNvbnN0IGNvbmRpdGlvbmFsID1cbiAgICAgIGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgbnVsbCwgY29uZGl0aW9ucywgaWZCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAc3dpdGNoYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0U3dpdGNoQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3dpdGNoQmxvY2s6IHQuU3dpdGNoQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChjb25zdCBzd2l0Y2hDYXNlIG9mIHN3aXRjaEJsb2NrLmNhc2VzKSB7XG4gICAgY29uc3QgY1ZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBjb25zdCB0bXBsT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgICBjVmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIG51bGwsICdDYXNlJywgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICAgIHVuZGVmaW5lZCAvKiBUT0RPOiBmaWd1cmUgb3V0IGhvdyBpMThuIHdvcmtzIHdpdGggbmV3IGNvbnRyb2wgZmxvdyAqLyxcbiAgICAgICAgc3dpdGNoQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRtcGxPcCk7XG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRtcGxPcC5oYW5kbGU7XG4gICAgfVxuICAgIGNvbnN0IGNhc2VFeHByID0gc3dpdGNoQ2FzZS5leHByZXNzaW9uID9cbiAgICAgICAgY29udmVydEFzdChzd2l0Y2hDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBzd2l0Y2hCbG9jay5zdGFydFNvdXJjZVNwYW4pIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID0gbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoY2FzZUV4cHIsIHRtcGxPcC54cmVmLCB0bXBsT3AuaGFuZGxlKTtcbiAgICBjb25kaXRpb25zLnB1c2goY29uZGl0aW9uYWxDYXNlRXhwcik7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIHN3aXRjaENhc2UuY2hpbGRyZW4pO1xuICB9XG4gIGNvbnN0IGNvbmRpdGlvbmFsID0gaXIuY3JlYXRlQ29uZGl0aW9uYWxPcChcbiAgICAgIGZpcnN0WHJlZiEsIGZpcnN0U2xvdEhhbmRsZSEsIGNvbnZlcnRBc3Qoc3dpdGNoQmxvY2suZXhwcmVzc2lvbiwgdW5pdC5qb2IsIG51bGwpLCBjb25kaXRpb25zLFxuICAgICAgc3dpdGNoQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG5mdW5jdGlvbiBpbmdlc3REZWZlclZpZXcoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3VmZml4OiBzdHJpbmcsIGNoaWxkcmVuPzogdC5Ob2RlW10sXG4gICAgc291cmNlU3Bhbj86IFBhcnNlU291cmNlU3Bhbik6IGlyLlRlbXBsYXRlT3B8bnVsbCB7XG4gIGlmIChjaGlsZHJlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc2Vjb25kYXJ5VmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICBpbmdlc3ROb2RlcyhzZWNvbmRhcnlWaWV3LCBjaGlsZHJlbik7XG4gIGNvbnN0IHRlbXBsYXRlT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgc2Vjb25kYXJ5Vmlldy54cmVmLCBpci5UZW1wbGF0ZUtpbmQuQmxvY2ssIG51bGwsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLFxuICAgICAgdW5kZWZpbmVkLCBzb3VyY2VTcGFuISk7XG4gIHVuaXQuY3JlYXRlLnB1c2godGVtcGxhdGVPcCk7XG4gIHJldHVybiB0ZW1wbGF0ZU9wO1xufVxuXG5mdW5jdGlvbiBpbmdlc3REZWZlckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGRlZmVyQmxvY2s6IHQuRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICBjb25zdCBibG9ja01ldGEgPSB1bml0LmpvYi5kZWZlckJsb2Nrc01ldGEuZ2V0KGRlZmVyQmxvY2spO1xuICBpZiAoYmxvY2tNZXRhID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gZmluZCBtZXRhZGF0YSBmb3IgZGVmZXJyZWQgYmxvY2tgKTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIHRoZSBkZWZlciBtYWluIHZpZXcgYW5kIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IG1haW4gPSBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suY2hpbGRyZW4sIGRlZmVyQmxvY2suc291cmNlU3BhbikhO1xuICBjb25zdCBsb2FkaW5nID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ0xvYWRpbmcnLCBkZWZlckJsb2NrLmxvYWRpbmc/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmxvYWRpbmc/LnNvdXJjZVNwYW4pO1xuICBjb25zdCBwbGFjZWhvbGRlciA9IGluZ2VzdERlZmVyVmlldyhcbiAgICAgIHVuaXQsICdQbGFjZWhvbGRlcicsIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmNoaWxkcmVuLCBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPVxuICAgICAgaW5nZXN0RGVmZXJWaWV3KHVuaXQsICdFcnJvcicsIGRlZmVyQmxvY2suZXJyb3I/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmVycm9yPy5zb3VyY2VTcGFuKTtcblxuICAvLyBDcmVhdGUgdGhlIG1haW4gZGVmZXIgb3AsIGFuZCBvcHMgZm9yIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IGRlZmVyWHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gIGNvbnN0IGRlZmVyT3AgPVxuICAgICAgaXIuY3JlYXRlRGVmZXJPcChkZWZlclhyZWYsIG1haW4ueHJlZiwgbWFpbi5oYW5kbGUsIGJsb2NrTWV0YSwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKTtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlclZpZXcgPSBwbGFjZWhvbGRlcj8ueHJlZiA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyU2xvdCA9IHBsYWNlaG9sZGVyPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nU2xvdCA9IGxvYWRpbmc/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmVycm9yU2xvdCA9IGVycm9yPy5oYW5kbGUgPz8gbnVsbDtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlck1pbmltdW1UaW1lID0gZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLmxvYWRpbmc/Lm1pbmltdW1UaW1lID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ0FmdGVyVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8uYWZ0ZXJUaW1lID8/IG51bGw7XG4gIHVuaXQuY3JlYXRlLnB1c2goZGVmZXJPcCk7XG5cbiAgLy8gQ29uZmlndXJlIGFsbCBkZWZlciBgb25gIGNvbmRpdGlvbnMuXG4gIC8vIFRPRE86IHJlZmFjdG9yIHByZWZldGNoIHRyaWdnZXJzIHRvIHVzZSBhIHNlcGFyYXRlIG9wIHR5cGUsIHdpdGggYSBzaGFyZWQgc3VwZXJjbGFzcy4gVGhpcyB3aWxsXG4gIC8vIG1ha2UgaXQgZWFzaWVyIHRvIHJlZmFjdG9yIHByZWZldGNoIGJlaGF2aW9yIGluIHRoZSBmdXR1cmUuXG4gIGxldCBwcmVmZXRjaCA9IGZhbHNlO1xuICBsZXQgZGVmZXJPbk9wczogaXIuRGVmZXJPbk9wW10gPSBbXTtcbiAgbGV0IGRlZmVyV2hlbk9wczogaXIuRGVmZXJXaGVuT3BbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHRyaWdnZXJzIG9mIFtkZWZlckJsb2NrLnRyaWdnZXJzLCBkZWZlckJsb2NrLnByZWZldGNoVHJpZ2dlcnNdKSB7XG4gICAgaWYgKHRyaWdnZXJzLmlkbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIHByZWZldGNoLCB0cmlnZ2Vycy5pZGxlLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5pbW1lZGlhdGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlfSwgcHJlZmV0Y2gsXG4gICAgICAgICAgdHJpZ2dlcnMuaW1tZWRpYXRlLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy50aW1lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5UaW1lciwgZGVsYXk6IHRyaWdnZXJzLnRpbWVyLmRlbGF5fSwgcHJlZmV0Y2gsXG4gICAgICAgICAgdHJpZ2dlcnMudGltZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmhvdmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXIsXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5ob3Zlci5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmhvdmVyLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy5pbnRlcmFjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLkludGVyYWN0aW9uLFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMuaW50ZXJhY3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMudmlld3BvcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5WaWV3cG9ydCxcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLnZpZXdwb3J0LnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMudmlld3BvcnQuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLndoZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJXaGVuT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCBjb252ZXJ0QXN0KHRyaWdnZXJzLndoZW4udmFsdWUsIHVuaXQuam9iLCB0cmlnZ2Vycy53aGVuLnNvdXJjZVNwYW4pLCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy53aGVuLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJXaGVuT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyAobm9uLXByZWZldGNoaW5nKSBkZWZlciB0cmlnZ2VycyB3ZXJlIHByb3ZpZGVkLCBkZWZhdWx0IHRvIGBpZGxlYC5cbiAgICBpZiAoZGVmZXJPbk9wcy5sZW5ndGggPT09IDAgJiYgZGVmZXJXaGVuT3BzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKFxuICAgICAgICAgIGlyLmNyZWF0ZURlZmVyT25PcChkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLklkbGV9LCBmYWxzZSwgbnVsbCEpKTtcbiAgICB9XG4gICAgcHJlZmV0Y2ggPSB0cnVlO1xuICB9XG5cbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9uT3BzKTtcbiAgdW5pdC51cGRhdGUucHVzaChkZWZlcldoZW5PcHMpO1xufVxuXG5mdW5jdGlvbiBpbmdlc3RJY3UodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWN1OiB0LkljdSkge1xuICBpZiAoaWN1LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgJiYgaXNTaW5nbGVJMThuSWN1KGljdS5pMThuKSkge1xuICAgIGNvbnN0IHhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGNvbnN0IGljdU5vZGUgPSBpY3UuaTE4bi5ub2Rlc1swXTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdVN0YXJ0T3AoeHJlZiwgaWN1LmkxOG4sIGljdUZyb21JMThuTWVzc2FnZShpY3UuaTE4bikubmFtZSwgbnVsbCEpKTtcbiAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgdGV4dF0gb2YgT2JqZWN0LmVudHJpZXMoey4uLmljdS52YXJzLCAuLi5pY3UucGxhY2Vob2xkZXJzfSkpIHtcbiAgICAgIGlmICh0ZXh0IGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIHRleHQsIFtwbGFjZWhvbGRlcl0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0VGV4dCh1bml0LCB0ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VFbmRPcCh4cmVmKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIElDVTogJHtpY3UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGZvcmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEZvckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGZvckJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHZvaWQge1xuICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICBjb25zdCBjcmVhdGVSZXBlYXRlckFsaWFzID0gKGlkZW50OiBzdHJpbmcsIHJlcGVhdGVyVmFyOiBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eSkgPT4ge1xuICAgIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICBpZGVudGlmaWVyOiBpZGVudCxcbiAgICAgIGV4cHJlc3Npb246IG5ldyBpci5EZXJpdmVkUmVwZWF0ZXJWYXJFeHByKHJlcGVhdGVyVmlldy54cmVmLCByZXBlYXRlclZhciksXG4gICAgfSk7XG4gIH07XG5cbiAgLy8gU2V0IGFsbCB0aGUgY29udGV4dCB2YXJpYWJsZXMgYW5kIGFsaWFzZXMgYXZhaWxhYmxlIGluIHRoZSByZXBlYXRlci5cbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGZvckJsb2NrLml0ZW0ubmFtZSwgZm9yQmxvY2suaXRlbS52YWx1ZSk7XG4gIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChcbiAgICAgIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQudmFsdWUpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5LkZpcnN0KTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5Lkxhc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRXZlbik7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5Lk9kZCk7XG5cbiAgY29uc3Qgc291cmNlU3BhbiA9IGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLnRyYWNrQnkuc3BhbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIGNvbnN0IHRyYWNrID0gY29udmVydEFzdChmb3JCbG9jay50cmFja0J5LCB1bml0LmpvYiwgc291cmNlU3Bhbik7XG5cbiAgaW5nZXN0Tm9kZXMocmVwZWF0ZXJWaWV3LCBmb3JCbG9jay5jaGlsZHJlbik7XG5cbiAgbGV0IGVtcHR5VmlldzogVmlld0NvbXBpbGF0aW9uVW5pdHxudWxsID0gbnVsbDtcbiAgaWYgKGZvckJsb2NrLmVtcHR5ICE9PSBudWxsKSB7XG4gICAgZW1wdHlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgaW5nZXN0Tm9kZXMoZW1wdHlWaWV3LCBmb3JCbG9jay5lbXB0eS5jaGlsZHJlbik7XG4gIH1cblxuICBjb25zdCB2YXJOYW1lczogaXIuUmVwZWF0ZXJWYXJOYW1lcyA9IHtcbiAgICAkaW5kZXg6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsXG4gICAgJGNvdW50OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLFxuICAgICRmaXJzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSxcbiAgICAkbGFzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLFxuICAgICRldmVuOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRldmVuLm5hbWUsXG4gICAgJG9kZDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsXG4gICAgJGltcGxpY2l0OiBmb3JCbG9jay5pdGVtLm5hbWUsXG4gIH07XG5cbiAgY29uc3QgdGFnTmFtZSA9IGluZ2VzdENvbnRyb2xGbG93SW5zZXJ0aW9uUG9pbnQodW5pdCwgcmVwZWF0ZXJWaWV3LnhyZWYsIGZvckJsb2NrKTtcbiAgY29uc3QgcmVwZWF0ZXJDcmVhdGUgPSBpci5jcmVhdGVSZXBlYXRlckNyZWF0ZU9wKFxuICAgICAgcmVwZWF0ZXJWaWV3LnhyZWYsIGVtcHR5Vmlldz8ueHJlZiA/PyBudWxsLCB0YWdOYW1lLCB0cmFjaywgdmFyTmFtZXMsIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHJlcGVhdGVyQ3JlYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gY29udmVydEFzdChcbiAgICAgIGZvckJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2suZXhwcmVzc2lvbi5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKSk7XG4gIGNvbnN0IHJlcGVhdGVyID0gaXIuY3JlYXRlUmVwZWF0ZXJPcChcbiAgICAgIHJlcGVhdGVyQ3JlYXRlLnhyZWYsIHJlcGVhdGVyQ3JlYXRlLmhhbmRsZSwgZXhwcmVzc2lvbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2gocmVwZWF0ZXIpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBBU1QgZXhwcmVzc2lvbiBpbnRvIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gY29udmVydEFzdChcbiAgICBhc3Q6IGUuQVNULCBqb2I6IENvbXBpbGF0aW9uSm9iLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmFzdCwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVJlYWQpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyICYmICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSwgbnVsbCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgICAgLy8gVE9ETzogSXMgaXQgY29ycmVjdCB0byBhbHdheXMgdXNlIHRoZSByb290IGNvbnRleHQgaW4gcGxhY2Ugb2YgdGhlIGltcGxpY2l0IHJlY2VpdmVyP1xuICAgICAgICAgIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKSwgYXN0Lm5hbWUsIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBudWxsLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkV3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNhbGwpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgSW1wbGljaXRSZWNlaXZlcmApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBhc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5VbmFyeSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVE9ETzogU3VwcG9ydCB1bmFyeSBvcGVyYXRpb25zLCB3aGljaCBleHRlbmQgYmluYXJ5IG9wcycpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluYXJ5KSB7XG4gICAgY29uc3Qgb3BlcmF0b3IgPSBCSU5BUllfT1BFUkFUT1JTLmdldChhc3Qub3BlcmF0aW9uKTtcbiAgICBpZiAob3BlcmF0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5rbm93biBiaW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICBvcGVyYXRvciwgY29udmVydEFzdChhc3QubGVmdCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJpZ2h0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikge1xuICAgIC8vIFRPRE86IHNob3VsZCBjb250ZXh0IGV4cHJlc3Npb25zIGhhdmUgc291cmNlIG1hcHM/XG4gICAgcmV0dXJuIG5ldyBpci5Db250ZXh0RXhwcihqb2Iucm9vdC54cmVmKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgby5SZWFkS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBDaGFpbiBpbiB1bmtub3duIGNvbnRleHRgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxNYXApIHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmtleXMubWFwKChrZXksIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWVzW2lkeF07XG4gICAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nXG4gICAgICAvLyBleHByZXNzaW9uP1xuICAgICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXkua2V5LCBjb252ZXJ0QXN0KHZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwga2V5LnF1b3RlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsQXJyYXkpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgbGl0ZXJhbHMgaGF2ZSBzb3VyY2UgbWFwcywgb3IgZG8gd2UganVzdCBtYXAgdGhlIHdob2xlIHN1cnJvdW5kaW5nIGV4cHJlc3Npb24/XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoXG4gICAgICAgIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Db25kaXRpb25hbCkge1xuICAgIHJldHVybiBuZXcgby5Db25kaXRpb25hbEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmNvbmRpdGlvbiwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnRydWVFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5mYWxzZUV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Ob25OdWxsQXNzZXJ0KSB7XG4gICAgLy8gQSBub24tbnVsbCBhc3NlcnRpb24gc2hvdWxkbid0IGltcGFjdCBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb25zLCBzbyB3ZSBjYW4ganVzdCBkcm9wIGl0LlxuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmRpbmdQaXBlKSB7XG4gICAgLy8gVE9ETzogcGlwZXMgc2hvdWxkIHByb2JhYmx5IGhhdmUgc291cmNlIG1hcHM7IGZpZ3VyZSBvdXQgZGV0YWlscy5cbiAgICByZXR1cm4gbmV3IGlyLlBpcGVCaW5kaW5nRXhwcihcbiAgICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksXG4gICAgICAgIG5ldyBpci5TbG90SGFuZGxlKCksXG4gICAgICAgIGFzdC5uYW1lLFxuICAgICAgICBbXG4gICAgICAgICAgY29udmVydEFzdChhc3QuZXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICAuLi5hc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksXG4gICAgICAgIF0sXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVLZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVLZXllZFJlYWRFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlUHJvcGVydHlSZWFkRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVDYWxsKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgYXN0LmFyZ3MubWFwKGEgPT4gY29udmVydEFzdChhLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuRW1wdHlFeHByKSB7XG4gICAgcmV0dXJuIG5ldyBpci5FbXB0eUV4cHIoY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5QcmVmaXhOb3QpIHtcbiAgICByZXR1cm4gby5ub3QoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGUgXCIke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfVwiIGluIGZpbGUgXCIke1xuICAgICAgICBiYXNlU291cmNlU3Bhbj8uc3RhcnQuZmlsZS51cmx9XCJgKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpcyBhIHBsYWluIG5nLXRlbXBsYXRlIChhcyBvcHBvc2VkIHRvIGFub3RoZXIga2luZCBvZiB0ZW1wbGF0ZVxuICogc3VjaCBhcyBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlIG9yIGNvbnRyb2wgZmxvdyB0ZW1wbGF0ZSkuIFRoaXMgaXMgY2hlY2tlZCBiYXNlZCBvbiB0aGVcbiAqIHRhZ05hbWUuIFdlIGNhbiBleHBlY3QgdGhhdCBvbmx5IHBsYWluIG5nLXRlbXBsYXRlcyB3aWxsIGNvbWUgdGhyb3VnaCB3aXRoIGEgdGFnTmFtZSBvZlxuICogJ25nLXRlbXBsYXRlJy5cbiAqXG4gKiBIZXJlIGFyZSBzb21lIG9mIHRoZSBjYXNlcyB3ZSBleHBlY3Q6XG4gKlxuICogfCBBbmd1bGFyIEhUTUwgICAgICAgICAgICAgICAgICAgICAgIHwgVGVtcGxhdGUgdGFnTmFtZSAgIHxcbiAqIHwgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8IC0tLS0tLS0tLS0tLS0tLS0tLSB8XG4gKiB8IGA8bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPGRpdiAqbmdJZj1cInRydWVcIj5gICAgICAgICAgICAgICAgfCAnZGl2JyAgICAgICAgICAgICAgfFxuICogfCBgPHN2Zz48bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgIHwgJ3N2ZzpuZy10ZW1wbGF0ZScgIHxcbiAqIHwgYEBpZiAodHJ1ZSkge2AgICAgICAgICAgICAgICAgICAgICB8ICdDb25kaXRpb25hbCcgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAocGxhaW4pICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHN0cnVjdHVyYWwpIHwgbnVsbCAgICAgICAgICAgICAgIHxcbiAqL1xuZnVuY3Rpb24gaXNQbGFpblRlbXBsYXRlKHRtcGw6IHQuVGVtcGxhdGUpIHtcbiAgcmV0dXJuIHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSA/PyAnJylbMV0gPT09ICduZy10ZW1wbGF0ZSc7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtXG4gKiB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0QmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIGVsZW1lbnQ6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGxldCBmbGFnczogQmluZGluZ0ZsYWdzID0gQmluZGluZ0ZsYWdzLk5vbmU7XG4gIGxldCBoYXNJMThuQXR0cmlidXRlcyA9IGZhbHNlO1xuXG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50O1xuICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBpc1BsYWluVGVtcGxhdGUoZWxlbWVudCkpIHtcbiAgICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5CaW5kaW5nVGFyZ2V0c1RlbXBsYXRlO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlQXR0ckZsYWdzID1cbiAgICAgICAgZmxhZ3MgfCBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSB8IEJpbmRpbmdGbGFncy5Jc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgdGVtcGxhdGVBdHRyRmxhZ3MgfCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlLFxuICAgICAgICAgICAgYXR0ci5pMThuKTtcbiAgICAgICAgaGFzSTE4bkF0dHJpYnV0ZXMgfHw9IGF0dHIuaTE4biAhPT0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgYXR0ci52YWx1ZSwgYXR0ci50eXBlLCBhdHRyLnVuaXQsIGF0dHIuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgICAgYXR0ci5zb3VyY2VTcGFuLCB0ZW1wbGF0ZUF0dHJGbGFncywgYXR0ci5pMThuKTtcbiAgICAgICAgaGFzSTE4bkF0dHJpYnV0ZXMgfHw9IGF0dHIuaTE4biAhPT0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAvLyBUaGlzIGlzIG9ubHkgYXR0cmlidXRlIFRleHRMaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC4gVGhpcyBjYW4gbmV2ZXIgYmVcbiAgICAvLyBgW2F0dHIuZm9vXT1cImJhclwiYCBvciBgYXR0ci5mb289XCJ7e2Jhcn19XCJgLCBib3RoIG9mIHdoaWNoIHdpbGwgYmUgaGFuZGxlZCBhcyBpbnB1dHMgd2l0aFxuICAgIC8vIGBCaW5kaW5nVHlwZS5BdHRyaWJ1dGVgLlxuICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgZmxhZ3MgfCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlLCBhdHRyLmkxOG4pO1xuICAgIGhhc0kxOG5BdHRyaWJ1dGVzIHx8PSBhdHRyLmkxOG4gIT09IHVuZGVmaW5lZDtcbiAgfVxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQubmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnR5cGUsIGlucHV0LnVuaXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgaW5wdXQuc291cmNlU3BhbiwgZmxhZ3MsIGlucHV0LmkxOG4pO1xuICAgIGhhc0kxOG5BdHRyaWJ1dGVzIHx8PSBpbnB1dC5pMThuICE9PSB1bmRlZmluZWQ7XG4gIH1cblxuICBmb3IgKGNvbnN0IG91dHB1dCBvZiBlbGVtZW50Lm91dHB1dHMpIHtcbiAgICBsZXQgbGlzdGVuZXJPcDogaXIuTGlzdGVuZXJPcDtcbiAgICBpZiAob3V0cHV0LnR5cGUgPT09IGUuUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgaWYgKG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQW5pbWF0aW9uIGxpc3RlbmVyIHNob3VsZCBoYXZlIGEgcGhhc2UnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgIWlzUGxhaW5UZW1wbGF0ZShlbGVtZW50KSkge1xuICAgICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChvcC54cmVmLCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3V0cHV0Lm5hbWUsIG51bGwsIG51bGwpKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxpc3RlbmVyT3AgPSBpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsIG91dHB1dC5waGFzZSwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKTtcblxuICAgIC8vIGlmIG91dHB1dC5oYW5kbGVyIGlzIGEgY2hhaW4sIHRoZW4gcHVzaCBlYWNoIHN0YXRlbWVudCBmcm9tIHRoZSBjaGFpbiBzZXBhcmF0ZWx5LCBhbmRcbiAgICAvLyByZXR1cm4gdGhlIGxhc3Qgb25lP1xuICAgIGxldCBoYW5kbGVyRXhwcnM6IGUuQVNUW107XG4gICAgbGV0IGhhbmRsZXI6IGUuQVNUID0gb3V0cHV0LmhhbmRsZXI7XG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmFzdDtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IGhhbmRsZXIuZXhwcmVzc2lvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IFtoYW5kbGVyXTtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlckV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBoYW5kbGVyRXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgb3V0cHV0LmhhbmRsZXJTcGFuKSk7XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcblxuICAgIGZvciAoY29uc3QgZXhwciBvZiBleHByZXNzaW9ucykge1xuICAgICAgY29uc3Qgc3RtdE9wID1cbiAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4obmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBleHByLnNvdXJjZVNwYW4pKTtcbiAgICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKHN0bXRPcCk7XG4gICAgfVxuICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKFxuICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwciwgcmV0dXJuRXhwci5zb3VyY2VTcGFuKSkpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2gobGlzdGVuZXJPcCk7XG4gIH1cblxuICAvLyBUT0RPOiBQZXJoYXBzIHdlIGNvdWxkIGRvIHRoaXMgaW4gYSBwaGFzZT8gKEl0IGxpa2VseSB3b3VsZG4ndCBjaGFuZ2UgdGhlIHNsb3QgaW5kaWNlcy4pXG4gIGlmIChoYXNJMThuQXR0cmlidXRlcykge1xuICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5BdHRyaWJ1dGVzT3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgbmV3IGlyLlNsb3RIYW5kbGUoKSwgb3AueHJlZikpO1xuICB9XG59XG5cbmNvbnN0IEJJTkRJTkdfS0lORFMgPSBuZXcgTWFwPGUuQmluZGluZ1R5cGUsIGlyLkJpbmRpbmdLaW5kPihbXG4gIFtlLkJpbmRpbmdUeXBlLlByb3BlcnR5LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlXSxcbiAgW2UuQmluZGluZ1R5cGUuQ2xhc3MsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZV0sXG4gIFtlLkJpbmRpbmdUeXBlLlN0eWxlLCBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQW5pbWF0aW9uLCBpci5CaW5kaW5nS2luZC5BbmltYXRpb25dLFxuXSk7XG5cbmVudW0gQmluZGluZ0ZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBpcyB0byBhIHN0YXRpYyB0ZXh0IGxpdGVyYWwgYW5kIG5vdCB0byBhbiBleHByZXNzaW9uLlxuICAgKi9cbiAgVGV4dFZhbHVlID0gMGIwMDAxLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBiZWxvbmdzIHRvIHRoZSBgPG5nLXRlbXBsYXRlPmAgc2lkZSBvZiBhIGB0LlRlbXBsYXRlYC5cbiAgICovXG4gIEJpbmRpbmdUYXJnZXRzVGVtcGxhdGUgPSAwYjAwMTAsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGlzIG9uIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUuXG4gICAqL1xuICBJc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSA9IDBiMDEwMCxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgaXMgb24gYSBgdC5UZW1wbGF0ZWAuXG4gICAqL1xuICBPbk5nVGVtcGxhdGVFbGVtZW50ID0gMGIxMDAwLFxufVxuXG5mdW5jdGlvbiBpbmdlc3RCaW5kaW5nKFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHhyZWY6IGlyLlhyZWZJZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogZS5BU1R8by5FeHByZXNzaW9uLFxuICAgIHR5cGU6IGUuQmluZGluZ1R5cGUsIHVuaXQ6IHN0cmluZ3xudWxsLCBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGZsYWdzOiBCaW5kaW5nRmxhZ3MsIGkxOG5NZXRhOiBpMThuLkkxOG5NZXRhfHVuZGVmaW5lZCk6IHZvaWQge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmFzdDtcbiAgfVxuXG4gIGxldCBpMThuQ29udGV4dDogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBpZiAoaTE4bk1ldGEgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICghKGkxOG5NZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSkge1xuICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGJpbmRpbmc6ICR7aTE4bk1ldGEuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICB9XG4gICAgaTE4bkNvbnRleHQgPSB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIHZpZXcuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5Db250ZXh0T3AoaXIuSTE4bkNvbnRleHRLaW5kLkF0dHIsIGkxOG5Db250ZXh0LCBudWxsLCBpMThuTWV0YSwgbnVsbCEpKTtcbiAgfVxuXG4gIGlmIChmbGFncyAmIEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50ICYmICEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSkgJiZcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAvLyBUaGlzIGJpbmRpbmcgb25seSBleGlzdHMgZm9yIGxhdGVyIGNvbnN0IGV4dHJhY3Rpb24sIGFuZCBpcyBub3QgYW4gYWN0dWFsIGJpbmRpbmcgdG8gYmVcbiAgICAvLyBjcmVhdGVkLlxuICAgIHZpZXcuY3JlYXRlLnB1c2goXG4gICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKHhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBuYW1lLCBudWxsLCBpMThuQ29udGV4dCkpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258aXIuSW50ZXJwb2xhdGlvbjtcbiAgLy8gVE9ETzogV2UgY291bGQgZWFzaWx5IGdlbmVyYXRlIHNvdXJjZSBtYXBzIGZvciBzdWJleHByZXNzaW9ucyBpbiB0aGVzZSBjYXNlcywgYnV0XG4gIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgZG9lcyBub3QuIFNob3VsZCB3ZSBkbyBzbz9cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgbGV0IGkxOG5QbGFjZWhvbGRlcnM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGkxOG5NZXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGkxOG5QbGFjZWhvbGRlcnMgPSBPYmplY3Qua2V5cyhpMThuTWV0YS5wbGFjZWhvbGRlcnMpO1xuICAgIH1cbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdmlldy5qb2IsIG51bGwpKSxcbiAgICAgICAgaTE4blBsYWNlaG9sZGVycyk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVCkge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KHZhbHVlLCB2aWV3LmpvYiwgbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IHZhbHVlO1xuICB9XG5cbiAgY29uc3Qga2luZDogaXIuQmluZGluZ0tpbmQgPSBCSU5ESU5HX0tJTkRTLmdldCh0eXBlKSE7XG4gIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgeHJlZiwga2luZCwgbmFtZSwgZXhwcmVzc2lvbiwgdW5pdCwgc2VjdXJpdHlDb250ZXh0LCAhIShmbGFncyAmIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpLFxuICAgICAgISEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuSXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUpLCBpMThuQ29udGV4dCwgc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBsb2NhbCByZWZlcmVuY2VzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmRcbiAqIGNvbnZlcnQgdGhlbSB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0UmVmZXJlbmNlcyhvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgYXNzZXJ0SXNBcnJheTxpci5Mb2NhbFJlZj4ob3AubG9jYWxSZWZzKTtcbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIGVsZW1lbnQucmVmZXJlbmNlcykge1xuICAgIG9wLmxvY2FsUmVmcy5wdXNoKHtcbiAgICAgIG5hbWUsXG4gICAgICB0YXJnZXQ6IHZhbHVlLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgdGhlIGdpdmVuIHZhbHVlIGlzIGFuIGFycmF5LlxuICovXG5mdW5jdGlvbiBhc3NlcnRJc0FycmF5PFQ+KHZhbHVlOiBhbnkpOiBhc3NlcnRzIHZhbHVlIGlzIEFycmF5PFQ+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGFuIGFycmF5YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFic29sdXRlIGBQYXJzZVNvdXJjZVNwYW5gIGZyb20gdGhlIHJlbGF0aXZlIGBQYXJzZVNwYW5gLlxuICpcbiAqIGBQYXJzZVNwYW5gIG9iamVjdHMgYXJlIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgZXhwcmVzc2lvbi5cbiAqIFRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZXNlIHRvIGZ1bGwgYFBhcnNlU291cmNlU3BhbmAgb2JqZWN0cyB0aGF0XG4gKiBzaG93IHdoZXJlIHRoZSBzcGFuIGlzIHdpdGhpbiB0aGUgb3ZlcmFsbCBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcGFyYW0gc3BhbiB0aGUgcmVsYXRpdmUgc3BhbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGJhc2VTb3VyY2VTcGFuIGEgc3BhbiBjb3JyZXNwb25kaW5nIHRvIHRoZSBiYXNlIG9mIHRoZSBleHByZXNzaW9uIHRyZWUuXG4gKiBAcmV0dXJucyBhIGBQYXJzZVNvdXJjZVNwYW5gIGZvciB0aGUgZ2l2ZW4gc3BhbiBvciBudWxsIGlmIG5vIGBiYXNlU291cmNlU3BhbmAgd2FzIHByb3ZpZGVkLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0U291cmNlU3BhbihcbiAgICBzcGFuOiBlLlBhcnNlU3BhbiwgYmFzZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICBpZiAoYmFzZVNvdXJjZVNwYW4gPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzdGFydCA9IGJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgY29uc3QgZW5kID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uZW5kKTtcbiAgY29uc3QgZnVsbFN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uZnVsbFN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCwgZnVsbFN0YXJ0KTtcbn1cblxuLyoqXG4gKiBXaXRoIHRoZSBkaXJlY3RpdmUtYmFzZWQgY29udHJvbCBmbG93IHVzZXJzIHdlcmUgYWJsZSB0byBjb25kaXRpb25hbGx5IHByb2plY3QgY29udGVudCB1c2luZ1xuICogdGhlIGAqYCBzeW50YXguIEUuZy4gYDxkaXYgKm5nSWY9XCJleHByXCIgcHJvamVjdE1lPjwvZGl2PmAgd2lsbCBiZSBwcm9qZWN0ZWQgaW50b1xuICogYDxuZy1jb250ZW50IHNlbGVjdD1cIltwcm9qZWN0TWVdXCIvPmAsIGJlY2F1c2UgdGhlIGF0dHJpYnV0ZXMgYW5kIHRhZyBuYW1lIGZyb20gdGhlIGBkaXZgIGFyZVxuICogY29waWVkIHRvIHRoZSB0ZW1wbGF0ZSB2aWEgdGhlIHRlbXBsYXRlIGNyZWF0aW9uIGluc3RydWN0aW9uLiBXaXRoIGBAaWZgIGFuZCBgQGZvcmAgdGhhdCBpc1xuICogbm90IHRoZSBjYXNlLCBiZWNhdXNlIHRoZSBjb25kaXRpb25hbCBpcyBwbGFjZWQgKmFyb3VuZCogZWxlbWVudHMsIHJhdGhlciB0aGFuICpvbiogdGhlbS5cbiAqIFRoZSByZXN1bHQgaXMgdGhhdCBjb250ZW50IHByb2plY3Rpb24gd29uJ3Qgd29yayBpbiB0aGUgc2FtZSB3YXkgaWYgYSB1c2VyIGNvbnZlcnRzIGZyb21cbiAqIGAqbmdJZmAgdG8gYEBpZmAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBhaW1zIHRvIGNvdmVyIHRoZSBtb3N0IGNvbW1vbiBjYXNlIGJ5IGRvaW5nIHRoZSBzYW1lIGNvcHlpbmcgd2hlbiBhIGNvbnRyb2wgZmxvd1xuICogbm9kZSBoYXMgKm9uZSBhbmQgb25seSBvbmUqIHJvb3QgZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLlxuICpcbiAqIFRoaXMgYXBwcm9hY2ggY29tZXMgd2l0aCBzb21lIGNhdmVhdHM6XG4gKiAxLiBBcyBzb29uIGFzIGFueSBvdGhlciBub2RlIGlzIGFkZGVkIHRvIHRoZSByb290LCB0aGUgY29weWluZyBiZWhhdmlvciB3b24ndCB3b3JrIGFueW1vcmUuXG4gKiAgICBBIGRpYWdub3N0aWMgd2lsbCBiZSBhZGRlZCB0byBmbGFnIGNhc2VzIGxpa2UgdGhpcyBhbmQgdG8gZXhwbGFpbiBob3cgdG8gd29yayBhcm91bmQgaXQuXG4gKiAyLiBJZiBgcHJlc2VydmVXaGl0ZXNwYWNlc2AgaXMgZW5hYmxlZCwgaXQncyB2ZXJ5IGxpa2VseSB0aGF0IGluZGVudGF0aW9uIHdpbGwgYnJlYWsgdGhpc1xuICogICAgd29ya2Fyb3VuZCwgYmVjYXVzZSBpdCdsbCBpbmNsdWRlIGFuIGFkZGl0aW9uYWwgdGV4dCBub2RlIGFzIHRoZSBmaXJzdCBjaGlsZC4gV2UgY2FuIHdvcmtcbiAqICAgIGFyb3VuZCBpdCBoZXJlLCBidXQgaW4gYSBkaXNjdXNzaW9uIGl0IHdhcyBkZWNpZGVkIG5vdCB0bywgYmVjYXVzZSB0aGUgdXNlciBleHBsaWNpdGx5IG9wdGVkXG4gKiAgICBpbnRvIHByZXNlcnZpbmcgdGhlIHdoaXRlc3BhY2UgYW5kIHdlIHdvdWxkIGhhdmUgdG8gZHJvcCBpdCBmcm9tIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqICAgIFRoZSBkaWFnbm9zdGljIG1lbnRpb25lZCBwb2ludCAjMSB3aWxsIGZsYWcgc3VjaCBjYXNlcyB0byB1c2Vycy5cbiAqXG4gKiBAcmV0dXJucyBUYWcgbmFtZSB0byBiZSB1c2VkIGZvciB0aGUgY29udHJvbCBmbG93IHRlbXBsYXRlLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250cm9sRmxvd0luc2VydGlvblBvaW50KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHhyZWY6IGlyLlhyZWZJZCwgbm9kZTogdC5JZkJsb2NrQnJhbmNofHQuRm9yTG9vcEJsb2NrKTogc3RyaW5nfG51bGwge1xuICBsZXQgcm9vdDogdC5FbGVtZW50fHQuVGVtcGxhdGV8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5Db21tZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4gb25seSBpbmZlciB0aGUgdGFnIG5hbWUvYXR0cmlidXRlcyBpZiB0aGVyZSdzIGEgc2luZ2xlIHJvb3Qgbm9kZS5cbiAgICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gUm9vdCBub2RlcyBjYW4gb25seSBlbGVtZW50cyBvciB0ZW1wbGF0ZXMgd2l0aCBhIHRhZyBuYW1lIChlLmcuIGA8ZGl2ICpmb28+PC9kaXY+YCkuXG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgdC5FbGVtZW50IHx8IChjaGlsZCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgY2hpbGQudGFnTmFtZSAhPT0gbnVsbCkpIHtcbiAgICAgIHJvb3QgPSBjaGlsZDtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSd2ZSBmb3VuZCBhIHNpbmdsZSByb290IG5vZGUsIGl0cyB0YWcgbmFtZSBhbmQgKnN0YXRpYyogYXR0cmlidXRlcyBjYW4gYmUgY29waWVkXG4gIC8vIHRvIHRoZSBzdXJyb3VuZGluZyB0ZW1wbGF0ZSB0byBiZSB1c2VkIGZvciBjb250ZW50IHByb2plY3Rpb24uIE5vdGUgdGhhdCBpdCdzIGltcG9ydGFudFxuICAvLyB0aGF0IHdlIGRvbid0IGNvcHkgYW55IGJvdW5kIGF0dHJpYnV0ZXMgc2luY2UgdGhleSBkb24ndCBwYXJ0aWNpcGF0ZSBpbiBjb250ZW50IHByb2plY3Rpb25cbiAgLy8gYW5kIHRoZXkgY2FuIGJlIHVzZWQgaW4gZGlyZWN0aXZlIG1hdGNoaW5nIChpbiB0aGUgY2FzZSBvZiBgVGVtcGxhdGUudGVtcGxhdGVBdHRyc2ApLlxuICBpZiAocm9vdCAhPT0gbnVsbCkge1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiByb290LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgICAgdW5pdCwgeHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUsIGF0dHIuaTE4bik7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZSA9IHJvb3QgaW5zdGFuY2VvZiB0LkVsZW1lbnQgPyByb290Lm5hbWUgOiByb290LnRhZ05hbWU7XG5cbiAgICAvLyBEb24ndCBwYXNzIGFsb25nIGBuZy10ZW1wbGF0ZWAgdGFnIG5hbWUgc2luY2UgaXQgZW5hYmxlcyBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgcmV0dXJuIHRhZ05hbWUgPT09ICduZy10ZW1wbGF0ZScgPyBudWxsIDogdGFnTmFtZTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIl19