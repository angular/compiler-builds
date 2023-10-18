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
                        ops.push(ir.createI18nExpressionOp(i18nBlockId, expr, placeholder.name, ir.I18nParamResolutionTime.Creation, expr.sourceSpan ?? op.sourceSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFtQjtJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLFdBQVc7UUFDWCxJQUFJLGFBQWEsR0FBbUIsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO1FBQ2xELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUN4QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJO29CQUNqQixJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7d0JBQzFCLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQzt3QkFDdEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7cUJBQ25DO29CQUNELE1BQU07YUFDVDtTQUNGO1FBRUQsZ0dBQWdHO1FBQ2hHLGtDQUFrQztRQUNsQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxlQUFlO29CQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQzdCLFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUM7b0JBQzlDLE1BQU0sR0FBRyxHQUFrQixFQUFFLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzVELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM3QyxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUM5QixXQUFXLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFDeEUsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztxQkFDeEM7b0JBQ0QsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDbEIsbUZBQW1GO3FCQUNwRjtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNsRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVtb3ZlcyB0ZXh0IG5vZGVzIHdpdGhpbiBpMThuIGJsb2NrcyBzaW5jZSB0aGV5IGFyZSBhbHJlYWR5IGhhcmRjb2RlZCBpbnRvIHRoZSBpMThuIG1lc3NhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUkxOG5UZXh0RXh0cmFjdGlvbihqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZW1vdmUgYWxsIHRleHQgbm9kZXMgd2l0aGluIGkxOG4gYmxvY2tzLCB0aGVpciBjb250ZW50IGlzIGFscmVhZHkgY2FwdHVyZWQgaW4gdGhlIGkxOG5cbiAgICAvLyBtZXNzYWdlLlxuICAgIGxldCBjdXJyZW50STE4bklkOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgdGV4dE5vZGVzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLlhyZWZJZD4oKTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJMThuSWQgPSBvcC54cmVmO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRJMThuSWQgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZXh0OlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bklkICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZXMuc2V0KG9wLnhyZWYsIGN1cnJlbnRJMThuSWQpO1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgYW55IGludGVycG9sYXRpb25zIHRvIHRoZSByZW1vdmVkIHRleHQsIGFuZCBpbnN0ZWFkIHJlcHJlc2VudCB0aGVtIGFzIGEgc2VyaWVzIG9mIGkxOG5cbiAgICAvLyBleHByZXNzaW9ucyB0aGF0IHdlIHRoZW4gYXBwbHkuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgICAgICBpZiAoIXRleHROb2Rlcy5oYXMob3AudGFyZ2V0KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaTE4bkJsb2NrSWQgPSB0ZXh0Tm9kZXMuZ2V0KG9wLnRhcmdldCkhO1xuICAgICAgICAgIGNvbnN0IG9wczogaXIuVXBkYXRlT3BbXSA9IFtdO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXhwciA9IG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlciA9IG9wLmkxOG5QbGFjZWhvbGRlcnNbaV07XG4gICAgICAgICAgICBvcHMucHVzaChpci5jcmVhdGVJMThuRXhwcmVzc2lvbk9wKFxuICAgICAgICAgICAgICAgIGkxOG5CbG9ja0lkLCBleHByLCBwbGFjZWhvbGRlci5uYW1lLCBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbixcbiAgICAgICAgICAgICAgICBleHByLnNvdXJjZVNwYW4gPz8gb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3BzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5BcHBseU9wKGkxOG5CbG9ja0lkLCBvcC5pMThuUGxhY2Vob2xkZXJzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlV2l0aE1hbnkob3AgYXMgaXIuVXBkYXRlT3AsIG9wcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=