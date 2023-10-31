/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phasePipeVariadic(job) {
    for (const unit of job.units) {
        for (const op of unit.update) {
            ir.transformExpressionsInOp(op, expr => {
                if (!(expr instanceof ir.PipeBindingExpr)) {
                    return expr;
                }
                // Pipes are variadic if they have more than 4 arguments.
                if (expr.args.length <= 4) {
                    return expr;
                }
                return new ir.PipeBindingVariadicExpr(expr.target, expr.targetSlot, expr.name, o.literalArr(expr.args), expr.args.length);
            }, ir.VisitorContextFlag.None);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV92YXJpYWRpYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BpcGVfdmFyaWFkaWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQixNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixFQUFFLENBQUMsd0JBQXdCLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNyQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFO29CQUN6QyxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFFRCx5REFBeUQ7Z0JBQ3pELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO29CQUN6QixPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFFRCxPQUFPLElBQUksRUFBRSxDQUFDLHVCQUF1QixDQUNqQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYiwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUGlwZVZhcmlhZGljKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBpci5QaXBlQmluZGluZ0V4cHIpKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQaXBlcyBhcmUgdmFyaWFkaWMgaWYgdGhleSBoYXZlIG1vcmUgdGhhbiA0IGFyZ3VtZW50cy5cbiAgICAgICAgaWYgKGV4cHIuYXJncy5sZW5ndGggPD0gNCkge1xuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBpci5QaXBlQmluZGluZ1ZhcmlhZGljRXhwcihcbiAgICAgICAgICAgIGV4cHIudGFyZ2V0LCBleHByLnRhcmdldFNsb3QsIGV4cHIubmFtZSwgby5saXRlcmFsQXJyKGV4cHIuYXJncyksIGV4cHIuYXJncy5sZW5ndGgpO1xuICAgICAgfSwgaXIuVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xuICAgIH1cbiAgfVxufVxuIl19