/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phaseTrackVariables(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.RepeaterCreate) {
                continue;
            }
            op.track = ir.transformExpressionsInExpression(op.track, expr => {
                if (expr instanceof ir.LexicalReadExpr) {
                    if (expr.name === op.varNames.$index) {
                        return o.variable('$index');
                    }
                    else if (expr.name === op.varNames.$implicit) {
                        return o.variable('$item');
                    }
                    // TODO: handle prohibited context variables (emit as globals?)
                }
                return expr;
            }, ir.VisitorContextFlag.None);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tfdmFyaWFibGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdHJhY2tfdmFyaWFibGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0IsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQW1CO0lBQ3JELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUN4QyxTQUFTO2FBQ1Y7WUFFRCxFQUFFLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUM5RCxJQUFJLElBQUksWUFBWSxFQUFFLENBQUMsZUFBZSxFQUFFO29CQUN0QyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUU7d0JBQ3BDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztxQkFDN0I7eUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFO3dCQUM5QyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7cUJBQzVCO29CQUVELCtEQUErRDtpQkFDaEU7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2hDO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlVHJhY2tWYXJpYWJsZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgb3AudHJhY2sgPSBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC50cmFjaywgZXhwciA9PiB7XG4gICAgICAgIGlmIChleHByIGluc3RhbmNlb2YgaXIuTGV4aWNhbFJlYWRFeHByKSB7XG4gICAgICAgICAgaWYgKGV4cHIubmFtZSA9PT0gb3AudmFyTmFtZXMuJGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gby52YXJpYWJsZSgnJGluZGV4Jyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChleHByLm5hbWUgPT09IG9wLnZhck5hbWVzLiRpbXBsaWNpdCkge1xuICAgICAgICAgICAgcmV0dXJuIG8udmFyaWFibGUoJyRpdGVtJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVE9ETzogaGFuZGxlIHByb2hpYml0ZWQgY29udGV4dCB2YXJpYWJsZXMgKGVtaXQgYXMgZ2xvYmFscz8pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG4gICAgfVxuICB9XG59XG4iXX0=