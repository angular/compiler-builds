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
 * Collapse the various conditions of conditional ops into a single test expression.
 */
export function phaseConditionals(job) {
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            if (op.kind !== ir.OpKind.Conditional) {
                continue;
            }
            let test;
            // Any case with a `null` condition is `default`. If one exists, default to it instead.
            const defaultCase = op.conditions.findIndex((cond) => cond.expr === null);
            if (defaultCase >= 0) {
                const slot = op.conditions.splice(defaultCase, 1)[0].targetSlot;
                test = new ir.SlotLiteralExpr(slot);
            }
            else {
                // By default, a switch evaluates to `-1`, causing no template to be displayed.
                test = o.literal(-1);
            }
            // Switch expressions assign their main test to a temporary, to avoid re-executing it.
            let tmp = op.test == null ? null : new ir.AssignTemporaryExpr(op.test, job.allocateXrefId());
            // For each remaining condition, test whether the temporary satifies the check. (If no temp is
            // present, just check each expression directly.)
            for (let i = op.conditions.length - 1; i >= 0; i--) {
                let conditionalCase = op.conditions[i];
                if (conditionalCase.expr === null) {
                    continue;
                }
                if (tmp !== null) {
                    const useTmp = i === 0 ? tmp : new ir.ReadTemporaryExpr(tmp.xref);
                    conditionalCase.expr =
                        new o.BinaryOperatorExpr(o.BinaryOperator.Identical, useTmp, conditionalCase.expr);
                }
                else if (conditionalCase.alias !== null) {
                    const caseExpressionTemporaryXref = job.allocateXrefId();
                    conditionalCase.expr =
                        new ir.AssignTemporaryExpr(conditionalCase.expr, caseExpressionTemporaryXref);
                    op.contextValue = new ir.ReadTemporaryExpr(caseExpressionTemporaryXref);
                }
                test = new o.ConditionalExpr(conditionalCase.expr, new ir.SlotLiteralExpr(conditionalCase.targetSlot), test);
            }
            // Save the resulting aggregate Joost-expression.
            op.processed = test;
            // Clear the original conditions array, since we no longer need it, and don't want it to
            // affect subsequent phases (e.g. pipe creation).
            op.conditions = [];
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZGl0aW9uYWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY29uZGl0aW9uYWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRTtnQkFDckMsU0FBUzthQUNWO1lBRUQsSUFBSSxJQUFrQixDQUFDO1lBRXZCLHVGQUF1RjtZQUN2RixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztZQUMxRSxJQUFJLFdBQVcsSUFBSSxDQUFDLEVBQUU7Z0JBQ3BCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7Z0JBQ2hFLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDckM7aUJBQU07Z0JBQ0wsK0VBQStFO2dCQUMvRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3RCO1lBRUQsc0ZBQXNGO1lBQ3RGLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFFN0YsOEZBQThGO1lBQzlGLGlEQUFpRDtZQUNqRCxLQUFLLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUNsRCxJQUFJLGVBQWUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLGVBQWUsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO29CQUNqQyxTQUFTO2lCQUNWO2dCQUNELElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtvQkFDaEIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2xFLGVBQWUsQ0FBQyxJQUFJO3dCQUNoQixJQUFJLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN4RjtxQkFBTSxJQUFJLGVBQWUsQ0FBQyxLQUFLLEtBQUssSUFBSSxFQUFFO29CQUN6QyxNQUFNLDJCQUEyQixHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDekQsZUFBZSxDQUFDLElBQUk7d0JBQ2hCLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztvQkFDbEYsRUFBRSxDQUFDLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO2lCQUN6RTtnQkFDRCxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUN4QixlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDckY7WUFFRCxpREFBaUQ7WUFDakQsRUFBRSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFFcEIsd0ZBQXdGO1lBQ3hGLGlEQUFpRDtZQUNqRCxFQUFFLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztTQUNwQjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDb2xsYXBzZSB0aGUgdmFyaW91cyBjb25kaXRpb25zIG9mIGNvbmRpdGlvbmFsIG9wcyBpbnRvIGEgc2luZ2xlIHRlc3QgZXhwcmVzc2lvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQ29uZGl0aW9uYWxzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5Db25kaXRpb25hbCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbGV0IHRlc3Q6IG8uRXhwcmVzc2lvbjtcblxuICAgICAgLy8gQW55IGNhc2Ugd2l0aCBhIGBudWxsYCBjb25kaXRpb24gaXMgYGRlZmF1bHRgLiBJZiBvbmUgZXhpc3RzLCBkZWZhdWx0IHRvIGl0IGluc3RlYWQuXG4gICAgICBjb25zdCBkZWZhdWx0Q2FzZSA9IG9wLmNvbmRpdGlvbnMuZmluZEluZGV4KChjb25kKSA9PiBjb25kLmV4cHIgPT09IG51bGwpO1xuICAgICAgaWYgKGRlZmF1bHRDYXNlID49IDApIHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IG9wLmNvbmRpdGlvbnMuc3BsaWNlKGRlZmF1bHRDYXNlLCAxKVswXS50YXJnZXRTbG90O1xuICAgICAgICB0ZXN0ID0gbmV3IGlyLlNsb3RMaXRlcmFsRXhwcihzbG90KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJ5IGRlZmF1bHQsIGEgc3dpdGNoIGV2YWx1YXRlcyB0byBgLTFgLCBjYXVzaW5nIG5vIHRlbXBsYXRlIHRvIGJlIGRpc3BsYXllZC5cbiAgICAgICAgdGVzdCA9IG8ubGl0ZXJhbCgtMSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFN3aXRjaCBleHByZXNzaW9ucyBhc3NpZ24gdGhlaXIgbWFpbiB0ZXN0IHRvIGEgdGVtcG9yYXJ5LCB0byBhdm9pZCByZS1leGVjdXRpbmcgaXQuXG4gICAgICBsZXQgdG1wID0gb3AudGVzdCA9PSBudWxsID8gbnVsbCA6IG5ldyBpci5Bc3NpZ25UZW1wb3JhcnlFeHByKG9wLnRlc3QsIGpvYi5hbGxvY2F0ZVhyZWZJZCgpKTtcblxuICAgICAgLy8gRm9yIGVhY2ggcmVtYWluaW5nIGNvbmRpdGlvbiwgdGVzdCB3aGV0aGVyIHRoZSB0ZW1wb3Jhcnkgc2F0aWZpZXMgdGhlIGNoZWNrLiAoSWYgbm8gdGVtcCBpc1xuICAgICAgLy8gcHJlc2VudCwganVzdCBjaGVjayBlYWNoIGV4cHJlc3Npb24gZGlyZWN0bHkuKVxuICAgICAgZm9yIChsZXQgaSA9IG9wLmNvbmRpdGlvbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgbGV0IGNvbmRpdGlvbmFsQ2FzZSA9IG9wLmNvbmRpdGlvbnNbaV07XG4gICAgICAgIGlmIChjb25kaXRpb25hbENhc2UuZXhwciA9PT0gbnVsbCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0bXAgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCB1c2VUbXAgPSBpID09PSAwID8gdG1wIDogbmV3IGlyLlJlYWRUZW1wb3JhcnlFeHByKHRtcC54cmVmKTtcbiAgICAgICAgICBjb25kaXRpb25hbENhc2UuZXhwciA9XG4gICAgICAgICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbCwgdXNlVG1wLCBjb25kaXRpb25hbENhc2UuZXhwcik7XG4gICAgICAgIH0gZWxzZSBpZiAoY29uZGl0aW9uYWxDYXNlLmFsaWFzICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgY2FzZUV4cHJlc3Npb25UZW1wb3JhcnlYcmVmID0gam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgICAgICAgY29uZGl0aW9uYWxDYXNlLmV4cHIgPVxuICAgICAgICAgICAgICBuZXcgaXIuQXNzaWduVGVtcG9yYXJ5RXhwcihjb25kaXRpb25hbENhc2UuZXhwciwgY2FzZUV4cHJlc3Npb25UZW1wb3JhcnlYcmVmKTtcbiAgICAgICAgICBvcC5jb250ZXh0VmFsdWUgPSBuZXcgaXIuUmVhZFRlbXBvcmFyeUV4cHIoY2FzZUV4cHJlc3Npb25UZW1wb3JhcnlYcmVmKTtcbiAgICAgICAgfVxuICAgICAgICB0ZXN0ID0gbmV3IG8uQ29uZGl0aW9uYWxFeHByKFxuICAgICAgICAgICAgY29uZGl0aW9uYWxDYXNlLmV4cHIsIG5ldyBpci5TbG90TGl0ZXJhbEV4cHIoY29uZGl0aW9uYWxDYXNlLnRhcmdldFNsb3QpLCB0ZXN0KTtcbiAgICAgIH1cblxuICAgICAgLy8gU2F2ZSB0aGUgcmVzdWx0aW5nIGFnZ3JlZ2F0ZSBKb29zdC1leHByZXNzaW9uLlxuICAgICAgb3AucHJvY2Vzc2VkID0gdGVzdDtcblxuICAgICAgLy8gQ2xlYXIgdGhlIG9yaWdpbmFsIGNvbmRpdGlvbnMgYXJyYXksIHNpbmNlIHdlIG5vIGxvbmdlciBuZWVkIGl0LCBhbmQgZG9uJ3Qgd2FudCBpdCB0b1xuICAgICAgLy8gYWZmZWN0IHN1YnNlcXVlbnQgcGhhc2VzIChlLmcuIHBpcGUgY3JlYXRpb24pLlxuICAgICAgb3AuY29uZGl0aW9ucyA9IFtdO1xuICAgIH1cbiAgfVxufVxuIl19