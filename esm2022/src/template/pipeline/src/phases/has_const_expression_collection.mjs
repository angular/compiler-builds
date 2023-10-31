/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
export function phaseConstExpressionCollection(job) {
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            ir.transformExpressionsInOp(op, expr => {
                if (!(expr instanceof ir.ConstCollectedExpr)) {
                    return expr;
                }
                return o.literal(job.addConst(expr.expr));
            }, ir.VisitorContextFlag.None);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFzX2NvbnN0X2V4cHJlc3Npb25fY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2hhc19jb25zdF9leHByZXNzaW9uX2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixNQUFNLFVBQVUsOEJBQThCLENBQUMsR0FBNEI7SUFDekUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRTtvQkFDNUMsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQ0QsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDNUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNoQztLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VDb25zdEV4cHJlc3Npb25Db2xsZWN0aW9uKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaXIudHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIGlyLkNvbnN0Q29sbGVjdGVkRXhwcikpIHtcbiAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gby5saXRlcmFsKGpvYi5hZGRDb25zdChleHByLmV4cHIpKTtcbiAgICAgIH0sIGlyLlZpc2l0b3JDb250ZXh0RmxhZy5Ob25lKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==