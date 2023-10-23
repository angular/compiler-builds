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
        newOps.push(ir.createVariableOp(view.job.allocateXrefId(), ref.variable, new ir.ReferenceExpr(ref.targetId, ref.offset), ir.VariableFlags.None));
    }
    if (scope.parent !== null) {
        // Recursively add variables from the parent scope.
        newOps.push(...generateVariablesInScopeForView(view, scope.parent));
    }
    return newOps;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZ2VuZXJhdGVfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUE0QjtJQUNqRSxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQXlCLEVBQUUsV0FBdUI7SUFDaEYsb0NBQW9DO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFakQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWM7Z0JBQzNCLHFDQUFxQztnQkFDckMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDNUQsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixtREFBbUQ7Z0JBQ25ELEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FB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RUFBRSxDQUFDLGdCQUFnQixDQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUN2RixFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDN0I7SUFFRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1FBQ3pCLG1EQUFtRDtRQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsK0JBQStCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3JFO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwcmVhbWJsZSBzZXF1ZW5jZSBmb3IgZWFjaCB2aWV3IGNyZWF0aW9uIGJsb2NrIGFuZCBsaXN0ZW5lciBmdW5jdGlvbiB3aGljaCBkZWNsYXJlc1xuICogYW55IHZhcmlhYmxlcyB0aGF0IGJlIHJlZmVyZW5jZWQgaW4gb3RoZXIgb3BlcmF0aW9ucyBpbiB0aGUgYmxvY2suXG4gKlxuICogVmFyaWFibGVzIGdlbmVyYXRlZCBpbmNsdWRlOlxuICogICAqIGEgc2F2ZWQgdmlldyBjb250ZXh0IHRvIGJlIHVzZWQgdG8gcmVzdG9yZSB0aGUgY3VycmVudCB2aWV3IGluIGV2ZW50IGxpc3RlbmVycy5cbiAqICAgKiB0aGUgY29udGV4dCBvZiB0aGUgcmVzdG9yZWQgdmlldyB3aXRoaW4gZXZlbnQgbGlzdGVuZXIgaGFuZGxlcnMuXG4gKiAgICogY29udGV4dCB2YXJpYWJsZXMgZnJvbSB0aGUgY3VycmVudCB2aWV3IGFzIHdlbGwgYXMgYWxsIHBhcmVudCB2aWV3cyAoaW5jbHVkaW5nIHRoZSByb290XG4gKiAgICAgY29udGV4dCBpZiBuZWVkZWQpLlxuICogICAqIGxvY2FsIHJlZmVyZW5jZXMgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldyBhbmQgYW55IGxleGljYWwgcGFyZW50cy5cbiAqXG4gKiBWYXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBoZXJlIHVuY29uZGl0aW9uYWxseSwgYW5kIG1heSBvcHRpbWl6ZWQgYXdheSBpbiBmdXR1cmUgb3BlcmF0aW9ucyBpZiBpdFxuICogdHVybnMgb3V0IHRoZWlyIHZhbHVlcyAoYW5kIGFueSBzaWRlIGVmZmVjdHMpIGFyZSB1bnVzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUdlbmVyYXRlVmFyaWFibGVzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyhqb2Iucm9vdCwgLyogdGhlcmUgaXMgbm8gcGFyZW50IHNjb3BlIGZvciB0aGUgcm9vdCB2aWV3ICovIG51bGwpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIGdpdmVuIGBWaWV3Q29tcGlsYXRpb25gIGFuZCBnZW5lcmF0ZSBwcmVhbWJsZXMgZm9yIGl0IGFuZCBhbnkgbGlzdGVuZXJzIHRoYXQgaXRcbiAqIGRlY2xhcmVzLlxuICpcbiAqIEBwYXJhbSBgcGFyZW50U2NvcGVgIGEgc2NvcGUgZXh0cmFjdGVkIGZyb20gdGhlIHBhcmVudCB2aWV3IHdoaWNoIGNhcHR1cmVzIGFueSB2YXJpYWJsZXMgd2hpY2hcbiAqICAgICBzaG91bGQgYmUgaW5oZXJpdGVkIGJ5IHRoaXMgdmlldy4gYG51bGxgIGlmIHRoZSBjdXJyZW50IHZpZXcgaXMgdGhlIHJvb3Qgdmlldy5cbiAqL1xuZnVuY3Rpb24gcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBwYXJlbnRTY29wZTogU2NvcGV8bnVsbCk6IHZvaWQge1xuICAvLyBFeHRyYWN0IGEgYFNjb3BlYCBmcm9tIHRoaXMgdmlldy5cbiAgY29uc3Qgc2NvcGUgPSBnZXRTY29wZUZvclZpZXcodmlldywgcGFyZW50U2NvcGUpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgY2FzZSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGU6XG4gICAgICAgIC8vIERlc2NlbmQgaW50byBjaGlsZCBlbWJlZGRlZCB2aWV3cy5cbiAgICAgICAgcmVjdXJzaXZlbHlQcm9jZXNzVmlldyh2aWV3LmpvYi52aWV3cy5nZXQob3AueHJlZikhLCBzY29wZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIC8vIFByZXBlbmQgdmFyaWFibGVzIHRvIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb25zLlxuICAgICAgICBvcC5oYW5kbGVyT3BzLnByZXBlbmQoZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZSkpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBQcmVwZW5kIHRoZSBkZWNsYXJhdGlvbnMgZm9yIGFsbCBhdmFpbGFibGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIHRoZSBgdXBkYXRlYCBibG9jay5cbiAgY29uc3QgcHJlYW1ibGVPcHMgPSBnZW5lcmF0ZVZhcmlhYmxlc0luU2NvcGVGb3JWaWV3KHZpZXcsIHNjb3BlKTtcbiAgdmlldy51cGRhdGUucHJlcGVuZChwcmVhbWJsZU9wcyk7XG59XG5cbi8qKlxuICogTGV4aWNhbCBzY29wZSBvZiBhIHZpZXcsIGluY2x1ZGluZyBhIHJlZmVyZW5jZSB0byBpdHMgcGFyZW50IHZpZXcncyBzY29wZSwgaWYgYW55LlxuICovXG5pbnRlcmZhY2UgU2NvcGUge1xuICAvKipcbiAgICogYFhyZWZJZGAgb2YgdGhlIHZpZXcgdG8gd2hpY2ggdGhpcyBzY29wZSBjb3JyZXNwb25kcy5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICB2aWV3Q29udGV4dFZhcmlhYmxlOiBpci5TZW1hbnRpY1ZhcmlhYmxlO1xuXG4gIGNvbnRleHRWYXJpYWJsZXM6IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+O1xuXG4gIGFsaWFzZXM6IFNldDxpci5BbGlhc1ZhcmlhYmxlPjtcblxuICAvKipcbiAgICogTG9jYWwgcmVmZXJlbmNlcyBjb2xsZWN0ZWQgZnJvbSBlbGVtZW50cyB3aXRoaW4gdGhlIHZpZXcuXG4gICAqL1xuICByZWZlcmVuY2VzOiBSZWZlcmVuY2VbXTtcblxuICAvKipcbiAgICogYFNjb3BlYCBvZiB0aGUgcGFyZW50IHZpZXcsIGlmIGFueS5cbiAgICovXG4gIHBhcmVudDogU2NvcGV8bnVsbDtcbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBuZWVkZWQgYWJvdXQgYSBsb2NhbCByZWZlcmVuY2UgY29sbGVjdGVkIGZyb20gYW4gZWxlbWVudCB3aXRoaW4gYSB2aWV3LlxuICovXG5pbnRlcmZhY2UgUmVmZXJlbmNlIHtcbiAgLyoqXG4gICAqIE5hbWUgZ2l2ZW4gdG8gdGhlIGxvY2FsIHJlZmVyZW5jZSB2YXJpYWJsZSB3aXRoaW4gdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGlzIG5vdCB0aGUgbmFtZSB3aGljaCB3aWxsIGJlIHVzZWQgZm9yIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpbiB0aGUgZ2VuZXJhdGVkXG4gICAqIHRlbXBsYXRlIGNvZGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIGBYcmVmSWRgIG9mIHRoZSBlbGVtZW50LWxpa2Ugbm9kZSB3aGljaCB0aGlzIHJlZmVyZW5jZSB0YXJnZXRzLlxuICAgKlxuICAgKiBUaGUgcmVmZXJlbmNlIG1heSBiZSBlaXRoZXIgdG8gdGhlIGVsZW1lbnQgKG9yIHRlbXBsYXRlKSBpdHNlbGYsIG9yIHRvIGEgZGlyZWN0aXZlIG9uIGl0LlxuICAgKi9cbiAgdGFyZ2V0SWQ6IGlyLlhyZWZJZDtcblxuICAvKipcbiAgICogQSBnZW5lcmF0ZWQgb2Zmc2V0IG9mIHRoaXMgcmVmZXJlbmNlIGFtb25nIGFsbCB0aGUgcmVmZXJlbmNlcyBvbiBhIHNwZWNpZmljIGVsZW1lbnQuXG4gICAqL1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICB2YXJpYWJsZTogaXIuU2VtYW50aWNWYXJpYWJsZTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgdmlldyBhbmQgZ2VuZXJhdGUgYSBgU2NvcGVgIHJlcHJlc2VudGluZyB0aGUgdmFyaWFibGVzIGF2YWlsYWJsZSBmb3IgcmVmZXJlbmNlIHdpdGhpblxuICogdGhhdCB2aWV3LlxuICovXG5mdW5jdGlvbiBnZXRTY29wZUZvclZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50OiBTY29wZXxudWxsKTogU2NvcGUge1xuICBjb25zdCBzY29wZTogU2NvcGUgPSB7XG4gICAgdmlldzogdmlldy54cmVmLFxuICAgIHZpZXdDb250ZXh0VmFyaWFibGU6IHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgdmlldzogdmlldy54cmVmLFxuICAgIH0sXG4gICAgY29udGV4dFZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIGlyLlNlbWFudGljVmFyaWFibGU+KCksXG4gICAgYWxpYXNlczogdmlldy5hbGlhc2VzLFxuICAgIHJlZmVyZW5jZXM6IFtdLFxuICAgIHBhcmVudCxcbiAgfTtcblxuICBmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2Ygdmlldy5jb250ZXh0VmFyaWFibGVzLmtleXMoKSkge1xuICAgIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuc2V0KGlkZW50aWZpZXIsIHtcbiAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgaWRlbnRpZmllcixcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob3AubG9jYWxSZWZzKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGxvY2FsUmVmcyB0byBiZSBhbiBhcnJheWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGF2YWlsYWJsZSBsb2NhbCByZWZlcmVuY2VzIGZyb20gdGhpcyBlbGVtZW50LlxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBvcC5sb2NhbFJlZnMubGVuZ3RoOyBvZmZzZXQrKykge1xuICAgICAgICAgIHNjb3BlLnJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgdGFyZ2V0SWQ6IG9wLnhyZWYsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICB2YXJpYWJsZToge1xuICAgICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgICBpZGVudGlmaWVyOiBvcC5sb2NhbFJlZnNbb2Zmc2V0XS5uYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2NvcGU7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgZGVjbGFyYXRpb25zIGZvciBhbGwgdmFyaWFibGVzIHRoYXQgYXJlIGluIHNjb3BlIGZvciBhIGdpdmVuIHZpZXcuXG4gKlxuICogVGhpcyBpcyBhIHJlY3Vyc2l2ZSBwcm9jZXNzLCBhcyB2aWV3cyBpbmhlcml0IHZhcmlhYmxlcyBhdmFpbGFibGUgZnJvbSB0aGVpciBwYXJlbnQgdmlldywgd2hpY2hcbiAqIGl0c2VsZiBtYXkgaGF2ZSBpbmhlcml0ZWQgdmFyaWFibGVzLCBldGMuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVzSW5TY29wZUZvclZpZXcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgc2NvcGU6IFNjb3BlKTogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSB7XG4gIGNvbnN0IG5ld09wczogaXIuVmFyaWFibGVPcDxpci5VcGRhdGVPcD5bXSA9IFtdO1xuXG4gIGlmIChzY29wZS52aWV3ICE9PSB2aWV3LnhyZWYpIHtcbiAgICAvLyBCZWZvcmUgZ2VuZXJhdGluZyB2YXJpYWJsZXMgZm9yIGEgcGFyZW50IHZpZXcsIHdlIG5lZWQgdG8gc3dpdGNoIHRvIHRoZSBjb250ZXh0IG9mIHRoZSBwYXJlbnRcbiAgICAvLyB2aWV3IHdpdGggYSBgbmV4dENvbnRleHRgIGV4cHJlc3Npb24uIFRoaXMgY29udGV4dCBzd2l0Y2hpbmcgb3BlcmF0aW9uIGl0c2VsZiBkZWNsYXJlcyBhXG4gICAgLy8gdmFyaWFibGUsIGJlY2F1c2UgdGhlIGNvbnRleHQgb2YgdGhlIHZpZXcgbWF5IGJlIHJlZmVyZW5jZWQgZGlyZWN0bHkuXG4gICAgbmV3T3BzLnB1c2goaXIuY3JlYXRlVmFyaWFibGVPcChcbiAgICAgICAgdmlldy5qb2IuYWxsb2NhdGVYcmVmSWQoKSwgc2NvcGUudmlld0NvbnRleHRWYXJpYWJsZSwgbmV3IGlyLk5leHRDb250ZXh0RXhwcigpLFxuICAgICAgICBpci5WYXJpYWJsZUZsYWdzLk5vbmUpKTtcbiAgfVxuXG4gIC8vIEFkZCB2YXJpYWJsZXMgZm9yIGFsbCBjb250ZXh0IHZhcmlhYmxlcyBhdmFpbGFibGUgaW4gdGhpcyBzY29wZSdzIHZpZXcuXG4gIGNvbnN0IHNjb3BlVmlldyA9IHZpZXcuam9iLnZpZXdzLmdldChzY29wZS52aWV3KSE7XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBzY29wZVZpZXcuY29udGV4dFZhcmlhYmxlcykge1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgaXIuQ29udGV4dEV4cHIoc2NvcGUudmlldyk7XG4gICAgLy8gV2UgZWl0aGVyIHJlYWQgdGhlIGNvbnRleHQsIG9yLCBpZiB0aGUgdmFyaWFibGUgaXMgQ1RYX1JFRiwgdXNlIHRoZSBjb250ZXh0IGRpcmVjdGx5LlxuICAgIGNvbnN0IHZhcmlhYmxlID0gdmFsdWUgPT09IGlyLkNUWF9SRUYgPyBjb250ZXh0IDogbmV3IG8uUmVhZFByb3BFeHByKGNvbnRleHQsIHZhbHVlKTtcbiAgICAvLyBBZGQgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHNjb3BlLmNvbnRleHRWYXJpYWJsZXMuZ2V0KG5hbWUpISwgdmFyaWFibGUsXG4gICAgICAgIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSkpO1xuICB9XG5cbiAgZm9yIChjb25zdCBhbGlhcyBvZiBzY29wZVZpZXcuYWxpYXNlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIGFsaWFzLCBhbGlhcy5leHByZXNzaW9uLmNsb25lKCksIGlyLlZhcmlhYmxlRmxhZ3MuQWx3YXlzSW5saW5lKSk7XG4gIH1cblxuICAvLyBBZGQgdmFyaWFibGVzIGZvciBhbGwgbG9jYWwgcmVmZXJlbmNlcyBkZWNsYXJlZCBmb3IgZWxlbWVudHMgaW4gdGhpcyBzY29wZS5cbiAgZm9yIChjb25zdCByZWYgb2Ygc2NvcGUucmVmZXJlbmNlcykge1xuICAgIG5ld09wcy5wdXNoKGlyLmNyZWF0ZVZhcmlhYmxlT3AoXG4gICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHJlZi52YXJpYWJsZSwgbmV3IGlyLlJlZmVyZW5jZUV4cHIocmVmLnRhcmdldElkLCByZWYub2Zmc2V0KSxcbiAgICAgICAgaXIuVmFyaWFibGVGbGFncy5Ob25lKSk7XG4gIH1cblxuICBpZiAoc2NvcGUucGFyZW50ICE9PSBudWxsKSB7XG4gICAgLy8gUmVjdXJzaXZlbHkgYWRkIHZhcmlhYmxlcyBmcm9tIHRoZSBwYXJlbnQgc2NvcGUuXG4gICAgbmV3T3BzLnB1c2goLi4uZ2VuZXJhdGVWYXJpYWJsZXNJblNjb3BlRm9yVmlldyh2aWV3LCBzY29wZS5wYXJlbnQpKTtcbiAgfVxuICByZXR1cm4gbmV3T3BzO1xufVxuIl19