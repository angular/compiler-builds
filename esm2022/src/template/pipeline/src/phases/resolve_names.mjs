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
        if (op.kind == ir.OpKind.Listener) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9uYW1lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfbmFtZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUFDLEdBQW1CO0lBQzlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBcUIsRUFBRSxHQUFrRCxFQUN6RSxTQUF5QjtJQUMzQiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLEVBQUU7SUFDRix5RkFBeUY7SUFDekYsbUZBQW1GO0lBQ25GLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTNDLCtDQUErQztJQUMvQyxrQ0FBa0M7SUFDbEMseUNBQXlDO0lBQ3pDLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDekIsS0FBSyxFQUFFLENBQUMs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QUFDLENBQUM7SUFDakMsQ0FBQztJQUVELEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNqQyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZDLE1BQU0sSUFBSSxLQUFLLENBQ1gscUVBQXFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3hGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcGlsYXRpb25Vbml0LCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZXMgbGV4aWNhbCByZWZlcmVuY2VzIGluIHZpZXdzIChgaXIuTGV4aWNhbFJlYWRFeHByYCkgdG8gZWl0aGVyIGEgdGFyZ2V0IHZhcmlhYmxlIG9yIHRvXG4gKiBwcm9wZXJ0eSByZWFkcyBvbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCBjb250ZXh0LlxuICpcbiAqIEFsc28gbWF0Y2hlcyBgaXIuUmVzdG9yZVZpZXdFeHByYCBleHByZXNzaW9ucyB3aXRoIHRoZSB2YXJpYWJsZXMgb2YgdGhlaXIgY29ycmVzcG9uZGluZyBzYXZlZFxuICogdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlTmFtZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCB1bml0LmNyZWF0ZSwgbnVsbCk7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCB1bml0LnVwZGF0ZSwgbnVsbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0xleGljYWxTY29wZShcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPnxpci5PcExpc3Q8aXIuVXBkYXRlT3A+LFxuICAgIHNhdmVkVmlldzogU2F2ZWRWaWV3fG51bGwpOiB2b2lkIHtcbiAgLy8gTWFwcyBuYW1lcyBkZWZpbmVkIGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIHRoaXMgdGVtcGxhdGUgdG8gdGhlIGBpci5YcmVmSWRgcyBvZiB0aGUgdmFyaWFibGVcbiAgLy8gZGVjbGFyYXRpb25zIHdoaWNoIHJlcHJlc2VudCB0aG9zZSB2YWx1ZXMuXG4gIC8vXG4gIC8vIFNpbmNlIHZhcmlhYmxlcyBhcmUgZ2VuZXJhdGVkIGluIGVhY2ggdmlldyBmb3IgdGhlIGVudGlyZSBsZXhpY2FsIHNjb3BlIChpbmNsdWRpbmcgYW55XG4gIC8vIGlkZW50aWZpZXJzIGZyb20gcGFyZW50IHRlbXBsYXRlcykgb25seSBsb2NhbCB2YXJpYWJsZXMgbmVlZCBiZSBjb25zaWRlcmVkIGhlcmUuXG4gIGNvbnN0IHNjb3BlID0gbmV3IE1hcDxzdHJpbmcsIGlyLlhyZWZJZD4oKTtcblxuICAvLyBGaXJzdCwgc3RlcCB0aHJvdWdoIHRoZSBvcGVyYXRpb25zIGxpc3QgYW5kOlxuICAvLyAxKSBidWlsZCB1cCB0aGUgYHNjb3BlYCBtYXBwaW5nXG4gIC8vIDIpIHJlY3Vyc2UgaW50byBhbnkgbGlzdGVuZXIgZnVuY3Rpb25zXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgc3dpdGNoIChvcC52YXJpYWJsZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQWxpYXM6XG4gICAgICAgICAgICAvLyBUaGlzIHZhcmlhYmxlIHJlcHJlc2VudHMgc29tZSBraW5kIG9mIGlkZW50aWZpZXIgd2hpY2ggY2FuIGJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLlxuICAgICAgICAgICAgaWYgKHNjb3BlLmhhcyhvcC52YXJpYWJsZS5pZGVudGlmaWVyKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjb3BlLnNldChvcC52YXJpYWJsZS5pZGVudGlmaWVyLCBvcC54cmVmKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuU2F2ZWRWaWV3OlxuICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSByZXByZXNlbnRzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LCBhbmQgY2FuIGJlIHVzZWQgdG9cbiAgICAgICAgICAgIC8vIHJlc3RvcmUgdGhhdCBjb250ZXh0IHdpdGhpbiBsaXN0ZW5lciBmdW5jdGlvbnMuXG4gICAgICAgICAgICBzYXZlZFZpZXcgPSB7XG4gICAgICAgICAgICAgIHZpZXc6IG9wLnZhcmlhYmxlLnZpZXcsXG4gICAgICAgICAgICAgIHZhcmlhYmxlOiBvcC54cmVmLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIC8vIExpc3RlbmVyIGZ1bmN0aW9ucyBoYXZlIHNlcGFyYXRlIHZhcmlhYmxlIGRlY2xhcmF0aW9ucywgc28gcHJvY2VzcyB0aGVtIGFzIGEgc2VwYXJhdGVcbiAgICAgICAgLy8gbGV4aWNhbCBzY29wZS5cbiAgICAgICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCBvcC5oYW5kbGVyT3BzLCBzYXZlZFZpZXcpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBOZXh0LCB1c2UgdGhlIGBzY29wZWAgbWFwcGluZyB0byBtYXRjaCBgaXIuTGV4aWNhbFJlYWRFeHByYCB3aXRoIGRlZmluZWQgbmFtZXMgaW4gdGhlIGxleGljYWxcbiAgLy8gc2NvcGUuIEFsc28sIGxvb2sgZm9yIGBpci5SZXN0b3JlVmlld0V4cHJgcyBhbmQgbWF0Y2ggdGhlbSB3aXRoIHRoZSBzbmFwc2hvdHRlZCB2aWV3IGNvbnRleHRcbiAgLy8gdmFyaWFibGUuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgPT0gaXIuT3BLaW5kLkxpc3RlbmVyKSB7XG4gICAgICAvLyBMaXN0ZW5lcnMgd2VyZSBhbHJlYWR5IHByb2Nlc3NlZCBhYm92ZSB3aXRoIHRoZWlyIG93biBzY29wZXMuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByKSB7XG4gICAgICAgIC8vIGBleHByYCBpcyBhIHJlYWQgb2YgYSBuYW1lIHdpdGhpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiB0aGlzIHZpZXcuXG4gICAgICAgIC8vIEVpdGhlciB0aGF0IG5hbWUgaXMgZGVmaW5lZCB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldywgb3IgaXQgcmVwcmVzZW50cyBhIHByb3BlcnR5IGZyb20gdGhlXG4gICAgICAgIC8vIG1haW4gY29tcG9uZW50IGNvbnRleHQuXG4gICAgICAgIGlmIChzY29wZS5oYXMoZXhwci5uYW1lKSkge1xuICAgICAgICAgIC8vIFRoaXMgd2FzIGEgZGVmaW5lZCB2YXJpYWJsZSBpbiB0aGUgY3VycmVudCBzY29wZS5cbiAgICAgICAgICByZXR1cm4gbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIoc2NvcGUuZ2V0KGV4cHIubmFtZSkhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZWFkaW5nIGZyb20gdGhlIGNvbXBvbmVudCBjb250ZXh0LlxuICAgICAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIobmV3IGlyLkNvbnRleHRFeHByKHVuaXQuam9iLnJvb3QueHJlZiksIGV4cHIubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlJlc3RvcmVWaWV3RXhwciAmJiB0eXBlb2YgZXhwci52aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBgaXIuUmVzdG9yZVZpZXdFeHByYCBoYXBwZW5zIGluIGxpc3RlbmVyIGZ1bmN0aW9ucyBhbmQgcmVzdG9yZXMgYSBzYXZlZCB2aWV3IGZyb20gdGhlXG4gICAgICAgIC8vIHBhcmVudCBjcmVhdGlvbiBsaXN0LiBXZSBleHBlY3QgdG8gZmluZCB0aGF0IHdlIGNhcHR1cmVkIHRoZSBgc2F2ZWRWaWV3YCBwcmV2aW91c2x5LCBhbmRcbiAgICAgICAgLy8gdGhhdCBpdCBtYXRjaGVzIHRoZSBleHBlY3RlZCB2aWV3IHRvIGJlIHJlc3RvcmVkLlxuICAgICAgICBpZiAoc2F2ZWRWaWV3ID09PSBudWxsIHx8IHNhdmVkVmlldy52aWV3ICE9PSBleHByLnZpZXcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBubyBzYXZlZCB2aWV3ICR7ZXhwci52aWV3fSBmcm9tIHZpZXcgJHt1bml0LnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgZXhwci52aWV3ID0gbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIoc2F2ZWRWaWV3LnZhcmlhYmxlKTtcbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH1cbiAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogbm8gbGV4aWNhbCByZWFkcyBzaG91bGQgcmVtYWluLCBidXQgZm91bmQgcmVhZCBvZiAke2V4cHIubmFtZX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IGEgYFNhdmVkVmlld2AgdmFyaWFibGUuXG4gKi9cbmludGVyZmFjZSBTYXZlZFZpZXcge1xuICAvKipcbiAgICogVGhlIHZpZXcgYGlyLlhyZWZJZGAgd2hpY2ggd2FzIHNhdmVkIGludG8gdGhpcyB2YXJpYWJsZS5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIGBpci5YcmVmSWRgIG9mIHRoZSB2YXJpYWJsZSBpbnRvIHdoaWNoIHRoZSB2aWV3IHdhcyBzYXZlZC5cbiAgICovXG4gIHZhcmlhYmxlOiBpci5YcmVmSWQ7XG59XG4iXX0=