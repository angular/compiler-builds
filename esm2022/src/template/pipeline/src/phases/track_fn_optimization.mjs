/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import { Identifiers } from '../../../../render3/r3_identifiers';
import * as ir from '../../ir';
export function phaseTrackFnOptimization(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.RepeaterCreate) {
                continue;
            }
            if (op.track instanceof o.ReadVarExpr && op.track.name === '$index') {
                // Top-level access of `$index` uses the built in `repeaterTrackByIndex`.
                op.trackByFn = o.importExpr(Identifiers.repeaterTrackByIndex);
            }
            else if (op.track instanceof o.ReadVarExpr && op.track.name === '$item') {
                // Top-level access of the item uses the built in `repeaterTrackByIdentity`.
                op.trackByFn = o.importExpr(Identifiers.repeaterTrackByIdentity);
            }
            else if (isTrackByFunctionCall(job.root.xref, op.track)) {
                // Top-level method calls in the form of `fn($index, item)` can be passed in directly.
                if (op.track.receiver.receiver.view === unit.xref) {
                    // TODO: this may be wrong
                    op.trackByFn = op.track.receiver;
                }
                else {
                    // This is a plain method call, but not in the component's root view.
                    // We need to get the component instance, and then call the method on it.
                    op.trackByFn =
                        o.importExpr(Identifiers.componentInstance).callFn([]).prop(op.track.receiver.name);
                    // Because the context is not avaiable (without a special function), we don't want to
                    // try to resolve it later. Let's get rid of it by overwriting the original track
                    // expression (which won't be used anyway).
                    op.track = op.trackByFn;
                }
            }
            else {
                // The track function could not be optimized.
                // Replace context reads with a special IR expression, since context reads in a track
                // function are emitted specially.
                op.track = ir.transformExpressionsInExpression(op.track, expr => {
                    if (expr instanceof ir.ContextExpr) {
                        op.usesComponentInstance = true;
                        return new ir.TrackContextExpr(expr.view);
                    }
                    return expr;
                }, ir.VisitorContextFlag.None);
            }
        }
    }
}
function isTrackByFunctionCall(rootView, expr) {
    if (!(expr instanceof o.InvokeFunctionExpr) || expr.args.length !== 2) {
        return false;
    }
    if (!(expr.receiver instanceof o.ReadPropExpr &&
        expr.receiver.receiver instanceof ir.ContextExpr) ||
        expr.receiver.receiver.view !== rootView) {
        return false;
    }
    const [arg0, arg1] = expr.args;
    if (!(arg0 instanceof o.ReadVarExpr) || arg0.name !== '$index') {
        return false;
    }
    if (!(arg1 instanceof o.ReadVarExpr) || arg1.name !== '$item') {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tfZm5fb3B0aW1pemF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdHJhY2tfZm5fb3B0aW1pemF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9CLE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUFtQjtJQUMxRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtnQkFDeEMsU0FBUzthQUNWO1lBQ0QsSUFBSSxFQUFFLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNuRSx5RUFBeUU7Z0JBQ3pFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQzthQUMvRDtpQkFBTSxJQUFJLEVBQUUsQ0FBQyxLQUFLLFlBQVksQ0FBQyxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7Z0JBQ3pFLDRFQUE0RTtnQkFDNUUsRUFBRSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2FBQ2xFO2lCQUFNLElBQUkscUJBQXFCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN6RCxzRkFBc0Y7Z0JBQ3RGLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUNqRCwwQkFBMEI7b0JBQzFCLEVBQUUsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7aUJBQ2xDO3FCQUFNO29CQUNMLHFFQUFxRTtvQkFDckUseUVBQXlFO29CQUN6RSxFQUFFLENBQUMsU0FBUzt3QkFDUixDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3hGLHFGQUFxRjtvQkFDckYsaUZBQWlGO29CQUNqRiwyQ0FBMkM7b0JBQzNDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQztpQkFDekI7YUFDRjtpQkFBTTtnQkFDTCw2Q0FBNkM7Z0JBQzdDLHFGQUFxRjtnQkFDckYsa0NBQWtDO2dCQUNsQyxFQUFFLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO29CQUM5RCxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsV0FBVyxFQUFFO3dCQUNsQyxFQUFFLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDO3dCQUNoQyxPQUFPLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDM0M7b0JBQ0QsT0FBTyxJQUFJLENBQUM7Z0JBQ2QsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNoQztTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDMUIsUUFBbUIsRUFBRSxJQUFrQjtJQU16QyxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3JFLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxZQUFZLENBQUMsQ0FBQyxZQUFZO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxZQUFZLEVBQUUsQ0FBQyxXQUFXLENBQUM7UUFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtRQUM1QyxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQy9CLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDOUQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7UUFDN0QsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlVHJhY2tGbk9wdGltaXphdGlvbihqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnRyYWNrIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciAmJiBvcC50cmFjay5uYW1lID09PSAnJGluZGV4Jykge1xuICAgICAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIGAkaW5kZXhgIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJbmRleGAuXG4gICAgICAgIG9wLnRyYWNrQnlGbiA9IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXBlYXRlclRyYWNrQnlJbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKG9wLnRyYWNrIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciAmJiBvcC50cmFjay5uYW1lID09PSAnJGl0ZW0nKSB7XG4gICAgICAgIC8vIFRvcC1sZXZlbCBhY2Nlc3Mgb2YgdGhlIGl0ZW0gdXNlcyB0aGUgYnVpbHQgaW4gYHJlcGVhdGVyVHJhY2tCeUlkZW50aXR5YC5cbiAgICAgICAgb3AudHJhY2tCeUZuID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlcGVhdGVyVHJhY2tCeUlkZW50aXR5KTtcbiAgICAgIH0gZWxzZSBpZiAoaXNUcmFja0J5RnVuY3Rpb25DYWxsKGpvYi5yb290LnhyZWYsIG9wLnRyYWNrKSkge1xuICAgICAgICAvLyBUb3AtbGV2ZWwgbWV0aG9kIGNhbGxzIGluIHRoZSBmb3JtIG9mIGBmbigkaW5kZXgsIGl0ZW0pYCBjYW4gYmUgcGFzc2VkIGluIGRpcmVjdGx5LlxuICAgICAgICBpZiAob3AudHJhY2sucmVjZWl2ZXIucmVjZWl2ZXIudmlldyA9PT0gdW5pdC54cmVmKSB7XG4gICAgICAgICAgLy8gVE9ETzogdGhpcyBtYXkgYmUgd3JvbmdcbiAgICAgICAgICBvcC50cmFja0J5Rm4gPSBvcC50cmFjay5yZWNlaXZlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgcGxhaW4gbWV0aG9kIGNhbGwsIGJ1dCBub3QgaW4gdGhlIGNvbXBvbmVudCdzIHJvb3Qgdmlldy5cbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIGdldCB0aGUgY29tcG9uZW50IGluc3RhbmNlLCBhbmQgdGhlbiBjYWxsIHRoZSBtZXRob2Qgb24gaXQuXG4gICAgICAgICAgb3AudHJhY2tCeUZuID1cbiAgICAgICAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmNvbXBvbmVudEluc3RhbmNlKS5jYWxsRm4oW10pLnByb3Aob3AudHJhY2sucmVjZWl2ZXIubmFtZSk7XG4gICAgICAgICAgLy8gQmVjYXVzZSB0aGUgY29udGV4dCBpcyBub3QgYXZhaWFibGUgKHdpdGhvdXQgYSBzcGVjaWFsIGZ1bmN0aW9uKSwgd2UgZG9uJ3Qgd2FudCB0b1xuICAgICAgICAgIC8vIHRyeSB0byByZXNvbHZlIGl0IGxhdGVyLiBMZXQncyBnZXQgcmlkIG9mIGl0IGJ5IG92ZXJ3cml0aW5nIHRoZSBvcmlnaW5hbCB0cmFja1xuICAgICAgICAgIC8vIGV4cHJlc3Npb24gKHdoaWNoIHdvbid0IGJlIHVzZWQgYW55d2F5KS5cbiAgICAgICAgICBvcC50cmFjayA9IG9wLnRyYWNrQnlGbjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIHRyYWNrIGZ1bmN0aW9uIGNvdWxkIG5vdCBiZSBvcHRpbWl6ZWQuXG4gICAgICAgIC8vIFJlcGxhY2UgY29udGV4dCByZWFkcyB3aXRoIGEgc3BlY2lhbCBJUiBleHByZXNzaW9uLCBzaW5jZSBjb250ZXh0IHJlYWRzIGluIGEgdHJhY2tcbiAgICAgICAgLy8gZnVuY3Rpb24gYXJlIGVtaXR0ZWQgc3BlY2lhbGx5LlxuICAgICAgICBvcC50cmFjayA9IGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnRyYWNrLCBleHByID0+IHtcbiAgICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLkNvbnRleHRFeHByKSB7XG4gICAgICAgICAgICBvcC51c2VzQ29tcG9uZW50SW5zdGFuY2UgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBpci5UcmFja0NvbnRleHRFeHByKGV4cHIudmlldyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzVHJhY2tCeUZ1bmN0aW9uQ2FsbChcbiAgICByb290VmlldzogaXIuWHJlZklkLCBleHByOiBvLkV4cHJlc3Npb24pOiBleHByIGlzIG8uSW52b2tlRnVuY3Rpb25FeHByJntcbiAgcmVjZWl2ZXI6IG8uUmVhZFByb3BFeHByICZcbiAgICAgIHtcbiAgICAgICAgcmVjZWl2ZXI6IGlyLkNvbnRleHRFeHByXG4gICAgICB9XG59IHtcbiAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB8fCBleHByLmFyZ3MubGVuZ3RoICE9PSAyKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCEoZXhwci5yZWNlaXZlciBpbnN0YW5jZW9mIG8uUmVhZFByb3BFeHByICYmXG4gICAgICAgIGV4cHIucmVjZWl2ZXIucmVjZWl2ZXIgaW5zdGFuY2VvZiBpci5Db250ZXh0RXhwcikgfHxcbiAgICAgIGV4cHIucmVjZWl2ZXIucmVjZWl2ZXIudmlldyAhPT0gcm9vdFZpZXcpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBbYXJnMCwgYXJnMV0gPSBleHByLmFyZ3M7XG4gIGlmICghKGFyZzAgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByKSB8fCBhcmcwLm5hbWUgIT09ICckaW5kZXgnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICghKGFyZzEgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByKSB8fCBhcmcxLm5hbWUgIT09ICckaXRlbScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG4iXX0=