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
 * Generate track functions that need to be extracted to the constant pool. This entails wrapping
 * them in an arrow (or traditional) function, replacing context reads with `this.`, and storing
 * them in the constant pool.
 *
 * Note that, if a track function was previously optimized, it will not need to be extracted, and
 * this phase is a no-op.
 */
export function phaseTrackFnGeneration(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.RepeaterCreate) {
                continue;
            }
            if (op.trackByFn !== null) {
                // The final track function was already set, probably because it was optimized.
                continue;
            }
            // Find all component context reads.
            let usesComponentContext = false;
            op.track = ir.transformExpressionsInExpression(op.track, expr => {
                if (expr instanceof ir.TrackContextExpr) {
                    usesComponentContext = true;
                    return o.variable('this');
                }
                return expr;
            }, ir.VisitorContextFlag.None);
            let fn;
            const fnParams = [new o.FnParam('$index'), new o.FnParam('$item')];
            if (usesComponentContext) {
                fn = new o.FunctionExpr(fnParams, [new o.ReturnStatement(op.track)]);
            }
            else {
                fn = o.arrowFn(fnParams, op.track);
            }
            op.trackByFn = job.pool.getSharedFunctionReference(fn, '_forTrack');
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tfZm5fZ2VuZXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3RyYWNrX2ZuX2dlbmVyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUVuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQjs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEdBQW1CO0lBQ3hELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUN4QyxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO2dCQUN6QiwrRUFBK0U7Z0JBQy9FLFNBQVM7YUFDVjtZQUVELG9DQUFvQztZQUNwQyxJQUFJLG9CQUFvQixHQUFHLEtBQUssQ0FBQztZQUNqQyxFQUFFLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUM5RCxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZ0JBQWdCLEVBQUU7b0JBQ3ZDLG9CQUFvQixHQUFHLElBQUksQ0FBQztvQkFDNUIsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUMzQjtnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFL0IsSUFBSSxFQUFzQyxDQUFDO1lBRTNDLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ25FLElBQUksb0JBQW9CLEVBQUU7Z0JBQ3hCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdEU7aUJBQU07Z0JBQ0wsRUFBRSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNwQztZQUVELEVBQUUsQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7U0FDckU7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcblxuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgdHJhY2sgZnVuY3Rpb25zIHRoYXQgbmVlZCB0byBiZSBleHRyYWN0ZWQgdG8gdGhlIGNvbnN0YW50IHBvb2wuIFRoaXMgZW50YWlscyB3cmFwcGluZ1xuICogdGhlbSBpbiBhbiBhcnJvdyAob3IgdHJhZGl0aW9uYWwpIGZ1bmN0aW9uLCByZXBsYWNpbmcgY29udGV4dCByZWFkcyB3aXRoIGB0aGlzLmAsIGFuZCBzdG9yaW5nXG4gKiB0aGVtIGluIHRoZSBjb25zdGFudCBwb29sLlxuICpcbiAqIE5vdGUgdGhhdCwgaWYgYSB0cmFjayBmdW5jdGlvbiB3YXMgcHJldmlvdXNseSBvcHRpbWl6ZWQsIGl0IHdpbGwgbm90IG5lZWQgdG8gYmUgZXh0cmFjdGVkLCBhbmRcbiAqIHRoaXMgcGhhc2UgaXMgYSBuby1vcC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlVHJhY2tGbkdlbmVyYXRpb24oam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC50cmFja0J5Rm4gIT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhlIGZpbmFsIHRyYWNrIGZ1bmN0aW9uIHdhcyBhbHJlYWR5IHNldCwgcHJvYmFibHkgYmVjYXVzZSBpdCB3YXMgb3B0aW1pemVkLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gRmluZCBhbGwgY29tcG9uZW50IGNvbnRleHQgcmVhZHMuXG4gICAgICBsZXQgdXNlc0NvbXBvbmVudENvbnRleHQgPSBmYWxzZTtcbiAgICAgIG9wLnRyYWNrID0gaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AudHJhY2ssIGV4cHIgPT4ge1xuICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlRyYWNrQ29udGV4dEV4cHIpIHtcbiAgICAgICAgICB1c2VzQ29tcG9uZW50Q29udGV4dCA9IHRydWU7XG4gICAgICAgICAgcmV0dXJuIG8udmFyaWFibGUoJ3RoaXMnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgICAgbGV0IGZuOiBvLkZ1bmN0aW9uRXhwcnxvLkFycm93RnVuY3Rpb25FeHByO1xuXG4gICAgICBjb25zdCBmblBhcmFtcyA9IFtuZXcgby5GblBhcmFtKCckaW5kZXgnKSwgbmV3IG8uRm5QYXJhbSgnJGl0ZW0nKV07XG4gICAgICBpZiAodXNlc0NvbXBvbmVudENvbnRleHQpIHtcbiAgICAgICAgZm4gPSBuZXcgby5GdW5jdGlvbkV4cHIoZm5QYXJhbXMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQob3AudHJhY2spXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbiA9IG8uYXJyb3dGbihmblBhcmFtcywgb3AudHJhY2spO1xuICAgICAgfVxuXG4gICAgICBvcC50cmFja0J5Rm4gPSBqb2IucG9vbC5nZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShmbiwgJ19mb3JUcmFjaycpO1xuICAgIH1cbiAgfVxufVxuIl19