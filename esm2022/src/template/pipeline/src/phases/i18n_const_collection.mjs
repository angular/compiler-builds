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
            if ((op.kind === ir.OpKind.I18nStart || op.kind === ir.OpKind.I18n) &&
                messageConstIndices[op.xref] !== undefined) {
                op.messageIndex = messageConstIndices[op.xref];
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEdBQTRCO0lBQ25FLHlEQUF5RDtJQUN6RCxxQ0FBcUM7SUFDckMsTUFBTSxtQkFBbUIsR0FBcUMsRUFBRSxDQUFDO0lBQ2pFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQzFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzRSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzthQUNuQztTQUNGO0tBQ0Y7SUFFRCxvRUFBb0U7SUFDcEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUMvRCxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO2dCQUM5QyxFQUFFLENBQUMsWUFBWSxHQUFHLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNoRDtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBMaWZ0cyBpMThuIHByb3BlcnRpZXMgaW50byB0aGUgY29uc3RzIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VJMThuQ29uc3RDb2xsZWN0aW9uKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gU2VyaWFsaXplIHRoZSBleHRyYWN0ZWQgbWVzc2FnZXMgaW50byB0aGUgY29uc3QgYXJyYXkuXG4gIC8vIFRPRE86IFVzZSBgTWFwYCBpbnN0ZWFkIG9mIG9iamVjdC5cbiAgY29uc3QgbWVzc2FnZUNvbnN0SW5kaWNlczoge1tpZDogaXIuWHJlZklkXTogaXIuQ29uc3RJbmRleH0gPSB7fTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkTWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlQ29uc3RJbmRpY2VzW29wLm93bmVyXSA9IGpvYi5hZGRDb25zdChvcC5leHByZXNzaW9uLCBvcC5zdGF0ZW1lbnRzKTtcbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEFzc2lnbiBjb25zdCBpbmRleCB0byBpMThuIG9wcyB0aGF0IG1lc3NhZ2VzIHdlcmUgZXh0cmFjdGVkIGZyb20uXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgfHwgb3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG4pICYmXG4gICAgICAgICAgbWVzc2FnZUNvbnN0SW5kaWNlc1tvcC54cmVmXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wLm1lc3NhZ2VJbmRleCA9IG1lc3NhZ2VDb25zdEluZGljZXNbb3AueHJlZl07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=