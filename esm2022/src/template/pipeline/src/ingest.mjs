/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as e from '../../../expression_parser/ast';
import * as o from '../../../output/output_ast';
import * as t from '../../../render3/r3_ast';
import * as ir from '../ir';
import { ComponentCompilation } from './compilation';
import { BINARY_OPERATORS } from './conversion';
/**
 * Process a template AST and convert it into a `ComponentCompilation` in the intermediate
 * representation.
 */
export function ingest(componentName, template, constantPool) {
    const cpl = new ComponentCompilation(componentName, constantPool);
    ingestNodes(cpl.root, template);
    return cpl;
}
/**
 * Ingest the nodes of a template AST into the given `ViewCompilation`.
 */
function ingestNodes(view, template) {
    for (const node of template) {
        if (node instanceof t.Element) {
            ingestElement(view, node);
        }
        else if (node instanceof t.Template) {
            ingestTemplate(view, node);
        }
        else if (node instanceof t.Text) {
            ingestText(view, node);
        }
        else if (node instanceof t.BoundText) {
            ingestBoundText(view, node);
        }
        else {
            throw new Error(`Unsupported template node: ${node.constructor.name}`);
        }
    }
}
/**
 * Ingest an element AST from the template into the given `ViewCompilation`.
 */
function ingestElement(view, element) {
    const staticAttributes = {};
    for (const attr of element.attributes) {
        staticAttributes[attr.name] = attr.value;
    }
    const id = view.tpl.allocateXrefId();
    const startOp = ir.createElementStartOp(element.name, id);
    view.create.push(startOp);
    ingestBindings(view, startOp, element);
    ingestReferences(startOp, element);
    ingestNodes(view, element.children);
    view.create.push(ir.createElementEndOp(id));
}
/**
 * Ingest an `ng-template` node from the AST into the given `ViewCompilation`.
 */
function ingestTemplate(view, tmpl) {
    const childView = view.tpl.allocateView(view.xref);
    // TODO: validate the fallback tag name here.
    const tplOp = ir.createTemplateOp(childView.xref, tmpl.tagName ?? 'ng-template');
    view.create.push(tplOp);
    ingestBindings(view, tplOp, tmpl);
    ingestReferences(tplOp, tmpl);
    ingestNodes(childView, tmpl.children);
    for (const { name, value } of tmpl.variables) {
        childView.contextVariables.set(name, value);
    }
}
/**
 * Ingest a literal text node from the AST into the given `ViewCompilation`.
 */
function ingestText(view, text) {
    view.create.push(ir.createTextOp(view.tpl.allocateXrefId(), text.value));
}
/**
 * Ingest an interpolated text node from the AST into the given `ViewCompilation`.
 */
function ingestBoundText(view, text) {
    let value = text.value;
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (!(value instanceof e.Interpolation)) {
        throw new Error(`AssertionError: expected Interpolation for BoundText node, got ${value.constructor.name}`);
    }
    const textXref = view.tpl.allocateXrefId();
    view.create.push(ir.createTextOp(textXref, ''));
    view.update.push(ir.createInterpolateTextOp(textXref, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl))));
}
/**
 * Convert a template AST expression into an output AST expression.
 */
function convertAst(ast, cpl) {
    if (ast instanceof e.ASTWithSource) {
        return convertAst(ast.ast, cpl);
    }
    else if (ast instanceof e.PropertyRead) {
        if (ast.receiver instanceof e.ImplicitReceiver) {
            return new ir.LexicalReadExpr(ast.name);
        }
        else {
            return new o.ReadPropExpr(convertAst(ast.receiver, cpl), ast.name);
        }
    }
    else if (ast instanceof e.PropertyWrite) {
        return new o.WritePropExpr(convertAst(ast.receiver, cpl), ast.name, convertAst(ast.value, cpl));
    }
    else if (ast instanceof e.KeyedWrite) {
        return new o.WriteKeyExpr(convertAst(ast.receiver, cpl), convertAst(ast.key, cpl), convertAst(ast.value, cpl));
    }
    else if (ast instanceof e.Call) {
        if (ast.receiver instanceof e.ImplicitReceiver) {
            throw new Error(`Unexpected ImplicitReceiver`);
        }
        else {
            return new o.InvokeFunctionExpr(convertAst(ast.receiver, cpl), ast.args.map(arg => convertAst(arg, cpl)));
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
        return new o.BinaryOperatorExpr(operator, convertAst(ast.left, cpl), convertAst(ast.right, cpl));
    }
    else if (ast instanceof e.ThisReceiver) {
        return new ir.ContextExpr(cpl.root.xref);
    }
    else if (ast instanceof e.KeyedRead) {
        return new o.ReadKeyExpr(convertAst(ast.receiver, cpl), convertAst(ast.key, cpl));
    }
    else if (ast instanceof e.Chain) {
        throw new Error(`AssertionError: Chain in unknown context`);
    }
    else if (ast instanceof e.LiteralMap) {
        const entries = ast.keys.map((key, idx) => {
            const value = ast.values[idx];
            return new o.LiteralMapEntry(key.key, convertAst(value, cpl), key.quoted);
        });
        return new o.LiteralMapExpr(entries);
    }
    else if (ast instanceof e.LiteralArray) {
        return new o.LiteralArrayExpr(ast.expressions.map(expr => convertAst(expr, cpl)));
    }
    else if (ast instanceof e.Conditional) {
        return new o.ConditionalExpr(convertAst(ast.condition, cpl), convertAst(ast.trueExp, cpl), convertAst(ast.falseExp, cpl));
    }
    else if (ast instanceof e.NonNullAssert) {
        // A non-null assertion shouldn't impact generated instructions, so we can just drop it.
        return convertAst(ast.expression, cpl);
    }
    else if (ast instanceof e.BindingPipe) {
        return new ir.PipeBindingExpr(cpl.allocateXrefId(), ast.name, [
            convertAst(ast.exp, cpl),
            ...ast.args.map(arg => convertAst(arg, cpl)),
        ]);
    }
    else if (ast instanceof e.SafeKeyedRead) {
        return new ir.SafeKeyedReadExpr(convertAst(ast.receiver, cpl), convertAst(ast.key, cpl));
    }
    else if (ast instanceof e.SafePropertyRead) {
        return new ir.SafePropertyReadExpr(convertAst(ast.receiver, cpl), ast.name);
    }
    else if (ast instanceof e.SafeCall) {
        return new ir.SafeInvokeFunctionExpr(convertAst(ast.receiver, cpl), ast.args.map(a => convertAst(a, cpl)));
    }
    else {
        throw new Error(`Unhandled expression type: ${ast.constructor.name}`);
    }
}
/**
 * Process all of the bindings on an element-like structure in the template AST and convert them
 * to their IR representation.
 */
function ingestBindings(view, op, element) {
    if (element instanceof t.Template) {
        for (const attr of element.templateAttrs) {
            if (attr instanceof t.TextAttribute) {
                view.update.push(ir.createAttributeOp(op.xref, ir.ElementAttributeKind.Template, attr.name, o.literal(attr.value)));
            }
            else {
                ingestPropertyBinding(view, op.xref, ir.ElementAttributeKind.Template, attr);
            }
        }
    }
    for (const attr of element.attributes) {
        view.update.push(ir.createAttributeOp(op.xref, ir.ElementAttributeKind.Attribute, attr.name, o.literal(attr.value)));
    }
    for (const input of element.inputs) {
        ingestPropertyBinding(view, op.xref, ir.ElementAttributeKind.Binding, input);
    }
    for (const output of element.outputs) {
        const listenerOp = ir.createListenerOp(op.xref, output.name, op.tag);
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
        const expressions = inputExprs.map(expr => convertAst(expr, view.tpl));
        const returnExpr = expressions.pop();
        for (const expr of expressions) {
            const stmtOp = ir.createStatementOp(new o.ExpressionStatement(expr));
            listenerOp.handlerOps.push(stmtOp);
        }
        listenerOp.handlerOps.push(ir.createStatementOp(new o.ReturnStatement(returnExpr)));
        view.create.push(listenerOp);
    }
}
function ingestPropertyBinding(view, xref, bindingKind, { name, value, type }) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (value instanceof e.Interpolation) {
        switch (type) {
            case 0 /* e.BindingType.Property */:
                view.update.push(ir.createInterpolatePropertyOp(xref, bindingKind, name, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl))));
                break;
            default:
                // TODO: implement remaining binding types.
                throw Error(`Interpolated property binding type not handled: ${type}`);
        }
    }
    else {
        switch (type) {
            case 0 /* e.BindingType.Property */:
                view.update.push(ir.createPropertyOp(xref, bindingKind, name, convertAst(value, view.tpl)));
                break;
            default:
                // TODO: implement remaining binding types.
                throw Error(`Property binding type not handled: ${type}`);
        }
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLENBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFDLG9CQUFvQixFQUFrQixNQUFNLGVBQWUsQ0FBQztBQUNwRSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFOUM7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLE1BQU0sQ0FDbEIsYUFBcUIsRUFBRSxRQUFrQixFQUFFLFlBQTBCO0lBQ3ZFLE1BQU0sR0FBRyxHQUFHLElBQUksb0JBQW9CLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ2xFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2hDLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxXQUFXLENBQUMsSUFBcUIsRUFBRSxRQUFrQjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLFFBQVEsRUFBRTtRQUMzQixJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsT0FBTyxFQUFFO1lBQzdCLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDM0I7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFO1lBQ3JDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDNUI7YUFBTSxJQUFJLElB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O0lBQ3pDLEtBQUssTUFBTSxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUMsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQzlDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQ2hCLElBQUk7WUFDSixNQUFNLEVBQUUsS0FBSztTQUNkLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxhQUFhLENBQUksS0FBVTtJQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7S0FDdEQ7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGUgZnJvbSAnLi4vLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb24sIFZpZXdDb21waWxhdGlvbn0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5pbXBvcnQge0JJTkFSWV9PUEVSQVRPUlN9IGZyb20gJy4vY29udmVyc2lvbic7XG5cbi8qKlxuICogUHJvY2VzcyBhIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCBpdCBpbnRvIGEgYENvbXBvbmVudENvbXBpbGF0aW9uYCBpbiB0aGUgaW50ZXJtZWRpYXRlXG4gKiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZ2VzdChcbiAgICBjb21wb25lbnROYW1lOiBzdHJpbmcsIHRlbXBsYXRlOiB0Lk5vZGVbXSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBDb21wb25lbnRDb21waWxhdGlvbiB7XG4gIGNvbnN0IGNwbCA9IG5ldyBDb21wb25lbnRDb21waWxhdGlvbihjb21wb25lbnROYW1lLCBjb25zdGFudFBvb2wpO1xuICBpbmdlc3ROb2RlcyhjcGwucm9vdCwgdGVtcGxhdGUpO1xuICByZXR1cm4gY3BsO1xufVxuXG4vKipcbiAqIEluZ2VzdCB0aGUgbm9kZXMgb2YgYSB0ZW1wbGF0ZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdE5vZGVzKHZpZXc6IFZpZXdDb21waWxhdGlvbiwgdGVtcGxhdGU6IHQuTm9kZVtdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiB0ZW1wbGF0ZSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICBpbmdlc3RFbGVtZW50KHZpZXcsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGVtcGxhdGUpIHtcbiAgICAgIGluZ2VzdFRlbXBsYXRlKHZpZXcsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgaW5nZXN0VGV4dCh2aWV3LCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkJvdW5kVGV4dCkge1xuICAgICAgaW5nZXN0Qm91bmRUZXh0KHZpZXcsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHRlbXBsYXRlIG5vZGU6ICR7bm9kZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBlbGVtZW50IEFTVCBmcm9tIHRoZSB0ZW1wbGF0ZSBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0RWxlbWVudCh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIGVsZW1lbnQ6IHQuRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBzdGF0aWNBdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICBzdGF0aWNBdHRyaWJ1dGVzW2F0dHIubmFtZV0gPSBhdHRyLnZhbHVlO1xuICB9XG4gIGNvbnN0IGlkID0gdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKTtcblxuICBjb25zdCBzdGFydE9wID0gaXIuY3JlYXRlRWxlbWVudFN0YXJ0T3AoZWxlbWVudC5uYW1lLCBpZCk7XG4gIHZpZXcuY3JlYXRlLnB1c2goc3RhcnRPcCk7XG5cbiAgaW5nZXN0QmluZGluZ3Modmlldywgc3RhcnRPcCwgZWxlbWVudCk7XG4gIGluZ2VzdFJlZmVyZW5jZXMoc3RhcnRPcCwgZWxlbWVudCk7XG5cbiAgaW5nZXN0Tm9kZXModmlldywgZWxlbWVudC5jaGlsZHJlbik7XG4gIHZpZXcuY3JlYXRlLnB1c2goaXIuY3JlYXRlRWxlbWVudEVuZE9wKGlkKSk7XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGBuZy10ZW1wbGF0ZWAgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRlbXBsYXRlKHZpZXc6IFZpZXdDb21waWxhdGlvbiwgdG1wbDogdC5UZW1wbGF0ZSk6IHZvaWQge1xuICBjb25zdCBjaGlsZFZpZXcgPSB2aWV3LnRwbC5hbGxvY2F0ZVZpZXcodmlldy54cmVmKTtcblxuICAvLyBUT0RPOiB2YWxpZGF0ZSB0aGUgZmFsbGJhY2sgdGFnIG5hbWUgaGVyZS5cbiAgY29uc3QgdHBsT3AgPSBpci5jcmVhdGVUZW1wbGF0ZU9wKGNoaWxkVmlldy54cmVmLCB0bXBsLnRhZ05hbWUgPz8gJ25nLXRlbXBsYXRlJyk7XG4gIHZpZXcuY3JlYXRlLnB1c2godHBsT3ApO1xuXG4gIGluZ2VzdEJpbmRpbmdzKHZpZXcsIHRwbE9wLCB0bXBsKTtcbiAgaW5nZXN0UmVmZXJlbmNlcyh0cGxPcCwgdG1wbCk7XG5cbiAgaW5nZXN0Tm9kZXMoY2hpbGRWaWV3LCB0bXBsLmNoaWxkcmVuKTtcblxuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgdG1wbC52YXJpYWJsZXMpIHtcbiAgICBjaGlsZFZpZXcuY29udGV4dFZhcmlhYmxlcy5zZXQobmFtZSwgdmFsdWUpO1xuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGEgbGl0ZXJhbCB0ZXh0IG5vZGUgZnJvbSB0aGUgQVNUIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RUZXh0KHZpZXc6IFZpZXdDb21waWxhdGlvbiwgdGV4dDogdC5UZXh0KTogdm9pZCB7XG4gIHZpZXcuY3JlYXRlLnB1c2goaXIuY3JlYXRlVGV4dE9wKHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHRleHQudmFsdWUpKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gaW50ZXJwb2xhdGVkIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdEJvdW5kVGV4dCh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHRleHQ6IHQuQm91bmRUZXh0KTogdm9pZCB7XG4gIGxldCB2YWx1ZSA9IHRleHQudmFsdWU7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHZhbHVlID0gdmFsdWUuYXN0O1xuICB9XG4gIGlmICghKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBJbnRlcnBvbGF0aW9uIGZvciBCb3VuZFRleHQgbm9kZSwgZ290ICR7dmFsdWUuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxuXG4gIGNvbnN0IHRleHRYcmVmID0gdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKTtcbiAgdmlldy5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3AodGV4dFhyZWYsICcnKSk7XG4gIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVUZXh0T3AoXG4gICAgICB0ZXh0WHJlZiwgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LnRwbCkpKSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRlbXBsYXRlIEFTVCBleHByZXNzaW9uIGludG8gYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0QXN0KGFzdDogZS5BU1QsIGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmFzdCwgY3BsKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5UmVhZCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBuZXcgaXIuTGV4aWNhbFJlYWRFeHByKGFzdC5uYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgYXN0Lm5hbWUpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlByb3BlcnR5V3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVQcm9wRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgYXN0Lm5hbWUsIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBjcGwpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkV3JpdGUpIHtcbiAgICByZXR1cm4gbmV3IG8uV3JpdGVLZXlFeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSxcbiAgICAgICAgY29udmVydEFzdChhc3Qua2V5LCBjcGwpLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC52YWx1ZSwgY3BsKSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2FsbCkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBlLkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBJbXBsaWNpdFJlY2VpdmVyYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgby5JbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgICAgY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGNwbCksIGFzdC5hcmdzLm1hcChhcmcgPT4gY29udmVydEFzdChhcmcsIGNwbCkpKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChhc3QudmFsdWUpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQmluYXJ5KSB7XG4gICAgY29uc3Qgb3BlcmF0b3IgPSBCSU5BUllfT1BFUkFUT1JTLmdldChhc3Qub3BlcmF0aW9uKTtcbiAgICBpZiAob3BlcmF0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5rbm93biBiaW5hcnkgb3BlcmF0b3IgJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICBvcGVyYXRvciwgY29udmVydEFzdChhc3QubGVmdCwgY3BsKSwgY29udmVydEFzdChhc3QucmlnaHQsIGNwbCkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuVGhpc1JlY2VpdmVyKSB7XG4gICAgcmV0dXJuIG5ldyBpci5Db250ZXh0RXhwcihjcGwucm9vdC54cmVmKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLktleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgby5SZWFkS2V5RXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgY29udmVydEFzdChhc3Qua2V5LCBjcGwpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNoYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQ2hhaW4gaW4gdW5rbm93biBjb250ZXh0YCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsTWFwKSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5rZXlzLm1hcCgoa2V5LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXN0LnZhbHVlc1tpZHhdO1xuICAgICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXkua2V5LCBjb252ZXJ0QXN0KHZhbHVlLCBjcGwpLCBrZXkucXVvdGVkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEV4cHIoZW50cmllcyk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5MaXRlcmFsQXJyYXkpIHtcbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihhc3QuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCBjcGwpKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5Db25kaXRpb25hbCkge1xuICAgIHJldHVybiBuZXcgby5Db25kaXRpb25hbEV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LmNvbmRpdGlvbiwgY3BsKSxcbiAgICAgICAgY29udmVydEFzdChhc3QudHJ1ZUV4cCwgY3BsKSxcbiAgICAgICAgY29udmVydEFzdChhc3QuZmFsc2VFeHAsIGNwbCksXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLk5vbk51bGxBc3NlcnQpIHtcbiAgICAvLyBBIG5vbi1udWxsIGFzc2VydGlvbiBzaG91bGRuJ3QgaW1wYWN0IGdlbmVyYXRlZCBpbnN0cnVjdGlvbnMsIHNvIHdlIGNhbiBqdXN0IGRyb3AgaXQuXG4gICAgcmV0dXJuIGNvbnZlcnRBc3QoYXN0LmV4cHJlc3Npb24sIGNwbCk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5kaW5nUGlwZSkge1xuICAgIHJldHVybiBuZXcgaXIuUGlwZUJpbmRpbmdFeHByKFxuICAgICAgICBjcGwuYWxsb2NhdGVYcmVmSWQoKSxcbiAgICAgICAgYXN0Lm5hbWUsXG4gICAgICAgIFtcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5leHAsIGNwbCksXG4gICAgICAgICAgLi4uYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgY3BsKSksXG4gICAgICAgIF0sXG4gICAgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVLZXllZFJlYWQpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVLZXllZFJlYWRFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLCBjb252ZXJ0QXN0KGFzdC5rZXksIGNwbCkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgIHJldHVybiBuZXcgaXIuU2FmZVByb3BlcnR5UmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGNwbCksIGFzdC5uYW1lKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLlNhZmVDYWxsKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlSW52b2tlRnVuY3Rpb25FeHByKFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgYXN0LmFyZ3MubWFwKGEgPT4gY29udmVydEFzdChhLCBjcGwpKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgZXhwcmVzc2lvbiB0eXBlOiAke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtXG4gKiB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0QmluZGluZ3MoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQudGVtcGxhdGVBdHRycykge1xuICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgIG9wLnhyZWYsIGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0UHJvcGVydHlCaW5kaW5nKHZpZXcsIG9wLnhyZWYsIGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlLCBhdHRyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVBdHRyaWJ1dGVPcChcbiAgICAgICAgb3AueHJlZiwgaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQXR0cmlidXRlLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBpbnB1dCBvZiBlbGVtZW50LmlucHV0cykge1xuICAgIGluZ2VzdFByb3BlcnR5QmluZGluZyh2aWV3LCBvcC54cmVmLCBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nLCBpbnB1dCk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG91dHB1dCBvZiBlbGVtZW50Lm91dHB1dHMpIHtcbiAgICBjb25zdCBsaXN0ZW5lck9wID0gaXIuY3JlYXRlTGlzdGVuZXJPcChvcC54cmVmLCBvdXRwdXQubmFtZSwgb3AudGFnKTtcbiAgICAvLyBpZiBvdXRwdXQuaGFuZGxlciBpcyBhIGNoYWluLCB0aGVuIHB1c2ggZWFjaCBzdGF0ZW1lbnQgZnJvbSB0aGUgY2hhaW4gc2VwYXJhdGVseSwgYW5kXG4gICAgLy8gcmV0dXJuIHRoZSBsYXN0IG9uZT9cbiAgICBsZXQgaW5wdXRFeHByczogZS5BU1RbXTtcbiAgICBsZXQgaGFuZGxlcjogZS5BU1QgPSBvdXRwdXQuaGFuZGxlcjtcbiAgICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXIuYXN0O1xuICAgIH1cblxuICAgIGlmIChoYW5kbGVyIGluc3RhbmNlb2YgZS5DaGFpbikge1xuICAgICAgaW5wdXRFeHBycyA9IGhhbmRsZXIuZXhwcmVzc2lvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlucHV0RXhwcnMgPSBbaGFuZGxlcl07XG4gICAgfVxuXG4gICAgaWYgKGlucHV0RXhwcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGxpc3RlbmVyIHRvIGhhdmUgbm9uLWVtcHR5IGV4cHJlc3Npb24gbGlzdC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBleHByZXNzaW9ucyA9IGlucHV0RXhwcnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LnRwbCkpO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBleHByZXNzaW9ucy5wb3AoKSE7XG5cbiAgICBmb3IgKGNvbnN0IGV4cHIgb2YgZXhwcmVzc2lvbnMpIHtcbiAgICAgIGNvbnN0IHN0bXRPcCA9IGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGV4cHIpKTtcbiAgICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKHN0bXRPcCk7XG4gICAgfVxuICAgIGxpc3RlbmVyT3AuaGFuZGxlck9wcy5wdXNoKGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLlJldHVyblN0YXRlbWVudChyZXR1cm5FeHByKSkpO1xuICAgIHZpZXcuY3JlYXRlLnB1c2gobGlzdGVuZXJPcCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5nZXN0UHJvcGVydHlCaW5kaW5nKFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvbiwgeHJlZjogaXIuWHJlZklkLFxuICAgIGJpbmRpbmdLaW5kOiBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nfGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlLFxuICAgIHtuYW1lLCB2YWx1ZSwgdHlwZX06IHQuQm91bmRBdHRyaWJ1dGUpOiB2b2lkIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cblxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pIHtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVByb3BlcnR5T3AoXG4gICAgICAgICAgICB4cmVmLCBiaW5kaW5nS2luZCwgbmFtZSwgdmFsdWUuc3RyaW5ncyxcbiAgICAgICAgICAgIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdmlldy50cGwpKSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIFRPRE86IGltcGxlbWVudCByZW1haW5pbmcgYmluZGluZyB0eXBlcy5cbiAgICAgICAgdGhyb3cgRXJyb3IoYEludGVycG9sYXRlZCBwcm9wZXJ0eSBiaW5kaW5nIHR5cGUgbm90IGhhbmRsZWQ6ICR7dHlwZX1gKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIGUuQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlUHJvcGVydHlPcCh4cmVmLCBiaW5kaW5nS2luZCwgbmFtZSwgY29udmVydEFzdCh2YWx1ZSwgdmlldy50cGwpKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IHJlbWFpbmluZyBiaW5kaW5nIHR5cGVzLlxuICAgICAgICB0aHJvdyBFcnJvcihgUHJvcGVydHkgYmluZGluZyB0eXBlIG5vdCBoYW5kbGVkOiAke3R5cGV9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGxvY2FsIHJlZmVyZW5jZXMgb24gYW4gZWxlbWVudC1saWtlIHN0cnVjdHVyZSBpbiB0aGUgdGVtcGxhdGUgQVNUIGFuZFxuICogY29udmVydCB0aGVtIHRvIHRoZWlyIElSIHJlcHJlc2VudGF0aW9uLlxuICovXG5mdW5jdGlvbiBpbmdlc3RSZWZlcmVuY2VzKG9wOiBpci5FbGVtZW50T3BCYXNlLCBlbGVtZW50OiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHZvaWQge1xuICBhc3NlcnRJc0FycmF5PGlyLkxvY2FsUmVmPihvcC5sb2NhbFJlZnMpO1xuICBmb3IgKGNvbnN0IHtuYW1lLCB2YWx1ZX0gb2YgZWxlbWVudC5yZWZlcmVuY2VzKSB7XG4gICAgb3AubG9jYWxSZWZzLnB1c2goe1xuICAgICAgbmFtZSxcbiAgICAgIHRhcmdldDogdmFsdWUsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgZ2l2ZW4gdmFsdWUgaXMgYW4gYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzQXJyYXk8VD4odmFsdWU6IGFueSk6IGFzc2VydHMgdmFsdWUgaXMgQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gYXJyYXlgKTtcbiAgfVxufVxuIl19