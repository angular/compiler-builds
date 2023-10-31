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
export function phaseApplyI18nExpressions(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1Qiw4RUFBOEU7WUFDOUUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUNoRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDN0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxFQUF1QjtJQUMvQyw4REFBOEQ7SUFDOUQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtRQUM5QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0Qsc0ZBQXNGO0lBQ3RGLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRTtRQUM5QixPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuXG4vKipcbiAqIEFkZHMgYXBwbHkgb3BlcmF0aW9ucyBhZnRlciBpMThuIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBcHBseUkxOG5FeHByZXNzaW9ucyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICAvLyBPbmx5IGFkZCBhcHBseSBhZnRlciBleHByZXNzaW9ucyB0aGF0IGFyZSBub3QgZm9sbG93ZWQgYnkgbW9yZSBleHByZXNzaW9ucy5cbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24gJiYgbmVlZHNBcHBsaWNhdGlvbihvcCkpIHtcbiAgICAgICAgLy8gVE9ETzogd2hhdCBzaG91bGQgYmUgdGhlIHNvdXJjZSBzcGFuIGZvciB0aGUgYXBwbHkgb3A/XG4gICAgICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcjxpci5VcGRhdGVPcD4oaXIuY3JlYXRlSTE4bkFwcGx5T3Aob3Aub3duZXIsIG9wLm93bmVyU2xvdCwgbnVsbCEpLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGV4cHJlc3Npb24gb3AgbmVlZHMgdG8gYmUgZm9sbG93ZWQgd2l0aCBhbiBhcHBseSBvcC5cbiAqL1xuZnVuY3Rpb24gbmVlZHNBcHBsaWNhdGlvbihvcDogaXIuSTE4bkV4cHJlc3Npb25PcCkge1xuICAvLyBJZiB0aGUgbmV4dCBvcCBpcyBub3QgYW5vdGhlciBleHByZXNzaW9uLCB3ZSBuZWVkIHRvIGFwcGx5LlxuICBpZiAob3AubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gSWYgdGhlIG5leHQgb3AgaXMgYW4gZXhwcmVzc2lvbiB0YXJnZXRpbmcgYSBkaWZmZXJlbnQgaTE4biBibG9jaywgd2UgbmVlZCB0byBhcHBseS5cbiAgaWYgKG9wLm5leHQub3duZXIgIT09IG9wLm93bmVyKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19