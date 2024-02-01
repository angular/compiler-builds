/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
import * as ng from '../instruction';
/**
 * Transforms a `TwoWayBindingSet` expression into an expression that either
 * sets a value through the `twoWayBindingSet` instruction or falls back to setting
 * the value directly. E.g. the expression `TwoWayBindingSet(target, value)` becomes:
 * `ng.twoWayBindingSet(target, value) || (target = value)`.
 */
export function transformTwoWayBindingSet(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.TwoWayListener) {
                ir.transformExpressionsInOp(op, (expr) => {
                    if (expr instanceof ir.TwoWayBindingSetExpr) {
                        return wrapAction(expr.target, expr.value);
                    }
                    return expr;
                }, ir.VisitorContextFlag.InChildOperation);
            }
        }
    }
}
function wrapSetOperation(target, value) {
    return ng.twoWayBindingSet(target, value).or(target.set(value));
}
function isReadExpression(value) {
    return value instanceof o.ReadPropExpr || value instanceof o.ReadKeyExpr;
}
function wrapAction(target, value) {
    // The only officially supported expressions inside of a two-way binding are read expressions.
    if (isReadExpression(target)) {
        return wrapSetOperation(target, value);
    }
    // However, historically the expression parser was handling two-way events by appending `=$event`
    // to the raw string before attempting to parse it. This has led to bugs over the years (see
    // #37809) and to unintentionally supporting unassignable events in the two-way binding. The
    // logic below aims to emulate the old behavior while still supporting the new output format
    // which uses `twoWayBindingSet`. Note that the generated code doesn't necessarily make sense
    // based on what the user wrote, for example the event binding for `[(value)]="a ? b : c"`
    // would produce `ctx.a ? ctx.b : ctx.c = $event`. We aim to reproduce what the parser used
    // to generate before #54154.
    if (target instanceof o.BinaryOperatorExpr && isReadExpression(target.rhs)) {
        // `a && b` -> `ctx.a && twoWayBindingSet(ctx.b, $event) || (ctx.b = $event)`
        return new o.BinaryOperatorExpr(target.operator, target.lhs, wrapSetOperation(target.rhs, value));
    }
    // Note: this also supports nullish coalescing expressions which
    // would've been downleveled to ternary expressions by this point.
    if (target instanceof o.ConditionalExpr && isReadExpression(target.falseCase)) {
        // `a ? b : c` -> `ctx.a ? ctx.b : twoWayBindingSet(ctx.c, $event) || (ctx.c = $event)`
        return new o.ConditionalExpr(target.condition, target.trueCase, wrapSetOperation(target.falseCase, value));
    }
    // `!!a` -> `twoWayBindingSet(ctx.a, $event) || (ctx.a = $event)`
    // Note: previously we'd actually produce `!!(ctx.a = $event)`, but the wrapping
    // node doesn't affect the result so we don't need to carry it over.
    if (target instanceof o.NotExpr) {
        let expr = target.condition;
        while (true) {
            if (expr instanceof o.NotExpr) {
                expr = expr.condition;
            }
            else {
                if (isReadExpression(expr)) {
                    return wrapSetOperation(expr, value);
                }
                break;
            }
        }
    }
    throw new Error(`Unsupported expression in two-way action binding.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtX3R3b193YXlfYmluZGluZ19zZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy90cmFuc2Zvcm1fdHdvX3dheV9iaW5kaW5nX3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFHckM7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3pDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDdkMsSUFBSSxJQUFJLFlBQVksRUFBRSxDQUFDLG9CQUFvQixFQUFFLENBQUM7d0JBQzVDLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUM3QyxDQUFDO29CQUNELE9BQU8sSUFBSSxDQUFDO2dCQUNkLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUM3QyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxNQUFvQyxFQUFFLEtBQW1CO0lBQ2pGLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2xFLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQWM7SUFDdEMsT0FBTyxLQUFLLFlBQVksQ0FBQyxDQUFDLFlBQVksSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUMzRSxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsTUFBb0IsRUFBRSxLQUFtQjtJQUMzRCw4RkFBOEY7SUFDOUYsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQzdCLE9BQU8sZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxpR0FBaUc7SUFDakcsNEZBQTRGO0lBQzVGLDRGQUE0RjtJQUM1Riw0RkFBNEY7SUFDNUYsNkZBQTZGO0lBQzdGLDBGQUEwRjtJQUMxRiwyRkFBMkY7SUFDM0YsNkJBQTZCO0lBQzdCLElBQUksTUFBTSxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUMzRSw2RUFBNkU7UUFDN0UsT0FBTyxJQUFJLENBQUMsQ0FBQyxrQkFBa0IsQ0FDM0IsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsZ0VBQWdFO0lBQ2hFLGtFQUFrRTtJQUNsRSxJQUFJLE1BQU0sWUFBWSxDQUFDLENBQUMsZUFBZSxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQzlFLHVGQUF1RjtRQUN2RixPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FDeEIsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBRUQsaUVBQWlFO0lBQ2pFLGdGQUFnRjtJQUNoRixvRUFBb0U7SUFDcEUsSUFBSSxNQUFNLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2hDLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFFNUIsT0FBTyxJQUFJLEVBQUUsQ0FBQztZQUNaLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDeEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDM0IsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3ZDLENBQUM7Z0JBQ0QsTUFBTTtZQUNSLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztBQUN2RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0ICogYXMgbmcgZnJvbSAnLi4vaW5zdHJ1Y3Rpb24nO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVHJhbnNmb3JtcyBhIGBUd29XYXlCaW5kaW5nU2V0YCBleHByZXNzaW9uIGludG8gYW4gZXhwcmVzc2lvbiB0aGF0IGVpdGhlclxuICogc2V0cyBhIHZhbHVlIHRocm91Z2ggdGhlIGB0d29XYXlCaW5kaW5nU2V0YCBpbnN0cnVjdGlvbiBvciBmYWxscyBiYWNrIHRvIHNldHRpbmdcbiAqIHRoZSB2YWx1ZSBkaXJlY3RseS4gRS5nLiB0aGUgZXhwcmVzc2lvbiBgVHdvV2F5QmluZGluZ1NldCh0YXJnZXQsIHZhbHVlKWAgYmVjb21lczpcbiAqIGBuZy50d29XYXlCaW5kaW5nU2V0KHRhcmdldCwgdmFsdWUpIHx8ICh0YXJnZXQgPSB2YWx1ZSlgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtVHdvV2F5QmluZGluZ1NldChqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLlR3b1dheUxpc3RlbmVyKSB7XG4gICAgICAgIGlyLnRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChvcCwgKGV4cHIpID0+IHtcbiAgICAgICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIGlyLlR3b1dheUJpbmRpbmdTZXRFeHByKSB7XG4gICAgICAgICAgICByZXR1cm4gd3JhcEFjdGlvbihleHByLnRhcmdldCwgZXhwci52YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9LCBpci5WaXNpdG9yQ29udGV4dEZsYWcuSW5DaGlsZE9wZXJhdGlvbik7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBTZXRPcGVyYXRpb24odGFyZ2V0OiBvLlJlYWRQcm9wRXhwcnxvLlJlYWRLZXlFeHByLCB2YWx1ZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG5nLnR3b1dheUJpbmRpbmdTZXQodGFyZ2V0LCB2YWx1ZSkub3IodGFyZ2V0LnNldCh2YWx1ZSkpO1xufVxuXG5mdW5jdGlvbiBpc1JlYWRFeHByZXNzaW9uKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgby5SZWFkUHJvcEV4cHJ8by5SZWFkS2V5RXhwciB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIG8uUmVhZFByb3BFeHByIHx8IHZhbHVlIGluc3RhbmNlb2Ygby5SZWFkS2V5RXhwcjtcbn1cblxuZnVuY3Rpb24gd3JhcEFjdGlvbih0YXJnZXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIC8vIFRoZSBvbmx5IG9mZmljaWFsbHkgc3VwcG9ydGVkIGV4cHJlc3Npb25zIGluc2lkZSBvZiBhIHR3by13YXkgYmluZGluZyBhcmUgcmVhZCBleHByZXNzaW9ucy5cbiAgaWYgKGlzUmVhZEV4cHJlc3Npb24odGFyZ2V0KSkge1xuICAgIHJldHVybiB3cmFwU2V0T3BlcmF0aW9uKHRhcmdldCwgdmFsdWUpO1xuICB9XG5cbiAgLy8gSG93ZXZlciwgaGlzdG9yaWNhbGx5IHRoZSBleHByZXNzaW9uIHBhcnNlciB3YXMgaGFuZGxpbmcgdHdvLXdheSBldmVudHMgYnkgYXBwZW5kaW5nIGA9JGV2ZW50YFxuICAvLyB0byB0aGUgcmF3IHN0cmluZyBiZWZvcmUgYXR0ZW1wdGluZyB0byBwYXJzZSBpdC4gVGhpcyBoYXMgbGVkIHRvIGJ1Z3Mgb3ZlciB0aGUgeWVhcnMgKHNlZVxuICAvLyAjMzc4MDkpIGFuZCB0byB1bmludGVudGlvbmFsbHkgc3VwcG9ydGluZyB1bmFzc2lnbmFibGUgZXZlbnRzIGluIHRoZSB0d28td2F5IGJpbmRpbmcuIFRoZVxuICAvLyBsb2dpYyBiZWxvdyBhaW1zIHRvIGVtdWxhdGUgdGhlIG9sZCBiZWhhdmlvciB3aGlsZSBzdGlsbCBzdXBwb3J0aW5nIHRoZSBuZXcgb3V0cHV0IGZvcm1hdFxuICAvLyB3aGljaCB1c2VzIGB0d29XYXlCaW5kaW5nU2V0YC4gTm90ZSB0aGF0IHRoZSBnZW5lcmF0ZWQgY29kZSBkb2Vzbid0IG5lY2Vzc2FyaWx5IG1ha2Ugc2Vuc2VcbiAgLy8gYmFzZWQgb24gd2hhdCB0aGUgdXNlciB3cm90ZSwgZm9yIGV4YW1wbGUgdGhlIGV2ZW50IGJpbmRpbmcgZm9yIGBbKHZhbHVlKV09XCJhID8gYiA6IGNcImBcbiAgLy8gd291bGQgcHJvZHVjZSBgY3R4LmEgPyBjdHguYiA6IGN0eC5jID0gJGV2ZW50YC4gV2UgYWltIHRvIHJlcHJvZHVjZSB3aGF0IHRoZSBwYXJzZXIgdXNlZFxuICAvLyB0byBnZW5lcmF0ZSBiZWZvcmUgIzU0MTU0LlxuICBpZiAodGFyZ2V0IGluc3RhbmNlb2Ygby5CaW5hcnlPcGVyYXRvckV4cHIgJiYgaXNSZWFkRXhwcmVzc2lvbih0YXJnZXQucmhzKSkge1xuICAgIC8vIGBhICYmIGJgIC0+IGBjdHguYSAmJiB0d29XYXlCaW5kaW5nU2V0KGN0eC5iLCAkZXZlbnQpIHx8IChjdHguYiA9ICRldmVudClgXG4gICAgcmV0dXJuIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgdGFyZ2V0Lm9wZXJhdG9yLCB0YXJnZXQubGhzLCB3cmFwU2V0T3BlcmF0aW9uKHRhcmdldC5yaHMsIHZhbHVlKSk7XG4gIH1cblxuICAvLyBOb3RlOiB0aGlzIGFsc28gc3VwcG9ydHMgbnVsbGlzaCBjb2FsZXNjaW5nIGV4cHJlc3Npb25zIHdoaWNoXG4gIC8vIHdvdWxkJ3ZlIGJlZW4gZG93bmxldmVsZWQgdG8gdGVybmFyeSBleHByZXNzaW9ucyBieSB0aGlzIHBvaW50LlxuICBpZiAodGFyZ2V0IGluc3RhbmNlb2Ygby5Db25kaXRpb25hbEV4cHIgJiYgaXNSZWFkRXhwcmVzc2lvbih0YXJnZXQuZmFsc2VDYXNlKSkge1xuICAgIC8vIGBhID8gYiA6IGNgIC0+IGBjdHguYSA/IGN0eC5iIDogdHdvV2F5QmluZGluZ1NldChjdHguYywgJGV2ZW50KSB8fCAoY3R4LmMgPSAkZXZlbnQpYFxuICAgIHJldHVybiBuZXcgby5Db25kaXRpb25hbEV4cHIoXG4gICAgICAgIHRhcmdldC5jb25kaXRpb24sIHRhcmdldC50cnVlQ2FzZSwgd3JhcFNldE9wZXJhdGlvbih0YXJnZXQuZmFsc2VDYXNlLCB2YWx1ZSkpO1xuICB9XG5cbiAgLy8gYCEhYWAgLT4gYHR3b1dheUJpbmRpbmdTZXQoY3R4LmEsICRldmVudCkgfHwgKGN0eC5hID0gJGV2ZW50KWBcbiAgLy8gTm90ZTogcHJldmlvdXNseSB3ZSdkIGFjdHVhbGx5IHByb2R1Y2UgYCEhKGN0eC5hID0gJGV2ZW50KWAsIGJ1dCB0aGUgd3JhcHBpbmdcbiAgLy8gbm9kZSBkb2Vzbid0IGFmZmVjdCB0aGUgcmVzdWx0IHNvIHdlIGRvbid0IG5lZWQgdG8gY2FycnkgaXQgb3Zlci5cbiAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG8uTm90RXhwcikge1xuICAgIGxldCBleHByID0gdGFyZ2V0LmNvbmRpdGlvbjtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTm90RXhwcikge1xuICAgICAgICBleHByID0gZXhwci5jb25kaXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNSZWFkRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybiB3cmFwU2V0T3BlcmF0aW9uKGV4cHIsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGV4cHJlc3Npb24gaW4gdHdvLXdheSBhY3Rpb24gYmluZGluZy5gKTtcbn1cbiJdfQ==