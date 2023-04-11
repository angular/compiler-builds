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
        ir.createVariableOp(view.tpl.allocateXrefId(), {
            kind: ir.SemanticVariableKind.SavedView,
            view: view.xref,
        }, new ir.GetCurrentViewExpr()),
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
                    ir.createVariableOp(view.tpl.allocateXrefId(), {
                        kind: ir.SemanticVariableKind.Context,
                        view: view.xref,
                    }, new ir.RestoreViewExpr(view.xref)),
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
        references: [],
        parent,
    };
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
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), {
            kind: ir.SemanticVariableKind.Context,
            view: scope.view,
        }, new ir.NextContextExpr()));
    }
    // Add variables for all context variables available in this scope's view.
    for (const [name, value] of view.tpl.views.get(scope.view).contextVariables) {
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), {
            kind: ir.SemanticVariableKind.Identifier,
            name,
        }, new o.ReadPropExpr(new ir.ContextExpr(view.xref), value)));
    }
    // Add variables for all local references declared for elements in this scope.
    for (const ref of scope.references) {
        newOps.push(ir.createVariableOp(view.tpl.allocateXrefId(), {
            kind: ir.SemanticVariableKind.Identifier,
            name: ref.name,
        }, new ir.ReferenceExpr(ref.targetId, ref.offset)));
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUF5QjtJQUM5RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXFCLEVBQUUsV0FBdUI7SUFDNUUsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsZ0dBQWdHO0lBQ2hHLHlFQUF5RTtJQUN6RSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUNsQixFQUFFLENBQUMsZ0JBQWdCLENBQ2YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRTtZQUN6QixJQUFJLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLFNBQVM7WUFDdkMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztLQUNqQyxDQUFDLENBQUM7SUFFSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFB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QUFvQixDQUFDLFVBQVU7WUFDeEMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO1NBQ2YsRUFDRCxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3REO0lBRUQsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN6QixtREFBbUQ7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNyRTtJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwcmVhbWJsZSBzZXF1ZW5jZSBmb3IgZWFjaCB2aWV3IGNyZWF0aW9uIGJsb2NrIGFuZCBsaXN0ZW5lciBmdW5jdGlvbiB3aGljaCBkZWNsYXJlc1xuICogYW55IHZhcmlhYmxlcyB0aGF0IGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgb3BlcmF0aW9ucyBpbiB0aGUgYmxvY2suXG4gKlxuICogVmFyaWFibGVzIGdlbmVyYXRlZCBpbmNsdWRlOlxuICogICAqIGEgc2F2ZWQgdmlldyBjb250ZXh0IHRvIGJlIHVzZWQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGV2ZW50IGxpc3RlbmVycy5cbiAqICAgKiB0aGUgY29udGV4dCBvZiB0aGUgcmVzdG9yZWQgdmlldyB3aXRoaW4gZXZlbnQgbGlzdGVuZXIgaGFuZGxlcnMuXG4gKiAgICogY29udGV4dCB2YXJpYWJsZXMgZnJvbSB0aGUgY3VycmVudCB2aWV3IGFzIHdlbGwgYXMgYWxsIHBhcmVudCB2aWV3cyAoaW5jbHVkaW5nIHRoZSByb290XG4gKiAgICAgY29udGV4dCBpZiBuZWVkZWQpLlxuICogICAqIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldyBhbmQgYW55IGxleGljYWwgcGFyZW50cy5cbiAqXG4gKiBWYXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBoZXJlIHVuY29uZGl0aW9uYWxseSwgYW5kIG1heSBvcHRpbWl6ZWQgYXdheSBpbiBmdXR1cmUgb3BlcmF0aW9ucyBpZiBpdFxuICogdHVybnMgb3V0IHRoZWlyIHZhbHVlcyAoYW5kIGFueSBzaWRlIGVmZmVjdHMpIGFyZSB1bnVzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUdlbmVyYXRlVmFyaWFibGVzKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyhjcGwucm9vdCwgLyogdGhlcmUgaXMgbm8gcGFyZW50IHNjb3BlIGZvciB0aGUgcm9vdCB2aWV3ICovIG51bGwpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gIGFuZCBnZW5lcmF0ZSBwcmVhbWJsZXMgZm9yIGl0IGFuZCBhbnkgbGlzdGVuZXJzIHRoYXQgaXRcbiAqIGRlY2xhcmVzLlxuICpcbiAqIEBwYXJhbSBgcGFyZW50U2NvcGVgIGEgc2NvcGUgZXh0cmFjdGVkIGZyb20gdGhlIHBhcmVudCB2aWV3IHdoaWNoIGNhcHR1cmVzIGFueSB2YXJpYWJsZXMgd2hpY2hcbiAqICAgICBzaG91bGQgYmUgaW5oZXJpdGVkIGJ5IHRoaXMgdmlldy4gYG51bGxgIGlmIHRoZSBjdXJyZW50IHZpZXcgaXMgdGhlIHJvb3Qgdmlldy5cbiAqL1xuZnVuY3Rpb24gcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHBhcmVudFNjb3BlOiBTY29wZXxudWxsKTogdm9pZCB7XG4gIC8vIEV4dHJhY3QgYSBgU2NvcGVgIGZyb20gdGhpcyB2aWV3LlxuICBjb25zdCBzY29wZSA9IGdldFNjb3BlRm9yVmlldyh2aWV3LCBwYXJlbnRTY29wZSk7XG5cbiAgLy8gU3RhcnQgdGhlIHZpZXcgY3JlYXRpb24gYmxvY2sgd2l0aCBhbiBvcGVyYXRpb24gdG8gc2F2ZSB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuIFRoaXMgbWF5IGJlXG4gIC8vIHVzZWQgdG8gcmVzdG9yZSB0aGUgdmlldyBjb250ZXh0IGluIGFueSBsaXN0ZW5lcnMgdGhhdCBtYXkgYmUgcHJlc2VudC5cbiAgdmlldy5jcmVhdGUucHJlcGVuZChbXG4gICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5DcmVhdGVPcD4oXG4gICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHtcbiAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5TYXZlZFZpZXcsXG4gICAgICAgICAgdmlldzogdmlldy54cmVmLFxuICAgICAgICB9LFxuICAgICAgICBuZXcgaXIuR2V0Q3VycmVudFZpZXdFeHByKCkpLFxuICBdKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIGNoaWxkIGVtYmVkZGVkIHZpZXdzLlxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXcudHBsLnZpZXdzLmdldChvcC54cmVmKSEsIHNjb3BlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgLy8gTGlzdGVuZXJzIGdldCBhIHByZWFtYmxlIHdoaWNoIHN0YXJ0cyB3aXRoIGEgY2FsbCB0byByZXN0b3JlIHRoZSB2aWV3LlxuICAgICAgICBjb25zdCBwcmVhbWJsZU9wcyA9IFtcbiAgICAgICAgICBpci5jcmVhdGVWYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPihcbiAgICAgICAgICAgICAgdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwge1xuICAgICAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICAgICAgICAgICAgdmlldzogdmlldy54cmVmLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBuZXcgaXIuUmVzdG9yZVZpZXdFeHByKHZpZXcueHJlZikpLFxuICAgICAgICAgIC8vIEFuZCBpbmNsdWRlcyBhbGwgdmFyaWFibGVzIGF2YWlsYWJsZSB0byB0aGlzIHZpZXcuXG4gICAgICAgICAgLi4uZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSlcbiAgICAgICAgXTtcblxuICAgICAgICBvcC5oYW5kbGVyT3BzLnByZXBlbmQocHJlYW1ibGVPcHMpO1xuXG4gICAgICAgIC8vIFRoZSBcInJlc3RvcmUgdmlld1wiIG9wZXJhdGlvbiBpbiBsaXN0ZW5lcnMgcmVxdWlyZXMgYSBjYWxsIHRvIGByZXNldFZpZXdgIHRvIHJlc2V0IHRoZVxuICAgICAgICAvLyBjb250ZXh0IHByaW9yIHRvIHJldHVybmluZyBmcm9tIHRoZSBsaXN0ZW5lciBvcGVyYXRpb24uIEZpbmQgYW55IGByZXR1cm5gIHN0YXRlbWVudHMgaW5cbiAgICAgICAgLy8gdGhlIGxpc3RlbmVyIGJvZHkgYW5kIHdyYXAgdGhlbSBpbiBhIGNhbGwgdG8gcmVzZXQgdGhlIHZpZXcuXG4gICAgICAgIGZvciAoY29uc3QgaGFuZGxlck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICAgICAgICBpZiAoaGFuZGxlck9wLmtpbmQgPT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgJiZcbiAgICAgICAgICAgICAgaGFuZGxlck9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgICAgICAgICBoYW5kbGVyT3Auc3RhdGVtZW50LnZhbHVlID0gbmV3IGlyLlJlc2V0Vmlld0V4cHIoaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByZXBlbmQgdGhlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIGF2YWlsYWJsZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gdGhlIGB1cGRhdGVgIGJsb2NrLlxuICBjb25zdCBwcmVhbWJsZU9wcyA9IGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpO1xuICB2aWV3LnVwZGF0ZS5wcmVwZW5kKHByZWFtYmxlT3BzKTtcbn1cblxuLyoqXG4gKiBMZXhpY2FsIHNjb3BlIG9mIGEgdmlldywgaW5jbHVkaW5nIGEgcmVmZXJlbmNlIHRvIGl0cyBwYXJlbnQgdmlldydzIHNjb3BlLCBpZiBhbnkuXG4gKi9cbmludGVyZmFjZSBTY29wZSB7XG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgdmlldyB0byB3aGljaCB0aGlzIHNjb3BlIGNvcnJlc3BvbmRzLlxuICAgKi9cbiAgdmlldzogaXIuWHJlZklkO1xuXG4gIC8qKlxuICAgKiBMb2NhbCByZWZlcmVuY2VzIGNvbGxlY3RlZCBmcm9tIGVsZW1lbnRzIHdpdGhpbiB0aGUgdmlldy5cbiAgICovXG4gIHJlZmVyZW5jZXM6IFJlZmVyZW5jZVtdO1xuXG4gIC8qKlxuICAgKiBgU2NvcGVgIG9mIHRoZSBwYXJlbnQgdmlldywgaWYgYW55LlxuICAgKi9cbiAgcGFyZW50OiBTY29wZXxudWxsO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCBhYm91dCBhIGxvY2FsIHJlZmVyZW5jZSBjb2xsZWN0ZWQgZnJvbSBhbiBlbGVtZW50IHdpdGhpbiBhIHZpZXcuXG4gKi9cbmludGVyZmFjZSBSZWZlcmVuY2Uge1xuICAvKipcbiAgICogTmFtZSBnaXZlbiB0byB0aGUgbG9jYWwgcmVmZXJlbmNlIHZhcmlhYmxlIHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IHRoZSBuYW1lIHdoaWNoIHdpbGwgYmUgdXNlZCBmb3IgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGluIHRoZSBnZW5lcmF0ZWRcbiAgICogdGVtcGxhdGUgY29kZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIGVsZW1lbnQtbGlrZSBub2RlIHdoaWNoIHRoaXMgcmVmZXJlbmNlIHRhcmdldHMuXG4gICAqXG4gICAqIFRoZSByZWZlcmVuY2UgbWF5IGJlIGVpdGhlciB0byB0aGUgZWxlbWVudCAob3IgdGVtcGxhdGUpIGl0c2VsZiwgb3IgdG8gYSBkaXJlY3RpdmUgb24gaXQuXG4gICAqL1xuICB0YXJnZXRJZDogaXIuWHJlZklkO1xuXG4gIC8qKlxuICAgKiBBIGdlbmVyYXRlZCBvZmZzZXQgb2YgdGhpcyByZWZlcmVuY2UgYW1vbmcgYWxsIHRoZSByZWZlcmVuY2VzIG9uIGEgc3BlY2lmaWMgZWxlbWVudC5cbiAgICovXG4gIG9mZnNldDogbnVtYmVyO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSB2aWV3IGFuZCBnZW5lcmF0ZSBhIGBTY29wZWAgcmVwcmVzZW50aW5nIHRoZSB2YXJpYWJsZXMgYXZhaWxhYmxlIGZvciByZWZlcmVuY2Ugd2l0aGluXG4gKiB0aGF0IHZpZXcuXG4gKi9cbmZ1bmN0aW9uIGdldFNjb3BlRm9yVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHBhcmVudDogU2NvcGV8bnVsbCk6IFNjb3BlIHtcbiAgY29uc3Qgc2NvcGU6IFNjb3BlID0ge1xuICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICByZWZlcmVuY2VzOiBbXSxcbiAgICBwYXJlbnQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHNjb3BlO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIHZhcmlhYmxlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3IgYSBnaXZlbiB2aWV3LlxuICpcbiAqIFRoaXMgaXMgYSByZWN1cnNpdmUgcHJvY2VzcywgYXMgdmlld3MgaW5oZXJpdCB2YXJpYWJsZXMgYXZhaWxhYmxlIGZyb20gdGhlaXIgcGFyZW50IHZpZXcsIHdoaWNoXG4gKiBpdHNlbGYgbWF5IGhhdmUgaW5oZXJpdGVkIHZhcmlhYmxlcywgZXRjLlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvbiwgc2NvcGU6IFNjb3BlKTogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSB7XG4gIGNvbnN0IG5ld09wczogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSA9IFtdO1xuXG4gIGlmIChzY29wZS52aWV3ICE9PSB2aWV3LnhyZWYpIHtcbiAgICAvLyBCZWZvcmUgZ2VuZXJhdGluZyB2YXJpYWJsZXMgZm9yIGEgcGFyZW50IHZpZXcsIHdlIG5lZWQgdG8gc3dpdGNoIHRvIHRoZSBjb250ZXh0IG9mIHRoZSBwYXJlbnRcbiAgICAvLyB2aWV3IHdpdGggYSBgbmV4dENvbnRleHRgIGV4cHJlc3Npb24uIFRoaXMgY29udGV4dCBzd2l0Y2hpbmcgb3BlcmF0aW9uIGl0c2VsZiBkZWNsYXJlcyBhXG4gICAgLy8gdmFyaWFibGUsIGJlY2F1c2UgdGhlIGNvbnRleHQgb2YgdGhlIHZpZXcgbWF5IGJlIHJlZmVyZW5jZWQgZGlyZWN0bHkuXG4gICAgbmV3T3BzLnB1c2goaXIuY3JlYXRlVmFyaWFibGVPcChcbiAgICAgICAgdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwge1xuICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICAgICAgdmlldzogc2NvcGUudmlldyxcbiAgICAgICAgfSxcbiAgICAgICAgbmV3IGlyLk5leHRDb250ZXh0RXhwcigpKSk7XG4gIH1cblxuICAvLyBBZGQgdmFyaWFibGVzIGZvciBhbGwgY29udGV4dCB2YXJpYWJsZXMgYXZhaWxhYmxlIGluIHRoaXMgc2NvcGUncyB2aWV3LlxuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2Ygdmlldy50cGwudmlld3MuZ2V0KHNjb3BlLnZpZXcpIS5jb250ZXh0VmFyaWFibGVzKSB7XG4gICAgbmV3T3BzLnB1c2goaXIuY3JlYXRlVmFyaWFibGVPcChcbiAgICAgICAgdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwge1xuICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgbmV3IG8uUmVhZFByb3BFeHByKG5ldyBpci5Db250ZXh0RXhwcih2aWV3LnhyZWYpLCB2YWx1ZSkpKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBsb2NhbCByZWZlcmVuY2VzIGRlY2xhcmVkIGZvciBlbGVtZW50cyBpbiB0aGlzIHNjb3BlLlxuICBmb3IgKGNvbnN0IHJlZiBvZiBzY29wZS5yZWZlcmVuY2VzKSB7XG4gICAgbmV3T3BzLnB1c2goaXIuY3JlYXRlVmFyaWFibGVPcChcbiAgICAgICAgdmlldy50cGwuYWxsb2NhdGVYcmVmSWQoKSwge1xuICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICAgICAgbmFtZTogcmVmLm5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLm9mZnNldCkpKTtcbiAgfVxuXG4gIGlmIChzY29wZS5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAvLyBSZWN1cnNpdmVseSBhZGQgdmFyaWFibGVzIGZyb20gdGhlIHBhcmVudCBzY29wZS5cbiAgICBuZXdPcHMucHVzaCguLi5nZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlLnBhcmVudCkpO1xuICB9XG4gIHJldHVybiBuZXdPcHM7XG59XG4iXX0=