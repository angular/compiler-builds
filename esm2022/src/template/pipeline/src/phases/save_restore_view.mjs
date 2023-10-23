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
            }, new ir.GetCurrentViewExpr(), ir.VariableFlags.None),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZV9yZXN0b3JlX3ZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9zYXZlX3Jlc3RvcmVfdmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUE0QjtJQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsU0FBUztnQkFDdkMsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztTQUN4RCxDQUFDLENBQUM7UUFFSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO2dCQUNsQyxTQUFTO2FBQ1Y7WUFFRCw4REFBOEQ7WUFDOUQsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQztZQUV6QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQ3JCLEtBQUssTUFBTSxTQUFTLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRTtvQkFDckMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRTt3QkFDeEMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLGFBQWEsRUFBRTs0QkFDcEMsK0VBQStFOzRCQUMvRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7eUJBQ3pCO29CQUNILENBQUMsQ0FBQyxDQUFDO2lCQUNKO2FBQ0Y7WUFFRCxJQUFJLGdCQUFnQixFQUFFO2dCQUNwQixxQ0FBcUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDakQ7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVELFNBQVMscUNBQXFDLENBQUMsSUFBeUIsRUFBRSxFQUFpQjtJQUN6RixFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUNwQixFQUFFLENBQUMsZ0JBQWdCLENBQ2YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRTtZQUN6QixJQUFJLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU87WUFDckMsSUFBSSxFQUFFLElBQUk7WUFDVixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7U0FDaEIsRUFDRCxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO0tBQzlELENBQUMsQ0FBQztJQUVILHdGQUF3RjtJQUN4RiwwRkFBMEY7SUFDMUYsK0RBQStEO0lBQy9ELEtBQUssTUFBTSxTQUFTLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRTtRQUNyQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO1lBQ3RDLFNBQVMsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLGVBQWUsRUFBRTtZQUNwRCxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM3RTtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VTYXZlUmVzdG9yZVZpZXcoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHZpZXcgb2Ygam9iLnZpZXdzLnZhbHVlcygpKSB7XG4gICAgdmlldy5jcmVhdGUucHJlcGVuZChbXG4gICAgICBpci5jcmVhdGVWYXJpYWJsZU9wPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICB2aWV3LmpvYi5hbGxvY2F0ZVhyZWZJZCgpLCB7XG4gICAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5TYXZlZFZpZXcsXG4gICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgdmlldzogdmlldy54cmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbmV3IGlyLkdldEN1cnJlbnRWaWV3RXhwcigpLCBpci5WYXJpYWJsZUZsYWdzLk5vbmUpLFxuICAgIF0pO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gRW1iZWRkZWQgdmlld3MgYWx3YXlzIG5lZWQgdGhlIHNhdmUvcmVzdG9yZSB2aWV3IG9wZXJhdGlvbi5cbiAgICAgIGxldCBuZWVkc1Jlc3RvcmVWaWV3ID0gdmlldyAhPT0gam9iLnJvb3Q7XG5cbiAgICAgIGlmICghbmVlZHNSZXN0b3JlVmlldykge1xuICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3AoaGFuZGxlck9wLCBleHByID0+IHtcbiAgICAgICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuUmVmZXJlbmNlRXhwcikge1xuICAgICAgICAgICAgICAvLyBMaXN0ZW5lcnMgdGhhdCByZWZlcmVuY2UoKSBhIGxvY2FsIHJlZiBuZWVkIHRoZSBzYXZlL3Jlc3RvcmUgdmlldyBvcGVyYXRpb24uXG4gICAgICAgICAgICAgIG5lZWRzUmVzdG9yZVZpZXcgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuZWVkc1Jlc3RvcmVWaWV3KSB7XG4gICAgICAgIGFkZFNhdmVSZXN0b3JlVmlld09wZXJhdGlvblRvTGlzdGVuZXIodmlldywgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRTYXZlUmVzdG9yZVZpZXdPcGVyYXRpb25Ub0xpc3RlbmVyKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIG9wOiBpci5MaXN0ZW5lck9wKSB7XG4gIG9wLmhhbmRsZXJPcHMucHJlcGVuZChbXG4gICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5VcGRhdGVPcD4oXG4gICAgICAgIHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCksIHtcbiAgICAgICAgICBraW5kOiBpci5TZW1hbnRpY1ZhcmlhYmxlS2luZC5Db250ZXh0LFxuICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgdmlldzogdW5pdC54cmVmLFxuICAgICAgICB9LFxuICAgICAgICBuZXcgaXIuUmVzdG9yZVZpZXdFeHByKHVuaXQueHJlZiksIGlyLlZhcmlhYmxlRmxhZ3MuTm9uZSksXG4gIF0pO1xuXG4gIC8vIFRoZSBcInJlc3RvcmUgdmlld1wiIG9wZXJhdGlvbiBpbiBsaXN0ZW5lcnMgcmVxdWlyZXMgYSBjYWxsIHRvIGByZXNldFZpZXdgIHRvIHJlc2V0IHRoZVxuICAvLyBjb250ZXh0IHByaW9yIHRvIHJldHVybmluZyBmcm9tIHRoZSBsaXN0ZW5lciBvcGVyYXRpb24uIEZpbmQgYW55IGByZXR1cm5gIHN0YXRlbWVudHMgaW5cbiAgLy8gdGhlIGxpc3RlbmVyIGJvZHkgYW5kIHdyYXAgdGhlbSBpbiBhIGNhbGwgdG8gcmVzZXQgdGhlIHZpZXcuXG4gIGZvciAoY29uc3QgaGFuZGxlck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICBpZiAoaGFuZGxlck9wLmtpbmQgPT09IGlyLk9wS2luZC5TdGF0ZW1lbnQgJiZcbiAgICAgICAgaGFuZGxlck9wLnN0YXRlbWVudCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgICBoYW5kbGVyT3Auc3RhdGVtZW50LnZhbHVlID0gbmV3IGlyLlJlc2V0Vmlld0V4cHIoaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSk7XG4gICAgfVxuICB9XG59XG4iXX0=