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
 * Resolves `ir.ContextExpr` expressions (which represent embedded view or component contexts) to
 * either the `ctx` parameter to component functions (for the current view context) or to variables
 * that store those contexts (for contexts accessed via the `nextContext()` instruction).
 */
export function phaseResolveContexts(cpl) {
    for (const unit of cpl.units) {
        processLexicalScope(unit, unit.create);
        processLexicalScope(unit, unit.update);
    }
}
function processLexicalScope(view, ops) {
    // Track the expressions used to access all available contexts within the current view, by the
    // view `ir.XrefId`.
    const scope = new Map();
    // The current view's context is accessible via the `ctx` parameter.
    scope.set(view.xref, o.variable('ctx'));
    for (const op of ops) {
        switch (op.kind) {
            case ir.OpKind.Variable:
                switch (op.variable.kind) {
                    case ir.SemanticVariableKind.Context:
                        scope.set(op.variable.view, new ir.ReadVariableExpr(op.xref));
                        break;
                }
                break;
            case ir.OpKind.Listener:
                processLexicalScope(view, op.handlerOps);
                break;
        }
    }
    if (view === view.job.root) {
        // Prefer `ctx` of the root view to any variables which happen to contain the root context.
        scope.set(view.xref, o.variable('ctx'));
    }
    for (const op of ops) {
        ir.transformExpressionsInOp(op, expr => {
            if (expr instanceof ir.ContextExpr) {
                if (!scope.has(expr.view)) {
                    throw new Error(`No context found for reference to view ${expr.view} from view ${view.xref}`);
                }
                return scope.get(expr.view);
            }
            else {
                return expr;
            }
        }, ir.VisitorContextFlag.None);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9jb250ZXh0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfY29udGV4dHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQW1CO0lBQ3RELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDeEM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUFxQixFQUFFLEdBQXVDO0lBQ3pGLDhGQUE4RjtJQUM5RixvQkFBb0I7SUFDcEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7SUFFakQsb0VBQW9FO0lBQ3BFLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFFeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7b0JBQ3hCLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU87d0JBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQzlELE1BQU07aUJBQ1Q7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN6QyxNQUFNO1NBQ1Q7S0FDRjtJQUVELElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFO1FBQzFCLDJGQUEyRjtRQUMzRixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3pDO0lBRUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNyQyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsV0FBVyxFQUFFO2dCQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQ1gsMENBQTBDLElBQUksQ0FBQyxJQUFJLGNBQWMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7aUJBQ25GO2dCQUNELE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7YUFDOUI7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUM7YUFDYjtRQUNILENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDaEM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcGlsYXRpb25Vbml0LCBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmVzIGBpci5Db250ZXh0RXhwcmAgZXhwcmVzc2lvbnMgKHdoaWNoIHJlcHJlc2VudCBlbWJlZGRlZCB2aWV3IG9yIGNvbXBvbmVudCBjb250ZXh0cykgdG9cbiAqIGVpdGhlciB0aGUgYGN0eGAgcGFyYW1ldGVyIHRvIGNvbXBvbmVudCBmdW5jdGlvbnMgKGZvciB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQpIG9yIHRvIHZhcmlhYmxlc1xuICogdGhhdCBzdG9yZSB0aG9zZSBjb250ZXh0cyAoZm9yIGNvbnRleHRzIGFjY2Vzc2VkIHZpYSB0aGUgYG5leHRDb250ZXh0KClgIGluc3RydWN0aW9uKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZUNvbnRleHRzKGNwbDogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGNwbC51bml0cykge1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC5jcmVhdGUpO1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldzogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgLy8gVHJhY2sgdGhlIGV4cHJlc3Npb25zIHVzZWQgdG8gYWNjZXNzIGFsbCBhdmFpbGFibGUgY29udGV4dHMgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcsIGJ5IHRoZVxuICAvLyB2aWV3IGBpci5YcmVmSWRgLlxuICBjb25zdCBzY29wZSA9IG5ldyBNYXA8aXIuWHJlZklkLCBvLkV4cHJlc3Npb24+KCk7XG5cbiAgLy8gVGhlIGN1cnJlbnQgdmlldydzIGNvbnRleHQgaXMgYWNjZXNzaWJsZSB2aWEgdGhlIGBjdHhgIHBhcmFtZXRlci5cbiAgc2NvcGUuc2V0KHZpZXcueHJlZiwgby52YXJpYWJsZSgnY3R4JykpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgc3dpdGNoIChvcC52YXJpYWJsZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICAgICAgc2NvcGUuc2V0KG9wLnZhcmlhYmxlLnZpZXcsIG5ldyBpci5SZWFkVmFyaWFibGVFeHByKG9wLnhyZWYpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgb3AuaGFuZGxlck9wcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmICh2aWV3ID09PSB2aWV3LmpvYi5yb290KSB7XG4gICAgLy8gUHJlZmVyIGBjdHhgIG9mIHRoZSByb290IHZpZXcgdG8gYW55IHZhcmlhYmxlcyB3aGljaCBoYXBwZW4gdG8gY29udGFpbiB0aGUgcm9vdCBjb250ZXh0LlxuICAgIHNjb3BlLnNldCh2aWV3LnhyZWYsIG8udmFyaWFibGUoJ2N0eCcpKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuQ29udGV4dEV4cHIpIHtcbiAgICAgICAgaWYgKCFzY29wZS5oYXMoZXhwci52aWV3KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYE5vIGNvbnRleHQgZm91bmQgZm9yIHJlZmVyZW5jZSB0byB2aWV3ICR7ZXhwci52aWV3fSBmcm9tIHZpZXcgJHt2aWV3LnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjb3BlLmdldChleHByLnZpZXcpITtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfVxuICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgfVxufVxuIl19