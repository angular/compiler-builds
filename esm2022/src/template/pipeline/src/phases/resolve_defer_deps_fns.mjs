/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Resolve the dependency function of a deferred block.
 */
export function resolveDeferDepsFns(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.Defer) {
                if (op.resolverFn !== null) {
                    continue;
                }
                if (op.ownResolverFn !== null) {
                    if (op.handle.slot === null) {
                        throw new Error('AssertionError: slot must be assigned before extracting defer deps functions');
                    }
                    const fullPathName = unit.fnName?.replace('_Template', '');
                    op.resolverFn = job.pool.getSharedFunctionReference(op.ownResolverFn, `${fullPathName}_Defer_${op.handle.slot}_DepsFn`, 
                    /* Don't use unique names for TDB compatibility */ false);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9kZWZlcl9kZXBzX2Zucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfZGVmZXJfZGVwc19mbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBNEI7SUFDOUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksRUFBRSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDM0IsU0FBUztnQkFDWCxDQUFDO2dCQUVELElBQUksRUFBRSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDOUIsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FDWCw4RUFBOEUsQ0FBQyxDQUFDO29CQUN0RixDQUFDO29CQUNELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDM0QsRUFBRSxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUMvQyxFQUFFLENBQUMsYUFBYSxFQUFFLEdBQUcsWUFBWSxVQUFVLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTO29CQUNsRSxrREFBa0QsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGRlcGVuZGVuY3kgZnVuY3Rpb24gb2YgYSBkZWZlcnJlZCBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVEZWZlckRlcHNGbnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5EZWZlcikge1xuICAgICAgICBpZiAob3AucmVzb2x2ZXJGbiAhPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wLm93blJlc29sdmVyRm4gIT09IG51bGwpIHtcbiAgICAgICAgICBpZiAob3AuaGFuZGxlLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IHNsb3QgbXVzdCBiZSBhc3NpZ25lZCBiZWZvcmUgZXh0cmFjdGluZyBkZWZlciBkZXBzIGZ1bmN0aW9ucycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBmdWxsUGF0aE5hbWUgPSB1bml0LmZuTmFtZT8ucmVwbGFjZSgnX1RlbXBsYXRlJywgJycpO1xuICAgICAgICAgIG9wLnJlc29sdmVyRm4gPSBqb2IucG9vbC5nZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShcbiAgICAgICAgICAgICAgb3Aub3duUmVzb2x2ZXJGbiwgYCR7ZnVsbFBhdGhOYW1lfV9EZWZlcl8ke29wLmhhbmRsZS5zbG90fV9EZXBzRm5gLFxuICAgICAgICAgICAgICAvKiBEb24ndCB1c2UgdW5pcXVlIG5hbWVzIGZvciBUREIgY29tcGF0aWJpbGl0eSAqLyBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==