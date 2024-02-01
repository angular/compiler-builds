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
        if (op.kind === ir.OpKind.Listener || op.kind === ir.OpKind.TwoWayListener) {
            ir.transformExpressionsInOp(op, (expr) => {
                if (expr instanceof ir.LexicalReadExpr && expr.name === '$event') {
                    // Two-way listeners always consume `$event` so they omit this field.
                    if (op.kind === ir.OpKind.Listener) {
                        op.consumesDollarEvent = true;
                    }
                    return new o.ReadVarExpr(expr.name);
                }
                return expr;
            }, ir.VisitorContextFlag.InChildOperation);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9kb2xsYXJfZXZlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZXNvbHZlX2RvbGxhcl9ldmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxHQUFtQjtJQUNwRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hDLG9CQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUN6QixJQUFxQixFQUFFLEdBQWtEO0lBQzNFLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMzRSxFQUFFLENBQUMsd0JBQXdCLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ3ZDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDakUscUVBQXFFO29CQUNyRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDbkMsRUFBRSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztvQkFDaEMsQ0FBQztvQkFDRCxPQUFPLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3RDLENBQUM7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDN0MsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9iLCBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBBbnkgdmFyaWFibGUgaW5zaWRlIGEgbGlzdGVuZXIgd2l0aCB0aGUgbmFtZSBgJGV2ZW50YCB3aWxsIGJlIHRyYW5zZm9ybWVkIGludG8gYSBvdXRwdXQgbGV4aWNhbFxuICogcmVhZCBpbW1lZGlhdGVseSwgYW5kIGRvZXMgbm90IHBhcnRpY2lwYXRlIGluIGFueSBvZiB0aGUgbm9ybWFsIGxvZ2ljIGZvciBoYW5kbGluZyB2YXJpYWJsZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRG9sbGFyRXZlbnQoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgdHJhbnNmb3JtRG9sbGFyRXZlbnQodW5pdCwgdW5pdC5jcmVhdGUpO1xuICAgIHRyYW5zZm9ybURvbGxhckV2ZW50KHVuaXQsIHVuaXQudXBkYXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Eb2xsYXJFdmVudChcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wczogaXIuT3BMaXN0PGlyLkNyZWF0ZU9wPnxpci5PcExpc3Q8aXIuVXBkYXRlT3A+KTogdm9pZCB7XG4gIGZvciAoY29uc3Qgb3Agb2Ygb3BzKSB7XG4gICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5MaXN0ZW5lciB8fCBvcC5raW5kID09PSBpci5PcEtpbmQuVHdvV2F5TGlzdGVuZXIpIHtcbiAgICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgKGV4cHIpID0+IHtcbiAgICAgICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5MZXhpY2FsUmVhZEV4cHIgJiYgZXhwci5uYW1lID09PSAnJGV2ZW50Jykge1xuICAgICAgICAgIC8vIFR3by13YXkgbGlzdGVuZXJzIGFsd2F5cyBjb25zdW1lIGAkZXZlbnRgIHNvIHRoZXkgb21pdCB0aGlzIGZpZWxkLlxuICAgICAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIG9wLmNvbnN1bWVzRG9sbGFyRXZlbnQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV3IG8uUmVhZFZhckV4cHIoZXhwci5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==