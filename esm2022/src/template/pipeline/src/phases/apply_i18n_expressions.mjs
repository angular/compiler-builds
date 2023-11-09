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
    for (const unit of job.units) {
        for (const op of unit.update) {
            // Only add apply after expressions that are not followed by more expressions.
            if (op.kind === ir.OpKind.I18nExpression && needsApplication(op)) {
                // TODO: what should be the source span for the apply op?
                ir.OpList.insertAfter(ir.createI18nApplyOp(op.target, op.handle, null), op);
            }
        }
    }
}
/**
 * Checks whether the given expression op needs to be followed with an apply op.
 */
function needsApplication(op) {
    // If the next op is not another expression, we need to apply.
    if (op.next?.kind !== ir.OpKind.I18nExpression) {
        return true;
    }
    // If the next op is an expression targeting a different i18n context, we need to apply.
    if (op.next.context !== op.context) {
        return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsOEVBQThFO1lBQzlFLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNqRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUYsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxFQUF1QjtJQUMvQyw4REFBOEQ7SUFDOUQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQy9DLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELHdGQUF3RjtJQUN4RixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEFkZHMgYXBwbHkgb3BlcmF0aW9ucyBhZnRlciBpMThuIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlJMThuRXhwcmVzc2lvbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgLy8gT25seSBhZGQgYXBwbHkgYWZ0ZXIgZXhwcmVzc2lvbnMgdGhhdCBhcmUgbm90IGZvbGxvd2VkIGJ5IG1vcmUgZXhwcmVzc2lvbnMuXG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uICYmIG5lZWRzQXBwbGljYXRpb24ob3ApKSB7XG4gICAgICAgIC8vIFRPRE86IHdoYXQgc2hvdWxkIGJlIHRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGFwcGx5IG9wP1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuVXBkYXRlT3A+KGlyLmNyZWF0ZUkxOG5BcHBseU9wKG9wLnRhcmdldCwgb3AuaGFuZGxlLCBudWxsISksIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBvcCBuZWVkcyB0byBiZSBmb2xsb3dlZCB3aXRoIGFuIGFwcGx5IG9wLlxuICovXG5mdW5jdGlvbiBuZWVkc0FwcGxpY2F0aW9uKG9wOiBpci5JMThuRXhwcmVzc2lvbk9wKSB7XG4gIC8vIElmIHRoZSBuZXh0IG9wIGlzIG5vdCBhbm90aGVyIGV4cHJlc3Npb24sIHdlIG5lZWQgdG8gYXBwbHkuXG4gIGlmIChvcC5uZXh0Py5raW5kICE9PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICAvLyBJZiB0aGUgbmV4dCBvcCBpcyBhbiBleHByZXNzaW9uIHRhcmdldGluZyBhIGRpZmZlcmVudCBpMThuIGNvbnRleHQsIHdlIG5lZWQgdG8gYXBwbHkuXG4gIGlmIChvcC5uZXh0LmNvbnRleHQgIT09IG9wLmNvbnRleHQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iXX0=