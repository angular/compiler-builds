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
    R3.attribute,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDeEIsRUFBRSxDQUFDLFlBQVk7SUFDZixFQUFFLENBQUMsVUFBVTtJQUNiLEVBQUUsQ0FBQyxRQUFRO0lBQ1gsRUFBRSxDQUFDLFNBQVM7SUFDWixFQUFFLENBQUMsU0FBUztJQUNaLEVBQUUsQ0FBQyxxQkFBcUI7SUFDeEIsRUFBRSxDQUFDLG1CQUFtQjtJQUN0QixFQUFFLENBQUMsZ0JBQWdCO0NBQ3BCLENBQUMsQ0FBQztBQUVIOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsTUFBTSxVQUFVLGFBQWEsQ0FBQyxHQUF5QjtJQUNyRCxLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3BDO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsTUFBMEM7SUFDdkUsSUFBSSxLQUFLLEdBQWUsSUFBSSxDQUFDO0lBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFO1FBQ3ZCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUN2RiwwQ0FBMEM7WUFDMUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUNELElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztZQUNwRCxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNyRCwyRUFBMkU7WUFDM0UsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNiLFNBQVM7U0FDVjtRQUVELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDL0Isb0NBQW9DO1lBQ3BDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixTQUFTO1NBQ1Y7UUFFRCx1RkFBdUY7UUFDdkYscURBQXFEO1FBQ3JELElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFdBQVcsRUFBRTtZQUN2RCx5REFBeUQ7WUFDekQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQ3RDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEYsS0FBSyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDOUIsS0FBSyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQW9DLENBQUMsQ0FBQztTQUN4RDthQUFNO1lBQ0wsa0ZBQWtGO1lBQ2xGLEtBQUssR0FBRztnQkFDTixFQUFFO2dCQUNGLFdBQVc7Z0JBQ1gsVUFBVSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSTthQUM5QixDQUFDO1NBQ0g7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuY29uc3QgQ0hBSU5BQkxFID0gbmV3IFNldChbXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMucHJvcGVydHksXG4gIFIzLnN0eWxlUHJvcCxcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQsXG4gIFIzLmVsZW1lbnRDb250YWluZXJFbmQsXG4gIFIzLmVsZW1lbnRDb250YWluZXIsXG5dKTtcblxuLyoqXG4gKiBQb3N0LXByb2Nlc3MgYSByZWlmaWVkIHZpZXcgY29tcGlsYXRpb24gYW5kIGNvbnZlcnQgc2VxdWVudGlhbCBjYWxscyB0byBjaGFpbmFibGUgaW5zdHJ1Y3Rpb25zXG4gKiBpbnRvIGNoYWluIGNhbGxzLlxuICpcbiAqIEZvciBleGFtcGxlLCB0d28gYGVsZW1lbnRTdGFydGAgb3BlcmF0aW9ucyBpbiBzZXF1ZW5jZTpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpO1xuICogZWxlbWVudFN0YXJ0KDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqXG4gKiBDYW4gYmUgY2FsbGVkIGFzIGEgY2hhaW4gaW5zdGVhZDpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBlbGVtZW50U3RhcnQoMCwgJ2RpdicpKDEsICdzcGFuJyk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQ2hhaW5pbmcoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICBjaGFpbk9wZXJhdGlvbnNJbkxpc3Qodmlldy5jcmVhdGUpO1xuICAgIGNoYWluT3BlcmF0aW9uc0luTGlzdCh2aWV3LnVwZGF0ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2hhaW5PcGVyYXRpb25zSW5MaXN0KG9wTGlzdDogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPik6IHZvaWQge1xuICBsZXQgY2hhaW46IENoYWlufG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIG9wTGlzdCkge1xuICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RhdGVtZW50IHx8ICEob3Auc3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSkge1xuICAgICAgLy8gVGhpcyB0eXBlIG9mIHN0YXRlbWVudCBpc24ndCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCEob3Auc3RhdGVtZW50LmV4cHIgaW5zdGFuY2VvZiBvLkludm9rZUZ1bmN0aW9uRXhwcikgfHxcbiAgICAgICAgIShvcC5zdGF0ZW1lbnQuZXhwci5mbiBpbnN0YW5jZW9mIG8uRXh0ZXJuYWxFeHByKSkge1xuICAgICAgLy8gVGhpcyBpcyBhIHN0YXRlbWVudCwgYnV0IG5vdCBhbiBpbnN0cnVjdGlvbi10eXBlIGNhbGwsIHNvIG5vdCBjaGFpbmFibGUuXG4gICAgICBjaGFpbiA9IG51bGw7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBpbnN0cnVjdGlvbiA9IG9wLnN0YXRlbWVudC5leHByLmZuLnZhbHVlO1xuICAgIGlmICghQ0hBSU5BQkxFLmhhcyhpbnN0cnVjdGlvbikpIHtcbiAgICAgIC8vIFRoaXMgaW5zdHJ1Y3Rpb24gaXNuJ3QgY2hhaW5hYmxlLlxuICAgICAgY2hhaW4gPSBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpbnN0cnVjdGlvbiBjYW4gYmUgY2hhaW5lZC4gSXQgY2FuIGVpdGhlciBiZSBhZGRlZCBvbiB0byB0aGUgcHJldmlvdXMgY2hhaW4gKGlmXG4gICAgLy8gY29tcGF0aWJsZSkgb3IgaXQgY2FuIGJlIHRoZSBzdGFydCBvZiBhIG5ldyBjaGFpbi5cbiAgICBpZiAoY2hhaW4gIT09IG51bGwgJiYgY2hhaW4uaW5zdHJ1Y3Rpb24gPT09IGluc3RydWN0aW9uKSB7XG4gICAgICAvLyBUaGlzIGluc3RydWN0aW9uIGNhbiBiZSBhZGRlZCBvbnRvIHRoZSBwcmV2aW91cyBjaGFpbi5cbiAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjaGFpbi5leHByZXNzaW9uLmNhbGxGbihcbiAgICAgICAgICBvcC5zdGF0ZW1lbnQuZXhwci5hcmdzLCBvcC5zdGF0ZW1lbnQuZXhwci5zb3VyY2VTcGFuLCBvcC5zdGF0ZW1lbnQuZXhwci5wdXJlKTtcbiAgICAgIGNoYWluLmV4cHJlc3Npb24gPSBleHByZXNzaW9uO1xuICAgICAgY2hhaW4ub3Auc3RhdGVtZW50ID0gZXhwcmVzc2lvbi50b1N0bXQoKTtcbiAgICAgIGlyLk9wTGlzdC5yZW1vdmUob3AgYXMgaXIuT3A8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTGVhdmUgdGhpcyBpbnN0cnVjdGlvbiBhbG9uZSBmb3Igbm93LCBidXQgY29uc2lkZXIgaXQgdGhlIHN0YXJ0IG9mIGEgbmV3IGNoYWluLlxuICAgICAgY2hhaW4gPSB7XG4gICAgICAgIG9wLFxuICAgICAgICBpbnN0cnVjdGlvbixcbiAgICAgICAgZXhwcmVzc2lvbjogb3Auc3RhdGVtZW50LmV4cHIsXG4gICAgICB9O1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFN0cnVjdHVyZSByZXByZXNlbnRpbmcgYW4gaW4tcHJvZ3Jlc3MgY2hhaW4uXG4gKi9cbmludGVyZmFjZSBDaGFpbiB7XG4gIC8qKlxuICAgKiBUaGUgc3RhdGVtZW50IHdoaWNoIGhvbGRzIHRoZSBlbnRpcmUgY2hhaW4uXG4gICAqL1xuICBvcDogaXIuU3RhdGVtZW50T3A8aXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+O1xuXG4gIC8qKlxuICAgKiBUaGUgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHdob2xlIGN1cnJlbnQgY2hhaW5lZCBjYWxsLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBiZSB0aGUgc2FtZSBhcyBgb3Auc3RhdGVtZW50LmV4cHJlc3Npb25gLCBidXQgaXMgZXh0cmFjdGVkIGhlcmUgZm9yIGNvbnZlbmllbmNlXG4gICAqIHNpbmNlIHRoZSBgb3BgIHR5cGUgZG9lc24ndCBjYXB0dXJlIHRoZSBmYWN0IHRoYXQgYG9wLnN0YXRlbWVudGAgaXMgYW4gYG8uRXhwcmVzc2lvblN0YXRlbWVudGAuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFRoZSBpbnN0cnVjdGlvbiB0aGF0IGlzIGJlaW5nIGNoYWluZWQuXG4gICAqL1xuICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZTtcbn1cbiJdfQ==