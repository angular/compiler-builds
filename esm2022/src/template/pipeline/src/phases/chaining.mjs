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
    R3.twoWayProperty,
    R3.twoWayListener,
    R3.declareLet,
]);
/**
 * Chaining results in repeated call expressions, causing a deep AST of receiver expressions. To prevent running out of
 * stack depth the maximum number of chained instructions is limited to this threshold, which has been selected
 * arbitrarily.
 */
const MAX_CHAIN_LENGTH = 256;
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
export function chain(job) {
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
        if (chain !== null && chain.instruction === instruction && chain.length < MAX_CHAIN_LENGTH) {
            // This instruction can be added onto the previous chain.
            const expression = chain.expression.callFn(op.statement.expr.args, op.statement.expr.sourceSpan, op.statement.expr.pure);
            chain.expression = expression;
            chain.op.statement = expression.toStmt();
            chain.length++;
            ir.OpList.remove(op);
        }
        else {
            // Leave this instruction alone for now, but consider it the start of a new chain.
            chain = {
                op,
                instruction,
                expression: op.statement.expr,
                length: 1,
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxPQUFPO0lBQ1YsRUFBRSxDQUFDLGdCQUFnQjtJQUNuQixFQUFFLENBQUMsbUJBQW1CO0lBQ3RCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLFVBQVU7SUFDYixFQUFFLENBQUMsWUFBWTtJQUNmLEVBQUUsQ0FBQyxZQUFZO0lBQ2YsRUFBRSxDQUFDLE9BQU87SUFDVixFQUFFLENBQUMsUUFBUTtJQUNYLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFFBQVE7SUFDWCxFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMsY0FBYztJQUNqQixFQUFFLENBQUMsY0FBYztJQUNqQixFQUFFLENBQUMsY0FBYztJQUNqQixFQUFFLENBQUMsVUFBVTtDQUNkLENBQUMsQ0FBQztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3Qjs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQU0sVUFBVSxLQUFLLENBQUMsR0FBbUI7SUFDdkMsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyQyxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsTUFBNEM7SUFDekUsSUFBSSxLQUFLLEdBQWlCLElBQUksQ0FBQztJQUMvQixLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sRUFBRSxDQUFDO1FBQ3hCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO1lBQ3hGLDBDQUEwQztZQUMxQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztRQUNYLENBQUM7UUFDRCxJQUNFLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsa0JBQWtCLENBQUM7WUFDcEQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQ2pELENBQUM7WUFDRCwyRUFBMkU7WUFDM0UsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7UUFDWCxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUMvQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ2hDLG9DQUFvQztZQUNwQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztRQUNYLENBQUM7UUFFRCx1RkFBdUY7UUFDdkYscURBQXFEO1FBQ3JELElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFdBQVcsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLGdCQUFnQixFQUFFLENBQUM7WUFDM0YseURBQXlEO1lBQ3pELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUN4QyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQ3RCLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFDNUIsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUN2QixDQUFDO1lBQ0YsS0FBSyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDOUIsS0FBSyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNmLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQXNDLENBQUMsQ0FBQztRQUMzRCxDQUFDO2FBQU0sQ0FBQztZQUNOLGtGQUFrRjtZQUNsRixLQUFLLEdBQUc7Z0JBQ04sRUFBRTtnQkFDRixXQUFXO2dCQUNYLFVBQVUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUk7Z0JBQzdCLE1BQU0sRUFBRSxDQUFDO2FBQ1YsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5jb25zdCBDSEFJTkFCTEUgPSBuZXcgU2V0KFtcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5jbGFzc1Byb3AsXG4gIFIzLmVsZW1lbnQsXG4gIFIzLmVsZW1lbnRDb250YWluZXIsXG4gIFIzLmVsZW1lbnRDb250YWluZXJFbmQsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudFN0YXJ0LFxuICBSMy5ob3N0UHJvcGVydHksXG4gIFIzLmkxOG5FeHAsXG4gIFIzLmxpc3RlbmVyLFxuICBSMy5saXN0ZW5lcixcbiAgUjMucHJvcGVydHksXG4gIFIzLnN0eWxlUHJvcCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTIsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTUsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTgsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlVixcbiAgUjMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHksXG4gIFIzLnRlbXBsYXRlQ3JlYXRlLFxuICBSMy50d29XYXlQcm9wZXJ0eSxcbiAgUjMudHdvV2F5TGlzdGVuZXIsXG4gIFIzLmRlY2xhcmVMZXQsXG5dKTtcblxuLyoqXG4gKiBDaGFpbmluZyByZXN1bHRzIGluIHJlcGVhdGVkIGNhbGwgZXhwcmVzc2lvbnMsIGNhdXNpbmcgYSBkZWVwIEFTVCBvZiByZWNlaXZlciBleHByZXNzaW9ucy4gVG8gcHJldmVudCBydW5uaW5nIG91dCBvZlxuICogc3RhY2sgZGVwdGggdGhlIG1heGltdW0gbnVtYmVyIG9mIGNoYWluZWQgaW5zdHJ1Y3Rpb25zIGlzIGxpbWl0ZWQgdG8gdGhpcyB0aHJlc2hvbGQsIHdoaWNoIGhhcyBiZWVuIHNlbGVjdGVkXG4gKiBhcmJpdHJhcmlseS5cbiAqL1xuY29uc3QgTUFYX0NIQUlOX0xFTkdUSCA9IDI1NjtcblxuLyoqXG4gKiBQb3N0LXByb2Nlc3MgYSByZWlmaWVkIHZpZXcgY29tcGlsYXRpb24gYW5kIGNvbnZlcnQgc2VxdWVudGlhbCBjYWxscyB0byBjaGFpbmFibGUgaW5zdHJ1Y3Rpb25zXG4gKiBpbnRvIGNoYWluIGNhbGxzLlxuICpcbiAqIEZvciBleGFtcGxlLCB0d28gYGVsZW1lbnRTdGFydGAgb3BlcmF0aW9ucyBpbiBzZXF1ZW5jZTpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpO1xuICogZWxlbWVudFN0YXJ0KDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqXG4gKiBDYW4gYmUgY2FsbGVkIGFzIGEgY2hhaW4gaW5zdGVhZDpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpKDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYWluKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNoYWluT3BlcmF0aW9uc0luTGlzdCh1bml0LmNyZWF0ZSk7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qob3BMaXN0OiBpci5PcExpc3Q8aXIuQ3JlYXRlT3AgfCBpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgbGV0IGNoYWluOiBDaGFpbiB8IG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wTGlzdCkge1xuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50IHx8ICEob3Auc3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSkge1xuICAgICAgLy8gVGhpcyB0eXBlIG9mIHN0YXRlbWVudCBpc24ndCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgIShvcC5zdGF0ZW1lbnQuZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB8fFxuICAgICAgIShvcC5zdGF0ZW1lbnQuZXhwci5mbiBpbnN0YW5jZW9mIG8uRXh0ZXJuYWxFeHByKVxuICAgICkge1xuICAgICAgLy8gVGhpcyBpcyBhIHN0YXRlbWVudCwgYnV0IG5vdCBhbiBpbnN0cnVjdGlvbi10eXBlIGNhbGwsIHNvIG5vdCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBpbnN0cnVjdGlvbiA9IG9wLnN0YXRlbWVudC5leHByLmZuLnZhbHVlO1xuICAgIGlmICghQ0hBSU5BQkxFLmhhcyhpbnN0cnVjdGlvbikpIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gaXNuJ3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBjYW4gYmUgY2hhaW5lZC4gSXQgY2FuIGVpdGhlciBiZSBhZGRlZCBvbiB0byB0aGUgcHJldmlvdXMgY2hhaW4gKGlmXG4gICAgLy8gY29tcGF0aWJsZSkgb3IgaXQgY2FuIGJlIHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICBpZiAoY2hhaW4gIT09IG51bGwgJiYgY2hhaW4uaW5zdHJ1Y3Rpb24gPT09IGluc3RydWN0aW9uICYmIGNoYWluLmxlbmd0aCA8IE1BWF9DSEFJTl9MRU5HVEgpIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGFkZGVkIG9udG8gdGhlIHByZXZpb3VzIGNoYWluLlxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGNoYWluLmV4cHJlc3Npb24uY2FsbEZuKFxuICAgICAgICBvcC5zdGF0ZW1lbnQuZXhwci5hcmdzLFxuICAgICAgICBvcC5zdGF0ZW1lbnQuZXhwci5zb3VyY2VTcGFuLFxuICAgICAgICBvcC5zdGF0ZW1lbnQuZXhwci5wdXJlLFxuICAgICAgKTtcbiAgICAgIGNoYWluLmV4cHJlc3Npb24gPSBleHByZXNzaW9uO1xuICAgICAgY2hhaW4ub3Auc3RhdGVtZW50ID0gZXhwcmVzc2lvbi50b1N0bXQoKTtcbiAgICAgIGNoYWluLmxlbmd0aCsrO1xuICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5PcDxpci5DcmVhdGVPcCB8IGlyLlVwZGF0ZU9wPik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIExlYXZlIHRoaXMgaW5zdHJ1Y3Rpb24gYWxvbmUgZm9yIG5vdywgYnV0IGNvbnNpZGVyIGl0IHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICAgIGNoYWluID0ge1xuICAgICAgICBvcCxcbiAgICAgICAgaW5zdHJ1Y3Rpb24sXG4gICAgICAgIGV4cHJlc3Npb246IG9wLnN0YXRlbWVudC5leHByLFxuICAgICAgICBsZW5ndGg6IDEsXG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFN0cnVjdHVyZSByZXByZXNlbnRpbmcgYW4gaW4tcHJvZ3Jlc3MgY2hhaW4uXG4gKi9cbmludGVyZmFjZSBDaGFpbiB7XG4gIC8qKlxuICAgKiBUaGUgc3RhdGVtZW50IHdoaWNoIGhvbGRzIHRoZSBlbnRpcmUgY2hhaW4uXG4gICAqL1xuICBvcDogaXIuU3RhdGVtZW50T3A8aXIuQ3JlYXRlT3AgfCBpci5VcGRhdGVPcD47XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgd2hvbGUgY3VycmVudCBjaGFpbmVkIGNhbGwuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGJlIHRoZSBzYW1lIGFzIGBvcC5zdGF0ZW1lbnQuZXhwcmVzc2lvbmAsIGJ1dCBpcyBleHRyYWN0ZWQgaGVyZSBmb3IgY29udmVuaWVuY2VcbiAgICogc2luY2UgdGhlIGBvcGAgdHlwZSBkb2Vzbid0IGNhcHR1cmUgdGhlIGZhY3QgdGhhdCBgb3Auc3RhdGVtZW50YCBpcyBhbiBgby5FeHByZXNzaW9uU3RhdGVtZW50YC5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGluc3RydWN0aW9uIHRoYXQgaXMgYmVpbmcgY2hhaW5lZC5cbiAgICovXG4gIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIGluc3RydWN0aW9ucyB0aGF0IGhhdmUgYmVlbiBjb2xsZWN0ZWQgaW50byB0aGlzIGNoYWluLlxuICAgKi9cbiAgbGVuZ3RoOiBudW1iZXI7XG59XG4iXX0=