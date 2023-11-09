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
export function extractI18nText(job) {
    for (const unit of job.units) {
        // Remove all text nodes within i18n blocks, their content is already captured in the i18n
        // message.
        let currentI18n = null;
        const textNodeI18nBlocks = new Map();
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    if (op.context === null) {
                        throw Error('I18n op should have its context set.');
                    }
                    currentI18n = op;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18n = null;
                    break;
                case ir.OpKind.Text:
                    if (currentI18n !== null) {
                        textNodeI18nBlocks.set(op.xref, currentI18n);
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
                    if (!textNodeI18nBlocks.has(op.target)) {
                        continue;
                    }
                    const i18nOp = textNodeI18nBlocks.get(op.target);
                    const ops = [];
                    for (let i = 0; i < op.interpolation.expressions.length; i++) {
                        const expr = op.interpolation.expressions[i];
                        const placeholder = op.i18nPlaceholders[i];
                        // For now, this i18nExpression depends on the slot context of the enclosing i18n block.
                        // Later, we will modify this, and advance to a different point.
                        ops.push(ir.createI18nExpressionOp(i18nOp.context, i18nOp.xref, i18nOp.handle, expr, placeholder.name, ir.I18nParamResolutionTime.Creation, expr.sourceSpan ?? op.sourceSpan));
                    }
                    ir.OpList.replaceWithMany(op, ops);
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBbUI7SUFDakQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsMEZBQTBGO1FBQzFGLFdBQVc7UUFDWCxJQUFJLFdBQVcsR0FBd0IsSUFBSSxDQUFDO1FBQzVDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7UUFDaEUsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixJQUFJLEVBQUUsQ0FBQyxPQUFPLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQ3hCLE1BQU0sS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7b0JBQ3RELENBQUM7b0JBQ0QsV0FBVyxHQUFHLEVBQUUsQ0FBQztvQkFDakIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztvQkFDcEIsV0FBVyxHQUFHLElBQUksQ0FBQztvQkFDbkIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSTtvQkFDakIsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQ3pCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO3dCQUM3QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztvQkFDcEMsQ0FBQztvQkFDRCxNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7UUFFRCxnR0FBZ0c7UUFDaEcsa0NBQWtDO1FBQ2xDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZTtvQkFDNUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzt3QkFDdkMsU0FBUztvQkFDWCxDQUFDO29CQUVELE1BQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUM7b0JBQ2xELE1BQU0sR0FBRyxHQUFrQixFQUFFLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzt3QkFDN0QsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzdDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDM0Msd0ZBQXdGO3dCQUN4RixnRUFBZ0U7d0JBQ2hFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUM5QixNQUFNLENBQUMsT0FBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksRUFDbkUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUM5RSxDQUFDO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEVBQWlCLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ2xELE1BQU07WUFDVixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZW1vdmVzIHRleHQgbm9kZXMgd2l0aGluIGkxOG4gYmxvY2tzIHNpbmNlIHRoZXkgYXJlIGFscmVhZHkgaGFyZGNvZGVkIGludG8gdGhlIGkxOG4gbWVzc2FnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RJMThuVGV4dChqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZW1vdmUgYWxsIHRleHQgbm9kZXMgd2l0aGluIGkxOG4gYmxvY2tzLCB0aGVpciBjb250ZW50IGlzIGFscmVhZHkgY2FwdHVyZWQgaW4gdGhlIGkxOG5cbiAgICAvLyBtZXNzYWdlLlxuICAgIGxldCBjdXJyZW50STE4bjogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgdGV4dE5vZGVJMThuQmxvY2tzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaWYgKG9wLmNvbnRleHQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdJMThuIG9wIHNob3VsZCBoYXZlIGl0cyBjb250ZXh0IHNldC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3VycmVudEkxOG4gPSBvcDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50STE4biA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZUkxOG5CbG9ja3Muc2V0KG9wLnhyZWYsIGN1cnJlbnRJMThuKTtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGFueSBpbnRlcnBvbGF0aW9ucyB0byB0aGUgcmVtb3ZlZCB0ZXh0LCBhbmQgaW5zdGVhZCByZXByZXNlbnQgdGhlbSBhcyBhIHNlcmllcyBvZiBpMThuXG4gICAgLy8gZXhwcmVzc2lvbnMgdGhhdCB3ZSB0aGVuIGFwcGx5LlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAgICAgaWYgKCF0ZXh0Tm9kZUkxOG5CbG9ja3MuaGFzKG9wLnRhcmdldCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGkxOG5PcCA9IHRleHROb2RlSTE4bkJsb2Nrcy5nZXQob3AudGFyZ2V0KSE7XG4gICAgICAgICAgY29uc3Qgb3BzOiBpci5VcGRhdGVPcFtdID0gW107XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBleHByID0gb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gb3AuaTE4blBsYWNlaG9sZGVyc1tpXTtcbiAgICAgICAgICAgIC8vIEZvciBub3csIHRoaXMgaTE4bkV4cHJlc3Npb24gZGVwZW5kcyBvbiB0aGUgc2xvdCBjb250ZXh0IG9mIHRoZSBlbmNsb3NpbmcgaTE4biBibG9jay5cbiAgICAgICAgICAgIC8vIExhdGVyLCB3ZSB3aWxsIG1vZGlmeSB0aGlzLCBhbmQgYWR2YW5jZSB0byBhIGRpZmZlcmVudCBwb2ludC5cbiAgICAgICAgICAgIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgICAgICAgICAgICAgaTE4bk9wLmNvbnRleHQhLCBpMThuT3AueHJlZiwgaTE4bk9wLmhhbmRsZSwgZXhwciwgcGxhY2Vob2xkZXIubmFtZSxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbiwgZXhwci5zb3VyY2VTcGFuID8/IG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2VXaXRoTWFueShvcCBhcyBpci5VcGRhdGVPcCwgb3BzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==