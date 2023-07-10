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
    for (const [_, view] of cpl.views) {
        processLexicalScope(view, view.create, null);
        processLexicalScope(view, view.update, null);
    }
}
function processLexicalScope(view, ops, savedView) {
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
                processLexicalScope(view, op.handlerOps, savedView);
                break;
        }
    }
    // Next, use the `scope` mapping to match `ir.LexicalReadExpr` with defined names in the lexical
    // scope. Also, look for `ir.RestoreViewExpr`s and match them with the snapshotted view context
    // variable.
    for (const op of ops) {
        ir.transformExpressionsInOp(op, expr => {
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
                    return new o.ReadPropExpr(new ir.ContextExpr(view.tpl.root.xref), expr.name);
                }
            }
            else if (expr instanceof ir.RestoreViewExpr && typeof expr.view === 'number') {
                // `ir.RestoreViewExpr` happens in listener functions and restores a saved view from the
                // parent creation list. We expect to find that we captured the `savedView` previously, and
                // that it matches the expected view to be restored.
                if (savedView === null || savedView.view !== expr.view) {
                    throw new Error(`AssertionError: no saved view ${expr.view} from view ${view.xref}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9uYW1lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfbmFtZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBeUI7SUFDekQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0MsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDOUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBcUIsRUFBRSxHQUFrRCxFQUN6RSxTQUF5QjtJQUMzQiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLEVBQUU7SUFDRix5RkFBeUY7SUFDekYsbUZBQW1GO0lBQ25GLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTNDLCtDQUErQztJQUMvQyxrQ0FBa0M7SUFDbEMseUNBQXlDO0lBQ3pDLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1FBQ3BCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFO29CQUN4QixLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO3dCQUNyQyxzRkFBc0Y7d0JBQ3RGLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFOzRCQUNyQyxTQUFTO3lCQUNWO3dCQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMzQyxNQUFNO29CQUNSLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLFNBQVM7d0JBQ3BDLHNGQUFzRjt3QkFDdEYsa0RBQWtEO3dCQUNsRCxTQUFTLEdBQUc7NEJBQ1YsSUFBSSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSTs0QkFDdEIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJO3lCQUNsQixDQUFDO3dCQUNGLE1BQU07aUJBQ1Q7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQix3RkFBd0Y7Z0JBQ3hGLGlCQUFpQjtnQkFDakIsbUJBQW1CLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3BELE1BQU07U0FDVDtLQUNGO0lBRUQsZ0dBQWdHO0lBQ2hHLCtGQUErRjtJQUMvRixZQUFZO0lBQ1osS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNyQyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZUFBZSxFQUFFO2dCQUN0QyxvRUFBb0U7Z0JBQ3BFLDRGQUE0RjtnQkFDNUYsMEJBQTBCO2dCQUMxQixJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN4QixvREFBb0Q7b0JBQ3BELE9BQU8sSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUMsQ0FBQztpQkFDdkQ7cUJBQU07b0JBQ0wsc0NBQXNDO29CQUN0QyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM5RTthQUNGO2lCQUFNLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxlQUFlLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDOUUsd0ZBQXdGO2dCQUN4RiwyRkFBMkY7Z0JBQzNGLG9EQUFvRDtnQkFDcEQsSUFBSSxTQUFTLEtBQUssSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLElBQUksY0FBYyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztpQkFDdEY7Z0JBQ0QsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3hELE9BQU8sSUFBSSxDQUFDO2FBQ2I7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUM7YUFDYjtRQUNILENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDaEM7SUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtRQUNwQixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2pDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxlQUFlLEVBQUU7Z0JBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQ1gscUVBQXFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQ3ZGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7S0FDSjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uLCBWaWV3Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlcyBsZXhpY2FsIHJlZmVyZW5jZXMgaW4gdmlld3MgKGBpci5MZXhpY2FsUmVhZEV4cHJgKSB0byBlaXRoZXIgYSB0YXJnZXQgdmFyaWFibGUgb3IgdG9cbiAqIHByb3BlcnR5IHJlYWRzIG9uIHRoZSB0b3AtbGV2ZWwgY29tcG9uZW50IGNvbnRleHQuXG4gKlxuICogQWxzbyBtYXRjaGVzIGBpci5SZXN0b3JlVmlld0V4cHJgIGV4cHJlc3Npb25zIHdpdGggdGhlIHZhcmlhYmxlcyBvZiB0aGVpciBjb3JyZXNwb25kaW5nIHNhdmVkXG4gKiB2aWV3cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZU5hbWVzKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh2aWV3LCB2aWV3LmNyZWF0ZSwgbnVsbCk7XG4gICAgcHJvY2Vzc0xleGljYWxTY29wZSh2aWV3LCB2aWV3LnVwZGF0ZSwgbnVsbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0xleGljYWxTY29wZShcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb24sIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPnxpci5PcExpc3Q8aXIuVXBkYXRlT3A+LFxuICAgIHNhdmVkVmlldzogU2F2ZWRWaWV3fG51bGwpOiB2b2lkIHtcbiAgLy8gTWFwcyBuYW1lcyBkZWZpbmVkIGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIHRoaXMgdGVtcGxhdGUgdG8gdGhlIGBpci5YcmVmSWRgcyBvZiB0aGUgdmFyaWFibGVcbiAgLy8gZGVjbGFyYXRpb25zIHdoaWNoIHJlcHJlc2VudCB0aG9zZSB2YWx1ZXMuXG4gIC8vXG4gIC8vIFNpbmNlIHZhcmlhYmxlcyBhcmUgZ2VuZXJhdGVkIGluIGVhY2ggdmlldyBmb3IgdGhlIGVudGlyZSBsZXhpY2FsIHNjb3BlIChpbmNsdWRpbmcgYW55XG4gIC8vIGlkZW50aWZpZXJzIGZyb20gcGFyZW50IHRlbXBsYXRlcykgb25seSBsb2NhbCB2YXJpYWJsZXMgbmVlZCBiZSBjb25zaWRlcmVkIGhlcmUuXG4gIGNvbnN0IHNjb3BlID0gbmV3IE1hcDxzdHJpbmcsIGlyLlhyZWZJZD4oKTtcblxuICAvLyBGaXJzdCwgc3RlcCB0aHJvdWdoIHRoZSBvcGVyYXRpb25zIGxpc3QgYW5kOlxuICAvLyAxKSBidWlsZCB1cCB0aGUgYHNjb3BlYCBtYXBwaW5nXG4gIC8vIDIpIHJlY3Vyc2UgaW50byBhbnkgbGlzdGVuZXIgZnVuY3Rpb25zXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgc3dpdGNoIChvcC52YXJpYWJsZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5JZGVudGlmaWVyOlxuICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSByZXByZXNlbnRzIHNvbWUga2luZCBvZiBpZGVudGlmaWVyIHdoaWNoIGNhbiBiZSB1c2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICAgICAgICAgIGlmIChzY29wZS5oYXMob3AudmFyaWFibGUuaWRlbnRpZmllcikpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzY29wZS5zZXQob3AudmFyaWFibGUuaWRlbnRpZmllciwgb3AueHJlZik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLlNlbWFudGljVmFyaWFibGVLaW5kLlNhdmVkVmlldzpcbiAgICAgICAgICAgIC8vIFRoaXMgdmFyaWFibGUgcmVwcmVzZW50cyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCwgYW5kIGNhbiBiZSB1c2VkIHRvXG4gICAgICAgICAgICAvLyByZXN0b3JlIHRoYXQgY29udGV4dCB3aXRoaW4gbGlzdGVuZXIgZnVuY3Rpb25zLlxuICAgICAgICAgICAgc2F2ZWRWaWV3ID0ge1xuICAgICAgICAgICAgICB2aWV3OiBvcC52YXJpYWJsZS52aWV3LFxuICAgICAgICAgICAgICB2YXJpYWJsZTogb3AueHJlZixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAvLyBMaXN0ZW5lciBmdW5jdGlvbnMgaGF2ZSBzZXBhcmF0ZSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMsIHNvIHByb2Nlc3MgdGhlbSBhcyBhIHNlcGFyYXRlXG4gICAgICAgIC8vIGxleGljYWwgc2NvcGUuXG4gICAgICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgb3AuaGFuZGxlck9wcywgc2F2ZWRWaWV3KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gTmV4dCwgdXNlIHRoZSBgc2NvcGVgIG1hcHBpbmcgdG8gbWF0Y2ggYGlyLkxleGljYWxSZWFkRXhwcmAgd2l0aCBkZWZpbmVkIG5hbWVzIGluIHRoZSBsZXhpY2FsXG4gIC8vIHNjb3BlLiBBbHNvLCBsb29rIGZvciBgaXIuUmVzdG9yZVZpZXdFeHByYHMgYW5kIG1hdGNoIHRoZW0gd2l0aCB0aGUgc25hcHNob3R0ZWQgdmlldyBjb250ZXh0XG4gIC8vIHZhcmlhYmxlLlxuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkxleGljYWxSZWFkRXhwcikge1xuICAgICAgICAvLyBgZXhwcmAgaXMgYSByZWFkIG9mIGEgbmFtZSB3aXRoaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgdGhpcyB2aWV3LlxuICAgICAgICAvLyBFaXRoZXIgdGhhdCBuYW1lIGlzIGRlZmluZWQgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcsIG9yIGl0IHJlcHJlc2VudHMgYSBwcm9wZXJ0eSBmcm9tIHRoZVxuICAgICAgICAvLyBtYWluIGNvbXBvbmVudCBjb250ZXh0LlxuICAgICAgICBpZiAoc2NvcGUuaGFzKGV4cHIubmFtZSkpIHtcbiAgICAgICAgICAvLyBUaGlzIHdhcyBhIGRlZmluZWQgdmFyaWFibGUgaW4gdGhlIGN1cnJlbnQgc2NvcGUuXG4gICAgICAgICAgcmV0dXJuIG5ldyBpci5SZWFkVmFyaWFibGVFeHByKHNjb3BlLmdldChleHByLm5hbWUpISk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUmVhZGluZyBmcm9tIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAgICAgICAgICByZXR1cm4gbmV3IG8uUmVhZFByb3BFeHByKG5ldyBpci5Db250ZXh0RXhwcih2aWV3LnRwbC5yb290LnhyZWYpLCBleHByLm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5SZXN0b3JlVmlld0V4cHIgJiYgdHlwZW9mIGV4cHIudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gYGlyLlJlc3RvcmVWaWV3RXhwcmAgaGFwcGVucyBpbiBsaXN0ZW5lciBmdW5jdGlvbnMgYW5kIHJlc3RvcmVzIGEgc2F2ZWQgdmlldyBmcm9tIHRoZVxuICAgICAgICAvLyBwYXJlbnQgY3JlYXRpb24gbGlzdC4gV2UgZXhwZWN0IHRvIGZpbmQgdGhhdCB3ZSBjYXB0dXJlZCB0aGUgYHNhdmVkVmlld2AgcHJldmlvdXNseSwgYW5kXG4gICAgICAgIC8vIHRoYXQgaXQgbWF0Y2hlcyB0aGUgZXhwZWN0ZWQgdmlldyB0byBiZSByZXN0b3JlZC5cbiAgICAgICAgaWYgKHNhdmVkVmlldyA9PT0gbnVsbCB8fCBzYXZlZFZpZXcudmlldyAhPT0gZXhwci52aWV3KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbm8gc2F2ZWQgdmlldyAke2V4cHIudmlld30gZnJvbSB2aWV3ICR7dmlldy54cmVmfWApO1xuICAgICAgICB9XG4gICAgICAgIGV4cHIudmlldyA9IG5ldyBpci5SZWFkVmFyaWFibGVFeHByKHNhdmVkVmlldy52YXJpYWJsZSk7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9XG4gICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuICB9XG5cbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkxleGljYWxSZWFkRXhwcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IG5vIGxleGljYWwgcmVhZHMgc2hvdWxkIHJlbWFpbiwgYnV0IGZvdW5kIHJlYWQgb2YgJHtleHByLm5hbWV9YCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCBhIGBTYXZlZFZpZXdgIHZhcmlhYmxlLlxuICovXG5pbnRlcmZhY2UgU2F2ZWRWaWV3IHtcbiAgLyoqXG4gICAqIFRoZSB2aWV3IGBpci5YcmVmSWRgIHdoaWNoIHdhcyBzYXZlZCBpbnRvIHRoaXMgdmFyaWFibGUuXG4gICAqL1xuICB2aWV3OiBpci5YcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBgaXIuWHJlZklkYCBvZiB0aGUgdmFyaWFibGUgaW50byB3aGljaCB0aGUgdmlldyB3YXMgc2F2ZWQuXG4gICAqL1xuICB2YXJpYWJsZTogaXIuWHJlZklkO1xufVxuIl19