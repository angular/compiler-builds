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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsVUFBVTtJQUNiLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMsbUJBQW1CO0lBQ3RCLEVBQUUsQ0FBQyxnQkFBZ0I7Q0FDcEIsQ0FBQyxDQUFDO0FBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUFDLEdBQXlCO0lBQ3JELEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2pDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDcEM7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxNQUEwQztJQUN2RSxJQUFJLEtBQUssR0FBZSxJQUFJLENBQUM7SUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxNQUFNLEVBQUU7UUFDdkIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO1lBQ3ZGLDBDQUEwQztZQUMxQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBQ0QsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixDQUFDO1lBQ3BELENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ3JELDJFQUEyRTtZQUMzRSxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztTQUNWO1FBRUQsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUMvQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUMvQixvQ0FBb0M7WUFDcEMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUVELHVGQUF1RjtRQUN2RixxREFBcUQ7UUFDckQsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssV0FBVyxFQUFFO1lBQ3ZELHlEQUF5RDtZQUN6RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FDdEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsRixLQUFLLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUM5QixLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDekMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBb0MsQ0FBQyxDQUFDO1NBQ3hEO2FBQU07WUFDTCxrRkFBa0Y7WUFDbEYsS0FBSyxHQUFHO2dCQUNOLEVBQUU7Z0JBQ0YsV0FBVztnQkFDWCxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJO2FBQzlCLENBQUM7U0FDSDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5jb25zdCBDSEFJTkFCTEUgPSBuZXcgU2V0KFtcbiAgUjMuZWxlbWVudFN0YXJ0LFxuICBSMy5lbGVtZW50RW5kLFxuICBSMy5wcm9wZXJ0eSxcbiAgUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0LFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5lbGVtZW50Q29udGFpbmVyLFxuXSk7XG5cbi8qKlxuICogUG9zdC1wcm9jZXNzIGEgcmVpZmllZCB2aWV3IGNvbXBpbGF0aW9uIGFuZCBjb252ZXJ0IHNlcXVlbnRpYWwgY2FsbHMgdG8gY2hhaW5hYmxlIGluc3RydWN0aW9uc1xuICogaW50byBjaGFpbiBjYWxscy5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdHdvIGBlbGVtZW50U3RhcnRgIG9wZXJhdGlvbnMgaW4gc2VxdWVuY2U6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKTtcbiAqIGVsZW1lbnRTdGFydCgxLCAnc3BhbicpO1xuICogYGBgXG4gKlxuICogQ2FuIGJlIGNhbGxlZCBhcyBhIGNoYWluIGluc3RlYWQ6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZWxlbWVudFN0YXJ0KDAsICdkaXYnKSgxLCAnc3BhbicpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUNoYWluaW5nKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHZpZXcuY3JlYXRlKTtcbiAgICBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qodmlldy51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYWluT3BlcmF0aW9uc0luTGlzdChvcExpc3Q6IGlyLk9wTGlzdDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgbGV0IGNoYWluOiBDaGFpbnxudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCBvcCBvZiBvcExpc3QpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCB8fCAhKG9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkpIHtcbiAgICAgIC8vIFRoaXMgdHlwZSBvZiBzdGF0ZW1lbnQgaXNuJ3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghKG9wLnN0YXRlbWVudC5leHByIGluc3RhbmNlb2Ygby5JbnZva2VGdW5jdGlvbkV4cHIpIHx8XG4gICAgICAgICEob3Auc3RhdGVtZW50LmV4cHIuZm4gaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwcikpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBzdGF0ZW1lbnQsIGJ1dCBub3QgYW4gaW5zdHJ1Y3Rpb24tdHlwZSBjYWxsLCBzbyBub3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBvcC5zdGF0ZW1lbnQuZXhwci5mbi52YWx1ZTtcbiAgICBpZiAoIUNIQUlOQUJMRS5oYXMoaW5zdHJ1Y3Rpb24pKSB7XG4gICAgICAvLyBUaGlzIGluc3RydWN0aW9uIGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGNoYWluZWQuIEl0IGNhbiBlaXRoZXIgYmUgYWRkZWQgb24gdG8gdGhlIHByZXZpb3VzIGNoYWluIChpZlxuICAgIC8vIGNvbXBhdGlibGUpIG9yIGl0IGNhbiBiZSB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgaWYgKGNoYWluICE9PSBudWxsICYmIGNoYWluLmluc3RydWN0aW9uID09PSBpbnN0cnVjdGlvbikge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBjYW4gYmUgYWRkZWQgb250byB0aGUgcHJldmlvdXMgY2hhaW4uXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gY2hhaW4uZXhwcmVzc2lvbi5jYWxsRm4oXG4gICAgICAgICAgb3Auc3RhdGVtZW50LmV4cHIuYXJncywgb3Auc3RhdGVtZW50LmV4cHIuc291cmNlU3Bhbiwgb3Auc3RhdGVtZW50LmV4cHIucHVyZSk7XG4gICAgICBjaGFpbi5leHByZXNzaW9uID0gZXhwcmVzc2lvbjtcbiAgICAgIGNoYWluLm9wLnN0YXRlbWVudCA9IGV4cHJlc3Npb24udG9TdG10KCk7XG4gICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLk9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIExlYXZlIHRoaXMgaW5zdHJ1Y3Rpb24gYWxvbmUgZm9yIG5vdywgYnV0IGNvbnNpZGVyIGl0IHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICAgIGNoYWluID0ge1xuICAgICAgICBvcCxcbiAgICAgICAgaW5zdHJ1Y3Rpb24sXG4gICAgICAgIGV4cHJlc3Npb246IG9wLnN0YXRlbWVudC5leHByLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTdHJ1Y3R1cmUgcmVwcmVzZW50aW5nIGFuIGluLXByb2dyZXNzIGNoYWluLlxuICovXG5pbnRlcmZhY2UgQ2hhaW4ge1xuICAvKipcbiAgICogVGhlIHN0YXRlbWVudCB3aGljaCBob2xkcyB0aGUgZW50aXJlIGNoYWluLlxuICAgKi9cbiAgb3A6IGlyLlN0YXRlbWVudE9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPjtcblxuICAvKipcbiAgICogVGhlIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB3aG9sZSBjdXJyZW50IGNoYWluZWQgY2FsbC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYmUgdGhlIHNhbWUgYXMgYG9wLnN0YXRlbWVudC5leHByZXNzaW9uYCwgYnV0IGlzIGV4dHJhY3RlZCBoZXJlIGZvciBjb252ZW5pZW5jZVxuICAgKiBzaW5jZSB0aGUgYG9wYCB0eXBlIGRvZXNuJ3QgY2FwdHVyZSB0aGUgZmFjdCB0aGF0IGBvcC5zdGF0ZW1lbnRgIGlzIGFuIGBvLkV4cHJlc3Npb25TdGF0ZW1lbnRgLlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gdGhhdCBpcyBiZWluZyBjaGFpbmVkLlxuICAgKi9cbiAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG59XG4iXX0=