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
    R3.property,
    R3.styleProp,
    R3.elementContainerStart,
    R3.elementContainerEnd,
    R3.elementContainer,
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
export function phaseChaining(cpl) {
    for (const [_, view] of cpl.views) {
        chainOperationsInList(view.create);
        chainOperationsInList(view.update);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsVUFBVTtJQUNiLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxtQkFBbUI7SUFDdEIsRUFBRSxDQUFDLGdCQUFnQjtDQUNwQixDQUFDLENBQUM7QUFFSDs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsR0FBeUI7SUFDckQsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNwQztBQUNILENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLE1BQTBDO0lBQ3ZFLElBQUksS0FBSyxHQUFlLElBQUksQ0FBQztJQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sRUFBRTtRQUN2QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLEVBQUU7WUFDdkYsMENBQTBDO1lBQzFDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFDRCxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsa0JBQWtCLENBQUM7WUFDcEQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDckQsMkVBQTJFO1lBQzNFLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFFRCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQy9CLG9DQUFvQztZQUNwQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBRUQsdUZBQXVGO1FBQ3ZGLHFEQUFxRDtRQUNyRCxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxDQUFDLFdBQVcsS0FBSyxXQUFXLEVBQUU7WUFDdkQseURBQXlEO1lBQ3pELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUN0QyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xGLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxFQUFFLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN6QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFvQyxDQUFDLENBQUM7U0FDeEQ7YUFBTTtZQUNMLGtGQUFrRjtZQUNsRixLQUFLLEdBQUc7Z0JBQ04sRUFBRTtnQkFDRixXQUFXO2dCQUNYLFVBQVUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUk7YUFDOUIsQ0FBQztTQUNIO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbmNvbnN0IENIQUlOQUJMRSA9IG5ldyBTZXQoW1xuICBSMy5lbGVtZW50U3RhcnQsXG4gIFIzLmVsZW1lbnRFbmQsXG4gIFIzLnByb3BlcnR5LFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudENvbnRhaW5lckVuZCxcbiAgUjMuZWxlbWVudENvbnRhaW5lcixcbl0pO1xuXG4vKipcbiAqIFBvc3QtcHJvY2VzcyBhIHJlaWZpZWQgdmlldyBjb21waWxhdGlvbiBhbmQgY29udmVydCBzZXF1ZW50aWFsIGNhbGxzIHRvIGNoYWluYWJsZSBpbnN0cnVjdGlvbnNcbiAqIGludG8gY2hhaW4gY2FsbHMuXG4gKlxuICogRm9yIGV4YW1wbGUsIHR3byBgZWxlbWVudFN0YXJ0YCBvcGVyYXRpb25zIGluIHNlcXVlbmNlOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGVsZW1lbnRTdGFydCgwLCAnZGl2Jyk7XG4gKiBlbGVtZW50U3RhcnQoMSwgJ3NwYW4nKTtcbiAqIGBgYFxuICpcbiAqIENhbiBiZSBjYWxsZWQgYXMgYSBjaGFpbiBpbnN0ZWFkOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGVsZW1lbnRTdGFydCgwLCAnZGl2JykoMSwgJ3NwYW4nKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VDaGFpbmluZyhjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIGZvciAoY29uc3QgW18sIHZpZXddIG9mIGNwbC52aWV3cykge1xuICAgIGNoYWluT3BlcmF0aW9uc0luTGlzdCh2aWV3LmNyZWF0ZSk7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHZpZXcudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qob3BMaXN0OiBpci5PcExpc3Q8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGxldCBjaGFpbjogQ2hhaW58bnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BMaXN0KSB7XG4gICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgfHwgIShvcC5zdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpKSB7XG4gICAgICAvLyBUaGlzIHR5cGUgb2Ygc3RhdGVtZW50IGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIShvcC5zdGF0ZW1lbnQuZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB8fFxuICAgICAgICAhKG9wLnN0YXRlbWVudC5leHByLmZuIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIpKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgc3RhdGVtZW50LCBidXQgbm90IGFuIGluc3RydWN0aW9uLXR5cGUgY2FsbCwgc28gbm90IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGluc3RydWN0aW9uID0gb3Auc3RhdGVtZW50LmV4cHIuZm4udmFsdWU7XG4gICAgaWYgKCFDSEFJTkFCTEUuaGFzKGluc3RydWN0aW9uKSkge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBpc24ndCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGluc3RydWN0aW9uIGNhbiBiZSBjaGFpbmVkLiBJdCBjYW4gZWl0aGVyIGJlIGFkZGVkIG9uIHRvIHRoZSBwcmV2aW91cyBjaGFpbiAoaWZcbiAgICAvLyBjb21wYXRpYmxlKSBvciBpdCBjYW4gYmUgdGhlIHN0YXJ0IG9mIGEgbmV3IGNoYWluLlxuICAgIGlmIChjaGFpbiAhPT0gbnVsbCAmJiBjaGFpbi5pbnN0cnVjdGlvbiA9PT0gaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGFkZGVkIG9udG8gdGhlIHByZXZpb3VzIGNoYWluLlxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGNoYWluLmV4cHJlc3Npb24uY2FsbEZuKFxuICAgICAgICAgIG9wLnN0YXRlbWVudC5leHByLmFyZ3MsIG9wLnN0YXRlbWVudC5leHByLnNvdXJjZVNwYW4sIG9wLnN0YXRlbWVudC5leHByLnB1cmUpO1xuICAgICAgY2hhaW4uZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XG4gICAgICBjaGFpbi5vcC5zdGF0ZW1lbnQgPSBleHByZXNzaW9uLnRvU3RtdCgpO1xuICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5PcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBMZWF2ZSB0aGlzIGluc3RydWN0aW9uIGFsb25lIGZvciBub3csIGJ1dCBjb25zaWRlciBpdCB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgICBjaGFpbiA9IHtcbiAgICAgICAgb3AsXG4gICAgICAgIGluc3RydWN0aW9uLFxuICAgICAgICBleHByZXNzaW9uOiBvcC5zdGF0ZW1lbnQuZXhwcixcbiAgICAgIH07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU3RydWN0dXJlIHJlcHJlc2VudGluZyBhbiBpbi1wcm9ncmVzcyBjaGFpbi5cbiAqL1xuaW50ZXJmYWNlIENoYWluIHtcbiAgLyoqXG4gICAqIFRoZSBzdGF0ZW1lbnQgd2hpY2ggaG9sZHMgdGhlIGVudGlyZSBjaGFpbi5cbiAgICovXG4gIG9wOiBpci5TdGF0ZW1lbnRPcDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD47XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgd2hvbGUgY3VycmVudCBjaGFpbmVkIGNhbGwuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGJlIHRoZSBzYW1lIGFzIGBvcC5zdGF0ZW1lbnQuZXhwcmVzc2lvbmAsIGJ1dCBpcyBleHRyYWN0ZWQgaGVyZSBmb3IgY29udmVuaWVuY2VcbiAgICogc2luY2UgdGhlIGBvcGAgdHlwZSBkb2Vzbid0IGNhcHR1cmUgdGhlIGZhY3QgdGhhdCBgb3Auc3RhdGVtZW50YCBpcyBhbiBgby5FeHByZXNzaW9uU3RhdGVtZW50YC5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGluc3RydWN0aW9uIHRoYXQgaXMgYmVpbmcgY2hhaW5lZC5cbiAgICovXG4gIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xufVxuIl19