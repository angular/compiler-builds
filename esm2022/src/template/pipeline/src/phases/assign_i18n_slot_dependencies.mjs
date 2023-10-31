/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Updates i18n expression ops to depend on the last slot in their owning i18n block.
 */
export function phaseAssignI18nSlotDependencies(job) {
    const i18nLastSlotConsumers = new Map();
    let lastSlotConsumer = null;
    for (const unit of job.units) {
        // Record the last consumed slot before each i18n end instruction.
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nEnd) {
                i18nLastSlotConsumers.set(op.xref, lastSlotConsumer);
            }
            if (ir.hasConsumesSlotTrait(op)) {
                lastSlotConsumer = op.xref;
            }
        }
        // Assign i18n expressions to target the last slot in its owning block.
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                op.target = i18nLastSlotConsumers.get(op.owner);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwrQkFBK0IsQ0FBQyxHQUFtQjtJQUNqRSxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQW1CLElBQUksQ0FBQztJQUM1QyxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsa0VBQWtFO1FBQ2xFLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Z0JBQ2pDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLGdCQUFpQixDQUFDLENBQUM7YUFDdkQ7WUFDRCxJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDL0IsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQzthQUM1QjtTQUNGO1FBRUQsdUVBQXVFO1FBQ3ZFLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7Z0JBQ3hDLEVBQUUsQ0FBQyxNQUFNLEdBQUcscUJBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsQ0FBQzthQUNsRDtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBVcGRhdGVzIGkxOG4gZXhwcmVzc2lvbiBvcHMgdG8gZGVwZW5kIG9uIHRoZSBsYXN0IHNsb3QgaW4gdGhlaXIgb3duaW5nIGkxOG4gYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUFzc2lnbkkxOG5TbG90RGVwZW5kZW5jaWVzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgaTE4bkxhc3RTbG90Q29uc3VtZXJzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLlhyZWZJZD4oKTtcbiAgbGV0IGxhc3RTbG90Q29uc3VtZXI6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlY29yZCB0aGUgbGFzdCBjb25zdW1lZCBzbG90IGJlZm9yZSBlYWNoIGkxOG4gZW5kIGluc3RydWN0aW9uLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkVuZCkge1xuICAgICAgICBpMThuTGFzdFNsb3RDb25zdW1lcnMuc2V0KG9wLnhyZWYsIGxhc3RTbG90Q29uc3VtZXIhKTtcbiAgICAgIH1cbiAgICAgIGlmIChpci5oYXNDb25zdW1lc1Nsb3RUcmFpdChvcCkpIHtcbiAgICAgICAgbGFzdFNsb3RDb25zdW1lciA9IG9wLnhyZWY7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXNzaWduIGkxOG4gZXhwcmVzc2lvbnMgdG8gdGFyZ2V0IHRoZSBsYXN0IHNsb3QgaW4gaXRzIG93bmluZyBibG9jay5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgICAgIG9wLnRhcmdldCA9IGkxOG5MYXN0U2xvdENvbnN1bWVycy5nZXQob3Aub3duZXIpITtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==