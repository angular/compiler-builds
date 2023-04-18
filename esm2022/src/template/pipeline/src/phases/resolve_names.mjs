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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9uYW1lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfbmFtZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBeUI7SUFDekQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0MsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDOUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBcUIsRUFBRSxHQUFrRCxFQUN6RSxTQUF5QjtJQUMzQiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLEVBQUU7SUFDRix5RkFBeUY7SUFDekYsbUZBQW1GO0lBQ25GLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTNDLCtDQUErQztJQUMvQyxrQ0FBa0M7SUFDbEMseUNBQXlDO0lBQ3pDLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1FBQ3BCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtZQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFO29CQUN4QixLQUFLLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO3dCQUNyQyxzRkFBc0Y7d0JBQ3RGLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFOzRCQUNyQyxTQUFTO3lCQUNWO3dCQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMzQyxNQUFNO29CQUNSLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLFNBQVM7d0JBQ3BDLHNGQUFzRjt3QkFDdEYsa0RBQWtEO3dCQUNsRCxTQUFTLEdBQUc7NEJBQ1YsSUFBSSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSTs0QkFDdEIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJO3lCQUNsQixDQUFDO3dCQUNGLE1BQU07aUJBQ1Q7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQix3RkFBd0Y7Z0JBQ3hGLGlCQUFpQjtnQkFDakIsbUJBQW1CLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3BELE1BQU07U0FDVDtLQUNGO0lBRUQsZ0dBQWdHO0lBQ2hHLCtGQUErRjtJQUMvRixZQUFZO0lBQ1osS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNyQyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZUFBZSxFQUFFO2dCQUN0QyxvRUFBb0U7Z0JBQ3BFLDRGQUE0RjtnQkFDNUYsMEJBQTBCO2dCQUMxQixJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN4QixvREFBb0Q7b0JBQ3BELE9BQU8sSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUMsQ0FBQztpQkFDdkQ7cUJBQU07b0JBQ0wsc0NBQXNDO29CQUN0QyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM5RTthQUNGO2lCQUFNLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxlQUFlLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDOUUsd0ZBQXdGO2dCQUN4RiwyRkFBMkY7Z0JBQzNGLG9EQUFvRDtnQkFDcEQsSUFBSSxTQUFTLEtBQUssSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLElBQUksY0FBYyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztpQkFDdEY7Z0JBQ0QsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3hELE9BQU8sSUFBSSxDQUFDO2FBQ2I7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUM7YUFDYjtRQUNILENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDaEM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZXMgbGV4aWNhbCByZWZlcmVuY2VzIGluIHZpZXdzIChgaXIuTGV4aWNhbFJlYWRFeHByYCkgdG8gZWl0aGVyIGEgdGFyZ2V0IHZhcmlhYmxlIG9yIHRvXG4gKiBwcm9wZXJ0eSByZWFkcyBvbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCBjb250ZXh0LlxuICpcbiAqIEFsc28gbWF0Y2hlcyBgaXIuUmVzdG9yZVZpZXdFeHByYCBleHByZXNzaW9ucyB3aXRoIHRoZSB2YXJpYWJsZXMgb2YgdGhlaXIgY29ycmVzcG9uZGluZyBzYXZlZFxuICogdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVOYW1lcyhjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIGZvciAoY29uc3QgW18sIHZpZXddIG9mIGNwbC52aWV3cykge1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgdmlldy5jcmVhdGUsIG51bGwpO1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgdmlldy51cGRhdGUsIG51bGwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NMZXhpY2FsU2NvcGUoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcD58aXIuT3BMaXN0PGlyLlVwZGF0ZU9wPixcbiAgICBzYXZlZFZpZXc6IFNhdmVkVmlld3xudWxsKTogdm9pZCB7XG4gIC8vIE1hcHMgbmFtZXMgZGVmaW5lZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiB0aGlzIHRlbXBsYXRlIHRvIHRoZSBgaXIuWHJlZklkYHMgb2YgdGhlIHZhcmlhYmxlXG4gIC8vIGRlY2xhcmF0aW9ucyB3aGljaCByZXByZXNlbnQgdGhvc2UgdmFsdWVzLlxuICAvL1xuICAvLyBTaW5jZSB2YXJpYWJsZXMgYXJlIGdlbmVyYXRlZCBpbiBlYWNoIHZpZXcgZm9yIHRoZSBlbnRpcmUgbGV4aWNhbCBzY29wZSAoaW5jbHVkaW5nIGFueVxuICAvLyBpZGVudGlmaWVycyBmcm9tIHBhcmVudCB0ZW1wbGF0ZXMpIG9ubHkgbG9jYWwgdmFyaWFibGVzIG5lZWQgYmUgY29uc2lkZXJlZCBoZXJlLlxuICBjb25zdCBzY29wZSA9IG5ldyBNYXA8c3RyaW5nLCBpci5YcmVmSWQ+KCk7XG5cbiAgLy8gRmlyc3QsIHN0ZXAgdGhyb3VnaCB0aGUgb3BlcmF0aW9ucyBsaXN0IGFuZDpcbiAgLy8gMSkgYnVpbGQgdXAgdGhlIGBzY29wZWAgbWFwcGluZ1xuICAvLyAyKSByZWN1cnNlIGludG8gYW55IGxpc3RlbmVyIGZ1bmN0aW9uc1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIHN3aXRjaCAob3AudmFyaWFibGUua2luZCkge1xuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuSWRlbnRpZmllcjpcbiAgICAgICAgICAgIC8vIFRoaXMgdmFyaWFibGUgcmVwcmVzZW50cyBzb21lIGtpbmQgb2YgaWRlbnRpZmllciB3aGljaCBjYW4gYmUgdXNlZCBpbiB0aGUgdGVtcGxhdGUuXG4gICAgICAgICAgICBpZiAoc2NvcGUuaGFzKG9wLnZhcmlhYmxlLmlkZW50aWZpZXIpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2NvcGUuc2V0KG9wLnZhcmlhYmxlLmlkZW50aWZpZXIsIG9wLnhyZWYpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5TYXZlZFZpZXc6XG4gICAgICAgICAgICAvLyBUaGlzIHZhcmlhYmxlIHJlcHJlc2VudHMgYSBzbmFwc2hvdCBvZiB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQsIGFuZCBjYW4gYmUgdXNlZCB0b1xuICAgICAgICAgICAgLy8gcmVzdG9yZSB0aGF0IGNvbnRleHQgd2l0aGluIGxpc3RlbmVyIGZ1bmN0aW9ucy5cbiAgICAgICAgICAgIHNhdmVkVmlldyA9IHtcbiAgICAgICAgICAgICAgdmlldzogb3AudmFyaWFibGUudmlldyxcbiAgICAgICAgICAgICAgdmFyaWFibGU6IG9wLnhyZWYsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgLy8gTGlzdGVuZXIgZnVuY3Rpb25zIGhhdmUgc2VwYXJhdGUgdmFyaWFibGUgZGVjbGFyYXRpb25zLCBzbyBwcm9jZXNzIHRoZW0gYXMgYSBzZXBhcmF0ZVxuICAgICAgICAvLyBsZXhpY2FsIHNjb3BlLlxuICAgICAgICBwcm9jZXNzTGV4aWNhbFNjb3BlKHZpZXcsIG9wLmhhbmRsZXJPcHMsIHNhdmVkVmlldyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5leHQsIHVzZSB0aGUgYHNjb3BlYCBtYXBwaW5nIHRvIG1hdGNoIGBpci5MZXhpY2FsUmVhZEV4cHJgIHdpdGggZGVmaW5lZCBuYW1lcyBpbiB0aGUgbGV4aWNhbFxuICAvLyBzY29wZS4gQWxzbywgbG9vayBmb3IgYGlyLlJlc3RvcmVWaWV3RXhwcmBzIGFuZCBtYXRjaCB0aGVtIHdpdGggdGhlIHNuYXBzaG90dGVkIHZpZXcgY29udGV4dFxuICAvLyB2YXJpYWJsZS5cbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5MZXhpY2FsUmVhZEV4cHIpIHtcbiAgICAgICAgLy8gYGV4cHJgIGlzIGEgcmVhZCBvZiBhIG5hbWUgd2l0aGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIHRoaXMgdmlldy5cbiAgICAgICAgLy8gRWl0aGVyIHRoYXQgbmFtZSBpcyBkZWZpbmVkIHdpdGhpbiB0aGUgY3VycmVudCB2aWV3LCBvciBpdCByZXByZXNlbnRzIGEgcHJvcGVydHkgZnJvbSB0aGVcbiAgICAgICAgLy8gbWFpbiBjb21wb25lbnQgY29udGV4dC5cbiAgICAgICAgaWYgKHNjb3BlLmhhcyhleHByLm5hbWUpKSB7XG4gICAgICAgICAgLy8gVGhpcyB3YXMgYSBkZWZpbmVkIHZhcmlhYmxlIGluIHRoZSBjdXJyZW50IHNjb3BlLlxuICAgICAgICAgIHJldHVybiBuZXcgaXIuUmVhZFZhcmlhYmxlRXhwcihzY29wZS5nZXQoZXhwci5uYW1lKSEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlYWRpbmcgZnJvbSB0aGUgY29tcG9uZW50IGNvbnRleHQuXG4gICAgICAgICAgcmV0dXJuIG5ldyBvLlJlYWRQcm9wRXhwcihuZXcgaXIuQ29udGV4dEV4cHIodmlldy50cGwucm9vdC54cmVmKSwgZXhwci5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2YgaXIuUmVzdG9yZVZpZXdFeHByICYmIHR5cGVvZiBleHByLnZpZXcgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIGBpci5SZXN0b3JlVmlld0V4cHJgIGhhcHBlbnMgaW4gbGlzdGVuZXIgZnVuY3Rpb25zIGFuZCByZXN0b3JlcyBhIHNhdmVkIHZpZXcgZnJvbSB0aGVcbiAgICAgICAgLy8gcGFyZW50IGNyZWF0aW9uIGxpc3QuIFdlIGV4cGVjdCB0byBmaW5kIHRoYXQgd2UgY2FwdHVyZWQgdGhlIGBzYXZlZFZpZXdgIHByZXZpb3VzbHksIGFuZFxuICAgICAgICAvLyB0aGF0IGl0IG1hdGNoZXMgdGhlIGV4cGVjdGVkIHZpZXcgdG8gYmUgcmVzdG9yZWQuXG4gICAgICAgIGlmIChzYXZlZFZpZXcgPT09IG51bGwgfHwgc2F2ZWRWaWV3LnZpZXcgIT09IGV4cHIudmlldykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG5vIHNhdmVkIHZpZXcgJHtleHByLnZpZXd9IGZyb20gdmlldyAke3ZpZXcueHJlZn1gKTtcbiAgICAgICAgfVxuICAgICAgICBleHByLnZpZXcgPSBuZXcgaXIuUmVhZFZhcmlhYmxlRXhwcihzYXZlZFZpZXcudmFyaWFibGUpO1xuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfVxuICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IGEgYFNhdmVkVmlld2AgdmFyaWFibGUuXG4gKi9cbmludGVyZmFjZSBTYXZlZFZpZXcge1xuICAvKipcbiAgICogVGhlIHZpZXcgYGlyLlhyZWZJZGAgd2hpY2ggd2FzIHNhdmVkIGludG8gdGhpcyB2YXJpYWJsZS5cbiAgICovXG4gIHZpZXc6IGlyLlhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIGBpci5YcmVmSWRgIG9mIHRoZSB2YXJpYWJsZSBpbnRvIHdoaWNoIHRoZSB2aWV3IHdhcyBzYXZlZC5cbiAgICovXG4gIHZhcmlhYmxlOiBpci5YcmVmSWQ7XG59XG4iXX0=