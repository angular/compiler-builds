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
                        if (op.variable.view === view.xref) {
                            // This variable is for the same view as `ctx`. Ideally we'd use `ctx`, but we should
                            // prefer the variable in non-root views because of the risk of closure-capturing
                            // `ctx`.
                            if (view === view.job.root) {
                                // This is the root view, so it's safe to use `ctx` and we don't need to use this
                                // variable.
                                break;
                            }
                        }
                        // This is a reference to a different context.
                        scope.set(op.variable.view, new ir.ReadVariableExpr(op.xref));
                }
                break;
            case ir.OpKind.Listener:
                processLexicalScope(view, op.handlerOps);
                break;
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9jb250ZXh0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfY29udGV4dHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQW1CO0lBQ3RELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDeEM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUFxQixFQUFFLEdBQXVDO0lBQ3pGLDhGQUE4RjtJQUM5RixvQkFBb0I7SUFDcEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7SUFFakQsb0VBQW9FO0lBQ3BFLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFFeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7b0JBQ3hCLEtBQUssRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU87d0JBQ2xDLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRTs0QkFDbEMscUZBQXFGOzRCQUNyRixpRkFBaUY7NEJBQ2pGLFNBQVM7NEJBRVQsSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUU7Z0NBQzFCLGlGQUFpRjtnQ0FDakYsWUFBWTtnQ0FDWixNQUFNOzZCQUNQO3lCQUNGO3dCQUVELDhDQUE4Qzt3QkFDOUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDakU7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN6QyxNQUFNO1NBQ1Q7S0FDRjtJQUVELEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFO1FBQ3BCLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDckMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLFdBQVcsRUFBRTtnQkFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN6QixNQUFNLElBQUksS0FBSyxDQUNYLDBDQUEwQyxJQUFJLENBQUMsSUFBSSxjQUFjLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2lCQUNuRjtnQkFDRCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBRSxDQUFDO2FBQzlCO2lCQUFNO2dCQUNMLE9BQU8sSUFBSSxDQUFDO2FBQ2I7UUFDSCxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2hDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdCwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlcyBgaXIuQ29udGV4dEV4cHJgIGV4cHJlc3Npb25zICh3aGljaCByZXByZXNlbnQgZW1iZWRkZWQgdmlldyBvciBjb21wb25lbnQgY29udGV4dHMpIHRvXG4gKiBlaXRoZXIgdGhlIGBjdHhgIHBhcmFtZXRlciB0byBjb21wb25lbnQgZnVuY3Rpb25zIChmb3IgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0KSBvciB0byB2YXJpYWJsZXNcbiAqIHRoYXQgc3RvcmUgdGhvc2UgY29udGV4dHMgKGZvciBjb250ZXh0cyBhY2Nlc3NlZCB2aWEgdGhlIGBuZXh0Q29udGV4dCgpYCBpbnN0cnVjdGlvbikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVDb250ZXh0cyhjcGw6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBjcGwudW5pdHMpIHtcbiAgICBwcm9jZXNzTGV4aWNhbFNjb3BlKHVuaXQsIHVuaXQuY3JlYXRlKTtcbiAgICBwcm9jZXNzTGV4aWNhbFNjb3BlKHVuaXQsIHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzTGV4aWNhbFNjb3BlKHZpZXc6IENvbXBpbGF0aW9uVW5pdCwgb3BzOiBpci5PcExpc3Q8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIC8vIFRyYWNrIHRoZSBleHByZXNzaW9ucyB1c2VkIHRvIGFjY2VzcyBhbGwgYXZhaWxhYmxlIGNvbnRleHRzIHdpdGhpbiB0aGUgY3VycmVudCB2aWV3LCBieSB0aGVcbiAgLy8gdmlldyBgaXIuWHJlZklkYC5cbiAgY29uc3Qgc2NvcGUgPSBuZXcgTWFwPGlyLlhyZWZJZCwgby5FeHByZXNzaW9uPigpO1xuXG4gIC8vIFRoZSBjdXJyZW50IHZpZXcncyBjb250ZXh0IGlzIGFjY2Vzc2libGUgdmlhIHRoZSBgY3R4YCBwYXJhbWV0ZXIuXG4gIHNjb3BlLnNldCh2aWV3LnhyZWYsIG8udmFyaWFibGUoJ2N0eCcpKTtcblxuICBmb3IgKGNvbnN0IG9wIG9mIG9wcykge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuVmFyaWFibGU6XG4gICAgICAgIHN3aXRjaCAob3AudmFyaWFibGUua2luZCkge1xuICAgICAgICAgIGNhc2UgaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dDpcbiAgICAgICAgICAgIGlmIChvcC52YXJpYWJsZS52aWV3ID09PSB2aWV3LnhyZWYpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSBpcyBmb3IgdGhlIHNhbWUgdmlldyBhcyBgY3R4YC4gSWRlYWxseSB3ZSdkIHVzZSBgY3R4YCwgYnV0IHdlIHNob3VsZFxuICAgICAgICAgICAgICAvLyBwcmVmZXIgdGhlIHZhcmlhYmxlIGluIG5vbi1yb290IHZpZXdzIGJlY2F1c2Ugb2YgdGhlIHJpc2sgb2YgY2xvc3VyZS1jYXB0dXJpbmdcbiAgICAgICAgICAgICAgLy8gYGN0eGAuXG5cbiAgICAgICAgICAgICAgaWYgKHZpZXcgPT09IHZpZXcuam9iLnJvb3QpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIHRoZSByb290IHZpZXcsIHNvIGl0J3Mgc2FmZSB0byB1c2UgYGN0eGAgYW5kIHdlIGRvbid0IG5lZWQgdG8gdXNlIHRoaXNcbiAgICAgICAgICAgICAgICAvLyB2YXJpYWJsZS5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUaGlzIGlzIGEgcmVmZXJlbmNlIHRvIGEgZGlmZmVyZW50IGNvbnRleHQuXG4gICAgICAgICAgICBzY29wZS5zZXQob3AudmFyaWFibGUudmlldywgbmV3IGlyLlJlYWRWYXJpYWJsZUV4cHIob3AueHJlZikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIHByb2Nlc3NMZXhpY2FsU2NvcGUodmlldywgb3AuaGFuZGxlck9wcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuQ29udGV4dEV4cHIpIHtcbiAgICAgICAgaWYgKCFzY29wZS5oYXMoZXhwci52aWV3KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYE5vIGNvbnRleHQgZm91bmQgZm9yIHJlZmVyZW5jZSB0byB2aWV3ICR7ZXhwci52aWV3fSBmcm9tIHZpZXcgJHt2aWV3LnhyZWZ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjb3BlLmdldChleHByLnZpZXcpITtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfVxuICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgfVxufVxuIl19