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
            if (op.kind === ir.OpKind.I18nStart && messageConstIndices[op.xref] !== undefined) {
                op.messageIndex = messageConstIndices[op.xref];
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9jb25zdF9jb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvaTE4bl9jb25zdF9jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEdBQTRCO0lBQ25FLHlEQUF5RDtJQUN6RCxxQ0FBcUM7SUFDckMsTUFBTSxtQkFBbUIsR0FBcUMsRUFBRSxDQUFDO0lBQ2pFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQzFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzRSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzthQUNuQztTQUNGO0tBQ0Y7SUFFRCxvRUFBb0U7SUFDcEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksbUJBQW1CLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRTtnQkFDakYsRUFBRSxDQUFDLFlBQVksR0FBRyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDaEQ7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge3R5cGUgQ29tcGlsYXRpb25Kb2IsIENvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogTGlmdHMgaTE4biBwcm9wZXJ0aWVzIGludG8gdGhlIGNvbnN0cyBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlSTE4bkNvbnN0Q29sbGVjdGlvbihqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIFNlcmlhbGl6ZSB0aGUgZXh0cmFjdGVkIG1lc3NhZ2VzIGludG8gdGhlIGNvbnN0IGFycmF5LlxuICAvLyBUT0RPOiBVc2UgYE1hcGAgaW5zdGVhZCBvZiBvYmplY3QuXG4gIGNvbnN0IG1lc3NhZ2VDb25zdEluZGljZXM6IHtbaWQ6IGlyLlhyZWZJZF06IGlyLkNvbnN0SW5kZXh9ID0ge307XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZE1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZUNvbnN0SW5kaWNlc1tvcC5vd25lcl0gPSBqb2IuYWRkQ29uc3Qob3AuZXhwcmVzc2lvbiwgb3Auc3RhdGVtZW50cyk7XG4gICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NpZ24gY29uc3QgaW5kZXggdG8gaTE4biBvcHMgdGhhdCBtZXNzYWdlcyB3ZXJlIGV4dHJhY3RlZCBmcm9tLlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgJiYgbWVzc2FnZUNvbnN0SW5kaWNlc1tvcC54cmVmXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wLm1lc3NhZ2VJbmRleCA9IG1lc3NhZ2VDb25zdEluZGljZXNbb3AueHJlZl07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=