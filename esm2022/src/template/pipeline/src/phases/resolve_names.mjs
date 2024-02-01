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
 * Resolves lexical references in views (`ir.LexicalReadExpr`) to either a target variable or to
 * property reads on the top-level component context.
 *
 * Also matches `ir.RestoreViewExpr` expressions with the variables of their corresponding saved
 * views.
 */
export function resolveNames(job) {
    for (const unit of job.units) {
        processLexicalScope(unit, unit.create, null);
        processLexicalScope(unit, unit.update, null);
    }
}
function processLexicalScope(unit, ops, savedView) {
    // Maps names defined in the lexical scope of this template to the `ir.XrefId`s of the variable
    // declarations which represent those values.
    //
    // Since variables are generated in each view for the entire lexical scope (including any
    // identifiers from parent templates) only local variables need be considered here.
    const scope = new Map();
    // First, step through the operations list and:
    // 1) build up the `scope` mapping
    // 2) recurse into any listener functions
    for (const op of ops) {
        switch (op.kind) {
            case ir.OpKind.Variable:
                switch (op.variable.kind) {
                    case ir.SemanticVariableKind.Identifier:
                    case ir.SemanticVariableKind.Alias:
                        // This variable represents some kind of identifier which can be used in the template.
                        if (scope.has(op.variable.identifier)) {
                            continue;
                        }
                        scope.set(op.variable.identifier, op.xref);
                        break;
                    case ir.SemanticVariableKind.SavedView:
                        // This variable represents a snapshot of the current view context, and can be used to
                        // restore that context within listener functions.
                        savedView = {
                            view: op.variable.view,
                            variable: op.xref,
                        };
                        break;
                }
                break;
            case ir.OpKind.Listener:
            case ir.OpKind.TwoWayListener:
                // Listener functions have separate variable declarations, so process them as a separate
                // lexical scope.
                processLexicalScope(unit, op.handlerOps, savedView);
                break;
        }
    }
    // Next, use the `scope` mapping to match `ir.LexicalReadExpr` with defined names in the lexical
    // scope. Also, look for `ir.RestoreViewExpr`s and match them with the snapshotted view context
    // variable.
    for (const op of ops) {
        if (op.kind == ir.OpKind.Listener || op.kind === ir.OpKind.TwoWayListener) {
            // Listeners were already processed above with their own scopes.
            continue;
        }
        ir.transformExpressionsInOp(op, (expr, flags) => {
            if (expr instanceof ir.LexicalReadExpr) {
                // `expr` is a read of a name within the lexical scope of this view.
                // Either that name is defined within the current view, or it represents a property from the
                // main component context.
                if (scope.has(expr.name)) {
                    // This was a defined variable in the current scope.
                    return new ir.ReadVariableExpr(scope.get(expr.name));
                }
                else {
                    // Reading from the component context.
                    return new o.ReadPropExpr(new ir.ContextExpr(unit.job.root.xref), expr.name);
                }
            }
            else if (expr instanceof ir.RestoreViewExpr && typeof expr.view === 'number') {
                // `ir.RestoreViewExpr` happens in listener functions and restores a saved view from the
                // parent creation list. We expect to find that we captured the `savedView` previously, and
                // that it matches the expected view to be restored.
                if (savedView === null || savedView.view !== expr.view) {
                    throw new Error(`AssertionError: no saved view ${expr.view} from view ${unit.xref}`);
                }
                expr.view = new ir.ReadVariableExpr(savedView.variable);
                return expr;
            }
            else {
                return expr;
            }
        }, ir.VisitorContextFlag.None);
    }
    for (const op of ops) {
        ir.visitExpressionsInOp(op, expr => {
            if (expr instanceof ir.LexicalReadExpr) {
                throw new Error(`AssertionError: no lexical reads should remain, but found read of ${expr.name}`);
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9uYW1lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfbmFtZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUFDLEdBQW1CO0lBQzlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBcUIsRUFBRSxHQUFrRCxFQUN6RSxTQUF5QjtJQUMzQiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLEVBQUU7SUFDRix5RkFBeUY7SUFDekYsbUZBQW1GO0lBQ25GLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTNDLCtDQUErQztJQUMvQyxrQ0FBa0M7SUFDbEMseUNBQXlDO0lBQ3pDLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDekIsS0FBSyxFQUFFLENBQUMs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LENBQUM7aUJBQU0sQ0FBQztnQkFDTixPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDakMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN2QyxNQUFNLElBQUksS0FBSyxDQUNYLHFFQUFxRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN4RixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdCwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmVzIGxleGljYWwgcmVmZXJlbmNlcyBpbiB2aWV3cyAoYGlyLkxleGljYWxSZWFkRXhwcmApIHRvIGVpdGhlciBhIHRhcmdldCB2YXJpYWJsZSBvciB0b1xuICogcHJvcGVydHkgcmVhZHMgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAqXG4gKiBBbHNvIG1hdGNoZXMgYGlyLlJlc3RvcmVWaWV3RXhwcmAgZXhwcmVzc2lvbnMgd2l0aCB0aGUgdmFyaWFibGVzIG9mIHRoZWlyIGNvcnJlc3BvbmRpbmcgc2F2ZWRcbiAqIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZU5hbWVzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC5jcmVhdGUsIG51bGwpO1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC51cGRhdGUsIG51bGwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NMZXhpY2FsU2NvcGUoXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD58aXIuT3BMaXN0PGlyLlVwZGF0ZU9wPixcbiAgICBzYXZlZFZpZXc6IFNhdmVkVmlld3xudWxsKTogdm9pZCB7XG4gIC8vIE1hcHMgbmFtZXMgZGVmaW5lZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiB0aGlzIHRlbXBsYXRlIHRvIHRoZSBgaXIuWHJlZklkYHMgb2YgdGhlIHZhcmlhYmxlXG4gIC8vIGRlY2xhcmF0aW9ucyB3aGljaCByZXByZXNlbnQgdGhvc2UgdmFsdWVzLlxuICAvL1xuICAvLyBTaW5jZSB2YXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBpbiBlYWNoIHZpZXcgZm9yIHRoZSBlbnRpcmUgbGV4aWNhbCBzY29wZSAoaW5jbHVkaW5nIGFueVxuICAvLyBpZGVudGlmaWVycyBmcm9tIHBhcmVudCB0ZW1wbGF0ZXMpIG9ubHkgbG9jYWwgdmFyaWFibGVzIG5lZWQgYmUgY29uc2lkZXJlZCBoZXJlLlxuICBjb25zdCBzY29wZSA9IG5ldyBNYXA8c3RyaW5nLCBpci5YcmVmSWQ+KCk7XG5cbiAgLy8gRmlyc3QsIHN0ZXAgdGhyb3VnaCB0aGUgb3BlcmF0aW9ucyBsaXN0IGFuZDpcbiAgLy8gMSkgYnVpbGQgdXAgdGhlIGBzY29wZWAgbWFwcGluZ1xuICAvLyAyKSByZWN1cnNlIGludG8gYW55IGxpc3RlbmVyIGZ1bmN0aW9uc1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIHN3aXRjaCAob3AudmFyaWFibGUua2luZCkge1xuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkFsaWFzOlxuICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSByZXByZXNlbnRzIHNvbWUga2luZCBvZiBpZGVudGlmaWVyIHdoaWNoIGNhbiBiZSB1c2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICAgICAgICAgIGlmIChzY29wZS5oYXMob3AudmFyaWFibGUuaWRlbnRpZmllcikpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzY29wZS5zZXQob3AudmFyaWFibGUuaWRlbnRpZmllciwgb3AueHJlZik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLlNhdmVkVmlldzpcbiAgICAgICAgICAgIC8vIFRoaXMgdmFyaWFibGUgcmVwcmVzZW50cyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCwgYW5kIGNhbiBiZSB1c2VkIHRvXG4gICAgICAgICAgICAvLyByZXN0b3JlIHRoYXQgY29udGV4dCB3aXRoaW4gbGlzdGVuZXIgZnVuY3Rpb25zLlxuICAgICAgICAgICAgc2F2ZWRWaWV3ID0ge1xuICAgICAgICAgICAgICB2aWV3OiBvcC52YXJpYWJsZS52aWV3LFxuICAgICAgICAgICAgICB2YXJpYWJsZTogb3AueHJlZixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgY2FzZSBpci5PcEtpbmQuVHdvV2F5TGlzdGVuZXI6XG4gICAgICAgIC8vIExpc3RlbmVyIGZ1bmN0aW9ucyBoYXZlIHNlcGFyYXRlIHZhcmlhYmxlIGRlY2xhcmF0aW9ucywgc28gcHJvY2VzcyB0aGVtIGFzIGEgc2VwYXJhdGVcbiAgICAgICAgLy8gbGV4aWNhbCBzY29wZS5cbiAgICAgICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCBvcC5oYW5kbGVyT3BzLCBzYXZlZFZpZXcpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBOZXh0LCB1c2UgdGhlIGBzY29wZWAgbWFwcGluZyB0byBtYXRjaCBgaXIuTGV4aWNhbFJlYWRFeHByYCB3aXRoIGRlZmluZWQgbmFtZXMgaW4gdGhlIGxleGljYWxcbiAgLy8gc2NvcGUuIEFsc28sIGxvb2sgZm9yIGBpci5SZXN0b3JlVmlld0V4cHJgcyBhbmQgbWF0Y2ggdGhlbSB3aXRoIHRoZSBzbmFwc2hvdHRlZCB2aWV3IGNvbnRleHRcbiAgLy8gdmFyaWFibGUuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgPT0gaXIuT3BLaW5kLkxpc3RlbmVyIHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5Ud29XYXlMaXN0ZW5lcikge1xuICAgICAgLy8gTGlzdGVuZXJzIHdlcmUgYWxyZWFkeSBwcm9jZXNzZWQgYWJvdmUgd2l0aCB0aGVpciBvd24gc2NvcGVzLlxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgKGV4cHIsIGZsYWdzKSA9PiB7XG4gICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkxleGljYWxSZWFkRXhwcikge1xuICAgICAgICAvLyBgZXhwcmAgaXMgYSByZWFkIG9mIGEgbmFtZSB3aXRoaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgdGhpcyB2aWV3LlxuICAgICAgICAvLyBFaXRoZXIgdGhhdCBuYW1lIGlzIGRlZmluZWQgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcsIG9yIGl0IHJlcHJlc2VudHMgYSBwcm9wZXJ0eSBmcm9tIHRoZVxuICAgICAgICAvLyBtYWluIGNvbXBvbmVudCBjb250ZXh0LlxuICAgICAgICBpZiAoc2NvcGUuaGFzKGV4cHIubmFtZSkpIHtcbiAgICAgICAgICAvLyBUaGlzIHdhcyBhIGRlZmluZWQgdmFyaWFibGUgaW4gdGhlIGN1cnJlbnQgc2NvcGUuXG4gICAgICAgICAgcmV0dXJuIG5ldyBpci5SZWFkVmFyaWFibGVFeHByKHNjb3BlLmdldChleHByLm5hbWUpISk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUmVhZGluZyBmcm9tIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAgICAgICAgICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKG5ldyBpci5Db250ZXh0RXhwcih1bml0LmpvYi5yb290LnhyZWYpLCBleHByLm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5SZXN0b3JlVmlld0V4cHIgJiYgdHlwZW9mIGV4cHIudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gYGlyLlJlc3RvcmVWaWV3RXhwcmAgaGFwcGVucyBpbiBsaXN0ZW5lciBmdW5jdGlvbnMgYW5kIHJlc3RvcmVzIGEgc2F2ZWQgdmlldyBmcm9tIHRoZVxuICAgICAgICAvLyBwYXJlbnQgY3JlYXRpb24gbGlzdC4gV2UgZXhwZWN0IHRvIGZpbmQgdGhhdCB3ZSBjYXB0dXJlZCB0aGUgYHNhdmVkVmlld2AgcHJldmlvdXNseSwgYW5kXG4gICAgICAgIC8vIHRoYXQgaXQgbWF0Y2hlcyB0aGUgZXhwZWN0ZWQgdmlldyB0byBiZSByZXN0b3JlZC5cbiAgICAgICAgaWYgKHNhdmVkVmlldyA9PT0gbnVsbCB8fCBzYXZlZFZpZXcudmlldyAhPT0gZXhwci52aWV3KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbm8gc2F2ZWQgdmlldyAke2V4cHIudmlld30gZnJvbSB2aWV3ICR7dW5pdC54cmVmfWApO1xuICAgICAgICB9XG4gICAgICAgIGV4cHIudmlldyA9IG5ldyBpci5SZWFkVmFyaWFibGVFeHByKHNhdmVkVmlldy52YXJpYWJsZSk7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9XG4gICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuICB9XG5cbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkxleGljYWxSZWFkRXhwcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IG5vIGxleGljYWwgcmVhZHMgc2hvdWxkIHJlbWFpbiwgYnV0IGZvdW5kIHJlYWQgb2YgJHtleHByLm5hbWV9YCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCBhIGBTYXZlZFZpZXdgIHZhcmlhYmxlLlxuICovXG5pbnRlcmZhY2UgU2F2ZWRWaWV3IHtcbiAgLyoqXG4gICAqIFRoZSB2aWV3IGBpci5YcmVmSWRgIHdoaWNoIHdhcyBzYXZlZCBpbnRvIHRoaXMgdmFyaWFibGUuXG4gICAqL1xuICB2aWV3OiBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBgaXIuWHJlZklkYCBvZiB0aGUgdmFyaWFibGUgaW50byB3aGljaCB0aGUgdmlldyB3YXMgc2F2ZWQuXG4gICAqL1xuICB2YXJpYWJsZTogaXIuWHJlZklkO1xufVxuIl19