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
export function resolveDollarEvent(job) {
    for (const unit of job.units) {
        transformDollarEvent(unit, unit.create);
        transformDollarEvent(unit, unit.update);
    }
}
function transformDollarEvent(unit, ops) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9kb2xsYXJfZXZlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZXNvbHZlX2RvbGxhcl9ldmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxHQUFtQjtJQUNwRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hDLG9CQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUN6QixJQUFxQixFQUFFLEdBQWtEO0lBQzNFLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUN2QyxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7b0JBQ2pFLEVBQUUsQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7b0JBQzlCLE9BQU8sSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEFueSB2YXJpYWJsZSBpbnNpZGUgYSBsaXN0ZW5lciB3aXRoIHRoZSBuYW1lIGAkZXZlbnRgIHdpbGwgYmUgdHJhbnNmb3JtZWQgaW50byBhIG91dHB1dCBsZXhpY2FsXG4gKiByZWFkIGltbWVkaWF0ZWx5LCBhbmQgZG9lcyBub3QgcGFydGljaXBhdGUgaW4gYW55IG9mIHRoZSBub3JtYWwgbG9naWMgZm9yIGhhbmRsaW5nIHZhcmlhYmxlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVEb2xsYXJFdmVudChqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICB0cmFuc2Zvcm1Eb2xsYXJFdmVudCh1bml0LCB1bml0LmNyZWF0ZSk7XG4gICAgdHJhbnNmb3JtRG9sbGFyRXZlbnQodW5pdCwgdW5pdC51cGRhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybURvbGxhckV2ZW50KFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgb3BzOiBpci5PcExpc3Q8aXIuQ3JlYXRlT3A+fGlyLk9wTGlzdDxpci5VcGRhdGVPcD4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBvcCBvZiBvcHMpIHtcbiAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkxpc3RlbmVyKSB7XG4gICAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIChleHByKSA9PiB7XG4gICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByICYmIGV4cHIubmFtZSA9PT0gJyRldmVudCcpIHtcbiAgICAgICAgICBvcC5jb25zdW1lc0RvbGxhckV2ZW50ID0gdHJ1ZTtcbiAgICAgICAgICByZXR1cm4gbmV3IG8uUmVhZFZhckV4cHIoZXhwci5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==