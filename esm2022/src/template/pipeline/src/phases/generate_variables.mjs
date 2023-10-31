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
export function phaseGenerateVariables(job) {
    recursivelyProcessView(job.root, /* there is no parent scope for the root view */ null);
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
            case ir.OpKind.RepeaterCreate:
                // Descend into child embedded views.
                recursivelyProcessView(view.job.views.get(op.xref), scope);
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
        aliases: view.aliases,
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
                        targetSlot: op.slot,
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
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), scope.viewContextVariable, new ir.NextContextExpr(), ir.VariableFlags.None));
    }
    // Add variables for all context variables available in this scope's view.
    const scopeView = view.job.views.get(scope.view);
    for (const [name, value] of scopeView.contextVariables) {
        const context = new ir.ContextExpr(scope.view);
        // We either read the context, or, if the variable is CTX_REF, use the context directly.
        const variable = value === ir.CTX_REF ? context : new o.ReadPropExpr(context, value);
        // Add the variable declaration.
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), scope.contextVariables.get(name), variable, ir.VariableFlags.None));
    }
    for (const alias of scopeView.aliases) {
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), alias, alias.expression.clone(), ir.VariableFlags.AlwaysInline));
    }
    // Add variables for all local references declared for elements in this scope.
    for (const ref of scope.references) {
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), ref.variable, new ir.ReferenceExpr(ref.targetId, ref.targetSlot, ref.offset), ir.VariableFlags.None));
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUE0QjtJQUNqRSxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXlCLEVBQUUsV0FBdUI7SUFDaEYsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWM7Z0JBQzNCLHFDQUFxQztnQkFDckMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDNUQsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixtREFBbUQ7Z0JBQ25ELEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FB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LEVBQUU7UUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFDdkMsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQzdGO0lBRUQsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtRQUN6QixtREFBbUQ7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNyRTtJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgcHJlYW1ibGUgc2VxdWVuY2UgZm9yIGVhY2ggdmlldyBjcmVhdGlvbiBibG9jayBhbmQgbGlzdGVuZXIgZnVuY3Rpb24gd2hpY2ggZGVjbGFyZXNcbiAqIGFueSB2YXJpYWJsZXMgdGhhdCBiZSByZWZlcmVuY2VkIGluIG90aGVyIG9wZXJhdGlvbnMgaW4gdGhlIGJsb2NrLlxuICpcbiAqIFZhcmlhYmxlcyBnZW5lcmF0ZWQgaW5jbHVkZTpcbiAqICAgKiBhIHNhdmVkIHZpZXcgY29udGV4dCB0byBiZSB1c2VkIHRvIHJlc3RvcmUgdGhlIGN1cnJlbnQgdmlldyBpbiBldmVudCBsaXN0ZW5lcnMuXG4gKiAgICogdGhlIGNvbnRleHQgb2YgdGhlIHJlc3RvcmVkIHZpZXcgd2l0aGluIGV2ZW50IGxpc3RlbmVyIGhhbmRsZXJzLlxuICogICAqIGNvbnRleHQgdmFyaWFibGVzIGZyb20gdGhlIGN1cnJlbnQgdmlldyBhcyB3ZWxsIGFzIGFsbCBwYXJlbnQgdmlld3MgKGluY2x1ZGluZyB0aGUgcm9vdFxuICogICAgIGNvbnRleHQgaWYgbmVlZGVkKS5cbiAqICAgKiBsb2NhbCByZWZlcmVuY2VzIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcgYW5kIGFueSBsZXhpY2FsIHBhcmVudHMuXG4gKlxuICogVmFyaWFibGVzIGFyZSBnZW5lcmF0ZWQgaGVyZSB1bmNvbmRpdGlvbmFsbHksIGFuZCBtYXkgb3B0aW1pemVkIGF3YXkgaW4gZnV0dXJlIG9wZXJhdGlvbnMgaWYgaXRcbiAqIHR1cm5zIG91dCB0aGVpciB2YWx1ZXMgKGFuZCBhbnkgc2lkZSBlZmZlY3RzKSBhcmUgdW51c2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VHZW5lcmF0ZVZhcmlhYmxlcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcoam9iLnJvb3QsIC8qIHRoZXJlIGlzIG5vIHBhcmVudCBzY29wZSBmb3IgdGhlIHJvb3QgdmlldyAqLyBudWxsKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYCBhbmQgZ2VuZXJhdGUgcHJlYW1ibGVzIGZvciBpdCBhbmQgYW55IGxpc3RlbmVycyB0aGF0IGl0XG4gKiBkZWNsYXJlcy5cbiAqXG4gKiBAcGFyYW0gYHBhcmVudFNjb3BlYCBhIHNjb3BlIGV4dHJhY3RlZCBmcm9tIHRoZSBwYXJlbnQgdmlldyB3aGljaCBjYXB0dXJlcyBhbnkgdmFyaWFibGVzIHdoaWNoXG4gKiAgICAgc2hvdWxkIGJlIGluaGVyaXRlZCBieSB0aGlzIHZpZXcuIGBudWxsYCBpZiB0aGUgY3VycmVudCB2aWV3IGlzIHRoZSByb290IHZpZXcuXG4gKi9cbmZ1bmN0aW9uIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwpOiB2b2lkIHtcbiAgLy8gRXh0cmFjdCBhIGBTY29wZWAgZnJvbSB0aGlzIHZpZXcuXG4gIGNvbnN0IHNjb3BlID0gZ2V0U2NvcGVGb3JWaWV3KHZpZXcsIHBhcmVudFNjb3BlKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICAvLyBEZXNjZW5kIGludG8gY2hpbGQgZW1iZWRkZWQgdmlld3MuXG4gICAgICAgIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldy5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISwgc2NvcGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAvLyBQcmVwZW5kIHZhcmlhYmxlcyB0byBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9ucy5cbiAgICAgICAgb3AuaGFuZGxlck9wcy5wcmVwZW5kKGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJlcGVuZCB0aGUgZGVjbGFyYXRpb25zIGZvciBhbGwgYXZhaWxhYmxlIHZhcmlhYmxlcyBpbiBzY29wZSB0byB0aGUgYHVwZGF0ZWAgYmxvY2suXG4gIGNvbnN0IHByZWFtYmxlT3BzID0gZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSk7XG4gIHZpZXcudXBkYXRlLnByZXBlbmQocHJlYW1ibGVPcHMpO1xufVxuXG4vKipcbiAqIExleGljYWwgc2NvcGUgb2YgYSB2aWV3LCBpbmNsdWRpbmcgYSByZWZlcmVuY2UgdG8gaXRzIHBhcmVudCB2aWV3J3Mgc2NvcGUsIGlmIGFueS5cbiAqL1xuaW50ZXJmYWNlIFNjb3BlIHtcbiAgLyoqXG4gICAqIGBYcmVmSWRgIG9mIHRoZSB2aWV3IHRvIHdoaWNoIHRoaXMgc2NvcGUgY29ycmVzcG9uZHMuXG4gICAqL1xuICB2aWV3OiBpci5YcmVmSWQ7XG5cbiAgdmlld0NvbnRleHRWYXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcblxuICBjb250ZXh0VmFyaWFibGVzOiBNYXA8c3RyaW5nLCBpci5TZW1hbnRpY1ZhcmlhYmxlPjtcblxuICBhbGlhc2VzOiBTZXQ8aXIuQWxpYXNWYXJpYWJsZT47XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgY29sbGVjdGVkIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSB2aWV3LlxuICAgKi9cbiAgcmVmZXJlbmNlczogUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIGBTY29wZWAgb2YgdGhlIHBhcmVudCB2aWV3LCBpZiBhbnkuXG4gICAqL1xuICBwYXJlbnQ6IFNjb3BlfG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIGFib3V0IGEgbG9jYWwgcmVmZXJlbmNlIGNvbGxlY3RlZCBmcm9tIGFuIGVsZW1lbnQgd2l0aGluIGEgdmlldy5cbiAqL1xuaW50ZXJmYWNlIFJlZmVyZW5jZSB7XG4gIC8qKlxuICAgKiBOYW1lIGdpdmVuIHRvIHRoZSBsb2NhbCByZWZlcmVuY2UgdmFyaWFibGUgd2l0aGluIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBpcyBub3QgdGhlIG5hbWUgd2hpY2ggd2lsbCBiZSB1c2VkIGZvciB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gaW4gdGhlIGdlbmVyYXRlZFxuICAgKiB0ZW1wbGF0ZSBjb2RlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudC1saWtlIG5vZGUgd2hpY2ggdGhpcyByZWZlcmVuY2UgdGFyZ2V0cy5cbiAgICpcbiAgICogVGhlIHJlZmVyZW5jZSBtYXkgYmUgZWl0aGVyIHRvIHRoZSBlbGVtZW50IChvciB0ZW1wbGF0ZSkgaXRzZWxmLCBvciB0byBhIGRpcmVjdGl2ZSBvbiBpdC5cbiAgICovXG4gIHRhcmdldElkOiBpci5YcmVmSWQ7XG5cbiAgdGFyZ2V0U2xvdDogaXIuU2xvdEhhbmRsZTtcblxuICAvKipcbiAgICogQSBnZW5lcmF0ZWQgb2Zmc2V0IG9mIHRoaXMgcmVmZXJlbmNlIGFtb25nIGFsbCB0aGUgcmVmZXJlbmNlcyBvbiBhIHNwZWNpZmljIGVsZW1lbnQuXG4gICAqL1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICB2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgdmlldyBhbmQgZ2VuZXJhdGUgYSBgU2NvcGVgIHJlcHJlc2VudGluZyB0aGUgdmFyaWFibGVzIGF2YWlsYWJsZSBmb3IgcmVmZXJlbmNlIHdpdGhpblxuICogdGhhdCB2aWV3LlxuICovXG5mdW5jdGlvbiBnZXRTY29wZUZvclZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50OiBTY29wZXxudWxsKTogU2NvcGUge1xuICBjb25zdCBzY29wZTogU2NvcGUgPSB7XG4gICAgdmlldzogdmlldy54cmVmLFxuICAgIHZpZXdDb250ZXh0VmFyaWFibGU6IHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgYWxpYXNlczogdmlldy5hbGlhc2VzLFxuICAgIHJlZmVyZW5jZXM6IFtdLFxuICAgIHBhcmVudCxcbiAgfTtcblxuICBmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2Ygdmlldy5jb250ZXh0VmFyaWFibGVzLmtleXMoKSkge1xuICAgIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuc2V0KGlkZW50aWZpZXIsIHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgaWRlbnRpZmllcixcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBvcC5zbG90LFxuICAgICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcixcbiAgICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgICAgaWRlbnRpZmllcjogb3AubG9jYWxSZWZzW29mZnNldF0ubmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHNjb3BlO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIHZhcmlhYmxlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3IgYSBnaXZlbiB2aWV3LlxuICpcbiAqIFRoaXMgaXMgYSByZWN1cnNpdmUgcHJvY2VzcywgYXMgdmlld3MgaW5oZXJpdCB2YXJpYWJsZXMgYXZhaWxhYmxlIGZyb20gdGhlaXIgcGFyZW50IHZpZXcsIHdoaWNoXG4gKiBpdHNlbGYgbWF5IGhhdmUgaW5oZXJpdGVkIHZhcmlhYmxlcywgZXRjLlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KFxuICAgIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHNjb3BlOiBTY29wZSk6IGlyLlZhcmlhYmxlT3A8aXIuVXBkYXRlT3A+W10ge1xuICBjb25zdCBuZXdPcHM6IGlyLlZhcmlhYmxlT3A8aXIuVXBkYXRlT3A+W10gPSBbXTtcblxuICBpZiAoc2NvcGUudmlldyAhPT0gdmlldy54cmVmKSB7XG4gICAgLy8gQmVmb3JlIGdlbmVyYXRpbmcgdmFyaWFibGVzIGZvciBhIHBhcmVudCB2aWV3LCB3ZSBuZWVkIHRvIHN3aXRjaCB0byB0aGUgY29udGV4dCBvZiB0aGUgcGFyZW50XG4gICAgLy8gdmlldyB3aXRoIGEgYG5leHRDb250ZXh0YCBleHByZXNzaW9uLiBUaGlzIGNvbnRleHQgc3dpdGNoaW5nIG9wZXJhdGlvbiBpdHNlbGYgZGVjbGFyZXMgYVxuICAgIC8vIHZhcmlhYmxlLCBiZWNhdXNlIHRoZSBjb250ZXh0IG9mIHRoZSB2aWV3IG1heSBiZSByZWZlcmVuY2VkIGRpcmVjdGx5LlxuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLnZpZXdDb250ZXh0VmFyaWFibGUsIG5ldyBpci5OZXh0Q29udGV4dEV4cHIoKSxcbiAgICAgICAgaXIuVmFyaWFibGVGbGFncy5Ob25lKSk7XG4gIH1cblxuICAvLyBBZGQgdmFyaWFibGVzIGZvciBhbGwgY29udGV4dCB2YXJpYWJsZXMgYXZhaWxhYmxlIGluIHRoaXMgc2NvcGUncyB2aWV3LlxuICBjb25zdCBzY29wZVZpZXcgPSB2aWV3LmpvYi52aWV3cy5nZXQoc2NvcGUudmlldykhO1xuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2Ygc2NvcGVWaWV3LmNvbnRleHRWYXJpYWJsZXMpIHtcbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IGlyLkNvbnRleHRFeHByKHNjb3BlLnZpZXcpO1xuICAgIC8vIFdlIGVpdGhlciByZWFkIHRoZSBjb250ZXh0LCBvciwgaWYgdGhlIHZhcmlhYmxlIGlzIENUWF9SRUYsIHVzZSB0aGUgY29udGV4dCBkaXJlY3RseS5cbiAgICBjb25zdCB2YXJpYWJsZSA9IHZhbHVlID09PSBpci5DVFhfUkVGID8gY29udGV4dCA6IG5ldyBvLlJlYWRQcm9wRXhwcihjb250ZXh0LCB2YWx1ZSk7XG4gICAgLy8gQWRkIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvbi5cbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS5jb250ZXh0VmFyaWFibGVzLmdldChuYW1lKSEsIHZhcmlhYmxlLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLk5vbmUpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYWxpYXMgb2Ygc2NvcGVWaWV3LmFsaWFzZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBhbGlhcywgYWxpYXMuZXhwcmVzc2lvbi5jbG9uZSgpLCBpci5WYXJpYWJsZUZsYWdzLkFsd2F5c0lubGluZSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGxvY2FsIHJlZmVyZW5jZXMgZGVjbGFyZWQgZm9yIGVsZW1lbnRzIGluIHRoaXMgc2NvcGUuXG4gIGZvciAoY29uc3QgcmVmIG9mIHNjb3BlLnJlZmVyZW5jZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCByZWYudmFyaWFibGUsXG4gICAgICAgIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLnRhcmdldFNsb3QsIHJlZi5vZmZzZXQpLCBpci5WYXJpYWJsZUZsYWdzLk5vbmUpKTtcbiAgfVxuXG4gIGlmIChzY29wZS5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAvLyBSZWN1cnNpdmVseSBhZGQgdmFyaWFibGVzIGZyb20gdGhlIHBhcmVudCBzY29wZS5cbiAgICBuZXdPcHMucHVzaCguLi5nZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlLnBhcmVudCkpO1xuICB9XG4gIHJldHVybiBuZXdPcHM7XG59XG4iXX0=