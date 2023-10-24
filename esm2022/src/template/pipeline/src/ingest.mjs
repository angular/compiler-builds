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
    const eventBinding = ir.createListenerOp(job.root.xref, event.name, null, event.targetOrPhase, true, event.sourceSpan);
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
    let conditions = [];
    for (const ifCase of ifBlock.branches) {
        const cView = unit.job.allocateView(unit.xref);
        if (ifCase.expressionAlias !== null) {
            cView.contextVariables.set(ifCase.expressionAlias.name, ir.CTX_REF);
        }
        if (firstXref === null) {
            firstXref = cView.xref;
        }
        unit.create.push(ir.createTemplateOp(cView.xref, 'Conditional', ir.Namespace.HTML, true, undefined /* TODO: figure out how i18n works with new control flow */, ifCase.sourceSpan));
        const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, cView.xref, ifCase.expressionAlias);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, ifCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, null, conditions, ifBlock.sourceSpan);
    unit.update.push(conditional);
}
/**
 * Ingest an `@switch` block into the given `ViewCompilation`.
 */
function ingestSwitchBlock(unit, switchBlock) {
    let firstXref = null;
    let conditions = [];
    for (const switchCase of switchBlock.cases) {
        const cView = unit.job.allocateView(unit.xref);
        if (firstXref === null) {
            firstXref = cView.xref;
        }
        unit.create.push(ir.createTemplateOp(cView.xref, 'Case', ir.Namespace.HTML, true, undefined /* TODO: figure out how i18n works with new control flow */, switchCase.sourceSpan));
        const caseExpr = switchCase.expression ?
            convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan) :
            null;
        const conditionalCaseExpr = new ir.ConditionalCaseExpr(caseExpr, cView.xref);
        conditions.push(conditionalCaseExpr);
        ingestNodes(cView, switchCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, convertAst(switchBlock.expression, unit.job, null), conditions, switchBlock.sourceSpan);
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
    const deferOp = ir.createDeferOp(unit.job.allocateXrefId(), main.xref, deferBlock.sourceSpan);
    unit.create.push(deferOp);
    if (loading && deferBlock.loading) {
        deferOp.loading =
            ir.createDeferSecondaryOp(deferOp.xref, loading.xref, ir.DeferSecondaryKind.Loading);
        if (deferBlock.loading.afterTime !== null || deferBlock.loading.minimumTime !== null) {
            deferOp.loading.constValue = [deferBlock.loading.minimumTime, deferBlock.loading.afterTime];
        }
        unit.create.push(deferOp.loading);
    }
    if (placeholder && deferBlock.placeholder) {
        deferOp.placeholder = ir.createDeferSecondaryOp(deferOp.xref, placeholder.xref, ir.DeferSecondaryKind.Placeholder);
        if (deferBlock.placeholder.minimumTime !== null) {
            deferOp.placeholder.constValue = [deferBlock.placeholder.minimumTime];
        }
        unit.create.push(deferOp.placeholder);
    }
    if (error && deferBlock.error) {
        deferOp.error =
            ir.createDeferSecondaryOp(deferOp.xref, error.xref, ir.DeferSecondaryKind.Error);
        unit.create.push(deferOp.error);
    }
    // Configure all defer conditions.
    const deferOnOp = ir.createDeferOnOp(unit.job.allocateXrefId(), null);
    // Add all ops to the view.
    unit.create.push(deferOnOp);
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
    const repeater = ir.createRepeaterOp(repeaterCreate.xref, expression, forBlock.sourceSpan);
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
        return new ir.PipeBindingExpr(job.allocateXrefId(), ast.name, [
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
        listenerOp =
            ir.createListenerOp(op.xref, output.name, op.tag, output.phase, false, output.sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFHN0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFDLHVCQUF1QixFQUFFLHlCQUF5QixFQUFnRCxNQUFNLGVBQWUsQ0FBQztBQUNoSSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsZUFBZSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRS9ELE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDO0FBRXpFOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUMzQixhQUFxQixFQUFFLFFBQWtCLEVBQUUsWUFBMEIsRUFDckUsdUJBQStCLEVBQUUsa0JBQTJCO0lBQzlELE1BQU0sR0FBRyxHQUFHLElBQUksdUJBQXVCLENBQ25DLGFBQWEsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNqRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMs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QUFFO1FBQzNCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEQsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xELE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5RCxPQUFPLElBQUksZUFBZSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDcEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBlIGZyb20gJy4uLy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtCSU5BUllfT1BFUkFUT1JTLCBuYW1lc3BhY2VGb3JLZXl9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbmNvbnN0IGNvbXBhdGliaWxpdHlNb2RlID0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcjtcblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICogVE9ETzogUmVmYWN0b3IgbW9yZSBvZiB0aGUgaW5nZXN0aW9uIGNvZGUgaW50byBwaGFzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RDb21wb25lbnQoXG4gICAgY29tcG9uZW50TmFtZTogc3RyaW5nLCB0ZW1wbGF0ZTogdC5Ob2RlW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbik6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iIHtcbiAgY29uc3QgY3BsID0gbmV3IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKFxuICAgICAgY29tcG9uZW50TmFtZSwgY29uc3RhbnRQb29sLCBjb21wYXRpYmlsaXR5TW9kZSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIGkxOG5Vc2VFeHRlcm5hbElkcyk7XG4gIGluZ2VzdE5vZGVzKGNwbC5yb290LCB0ZW1wbGF0ZSk7XG4gIHJldHVybiBjcGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9zdEJpbmRpbmdJbnB1dCB7XG4gIGNvbXBvbmVudE5hbWU6IHN0cmluZztcbiAgcHJvcGVydGllczogZS5QYXJzZWRQcm9wZXJ0eVtdfG51bGw7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBldmVudHM6IGUuUGFyc2VkRXZlbnRbXXxudWxsO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBob3N0IGJpbmRpbmcgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYmAgaW4gdGhlIGludGVybWVkaWF0ZVxuICogcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QmluZGluZyhcbiAgICBpbnB1dDogSG9zdEJpbmRpbmdJbnB1dCwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBqb2IgPSBuZXcgSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYihpbnB1dC5jb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlKTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBpbnB1dC5wcm9wZXJ0aWVzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdFByb3BlcnR5KGpvYiwgcHJvcGVydHksIGZhbHNlKTtcbiAgfVxuICBmb3IgKGNvbnN0IFtuYW1lLCBleHByXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dC5hdHRyaWJ1dGVzKSA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RBdHRyaWJ1dGUoam9iLCBuYW1lLCBleHByKTtcbiAgfVxuICBmb3IgKGNvbnN0IGV2ZW50IG9mIGlucHV0LmV2ZW50cyA/PyBbXSkge1xuICAgIGluZ2VzdEhvc3RFdmVudChqb2IsIGV2ZW50KTtcbiAgfVxuICByZXR1cm4gam9iO1xufVxuXG4vLyBUT0RPOiBXZSBzaG91bGQgcmVmYWN0b3IgdGhlIHBhcnNlciB0byB1c2UgdGhlIHNhbWUgdHlwZXMgYW5kIHN0cnVjdHVyZXMgZm9yIGhvc3QgYmluZGluZ3MgYXNcbi8vIHdpdGggb3JkaW5hcnkgY29tcG9uZW50cy4gVGhpcyB3b3VsZCBhbGxvdyB1cyB0byBzaGFyZSBhIGxvdCBtb3JlIGluZ2VzdGlvbiBjb2RlLlxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RQcm9wZXJ0eShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIHByb3BlcnR5OiBlLlBhcnNlZFByb3BlcnR5LCBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICBjb25zdCBhc3QgPSBwcm9wZXJ0eS5leHByZXNzaW9uLmFzdDtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgYXN0LnN0cmluZ3MsIGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGpvYiwgcHJvcGVydHkuc291cmNlU3BhbikpKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gY29udmVydEFzdChhc3QsIGpvYiwgcHJvcGVydHkuc291cmNlU3Bhbik7XG4gIH1cbiAgbGV0IGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gIC8vIFRPRE86IHRoaXMgc2hvdWxkIHJlYWxseSBiZSBoYW5kbGVkIGluIHRoZSBwYXJzZXIuXG4gIGlmIChwcm9wZXJ0eS5uYW1lLnN0YXJ0c1dpdGgoJ2F0dHIuJykpIHtcbiAgICBwcm9wZXJ0eS5uYW1lID0gcHJvcGVydHkubmFtZS5zdWJzdHJpbmcoJ2F0dHIuJy5sZW5ndGgpO1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlO1xuICB9XG4gIGlmIChwcm9wZXJ0eS5pc0FuaW1hdGlvbikge1xuICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uO1xuICB9XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGJpbmRpbmdLaW5kLCBwcm9wZXJ0eS5uYW1lLCBleHByZXNzaW9uLCBudWxsLFxuICAgICAgU2VjdXJpdHlDb250ZXh0XG4gICAgICAgICAgLk5PTkUgLyogVE9ETzogd2hhdCBzaG91bGQgd2UgcGFzcyBhcyBzZWN1cml0eSBjb250ZXh0PyBQYXNzaW5nIE5PTkUgZm9yIG5vdy4gKi8sXG4gICAgICBpc1RleHRBdHRyaWJ1dGUsIGZhbHNlLCBwcm9wZXJ0eS5zb3VyY2VTcGFuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmdlc3RIb3N0QXR0cmlidXRlKFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgbmFtZTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gIGNvbnN0IGF0dHJCaW5kaW5nID0gaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgam9iLnJvb3QueHJlZiwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBuYW1lLCB2YWx1ZSwgbnVsbCwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIHRydWUsIGZhbHNlLFxuICAgICAgLyogVE9ETzogaG9zdCBhdHRyaWJ1dGUgc291cmNlIHNwYW5zICovIG51bGwhKTtcbiAgam9iLnJvb3QudXBkYXRlLnB1c2goYXR0ckJpbmRpbmcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEV2ZW50KGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgZXZlbnQ6IGUuUGFyc2VkRXZlbnQpIHtcbiAgY29uc3QgZXZlbnRCaW5kaW5nID0gaXIuY3JlYXRlTGlzdGVuZXJPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGV2ZW50Lm5hbWUsIG51bGwsIGV2ZW50LnRhcmdldE9yUGhhc2UsIHRydWUsIGV2ZW50LnNvdXJjZVNwYW4pO1xuICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBhIGNoYWluP1xuICBldmVudEJpbmRpbmcuaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChcbiAgICAgIGNvbnZlcnRBc3QoZXZlbnQuaGFuZGxlci5hc3QsIGpvYiwgZXZlbnQuc291cmNlU3BhbiksIGV2ZW50LmhhbmRsZXJTcGFuKSkpO1xuICBqb2Iucm9vdC5jcmVhdGUucHVzaChldmVudEJpbmRpbmcpO1xufVxuXG4vKipcbiAqIEluZ2VzdCB0aGUgbm9kZXMgb2YgYSB0ZW1wbGF0ZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdE5vZGVzKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRlbXBsYXRlOiB0Lk5vZGVbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IG5vZGUgb2YgdGVtcGxhdGUpIHtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgaW5nZXN0RWxlbWVudCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgICBpbmdlc3RUZW1wbGF0ZSh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkNvbnRlbnQpIHtcbiAgICAgIGluZ2VzdENvbnRlbnQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBpbmdlc3RUZXh0KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICBpbmdlc3RCb3VuZFRleHQodW5pdCwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5JZkJsb2NrKSB7XG4gICAgICBpbmdlc3RJZkJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuU3dpdGNoQmxvY2spIHtcbiAgICAgIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRGVmZXJyZWRCbG9jaykge1xuICAgICAgaW5nZXN0RGVmZXJCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkljdSkge1xuICAgICAgaW5nZXN0SWN1KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuRm9yTG9vcEJsb2NrKSB7XG4gICAgICBpbmdlc3RGb3JCbG9jayh1bml0LCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB0ZW1wbGF0ZSBub2RlOiAke25vZGUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gZWxlbWVudCBBU1QgZnJvbSB0aGUgdGVtcGxhdGUgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGlmIChlbGVtZW50LmkxOG4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIShlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgfHwgZWxlbWVudC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikpIHtcbiAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIGkxOG4gbWV0YWRhdGEgdHlwZSBmb3IgZWxlbWVudDogJHtlbGVtZW50LmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IHN0YXRpY0F0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIHN0YXRpY0F0dHJpYnV0ZXNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG4gIH1cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgICAgZWxlbWVudE5hbWUsIGlkLCBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlS2V5KSxcbiAgICAgIGVsZW1lbnQuaTE4biBpbnN0YW5jZW9mIGkxOG4uVGFnUGxhY2Vob2xkZXIgPyBlbGVtZW50LmkxOG4gOiB1bmRlZmluZWQsXG4gICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goc3RhcnRPcCk7XG5cbiAgaW5nZXN0QmluZGluZ3ModW5pdCwgc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdE5vZGVzKHVuaXQsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gIGNvbnN0IGVuZE9wID0gaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKGVuZE9wKTtcblxuICAvLyBJZiB0aGVyZSBpcyBhbiBpMThuIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZWxlbWVudCwgaW5zZXJ0IGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gIGlmIChlbGVtZW50LmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICBjb25zdCBpMThuQmxvY2tJZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVJMThuU3RhcnRPcChpMThuQmxvY2tJZCwgZWxlbWVudC5pMThuKSwgc3RhcnRPcCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oaXIuY3JlYXRlSTE4bkVuZE9wKGkxOG5CbG9ja0lkKSwgZW5kT3ApO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBuZy10ZW1wbGF0ZWAgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRtcGw6IHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKHRtcGwuaTE4biAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhKHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSB8fCB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyKSkge1xuICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgaTE4biBtZXRhZGF0YSB0eXBlIGZvciB0ZW1wbGF0ZTogJHt0bXBsLmkxOG4uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IGNoaWxkVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuXG4gIGxldCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9IHRtcGwudGFnTmFtZTtcbiAgbGV0IG5hbWVzcGFjZVByZWZpeDogc3RyaW5nfG51bGwgPSAnJztcbiAgaWYgKHRtcGwudGFnTmFtZSkge1xuICAgIFtuYW1lc3BhY2VQcmVmaXgsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlXSA9IHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXIgPSB0bXBsLmkxOG4gaW5zdGFuY2VvZiBpMThuLlRhZ1BsYWNlaG9sZGVyID8gdG1wbC5pMThuIDogdW5kZWZpbmVkO1xuICBjb25zdCB0cGxPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBjaGlsZFZpZXcueHJlZiwgdGFnTmFtZVdpdGhvdXROYW1lc3BhY2UsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VQcmVmaXgpLCBmYWxzZSxcbiAgICAgIGkxOG5QbGFjZWhvbGRlciwgdG1wbC5zdGFydFNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHRwbE9wKTtcblxuICBpbmdlc3RCaW5kaW5ncyh1bml0LCB0cGxPcCwgdG1wbCk7XG4gIGluZ2VzdFJlZmVyZW5jZXModHBsT3AsIHRtcGwpO1xuICBpbmdlc3ROb2RlcyhjaGlsZFZpZXcsIHRtcGwuY2hpbGRyZW4pO1xuXG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiB0bXBsLnZhcmlhYmxlcykge1xuICAgIGNoaWxkVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChuYW1lLCB2YWx1ZSAhPT0gJycgPyB2YWx1ZSA6ICckaW1wbGljaXQnKTtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSBwbGFpbiB0ZW1wbGF0ZSBhbmQgdGhlcmUgaXMgYW4gaTE4biBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCBpdCwgaW5zZXJ0IGkxOG4gc3RhcnRcbiAgLy8gYW5kIGVuZCBvcHMuIEZvciBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZXMsIHRoZSBpMThuIG9wcyB3aWxsIGJlIGFkZGVkIHdoZW4gaW5nZXN0aW5nIHRoZVxuICAvLyBlbGVtZW50L3RlbXBsYXRlIHRoZSBkaXJlY3RpdmUgaXMgcGxhY2VkIG9uLlxuICBpZiAoaXNQbGFpblRlbXBsYXRlKHRtcGwpICYmIHRtcGwuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHRtcGwuaTE4biksIGNoaWxkVmlldy5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCBjaGlsZFZpZXcuY3JlYXRlLnRhaWwpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RDb250ZW50KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGNvbnRlbnQ6IHQuQ29udGVudCk6IHZvaWQge1xuICBjb25zdCBvcCA9IGlyLmNyZWF0ZVByb2plY3Rpb25PcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBjb250ZW50LnNlbGVjdG9yLCBjb250ZW50LnNvdXJjZVNwYW4pO1xuICBmb3IgKGNvbnN0IGF0dHIgb2YgY29udGVudC5hdHRyaWJ1dGVzKSB7XG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKTtcbiAgfVxuICB1bml0LmNyZWF0ZS5wdXNoKG9wKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5UZXh0KTogdm9pZCB7XG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbikpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHRleHQ6IHQuQm91bmRUZXh0KTogdm9pZCB7XG4gIGxldCB2YWx1ZSA9IHRleHQudmFsdWU7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHZhbHVlID0gdmFsdWUuYXN0O1xuICB9XG4gIGlmICghKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBJbnRlcnBvbGF0aW9uIGZvciBCb3VuZFRleHQgbm9kZSwgZ290ICR7dmFsdWUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuICBpZiAodGV4dC5pMThuICE9PSB1bmRlZmluZWQgJiYgISh0ZXh0LmkxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lcikpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIHRleHQgaW50ZXJwb2xhdGlvbjogJHt0ZXh0LmkxOG4/LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cblxuICBjb25zdCBpMThuUGxhY2Vob2xkZXJzID0gdGV4dC5pMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIgP1xuICAgICAgdGV4dC5pMThuLmNoaWxkcmVuLmZpbHRlcihcbiAgICAgICAgICAobm9kZSk6IG5vZGUgaXMgaTE4bi5QbGFjZWhvbGRlciA9PiBub2RlIGluc3RhbmNlb2YgaTE4bi5QbGFjZWhvbGRlcikgOlxuICAgICAgW107XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIHRleHQuc291cmNlU3BhbikpO1xuICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90IGdlbmVyYXRlIHNvdXJjZSBtYXBzIGZvciBzdWItZXhwcmVzc2lvbnMgaW5zaWRlIGFuXG4gIC8vIGludGVycG9sYXRpb24uIFdlIGNvcHkgdGhhdCBiZWhhdmlvciBpbiBjb21wYXRpYmlsaXR5IG1vZGUuXG4gIC8vIFRPRE86IGlzIGl0IGFjdHVhbGx5IGNvcnJlY3QgdG8gZ2VuZXJhdGUgdGhlc2UgZXh0cmEgbWFwcyBpbiBtb2Rlcm4gbW9kZT9cbiAgY29uc3QgYmFzZVNvdXJjZVNwYW4gPSB1bml0LmpvYi5jb21wYXRpYmlsaXR5ID8gbnVsbCA6IHRleHQuc291cmNlU3BhbjtcbiAgdW5pdC51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVRleHRPcChcbiAgICAgIHRleHRYcmVmLFxuICAgICAgbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB1bml0LmpvYiwgYmFzZVNvdXJjZVNwYW4pKSksXG4gICAgICBpMThuUGxhY2Vob2xkZXJzLCB0ZXh0LnNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYEBpZmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdElmQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgaWZCbG9jazogdC5JZkJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3QgaWZDYXNlIG9mIGlmQmxvY2suYnJhbmNoZXMpIHtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGlmIChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICBjVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChpZkNhc2UuZXhwcmVzc2lvbkFsaWFzLm5hbWUsIGlyLkNUWF9SRUYpO1xuICAgIH1cbiAgICBpZiAoZmlyc3RYcmVmID09PSBudWxsKSB7XG4gICAgICBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgIH1cbiAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICAgIGNWaWV3LnhyZWYsICdDb25kaXRpb25hbCcsIGlyLk5hbWVzcGFjZS5IVE1MLCB0cnVlLFxuICAgICAgICB1bmRlZmluZWQgLyogVE9ETzogZmlndXJlIG91dCBob3cgaTE4biB3b3JrcyB3aXRoIG5ldyBjb250cm9sIGZsb3cgKi8sIGlmQ2FzZS5zb3VyY2VTcGFuKSk7XG4gICAgY29uc3QgY2FzZUV4cHIgPSBpZkNhc2UuZXhwcmVzc2lvbiA/IGNvbnZlcnRBc3QoaWZDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBudWxsKSA6IG51bGw7XG4gICAgY29uc3QgY29uZGl0aW9uYWxDYXNlRXhwciA9XG4gICAgICAgIG5ldyBpci5Db25kaXRpb25hbENhc2VFeHByKGNhc2VFeHByLCBjVmlldy54cmVmLCBpZkNhc2UuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICBjb25kaXRpb25zLnB1c2goY29uZGl0aW9uYWxDYXNlRXhwcik7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIGlmQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKGZpcnN0WHJlZiEsIG51bGwsIGNvbmRpdGlvbnMsIGlmQmxvY2suc291cmNlU3Bhbik7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQHN3aXRjaGAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHI+ID0gW107XG4gIGZvciAoY29uc3Qgc3dpdGNoQ2FzZSBvZiBzd2l0Y2hCbG9jay5jYXNlcykge1xuICAgIGNvbnN0IGNWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgaWYgKGZpcnN0WHJlZiA9PT0gbnVsbCkge1xuICAgICAgZmlyc3RYcmVmID0gY1ZpZXcueHJlZjtcbiAgICB9XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgICBjVmlldy54cmVmLCAnQ2FzZScsIGlyLk5hbWVzcGFjZS5IVE1MLCB0cnVlLFxuICAgICAgICB1bmRlZmluZWQgLyogVE9ETzogZmlndXJlIG91dCBob3cgaTE4biB3b3JrcyB3aXRoIG5ldyBjb250cm9sIGZsb3cgKi8sXG4gICAgICAgIHN3aXRjaENhc2Uuc291cmNlU3BhbikpO1xuICAgIGNvbnN0IGNhc2VFeHByID0gc3dpdGNoQ2FzZS5leHByZXNzaW9uID9cbiAgICAgICAgY29udmVydEFzdChzd2l0Y2hDYXNlLmV4cHJlc3Npb24sIHVuaXQuam9iLCBzd2l0Y2hCbG9jay5zdGFydFNvdXJjZVNwYW4pIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBjb25kaXRpb25hbENhc2VFeHByID0gbmV3IGlyLkNvbmRpdGlvbmFsQ2FzZUV4cHIoY2FzZUV4cHIsIGNWaWV3LnhyZWYpO1xuICAgIGNvbmRpdGlvbnMucHVzaChjb25kaXRpb25hbENhc2VFeHByKTtcbiAgICBpbmdlc3ROb2RlcyhjVmlldywgc3dpdGNoQ2FzZS5jaGlsZHJlbik7XG4gIH1cbiAgY29uc3QgY29uZGl0aW9uYWwgPSBpci5jcmVhdGVDb25kaXRpb25hbE9wKFxuICAgICAgZmlyc3RYcmVmISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiwgbnVsbCksIGNvbmRpdGlvbnMsXG4gICAgICBzd2l0Y2hCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChjb25kaXRpb25hbCk7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyVmlldyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWZmaXg6IHN0cmluZywgY2hpbGRyZW4/OiB0Lk5vZGVbXSxcbiAgICBzb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogaXIuVGVtcGxhdGVPcHxudWxsIHtcbiAgaWYgKGNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZWNvbmRhcnlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gIGluZ2VzdE5vZGVzKHNlY29uZGFyeVZpZXcsIGNoaWxkcmVuKTtcbiAgY29uc3QgdGVtcGxhdGVPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoXG4gICAgICBzZWNvbmRhcnlWaWV3LnhyZWYsIGBEZWZlciR7c3VmZml4fWAsIGlyLk5hbWVzcGFjZS5IVE1MLCB0cnVlLCB1bmRlZmluZWQsIHNvdXJjZVNwYW4hKTtcbiAgdW5pdC5jcmVhdGUucHVzaCh0ZW1wbGF0ZU9wKTtcbiAgcmV0dXJuIHRlbXBsYXRlT3A7XG59XG5cbmZ1bmN0aW9uIGluZ2VzdERlZmVyQmxvY2sodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZGVmZXJCbG9jazogdC5EZWZlcnJlZEJsb2NrKTogdm9pZCB7XG4gIC8vIEdlbmVyYXRlIHRoZSBkZWZlciBtYWluIHZpZXcgYW5kIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IG1haW4gPSBpbmdlc3REZWZlclZpZXcodW5pdCwgJycsIGRlZmVyQmxvY2suY2hpbGRyZW4sIGRlZmVyQmxvY2suc291cmNlU3BhbikhO1xuICBjb25zdCBsb2FkaW5nID0gaW5nZXN0RGVmZXJWaWV3KFxuICAgICAgdW5pdCwgJ0xvYWRpbmcnLCBkZWZlckJsb2NrLmxvYWRpbmc/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmxvYWRpbmc/LnNvdXJjZVNwYW4pO1xuICBjb25zdCBwbGFjZWhvbGRlciA9IGluZ2VzdERlZmVyVmlldyhcbiAgICAgIHVuaXQsICdQbGFjZWhvbGRlcicsIGRlZmVyQmxvY2sucGxhY2Vob2xkZXI/LmNoaWxkcmVuLCBkZWZlckJsb2NrLnBsYWNlaG9sZGVyPy5zb3VyY2VTcGFuKTtcbiAgY29uc3QgZXJyb3IgPVxuICAgICAgaW5nZXN0RGVmZXJWaWV3KHVuaXQsICdFcnJvcicsIGRlZmVyQmxvY2suZXJyb3I/LmNoaWxkcmVuLCBkZWZlckJsb2NrLmVycm9yPy5zb3VyY2VTcGFuKTtcblxuICAvLyBDcmVhdGUgdGhlIG1haW4gZGVmZXIgb3AsIGFuZCBvcHMgZm9yIGFsbCBzZWNvbmRhcnkgdmlld3MuXG4gIGNvbnN0IGRlZmVyT3AgPSBpci5jcmVhdGVEZWZlck9wKHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIG1haW4ueHJlZiwgZGVmZXJCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wKTtcblxuICBpZiAobG9hZGluZyAmJiBkZWZlckJsb2NrLmxvYWRpbmcpIHtcbiAgICBkZWZlck9wLmxvYWRpbmcgPVxuICAgICAgICBpci5jcmVhdGVEZWZlclNlY29uZGFyeU9wKGRlZmVyT3AueHJlZiwgbG9hZGluZy54cmVmLCBpci5EZWZlclNlY29uZGFyeUtpbmQuTG9hZGluZyk7XG4gICAgaWYgKGRlZmVyQmxvY2subG9hZGluZy5hZnRlclRpbWUgIT09IG51bGwgfHwgZGVmZXJCbG9jay5sb2FkaW5nLm1pbmltdW1UaW1lICE9PSBudWxsKSB7XG4gICAgICBkZWZlck9wLmxvYWRpbmcuY29uc3RWYWx1ZSA9IFtkZWZlckJsb2NrLmxvYWRpbmcubWluaW11bVRpbWUsIGRlZmVyQmxvY2subG9hZGluZy5hZnRlclRpbWVdO1xuICAgIH1cbiAgICB1bml0LmNyZWF0ZS5wdXNoKGRlZmVyT3AubG9hZGluZyk7XG4gIH1cblxuICBpZiAocGxhY2Vob2xkZXIgJiYgZGVmZXJCbG9jay5wbGFjZWhvbGRlcikge1xuICAgIGRlZmVyT3AucGxhY2Vob2xkZXIgPSBpci5jcmVhdGVEZWZlclNlY29uZGFyeU9wKFxuICAgICAgICBkZWZlck9wLnhyZWYsIHBsYWNlaG9sZGVyLnhyZWYsIGlyLkRlZmVyU2Vjb25kYXJ5S2luZC5QbGFjZWhvbGRlcik7XG4gICAgaWYgKGRlZmVyQmxvY2sucGxhY2Vob2xkZXIubWluaW11bVRpbWUgIT09IG51bGwpIHtcbiAgICAgIGRlZmVyT3AucGxhY2Vob2xkZXIuY29uc3RWYWx1ZSA9IFtkZWZlckJsb2NrLnBsYWNlaG9sZGVyLm1pbmltdW1UaW1lXTtcbiAgICB9XG4gICAgdW5pdC5jcmVhdGUucHVzaChkZWZlck9wLnBsYWNlaG9sZGVyKTtcbiAgfVxuXG4gIGlmIChlcnJvciAmJiBkZWZlckJsb2NrLmVycm9yKSB7XG4gICAgZGVmZXJPcC5lcnJvciA9XG4gICAgICAgIGlyLmNyZWF0ZURlZmVyU2Vjb25kYXJ5T3AoZGVmZXJPcC54cmVmLCBlcnJvci54cmVmLCBpci5EZWZlclNlY29uZGFyeUtpbmQuRXJyb3IpO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goZGVmZXJPcC5lcnJvcik7XG4gIH1cblxuICAvLyBDb25maWd1cmUgYWxsIGRlZmVyIGNvbmRpdGlvbnMuXG4gIGNvbnN0IGRlZmVyT25PcCA9IGlyLmNyZWF0ZURlZmVyT25PcCh1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBudWxsISk7XG5cbiAgLy8gQWRkIGFsbCBvcHMgdG8gdGhlIHZpZXcuXG4gIHVuaXQuY3JlYXRlLnB1c2goZGVmZXJPbk9wKTtcbn1cblxuZnVuY3Rpb24gaW5nZXN0SWN1KHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGljdTogdC5JY3UpIHtcbiAgaWYgKGljdS5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgY29uc3QgeHJlZiA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJY3VPcCh4cmVmLCBpY3UuaTE4biwgbnVsbCEpKTtcbiAgICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUljdVVwZGF0ZU9wKHhyZWYsIG51bGwhKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCBpMThuIG1ldGFkYXRhIHR5cGUgZm9yIElDVTogJHtpY3UuaTE4bj8uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBgQGZvcmAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEZvckJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIGZvckJsb2NrOiB0LkZvckxvb3BCbG9jayk6IHZvaWQge1xuICBjb25zdCByZXBlYXRlclZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuICBjb25zdCBjcmVhdGVSZXBlYXRlckFsaWFzID0gKGlkZW50OiBzdHJpbmcsIHJlcGVhdGVyVmFyOiBpci5EZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eSkgPT4ge1xuICAgIHJlcGVhdGVyVmlldy5hbGlhc2VzLmFkZCh7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5BbGlhcyxcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICBpZGVudGlmaWVyOiBpZGVudCxcbiAgICAgIGV4cHJlc3Npb246IG5ldyBpci5EZXJpdmVkUmVwZWF0ZXJWYXJFeHByKHJlcGVhdGVyVmlldy54cmVmLCByZXBlYXRlclZhciksXG4gICAgfSk7XG4gIH07XG5cbiAgLy8gU2V0IGFsbCB0aGUgY29udGV4dCB2YXJpYWJsZXMgYW5kIGFsaWFzZXMgYXZhaWxhYmxlIGluIHRoZSByZXBlYXRlci5cbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KGZvckJsb2NrLml0ZW0ubmFtZSwgZm9yQmxvY2suaXRlbS52YWx1ZSk7XG4gIHJlcGVhdGVyVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChcbiAgICAgIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsIGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4LnZhbHVlKTtcbiAgcmVwZWF0ZXJWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KFxuICAgICAgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQubmFtZSwgZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kY291bnQudmFsdWUpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGZpcnN0Lm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5LkZpcnN0KTtcbiAgY3JlYXRlUmVwZWF0ZXJBbGlhcyhmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRsYXN0Lm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5Lkxhc3QpO1xuICBjcmVhdGVSZXBlYXRlckFsaWFzKGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGV2ZW4ubmFtZSwgaXIuRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkuRXZlbik7XG4gIGNyZWF0ZVJlcGVhdGVyQWxpYXMoZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsIGlyLkRlcml2ZWRSZXBlYXRlclZhcklkZW50aXR5Lk9kZCk7XG5cbiAgY29uc3Qgc291cmNlU3BhbiA9IGNvbnZlcnRTb3VyY2VTcGFuKGZvckJsb2NrLnRyYWNrQnkuc3BhbiwgZm9yQmxvY2suc291cmNlU3Bhbik7XG4gIGNvbnN0IHRyYWNrID0gY29udmVydEFzdChmb3JCbG9jay50cmFja0J5LCB1bml0LmpvYiwgc291cmNlU3Bhbik7XG5cbiAgaW5nZXN0Tm9kZXMocmVwZWF0ZXJWaWV3LCBmb3JCbG9jay5jaGlsZHJlbik7XG5cbiAgbGV0IGVtcHR5VmlldzogVmlld0NvbXBpbGF0aW9uVW5pdHxudWxsID0gbnVsbDtcbiAgaWYgKGZvckJsb2NrLmVtcHR5ICE9PSBudWxsKSB7XG4gICAgZW1wdHlWaWV3ID0gdW5pdC5qb2IuYWxsb2NhdGVWaWV3KHVuaXQueHJlZik7XG4gICAgaW5nZXN0Tm9kZXMoZW1wdHlWaWV3LCBmb3JCbG9jay5lbXB0eS5jaGlsZHJlbik7XG4gIH1cblxuICBjb25zdCB2YXJOYW1lczogaXIuUmVwZWF0ZXJWYXJOYW1lcyA9IHtcbiAgICAkaW5kZXg6IGZvckJsb2NrLmNvbnRleHRWYXJpYWJsZXMuJGluZGV4Lm5hbWUsXG4gICAgJGNvdW50OiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRjb3VudC5uYW1lLFxuICAgICRmaXJzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kZmlyc3QubmFtZSxcbiAgICAkbGFzdDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kbGFzdC5uYW1lLFxuICAgICRldmVuOiBmb3JCbG9jay5jb250ZXh0VmFyaWFibGVzLiRldmVuLm5hbWUsXG4gICAgJG9kZDogZm9yQmxvY2suY29udGV4dFZhcmlhYmxlcy4kb2RkLm5hbWUsXG4gICAgJGltcGxpY2l0OiBmb3JCbG9jay5pdGVtLm5hbWUsXG4gIH07XG5cbiAgY29uc3QgcmVwZWF0ZXJDcmVhdGUgPSBpci5jcmVhdGVSZXBlYXRlckNyZWF0ZU9wKFxuICAgICAgcmVwZWF0ZXJWaWV3LnhyZWYsIGVtcHR5Vmlldz8ueHJlZiA/PyBudWxsLCB0cmFjaywgdmFyTmFtZXMsIGZvckJsb2NrLnNvdXJjZVNwYW4pO1xuICB1bml0LmNyZWF0ZS5wdXNoKHJlcGVhdGVyQ3JlYXRlKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gY29udmVydEFzdChcbiAgICAgIGZvckJsb2NrLmV4cHJlc3Npb24sIHVuaXQuam9iLFxuICAgICAgY29udmVydFNvdXJjZVNwYW4oZm9yQmxvY2suZXhwcmVzc2lvbi5zcGFuLCBmb3JCbG9jay5zb3VyY2VTcGFuKSk7XG4gIGNvbnN0IHJlcGVhdGVyID0gaXIuY3JlYXRlUmVwZWF0ZXJPcChyZXBlYXRlckNyZWF0ZS54cmVmLCBleHByZXNzaW9uLCBmb3JCbG9jay5zb3VyY2VTcGFuKTtcbiAgdW5pdC51cGRhdGUucHVzaChyZXBlYXRlcik7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRlbXBsYXRlIEFTVCBleHByZXNzaW9uIGludG8gYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXN0KFxuICAgIGFzdDogZS5BU1QsIGpvYjogQ29tcGlsYXRpb25Kb2IsIGJhc2VTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuYXN0LCBqb2IsIGJhc2VTb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5UmVhZCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIgJiYgIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksIGFzdC5uYW1lLCBudWxsLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5V3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRXcml0ZSkge1xuICAgIHJldHVybiBuZXcgby5Xcml0ZUtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCB1bmRlZmluZWQsXG4gICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2FsbCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBJbXBsaWNpdFJlY2VpdmVyYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYiwgYmFzZVNvdXJjZVNwYW4pKSwgdW5kZWZpbmVkLFxuICAgICAgICAgIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKGFzdC52YWx1ZSwgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgb3BlcmF0b3IsIGNvbnZlcnRBc3QoYXN0LmxlZnQsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yaWdodCwgam9iLCBiYXNlU291cmNlU3BhbiksIHVuZGVmaW5lZCxcbiAgICAgICAgY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4sIGJhc2VTb3VyY2VTcGFuKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICAvLyBUT0RPOiBzaG91bGQgY29udGV4dCBleHByZXNzaW9ucyBoYXZlIHNvdXJjZSBtYXBzP1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IsIGJhc2VTb3VyY2VTcGFuKSxcbiAgICAgICAgdW5kZWZpbmVkLCBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQ2hhaW4gaW4gdW5rbm93biBjb250ZXh0YCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsTWFwKSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5rZXlzLm1hcCgoa2V5LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlc1tpZHhdO1xuICAgICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZ1xuICAgICAgLy8gZXhwcmVzc2lvbj9cbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LmtleSwgY29udmVydEFzdCh2YWx1ZSwgam9iLCBiYXNlU291cmNlU3BhbiksIGtleS5xdW90ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRXhwcihlbnRyaWVzLCB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbEFycmF5KSB7XG4gICAgLy8gVE9ETzogc2hvdWxkIGxpdGVyYWxzIGhhdmUgc291cmNlIG1hcHMsIG9yIGRvIHdlIGp1c3QgbWFwIHRoZSB3aG9sZSBzdXJyb3VuZGluZyBleHByZXNzaW9uP1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFxuICAgICAgICBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5jb25kaXRpb24sIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC50cnVlRXhwLCBqb2IsIGJhc2VTb3VyY2VTcGFuKSwgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICB1bmRlZmluZWQsIGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgam9iLCBiYXNlU291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIC8vIFRPRE86IHBpcGVzIHNob3VsZCBwcm9iYWJseSBoYXZlIHNvdXJjZSBtYXBzOyBmaWd1cmUgb3V0IGRldGFpbHMuXG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoXG4gICAgICAgIGpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgW1xuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cCwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgICAgLi4uYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgam9iLCBiYXNlU291cmNlU3BhbikpLFxuICAgICAgICBdLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBjb252ZXJ0QXN0KGFzdC5rZXksIGpvYiwgYmFzZVNvdXJjZVNwYW4pLFxuICAgICAgICBjb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbiwgYmFzZVNvdXJjZVNwYW4pKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAvLyBUT0RPOiBzb3VyY2Ugc3BhblxuICAgIHJldHVybiBuZXcgaXIuU2FmZVByb3BlcnR5UmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiwgYmFzZVNvdXJjZVNwYW4pLCBhc3QubmFtZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlQ2FsbCkge1xuICAgIC8vIFRPRE86IHNvdXJjZSBzcGFuXG4gICAgcmV0dXJuIG5ldyBpci5TYWZlSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iLCBiYXNlU291cmNlU3BhbiksXG4gICAgICAgIGFzdC5hcmdzLm1hcChhID0+IGNvbnZlcnRBc3QoYSwgam9iLCBiYXNlU291cmNlU3BhbikpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKGNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuLCBiYXNlU291cmNlU3BhbikpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIGV4cHJlc3Npb24gdHlwZTogJHthc3QuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpcyBhIHBsYWluIG5nLXRlbXBsYXRlIChhcyBvcHBvc2VkIHRvIGFub3RoZXIga2luZCBvZiB0ZW1wbGF0ZVxuICogc3VjaCBhcyBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHRlbXBsYXRlIG9yIGNvbnRyb2wgZmxvdyB0ZW1wbGF0ZSkuIFRoaXMgaXMgY2hlY2tlZCBiYXNlZCBvbiB0aGVcbiAqIHRhZ05hbWUuIFdlIGNhbiBleHBlY3QgdGhhdCBvbmx5IHBsYWluIG5nLXRlbXBsYXRlcyB3aWxsIGNvbWUgdGhyb3VnaCB3aXRoIGEgdGFnTmFtZSBvZlxuICogJ25nLXRlbXBsYXRlJy5cbiAqXG4gKiBIZXJlIGFyZSBzb21lIG9mIHRoZSBjYXNlcyB3ZSBleHBlY3Q6XG4gKlxuICogfCBBbmd1bGFyIEhUTUwgICAgICAgICAgICAgICAgICAgICAgIHwgVGVtcGxhdGUgdGFnTmFtZSAgIHxcbiAqIHwgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8IC0tLS0tLS0tLS0tLS0tLS0tLSB8XG4gKiB8IGA8bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPGRpdiAqbmdJZj1cInRydWVcIj5gICAgICAgICAgICAgICAgfCAnZGl2JyAgICAgICAgICAgICAgfFxuICogfCBgPHN2Zz48bmctdGVtcGxhdGU+YCAgICAgICAgICAgICAgIHwgJ3N2ZzpuZy10ZW1wbGF0ZScgIHxcbiAqIHwgYEBpZiAodHJ1ZSkge2AgICAgICAgICAgICAgICAgICAgICB8ICdDb25kaXRpb25hbCcgICAgICB8XG4gKiB8IGA8bmctdGVtcGxhdGUgKm5nSWY+YCAocGxhaW4pICAgICAgfCAnbmctdGVtcGxhdGUnICAgICAgfFxuICogfCBgPG5nLXRlbXBsYXRlICpuZ0lmPmAgKHN0cnVjdHVyYWwpIHwgbnVsbCAgICAgICAgICAgICAgIHxcbiAqL1xuZnVuY3Rpb24gaXNQbGFpblRlbXBsYXRlKHRtcGw6IHQuVGVtcGxhdGUpIHtcbiAgcmV0dXJuIHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSA/PyAnJylbMV0gPT09ICduZy10ZW1wbGF0ZSc7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtXG4gKiB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0QmluZGluZ3MoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkVsZW1lbnRPcEJhc2UsIGVsZW1lbnQ6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGxldCBmbGFnczogQmluZGluZ0ZsYWdzID0gQmluZGluZ0ZsYWdzLk5vbmU7XG4gIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5Pbk5nVGVtcGxhdGVFbGVtZW50O1xuICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBpc1BsYWluVGVtcGxhdGUoZWxlbWVudCkpIHtcbiAgICAgIGZsYWdzIHw9IEJpbmRpbmdGbGFncy5CaW5kaW5nVGFyZ2V0c1RlbXBsYXRlO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlQXR0ckZsYWdzID1cbiAgICAgICAgZmxhZ3MgfCBCaW5kaW5nRmxhZ3MuQmluZGluZ1RhcmdldHNUZW1wbGF0ZSB8IEJpbmRpbmdGbGFncy5Jc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC50ZW1wbGF0ZUF0dHJzKSB7XG4gICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICBpbmdlc3RCaW5kaW5nKFxuICAgICAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgdGVtcGxhdGVBdHRyRmxhZ3MgfCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgICAgICB1bml0LCBvcC54cmVmLCBhdHRyLm5hbWUsIGF0dHIudmFsdWUsIGF0dHIudHlwZSwgYXR0ci51bml0LCBhdHRyLnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgICAgIGF0dHIuc291cmNlU3BhbiwgdGVtcGxhdGVBdHRyRmxhZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAvLyBUaGlzIGlzIG9ubHkgYXR0cmlidXRlIFRleHRMaXRlcmFsIGJpbmRpbmdzLCBzdWNoIGFzIGBhdHRyLmZvbz1cImJhclwiYC4gVGhpcyBjYW4gbmV2ZXIgYmVcbiAgICAvLyBgW2F0dHIuZm9vXT1cImJhclwiYCBvciBgYXR0ci5mb289XCJ7e2Jhcn19XCJgLCBib3RoIG9mIHdoaWNoIHdpbGwgYmUgaGFuZGxlZCBhcyBpbnB1dHMgd2l0aFxuICAgIC8vIGBCaW5kaW5nVHlwZS5BdHRyaWJ1dGVgLlxuICAgIGluZ2VzdEJpbmRpbmcoXG4gICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGF0dHIuc291cmNlU3BhbiwgZmxhZ3MgfCBCaW5kaW5nRmxhZ3MuVGV4dFZhbHVlKTtcbiAgfVxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQubmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnR5cGUsIGlucHV0LnVuaXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgaW5wdXQuc291cmNlU3BhbiwgZmxhZ3MpO1xuICB9XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgZWxlbWVudC5vdXRwdXRzKSB7XG4gICAgbGV0IGxpc3RlbmVyT3A6IGlyLkxpc3RlbmVyT3A7XG4gICAgaWYgKG91dHB1dC50eXBlID09PSBlLlBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIGlmIChvdXRwdXQucGhhc2UgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0FuaW1hdGlvbiBsaXN0ZW5lciBzaG91bGQgaGF2ZSBhIHBoYXNlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmICFpc1BsYWluVGVtcGxhdGUoZWxlbWVudCkpIHtcbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goXG4gICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3Aob3AueHJlZiwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG91dHB1dC5uYW1lLCBudWxsKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lck9wID1cbiAgICAgICAgaXIuY3JlYXRlTGlzdGVuZXJPcChvcC54cmVmLCBvdXRwdXQubmFtZSwgb3AudGFnLCBvdXRwdXQucGhhc2UsIGZhbHNlLCBvdXRwdXQuc291cmNlU3Bhbik7XG5cbiAgICAvLyBpZiBvdXRwdXQuaGFuZGxlciBpcyBhIGNoYWluLCB0aGVuIHB1c2ggZWFjaCBzdGF0ZW1lbnQgZnJvbSB0aGUgY2hhaW4gc2VwYXJhdGVseSwgYW5kXG4gICAgLy8gcmV0dXJuIHRoZSBsYXN0IG9uZT9cbiAgICBsZXQgaGFuZGxlckV4cHJzOiBlLkFTVFtdO1xuICAgIGxldCBoYW5kbGVyOiBlLkFTVCA9IG91dHB1dC5oYW5kbGVyO1xuICAgIGlmIChoYW5kbGVyIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgICBoYW5kbGVyID0gaGFuZGxlci5hc3Q7XG4gICAgfVxuXG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgICBoYW5kbGVyRXhwcnMgPSBoYW5kbGVyLmV4cHJlc3Npb25zO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVyRXhwcnMgPSBbaGFuZGxlcl07XG4gICAgfVxuXG4gICAgaWYgKGhhbmRsZXJFeHBycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gaGF2ZSBub24tZW1wdHkgZXhwcmVzc2lvbiBsaXN0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gaGFuZGxlckV4cHJzLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdW5pdC5qb2IsIG91dHB1dC5oYW5kbGVyU3BhbikpO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG5cbiAgICBmb3IgKGNvbnN0IGV4cHIgb2YgZXhwcmVzc2lvbnMpIHtcbiAgICAgIGNvbnN0IHN0bXRPcCA9XG4gICAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwciwgZXhwci5zb3VyY2VTcGFuKSk7XG4gICAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChzdG10T3ApO1xuICAgIH1cbiAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChcbiAgICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KHJldHVybkV4cHIsIHJldHVybkV4cHIuc291cmNlU3BhbikpKTtcbiAgICB1bml0LmNyZWF0ZS5wdXNoKGxpc3RlbmVyT3ApO1xuICB9XG59XG5cbmNvbnN0IEJJTkRJTkdfS0lORFMgPSBuZXcgTWFwPGUuQmluZGluZ1R5cGUsIGlyLkJpbmRpbmdLaW5kPihbXG4gIFtlLkJpbmRpbmdUeXBlLlByb3BlcnR5LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlXSxcbiAgW2UuQmluZGluZ1R5cGUuQ2xhc3MsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZV0sXG4gIFtlLkJpbmRpbmdUeXBlLlN0eWxlLCBpci5CaW5kaW5nS2luZC5TdHlsZVByb3BlcnR5XSxcbiAgW2UuQmluZGluZ1R5cGUuQW5pbWF0aW9uLCBpci5CaW5kaW5nS2luZC5BbmltYXRpb25dLFxuXSk7XG5cbmVudW0gQmluZGluZ0ZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBpcyB0byBhIHN0YXRpYyB0ZXh0IGxpdGVyYWwgYW5kIG5vdCB0byBhbiBleHByZXNzaW9uLlxuICAgKi9cbiAgVGV4dFZhbHVlID0gMGIwMDAxLFxuXG4gIC8qKlxuICAgKiBUaGUgYmluZGluZyBiZWxvbmdzIHRvIHRoZSBgPG5nLXRlbXBsYXRlPmAgc2lkZSBvZiBhIGB0LlRlbXBsYXRlYC5cbiAgICovXG4gIEJpbmRpbmdUYXJnZXRzVGVtcGxhdGUgPSAwYjAwMTAsXG5cbiAgLyoqXG4gICAqIFRoZSBiaW5kaW5nIGlzIG9uIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUuXG4gICAqL1xuICBJc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSA9IDBiMDEwMCxcblxuICAvKipcbiAgICogVGhlIGJpbmRpbmcgaXMgb24gYSBgdC5UZW1wbGF0ZWAuXG4gICAqL1xuICBPbk5nVGVtcGxhdGVFbGVtZW50ID0gMGIxMDAwLFxufVxuXG5mdW5jdGlvbiBpbmdlc3RCaW5kaW5nKFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHhyZWY6IGlyLlhyZWZJZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogZS5BU1R8by5FeHByZXNzaW9uLFxuICAgIHR5cGU6IGUuQmluZGluZ1R5cGUsIHVuaXQ6IHN0cmluZ3xudWxsLCBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGZsYWdzOiBCaW5kaW5nRmxhZ3MpOiB2b2lkIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cblxuICBpZiAoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuT25OZ1RlbXBsYXRlRWxlbWVudCAmJiAhKGZsYWdzICYgQmluZGluZ0ZsYWdzLkJpbmRpbmdUYXJnZXRzVGVtcGxhdGUpICYmXG4gICAgICB0eXBlID09PSBlLkJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgLy8gVGhpcyBiaW5kaW5nIG9ubHkgZXhpc3RzIGZvciBsYXRlciBjb25zdCBleHRyYWN0aW9uLCBhbmQgaXMgbm90IGFuIGFjdHVhbCBiaW5kaW5nIHRvIGJlXG4gICAgLy8gY3JlYXRlZC5cbiAgICB2aWV3LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKHhyZWYsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBuYW1lLCBudWxsKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxpci5JbnRlcnBvbGF0aW9uO1xuICAvLyBUT0RPOiBXZSBjb3VsZCBlYXNpbHkgZ2VuZXJhdGUgc291cmNlIG1hcHMgZm9yIHN1YmV4cHJlc3Npb25zIGluIHRoZXNlIGNhc2VzLCBidXRcbiAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdC4gU2hvdWxkIHdlIGRvIHNvP1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBleHByZXNzaW9uID0gbmV3IGlyLkludGVycG9sYXRpb24oXG4gICAgICAgIHZhbHVlLnN0cmluZ3MsIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdmlldy5qb2IsIG51bGwpKSk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkFTVCkge1xuICAgIGV4cHJlc3Npb24gPSBjb252ZXJ0QXN0KHZhbHVlLCB2aWV3LmpvYiwgbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IHZhbHVlO1xuICB9XG5cbiAgY29uc3Qga2luZDogaXIuQmluZGluZ0tpbmQgPSBCSU5ESU5HX0tJTkRTLmdldCh0eXBlKSE7XG4gIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlQmluZGluZ09wKFxuICAgICAgeHJlZiwga2luZCwgbmFtZSwgZXhwcmVzc2lvbiwgdW5pdCwgc2VjdXJpdHlDb250ZXh0LCAhIShmbGFncyAmIEJpbmRpbmdGbGFncy5UZXh0VmFsdWUpLFxuICAgICAgISEoZmxhZ3MgJiBCaW5kaW5nRmxhZ3MuSXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUpLCBzb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gKlxuICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gYmFzZVNvdXJjZVNwYW4gYSBzcGFuIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2Ugb2YgdGhlIGV4cHJlc3Npb24gdHJlZS5cbiAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm8gYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKFxuICAgIHNwYW46IGUuUGFyc2VTcGFuLCBiYXNlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gIGlmIChiYXNlU291cmNlU3BhbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHN0YXJ0ID0gYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICBjb25zdCBlbmQgPSBiYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICBjb25zdCBmdWxsU3RhcnQgPSBiYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kLCBmdWxsU3RhcnQpO1xufVxuIl19