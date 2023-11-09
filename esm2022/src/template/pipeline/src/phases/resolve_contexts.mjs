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
export function resolveContexts(job) {
    for (const unit of job.units) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9jb250ZXh0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfY29udGV4dHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxHQUFtQjtJQUNqRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLElBQXFCLEVBQUUsR0FBdUM7SUFDekYsOEZBQThGO0lBQzlGLG9CQUFvQjtJQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBMkIsQ0FBQztJQUVqRCxvRUFBb0U7SUFDcEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUV4QyxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3pCLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU87d0JBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQzlELE1BQU07Z0JBQ1YsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3pDLE1BQU07UUFDVixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0IsMkZBQTJGO1FBQzNGLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNyQyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUMxQixNQUFNLElBQUksS0FBSyxDQUNYLDBDQUEwQyxJQUFJLENBQUMsSUFBSSxjQUFjLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUNwRixDQUFDO2dCQUNELE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDL0IsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQztRQUNILENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iLCBDb21waWxhdGlvblVuaXQsIENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZXMgYGlyLkNvbnRleHRFeHByYCBleHByZXNzaW9ucyAod2hpY2ggcmVwcmVzZW50IGVtYmVkZGVkIHZpZXcgb3IgY29tcG9uZW50IGNvbnRleHRzKSB0b1xuICogZWl0aGVyIHRoZSBgY3R4YCBwYXJhbWV0ZXIgdG8gY29tcG9uZW50IGZ1bmN0aW9ucyAoZm9yIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCkgb3IgdG8gdmFyaWFibGVzXG4gKiB0aGF0IHN0b3JlIHRob3NlIGNvbnRleHRzIChmb3IgY29udGV4dHMgYWNjZXNzZWQgdmlhIHRoZSBgbmV4dENvbnRleHQoKWAgaW5zdHJ1Y3Rpb24pLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNvbnRleHRzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC5jcmVhdGUpO1xuICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldzogQ29tcGlsYXRpb25Vbml0LCBvcHM6IGlyLk9wTGlzdDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgLy8gVHJhY2sgdGhlIGV4cHJlc3Npb25zIHVzZWQgdG8gYWNjZXNzIGFsbCBhdmFpbGFibGUgY29udGV4dHMgd2l0aGluIHRoZSBjdXJyZW50IHZpZXcsIGJ5IHRoZVxuICAvLyB2aWV3IGBpci5YcmVmSWRgLlxuICBjb25zdCBzY29wZSA9IG5ldyBNYXA8aXIuWHJlZklkLCBvLkV4cHJlc3Npb24+KCk7XG5cbiAgLy8gVGhlIGN1cnJlbnQgdmlldydzIGNvbnRleHQgaXMgYWNjZXNzaWJsZSB2aWEgdGhlIGBjdHhgIHBhcmFtZXRlci5cbiAgc2NvcGUuc2V0KHZpZXcueHJlZiwgby52YXJpYWJsZSgnY3R4JykpO1xuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5WYXJpYWJsZTpcbiAgICAgICAgc3dpdGNoIChvcC52YXJpYWJsZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0OlxuICAgICAgICAgICAgc2NvcGUuc2V0KG9wLnZhcmlhYmxlLnZpZXcsIG5ldyBpci5SZWFkVmFyaWFibGVFeHByKG9wLnhyZWYpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgb3AuaGFuZGxlck9wcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmICh2aWV3ID09PSB2aWV3LmpvYi5yb290KSB7XG4gICAgLy8gUHJlZmVyIGBjdHhgIG9mIHRoZSByb290IHZpZXcgdG8gYW55IHZhcmlhYmxlcyB3aGljaCBoYXBwZW4gdG8gY29udGFpbiB0aGUgcm9vdCBjb250ZXh0LlxuICAgIHNjb3BlLnNldCh2aWV3LnhyZWYsIG8udmFyaWFibGUoJ2N0eCcpKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuQ29udGV4dEV4cHIpIHtcbiAgICAgICAgaWYgKCFzY29wZS5oYXMoZXhwci52aWV3KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYE5vIGNvbnRleHQgZm91bmQgZm9yIHJlZmVyZW5jZSB0byB2aWV3ICR7ZXhwci52aWV3fSBmcm9tIHZpZXcgJHt2aWV3LnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjb3BlLmdldChleHByLnZpZXcpITtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfVxuICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgfVxufVxuIl19