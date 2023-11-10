/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Adds apply operations after i18n expressions.
 */
export function applyI18nExpressions(job) {
    const i18nContexts = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nContext) {
                i18nContexts.set(op.xref, op);
            }
        }
    }
    for (const unit of job.units) {
        for (const op of unit.update) {
            // Only add apply after expressions that are not followed by more expressions.
            if (op.kind === ir.OpKind.I18nExpression && needsApplication(i18nContexts, op)) {
                // TODO: what should be the source span for the apply op?
                ir.OpList.insertAfter(ir.createI18nApplyOp(op.target, op.handle, null), op);
            }
        }
    }
}
/**
 * Checks whether the given expression op needs to be followed with an apply op.
 */
function needsApplication(i18nContexts, op) {
    // If the next op is not another expression, we need to apply.
    if (op.next?.kind !== ir.OpKind.I18nExpression) {
        return true;
    }
    // If the next op is an expression targeting a different i18n block, we need to apply.
    const context = i18nContexts.get(op.context);
    const nextContext = i18nContexts.get(op.next.context);
    if (context.i18nBlock !== nextContext.i18nBlock) {
        return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUU7Z0JBQ3JDLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQzthQUMvQjtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLDhFQUE4RTtZQUM5RSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksZ0JBQWdCLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxFQUFFO2dCQUM5RSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDM0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxZQUE4QyxFQUFFLEVBQXVCO0lBQy9GLDhEQUE4RDtJQUM5RCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO1FBQzlDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxzRkFBc0Y7SUFDdEYsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFFLENBQUM7SUFDOUMsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBRSxDQUFDO0lBQ3ZELElBQUksT0FBTyxDQUFDLFNBQVMsS0FBSyxXQUFXLENBQUMsU0FBUyxFQUFFO1FBQy9DLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEFkZHMgYXBwbHkgb3BlcmF0aW9ucyBhZnRlciBpMThuIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlJMThuRXhwcmVzc2lvbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkNvbnRleHQpIHtcbiAgICAgICAgaTE4bkNvbnRleHRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIC8vIE9ubHkgYWRkIGFwcGx5IGFmdGVyIGV4cHJlc3Npb25zIHRoYXQgYXJlIG5vdCBmb2xsb3dlZCBieSBtb3JlIGV4cHJlc3Npb25zLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbiAmJiBuZWVkc0FwcGxpY2F0aW9uKGkxOG5Db250ZXh0cywgb3ApKSB7XG4gICAgICAgIC8vIFRPRE86IHdoYXQgc2hvdWxkIGJlIHRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGFwcGx5IG9wP1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuVXBkYXRlT3A+KGlyLmNyZWF0ZUkxOG5BcHBseU9wKG9wLnRhcmdldCwgb3AuaGFuZGxlLCBudWxsISksIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBvcCBuZWVkcyB0byBiZSBmb2xsb3dlZCB3aXRoIGFuIGFwcGx5IG9wLlxuICovXG5mdW5jdGlvbiBuZWVkc0FwcGxpY2F0aW9uKGkxOG5Db250ZXh0czogTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4sIG9wOiBpci5JMThuRXhwcmVzc2lvbk9wKSB7XG4gIC8vIElmIHRoZSBuZXh0IG9wIGlzIG5vdCBhbm90aGVyIGV4cHJlc3Npb24sIHdlIG5lZWQgdG8gYXBwbHkuXG4gIGlmIChvcC5uZXh0Py5raW5kICE9PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICAvLyBJZiB0aGUgbmV4dCBvcCBpcyBhbiBleHByZXNzaW9uIHRhcmdldGluZyBhIGRpZmZlcmVudCBpMThuIGJsb2NrLCB3ZSBuZWVkIHRvIGFwcGx5LlxuICBjb25zdCBjb250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSE7XG4gIGNvbnN0IG5leHRDb250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChvcC5uZXh0LmNvbnRleHQpITtcbiAgaWYgKGNvbnRleHQuaTE4bkJsb2NrICE9PSBuZXh0Q29udGV4dC5pMThuQmxvY2spIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iXX0=