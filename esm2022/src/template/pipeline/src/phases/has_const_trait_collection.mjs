/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Looks for the HasConst trait, indicating that an op or expression has some data which
 * should be collected into the constant array. Capable of collecting either a single literal value,
 * or an array literal.
 */
export function phaseConstTraitCollection(job) {
    const collectGlobalConsts = (e) => {
        if (e instanceof ir.ExpressionBase && ir.hasConstTrait(e)) {
            // TODO: Figure out how to make this type narrowing work.
            const ea = e;
            if (ea.constValue !== null) {
                ea.constIndex = job.addConst(ea.constValue);
            }
        }
        return e;
    };
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            if (ir.hasConstTrait(op) && op.constValue !== null) {
                op.constIndex = job.addConst(op.makeExpression(op.constValue));
            }
            ir.transformExpressionsInOp(op, collectGlobalConsts, ir.VisitorContextFlag.None);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFzX2NvbnN0X3RyYWl0X2NvbGxlY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9oYXNfY29uc3RfdHJhaXRfY29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLHlCQUF5QixDQUFDLEdBQTRCO0lBQ3BFLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUFlLEVBQWdCLEVBQUU7UUFDNUQsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQWtCLENBQUMsRUFBRTtZQUMxRSx5REFBeUQ7WUFDekQsTUFBTSxFQUFFLEdBQUcsQ0FBb0QsQ0FBQztZQUNoRSxJQUFJLEVBQUUsQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUMxQixFQUFFLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFVBQXFDLENBQUMsQ0FBQzthQUN4RTtTQUNGO1FBQ0QsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDLENBQUM7SUFFRixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUNsRCxFQUFFLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQzthQUNoRTtZQUNELEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2xGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogTG9va3MgZm9yIHRoZSBIYXNDb25zdCB0cmFpdCwgaW5kaWNhdGluZyB0aGF0IGFuIG9wIG9yIGV4cHJlc3Npb24gaGFzIHNvbWUgZGF0YSB3aGljaFxuICogc2hvdWxkIGJlIGNvbGxlY3RlZCBpbnRvIHRoZSBjb25zdGFudCBhcnJheS4gQ2FwYWJsZSBvZiBjb2xsZWN0aW5nIGVpdGhlciBhIHNpbmdsZSBsaXRlcmFsIHZhbHVlLFxuICogb3IgYW4gYXJyYXkgbGl0ZXJhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQ29uc3RUcmFpdENvbGxlY3Rpb24oam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBjb25zdCBjb2xsZWN0R2xvYmFsQ29uc3RzID0gKGU6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiA9PiB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBpci5FeHByZXNzaW9uQmFzZSAmJiBpci5oYXNDb25zdFRyYWl0KGUgYXMgaXIuRXhwcmVzc2lvbikpIHtcbiAgICAgIC8vIFRPRE86IEZpZ3VyZSBvdXQgaG93IHRvIG1ha2UgdGhpcyB0eXBlIG5hcnJvd2luZyB3b3JrLlxuICAgICAgY29uc3QgZWEgPSBlIGFzIHVua25vd24gYXMgaXIuRXhwcmVzc2lvbkJhc2UgJiBpci5IYXNDb25zdFRyYWl0O1xuICAgICAgaWYgKGVhLmNvbnN0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgZWEuY29uc3RJbmRleCA9IGpvYi5hZGRDb25zdChlYS5jb25zdFZhbHVlIGFzIHVua25vd24gYXMgby5FeHByZXNzaW9uKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH07XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKGlyLmhhc0NvbnN0VHJhaXQob3ApICYmIG9wLmNvbnN0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgb3AuY29uc3RJbmRleCA9IGpvYi5hZGRDb25zdChvcC5tYWtlRXhwcmVzc2lvbihvcC5jb25zdFZhbHVlKSk7XG4gICAgICB9XG4gICAgICBpci50cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIGNvbGxlY3RHbG9iYWxDb25zdHMsIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==