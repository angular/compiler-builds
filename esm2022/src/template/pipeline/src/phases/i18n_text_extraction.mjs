/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Removes text nodes within i18n blocks since they are already hardcoded into the i18n message.
 */
export function phaseI18nTextExtraction(job) {
    for (const unit of job.units) {
        // Remove all text nodes within i18n blocks, their content is already captured in the i18n
        // message.
        let currentI18nId = null;
        const textNodes = new Map();
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nId = op.xref;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nId = null;
                    break;
                case ir.OpKind.Text:
                    if (currentI18nId !== null) {
                        textNodes.set(op.xref, currentI18nId);
                        ir.OpList.remove(op);
                    }
                    break;
            }
        }
        // Update any interpolations to the removed text, and instead represent them as a series of i18n
        // expressions that we then apply.
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.InterpolateText:
                    if (!textNodes.has(op.target)) {
                        continue;
                    }
                    const i18nBlockId = textNodes.get(op.target);
                    const ops = [];
                    for (let i = 0; i < op.interpolation.expressions.length; i++) {
                        const expr = op.interpolation.expressions[i];
                        const placeholder = op.i18nPlaceholders[i];
                        ops.push(ir.createI18nExpressionOp(i18nBlockId, expr, placeholder, expr.sourceSpan ?? op.sourceSpan));
                    }
                    if (ops.length > 0) {
                        // ops.push(ir.createI18nApplyOp(i18nBlockId, op.i18nPlaceholders, op.sourceSpan));
                    }
                    ir.OpList.replaceWithMany(op, ops);
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFtQjtJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLFdBQVc7UUFDWCxJQUFJLGFBQWEsR0FBbUIsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO1FBQ2xELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUN4QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJO29CQUNqQixJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7d0JBQzFCLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQzt3QkFDdEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7cUJBQ25DO29CQUNELE1BQU07YUFDVDtTQUNGO1FBRUQsZ0dBQWdHO1FBQ2hHLGtDQUFrQztRQUNsQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxlQUFlO29CQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQzdCLFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUM7b0JBQzlDLE1BQU0sR0FBRyxHQUFrQixFQUFFLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzVELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM3QyxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUM5QixXQUFXLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3FCQUN4RTtvQkFDRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO3dCQUNsQixtRkFBbUY7cUJBQ3BGO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEVBQWlCLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ2xELE1BQU07YUFDVDtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZW1vdmVzIHRleHQgbm9kZXMgd2l0aGluIGkxOG4gYmxvY2tzIHNpbmNlIHRoZXkgYXJlIGFscmVhZHkgaGFyZGNvZGVkIGludG8gdGhlIGkxOG4gbWVzc2FnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlSTE4blRleHRFeHRyYWN0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlbW92ZSBhbGwgdGV4dCBub2RlcyB3aXRoaW4gaTE4biBibG9ja3MsIHRoZWlyIGNvbnRlbnQgaXMgYWxyZWFkeSBjYXB0dXJlZCBpbiB0aGUgaTE4blxuICAgIC8vIG1lc3NhZ2UuXG4gICAgbGV0IGN1cnJlbnRJMThuSWQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBjb25zdCB0ZXh0Tm9kZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuWHJlZklkPigpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgY3VycmVudEkxOG5JZCA9IG9wLnhyZWY7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG5JZCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRleHROb2Rlcy5zZXQob3AueHJlZiwgY3VycmVudEkxOG5JZCk7XG4gICAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBhbnkgaW50ZXJwb2xhdGlvbnMgdG8gdGhlIHJlbW92ZWQgdGV4dCwgYW5kIGluc3RlYWQgcmVwcmVzZW50IHRoZW0gYXMgYSBzZXJpZXMgb2YgaTE4blxuICAgIC8vIGV4cHJlc3Npb25zIHRoYXQgd2UgdGhlbiBhcHBseS5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgICAgIGlmICghdGV4dE5vZGVzLmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpMThuQmxvY2tJZCA9IHRleHROb2Rlcy5nZXQob3AudGFyZ2V0KSE7XG4gICAgICAgICAgY29uc3Qgb3BzOiBpci5VcGRhdGVPcFtdID0gW107XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBleHByID0gb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gb3AuaTE4blBsYWNlaG9sZGVyc1tpXTtcbiAgICAgICAgICAgIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgICAgICAgICAgICAgaTE4bkJsb2NrSWQsIGV4cHIsIHBsYWNlaG9sZGVyLCBleHByLnNvdXJjZVNwYW4gPz8gb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3BzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5BcHBseU9wKGkxOG5CbG9ja0lkLCBvcC5pMThuUGxhY2Vob2xkZXJzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlV2l0aE1hbnkob3AgYXMgaXIuVXBkYXRlT3AsIG9wcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=