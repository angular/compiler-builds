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
    // Start the view creation block with an operation to save the current view context. This may be
    // used to restore the view context in any listeners that may be present.
    view.create.prepend([
        ir.createVariableOp(view.tpl.allocateXrefId(), scope.savedViewVariable, new ir.GetCurrentViewExpr()),
    ]);
    for (const op of view.create) {
        switch (op.kind) {
            case ir.OpKind.Template:
                // Descend into child embedded views.
                recursivelyProcessView(view.tpl.views.get(op.xref), scope);
                break;
            case ir.OpKind.Listener:
                // Listeners get a preamble which starts with a call to restore the view.
                const preambleOps = [
                    ir.createVariableOp(view.tpl.allocateXrefId(), scope.viewContextVariable, new ir.RestoreViewExpr(view.xref)),
                    // And includes all variables available to this view.
                    ...generateVariablesInScopeForView(view, scope)
                ];
                op.handlerOps.prepend(preambleOps);
                // The "restore view" operation in listeners requires a call to `resetView` to reset the
                // context prior to returning from the listener operation. Find any `return` statements in
                // the listener body and wrap them in a call to reset the view.
                for (const handlerOp of op.handlerOps) {
                    if (handlerOp.kind === ir.OpKind.Statement &&
                        handlerOp.statement instanceof o.ReturnStatement) {
                        handlerOp.statement.value = new ir.ResetViewExpr(handlerOp.statement.value);
                    }
                }
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
        savedViewVariable: {
            kind: ir.SemanticVariableKind.SavedView,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUF5QjtJQUM5RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXFCLEVBQUUsV0FBdUI7SUFDNUUsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsZ0dBQWdHO0lBQ2hHLHlFQUF5RTtJQUN6RSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUNsQixFQUFFLENBQUMsZ0JBQWdCLENBQ2YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxLQUFLLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztLQUNyRixDQUFDLENBQUM7SUFFSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLHFDQUFxQztnQkFDckMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDNUQsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQix5RUFBeUU7Z0JBQ3pFLE1BQU0sV0FBVyxHQUFHO29CQUNsQixFQUFFLENBQUMsZ0JBQWdCLENBQ2YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxLQUFLLENBQUMsbUJBQW1CLEVBQ3BELElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3RDLHFEQUFxRDtvQkFDckQsR0FBRywrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO2lCQUNoRCxDQUFDO2dCQUVGLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUVuQyx3RkFBd0Y7Z0JBQ3hGLDBGQUEwRjtnQkFDMUYsK0RBQStEO2dCQUMvRCxLQUFLLE1BQU0sU0FBUyxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUU7b0JBQ3JDLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7d0JBQ3RDLFNBQVMsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLGVBQWUsRUFBRTt3QkFDcEQsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQzdFO2lCQUNGO2dCQUNELE1BQU07U0FDVDtLQUNGO0lBRUQsdUZBQXVGO0lBQ3ZGLE1BQU0sV0FBVyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBdUREOzs7R0FHRztBQUNILFNBQVMsZUFBZSxDQUFDLElBQXFCLEVBQUUsTUFBa0I7SUFDaEUsTUFBTSxLQUFLLEdBQVU7UUFDbkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsbUJBQW1CLEVBQUU7WUFDbkIsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPO1lBQ3JDLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCO1FBQ0QsaUJBQWlCLEVBQUU7WUFDakIsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTO1lBQ3ZDLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCO1FBQ0QsZ0JBQWdCLEVBQUUsSUFBSSxHQUFHLEVBQStCO1FBQ3hELFVBQVUsRUFBRSxFQUFFO1FBQ2QsTUFBTTtLQUNQLENBQUM7SUFFRixLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNyRCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRTtZQUNyQyxJQUFJLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLFVBQVU7WUFDeEMsSUFBSSxFQUFFLElBQUk7WUFDVixVQUFVO1NBQ1gsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztZQUN2QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO1lBQzVCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztpQkFDdEU7Z0JBRUQsdURBQXVEO2dCQUN2RCxLQUFLLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUU7b0JBQzNELEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO3dCQUNwQixJQUFJLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJO3dCQUMvQixRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUk7d0JBQ2pCLE1BQU07d0JBQ04sUUFBUSxFQUFFOzRCQUNSLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsVUFBVTs0QkFDeEMsSUFBSSxFQUFFLElBQUk7NEJBQ1YsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSTt5QkFDdEM7cUJBQ0YsQ0FBQyxDQUFDO2lCQUNKO2dCQUNELE1BQU07U0FDVDtLQUNGO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLCtCQUErQixDQUNwQyxJQUFxQixFQUFFLEtBQVk7SUFDckMsTUFBTSxNQUFNLEdBQWlDLEVBQUUsQ0FBQztJQUVoRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRTtRQUM1QixnR0FBZ0c7UUFDaEcsMkZBQTJGO1FBQzNGLHdFQUF3RTtRQUN4RSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxLQUFLLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RGO0lBRUQsMEVBQTBFO0lBQzFFLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBRSxDQUFDLGdCQUFnQixFQUFFO1FBQzVFLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxFQUFFLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLEVBQzVELElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNqRTtJQUVELDhFQUE4RTtJQUM5RSxLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7UUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQy9GO0lBRUQsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN6QixtREFBbUQ7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNyRTtJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwcmVhbWJsZSBzZXF1ZW5jZSBmb3IgZWFjaCB2aWV3IGNyZWF0aW9uIGJsb2NrIGFuZCBsaXN0ZW5lciBmdW5jdGlvbiB3aGljaCBkZWNsYXJlc1xuICogYW55IHZhcmlhYmxlcyB0aGF0IGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgb3BlcmF0aW9ucyBpbiB0aGUgYmxvY2suXG4gKlxuICogVmFyaWFibGVzIGdlbmVyYXRlZCBpbmNsdWRlOlxuICogICAqIGEgc2F2ZWQgdmlldyBjb250ZXh0IHRvIGJlIHVzZWQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGV2ZW50IGxpc3RlbmVycy5cbiAqICAgKiB0aGUgY29udGV4dCBvZiB0aGUgcmVzdG9yZWQgdmlldyB3aXRoaW4gZXZlbnQgbGlzdGVuZXIgaGFuZGxlcnMuXG4gKiAgICogY29udGV4dCB2YXJpYWJsZXMgZnJvbSB0aGUgY3VycmVudCB2aWV3IGFzIHdlbGwgYXMgYWxsIHBhcmVudCB2aWV3cyAoaW5jbHVkaW5nIHRoZSByb290XG4gKiAgICAgY29udGV4dCBpZiBuZWVkZWQpLlxuICogICAqIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldyBhbmQgYW55IGxleGljYWwgcGFyZW50cy5cbiAqXG4gKiBWYXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBoZXJlIHVuY29uZGl0aW9uYWxseSwgYW5kIG1heSBvcHRpbWl6ZWQgYXdheSBpbiBmdXR1cmUgb3BlcmF0aW9ucyBpZiBpdFxuICogdHVybnMgb3V0IHRoZWlyIHZhbHVlcyAoYW5kIGFueSBzaWRlIGVmZmVjdHMpIGFyZSB1bnVzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUdlbmVyYXRlVmFyaWFibGVzKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyhjcGwucm9vdCwgLyogdGhlcmUgaXMgbm8gcGFyZW50IHNjb3BlIGZvciB0aGUgcm9vdCB2aWV3ICovIG51bGwpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gIGFuZCBnZW5lcmF0ZSBwcmVhbWJsZXMgZm9yIGl0IGFuZCBhbnkgbGlzdGVuZXJzIHRoYXQgaXRcbiAqIGRlY2xhcmVzLlxuICpcbiAqIEBwYXJhbSBgcGFyZW50U2NvcGVgIGEgc2NvcGUgZXh0cmFjdGVkIGZyb20gdGhlIHBhcmVudCB2aWV3IHdoaWNoIGNhcHR1cmVzIGFueSB2YXJpYWJsZXMgd2hpY2hcbiAqICAgICBzaG91bGQgYmUgaW5oZXJpdGVkIGJ5IHRoaXMgdmlldy4gYG51bGxgIGlmIHRoZSBjdXJyZW50IHZpZXcgaXMgdGhlIHJvb3Qgdmlldy5cbiAqL1xuZnVuY3Rpb24gcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHBhcmVudFNjb3BlOiBTY29wZXxudWxsKTogdm9pZCB7XG4gIC8vIEV4dHJhY3QgYSBgU2NvcGVgIGZyb20gdGhpcyB2aWV3LlxuICBjb25zdCBzY29wZSA9IGdldFNjb3BlRm9yVmlldyh2aWV3LCBwYXJlbnRTY29wZSk7XG5cbiAgLy8gU3RhcnQgdGhlIHZpZXcgY3JlYXRpb24gYmxvY2sgd2l0aCBhbiBvcGVyYXRpb24gdG8gc2F2ZSB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuIFRoaXMgbWF5IGJlXG4gIC8vIHVzZWQgdG8gcmVzdG9yZSB0aGUgdmlldyBjb250ZXh0IGluIGFueSBsaXN0ZW5lcnMgdGhhdCBtYXkgYmUgcHJlc2VudC5cbiAgdmlldy5jcmVhdGUucHJlcGVuZChbXG4gICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5DcmVhdGVPcD4oXG4gICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLnNhdmVkVmlld1ZhcmlhYmxlLCBuZXcgaXIuR2V0Q3VycmVudFZpZXdFeHByKCkpLFxuICBdKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIGNoaWxkIGVtYmVkZGVkIHZpZXdzLlxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXcudHBsLnZpZXdzLmdldChvcC54cmVmKSEsIHNjb3BlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgLy8gTGlzdGVuZXJzIGdldCBhIHByZWFtYmxlIHdoaWNoIHN0YXJ0cyB3aXRoIGEgY2FsbCB0byByZXN0b3JlIHRoZSB2aWV3LlxuICAgICAgICBjb25zdCBwcmVhbWJsZU9wcyA9IFtcbiAgICAgICAgICBpci5jcmVhdGVWYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPihcbiAgICAgICAgICAgICAgdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwgc2NvcGUudmlld0NvbnRleHRWYXJpYWJsZSxcbiAgICAgICAgICAgICAgbmV3IGlyLlJlc3RvcmVWaWV3RXhwcih2aWV3LnhyZWYpKSxcbiAgICAgICAgICAvLyBBbmQgaW5jbHVkZXMgYWxsIHZhcmlhYmxlcyBhdmFpbGFibGUgdG8gdGhpcyB2aWV3LlxuICAgICAgICAgIC4uLmdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpXG4gICAgICAgIF07XG5cbiAgICAgICAgb3AuaGFuZGxlck9wcy5wcmVwZW5kKHByZWFtYmxlT3BzKTtcblxuICAgICAgICAvLyBUaGUgXCJyZXN0b3JlIHZpZXdcIiBvcGVyYXRpb24gaW4gbGlzdGVuZXJzIHJlcXVpcmVzIGEgY2FsbCB0byBgcmVzZXRWaWV3YCB0byByZXNldCB0aGVcbiAgICAgICAgLy8gY29udGV4dCBwcmlvciB0byByZXR1cm5pbmcgZnJvbSB0aGUgbGlzdGVuZXIgb3BlcmF0aW9uLiBGaW5kIGFueSBgcmV0dXJuYCBzdGF0ZW1lbnRzIGluXG4gICAgICAgIC8vIHRoZSBsaXN0ZW5lciBib2R5IGFuZCB3cmFwIHRoZW0gaW4gYSBjYWxsIHRvIHJlc2V0IHRoZSB2aWV3LlxuICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgICAgaWYgKGhhbmRsZXJPcC5raW5kID09PSBpci5PcEtpbmQuU3RhdGVtZW50ICYmXG4gICAgICAgICAgICAgIGhhbmRsZXJPcC5zdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLlJldHVyblN0YXRlbWVudCkge1xuICAgICAgICAgICAgaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSA9IG5ldyBpci5SZXNldFZpZXdFeHByKGhhbmRsZXJPcC5zdGF0ZW1lbnQudmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBQcmVwZW5kIHRoZSBkZWNsYXJhdGlvbnMgZm9yIGFsbCBhdmFpbGFibGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIHRoZSBgdXBkYXRlYCBibG9jay5cbiAgY29uc3QgcHJlYW1ibGVPcHMgPSBnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlKTtcbiAgdmlldy51cGRhdGUucHJlcGVuZChwcmVhbWJsZU9wcyk7XG59XG5cbi8qKlxuICogTGV4aWNhbCBzY29wZSBvZiBhIHZpZXcsIGluY2x1ZGluZyBhIHJlZmVyZW5jZSB0byBpdHMgcGFyZW50IHZpZXcncyBzY29wZSwgaWYgYW55LlxuICovXG5pbnRlcmZhY2UgU2NvcGUge1xuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIHZpZXcgdG8gd2hpY2ggdGhpcyBzY29wZSBjb3JyZXNwb25kcy5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICB2aWV3Q29udGV4dFZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlO1xuXG4gIHNhdmVkVmlld1ZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlO1xuXG4gIGNvbnRleHRWYXJpYWJsZXM6IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+O1xuXG4gIC8qKlxuICAgKiBMb2NhbCByZWZlcmVuY2VzIGNvbGxlY3RlZCBmcm9tIGVsZW1lbnRzIHdpdGhpbiB0aGUgdmlldy5cbiAgICovXG4gIHJlZmVyZW5jZXM6IFJlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBgU2NvcGVgIG9mIHRoZSBwYXJlbnQgdmlldywgaWYgYW55LlxuICAgKi9cbiAgcGFyZW50OiBTY29wZXxudWxsO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCBhYm91dCBhIGxvY2FsIHJlZmVyZW5jZSBjb2xsZWN0ZWQgZnJvbSBhbiBlbGVtZW50IHdpdGhpbiBhIHZpZXcuXG4gKi9cbmludGVyZmFjZSBSZWZlcmVuY2Uge1xuICAvKipcbiAgICogTmFtZSBnaXZlbiB0byB0aGUgbG9jYWwgcmVmZXJlbmNlIHZhcmlhYmxlIHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IHRoZSBuYW1lIHdoaWNoIHdpbGwgYmUgdXNlZCBmb3IgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGluIHRoZSBnZW5lcmF0ZWRcbiAgICogdGVtcGxhdGUgY29kZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIGVsZW1lbnQtbGlrZSBub2RlIHdoaWNoIHRoaXMgcmVmZXJlbmNlIHRhcmdldHMuXG4gICAqXG4gICAqIFRoZSByZWZlcmVuY2UgbWF5IGJlIGVpdGhlciB0byB0aGUgZWxlbWVudCAob3IgdGVtcGxhdGUpIGl0c2VsZiwgb3IgdG8gYSBkaXJlY3RpdmUgb24gaXQuXG4gICAqL1xuICB0YXJnZXRJZDogaXIuWHJlZklkO1xuXG4gIC8qKlxuICAgKiBBIGdlbmVyYXRlZCBvZmZzZXQgb2YgdGhpcyByZWZlcmVuY2UgYW1vbmcgYWxsIHRoZSByZWZlcmVuY2VzIG9uIGEgc3BlY2lmaWMgZWxlbWVudC5cbiAgICovXG4gIG9mZnNldDogbnVtYmVyO1xuXG4gIHZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSB2aWV3IGFuZCBnZW5lcmF0ZSBhIGBTY29wZWAgcmVwcmVzZW50aW5nIHRoZSB2YXJpYWJsZXMgYXZhaWxhYmxlIGZvciByZWZlcmVuY2Ugd2l0aGluXG4gKiB0aGF0IHZpZXcuXG4gKi9cbmZ1bmN0aW9uIGdldFNjb3BlRm9yVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHBhcmVudDogU2NvcGV8bnVsbCk6IFNjb3BlIHtcbiAgY29uc3Qgc2NvcGU6IFNjb3BlID0ge1xuICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICB2aWV3Q29udGV4dFZhcmlhYmxlOiB7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0LFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICB9LFxuICAgIHNhdmVkVmlld1ZhcmlhYmxlOiB7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5TYXZlZFZpZXcsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgcmVmZXJlbmNlczogW10sXG4gICAgcGFyZW50LFxuICB9O1xuXG4gIGZvciAoY29uc3QgaWRlbnRpZmllciBvZiB2aWV3LmNvbnRleHRWYXJpYWJsZXMua2V5cygpKSB7XG4gICAgc2NvcGUuY29udGV4dFZhcmlhYmxlcy5zZXQoaWRlbnRpZmllciwge1xuICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcixcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICBpZGVudGlmaWVyLFxuICAgIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICB2YXJpYWJsZToge1xuICAgICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgICBpZGVudGlmaWVyOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2NvcGU7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgZGVjbGFyYXRpb25zIGZvciBhbGwgdmFyaWFibGVzIHRoYXQgYXJlIGluIHNjb3BlIGZvciBhIGdpdmVuIHZpZXcuXG4gKlxuICogVGhpcyBpcyBhIHJlY3Vyc2l2ZSBwcm9jZXNzLCBhcyB2aWV3cyBpbmhlcml0IHZhcmlhYmxlcyBhdmFpbGFibGUgZnJvbSB0aGVpciBwYXJlbnQgdmlldywgd2hpY2hcbiAqIGl0c2VsZiBtYXkgaGF2ZSBpbmhlcml0ZWQgdmFyaWFibGVzLCBldGMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBzY29wZTogU2NvcGUpOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdIHtcbiAgY29uc3QgbmV3T3BzOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdID0gW107XG5cbiAgaWYgKHNjb3BlLnZpZXcgIT09IHZpZXcueHJlZikge1xuICAgIC8vIEJlZm9yZSBnZW5lcmF0aW5nIHZhcmlhYmxlcyBmb3IgYSBwYXJlbnQgdmlldywgd2UgbmVlZCB0byBzd2l0Y2ggdG8gdGhlIGNvbnRleHQgb2YgdGhlIHBhcmVudFxuICAgIC8vIHZpZXcgd2l0aCBhIGBuZXh0Q29udGV4dGAgZXhwcmVzc2lvbi4gVGhpcyBjb250ZXh0IHN3aXRjaGluZyBvcGVyYXRpb24gaXRzZWxmIGRlY2xhcmVzIGFcbiAgICAvLyB2YXJpYWJsZSwgYmVjYXVzZSB0aGUgY29udGV4dCBvZiB0aGUgdmlldyBtYXkgYmUgcmVmZXJlbmNlZCBkaXJlY3RseS5cbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS52aWV3Q29udGV4dFZhcmlhYmxlLCBuZXcgaXIuTmV4dENvbnRleHRFeHByKCkpKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBjb250ZXh0IHZhcmlhYmxlcyBhdmFpbGFibGUgaW4gdGhpcyBzY29wZSdzIHZpZXcuXG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiB2aWV3LnRwbC52aWV3cy5nZXQoc2NvcGUudmlldykhLmNvbnRleHRWYXJpYWJsZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS5jb250ZXh0VmFyaWFibGVzLmdldChuYW1lKSEsXG4gICAgICAgIG5ldyBvLlJlYWRQcm9wRXhwcihuZXcgaXIuQ29udGV4dEV4cHIoc2NvcGUudmlldyksIHZhbHVlKSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGxvY2FsIHJlZmVyZW5jZXMgZGVjbGFyZWQgZm9yIGVsZW1lbnRzIGluIHRoaXMgc2NvcGUuXG4gIGZvciAoY29uc3QgcmVmIG9mIHNjb3BlLnJlZmVyZW5jZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCByZWYudmFyaWFibGUsIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLm9mZnNldCkpKTtcbiAgfVxuXG4gIGlmIChzY29wZS5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAvLyBSZWN1cnNpdmVseSBhZGQgdmFyaWFibGVzIGZyb20gdGhlIHBhcmVudCBzY29wZS5cbiAgICBuZXdPcHMucHVzaCguLi5nZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlLnBhcmVudCkpO1xuICB9XG4gIHJldHVybiBuZXdPcHM7XG59XG4iXX0=