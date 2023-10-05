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
                ir.OpList.insertAfter(ir.createI18nApplyOp(op.target, null), op);
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
    if (op.next.target !== op.target) {
        return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFJL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBbUI7SUFDM0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1Qiw4RUFBOEU7WUFDOUUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUNoRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLElBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQ2hGO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsRUFBdUI7SUFDL0MsOERBQThEO0lBQzlELElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7UUFDOUMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELHNGQUFzRjtJQUN0RixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxNQUFNLEVBQUU7UUFDaEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cblxuLyoqXG4gKiBBZGRzIGFwcGx5IG9wZXJhdGlvbnMgYWZ0ZXIgaTE4biBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQXBwbHlJMThuRXhwcmVzc2lvbnMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgLy8gT25seSBhZGQgYXBwbHkgYWZ0ZXIgZXhwcmVzc2lvbnMgdGhhdCBhcmUgbm90IGZvbGxvd2VkIGJ5IG1vcmUgZXhwcmVzc2lvbnMuXG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uICYmIG5lZWRzQXBwbGljYXRpb24ob3ApKSB7XG4gICAgICAgIC8vIFRPRE86IHdoYXQgc2hvdWxkIGJlIHRoZSBzb3VyY2Ugc3BhbiBmb3IgdGhlIGFwcGx5IG9wP1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXI8aXIuVXBkYXRlT3A+KGlyLmNyZWF0ZUkxOG5BcHBseU9wKG9wLnRhcmdldCwgbnVsbCEpLCBvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGV4cHJlc3Npb24gb3AgbmVlZHMgdG8gYmUgZm9sbG93ZWQgd2l0aCBhbiBhcHBseSBvcC5cbiAqL1xuZnVuY3Rpb24gbmVlZHNBcHBsaWNhdGlvbihvcDogaXIuSTE4bkV4cHJlc3Npb25PcCkge1xuICAvLyBJZiB0aGUgbmV4dCBvcCBpcyBub3QgYW5vdGhlciBleHByZXNzaW9uLCB3ZSBuZWVkIHRvIGFwcGx5LlxuICBpZiAob3AubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gSWYgdGhlIG5leHQgb3AgaXMgYW4gZXhwcmVzc2lvbiB0YXJnZXRpbmcgYSBkaWZmZXJlbnQgaTE4biBibG9jaywgd2UgbmVlZCB0byBhcHBseS5cbiAgaWYgKG9wLm5leHQudGFyZ2V0ICE9PSBvcC50YXJnZXQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iXX0=