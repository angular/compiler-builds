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
                ir.OpList.insertAfter(ir.createI18nApplyOp(op.owner, op.ownerSlot, null), op);
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
    // If the next op is an expression targeting a different i18n block, we need to apply.
    if (op.next.owner !== op.owner) {
        return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1Qiw4RUFBOEU7WUFDOUUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUNoRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDN0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxFQUF1QjtJQUMvQyw4REFBOEQ7SUFDOUQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtRQUM5QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0Qsc0ZBQXNGO0lBQ3RGLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRTtRQUM5QixPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuXG4vKipcbiAqIEFkZHMgYXBwbHkgb3BlcmF0aW9ucyBhZnRlciBpMThuIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlJMThuRXhwcmVzc2lvbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgLy8gT25seSBhZGQgYXBwbHkgYWZ0ZXIgZXhwcmVzc2lvbnMgdGhhdCBhcmUgbm90IGZvbGxvd2VkIGJ5IG1vcmUgZXhwcmVzc2lvbnMuXG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uICYmIG5lZWRzQXBwbGljYXRpb24ob3ApKSB7XG4gICAgICAgIC8vIFRPRE86IHdoYXQgc2hvdWxkIGJlIHRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGFwcGx5IG9wP1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuVXBkYXRlT3A+KGlyLmNyZWF0ZUkxOG5BcHBseU9wKG9wLm93bmVyLCBvcC5vd25lclNsb3QsIG51bGwhKSwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBleHByZXNzaW9uIG9wIG5lZWRzIHRvIGJlIGZvbGxvd2VkIHdpdGggYW4gYXBwbHkgb3AuXG4gKi9cbmZ1bmN0aW9uIG5lZWRzQXBwbGljYXRpb24ob3A6IGlyLkkxOG5FeHByZXNzaW9uT3ApIHtcbiAgLy8gSWYgdGhlIG5leHQgb3AgaXMgbm90IGFub3RoZXIgZXhwcmVzc2lvbiwgd2UgbmVlZCB0byBhcHBseS5cbiAgaWYgKG9wLm5leHQ/LmtpbmQgIT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIElmIHRoZSBuZXh0IG9wIGlzIGFuIGV4cHJlc3Npb24gdGFyZ2V0aW5nIGEgZGlmZmVyZW50IGkxOG4gYmxvY2ssIHdlIG5lZWQgdG8gYXBwbHkuXG4gIGlmIChvcC5uZXh0Lm93bmVyICE9PSBvcC5vd25lcikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiJdfQ==