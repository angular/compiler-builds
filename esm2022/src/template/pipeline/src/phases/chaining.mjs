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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxPQUFPO0lBQ1YsRUFBRSxDQUFDLGdCQUFnQjtJQUNuQixFQUFFLENBQUMsbUJBQW1CO0lBQ3RCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLFVBQVU7SUFDYixFQUFFLENBQUMsWUFBWTtJQUNmLEVBQUUsQ0FBQyxZQUFZO0lBQ2YsRUFBRSxDQUFDLE9BQU87SUFDVixFQUFFLENBQUMsUUFBUTtJQUNYLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFFBQVE7SUFDWCxFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMscUJBQXFCO0lBQ3hCLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLHFCQUFxQjtJQUN4QixFQUFFLENBQUMsY0FBYztDQUNsQixDQUFDLENBQUM7QUFFSDs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQU0sVUFBVSxLQUFLLENBQUMsR0FBbUI7SUFDdkMsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyQyxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsTUFBMEM7SUFDdkUsSUFBSSxLQUFLLEdBQWUsSUFBSSxDQUFDO0lBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFLENBQUM7UUFDeEIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUM7WUFDeEYsMENBQTBDO1lBQzFDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1FBQ1gsQ0FBQztRQUNELElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztZQUNwRCxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ3RELDJFQUEyRTtZQUMzRSxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsU0FBUztRQUNYLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDaEMsb0NBQW9DO1lBQ3BDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1FBQ1gsQ0FBQztRQUVELHVGQUF1RjtRQUN2RixxREFBcUQ7UUFDckQsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDeEQseURBQXlEO1lBQ3pELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUN0QyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xGLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxFQUFFLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN6QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFvQyxDQUFDLENBQUM7UUFDekQsQ0FBQzthQUFNLENBQUM7WUFDTixrRkFBa0Y7WUFDbEYsS0FBSyxHQUFHO2dCQUNOLEVBQUU7Z0JBQ0YsV0FBVztnQkFDWCxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJO2FBQzlCLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuY29uc3QgQ0hBSU5BQkxFID0gbmV3IFNldChbXG4gIFIzLmF0dHJpYnV0ZSxcbiAgUjMuY2xhc3NQcm9wLFxuICBSMy5lbGVtZW50LFxuICBSMy5lbGVtZW50Q29udGFpbmVyLFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQsXG4gIFIzLmVsZW1lbnRFbmQsXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuaG9zdFByb3BlcnR5LFxuICBSMy5pMThuRXhwLFxuICBSMy5saXN0ZW5lcixcbiAgUjMubGlzdGVuZXIsXG4gIFIzLnByb3BlcnR5LFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTMsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTYsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZVYsXG4gIFIzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lcixcbiAgUjMuc3ludGhldGljSG9zdFByb3BlcnR5LFxuICBSMy50ZW1wbGF0ZUNyZWF0ZSxcbl0pO1xuXG4vKipcbiAqIFBvc3QtcHJvY2VzcyBhIHJlaWZpZWQgdmlldyBjb21waWxhdGlvbiBhbmQgY29udmVydCBzZXF1ZW50aWFsIGNhbGxzIHRvIGNoYWluYWJsZSBpbnN0cnVjdGlvbnNcbiAqIGludG8gY2hhaW4gY2FsbHMuXG4gKlxuICogRm9yIGV4YW1wbGUsIHR3byBgZWxlbWVudFN0YXJ0YCBvcGVyYXRpb25zIGluIHNlcXVlbmNlOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGVsZW1lbnRTdGFydCgwLCAnZGl2Jyk7XG4gKiBlbGVtZW50U3RhcnQoMSwgJ3NwYW4nKTtcbiAqIGBgYFxuICpcbiAqIENhbiBiZSBjYWxsZWQgYXMgYSBjaGFpbiBpbnN0ZWFkOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGVsZW1lbnRTdGFydCgwLCAnZGl2JykoMSwgJ3NwYW4nKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hhaW4oam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY2hhaW5PcGVyYXRpb25zSW5MaXN0KHVuaXQuY3JlYXRlKTtcbiAgICBjaGFpbk9wZXJhdGlvbnNJbkxpc3QodW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYWluT3BlcmF0aW9uc0luTGlzdChvcExpc3Q6IGlyLk9wTGlzdDxpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgbGV0IGNoYWluOiBDaGFpbnxudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCBvcCBvZiBvcExpc3QpIHtcbiAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlN0YXRlbWVudCB8fCAhKG9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkpIHtcbiAgICAgIC8vIFRoaXMgdHlwZSBvZiBzdGF0ZW1lbnQgaXNuJ3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghKG9wLnN0YXRlbWVudC5leHByIGluc3RhbmNlb2Ygby5JbnZva2VGdW5jdGlvbkV4cHIpIHx8XG4gICAgICAgICEob3Auc3RhdGVtZW50LmV4cHIuZm4gaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwcikpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBzdGF0ZW1lbnQsIGJ1dCBub3QgYW4gaW5zdHJ1Y3Rpb24tdHlwZSBjYWxsLCBzbyBub3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBvcC5zdGF0ZW1lbnQuZXhwci5mbi52YWx1ZTtcbiAgICBpZiAoIUNIQUlOQUJMRS5oYXMoaW5zdHJ1Y3Rpb24pKSB7XG4gICAgICAvLyBUaGlzIGluc3RydWN0aW9uIGlzbid0IGNoYWluYWJsZS5cbiAgICAgIGNoYWluID0gbnVsbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gY2FuIGJlIGNoYWluZWQuIEl0IGNhbiBlaXRoZXIgYmUgYWRkZWQgb24gdG8gdGhlIHByZXZpb3VzIGNoYWluIChpZlxuICAgIC8vIGNvbXBhdGlibGUpIG9yIGl0IGNhbiBiZSB0aGUgc3RhcnQgb2YgYSBuZXcgY2hhaW4uXG4gICAgaWYgKGNoYWluICE9PSBudWxsICYmIGNoYWluLmluc3RydWN0aW9uID09PSBpbnN0cnVjdGlvbikge1xuICAgICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBjYW4gYmUgYWRkZWQgb250byB0aGUgcHJldmlvdXMgY2hhaW4uXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gY2hhaW4uZXhwcmVzc2lvbi5jYWxsRm4oXG4gICAgICAgICAgb3Auc3RhdGVtZW50LmV4cHIuYXJncywgb3Auc3RhdGVtZW50LmV4cHIuc291cmNlU3Bhbiwgb3Auc3RhdGVtZW50LmV4cHIucHVyZSk7XG4gICAgICBjaGFpbi5leHByZXNzaW9uID0gZXhwcmVzc2lvbjtcbiAgICAgIGNoYWluLm9wLnN0YXRlbWVudCA9IGV4cHJlc3Npb24udG9TdG10KCk7XG4gICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLk9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIExlYXZlIHRoaXMgaW5zdHJ1Y3Rpb24gYWxvbmUgZm9yIG5vdywgYnV0IGNvbnNpZGVyIGl0IHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICAgIGNoYWluID0ge1xuICAgICAgICBvcCxcbiAgICAgICAgaW5zdHJ1Y3Rpb24sXG4gICAgICAgIGV4cHJlc3Npb246IG9wLnN0YXRlbWVudC5leHByLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTdHJ1Y3R1cmUgcmVwcmVzZW50aW5nIGFuIGluLXByb2dyZXNzIGNoYWluLlxuICovXG5pbnRlcmZhY2UgQ2hhaW4ge1xuICAvKipcbiAgICogVGhlIHN0YXRlbWVudCB3aGljaCBob2xkcyB0aGUgZW50aXJlIGNoYWluLlxuICAgKi9cbiAgb3A6IGlyLlN0YXRlbWVudE9wPGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPjtcblxuICAvKipcbiAgICogVGhlIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSB3aG9sZSBjdXJyZW50IGNoYWluZWQgY2FsbC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYmUgdGhlIHNhbWUgYXMgYG9wLnN0YXRlbWVudC5leHByZXNzaW9uYCwgYnV0IGlzIGV4dHJhY3RlZCBoZXJlIGZvciBjb252ZW5pZW5jZVxuICAgKiBzaW5jZSB0aGUgYG9wYCB0eXBlIGRvZXNuJ3QgY2FwdHVyZSB0aGUgZmFjdCB0aGF0IGBvcC5zdGF0ZW1lbnRgIGlzIGFuIGBvLkV4cHJlc3Npb25TdGF0ZW1lbnRgLlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgaW5zdHJ1Y3Rpb24gdGhhdCBpcyBiZWluZyBjaGFpbmVkLlxuICAgKi9cbiAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG59XG4iXX0=