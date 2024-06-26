/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Replaces the `storeLet` ops with variables that can be
 * used to reference the value within the same view.
 */
export function generateLocalLetReferences(job) {
    for (const unit of job.units) {
        for (const op of unit.update) {
            if (op.kind !== ir.OpKind.StoreLet) {
                continue;
            }
            const variable = {
                kind: ir.SemanticVariableKind.Identifier,
                name: null,
                identifier: op.declaredName,
                local: true,
            };
            ir.OpList.replace(op, ir.createVariableOp(job.allocateXrefId(), variable, new ir.StoreLetExpr(op.target, op.value, op.sourceSpan), ir.VariableFlags.None));
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfbG9jYWxfbGV0X3JlZmVyZW5jZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9nZW5lcmF0ZV9sb2NhbF9sZXRfcmVmZXJlbmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsR0FBNEI7SUFDckUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ25DLFNBQVM7WUFDWCxDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQTBCO2dCQUN0QyxJQUFJLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLFVBQVU7Z0JBQ3hDLElBQUksRUFBRSxJQUFJO2dCQUNWLFVBQVUsRUFBRSxFQUFFLENBQUMsWUFBWTtnQkFDM0IsS0FBSyxFQUFFLElBQUk7YUFDWixDQUFDO1lBRUYsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQ2YsRUFBRSxFQUNGLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDakIsR0FBRyxDQUFDLGNBQWMsRUFBRSxFQUNwQixRQUFRLEVBQ1IsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQ3ZELEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUN0QixDQUNGLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXBsYWNlcyB0aGUgYHN0b3JlTGV0YCBvcHMgd2l0aCB2YXJpYWJsZXMgdGhhdCBjYW4gYmVcbiAqIHVzZWQgdG8gcmVmZXJlbmNlIHRoZSB2YWx1ZSB3aXRoaW4gdGhlIHNhbWUgdmlldy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlTG9jYWxMZXRSZWZlcmVuY2VzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuU3RvcmVMZXQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZhcmlhYmxlOiBpci5JZGVudGlmaWVyVmFyaWFibGUgPSB7XG4gICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLklkZW50aWZpZXIsXG4gICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgIGlkZW50aWZpZXI6IG9wLmRlY2xhcmVkTmFtZSxcbiAgICAgICAgbG9jYWw6IHRydWUsXG4gICAgICB9O1xuXG4gICAgICBpci5PcExpc3QucmVwbGFjZTxpci5VcGRhdGVPcD4oXG4gICAgICAgIG9wLFxuICAgICAgICBpci5jcmVhdGVWYXJpYWJsZU9wPGlyLlVwZGF0ZU9wPihcbiAgICAgICAgICBqb2IuYWxsb2NhdGVYcmVmSWQoKSxcbiAgICAgICAgICB2YXJpYWJsZSxcbiAgICAgICAgICBuZXcgaXIuU3RvcmVMZXRFeHByKG9wLnRhcmdldCwgb3AudmFsdWUsIG9wLnNvdXJjZVNwYW4pLFxuICAgICAgICAgIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG59XG4iXX0=