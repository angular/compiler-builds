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
    // Embedded views require an operation to save/restore the view context.
    if (view.parent !== null) {
        // Start the view creation block with an operation to save the current view context. This may be
        // used to restore the view context in any listeners that may be present.
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUF5QjtJQUM5RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXFCLEVBQUUsV0FBdUI7SUFDNUUsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsd0VBQXdFO0lBQ3hFLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDeEIsZ0dBQWdHO1FBQ2hHLHlFQUF5RTtLQUMxRTtJQUVELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIscUNBQXFDO2dCQUNyQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUM1RCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7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aHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwcmVhbWJsZSBzZXF1ZW5jZSBmb3IgZWFjaCB2aWV3IGNyZWF0aW9uIGJsb2NrIGFuZCBsaXN0ZW5lciBmdW5jdGlvbiB3aGljaCBkZWNsYXJlc1xuICogYW55IHZhcmlhYmxlcyB0aGF0IGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgb3BlcmF0aW9ucyBpbiB0aGUgYmxvY2suXG4gKlxuICogVmFyaWFibGVzIGdlbmVyYXRlZCBpbmNsdWRlOlxuICogICAqIGEgc2F2ZWQgdmlldyBjb250ZXh0IHRvIGJlIHVzZWQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGV2ZW50IGxpc3RlbmVycy5cbiAqICAgKiB0aGUgY29udGV4dCBvZiB0aGUgcmVzdG9yZWQgdmlldyB3aXRoaW4gZXZlbnQgbGlzdGVuZXIgaGFuZGxlcnMuXG4gKiAgICogY29udGV4dCB2YXJpYWJsZXMgZnJvbSB0aGUgY3VycmVudCB2aWV3IGFzIHdlbGwgYXMgYWxsIHBhcmVudCB2aWV3cyAoaW5jbHVkaW5nIHRoZSByb290XG4gKiAgICAgY29udGV4dCBpZiBuZWVkZWQpLlxuICogICAqIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldyBhbmQgYW55IGxleGljYWwgcGFyZW50cy5cbiAqXG4gKiBWYXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBoZXJlIHVuY29uZGl0aW9uYWxseSwgYW5kIG1heSBvcHRpbWl6ZWQgYXdheSBpbiBmdXR1cmUgb3BlcmF0aW9ucyBpZiBpdFxuICogdHVybnMgb3V0IHRoZWlyIHZhbHVlcyAoYW5kIGFueSBzaWRlIGVmZmVjdHMpIGFyZSB1bnVzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUdlbmVyYXRlVmFyaWFibGVzKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyhjcGwucm9vdCwgLyogdGhlcmUgaXMgbm8gcGFyZW50IHNjb3BlIGZvciB0aGUgcm9vdCB2aWV3ICovIG51bGwpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gIGFuZCBnZW5lcmF0ZSBwcmVhbWJsZXMgZm9yIGl0IGFuZCBhbnkgbGlzdGVuZXJzIHRoYXQgaXRcbiAqIGRlY2xhcmVzLlxuICpcbiAqIEBwYXJhbSBgcGFyZW50U2NvcGVgIGEgc2NvcGUgZXh0cmFjdGVkIGZyb20gdGhlIHBhcmVudCB2aWV3IHdoaWNoIGNhcHR1cmVzIGFueSB2YXJpYWJsZXMgd2hpY2hcbiAqICAgICBzaG91bGQgYmUgaW5oZXJpdGVkIGJ5IHRoaXMgdmlldy4gYG51bGxgIGlmIHRoZSBjdXJyZW50IHZpZXcgaXMgdGhlIHJvb3Qgdmlldy5cbiAqL1xuZnVuY3Rpb24gcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHBhcmVudFNjb3BlOiBTY29wZXxudWxsKTogdm9pZCB7XG4gIC8vIEV4dHJhY3QgYSBgU2NvcGVgIGZyb20gdGhpcyB2aWV3LlxuICBjb25zdCBzY29wZSA9IGdldFNjb3BlRm9yVmlldyh2aWV3LCBwYXJlbnRTY29wZSk7XG5cbiAgLy8gRW1iZWRkZWQgdmlld3MgcmVxdWlyZSBhbiBvcGVyYXRpb24gdG8gc2F2ZS9yZXN0b3JlIHRoZSB2aWV3IGNvbnRleHQuXG4gIGlmICh2aWV3LnBhcmVudCAhPT0gbnVsbCkge1xuICAgIC8vIFN0YXJ0IHRoZSB2aWV3IGNyZWF0aW9uIGJsb2NrIHdpdGggYW4gb3BlcmF0aW9uIHRvIHNhdmUgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LiBUaGlzIG1heSBiZVxuICAgIC8vIHVzZWQgdG8gcmVzdG9yZSB0aGUgdmlldyBjb250ZXh0IGluIGFueSBsaXN0ZW5lcnMgdGhhdCBtYXkgYmUgcHJlc2VudC5cbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICAvLyBEZXNjZW5kIGludG8gY2hpbGQgZW1iZWRkZWQgdmlld3MuXG4gICAgICAgIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldy50cGwudmlld3MuZ2V0KG9wLnhyZWYpISwgc2NvcGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAvLyBQcmVwZW5kIHZhcmlhYmxlcyB0byBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9ucy5cbiAgICAgICAgb3AuaGFuZGxlck9wcy5wcmVwZW5kKGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJlcGVuZCB0aGUgZGVjbGFyYXRpb25zIGZvciBhbGwgYXZhaWxhYmxlIHZhcmlhYmxlcyBpbiBzY29wZSB0byB0aGUgYHVwZGF0ZWAgYmxvY2suXG4gIGNvbnN0IHByZWFtYmxlT3BzID0gZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSk7XG4gIHZpZXcudXBkYXRlLnByZXBlbmQocHJlYW1ibGVPcHMpO1xufVxuXG4vKipcbiAqIExleGljYWwgc2NvcGUgb2YgYSB2aWV3LCBpbmNsdWRpbmcgYSByZWZlcmVuY2UgdG8gaXRzIHBhcmVudCB2aWV3J3Mgc2NvcGUsIGlmIGFueS5cbiAqL1xuaW50ZXJmYWNlIFNjb3BlIHtcbiAgLyoqXG4gICAqIGBYcmVmSWRgIG9mIHRoZSB2aWV3IHRvIHdoaWNoIHRoaXMgc2NvcGUgY29ycmVzcG9uZHMuXG4gICAqL1xuICB2aWV3OiBpci5YcmVmSWQ7XG5cbiAgdmlld0NvbnRleHRWYXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcblxuICBjb250ZXh0VmFyaWFibGVzOiBNYXA8c3RyaW5nLCBpci5TZW1hbnRpY1ZhcmlhYmxlPjtcblxuICAvKipcbiAgICogTG9jYWwgcmVmZXJlbmNlcyBjb2xsZWN0ZWQgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIHZpZXcuXG4gICAqL1xuICByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogYFNjb3BlYCBvZiB0aGUgcGFyZW50IHZpZXcsIGlmIGFueS5cbiAgICovXG4gIHBhcmVudDogU2NvcGV8bnVsbDtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgYWJvdXQgYSBsb2NhbCByZWZlcmVuY2UgY29sbGVjdGVkIGZyb20gYW4gZWxlbWVudCB3aXRoaW4gYSB2aWV3LlxuICovXG5pbnRlcmZhY2UgUmVmZXJlbmNlIHtcbiAgLyoqXG4gICAqIE5hbWUgZ2l2ZW4gdG8gdGhlIGxvY2FsIHJlZmVyZW5jZSB2YXJpYWJsZSB3aXRoaW4gdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGlzIG5vdCB0aGUgbmFtZSB3aGljaCB3aWxsIGJlIHVzZWQgZm9yIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpbiB0aGUgZ2VuZXJhdGVkXG4gICAqIHRlbXBsYXRlIGNvZGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIGBYcmVmSWRgIG9mIHRoZSBlbGVtZW50LWxpa2Ugbm9kZSB3aGljaCB0aGlzIHJlZmVyZW5jZSB0YXJnZXRzLlxuICAgKlxuICAgKiBUaGUgcmVmZXJlbmNlIG1heSBiZSBlaXRoZXIgdG8gdGhlIGVsZW1lbnQgKG9yIHRlbXBsYXRlKSBpdHNlbGYsIG9yIHRvIGEgZGlyZWN0aXZlIG9uIGl0LlxuICAgKi9cbiAgdGFyZ2V0SWQ6IGlyLlhyZWZJZDtcblxuICAvKipcbiAgICogQSBnZW5lcmF0ZWQgb2Zmc2V0IG9mIHRoaXMgcmVmZXJlbmNlIGFtb25nIGFsbCB0aGUgcmVmZXJlbmNlcyBvbiBhIHNwZWNpZmljIGVsZW1lbnQuXG4gICAqL1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICB2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgdmlldyBhbmQgZ2VuZXJhdGUgYSBgU2NvcGVgIHJlcHJlc2VudGluZyB0aGUgdmFyaWFibGVzIGF2YWlsYWJsZSBmb3IgcmVmZXJlbmNlIHdpdGhpblxuICogdGhhdCB2aWV3LlxuICovXG5mdW5jdGlvbiBnZXRTY29wZUZvclZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uLCBwYXJlbnQ6IFNjb3BlfG51bGwpOiBTY29wZSB7XG4gIGNvbnN0IHNjb3BlOiBTY29wZSA9IHtcbiAgICB2aWV3OiB2aWV3LnhyZWYsXG4gICAgdmlld0NvbnRleHRWYXJpYWJsZToge1xuICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dCxcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICB2aWV3OiB2aWV3LnhyZWYsXG4gICAgfSxcbiAgICBjb250ZXh0VmFyaWFibGVzOiBuZXcgTWFwPHN0cmluZywgaXIuU2VtYW50aWNWYXJpYWJsZT4oKSxcbiAgICByZWZlcmVuY2VzOiBbXSxcbiAgICBwYXJlbnQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBpZGVudGlmaWVyIG9mIHZpZXcuY29udGV4dFZhcmlhYmxlcy5rZXlzKCkpIHtcbiAgICBzY29wZS5jb250ZXh0VmFyaWFibGVzLnNldChpZGVudGlmaWVyLCB7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGlkZW50aWZpZXIsXG4gICAgfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50OlxuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvcC5sb2NhbFJlZnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgbG9jYWxSZWZzIHRvIGJlIGFuIGFycmF5YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgYXZhaWxhYmxlIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSB0aGlzIGVsZW1lbnQuXG4gICAgICAgIGZvciAobGV0IG9mZnNldCA9IDA7IG9mZnNldCA8IG9wLmxvY2FsUmVmcy5sZW5ndGg7IG9mZnNldCsrKSB7XG4gICAgICAgICAgc2NvcGUucmVmZXJlbmNlcy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IG9wLmxvY2FsUmVmc1tvZmZzZXRdLm5hbWUsXG4gICAgICAgICAgICB0YXJnZXRJZDogb3AueHJlZixcbiAgICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICAgIGlkZW50aWZpZXI6IG9wLmxvY2FsUmVmc1tvZmZzZXRdLm5hbWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzY29wZTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBkZWNsYXJhdGlvbnMgZm9yIGFsbCB2YXJpYWJsZXMgdGhhdCBhcmUgaW4gc2NvcGUgZm9yIGEgZ2l2ZW4gdmlldy5cbiAqXG4gKiBUaGlzIGlzIGEgcmVjdXJzaXZlIHByb2Nlc3MsIGFzIHZpZXdzIGluaGVyaXQgdmFyaWFibGVzIGF2YWlsYWJsZSBmcm9tIHRoZWlyIHBhcmVudCB2aWV3LCB3aGljaFxuICogaXRzZWxmIG1heSBoYXZlIGluaGVyaXRlZCB2YXJpYWJsZXMsIGV0Yy5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb24sIHNjb3BlOiBTY29wZSk6IGlyLlZhcmlhYmxlT3A8aXIuVXBkYXRlT3A+W10ge1xuICBjb25zdCBuZXdPcHM6IGlyLlZhcmlhYmxlT3A8aXIuVXBkYXRlT3A+W10gPSBbXTtcblxuICBpZiAoc2NvcGUudmlldyAhPT0gdmlldy54cmVmKSB7XG4gICAgLy8gQmVmb3JlIGdlbmVyYXRpbmcgdmFyaWFibGVzIGZvciBhIHBhcmVudCB2aWV3LCB3ZSBuZWVkIHRvIHN3aXRjaCB0byB0aGUgY29udGV4dCBvZiB0aGUgcGFyZW50XG4gICAgLy8gdmlldyB3aXRoIGEgYG5leHRDb250ZXh0YCBleHByZXNzaW9uLiBUaGlzIGNvbnRleHQgc3dpdGNoaW5nIG9wZXJhdGlvbiBpdHNlbGYgZGVjbGFyZXMgYVxuICAgIC8vIHZhcmlhYmxlLCBiZWNhdXNlIHRoZSBjb250ZXh0IG9mIHRoZSB2aWV3IG1heSBiZSByZWZlcmVuY2VkIGRpcmVjdGx5LlxuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLnZpZXdDb250ZXh0VmFyaWFibGUsIG5ldyBpci5OZXh0Q29udGV4dEV4cHIoKSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGNvbnRleHQgdmFyaWFibGVzIGF2YWlsYWJsZSBpbiB0aGlzIHNjb3BlJ3Mgdmlldy5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIHZpZXcudHBsLnZpZXdzLmdldChzY29wZS52aWV3KSEuY29udGV4dFZhcmlhYmxlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuZ2V0KG5hbWUpISxcbiAgICAgICAgbmV3IG8uUmVhZFByb3BFeHByKG5ldyBpci5Db250ZXh0RXhwcihzY29wZS52aWV3KSwgdmFsdWUpKSk7XG4gIH1cblxuICAvLyBBZGQgdmFyaWFibGVzIGZvciBhbGwgbG9jYWwgcmVmZXJlbmNlcyBkZWNsYXJlZCBmb3IgZWxlbWVudHMgaW4gdGhpcyBzY29wZS5cbiAgZm9yIChjb25zdCByZWYgb2Ygc2NvcGUucmVmZXJlbmNlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHJlZi52YXJpYWJsZSwgbmV3IGlyLlJlZmVyZW5jZUV4cHIocmVmLnRhcmdldElkLCByZWYub2Zmc2V0KSkpO1xuICB9XG5cbiAgaWYgKHNjb3BlLnBhcmVudCAhPT0gbnVsbCkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGFkZCB2YXJpYWJsZXMgZnJvbSB0aGUgcGFyZW50IHNjb3BlLlxuICAgIG5ld09wcy5wdXNoKC4uLmdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUucGFyZW50KSk7XG4gIH1cbiAgcmV0dXJuIG5ld09wcztcbn1cbiJdfQ==