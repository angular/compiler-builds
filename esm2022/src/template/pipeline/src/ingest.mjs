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
import * as ir from '../ir';
import { ComponentCompilationJob, HostBindingCompilationJob } from './compilation';
import { BINARY_OPERATORS, namespaceForKey } from './conversion';
const compatibilityMode = ir.CompatibilityMode.TemplateDefinitionBuilder;
/**
 * Process a template AST and convert it into a `ComponentCompilation` in the intermediate
 * representation.
 * TODO: Refactor more of the ingestion code into phases.
 */
export function ingestComponent(componentName, template, constantPool, relativeContextFilePath, i18nUseExternalIds) {
    const cpl = new ComponentCompilationJob(componentName, constantPool, compatibilityMode, relativeContextFilePath, i18nUseExternalIds);
    ingestNodes(cpl.root, template);
    return cpl;
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
    const staticAttributes = {};
    for (const attr of element.attributes) {
        staticAttributes[attr.name] = attr.value;
    }
    const id = unit.job.allocateXrefId();
    const [namespaceKey, elementName] = splitNsName(element.name);
    const startOp = ir.createElementStartOp(elementName, id, namespaceForKey(namespaceKey), element.i18n instanceof i18n.TagPlaceholder ? element.i18n : undefined, element.startSourceSpan);
    unit.create.push(startOp);
    ingestBindings(unit, startOp, element);
    ingestReferences(startOp, element);
    ingestNodes(unit, element.children);
    const endOp = ir.createElementEndOp(id, element.endSourceSpan);
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
    const tplOp = ir.createTemplateOp(childView.xref, tagNameWithoutNamespace, namespaceForKey(namespacePrefix), false, i18nPlaceholder, tmpl.startSourceSpan);
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
function ingestBoundText(unit, text) {
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
        text.i18n.children.filter((node) => node instanceof i18n.Placeholder) :
        [];
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
    for (const ifCase of ifBlock.branches) {
        const cView = unit.job.allocateView(unit.xref);
        if (ifCase.expressionAlias !== null) {
            cView.contextVariables.set(ifCase.expressionAlias.name, ir.CTX_REF);
        }
        const tmplOp = ir.createTemplateOp(cView.xref, 'Conditional', ir.Namespace.HTML, true, undefined /* TODO: figure out how i18n works with new control flow */, ifCase.sourceSpan);
        unit.create.push(tmplOp);
        if (firstXref === null) {
            firstXref = cView.xref;
            firstSlotHandle = tmplOp.slot;
        }
        const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, tmplOp.xref, tmplOp.slot, ifCase.expressionAlias);
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
        const tmplOp = ir.createTemplateOp(cView.xref, 'Case', ir.Namespace.HTML, true, undefined /* TODO: figure out how i18n works with new control flow */, switchCase.sourceSpan);
        unit.create.push(tmplOp);
        if (firstXref === null) {
            firstXref = cView.xref;
            firstSlotHandle = tmplOp.slot;
        }
        const caseExpr = switchCase.expression ?
            convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan) :
            null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, tmplOp.xref, tmplOp.slot);
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
    const templateOp = ir.createTemplateOp(secondaryView.xref, `Defer${suffix}`, ir.Namespace.HTML, true, undefined, sourceSpan);
    unit.create.push(templateOp);
    return templateOp;
}
function ingestDeferBlock(unit, deferBlock) {
    // Generate the defer main view and all secondary views.
    const main = ingestDeferView(unit, '', deferBlock.children, deferBlock.sourceSpan);
    const loading = ingestDeferView(unit, 'Loading', deferBlock.loading?.children, deferBlock.loading?.sourceSpan);
    const placeholder = ingestDeferView(unit, 'Placeholder', deferBlock.placeholder?.children, deferBlock.placeholder?.sourceSpan);
    const error = ingestDeferView(unit, 'Error', deferBlock.error?.children, deferBlock.error?.sourceSpan);
    // Create the main defer op, and ops for all secondary views.
    const deferXref = unit.job.allocateXrefId();
    const deferOp = ir.createDeferOp(deferXref, main.xref, main.slot, deferBlock.sourceSpan);
    deferOp.placeholderView = placeholder?.xref ?? null;
    deferOp.placeholderSlot = placeholder?.slot ?? null;
    deferOp.loadingSlot = loading?.slot ?? null;
    deferOp.errorSlot = error?.slot ?? null;
    deferOp.placeholderMinimumTime = deferBlock.placeholder?.minimumTime ?? null;
    deferOp.loadingMinimumTime = deferBlock.loading?.minimumTime ?? null;
    deferOp.loadingAfterTime = deferBlock.loading?.afterTime ?? null;
    unit.create.push(deferOp);
    // Configure all defer `on` conditions.
    // TODO: refactor prefetch triggers to use a separate op type, with a shared superclass. This will
    // make it easier to refactor prefetch behavior in the future.
    let prefetch = false;
    let deferOnOps = [];
    for (const triggers of [deferBlock.triggers, deferBlock.prefetchTriggers]) {
        if (triggers.idle !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Idle }, prefetch, null);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.immediate !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Immediate }, prefetch, null);
            deferOnOps.push(deferOnOp);
        }
        if (triggers.timer !== undefined) {
            const deferOnOp = ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Timer, delay: triggers.timer.delay }, prefetch, null);
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
            }, prefetch, null);
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
            }, prefetch, null);
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
            }, prefetch, null);
            deferOnOps.push(deferOnOp);
        }
        // If no (non-prefetching) defer triggers were provided, default to `idle`.
        if (deferOnOps.length === 0) {
            deferOnOps.push(ir.createDeferOnOp(deferXref, { kind: ir.DeferTriggerKind.Idle }, false, null));
        }
        prefetch = true;
    }
    unit.create.push(deferOnOps);
}
function ingestIcu(unit, icu) {
    if (icu.i18n instanceof i18n.Message) {
        const xref = unit.job.allocateXrefId();
        unit.create.push(ir.createIcuOp(xref, icu.i18n, null));
        unit.update.push(ir.createIcuUpdateOp(xref, null));
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
    const repeaterCreate = ir.createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, track, varNames, forBlock.sourceSpan);
    unit.create.push(repeaterCreate);
    const expression = convertAst(forBlock.expression, unit.job, convertSourceSpan(forBlock.expression.span, forBlock.sourceSpan));
    const repeater = ir.createRepeaterOp(repeaterCreate.xref, repeaterCreate.slot, expression, forBlock.sourceSpan);
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
        throw new Error(`Unhandled expression type: ${ast.constructor.name}`);
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
        listenerOp = ir.createListenerOp(op.xref, op.slot, output.name, op.tag, output.phase, false, output.sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFDLHVCQUF1QixFQUFFLHlCQUF5QixFQUFnRCxNQUFNLGVBQWUsQ0FBQztBQUNoSSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsZUFBZSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRS9ELE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDO0FBRXpFOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUMzQixhQUFxQixFQUFFLFFBQWtCLEVBQUUsWUFBMEIsRUFDckUsdUJBQStCLEVBQUUsa0JBQTJCO0lBQzlELE1BQU0sR0FBRyxHQUFHLElBQUksdUJBQXVCLENBQ25DLGFBQWEsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNqRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoQyxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFTRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQzdCLEtBQXVCLEVBQUUsYUFBNEIsRUFDckQsWUFBMEI7SUFDNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSx5QkFBeUIsQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2hHLEtBQUssTUFBTSxRQUFRLElBQUksS0FBSyxDQUFDLFVBQVUsSUFBSSxFQUFFLEVBQUU7UUFDN0Msa0JBQWtCLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztLQUMxQztJQUNELEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDakUsbUJBQW1CLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN0QztJQUNELEtBQUssTUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUU7UUFDdEMsZUFBZSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztLQUM3QjtJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELGdHQUFnRztBQUNoRyxvRkFBb0Y7QUFDcEYsTUFBTSxVQUFVLGtCQUFrQixDQUM5QixHQUE4QixFQUFFLFFBQTBCLEVBQUUsZUFBd0I7SUFDdEYsSUFBSSxVQUF5QyxDQUFDO0lBQzlDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO0lBQ3BDLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxhQUFhLEVBQUU7UUFDbEMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FDN0IsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDM0Y7U0FBTTtRQUNMLFVBQVUsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDeEQ7SUFDRCxJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztJQUMxQyxxREFBcUQ7SUFDckQsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNyQyxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4RCxXQUFXLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7S0FDeEM7SUFDRCxJQUFJLFFBQVEsQ0FBQyxXQUFXLEVBQUU7UUFDeEIsV0FBVyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDO0tBQ3hDO0lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQzNELGVBQWU7U0FDVixJQUFJLENBQUMsMEVBQTBFLEVBQ3BGLGVBQWUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FDL0IsR0FBOEIsRUFBRSxJQUFZLEVBQUUsS0FBbUI7SUFDbkUsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDbEMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSztJQUM3Rix1Q0FBdUMsQ0FBQyxJQUFLLENBQUMsQ0FBQztJQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBOEIsRUFBRSxLQUFvQjtJQUNsRixNQUFNLFlBQVksR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQ3BDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUMvRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdEIsNkJBQTZCO0lBQzdCLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQ25FLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0UsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsV0FBVyxDQUFDLElBQXlCLEVBQUUsUUFBa0I7SUFDaEUsS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLEVBQUU7UUFDM0IsSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtZQUM3QixhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzNCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFFBQVEsRUFBRTtZQUNyQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzVCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtZQUNwQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzNCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLElBQUksRUFBRTtZQUNqQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3hCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFNBQVMsRUFBRTtZQUN0QyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzdCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtZQUNwQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzNCO2FBQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRTtZQUN4QyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDL0I7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1lBQzFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUM5QjthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxHQUFHLEVBQUU7WUFDaEMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUN2QjthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxZQUFZLEVBQUU7WUFDekMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUM1QjthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQ3hFO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FBQyxJQUF5QixFQUFFLE9BQWtCO0lBQ2xFLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTO1FBQzFCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7UUFDMUYsTUFBTSxLQUFLLENBQUMsNkNBQTZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDM0Y7SUFFRCxNQUFNLGdCQUFnQixHQUEyQixFQUFFLENBQUM7SUFDcEQsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3JDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0tBQzFDO0lBQ0QsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUVyQyxNQUFNLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFOUQsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUNuQyxXQUFXLEVBQUUsRUFBRSxFQUFFLGVBQWUsQ0FBQyxZQUFZLENBQUMsRUFDOUMsT0FBTyxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQ3RFLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUxQixjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbkMsV0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFcEMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDL0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFeEIsMkZBQTJGO0lBQzNGLElBQUksT0FBTyxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ3hDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDOUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQWMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0YsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQWMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztLQUM3RTtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQXlCLEVBQUUsSUFBZ0I7SUFDakUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVM7UUFDdkIsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRTtRQUNwRixNQUFNLEtBQUssQ0FBQyw4Q0FBOEMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUN6RjtJQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVuRCxJQUFJLHVCQUF1QixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDM0MsSUFBSSxlQUFlLEdBQWdCLEVBQUUsQ0FBQztJQUN0QyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDaEIsQ0FBQyxlQUFlLEVBQUUsdUJBQXVCLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ3hFO0lBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDekYsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUM3QixTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFLGVBQWUsQ0FBQyxlQUFlLENBQUMsRUFBRSxLQUFLLEVBQ2hGLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDM0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFeEIsY0FBYyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzlCLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXRDLEtBQUssTUFBTSxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1FBQzFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDMUU7SUFFRCxpR0FBaUc7SUFDakcsaUdBQWlHO0lBQ2pHLCtDQUErQztJQUMvQyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDOUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xGLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN2RTtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUFDLElBQXlCLEVBQUUsT0FBa0I7SUFDbEUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbEcsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3JDLGFBQWEsQ0FDVCxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBMkIsSUFBSSxFQUM5RSxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQ3BFO0lBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxVQUFVLENBQUMsSUFBeUIsRUFBRSxJQUFZO0lBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQzVGLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLElBQXlCLEVBQUUsSUFBaUI7SUFDbkUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUN2QixJQUFJLEtBQUssWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1FBQ3BDLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0tBQ25CO0lBQ0QsSUFBSSxDQUFDLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsRUFBRTtRQUN2QyxNQUFNLElBQUksS0FBSyxDQUNYLGtFQUFrRSxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDakc7SUFDRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUNyRSxNQUFNLEtBQUssQ0FDUCx3REFBd0QsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUM1RjtJQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUNyQixDQUFDLElBQUksRUFBNEIsRUFBRSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUMzRSxFQUFFLENBQUM7SUFFUCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQzNDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUNqRSx3RkFBd0Y7SUFDeEYsOERBQThEO0lBQzlELDRFQUE0RTtJQUM1RSxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3ZFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyx1QkFBdUIsQ0FDdkMsUUFBUSxFQUNSLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FDaEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQzdGLGdCQUFnQixFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUFDLElBQXlCLEVBQUUsT0FBa0I7SUFDbEUsSUFBSSxTQUFTLEdBQW1CLElBQUksQ0FBQztJQUNyQyxJQUFJLGVBQWUsR0FBdUIsSUFBSSxDQUFDO0lBQy9DLElBQUksVUFBVSxHQUFrQyxFQUFFLENBQUM7SUFDbkQsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO1FBQ3JDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQyxJQUFJLE1BQU0sQ0FBQyxlQUFlLEtBQUssSUFBSSxFQUFFO1lBQ25DLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ3JFO1FBQ0QsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUM5QixLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQ2xELFNBQVMsQ0FBQywyREFBMkQsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDOUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFekIsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO1lBQ3RCLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLGVBQWUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1NBQy9CO1FBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzFGLE1BQU0sbUJBQW1CLEdBQ3JCLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNGLFVBQVUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUNyQyxXQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNyQztJQUNELE1BQU0sV0FBVyxHQUNiLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFVLEVBQUUsZUFBZ0IsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGlCQUFpQixDQUFDLElBQXlCLEVBQUUsV0FBMEI7SUFDOUUsSUFBSSxTQUFTLEdBQW1CLElBQUksQ0FBQztJQUNyQyxJQUFJLGVBQWUsR0FBdUIsSUFBSSxDQUFDO0lBQy9DLElBQUksVUFBVSxHQUFrQyxFQUFFLENBQUM7SUFDbkQsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFO1FBQzFDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQyxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQzlCLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFDM0MsU0FBUyxDQUFDLDJEQUEyRCxFQUNyRSxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekIsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO1lBQ3RCLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLGVBQWUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1NBQy9CO1FBQ0QsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3BDLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7WUFDMUUsSUFBSSxDQUFDO1FBQ1QsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0YsVUFBVSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3JDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ3pDO0lBQ0QsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUN0QyxTQUFVLEVBQUUsZUFBZ0IsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFDNUYsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FDcEIsSUFBeUIsRUFBRSxNQUFjLEVBQUUsUUFBbUIsRUFDOUQsVUFBNEI7SUFDOUIsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQzFCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkQsV0FBVyxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNyQyxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQ2xDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVcsQ0FBQyxDQUFDO0lBQzNGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdCLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLElBQXlCLEVBQUUsVUFBMkI7SUFDOUUsd0RBQXdEO0lBQ3hELE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLFVBQVUsQ0FBRSxDQUFDO0lBQ3BGLE1BQU0sT0FBTyxHQUFHLGVBQWUsQ0FDM0IsSUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25GLE1BQU0sV0FBVyxHQUFHLGVBQWUsQ0FDL0IsSUFBSSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sS0FBSyxHQUNQLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFFN0YsNkRBQTZEO0lBQzdELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDNUMsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN6RixPQUFPLENBQUMsZUFBZSxHQUFHLFdBQVcsRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDO0lBQ3BELE9BQU8sQ0FBQyxlQUFlLEdBQUcsV0FBVyxFQUFFLElBQUksSUFBSSxJQUFJLENBQUM7SUFDcEQsT0FBTyxDQUFDLFdBQVcsR0FBRyxPQUFPLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQztJQUM1QyxPQUFPLENBQUMsU0FBUyxHQUFHLEtBQUssRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDO0lBQ3hDLE9BQU8sQ0FBQyxzQkFBc0IsR0FBRyxVQUFVLENBQUMsV0FBVyxFQUFFLFdBQVcsSUFBSSxJQUFJLENBQUM7SUFDN0UsT0FBTyxDQUFDLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxJQUFJLElBQUksQ0FBQztJQUNyRSxPQUFPLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksSUFBSSxDQUFDO0lBQ2pFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRTFCLHVDQUF1QztJQUV2QyxrR0FBa0c7SUFDbEcsOERBQThEO0lBQzlELElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztJQUNyQixJQUFJLFVBQVUsR0FBbUIsRUFBRSxDQUFDO0lBQ3BDLEtBQUssTUFBTSxRQUFRLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ3pFLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDL0IsTUFBTSxTQUFTLEdBQ1gsRUFBRSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEVBQUUsRUFBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBQyxFQUFFLFFBQVEsRUFBRSxJQUFLLENBQUMsQ0FBQztZQUNyRixVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxRQUFRLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRTtZQUNwQyxNQUFNLFNBQVMsR0FDWCxFQUFFLENBQUMsZUFBZSxDQUFDLFNBQVMsRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFDLEVBQUUsUUFBUSxFQUFFLElBQUssQ0FBQyxDQUFDO1lBQzFGLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLFFBQVEsQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ2hDLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQ2hDLFNBQVMsRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxFQUFFLFFBQVEsRUFBRSxJQUFLLENBQzdGLENBQUM7WUFDRixVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxRQUFRLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUNoQyxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUNoQyxTQUFTLEVBQUU7Z0JBQ1QsSUFBSSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLO2dCQUMvQixVQUFVLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTO2dCQUNwQyxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLFVBQVUsRUFBRSxJQUFJO2dCQUNoQixtQkFBbUIsRUFBRSxJQUFJO2FBQzFCLEVBQ0QsUUFBUSxFQUFFLElBQUssQ0FBQyxDQUFDO1lBQ3JCLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLFFBQVEsQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFFO1lBQ3RDLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQ2hDLFNBQVMsRUFBRTtnQkFDVCxJQUFJLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFdBQVc7Z0JBQ3JDLFVBQVUsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLFNBQVM7Z0JBQzFDLFVBQVUsRUFBRSxJQUFJO2dCQUNoQixVQUFVLEVBQUUsSUFBSTtnQkFDaEIsVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLG1CQUFtQixFQUFFLElBQUk7YUFDMUIsRUFDRCxRQUFRLEVBQUUsSUFBSyxDQUFDLENBQUM7WUFDckIsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM1QjtRQUNELElBQUksUUFBUSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDbkMsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FDaEMsU0FBUyxFQUFFO2dCQUNULElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsUUFBUTtnQkFDbEMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUztnQkFDdkMsVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLFVBQVUsRUFBRSxJQUFJO2dCQUNoQixVQUFVLEVBQUUsSUFBSTtnQkFDaEIsbUJBQW1CLEVBQUUsSUFBSTthQUMxQixFQUNELFFBQVEsRUFBRSxJQUFLLENBQUMsQ0FBQztZQUNyQixVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzVCO1FBQ0QsMkVBQTJFO1FBQzNFLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDM0IsVUFBVSxDQUFDLElBQUksQ0FDWCxFQUFFLENBQUMsZUFBZSxDQUFDLFNBQVMsRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFDLEVBQUUsS0FBSyxFQUFFLElBQUssQ0FBQyxDQUFDLENBQUM7U0FDcEY7UUFDRCxRQUFRLEdBQUcsSUFBSSxDQUFDO0tBQ2pCO0lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDL0IsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLElBQXlCLEVBQUUsR0FBVTtJQUN0RCxJQUFJLEdBQUcsQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNwQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUssQ0FBQyxDQUFDLENBQUM7S0FDckQ7U0FBTTtRQUNMLE1BQU0sS0FBSyxDQUFDLHlDQUF5QyxHQUFHLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQ3BGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxjQUFjLENBQUMsSUFBeUIsRUFBRSxRQUF3QjtJQUN6RSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdEQsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLEtBQWEsRUFBRSxXQUEwQyxFQUFFLEVBQUU7UUFDeEYsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDdkIsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLO1lBQ25DLElBQUksRUFBRSxJQUFJO1lBQ1YsVUFBVSxFQUFFLEtBQUs7WUFDakIsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDLHNCQUFzQixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDO1NBQzFFLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQztJQUVGLHVFQUF1RTtJQUN2RSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0UsWUFBWSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FDN0IsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuRixZQUFZLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUM3QixRQUFRLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25GLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUYsbUJBQW1CLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlGLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUU1RixNQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDakYsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUVqRSxXQUFXLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUU3QyxJQUFJLFNBQVMsR0FBNkIsSUFBSSxDQUFDO0lBQy9DLElBQUksUUFBUSxDQUFDLEtBQUssS0FBSyxJQUFJLEVBQUU7UUFDM0IsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxXQUFXLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDakQ7SUFFRCxNQUFNLFFBQVEsR0FBd0I7UUFDcEMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSTtRQUM3QyxNQUFNLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxJQUFJO1FBQzdDLE1BQU0sRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLElBQUk7UUFDN0MsS0FBSyxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSTtRQUMzQyxLQUFLLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJO1FBQzNDLElBQUksRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUk7UUFDekMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSTtLQUM5QixDQUFDO0lBRUYsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDLHNCQUFzQixDQUM1QyxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLElBQUksSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3RGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRWpDLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FDekIsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUM3QixpQkFBaUIsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN0RSxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQ2hDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQy9FLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsVUFBVSxDQUNmLEdBQVUsRUFBRSxHQUFtQixFQUFFLGNBQW9DO0lBQ3ZFLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxhQUFhLEVBQUU7UUFDbEMsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLENBQUM7S0FDakQ7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsWUFBWSxFQUFFO1FBQ3hDLElBQUksR0FBRyxDQUFDLFFBQVEsWUFBWSxDQUFDLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLFlBQVksQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQzNGLE9BQU8sSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN6QzthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQ3JCLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFDN0QsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO0tBQ0Y7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1FBQ3pDLE9BQU8sSUFBSSxDQUFDLENBQUMsYUFBYSxDQUN0QixVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFDdkQsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUFFLFNBQVMsRUFDckQsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQ2xEO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLFVBQVUsRUFBRTtRQUN0QyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FDckIsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsRUFDdkYsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUFFLFNBQVMsRUFDckQsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQ2xEO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLElBQUksRUFBRTtRQUNoQyxJQUFJLEdBQUcsQ0FBQyxRQUFRLFlBQVksQ0FBQyxDQUFDLGdCQUFnQixFQUFFO1lBQzlDLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztTQUNoRDthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsQ0FDM0IsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUM3QyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUNwRSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7U0FDbEQ7S0FDRjtTQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRTtRQUM1QyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQ3JGO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLE1BQU0sRUFBRTtRQUNsQyxNQUFNLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztTQUM3RTtRQUNELE9BQU8sSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQzNCLFFBQVEsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQ25ELFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsRUFBRSxTQUFTLEVBQ3JELGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztLQUNsRDtTQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxZQUFZLEVBQUU7UUFDeEMscURBQXFEO1FBQ3JELE9BQU8sSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDMUM7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsU0FBUyxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxDQUFDLENBQUMsV0FBVyxDQUNwQixVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUN2RixTQUFTLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQzdEO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLEtBQUssRUFBRTtRQUNqQyxNQUFNLElBQUksS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7S0FDN0Q7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsVUFBVSxFQUFFO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ3hDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsa0ZBQWtGO1lBQ2xGLGNBQWM7WUFDZCxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1RixDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQzlGO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLFlBQVksRUFBRTtRQUN4Qyw4RkFBOEY7UUFDOUYsT0FBTyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FDekIsR0FBRyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDekU7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsV0FBVyxFQUFFO1FBQ3ZDLE9BQU8sSUFBSSxDQUFDLENBQUMsZUFBZSxDQUN4QixVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQzlDLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQzNGLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7S0FDN0Q7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1FBQ3pDLHdGQUF3RjtRQUN4RixPQUFPLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQztLQUN4RDtTQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxXQUFXLEVBQUU7UUFDdkMsb0VBQW9FO1FBQ3BFLE9BQU8sSUFBSSxFQUFFLENBQUMsZUFBZSxDQUN6QixHQUFHLENBQUMsY0FBYyxFQUFFLEVBQ3BCLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUNuQixHQUFHLENBQUMsSUFBSSxFQUNSO1lBQ0UsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQztZQUN4QyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLENBQUM7U0FDN0QsQ0FDSixDQUFDO0tBQ0g7U0FBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1FBQ3pDLE9BQU8sSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQzNCLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQ3ZGLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztLQUNsRDtTQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRTtRQUM1QyxvQkFBb0I7UUFDcEIsT0FBTyxJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzdGO1NBQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLFFBQVEsRUFBRTtRQUNwQyxvQkFBb0I7UUFDcEIsT0FBTyxJQUFJLEVBQUUsQ0FBQyxzQkFBc0IsQ0FDaEMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUM3QyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUM1RDtTQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxTQUFTLEVBQUU7UUFDckMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0tBQ3RFO1NBQU07UUFDTCxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDdkU7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxJQUFnQjtJQUN2QyxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLGFBQWEsQ0FBQztBQUM5RCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxjQUFjLENBQ25CLElBQXlCLEVBQUUsRUFBb0IsRUFBRSxPQUE2QjtJQUNoRixJQUFJLEtBQUssR0FBaUIsWUFBWSxDQUFDLElBQUksQ0FBQztJQUM1QyxJQUFJLE9BQU8sWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFO1FBQ2pDLEtBQUssSUFBSSxZQUFZLENBQUMsbUJBQW1CLENBQUM7UUFDMUMsSUFBSSxPQUFPLFlBQVksQ0FBQyxDQUFDLFFBQVEsSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDN0QsS0FBSyxJQUFJLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQztTQUM5QztRQUVELE1BQU0saUJBQWlCLEdBQ25CLEtBQUssR0FBRyxZQUFZLENBQUMsc0JBQXNCLEdBQUcsWUFBWSxDQUFDLDZCQUE2QixDQUFDO1FBQzdGLEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxDQUFDLGFBQWEsRUFBRTtZQUN4QyxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO2dCQUNuQyxhQUFhLENBQ1QsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsbUNBQTJCLElBQUksRUFDOUUsZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUN4RjtpQkFBTTtnQkFDTCxhQUFhLENBQ1QsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxFQUNoRixJQUFJLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7YUFDekM7U0FDRjtLQUNGO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3JDLDJGQUEyRjtRQUMzRiwyRkFBMkY7UUFDM0YsMkJBQTJCO1FBQzNCLGFBQWEsQ0FDVCxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBMkIsSUFBSSxFQUM5RSxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUM1RTtJQUNELEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtRQUNsQyxhQUFhLENBQ1QsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsZUFBZSxFQUNyRixLQUFLLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQzlCO0lBRUQsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO1FBQ3BDLElBQUksVUFBeUIsQ0FBQztRQUM5QixJQUFJLE1BQU0sQ0FBQyxJQUFJLHdDQUFnQyxFQUFFO1lBQy9DLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ3pCLE1BQU0sS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7YUFDdkQ7U0FDRjtRQUVELElBQUksT0FBTyxZQUFZLENBQUMsQ0FBQyxRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ1osRUFBRSxDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLFNBQVM7U0FDVjtRQUVELFVBQVUsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQzVCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRW5GLHdGQUF3RjtRQUN4Rix1QkFBdUI7UUFDdkIsSUFBSSxZQUFxQixDQUFDO1FBQzFCLElBQUksT0FBTyxHQUFVLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDcEMsSUFBSSxPQUFPLFlBQVksQ0FBQyxDQUFDLGFBQWEsRUFBRTtZQUN0QyxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztTQUN2QjtRQUVELElBQUksT0FBTyxZQUFZLENBQUMsQ0FBQyxLQUFLLEVBQUU7WUFDOUIsWUFBWSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7U0FDcEM7YUFBTTtZQUNMLFlBQVksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzFCO1FBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7U0FDekU7UUFFRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzdGLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUcsQ0FBQztRQUV0QyxLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsRUFBRTtZQUM5QixNQUFNLE1BQU0sR0FDUixFQUFFLENBQUMsaUJBQWlCLENBQWMsSUFBSSxDQUFDLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3BDO1FBQ0QsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQ3RCLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDOUI7QUFDSCxDQUFDO0FBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQWdDO0lBQzNELGlDQUF5QixFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztJQUNqRCxrQ0FBMEIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDbkQsOEJBQXNCLEVBQUUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDO0lBQy9DLDhCQUFzQixFQUFFLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQztJQUNuRCxrQ0FBMEIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDcEQsQ0FBQyxDQUFDO0FBRUgsSUFBSyxZQXNCSjtBQXRCRCxXQUFLLFlBQVk7SUFDZiwrQ0FBWSxDQUFBO0lBRVo7O09BRUc7SUFDSCx5REFBa0IsQ0FBQTtJQUVsQjs7T0FFRztJQUNILG1GQUErQixDQUFBO0lBRS9COztPQUVHO0lBQ0gsaUdBQXNDLENBQUE7SUFFdEM7O09BRUc7SUFDSCw2RUFBNEIsQ0FBQTtBQUM5QixDQUFDLEVBdEJJLFlBQVksS0FBWixZQUFZLFFBc0JoQjtBQUVELFNBQVMsYUFBYSxDQUNsQixJQUF5QixFQUFFLElBQWUsRUFBRSxJQUFZLEVBQUUsS0FBeUIsRUFDbkYsSUFBbUIsRUFBRSxJQUFpQixFQUFFLGVBQWdDLEVBQ3hFLFVBQTJCLEVBQUUsS0FBbUI7SUFDbEQsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLGFBQWEsRUFBRTtRQUNwQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztLQUNuQjtJQUVELElBQUksS0FBSyxHQUFHLFlBQVksQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQztRQUMxRixJQUFJLG1DQUEyQixFQUFFO1FBQ25DLDBGQUEwRjtRQUMxRixXQUFXO1FBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzRixPQUFPO0tBQ1I7SUFFRCxJQUFJLFVBQXlDLENBQUM7SUFDOUMsb0ZBQW9GO0lBQ3BGLHVEQUF1RDtJQUN2RCxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUMsYUFBYSxFQUFFO1FBQ3BDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQzdCLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3JGO1NBQU0sSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLEdBQUcsRUFBRTtRQUNqQyxVQUFVLEdBQUcsVUFBVSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ2hEO1NBQU07UUFDTCxVQUFVLEdBQUcsS0FBSyxDQUFDO0tBQ3BCO0lBRUQsTUFBTSxJQUFJLEdBQW1CLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDdEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FDL0IsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFDdkYsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDM0UsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsRUFBb0IsRUFBRSxPQUE2QjtJQUMzRSxhQUFhLENBQWMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3pDLEtBQUssTUFBTSxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUMsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQzlDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQ2hCLElBQUk7WUFDSixNQUFNLEVBQUUsS0FBSztTQUNkLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxhQUFhLENBQUksS0FBVTtJQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7S0FDdEQ7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQVMsaUJBQWlCLENBQ3RCLElBQWlCLEVBQUUsY0FBb0M7SUFDekQsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFO1FBQzNCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEQsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xELE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5RCxPQUFPLElBQUksZUFBZSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDcEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBlIGZyb20gJy4uLy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7QklOQVJZX09QRVJBVE9SUywgbmFtZXNwYWNlRm9yS2V5fSBmcm9tICcuL2NvbnZlcnNpb24nO1xuXG5jb25zdCBjb21wYXRpYmlsaXR5TW9kZSA9IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI7XG5cbi8qKlxuICogUHJvY2VzcyBhIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYENvbXBvbmVudENvbXBpbGF0aW9uYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqIFRPRE86IFJlZmFjdG9yIG1vcmUgb2YgdGhlIGluZ2VzdGlvbiBjb2RlIGludG8gcGhhc2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0Q29tcG9uZW50KFxuICAgIGNvbXBvbmVudE5hbWU6IHN0cmluZywgdGVtcGxhdGU6IHQuTm9kZVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLCBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4pOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGNwbCA9IG5ldyBDb21wb25lbnRDb21waWxhdGlvbkpvYihcbiAgICAgIGNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBpMThuVXNlRXh0ZXJuYWxJZHMpO1xuICBpbmdlc3ROb2RlcyhjcGwucm9vdCwgdGVtcGxhdGUpO1xuICByZXR1cm4gY3BsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhvc3RCaW5kaW5nSW5wdXQge1xuICBjb21wb25lbnROYW1lOiBzdHJpbmc7XG4gIHByb3BlcnRpZXM6IGUuUGFyc2VkUHJvcGVydHlbXXxudWxsO1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcbiAgZXZlbnRzOiBlLlBhcnNlZEV2ZW50W118bnVsbDtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgaG9zdCBiaW5kaW5nIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2JgIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEJpbmRpbmcoXG4gICAgaW5wdXQ6IEhvc3RCaW5kaW5nSW5wdXQsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3Qgam9iID0gbmV3IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IoaW5wdXQuY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSk7XG4gIGZvciAoY29uc3QgcHJvcGVydHkgb2YgaW5wdXQucHJvcGVydGllcyA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RQcm9wZXJ0eShqb2IsIHByb3BlcnR5LCBmYWxzZSk7XG4gIH1cbiAgZm9yIChjb25zdCBbbmFtZSwgZXhwcl0gb2YgT2JqZWN0LmVudHJpZXMoaW5wdXQuYXR0cmlidXRlcykgPz8gW10pIHtcbiAgICBpbmdlc3RIb3N0QXR0cmlidXRlKGpvYiwgbmFtZSwgZXhwcik7XG4gIH1cbiAgZm9yIChjb25zdCBldmVudCBvZiBpbnB1dC5ldmVudHMgPz8gW10pIHtcbiAgICBpbmdlc3RIb3N0RXZlbnQoam9iLCBldmVudCk7XG4gIH1cbiAgcmV0dXJuIGpvYjtcbn1cblxuLy8gVE9ETzogV2Ugc2hvdWxkIHJlZmFjdG9yIHRoZSBwYXJzZXIgdG8gdXNlIHRoZSBzYW1lIHR5cGVzIGFuZCBzdHJ1Y3R1cmVzIGZvciBob3N0IGJpbmRpbmdzIGFzXG4vLyB3aXRoIG9yZGluYXJ5IGNvbXBvbmVudHMuIFRoaXMgd291bGQgYWxsb3cgdXMgdG8gc2hhcmUgYSBsb3QgbW9yZSBpbmdlc3Rpb24gY29kZS5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0UHJvcGVydHkoXG4gICAgam9iOiBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCBwcm9wZXJ0eTogZS5QYXJzZWRQcm9wZXJ0eSwgaXNUZXh0QXR0cmlidXRlOiBib29sZWFuKTogdm9pZCB7XG4gIGxldCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258aXIuSW50ZXJwb2xhdGlvbjtcbiAgY29uc3QgYXN0ID0gcHJvcGVydHkuZXhwcmVzc2lvbi5hc3Q7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIGFzdC5zdHJpbmdzLCBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoYXN0LCBqb2IsIHByb3BlcnR5LnNvdXJjZVNwYW4pO1xuICB9XG4gIGxldCBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAvLyBUT0RPOiB0aGlzIHNob3VsZCByZWFsbHkgYmUgaGFuZGxlZCBpbiB0aGUgcGFyc2VyLlxuICBpZiAocHJvcGVydHkubmFtZS5zdGFydHNXaXRoKCdhdHRyLicpKSB7XG4gICAgcHJvcGVydHkubmFtZSA9IHByb3BlcnR5Lm5hbWUuc3Vic3RyaW5nKCdhdHRyLicubGVuZ3RoKTtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZTtcbiAgfVxuICBpZiAocHJvcGVydHkuaXNBbmltYXRpb24pIHtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbjtcbiAgfVxuICBqb2Iucm9vdC51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBiaW5kaW5nS2luZCwgcHJvcGVydHkubmFtZSwgZXhwcmVzc2lvbiwgbnVsbCxcbiAgICAgIFNlY3VyaXR5Q29udGV4dFxuICAgICAgICAgIC5OT05FIC8qIFRPRE86IHdoYXQgc2hvdWxkIHdlIHBhc3MgYXMgc2VjdXJpdHkgY29udGV4dD8gUGFzc2luZyBOT05FIGZvciBub3cuICovLFxuICAgICAgaXNUZXh0QXR0cmlidXRlLCBmYWxzZSwgcHJvcGVydHkuc291cmNlU3BhbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEF0dHJpYnV0ZShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIG5hbWU6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbik6IHZvaWQge1xuICBjb25zdCBhdHRyQmluZGluZyA9IGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgbmFtZSwgdmFsdWUsIG51bGwsIFNlY3VyaXR5Q29udGV4dC5OT05FLCB0cnVlLCBmYWxzZSxcbiAgICAgIC8qIFRPRE86IGhvc3QgYXR0cmlidXRlIHNvdXJjZSBzcGFucyAqLyBudWxsISk7XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGF0dHJCaW5kaW5nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RFdmVudChqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIGV2ZW50OiBlLlBhcnNlZEV2ZW50KSB7XG4gIGNvbnN0IGV2ZW50QmluZGluZyA9IGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBuZXcgaXIuU2xvdEhhbmRsZSgpLCBldmVudC5uYW1lLCBudWxsLCBldmVudC50YXJnZXRPclBoYXNlLCB0cnVlLFxuICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gIC8vIFRPRE86IENhbiB0aGlzIGJlIGEgY2hhaW4/XG4gIGV2ZW50QmluZGluZy5oYW5kbGVyT3BzLnB1c2goaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KFxuICAgICAgY29udmVydEFzdChldmVudC5oYW5kbGVyLmFzdCwgam9iLCBldmVudC5zb3VyY2VTcGFuKSwgZXZlbnQuaGFuZGxlclNwYW4pKSk7XG4gIGpvYi5yb290LmNyZWF0ZS5wdXNoKGV2ZW50QmluZGluZyk7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQ29udGVudCkge1xuICAgICAgaW5nZXN0Q29udGVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGluZ2VzdFRleHQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQpIHtcbiAgICAgIGluZ2VzdEJvdW5kVGV4dCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LklmQmxvY2spIHtcbiAgICAgIGluZ2VzdElmQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Td2l0Y2hCbG9jaykge1xuICAgICAgaW5nZXN0U3dpdGNoQmxvY2sodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5EZWZlcnJlZEJsb2NrKSB7XG4gICAgICBpbmdlc3REZWZlckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuSWN1KSB7XG4gICAgICBpbmdlc3RJY3UodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5Gb3JMb29wQmxvY2spIHtcbiAgICAgIGluZ2VzdEZvckJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBlbGVtZW50IEFTVCBmcm9tIHRoZSB0ZW1wbGF0ZSBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBlbGVtZW50OiB0LkVsZW1lbnQpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCBlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciBlbGVtZW50OiAke2VsZW1lbnQuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3Qgc3RhdGljQXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgc3RhdGljQXR0cmlidXRlc1thdHRyLm5hbWVdID0gYXR0ci52YWx1ZTtcbiAgfVxuICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG5cbiAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcblxuICBjb25zdCBzdGFydE9wID0gaXIuY3JlYXRlRWxlbWVudFN0YXJ0T3AoXG4gICAgICBlbGVtZW50TmFtZSwgaWQsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VLZXkpLFxuICAgICAgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlciA/IGVsZW1lbnQuaTE4biA6IHVuZGVmaW5lZCxcbiAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChzdGFydE9wKTtcblxuICBpbmdlc3RCaW5kaW5ncyh1bml0LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0Tm9kZXModW5pdCwgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgY29uc3QgZW5kT3AgPSBpci5jcmVhdGVFbGVtZW50RW5kT3AoaWQsIGVsZW1lbnQuZW5kU291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goZW5kT3ApO1xuXG4gIC8vIElmIHRoZXJlIGlzIGFuIGkxOG4gbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBlbGVtZW50LCBpbnNlcnQgaTE4biBzdGFydCBhbmQgZW5kIG9wcy5cbiAgaWYgKGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGkxOG5CbG9ja0lkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuQ3JlYXRlT3A+KGlyLmNyZWF0ZUkxOG5TdGFydE9wKGkxOG5CbG9ja0lkLCBlbGVtZW50LmkxOG4pLCBzdGFydE9wKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVJMThuRW5kT3AoaTE4bkJsb2NrSWQpLCBlbmRPcCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBpZiAodG1wbC5pMThuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICEodG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlIHx8IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIpKSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRlbXBsYXRlOiAke3RtcGwuaTE4bi5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgY2hpbGRWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG5cbiAgbGV0IHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID0gdG1wbC50YWdOYW1lO1xuICBsZXQgbmFtZXNwYWNlUHJlZml4OiBzdHJpbmd8bnVsbCA9ICcnO1xuICBpZiAodG1wbC50YWdOYW1lKSB7XG4gICAgW25hbWVzcGFjZVByZWZpeCwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2VdID0gc3BsaXROc05hbWUodG1wbC50YWdOYW1lKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlciA9IHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyB0bXBsLmkxOG4gOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHRwbE9wID0gaXIuY3JlYXRlVGVtcGxhdGVPcChcbiAgICAgIGNoaWxkVmlldy54cmVmLCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSwgbmFtZXNwYWNlRm9yS2V5KG5hbWVzcGFjZVByZWZpeCksIGZhbHNlLFxuICAgICAgaTE4blBsYWNlaG9sZGVyLCB0bXBsLnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2godHBsT3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHVuaXQsIHRwbE9wLCB0bXBsKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0cGxPcCwgdG1wbCk7XG4gIGluZ2VzdE5vZGVzKGNoaWxkVmlldywgdG1wbC5jaGlsZHJlbik7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIHRtcGwudmFyaWFibGVzKSB7XG4gICAgY2hpbGRWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KG5hbWUsIHZhbHVlICE9PSAnJyA/IHZhbHVlIDogJyRpbXBsaWNpdCcpO1xuICB9XG5cbiAgLy8gSWYgdGhpcyBpcyBhIHBsYWluIHRlbXBsYXRlIGFuZCB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIGl0LCBpbnNlcnQgaTE4biBzdGFydFxuICAvLyBhbmQgZW5kIG9wcy4gRm9yIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlcywgdGhlIGkxOG4gb3BzIHdpbGwgYmUgYWRkZWQgd2hlbiBpbmdlc3RpbmcgdGhlXG4gIC8vIGVsZW1lbnQvdGVtcGxhdGUgdGhlIGRpcmVjdGl2ZSBpcyBwbGFjZWQgb24uXG4gIGlmIChpc1BsYWluVGVtcGxhdGUodG1wbCkgJiYgdG1wbC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcihpci5jcmVhdGVJMThuU3RhcnRPcChpZCwgdG1wbC5pMThuKSwgY2hpbGRWaWV3LmNyZWF0ZS5oZWFkKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKGlyLmNyZWF0ZUkxOG5FbmRPcChpZCksIGNoaWxkVmlldy5jcmVhdGUudGFpbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdENvbnRlbnQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgY29udGVudDogdC5Db250ZW50KTogdm9pZCB7XG4gIGNvbnN0IG9wID0gaXIuY3JlYXRlUHJvamVjdGlvbk9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRlbnQuc2VsZWN0b3IsIGNvbnRlbnQuc291cmNlU3Bhbik7XG4gIGZvciAoY29uc3QgYXR0ciBvZiBjb250ZW50LmF0dHJpYnV0ZXMpIHtcbiAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIG51bGwsXG4gICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpO1xuICB9XG4gIHVuaXQuY3JlYXRlLnB1c2gob3ApO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhIGxpdGVyYWwgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGV4dCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZXh0OiB0LlRleHQpOiB2b2lkIHtcbiAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGludGVycG9sYXRlZCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RCb3VuZFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5Cb3VuZFRleHQpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIGlmICh0ZXh0LmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhKHRleHQuaTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgICBgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgdGV4dCBpbnRlcnBvbGF0aW9uOiAke3RleHQuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5QbGFjZWhvbGRlcnMgPSB0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lciA/XG4gICAgICB0ZXh0LmkxOG4uY2hpbGRyZW4uZmlsdGVyKFxuICAgICAgICAgIChub2RlKTogbm9kZSBpcyBpMThuLlBsYWNlaG9sZGVyID0+IG5vZGUgaW5zdGFuY2VvZiBpMThuLlBsYWNlaG9sZGVyKSA6XG4gICAgICBbXTtcblxuICBjb25zdCB0ZXh0WHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHRleHRYcmVmLCAnJywgdGV4dC5zb3VyY2VTcGFuKSk7XG4gIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgZG9lcyBub3QgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1Yi1leHByZXNzaW9ucyBpbnNpZGUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbi4gV2UgY29weSB0aGF0IGJlaGF2aW9yIGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgLy8gVE9ETzogaXMgaXQgYWN0dWFsbHkgY29ycmVjdCB0byBnZW5lcmF0ZSB0aGVzZSBleHRyYSBtYXBzIGluIG1vZGVybiBtb2RlP1xuICBjb25zdCBiYXNlU291cmNlU3BhbiA9IHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPyBudWxsIDogdGV4dC5zb3VyY2VTcGFuO1xuICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgICAgdGV4dFhyZWYsXG4gICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgICB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iLCBiYXNlU291cmNlU3BhbikpKSxcbiAgICAgIGkxOG5QbGFjZWhvbGRlcnMsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGlmYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0SWZCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpZkJsb2NrOiB0LklmQmxvY2spOiB2b2lkIHtcbiAgbGV0IGZpcnN0WHJlZjogaXIuWHJlZklkfG51bGwgPSBudWxsO1xuICBsZXQgZmlyc3RTbG90SGFuZGxlOiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICBsZXQgY29uZGl0aW9uczogQXJyYXk8aXIuQ29uZGl0aW9uYWxDYXNlRXhwcj4gPSBbXTtcbiAgZm9yIChjb25zdCBpZkNhc2Ugb2YgaWZCbG9jay5icmFuY2hlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgaWYgKGlmQ2FzZS5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGNWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGlmQ2FzZS5leHByZXNzaW9uQWxpYXMubmFtZSwgaXIuQ1RYX1JFRik7XG4gICAgfVxuICAgIGNvbnN0IHRtcGxPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsICdDb25kaXRpb25hbCcsIGlyLk5hbWVzcGFjZS5IVE1MLCB0cnVlLFxuICAgICAgICB1bmRlZmluZWQgLyogVE9ETzogZmlndXJlIG91dCBob3cgaTE4biB3b3JrcyB3aXRoIG5ldyBjb250cm9sIGZsb3cgKi8sIGlmQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRtcGxPcCk7XG5cbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgICAgZmlyc3RTbG90SGFuZGxlID0gdG1wbE9wLnNsb3Q7XG4gICAgfVxuICAgIGNvbnN0IGNhc2VFeHByID0gaWZDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KGlmQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCkgOiBudWxsO1xuICAgIGNvbnN0IGNvbmRpdGlvbmFsQ2FzZUV4cHIgPVxuICAgICAgICBuZXcgaXIuQ29uZGl0aW9uYWxDYXNlRXhwcihjYXNlRXhwciwgdG1wbE9wLnhyZWYsIHRtcGxPcC5zbG90LCBpZkNhc2UuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICBjb25kaXRpb25zLnB1c2goY29uZGl0aW9uYWxDYXNlRXhwcik7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIGlmQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPVxuICAgICAgaXIuY3JlYXRlQ29uZGl0aW9uYWxPcChmaXJzdFhyZWYhLCBmaXJzdFNsb3RIYW5kbGUhLCBudWxsLCBjb25kaXRpb25zLCBpZkJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LnVwZGF0ZS5wdXNoKGNvbmRpdGlvbmFsKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBzd2l0Y2hgIGJsb2NrIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RTd2l0Y2hCbG9jayh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzd2l0Y2hCbG9jazogdC5Td2l0Y2hCbG9jayk6IHZvaWQge1xuICBsZXQgZmlyc3RYcmVmOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gIGxldCBmaXJzdFNsb3RIYW5kbGU6IGlyLlNsb3RIYW5kbGV8bnVsbCA9IG51bGw7XG4gIGxldCBjb25kaXRpb25zOiBBcnJheTxpci5Db25kaXRpb25hbENhc2VFeHByPiA9IFtdO1xuICBmb3IgKGNvbnN0IHN3aXRjaENhc2Ugb2Ygc3dpdGNoQmxvY2suY2FzZXMpIHtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGNvbnN0IHRtcGxPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsICdDYXNlJywgaXIuTmFtZXNwYWNlLkhUTUwsIHRydWUsXG4gICAgICAgIHVuZGVmaW5lZCAvKiBUT0RPOiBmaWd1cmUgb3V0IGhvdyBpMThuIHdvcmtzIHdpdGggbmV3IGNvbnRyb2wgZmxvdyAqLyxcbiAgICAgICAgc3dpdGNoQ2FzZS5zb3VyY2VTcGFuKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKHRtcGxPcCk7XG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICAgIGZpcnN0U2xvdEhhbmRsZSA9IHRtcGxPcC5zbG90O1xuICAgIH1cbiAgICBjb25zdCBjYXNlRXhwciA9IHN3aXRjaENhc2UuZXhwcmVzc2lvbiA/XG4gICAgICAgIGNvbnZlcnRBc3Qoc3dpdGNoQ2FzZS5leHByZXNzaW9uLCB1bml0LmpvYiwgc3dpdGNoQmxvY2suc3RhcnRTb3VyY2VTcGFuKSA6XG4gICAgICAgIG51bGw7XG4gICAgY29uc3QgY29uZGl0aW9uYWxDYXNlRXhwciA9IG5ldyBpci5Db25kaXRpb25hbENhc2VFeHByKGNhc2VFeHByLCB0bXBsT3AueHJlZiwgdG1wbE9wLnNsb3QpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgc3dpdGNoQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKFxuICAgICAgZmlyc3RYcmVmISwgZmlyc3RTbG90SGFuZGxlISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCksIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWZmaXg6IHN0cmluZywgY2hpbGRyZW4/OiB0Lk5vZGVbXSxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogaXIuVGVtcGxhdGVPcHxudWxsIHtcbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLCB0cnVlLCB1bmRlZmluZWQsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIC8vIEdlbmVyYXRlIHRoZSBkZWZlciBtYWluIHZpZXcgYW5kIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IG1haW4gPSBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suY2hpbGRyZW4sIGRlZmVyQmxvY2suc291cmNlU3BhbikhO1xuICBjb25zdCBsb2FkaW5nID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ0xvYWRpbmcnLCBkZWZlckJsb2NrLmxvYWRpbmc/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmxvYWRpbmc/LnNvdXJjZVNwYW4pO1xuICBjb25zdCBwbGFjZWhvbGRlciA9IGluZ2VzdERlZmVyVmlldyhcbiAgICAgIHVuaXQsICdQbGFjZWhvbGRlcicsIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmNoaWxkcmVuLCBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPVxuICAgICAgaW5nZXN0RGVmZXJWaWV3KHVuaXQsICdFcnJvcicsIGRlZmVyQmxvY2suZXJyb3I/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmVycm9yPy5zb3VyY2VTcGFuKTtcblxuICAvLyBDcmVhdGUgdGhlIG1haW4gZGVmZXIgb3AsIGFuZCBvcHMgZm9yIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IGRlZmVyWHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gIGNvbnN0IGRlZmVyT3AgPSBpci5jcmVhdGVEZWZlck9wKGRlZmVyWHJlZiwgbWFpbi54cmVmLCBtYWluLnNsb3QsIGRlZmVyQmxvY2suc291cmNlU3Bhbik7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJWaWV3ID0gcGxhY2Vob2xkZXI/LnhyZWYgPz8gbnVsbDtcbiAgZGVmZXJPcC5wbGFjZWhvbGRlclNsb3QgPSBwbGFjZWhvbGRlcj8uc2xvdCA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdTbG90ID0gbG9hZGluZz8uc2xvdCA/PyBudWxsO1xuICBkZWZlck9wLmVycm9yU2xvdCA9IGVycm9yPy5zbG90ID8/IG51bGw7XG4gIGRlZmVyT3AucGxhY2Vob2xkZXJNaW5pbXVtVGltZSA9IGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/Lm1pbmltdW1UaW1lID8/IG51bGw7XG4gIGRlZmVyT3AubG9hZGluZ01pbmltdW1UaW1lID0gZGVmZXJCbG9jay5sb2FkaW5nPy5taW5pbXVtVGltZSA/PyBudWxsO1xuICBkZWZlck9wLmxvYWRpbmdBZnRlclRpbWUgPSBkZWZlckJsb2NrLmxvYWRpbmc/LmFmdGVyVGltZSA/PyBudWxsO1xuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT3ApO1xuXG4gIC8vIENvbmZpZ3VyZSBhbGwgZGVmZXIgYG9uYCBjb25kaXRpb25zLlxuXG4gIC8vIFRPRE86IHJlZmFjdG9yIHByZWZldGNoIHRyaWdnZXJzIHRvIHVzZSBhIHNlcGFyYXRlIG9wIHR5cGUsIHdpdGggYSBzaGFyZWQgc3VwZXJjbGFzcy4gVGhpcyB3aWxsXG4gIC8vIG1ha2UgaXQgZWFzaWVyIHRvIHJlZmFjdG9yIHByZWZldGNoIGJlaGF2aW9yIGluIHRoZSBmdXR1cmUuXG4gIGxldCBwcmVmZXRjaCA9IGZhbHNlO1xuICBsZXQgZGVmZXJPbk9wczogaXIuRGVmZXJPbk9wW10gPSBbXTtcbiAgZm9yIChjb25zdCB0cmlnZ2VycyBvZiBbZGVmZXJCbG9jay50cmlnZ2VycywgZGVmZXJCbG9jay5wcmVmZXRjaFRyaWdnZXJzXSkge1xuICAgIGlmICh0cmlnZ2Vycy5pZGxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9XG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIHByZWZldGNoLCBudWxsISk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmltbWVkaWF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPVxuICAgICAgICAgIGlyLmNyZWF0ZURlZmVyT25PcChkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLkltbWVkaWF0ZX0sIHByZWZldGNoLCBudWxsISk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLnRpbWVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBkZWxheTogdHJpZ2dlcnMudGltZXIuZGVsYXl9LCBwcmVmZXRjaCwgbnVsbCFcbiAgICAgICk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgaWYgKHRyaWdnZXJzLmhvdmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcChcbiAgICAgICAgICBkZWZlclhyZWYsIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSG92ZXIsXG4gICAgICAgICAgICB0YXJnZXROYW1lOiB0cmlnZ2Vycy5ob3Zlci5yZWZlcmVuY2UsXG4gICAgICAgICAgICB0YXJnZXRYcmVmOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFZpZXc6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90Vmlld1N0ZXBzOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZmV0Y2gsIG51bGwhKTtcbiAgICAgIGRlZmVyT25PcHMucHVzaChkZWZlck9uT3ApO1xuICAgIH1cbiAgICBpZiAodHJpZ2dlcnMuaW50ZXJhY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVmZXJPbk9wID0gaXIuY3JlYXRlRGVmZXJPbk9wKFxuICAgICAgICAgIGRlZmVyWHJlZiwge1xuICAgICAgICAgICAga2luZDogaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbixcbiAgICAgICAgICAgIHRhcmdldE5hbWU6IHRyaWdnZXJzLmludGVyYWN0aW9uLnJlZmVyZW5jZSxcbiAgICAgICAgICAgIHRhcmdldFhyZWY6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0VmlldzogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3RWaWV3U3RlcHM6IG51bGwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmZXRjaCwgbnVsbCEpO1xuICAgICAgZGVmZXJPbk9wcy5wdXNoKGRlZmVyT25PcCk7XG4gICAgfVxuICAgIGlmICh0cmlnZ2Vycy52aWV3cG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBkZWZlck9uT3AgPSBpci5jcmVhdGVEZWZlck9uT3AoXG4gICAgICAgICAgZGVmZXJYcmVmLCB7XG4gICAgICAgICAgICBraW5kOiBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LFxuICAgICAgICAgICAgdGFyZ2V0TmFtZTogdHJpZ2dlcnMudmlld3BvcnQucmVmZXJlbmNlLFxuICAgICAgICAgICAgdGFyZ2V0WHJlZjogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG51bGwsXG4gICAgICAgICAgICB0YXJnZXRWaWV3OiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0U2xvdFZpZXdTdGVwczogbnVsbCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZWZldGNoLCBudWxsISk7XG4gICAgICBkZWZlck9uT3BzLnB1c2goZGVmZXJPbk9wKTtcbiAgICB9XG4gICAgLy8gSWYgbm8gKG5vbi1wcmVmZXRjaGluZykgZGVmZXIgdHJpZ2dlcnMgd2VyZSBwcm92aWRlZCwgZGVmYXVsdCB0byBgaWRsZWAuXG4gICAgaWYgKGRlZmVyT25PcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWZlck9uT3BzLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRGVmZXJPbk9wKGRlZmVyWHJlZiwge2tpbmQ6IGlyLkRlZmVyVHJpZ2dlcktpbmQuSWRsZX0sIGZhbHNlLCBudWxsISkpO1xuICAgIH1cbiAgICBwcmVmZXRjaCA9IHRydWU7XG4gIH1cblxuICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT25PcHMpO1xufVxuXG5mdW5jdGlvbiBpbmdlc3RJY3UodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWN1OiB0LkljdSkge1xuICBpZiAoaWN1LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBjb25zdCB4cmVmID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUljdU9wKHhyZWYsIGljdS5pMThuLCBudWxsISkpO1xuICAgIHVuaXQudXBkYXRlLnB1c2goaXIuY3JlYXRlSWN1VXBkYXRlT3AoeHJlZiwgbnVsbCEpKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgSUNVOiAke2ljdS5pMThuPy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBAZm9yYCBibG9jayBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Rm9yQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZm9yQmxvY2s6IHQuRm9yTG9vcEJsb2NrKTogdm9pZCB7XG4gIGNvbnN0IHJlcGVhdGVyVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGNvbnN0IGNyZWF0ZVJlcGVhdGVyQWxpYXMgPSAoaWRlbnQ6IHN0cmluZywgcmVwZWF0ZXJWYXI6IGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5KSA9PiB7XG4gICAgcmVwZWF0ZXJWaWV3LmFsaWFzZXMuYWRkKHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGlkZW50aWZpZXI6IGlkZW50LFxuICAgICAgZXhwcmVzc2lvbjogbmV3IGlyLkRlcml2ZWRSZXBlYXRlclZhckV4cHIocmVwZWF0ZXJWaWV3LnhyZWYsIHJlcGVhdGVyVmFyKSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyBTZXQgYWxsIHRoZSBjb250ZXh0IHZhcmlhYmxlcyBhbmQgYWxpYXNlcyBhdmFpbGFibGUgaW4gdGhlIHJlcGVhdGVyLlxuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoZm9yQmxvY2suaXRlbS5uYW1lLCBmb3JCbG9jay5pdGVtLnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgudmFsdWUpO1xuICByZXBlYXRlclZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQoXG4gICAgICBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLCBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC52YWx1ZSk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRmlyc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGxhc3QubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuTGFzdCk7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZXZlbi5uYW1lLCBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eS5FdmVuKTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuT2RkKTtcblxuICBjb25zdCBzb3VyY2VTcGFuID0gY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2sudHJhY2tCeS5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgY29uc3QgdHJhY2sgPSBjb252ZXJ0QXN0KGZvckJsb2NrLnRyYWNrQnksIHVuaXQuam9iLCBzb3VyY2VTcGFuKTtcblxuICBpbmdlc3ROb2RlcyhyZXBlYXRlclZpZXcsIGZvckJsb2NrLmNoaWxkcmVuKTtcblxuICBsZXQgZW1wdHlWaWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0fG51bGwgPSBudWxsO1xuICBpZiAoZm9yQmxvY2suZW1wdHkgIT09IG51bGwpIHtcbiAgICBlbXB0eVZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcbiAgICBpbmdlc3ROb2RlcyhlbXB0eVZpZXcsIGZvckJsb2NrLmVtcHR5LmNoaWxkcmVuKTtcbiAgfVxuXG4gIGNvbnN0IHZhck5hbWVzOiBpci5SZXBlYXRlclZhck5hbWVzID0ge1xuICAgICRpbmRleDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kaW5kZXgubmFtZSxcbiAgICAkY291bnQ6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGNvdW50Lm5hbWUsXG4gICAgJGZpcnN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRmaXJzdC5uYW1lLFxuICAgICRsYXN0OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsXG4gICAgJGV2ZW46IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSxcbiAgICAkb2RkOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRvZGQubmFtZSxcbiAgICAkaW1wbGljaXQ6IGZvckJsb2NrLml0ZW0ubmFtZSxcbiAgfTtcblxuICBjb25zdCByZXBlYXRlckNyZWF0ZSA9IGlyLmNyZWF0ZVJlcGVhdGVyQ3JlYXRlT3AoXG4gICAgICByZXBlYXRlclZpZXcueHJlZiwgZW1wdHlWaWV3Py54cmVmID8/IG51bGwsIHRyYWNrLCB2YXJOYW1lcywgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2gocmVwZWF0ZXJDcmVhdGUpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KFxuICAgICAgZm9yQmxvY2suZXhwcmVzc2lvbiwgdW5pdC5qb2IsXG4gICAgICBjb252ZXJ0U291cmNlU3Bhbihmb3JCbG9jay5leHByZXNzaW9uLnNwYW4sIGZvckJsb2NrLnNvdXJjZVNwYW4pKTtcbiAgY29uc3QgcmVwZWF0ZXIgPSBpci5jcmVhdGVSZXBlYXRlck9wKFxuICAgICAgcmVwZWF0ZXJDcmVhdGUueHJlZiwgcmVwZWF0ZXJDcmVhdGUuc2xvdCwgZXhwcmVzc2lvbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2gocmVwZWF0ZXIpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBBU1QgZXhwcmVzc2lvbiBpbnRvIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gY29udmVydEFzdChcbiAgICBhc3Q6IGUuQVNULCBqb2I6IENvbXBpbGF0aW9uSm9iLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmFzdCwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVJlYWQpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyICYmICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSwgbnVsbCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUsXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkV3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgdW5kZWZpbmVkLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNhbGwpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgSW1wbGljaXRSZWNlaXZlcmApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgICBhc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSksIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUsIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5hcnkpIHtcbiAgICBjb25zdCBvcGVyYXRvciA9IEJJTkFSWV9PUEVSQVRPUlMuZ2V0KGFzdC5vcGVyYXRpb24pO1xuICAgIGlmIChvcGVyYXRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIGJpbmFyeSBvcGVyYXRvciAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgIG9wZXJhdG9yLCBjb252ZXJ0QXN0KGFzdC5sZWZ0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QucmlnaHQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGNvbnRleHQgZXhwcmVzc2lvbnMgaGF2ZSBzb3VyY2UgbWFwcz9cbiAgICByZXR1cm4gbmV3IGlyLkNvbnRleHRFeHByKGpvYi5yb290LnhyZWYpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIHVuZGVmaW5lZCwgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DaGFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IENoYWluIGluIHVua25vd24gY29udGV4dGApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbE1hcCkge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhc3Qua2V5cy5tYXAoKGtleSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZXNbaWR4XTtcbiAgICAgIC8vIFRPRE86IHNob3VsZCBsaXRlcmFscyBoYXZlIHNvdXJjZSBtYXBzLCBvciBkbyB3ZSBqdXN0IG1hcCB0aGUgd2hvbGUgc3Vycm91bmRpbmdcbiAgICAgIC8vIGV4cHJlc3Npb24/XG4gICAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KGtleS5rZXksIGNvbnZlcnRBc3QodmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBrZXkucXVvdGVkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxBcnJheSkge1xuICAgIC8vIFRPRE86IHNob3VsZCBsaXRlcmFscyBoYXZlIHNvdXJjZSBtYXBzLCBvciBkbyB3ZSBqdXN0IG1hcCB0aGUgd2hvbGUgc3Vycm91bmRpbmcgZXhwcmVzc2lvbj9cbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihcbiAgICAgICAgYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNvbmRpdGlvbmFsKSB7XG4gICAgcmV0dXJuIG5ldyBvLkNvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QuY29uZGl0aW9uLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudHJ1ZUV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksIGNvbnZlcnRBc3QoYXN0LmZhbHNlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLk5vbk51bGxBc3NlcnQpIHtcbiAgICAvLyBBIG5vbi1udWxsIGFzc2VydGlvbiBzaG91bGRuJ3QgaW1wYWN0IGdlbmVyYXRlZCBpbnN0cnVjdGlvbnMsIHNvIHdlIGNhbiBqdXN0IGRyb3AgaXQuXG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluZGluZ1BpcGUpIHtcbiAgICAvLyBUT0RPOiBwaXBlcyBzaG91bGQgcHJvYmFibHkgaGF2ZSBzb3VyY2UgbWFwczsgZmlndXJlIG91dCBkZXRhaWxzLlxuICAgIHJldHVybiBuZXcgaXIuUGlwZUJpbmRpbmdFeHByKFxuICAgICAgICBqb2IuYWxsb2NhdGVYcmVmSWQoKSxcbiAgICAgICAgbmV3IGlyLlNsb3RIYW5kbGUoKSxcbiAgICAgICAgYXN0Lm5hbWUsXG4gICAgICAgIFtcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5leHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIC4uLmFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSxcbiAgICAgICAgXSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUtleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgaXIuU2FmZUtleWVkUmVhZEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgLy8gVE9ETzogc291cmNlIHNwYW5cbiAgICByZXR1cm4gbmV3IGlyLlNhZmVQcm9wZXJ0eVJlYWRFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgYXN0Lm5hbWUpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUNhbGwpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZUludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBhc3QuYXJncy5tYXAoYSA9PiBjb252ZXJ0QXN0KGEsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5FbXB0eUV4cHIpIHtcbiAgICByZXR1cm4gbmV3IGlyLkVtcHR5RXhwcihjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGU6ICR7YXN0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gdGVtcGxhdGUgaXMgYSBwbGFpbiBuZy10ZW1wbGF0ZSAoYXMgb3Bwb3NlZCB0byBhbm90aGVyIGtpbmQgb2YgdGVtcGxhdGVcbiAqIHN1Y2ggYXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZSBvciBjb250cm9sIGZsb3cgdGVtcGxhdGUpLiBUaGlzIGlzIGNoZWNrZWQgYmFzZWQgb24gdGhlXG4gKiB0YWdOYW1lLiBXZSBjYW4gZXhwZWN0IHRoYXQgb25seSBwbGFpbiBuZy10ZW1wbGF0ZXMgd2lsbCBjb21lIHRocm91Z2ggd2l0aCBhIHRhZ05hbWUgb2ZcbiAqICduZy10ZW1wbGF0ZScuXG4gKlxuICogSGVyZSBhcmUgc29tZSBvZiB0aGUgY2FzZXMgd2UgZXhwZWN0OlxuICpcbiAqIHwgQW5ndWxhciBIVE1MICAgICAgICAgICAgICAgICAgICAgICB8IFRlbXBsYXRlIHRhZ05hbWUgICB8XG4gKiB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCBgPG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxkaXYgKm5nSWY9XCJ0cnVlXCI+YCAgICAgICAgICAgICAgIHwgJ2RpdicgICAgICAgICAgICAgIHxcbiAqIHwgYDxzdmc+PG5nLXRlbXBsYXRlPmAgICAgICAgICAgICAgICB8ICdzdmc6bmctdGVtcGxhdGUnICB8XG4gKiB8IGBAaWYgKHRydWUpIHtgICAgICAgICAgICAgICAgICAgICAgfCAnQ29uZGl0aW9uYWwnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHBsYWluKSAgICAgIHwgJ25nLXRlbXBsYXRlJyAgICAgIHxcbiAqIHwgYDxuZy10ZW1wbGF0ZSAqbmdJZj5gIChzdHJ1Y3R1cmFsKSB8IG51bGwgICAgICAgICAgICAgICB8XG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5UZW1wbGF0ZSh0bXBsOiB0LlRlbXBsYXRlKSB7XG4gIHJldHVybiBzcGxpdE5zTmFtZSh0bXBsLnRhZ05hbWUgPz8gJycpWzFdID09PSAnbmctdGVtcGxhdGUnO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYWxsIG9mIHRoZSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50LWxpa2Ugc3RydWN0dXJlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kIGNvbnZlcnQgdGhlbVxuICogdG8gdGhlaXIgSVIgcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEJpbmRpbmdzKFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBsZXQgZmxhZ3M6IEJpbmRpbmdGbGFncyA9IEJpbmRpbmdGbGFncy5Ob25lO1xuICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICBmbGFncyB8PSBCaW5kaW5nRmxhZ3MuT25OZ1RlbXBsYXRlRWxlbWVudDtcbiAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgaXNQbGFpblRlbXBsYXRlKGVsZW1lbnQpKSB7XG4gICAgICBmbGFncyB8PSBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUF0dHJGbGFncyA9XG4gICAgICAgIGZsYWdzIHwgQmluZGluZ0ZsYWdzLkJpbmRpbmdUYXJnZXRzVGVtcGxhdGUgfCBCaW5kaW5nRmxhZ3MuSXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU7XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQudGVtcGxhdGVBdHRycykge1xuICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIHRlbXBsYXRlQXR0ckZsYWdzIHwgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlLCBhdHRyLnR5cGUsIGF0dHIudW5pdCwgYXR0ci5zZWN1cml0eUNvbnRleHQsXG4gICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4sIHRlbXBsYXRlQXR0ckZsYWdzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gVGhpcyBpcyBvbmx5IGF0dHJpYnV0ZSBUZXh0TGl0ZXJhbCBiaW5kaW5ncywgc3VjaCBhcyBgYXR0ci5mb289XCJiYXJcImAuIFRoaXMgY2FuIG5ldmVyIGJlXG4gICAgLy8gYFthdHRyLmZvb109XCJiYXJcImAgb3IgYGF0dHIuZm9vPVwie3tiYXJ9fVwiYCwgYm90aCBvZiB3aGljaCB3aWxsIGJlIGhhbmRsZWQgYXMgaW5wdXRzIHdpdGhcbiAgICAvLyBgQmluZGluZ1R5cGUuQXR0cmlidXRlYC5cbiAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICB1bml0LCBvcC54cmVmLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSwgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIG51bGwsXG4gICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIGZsYWdzIHwgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSk7XG4gIH1cbiAgZm9yIChjb25zdCBpbnB1dCBvZiBlbGVtZW50LmlucHV0cykge1xuICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgIHVuaXQsIG9wLnhyZWYsIGlucHV0Lm5hbWUsIGlucHV0LnZhbHVlLCBpbnB1dC50eXBlLCBpbnB1dC51bml0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQsXG4gICAgICAgIGlucHV0LnNvdXJjZVNwYW4sIGZsYWdzKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGxldCBsaXN0ZW5lck9wOiBpci5MaXN0ZW5lck9wO1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICBpZiAob3V0cHV0LnBoYXNlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBbmltYXRpb24gbGlzdGVuZXIgc2hvdWxkIGhhdmUgYSBwaGFzZScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiAhaXNQbGFpblRlbXBsYXRlKGVsZW1lbnQpKSB7XG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKFxuICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKG9wLnhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBvdXRwdXQubmFtZSwgbnVsbCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGlzdGVuZXJPcCA9IGlyLmNyZWF0ZUxpc3RlbmVyT3AoXG4gICAgICAgIG9wLnhyZWYsIG9wLnNsb3QsIG91dHB1dC5uYW1lLCBvcC50YWcsIG91dHB1dC5waGFzZSwgZmFsc2UsIG91dHB1dC5zb3VyY2VTcGFuKTtcblxuICAgIC8vIGlmIG91dHB1dC5oYW5kbGVyIGlzIGEgY2hhaW4sIHRoZW4gcHVzaCBlYWNoIHN0YXRlbWVudCBmcm9tIHRoZSBjaGFpbiBzZXBhcmF0ZWx5LCBhbmRcbiAgICAvLyByZXR1cm4gdGhlIGxhc3Qgb25lP1xuICAgIGxldCBoYW5kbGVyRXhwcnM6IGUuQVNUW107XG4gICAgbGV0IGhhbmRsZXI6IGUuQVNUID0gb3V0cHV0LmhhbmRsZXI7XG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmFzdDtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IGhhbmRsZXIuZXhwcmVzc2lvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJFeHBycyA9IFtoYW5kbGVyXTtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlckV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBoYW5kbGVyRXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgb3V0cHV0LmhhbmRsZXJTcGFuKSk7XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcblxuICAgIGZvciAoY29uc3QgZXhwciBvZiBleHByZXNzaW9ucykge1xuICAgICAgY29uc3Qgc3RtdE9wID1cbiAgICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4obmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBleHByLnNvdXJjZVNwYW4pKTtcbiAgICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKHN0bXRPcCk7XG4gICAgfVxuICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKFxuICAgICAgICBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwciwgcmV0dXJuRXhwci5zb3VyY2VTcGFuKSkpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2gobGlzdGVuZXJPcCk7XG4gIH1cbn1cblxuY29uc3QgQklORElOR19LSU5EUyA9IG5ldyBNYXA8ZS5CaW5kaW5nVHlwZSwgaXIuQmluZGluZ0tpbmQ+KFtcbiAgW2UuQmluZGluZ1R5cGUuUHJvcGVydHksIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGVdLFxuICBbZS5CaW5kaW5nVHlwZS5DbGFzcywgaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lXSxcbiAgW2UuQmluZGluZ1R5cGUuU3R5bGUsIGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BbmltYXRpb24sIGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbl0sXG5dKTtcblxuZW51bSBCaW5kaW5nRmxhZ3Mge1xuICBOb25lID0gMGIwMDAsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGlzIHRvIGEgc3RhdGljIHRleHQgbGl0ZXJhbCBhbmQgbm90IHRvIGFuIGV4cHJlc3Npb24uXG4gICAqL1xuICBUZXh0VmFsdWUgPSAwYjAwMDEsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGJlbG9uZ3MgdG8gdGhlIGA8bmctdGVtcGxhdGU+YCBzaWRlIG9mIGEgYHQuVGVtcGxhdGVgLlxuICAgKi9cbiAgQmluZGluZ1RhcmdldHNUZW1wbGF0ZSA9IDBiMDAxMCxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgaXMgb24gYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZS5cbiAgICovXG4gIElzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlID0gMGIwMTAwLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBpcyBvbiBhIGB0LlRlbXBsYXRlYC5cbiAgICovXG4gIE9uTmdUZW1wbGF0ZUVsZW1lbnQgPSAwYjEwMDAsXG59XG5cbmZ1bmN0aW9uIGluZ2VzdEJpbmRpbmcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgeHJlZjogaXIuWHJlZklkLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBlLkFTVHxvLkV4cHJlc3Npb24sXG4gICAgdHlwZTogZS5CaW5kaW5nVHlwZSwgdW5pdDogc3RyaW5nfG51bGwsIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZmxhZ3M6IEJpbmRpbmdGbGFncyk6IHZvaWQge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmFzdDtcbiAgfVxuXG4gIGlmIChmbGFncyAmIEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50ICYmICEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSkgJiZcbiAgICAgIHR5cGUgPT09IGUuQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAvLyBUaGlzIGJpbmRpbmcgb25seSBleGlzdHMgZm9yIGxhdGVyIGNvbnN0IGV4dHJhY3Rpb24sIGFuZCBpcyBub3QgYW4gYWN0dWFsIGJpbmRpbmcgdG8gYmVcbiAgICAvLyBjcmVhdGVkLlxuICAgIHZpZXcuY3JlYXRlLnB1c2goaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoeHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG5hbWUsIG51bGwpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIC8vIFRPRE86IFdlIGNvdWxkIGVhc2lseSBnZW5lcmF0ZSBzb3VyY2UgbWFwcyBmb3Igc3ViZXhwcmVzc2lvbnMgaW4gdGhlc2UgY2FzZXMsIGJ1dFxuICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90LiBTaG91bGQgd2UgZG8gc28/XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LmpvYiwgbnVsbCkpKTtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUKSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QodmFsdWUsIHZpZXcuam9iLCBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gdmFsdWU7XG4gIH1cblxuICBjb25zdCBraW5kOiBpci5CaW5kaW5nS2luZCA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcbiAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICB4cmVmLCBraW5kLCBuYW1lLCBleHByZXNzaW9uLCB1bml0LCBzZWN1cml0eUNvbnRleHQsICEhKGZsYWdzICYgQmluZGluZ0ZsYWdzLlRleHRWYWx1ZSksXG4gICAgICAhIShmbGFncyAmIEJpbmRpbmdGbGFncy5Jc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSksIHNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgbG9jYWwgcmVmZXJlbmNlcyBvbiBhbiBlbGVtZW50LWxpa2Ugc3RydWN0dXJlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kXG4gKiBjb252ZXJ0IHRoZW0gdG8gdGhlaXIgSVIgcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFJlZmVyZW5jZXMob3A6IGlyLkVsZW1lbnRPcEJhc2UsIGVsZW1lbnQ6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGFzc2VydElzQXJyYXk8aXIuTG9jYWxSZWY+KG9wLmxvY2FsUmVmcyk7XG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiBlbGVtZW50LnJlZmVyZW5jZXMpIHtcbiAgICBvcC5sb2NhbFJlZnMucHVzaCh7XG4gICAgICBuYW1lLFxuICAgICAgdGFyZ2V0OiB2YWx1ZSxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSBnaXZlbiB2YWx1ZSBpcyBhbiBhcnJheS5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0SXNBcnJheTxUPih2YWx1ZTogYW55KTogYXNzZXJ0cyB2YWx1ZSBpcyBBcnJheTxUPiB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBhbiBhcnJheWApO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhYnNvbHV0ZSBgUGFyc2VTb3VyY2VTcGFuYCBmcm9tIHRoZSByZWxhdGl2ZSBgUGFyc2VTcGFuYC5cbiAqXG4gKiBgUGFyc2VTcGFuYCBvYmplY3RzIGFyZSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGV4cHJlc3Npb24uXG4gKiBUaGlzIG1ldGhvZCBjb252ZXJ0cyB0aGVzZSB0byBmdWxsIGBQYXJzZVNvdXJjZVNwYW5gIG9iamVjdHMgdGhhdFxuICogc2hvdyB3aGVyZSB0aGUgc3BhbiBpcyB3aXRoaW4gdGhlIG92ZXJhbGwgc291cmNlIGZpbGUuXG4gKlxuICogQHBhcmFtIHNwYW4gdGhlIHJlbGF0aXZlIHNwYW4gdG8gY29udmVydC5cbiAqIEBwYXJhbSBiYXNlU291cmNlU3BhbiBhIHNwYW4gY29ycmVzcG9uZGluZyB0byB0aGUgYmFzZSBvZiB0aGUgZXhwcmVzc2lvbiB0cmVlLlxuICogQHJldHVybnMgYSBgUGFyc2VTb3VyY2VTcGFuYCBmb3IgdGhlIGdpdmVuIHNwYW4gb3IgbnVsbCBpZiBubyBgYmFzZVNvdXJjZVNwYW5gIHdhcyBwcm92aWRlZC5cbiAqL1xuZnVuY3Rpb24gY29udmVydFNvdXJjZVNwYW4oXG4gICAgc3BhbjogZS5QYXJzZVNwYW4sIGJhc2VTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IFBhcnNlU291cmNlU3BhbnxudWxsIHtcbiAgaWYgKGJhc2VTb3VyY2VTcGFuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3Qgc3RhcnQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIGNvbnN0IGVuZCA9IGJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLmVuZCk7XG4gIGNvbnN0IGZ1bGxTdGFydCA9IGJhc2VTb3VyY2VTcGFuLmZ1bGxTdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQsIGZ1bGxTdGFydCk7XG59XG4iXX0=