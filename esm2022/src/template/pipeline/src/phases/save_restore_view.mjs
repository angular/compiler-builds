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
 * When inside of a listener, we may need access to one or more enclosing views. Therefore, each
 * view should save the current view, and each listener must have the ability to restore the
 * appropriate view. We eagerly generate all save view variables; they will be optimized away later.
 */
export function saveAndRestoreView(job) {
    for (const unit of job.units) {
        unit.create.prepend([
            ir.createVariableOp(unit.job.allocateXrefId(), {
                kind: ir.SemanticVariableKind.SavedView,
                name: null,
                view: unit.xref,
            }, new ir.GetCurrentViewExpr(), ir.VariableFlags.None),
        ]);
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.Listener) {
                continue;
            }
            // Embedded views always need the save/restore view operation.
            let needsRestoreView = unit !== job.root;
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
                addSaveRestoreViewOperationToListener(unit, op);
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
        }, new ir.RestoreViewExpr(unit.xref), ir.VariableFlags.None),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZV9yZXN0b3JlX3ZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9zYXZlX3Jlc3RvcmVfdmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBNEI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsU0FBUztnQkFDdkMsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztTQUN4RCxDQUFDLENBQUM7UUFFSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDbkMsU0FBUztZQUNYLENBQUM7WUFFRCw4REFBOEQ7WUFDOUQsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQztZQUV6QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDdEIsS0FBSyxNQUFNLFNBQVMsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3RDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEVBQUU7d0JBQ3hDLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQzs0QkFDckMsK0VBQStFOzRCQUMvRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7d0JBQzFCLENBQUM7b0JBQ0gsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNILENBQUM7WUFFRCxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3JCLHFDQUFxQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNsRCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQ0FBcUMsQ0FBQyxJQUF5QixFQUFFLEVBQWlCO0lBQ3pGLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO1FBQ3BCLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FDZixJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsT0FBTztZQUNyQyxJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtTQUNoQixFQUNELElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7S0FDOUQsQ0FBQyxDQUFDO0lBRUgsd0ZBQXdGO0lBQ3hGLDBGQUEwRjtJQUMxRiwrREFBK0Q7SUFDL0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDdEMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztZQUN0QyxTQUFTLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNyRCxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5RSxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBXaGVuIGluc2lkZSBvZiBhIGxpc3RlbmVyLCB3ZSBtYXkgbmVlZCBhY2Nlc3MgdG8gb25lIG9yIG1vcmUgZW5jbG9zaW5nIHZpZXdzLiBUaGVyZWZvcmUsIGVhY2hcbiAqIHZpZXcgc2hvdWxkIHNhdmUgdGhlIGN1cnJlbnQgdmlldywgYW5kIGVhY2ggbGlzdGVuZXIgbXVzdCBoYXZlIHRoZSBhYmlsaXR5IHRvIHJlc3RvcmUgdGhlXG4gKiBhcHByb3ByaWF0ZSB2aWV3LiBXZSBlYWdlcmx5IGdlbmVyYXRlIGFsbCBzYXZlIHZpZXcgdmFyaWFibGVzOyB0aGV5IHdpbGwgYmUgb3B0aW1pemVkIGF3YXkgbGF0ZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXZlQW5kUmVzdG9yZVZpZXcoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgdW5pdC5jcmVhdGUucHJlcGVuZChbXG4gICAgICBpci5jcmVhdGVWYXJpYWJsZU9wPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCB7XG4gICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5TYXZlZFZpZXcsXG4gICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgdmlldzogdW5pdC54cmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbmV3IGlyLkdldEN1cnJlbnRWaWV3RXhwcigpLCBpci5WYXJpYWJsZUZsYWdzLk5vbmUpLFxuICAgIF0pO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gRW1iZWRkZWQgdmlld3MgYWx3YXlzIG5lZWQgdGhlIHNhdmUvcmVzdG9yZSB2aWV3IG9wZXJhdGlvbi5cbiAgICAgIGxldCBuZWVkc1Jlc3RvcmVWaWV3ID0gdW5pdCAhPT0gam9iLnJvb3Q7XG5cbiAgICAgIGlmICghbmVlZHNSZXN0b3JlVmlldykge1xuICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3AoaGFuZGxlck9wLCBleHByID0+IHtcbiAgICAgICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuUmVmZXJlbmNlRXhwcikge1xuICAgICAgICAgICAgICAvLyBMaXN0ZW5lcnMgdGhhdCByZWZlcmVuY2UoKSBhIGxvY2FsIHJlZiBuZWVkIHRoZSBzYXZlL3Jlc3RvcmUgdmlldyBvcGVyYXRpb24uXG4gICAgICAgICAgICAgIG5lZWRzUmVzdG9yZVZpZXcgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuZWVkc1Jlc3RvcmVWaWV3KSB7XG4gICAgICAgIGFkZFNhdmVSZXN0b3JlVmlld09wZXJhdGlvblRvTGlzdGVuZXIodW5pdCwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRTYXZlUmVzdG9yZVZpZXdPcGVyYXRpb25Ub0xpc3RlbmVyKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIG9wOiBpci5MaXN0ZW5lck9wKSB7XG4gIG9wLmhhbmRsZXJPcHMucHJlcGVuZChbXG4gICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5VcGRhdGVPcD4oXG4gICAgICAgIHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHtcbiAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0LFxuICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgdmlldzogdW5pdC54cmVmLFxuICAgICAgICB9LFxuICAgICAgICBuZXcgaXIuUmVzdG9yZVZpZXdFeHByKHVuaXQueHJlZiksIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSksXG4gIF0pO1xuXG4gIC8vIFRoZSBcInJlc3RvcmUgdmlld1wiIG9wZXJhdGlvbiBpbiBsaXN0ZW5lcnMgcmVxdWlyZXMgYSBjYWxsIHRvIGByZXNldFZpZXdgIHRvIHJlc2V0IHRoZVxuICAvLyBjb250ZXh0IHByaW9yIHRvIHJldHVybmluZyBmcm9tIHRoZSBsaXN0ZW5lciBvcGVyYXRpb24uIEZpbmQgYW55IGByZXR1cm5gIHN0YXRlbWVudHMgaW5cbiAgLy8gdGhlIGxpc3RlbmVyIGJvZHkgYW5kIHdyYXAgdGhlbSBpbiBhIGNhbGwgdG8gcmVzZXQgdGhlIHZpZXcuXG4gIGZvciAoY29uc3QgaGFuZGxlck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICBpZiAoaGFuZGxlck9wLmtpbmQgPT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgJiZcbiAgICAgICAgaGFuZGxlck9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgICBoYW5kbGVyT3Auc3RhdGVtZW50LnZhbHVlID0gbmV3IGlyLlJlc2V0Vmlld0V4cHIoaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSk7XG4gICAgfVxuICB9XG59XG4iXX0=