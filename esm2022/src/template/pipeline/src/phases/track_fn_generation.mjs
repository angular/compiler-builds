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
export function generateTrackFns(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tfZm5fZ2VuZXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3RyYWNrX2ZuX2dlbmVyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQjs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUFDLEdBQW1CO0lBQ2xELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN6QyxTQUFTO1lBQ1gsQ0FBQztZQUNELElBQUksRUFBRSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDMUIsK0VBQStFO2dCQUMvRSxTQUFTO1lBQ1gsQ0FBQztZQUVELG9DQUFvQztZQUNwQyxJQUFJLG9CQUFvQixHQUFHLEtBQUssQ0FBQztZQUNqQyxFQUFFLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUM5RCxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDeEMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO29CQUM1QixPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzVCLENBQUM7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRS9CLElBQUksRUFBc0MsQ0FBQztZQUUzQyxNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNuRSxJQUFJLG9CQUFvQixFQUFFLENBQUM7Z0JBQ3pCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkUsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEVBQUUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckMsQ0FBQztZQUVELEVBQUUsQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdEUsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBHZW5lcmF0ZSB0cmFjayBmdW5jdGlvbnMgdGhhdCBuZWVkIHRvIGJlIGV4dHJhY3RlZCB0byB0aGUgY29uc3RhbnQgcG9vbC4gVGhpcyBlbnRhaWxzIHdyYXBwaW5nXG4gKiB0aGVtIGluIGFuIGFycm93IChvciB0cmFkaXRpb25hbCkgZnVuY3Rpb24sIHJlcGxhY2luZyBjb250ZXh0IHJlYWRzIHdpdGggYHRoaXMuYCwgYW5kIHN0b3JpbmdcbiAqIHRoZW0gaW4gdGhlIGNvbnN0YW50IHBvb2wuXG4gKlxuICogTm90ZSB0aGF0LCBpZiBhIHRyYWNrIGZ1bmN0aW9uIHdhcyBwcmV2aW91c2x5IG9wdGltaXplZCwgaXQgd2lsbCBub3QgbmVlZCB0byBiZSBleHRyYWN0ZWQsIGFuZFxuICogdGhpcyBwaGFzZSBpcyBhIG5vLW9wLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUcmFja0Zucyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnRyYWNrQnlGbiAhPT0gbnVsbCkge1xuICAgICAgICAvLyBUaGUgZmluYWwgdHJhY2sgZnVuY3Rpb24gd2FzIGFscmVhZHkgc2V0LCBwcm9iYWJseSBiZWNhdXNlIGl0IHdhcyBvcHRpbWl6ZWQuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBGaW5kIGFsbCBjb21wb25lbnQgY29udGV4dCByZWFkcy5cbiAgICAgIGxldCB1c2VzQ29tcG9uZW50Q29udGV4dCA9IGZhbHNlO1xuICAgICAgb3AudHJhY2sgPSBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC50cmFjaywgZXhwciA9PiB7XG4gICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuVHJhY2tDb250ZXh0RXhwcikge1xuICAgICAgICAgIHVzZXNDb21wb25lbnRDb250ZXh0ID0gdHJ1ZTtcbiAgICAgICAgICByZXR1cm4gby52YXJpYWJsZSgndGhpcycpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuXG4gICAgICBsZXQgZm46IG8uRnVuY3Rpb25FeHByfG8uQXJyb3dGdW5jdGlvbkV4cHI7XG5cbiAgICAgIGNvbnN0IGZuUGFyYW1zID0gW25ldyBvLkZuUGFyYW0oJyRpbmRleCcpLCBuZXcgby5GblBhcmFtKCckaXRlbScpXTtcbiAgICAgIGlmICh1c2VzQ29tcG9uZW50Q29udGV4dCkge1xuICAgICAgICBmbiA9IG5ldyBvLkZ1bmN0aW9uRXhwcihmblBhcmFtcywgW25ldyBvLlJldHVyblN0YXRlbWVudChvcC50cmFjayldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuID0gby5hcnJvd0ZuKGZuUGFyYW1zLCBvcC50cmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9wLnRyYWNrQnlGbiA9IGpvYi5wb29sLmdldFNoYXJlZEZ1bmN0aW9uUmVmZXJlbmNlKGZuLCAnX2ZvclRyYWNrJyk7XG4gICAgfVxuICB9XG59XG4iXX0=