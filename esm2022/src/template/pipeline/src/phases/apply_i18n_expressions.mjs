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
    const context = i18nContexts.get(op.context);
    const nextContext = i18nContexts.get(op.next.context);
    if (context === undefined) {
        throw new Error('AssertionError: expected an I18nContextOp to exist for the I18nExpressionOp\'s context');
    }
    if (nextContext === undefined) {
        throw new Error('AssertionError: expected an I18nContextOp to exist for the next I18nExpressionOp\'s context');
    }
    // If the next op is an expression targeting a different i18n block (or different element, in the
    // case of i18n attributes), we need to apply.
    // First, handle the case of i18n blocks.
    if (context.i18nBlock !== null) {
        // This is a block context. Compare the blocks.
        if (context.i18nBlock !== nextContext.i18nBlock) {
            return true;
        }
        return false;
    }
    // Second, handle the case of i18n attributes.
    if (op.target !== op.next.target) {
        return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfaTE4bl9leHByZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2FwcGx5X2kxOG5fZXhwcmVzc2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ3RDLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNoQyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3Qiw4RUFBOEU7WUFDOUUsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLGdCQUFnQixDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUMvRSx5REFBeUQ7Z0JBQ3pELEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFjLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUYsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxZQUE4QyxFQUFFLEVBQXVCO0lBQy9GLDhEQUE4RDtJQUM5RCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDL0MsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0MsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXRELElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzFCLE1BQU0sSUFBSSxLQUFLLENBQ1gsd0ZBQXdGLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRUQsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FDWCw2RkFBNkYsQ0FBQyxDQUFDO0lBQ3JHLENBQUM7SUFFRCxpR0FBaUc7SUFDakcsOENBQThDO0lBRTlDLHlDQUF5QztJQUN6QyxJQUFJLE9BQU8sQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDL0IsK0NBQStDO1FBQy9DLElBQUksT0FBTyxDQUFDLFNBQVMsS0FBSyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEQsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsOENBQThDO0lBQzlDLElBQUksRUFBRSxDQUFDLE1BQU0sS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQWRkcyBhcHBseSBvcGVyYXRpb25zIGFmdGVyIGkxOG4gZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUkxOG5FeHByZXNzaW9ucyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuQ29udGV4dCkge1xuICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgLy8gT25seSBhZGQgYXBwbHkgYWZ0ZXIgZXhwcmVzc2lvbnMgdGhhdCBhcmUgbm90IGZvbGxvd2VkIGJ5IG1vcmUgZXhwcmVzc2lvbnMuXG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uICYmIG5lZWRzQXBwbGljYXRpb24oaTE4bkNvbnRleHRzLCBvcCkpIHtcbiAgICAgICAgLy8gVE9ETzogd2hhdCBzaG91bGQgYmUgdGhlIHNvdXJjZSBzcGFuIGZvciB0aGUgYXBwbHkgb3A/XG4gICAgICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcjxpci5VcGRhdGVPcD4oaXIuY3JlYXRlSTE4bkFwcGx5T3Aob3AudGFyZ2V0LCBvcC5oYW5kbGUsIG51bGwhKSwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBleHByZXNzaW9uIG9wIG5lZWRzIHRvIGJlIGZvbGxvd2VkIHdpdGggYW4gYXBwbHkgb3AuXG4gKi9cbmZ1bmN0aW9uIG5lZWRzQXBwbGljYXRpb24oaTE4bkNvbnRleHRzOiBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPiwgb3A6IGlyLkkxOG5FeHByZXNzaW9uT3ApIHtcbiAgLy8gSWYgdGhlIG5leHQgb3AgaXMgbm90IGFub3RoZXIgZXhwcmVzc2lvbiwgd2UgbmVlZCB0byBhcHBseS5cbiAgaWYgKG9wLm5leHQ/LmtpbmQgIT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgY29udGV4dCA9IGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCk7XG4gIGNvbnN0IG5leHRDb250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChvcC5uZXh0LmNvbnRleHQpO1xuXG4gIGlmIChjb250ZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgYW4gSTE4bkNvbnRleHRPcCB0byBleGlzdCBmb3IgdGhlIEkxOG5FeHByZXNzaW9uT3BcXCdzIGNvbnRleHQnKTtcbiAgfVxuXG4gIGlmIChuZXh0Q29udGV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIGFuIEkxOG5Db250ZXh0T3AgdG8gZXhpc3QgZm9yIHRoZSBuZXh0IEkxOG5FeHByZXNzaW9uT3BcXCdzIGNvbnRleHQnKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBuZXh0IG9wIGlzIGFuIGV4cHJlc3Npb24gdGFyZ2V0aW5nIGEgZGlmZmVyZW50IGkxOG4gYmxvY2sgKG9yIGRpZmZlcmVudCBlbGVtZW50LCBpbiB0aGVcbiAgLy8gY2FzZSBvZiBpMThuIGF0dHJpYnV0ZXMpLCB3ZSBuZWVkIHRvIGFwcGx5LlxuXG4gIC8vIEZpcnN0LCBoYW5kbGUgdGhlIGNhc2Ugb2YgaTE4biBibG9ja3MuXG4gIGlmIChjb250ZXh0LmkxOG5CbG9jayAhPT0gbnVsbCkge1xuICAgIC8vIFRoaXMgaXMgYSBibG9jayBjb250ZXh0LiBDb21wYXJlIHRoZSBibG9ja3MuXG4gICAgaWYgKGNvbnRleHQuaTE4bkJsb2NrICE9PSBuZXh0Q29udGV4dC5pMThuQmxvY2spIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBTZWNvbmQsIGhhbmRsZSB0aGUgY2FzZSBvZiBpMThuIGF0dHJpYnV0ZXMuXG4gIGlmIChvcC50YXJnZXQgIT09IG9wLm5leHQudGFyZ2V0KSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19