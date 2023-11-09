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
export function generateVariables(job) {
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
                        targetSlot: op.handle,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXlCLEVBQUUsV0FBdUI7SUFDaEYsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDN0IsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztZQUN4QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYztnQkFDM0IscUNBQXFDO2dCQUNyQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUM1RCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLG1EQUFtRDtnQkFDbkQsRUFBRSxDQUFDLFVB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QUFFLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELDhFQUE4RTtJQUM5RSxLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNuQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUN2QyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUMxQixtREFBbUQ7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwcmVhbWJsZSBzZXF1ZW5jZSBmb3IgZWFjaCB2aWV3IGNyZWF0aW9uIGJsb2NrIGFuZCBsaXN0ZW5lciBmdW5jdGlvbiB3aGljaCBkZWNsYXJlc1xuICogYW55IHZhcmlhYmxlcyB0aGF0IGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgb3BlcmF0aW9ucyBpbiB0aGUgYmxvY2suXG4gKlxuICogVmFyaWFibGVzIGdlbmVyYXRlZCBpbmNsdWRlOlxuICogICAqIGEgc2F2ZWQgdmlldyBjb250ZXh0IHRvIGJlIHVzZWQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGV2ZW50IGxpc3RlbmVycy5cbiAqICAgKiB0aGUgY29udGV4dCBvZiB0aGUgcmVzdG9yZWQgdmlldyB3aXRoaW4gZXZlbnQgbGlzdGVuZXIgaGFuZGxlcnMuXG4gKiAgICogY29udGV4dCB2YXJpYWJsZXMgZnJvbSB0aGUgY3VycmVudCB2aWV3IGFzIHdlbGwgYXMgYWxsIHBhcmVudCB2aWV3cyAoaW5jbHVkaW5nIHRoZSByb290XG4gKiAgICAgY29udGV4dCBpZiBuZWVkZWQpLlxuICogICAqIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldyBhbmQgYW55IGxleGljYWwgcGFyZW50cy5cbiAqXG4gKiBWYXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBoZXJlIHVuY29uZGl0aW9uYWxseSwgYW5kIG1heSBvcHRpbWl6ZWQgYXdheSBpbiBmdXR1cmUgb3BlcmF0aW9ucyBpZiBpdFxuICogdHVybnMgb3V0IHRoZWlyIHZhbHVlcyAoYW5kIGFueSBzaWRlIGVmZmVjdHMpIGFyZSB1bnVzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVZhcmlhYmxlcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcoam9iLnJvb3QsIC8qIHRoZXJlIGlzIG5vIHBhcmVudCBzY29wZSBmb3IgdGhlIHJvb3QgdmlldyAqLyBudWxsKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYCBhbmQgZ2VuZXJhdGUgcHJlYW1ibGVzIGZvciBpdCBhbmQgYW55IGxpc3RlbmVycyB0aGF0IGl0XG4gKiBkZWNsYXJlcy5cbiAqXG4gKiBAcGFyYW0gYHBhcmVudFNjb3BlYCBhIHNjb3BlIGV4dHJhY3RlZCBmcm9tIHRoZSBwYXJlbnQgdmlldyB3aGljaCBjYXB0dXJlcyBhbnkgdmFyaWFibGVzIHdoaWNoXG4gKiAgICAgc2hvdWxkIGJlIGluaGVyaXRlZCBieSB0aGlzIHZpZXcuIGBudWxsYCBpZiB0aGUgY3VycmVudCB2aWV3IGlzIHRoZSByb290IHZpZXcuXG4gKi9cbmZ1bmN0aW9uIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwpOiB2b2lkIHtcbiAgLy8gRXh0cmFjdCBhIGBTY29wZWAgZnJvbSB0aGlzIHZpZXcuXG4gIGNvbnN0IHNjb3BlID0gZ2V0U2NvcGVGb3JWaWV3KHZpZXcsIHBhcmVudFNjb3BlKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICAvLyBEZXNjZW5kIGludG8gY2hpbGQgZW1iZWRkZWQgdmlld3MuXG4gICAgICAgIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldy5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISwgc2NvcGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAvLyBQcmVwZW5kIHZhcmlhYmxlcyB0byBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9ucy5cbiAgICAgICAgb3AuaGFuZGxlck9wcy5wcmVwZW5kKGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJlcGVuZCB0aGUgZGVjbGFyYXRpb25zIGZvciBhbGwgYXZhaWxhYmxlIHZhcmlhYmxlcyBpbiBzY29wZSB0byB0aGUgYHVwZGF0ZWAgYmxvY2suXG4gIGNvbnN0IHByZWFtYmxlT3BzID0gZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSk7XG4gIHZpZXcudXBkYXRlLnByZXBlbmQocHJlYW1ibGVPcHMpO1xufVxuXG4vKipcbiAqIExleGljYWwgc2NvcGUgb2YgYSB2aWV3LCBpbmNsdWRpbmcgYSByZWZlcmVuY2UgdG8gaXRzIHBhcmVudCB2aWV3J3Mgc2NvcGUsIGlmIGFueS5cbiAqL1xuaW50ZXJmYWNlIFNjb3BlIHtcbiAgLyoqXG4gICAqIGBYcmVmSWRgIG9mIHRoZSB2aWV3IHRvIHdoaWNoIHRoaXMgc2NvcGUgY29ycmVzcG9uZHMuXG4gICAqL1xuICB2aWV3OiBpci5YcmVmSWQ7XG5cbiAgdmlld0NvbnRleHRWYXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcblxuICBjb250ZXh0VmFyaWFibGVzOiBNYXA8c3RyaW5nLCBpci5TZW1hbnRpY1ZhcmlhYmxlPjtcblxuICBhbGlhc2VzOiBTZXQ8aXIuQWxpYXNWYXJpYWJsZT47XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgY29sbGVjdGVkIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSB2aWV3LlxuICAgKi9cbiAgcmVmZXJlbmNlczogUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIGBTY29wZWAgb2YgdGhlIHBhcmVudCB2aWV3LCBpZiBhbnkuXG4gICAqL1xuICBwYXJlbnQ6IFNjb3BlfG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIGFib3V0IGEgbG9jYWwgcmVmZXJlbmNlIGNvbGxlY3RlZCBmcm9tIGFuIGVsZW1lbnQgd2l0aGluIGEgdmlldy5cbiAqL1xuaW50ZXJmYWNlIFJlZmVyZW5jZSB7XG4gIC8qKlxuICAgKiBOYW1lIGdpdmVuIHRvIHRoZSBsb2NhbCByZWZlcmVuY2UgdmFyaWFibGUgd2l0aGluIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBpcyBub3QgdGhlIG5hbWUgd2hpY2ggd2lsbCBiZSB1c2VkIGZvciB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gaW4gdGhlIGdlbmVyYXRlZFxuICAgKiB0ZW1wbGF0ZSBjb2RlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudC1saWtlIG5vZGUgd2hpY2ggdGhpcyByZWZlcmVuY2UgdGFyZ2V0cy5cbiAgICpcbiAgICogVGhlIHJlZmVyZW5jZSBtYXkgYmUgZWl0aGVyIHRvIHRoZSBlbGVtZW50IChvciB0ZW1wbGF0ZSkgaXRzZWxmLCBvciB0byBhIGRpcmVjdGl2ZSBvbiBpdC5cbiAgICovXG4gIHRhcmdldElkOiBpci5YcmVmSWQ7XG5cbiAgdGFyZ2V0U2xvdDogaXIuU2xvdEhhbmRsZTtcblxuICAvKipcbiAgICogQSBnZW5lcmF0ZWQgb2Zmc2V0IG9mIHRoaXMgcmVmZXJlbmNlIGFtb25nIGFsbCB0aGUgcmVmZXJlbmNlcyBvbiBhIHNwZWNpZmljIGVsZW1lbnQuXG4gICAqL1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICB2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgdmlldyBhbmQgZ2VuZXJhdGUgYSBgU2NvcGVgIHJlcHJlc2VudGluZyB0aGUgdmFyaWFibGVzIGF2YWlsYWJsZSBmb3IgcmVmZXJlbmNlIHdpdGhpblxuICogdGhhdCB2aWV3LlxuICovXG5mdW5jdGlvbiBnZXRTY29wZUZvclZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50OiBTY29wZXxudWxsKTogU2NvcGUge1xuICBjb25zdCBzY29wZTogU2NvcGUgPSB7XG4gICAgdmlldzogdmlldy54cmVmLFxuICAgIHZpZXdDb250ZXh0VmFyaWFibGU6IHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgYWxpYXNlczogdmlldy5hbGlhc2VzLFxuICAgIHJlZmVyZW5jZXM6IFtdLFxuICAgIHBhcmVudCxcbiAgfTtcblxuICBmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2Ygdmlldy5jb250ZXh0VmFyaWFibGVzLmtleXMoKSkge1xuICAgIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuc2V0KGlkZW50aWZpZXIsIHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgaWRlbnRpZmllcixcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICB0YXJnZXRTbG90OiBvcC5oYW5kbGUsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICB2YXJpYWJsZToge1xuICAgICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgICBpZGVudGlmaWVyOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2NvcGU7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgZGVjbGFyYXRpb25zIGZvciBhbGwgdmFyaWFibGVzIHRoYXQgYXJlIGluIHNjb3BlIGZvciBhIGdpdmVuIHZpZXcuXG4gKlxuICogVGhpcyBpcyBhIHJlY3Vyc2l2ZSBwcm9jZXNzLCBhcyB2aWV3cyBpbmhlcml0IHZhcmlhYmxlcyBhdmFpbGFibGUgZnJvbSB0aGVpciBwYXJlbnQgdmlldywgd2hpY2hcbiAqIGl0c2VsZiBtYXkgaGF2ZSBpbmhlcml0ZWQgdmFyaWFibGVzLCBldGMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgc2NvcGU6IFNjb3BlKTogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSB7XG4gIGNvbnN0IG5ld09wczogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSA9IFtdO1xuXG4gIGlmIChzY29wZS52aWV3ICE9PSB2aWV3LnhyZWYpIHtcbiAgICAvLyBCZWZvcmUgZ2VuZXJhdGluZyB2YXJpYWJsZXMgZm9yIGEgcGFyZW50IHZpZXcsIHdlIG5lZWQgdG8gc3dpdGNoIHRvIHRoZSBjb250ZXh0IG9mIHRoZSBwYXJlbnRcbiAgICAvLyB2aWV3IHdpdGggYSBgbmV4dENvbnRleHRgIGV4cHJlc3Npb24uIFRoaXMgY29udGV4dCBzd2l0Y2hpbmcgb3BlcmF0aW9uIGl0c2VsZiBkZWNsYXJlcyBhXG4gICAgLy8gdmFyaWFibGUsIGJlY2F1c2UgdGhlIGNvbnRleHQgb2YgdGhlIHZpZXcgbWF5IGJlIHJlZmVyZW5jZWQgZGlyZWN0bHkuXG4gICAgbmV3T3BzLnB1c2goaXIuY3JlYXRlVmFyaWFibGVPcChcbiAgICAgICAgdmlldy5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgc2NvcGUudmlld0NvbnRleHRWYXJpYWJsZSwgbmV3IGlyLk5leHRDb250ZXh0RXhwcigpLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLk5vbmUpKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBjb250ZXh0IHZhcmlhYmxlcyBhdmFpbGFibGUgaW4gdGhpcyBzY29wZSdzIHZpZXcuXG4gIGNvbnN0IHNjb3BlVmlldyA9IHZpZXcuam9iLnZpZXdzLmdldChzY29wZS52aWV3KSE7XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBzY29wZVZpZXcuY29udGV4dFZhcmlhYmxlcykge1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgaXIuQ29udGV4dEV4cHIoc2NvcGUudmlldyk7XG4gICAgLy8gV2UgZWl0aGVyIHJlYWQgdGhlIGNvbnRleHQsIG9yLCBpZiB0aGUgdmFyaWFibGUgaXMgQ1RYX1JFRiwgdXNlIHRoZSBjb250ZXh0IGRpcmVjdGx5LlxuICAgIGNvbnN0IHZhcmlhYmxlID0gdmFsdWUgPT09IGlyLkNUWF9SRUYgPyBjb250ZXh0IDogbmV3IG8uUmVhZFByb3BFeHByKGNvbnRleHQsIHZhbHVlKTtcbiAgICAvLyBBZGQgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuZ2V0KG5hbWUpISwgdmFyaWFibGUsXG4gICAgICAgIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBhbGlhcyBvZiBzY29wZVZpZXcuYWxpYXNlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIGFsaWFzLCBhbGlhcy5leHByZXNzaW9uLmNsb25lKCksIGlyLlZhcmlhYmxlRmxhZ3MuQWx3YXlzSW5saW5lKSk7XG4gIH1cblxuICAvLyBBZGQgdmFyaWFibGVzIGZvciBhbGwgbG9jYWwgcmVmZXJlbmNlcyBkZWNsYXJlZCBmb3IgZWxlbWVudHMgaW4gdGhpcyBzY29wZS5cbiAgZm9yIChjb25zdCByZWYgb2Ygc2NvcGUucmVmZXJlbmNlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHJlZi52YXJpYWJsZSxcbiAgICAgICAgbmV3IGlyLlJlZmVyZW5jZUV4cHIocmVmLnRhcmdldElkLCByZWYudGFyZ2V0U2xvdCwgcmVmLm9mZnNldCksIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSkpO1xuICB9XG5cbiAgaWYgKHNjb3BlLnBhcmVudCAhPT0gbnVsbCkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGFkZCB2YXJpYWJsZXMgZnJvbSB0aGUgcGFyZW50IHNjb3BlLlxuICAgIG5ld09wcy5wdXNoKC4uLmdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUucGFyZW50KSk7XG4gIH1cbiAgcmV0dXJuIG5ld09wcztcbn1cbiJdfQ==