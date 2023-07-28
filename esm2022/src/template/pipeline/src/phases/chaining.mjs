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
    R3.hostProperty,
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
    R3.elementContainerStart,
    R3.elementContainerEnd,
    R3.elementContainer,
    R3.listener,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsVUFBVTtJQUNiLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxTQUFTO0lBQ1osRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxtQkFBbUI7SUFDdEIsRUFBRSxDQUFDLGdCQUFnQjtJQUNuQixFQUFFLENBQUMsUUFBUTtDQUNaLENBQUMsQ0FBQztBQUVIOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsTUFBTSxVQUFVLGFBQWEsQ0FBQyxHQUFtQjtJQUMvQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNwQztBQUNILENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLE1BQTBDO0lBQ3ZFLElBQUksS0FBSyxHQUFlLElBQUksQ0FBQztJQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sRUFBRTtRQUN2QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLEVBQUU7WUFDdkYsMENBQTBDO1lBQzFDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFDRCxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsa0JBQWtCLENBQUM7WUFDcEQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDckQsMkVBQTJFO1lBQzNFLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFFRCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQy9CLG9DQUFvQztZQUNwQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBRUQsdUZBQXVGO1FBQ3ZGLHFEQUFxRDtRQUNyRCxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxDQUFDLFdBQVcsS0FBSyxXQUFXLEVBQUU7WUFDdkQseURBQXlEO1lBQ3pELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUN0QyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xGLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxFQUFFLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN6QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFvQyxDQUFDLENBQUM7U0FDeEQ7YUFBTTtZQUNMLGtGQUFrRjtZQUNsRixLQUFLLEdBQUc7Z0JBQ04sRUFBRTtnQkFDRixXQUFXO2dCQUNYLFVBQVUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUk7YUFDOUIsQ0FBQztTQUNIO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbmNvbnN0IENIQUlOQUJMRSA9IG5ldyBTZXQoW1xuICBSMy5lbGVtZW50U3RhcnQsXG4gIFIzLmVsZW1lbnRFbmQsXG4gIFIzLnByb3BlcnR5LFxuICBSMy5ob3N0UHJvcGVydHksXG4gIFIzLnN0eWxlUHJvcCxcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUzLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlOCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBSMy5jbGFzc1Byb3AsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudENvbnRhaW5lckVuZCxcbiAgUjMuZWxlbWVudENvbnRhaW5lcixcbiAgUjMubGlzdGVuZXIsXG5dKTtcblxuLyoqXG4gKiBQb3N0LXByb2Nlc3MgYSByZWlmaWVkIHZpZXcgY29tcGlsYXRpb24gYW5kIGNvbnZlcnQgc2VxdWVudGlhbCBjYWxscyB0byBjaGFpbmFibGUgaW5zdHJ1Y3Rpb25zXG4gKiBpbnRvIGNoYWluIGNhbGxzLlxuICpcbiAqIEZvciBleGFtcGxlLCB0d28gYGVsZW1lbnRTdGFydGAgb3BlcmF0aW9ucyBpbiBzZXF1ZW5jZTpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpO1xuICogZWxlbWVudFN0YXJ0KDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqXG4gKiBDYW4gYmUgY2FsbGVkIGFzIGEgY2hhaW4gaW5zdGVhZDpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpKDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQ2hhaW5pbmcoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHVuaXQuY3JlYXRlKTtcbiAgICBjaGFpbk9wZXJhdGlvbnNJbkxpc3QodW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYWluT3BlcmF0aW9uc0luTGlzdChvcExpc3Q6IGlyLk9wTGlzdDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgbGV0IGNoYWluOiBDaGFpbnxudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCBvcCBvZiBvcExpc3QpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCB8fCAhKG9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkpIHtcbiAgICAgIC8vIFRoaXMgdHlwZSBvZiBzdGF0ZW1lbnQgaXNuJ3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghKG9wLnN0YXRlbWVudC5leHByIGluc3RhbmNlb2Ygby5JbnZva2VGdW5jdGlvbkV4cHIpIHx8XG4gICAgICAgICEob3Auc3RhdGVtZW50LmV4cHIuZm4gaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwcikpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBzdGF0ZW1lbnQsIGJ1dCBub3QgYW4gaW5zdHJ1Y3Rpb24tdHlwZSBjYWxsLCBzbyBub3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBvcC5zdGF0ZW1lbnQuZXhwci5mbi52YWx1ZTtcbiAgICBpZiAoIUNIQUlOQUJMRS5oYXMoaW5zdHJ1Y3Rpb24pKSB7XG4gICAgICAvLyBUaGlzIGluc3RydWN0aW9uIGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGNoYWluZWQuIEl0IGNhbiBlaXRoZXIgYmUgYWRkZWQgb24gdG8gdGhlIHByZXZpb3VzIGNoYWluIChpZlxuICAgIC8vIGNvbXBhdGlibGUpIG9yIGl0IGNhbiBiZSB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgaWYgKGNoYWluICE9PSBudWxsICYmIGNoYWluLmluc3RydWN0aW9uID09PSBpbnN0cnVjdGlvbikge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBjYW4gYmUgYWRkZWQgb250byB0aGUgcHJldmlvdXMgY2hhaW4uXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gY2hhaW4uZXhwcmVzc2lvbi5jYWxsRm4oXG4gICAgICAgICAgb3Auc3RhdGVtZW50LmV4cHIuYXJncywgb3Auc3RhdGVtZW50LmV4cHIuc291cmNlU3Bhbiwgb3Auc3RhdGVtZW50LmV4cHIucHVyZSk7XG4gICAgICBjaGFpbi5leHByZXNzaW9uID0gZXhwcmVzc2lvbjtcbiAgICAgIGNoYWluLm9wLnN0YXRlbWVudCA9IGV4cHJlc3Npb24udG9TdG10KCk7XG4gICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLk9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIExlYXZlIHRoaXMgaW5zdHJ1Y3Rpb24gYWxvbmUgZm9yIG5vdywgYnV0IGNvbnNpZGVyIGl0IHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICAgIGNoYWluID0ge1xuICAgICAgICBvcCxcbiAgICAgICAgaW5zdHJ1Y3Rpb24sXG4gICAgICAgIGV4cHJlc3Npb246IG9wLnN0YXRlbWVudC5leHByLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTdHJ1Y3R1cmUgcmVwcmVzZW50aW5nIGFuIGluLXByb2dyZXNzIGNoYWluLlxuICovXG5pbnRlcmZhY2UgQ2hhaW4ge1xuICAvKipcbiAgICogVGhlIHN0YXRlbWVudCB3aGljaCBob2xkcyB0aGUgZW50aXJlIGNoYWluLlxuICAgKi9cbiAgb3A6IGlyLlN0YXRlbWVudE9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPjtcblxuICAvKipcbiAgICogVGhlIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB3aG9sZSBjdXJyZW50IGNoYWluZWQgY2FsbC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYmUgdGhlIHNhbWUgYXMgYG9wLnN0YXRlbWVudC5leHByZXNzaW9uYCwgYnV0IGlzIGV4dHJhY3RlZCBoZXJlIGZvciBjb252ZW5pZW5jZVxuICAgKiBzaW5jZSB0aGUgYG9wYCB0eXBlIGRvZXNuJ3QgY2FwdHVyZSB0aGUgZmFjdCB0aGF0IGBvcC5zdGF0ZW1lbnRgIGlzIGFuIGBvLkV4cHJlc3Npb25TdGF0ZW1lbnRgLlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gdGhhdCBpcyBiZWluZyBjaGFpbmVkLlxuICAgKi9cbiAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG59XG4iXX0=