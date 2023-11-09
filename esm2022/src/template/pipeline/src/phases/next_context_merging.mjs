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
 * Merges logically sequential `NextContextExpr` operations.
 *
 * `NextContextExpr` can be referenced repeatedly, "popping" the runtime's context stack each time.
 * When two such expressions appear back-to-back, it's possible to merge them together into a single
 * `NextContextExpr` that steps multiple contexts. This merging is possible if all conditions are
 * met:
 *
 *   * The result of the `NextContextExpr` that's folded into the subsequent one is not stored (that
 *     is, the call is purely side-effectful).
 *   * No operations in between them uses the implicit context.
 */
export function mergeNextContextExpressions(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.Listener) {
                mergeNextContextsInOps(op.handlerOps);
            }
        }
        mergeNextContextsInOps(unit.update);
    }
}
function mergeNextContextsInOps(ops) {
    for (const op of ops) {
        // Look for a candidate operation to maybe merge.
        if (op.kind !== ir.OpKind.Statement || !(op.statement instanceof o.ExpressionStatement) ||
            !(op.statement.expr instanceof ir.NextContextExpr)) {
            continue;
        }
        const mergeSteps = op.statement.expr.steps;
        // Try to merge this `ir.NextContextExpr`.
        let tryToMerge = true;
        for (let candidate = op.next; candidate.kind !== ir.OpKind.ListEnd && tryToMerge; candidate = candidate.next) {
            ir.visitExpressionsInOp(candidate, (expr, flags) => {
                if (!ir.isIrExpression(expr)) {
                    return expr;
                }
                if (!tryToMerge) {
                    // Either we've already merged, or failed to merge.
                    return;
                }
                if (flags & ir.VisitorContextFlag.InChildOperation) {
                    // We cannot merge into child operations.
                    return;
                }
                switch (expr.kind) {
                    case ir.ExpressionKind.NextContext:
                        // Merge the previous `ir.NextContextExpr` into this one.
                        expr.steps += mergeSteps;
                        ir.OpList.remove(op);
                        tryToMerge = false;
                        break;
                    case ir.ExpressionKind.GetCurrentView:
                    case ir.ExpressionKind.Reference:
                        // Can't merge past a dependency on the context.
                        tryToMerge = false;
                        break;
                }
                return;
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV4dF9jb250ZXh0X21lcmdpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9uZXh0X2NvbnRleHRfbWVyZ2luZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9COzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUFDLEdBQW1CO0lBQzdELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNuQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNILENBQUM7UUFDRCxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEMsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLEdBQTJCO0lBQ3pELEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsaURBQWlEO1FBQ2pELElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsbUJBQW1CLENBQUM7WUFDbkYsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBQ3ZELFNBQVM7UUFDWCxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBRTNDLDBDQUEwQztRQUMxQyxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDdEIsS0FBSyxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUMsSUFBSyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksVUFBVSxFQUM1RSxTQUFTLEdBQUcsU0FBUyxDQUFDLElBQUssRUFBRSxDQUFDO1lBQ2pDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ2pELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQzdCLE9BQU8sSUFBSSxDQUFDO2dCQUNkLENBQUM7Z0JBRUQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUNoQixtREFBbUQ7b0JBQ25ELE9BQU87Z0JBQ1QsQ0FBQztnQkFFRCxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDbkQseUNBQXlDO29CQUN6QyxPQUFPO2dCQUNULENBQUM7Z0JBRUQsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ2xCLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXO3dCQUNoQyx5REFBeUQ7d0JBQ3pELElBQUksQ0FBQyxLQUFLLElBQUksVUFBVSxDQUFDO3dCQUN6QixFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFpQixDQUFDLENBQUM7d0JBQ3BDLFVBQVUsR0FBRyxLQUFLLENBQUM7d0JBQ25CLE1BQU07b0JBQ1IsS0FBSyxFQUFFLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQztvQkFDdEMsS0FBSyxFQUFFLENBQUMsY0FBYyxDQUFDLFNBQVM7d0JBQzlCLGdEQUFnRDt3QkFDaEQsVUFBVSxHQUFHLEtBQUssQ0FBQzt3QkFDbkIsTUFBTTtnQkFDVixDQUFDO2dCQUNELE9BQU87WUFDVCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogTWVyZ2VzIGxvZ2ljYWxseSBzZXF1ZW50aWFsIGBOZXh0Q29udGV4dEV4cHJgIG9wZXJhdGlvbnMuXG4gKlxuICogYE5leHRDb250ZXh0RXhwcmAgY2FuIGJlIHJlZmVyZW5jZWQgcmVwZWF0ZWRseSwgXCJwb3BwaW5nXCIgdGhlIHJ1bnRpbWUncyBjb250ZXh0IHN0YWNrIGVhY2ggdGltZS5cbiAqIFdoZW4gdHdvIHN1Y2ggZXhwcmVzc2lvbnMgYXBwZWFyIGJhY2stdG8tYmFjaywgaXQncyBwb3NzaWJsZSB0byBtZXJnZSB0aGVtIHRvZ2V0aGVyIGludG8gYSBzaW5nbGVcbiAqIGBOZXh0Q29udGV4dEV4cHJgIHRoYXQgc3RlcHMgbXVsdGlwbGUgY29udGV4dHMuIFRoaXMgbWVyZ2luZyBpcyBwb3NzaWJsZSBpZiBhbGwgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAgICogVGhlIHJlc3VsdCBvZiB0aGUgYE5leHRDb250ZXh0RXhwcmAgdGhhdCdzIGZvbGRlZCBpbnRvIHRoZSBzdWJzZXF1ZW50IG9uZSBpcyBub3Qgc3RvcmVkICh0aGF0XG4gKiAgICAgaXMsIHRoZSBjYWxsIGlzIHB1cmVseSBzaWRlLWVmZmVjdGZ1bCkuXG4gKiAgICogTm8gb3BlcmF0aW9ucyBpbiBiZXR3ZWVuIHRoZW0gdXNlcyB0aGUgaW1wbGljaXQgY29udGV4dC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlTmV4dENvbnRleHRFeHByZXNzaW9ucyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkxpc3RlbmVyKSB7XG4gICAgICAgIG1lcmdlTmV4dENvbnRleHRzSW5PcHMob3AuaGFuZGxlck9wcyk7XG4gICAgICB9XG4gICAgfVxuICAgIG1lcmdlTmV4dENvbnRleHRzSW5PcHModW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1lcmdlTmV4dENvbnRleHRzSW5PcHMob3BzOiBpci5PcExpc3Q8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgLy8gTG9vayBmb3IgYSBjYW5kaWRhdGUgb3BlcmF0aW9uIHRvIG1heWJlIG1lcmdlLlxuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50IHx8ICEob3Auc3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB8fFxuICAgICAgICAhKG9wLnN0YXRlbWVudC5leHByIGluc3RhbmNlb2YgaXIuTmV4dENvbnRleHRFeHByKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgbWVyZ2VTdGVwcyA9IG9wLnN0YXRlbWVudC5leHByLnN0ZXBzO1xuXG4gICAgLy8gVHJ5IHRvIG1lcmdlIHRoaXMgYGlyLk5leHRDb250ZXh0RXhwcmAuXG4gICAgbGV0IHRyeVRvTWVyZ2UgPSB0cnVlO1xuICAgIGZvciAobGV0IGNhbmRpZGF0ZSA9IG9wLm5leHQhOyBjYW5kaWRhdGUua2luZCAhPT0gaXIuT3BLaW5kLkxpc3RFbmQgJiYgdHJ5VG9NZXJnZTtcbiAgICAgICAgIGNhbmRpZGF0ZSA9IGNhbmRpZGF0ZS5uZXh0ISkge1xuICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3AoY2FuZGlkYXRlLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0cnlUb01lcmdlKSB7XG4gICAgICAgICAgLy8gRWl0aGVyIHdlJ3ZlIGFscmVhZHkgbWVyZ2VkLCBvciBmYWlsZWQgdG8gbWVyZ2UuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZsYWdzICYgaXIuVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pIHtcbiAgICAgICAgICAvLyBXZSBjYW5ub3QgbWVyZ2UgaW50byBjaGlsZCBvcGVyYXRpb25zLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAoZXhwci5raW5kKSB7XG4gICAgICAgICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5OZXh0Q29udGV4dDpcbiAgICAgICAgICAgIC8vIE1lcmdlIHRoZSBwcmV2aW91cyBgaXIuTmV4dENvbnRleHRFeHByYCBpbnRvIHRoaXMgb25lLlxuICAgICAgICAgICAgZXhwci5zdGVwcyArPSBtZXJnZVN0ZXBzO1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5VcGRhdGVPcCk7XG4gICAgICAgICAgICB0cnlUb01lcmdlID0gZmFsc2U7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLkdldEN1cnJlbnRWaWV3OlxuICAgICAgICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlOlxuICAgICAgICAgICAgLy8gQ2FuJ3QgbWVyZ2UgcGFzdCBhIGRlcGVuZGVuY3kgb24gdGhlIGNvbnRleHQuXG4gICAgICAgICAgICB0cnlUb01lcmdlID0gZmFsc2U7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==