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
            if (unit.job.compatibility) {
                addPipeToCreationBlock(unit, updateOp.target, expr);
            }
            else {
                // When not in compatibility mode, we just add the pipe to the end of the create block. This
                // is not only simpler and faster, but allows more chaining opportunities for other
                // instructions.
                unit.create.push(ir.createPipeOp(expr.target, expr.name));
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9jcmVhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BpcGVfY3JlYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQW1CO0lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1Qix5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLElBQXFCO0lBQ3RELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNsQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ2hELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixPQUFPO2FBQ1I7WUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUU7Z0JBQy9DLE9BQU87YUFDUjtZQUVELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO2FBQ3pGO1lBRUQscUZBQXFGO1lBQ3JGLHlGQUF5RjtZQUN6RixhQUFhO1lBQ2IsSUFBSSxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLENBQUM7Z0JBQzFDLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFjLFFBQVEsQ0FBQyxFQUFFO2dCQUNwRCxNQUFNLElBQUksS0FBSyxDQUFDLG1FQUNaLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNqQztZQUVELElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUU7Z0JBQzFCLHNCQUFzQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3JEO2lCQUFNO2dCQUNMLDRGQUE0RjtnQkFDNUYsbUZBQW1GO2dCQUNuRixnQkFBZ0I7Z0JBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUMzRDtRQUNILENBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFDSCxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FDM0IsSUFBcUIsRUFBRSxlQUEwQixFQUFFLE9BQTJCO0lBQ2hGLG9FQUFvRTtJQUNwRSwrRkFBK0Y7SUFDL0YsNkJBQTZCO0lBQzdCLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFLLEVBQUU7UUFDbEYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBYyxFQUFFLENBQUMsRUFBRTtZQUM3QyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssZUFBZSxFQUFFO1lBQy9CLFNBQVM7U0FDVjtRQUVELCtGQUErRjtRQUMvRixzQkFBc0I7UUFDdEIsT0FBTyxFQUFFLENBQUMsSUFBSyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUN2QyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUssQ0FBQztTQUNmO1FBRUQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQWdCLENBQUM7UUFDMUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFLLENBQUMsQ0FBQztRQUV2Qyx3REFBd0Q7UUFDeEQsT0FBTztLQUNSO0lBRUQscUVBQXFFO0lBQ3JFLE1BQU0sSUFBSSxLQUFLLENBQUMsMkRBQTJELE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzdGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9iLCBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUGlwZUNyZWF0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIHByb2Nlc3NQaXBlQmluZGluZ3NJblZpZXcodW5pdCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1BpcGVCaW5kaW5nc0luVmlldyh1bml0OiBDb21waWxhdGlvblVuaXQpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1cGRhdGVPcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKHVwZGF0ZU9wLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhwci5raW5kICE9PSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChmbGFncyAmIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHBpcGUgYmluZGluZ3Mgc2hvdWxkIG5vdCBhcHBlYXIgaW4gY2hpbGQgZXhwcmVzc2lvbnNgKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyB1cGRhdGUgb3AgbXVzdCBiZSBhc3NvY2lhdGVkIHdpdGggYSBjcmVhdGUgb3AgdGhhdCBjb25zdW1lcyBhIHNsb3QgKGVpdGhlciBieVxuICAgICAgLy8gZGVwZW5kaW5nIG9uIHRoZSBhbWJpZW50IGNvbnRleHQgb2YgYHRhcmdldGAsIG9yIG1lcmVseSByZWZlcmVuY2luZyB0aGF0IGNyZWF0ZSBvcCB2aWFcbiAgICAgIC8vIGB0YXJnZXRgKS5cbiAgICAgIGlmICghaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdCh1cGRhdGVPcCkgJiZcbiAgICAgICAgICAhaXIuaGFzVXNlc1Nsb3RJbmRleFRyYWl0PGlyLlVwZGF0ZU9wPih1cGRhdGVPcCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogcGlwZSBiaW5kaW5nIGFzc29jaWF0ZWQgd2l0aCBub24tc2xvdCBvcGVyYXRpb24gJHtcbiAgICAgICAgICAgIGlyLk9wS2luZFt1cGRhdGVPcC5raW5kXX1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVuaXQuam9iLmNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgYWRkUGlwZVRvQ3JlYXRpb25CbG9jayh1bml0LCB1cGRhdGVPcC50YXJnZXQsIGV4cHIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2hlbiBub3QgaW4gY29tcGF0aWJpbGl0eSBtb2RlLCB3ZSBqdXN0IGFkZCB0aGUgcGlwZSB0byB0aGUgZW5kIG9mIHRoZSBjcmVhdGUgYmxvY2suIFRoaXNcbiAgICAgICAgLy8gaXMgbm90IG9ubHkgc2ltcGxlciBhbmQgZmFzdGVyLCBidXQgYWxsb3dzIG1vcmUgY2hhaW5pbmcgb3Bwb3J0dW5pdGllcyBmb3Igb3RoZXJcbiAgICAgICAgLy8gaW5zdHJ1Y3Rpb25zLlxuICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZVBpcGVPcChleHByLnRhcmdldCwgZXhwci5uYW1lKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUGlwZVRvQ3JlYXRpb25CbG9jayhcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIGFmdGVyVGFyZ2V0WHJlZjogaXIuWHJlZklkLCBiaW5kaW5nOiBpci5QaXBlQmluZGluZ0V4cHIpOiB2b2lkIHtcbiAgLy8gRmluZCB0aGUgYXBwcm9wcmlhdGUgcG9pbnQgdG8gaW5zZXJ0IHRoZSBQaXBlIGNyZWF0aW9uIG9wZXJhdGlvbi5cbiAgLy8gV2UncmUgbG9va2luZyBmb3IgYGFmdGVyVGFyZ2V0WHJlZmAgKGFuZCBhbHNvIHdhbnQgdG8gaW5zZXJ0IGFmdGVyIGFueSBvdGhlciBwaXBlIG9wZXJhdGlvbnNcbiAgLy8gd2hpY2ggbWlnaHQgYmUgYmV5b25kIGl0KS5cbiAgZm9yIChsZXQgb3AgPSB1bml0LmNyZWF0ZS5oZWFkLm5leHQhOyBvcC5raW5kICE9PSBpci5PcEtpbmQuTGlzdEVuZDsgb3AgPSBvcC5uZXh0ISkge1xuICAgIGlmICghaXIuaGFzQ29uc3VtZXNTbG90VHJhaXQ8aXIuQ3JlYXRlT3A+KG9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKG9wLnhyZWYgIT09IGFmdGVyVGFyZ2V0WHJlZikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gV2UndmUgZm91bmQgYSB0ZW50YXRpdmUgaW5zZXJ0aW9uIHBvaW50OyBob3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc2tpcCBwYXN0IGFueSBfb3RoZXJfIHBpcGVcbiAgICAvLyBvcGVyYXRpb25zIHByZXNlbnQuXG4gICAgd2hpbGUgKG9wLm5leHQhLmtpbmQgPT09IGlyLk9wS2luZC5QaXBlKSB7XG4gICAgICBvcCA9IG9wLm5leHQhO1xuICAgIH1cblxuICAgIGNvbnN0IHBpcGUgPSBpci5jcmVhdGVQaXBlT3AoYmluZGluZy50YXJnZXQsIGJpbmRpbmcubmFtZSkgYXMgaXIuQ3JlYXRlT3A7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShwaXBlLCBvcC5uZXh0ISk7XG5cbiAgICAvLyBUaGlzIGNvbXBsZXRlcyBhZGRpbmcgdGhlIHBpcGUgdG8gdGhlIGNyZWF0aW9uIGJsb2NrLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQsIHdlJ3ZlIGZhaWxlZCB0byBhZGQgdGhlIHBpcGUgdG8gdGhlIGNyZWF0aW9uIGJsb2NrLlxuICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gZmluZCBpbnNlcnRpb24gcG9pbnQgZm9yIHBpcGUgJHtiaW5kaW5nLm5hbWV9YCk7XG59XG4iXX0=