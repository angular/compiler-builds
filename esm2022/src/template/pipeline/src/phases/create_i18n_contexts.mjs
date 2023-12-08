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
    const rootContexts = new Map();
    let currentI18nOp = null;
    let xref;
    // We use the message instead of the message ID, because placeholder values might differ even
    // when IDs are the same.
    const messageToContext = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nOp = op;
                    // Each root i18n block gets its own context, child ones refer to the context for their
                    // root block.
                    if (op.xref === op.root) {
                        xref = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.RootI18n, xref, op.xref, op.message, null));
                        op.context = xref;
                        rootContexts.set(op.xref, xref);
                    }
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
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.Icu, xref, currentI18nOp.xref, op.message, null));
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
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Binding:
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                case ir.OpKind.ExtractedAttribute:
                    if (!op.i18nMessage) {
                        continue;
                    }
                    if (!messageToContext.has(op.i18nMessage)) {
                        // create the context
                        const i18nContext = job.allocateXrefId();
                        unit.create.push(ir.createI18nContextOp(ir.I18nContextKind.Attr, i18nContext, null, op.i18nMessage, null));
                        messageToContext.set(op.i18nMessage, i18nContext);
                    }
                    op.i18nContext = messageToContext.get(op.i18nMessage);
                    break;
            }
        }
    }
    // Assign contexts to child i18n blocks, now that all root i18n blocks have their context
    // assigned.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.xref !== op.root) {
                op.context = rootContexts.get(op.root);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFDckQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztJQUM5QyxJQUFJLElBQWUsQ0FBQztJQUdwQiw2RkFBNkY7SUFDN0YseUJBQXlCO0lBQ3pCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7SUFFNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUM7b0JBQ25CLHVGQUF1RjtvQkFDdkYsY0FBYztvQkFDZCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRTt3QkFDdkIsSUFBSSxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUNuQyxFQUFFLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFF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LENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBQzthQUN6QztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ3JlYXRlIG9uZSBoZWxwZXIgY29udGV4dCBvcCBwZXIgaTE4biBibG9jayAoaW5jbHVkaW5nIGdlbmVyYXRlIGRlc2NlbmRpbmcgYmxvY2tzKS5cbiAqXG4gKiBBbHNvLCBpZiBhbiBJQ1UgZXhpc3RzIGluc2lkZSBhbiBpMThuIGJsb2NrIHRoYXQgYWxzbyBjb250YWlucyBvdGhlciBsb2NhbGl6YWJsZSBjb250ZW50IChzdWNoIGFzXG4gKiBzdHJpbmcpLCBjcmVhdGUgYW4gYWRkaXRpb25hbCBoZWxwZXIgY29udGV4dCBvcCBmb3IgdGhlIElDVS5cbiAqXG4gKiBUaGVzZSBjb250ZXh0IG9wcyBhcmUgbGF0ZXIgdXNlZCBmb3IgZ2VuZXJhdGluZyBpMThuIG1lc3NhZ2VzLiAoQWx0aG91Z2ggd2UgZ2VuZXJhdGUgYXQgbGVhc3Qgb25lXG4gKiBjb250ZXh0IG9wIHBlciBuZXN0ZWQgdmlldywgd2Ugd2lsbCBjb2xsZWN0IHRoZW0gdXAgdGhlIHRyZWUgbGF0ZXIsIHRvIGdlbmVyYXRlIGEgdG9wLWxldmVsXG4gKiBtZXNzYWdlLilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5Db250ZXh0cyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGNvbnN0IHJvb3RDb250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5YcmVmSWQ+KCk7XG4gIGxldCBjdXJyZW50STE4bk9wOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcbiAgbGV0IHhyZWY6IGlyLlhyZWZJZDtcblxuXG4gIC8vIFdlIHVzZSB0aGUgbWVzc2FnZSBpbnN0ZWFkIG9mIHRoZSBtZXNzYWdlIElELCBiZWNhdXNlIHBsYWNlaG9sZGVyIHZhbHVlcyBtaWdodCBkaWZmZXIgZXZlblxuICAvLyB3aGVuIElEcyBhcmUgdGhlIHNhbWUuXG4gIGNvbnN0IG1lc3NhZ2VUb0NvbnRleHQgPSBuZXcgTWFwPGkxOG4uTWVzc2FnZSwgaXIuWHJlZklkPigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBvcDtcbiAgICAgICAgICAvLyBFYWNoIHJvb3QgaTE4biBibG9jayBnZXRzIGl0cyBvd24gY29udGV4dCwgY2hpbGQgb25lcyByZWZlciB0byB0aGUgY29udGV4dCBmb3IgdGhlaXJcbiAgICAgICAgICAvLyByb290IGJsb2NrLlxuICAgICAgICAgIGlmIChvcC54cmVmID09PSBvcC5yb290KSB7XG4gICAgICAgICAgICB4cmVmID0gam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGlyLmNyZWF0ZUkxOG5Db250ZXh0T3AoXG4gICAgICAgICAgICAgICAgaXIuSTE4bkNvbnRleHRLaW5kLlJvb3RJMThuLCB4cmVmLCBvcC54cmVmLCBvcC5tZXNzYWdlLCBudWxsISkpO1xuICAgICAgICAgICAgb3AuY29udGV4dCA9IHhyZWY7XG4gICAgICAgICAgICByb290Q29udGV4dHMuc2V0KG9wLnhyZWYsIHhyZWYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSWN1U3RhcnQ6XG4gICAgICAgICAgLy8gSWYgYW4gSUNVIHJlcHJlc2VudHMgYSBkaWZmZXJlbnQgbWVzc2FnZSB0aGFuIGl0cyBjb250YWluaW5nIGJsb2NrLCB3ZSBnaXZlIGl0IGl0cyBvd25cbiAgICAgICAgICAvLyBpMThuIGNvbnRleHQuXG4gICAgICAgICAgaWYgKGN1cnJlbnRJMThuT3AgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdVbmV4cGVjdGVkIElDVSBvdXRzaWRlIG9mIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcC5tZXNzYWdlLmlkICE9PSBjdXJyZW50STE4bk9wLm1lc3NhZ2UuaWQpIHtcbiAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhbiBlbmNsb3NpbmcgaTE4biBibG9jayBhcm91bmQgdGhpcyBJQ1Ugc29tZXdoZXJlLlxuICAgICAgICAgICAgeHJlZiA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKFxuICAgICAgICAgICAgICAgIGlyLkkxOG5Db250ZXh0S2luZC5JY3UsIHhyZWYsIGN1cnJlbnRJMThuT3AueHJlZiwgb3AubWVzc2FnZSwgbnVsbCEpKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSB4cmVmO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGUgaTE4biBibG9jayB3YXMgZ2VuZXJhdGVkIGJlY2F1c2Ugb2YgdGhpcyBJQ1UsIE9SIGl0IHdhcyBleHBsaWNpdCwgYnV0IHRoZSBJQ1UgaXNcbiAgICAgICAgICAgIC8vIHRoZSBvbmx5IGxvY2FsaXphYmxlIGNvbnRlbnQgaW5zaWRlIG9mIGl0LlxuICAgICAgICAgICAgb3AuY29udGV4dCA9IGN1cnJlbnRJMThuT3AuY29udGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQmluZGluZzpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlOlxuICAgICAgICAgIGlmICghb3AuaTE4bk1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIW1lc3NhZ2VUb0NvbnRleHQuaGFzKG9wLmkxOG5NZXNzYWdlKSkge1xuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBjb250ZXh0XG4gICAgICAgICAgICBjb25zdCBpMThuQ29udGV4dCA9IGpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpci5jcmVhdGVJMThuQ29udGV4dE9wKFxuICAgICAgICAgICAgICAgIGlyLkkxOG5Db250ZXh0S2luZC5BdHRyLCBpMThuQ29udGV4dCwgbnVsbCwgb3AuaTE4bk1lc3NhZ2UsIG51bGwhKSk7XG4gICAgICAgICAgICBtZXNzYWdlVG9Db250ZXh0LnNldChvcC5pMThuTWVzc2FnZSwgaTE4bkNvbnRleHQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9wLmkxOG5Db250ZXh0ID0gbWVzc2FnZVRvQ29udGV4dC5nZXQob3AuaTE4bk1lc3NhZ2UpITtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NpZ24gY29udGV4dHMgdG8gY2hpbGQgaTE4biBibG9ja3MsIG5vdyB0aGF0IGFsbCByb290IGkxOG4gYmxvY2tzIGhhdmUgdGhlaXIgY29udGV4dFxuICAvLyBhc3NpZ25lZC5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0ICYmIG9wLnhyZWYgIT09IG9wLnJvb3QpIHtcbiAgICAgICAgb3AuY29udGV4dCA9IHJvb3RDb250ZXh0cy5nZXQob3Aucm9vdCkhO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19