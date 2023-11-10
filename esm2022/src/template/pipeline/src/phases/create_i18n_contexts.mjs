/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Create one helper context op per i18n block (including generate descending blocks).
 *
 * Also, if an ICU exists inside an i18n block that also contains other localizable content (such as
 * string), create an additional helper context op for the ICU.
 *
 * These context ops are later used for generating i18n messages. (Although we generate at least one
 * context op per nested view, we will collect them up the tree later, to generate a top-level
 * message.)
 */
export function createI18nContexts(job) {
    let currentI18nOp = null;
    let xref;
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    // Each i18n block gets its own context.
                    xref = job.allocateXrefId();
                    unit.create.push(ir.createI18nContextOp(xref, op.xref, op.message, null));
                    op.context = xref;
                    currentI18nOp = op;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.IcuStart:
                    // If an ICU represents a different message than its containing block, we give it its own
                    // i18n context.
                    if (currentI18nOp === null) {
                        throw Error('Unexpected ICU outside of an i18n block.');
                    }
                    if (op.message.id !== currentI18nOp.message.id) {
                        // There was an enclosing i18n block around this ICU somewhere.
                        xref = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(xref, currentI18nOp.xref, op.message, null));
                        op.context = xref;
                    }
                    else {
                        // The i18n block was generated because of this ICU, OR it was explicit, but the ICU is
                        // the only localizable content inside of it.
                        op.context = currentI18nOp.context;
                    }
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUM5QyxJQUFJLElBQWUsQ0FBQztJQUNwQixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLHdDQUF3QztvQkFDeEMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQztvQkFDM0UsRUFBRSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7b0JBQ2xCLGFBQWEsR0FBRyxFQUFFLENBQUM7b0JBQ25CLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87b0JBQ3BCLGFBQWEsR0FBRyxJQUFJLENBQUM7b0JBQ3JCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLHlGQUF5RjtvQkFDekYsZ0JBQWdCO29CQUNoQixJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQztvQkFDMUQsQ0FBQztvQkFDRCxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQy9DLCtEQUErRDt3QkFDL0QsSUFBSSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQzt3QkFDdEYsRUFBRSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7b0JBQ3BCLENBQUM7eUJBQU0sQ0FBQzt3QkFDTix1RkFBdUY7d0JBQ3ZGLDZDQUE2Qzt3QkFDN0MsRUFBRSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO29CQUNyQyxDQUFDO29CQUNELE1BQU07WUFDVixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDcmVhdGUgb25lIGhlbHBlciBjb250ZXh0IG9wIHBlciBpMThuIGJsb2NrIChpbmNsdWRpbmcgZ2VuZXJhdGUgZGVzY2VuZGluZyBibG9ja3MpLlxuICpcbiAqIEFsc28sIGlmIGFuIElDVSBleGlzdHMgaW5zaWRlIGFuIGkxOG4gYmxvY2sgdGhhdCBhbHNvIGNvbnRhaW5zIG90aGVyIGxvY2FsaXphYmxlIGNvbnRlbnQgKHN1Y2ggYXNcbiAqIHN0cmluZyksIGNyZWF0ZSBhbiBhZGRpdGlvbmFsIGhlbHBlciBjb250ZXh0IG9wIGZvciB0aGUgSUNVLlxuICpcbiAqIFRoZXNlIGNvbnRleHQgb3BzIGFyZSBsYXRlciB1c2VkIGZvciBnZW5lcmF0aW5nIGkxOG4gbWVzc2FnZXMuIChBbHRob3VnaCB3ZSBnZW5lcmF0ZSBhdCBsZWFzdCBvbmVcbiAqIGNvbnRleHQgb3AgcGVyIG5lc3RlZCB2aWV3LCB3ZSB3aWxsIGNvbGxlY3QgdGhlbSB1cCB0aGUgdHJlZSBsYXRlciwgdG8gZ2VuZXJhdGUgYSB0b3AtbGV2ZWxcbiAqIG1lc3NhZ2UuKVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSTE4bkNvbnRleHRzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgbGV0IGN1cnJlbnRJMThuT3A6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICBsZXQgeHJlZjogaXIuWHJlZklkO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICAvLyBFYWNoIGkxOG4gYmxvY2sgZ2V0cyBpdHMgb3duIGNvbnRleHQuXG4gICAgICAgICAgeHJlZiA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaXIuY3JlYXRlSTE4bkNvbnRleHRPcCh4cmVmLCBvcC54cmVmLCBvcC5tZXNzYWdlLCBudWxsISkpO1xuICAgICAgICAgIG9wLmNvbnRleHQgPSB4cmVmO1xuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBvcDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSWN1U3RhcnQ6XG4gICAgICAgICAgLy8gSWYgYW4gSUNVIHJlcHJlc2VudHMgYSBkaWZmZXJlbnQgbWVzc2FnZSB0aGFuIGl0cyBjb250YWluaW5nIGJsb2NrLCB3ZSBnaXZlIGl0IGl0cyBvd25cbiAgICAgICAgICAvLyBpMThuIGNvbnRleHQuXG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuT3AgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdVbmV4cGVjdGVkIElDVSBvdXRzaWRlIG9mIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcC5tZXNzYWdlLmlkICE9PSBjdXJyZW50STE4bk9wLm1lc3NhZ2UuaWQpIHtcbiAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhbiBlbmNsb3NpbmcgaTE4biBibG9jayBhcm91bmQgdGhpcyBJQ1Ugc29tZXdoZXJlLlxuICAgICAgICAgICAgeHJlZiA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKHhyZWYsIGN1cnJlbnRJMThuT3AueHJlZiwgb3AubWVzc2FnZSwgbnVsbCEpKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSB4cmVmO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGUgaTE4biBibG9jayB3YXMgZ2VuZXJhdGVkIGJlY2F1c2Ugb2YgdGhpcyBJQ1UsIE9SIGl0IHdhcyBleHBsaWNpdCwgYnV0IHRoZSBJQ1UgaXNcbiAgICAgICAgICAgIC8vIHRoZSBvbmx5IGxvY2FsaXphYmxlIGNvbnRlbnQgaW5zaWRlIG9mIGl0LlxuICAgICAgICAgICAgb3AuY29udGV4dCA9IGN1cnJlbnRJMThuT3AuY29udGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=