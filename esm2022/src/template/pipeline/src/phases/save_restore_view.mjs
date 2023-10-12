/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phaseSaveRestoreView(job) {
    for (const view of job.views.values()) {
        view.create.prepend([
            ir.createVariableOp(view.job.allocateXrefId(), {
                kind: ir.SemanticVariableKind.SavedView,
                name: null,
                view: view.xref,
            }, new ir.GetCurrentViewExpr(), /* isConstant */ true),
        ]);
        for (const op of view.create) {
            if (op.kind !== ir.OpKind.Listener) {
                continue;
            }
            // Embedded views always need the save/restore view operation.
            let needsRestoreView = view !== job.root;
            if (!needsRestoreView) {
                for (const handlerOp of op.handlerOps) {
                    ir.visitExpressionsInOp(handlerOp, expr => {
                        if (expr instanceof ir.ReferenceExpr) {
                            // Listeners that reference() a local ref need the save/restore view operation.
                            needsRestoreView = true;
                        }
                    });
                }
            }
            if (needsRestoreView) {
                addSaveRestoreViewOperationToListener(view, op);
            }
        }
    }
}
function addSaveRestoreViewOperationToListener(unit, op) {
    op.handlerOps.prepend([
        ir.createVariableOp(unit.job.allocateXrefId(), {
            kind: ir.SemanticVariableKind.Context,
            name: null,
            view: unit.xref,
        }, new ir.RestoreViewExpr(unit.xref), /* isConstant */ true),
    ]);
    // The "restore view" operation in listeners requires a call to `resetView` to reset the
    // context prior to returning from the listener operation. Find any `return` statements in
    // the listener body and wrap them in a call to reset the view.
    for (const handlerOp of op.handlerOps) {
        if (handlerOp.kind === ir.OpKind.Statement &&
            handlerOp.statement instanceof o.ReturnStatement) {
            handlerOp.statement.value = new ir.ResetViewExpr(handlerOp.statement.value);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZV9yZXN0b3JlX3ZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9zYXZlX3Jlc3RvcmVfdmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUE0QjtJQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsU0FBUztnQkFDdkMsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7U0FFeEQsQ0FBQyxDQUFDO1FBRUgsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDbEMsU0FBUzthQUNWO1lBRUQsOERBQThEO1lBQzlELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFFekMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixLQUFLLE1BQU0sU0FBUyxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUU7b0JBQ3JDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEVBQUU7d0JBQ3hDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxhQUFhLEVBQUU7NEJBQ3BDLCtFQUErRTs0QkFDL0UsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO3lCQUN6QjtvQkFDSCxDQUFDLENBQUMsQ0FBQztpQkFDSjthQUNGO1lBRUQsSUFBSSxnQkFBZ0IsRUFBRTtnQkFDcEIscUNBQXFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQ2pEO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRCxTQUFTLHFDQUFxQyxDQUFDLElBQXlCLEVBQUUsRUFBaUI7SUFDekYsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDcEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7WUFDekIsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPO1lBQ3JDLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7S0FDOUQsQ0FBQyxDQUFDO0lBRUgsd0ZBQXdGO0lBQ3hGLDBGQUEwRjtJQUMxRiwrREFBK0Q7SUFDL0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFO1FBQ3JDLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7WUFDdEMsU0FBUyxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsZUFBZSxFQUFFO1lBQ3BELFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQzdFO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVNhdmVSZXN0b3JlVmlldyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdmlldyBvZiBqb2Iudmlld3MudmFsdWVzKCkpIHtcbiAgICB2aWV3LmNyZWF0ZS5wcmVwZW5kKFtcbiAgICAgIGlyLmNyZWF0ZVZhcmlhYmxlT3A8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgIHZpZXcuam9iLmFsbG9jYXRlWHJlZklkKCksIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLlNhdmVkVmlldyxcbiAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICB2aWV3OiB2aWV3LnhyZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuZXcgaXIuR2V0Q3VycmVudFZpZXdFeHByKCksIC8qIGlzQ29uc3RhbnQgKi8gdHJ1ZSksXG5cbiAgICBdKTtcblxuICAgIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuTGlzdGVuZXIpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEVtYmVkZGVkIHZpZXdzIGFsd2F5cyBuZWVkIHRoZSBzYXZlL3Jlc3RvcmUgdmlldyBvcGVyYXRpb24uXG4gICAgICBsZXQgbmVlZHNSZXN0b3JlVmlldyA9IHZpZXcgIT09IGpvYi5yb290O1xuXG4gICAgICBpZiAoIW5lZWRzUmVzdG9yZVZpZXcpIHtcbiAgICAgICAgZm9yIChjb25zdCBoYW5kbGVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKGhhbmRsZXJPcCwgZXhwciA9PiB7XG4gICAgICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlJlZmVyZW5jZUV4cHIpIHtcbiAgICAgICAgICAgICAgLy8gTGlzdGVuZXJzIHRoYXQgcmVmZXJlbmNlKCkgYSBsb2NhbCByZWYgbmVlZCB0aGUgc2F2ZS9yZXN0b3JlIHZpZXcgb3BlcmF0aW9uLlxuICAgICAgICAgICAgICBuZWVkc1Jlc3RvcmVWaWV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobmVlZHNSZXN0b3JlVmlldykge1xuICAgICAgICBhZGRTYXZlUmVzdG9yZVZpZXdPcGVyYXRpb25Ub0xpc3RlbmVyKHZpZXcsIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkU2F2ZVJlc3RvcmVWaWV3T3BlcmF0aW9uVG9MaXN0ZW5lcih1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBvcDogaXIuTGlzdGVuZXJPcCkge1xuICBvcC5oYW5kbGVyT3BzLnByZXBlbmQoW1xuICAgIGlyLmNyZWF0ZVZhcmlhYmxlT3A8aXIuVXBkYXRlT3A+KFxuICAgICAgICB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCB7XG4gICAgICAgICAga2luZDogaXIuU2VtYW50aWNWYXJpYWJsZUtpbmQuQ29udGV4dCxcbiAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgIHZpZXc6IHVuaXQueHJlZixcbiAgICAgICAgfSxcbiAgICAgICAgbmV3IGlyLlJlc3RvcmVWaWV3RXhwcih1bml0LnhyZWYpLCAvKiBpc0NvbnN0YW50ICovIHRydWUpLFxuICBdKTtcblxuICAvLyBUaGUgXCJyZXN0b3JlIHZpZXdcIiBvcGVyYXRpb24gaW4gbGlzdGVuZXJzIHJlcXVpcmVzIGEgY2FsbCB0byBgcmVzZXRWaWV3YCB0byByZXNldCB0aGVcbiAgLy8gY29udGV4dCBwcmlvciB0byByZXR1cm5pbmcgZnJvbSB0aGUgbGlzdGVuZXIgb3BlcmF0aW9uLiBGaW5kIGFueSBgcmV0dXJuYCBzdGF0ZW1lbnRzIGluXG4gIC8vIHRoZSBsaXN0ZW5lciBib2R5IGFuZCB3cmFwIHRoZW0gaW4gYSBjYWxsIHRvIHJlc2V0IHRoZSB2aWV3LlxuICBmb3IgKGNvbnN0IGhhbmRsZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgaWYgKGhhbmRsZXJPcC5raW5kID09PSBpci5PcEtpbmQuU3RhdGVtZW50ICYmXG4gICAgICAgIGhhbmRsZXJPcC5zdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLlJldHVyblN0YXRlbWVudCkge1xuICAgICAgaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSA9IG5ldyBpci5SZXNldFZpZXdFeHByKGhhbmRsZXJPcC5zdGF0ZW1lbnQudmFsdWUpO1xuICAgIH1cbiAgfVxufVxuIl19