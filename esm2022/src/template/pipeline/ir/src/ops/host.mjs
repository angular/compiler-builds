/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { OpKind } from '../enums';
import { TRAIT_CONSUMES_VARS } from '../traits';
import { NEW_OP } from './shared';
export function createHostPropertyOp(name, expression, sourceSpan) {
    return {
        kind: OpKind.HostProperty,
        name,
        expression,
        sourceSpan,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvb3BzL2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUVoQyxPQUFPLEVBQW9CLG1CQUFtQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRWpFLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFnQmhDLE1BQU0sVUFBVSxvQkFBb0IsQ0FDaEMsSUFBWSxFQUFFLFVBQXNDLEVBQ3BELFVBQWdDO0lBQ2xDLE9BQU87UUFDTCxJQUFJLEVBQUUsTUFBTSxDQUFDLFlBQVk7UUFDekIsSUFBSTtRQUNKLFVBQVU7UUFDVixVQUFVO1FBQ1YsR0FBRyxtQkFBbUI7UUFDdEIsR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9zcmMvb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9wYXJzZV91dGlsJztcbmltcG9ydCB7T3BLaW5kfSBmcm9tICcuLi9lbnVtcyc7XG5pbXBvcnQge09wfSBmcm9tICcuLi9vcGVyYXRpb25zJztcbmltcG9ydCB7Q29uc3VtZXNWYXJzVHJhaXQsIFRSQUlUX0NPTlNVTUVTX1ZBUlN9IGZyb20gJy4uL3RyYWl0cyc7XG5cbmltcG9ydCB7TkVXX09QfSBmcm9tICcuL3NoYXJlZCc7XG5cbmltcG9ydCB0eXBlIHtJbnRlcnBvbGF0aW9uLCBVcGRhdGVPcH0gZnJvbSAnLi91cGRhdGUnO1xuXG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGEgaG9zdCBiaW5kaW5nIHRvIGEgcHJvcGVydHkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSG9zdFByb3BlcnR5T3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4sIENvbnN1bWVzVmFyc1RyYWl0IHtcbiAga2luZDogT3BLaW5kLkhvc3RQcm9wZXJ0eTtcbiAgbmFtZTogc3RyaW5nO1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbjtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhvc3RQcm9wZXJ0eU9wKFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb24sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBIb3N0UHJvcGVydHlPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkhvc3RQcm9wZXJ0eSxcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9DT05TVU1FU19WQVJTLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cbiJdfQ==