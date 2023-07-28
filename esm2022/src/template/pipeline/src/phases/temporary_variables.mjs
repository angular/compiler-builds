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
    for (const unit of cpl.units) {
        let opCount = 0;
        let generatedStatements = [];
        for (const op of unit.ops()) {
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
        unit.update.prepend(generatedStatements);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcG9yYXJ5X3ZhcmlhYmxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3RlbXBvcmFyeV92YXJpYWJsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFtQjtJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksbUJBQW1CLEdBQXVDLEVBQUUsQ0FBQztRQUNqRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDZCxJQUFJLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBYSxDQUFDO1lBQ2pDLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1lBRXhDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLG1CQUFtQixFQUFFO29CQUNsRixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDdEI7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO2dCQUN4QiwwRkFBMEY7Z0JBQzFGLHlEQUF5RDtnQkFDekQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxPQUFPLElBQUksS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzdDO1lBRUQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLGlCQUFpQixJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsbUJBQW1CLEVBQUU7b0JBQ2xGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNqQyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7d0JBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztxQkFDcEQ7b0JBQ0QsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7aUJBQ2xCO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxtQkFBbUIsQ0FBQyxJQUFJLENBQ3BCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ3ZCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBYyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckYsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUNELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7S0FDMUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBGaW5kIGFsbCBhc3NpZ25tZW50cyBhbmQgdXNhZ2VzIG9mIHRlbXBvcmFyeSB2YXJpYWJsZXMsIHdoaWNoIGFyZSBsaW5rZWQgdG8gZWFjaCBvdGhlciB3aXRoIGNyb3NzXG4gKiByZWZlcmVuY2VzLiBHZW5lcmF0ZSBuYW1lcyBmb3IgZWFjaCBjcm9zcy1yZWZlcmVuY2UsIGFuZCBhZGQgYSBgRGVjbGFyZVZhclN0bXRgIHRvIGluaXRpYWxpemVcbiAqIHRoZW0gYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgdXBkYXRlIGJsb2NrLlxuICpcbiAqIFRPRE86IFNvbWV0aW1lcywgaXQgd2lsbCBiZSBwb3NzaWJsZSB0byByZXVzZSBuYW1lcyBhY3Jvc3MgZGlmZmVyZW50IHN1YmV4cHJlc3Npb25zLiBGb3IgZXhhbXBsZSxcbiAqIGluIHRoZSBkb3VibGUga2V5ZWQgcmVhZCBgYT8uW2YoKV0/LltmKCldYCwgdGhlIHR3byBmdW5jdGlvbiBjYWxscyBoYXZlIG5vbi1vdmVybGFwcGluZyBzY29wZXMuXG4gKiBJbXBsZW1lbnQgYW4gYWxnb3JpdGhtIGZvciByZXVzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlVGVtcG9yYXJ5VmFyaWFibGVzKGNwbDogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGNwbC51bml0cykge1xuICAgIGxldCBvcENvdW50ID0gMDtcbiAgICBsZXQgZ2VuZXJhdGVkU3RhdGVtZW50czogQXJyYXk8aXIuU3RhdGVtZW50T3A8aXIuVXBkYXRlT3A+PiA9IFtdO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgIGxldCB4cmVmcyA9IG5ldyBTZXQ8aXIuWHJlZklkPigpO1xuICAgICAgbGV0IGRlZnMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgc3RyaW5nPigpO1xuXG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuUmVhZFRlbXBvcmFyeUV4cHIgfHwgZXhwciBpbnN0YW5jZW9mIGlyLkFzc2lnblRlbXBvcmFyeUV4cHIpIHtcbiAgICAgICAgICB4cmVmcy5hZGQoZXhwci54cmVmKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGZvciAoY29uc3QgeHJlZiBvZiB4cmVmcykge1xuICAgICAgICAvLyBUT0RPOiBFeGFjdGx5IHJlcGxpY2F0ZSB0aGUgbmFtaW5nIHNjaGVtZSB1c2VkIGJ5IGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYC4gSXQgc2VlbXNcbiAgICAgICAgLy8gdG8gcmVseSBvbiBhbiBleHByZXNzaW9uIGluZGV4IGluc3RlYWQgb2YgYW4gb3AgaW5kZXguXG4gICAgICAgIGRlZnMuc2V0KHhyZWYsIGB0bXBfJHtvcENvdW50fV8ke2NvdW50Kyt9YCk7XG4gICAgICB9XG5cbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5SZWFkVGVtcG9yYXJ5RXhwciB8fCBleHByIGluc3RhbmNlb2YgaXIuQXNzaWduVGVtcG9yYXJ5RXhwcikge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBkZWZzLmdldChleHByLnhyZWYpO1xuICAgICAgICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgeHJlZiB3aXRoIHVuYXNzaWduZWQgbmFtZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHByLm5hbWUgPSBuYW1lO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgZ2VuZXJhdGVkU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgIC4uLkFycmF5LmZyb20oZGVmcy52YWx1ZXMoKSlcbiAgICAgICAgICAgICAgLm1hcChuYW1lID0+IGlyLmNyZWF0ZVN0YXRlbWVudE9wPGlyLlVwZGF0ZU9wPihuZXcgby5EZWNsYXJlVmFyU3RtdChuYW1lKSkpKTtcbiAgICAgIG9wQ291bnQrKztcbiAgICB9XG4gICAgdW5pdC51cGRhdGUucHJlcGVuZChnZW5lcmF0ZWRTdGF0ZW1lbnRzKTtcbiAgfVxufVxuIl19