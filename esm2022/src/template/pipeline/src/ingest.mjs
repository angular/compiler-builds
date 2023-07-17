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
        // This is only attribute TextLiteral bindings, such as `attr.foo="bar'`. This can never be
        // `[attr.foo]="bar"` or `attr.foo="{{bar}}"`, both of which will be handled as inputs with
        // `BindingType.Attribute`.
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
function ingestPropertyBinding(view, xref, bindingKind, { name, value, type, unit }) {
    if (value instanceof e.ASTWithSource) {
        value = value.ast;
    }
    if (value instanceof e.Interpolation) {
        switch (type) {
            case 0 /* e.BindingType.Property */:
                if (name === 'style') {
                    if (bindingKind !== ir.ElementAttributeKind.Binding) {
                        throw Error('Unexpected style binding on ng-template');
                    }
                    view.update.push(ir.createInterpolateStyleMapOp(xref, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl))));
                }
                else if (name === 'class') {
                    if (bindingKind !== ir.ElementAttributeKind.Binding) {
                        throw Error('Unexpected class binding on ng-template');
                    }
                    view.update.push(ir.createInterpolateClassMapOp(xref, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl))));
                }
                else {
                    view.update.push(ir.createInterpolatePropertyOp(xref, bindingKind, name, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl))));
                }
                break;
            case 3 /* e.BindingType.Style */:
                if (bindingKind !== ir.ElementAttributeKind.Binding) {
                    throw Error('Unexpected style binding on ng-template');
                }
                view.update.push(ir.createInterpolateStylePropOp(xref, name, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl)), unit));
                break;
            case 1 /* e.BindingType.Attribute */:
                if (bindingKind !== ir.ElementAttributeKind.Binding) {
                    throw new Error('Attribute bindings on templates are not expected to be valid');
                }
                const attributeInterpolate = ir.createInterpolateAttributeOp(xref, bindingKind, name, value.strings, value.expressions.map(expr => convertAst(expr, view.tpl)));
                view.update.push(attributeInterpolate);
                break;
            case 2 /* e.BindingType.Class */:
                throw Error('Unexpected interpolation in class property binding');
            // TODO: implement remaining binding types.
            case 4 /* e.BindingType.Animation */:
            default:
                throw Error(`Interpolated property binding type not handled: ${type}`);
        }
    }
    else {
        switch (type) {
            case 0 /* e.BindingType.Property */:
                // Bindings to [style] are mapped to their own special instruction.
                if (name === 'style') {
                    if (bindingKind !== ir.ElementAttributeKind.Binding) {
                        throw Error('Unexpected style binding on ng-template');
                    }
                    view.update.push(ir.createStyleMapOp(xref, convertAst(value, view.tpl)));
                }
                else if (name === 'class') {
                    if (bindingKind !== ir.ElementAttributeKind.Binding) {
                        throw Error('Unexpected class binding on ng-template');
                    }
                    view.update.push(ir.createClassMapOp(xref, convertAst(value, view.tpl)));
                }
                else {
                    view.update.push(ir.createPropertyOp(xref, bindingKind, name, convertAst(value, view.tpl)));
                }
                break;
            case 3 /* e.BindingType.Style */:
                if (bindingKind !== ir.ElementAttributeKind.Binding) {
                    throw Error('Unexpected style binding on ng-template');
                }
                view.update.push(ir.createStylePropOp(xref, name, convertAst(value, view.tpl), unit));
                break;
            case 1 /* e.BindingType.Attribute */:
                if (bindingKind !== ir.ElementAttributeKind.Binding) {
                    throw new Error('Attribute bindings on templates are not expected to be valid');
                }
                const attrOp = ir.createAttributeOp(xref, bindingKind, name, convertAst(value, view.tpl));
                view.update.push(attrOp);
                break;
            case 2 /* e.BindingType.Class */:
                if (bindingKind !== ir.ElementAttributeKind.Binding) {
                    throw Error('Unexpected class binding on ng-template');
                }
                view.update.push(ir.createClassPropOp(xref, name, convertAst(value, view.tpl)));
                break;
            // TODO: implement remaining binding types.
            case 4 /* e.BindingType.Animation */:
            default:
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9pbmdlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxLQUFLLENBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFNUIsT0FBTyxFQUFDLG9CQUFvQixFQUFrQixNQUFNLGVBQWUsQ0FBQztBQUNwRSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFOUM7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLE1BQU0sQ0FDbEIsYUFBcUIsRUFBRSxRQUFrQixFQUFFLFlBQTBCO0lBQ3ZFLE1BQU0sR0FBRyxHQUFHLElBQUksb0JBQW9CLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ2xFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2hDLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxXQUFXLENBQUMsSUFBcUIsRUFBRSxRQUFrQjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLFFBQVEsRUFBRTtRQUMzQixJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsT0FBTyxFQUFFO1lBQzdCLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDM0I7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFO1lBQ3JDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDNUI7YUFBTSxJQUFJLElB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LENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hGLE1BQU07WUFDUiwyQ0FBMkM7WUFDM0MscUNBQTZCO1lBQzdCO2dCQUNFLE1BQU0sS0FBSyxDQUFDLHNDQUFzQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzdEO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxFQUFvQixFQUFFLE9BQTZCO0lBQzNFLGFBQWEsQ0FBYyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekMsS0FBSyxNQUFNLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBQyxJQUFJLE9BQU8sQ0FBQyxVQUFVLEVBQUU7UUFDOUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDaEIsSUFBSTtZQUNKLE1BQU0sRUFBRSxLQUFLO1NBQ2QsQ0FBQyxDQUFDO0tBQ0o7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGFBQWEsQ0FBSSxLQUFVO0lBQ2xDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztLQUN0RDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgZSBmcm9tICcuLi8uLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7QklOQVJZX09QRVJBVE9SU30gZnJvbSAnLi9jb252ZXJzaW9uJztcblxuLyoqXG4gKiBQcm9jZXNzIGEgdGVtcGxhdGUgQVNUIGFuZCBjb252ZXJ0IGl0IGludG8gYSBgQ29tcG9uZW50Q29tcGlsYXRpb25gIGluIHRoZSBpbnRlcm1lZGlhdGVcbiAqIHJlcHJlc2VudGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5nZXN0KFxuICAgIGNvbXBvbmVudE5hbWU6IHN0cmluZywgdGVtcGxhdGU6IHQuTm9kZVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IENvbXBvbmVudENvbXBpbGF0aW9uIHtcbiAgY29uc3QgY3BsID0gbmV3IENvbXBvbmVudENvbXBpbGF0aW9uKGNvbXBvbmVudE5hbWUsIGNvbnN0YW50UG9vbCk7XG4gIGluZ2VzdE5vZGVzKGNwbC5yb290LCB0ZW1wbGF0ZSk7XG4gIHJldHVybiBjcGw7XG59XG5cbi8qKlxuICogSW5nZXN0IHRoZSBub2RlcyBvZiBhIHRlbXBsYXRlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Tm9kZXModmlldzogVmlld0NvbXBpbGF0aW9uLCB0ZW1wbGF0ZTogdC5Ob2RlW10pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBub2RlIG9mIHRlbXBsYXRlKSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIGluZ2VzdEVsZW1lbnQodmlldywgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSkge1xuICAgICAgaW5nZXN0VGVtcGxhdGUodmlldywgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBpbmdlc3RUZXh0KHZpZXcsIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0KSB7XG4gICAgICBpbmdlc3RCb3VuZFRleHQodmlldywgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZTogJHtub2RlLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW5nZXN0IGFuIGVsZW1lbnQgQVNUIGZyb20gdGhlIHRlbXBsYXRlIGludG8gdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gLlxuICovXG5mdW5jdGlvbiBpbmdlc3RFbGVtZW50KHZpZXc6IFZpZXdDb21waWxhdGlvbiwgZWxlbWVudDogdC5FbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHN0YXRpY0F0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgIHN0YXRpY0F0dHJpYnV0ZXNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG4gIH1cbiAgY29uc3QgaWQgPSB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpO1xuXG4gIGNvbnN0IHN0YXJ0T3AgPSBpci5jcmVhdGVFbGVtZW50U3RhcnRPcChlbGVtZW50Lm5hbWUsIGlkKTtcbiAgdmlldy5jcmVhdGUucHVzaChzdGFydE9wKTtcblxuICBpbmdlc3RCaW5kaW5ncyh2aWV3LCBzdGFydE9wLCBlbGVtZW50KTtcbiAgaW5nZXN0UmVmZXJlbmNlcyhzdGFydE9wLCBlbGVtZW50KTtcblxuICBpbmdlc3ROb2Rlcyh2aWV3LCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgdmlldy5jcmVhdGUucHVzaChpci5jcmVhdGVFbGVtZW50RW5kT3AoaWQpKTtcbn1cblxuLyoqXG4gKiBJbmdlc3QgYW4gYG5nLXRlbXBsYXRlYCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0VGVtcGxhdGUodmlldzogVmlld0NvbXBpbGF0aW9uLCB0bXBsOiB0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGNvbnN0IGNoaWxkVmlldyA9IHZpZXcudHBsLmFsbG9jYXRlVmlldyh2aWV3LnhyZWYpO1xuXG4gIC8vIFRPRE86IHZhbGlkYXRlIHRoZSBmYWxsYmFjayB0YWcgbmFtZSBoZXJlLlxuICBjb25zdCB0cGxPcCA9IGlyLmNyZWF0ZVRlbXBsYXRlT3AoY2hpbGRWaWV3LnhyZWYsIHRtcGwudGFnTmFtZSA/PyAnbmctdGVtcGxhdGUnKTtcbiAgdmlldy5jcmVhdGUucHVzaCh0cGxPcCk7XG5cbiAgaW5nZXN0QmluZGluZ3ModmlldywgdHBsT3AsIHRtcGwpO1xuICBpbmdlc3RSZWZlcmVuY2VzKHRwbE9wLCB0bXBsKTtcblxuICBpbmdlc3ROb2RlcyhjaGlsZFZpZXcsIHRtcGwuY2hpbGRyZW4pO1xuXG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiB0bXBsLnZhcmlhYmxlcykge1xuICAgIGNoaWxkVmlldy5jb250ZXh0VmFyaWFibGVzLnNldChuYW1lLCB2YWx1ZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmdlc3QgYSBsaXRlcmFsIHRleHQgbm9kZSBmcm9tIHRoZSBBU1QgaW50byB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAuXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFRleHQodmlldzogVmlld0NvbXBpbGF0aW9uLCB0ZXh0OiB0LlRleHQpOiB2b2lkIHtcbiAgdmlldy5jcmVhdGUucHVzaChpci5jcmVhdGVUZXh0T3Aodmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwgdGV4dC52YWx1ZSkpO1xufVxuXG4vKipcbiAqIEluZ2VzdCBhbiBpbnRlcnBvbGF0ZWQgdGV4dCBub2RlIGZyb20gdGhlIEFTVCBpbnRvIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYC5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0Qm91bmRUZXh0KHZpZXc6IFZpZXdDb21waWxhdGlvbiwgdGV4dDogdC5Cb3VuZFRleHQpOiB2b2lkIHtcbiAgbGV0IHZhbHVlID0gdGV4dC52YWx1ZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5BU1RXaXRoU291cmNlKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5hc3Q7XG4gIH1cbiAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBlLkludGVycG9sYXRpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIEludGVycG9sYXRpb24gZm9yIEJvdW5kVGV4dCBub2RlLCBnb3QgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG5cbiAgY29uc3QgdGV4dFhyZWYgPSB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpO1xuICB2aWV3LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVRleHRPcCh0ZXh0WHJlZiwgJycpKTtcbiAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVRleHRPcChcbiAgICAgIHRleHRYcmVmLCB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHZpZXcudHBsKSkpKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGVtcGxhdGUgQVNUIGV4cHJlc3Npb24gaW50byBhbiBvdXRwdXQgQVNUIGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRBc3QoYXN0OiBlLkFTVCwgY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuYXN0LCBjcGwpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlSZWFkKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG5ldyBpci5MZXhpY2FsUmVhZEV4cHIoYXN0Lm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLCBhc3QubmFtZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuUHJvcGVydHlXcml0ZSkge1xuICAgIHJldHVybiBuZXcgby5Xcml0ZVByb3BFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLCBhc3QubmFtZSwgY29udmVydEFzdChhc3QudmFsdWUsIGNwbCkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRXcml0ZSkge1xuICAgIHJldHVybiBuZXcgby5Xcml0ZUtleUV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5rZXksIGNwbCksXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnZhbHVlLCBjcGwpLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5DYWxsKSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGUuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIEltcGxpY2l0UmVjZWl2ZXJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBvLkludm9rZUZ1bmN0aW9uRXhwcihcbiAgICAgICAgICBjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgYXN0LmFyZ3MubWFwKGFyZyA9PiBjb252ZXJ0QXN0KGFyZywgY3BsKSkpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKGFzdC52YWx1ZSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5CaW5hcnkpIHtcbiAgICBjb25zdCBvcGVyYXRvciA9IEJJTkFSWV9PUEVSQVRPUlMuZ2V0KGFzdC5vcGVyYXRpb24pO1xuICAgIGlmIChvcGVyYXRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmtub3duIGJpbmFyeSBvcGVyYXRvciAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgIG9wZXJhdG9yLCBjb252ZXJ0QXN0KGFzdC5sZWZ0LCBjcGwpLCBjb252ZXJ0QXN0KGFzdC5yaWdodCwgY3BsKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5UaGlzUmVjZWl2ZXIpIHtcbiAgICByZXR1cm4gbmV3IGlyLkNvbnRleHRFeHByKGNwbC5yb290LnhyZWYpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuS2V5ZWRSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRLZXlFeHByKGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLCBjb252ZXJ0QXN0KGFzdC5rZXksIGNwbCkpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBDaGFpbiBpbiB1bmtub3duIGNvbnRleHRgKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxNYXApIHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXN0LmtleXMubWFwKChrZXksIGlkeCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWVzW2lkeF07XG4gICAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KGtleS5rZXksIGNvbnZlcnRBc3QodmFsdWUsIGNwbCksIGtleS5xdW90ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRXhwcihlbnRyaWVzKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkxpdGVyYWxBcnJheSkge1xuICAgIHJldHVybiBuZXcgby5MaXRlcmFsQXJyYXlFeHByKGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIGNwbCkpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkNvbmRpdGlvbmFsKSB7XG4gICAgcmV0dXJuIG5ldyBvLkNvbmRpdGlvbmFsRXhwcihcbiAgICAgICAgY29udmVydEFzdChhc3QuY29uZGl0aW9uLCBjcGwpLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC50cnVlRXhwLCBjcGwpLFxuICAgICAgICBjb252ZXJ0QXN0KGFzdC5mYWxzZUV4cCwgY3BsKSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuTm9uTnVsbEFzc2VydCkge1xuICAgIC8vIEEgbm9uLW51bGwgYXNzZXJ0aW9uIHNob3VsZG4ndCBpbXBhY3QgZ2VuZXJhdGVkIGluc3RydWN0aW9ucywgc28gd2UgY2FuIGp1c3QgZHJvcCBpdC5cbiAgICByZXR1cm4gY29udmVydEFzdChhc3QuZXhwcmVzc2lvbiwgY3BsKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkJpbmRpbmdQaXBlKSB7XG4gICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ0V4cHIoXG4gICAgICAgIGNwbC5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBhc3QubmFtZSxcbiAgICAgICAgW1xuICAgICAgICAgIGNvbnZlcnRBc3QoYXN0LmV4cCwgY3BsKSxcbiAgICAgICAgICAuLi5hc3QuYXJncy5tYXAoYXJnID0+IGNvbnZlcnRBc3QoYXJnLCBjcGwpKSxcbiAgICAgICAgXSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUtleWVkUmVhZCkge1xuICAgIHJldHVybiBuZXcgaXIuU2FmZUtleWVkUmVhZEV4cHIoY29udmVydEFzdChhc3QucmVjZWl2ZXIsIGNwbCksIGNvbnZlcnRBc3QoYXN0LmtleSwgY3BsKSk7XG4gIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgZS5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgcmV0dXJuIG5ldyBpci5TYWZlUHJvcGVydHlSZWFkRXhwcihjb252ZXJ0QXN0KGFzdC5yZWNlaXZlciwgY3BsKSwgYXN0Lm5hbWUpO1xuICB9IGVsc2UgaWYgKGFzdCBpbnN0YW5jZW9mIGUuU2FmZUNhbGwpIHtcbiAgICByZXR1cm4gbmV3IGlyLlNhZmVJbnZva2VGdW5jdGlvbkV4cHIoXG4gICAgICAgIGNvbnZlcnRBc3QoYXN0LnJlY2VpdmVyLCBjcGwpLCBhc3QuYXJncy5tYXAoYSA9PiBjb252ZXJ0QXN0KGEsIGNwbCkpKTtcbiAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBlLkVtcHR5RXhwcikge1xuICAgIHJldHVybiBuZXcgaXIuRW1wdHlFeHByKCk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgZXhwcmVzc2lvbiB0eXBlOiAke2FzdC5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2VzcyBhbGwgb2YgdGhlIGJpbmRpbmdzIG9uIGFuIGVsZW1lbnQtbGlrZSBzdHJ1Y3R1cmUgaW4gdGhlIHRlbXBsYXRlIEFTVCBhbmQgY29udmVydCB0aGVtXG4gKiB0byB0aGVpciBJUiByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5nZXN0QmluZGluZ3MoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBvcDogaXIuRWxlbWVudE9wQmFzZSwgZWxlbWVudDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB2b2lkIHtcbiAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiB0LlRlbXBsYXRlKSB7XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQudGVtcGxhdGVBdHRycykge1xuICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgIG9wLnhyZWYsIGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlLCBhdHRyLm5hbWUsIG8ubGl0ZXJhbChhdHRyLnZhbHVlKSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5nZXN0UHJvcGVydHlCaW5kaW5nKHZpZXcsIG9wLnhyZWYsIGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLlRlbXBsYXRlLCBhdHRyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgLy8gVGhpcyBpcyBvbmx5IGF0dHJpYnV0ZSBUZXh0TGl0ZXJhbCBiaW5kaW5ncywgc3VjaCBhcyBgYXR0ci5mb289XCJiYXInYC4gVGhpcyBjYW4gbmV2ZXIgYmVcbiAgICAvLyBgW2F0dHIuZm9vXT1cImJhclwiYCBvciBgYXR0ci5mb289XCJ7e2Jhcn19XCJgLCBib3RoIG9mIHdoaWNoIHdpbGwgYmUgaGFuZGxlZCBhcyBpbnB1dHMgd2l0aFxuICAgIC8vIGBCaW5kaW5nVHlwZS5BdHRyaWJ1dGVgLlxuICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlQXR0cmlidXRlT3AoXG4gICAgICAgIG9wLnhyZWYsIGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLkF0dHJpYnV0ZSwgYXR0ci5uYW1lLCBvLmxpdGVyYWwoYXR0ci52YWx1ZSkpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgaW5wdXQgb2YgZWxlbWVudC5pbnB1dHMpIHtcbiAgICBpbmdlc3RQcm9wZXJ0eUJpbmRpbmcodmlldywgb3AueHJlZiwgaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQmluZGluZywgaW5wdXQpO1xuICB9XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2YgZWxlbWVudC5vdXRwdXRzKSB7XG4gICAgY29uc3QgbGlzdGVuZXJPcCA9IGlyLmNyZWF0ZUxpc3RlbmVyT3Aob3AueHJlZiwgb3V0cHV0Lm5hbWUsIG9wLnRhZyk7XG4gICAgLy8gaWYgb3V0cHV0LmhhbmRsZXIgaXMgYSBjaGFpbiwgdGhlbiBwdXNoIGVhY2ggc3RhdGVtZW50IGZyb20gdGhlIGNoYWluIHNlcGFyYXRlbHksIGFuZFxuICAgIC8vIHJldHVybiB0aGUgbGFzdCBvbmU/XG4gICAgbGV0IGlucHV0RXhwcnM6IGUuQVNUW107XG4gICAgbGV0IGhhbmRsZXI6IGUuQVNUID0gb3V0cHV0LmhhbmRsZXI7XG4gICAgaWYgKGhhbmRsZXIgaW5zdGFuY2VvZiBlLkFTVFdpdGhTb3VyY2UpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmFzdDtcbiAgICB9XG5cbiAgICBpZiAoaGFuZGxlciBpbnN0YW5jZW9mIGUuQ2hhaW4pIHtcbiAgICAgIGlucHV0RXhwcnMgPSBoYW5kbGVyLmV4cHJlc3Npb25zO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnB1dEV4cHJzID0gW2hhbmRsZXJdO1xuICAgIH1cblxuICAgIGlmIChpbnB1dEV4cHJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBsaXN0ZW5lciB0byBoYXZlIG5vbi1lbXB0eSBleHByZXNzaW9uIGxpc3QuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBpbnB1dEV4cHJzLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdmlldy50cGwpKTtcbiAgICBjb25zdCByZXR1cm5FeHByID0gZXhwcmVzc2lvbnMucG9wKCkhO1xuXG4gICAgZm9yIChjb25zdCBleHByIG9mIGV4cHJlc3Npb25zKSB7XG4gICAgICBjb25zdCBzdG10T3AgPSBpci5jcmVhdGVTdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4obmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByKSk7XG4gICAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChzdG10T3ApO1xuICAgIH1cbiAgICBsaXN0ZW5lck9wLmhhbmRsZXJPcHMucHVzaChpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmV0dXJuRXhwcikpKTtcbiAgICB2aWV3LmNyZWF0ZS5wdXNoKGxpc3RlbmVyT3ApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluZ2VzdFByb3BlcnR5QmluZGluZyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHhyZWY6IGlyLlhyZWZJZCxcbiAgICBiaW5kaW5nS2luZDogaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQmluZGluZ3xpci5FbGVtZW50QXR0cmlidXRlS2luZC5UZW1wbGF0ZSxcbiAgICB7bmFtZSwgdmFsdWUsIHR5cGUsIHVuaXR9OiB0LkJvdW5kQXR0cmlidXRlKTogdm9pZCB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIGUuQVNUV2l0aFNvdXJjZSkge1xuICAgIHZhbHVlID0gdmFsdWUuYXN0O1xuICB9XG5cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgZS5JbnRlcnBvbGF0aW9uKSB7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIGUuQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICAgIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBzdHlsZSBiaW5kaW5nIG9uIG5nLXRlbXBsYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVTdHlsZU1hcE9wKFxuICAgICAgICAgICAgICB4cmVmLCB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHZpZXcudHBsKSkpKTtcbiAgICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBjbGFzcyBiaW5kaW5nIG9uIG5nLXRlbXBsYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlSW50ZXJwb2xhdGVDbGFzc01hcE9wKFxuICAgICAgICAgICAgICB4cmVmLCB2YWx1ZS5zdHJpbmdzLCB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHZpZXcudHBsKSkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2aWV3LnVwZGF0ZS5wdXNoKGlyLmNyZWF0ZUludGVycG9sYXRlUHJvcGVydHlPcChcbiAgICAgICAgICAgICAgeHJlZiwgYmluZGluZ0tpbmQsIG5hbWUsIHZhbHVlLnN0cmluZ3MsXG4gICAgICAgICAgICAgIHZhbHVlLmV4cHJlc3Npb25zLm1hcChleHByID0+IGNvbnZlcnRBc3QoZXhwciwgdmlldy50cGwpKSkpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICBpZiAoYmluZGluZ0tpbmQgIT09IGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLkJpbmRpbmcpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBzdHlsZSBiaW5kaW5nIG9uIG5nLXRlbXBsYXRlJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmlldy51cGRhdGUucHVzaChpci5jcmVhdGVJbnRlcnBvbGF0ZVN0eWxlUHJvcE9wKFxuICAgICAgICAgICAgeHJlZiwgbmFtZSwgdmFsdWUuc3RyaW5ncywgdmFsdWUuZXhwcmVzc2lvbnMubWFwKGV4cHIgPT4gY29udmVydEFzdChleHByLCB2aWV3LnRwbCkpLFxuICAgICAgICAgICAgdW5pdCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5BdHRyaWJ1dGU6XG4gICAgICAgIGlmIChiaW5kaW5nS2luZCAhPT0gaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQmluZGluZykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQXR0cmlidXRlIGJpbmRpbmdzIG9uIHRlbXBsYXRlcyBhcmUgbm90IGV4cGVjdGVkIHRvIGJlIHZhbGlkJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXR0cmlidXRlSW50ZXJwb2xhdGUgPSBpci5jcmVhdGVJbnRlcnBvbGF0ZUF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgeHJlZiwgYmluZGluZ0tpbmQsIG5hbWUsIHZhbHVlLnN0cmluZ3MsXG4gICAgICAgICAgICB2YWx1ZS5leHByZXNzaW9ucy5tYXAoZXhwciA9PiBjb252ZXJ0QXN0KGV4cHIsIHZpZXcudHBsKSkpO1xuICAgICAgICB2aWV3LnVwZGF0ZS5wdXNoKGF0dHJpYnV0ZUludGVycG9sYXRlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGUuQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgIHRocm93IEVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24gaW4gY2xhc3MgcHJvcGVydHkgYmluZGluZycpO1xuICAgICAgLy8gVE9ETzogaW1wbGVtZW50IHJlbWFpbmluZyBiaW5kaW5nIHR5cGVzLlxuICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLkFuaW1hdGlvbjpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKGBJbnRlcnBvbGF0ZWQgcHJvcGVydHkgYmluZGluZyB0eXBlIG5vdCBoYW5kbGVkOiAke3R5cGV9YCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICAvLyBCaW5kaW5ncyB0byBbc3R5bGVdIGFyZSBtYXBwZWQgdG8gdGhlaXIgb3duIHNwZWNpYWwgaW5zdHJ1Y3Rpb24uXG4gICAgICAgIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBzdHlsZSBiaW5kaW5nIG9uIG5nLXRlbXBsYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlU3R5bGVNYXBPcCh4cmVmLCBjb252ZXJ0QXN0KHZhbHVlLCB2aWV3LnRwbCkpKTtcbiAgICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignVW5leHBlY3RlZCBjbGFzcyBiaW5kaW5nIG9uIG5nLXRlbXBsYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlQ2xhc3NNYXBPcCh4cmVmLCBjb252ZXJ0QXN0KHZhbHVlLCB2aWV3LnRwbCkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2aWV3LnVwZGF0ZS5wdXNoKFxuICAgICAgICAgICAgICBpci5jcmVhdGVQcm9wZXJ0eU9wKHhyZWYsIGJpbmRpbmdLaW5kLCBuYW1lLCBjb252ZXJ0QXN0KHZhbHVlLCB2aWV3LnRwbCkpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5TdHlsZTpcbiAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgc3R5bGUgYmluZGluZyBvbiBuZy10ZW1wbGF0ZScpO1xuICAgICAgICB9XG4gICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlU3R5bGVQcm9wT3AoeHJlZiwgbmFtZSwgY29udmVydEFzdCh2YWx1ZSwgdmlldy50cGwpLCB1bml0KSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLkF0dHJpYnV0ZTpcbiAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBdHRyaWJ1dGUgYmluZGluZ3Mgb24gdGVtcGxhdGVzIGFyZSBub3QgZXhwZWN0ZWQgdG8gYmUgdmFsaWQnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhdHRyT3AgPSBpci5jcmVhdGVBdHRyaWJ1dGVPcCh4cmVmLCBiaW5kaW5nS2luZCwgbmFtZSwgY29udmVydEFzdCh2YWx1ZSwgdmlldy50cGwpKTtcbiAgICAgICAgdmlldy51cGRhdGUucHVzaChhdHRyT3ApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZS5CaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgICAgaWYgKGJpbmRpbmdLaW5kICE9PSBpci5FbGVtZW50QXR0cmlidXRlS2luZC5CaW5kaW5nKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgY2xhc3MgYmluZGluZyBvbiBuZy10ZW1wbGF0ZScpO1xuICAgICAgICB9XG4gICAgICAgIHZpZXcudXBkYXRlLnB1c2goaXIuY3JlYXRlQ2xhc3NQcm9wT3AoeHJlZiwgbmFtZSwgY29udmVydEFzdCh2YWx1ZSwgdmlldy50cGwpKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gVE9ETzogaW1wbGVtZW50IHJlbWFpbmluZyBiaW5kaW5nIHR5cGVzLlxuICAgICAgY2FzZSBlLkJpbmRpbmdUeXBlLkFuaW1hdGlvbjpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKGBQcm9wZXJ0eSBiaW5kaW5nIHR5cGUgbm90IGhhbmRsZWQ6ICR7dHlwZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFsbCBvZiB0aGUgbG9jYWwgcmVmZXJlbmNlcyBvbiBhbiBlbGVtZW50LWxpa2Ugc3RydWN0dXJlIGluIHRoZSB0ZW1wbGF0ZSBBU1QgYW5kXG4gKiBjb252ZXJ0IHRoZW0gdG8gdGhlaXIgSVIgcmVwcmVzZW50YXRpb24uXG4gKi9cbmZ1bmN0aW9uIGluZ2VzdFJlZmVyZW5jZXMob3A6IGlyLkVsZW1lbnRPcEJhc2UsIGVsZW1lbnQ6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogdm9pZCB7XG4gIGFzc2VydElzQXJyYXk8aXIuTG9jYWxSZWY+KG9wLmxvY2FsUmVmcyk7XG4gIGZvciAoY29uc3Qge25hbWUsIHZhbHVlfSBvZiBlbGVtZW50LnJlZmVyZW5jZXMpIHtcbiAgICBvcC5sb2NhbFJlZnMucHVzaCh7XG4gICAgICBuYW1lLFxuICAgICAgdGFyZ2V0OiB2YWx1ZSxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSBnaXZlbiB2YWx1ZSBpcyBhbiBhcnJheS5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0SXNBcnJheTxUPih2YWx1ZTogYW55KTogYXNzZXJ0cyB2YWx1ZSBpcyBBcnJheTxUPiB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBhbiBhcnJheWApO1xuICB9XG59XG4iXX0=