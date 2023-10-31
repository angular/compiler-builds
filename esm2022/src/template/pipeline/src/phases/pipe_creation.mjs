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
            if (unit.job.compatibility) {
                // TODO: We can delete this cast and check once compatibility mode is removed.
                const slotHandle = updateOp.target;
                if (slotHandle == undefined) {
                    throw new Error(`AssertionError: expected slot handle to be assigned for pipe creation`);
                }
                addPipeToCreationBlock(unit, updateOp.target, expr);
            }
            else {
                // When not in compatibility mode, we just add the pipe to the end of the create block. This
                // is not only simpler and faster, but allows more chaining opportunities for other
                // instructions.
                unit.create.push(ir.createPipeOp(expr.target, expr.targetSlot, expr.name));
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
        const pipe = ir.createPipeOp(binding.target, binding.targetSlot, binding.name);
        ir.OpList.insertBefore(pipe, op.next);
        // This completes adding the pipe to the creation block.
        return;
    }
    // At this point, we've failed to add the pipe to the creation block.
    throw new Error(`AssertionError: unable to find insertion point for pipe ${binding.name}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9jcmVhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BpcGVfY3JlYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQW1CO0lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1Qix5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLElBQXFCO0lBQ3RELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNsQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ2hELElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixPQUFPO2FBQ1I7WUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUU7Z0JBQy9DLE9BQU87YUFDUjtZQUVELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO2FBQ3pGO1lBRUQsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRTtnQkFDMUIsOEVBQThFO2dCQUM5RSxNQUFNLFVBQVUsR0FBSSxRQUFnQixDQUFDLE1BQU0sQ0FBQztnQkFDNUMsSUFBSSxVQUFVLElBQUksU0FBUyxFQUFFO29CQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLHVFQUF1RSxDQUFDLENBQUM7aUJBQzFGO2dCQUNELHNCQUFzQixDQUFDLElBQUksRUFBRyxRQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQzthQUM5RDtpQkFBTTtnQkFDTCw0RkFBNEY7Z0JBQzVGLG1GQUFtRjtnQkFDbkYsZ0JBQWdCO2dCQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUM1RTtRQUNILENBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFDSCxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FDM0IsSUFBcUIsRUFBRSxlQUEwQixFQUFFLE9BQTJCO0lBQ2hGLG9FQUFvRTtJQUNwRSwrRkFBK0Y7SUFDL0YsNkJBQTZCO0lBQzdCLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFLLEVBQUU7UUFDbEYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBYyxFQUFFLENBQUMsRUFBRTtZQUM3QyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssZUFBZSxFQUFFO1lBQy9CLFNBQVM7U0FDVjtRQUVELCtGQUErRjtRQUMvRixzQkFBc0I7UUFDdEIsT0FBTyxFQUFFLENBQUMsSUFBSyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUN2QyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUssQ0FBQztTQUNmO1FBRUQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBZ0IsQ0FBQztRQUM5RixFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUssQ0FBQyxDQUFDO1FBRXZDLHdEQUF3RDtRQUN4RCxPQUFPO0tBQ1I7SUFFRCxxRUFBcUU7SUFDckUsTUFBTSxJQUFJLEtBQUssQ0FBQywyREFBMkQsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7QUFDN0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VQaXBlQ3JlYXRpb24oam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgcHJvY2Vzc1BpcGVCaW5kaW5nc0luVmlldyh1bml0KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzUGlwZUJpbmRpbmdzSW5WaWV3KHVuaXQ6IENvbXBpbGF0aW9uVW5pdCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVwZGF0ZU9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3AodXBkYXRlT3AsIChleHByLCBmbGFncykgPT4ge1xuICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChleHByLmtpbmQgIT09IGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGZsYWdzICYgaXIuVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogcGlwZSBiaW5kaW5ncyBzaG91bGQgbm90IGFwcGVhciBpbiBjaGlsZCBleHByZXNzaW9uc2ApO1xuICAgICAgfVxuXG4gICAgICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAvLyBUT0RPOiBXZSBjYW4gZGVsZXRlIHRoaXMgY2FzdCBhbmQgY2hlY2sgb25jZSBjb21wYXRpYmlsaXR5IG1vZGUgaXMgcmVtb3ZlZC5cbiAgICAgICAgY29uc3Qgc2xvdEhhbmRsZSA9ICh1cGRhdGVPcCBhcyBhbnkpLnRhcmdldDtcbiAgICAgICAgaWYgKHNsb3RIYW5kbGUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgc2xvdCBoYW5kbGUgdG8gYmUgYXNzaWduZWQgZm9yIHBpcGUgY3JlYXRpb25gKTtcbiAgICAgICAgfVxuICAgICAgICBhZGRQaXBlVG9DcmVhdGlvbkJsb2NrKHVuaXQsICh1cGRhdGVPcCBhcyBhbnkpLnRhcmdldCwgZXhwcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXaGVuIG5vdCBpbiBjb21wYXRpYmlsaXR5IG1vZGUsIHdlIGp1c3QgYWRkIHRoZSBwaXBlIHRvIHRoZSBlbmQgb2YgdGhlIGNyZWF0ZSBibG9jay4gVGhpc1xuICAgICAgICAvLyBpcyBub3Qgb25seSBzaW1wbGVyIGFuZCBmYXN0ZXIsIGJ1dCBhbGxvd3MgbW9yZSBjaGFpbmluZyBvcHBvcnR1bml0aWVzIGZvciBvdGhlclxuICAgICAgICAvLyBpbnN0cnVjdGlvbnMuXG4gICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlUGlwZU9wKGV4cHIudGFyZ2V0LCBleHByLnRhcmdldFNsb3QsIGV4cHIubmFtZSkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFBpcGVUb0NyZWF0aW9uQmxvY2soXG4gICAgdW5pdDogQ29tcGlsYXRpb25Vbml0LCBhZnRlclRhcmdldFhyZWY6IGlyLlhyZWZJZCwgYmluZGluZzogaXIuUGlwZUJpbmRpbmdFeHByKTogdm9pZCB7XG4gIC8vIEZpbmQgdGhlIGFwcHJvcHJpYXRlIHBvaW50IHRvIGluc2VydCB0aGUgUGlwZSBjcmVhdGlvbiBvcGVyYXRpb24uXG4gIC8vIFdlJ3JlIGxvb2tpbmcgZm9yIGBhZnRlclRhcmdldFhyZWZgIChhbmQgYWxzbyB3YW50IHRvIGluc2VydCBhZnRlciBhbnkgb3RoZXIgcGlwZSBvcGVyYXRpb25zXG4gIC8vIHdoaWNoIG1pZ2h0IGJlIGJleW9uZCBpdCkuXG4gIGZvciAobGV0IG9wID0gdW5pdC5jcmVhdGUuaGVhZC5uZXh0ITsgb3Aua2luZCAhPT0gaXIuT3BLaW5kLkxpc3RFbmQ7IG9wID0gb3AubmV4dCEpIHtcbiAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0PGlyLkNyZWF0ZU9wPihvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChvcC54cmVmICE9PSBhZnRlclRhcmdldFhyZWYpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFdlJ3ZlIGZvdW5kIGEgdGVudGF0aXZlIGluc2VydGlvbiBwb2ludDsgaG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHNraXAgcGFzdCBhbnkgX290aGVyXyBwaXBlXG4gICAgLy8gb3BlcmF0aW9ucyBwcmVzZW50LlxuICAgIHdoaWxlIChvcC5uZXh0IS5raW5kID09PSBpci5PcEtpbmQuUGlwZSkge1xuICAgICAgb3AgPSBvcC5uZXh0ITtcbiAgICB9XG5cbiAgICBjb25zdCBwaXBlID0gaXIuY3JlYXRlUGlwZU9wKGJpbmRpbmcudGFyZ2V0LCBiaW5kaW5nLnRhcmdldFNsb3QsIGJpbmRpbmcubmFtZSkgYXMgaXIuQ3JlYXRlT3A7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShwaXBlLCBvcC5uZXh0ISk7XG5cbiAgICAvLyBUaGlzIGNvbXBsZXRlcyBhZGRpbmcgdGhlIHBpcGUgdG8gdGhlIGNyZWF0aW9uIGJsb2NrLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQsIHdlJ3ZlIGZhaWxlZCB0byBhZGQgdGhlIHBpcGUgdG8gdGhlIGNyZWF0aW9uIGJsb2NrLlxuICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gZmluZCBpbnNlcnRpb24gcG9pbnQgZm9yIHBpcGUgJHtiaW5kaW5nLm5hbWV9YCk7XG59XG4iXX0=