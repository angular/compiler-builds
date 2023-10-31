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
        let currentI18nSlot = null;
        const textNodes = new Map();
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nId = op.xref;
                    currentI18nSlot = op.slot;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nId = null;
                    currentI18nSlot = null;
                    break;
                case ir.OpKind.Text:
                    if (currentI18nId !== null && currentI18nSlot !== null) {
                        textNodes.set(op.xref, { xref: currentI18nId, slot: currentI18nSlot });
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
                    const i18nBlock = textNodes.get(op.target);
                    const ops = [];
                    for (let i = 0; i < op.interpolation.expressions.length; i++) {
                        const expr = op.interpolation.expressions[i];
                        const placeholder = op.i18nPlaceholders[i];
                        ops.push(ir.createI18nExpressionOp(i18nBlock.xref, i18nBlock.slot, expr, placeholder.name, ir.I18nParamResolutionTime.Creation, expr.sourceSpan ?? op.sourceSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFtQjtJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLFdBQVc7UUFDWCxJQUFJLGFBQWEsR0FBbUIsSUFBSSxDQUFDO1FBQ3pDLElBQUksZUFBZSxHQUF1QixJQUFJLENBQUM7UUFDL0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQXFELENBQUM7UUFDL0UsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsYUFBYSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUM7b0JBQ3hCLGVBQWUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUMxQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUNyQixlQUFlLEdBQUcsSUFBSSxDQUFDO29CQUN2QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJO29CQUNqQixJQUFJLGFBQWEsS0FBSyxJQUFJLElBQUksZUFBZSxLQUFLLElBQUksRUFBRTt3QkFDdEQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFDLENBQUMsQ0FBQzt3QkFDckUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7cUJBQ25DO29CQUNELE1BQU07YUFDVDtTQUNGO1FBRUQsZ0dBQWdHO1FBQ2hHLGtDQUFrQztRQUNsQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxlQUFlO29CQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQzdCLFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFFLENBQUM7b0JBQzVDLE1BQU0sR0FBRyxHQUFrQixFQUFFLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzVELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM3QyxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUM5QixTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQ3RELEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztxQkFDN0U7b0JBQ0QsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDbEIsbUZBQW1GO3FCQUNwRjtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNsRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVtb3ZlcyB0ZXh0IG5vZGVzIHdpdGhpbiBpMThuIGJsb2NrcyBzaW5jZSB0aGV5IGFyZSBhbHJlYWR5IGhhcmRjb2RlZCBpbnRvIHRoZSBpMThuIG1lc3NhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUkxOG5UZXh0RXh0cmFjdGlvbihqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZW1vdmUgYWxsIHRleHQgbm9kZXMgd2l0aGluIGkxOG4gYmxvY2tzLCB0aGVpciBjb250ZW50IGlzIGFscmVhZHkgY2FwdHVyZWQgaW4gdGhlIGkxOG5cbiAgICAvLyBtZXNzYWdlLlxuICAgIGxldCBjdXJyZW50STE4bklkOiBpci5YcmVmSWR8bnVsbCA9IG51bGw7XG4gICAgbGV0IGN1cnJlbnRJMThuU2xvdDogaXIuU2xvdEhhbmRsZXxudWxsID0gbnVsbDtcbiAgICBjb25zdCB0ZXh0Tm9kZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwge3hyZWY6IGlyLlhyZWZJZCwgc2xvdDogaXIuU2xvdEhhbmRsZX0+KCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBjdXJyZW50STE4bklkID0gb3AueHJlZjtcbiAgICAgICAgICBjdXJyZW50STE4blNsb3QgPSBvcC5zbG90O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRJMThuSWQgPSBudWxsO1xuICAgICAgICAgIGN1cnJlbnRJMThuU2xvdCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlRleHQ6XG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuSWQgIT09IG51bGwgJiYgY3VycmVudEkxOG5TbG90ICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZXMuc2V0KG9wLnhyZWYsIHt4cmVmOiBjdXJyZW50STE4bklkLCBzbG90OiBjdXJyZW50STE4blNsb3R9KTtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGFueSBpbnRlcnBvbGF0aW9ucyB0byB0aGUgcmVtb3ZlZCB0ZXh0LCBhbmQgaW5zdGVhZCByZXByZXNlbnQgdGhlbSBhcyBhIHNlcmllcyBvZiBpMThuXG4gICAgLy8gZXhwcmVzc2lvbnMgdGhhdCB3ZSB0aGVuIGFwcGx5LlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAgICAgaWYgKCF0ZXh0Tm9kZXMuaGFzKG9wLnRhcmdldCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGkxOG5CbG9jayA9IHRleHROb2Rlcy5nZXQob3AudGFyZ2V0KSE7XG4gICAgICAgICAgY29uc3Qgb3BzOiBpci5VcGRhdGVPcFtdID0gW107XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBleHByID0gb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gb3AuaTE4blBsYWNlaG9sZGVyc1tpXTtcbiAgICAgICAgICAgIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgICAgICAgICAgICAgaTE4bkJsb2NrLnhyZWYsIGkxOG5CbG9jay5zbG90LCBleHByLCBwbGFjZWhvbGRlci5uYW1lLFxuICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uLCBleHByLnNvdXJjZVNwYW4gPz8gb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3BzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5BcHBseU9wKGkxOG5CbG9ja0lkLCBvcC5pMThuUGxhY2Vob2xkZXJzLCBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlV2l0aE1hbnkob3AgYXMgaXIuVXBkYXRlT3AsIG9wcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=