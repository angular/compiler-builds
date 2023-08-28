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
    R3.elementStart,
    R3.elementEnd,
    R3.element,
    R3.property,
    R3.hostProperty,
    R3.syntheticHostProperty,
    R3.styleProp,
    R3.attribute,
    R3.stylePropInterpolate1,
    R3.stylePropInterpolate2,
    R3.stylePropInterpolate3,
    R3.stylePropInterpolate4,
    R3.stylePropInterpolate5,
    R3.stylePropInterpolate6,
    R3.stylePropInterpolate7,
    R3.stylePropInterpolate8,
    R3.stylePropInterpolateV,
    R3.classProp,
    R3.listener,
    R3.elementContainerStart,
    R3.elementContainerEnd,
    R3.elementContainer,
    R3.listener,
    R3.syntheticHostListener,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsVUFBVTtJQUNiLEVBQUUsQ0FBQyxPQUFPO0lBQ1YsRUFBRSxDQUFDLFFBQVE7SUFDWCxFQUFFLENBQUMsWUFBWTtJQUNmLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxTQUFTO0lBQ1osRUFBRSxDQUFDLFFBQVE7SUFDWCxFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxtQkFBbUI7SUFDdEIsRUFBRSxDQUFDLGdCQUFnQjtJQUNuQixFQUFFLENBQUMsUUFBUTtJQUNYLEVBQUUsQ0FBQyxxQkFBcUI7Q0FDekIsQ0FBQyxDQUFDO0FBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUFDLEdBQW1CO0lBQy9DLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3BDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsTUFBMEM7SUFDdkUsSUFBSSxLQUFLLEdBQWUsSUFBSSxDQUFDO0lBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFO1FBQ3ZCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUN2RiwwQ0FBMEM7WUFDMUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUNELElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztZQUNwRCxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNyRCwyRUFBMkU7WUFDM0UsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUVELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDL0Isb0NBQW9DO1lBQ3BDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFFRCx1RkFBdUY7UUFDdkYscURBQXFEO1FBQ3JELElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFdBQVcsRUFBRTtZQUN2RCx5REFBeUQ7WUFDekQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQ3RDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEYsS0FBSyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDOUIsS0FBSyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQW9DLENBQUMsQ0FBQztTQUN4RDthQUFNO1lBQ0wsa0ZBQWtGO1lBQ2xGLEtBQUssR0FBRztnQkFDTixFQUFFO2dCQUNGLFdBQVc7Z0JBQ1gsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSTthQUM5QixDQUFDO1NBQ0g7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuY29uc3QgQ0hBSU5BQkxFID0gbmV3IFNldChbXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudCxcbiAgUjMucHJvcGVydHksXG4gIFIzLmhvc3RQcm9wZXJ0eSxcbiAgUjMuc3ludGhldGljSG9zdFByb3BlcnR5LFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLmF0dHJpYnV0ZSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTIsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTUsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTgsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlVixcbiAgUjMuY2xhc3NQcm9wLFxuICBSMy5saXN0ZW5lcixcbiAgUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0LFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5lbGVtZW50Q29udGFpbmVyLFxuICBSMy5saXN0ZW5lcixcbiAgUjMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuXSk7XG5cbi8qKlxuICogUG9zdC1wcm9jZXNzIGEgcmVpZmllZCB2aWV3IGNvbXBpbGF0aW9uIGFuZCBjb252ZXJ0IHNlcXVlbnRpYWwgY2FsbHMgdG8gY2hhaW5hYmxlIGluc3RydWN0aW9uc1xuICogaW50byBjaGFpbiBjYWxscy5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdHdvIGBlbGVtZW50U3RhcnRgIG9wZXJhdGlvbnMgaW4gc2VxdWVuY2U6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKTtcbiAqIGVsZW1lbnRTdGFydCgxLCAnc3BhbicpO1xuICogYGBgXG4gKlxuICogQ2FuIGJlIGNhbGxlZCBhcyBhIGNoYWluIGluc3RlYWQ6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKSgxLCAnc3BhbicpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUNoYWluaW5nKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNoYWluT3BlcmF0aW9uc0luTGlzdCh1bml0LmNyZWF0ZSk7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qob3BMaXN0OiBpci5PcExpc3Q8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGxldCBjaGFpbjogQ2hhaW58bnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BMaXN0KSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgfHwgIShvcC5zdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpKSB7XG4gICAgICAvLyBUaGlzIHR5cGUgb2Ygc3RhdGVtZW50IGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIShvcC5zdGF0ZW1lbnQuZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB8fFxuICAgICAgICAhKG9wLnN0YXRlbWVudC5leHByLmZuIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIpKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgc3RhdGVtZW50LCBidXQgbm90IGFuIGluc3RydWN0aW9uLXR5cGUgY2FsbCwgc28gbm90IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGluc3RydWN0aW9uID0gb3Auc3RhdGVtZW50LmV4cHIuZm4udmFsdWU7XG4gICAgaWYgKCFDSEFJTkFCTEUuaGFzKGluc3RydWN0aW9uKSkge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBpc24ndCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGluc3RydWN0aW9uIGNhbiBiZSBjaGFpbmVkLiBJdCBjYW4gZWl0aGVyIGJlIGFkZGVkIG9uIHRvIHRoZSBwcmV2aW91cyBjaGFpbiAoaWZcbiAgICAvLyBjb21wYXRpYmxlKSBvciBpdCBjYW4gYmUgdGhlIHN0YXJ0IG9mIGEgbmV3IGNoYWluLlxuICAgIGlmIChjaGFpbiAhPT0gbnVsbCAmJiBjaGFpbi5pbnN0cnVjdGlvbiA9PT0gaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGFkZGVkIG9udG8gdGhlIHByZXZpb3VzIGNoYWluLlxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGNoYWluLmV4cHJlc3Npb24uY2FsbEZuKFxuICAgICAgICAgIG9wLnN0YXRlbWVudC5leHByLmFyZ3MsIG9wLnN0YXRlbWVudC5leHByLnNvdXJjZVNwYW4sIG9wLnN0YXRlbWVudC5leHByLnB1cmUpO1xuICAgICAgY2hhaW4uZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XG4gICAgICBjaGFpbi5vcC5zdGF0ZW1lbnQgPSBleHByZXNzaW9uLnRvU3RtdCgpO1xuICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5PcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBMZWF2ZSB0aGlzIGluc3RydWN0aW9uIGFsb25lIGZvciBub3csIGJ1dCBjb25zaWRlciBpdCB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgICBjaGFpbiA9IHtcbiAgICAgICAgb3AsXG4gICAgICAgIGluc3RydWN0aW9uLFxuICAgICAgICBleHByZXNzaW9uOiBvcC5zdGF0ZW1lbnQuZXhwcixcbiAgICAgIH07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU3RydWN0dXJlIHJlcHJlc2VudGluZyBhbiBpbi1wcm9ncmVzcyBjaGFpbi5cbiAqL1xuaW50ZXJmYWNlIENoYWluIHtcbiAgLyoqXG4gICAqIFRoZSBzdGF0ZW1lbnQgd2hpY2ggaG9sZHMgdGhlIGVudGlyZSBjaGFpbi5cbiAgICovXG4gIG9wOiBpci5TdGF0ZW1lbnRPcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD47XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgd2hvbGUgY3VycmVudCBjaGFpbmVkIGNhbGwuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGJlIHRoZSBzYW1lIGFzIGBvcC5zdGF0ZW1lbnQuZXhwcmVzc2lvbmAsIGJ1dCBpcyBleHRyYWN0ZWQgaGVyZSBmb3IgY29udmVuaWVuY2VcbiAgICogc2luY2UgdGhlIGBvcGAgdHlwZSBkb2Vzbid0IGNhcHR1cmUgdGhlIGZhY3QgdGhhdCBgb3Auc3RhdGVtZW50YCBpcyBhbiBgby5FeHByZXNzaW9uU3RhdGVtZW50YC5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGluc3RydWN0aW9uIHRoYXQgaXMgYmVpbmcgY2hhaW5lZC5cbiAgICovXG4gIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xufVxuIl19