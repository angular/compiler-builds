/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
export function phasePipeCreation(cpl) {
    for (const view of cpl.views.values()) {
        processPipeBindingsInView(view);
    }
}
function processPipeBindingsInView(view) {
    for (const updateOp of view.update) {
        ir.visitExpressionsInOp(updateOp, (expr, flags) => {
            if (!ir.isIrExpression(expr)) {
                return;
            }
            if (expr.kind !== ir.ExpressionKind.PipeBinding) {
                return;
            }
            if (flags & ir.VisitorContextFlag.InChildOperation) {
                throw new Error(`AssertionError: pipe bindings should not appear in child expressions`);
            }
            if (!ir.hasDependsOnSlotContextTrait(updateOp)) {
                throw new Error(`AssertionError: pipe binding associated with non-slot operation ${ir.OpKind[updateOp.kind]}`);
            }
            addPipeToCreationBlock(view, updateOp.target, expr);
        });
    }
}
function addPipeToCreationBlock(view, afterTargetXref, binding) {
    // Find the appropriate point to insert the Pipe creation operation.
    // We're looking for `afterTargetXref` (and also want to insert after any other pipe operations
    // which might be beyond it).
    for (let op = view.create.head.next; op.kind !== ir.OpKind.ListEnd; op = op.next) {
        if (!ir.hasConsumesSlotTrait(op)) {
            continue;
        }
        if (op.xref !== afterTargetXref) {
            continue;
        }
        // We've found a tentative insertion point; however, we also want to skip past any _other_ pipe
        // operations present.
        while (op.next.kind === ir.OpKind.Pipe) {
            op = op.next;
        }
        const pipe = ir.createPipeOp(binding.target, binding.name);
        ir.OpList.insertBefore(pipe, op.next);
        // This completes adding the pipe to the creation block.
        return;
    }
    // At this point, we've failed to add the pipe to the creation block.
    throw new Error(`AssertionError: unable to find insertion point for pipe ${binding.name}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9jcmVhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BpcGVfY3JlYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQXlCO0lBQ3pELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUNyQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLElBQXFCO0lBQ3RELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNsQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ2hELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixPQUFPO2FBQ1I7WUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUU7Z0JBQy9DLE9BQU87YUFDUjtZQUVELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO2FBQ3pGO1lBRUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxtRUFDWixFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDakM7WUFFRCxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN0RCxDQUFDLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQzNCLElBQXFCLEVBQUUsZUFBMEIsRUFBRSxPQUEyQjtJQUNoRixvRUFBb0U7SUFDcEUsK0ZBQStGO0lBQy9GLDZCQUE2QjtJQUM3QixLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSyxFQUFFO1FBQ2xGLElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQWMsRUFBRSxDQUFDLEVBQUU7WUFDN0MsU0FBUztTQUNWO1FBRUQsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLGVBQWUsRUFBRTtZQUMvQixTQUFTO1NBQ1Y7UUFFRCwrRkFBK0Y7UUFDL0Ysc0JBQXNCO1FBQ3RCLE9BQU8sRUFBRSxDQUFDLElBQUssQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUU7WUFDdkMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFLLENBQUM7U0FDZjtRQUVELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFnQixDQUFDO1FBQzFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSyxDQUFDLENBQUM7UUFFdkMsd0RBQXdEO1FBQ3hELE9BQU87S0FDUjtJQUVELHFFQUFxRTtJQUNyRSxNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRCxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUM3RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVBpcGVDcmVhdGlvbihjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdmlldyBvZiBjcGwudmlld3MudmFsdWVzKCkpIHtcbiAgICBwcm9jZXNzUGlwZUJpbmRpbmdzSW5WaWV3KHZpZXcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NQaXBlQmluZGluZ3NJblZpZXcodmlldzogVmlld0NvbXBpbGF0aW9uKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdXBkYXRlT3Agb2Ygdmlldy51cGRhdGUpIHtcbiAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcCh1cGRhdGVPcCwgKGV4cHIsIGZsYWdzKSA9PiB7XG4gICAgICBpZiAoIWlyLmlzSXJFeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGV4cHIua2luZCAhPT0gaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmxhZ3MgJiBpci5WaXNpdG9yQ29udGV4dEZsYWcuSW5DaGlsZE9wZXJhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBwaXBlIGJpbmRpbmdzIHNob3VsZCBub3QgYXBwZWFyIGluIGNoaWxkIGV4cHJlc3Npb25zYCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdCh1cGRhdGVPcCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogcGlwZSBiaW5kaW5nIGFzc29jaWF0ZWQgd2l0aCBub24tc2xvdCBvcGVyYXRpb24gJHtcbiAgICAgICAgICAgIGlyLk9wS2luZFt1cGRhdGVPcC5raW5kXX1gKTtcbiAgICAgIH1cblxuICAgICAgYWRkUGlwZVRvQ3JlYXRpb25CbG9jayh2aWV3LCB1cGRhdGVPcC50YXJnZXQsIGV4cHIpO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFBpcGVUb0NyZWF0aW9uQmxvY2soXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uLCBhZnRlclRhcmdldFhyZWY6IGlyLlhyZWZJZCwgYmluZGluZzogaXIuUGlwZUJpbmRpbmdFeHByKTogdm9pZCB7XG4gIC8vIEZpbmQgdGhlIGFwcHJvcHJpYXRlIHBvaW50IHRvIGluc2VydCB0aGUgUGlwZSBjcmVhdGlvbiBvcGVyYXRpb24uXG4gIC8vIFdlJ3JlIGxvb2tpbmcgZm9yIGBhZnRlclRhcmdldFhyZWZgIChhbmQgYWxzbyB3YW50IHRvIGluc2VydCBhZnRlciBhbnkgb3RoZXIgcGlwZSBvcGVyYXRpb25zXG4gIC8vIHdoaWNoIG1pZ2h0IGJlIGJleW9uZCBpdCkuXG4gIGZvciAobGV0IG9wID0gdmlldy5jcmVhdGUuaGVhZC5uZXh0ITsgb3Aua2luZCAhPT0gaXIuT3BLaW5kLkxpc3RFbmQ7IG9wID0gb3AubmV4dCEpIHtcbiAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0PGlyLkNyZWF0ZU9wPihvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChvcC54cmVmICE9PSBhZnRlclRhcmdldFhyZWYpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFdlJ3ZlIGZvdW5kIGEgdGVudGF0aXZlIGluc2VydGlvbiBwb2ludDsgaG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHNraXAgcGFzdCBhbnkgX290aGVyXyBwaXBlXG4gICAgLy8gb3BlcmF0aW9ucyBwcmVzZW50LlxuICAgIHdoaWxlIChvcC5uZXh0IS5raW5kID09PSBpci5PcEtpbmQuUGlwZSkge1xuICAgICAgb3AgPSBvcC5uZXh0ITtcbiAgICB9XG5cbiAgICBjb25zdCBwaXBlID0gaXIuY3JlYXRlUGlwZU9wKGJpbmRpbmcudGFyZ2V0LCBiaW5kaW5nLm5hbWUpIGFzIGlyLkNyZWF0ZU9wO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUocGlwZSwgb3AubmV4dCEpO1xuXG4gICAgLy8gVGhpcyBjb21wbGV0ZXMgYWRkaW5nIHRoZSBwaXBlIHRvIHRoZSBjcmVhdGlvbiBibG9jay5cbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50LCB3ZSd2ZSBmYWlsZWQgdG8gYWRkIHRoZSBwaXBlIHRvIHRoZSBjcmVhdGlvbiBibG9jay5cbiAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5hYmxlIHRvIGZpbmQgaW5zZXJ0aW9uIHBvaW50IGZvciBwaXBlICR7YmluZGluZy5uYW1lfWApO1xufVxuIl19