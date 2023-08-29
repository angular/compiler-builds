/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../core';
import * as e from '../../../expression_parser/ast';
import { splitNsName } from '../../../ml_parser/tags';
import * as o from '../../../output/output_ast';
import * as t from '../../../render3/r3_ast';
import * as ir from '../ir';
import { ComponentCompilationJob, HostBindingCompilationJob } from './compilation';
import { BINARY_OPERATORS, namespaceForKey } from './conversion';
const compatibilityMode = ir.CompatibilityMode.TemplateDefinitionBuilder;
/**
 * Process a template AST and convert it into a `ComponentCompilation` in the intermediate
 * representation.
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
        expression =
            new ir.Interpolation(ast.strings, ast.expressions.map(expr => convertAst(expr, job)));
    }
    else {
        expression = convertAst(ast, job);
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
    const eventBinding = ir.createListenerOp(job.root.xref, event.name, null, event.targetOrPhase, true);
    // TODO: Can this be a chain?
    eventBinding.handlerOps.push(ir.createStatementOp(new o.ReturnStatement(convertAst(event.handler.ast, job))));
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
        else if (node instanceof t.Text) {
            ingestText(unit, node);
        }
        else if (node instanceof t.BoundText) {
            ingestBoundText(unit, node);
        }
        else if (node instanceof t.SwitchBlock) {
            ingestSwitchBlock(unit, node);
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
    const staticAttributes = {};
    for (const attr of element.attributes) {
        staticAttributes[attr.name] = attr.value;
    }
    const id = unit.job.allocateXrefId();
    const [namespaceKey, elementName] = splitNsName(element.name);
    const startOp = ir.createElementStartOp(elementName, id, namespaceForKey(namespaceKey), element.i18n, element.startSourceSpan);
    unit.create.push(startOp);
    ingestBindings(unit, startOp, element);
    ingestReferences(startOp, element);
    ingestNodes(unit, element.children);
    unit.create.push(ir.createElementEndOp(id, element.endSourceSpan));
}
/**
 * Ingest an `ng-template` node from the AST into the given `ViewCompilation`.
 */
function ingestTemplate(unit, tmpl) {
    const childView = unit.job.allocateView(unit.xref);
    let tagNameWithoutNamespace = tmpl.tagName;
    let namespacePrefix = '';
    if (tmpl.tagName) {
        [namespacePrefix, tagNameWithoutNamespace] = splitNsName(tmpl.tagName);
    }
    // TODO: validate the fallback tag name here.
    const tplOp = ir.createTemplateOp(childView.xref, tagNameWithoutNamespace ?? 'ng-template', namespaceForKey(namespacePrefix), tmpl.i18n, tmpl.startSourceSpan);
    unit.create.push(tplOp);
    ingestBindings(unit, tplOp, tmpl);
    ingestReferences(tplOp, tmpl);
    ingestNodes(childView, tmpl.children);
    for (const { name, value } of tmpl.variables) {
        childView.contextVariables.set(name, value);
    }
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
    const textXref = unit.job.allocateXrefId();
    unit.create.push(ir.createTextOp(textXref, '', text.sourceSpan));
    unit.update.push(ir.createInterpolateTextOp(textXref, new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, unit.job))), text.sourceSpan));
}
/**
 * Ingest a `{#switch}` block into the given `ViewCompilation`.
 */
function ingestSwitchBlock(unit, switchBlock) {
    let firstXref = null;
    let conditions = [];
    for (const switchCase of switchBlock.cases) {
        const cView = unit.job.allocateView(unit.xref);
        if (!firstXref)
            firstXref = cView.xref;
        unit.create.push(ir.createTemplateOp(cView.xref, 'Case', ir.Namespace.HTML, undefined, null));
        const caseExpr = switchCase.expression ? convertAst(switchCase.expression, unit.job) : null;
        conditions.push([cView.xref, caseExpr]);
        ingestNodes(cView, switchCase.children);
    }
    const conditional = ir.createConditionalOp(firstXref, convertAst(switchBlock.expression, unit.job), null);
    conditional.conditions = conditions;
    unit.update.push(conditional);
}
/**
 * Convert a template AST expression into an output AST expression.
 */
function convertAst(ast, job) {
    if (ast instanceof e.ASTWithSource) {
        return convertAst(ast.ast, job);
    }
    else if (ast instanceof e.PropertyRead) {
        if (ast.receiver instanceof e.ImplicitReceiver && !(ast.receiver instanceof e.ThisReceiver)) {
            return new ir.LexicalReadExpr(ast.name);
        }
        else {
            return new o.ReadPropExpr(convertAst(ast.receiver, job), ast.name);
        }
    }
    else if (ast instanceof e.PropertyWrite) {
        return new o.WritePropExpr(convertAst(ast.receiver, job), ast.name, convertAst(ast.value, job));
    }
    else if (ast instanceof e.KeyedWrite) {
        return new o.WriteKeyExpr(convertAst(ast.receiver, job), convertAst(ast.key, job), convertAst(ast.value, job));
    }
    else if (ast instanceof e.Call) {
        if (ast.receiver instanceof e.ImplicitReceiver) {
            throw new Error(`Unexpected ImplicitReceiver`);
        }
        else {
            return new o.InvokeFunctionExpr(convertAst(ast.receiver, job), ast.args.map(arg => convertAst(arg, job)));
        }
    }
    else if (ast instanceof e.LiteralPrimitive) {
        return o.literal(ast.value);
    }
    else if (ast instanceof e.Binary) {
        const operator = BINARY_OPERATORS.get(ast.operation);
        if (operator === undefined) {
            throw new Error(`AssertionError: unknown binary operator ${ast.operation}`);
        }
        return new o.BinaryOperatorExpr(operator, convertAst(ast.left, job), convertAst(ast.right, job));
    }
    else if (ast instanceof e.ThisReceiver) {
        return new ir.ContextExpr(job.root.xref);
    }
    else if (ast instanceof e.KeyedRead) {
        return new o.ReadKeyExpr(convertAst(ast.receiver, job), convertAst(ast.key, job));
    }
    else if (ast instanceof e.Chain) {
        throw new Error(`AssertionError: Chain in unknown context`);
    }
    else if (ast instanceof e.LiteralMap) {
        const entries = ast.keys.map((key, idx) => {
            const value = ast.values[idx];
            return new o.LiteralMapEntry(key.key, convertAst(value, job), key.quoted);
        });
        return new o.LiteralMapExpr(entries);
    }
    else if (ast instanceof e.LiteralArray) {
        return new o.LiteralArrayExpr(ast.expressions.map(expr => convertAst(expr, job)));
    }
    else if (ast instanceof e.Conditional) {
        return new o.ConditionalExpr(convertAst(ast.condition, job), convertAst(ast.trueExp, job), convertAst(ast.falseExp, job));
    }
    else if (ast instanceof e.NonNullAssert) {
        // A non-null assertion shouldn't impact generated instructions, so we can just drop it.
        return convertAst(ast.expression, job);
    }
    else if (ast instanceof e.BindingPipe) {
        return new ir.PipeBindingExpr(job.allocateXrefId(), ast.name, [
            convertAst(ast.exp, job),
            ...ast.args.map(arg => convertAst(arg, job)),
        ]);
    }
    else if (ast instanceof e.SafeKeyedRead) {
        return new ir.SafeKeyedReadExpr(convertAst(ast.receiver, job), convertAst(ast.key, job));
    }
    else if (ast instanceof e.SafePropertyRead) {
        return new ir.SafePropertyReadExpr(convertAst(ast.receiver, job), ast.name);
    }
    else if (ast instanceof e.SafeCall) {
        return new ir.SafeInvokeFunctionExpr(convertAst(ast.receiver, job), ast.args.map(a => convertAst(a, job)));
    }
    else if (ast instanceof e.EmptyExpr) {
        return new ir.EmptyExpr();
    }
    else {
        throw new Error(`Unhandled expression type: ${ast.constructor.name}`);
    }
}
/**
 * Process all of the bindings on an element-like structure in the template AST and convert them
 * to their IR representation.
 */
function ingestBindings(unit, op, element) {
    if (element instanceof t.Template) {
        for (const attr of element.templateAttrs) {
            if (attr instanceof t.TextAttribute) {
                ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, true, true);
            }
            else {
                ingestBinding(unit, op.xref, attr.name, attr.value, attr.type, attr.unit, attr.securityContext, attr.sourceSpan, false, true);
            }
        }
    }
    for (const attr of element.attributes) {
        // This is only attribute TextLiteral bindings, such as `attr.foo="bar"`. This can never be
        // `[attr.foo]="bar"` or `attr.foo="{{bar}}"`, both of which will be handled as inputs with
        // `BindingType.Attribute`.
        ingestBinding(unit, op.xref, attr.name, o.literal(attr.value), 1 /* e.BindingType.Attribute */, null, SecurityContext.NONE, attr.sourceSpan, true, false);
    }
    for (const input of element.inputs) {
        ingestBinding(unit, op.xref, input.name, input.value, input.type, input.unit, input.securityContext, input.sourceSpan, false, false);
    }
    for (const output of element.outputs) {
        let listenerOp;
        if (output.type === 1 /* e.ParsedEventType.Animation */) {
            if (output.phase === null) {
                throw Error('Animation listener should have a phase');
            }
        }
        listenerOp = ir.createListenerOp(op.xref, output.name, op.tag, output.phase, false);
        // if output.handler is a chain, then push each statement from the chain separately, and
        // return the last one?
        let inputExprs;
        let handler = output.handler;
        if (handler instanceof e.ASTWithSource) {
            handler = handler.ast;
        }
        if (handler instanceof e.Chain) {
            inputExprs = handler.expressions;
        }
        else {
            inputExprs = [handler];
        }
        if (inputExprs.length === 0) {
            throw new Error('Expected listener to have non-empty expression list.');
        }
        const expressions = inputExprs.map(expr => convertAst(expr, unit.job));
        const returnExpr = expressions.pop();
        for (const expr of expressions) {
            const stmtOp = ir.createStatementOp(new o.ExpressionStatement(expr));
            listenerOp.handlerOps.push(stmtOp);
        }
        listenerOp.handlerOps.push(ir.createStatementOp(new o.ReturnStatement(returnExpr)));
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
function ingestBinding(view, xref, name, value, type, unit, securityContext, sourceSpan, isTextAttribute, isTemplateBinding) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    let expression;
    if (value instanceof e.Interpolation) {
        expression = new ir.Interpolation(value.strings, value.expressions.map(expr => convertAst(expr, view.job)));
    }
    else if (value instanceof e.AST) {
        expression = convertAst(value, view.job);
    }
    else {
        expression = value;
    }
    const kind = BINDING_KINDS.get(type);
    view.update.push(ir.createBindingOp(xref, kind, name, expression, unit, securityContext, isTextAttribute, isTemplateBinding, sourceSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUNwRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWhELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFDLHVCQUF1QixFQUFFLHlCQUF5QixFQUE0RSxNQUFNLGVBQWUsQ0FBQztBQUM1SixPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsZUFBZSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRS9ELE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDO0FBRXpFOzs7R0FHRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQzNCLGFBQXFCLEVBQUUsUUFBa0IsRUFBRSxZQUEwQixFQUNyRSx1QkFBK0IsRUFBRSxrQkFBMkI7SUFDOUQsTUFBTSxHQUFHLEdBQUcsSUFBSSx1QkFBdUIsQ0FDbkMsYUFBYSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ2pHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2hDLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQVNEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FDN0IsS0FBdUIs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QUFDO0tBQ3BCO0lBRUQsTUFBTSxJQUFJLEdBQW1CLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDdEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FDL0IsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUN2RixVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGdCQUFnQixDQUFDLEVBQW9CLEVBQUUsT0FBNkI7SUFDM0UsYUFBYSxDQUFjLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN6QyxLQUFLLE1BQU0sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFDLElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRTtRQUM5QyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNoQixJQUFJO1lBQ0osTUFBTSxFQUFFLEtBQUs7U0FDZCxDQUFDLENBQUM7S0FDSjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUFJLEtBQVU7SUFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO0tBQ3REO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBlIGZyb20gJy4uLy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19hc3QnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIFZpZXdDb21waWxhdGlvblVuaXQsIEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7QklOQVJZX09QRVJBVE9SUywgbmFtZXNwYWNlRm9yS2V5fSBmcm9tICcuL2NvbnZlcnNpb24nO1xuXG5jb25zdCBjb21wYXRpYmlsaXR5TW9kZSA9IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXI7XG5cbi8qKlxuICogUHJvY2VzcyBhIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYENvbXBvbmVudENvbXBpbGF0aW9uYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdENvbXBvbmVudChcbiAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHRlbXBsYXRlOiB0Lk5vZGVbXSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZywgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuKTogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2Ige1xuICBjb25zdCBjcGwgPSBuZXcgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IoXG4gICAgICBjb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wsIGNvbXBhdGliaWxpdHlNb2RlLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCwgaTE4blVzZUV4dGVybmFsSWRzKTtcbiAgaW5nZXN0Tm9kZXMoY3BsLnJvb3QsIHRlbXBsYXRlKTtcbiAgcmV0dXJuIGNwbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb3N0QmluZGluZ0lucHV0IHtcbiAgY29tcG9uZW50TmFtZTogc3RyaW5nO1xuICBwcm9wZXJ0aWVzOiBlLlBhcnNlZFByb3BlcnR5W118bnVsbDtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGV2ZW50czogZS5QYXJzZWRFdmVudFtdfG51bGw7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIGhvc3QgYmluZGluZyBBU1QgYW5kIGNvbnZlcnQgaXQgaW50byBhIGBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgIGlucHV0OiBIb3N0QmluZGluZ0lucHV0LCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiB7XG4gIGNvbnN0IGpvYiA9IG5ldyBIb3N0QmluZGluZ0NvbXBpbGF0aW9uSm9iKGlucHV0LmNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCwgY29tcGF0aWJpbGl0eU1vZGUpO1xuICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIGlucHV0LnByb3BlcnRpZXMgPz8gW10pIHtcbiAgICBpbmdlc3RIb3N0UHJvcGVydHkoam9iLCBwcm9wZXJ0eSwgZmFsc2UpO1xuICB9XG4gIGZvciAoY29uc3QgW25hbWUsIGV4cHJdIG9mIE9iamVjdC5lbnRyaWVzKGlucHV0LmF0dHJpYnV0ZXMpID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEF0dHJpYnV0ZShqb2IsIG5hbWUsIGV4cHIpO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgaW5wdXQuZXZlbnRzID8/IFtdKSB7XG4gICAgaW5nZXN0SG9zdEV2ZW50KGpvYiwgZXZlbnQpO1xuICB9XG4gIHJldHVybiBqb2I7XG59XG5cbi8vIFRPRE86IFdlIHNob3VsZCByZWZhY3RvciB0aGUgcGFyc2VyIHRvIHVzZSB0aGUgc2FtZSB0eXBlcyBhbmQgc3RydWN0dXJlcyBmb3IgaG9zdCBiaW5kaW5ncyBhc1xuLy8gd2l0aCBvcmRpbmFyeSBjb21wb25lbnRzLiBUaGlzIHdvdWxkIGFsbG93IHVzIHRvIHNoYXJlIGEgbG90IG1vcmUgaW5nZXN0aW9uIGNvZGUuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdFByb3BlcnR5KFxuICAgIGpvYjogSG9zdEJpbmRpbmdDb21waWxhdGlvbkpvYiwgcHJvcGVydHk6IGUuUGFyc2VkUHJvcGVydHksIGlzVGV4dEF0dHJpYnV0ZTogYm9vbGVhbik6IHZvaWQge1xuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGNvbnN0IGFzdCA9IHByb3BlcnR5LmV4cHJlc3Npb24uYXN0O1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgZXhwcmVzc2lvbiA9XG4gICAgICAgIG5ldyBpci5JbnRlcnBvbGF0aW9uKGFzdC5zdHJpbmdzLCBhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBqb2IpKSk7XG4gIH0gZWxzZSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QoYXN0LCBqb2IpO1xuICB9XG4gIGxldCBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAvLyBUT0RPOiB0aGlzIHNob3VsZCByZWFsbHkgYmUgaGFuZGxlZCBpbiB0aGUgcGFyc2VyLlxuICBpZiAocHJvcGVydHkubmFtZS5zdGFydHNXaXRoKCdhdHRyLicpKSB7XG4gICAgcHJvcGVydHkubmFtZSA9IHByb3BlcnR5Lm5hbWUuc3Vic3RyaW5nKCdhdHRyLicubGVuZ3RoKTtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZTtcbiAgfVxuICBpZiAocHJvcGVydHkuaXNBbmltYXRpb24pIHtcbiAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkFuaW1hdGlvbjtcbiAgfVxuICBqb2Iucm9vdC51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICBqb2Iucm9vdC54cmVmLCBiaW5kaW5nS2luZCwgcHJvcGVydHkubmFtZSwgZXhwcmVzc2lvbiwgbnVsbCxcbiAgICAgIFNlY3VyaXR5Q29udGV4dFxuICAgICAgICAgIC5OT05FIC8qIFRPRE86IHdoYXQgc2hvdWxkIHdlIHBhc3MgYXMgc2VjdXJpdHkgY29udGV4dD8gUGFzc2luZyBOT05FIGZvciBub3cuICovLFxuICAgICAgaXNUZXh0QXR0cmlidXRlLCBmYWxzZSwgcHJvcGVydHkuc291cmNlU3BhbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0SG9zdEF0dHJpYnV0ZShcbiAgICBqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIG5hbWU6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbik6IHZvaWQge1xuICBjb25zdCBhdHRyQmluZGluZyA9IGlyLmNyZWF0ZUJpbmRpbmdPcChcbiAgICAgIGpvYi5yb290LnhyZWYsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgbmFtZSwgdmFsdWUsIG51bGwsIFNlY3VyaXR5Q29udGV4dC5OT05FLCB0cnVlLCBmYWxzZSxcbiAgICAgIC8qIFRPRE86IGhvc3QgYXR0cmlidXRlIHNvdXJjZSBzcGFucyAqLyBudWxsISk7XG4gIGpvYi5yb290LnVwZGF0ZS5wdXNoKGF0dHJCaW5kaW5nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdEhvc3RFdmVudChqb2I6IEhvc3RCaW5kaW5nQ29tcGlsYXRpb25Kb2IsIGV2ZW50OiBlLlBhcnNlZEV2ZW50KSB7XG4gIGNvbnN0IGV2ZW50QmluZGluZyA9XG4gICAgICBpci5jcmVhdGVMaXN0ZW5lck9wKGpvYi5yb290LnhyZWYsIGV2ZW50Lm5hbWUsIG51bGwsIGV2ZW50LnRhcmdldE9yUGhhc2UsIHRydWUpO1xuICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBhIGNoYWluP1xuICBldmVudEJpbmRpbmcuaGFuZGxlck9wcy5wdXNoKFxuICAgICAgaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KGNvbnZlcnRBc3QoZXZlbnQuaGFuZGxlci5hc3QsIGpvYikpKSk7XG4gIGpvYi5yb290LmNyZWF0ZS5wdXNoKGV2ZW50QmluZGluZyk7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgaW5nZXN0VGV4dCh1bml0LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgaW5nZXN0Qm91bmRUZXh0KHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuU3dpdGNoQmxvY2spIHtcbiAgICAgIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG5cblxuLyoqXG4gKiBJbmdlc3QgYW4gZWxlbWVudCBBU1QgZnJvbSB0aGUgdGVtcGxhdGUgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEVsZW1lbnQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHN0YXRpY0F0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIHN0YXRpY0F0dHJpYnV0ZXNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG4gIH1cbiAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG5cbiAgY29uc3Qgc3RhcnRPcCA9IGlyLmNyZWF0ZUVsZW1lbnRTdGFydE9wKFxuICAgICAgZWxlbWVudE5hbWUsIGlkLCBuYW1lc3BhY2VGb3JLZXkobmFtZXNwYWNlS2V5KSwgZWxlbWVudC5pMThuLCBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2goc3RhcnRPcCk7XG5cbiAgaW5nZXN0QmluZGluZ3ModW5pdCwgc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdE5vZGVzKHVuaXQsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4pKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBjb25zdCBjaGlsZFZpZXcgPSB1bml0LmpvYi5hbGxvY2F0ZVZpZXcodW5pdC54cmVmKTtcblxuXG4gIGxldCB0YWdOYW1lV2l0aG91dE5hbWVzcGFjZSA9IHRtcGwudGFnTmFtZTtcbiAgbGV0IG5hbWVzcGFjZVByZWZpeDogc3RyaW5nfG51bGwgPSAnJztcbiAgaWYgKHRtcGwudGFnTmFtZSkge1xuICAgIFtuYW1lc3BhY2VQcmVmaXgsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlXSA9IHNwbGl0TnNOYW1lKHRtcGwudGFnTmFtZSk7XG4gIH1cblxuICAvLyBUT0RPOiB2YWxpZGF0ZSB0aGUgZmFsbGJhY2sgdGFnIG5hbWUgaGVyZS5cbiAgY29uc3QgdHBsT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKFxuICAgICAgY2hpbGRWaWV3LnhyZWYsIHRhZ05hbWVXaXRob3V0TmFtZXNwYWNlID8/ICduZy10ZW1wbGF0ZScsIG5hbWVzcGFjZUZvcktleShuYW1lc3BhY2VQcmVmaXgpLFxuICAgICAgdG1wbC5pMThuLCB0bXBsLnN0YXJ0U291cmNlU3Bhbik7XG4gIHVuaXQuY3JlYXRlLnB1c2godHBsT3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHVuaXQsIHRwbE9wLCB0bXBsKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0cGxPcCwgdG1wbCk7XG4gIGluZ2VzdE5vZGVzKGNoaWxkVmlldywgdG1wbC5jaGlsZHJlbik7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgdmFsdWV9IG9mIHRtcGwudmFyaWFibGVzKSB7XG4gICAgY2hpbGRWaWV3LmNvbnRleHRWYXJpYWJsZXMuc2V0KG5hbWUsIHZhbHVlKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhIGxpdGVyYWwgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGV4dCh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCB0ZXh0OiB0LlRleHQpOiB2b2lkIHtcbiAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3AodW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGludGVycG9sYXRlZCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RCb3VuZFRleHQodW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgdGV4dDogdC5Cb3VuZFRleHQpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycsIHRleHQuc291cmNlU3BhbikpO1xuICB1bml0LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgICAgdGV4dFhyZWYsXG4gICAgICBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgICB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iKSkpLFxuICAgICAgdGV4dC5zb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGEgYHsjc3dpdGNofWAgYmxvY2sgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFN3aXRjaEJsb2NrKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN3aXRjaEJsb2NrOiB0LlN3aXRjaEJsb2NrKTogdm9pZCB7XG4gIGxldCBmaXJzdFhyZWY6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGNvbmRpdGlvbnM6IEFycmF5PFtpci5YcmVmSWQsIG8uRXhwcmVzc2lvbiB8IG51bGxdPiA9IFtdO1xuICBmb3IgKGNvbnN0IHN3aXRjaENhc2Ugb2Ygc3dpdGNoQmxvY2suY2FzZXMpIHtcbiAgICBjb25zdCBjVmlldyA9IHVuaXQuam9iLmFsbG9jYXRlVmlldyh1bml0LnhyZWYpO1xuICAgIGlmICghZmlyc3RYcmVmKSBmaXJzdFhyZWYgPSBjVmlldy54cmVmO1xuICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGVtcGxhdGVPcChjVmlldy54cmVmLCAnQ2FzZScsIGlyLk5hbWVzcGFjZS5IVE1MLCB1bmRlZmluZWQsIG51bGwhKSk7XG4gICAgY29uc3QgY2FzZUV4cHIgPSBzd2l0Y2hDYXNlLmV4cHJlc3Npb24gPyBjb252ZXJ0QXN0KHN3aXRjaENhc2UuZXhwcmVzc2lvbiwgdW5pdC5qb2IpIDogbnVsbDtcbiAgICBjb25kaXRpb25zLnB1c2goW2NWaWV3LnhyZWYsIGNhc2VFeHByXSk7XG4gICAgaW5nZXN0Tm9kZXMoY1ZpZXcsIHN3aXRjaENhc2UuY2hpbGRyZW4pO1xuICB9XG4gIGNvbnN0IGNvbmRpdGlvbmFsID1cbiAgICAgIGlyLmNyZWF0ZUNvbmRpdGlvbmFsT3AoZmlyc3RYcmVmISwgY29udmVydEFzdChzd2l0Y2hCbG9jay5leHByZXNzaW9uLCB1bml0LmpvYiksIG51bGwhKTtcbiAgY29uZGl0aW9uYWwuY29uZGl0aW9ucyA9IGNvbmRpdGlvbnM7XG4gIHVuaXQudXBkYXRlLnB1c2goY29uZGl0aW9uYWwpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBBU1QgZXhwcmVzc2lvbiBpbnRvIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbi5cbiAqL1xuZnVuY3Rpb24gY29udmVydEFzdChhc3Q6IGUuQVNULCBqb2I6IENvbXBpbGF0aW9uSm9iKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5hc3QsIGpvYik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVJlYWQpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyICYmICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGlyLkxleGljYWxSZWFkRXhwcihhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiksIGFzdC5uYW1lKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlUHJvcEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiksIGFzdC5uYW1lLCBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgam9iKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFdyaXRlKSB7XG4gICAgcmV0dXJuIG5ldyBvLldyaXRlS2V5RXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudmFsdWUsIGpvYiksXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNhbGwpIHtcbiAgICBpZiAoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgZS5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgSW1wbGljaXRSZWNlaXZlcmApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IpLCBhc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBqb2IpKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgIHJldHVybiBvLmxpdGVyYWwoYXN0LnZhbHVlKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmFyeSkge1xuICAgIGNvbnN0IG9wZXJhdG9yID0gQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wZXJhdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVua25vd24gYmluYXJ5IG9wZXJhdG9yICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgb3BlcmF0b3IsIGNvbnZlcnRBc3QoYXN0LmxlZnQsIGpvYiksIGNvbnZlcnRBc3QoYXN0LnJpZ2h0LCBqb2IpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlRoaXNSZWNlaXZlcikge1xuICAgIHJldHVybiBuZXcgaXIuQ29udGV4dEV4cHIoam9iLnJvb3QueHJlZik7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5LZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IG8uUmVhZEtleUV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiksIGNvbnZlcnRBc3QoYXN0LmtleSwgam9iKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DaGFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IENoYWluIGluIHVua25vd24gY29udGV4dGApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbE1hcCkge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhc3Qua2V5cy5tYXAoKGtleSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZXNbaWR4XTtcbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LmtleSwgY29udmVydEFzdCh2YWx1ZSwgam9iKSwga2V5LnF1b3RlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTGl0ZXJhbEFycmF5KSB7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoYXN0LmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgam9iKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ29uZGl0aW9uYWwpIHtcbiAgICByZXR1cm4gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5jb25kaXRpb24sIGpvYiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnRydWVFeHAsIGpvYiksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmZhbHNlRXhwLCBqb2IpLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Ob25OdWxsQXNzZXJ0KSB7XG4gICAgLy8gQSBub24tbnVsbCBhc3NlcnRpb24gc2hvdWxkbid0IGltcGFjdCBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb25zLCBzbyB3ZSBjYW4ganVzdCBkcm9wIGl0LlxuICAgIHJldHVybiBjb252ZXJ0QXN0KGFzdC5leHByZXNzaW9uLCBqb2IpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluZGluZ1BpcGUpIHtcbiAgICByZXR1cm4gbmV3IGlyLlBpcGVCaW5kaW5nRXhwcihcbiAgICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksXG4gICAgICAgIGFzdC5uYW1lLFxuICAgICAgICBbXG4gICAgICAgICAgY29udmVydEFzdChhc3QuZXhwLCBqb2IpLFxuICAgICAgICAgIC4uLmFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGpvYikpLFxuICAgICAgICBdLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlS2V5ZWRSZWFkRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgam9iKSwgY29udmVydEFzdChhc3Qua2V5LCBqb2IpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVQcm9wZXJ0eVJlYWRFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBqb2IpLCBhc3QubmFtZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlQ2FsbCkge1xuICAgIHJldHVybiBuZXcgaXIuU2FmZUludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGpvYiksIGFzdC5hcmdzLm1hcChhID0+IGNvbnZlcnRBc3QoYSwgam9iKSkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuRW1wdHlFeHByKSB7XG4gICAgcmV0dXJuIG5ldyBpci5FbXB0eUV4cHIoKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIHR5cGU6ICR7YXN0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgYmluZGluZ3Mgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IHRoZW1cbiAqIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RCaW5kaW5ncyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQudGVtcGxhdGVBdHRycykge1xuICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgby5saXRlcmFsKGF0dHIudmFsdWUpLCBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZSwgbnVsbCxcbiAgICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FLCBhdHRyLnNvdXJjZVNwYW4sIHRydWUsIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgICAgIHVuaXQsIG9wLnhyZWYsIGF0dHIubmFtZSwgYXR0ci52YWx1ZSwgYXR0ci50eXBlLCBhdHRyLnVuaXQsIGF0dHIuc2VjdXJpdHlDb250ZXh0LFxuICAgICAgICAgICAgYXR0ci5zb3VyY2VTcGFuLCBmYWxzZSwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIC8vIFRoaXMgaXMgb25seSBhdHRyaWJ1dGUgVGV4dExpdGVyYWwgYmluZGluZ3MsIHN1Y2ggYXMgYGF0dHIuZm9vPVwiYmFyXCJgLiBUaGlzIGNhbiBuZXZlciBiZVxuICAgIC8vIGBbYXR0ci5mb29dPVwiYmFyXCJgIG9yIGBhdHRyLmZvbz1cInt7YmFyfX1cImAsIGJvdGggb2Ygd2hpY2ggd2lsbCBiZSBoYW5kbGVkIGFzIGlucHV0cyB3aXRoXG4gICAgLy8gYEJpbmRpbmdUeXBlLkF0dHJpYnV0ZWAuXG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSksIGUuQmluZGluZ1R5cGUuQXR0cmlidXRlLCBudWxsLFxuICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSwgYXR0ci5zb3VyY2VTcGFuLCB0cnVlLCBmYWxzZSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGlucHV0IG9mIGVsZW1lbnQuaW5wdXRzKSB7XG4gICAgaW5nZXN0QmluZGluZyhcbiAgICAgICAgdW5pdCwgb3AueHJlZiwgaW5wdXQubmFtZSwgaW5wdXQudmFsdWUsIGlucHV0LnR5cGUsIGlucHV0LnVuaXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCxcbiAgICAgICAgaW5wdXQuc291cmNlU3BhbiwgZmFsc2UsIGZhbHNlKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3V0cHV0IG9mIGVsZW1lbnQub3V0cHV0cykge1xuICAgIGxldCBsaXN0ZW5lck9wOiBpci5MaXN0ZW5lck9wO1xuICAgIGlmIChvdXRwdXQudHlwZSA9PT0gZS5QYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICBpZiAob3V0cHV0LnBoYXNlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBbmltYXRpb24gbGlzdGVuZXIgc2hvdWxkIGhhdmUgYSBwaGFzZScpO1xuICAgICAgfVxuICAgIH1cbiAgICBsaXN0ZW5lck9wID0gaXIuY3JlYXRlTGlzdGVuZXJPcChvcC54cmVmLCBvdXRwdXQubmFtZSwgb3AudGFnLCBvdXRwdXQucGhhc2UsIGZhbHNlKTtcblxuICAgIC8vIGlmIG91dHB1dC5oYW5kbGVyIGlzIGEgY2hhaW4sIHRoZW4gcHVzaCBlYWNoIHN0YXRlbWVudCBmcm9tIHRoZSBjaGFpbiBzZXBhcmF0ZWx5LCBhbmRcbiAgICAvLyByZXR1cm4gdGhlIGxhc3Qgb25lP1xuICAgIGxldCBpbnB1dEV4cHJzOiBlLkFTVFtdO1xuICAgIGxldCBoYW5kbGVyOiBlLkFTVCA9IG91dHB1dC5oYW5kbGVyO1xuICAgIGlmIChoYW5kbGVyIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgICBoYW5kbGVyID0gaGFuZGxlci5hc3Q7XG4gICAgfVxuXG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgICBpbnB1dEV4cHJzID0gaGFuZGxlci5leHByZXNzaW9ucztcbiAgICB9IGVsc2Uge1xuICAgICAgaW5wdXRFeHBycyA9IFtoYW5kbGVyXTtcbiAgICB9XG5cbiAgICBpZiAoaW5wdXRFeHBycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gaGF2ZSBub24tZW1wdHkgZXhwcmVzc2lvbiBsaXN0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gaW5wdXRFeHBycy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHVuaXQuam9iKSk7XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGV4cHJlc3Npb25zLnBvcCgpITtcblxuICAgIGZvciAoY29uc3QgZXhwciBvZiBleHByZXNzaW9ucykge1xuICAgICAgY29uc3Qgc3RtdE9wID0gaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwcikpO1xuICAgICAgbGlzdGVuZXJPcC5oYW5kbGVyT3BzLnB1c2goc3RtdE9wKTtcbiAgICB9XG4gICAgbGlzdGVuZXJPcC5oYW5kbGVyT3BzLnB1c2goaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uUmV0dXJuU3RhdGVtZW50KHJldHVybkV4cHIpKSk7XG4gICAgdW5pdC5jcmVhdGUucHVzaChsaXN0ZW5lck9wKTtcbiAgfVxufVxuXG5jb25zdCBCSU5ESU5HX0tJTkRTID0gbmV3IE1hcDxlLkJpbmRpbmdUeXBlLCBpci5CaW5kaW5nS2luZD4oW1xuICBbZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eSwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHldLFxuICBbZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGUsIGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZV0sXG4gIFtlLkJpbmRpbmdUeXBlLkNsYXNzLCBpci5CaW5kaW5nS2luZC5DbGFzc05hbWVdLFxuICBbZS5CaW5kaW5nVHlwZS5TdHlsZSwgaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eV0sXG4gIFtlLkJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgaXIuQmluZGluZ0tpbmQuQW5pbWF0aW9uXSxcbl0pO1xuXG5mdW5jdGlvbiBpbmdlc3RCaW5kaW5nKFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHhyZWY6IGlyLlhyZWZJZCwgbmFtZTogc3RyaW5nLCB2YWx1ZTogZS5BU1R8by5FeHByZXNzaW9uLFxuICAgIHR5cGU6IGUuQmluZGluZ1R5cGUsIHVuaXQ6IHN0cmluZ3xudWxsLCBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGlzVGV4dEF0dHJpYnV0ZTogYm9vbGVhbiwgaXNUZW1wbGF0ZUJpbmRpbmc6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cblxuICBsZXQgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufGlyLkludGVycG9sYXRpb247XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuSW50ZXJwb2xhdGlvbikge1xuICAgIGV4cHJlc3Npb24gPSBuZXcgaXIuSW50ZXJwb2xhdGlvbihcbiAgICAgICAgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LmpvYikpKTtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUKSB7XG4gICAgZXhwcmVzc2lvbiA9IGNvbnZlcnRBc3QodmFsdWUsIHZpZXcuam9iKTtcbiAgfSBlbHNlIHtcbiAgICBleHByZXNzaW9uID0gdmFsdWU7XG4gIH1cblxuICBjb25zdCBraW5kOiBpci5CaW5kaW5nS2luZCA9IEJJTkRJTkdfS0lORFMuZ2V0KHR5cGUpITtcbiAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVCaW5kaW5nT3AoXG4gICAgICB4cmVmLCBraW5kLCBuYW1lLCBleHByZXNzaW9uLCB1bml0LCBzZWN1cml0eUNvbnRleHQsIGlzVGV4dEF0dHJpYnV0ZSwgaXNUZW1wbGF0ZUJpbmRpbmcsXG4gICAgICBzb3VyY2VTcGFuKSk7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuIl19