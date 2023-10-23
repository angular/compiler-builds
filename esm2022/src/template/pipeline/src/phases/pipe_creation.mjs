/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
export function phasePipeCreation(job) {
    for (const unit of job.units) {
        processPipeBindingsInView(unit);
    }
}
function processPipeBindingsInView(unit) {
    for (const updateOp of unit.update) {
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
            // This update op must be associated with a create op that consumes a slot (either by
            // depending on the ambient context of `target`, or merely referencing that create op via
            // `target`).
            if (!ir.hasDependsOnSlotContextTrait(updateOp) &&
                !ir.hasUsesSlotIndexTrait(updateOp)) {
                throw new Error(`AssertionError: pipe binding associated with non-slot operation ${ir.OpKind[updateOp.kind]}`);
            }
            addPipeToCreationBlock(unit, updateOp.target, expr);
        });
    }
}
function addPipeToCreationBlock(unit, afterTargetXref, binding) {
    // Find the appropriate point to insert the Pipe creation operation.
    // We're looking for `afterTargetXref` (and also want to insert after any other pipe operations
    // which might be beyond it).
    for (let op = unit.create.head.next; op.kind !== ir.OpKind.ListEnd; op = op.next) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9jcmVhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BpcGVfY3JlYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQW1CO0lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1Qix5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLElBQXFCO0lBQ3RELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNsQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ2hELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixPQUFPO2FBQ1I7WUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUU7Z0JBQy9DLE9BQU87YUFDUjtZQUVELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO2FBQ3pGO1lBRUQscUZBQXFGO1lBQ3JGLHlGQUF5RjtZQUN6RixhQUFhO1lBQ2IsSUFBSSxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLENBQUM7Z0JBQzFDLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFjLFFBQVEsQ0FBQyxFQUFFO2dCQUNwRCxNQUFNLElBQUksS0FBSyxDQUFDLG1FQUNaLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNqQztZQUVELHNCQUFzQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RELENBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFDSCxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FDM0IsSUFBcUIsRUFBRSxlQUEwQixFQUFFLE9BQTJCO0lBQ2hGLG9FQUFvRTtJQUNwRSwrRkFBK0Y7SUFDL0YsNkJBQTZCO0lBQzdCLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFLLEVBQUU7UUFDbEYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBYyxFQUFFLENBQUMsRUFBRTtZQUM3QyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssZUFBZSxFQUFFO1lBQy9CLFNBQVM7U0FDVjtRQUVELCtGQUErRjtRQUMvRixzQkFBc0I7UUFDdEIsT0FBTyxFQUFFLENBQUMsSUFBSyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUN2QyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUssQ0FBQztTQUNmO1FBRUQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQWdCLENBQUM7UUFDMUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFLLENBQUMsQ0FBQztRQUV2Qyx3REFBd0Q7UUFDeEQsT0FBTztLQUNSO0lBRUQscUVBQXFFO0lBQ3JFLE1BQU0sSUFBSSxLQUFLLENBQUMsMkRBQTJELE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzdGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9iLCBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUGlwZUNyZWF0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHByb2Nlc3NQaXBlQmluZGluZ3NJblZpZXcodW5pdCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1BpcGVCaW5kaW5nc0luVmlldyh1bml0OiBDb21waWxhdGlvblVuaXQpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1cGRhdGVPcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKHVwZGF0ZU9wLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhwci5raW5kICE9PSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChmbGFncyAmIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHBpcGUgYmluZGluZ3Mgc2hvdWxkIG5vdCBhcHBlYXIgaW4gY2hpbGQgZXhwcmVzc2lvbnNgKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyB1cGRhdGUgb3AgbXVzdCBiZSBhc3NvY2lhdGVkIHdpdGggYSBjcmVhdGUgb3AgdGhhdCBjb25zdW1lcyBhIHNsb3QgKGVpdGhlciBieVxuICAgICAgLy8gZGVwZW5kaW5nIG9uIHRoZSBhbWJpZW50IGNvbnRleHQgb2YgYHRhcmdldGAsIG9yIG1lcmVseSByZWZlcmVuY2luZyB0aGF0IGNyZWF0ZSBvcCB2aWFcbiAgICAgIC8vIGB0YXJnZXRgKS5cbiAgICAgIGlmICghaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdCh1cGRhdGVPcCkgJiZcbiAgICAgICAgICAhaXIuaGFzVXNlc1Nsb3RJbmRleFRyYWl0PGlyLlVwZGF0ZU9wPih1cGRhdGVPcCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogcGlwZSBiaW5kaW5nIGFzc29jaWF0ZWQgd2l0aCBub24tc2xvdCBvcGVyYXRpb24gJHtcbiAgICAgICAgICAgIGlyLk9wS2luZFt1cGRhdGVPcC5raW5kXX1gKTtcbiAgICAgIH1cblxuICAgICAgYWRkUGlwZVRvQ3JlYXRpb25CbG9jayh1bml0LCB1cGRhdGVPcC50YXJnZXQsIGV4cHIpO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFBpcGVUb0NyZWF0aW9uQmxvY2soXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBhZnRlclRhcmdldFhyZWY6IGlyLlhyZWZJZCwgYmluZGluZzogaXIuUGlwZUJpbmRpbmdFeHByKTogdm9pZCB7XG4gIC8vIEZpbmQgdGhlIGFwcHJvcHJpYXRlIHBvaW50IHRvIGluc2VydCB0aGUgUGlwZSBjcmVhdGlvbiBvcGVyYXRpb24uXG4gIC8vIFdlJ3JlIGxvb2tpbmcgZm9yIGBhZnRlclRhcmdldFhyZWZgIChhbmQgYWxzbyB3YW50IHRvIGluc2VydCBhZnRlciBhbnkgb3RoZXIgcGlwZSBvcGVyYXRpb25zXG4gIC8vIHdoaWNoIG1pZ2h0IGJlIGJleW9uZCBpdCkuXG4gIGZvciAobGV0IG9wID0gdW5pdC5jcmVhdGUuaGVhZC5uZXh0ITsgb3Aua2luZCAhPT0gaXIuT3BLaW5kLkxpc3RFbmQ7IG9wID0gb3AubmV4dCEpIHtcbiAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0PGlyLkNyZWF0ZU9wPihvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChvcC54cmVmICE9PSBhZnRlclRhcmdldFhyZWYpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFdlJ3ZlIGZvdW5kIGEgdGVudGF0aXZlIGluc2VydGlvbiBwb2ludDsgaG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHNraXAgcGFzdCBhbnkgX290aGVyXyBwaXBlXG4gICAgLy8gb3BlcmF0aW9ucyBwcmVzZW50LlxuICAgIHdoaWxlIChvcC5uZXh0IS5raW5kID09PSBpci5PcEtpbmQuUGlwZSkge1xuICAgICAgb3AgPSBvcC5uZXh0ITtcbiAgICB9XG5cbiAgICBjb25zdCBwaXBlID0gaXIuY3JlYXRlUGlwZU9wKGJpbmRpbmcudGFyZ2V0LCBiaW5kaW5nLm5hbWUpIGFzIGlyLkNyZWF0ZU9wO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUocGlwZSwgb3AubmV4dCEpO1xuXG4gICAgLy8gVGhpcyBjb21wbGV0ZXMgYWRkaW5nIHRoZSBwaXBlIHRvIHRoZSBjcmVhdGlvbiBibG9jay5cbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50LCB3ZSd2ZSBmYWlsZWQgdG8gYWRkIHRoZSBwaXBlIHRvIHRoZSBjcmVhdGlvbiBibG9jay5cbiAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5hYmxlIHRvIGZpbmQgaW5zZXJ0aW9uIHBvaW50IGZvciBwaXBlICR7YmluZGluZy5uYW1lfWApO1xufVxuIl19