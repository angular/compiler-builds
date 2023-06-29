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
 * Find all assignments and usages of temporary variables, which are linked to each other with cross
 * references. Generate names for each cross-reference, and add a `DeclareVarStmt` to initialize
 * them at the beginning of the update block.
 *
 * TODO: Sometimes, it will be possible to reuse names across different subexpressions. For example,
 * in the double keyed read `a?.[f()]?.[f()]`, the two function calls have non-overlapping scopes.
 * Implement an algorithm for reuse.
 */
export function phaseTemporaryVariables(cpl) {
    for (const view of cpl.views.values()) {
        let opCount = 0;
        let generatedStatements = [];
        for (const op of view.ops()) {
            let count = 0;
            let xrefs = new Set();
            let defs = new Map();
            ir.visitExpressionsInOp(op, expr => {
                if (expr instanceof ir.ReadTemporaryExpr || expr instanceof ir.AssignTemporaryExpr) {
                    xrefs.add(expr.xref);
                }
            });
            for (const xref of xrefs) {
                // TODO: Exactly replicate the naming scheme used by `TemplateDefinitionBuilder`. It seems
                // to rely on an expression index instead of an op index.
                defs.set(xref, `tmp_${opCount}_${count++}`);
            }
            ir.visitExpressionsInOp(op, expr => {
                if (expr instanceof ir.ReadTemporaryExpr || expr instanceof ir.AssignTemporaryExpr) {
                    const name = defs.get(expr.xref);
                    if (name === undefined) {
                        throw new Error('Found xref with unassigned name');
                    }
                    expr.name = name;
                }
            });
            generatedStatements.push(...Array.from(defs.values())
                .map(name => ir.createStatementOp(new o.DeclareVarStmt(name))));
            opCount++;
        }
        view.update.prepend(generatedStatements);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcG9yYXJ5X3ZhcmlhYmxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3RlbXBvcmFyeV92YXJpYWJsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUF5QjtJQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksbUJBQW1CLEdBQXVDLEVBQUUsQ0FBQztRQUNqRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDZCxJQUFJLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBYSxDQUFDO1lBQ2pDLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1lBRXhDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLG1CQUFtQixFQUFFO29CQUNsRixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDdEI7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO2dCQUN4QiwwRkFBMEY7Z0JBQzFGLHlEQUF5RDtnQkFDekQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxPQUFPLElBQUksS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzdDO1lBRUQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLGlCQUFpQixJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsbUJBQW1CLEVBQUU7b0JBQ2xGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNqQyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7d0JBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztxQkFDcEQ7b0JBQ0QsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7aUJBQ2xCO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxtQkFBbUIsQ0FBQyxJQUFJLENBQ3BCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ3ZCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBYyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckYsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUNELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7S0FDMUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEZpbmQgYWxsIGFzc2lnbm1lbnRzIGFuZCB1c2FnZXMgb2YgdGVtcG9yYXJ5IHZhcmlhYmxlcywgd2hpY2ggYXJlIGxpbmtlZCB0byBlYWNoIG90aGVyIHdpdGggY3Jvc3NcbiAqIHJlZmVyZW5jZXMuIEdlbmVyYXRlIG5hbWVzIGZvciBlYWNoIGNyb3NzLXJlZmVyZW5jZSwgYW5kIGFkZCBhIGBEZWNsYXJlVmFyU3RtdGAgdG8gaW5pdGlhbGl6ZVxuICogdGhlbSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSB1cGRhdGUgYmxvY2suXG4gKlxuICogVE9ETzogU29tZXRpbWVzLCBpdCB3aWxsIGJlIHBvc3NpYmxlIHRvIHJldXNlIG5hbWVzIGFjcm9zcyBkaWZmZXJlbnQgc3ViZXhwcmVzc2lvbnMuIEZvciBleGFtcGxlLFxuICogaW4gdGhlIGRvdWJsZSBrZXllZCByZWFkIGBhPy5bZigpXT8uW2YoKV1gLCB0aGUgdHdvIGZ1bmN0aW9uIGNhbGxzIGhhdmUgbm9uLW92ZXJsYXBwaW5nIHNjb3Blcy5cbiAqIEltcGxlbWVudCBhbiBhbGdvcml0aG0gZm9yIHJldXNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VUZW1wb3JhcnlWYXJpYWJsZXMoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHZpZXcgb2YgY3BsLnZpZXdzLnZhbHVlcygpKSB7XG4gICAgbGV0IG9wQ291bnQgPSAwO1xuICAgIGxldCBnZW5lcmF0ZWRTdGF0ZW1lbnRzOiBBcnJheTxpci5TdGF0ZW1lbnRPcDxpci5VcGRhdGVPcD4+ID0gW107XG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3Lm9wcygpKSB7XG4gICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgbGV0IHhyZWZzID0gbmV3IFNldDxpci5YcmVmSWQ+KCk7XG4gICAgICBsZXQgZGVmcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBzdHJpbmc+KCk7XG5cbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVGVtcG9yYXJ5RXhwciB8fCBleHByIGluc3RhbmNlb2YgaXIuQXNzaWduVGVtcG9yYXJ5RXhwcikge1xuICAgICAgICAgIHhyZWZzLmFkZChleHByLnhyZWYpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgZm9yIChjb25zdCB4cmVmIG9mIHhyZWZzKSB7XG4gICAgICAgIC8vIFRPRE86IEV4YWN0bHkgcmVwbGljYXRlIHRoZSBuYW1pbmcgc2NoZW1lIHVzZWQgYnkgYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgLiBJdCBzZWVtc1xuICAgICAgICAvLyB0byByZWx5IG9uIGFuIGV4cHJlc3Npb24gaW5kZXggaW5zdGVhZCBvZiBhbiBvcCBpbmRleC5cbiAgICAgICAgZGVmcy5zZXQoeHJlZiwgYHRtcF8ke29wQ291bnR9XyR7Y291bnQrK31gKTtcbiAgICAgIH1cblxuICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlJlYWRUZW1wb3JhcnlFeHByIHx8IGV4cHIgaW5zdGFuY2VvZiBpci5Bc3NpZ25UZW1wb3JhcnlFeHByKSB7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IGRlZnMuZ2V0KGV4cHIueHJlZik7XG4gICAgICAgICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB4cmVmIHdpdGggdW5hc3NpZ25lZCBuYW1lJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGV4cHIubmFtZSA9IG5hbWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBnZW5lcmF0ZWRTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgLi4uQXJyYXkuZnJvbShkZWZzLnZhbHVlcygpKVxuICAgICAgICAgICAgICAubWFwKG5hbWUgPT4gaXIuY3JlYXRlU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+KG5ldyBvLkRlY2xhcmVWYXJTdG10KG5hbWUpKSkpO1xuICAgICAgb3BDb3VudCsrO1xuICAgIH1cbiAgICB2aWV3LnVwZGF0ZS5wcmVwZW5kKGdlbmVyYXRlZFN0YXRlbWVudHMpO1xuICB9XG59XG4iXX0=