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
        expression = new ir.Interpolation(ast.strings, ast.expressions.map(expr => convertAst(expr, job, property.sourceSpan)));
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
        .NONE /* TODO: what should we pass as security context? Passing NONE for now. */, isTextAttribute, false, property.sourceSpan));
}
export function ingestHostAttribute(job, name, value) {
    const attrBinding = ir.createBindingOp(job.root.xref, ir.BindingKind.Attribute, name, value, null, SecurityContext.NONE, true, false, 
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
    const tplOp = ir.createTemplateOp(childView.xref, tagNameWithoutNamespace, functionNameSuffix, namespace, i18nPlaceholder, tmpl.startSourceSpan);
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
    if (isPlainTemplate(tmpl) && tmpl.i18n instanceof i18n.Message) {
        const id = unit.job.allocateXrefId();
        ir.OpList.insertAfter(ir.createI18nStartOp(id, tmpl.i18n), childView.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id), childView.create.tail);
    }
}
/**
 * Ingest a literal text node from the AST into the given `ViewCompilation`.
 */
function ingestContent(unit, content) {
    const op = ir.createProjectionOp(unit.job.allocateXrefId(), content.selector, content.sourceSpan);
    for (const attr of content.attributes) {
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue);
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
    unit.update.push(ir.createInterpolateTextOp(textXref, new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, unit.job, baseSourceSpan))), i18nPlaceholders, text.sourceSpan));
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
        const tmplOp = ir.createTemplateOp(cView.xref, tagName, 'Conditional', ir.Namespace.HTML, undefined /* TODO: figure out how i18n works with new control flow */, ifCase.sourceSpan);
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
        const tmplOp = ir.createTemplateOp(cView.xref, null, 'Case', ir.Namespace.HTML, undefined /* TODO: figure out how i18n works with new control flow */, switchCase.sourceSpan);
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
    const templateOp = ir.createTemplateOp(secondaryView.xref, null, `Defer${suffix}`, ir.Namespace.HTML, undefined, sourceSpan);
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
        const expressionPlaceholder = icuNode.expressionPlaceholder?.trimEnd();
        if (expressionPlaceholder === undefined || icu.vars[expressionPlaceholder] === undefined) {
            throw Error('ICU should have a text binding');
        }
        ingestBoundText(unit, icu.vars[expressionPlaceholder], [expressionPlaceholder]);
        for (const [placeholder, text] of Object.entries(icu.placeholders)) {
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
    if (element instanceof t.Template) {
        flags |= BindingFlags.OnNgTemplateElement;
        if (element instanceof t.Template && isPlainTemplate(element)) {
            flags |= BindingFlags.BindingTargetsTemplate;
        }
        const templateAttrFlags = flags | BindingFlags.BindingTargetsTemplate | BindingFlags.IsStructuralTemplateAttribute;
        for (const attr of element.templateAttrs) {
            if (attr instanceof t.TextAttribute) {
                ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, templateAttrFlags | BindingFlags.TextValue);
            }
            else {
                ingestBinding(unit, op.xref, attr.name, attr.value, attr.type, attr.unit, attr.securityContext, attr.sourceSpan, templateAttrFlags);
            }
        }
    }
    for (const attr of element.attributes) {
        // This is only attribute TextLiteral bindings, such as `attr.foo="bar"`. This can never be
        // `[attr.foo]="bar"` or `attr.foo="{{bar}}"`, both of which will be handled as inputs with
        // `BindingType.Attribute`.
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, flags | BindingFlags.TextValue);
    }
    for (const input of element.inputs) {
        ingestBinding(unit, op.xref, input.name, input.value, input.type, input.unit, input.securityContext, input.sourceSpan, flags);
    }
    for (const output of element.outputs) {
        let listenerOp;
        if (output.type === 1 /* e.ParsedEventType.Animation */) {
            if (output.phase === null) {
                throw Error('Animation listener should have a phase');
            }
        }
        if (element instanceof t.Template && !isPlainTemplate(element)) {
            unit.create.push(ir.createExtractedAttributeOp(op.xref, ir.BindingKind.Property, output.name, null));
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
function ingestBinding(view, xref, name, value, type, unit, securityContext, sourceSpan, flags) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (flags & BindingFlags.OnNgTemplateElement && !(flags & BindingFlags.BindingTargetsTemplate) &&
        type === 0 /* e.BindingType.Property */) {
        // This binding only exists for later const extraction, and is not an actual binding to be
        // created.
        view.create.push(ir.createExtractedAttributeOp(xref, ir.BindingKind.Property, name, null));
        return;
    }
    let expression;
    // TODO: We could easily generate source maps for subexpressions in these cases, but
    // TemplateDefinitionBuilder does not. Should we do so?
    if (value instanceof e.Interpolation) {
        expression = new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, view.job, null)));
    }
    else if (value instanceof e.AST) {
        expression = convertAst(value, view.job, null);
    }
    else {
        expression = value;
    }
    const kind = BINDING_KINDS.get(type);
    view.update.push(ir.createBindingOp(xref, kind, name, expression, unit, securityContext, !!(flags & BindingFlags.TextValue), !!(flags & BindingFlags.IsStructuralTemplateAttribute), sourceSpan));
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
            ingestBinding(unit, xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, BindingFlags.TextValue);
        }
        const tagName = root instanceof t.Element ? root.name : root.tagName;
        // Don't pass along `ng-template` tag name since it enables directive matching.
        return tagName === 'ng-template' ? null : tagName;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBRXBGLE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBZ0QsTUFBTSxlQUFlLENBQUM7QUFDaEksT0FBTyxFQUFDLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVwRixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQztBQUV6RTs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FDM0IsYUFBcUIsRUFBRSxRQUFrQixFQUFFLFlBQTBCLEVBQ3JFLHVCQUErQixFQUFFLGtCQUEyQixFQUM1RCxlQUEyRDtJQUM3RCxNQUFNLEdBQUcsR0FBRyxJQUFJLHVCQUF1QixDQUNuQyxhQUFhLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixF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QUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3BFO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFckUsK0VBQStFO1FBQy9FLE9BQU8sT0FBTyxLQUFLLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7S0FDbkQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgZSBmcm9tICcuLi8uLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7c3BsaXROc05hbWV9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQge1IzRGVmZXJCbG9ja01ldGFkYXRhfSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7aWN1RnJvbUkxOG5NZXNzYWdlLCBpc1NpbmdsZUkxOG5JY3V9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvdmlldy9pMThuL3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtCSU5BUllfT1BFUkFUT1JTLCBuYW1lc3BhY2VGb3JLZXksIHByZWZpeFdpdGhOYW1lc3BhY2V9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbmNvbnN0IGNvbXBhdGliaWxpdHlNb2RlID0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcjtcblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICogVE9ETzogUmVmYWN0b3IgbW9yZSBvZiB0aGUgaW5nZXN0aW9uIGNvZGUgaW50byBwaGFzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RDb21wb25lbnQoXG4gICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCB0ZW1wbGF0ZTogdC5Ob2RlW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbixcbiAgICBkZWZlckJsb2Nrc01ldGE6IE1hcDx0LkRlZmVycmVkQmxvY2ssIFIzRGVmZXJCbG9ja01ldGFkYXRhPik6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKFxuICAgICAgY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIGkxOG5Vc2VFeHRlcm5hbElkcyxcbiAgICAgIGRlZmVyQmxvY2tzTWV0YSk7XG4gIGluZ2VzdE5vZGVzKGpvYi5yb290LCB0ZW1wbGF0ZSk7XG4gIHJldHVybiBqb2I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9zdEJpbmRpbmdJbnB1dCB7XG4gIGNvbXBvbmVudE5hbWU6IHN0cmluZztcbiAgcHJvcGVydGllczogZS5QYXJzZWRQcm9wZXJ0eVtdfG51bGw7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBldmVudHM6IGUuUGFyc2VkRXZlbnRbXXxudWxsO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBob3N0IGJpbmRpbmcgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QmluZGluZyhcbiAgICBpbnB1dDogSG9zdEJpbmRpbmdJbnB1dCwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYihpbnB1dC5jb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlKTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBpbnB1dC5wcm9wZXJ0aWVzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdFByb3BlcnR5KGpvYiwgcHJvcGVydHksIGZhbHNlKTtcbiAgfVxuICBmb3IgKGNvbnN0IFtuYW1lLCBleHByXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dC5hdHRyaWJ1dGVzKSA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RBdHRyaWJ1dGUoam9iLCBuYW1lLCBleHByKTtcbiAgfVxuICBmb3IgKGNvbnN0IGV2ZW50IG9mIGlucHV0LmV2ZW50cyA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RFdmVudChqb2IsIGV2ZW50KTtcbiAgfVxuICByZXR1cm4gam9iO1xufVxuXG4vLyBUT0RPOiBXZSBzaG91bGQgcmVmYWN0b3IgdGhlIHBhcnNlciB0byB1c2UgdGhlIHNhbWUgdHlwZXMgYW5kIHN0cnVjdHVyZXMgZm9yIGhvc3QgYmluZGluZ3MgYXNcbi8vIHdpdGggb3JkaW5hcnkgY29tcG9uZW50cy4gVGhpcyB3b3VsZCBhbGxvdyB1cyB0byBzaGFyZSBhIGxvdCBtb3JlIGluZ2VzdGlvbiBjb2RlLlxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RQcm9wZXJ0eShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHByb3BlcnR5OiBlLlBhcnNlZFByb3BlcnR5LCBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBjb25zdCBhc3QgPSBwcm9wZXJ0eS5leHByZXNzaW9uLmFzdDtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgYXN0LnN0cmluZ3MsIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgcHJvcGVydHkuc291cmNlU3BhbikpKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdChhc3QsIGpvYiwgcHJvcGVydHkuc291cmNlU3Bhbik7XG4gIH1cbiAgbGV0IGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gIC8vIFRPRE86IHRoaXMgc2hvdWxkIHJlYWxseSBiZSBoYW5kbGVkIGluIHRoZSBwYXJzZXIuXG4gIGlmIChwcm9wZXJ0eS5uYW1lLnN0YXJ0c1dpdGgoJ2F0dHIuJykpIHtcbiAgICBwcm9wZXJ0eS5uYW1lID0gcHJvcGVydHkubmFtZS5zdWJzdHJpbmcoJ2F0dHIuJy5sZW5ndGgpO1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlO1xuICB9XG4gIGlmIChwcm9wZXJ0eS5pc0FuaW1hdGlvbikge1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uO1xuICB9XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGJpbmRpbmdLaW5kLCBwcm9wZXJ0eS5uYW1lLCBleHByZXNzaW9uLCBudWxsLFxuICAgICAgU2VjdXJpdHlDb250ZXh0XG4gICAgICAgICAgLk5PTkUgLyogVE9ETzogd2hhdCBzaG91bGQgd2UgcGFzcyBhcyBzZWN1cml0eSBjb250ZXh0PyBQYXNzaW5nIE5PTkUgZm9yIG5vdy4gKi8sXG4gICAgICBpc1RleHRBdHRyaWJ1dGUsIGZhbHNlLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QXR0cmlidXRlKFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBuYW1lLCB2YWx1ZSwgbnVsbCwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIHRydWUsIGZhbHNlLFxuICAgICAgLyogVE9ETzogaG9zdCBhdHRyaWJ1dGUgc291cmNlIHNwYW5zICovIG51bGwhKTtcbiAgam9iLnJvb3QudXBkYXRlLnB1c2goYXR0ckJpbmRpbmcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEV2ZW50KGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgZXZlbnQ6IGUuUGFyc2VkRXZlbnQpIHtcbiAgY29uc3QgZXZlbnRCaW5kaW5nID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIG5ldyBpci5TbG90SGFuZGxlKCksIGV2ZW50Lm5hbWUsIG51bGwsIGV2ZW50LnRhcmdldE9yUGhhc2UsIHRydWUsXG4gICAgICBldmVudC5zb3VyY2VTcGFuKTtcbiAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgYSBjaGFpbj9cbiAgZXZlbnRCaW5kaW5nLmhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQoXG4gICAgICBjb252ZXJ0QXN0KGV2ZW50LmhhbmRsZXIuYXN0LCBqb2IsIGV2ZW50LnNvdXJjZVNwYW4pLCBldmVudC5oYW5kbGVyU3BhbikpKTtcbiAgam9iLnJvb3QuY3JlYXRlLnB1c2goZXZlbnRCaW5kaW5nKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgdGhlIG5vZGVzIG9mIGEgdGVtcGxhdGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3ROb2Rlcyh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZW1wbGF0ZTogdC5Ob2RlW10pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBub2RlIG9mIHRlbXBsYXRlKSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIGluZ2VzdEVsZW1lbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgICAgaW5nZXN0VGVtcGxhdGUodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Db250ZW50KSB7XG4gICAgICBpbmdlc3RDb250ZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgaW5nZXN0VGV4dCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWZCbG9jaykge1xuICAgICAgaW5nZXN0SWZCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlN3aXRjaEJsb2NrKSB7XG4gICAgICBpbmdlc3RTd2l0Y2hCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkRlZmVycmVkQmxvY2spIHtcbiAgICAgIGluZ2VzdERlZmVyQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JY3UpIHtcbiAgICAgIGluZ2VzdEljdSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkZvckxvb3BCbG9jaykge1xuICAgICAgaW5nZXN0Rm9yQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZTogJHtub2RlLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGVsZW1lbnQgQVNUIGZyb20gdGhlIHRlbXBsYXRlIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RFbGVtZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGVsZW1lbnQ6IHQuRWxlbWVudCk6IHZvaWQge1xuICBpZiAoZWxlbWVudC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEoZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIGVsZW1lbnQ6ICR7ZWxlbWVudC5pMThuLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG5cbiAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcblxuICBjb25zdCBzdGFydE9wID0gaXIuY3JlYXRlRWxlbWVudFN0YXJ0T3AoXG4gICAgICBlbGVtZW50TmFtZSwgaWQsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VLZXkpLFxuICAgICAgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IGVsZW1lbnQuaTE4biA6IHVuZGVmaW5lZCxcbiAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChzdGFydE9wKTtcblxuICBpbmdlc3RCaW5kaW5ncyh1bml0LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0Tm9kZXModW5pdCwgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgLy8gVGhlIHNvdXJjZSBzcGFuIGZvciB0aGUgZW5kIG9wIGlzIHR5cGljYWxseSB0aGUgZWxlbWVudCBjbG9zaW5nIHRhZy4gSG93ZXZlciwgaWYgbm8gY2xvc2luZyB0YWdcbiAgLy8gZXhpc3RzLCBzdWNoIGFzIGluIGA8aW5wdXQ+YCwgd2UgdXNlIHRoZSBzdGFydCBzb3VyY2Ugc3BhbiBpbnN0ZWFkLiBVc3VhbGx5IHRoZSBzdGFydCBhbmQgZW5kXG4gIC8vIGluc3RydWN0aW9ucyB3aWxsIGJlIGNvbGxhcHNlZCBpbnRvIG9uZSBgZWxlbWVudGAgaW5zdHJ1Y3Rpb24sIG5lZ2F0aW5nIHRoZSBwdXJwb3NlIG9mIHRoaXNcbiAgLy8gZmFsbGJhY2ssIGJ1dCBpbiBjYXNlcyB3aGVuIGl0IGlzIG5vdCBjb2xsYXBzZWQgKHN1Y2ggYXMgYW4gaW5wdXQgd2l0aCBhIGJpbmRpbmcpLCB3ZSBzdGlsbFxuICAvLyB3YW50IHRvIG1hcCB0aGUgZW5kIGluc3RydWN0aW9uIHRvIHRoZSBtYWluIGVsZW1lbnQuXG4gIGNvbnN0IGVuZE9wID0gaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKGVuZE9wKTtcblxuICAvLyBJZiB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudCwgaW5zZXJ0IGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gIGlmIChlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBjb25zdCBpMThuQmxvY2tJZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVJMThuU3RhcnRPcChpMThuQmxvY2tJZCwgZWxlbWVudC5pMThuKSwgc3RhcnRPcCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oaXIuY3JlYXRlSTE4bkVuZE9wKGkxOG5CbG9ja0lkKSwgZW5kT3ApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBuZy10ZW1wbGF0ZWAgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRtcGw6IHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKHRtcGwuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciB0ZW1wbGF0ZTogJHt0bXBsLmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGxldCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9IHRtcGwudGFnTmFtZTtcbiAgbGV0IG5hbWVzcGFjZVByZWZpeDogc3RyaW5nfG51bGwgPSAnJztcbiAgaWYgKHRtcGwudGFnTmFtZSkge1xuICAgIFtuYW1lc3BhY2VQcmVmaXgsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlXSA9IHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyID8gdG1wbC5pMThuIDogdW5kZWZpbmVkO1xuICBjb25zdCBuYW1lc3BhY2UgPSBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlUHJlZml4KTtcbiAgY29uc3QgZnVuY3Rpb25OYW1lU3VmZml4ID0gdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UgPT09IG51bGwgP1xuICAgICAgJycgOlxuICAgICAgcHJlZml4V2l0aE5hbWVzcGFjZSh0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgbmFtZXNwYWNlKTtcbiAgY29uc3QgdHBsT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgY2hpbGRWaWV3LnhyZWYsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlLCBmdW5jdGlvbk5hbWVTdWZmaXgsIG5hbWVzcGFjZSwgaTE4blBsYWNlaG9sZGVyLFxuICAgICAgdG1wbC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRwbE9wKTtcblxuICBpbmdlc3RCaW5kaW5ncyh1bml0LCB0cGxPcCwgdG1wbCk7XG4gIGluZ2VzdFJlZmVyZW5jZXModHBsT3AsIHRtcGwpO1xuICBpbmdlc3ROb2RlcyhjaGlsZFZpZXcsIHRtcGwuY2hpbGRyZW4pO1xuXG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiB0bXBsLnZhcmlhYmxlcykge1xuICAgIGNoaWxkVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChuYW1lLCB2YWx1ZSAhPT0gJycgPyB2YWx1ZSA6ICckaW1wbGljaXQnKTtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSBwbGFpbiB0ZW1wbGF0ZSBhbmQgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCBpdCwgaW5zZXJ0IGkxOG4gc3RhcnRcbiAgLy8gYW5kIGVuZCBvcHMuIEZvciBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZXMsIHRoZSBpMThuIG9wcyB3aWxsIGJlIGFkZGVkIHdoZW4gaW5nZXN0aW5nIHRoZVxuICAvLyBlbGVtZW50L3RlbXBsYXRlIHRoZSBkaXJlY3RpdmUgaXMgcGxhY2VkIG9uLlxuICBpZiAoaXNQbGFpblRlbXBsYXRlKHRtcGwpICYmIHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biksIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBjb250ZW50LnNlbGVjdG9yLCBjb250ZW50LnNvdXJjZVNwYW4pO1xuICBmb3IgKGNvbnN0IGF0dHIgb2YgY29udGVudC5hdHRyaWJ1dGVzKSB7XG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKTtcbiAgfVxuICB1bml0LmNyZWF0ZS5wdXNoKG9wKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5UZXh0KTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0LCBpMThuUGxhY2Vob2xkZXJzPzogc3RyaW5nW10pOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGlmIChpMThuUGxhY2Vob2xkZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICBpMThuUGxhY2Vob2xkZXJzID0gdGV4dC5pMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIgP1xuICAgICAgICB0ZXh0LmkxOG4uY2hpbGRyZW5cbiAgICAgICAgICAgIC5maWx0ZXIoKG5vZGUpOiBub2RlIGlzIGkxOG4uUGxhY2Vob2xkZXIgPT4gbm9kZSBpbnN0YW5jZW9mIGkxOG4uUGxhY2Vob2xkZXIpXG4gICAgICAgICAgICAubWFwKHBsYWNlaG9sZGVyID0+IHBsYWNlaG9sZGVyLm5hbWUpIDpcbiAgICAgICAgW107XG4gIH1cbiAgaWYgKGkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoID4gMCAmJiBpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCAhPT0gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuZXhwZWN0ZWQgbnVtYmVyIG9mIGkxOG4gcGxhY2Vob2xkZXJzICgke1xuICAgICAgICB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGh9KSBmb3IgQm91bmRUZXh0IHdpdGggJHt2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGh9IGV4cHJlc3Npb25zYCk7XG4gIH1cblxuICBjb25zdCB0ZXh0WHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHRleHRYcmVmLCAnJywgdGV4dC5zb3VyY2VTcGFuKSk7XG4gIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgZG9lcyBub3QgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1Yi1leHByZXNzaW9ucyBpbnNpZGUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbi4gV2UgY29weSB0aGF0IGJlaGF2aW9yIGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgLy8gVE9ETzogaXMgaXQgYWN0dWFsbHkgY29ycmVjdCB0byBnZW5lcmF0ZSB0aGVzZSBleHRyYSBtYXBzIGluIG1vZGVybiBtb2RlP1xuICBjb25zdCBiYXNlU291cmNlU3BhbiA9IHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPyBudWxsIDogdGV4dC5zb3VyY2VTcGFuO1xuICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgICAgdGV4dFhyZWYsXG4gICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgICB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iLCBiYXNlU291cmNlU3BhbikpKSxcbiAgICAgIGkxOG5QbGFjZWhvbGRlcnMsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGlmYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0SWZCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpZkJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZkJsb2NrLmJyYW5jaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaWZDYXNlID0gaWZCbG9jay5icmFuY2hlc1tpXTtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGxldCB0YWdOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgICAvLyBPbmx5IHRoZSBmaXJzdCBicmFuY2ggY2FuIGJlIHVzZWQgZm9yIHByb2plY3Rpb24sIGJlY2F1c2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgLy8gdXNlcyB0aGUgY29udGFpbmVyIG9mIHRoZSBmaXJzdCBicmFuY2ggYXMgdGhlIGluc2VydGlvbiBwb2ludCBmb3IgYWxsIGJyYW5jaGVzLlxuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCBjVmlldy54cmVmLCBpZkNhc2UpO1xuICAgIH1cbiAgICBpZiAoaWZDYXNlLmV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgY1ZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoaWZDYXNlLmV4cHJlc3Npb25BbGlhcy5uYW1lLCBpci5DVFhfUkVGKTtcbiAgICB9XG4gICAgY29uc3QgdG1wbE9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgdGFnTmFtZSwgJ0NvbmRpdGlvbmFsJywgaXIuTmFtZXNwYWNlLkhUTUwsXG4gICAgICAgIHVuZGVmaW5lZCAvKiBUT0RPOiBmaWd1cmUgb3V0IGhvdyBpMThuIHdvcmtzIHdpdGggbmV3IGNvbnRyb2wgZmxvdyAqLywgaWZDYXNlLnNvdXJjZVNwYW4pO1xuICAgIHVuaXQuY3JlYXRlLnB1c2godG1wbE9wKTtcblxuICAgIGlmIChmaXJzdFhyZWYgPT09IG51bGwpIHtcbiAgICAgIGZpcnN0WHJlZiA9IGNWaWV3LnhyZWY7XG4gICAgICBmaXJzdFNsb3RIYW5kbGUgPSB0bXBsT3AuaGFuZGxlO1xuICAgIH1cblxuICAgIGNvbnN0IGNhc2VFeHByID0gaWZDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KGlmQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCkgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPVxuICAgICAgICBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdG1wbE9wLnhyZWYsIHRtcGxPcC5oYW5kbGUsIGlmQ2FzZS5leHByZXNzaW9uQWxpYXMpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgaWZDYXNlLmNoaWxkcmVuKTtcbiAgfVxuICBjb25zdCBjb25kaXRpb25hbCA9XG4gICAgICBpci5jcmVhdGVDb25kaXRpb25hbE9wKGZpcnN0WHJlZiEsIGZpcnN0U2xvdEhhbmRsZSEsIG51bGwsIGNvbmRpdGlvbnMsIGlmQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQHN3aXRjaGAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGZpcnN0U2xvdEhhbmRsZTogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3Qgc3dpdGNoQ2FzZSBvZiBzd2l0Y2hCbG9jay5jYXNlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgY29uc3QgdG1wbE9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgICAgY1ZpZXcueHJlZiwgbnVsbCwgJ0Nhc2UnLCBpci5OYW1lc3BhY2UuSFRNTCxcbiAgICAgICAgdW5kZWZpbmVkIC8qIFRPRE86IGZpZ3VyZSBvdXQgaG93IGkxOG4gd29ya3Mgd2l0aCBuZXcgY29udHJvbCBmbG93ICovLFxuICAgICAgICBzd2l0Y2hDYXNlLnNvdXJjZVNwYW4pO1xuICAgIHVuaXQuY3JlYXRlLnB1c2godG1wbE9wKTtcbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgICAgZmlyc3RTbG90SGFuZGxlID0gdG1wbE9wLmhhbmRsZTtcbiAgICB9XG4gICAgY29uc3QgY2FzZUV4cHIgPSBzd2l0Y2hDYXNlLmV4cHJlc3Npb24gP1xuICAgICAgICBjb252ZXJ0QXN0KHN3aXRjaENhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IsIHN3aXRjaEJsb2NrLnN0YXJ0U291cmNlU3BhbikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPSBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdG1wbE9wLnhyZWYsIHRtcGxPcC5oYW5kbGUpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgc3dpdGNoQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKFxuICAgICAgZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCksIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWZmaXg6IHN0cmluZywgY2hpbGRyZW4/OiB0Lk5vZGVbXSxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogaXIuVGVtcGxhdGVPcHxudWxsIHtcbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIG51bGwsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLCB1bmRlZmluZWQsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IGJsb2NrTWV0YSA9IHVuaXQuam9iLmRlZmVyQmxvY2tzTWV0YS5nZXQoZGVmZXJCbG9jayk7XG4gIGlmIChibG9ja01ldGEgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVuYWJsZSB0byBmaW5kIG1ldGFkYXRhIGZvciBkZWZlcnJlZCBibG9ja2ApO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIGRlZmVyIG1haW4gdmlldyBhbmQgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgbWFpbiA9IGluZ2VzdERlZmVyVmlldyh1bml0LCAnJywgZGVmZXJCbG9jay5jaGlsZHJlbiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKSE7XG4gIGNvbnN0IGxvYWRpbmcgPSBpbmdlc3REZWZlclZpZXcoXG4gICAgICB1bml0LCAnTG9hZGluZycsIGRlZmVyQmxvY2subG9hZGluZz8uY2hpbGRyZW4sIGRlZmVyQmxvY2subG9hZGluZz8uc291cmNlU3Bhbik7XG4gIGNvbnN0IHBsYWNlaG9sZGVyID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ1BsYWNlaG9sZGVyJywgZGVmZXJCbG9jay5wbGFjZWhvbGRlcj8uY2hpbGRyZW4sIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LnNvdXJjZVNwYW4pO1xuICBjb25zdCBlcnJvciA9XG4gICAgICBpbmdlc3REZWZlclZpZXcodW5pdCwgJ0Vycm9yJywgZGVmZXJCbG9jay5lcnJvcj8uY2hpbGRyZW4sIGRlZmVyQmxvY2suZXJyb3I/LnNvdXJjZVNwYW4pO1xuXG4gIC8vIENyZWF0ZSB0aGUgbWFpbiBkZWZlciBvcCwgYW5kIG9wcyBmb3IgYWxsIHNlY29uZGFyeSB2aWV3cy5cbiAgY29uc3QgZGVmZXJYcmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgY29uc3QgZGVmZXJPcCA9XG4gICAgICBpci5jcmVhdGVEZWZlck9wKGRlZmVyWHJlZiwgbWFpbi54cmVmLCBtYWluLmhhbmRsZSwgYmxvY2tNZXRhLCBkZWZlckJsb2NrLnNvdXJjZVNwYW4pO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyVmlldyA9IHBsYWNlaG9sZGVyPy54cmVmID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJTbG90ID0gcGxhY2Vob2xkZXI/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdTbG90ID0gbG9hZGluZz8uaGFuZGxlID8/IG51bGw7XG4gIGRlZmVyT3AuZXJyb3JTbG90ID0gZXJyb3I/LmhhbmRsZSA/PyBudWxsO1xuICBkZWZlck9wLnBsYWNlaG9sZGVyTWluaW11bVRpbWUgPSBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2subG9hZGluZz8ubWluaW11bVRpbWUgPz8gbnVsbDtcbiAgZGVmZXJPcC5sb2FkaW5nQWZ0ZXJUaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5hZnRlclRpbWUgPz8gbnVsbDtcbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wKTtcblxuICAvLyBDb25maWd1cmUgYWxsIGRlZmVyIGBvbmAgY29uZGl0aW9ucy5cbiAgLy8gVE9ETzogcmVmYWN0b3IgcHJlZmV0Y2ggdHJpZ2dlcnMgdG8gdXNlIGEgc2VwYXJhdGUgb3AgdHlwZSwgd2l0aCBhIHNoYXJlZCBzdXBlcmNsYXNzLiBUaGlzIHdpbGxcbiAgLy8gbWFrZSBpdCBlYXNpZXIgdG8gcmVmYWN0b3IgcHJlZmV0Y2ggYmVoYXZpb3IgaW4gdGhlIGZ1dHVyZS5cbiAgbGV0IHByZWZldGNoID0gZmFsc2U7XG4gIGxldCBkZWZlck9uT3BzOiBpci5EZWZlck9uT3BbXSA9IFtdO1xuICBsZXQgZGVmZXJXaGVuT3BzOiBpci5EZWZlcldoZW5PcFtdID0gW107XG4gIGZvciAoY29uc3QgdHJpZ2dlcnMgb2YgW2RlZmVyQmxvY2sudHJpZ2dlcnMsIGRlZmVyQmxvY2sucHJlZmV0Y2hUcmlnZ2Vyc10pIHtcbiAgICBpZiAodHJpZ2dlcnMuaWRsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlfSwgcHJlZmV0Y2gsIHRyaWdnZXJzLmlkbGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7a2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGV9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy5pbW1lZGlhdGUuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnRpbWVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LCBwcmVmZXRjaCxcbiAgICAgICAgICB0cmlnZ2Vycy50aW1lci5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaG92ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlcixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmhvdmVyLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgdHJpZ2dlcnMuaG92ZXIuc291cmNlU3Bhbik7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmludGVyYWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5pbnRlcmFjdGlvbi5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIHRyaWdnZXJzLmludGVyYWN0aW9uLnNvdXJjZVNwYW4pO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy52aWV3cG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMudmlld3BvcnQucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCB0cmlnZ2Vycy52aWV3cG9ydC5zb3VyY2VTcGFuKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMud2hlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlcldoZW5PcChcbiAgICAgICAgICBkZWZlclhyZWYsIGNvbnZlcnRBc3QodHJpZ2dlcnMud2hlbi52YWx1ZSwgdW5pdC5qb2IsIHRyaWdnZXJzLndoZW4uc291cmNlU3BhbiksIHByZWZldGNoLFxuICAgICAgICAgIHRyaWdnZXJzLndoZW4uc291cmNlU3Bhbik7XG4gICAgICBkZWZlcldoZW5PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cblxuICAgIC8vIElmIG5vIChub24tcHJlZmV0Y2hpbmcpIGRlZmVyIHRyaWdnZXJzIHdlcmUgcHJvdmlkZWQsIGRlZmF1bHQgdG8gYGlkbGVgLlxuICAgIGlmIChkZWZlck9uT3BzLmxlbmd0aCA9PT0gMCAmJiBkZWZlcldoZW5PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIGZhbHNlLCBudWxsISkpO1xuICAgIH1cbiAgICBwcmVmZXRjaCA9IHRydWU7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT25PcHMpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGRlZmVyV2hlbk9wcyk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdEljdSh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpY3U6IHQuSWN1KSB7XG4gIGlmIChpY3UuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBpc1NpbmdsZUkxOG5JY3UoaWN1LmkxOG4pKSB7XG4gICAgY29uc3QgeHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgY29uc3QgaWN1Tm9kZSA9IGljdS5pMThuLm5vZGVzWzBdO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSWN1U3RhcnRPcCh4cmVmLCBpY3UuaTE4biwgaWN1RnJvbUkxOG5NZXNzYWdlKGljdS5pMThuKS5uYW1lLCBudWxsISkpO1xuICAgIGNvbnN0IGV4cHJlc3Npb25QbGFjZWhvbGRlciA9IGljdU5vZGUuZXhwcmVzc2lvblBsYWNlaG9sZGVyPy50cmltRW5kKCk7XG4gICAgaWYgKGV4cHJlc3Npb25QbGFjZWhvbGRlciA9PT0gdW5kZWZpbmVkIHx8IGljdS52YXJzW2V4cHJlc3Npb25QbGFjZWhvbGRlcl0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgRXJyb3IoJ0lDVSBzaG91bGQgaGF2ZSBhIHRleHQgYmluZGluZycpO1xuICAgIH1cbiAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgaWN1LnZhcnNbZXhwcmVzc2lvblBsYWNlaG9sZGVyXSwgW2V4cHJlc3Npb25QbGFjZWhvbGRlcl0pO1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCB0ZXh0XSBvZiBPYmplY3QuZW50cmllcyhpY3UucGxhY2Vob2xkZXJzKSkge1xuICAgICAgaWYgKHRleHQgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgdGV4dCwgW3BsYWNlaG9sZGVyXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RUZXh0KHVuaXQsIHRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdUVuZE9wKHhyZWYpKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgSUNVOiAke2ljdS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAZm9yYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Rm9yQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZm9yQmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGNvbnN0IGNyZWF0ZVJlcGVhdGVyQWxpYXMgPSAoaWRlbnQ6IHN0cmluZywgcmVwZWF0ZXJWYXI6IGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5KSA9PiB7XG4gICAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGlkZW50aWZpZXI6IGlkZW50LFxuICAgICAgZXhwcmVzc2lvbjogbmV3IGlyLkRlcml2ZWRSZXBlYXRlclZhckV4cHIocmVwZWF0ZXJWaWV3LnhyZWYsIHJlcGVhdGVyVmFyKSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoXG4gICAgICBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRmlyc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuTGFzdCk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eS5FdmVuKTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuT2RkKTtcblxuICBjb25zdCBzb3VyY2VTcGFuID0gY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2sudHJhY2tCeS5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgY29uc3QgdHJhY2sgPSBjb252ZXJ0QXN0KGZvckJsb2NrLnRyYWNrQnksIHVuaXQuam9iLCBzb3VyY2VTcGFuKTtcblxuICBpbmdlc3ROb2RlcyhyZXBlYXRlclZpZXcsIGZvckJsb2NrLmNoaWxkcmVuKTtcblxuICBsZXQgZW1wdHlWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0fG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgfVxuXG4gIGNvbnN0IHZhck5hbWVzOiBpci5SZXBlYXRlclZhck5hbWVzID0ge1xuICAgICRpbmRleDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSxcbiAgICAkY291bnQ6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWUsXG4gICAgJGZpcnN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRmaXJzdC5uYW1lLFxuICAgICRsYXN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsXG4gICAgJGV2ZW46IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSxcbiAgICAkb2RkOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSxcbiAgICAkaW1wbGljaXQ6IGZvckJsb2NrLml0ZW0ubmFtZSxcbiAgfTtcblxuICBjb25zdCB0YWdOYW1lID0gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludCh1bml0LCByZXBlYXRlclZpZXcueHJlZiwgZm9yQmxvY2spO1xuICBjb25zdCByZXBlYXRlckNyZWF0ZSA9IGlyLmNyZWF0ZVJlcGVhdGVyQ3JlYXRlT3AoXG4gICAgICByZXBlYXRlclZpZXcueHJlZiwgZW1wdHlWaWV3Py54cmVmID8/IG51bGwsIHRhZ05hbWUsIHRyYWNrLCB2YXJOYW1lcywgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2gocmVwZWF0ZXJDcmVhdGUpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KFxuICAgICAgZm9yQmxvY2suZXhwcmVzc2lvbiwgdW5pdC5qb2IsXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihmb3JCbG9jay5leHByZXNzaW9uLnNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pKTtcbiAgY29uc3QgcmVwZWF0ZXIgPSBpci5jcmVhdGVSZXBlYXRlck9wKFxuICAgICAgcmVwZWF0ZXJDcmVhdGUueHJlZiwgcmVwZWF0ZXJDcmVhdGUuaGFuZGxlLCBleHByZXNzaW9uLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChyZXBlYXRlcik7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRlbXBsYXRlIEFTVCBleHByZXNzaW9uIGludG8gYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXN0KFxuICAgIGFzdDogZS5BU1QsIGpvYjogQ29tcGlsYXRpb25Kb2IsIGJhc2VTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuYXN0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5UmVhZCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIgJiYgIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lLCBudWxsLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5V3JpdGUpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihcbiAgICAgICAgICAvLyBUT0RPOiBJcyBpdCBjb3JyZWN0IHRvIGFsd2F5cyB1c2UgdGhlIHJvb3QgY29udGV4dCBpbiBwbGFjZSBvZiB0aGUgaW1wbGljaXQgcmVjZWl2ZXI/XG4gICAgICAgICAgbmV3IGlyLkNvbnRleHRFeHByKGpvYi5yb290LnhyZWYpLCBhc3QubmFtZSwgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIG51bGwsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRXcml0ZSkge1xuICAgIHJldHVybiBuZXcgby5Xcml0ZUtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2FsbCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBJbXBsaWNpdFJlY2VpdmVyYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSwgdW5kZWZpbmVkLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKGFzdC52YWx1ZSwgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgb3BlcmF0b3IsIGNvbnZlcnRBc3QoYXN0LmxlZnQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yaWdodCwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgY29udGV4dCBleHByZXNzaW9ucyBoYXZlIHNvdXJjZSBtYXBzP1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQ2hhaW4gaW4gdW5rbm93biBjb250ZXh0YCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsTWFwKSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5rZXlzLm1hcCgoa2V5LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlc1tpZHhdO1xuICAgICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZ1xuICAgICAgLy8gZXhwcmVzc2lvbj9cbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LmtleSwgY29udmVydEFzdCh2YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIGtleS5xdW90ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRXhwcihlbnRyaWVzLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbEFycmF5KSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZyBleHByZXNzaW9uP1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFxuICAgICAgICBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5jb25kaXRpb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC50cnVlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIC8vIFRPRE86IHBpcGVzIHNob3VsZCBwcm9iYWJseSBoYXZlIHNvdXJjZSBtYXBzOyBmaWd1cmUgb3V0IGRldGFpbHMuXG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoXG4gICAgICAgIGpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBuZXcgaXIuU2xvdEhhbmRsZSgpLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgW1xuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgLi4uYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICBdLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZVByb3BlcnR5UmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlQ2FsbCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGFzdC5hcmdzLm1hcChhID0+IGNvbnZlcnRBc3QoYSwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIGV4cHJlc3Npb24gdHlwZSBcIiR7YXN0LmNvbnN0cnVjdG9yLm5hbWV9XCIgaW4gZmlsZSBcIiR7XG4gICAgICAgIGJhc2VTb3VyY2VTcGFuPy5zdGFydC5maWxlLnVybH1cImApO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHRlbXBsYXRlIGlzIGEgcGxhaW4gbmctdGVtcGxhdGUgKGFzIG9wcG9zZWQgdG8gYW5vdGhlciBraW5kIG9mIHRlbXBsYXRlXG4gKiBzdWNoIGFzIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgdGVtcGxhdGUgb3IgY29udHJvbCBmbG93IHRlbXBsYXRlKS4gVGhpcyBpcyBjaGVja2VkIGJhc2VkIG9uIHRoZVxuICogdGFnTmFtZS4gV2UgY2FuIGV4cGVjdCB0aGF0IG9ubHkgcGxhaW4gbmctdGVtcGxhdGVzIHdpbGwgY29tZSB0aHJvdWdoIHdpdGggYSB0YWdOYW1lIG9mXG4gKiAnbmctdGVtcGxhdGUnLlxuICpcbiAqIEhlcmUgYXJlIHNvbWUgb2YgdGhlIGNhc2VzIHdlIGV4cGVjdDpcbiAqXG4gKiB8IEFuZ3VsYXIgSFRNTCAgICAgICAgICAgICAgICAgICAgICAgfCBUZW1wbGF0ZSB0YWdOYW1lICAgfFxuICogfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHwgLS0tLS0tLS0tLS0tLS0tLS0tIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8ZGl2ICpuZ0lmPVwidHJ1ZVwiPmAgICAgICAgICAgICAgICB8ICdkaXYnICAgICAgICAgICAgICB8XG4gKiB8IGA8c3ZnPjxuZy10ZW1wbGF0ZT5gICAgICAgICAgICAgICAgfCAnc3ZnOm5nLXRlbXBsYXRlJyAgfFxuICogfCBgQGlmICh0cnVlKSB7YCAgICAgICAgICAgICAgICAgICAgIHwgJ0NvbmRpdGlvbmFsJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChwbGFpbikgICAgICB8ICduZy10ZW1wbGF0ZScgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAoc3RydWN0dXJhbCkgfCBudWxsICAgICAgICAgICAgICAgfFxuICovXG5mdW5jdGlvbiBpc1BsYWluVGVtcGxhdGUodG1wbDogdC5UZW1wbGF0ZSkge1xuICByZXR1cm4gc3BsaXROc05hbWUodG1wbC50YWdOYW1lID8/ICcnKVsxXSA9PT0gJ25nLXRlbXBsYXRlJztcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgYmluZGluZ3Mgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IHRoZW1cbiAqIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RCaW5kaW5ncyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgbGV0IGZsYWdzOiBCaW5kaW5nRmxhZ3MgPSBCaW5kaW5nRmxhZ3MuTm9uZTtcbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgZmxhZ3MgfD0gQmluZGluZ0ZsYWdzLk9uTmdUZW1wbGF0ZUVsZW1lbnQ7XG4gICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGlzUGxhaW5UZW1wbGF0ZShlbGVtZW50KSkge1xuICAgICAgZmxhZ3MgfD0gQmluZGluZ0ZsYWdzLkJpbmRpbmdUYXJnZXRzVGVtcGxhdGU7XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcGxhdGVBdHRyRmxhZ3MgPVxuICAgICAgICBmbGFncyB8IEJpbmRpbmdGbGFncy5CaW5kaW5nVGFyZ2V0c1RlbXBsYXRlIHwgQmluZGluZ0ZsYWdzLklzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlO1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LnRlbXBsYXRlQXR0cnMpIHtcbiAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgdC5UZXh0QXR0cmlidXRlKSB7XG4gICAgICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgICAgICB1bml0LCBvcC54cmVmLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIG51bGwsXG4gICAgICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCB0ZW1wbGF0ZUF0dHJGbGFncyB8IEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgYXR0ci52YWx1ZSwgYXR0ci50eXBlLCBhdHRyLnVuaXQsIGF0dHIuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgICAgYXR0ci5zb3VyY2VTcGFuLCB0ZW1wbGF0ZUF0dHJGbGFncyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIC8vIFRoaXMgaXMgb25seSBhdHRyaWJ1dGUgVGV4dExpdGVyYWwgYmluZGluZ3MsIHN1Y2ggYXMgYGF0dHIuZm9vPVwiYmFyXCJgLiBUaGlzIGNhbiBuZXZlciBiZVxuICAgIC8vIGBbYXR0ci5mb29dPVwiYmFyXCJgIG9yIGBhdHRyLmZvbz1cInt7YmFyfX1cImAsIGJvdGggb2Ygd2hpY2ggd2lsbCBiZSBoYW5kbGVkIGFzIGlucHV0cyB3aXRoXG4gICAgLy8gYEJpbmRpbmdUeXBlLkF0dHJpYnV0ZWAuXG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCBmbGFncyB8IEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpO1xuICB9XG4gIGZvciAoY29uc3QgaW5wdXQgb2YgZWxlbWVudC5pbnB1dHMpIHtcbiAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBpbnB1dC5uYW1lLCBpbnB1dC52YWx1ZSwgaW5wdXQudHlwZSwgaW5wdXQudW5pdCwgaW5wdXQuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICBpbnB1dC5zb3VyY2VTcGFuLCBmbGFncyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG91dHB1dCBvZiBlbGVtZW50Lm91dHB1dHMpIHtcbiAgICBsZXQgbGlzdGVuZXJPcDogaXIuTGlzdGVuZXJPcDtcbiAgICBpZiAob3V0cHV0LnR5cGUgPT09IGUuUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgaWYgKG91dHB1dC5waGFzZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQW5pbWF0aW9uIGxpc3RlbmVyIHNob3VsZCBoYXZlIGEgcGhhc2UnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgIWlzUGxhaW5UZW1wbGF0ZShlbGVtZW50KSkge1xuICAgICAgdW5pdC5jcmVhdGUucHVzaChcbiAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChvcC54cmVmLCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3V0cHV0Lm5hbWUsIG51bGwpKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxpc3RlbmVyT3AgPSBpci5jcmVhdGVMaXN0ZW5lck9wKFxuICAgICAgICBvcC54cmVmLCBvcC5oYW5kbGUsIG91dHB1dC5uYW1lLCBvcC50YWcsIG91dHB1dC5waGFzZSwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKTtcblxuICAgIC8vIGlmIG91dHB1dC5oYW5kbGVyIGlzIGEgY2hhaW4sIHRoZW4gcHVzaCBlYWNoIHN0YXRlbWVudCBmcm9tIHRoZSBjaGFpbiBzZXBhcmF0ZWx5LCBhbmRcbiAgICAvLyByZXR1cm4gdGhlIGxhc3Qgb25lP1xuICAgIGxldCBoYW5kbGVyRXhwcnM6IGUuQVNUW107XG4gICAgbGV0IGhhbmRsZXI6IGUuQVNUID0gb3V0cHV0LmhhbmRsZXI7XG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmFzdDtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IGhhbmRsZXIuZXhwcmVzc2lvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IFtoYW5kbGVyXTtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlckV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBoYW5kbGVyRXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgb3V0cHV0LmhhbmRsZXJTcGFuKSk7XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcblxuICAgIGZvciAoY29uc3QgZXhwciBvZiBleHByZXNzaW9ucykge1xuICAgICAgY29uc3Qgc3RtdE9wID1cbiAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4obmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBleHByLnNvdXJjZVNwYW4pKTtcbiAgICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKHN0bXRPcCk7XG4gICAgfVxuICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKFxuICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwciwgcmV0dXJuRXhwci5zb3VyY2VTcGFuKSkpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2gobGlzdGVuZXJPcCk7XG4gIH1cbn1cblxuY29uc3QgQklORElOR19LSU5EUyA9IG5ldyBNYXA8ZS5CaW5kaW5nVHlwZSwgaXIuQmluZGluZ0tpbmQ+KFtcbiAgW2UuQmluZGluZ1R5cGUuUHJvcGVydHksIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGVdLFxuICBbZS5CaW5kaW5nVHlwZS5DbGFzcywgaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lXSxcbiAgW2UuQmluZGluZ1R5cGUuU3R5bGUsIGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BbmltYXRpb24sIGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbl0sXG5dKTtcblxuZW51bSBCaW5kaW5nRmxhZ3Mge1xuICBOb25lID0gMGIwMDAsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGlzIHRvIGEgc3RhdGljIHRleHQgbGl0ZXJhbCBhbmQgbm90IHRvIGFuIGV4cHJlc3Npb24uXG4gICAqL1xuICBUZXh0VmFsdWUgPSAwYjAwMDEsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGJlbG9uZ3MgdG8gdGhlIGA8bmctdGVtcGxhdGU+YCBzaWRlIG9mIGEgYHQuVGVtcGxhdGVgLlxuICAgKi9cbiAgQmluZGluZ1RhcmdldHNUZW1wbGF0ZSA9IDBiMDAxMCxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgaXMgb24gYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS5cbiAgICovXG4gIElzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlID0gMGIwMTAwLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBpcyBvbiBhIGB0LlRlbXBsYXRlYC5cbiAgICovXG4gIE9uTmdUZW1wbGF0ZUVsZW1lbnQgPSAwYjEwMDAsXG59XG5cbmZ1bmN0aW9uIGluZ2VzdEJpbmRpbmcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBlLkFTVHxvLkV4cHJlc3Npb24sXG4gICAgdHlwZTogZS5CaW5kaW5nVHlwZSwgdW5pdDogc3RyaW5nfG51bGwsIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZmxhZ3M6IEJpbmRpbmdGbGFncyk6IHZvaWQge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmFzdDtcbiAgfVxuXG4gIGlmIChmbGFncyAmIEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50ICYmICEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSkgJiZcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAvLyBUaGlzIGJpbmRpbmcgb25seSBleGlzdHMgZm9yIGxhdGVyIGNvbnN0IGV4dHJhY3Rpb24sIGFuZCBpcyBub3QgYW4gYWN0dWFsIGJpbmRpbmcgdG8gYmVcbiAgICAvLyBjcmVhdGVkLlxuICAgIHZpZXcuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoeHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG5hbWUsIG51bGwpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIC8vIFRPRE86IFdlIGNvdWxkIGVhc2lseSBnZW5lcmF0ZSBzb3VyY2UgbWFwcyBmb3Igc3ViZXhwcmVzc2lvbnMgaW4gdGhlc2UgY2FzZXMsIGJ1dFxuICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90LiBTaG91bGQgd2UgZG8gc28/XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LmpvYiwgbnVsbCkpKTtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUKSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QodmFsdWUsIHZpZXcuam9iLCBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gdmFsdWU7XG4gIH1cblxuICBjb25zdCBraW5kOiBpci5CaW5kaW5nS2luZCA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcbiAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICB4cmVmLCBraW5kLCBuYW1lLCBleHByZXNzaW9uLCB1bml0LCBzZWN1cml0eUNvbnRleHQsICEhKGZsYWdzICYgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSksXG4gICAgICAhIShmbGFncyAmIEJpbmRpbmdGbGFncy5Jc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSksIHNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgbG9jYWwgcmVmZXJlbmNlcyBvbiBhbiBlbGVtZW50LWxpa2Ugc3RydWN0dXJlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kXG4gKiBjb252ZXJ0IHRoZW0gdG8gdGhlaXIgSVIgcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFJlZmVyZW5jZXMob3A6IGlyLkVsZW1lbnRPcEJhc2UsIGVsZW1lbnQ6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGFzc2VydElzQXJyYXk8aXIuTG9jYWxSZWY+KG9wLmxvY2FsUmVmcyk7XG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiBlbGVtZW50LnJlZmVyZW5jZXMpIHtcbiAgICBvcC5sb2NhbFJlZnMucHVzaCh7XG4gICAgICBuYW1lLFxuICAgICAgdGFyZ2V0OiB2YWx1ZSxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSBnaXZlbiB2YWx1ZSBpcyBhbiBhcnJheS5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0SXNBcnJheTxUPih2YWx1ZTogYW55KTogYXNzZXJ0cyB2YWx1ZSBpcyBBcnJheTxUPiB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBhbiBhcnJheWApO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhYnNvbHV0ZSBgUGFyc2VTb3VyY2VTcGFuYCBmcm9tIHRoZSByZWxhdGl2ZSBgUGFyc2VTcGFuYC5cbiAqXG4gKiBgUGFyc2VTcGFuYCBvYmplY3RzIGFyZSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGV4cHJlc3Npb24uXG4gKiBUaGlzIG1ldGhvZCBjb252ZXJ0cyB0aGVzZSB0byBmdWxsIGBQYXJzZVNvdXJjZVNwYW5gIG9iamVjdHMgdGhhdFxuICogc2hvdyB3aGVyZSB0aGUgc3BhbiBpcyB3aXRoaW4gdGhlIG92ZXJhbGwgc291cmNlIGZpbGUuXG4gKlxuICogQHBhcmFtIHNwYW4gdGhlIHJlbGF0aXZlIHNwYW4gdG8gY29udmVydC5cbiAqIEBwYXJhbSBiYXNlU291cmNlU3BhbiBhIHNwYW4gY29ycmVzcG9uZGluZyB0byB0aGUgYmFzZSBvZiB0aGUgZXhwcmVzc2lvbiB0cmVlLlxuICogQHJldHVybnMgYSBgUGFyc2VTb3VyY2VTcGFuYCBmb3IgdGhlIGdpdmVuIHNwYW4gb3IgbnVsbCBpZiBubyBgYmFzZVNvdXJjZVNwYW5gIHdhcyBwcm92aWRlZC5cbiAqL1xuZnVuY3Rpb24gY29udmVydFNvdXJjZVNwYW4oXG4gICAgc3BhbjogZS5QYXJzZVNwYW4sIGJhc2VTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFBhcnNlU291cmNlU3BhbnxudWxsIHtcbiAgaWYgKGJhc2VTb3VyY2VTcGFuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc3RhcnQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIGNvbnN0IGVuZCA9IGJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLmVuZCk7XG4gIGNvbnN0IGZ1bGxTdGFydCA9IGJhc2VTb3VyY2VTcGFuLmZ1bGxTdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQsIGZ1bGxTdGFydCk7XG59XG5cbi8qKlxuICogV2l0aCB0aGUgZGlyZWN0aXZlLWJhc2VkIGNvbnRyb2wgZmxvdyB1c2VycyB3ZXJlIGFibGUgdG8gY29uZGl0aW9uYWxseSBwcm9qZWN0IGNvbnRlbnQgdXNpbmdcbiAqIHRoZSBgKmAgc3ludGF4LiBFLmcuIGA8ZGl2ICpuZ0lmPVwiZXhwclwiIHByb2plY3RNZT48L2Rpdj5gIHdpbGwgYmUgcHJvamVjdGVkIGludG9cbiAqIGA8bmctY29udGVudCBzZWxlY3Q9XCJbcHJvamVjdE1lXVwiLz5gLCBiZWNhdXNlIHRoZSBhdHRyaWJ1dGVzIGFuZCB0YWcgbmFtZSBmcm9tIHRoZSBgZGl2YCBhcmVcbiAqIGNvcGllZCB0byB0aGUgdGVtcGxhdGUgdmlhIHRoZSB0ZW1wbGF0ZSBjcmVhdGlvbiBpbnN0cnVjdGlvbi4gV2l0aCBgQGlmYCBhbmQgYEBmb3JgIHRoYXQgaXNcbiAqIG5vdCB0aGUgY2FzZSwgYmVjYXVzZSB0aGUgY29uZGl0aW9uYWwgaXMgcGxhY2VkICphcm91bmQqIGVsZW1lbnRzLCByYXRoZXIgdGhhbiAqb24qIHRoZW0uXG4gKiBUaGUgcmVzdWx0IGlzIHRoYXQgY29udGVudCBwcm9qZWN0aW9uIHdvbid0IHdvcmsgaW4gdGhlIHNhbWUgd2F5IGlmIGEgdXNlciBjb252ZXJ0cyBmcm9tXG4gKiBgKm5nSWZgIHRvIGBAaWZgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gYWltcyB0byBjb3ZlciB0aGUgbW9zdCBjb21tb24gY2FzZSBieSBkb2luZyB0aGUgc2FtZSBjb3B5aW5nIHdoZW4gYSBjb250cm9sIGZsb3dcbiAqIG5vZGUgaGFzICpvbmUgYW5kIG9ubHkgb25lKiByb290IGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZS5cbiAqXG4gKiBUaGlzIGFwcHJvYWNoIGNvbWVzIHdpdGggc29tZSBjYXZlYXRzOlxuICogMS4gQXMgc29vbiBhcyBhbnkgb3RoZXIgbm9kZSBpcyBhZGRlZCB0byB0aGUgcm9vdCwgdGhlIGNvcHlpbmcgYmVoYXZpb3Igd29uJ3Qgd29yayBhbnltb3JlLlxuICogICAgQSBkaWFnbm9zdGljIHdpbGwgYmUgYWRkZWQgdG8gZmxhZyBjYXNlcyBsaWtlIHRoaXMgYW5kIHRvIGV4cGxhaW4gaG93IHRvIHdvcmsgYXJvdW5kIGl0LlxuICogMi4gSWYgYHByZXNlcnZlV2hpdGVzcGFjZXNgIGlzIGVuYWJsZWQsIGl0J3MgdmVyeSBsaWtlbHkgdGhhdCBpbmRlbnRhdGlvbiB3aWxsIGJyZWFrIHRoaXNcbiAqICAgIHdvcmthcm91bmQsIGJlY2F1c2UgaXQnbGwgaW5jbHVkZSBhbiBhZGRpdGlvbmFsIHRleHQgbm9kZSBhcyB0aGUgZmlyc3QgY2hpbGQuIFdlIGNhbiB3b3JrXG4gKiAgICBhcm91bmQgaXQgaGVyZSwgYnV0IGluIGEgZGlzY3Vzc2lvbiBpdCB3YXMgZGVjaWRlZCBub3QgdG8sIGJlY2F1c2UgdGhlIHVzZXIgZXhwbGljaXRseSBvcHRlZFxuICogICAgaW50byBwcmVzZXJ2aW5nIHRoZSB3aGl0ZXNwYWNlIGFuZCB3ZSB3b3VsZCBoYXZlIHRvIGRyb3AgaXQgZnJvbSB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKiAgICBUaGUgZGlhZ25vc3RpYyBtZW50aW9uZWQgcG9pbnQgIzEgd2lsbCBmbGFnIHN1Y2ggY2FzZXMgdG8gdXNlcnMuXG4gKlxuICogQHJldHVybnMgVGFnIG5hbWUgdG8gYmUgdXNlZCBmb3IgdGhlIGNvbnRyb2wgZmxvdyB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Q29udHJvbEZsb3dJbnNlcnRpb25Qb2ludChcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB4cmVmOiBpci5YcmVmSWQsIG5vZGU6IHQuSWZCbG9ja0JyYW5jaHx0LkZvckxvb3BCbG9jayk6IHN0cmluZ3xudWxsIHtcbiAgbGV0IHJvb3Q6IHQuRWxlbWVudHx0LlRlbXBsYXRlfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgIC8vIFNraXAgb3ZlciBjb21tZW50IG5vZGVzLlxuICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuQ29tbWVudCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gV2UgY2FuIG9ubHkgaW5mZXIgdGhlIHRhZyBuYW1lL2F0dHJpYnV0ZXMgaWYgdGhlcmUncyBhIHNpbmdsZSByb290IG5vZGUuXG4gICAgaWYgKHJvb3QgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFJvb3Qgbm9kZXMgY2FuIG9ubHkgZWxlbWVudHMgb3IgdGVtcGxhdGVzIHdpdGggYSB0YWcgbmFtZSAoZS5nLiBgPGRpdiAqZm9vPjwvZGl2PmApLlxuICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIHQuRWxlbWVudCB8fCAoY2hpbGQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGNoaWxkLnRhZ05hbWUgIT09IG51bGwpKSB7XG4gICAgICByb290ID0gY2hpbGQ7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgd2UndmUgZm91bmQgYSBzaW5nbGUgcm9vdCBub2RlLCBpdHMgdGFnIG5hbWUgYW5kICpzdGF0aWMqIGF0dHJpYnV0ZXMgY2FuIGJlIGNvcGllZFxuICAvLyB0byB0aGUgc3Vycm91bmRpbmcgdGVtcGxhdGUgdG8gYmUgdXNlZCBmb3IgY29udGVudCBwcm9qZWN0aW9uLiBOb3RlIHRoYXQgaXQncyBpbXBvcnRhbnRcbiAgLy8gdGhhdCB3ZSBkb24ndCBjb3B5IGFueSBib3VuZCBhdHRyaWJ1dGVzIHNpbmNlIHRoZXkgZG9uJ3QgcGFydGljaXBhdGUgaW4gY29udGVudCBwcm9qZWN0aW9uXG4gIC8vIGFuZCB0aGV5IGNhbiBiZSB1c2VkIGluIGRpcmVjdGl2ZSBtYXRjaGluZyAoaW4gdGhlIGNhc2Ugb2YgYFRlbXBsYXRlLnRlbXBsYXRlQXR0cnNgKS5cbiAgaWYgKHJvb3QgIT09IG51bGwpIHtcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygcm9vdC5hdHRyaWJ1dGVzKSB7XG4gICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgIHVuaXQsIHhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKTtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lID0gcm9vdCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IHJvb3QubmFtZSA6IHJvb3QudGFnTmFtZTtcblxuICAgIC8vIERvbid0IHBhc3MgYWxvbmcgYG5nLXRlbXBsYXRlYCB0YWcgbmFtZSBzaW5jZSBpdCBlbmFibGVzIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICByZXR1cm4gdGFnTmFtZSA9PT0gJ25nLXRlbXBsYXRlJyA/IG51bGwgOiB0YWdOYW1lO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG4iXX0=