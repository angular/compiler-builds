/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Lifts i18n properties into the consts array.
 */
export function phaseI18nConstCollection(job) {
    // Serialize the extracted messages into the const array.
    // TODO: Use `Map` instead of object.
    const messageConstIndices = {};
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedMessage) {
                messageConstIndices[op.owner] = job.addConst(op.expression, op.statements);
                ir.OpList.remove(op);
            }
        }
    }
    // Assign const index to i18n ops that messages were extracted from.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart) {
                op.messageIndex = messageConstIndices[op.root];
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEdBQTRCO0lBQ25FLHlEQUF5RDtJQUN6RCxxQ0FBcUM7SUFDckMsTUFBTSxtQkFBbUIsR0FBcUMsRUFBRSxDQUFDO0lBQ2pFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQzFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzRSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzthQUNuQztTQUNGO0tBQ0Y7SUFFRCxvRUFBb0U7SUFDcEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7Z0JBQ25DLEVBQUUsQ0FBQyxZQUFZLEdBQUcsbUJBQW1CLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2hEO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIExpZnRzIGkxOG4gcHJvcGVydGllcyBpbnRvIHRoZSBjb25zdHMgYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUkxOG5Db25zdENvbGxlY3Rpb24oam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBTZXJpYWxpemUgdGhlIGV4dHJhY3RlZCBtZXNzYWdlcyBpbnRvIHRoZSBjb25zdCBhcnJheS5cbiAgLy8gVE9ETzogVXNlIGBNYXBgIGluc3RlYWQgb2Ygb2JqZWN0LlxuICBjb25zdCBtZXNzYWdlQ29uc3RJbmRpY2VzOiB7W2lkOiBpci5YcmVmSWRdOiBpci5Db25zdEluZGV4fSA9IHt9O1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlKSB7XG4gICAgICAgIG1lc3NhZ2VDb25zdEluZGljZXNbb3Aub3duZXJdID0gam9iLmFkZENvbnN0KG9wLmV4cHJlc3Npb24sIG9wLnN0YXRlbWVudHMpO1xuICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQXNzaWduIGNvbnN0IGluZGV4IHRvIGkxOG4gb3BzIHRoYXQgbWVzc2FnZXMgd2VyZSBleHRyYWN0ZWQgZnJvbS5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0KSB7XG4gICAgICAgIG9wLm1lc3NhZ2VJbmRleCA9IG1lc3NhZ2VDb25zdEluZGljZXNbb3Aucm9vdF07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=