/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import { Identifiers as R3 } from '../../../../render3/r3_identifiers';
import * as ir from '../../ir';
const CHAINABLE = new Set([
    R3.attribute,
    R3.classProp,
    R3.element,
    R3.elementContainer,
    R3.elementContainerEnd,
    R3.elementContainerStart,
    R3.elementEnd,
    R3.elementStart,
    R3.hostProperty,
    R3.i18nExp,
    R3.listener,
    R3.listener,
    R3.property,
    R3.styleProp,
    R3.stylePropInterpolate1,
    R3.stylePropInterpolate2,
    R3.stylePropInterpolate3,
    R3.stylePropInterpolate4,
    R3.stylePropInterpolate5,
    R3.stylePropInterpolate6,
    R3.stylePropInterpolate7,
    R3.stylePropInterpolate8,
    R3.stylePropInterpolateV,
    R3.syntheticHostListener,
    R3.syntheticHostProperty,
    R3.templateCreate,
]);
/**
 * Post-process a reified view compilation and convert sequential calls to chainable instructions
 * into chain calls.
 *
 * For example, two `elementStart` operations in sequence:
 *
 * ```typescript
 * elementStart(0, 'div');
 * elementStart(1, 'span');
 * ```
 *
 * Can be called as a chain instead:
 *
 * ```typescript
 * elementStart(0, 'div')(1, 'span');
 * ```
 */
export function phaseChaining(job) {
    for (const unit of job.units) {
        chainOperationsInList(unit.create);
        chainOperationsInList(unit.update);
    }
}
function chainOperationsInList(opList) {
    let chain = null;
    for (const op of opList) {
        if (op.kind !== ir.OpKind.Statement || !(op.statement instanceof o.ExpressionStatement)) {
            // This type of statement isn't chainable.
            chain = null;
            continue;
        }
        if (!(op.statement.expr instanceof o.InvokeFunctionExpr) ||
            !(op.statement.expr.fn instanceof o.ExternalExpr)) {
            // This is a statement, but not an instruction-type call, so not chainable.
            chain = null;
            continue;
        }
        const instruction = op.statement.expr.fn.value;
        if (!CHAINABLE.has(instruction)) {
            // This instruction isn't chainable.
            chain = null;
            continue;
        }
        // This instruction can be chained. It can either be added on to the previous chain (if
        // compatible) or it can be the start of a new chain.
        if (chain !== null && chain.instruction === instruction) {
            // This instruction can be added onto the previous chain.
            const expression = chain.expression.callFn(op.statement.expr.args, op.statement.expr.sourceSpan, op.statement.expr.pure);
            chain.expression = expression;
            chain.op.statement = expression.toStmt();
            ir.OpList.remove(op);
        }
        else {
            // Leave this instruction alone for now, but consider it the start of a new chain.
            chain = {
                op,
                instruction,
                expression: op.statement.expr,
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxPQUFPO0lBQ1YsRUFBRSxDQUFDLGdCQUFnQjtJQUNuQixFQUFFLENBQUMsbUJBQW1CO0lBQ3RCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLFVBQVU7SUFDYixFQUFFLENBQUMsWUFBWTtJQUNmLEVBQUUsQ0FBQyxZQUFZO0lBQ2YsRUFBRSxDQUFDLE9BQU87SUFDVixFQUFFLENBQUMsUUFBUTtJQUNYLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFFBQVE7SUFDWCxFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMsY0FBYztDQUNsQixDQUFDLENBQUM7QUFFSDs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsR0FBbUI7SUFDL0MsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDcEM7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxNQUEwQztJQUN2RSxJQUFJLEtBQUssR0FBZSxJQUFJLENBQUM7SUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxNQUFNLEVBQUU7UUFDdkIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO1lBQ3ZGLDBDQUEwQztZQUMxQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBQ0QsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixDQUFDO1lBQ3BELENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ3JELDJFQUEyRTtZQUMzRSxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBRUQsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUMvQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUMvQixvQ0FBb0M7WUFDcEMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUVELHVGQUF1RjtRQUN2RixxREFBcUQ7UUFDckQsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssV0FBVyxFQUFFO1lBQ3ZELHlEQUF5RDtZQUN6RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FDdEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsRixLQUFLLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUM5QixLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDekMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBb0MsQ0FBQyxDQUFDO1NBQ3hEO2FBQU07WUFDTCxrRkFBa0Y7WUFDbEYsS0FBSyxHQUFHO2dCQUNOLEVBQUU7Z0JBQ0YsV0FBVztnQkFDWCxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJO2FBQzlCLENBQUM7U0FDSDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5jb25zdCBDSEFJTkFCTEUgPSBuZXcgU2V0KFtcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5jbGFzc1Byb3AsXG4gIFIzLmVsZW1lbnQsXG4gIFIzLmVsZW1lbnRDb250YWluZXIsXG4gIFIzLmVsZW1lbnRDb250YWluZXJFbmQsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudFN0YXJ0LFxuICBSMy5ob3N0UHJvcGVydHksXG4gIFIzLmkxOG5FeHAsXG4gIFIzLmxpc3RlbmVyLFxuICBSMy5saXN0ZW5lcixcbiAgUjMucHJvcGVydHksXG4gIFIzLnN0eWxlUHJvcCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTIsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTUsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTgsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlVixcbiAgUjMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHksXG4gIFIzLnRlbXBsYXRlQ3JlYXRlLFxuXSk7XG5cbi8qKlxuICogUG9zdC1wcm9jZXNzIGEgcmVpZmllZCB2aWV3IGNvbXBpbGF0aW9uIGFuZCBjb252ZXJ0IHNlcXVlbnRpYWwgY2FsbHMgdG8gY2hhaW5hYmxlIGluc3RydWN0aW9uc1xuICogaW50byBjaGFpbiBjYWxscy5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdHdvIGBlbGVtZW50U3RhcnRgIG9wZXJhdGlvbnMgaW4gc2VxdWVuY2U6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKTtcbiAqIGVsZW1lbnRTdGFydCgxLCAnc3BhbicpO1xuICogYGBgXG4gKlxuICogQ2FuIGJlIGNhbGxlZCBhcyBhIGNoYWluIGluc3RlYWQ6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKSgxLCAnc3BhbicpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUNoYWluaW5nKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNoYWluT3BlcmF0aW9uc0luTGlzdCh1bml0LmNyZWF0ZSk7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qob3BMaXN0OiBpci5PcExpc3Q8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGxldCBjaGFpbjogQ2hhaW58bnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BMaXN0KSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgfHwgIShvcC5zdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpKSB7XG4gICAgICAvLyBUaGlzIHR5cGUgb2Ygc3RhdGVtZW50IGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIShvcC5zdGF0ZW1lbnQuZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB8fFxuICAgICAgICAhKG9wLnN0YXRlbWVudC5leHByLmZuIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIpKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgc3RhdGVtZW50LCBidXQgbm90IGFuIGluc3RydWN0aW9uLXR5cGUgY2FsbCwgc28gbm90IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGluc3RydWN0aW9uID0gb3Auc3RhdGVtZW50LmV4cHIuZm4udmFsdWU7XG4gICAgaWYgKCFDSEFJTkFCTEUuaGFzKGluc3RydWN0aW9uKSkge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBpc24ndCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGluc3RydWN0aW9uIGNhbiBiZSBjaGFpbmVkLiBJdCBjYW4gZWl0aGVyIGJlIGFkZGVkIG9uIHRvIHRoZSBwcmV2aW91cyBjaGFpbiAoaWZcbiAgICAvLyBjb21wYXRpYmxlKSBvciBpdCBjYW4gYmUgdGhlIHN0YXJ0IG9mIGEgbmV3IGNoYWluLlxuICAgIGlmIChjaGFpbiAhPT0gbnVsbCAmJiBjaGFpbi5pbnN0cnVjdGlvbiA9PT0gaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGFkZGVkIG9udG8gdGhlIHByZXZpb3VzIGNoYWluLlxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGNoYWluLmV4cHJlc3Npb24uY2FsbEZuKFxuICAgICAgICAgIG9wLnN0YXRlbWVudC5leHByLmFyZ3MsIG9wLnN0YXRlbWVudC5leHByLnNvdXJjZVNwYW4sIG9wLnN0YXRlbWVudC5leHByLnB1cmUpO1xuICAgICAgY2hhaW4uZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XG4gICAgICBjaGFpbi5vcC5zdGF0ZW1lbnQgPSBleHByZXNzaW9uLnRvU3RtdCgpO1xuICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5PcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBMZWF2ZSB0aGlzIGluc3RydWN0aW9uIGFsb25lIGZvciBub3csIGJ1dCBjb25zaWRlciBpdCB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgICBjaGFpbiA9IHtcbiAgICAgICAgb3AsXG4gICAgICAgIGluc3RydWN0aW9uLFxuICAgICAgICBleHByZXNzaW9uOiBvcC5zdGF0ZW1lbnQuZXhwcixcbiAgICAgIH07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU3RydWN0dXJlIHJlcHJlc2VudGluZyBhbiBpbi1wcm9ncmVzcyBjaGFpbi5cbiAqL1xuaW50ZXJmYWNlIENoYWluIHtcbiAgLyoqXG4gICAqIFRoZSBzdGF0ZW1lbnQgd2hpY2ggaG9sZHMgdGhlIGVudGlyZSBjaGFpbi5cbiAgICovXG4gIG9wOiBpci5TdGF0ZW1lbnRPcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD47XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgd2hvbGUgY3VycmVudCBjaGFpbmVkIGNhbGwuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGJlIHRoZSBzYW1lIGFzIGBvcC5zdGF0ZW1lbnQuZXhwcmVzc2lvbmAsIGJ1dCBpcyBleHRyYWN0ZWQgaGVyZSBmb3IgY29udmVuaWVuY2VcbiAgICogc2luY2UgdGhlIGBvcGAgdHlwZSBkb2Vzbid0IGNhcHR1cmUgdGhlIGZhY3QgdGhhdCBgb3Auc3RhdGVtZW50YCBpcyBhbiBgby5FeHByZXNzaW9uU3RhdGVtZW50YC5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGluc3RydWN0aW9uIHRoYXQgaXMgYmVpbmcgY2hhaW5lZC5cbiAgICovXG4gIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xufVxuIl19