/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phaseSaveRestoreView(cpl) {
    for (const view of cpl.views.values()) {
        if (view === cpl.root) {
            // Save/restore operations are not necessary for the root view.
            continue;
        }
        view.create.prepend([
            ir.createVariableOp(view.tpl.allocateXrefId(), {
                kind: ir.SemanticVariableKind.SavedView,
                name: null,
                view: view.xref,
            }, new ir.GetCurrentViewExpr()),
        ]);
        for (const op of view.create) {
            if (op.kind !== ir.OpKind.Listener) {
                continue;
            }
            op.handlerOps.prepend([
                ir.createVariableOp(view.tpl.allocateXrefId(), {
                    kind: ir.SemanticVariableKind.Context,
                    name: null,
                    view: view.xref,
                }, new ir.RestoreViewExpr(view.xref)),
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
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZV9yZXN0b3JlX3ZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9zYXZlX3Jlc3RvcmVfdmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUF5QjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRTtZQUNyQiwrREFBK0Q7WUFDL0QsU0FBUztTQUNWO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsU0FBUztnQkFDdkMsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2FBQ2hCLEVBQ0QsSUFBSSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztTQUNqQyxDQUFDLENBQUM7UUFFSCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO2dCQUNsQyxTQUFTO2FBQ1Y7WUFFRCxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQkFDcEIsRUFBRSxDQUFDLGdCQUFnQixDQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUU7b0JBQ3pCLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsT0FBTztvQkFDckMsSUFBSSxFQUFFLElBQUk7b0JBQ1YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2lCQUNoQixFQUNELElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDdkMsQ0FBQyxDQUFDO1lBRUgsd0ZBQXdGO1lBQ3hGLDBGQUEwRjtZQUMxRiwrREFBK0Q7WUFDL0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFO2dCQUNyQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QyxTQUFTLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUU7b0JBQ3BELFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUM3RTthQUNGO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcG9uZW50Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlU2F2ZVJlc3RvcmVWaWV3KGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgZm9yIChjb25zdCB2aWV3IG9mIGNwbC52aWV3cy52YWx1ZXMoKSkge1xuICAgIGlmICh2aWV3ID09PSBjcGwucm9vdCkge1xuICAgICAgLy8gU2F2ZS9yZXN0b3JlIG9wZXJhdGlvbnMgYXJlIG5vdCBuZWNlc3NhcnkgZm9yIHRoZSByb290IHZpZXcuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB2aWV3LmNyZWF0ZS5wcmVwZW5kKFtcbiAgICAgIGlyLmNyZWF0ZVZhcmlhYmxlT3A8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgIHZpZXcudHBsLmFsbG9jYXRlWHJlZklkKCksIHtcbiAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLlNhdmVkVmlldyxcbiAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICB2aWV3OiB2aWV3LnhyZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuZXcgaXIuR2V0Q3VycmVudFZpZXdFeHByKCkpLFxuICAgIF0pO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5MaXN0ZW5lcikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgb3AuaGFuZGxlck9wcy5wcmVwZW5kKFtcbiAgICAgICAgaXIuY3JlYXRlVmFyaWFibGVPcDxpci5VcGRhdGVPcD4oXG4gICAgICAgICAgICB2aWV3LnRwbC5hbGxvY2F0ZVhyZWZJZCgpLCB7XG4gICAgICAgICAgICAgIGtpbmQ6IGlyLlNlbWFudGljVmFyaWFibGVLaW5kLkNvbnRleHQsXG4gICAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICAgIHZpZXc6IHZpZXcueHJlZixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuZXcgaXIuUmVzdG9yZVZpZXdFeHByKHZpZXcueHJlZikpLFxuICAgICAgXSk7XG5cbiAgICAgIC8vIFRoZSBcInJlc3RvcmUgdmlld1wiIG9wZXJhdGlvbiBpbiBsaXN0ZW5lcnMgcmVxdWlyZXMgYSBjYWxsIHRvIGByZXNldFZpZXdgIHRvIHJlc2V0IHRoZVxuICAgICAgLy8gY29udGV4dCBwcmlvciB0byByZXR1cm5pbmcgZnJvbSB0aGUgbGlzdGVuZXIgb3BlcmF0aW9uLiBGaW5kIGFueSBgcmV0dXJuYCBzdGF0ZW1lbnRzIGluXG4gICAgICAvLyB0aGUgbGlzdGVuZXIgYm9keSBhbmQgd3JhcCB0aGVtIGluIGEgY2FsbCB0byByZXNldCB0aGUgdmlldy5cbiAgICAgIGZvciAoY29uc3QgaGFuZGxlck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICAgICAgaWYgKGhhbmRsZXJPcC5raW5kID09PSBpci5PcEtpbmQuU3RhdGVtZW50ICYmXG4gICAgICAgICAgICBoYW5kbGVyT3Auc3RhdGVtZW50IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICAgICAgICBoYW5kbGVyT3Auc3RhdGVtZW50LnZhbHVlID0gbmV3IGlyLlJlc2V0Vmlld0V4cHIoaGFuZGxlck9wLnN0YXRlbWVudC52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==