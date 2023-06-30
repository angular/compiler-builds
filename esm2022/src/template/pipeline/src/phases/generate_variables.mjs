/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Generate a preamble sequence for each view creation block and listener function which declares
 * any variables that be referenced in other operations in the block.
 *
 * Variables generated include:
 *   * a saved view context to be used to restore the current view in event listeners.
 *   * the context of the restored view within event listener handlers.
 *   * context variables from the current view as well as all parent views (including the root
 *     context if needed).
 *   * local references from elements within the current view and any lexical parents.
 *
 * Variables are generated here unconditionally, and may optimized away in future operations if it
 * turns out their values (and any side effects) are unused.
 */
export function phaseGenerateVariables(cpl) {
    recursivelyProcessView(cpl.root, /* there is no parent scope for the root view */ null);
}
/**
 * Process the given `ViewCompilation` and generate preambles for it and any listeners that it
 * declares.
 *
 * @param `parentScope` a scope extracted from the parent view which captures any variables which
 *     should be inherited by this view. `null` if the current view is the root view.
 */
function recursivelyProcessView(view, parentScope) {
    // Extract a `Scope` from this view.
    const scope = getScopeForView(view, parentScope);
    for (const op of view.create) {
        switch (op.kind) {
            case ir.OpKind.Template:
                // Descend into child embedded views.
                recursivelyProcessView(view.tpl.views.get(op.xref), scope);
                break;
            case ir.OpKind.Listener:
                // Prepend variables to listener handler functions.
                op.handlerOps.prepend(generateVariablesInScopeForView(view, scope));
                break;
        }
    }
    // Prepend the declarations for all available variables in scope to the `update` block.
    const preambleOps = generateVariablesInScopeForView(view, scope);
    view.update.prepend(preambleOps);
}
/**
 * Process a view and generate a `Scope` representing the variables available for reference within
 * that view.
 */
function getScopeForView(view, parent) {
    const scope = {
        view: view.xref,
        viewContextVariable: {
            kind: ir.SemanticVariableKind.Context,
            name: null,
            view: view.xref,
        },
        contextVariables: new Map(),
        references: [],
        parent,
    };
    for (const identifier of view.contextVariables.keys()) {
        scope.contextVariables.set(identifier, {
            kind: ir.SemanticVariableKind.Identifier,
            name: null,
            identifier,
        });
    }
    for (const op of view.create) {
        switch (op.kind) {
            case ir.OpKind.Element:
            case ir.OpKind.ElementStart:
            case ir.OpKind.Template:
                if (!Array.isArray(op.localRefs)) {
                    throw new Error(`AssertionError: expected localRefs to be an array`);
                }
                // Record available local references from this element.
                for (let offset = 0; offset < op.localRefs.length; offset++) {
                    scope.references.push({
                        name: op.localRefs[offset].name,
                        targetId: op.xref,
                        offset,
                        variable: {
                            kind: ir.SemanticVariableKind.Identifier,
                            name: null,
                            identifier: op.localRefs[offset].name,
                        },
                    });
                }
                break;
        }
    }
    return scope;
}
/**
 * Generate declarations for all variables that are in scope for a given view.
 *
 * This is a recursive process, as views inherit variables available from their parent view, which
 * itself may have inherited variables, etc.
 */
function generateVariablesInScopeForView(view, scope) {
    const newOps = [];
    if (scope.view !== view.xref) {
        // Before generating variables for a parent view, we need to switch to the context of the parent
        // view with a `nextContext` expression. This context switching operation itself declares a
        // variable, because the context of the view may be referenced directly.
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), scope.viewContextVariable, new ir.NextContextExpr()));
    }
    // Add variables for all context variables available in this scope's view.
    for (const [name, value] of view.tpl.views.get(scope.view).contextVariables) {
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), scope.contextVariables.get(name), new o.ReadPropExpr(new ir.ContextExpr(scope.view), value)));
    }
    // Add variables for all local references declared for elements in this scope.
    for (const ref of scope.references) {
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), ref.variable, new ir.ReferenceExpr(ref.targetId, ref.offset)));
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUF5QjtJQUM5RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXFCLEVBQUUsV0FBdUI7SUFDNUUsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixxQ0FBcUM7Z0JBQ3JDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzVELE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsbURBQW1EO2dCQUNuRCxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENB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Q0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFFLENBQUMsZ0JBQWdCLEVBQUU7UUFDNUUsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsS0FBSyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUUsRUFDNUQsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pFO0lBRUQsOEVBQThFO0lBQzlFLEtBQUssTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtRQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDL0Y7SUFFRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3pCLG1EQUFtRDtRQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsK0JBQStCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3JFO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uLCBWaWV3Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBhIHByZWFtYmxlIHNlcXVlbmNlIGZvciBlYWNoIHZpZXcgY3JlYXRpb24gYmxvY2sgYW5kIGxpc3RlbmVyIGZ1bmN0aW9uIHdoaWNoIGRlY2xhcmVzXG4gKiBhbnkgdmFyaWFibGVzIHRoYXQgYmUgcmVmZXJlbmNlZCBpbiBvdGhlciBvcGVyYXRpb25zIGluIHRoZSBibG9jay5cbiAqXG4gKiBWYXJpYWJsZXMgZ2VuZXJhdGVkIGluY2x1ZGU6XG4gKiAgICogYSBzYXZlZCB2aWV3IGNvbnRleHQgdG8gYmUgdXNlZCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gZXZlbnQgbGlzdGVuZXJzLlxuICogICAqIHRoZSBjb250ZXh0IG9mIHRoZSByZXN0b3JlZCB2aWV3IHdpdGhpbiBldmVudCBsaXN0ZW5lciBoYW5kbGVycy5cbiAqICAgKiBjb250ZXh0IHZhcmlhYmxlcyBmcm9tIHRoZSBjdXJyZW50IHZpZXcgYXMgd2VsbCBhcyBhbGwgcGFyZW50IHZpZXdzIChpbmNsdWRpbmcgdGhlIHJvb3RcbiAqICAgICBjb250ZXh0IGlmIG5lZWRlZCkuXG4gKiAgICogbG9jYWwgcmVmZXJlbmNlcyBmcm9tIGVsZW1lbnRzIHdpdGhpbiB0aGUgY3VycmVudCB2aWV3IGFuZCBhbnkgbGV4aWNhbCBwYXJlbnRzLlxuICpcbiAqIFZhcmlhYmxlcyBhcmUgZ2VuZXJhdGVkIGhlcmUgdW5jb25kaXRpb25hbGx5LCBhbmQgbWF5IG9wdGltaXplZCBhd2F5IGluIGZ1dHVyZSBvcGVyYXRpb25zIGlmIGl0XG4gKiB0dXJucyBvdXQgdGhlaXIgdmFsdWVzIChhbmQgYW55IHNpZGUgZWZmZWN0cykgYXJlIHVudXNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlR2VuZXJhdGVWYXJpYWJsZXMoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KGNwbC5yb290LCAvKiB0aGVyZSBpcyBubyBwYXJlbnQgc2NvcGUgZm9yIHRoZSByb290IHZpZXcgKi8gbnVsbCk7XG59XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAgYW5kIGdlbmVyYXRlIHByZWFtYmxlcyBmb3IgaXQgYW5kIGFueSBsaXN0ZW5lcnMgdGhhdCBpdFxuICogZGVjbGFyZXMuXG4gKlxuICogQHBhcmFtIGBwYXJlbnRTY29wZWAgYSBzY29wZSBleHRyYWN0ZWQgZnJvbSB0aGUgcGFyZW50IHZpZXcgd2hpY2ggY2FwdHVyZXMgYW55IHZhcmlhYmxlcyB3aGljaFxuICogICAgIHNob3VsZCBiZSBpbmhlcml0ZWQgYnkgdGhpcyB2aWV3LiBgbnVsbGAgaWYgdGhlIGN1cnJlbnQgdmlldyBpcyB0aGUgcm9vdCB2aWV3LlxuICovXG5mdW5jdGlvbiByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXc6IFZpZXdDb21waWxhdGlvbiwgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwpOiB2b2lkIHtcbiAgLy8gRXh0cmFjdCBhIGBTY29wZWAgZnJvbSB0aGlzIHZpZXcuXG4gIGNvbnN0IHNjb3BlID0gZ2V0U2NvcGVGb3JWaWV3KHZpZXcsIHBhcmVudFNjb3BlKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIGNoaWxkIGVtYmVkZGVkIHZpZXdzLlxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXcudHBsLnZpZXdzLmdldChvcC54cmVmKSEsIHNjb3BlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgLy8gUHJlcGVuZCB2YXJpYWJsZXMgdG8gbGlzdGVuZXIgaGFuZGxlciBmdW5jdGlvbnMuXG4gICAgICAgIG9wLmhhbmRsZXJPcHMucHJlcGVuZChnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlKSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByZXBlbmQgdGhlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIGF2YWlsYWJsZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gdGhlIGB1cGRhdGVgIGJsb2NrLlxuICBjb25zdCBwcmVhbWJsZU9wcyA9IGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpO1xuICB2aWV3LnVwZGF0ZS5wcmVwZW5kKHByZWFtYmxlT3BzKTtcbn1cblxuLyoqXG4gKiBMZXhpY2FsIHNjb3BlIG9mIGEgdmlldywgaW5jbHVkaW5nIGEgcmVmZXJlbmNlIHRvIGl0cyBwYXJlbnQgdmlldydzIHNjb3BlLCBpZiBhbnkuXG4gKi9cbmludGVyZmFjZSBTY29wZSB7XG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgdmlldyB0byB3aGljaCB0aGlzIHNjb3BlIGNvcnJlc3BvbmRzLlxuICAgKi9cbiAgdmlldzogaXIuWHJlZklkO1xuXG4gIHZpZXdDb250ZXh0VmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGU7XG5cbiAgY29udGV4dFZhcmlhYmxlczogTWFwPHN0cmluZywgaXIuU2VtYW50aWNWYXJpYWJsZT47XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgY29sbGVjdGVkIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSB2aWV3LlxuICAgKi9cbiAgcmVmZXJlbmNlczogUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIGBTY29wZWAgb2YgdGhlIHBhcmVudCB2aWV3LCBpZiBhbnkuXG4gICAqL1xuICBwYXJlbnQ6IFNjb3BlfG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIGFib3V0IGEgbG9jYWwgcmVmZXJlbmNlIGNvbGxlY3RlZCBmcm9tIGFuIGVsZW1lbnQgd2l0aGluIGEgdmlldy5cbiAqL1xuaW50ZXJmYWNlIFJlZmVyZW5jZSB7XG4gIC8qKlxuICAgKiBOYW1lIGdpdmVuIHRvIHRoZSBsb2NhbCByZWZlcmVuY2UgdmFyaWFibGUgd2l0aGluIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBpcyBub3QgdGhlIG5hbWUgd2hpY2ggd2lsbCBiZSB1c2VkIGZvciB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gaW4gdGhlIGdlbmVyYXRlZFxuICAgKiB0ZW1wbGF0ZSBjb2RlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudC1saWtlIG5vZGUgd2hpY2ggdGhpcyByZWZlcmVuY2UgdGFyZ2V0cy5cbiAgICpcbiAgICogVGhlIHJlZmVyZW5jZSBtYXkgYmUgZWl0aGVyIHRvIHRoZSBlbGVtZW50IChvciB0ZW1wbGF0ZSkgaXRzZWxmLCBvciB0byBhIGRpcmVjdGl2ZSBvbiBpdC5cbiAgICovXG4gIHRhcmdldElkOiBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEEgZ2VuZXJhdGVkIG9mZnNldCBvZiB0aGlzIHJlZmVyZW5jZSBhbW9uZyBhbGwgdGhlIHJlZmVyZW5jZXMgb24gYSBzcGVjaWZpYyBlbGVtZW50LlxuICAgKi9cbiAgb2Zmc2V0OiBudW1iZXI7XG5cbiAgdmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGU7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIHZpZXcgYW5kIGdlbmVyYXRlIGEgYFNjb3BlYCByZXByZXNlbnRpbmcgdGhlIHZhcmlhYmxlcyBhdmFpbGFibGUgZm9yIHJlZmVyZW5jZSB3aXRoaW5cbiAqIHRoYXQgdmlldy5cbiAqL1xuZnVuY3Rpb24gZ2V0U2NvcGVGb3JWaWV3KHZpZXc6IFZpZXdDb21waWxhdGlvbiwgcGFyZW50OiBTY29wZXxudWxsKTogU2NvcGUge1xuICBjb25zdCBzY29wZTogU2NvcGUgPSB7XG4gICAgdmlldzogdmlldy54cmVmLFxuICAgIHZpZXdDb250ZXh0VmFyaWFibGU6IHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgcmVmZXJlbmNlczogW10sXG4gICAgcGFyZW50LFxuICB9O1xuXG4gIGZvciAoY29uc3QgaWRlbnRpZmllciBvZiB2aWV3LmNvbnRleHRWYXJpYWJsZXMua2V5cygpKSB7XG4gICAgc2NvcGUuY29udGV4dFZhcmlhYmxlcy5zZXQoaWRlbnRpZmllciwge1xuICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcixcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICBpZGVudGlmaWVyLFxuICAgIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICB2YXJpYWJsZToge1xuICAgICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgICBpZGVudGlmaWVyOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2NvcGU7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgZGVjbGFyYXRpb25zIGZvciBhbGwgdmFyaWFibGVzIHRoYXQgYXJlIGluIHNjb3BlIGZvciBhIGdpdmVuIHZpZXcuXG4gKlxuICogVGhpcyBpcyBhIHJlY3Vyc2l2ZSBwcm9jZXNzLCBhcyB2aWV3cyBpbmhlcml0IHZhcmlhYmxlcyBhdmFpbGFibGUgZnJvbSB0aGVpciBwYXJlbnQgdmlldywgd2hpY2hcbiAqIGl0c2VsZiBtYXkgaGF2ZSBpbmhlcml0ZWQgdmFyaWFibGVzLCBldGMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBzY29wZTogU2NvcGUpOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdIHtcbiAgY29uc3QgbmV3T3BzOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdID0gW107XG5cbiAgaWYgKHNjb3BlLnZpZXcgIT09IHZpZXcueHJlZikge1xuICAgIC8vIEJlZm9yZSBnZW5lcmF0aW5nIHZhcmlhYmxlcyBmb3IgYSBwYXJlbnQgdmlldywgd2UgbmVlZCB0byBzd2l0Y2ggdG8gdGhlIGNvbnRleHQgb2YgdGhlIHBhcmVudFxuICAgIC8vIHZpZXcgd2l0aCBhIGBuZXh0Q29udGV4dGAgZXhwcmVzc2lvbi4gVGhpcyBjb250ZXh0IHN3aXRjaGluZyBvcGVyYXRpb24gaXRzZWxmIGRlY2xhcmVzIGFcbiAgICAvLyB2YXJpYWJsZSwgYmVjYXVzZSB0aGUgY29udGV4dCBvZiB0aGUgdmlldyBtYXkgYmUgcmVmZXJlbmNlZCBkaXJlY3RseS5cbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS52aWV3Q29udGV4dFZhcmlhYmxlLCBuZXcgaXIuTmV4dENvbnRleHRFeHByKCkpKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBjb250ZXh0IHZhcmlhYmxlcyBhdmFpbGFibGUgaW4gdGhpcyBzY29wZSdzIHZpZXcuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiB2aWV3LnRwbC52aWV3cy5nZXQoc2NvcGUudmlldykhLmNvbnRleHRWYXJpYWJsZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS5jb250ZXh0VmFyaWFibGVzLmdldChuYW1lKSEsXG4gICAgICAgIG5ldyBvLlJlYWRQcm9wRXhwcihuZXcgaXIuQ29udGV4dEV4cHIoc2NvcGUudmlldyksIHZhbHVlKSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGxvY2FsIHJlZmVyZW5jZXMgZGVjbGFyZWQgZm9yIGVsZW1lbnRzIGluIHRoaXMgc2NvcGUuXG4gIGZvciAoY29uc3QgcmVmIG9mIHNjb3BlLnJlZmVyZW5jZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCByZWYudmFyaWFibGUsIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLm9mZnNldCkpKTtcbiAgfVxuXG4gIGlmIChzY29wZS5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAvLyBSZWN1cnNpdmVseSBhZGQgdmFyaWFibGVzIGZyb20gdGhlIHBhcmVudCBzY29wZS5cbiAgICBuZXdPcHMucHVzaCguLi5nZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlLnBhcmVudCkpO1xuICB9XG4gIHJldHVybiBuZXdPcHM7XG59XG4iXX0=