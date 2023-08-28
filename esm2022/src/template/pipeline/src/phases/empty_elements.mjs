/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
const REPLACEMENTS = new Map([
    [ir.OpKind.ElementEnd, [ir.OpKind.ElementStart, ir.OpKind.Element]],
    [ir.OpKind.ContainerEnd, [ir.OpKind.ContainerStart, ir.OpKind.Container]],
    [ir.OpKind.I18nEnd, [ir.OpKind.I18nStart, ir.OpKind.I18n]],
]);
/**
 * Replace sequences of mergable elements (e.g. `ElementStart` and `ElementEnd`) with a consolidated
 * element (e.g. `Element`).
 */
export function phaseEmptyElements(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            const opReplacements = REPLACEMENTS.get(op.kind);
            if (opReplacements === undefined) {
                continue;
            }
            const [startKind, mergedKind] = opReplacements;
            if (op.prev !== null && op.prev.kind === startKind) {
                // Transmute the start instruction to the merged version. This is safe as they're designed
                // to be identical apart from the `kind`.
                op.prev.kind = mergedKind;
                // Remove the end instruction.
                ir.OpList.remove(op);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1wdHlfZWxlbWVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9lbXB0eV9lbGVtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBb0M7SUFDOUQsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbkUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDM0QsQ0FBQyxDQUFDO0FBRUg7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLEdBQW1CO0lBQ3BELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakQsSUFBSSxjQUFjLEtBQUssU0FBUyxFQUFFO2dCQUNoQyxTQUFTO2FBQ1Y7WUFDRCxNQUFNLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLGNBQWMsQ0FBQztZQUMvQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtnQkFDbEQsMEZBQTBGO2dCQUMxRix5Q0FBeUM7Z0JBQ3hDLEVBQUUsQ0FBQyxJQUEyQixDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7Z0JBRWxELDhCQUE4QjtnQkFDOUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7YUFDbkM7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuY29uc3QgUkVQTEFDRU1FTlRTID0gbmV3IE1hcDxpci5PcEtpbmQsIFtpci5PcEtpbmQsIGlyLk9wS2luZF0+KFtcbiAgW2lyLk9wS2luZC5FbGVtZW50RW5kLCBbaXIuT3BLaW5kLkVsZW1lbnRTdGFydCwgaXIuT3BLaW5kLkVsZW1lbnRdXSxcbiAgW2lyLk9wS2luZC5Db250YWluZXJFbmQsIFtpci5PcEtpbmQuQ29udGFpbmVyU3RhcnQsIGlyLk9wS2luZC5Db250YWluZXJdXSxcbiAgW2lyLk9wS2luZC5JMThuRW5kLCBbaXIuT3BLaW5kLkkxOG5TdGFydCwgaXIuT3BLaW5kLkkxOG5dXSxcbl0pO1xuXG4vKipcbiAqIFJlcGxhY2Ugc2VxdWVuY2VzIG9mIG1lcmdhYmxlIGVsZW1lbnRzIChlLmcuIGBFbGVtZW50U3RhcnRgIGFuZCBgRWxlbWVudEVuZGApIHdpdGggYSBjb25zb2xpZGF0ZWRcbiAqIGVsZW1lbnQgKGUuZy4gYEVsZW1lbnRgKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlRW1wdHlFbGVtZW50cyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBjb25zdCBvcFJlcGxhY2VtZW50cyA9IFJFUExBQ0VNRU5UUy5nZXQob3Aua2luZCk7XG4gICAgICBpZiAob3BSZXBsYWNlbWVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IFtzdGFydEtpbmQsIG1lcmdlZEtpbmRdID0gb3BSZXBsYWNlbWVudHM7XG4gICAgICBpZiAob3AucHJldiAhPT0gbnVsbCAmJiBvcC5wcmV2LmtpbmQgPT09IHN0YXJ0S2luZCkge1xuICAgICAgICAvLyBUcmFuc211dGUgdGhlIHN0YXJ0IGluc3RydWN0aW9uIHRvIHRoZSBtZXJnZWQgdmVyc2lvbi4gVGhpcyBpcyBzYWZlIGFzIHRoZXkncmUgZGVzaWduZWRcbiAgICAgICAgLy8gdG8gYmUgaWRlbnRpY2FsIGFwYXJ0IGZyb20gdGhlIGBraW5kYC5cbiAgICAgICAgKG9wLnByZXYgYXMgaXIuT3A8aXIuQ3JlYXRlT3A+KS5raW5kID0gbWVyZ2VkS2luZDtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIGVuZCBpbnN0cnVjdGlvbi5cbiAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19