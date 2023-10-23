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
export function phaseResolveNames(cpl) {
    for (const unit of cpl.units) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9uYW1lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfbmFtZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzlDO0FBQ0gsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQ3hCLElBQXFCLEVBQUUsR0FBa0QsRUFDekUsU0FBeUI7SUFDM0IsK0ZBQStGO0lBQy9GLDZDQUE2QztJQUM3QyxFQUFFO0lBQ0YseUZBQXlGO0lBQ3pGLG1GQUFtRjtJQUNuRixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUUzQywrQ0FBK0M7SUFDL0Msa0NBQWtDO0lBQ2xDLHlDQUF5QztJQUN6QyxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtRQUNwQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRTtvQkFDeEIsS0FBSyxFQUFFLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDO29C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RUFBRSxDQUFDLGVBQWUsRUFBRTtnQkFDdEMsTUFBTSxJQUFJLEtBQUssQ0FDWCxxRUFBcUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7YUFDdkY7UUFDSCxDQUFDLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdCwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmVzIGxleGljYWwgcmVmZXJlbmNlcyBpbiB2aWV3cyAoYGlyLkxleGljYWxSZWFkRXhwcmApIHRvIGVpdGhlciBhIHRhcmdldCB2YXJpYWJsZSBvciB0b1xuICogcHJvcGVydHkgcmVhZHMgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAqXG4gKiBBbHNvIG1hdGNoZXMgYGlyLlJlc3RvcmVWaWV3RXhwcmAgZXhwcmVzc2lvbnMgd2l0aCB0aGUgdmFyaWFibGVzIG9mIHRoZWlyIGNvcnJlc3BvbmRpbmcgc2F2ZWRcbiAqIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VSZXNvbHZlTmFtZXMoY3BsOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2YgY3BsLnVuaXRzKSB7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCB1bml0LmNyZWF0ZSwgbnVsbCk7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCB1bml0LnVwZGF0ZSwgbnVsbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0xleGljYWxTY29wZShcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPnxpci5PcExpc3Q8aXIuVXBkYXRlT3A+LFxuICAgIHNhdmVkVmlldzogU2F2ZWRWaWV3fG51bGwpOiB2b2lkIHtcbiAgLy8gTWFwcyBuYW1lcyBkZWZpbmVkIGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIHRoaXMgdGVtcGxhdGUgdG8gdGhlIGBpci5YcmVmSWRgcyBvZiB0aGUgdmFyaWFibGVcbiAgLy8gZGVjbGFyYXRpb25zIHdoaWNoIHJlcHJlc2VudCB0aG9zZSB2YWx1ZXMuXG4gIC8vXG4gIC8vIFNpbmNlIHZhcmlhYmxlcyBhcmUgZ2VuZXJhdGVkIGluIGVhY2ggdmlldyBmb3IgdGhlIGVudGlyZSBsZXhpY2FsIHNjb3BlIChpbmNsdWRpbmcgYW55XG4gIC8vIGlkZW50aWZpZXJzIGZyb20gcGFyZW50IHRlbXBsYXRlcykgb25seSBsb2NhbCB2YXJpYWJsZXMgbmVlZCBiZSBjb25zaWRlcmVkIGhlcmUuXG4gIGNvbnN0IHNjb3BlID0gbmV3IE1hcDxzdHJpbmcsIGlyLlhyZWZJZD4oKTtcblxuICAvLyBGaXJzdCwgc3RlcCB0aHJvdWdoIHRoZSBvcGVyYXRpb25zIGxpc3QgYW5kOlxuICAvLyAxKSBidWlsZCB1cCB0aGUgYHNjb3BlYCBtYXBwaW5nXG4gIC8vIDIpIHJlY3Vyc2UgaW50byBhbnkgbGlzdGVuZXIgZnVuY3Rpb25zXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgc3dpdGNoIChvcC52YXJpYWJsZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQWxpYXM6XG4gICAgICAgICAgICAvLyBUaGlzIHZhcmlhYmxlIHJlcHJlc2VudHMgc29tZSBraW5kIG9mIGlkZW50aWZpZXIgd2hpY2ggY2FuIGJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLlxuICAgICAgICAgICAgaWYgKHNjb3BlLmhhcyhvcC52YXJpYWJsZS5pZGVudGlmaWVyKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjb3BlLnNldChvcC52YXJpYWJsZS5pZGVudGlmaWVyLCBvcC54cmVmKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuU2F2ZWRWaWV3OlxuICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSByZXByZXNlbnRzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LCBhbmQgY2FuIGJlIHVzZWQgdG9cbiAgICAgICAgICAgIC8vIHJlc3RvcmUgdGhhdCBjb250ZXh0IHdpdGhpbiBsaXN0ZW5lciBmdW5jdGlvbnMuXG4gICAgICAgICAgICBzYXZlZFZpZXcgPSB7XG4gICAgICAgICAgICAgIHZpZXc6IG9wLnZhcmlhYmxlLnZpZXcsXG4gICAgICAgICAgICAgIHZhcmlhYmxlOiBvcC54cmVmLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIC8vIExpc3RlbmVyIGZ1bmN0aW9ucyBoYXZlIHNlcGFyYXRlIHZhcmlhYmxlIGRlY2xhcmF0aW9ucywgc28gcHJvY2VzcyB0aGVtIGFzIGEgc2VwYXJhdGVcbiAgICAgICAgLy8gbGV4aWNhbCBzY29wZS5cbiAgICAgICAgcHJvY2Vzc0xleGljYWxTY29wZSh1bml0LCBvcC5oYW5kbGVyT3BzLCBzYXZlZFZpZXcpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBOZXh0LCB1c2UgdGhlIGBzY29wZWAgbWFwcGluZyB0byBtYXRjaCBgaXIuTGV4aWNhbFJlYWRFeHByYCB3aXRoIGRlZmluZWQgbmFtZXMgaW4gdGhlIGxleGljYWxcbiAgLy8gc2NvcGUuIEFsc28sIGxvb2sgZm9yIGBpci5SZXN0b3JlVmlld0V4cHJgcyBhbmQgbWF0Y2ggdGhlbSB3aXRoIHRoZSBzbmFwc2hvdHRlZCB2aWV3IGNvbnRleHRcbiAgLy8gdmFyaWFibGUuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgPT0gaXIuT3BLaW5kLkxpc3RlbmVyKSB7XG4gICAgICAvLyBMaXN0ZW5lcnMgd2VyZSBhbHJlYWR5IHByb2Nlc3NlZCBhYm92ZSB3aXRoIHRoZWlyIG93biBzY29wZXMuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByKSB7XG4gICAgICAgIC8vIGBleHByYCBpcyBhIHJlYWQgb2YgYSBuYW1lIHdpdGhpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiB0aGlzIHZpZXcuXG4gICAgICAgIC8vIEVpdGhlciB0aGF0IG5hbWUgaXMgZGVmaW5lZCB3aXRoaW4gdGhlIGN1cnJlbnQgdmlldywgb3IgaXQgcmVwcmVzZW50cyBhIHByb3BlcnR5IGZyb20gdGhlXG4gICAgICAgIC8vIG1haW4gY29tcG9uZW50IGNvbnRleHQuXG4gICAgICAgIGlmIChzY29wZS5oYXMoZXhwci5uYW1lKSkge1xuICAgICAgICAgIC8vIFRoaXMgd2FzIGEgZGVmaW5lZCB2YXJpYWJsZSBpbiB0aGUgY3VycmVudCBzY29wZS5cbiAgICAgICAgICByZXR1cm4gbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIoc2NvcGUuZ2V0KGV4cHIubmFtZSkhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZWFkaW5nIGZyb20gdGhlIGNvbXBvbmVudCBjb250ZXh0LlxuICAgICAgICAgIHJldHVybiBuZXcgby5SZWFkUHJvcEV4cHIobmV3IGlyLkNvbnRleHRFeHByKHVuaXQuam9iLnJvb3QueHJlZiksIGV4cHIubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlJlc3RvcmVWaWV3RXhwciAmJiB0eXBlb2YgZXhwci52aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBgaXIuUmVzdG9yZVZpZXdFeHByYCBoYXBwZW5zIGluIGxpc3RlbmVyIGZ1bmN0aW9ucyBhbmQgcmVzdG9yZXMgYSBzYXZlZCB2aWV3IGZyb20gdGhlXG4gICAgICAgIC8vIHBhcmVudCBjcmVhdGlvbiBsaXN0LiBXZSBleHBlY3QgdG8gZmluZCB0aGF0IHdlIGNhcHR1cmVkIHRoZSBgc2F2ZWRWaWV3YCBwcmV2aW91c2x5LCBhbmRcbiAgICAgICAgLy8gdGhhdCBpdCBtYXRjaGVzIHRoZSBleHBlY3RlZCB2aWV3IHRvIGJlIHJlc3RvcmVkLlxuICAgICAgICBpZiAoc2F2ZWRWaWV3ID09PSBudWxsIHx8IHNhdmVkVmlldy52aWV3ICE9PSBleHByLnZpZXcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBubyBzYXZlZCB2aWV3ICR7ZXhwci52aWV3fSBmcm9tIHZpZXcgJHt1bml0LnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgZXhwci52aWV3ID0gbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIoc2F2ZWRWaWV3LnZhcmlhYmxlKTtcbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH1cbiAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogbm8gbGV4aWNhbCByZWFkcyBzaG91bGQgcmVtYWluLCBidXQgZm91bmQgcmVhZCBvZiAke2V4cHIubmFtZX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IGEgYFNhdmVkVmlld2AgdmFyaWFibGUuXG4gKi9cbmludGVyZmFjZSBTYXZlZFZpZXcge1xuICAvKipcbiAgICogVGhlIHZpZXcgYGlyLlhyZWZJZGAgd2hpY2ggd2FzIHNhdmVkIGludG8gdGhpcyB2YXJpYWJsZS5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIGBpci5YcmVmSWRgIG9mIHRoZSB2YXJpYWJsZSBpbnRvIHdoaWNoIHRoZSB2aWV3IHdhcyBzYXZlZC5cbiAgICovXG4gIHZhcmlhYmxlOiBpci5YcmVmSWQ7XG59XG4iXX0=