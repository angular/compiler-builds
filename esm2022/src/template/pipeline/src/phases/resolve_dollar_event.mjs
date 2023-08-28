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
 * Any variable inside a listener with the name `$event` will be transformed into a output lexical
 * read immediately, and does not participate in any of the normal logic for handling variables.
 */
export function phaseResolveDollarEvent(job) {
    for (const unit of job.units) {
        resolveDollarEvent(unit, unit.create);
        resolveDollarEvent(unit, unit.update);
    }
}
function resolveDollarEvent(unit, ops) {
    for (const op of ops) {
        if (op.kind === ir.OpKind.Listener) {
            ir.transformExpressionsInOp(op, (expr) => {
                if (expr instanceof ir.LexicalReadExpr && expr.name === '$event') {
                    op.consumesDollarEvent = true;
                    return new o.ReadVarExpr(expr.name);
                }
                return expr;
            }, ir.VisitorContextFlag.InChildOperation);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9kb2xsYXJfZXZlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZXNvbHZlX2RvbGxhcl9ldmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFtQjtJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsa0JBQWtCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3ZDO0FBQ0gsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQ3ZCLElBQXFCLEVBQUUsR0FBa0Q7SUFDM0UsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7UUFDcEIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQ2xDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDdkMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtvQkFDaEUsRUFBRSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztvQkFDOUIsT0FBTyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUNyQztnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztTQUM1QztLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYiwgQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQW55IHZhcmlhYmxlIGluc2lkZSBhIGxpc3RlbmVyIHdpdGggdGhlIG5hbWUgYCRldmVudGAgd2lsbCBiZSB0cmFuc2Zvcm1lZCBpbnRvIGEgb3V0cHV0IGxleGljYWxcbiAqIHJlYWQgaW1tZWRpYXRlbHksIGFuZCBkb2VzIG5vdCBwYXJ0aWNpcGF0ZSBpbiBhbnkgb2YgdGhlIG5vcm1hbCBsb2dpYyBmb3IgaGFuZGxpbmcgdmFyaWFibGVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VSZXNvbHZlRG9sbGFyRXZlbnQoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgcmVzb2x2ZURvbGxhckV2ZW50KHVuaXQsIHVuaXQuY3JlYXRlKTtcbiAgICByZXNvbHZlRG9sbGFyRXZlbnQodW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVEb2xsYXJFdmVudChcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPnxpci5PcExpc3Q8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwcikgPT4ge1xuICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkxleGljYWxSZWFkRXhwciAmJiBleHByLm5hbWUgPT09ICckZXZlbnQnKSB7XG4gICAgICAgICAgb3AuY29uc3VtZXNEb2xsYXJFdmVudCA9IHRydWU7XG4gICAgICAgICAgcmV0dXJuIG5ldyBvLlJlYWRWYXJFeHByKGV4cHIubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuSW5DaGlsZE9wZXJhdGlvbik7XG4gICAgfVxuICB9XG59XG4iXX0=