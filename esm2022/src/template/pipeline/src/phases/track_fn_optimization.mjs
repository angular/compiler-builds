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
/**
 * `track` functions in `for` repeaters can sometimes be "optimized," i.e. transformed into inline
 * expressions, in lieu of an external function call. For example, tracking by `$index` can be be
 * optimized into an inline `trackByIndex` reference. This phase checks track expressions for
 * optimizable cases.
 */
export function optimizeTrackFns(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tfZm5fb3B0aW1pemF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdHJhY2tfZm5fb3B0aW1pemF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBSS9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUFDLEdBQW1CO0lBQ2xELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN6QyxTQUFTO1lBQ1gsQ0FBQztZQUNELElBQUksRUFBRSxDQUFDLEtBQUssWUFBWSxDQUFDLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUNwRSx5RUFBeUU7Z0JBQ3pFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUNoRSxDQUFDO2lCQUFNLElBQUksRUFBRSxDQUFDLEtBQUssWUFBWSxDQUFDLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO2dCQUMxRSw0RUFBNEU7Z0JBQzVFLEVBQUUsQ0FBQyxTQUFT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b3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogYHRyYWNrYCBmdW5jdGlvbnMgaW4gYGZvcmAgcmVwZWF0ZXJzIGNhbiBzb21ldGltZXMgYmUgXCJvcHRpbWl6ZWQsXCIgaS5lLiB0cmFuc2Zvcm1lZCBpbnRvIGlubGluZVxuICogZXhwcmVzc2lvbnMsIGluIGxpZXUgb2YgYW4gZXh0ZXJuYWwgZnVuY3Rpb24gY2FsbC4gRm9yIGV4YW1wbGUsIHRyYWNraW5nIGJ5IGAkaW5kZXhgIGNhbiBiZSBiZVxuICogb3B0aW1pemVkIGludG8gYW4gaW5saW5lIGB0cmFja0J5SW5kZXhgIHJlZmVyZW5jZS4gVGhpcyBwaGFzZSBjaGVja3MgdHJhY2sgZXhwcmVzc2lvbnMgZm9yXG4gKiBvcHRpbWl6YWJsZSBjYXNlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9wdGltaXplVHJhY2tGbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC50cmFjayBpbnN0YW5jZW9mIG8uUmVhZFZhckV4cHIgJiYgb3AudHJhY2submFtZSA9PT0gJyRpbmRleCcpIHtcbiAgICAgICAgLy8gVG9wLWxldmVsIGFjY2VzcyBvZiBgJGluZGV4YCB1c2VzIHRoZSBidWlsdCBpbiBgcmVwZWF0ZXJUcmFja0J5SW5kZXhgLlxuICAgICAgICBvcC50cmFja0J5Rm4gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVwZWF0ZXJUcmFja0J5SW5kZXgpO1xuICAgICAgfSBlbHNlIGlmIChvcC50cmFjayBpbnN0YW5jZW9mIG8uUmVhZFZhckV4cHIgJiYgb3AudHJhY2submFtZSA9PT0gJyRpdGVtJykge1xuICAgICAgICAvLyBUb3AtbGV2ZWwgYWNjZXNzIG9mIHRoZSBpdGVtIHVzZXMgdGhlIGJ1aWx0IGluIGByZXBlYXRlclRyYWNrQnlJZGVudGl0eWAuXG4gICAgICAgIG9wLnRyYWNrQnlGbiA9IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXBlYXRlclRyYWNrQnlJZGVudGl0eSk7XG4gICAgICB9IGVsc2UgaWYgKGlzVHJhY2tCeUZ1bmN0aW9uQ2FsbChqb2Iucm9vdC54cmVmLCBvcC50cmFjaykpIHtcbiAgICAgICAgLy8gVG9wLWxldmVsIG1ldGhvZCBjYWxscyBpbiB0aGUgZm9ybSBvZiBgZm4oJGluZGV4LCBpdGVtKWAgY2FuIGJlIHBhc3NlZCBpbiBkaXJlY3RseS5cbiAgICAgICAgaWYgKG9wLnRyYWNrLnJlY2VpdmVyLnJlY2VpdmVyLnZpZXcgPT09IHVuaXQueHJlZikge1xuICAgICAgICAgIC8vIFRPRE86IHRoaXMgbWF5IGJlIHdyb25nXG4gICAgICAgICAgb3AudHJhY2tCeUZuID0gb3AudHJhY2sucmVjZWl2ZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBhIHBsYWluIG1ldGhvZCBjYWxsLCBidXQgbm90IGluIHRoZSBjb21wb25lbnQncyByb290IHZpZXcuXG4gICAgICAgICAgLy8gV2UgbmVlZCB0byBnZXQgdGhlIGNvbXBvbmVudCBpbnN0YW5jZSwgYW5kIHRoZW4gY2FsbCB0aGUgbWV0aG9kIG9uIGl0LlxuICAgICAgICAgIG9wLnRyYWNrQnlGbiA9XG4gICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5jb21wb25lbnRJbnN0YW5jZSkuY2FsbEZuKFtdKS5wcm9wKG9wLnRyYWNrLnJlY2VpdmVyLm5hbWUpO1xuICAgICAgICAgIC8vIEJlY2F1c2UgdGhlIGNvbnRleHQgaXMgbm90IGF2YWlhYmxlICh3aXRob3V0IGEgc3BlY2lhbCBmdW5jdGlvbiksIHdlIGRvbid0IHdhbnQgdG9cbiAgICAgICAgICAvLyB0cnkgdG8gcmVzb2x2ZSBpdCBsYXRlci4gTGV0J3MgZ2V0IHJpZCBvZiBpdCBieSBvdmVyd3JpdGluZyB0aGUgb3JpZ2luYWwgdHJhY2tcbiAgICAgICAgICAvLyBleHByZXNzaW9uICh3aGljaCB3b24ndCBiZSB1c2VkIGFueXdheSkuXG4gICAgICAgICAgb3AudHJhY2sgPSBvcC50cmFja0J5Rm47XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSB0cmFjayBmdW5jdGlvbiBjb3VsZCBub3QgYmUgb3B0aW1pemVkLlxuICAgICAgICAvLyBSZXBsYWNlIGNvbnRleHQgcmVhZHMgd2l0aCBhIHNwZWNpYWwgSVIgZXhwcmVzc2lvbiwgc2luY2UgY29udGV4dCByZWFkcyBpbiBhIHRyYWNrXG4gICAgICAgIC8vIGZ1bmN0aW9uIGFyZSBlbWl0dGVkIHNwZWNpYWxseS5cbiAgICAgICAgb3AudHJhY2sgPSBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC50cmFjaywgZXhwciA9PiB7XG4gICAgICAgICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5Db250ZXh0RXhwcikge1xuICAgICAgICAgICAgb3AudXNlc0NvbXBvbmVudEluc3RhbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgaXIuVHJhY2tDb250ZXh0RXhwcihleHByLnZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc1RyYWNrQnlGdW5jdGlvbkNhbGwoXG4gICAgcm9vdFZpZXc6IGlyLlhyZWZJZCwgZXhwcjogby5FeHByZXNzaW9uKTogZXhwciBpcyBvLkludm9rZUZ1bmN0aW9uRXhwciZ7XG4gIHJlY2VpdmVyOiBvLlJlYWRQcm9wRXhwciAmXG4gICAgICB7XG4gICAgICAgIHJlY2VpdmVyOiBpci5Db250ZXh0RXhwclxuICAgICAgfVxufSB7XG4gIGlmICghKGV4cHIgaW5zdGFuY2VvZiBvLkludm9rZUZ1bmN0aW9uRXhwcikgfHwgZXhwci5hcmdzLmxlbmd0aCAhPT0gMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghKGV4cHIucmVjZWl2ZXIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwciAmJlxuICAgICAgICBleHByLnJlY2VpdmVyLnJlY2VpdmVyIGluc3RhbmNlb2YgaXIuQ29udGV4dEV4cHIpIHx8XG4gICAgICBleHByLnJlY2VpdmVyLnJlY2VpdmVyLnZpZXcgIT09IHJvb3RWaWV3KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgW2FyZzAsIGFyZzFdID0gZXhwci5hcmdzO1xuICBpZiAoIShhcmcwIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwcikgfHwgYXJnMC5uYW1lICE9PSAnJGluZGV4Jykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoIShhcmcxIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwcikgfHwgYXJnMS5uYW1lICE9PSAnJGl0ZW0nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuIl19