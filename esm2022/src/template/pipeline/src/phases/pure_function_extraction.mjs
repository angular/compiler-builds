/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GenericKeyFn } from '../../../../constant_pool';
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phasePureFunctionExtraction(job) {
    for (const view of job.units) {
        for (const op of view.ops()) {
            ir.visitExpressionsInOp(op, expr => {
                if (!(expr instanceof ir.PureFunctionExpr) || expr.body === null) {
                    return;
                }
                const constantDef = new PureFunctionConstant(expr.args.length);
                expr.fn = job.pool.getSharedConstant(constantDef, expr.body);
                expr.body = null;
            });
        }
    }
}
class PureFunctionConstant extends GenericKeyFn {
    constructor(numArgs) {
        super();
        this.numArgs = numArgs;
    }
    keyOf(expr) {
        if (expr instanceof ir.PureFunctionParameterExpr) {
            return `param(${expr.index})`;
        }
        else {
            return super.keyOf(expr);
        }
    }
    // TODO: Use the new pool method `getSharedFunctionReference`
    toSharedConstantDeclaration(declName, keyExpr) {
        const fnParams = [];
        for (let idx = 0; idx < this.numArgs; idx++) {
            fnParams.push(new o.FnParam('a' + idx));
        }
        // We will never visit `ir.PureFunctionParameterExpr`s that don't belong to us, because this
        // transform runs inside another visitor which will visit nested pure functions before this one.
        const returnExpr = ir.transformExpressionsInExpression(keyExpr, expr => {
            if (!(expr instanceof ir.PureFunctionParameterExpr)) {
                return expr;
            }
            return o.variable('a' + expr.index);
        }, ir.VisitorContextFlag.None);
        return new o.DeclareVarStmt(declName, new o.ArrowFunctionExpr(fnParams, returnExpr), undefined, o.StmtModifier.Final);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZV9mdW5jdGlvbl9leHRyYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHVyZV9mdW5jdGlvbl9leHRyYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQTJCLE1BQU0sMkJBQTJCLENBQUM7QUFDakYsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQixNQUFNLFVBQVUsMkJBQTJCLENBQUMsR0FBbUI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtvQkFDaEUsT0FBTztpQkFDUjtnQkFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQy9ELElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNuQixDQUFDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsTUFBTSxvQkFBcUIsU0FBUSxZQUFZO0lBQzdDLFlBQW9CLE9BQWU7UUFDakMsS0FBSyxFQUFFLENBQUM7UUFEVSxZQUFPLEdBQVAsT0FBTyxDQUFRO0lBRW5DLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBa0I7UUFDL0IsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLHlCQUF5QixFQUFFO1lBQ2hELE9BQU8sU0FBUyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUM7U0FDL0I7YUFBTTtZQUNMLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMxQjtJQUNILENBQUM7SUFFRCw2REFBNkQ7SUFDN0QsMkJBQTJCLENBQUMsUUFBZ0IsRUFBRSxPQUFxQjtRQUNqRSxNQUFNLFFBQVEsR0FBZ0IsRUFBRSxDQUFDO1FBQ2pDLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQzNDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3pDO1FBRUQsNEZBQTRGO1FBQzVGLGdHQUFnRztRQUNoRyxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUMsZ0NBQWdDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMseUJBQXlCLENBQUMsRUFBRTtnQkFDbkQsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RDLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFL0IsT0FBTyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQ3ZCLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEcsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7R2VuZXJpY0tleUZuLCBTaGFyZWRDb25zdGFudERlZmluaXRpb259IGZyb20gJy4uLy4uLy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VQdXJlRnVuY3Rpb25FeHRyYWN0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB2aWV3IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUHVyZUZ1bmN0aW9uRXhwcikgfHwgZXhwci5ib2R5ID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29uc3RhbnREZWYgPSBuZXcgUHVyZUZ1bmN0aW9uQ29uc3RhbnQoZXhwci5hcmdzLmxlbmd0aCk7XG4gICAgICAgIGV4cHIuZm4gPSBqb2IucG9vbC5nZXRTaGFyZWRDb25zdGFudChjb25zdGFudERlZiwgZXhwci5ib2R5KTtcbiAgICAgICAgZXhwci5ib2R5ID0gbnVsbDtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBQdXJlRnVuY3Rpb25Db25zdGFudCBleHRlbmRzIEdlbmVyaWNLZXlGbiBpbXBsZW1lbnRzIFNoYXJlZENvbnN0YW50RGVmaW5pdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgbnVtQXJnczogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGtleU9mKGV4cHI6IG8uRXhwcmVzc2lvbik6IHN0cmluZyB7XG4gICAgaWYgKGV4cHIgaW5zdGFuY2VvZiBpci5QdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByKSB7XG4gICAgICByZXR1cm4gYHBhcmFtKCR7ZXhwci5pbmRleH0pYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHN1cGVyLmtleU9mKGV4cHIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE86IFVzZSB0aGUgbmV3IHBvb2wgbWV0aG9kIGBnZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZWBcbiAgdG9TaGFyZWRDb25zdGFudERlY2xhcmF0aW9uKGRlY2xOYW1lOiBzdHJpbmcsIGtleUV4cHI6IG8uRXhwcmVzc2lvbik6IG8uU3RhdGVtZW50IHtcbiAgICBjb25zdCBmblBhcmFtczogby5GblBhcmFtW10gPSBbXTtcbiAgICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCB0aGlzLm51bUFyZ3M7IGlkeCsrKSB7XG4gICAgICBmblBhcmFtcy5wdXNoKG5ldyBvLkZuUGFyYW0oJ2EnICsgaWR4KSk7XG4gICAgfVxuXG4gICAgLy8gV2Ugd2lsbCBuZXZlciB2aXNpdCBgaXIuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcmBzIHRoYXQgZG9uJ3QgYmVsb25nIHRvIHVzLCBiZWNhdXNlIHRoaXNcbiAgICAvLyB0cmFuc2Zvcm0gcnVucyBpbnNpZGUgYW5vdGhlciB2aXNpdG9yIHdoaWNoIHdpbGwgdmlzaXQgbmVzdGVkIHB1cmUgZnVuY3Rpb25zIGJlZm9yZSB0aGlzIG9uZS5cbiAgICBjb25zdCByZXR1cm5FeHByID0gaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oa2V5RXhwciwgZXhwciA9PiB7XG4gICAgICBpZiAoIShleHByIGluc3RhbmNlb2YgaXIuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcikpIHtcbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKCdhJyArIGV4cHIuaW5kZXgpO1xuICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcblxuICAgIHJldHVybiBuZXcgby5EZWNsYXJlVmFyU3RtdChcbiAgICAgICAgZGVjbE5hbWUsIG5ldyBvLkFycm93RnVuY3Rpb25FeHByKGZuUGFyYW1zLCByZXR1cm5FeHByKSwgdW5kZWZpbmVkLCBvLlN0bXRNb2RpZmllci5GaW5hbCk7XG4gIH1cbn1cbiJdfQ==