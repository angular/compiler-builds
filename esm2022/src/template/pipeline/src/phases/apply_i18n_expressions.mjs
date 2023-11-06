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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1Qiw4RUFBOEU7WUFDOUUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUNoRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDM0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxFQUF1QjtJQUMvQyw4REFBOEQ7SUFDOUQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtRQUM5QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0Qsd0ZBQXdGO0lBQ3hGLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDLE9BQU8sRUFBRTtRQUNsQyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBBZGRzIGFwcGx5IG9wZXJhdGlvbnMgYWZ0ZXIgaTE4biBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5STE4bkV4cHJlc3Npb25zKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIC8vIE9ubHkgYWRkIGFwcGx5IGFmdGVyIGV4cHJlc3Npb25zIHRoYXQgYXJlIG5vdCBmb2xsb3dlZCBieSBtb3JlIGV4cHJlc3Npb25zLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbiAmJiBuZWVkc0FwcGxpY2F0aW9uKG9wKSkge1xuICAgICAgICAvLyBUT0RPOiB3aGF0IHNob3VsZCBiZSB0aGUgc291cmNlIHNwYW4gZm9yIHRoZSBhcHBseSBvcD9cbiAgICAgICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyPGlyLlVwZGF0ZU9wPihpci5jcmVhdGVJMThuQXBwbHlPcChvcC50YXJnZXQsIG9wLmhhbmRsZSwgbnVsbCEpLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGV4cHJlc3Npb24gb3AgbmVlZHMgdG8gYmUgZm9sbG93ZWQgd2l0aCBhbiBhcHBseSBvcC5cbiAqL1xuZnVuY3Rpb24gbmVlZHNBcHBsaWNhdGlvbihvcDogaXIuSTE4bkV4cHJlc3Npb25PcCkge1xuICAvLyBJZiB0aGUgbmV4dCBvcCBpcyBub3QgYW5vdGhlciBleHByZXNzaW9uLCB3ZSBuZWVkIHRvIGFwcGx5LlxuICBpZiAob3AubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gSWYgdGhlIG5leHQgb3AgaXMgYW4gZXhwcmVzc2lvbiB0YXJnZXRpbmcgYSBkaWZmZXJlbnQgaTE4biBjb250ZXh0LCB3ZSBuZWVkIHRvIGFwcGx5LlxuICBpZiAob3AubmV4dC5jb250ZXh0ICE9PSBvcC5jb250ZXh0KSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19