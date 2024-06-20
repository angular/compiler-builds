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
                // Descend into child embedded views.
                recursivelyProcessView(view.job.views.get(op.xref), scope);
                break;
            case ir.OpKind.Projection:
                if (op.fallbackView !== null) {
                    recursivelyProcessView(view.job.views.get(op.fallbackView), scope);
                }
                break;
            case ir.OpKind.RepeaterCreate:
                // Descend into child embedded views.
                recursivelyProcessView(view.job.views.get(op.xref), scope);
                if (op.emptyView) {
                    recursivelyProcessView(view.job.views.get(op.emptyView), scope);
                }
                break;
            case ir.OpKind.Listener:
            case ir.OpKind.TwoWayListener:
                // Prepend variables to listener handler functions.
                op.handlerOps.prepend(generateVariablesInScopeForView(view, scope, true));
                break;
        }
    }
    view.update.prepend(generateVariablesInScopeForView(view, scope, false));
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
        letDeclarations: [],
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
            case ir.OpKind.DeclareLet:
                scope.letDeclarations.push({
                    targetId: op.xref,
                    targetSlot: op.handle,
                    variable: {
                        kind: ir.SemanticVariableKind.Identifier,
                        name: null,
                        identifier: op.declaredName,
                    },
                });
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
function generateVariablesInScopeForView(view, scope, isListener) {
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
    if (scope.view !== view.xref || isListener) {
        for (const decl of scope.letDeclarations) {
            newOps.push(ir.createVariableOp(view.job.allocateXrefId(), decl.variable, new ir.ContextLetReferenceExpr(decl.targetId, decl.targetSlot), ir.VariableFlags.None));
        }
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent, false));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXlCLEVBQUUsV0FBeUI7SUFDbEYsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDN0IsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLHFDQUFxQztnQkFDckMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDNUQsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFVO2dCQUN2QixJQUFJLEVBQUUsQ0FBQyxZQUFZLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQzdCLHNCQUFzQixDQUFDLElBQUksQ0FB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LENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbkMsTUFBTSxDQUFDLElBQUksQ0FDVCxFQUFFLENBQUMsZ0JBQWdCLENBQ2pCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQ3pCLEdBQUcsQ0FBQyxRQUFRLEVBQ1osSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQzlELEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUN0QixDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLElBQUksVUFBVSxFQUFFLENBQUM7UUFDM0MsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDekMsTUFBTSxDQUFDLElBQUksQ0FDVCxFQUFFLENBQUMsZ0JBQWdCLENBQ2pCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQ3pCLElBQUksQ0FBQyxRQUFRLEVBQ2IsSUFBSSxFQUFFLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQzlELEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUN0QixDQUNGLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUMxQixtREFBbUQ7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLCtCQUErQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgcHJlYW1ibGUgc2VxdWVuY2UgZm9yIGVhY2ggdmlldyBjcmVhdGlvbiBibG9jayBhbmQgbGlzdGVuZXIgZnVuY3Rpb24gd2hpY2ggZGVjbGFyZXNcbiAqIGFueSB2YXJpYWJsZXMgdGhhdCBiZSByZWZlcmVuY2VkIGluIG90aGVyIG9wZXJhdGlvbnMgaW4gdGhlIGJsb2NrLlxuICpcbiAqIFZhcmlhYmxlcyBnZW5lcmF0ZWQgaW5jbHVkZTpcbiAqICAgKiBhIHNhdmVkIHZpZXcgY29udGV4dCB0byBiZSB1c2VkIHRvIHJlc3RvcmUgdGhlIGN1cnJlbnQgdmlldyBpbiBldmVudCBsaXN0ZW5lcnMuXG4gKiAgICogdGhlIGNvbnRleHQgb2YgdGhlIHJlc3RvcmVkIHZpZXcgd2l0aGluIGV2ZW50IGxpc3RlbmVyIGhhbmRsZXJzLlxuICogICAqIGNvbnRleHQgdmFyaWFibGVzIGZyb20gdGhlIGN1cnJlbnQgdmlldyBhcyB3ZWxsIGFzIGFsbCBwYXJlbnQgdmlld3MgKGluY2x1ZGluZyB0aGUgcm9vdFxuICogICAgIGNvbnRleHQgaWYgbmVlZGVkKS5cbiAqICAgKiBsb2NhbCByZWZlcmVuY2VzIGZyb20gZWxlbWVudHMgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcgYW5kIGFueSBsZXhpY2FsIHBhcmVudHMuXG4gKlxuICogVmFyaWFibGVzIGFyZSBnZW5lcmF0ZWQgaGVyZSB1bmNvbmRpdGlvbmFsbHksIGFuZCBtYXkgb3B0aW1pemVkIGF3YXkgaW4gZnV0dXJlIG9wZXJhdGlvbnMgaWYgaXRcbiAqIHR1cm5zIG91dCB0aGVpciB2YWx1ZXMgKGFuZCBhbnkgc2lkZSBlZmZlY3RzKSBhcmUgdW51c2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVWYXJpYWJsZXMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KGpvYi5yb290LCAvKiB0aGVyZSBpcyBubyBwYXJlbnQgc2NvcGUgZm9yIHRoZSByb290IHZpZXcgKi8gbnVsbCk7XG59XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgZ2l2ZW4gYFZpZXdDb21waWxhdGlvbmAgYW5kIGdlbmVyYXRlIHByZWFtYmxlcyBmb3IgaXQgYW5kIGFueSBsaXN0ZW5lcnMgdGhhdCBpdFxuICogZGVjbGFyZXMuXG4gKlxuICogQHBhcmFtIGBwYXJlbnRTY29wZWAgYSBzY29wZSBleHRyYWN0ZWQgZnJvbSB0aGUgcGFyZW50IHZpZXcgd2hpY2ggY2FwdHVyZXMgYW55IHZhcmlhYmxlcyB3aGljaFxuICogICAgIHNob3VsZCBiZSBpbmhlcml0ZWQgYnkgdGhpcyB2aWV3LiBgbnVsbGAgaWYgdGhlIGN1cnJlbnQgdmlldyBpcyB0aGUgcm9vdCB2aWV3LlxuICovXG5mdW5jdGlvbiByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudFNjb3BlOiBTY29wZSB8IG51bGwpOiB2b2lkIHtcbiAgLy8gRXh0cmFjdCBhIGBTY29wZWAgZnJvbSB0aGlzIHZpZXcuXG4gIGNvbnN0IHNjb3BlID0gZ2V0U2NvcGVGb3JWaWV3KHZpZXcsIHBhcmVudFNjb3BlKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIGNoaWxkIGVtYmVkZGVkIHZpZXdzLlxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3NWaWV3KHZpZXcuam9iLnZpZXdzLmdldChvcC54cmVmKSEsIHNjb3BlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9qZWN0aW9uOlxuICAgICAgICBpZiAob3AuZmFsbGJhY2tWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3LmpvYi52aWV3cy5nZXQob3AuZmFsbGJhY2tWaWV3KSEsIHNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICAvLyBEZXNjZW5kIGludG8gY2hpbGQgZW1iZWRkZWQgdmlld3MuXG4gICAgICAgIHJlY3Vyc2l2ZWx5UHJvY2Vzc1ZpZXcodmlldy5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISwgc2NvcGUpO1xuICAgICAgICBpZiAob3AuZW1wdHlWaWV3KSB7XG4gICAgICAgICAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KSEsIHNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgY2FzZSBpci5PcEtpbmQuVHdvV2F5TGlzdGVuZXI6XG4gICAgICAgIC8vIFByZXBlbmQgdmFyaWFibGVzIHRvIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb25zLlxuICAgICAgICBvcC5oYW5kbGVyT3BzLnByZXBlbmQoZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSwgdHJ1ZSkpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2aWV3LnVwZGF0ZS5wcmVwZW5kKGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUsIGZhbHNlKSk7XG59XG5cbi8qKlxuICogTGV4aWNhbCBzY29wZSBvZiBhIHZpZXcsIGluY2x1ZGluZyBhIHJlZmVyZW5jZSB0byBpdHMgcGFyZW50IHZpZXcncyBzY29wZSwgaWYgYW55LlxuICovXG5pbnRlcmZhY2UgU2NvcGUge1xuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIHZpZXcgdG8gd2hpY2ggdGhpcyBzY29wZSBjb3JyZXNwb25kcy5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICB2aWV3Q29udGV4dFZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlO1xuXG4gIGNvbnRleHRWYXJpYWJsZXM6IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+O1xuXG4gIGFsaWFzZXM6IFNldDxpci5BbGlhc1ZhcmlhYmxlPjtcblxuICAvKipcbiAgICogTG9jYWwgcmVmZXJlbmNlcyBjb2xsZWN0ZWQgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIHZpZXcuXG4gICAqL1xuICByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogYEBsZXRgIGRlY2xhcmF0aW9ucyBjb2xsZWN0ZWQgZnJvbSB0aGUgdmlldy5cbiAgICovXG4gIGxldERlY2xhcmF0aW9uczogTGV0RGVjbGFyYXRpb25bXTtcblxuICAvKipcbiAgICogYFNjb3BlYCBvZiB0aGUgcGFyZW50IHZpZXcsIGlmIGFueS5cbiAgICovXG4gIHBhcmVudDogU2NvcGUgfCBudWxsO1xufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG5lZWRlZCBhYm91dCBhIGxvY2FsIHJlZmVyZW5jZSBjb2xsZWN0ZWQgZnJvbSBhbiBlbGVtZW50IHdpdGhpbiBhIHZpZXcuXG4gKi9cbmludGVyZmFjZSBSZWZlcmVuY2Uge1xuICAvKipcbiAgICogTmFtZSBnaXZlbiB0byB0aGUgbG9jYWwgcmVmZXJlbmNlIHZhcmlhYmxlIHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IHRoZSBuYW1lIHdoaWNoIHdpbGwgYmUgdXNlZCBmb3IgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGluIHRoZSBnZW5lcmF0ZWRcbiAgICogdGVtcGxhdGUgY29kZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIGVsZW1lbnQtbGlrZSBub2RlIHdoaWNoIHRoaXMgcmVmZXJlbmNlIHRhcmdldHMuXG4gICAqXG4gICAqIFRoZSByZWZlcmVuY2UgbWF5IGJlIGVpdGhlciB0byB0aGUgZWxlbWVudCAob3IgdGVtcGxhdGUpIGl0c2VsZiwgb3IgdG8gYSBkaXJlY3RpdmUgb24gaXQuXG4gICAqL1xuICB0YXJnZXRJZDogaXIuWHJlZklkO1xuXG4gIHRhcmdldFNsb3Q6IGlyLlNsb3RIYW5kbGU7XG5cbiAgLyoqXG4gICAqIEEgZ2VuZXJhdGVkIG9mZnNldCBvZiB0aGlzIHJlZmVyZW5jZSBhbW9uZyBhbGwgdGhlIHJlZmVyZW5jZXMgb24gYSBzcGVjaWZpYyBlbGVtZW50LlxuICAgKi9cbiAgb2Zmc2V0OiBudW1iZXI7XG5cbiAgdmFyaWFibGU6IGlyLlNlbWFudGljVmFyaWFibGU7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgYEBsZXRgIGRlY2xhcmF0aW9uIGNvbGxlY3RlZCBmcm9tIGEgdmlldy5cbiAqL1xuaW50ZXJmYWNlIExldERlY2xhcmF0aW9uIHtcbiAgLyoqIGBYcmVmSWRgIG9mIHRoZSBgQGxldGAgZGVjbGFyYXRpb24gdGhhdCB0aGUgcmVmZXJlbmNlIGlzIHBvaW50aW5nIHRvLiAqL1xuICB0YXJnZXRJZDogaXIuWHJlZklkO1xuXG4gIC8qKiBTbG90IGluIHdoaWNoIHRoZSBkZWNsYXJhdGlvbiBpcyBzdG9yZWQuICovXG4gIHRhcmdldFNsb3Q6IGlyLlNsb3RIYW5kbGU7XG5cbiAgLyoqIFZhcmlhYmxlIHJlZmVycmluZyB0byB0aGUgZGVjbGFyYXRpb24uICovXG4gIHZhcmlhYmxlOiBpci5JZGVudGlmaWVyVmFyaWFibGU7XG59XG5cbi8qKlxuICogUHJvY2VzcyBhIHZpZXcgYW5kIGdlbmVyYXRlIGEgYFNjb3BlYCByZXByZXNlbnRpbmcgdGhlIHZhcmlhYmxlcyBhdmFpbGFibGUgZm9yIHJlZmVyZW5jZSB3aXRoaW5cbiAqIHRoYXQgdmlldy5cbiAqL1xuZnVuY3Rpb24gZ2V0U2NvcGVGb3JWaWV3KHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudDogU2NvcGUgfCBudWxsKTogU2NvcGUge1xuICBjb25zdCBzY29wZTogU2NvcGUgPSB7XG4gICAgdmlldzogdmlldy54cmVmLFxuICAgIHZpZXdDb250ZXh0VmFyaWFibGU6IHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgYWxpYXNlczogdmlldy5hbGlhc2VzLFxuICAgIHJlZmVyZW5jZXM6IFtdLFxuICAgIGxldERlY2xhcmF0aW9uczogW10sXG4gICAgcGFyZW50LFxuICB9O1xuXG4gIGZvciAoY29uc3QgaWRlbnRpZmllciBvZiB2aWV3LmNvbnRleHRWYXJpYWJsZXMua2V5cygpKSB7XG4gICAgc2NvcGUuY29udGV4dFZhcmlhYmxlcy5zZXQoaWRlbnRpZmllciwge1xuICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcixcbiAgICAgIG5hbWU6IG51bGwsXG4gICAgICBpZGVudGlmaWVyLFxuICAgIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvcC5sb2NhbFJlZnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgbG9jYWxSZWZzIHRvIGJlIGFuIGFycmF5YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgYXZhaWxhYmxlIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSB0aGlzIGVsZW1lbnQuXG4gICAgICAgIGZvciAobGV0IG9mZnNldCA9IDA7IG9mZnNldCA8IG9wLmxvY2FsUmVmcy5sZW5ndGg7IG9mZnNldCsrKSB7XG4gICAgICAgICAgc2NvcGUucmVmZXJlbmNlcy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IG9wLmxvY2FsUmVmc1tvZmZzZXRdLm5hbWUsXG4gICAgICAgICAgICB0YXJnZXRJZDogb3AueHJlZixcbiAgICAgICAgICAgIHRhcmdldFNsb3Q6IG9wLmhhbmRsZSxcbiAgICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICAgIGlkZW50aWZpZXI6IG9wLmxvY2FsUmVmc1tvZmZzZXRdLm5hbWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIGlyLk9wS2luZC5EZWNsYXJlTGV0OlxuICAgICAgICBzY29wZS5sZXREZWNsYXJhdGlvbnMucHVzaCh7XG4gICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgdGFyZ2V0U2xvdDogb3AuaGFuZGxlLFxuICAgICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIGlkZW50aWZpZXI6IG9wLmRlY2xhcmVkTmFtZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHNjb3BlO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGRlY2xhcmF0aW9ucyBmb3IgYWxsIHZhcmlhYmxlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3IgYSBnaXZlbiB2aWV3LlxuICpcbiAqIFRoaXMgaXMgYSByZWN1cnNpdmUgcHJvY2VzcywgYXMgdmlld3MgaW5oZXJpdCB2YXJpYWJsZXMgYXZhaWxhYmxlIGZyb20gdGhlaXIgcGFyZW50IHZpZXcsIHdoaWNoXG4gKiBpdHNlbGYgbWF5IGhhdmUgaW5oZXJpdGVkIHZhcmlhYmxlcywgZXRjLlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KFxuICB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LFxuICBzY29wZTogU2NvcGUsXG4gIGlzTGlzdGVuZXI6IGJvb2xlYW4sXG4pOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdIHtcbiAgY29uc3QgbmV3T3BzOiBpci5WYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPltdID0gW107XG5cbiAgaWYgKHNjb3BlLnZpZXcgIT09IHZpZXcueHJlZikge1xuICAgIC8vIEJlZm9yZSBnZW5lcmF0aW5nIHZhcmlhYmxlcyBmb3IgYSBwYXJlbnQgdmlldywgd2UgbmVlZCB0byBzd2l0Y2ggdG8gdGhlIGNvbnRleHQgb2YgdGhlIHBhcmVudFxuICAgIC8vIHZpZXcgd2l0aCBhIGBuZXh0Q29udGV4dGAgZXhwcmVzc2lvbi4gVGhpcyBjb250ZXh0IHN3aXRjaGluZyBvcGVyYXRpb24gaXRzZWxmIGRlY2xhcmVzIGFcbiAgICAvLyB2YXJpYWJsZSwgYmVjYXVzZSB0aGUgY29udGV4dCBvZiB0aGUgdmlldyBtYXkgYmUgcmVmZXJlbmNlZCBkaXJlY3RseS5cbiAgICBuZXdPcHMucHVzaChcbiAgICAgIGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksXG4gICAgICAgIHNjb3BlLnZpZXdDb250ZXh0VmFyaWFibGUsXG4gICAgICAgIG5ldyBpci5OZXh0Q29udGV4dEV4cHIoKSxcbiAgICAgICAgaXIuVmFyaWFibGVGbGFncy5Ob25lLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgLy8gQWRkIHZhcmlhYmxlcyBmb3IgYWxsIGNvbnRleHQgdmFyaWFibGVzIGF2YWlsYWJsZSBpbiB0aGlzIHNjb3BlJ3Mgdmlldy5cbiAgY29uc3Qgc2NvcGVWaWV3ID0gdmlldy5qb2Iudmlld3MuZ2V0KHNjb3BlLnZpZXcpITtcbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIHNjb3BlVmlldy5jb250ZXh0VmFyaWFibGVzKSB7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBpci5Db250ZXh0RXhwcihzY29wZS52aWV3KTtcbiAgICAvLyBXZSBlaXRoZXIgcmVhZCB0aGUgY29udGV4dCwgb3IsIGlmIHRoZSB2YXJpYWJsZSBpcyBDVFhfUkVGLCB1c2UgdGhlIGNvbnRleHQgZGlyZWN0bHkuXG4gICAgY29uc3QgdmFyaWFibGUgPSB2YWx1ZSA9PT0gaXIuQ1RYX1JFRiA/IGNvbnRleHQgOiBuZXcgby5SZWFkUHJvcEV4cHIoY29udGV4dCwgdmFsdWUpO1xuICAgIC8vIEFkZCB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb24uXG4gICAgbmV3T3BzLnB1c2goXG4gICAgICBpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBzY29wZS5jb250ZXh0VmFyaWFibGVzLmdldChuYW1lKSEsXG4gICAgICAgIHZhcmlhYmxlLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLk5vbmUsXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGFsaWFzIG9mIHNjb3BlVmlldy5hbGlhc2VzKSB7XG4gICAgbmV3T3BzLnB1c2goXG4gICAgICBpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICBhbGlhcyxcbiAgICAgICAgYWxpYXMuZXhwcmVzc2lvbi5jbG9uZSgpLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLkFsd2F5c0lubGluZSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBsb2NhbCByZWZlcmVuY2VzIGRlY2xhcmVkIGZvciBlbGVtZW50cyBpbiB0aGlzIHNjb3BlLlxuICBmb3IgKGNvbnN0IHJlZiBvZiBzY29wZS5yZWZlcmVuY2VzKSB7XG4gICAgbmV3T3BzLnB1c2goXG4gICAgICBpci5jcmVhdGVWYXJpYWJsZU9wKFxuICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLFxuICAgICAgICByZWYudmFyaWFibGUsXG4gICAgICAgIG5ldyBpci5SZWZlcmVuY2VFeHByKHJlZi50YXJnZXRJZCwgcmVmLnRhcmdldFNsb3QsIHJlZi5vZmZzZXQpLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLk5vbmUsXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NvcGUudmlldyAhPT0gdmlldy54cmVmIHx8IGlzTGlzdGVuZXIpIHtcbiAgICBmb3IgKGNvbnN0IGRlY2wgb2Ygc2NvcGUubGV0RGVjbGFyYXRpb25zKSB7XG4gICAgICBuZXdPcHMucHVzaChcbiAgICAgICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5VcGRhdGVPcD4oXG4gICAgICAgICAgdmlldy5qb2IuYWxsb2NhdGVYcmVmSWQoKSxcbiAgICAgICAgICBkZWNsLnZhcmlhYmxlLFxuICAgICAgICAgIG5ldyBpci5Db250ZXh0TGV0UmVmZXJlbmNlRXhwcihkZWNsLnRhcmdldElkLCBkZWNsLnRhcmdldFNsb3QpLFxuICAgICAgICAgIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHNjb3BlLnBhcmVudCAhPT0gbnVsbCkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGFkZCB2YXJpYWJsZXMgZnJvbSB0aGUgcGFyZW50IHNjb3BlLlxuICAgIG5ld09wcy5wdXNoKC4uLmdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcodmlldywgc2NvcGUucGFyZW50LCBmYWxzZSkpO1xuICB9XG4gIHJldHVybiBuZXdPcHM7XG59XG4iXX0=