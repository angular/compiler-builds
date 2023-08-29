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
            const defaultCase = op.conditions.findIndex(([xref, cond]) => cond === null);
            if (defaultCase >= 0) {
                const [xref, cond] = op.conditions.splice(defaultCase, 1)[0];
                test = new ir.SlotLiteralExpr(xref);
            }
            else {
                // By default, a switch evaluates to `-1`, causing no template to be displayed.
                test = o.literal(-1);
            }
            // Switch expressions assign their main test to a temporary, to avoid re-executing it.
            let tmp = new ir.AssignTemporaryExpr(op.test, job.allocateXrefId());
            // For each remaining condition, test whether the temporary satifies the check.
            for (let i = op.conditions.length - 1; i >= 0; i--) {
                const useTmp = i === 0 ? tmp : new ir.ReadTemporaryExpr(tmp.xref);
                const [xref, check] = op.conditions[i];
                const comparison = new o.BinaryOperatorExpr(o.BinaryOperator.Identical, useTmp, check);
                test = new o.ConditionalExpr(comparison, new ir.SlotLiteralExpr(xref), test);
            }
            // Save the resulting aggregate Joost-expression.
            op.processed = test;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZGl0aW9uYWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY29uZGl0aW9uYWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRTtnQkFDckMsU0FBUzthQUNWO1lBRUQsSUFBSSxJQUFrQixDQUFDO1lBRXZCLHVGQUF1RjtZQUN2RixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7WUFDN0UsSUFBSSxXQUFXLElBQUksQ0FBQyxFQUFFO2dCQUNwQixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNyQztpQkFBTTtnQkFDTCwrRUFBK0U7Z0JBQy9FLElBQUksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdEI7WUFFRCxzRkFBc0Y7WUFDdEYsSUFBSSxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztZQUVwRSwrRUFBK0U7WUFDL0UsS0FBSyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDbEQsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQU0sQ0FBQyxDQUFDO2dCQUN4RixJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDOUU7WUFFRCxpREFBaUQ7WUFDakQsRUFBRSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7U0FDckI7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ29sbGFwc2UgdGhlIHZhcmlvdXMgY29uZGl0aW9ucyBvZiBjb25kaXRpb25hbCBvcHMgaW50byBhIHNpbmdsZSB0ZXN0IGV4cHJlc3Npb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUNvbmRpdGlvbmFscyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuQ29uZGl0aW9uYWwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGxldCB0ZXN0OiBvLkV4cHJlc3Npb247XG5cbiAgICAgIC8vIEFueSBjYXNlIHdpdGggYSBgbnVsbGAgY29uZGl0aW9uIGlzIGBkZWZhdWx0YC4gSWYgb25lIGV4aXN0cywgZGVmYXVsdCB0byBpdCBpbnN0ZWFkLlxuICAgICAgY29uc3QgZGVmYXVsdENhc2UgPSBvcC5jb25kaXRpb25zLmZpbmRJbmRleCgoW3hyZWYsIGNvbmRdKSA9PiBjb25kID09PSBudWxsKTtcbiAgICAgIGlmIChkZWZhdWx0Q2FzZSA+PSAwKSB7XG4gICAgICAgIGNvbnN0IFt4cmVmLCBjb25kXSA9IG9wLmNvbmRpdGlvbnMuc3BsaWNlKGRlZmF1bHRDYXNlLCAxKVswXTtcbiAgICAgICAgdGVzdCA9IG5ldyBpci5TbG90TGl0ZXJhbEV4cHIoeHJlZik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCeSBkZWZhdWx0LCBhIHN3aXRjaCBldmFsdWF0ZXMgdG8gYC0xYCwgY2F1c2luZyBubyB0ZW1wbGF0ZSB0byBiZSBkaXNwbGF5ZWQuXG4gICAgICAgIHRlc3QgPSBvLmxpdGVyYWwoLTEpO1xuICAgICAgfVxuXG4gICAgICAvLyBTd2l0Y2ggZXhwcmVzc2lvbnMgYXNzaWduIHRoZWlyIG1haW4gdGVzdCB0byBhIHRlbXBvcmFyeSwgdG8gYXZvaWQgcmUtZXhlY3V0aW5nIGl0LlxuICAgICAgbGV0IHRtcCA9IG5ldyBpci5Bc3NpZ25UZW1wb3JhcnlFeHByKG9wLnRlc3QsIGpvYi5hbGxvY2F0ZVhyZWZJZCgpKTtcblxuICAgICAgLy8gRm9yIGVhY2ggcmVtYWluaW5nIGNvbmRpdGlvbiwgdGVzdCB3aGV0aGVyIHRoZSB0ZW1wb3Jhcnkgc2F0aWZpZXMgdGhlIGNoZWNrLlxuICAgICAgZm9yIChsZXQgaSA9IG9wLmNvbmRpdGlvbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgdXNlVG1wID0gaSA9PT0gMCA/IHRtcCA6IG5ldyBpci5SZWFkVGVtcG9yYXJ5RXhwcih0bXAueHJlZik7XG4gICAgICAgIGNvbnN0IFt4cmVmLCBjaGVja10gPSBvcC5jb25kaXRpb25zW2ldO1xuICAgICAgICBjb25zdCBjb21wYXJpc29uID0gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKG8uQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsLCB1c2VUbXAsIGNoZWNrISk7XG4gICAgICAgIHRlc3QgPSBuZXcgby5Db25kaXRpb25hbEV4cHIoY29tcGFyaXNvbiwgbmV3IGlyLlNsb3RMaXRlcmFsRXhwcih4cmVmKSwgdGVzdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNhdmUgdGhlIHJlc3VsdGluZyBhZ2dyZWdhdGUgSm9vc3QtZXhwcmVzc2lvbi5cbiAgICAgIG9wLnByb2Nlc3NlZCA9IHRlc3Q7XG4gICAgfVxuICB9XG59XG4iXX0=