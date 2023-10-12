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
                // Descend into child embedded views.
                recursivelyProcessView(view.job.views.get(op.xref), scope);
                break;
            case ir.OpKind.Listener:
                // Prepend variables to listener handler functions.
                op.handlerOps.prepend(generateVariablesInScopeForView(view, scope));
                break;
        }
    }
    // Prepend the declarations for all available variables in scope to both blocks.
    view.create.prepend(generateVariablesInScopeForView(view, scope));
    view.update.prepend(generateVariablesInScopeForView(view, scope));
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
            target: null,
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
                            target: op.xref,
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
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), scope.viewContextVariable, new ir.NextContextExpr(), 
        /* isConstant */ true));
    }
    // Add variables for all context variables available in this scope's view.
    for (const [name, value] of view.job.views.get(scope.view).contextVariables) {
        const context = new ir.ContextExpr(scope.view);
        // We either read the context, or, if the variable is CTX_REF, use the context directly.
        const variable = value === ir.CTX_REF ? context : new o.ReadPropExpr(context, value);
        // Add the variable declaration.
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), scope.contextVariables.get(name), variable, 
        /* isConstant */ true));
    }
    // Add variables for all local references declared for elements in this scope.
    for (const ref of scope.references) {
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), ref.variable, new ir.ReferenceExpr(ref.targetId, ref.offset), 
        /* isConstant */ true));
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUE0QjtJQUNqRSxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXlCLEVBQUUsV0FBdUI7SUFDaEYsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixxQ0FBcUM7Z0JBQ3JDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzVELE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsbURBQW1EO2dCQUNuRCxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENB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QUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3pCLG1EQUFtRDtRQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsK0JBQStCLENBQU0sSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQzFFO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgcHJlYW1ibGUgc2VxdWVuY2UgZm9yIGVhY2ggdmlldyBjcmVhdGlvbiBibG9jayBhbmQgbGlzdGVuZXIgZnVuY3Rpb24gd2hpY2ggZGVjbGFyZXNcbiAqIGFueSB2YXJpYWJsZXMgdGhhdCBiZSByZWZlcmVuY2VkIGluIG90aGVyIG9wZXJhdGlvbnMgaW4gdGhlIGJsb2NrLlxuICpcbiAqIFZhcmlhYmxlcyBnZW5lcmF0ZWQgaW5jbHVkZTpcbiAqICAgKiBhIHNhdmVkIHZpZXcgY29udGV4dCB0byBiZSB1c2VkIHRvIHJlc3RvcmUgdGhlIGN1cnJlbnQgdmlldyBpbiBldmVudCBsaXN0ZW5lcnMuXG4gKiAgICogdGhlIGNvbnRleHQgb2YgdGhlIHJlc3RvcmVkIHZpZXcgd2l0aGluIGV2ZW50IGxpc3RlbmVyIGhhbmRsZXJzLlxuICogICAqIGNvbnRleHQgdmFyaWFibGVzIGZyb20gdGhlIGN1cnJlbnQgdmlldyBhcyB3ZWxsIGFzIGFsbCBwYXJlbnQgdmlld3MgKGluY2x1ZGluZyB0aGUgcm9vdFxuICogICAgIGNvbnRleHQgaWYgbmVlZGVkKS5cbiAqICAgKiBsb2NhbCByZWZlcmVuY2VzIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcgYW5kIGFueSBsZXhpY2FsIHBhcmVudHMuXG4gKlxuICogVmFyaWFibGVzIGFyZSBnZW5lcmF0ZWQgaGVyZSB1bmNvbmRpdGlvbmFsbHksIGFuZCBtYXkgb3B0aW1pemVkIGF3YXkgaW4gZnV0dXJlIG9wZXJhdGlvbnMgaWYgaXRcbiAqIHR1cm5zIG91dCB0aGVpciB2YWx1ZXMgKGFuZCBhbnkgc2lkZSBlZmZlY3RzKSBhcmUgdW51c2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VHZW5lcmF0ZVZhcmlhYmxlcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcoam9iLnJvb3QsIC8qIHRoZXJlIGlzIG5vIHBhcmVudCBzY29wZSBmb3IgdGhlIHJvb3QgdmlldyAqLyBudWxsKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBnaXZlbiBgVmlld0NvbXBpbGF0aW9uYCBhbmQgZ2VuZXJhdGUgcHJlYW1ibGVzIGZvciBpdCBhbmQgYW55IGxpc3RlbmVycyB0aGF0IGl0XG4gKiBkZWNsYXJlcy5cbiAqXG4gKiBAcGFyYW0gYHBhcmVudFNjb3BlYCBhIHNjb3BlIGV4dHJhY3RlZCBmcm9tIHRoZSBwYXJlbnQgdmlldyB3aGljaCBjYXB0dXJlcyBhbnkgdmFyaWFibGVzIHdoaWNoXG4gKiAgICAgc2hvdWxkIGJlIGluaGVyaXRlZCBieSB0aGlzIHZpZXcuIGBudWxsYCBpZiB0aGUgY3VycmVudCB2aWV3IGlzIHRoZSByb290IHZpZXcuXG4gKi9cbmZ1bmN0aW9uIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwpOiB2b2lkIHtcbiAgLy8gRXh0cmFjdCBhIGBTY29wZWAgZnJvbSB0aGlzIHZpZXcuXG4gIGNvbnN0IHNjb3BlID0gZ2V0U2NvcGVGb3JWaWV3KHZpZXcsIHBhcmVudFNjb3BlKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIGNoaWxkIGVtYmVkZGVkIHZpZXdzLlxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXcuam9iLnZpZXdzLmdldChvcC54cmVmKSEsIHNjb3BlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgLy8gUHJlcGVuZCB2YXJpYWJsZXMgdG8gbGlzdGVuZXIgaGFuZGxlciBmdW5jdGlvbnMuXG4gICAgICAgIG9wLmhhbmRsZXJPcHMucHJlcGVuZChnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlKSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByZXBlbmQgdGhlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIGF2YWlsYWJsZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gYm90aCBibG9ja3MuXG4gIHZpZXcuY3JlYXRlLnByZXBlbmQoZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSkpO1xuICB2aWV3LnVwZGF0ZS5wcmVwZW5kKGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUpKTtcbn1cblxuLyoqXG4gKiBMZXhpY2FsIHNjb3BlIG9mIGEgdmlldywgaW5jbHVkaW5nIGEgcmVmZXJlbmNlIHRvIGl0cyBwYXJlbnQgdmlldydzIHNjb3BlLCBpZiBhbnkuXG4gKi9cbmludGVyZmFjZSBTY29wZSB7XG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgdmlldyB0byB3aGljaCB0aGlzIHNjb3BlIGNvcnJlc3BvbmRzLlxuICAgKi9cbiAgdmlldzogaXIuWHJlZklkO1xuXG4gIHZpZXdDb250ZXh0VmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGU7XG5cbiAgY29udGV4dFZhcmlhYmxlczogTWFwPHN0cmluZywgaXIuU2VtYW50aWNWYXJpYWJsZT47XG5cbiAgLyoqXG4gICAqIExvY2FsIHJlZmVyZW5jZXMgY29sbGVjdGVkIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSB2aWV3LlxuICAgKi9cbiAgcmVmZXJlbmNlczogUmVmZXJlbmNlW107XG5cbiAgLyoqXG4gICAqIGBTY29wZWAgb2YgdGhlIHBhcmVudCB2aWV3LCBpZiBhbnkuXG4gICAqL1xuICBwYXJlbnQ6IFNjb3BlfG51bGw7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbmVlZGVkIGFib3V0IGEgbG9jYWwgcmVmZXJlbmNlIGNvbGxlY3RlZCBmcm9tIGFuIGVsZW1lbnQgd2l0aGluIGEgdmlldy5cbiAqL1xuaW50ZXJmYWNlIFJlZmVyZW5jZSB7XG4gIC8qKlxuICAgKiBOYW1lIGdpdmVuIHRvIHRoZSBsb2NhbCByZWZlcmVuY2UgdmFyaWFibGUgd2l0aGluIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBpcyBub3QgdGhlIG5hbWUgd2hpY2ggd2lsbCBiZSB1c2VkIGZvciB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24gaW4gdGhlIGdlbmVyYXRlZFxuICAgKiB0ZW1wbGF0ZSBjb2RlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBgWHJlZklkYCBvZiB0aGUgZWxlbWVudC1saWtlIG5vZGUgd2hpY2ggdGhpcyByZWZlcmVuY2UgdGFyZ2V0cy5cbiAgICpcbiAgICogVGhlIHJlZmVyZW5jZSBtYXkgYmUgZWl0aGVyIHRvIHRoZSBlbGVtZW50IChvciB0ZW1wbGF0ZSkgaXRzZWxmLCBvciB0byBhIGRpcmVjdGl2ZSBvbiBpdC5cbiAgICovXG4gIHRhcmdldElkOiBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEEgZ2VuZXJhdGVkIG9mZnNldCBvZiB0aGlzIHJlZmVyZW5jZSBhbW9uZyBhbGwgdGhlIHJlZmVyZW5jZXMgb24gYSBzcGVjaWZpYyBlbGVtZW50LlxuICAgKi9cbiAgb2Zmc2V0OiBudW1iZXI7XG5cbiAgdmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGU7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIHZpZXcgYW5kIGdlbmVyYXRlIGEgYFNjb3BlYCByZXByZXNlbnRpbmcgdGhlIHZhcmlhYmxlcyBhdmFpbGFibGUgZm9yIHJlZmVyZW5jZSB3aXRoaW5cbiAqIHRoYXQgdmlldy5cbiAqL1xuZnVuY3Rpb24gZ2V0U2NvcGVGb3JWaWV3KHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudDogU2NvcGV8bnVsbCk6IFNjb3BlIHtcbiAgY29uc3Qgc2NvcGU6IFNjb3BlID0ge1xuICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICB2aWV3Q29udGV4dFZhcmlhYmxlOiB7XG4gICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0LFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICB9LFxuICAgIGNvbnRleHRWYXJpYWJsZXM6IG5ldyBNYXA8c3RyaW5nLCBpci5TZW1hbnRpY1ZhcmlhYmxlPigpLFxuICAgIHJlZmVyZW5jZXM6IFtdLFxuICAgIHBhcmVudCxcbiAgfTtcblxuICBmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2Ygdmlldy5jb250ZXh0VmFyaWFibGVzLmtleXMoKSkge1xuICAgIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuc2V0KGlkZW50aWZpZXIsIHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgaWRlbnRpZmllcixcbiAgICAgIHRhcmdldDogbnVsbCxcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnQ6XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9wLmxvY2FsUmVmcykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBsb2NhbFJlZnMgdG8gYmUgYW4gYXJyYXlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlY29yZCBhdmFpbGFibGUgbG9jYWwgcmVmZXJlbmNlcyBmcm9tIHRoaXMgZWxlbWVudC5cbiAgICAgICAgZm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDwgb3AubG9jYWxSZWZzLmxlbmd0aDsgb2Zmc2V0KyspIHtcbiAgICAgICAgICBzY29wZS5yZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogb3AubG9jYWxSZWZzW29mZnNldF0ubmFtZSxcbiAgICAgICAgICAgIHRhcmdldElkOiBvcC54cmVmLFxuICAgICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcixcbiAgICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgICAgaWRlbnRpZmllcjogb3AubG9jYWxSZWZzW29mZnNldF0ubmFtZSxcbiAgICAgICAgICAgICAgdGFyZ2V0OiBvcC54cmVmLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2NvcGU7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgZGVjbGFyYXRpb25zIGZvciBhbGwgdmFyaWFibGVzIHRoYXQgYXJlIGluIHNjb3BlIGZvciBhIGdpdmVuIHZpZXcuXG4gKlxuICogVGhpcyBpcyBhIHJlY3Vyc2l2ZSBwcm9jZXNzLCBhcyB2aWV3cyBpbmhlcml0IHZhcmlhYmxlcyBhdmFpbGFibGUgZnJvbSB0aGVpciBwYXJlbnQgdmlldywgd2hpY2hcbiAqIGl0c2VsZiBtYXkgaGF2ZSBpbmhlcml0ZWQgdmFyaWFibGVzLCBldGMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXc8T3BUIGV4dGVuZHMgaXIuT3A8T3BUPj4oXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgc2NvcGU6IFNjb3BlKTogaXIuVmFyaWFibGVPcDxPcFQ+W10ge1xuICBjb25zdCBuZXdPcHM6IGlyLlZhcmlhYmxlT3A8T3BUPltdID0gW107XG5cbiAgaWYgKHNjb3BlLnZpZXcgIT09IHZpZXcueHJlZikge1xuICAgIC8vIEJlZm9yZSBnZW5lcmF0aW5nIHZhcmlhYmxlcyBmb3IgYSBwYXJlbnQgdmlldywgd2UgbmVlZCB0byBzd2l0Y2ggdG8gdGhlIGNvbnRleHQgb2YgdGhlIHBhcmVudFxuICAgIC8vIHZpZXcgd2l0aCBhIGBuZXh0Q29udGV4dGAgZXhwcmVzc2lvbi4gVGhpcyBjb250ZXh0IHN3aXRjaGluZyBvcGVyYXRpb24gaXRzZWxmIGRlY2xhcmVzIGFcbiAgICAvLyB2YXJpYWJsZSwgYmVjYXVzZSB0aGUgY29udGV4dCBvZiB0aGUgdmlldyBtYXkgYmUgcmVmZXJlbmNlZCBkaXJlY3RseS5cbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBzY29wZS52aWV3Q29udGV4dFZhcmlhYmxlLCBuZXcgaXIuTmV4dENvbnRleHRFeHByKCksXG4gICAgICAgIC8qIGlzQ29uc3RhbnQgKi8gdHJ1ZSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGNvbnRleHQgdmFyaWFibGVzIGF2YWlsYWJsZSBpbiB0aGlzIHNjb3BlJ3Mgdmlldy5cbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIHZpZXcuam9iLnZpZXdzLmdldChzY29wZS52aWV3KSEuY29udGV4dFZhcmlhYmxlcykge1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgaXIuQ29udGV4dEV4cHIoc2NvcGUudmlldyk7XG4gICAgLy8gV2UgZWl0aGVyIHJlYWQgdGhlIGNvbnRleHQsIG9yLCBpZiB0aGUgdmFyaWFibGUgaXMgQ1RYX1JFRiwgdXNlIHRoZSBjb250ZXh0IGRpcmVjdGx5LlxuICAgIGNvbnN0IHZhcmlhYmxlID0gdmFsdWUgPT09IGlyLkNUWF9SRUYgPyBjb250ZXh0IDogbmV3IG8uUmVhZFByb3BFeHByKGNvbnRleHQsIHZhbHVlKTtcbiAgICAvLyBBZGQgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuZ2V0KG5hbWUpISwgdmFyaWFibGUsXG4gICAgICAgIC8qIGlzQ29uc3RhbnQgKi8gdHJ1ZSkpO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGxvY2FsIHJlZmVyZW5jZXMgZGVjbGFyZWQgZm9yIGVsZW1lbnRzIGluIHRoaXMgc2NvcGUuXG4gIGZvciAoY29uc3QgcmVmIG9mIHNjb3BlLnJlZmVyZW5jZXMpIHtcbiAgICBuZXdPcHMucHVzaChpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCByZWYudmFyaWFibGUsIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLm9mZnNldCksXG4gICAgICAgIC8qIGlzQ29uc3RhbnQgKi8gdHJ1ZSkpO1xuICB9XG5cbiAgaWYgKHNjb3BlLnBhcmVudCAhPT0gbnVsbCkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGFkZCB2YXJpYWJsZXMgZnJvbSB0aGUgcGFyZW50IHNjb3BlLlxuICAgIG5ld09wcy5wdXNoKC4uLmdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXc8T3BUPih2aWV3LCBzY29wZS5wYXJlbnQpKTtcbiAgfVxuICByZXR1cm4gbmV3T3BzO1xufVxuIl19