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
    // Create i18n context ops for i18n attrs.
    const attrContextByMessage = new Map();
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Binding:
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                case ir.OpKind.ExtractedAttribute:
                    if (op.i18nMessage === null) {
                        continue;
                    }
                    if (!attrContextByMessage.has(op.i18nMessage)) {
                        const i18nContext = ir.createI18nContextOp(ir.I18nContextKind.Attr, job.allocateXrefId(), null, op.i18nMessage, null);
                        unit.create.push(i18nContext);
                        attrContextByMessage.set(op.i18nMessage, i18nContext.xref);
                    }
                    op.i18nContext = attrContextByMessage.get(op.i18nMessage);
                    break;
            }
        }
    }
    // Create i18n context ops for root i18n blocks.
    const blockContextByI18nBlock = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    if (op.xref === op.root) {
                        const contextOp = ir.createI18nContextOp(ir.I18nContextKind.RootI18n, job.allocateXrefId(), op.xref, op.message, null);
                        unit.create.push(contextOp);
                        op.context = contextOp.xref;
                        blockContextByI18nBlock.set(op.xref, contextOp);
                    }
                    break;
            }
        }
    }
    // Assign i18n contexts for child i18n blocks. These don't need their own conext, instead they
    // should inherit from their root i18n block.
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.xref !== op.root) {
                const rootContext = blockContextByI18nBlock.get(op.root);
                if (rootContext === undefined) {
                    throw Error('AssertionError: Root i18n block i18n context should have been created.');
                }
                op.context = rootContext.xref;
                blockContextByI18nBlock.set(op.xref, rootContext);
            }
        }
    }
    // Create or assign i18n contexts for ICUs.
    let currentI18nOp = null;
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nOp = op;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.IcuStart:
                    if (currentI18nOp === null) {
                        throw Error('AssertionError: Unexpected ICU outside of an i18n block.');
                    }
                    if (op.message.id !== currentI18nOp.message.id) {
                        // This ICU is a sub-message inside its parent i18n block message. We need to give it
                        // its own context.
                        const contextOp = ir.createI18nContextOp(ir.I18nContextKind.Icu, job.allocateXrefId(), currentI18nOp.xref, op.message, null);
                        unit.create.push(contextOp);
                        op.context = contextOp.xref;
                    }
                    else {
                        // This ICU is the only translatable content in its parent i18n block. We need to
                        // convert the parent's context into an ICU context.
                        op.context = currentI18nOp.context;
                        blockContextByI18nBlock.get(currentI18nOp.xref).contextKind = ir.I18nContextKind.Icu;
                    }
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2kxOG5fY29udGV4dHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9jcmVhdGVfaTE4bl9jb250ZXh0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBbUI7SUFDcEQsMENBQTBDO0lBQzFDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7SUFDaEUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO2dCQUN2QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO2dCQUN4QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO2dCQUN6QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsa0JBQWtCO29CQUMvQixJQUFJLEVBQUUsQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO3dCQUMzQixTQUFTO3FCQUNWO29CQUNELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFO3dCQUM3QyxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQ3RDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLFdB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RCxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO3dCQUM5QyxxRkFBcUY7d0JBQ3JGLG1CQUFtQjt3QkFDbkIsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUNwQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsYUFBYSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUssQ0FDdEYsQ0FBQzt3QkFDRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDNUIsRUFBRSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO3FCQUM3Qjt5QkFBTTt3QkFDTCxpRkFBaUY7d0JBQ2pGLG9EQUFvRDt3QkFDcEQsRUFBRSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO3dCQUNuQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBRSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQztxQkFDdkY7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDcmVhdGUgb25lIGhlbHBlciBjb250ZXh0IG9wIHBlciBpMThuIGJsb2NrIChpbmNsdWRpbmcgZ2VuZXJhdGUgZGVzY2VuZGluZyBibG9ja3MpLlxuICpcbiAqIEFsc28sIGlmIGFuIElDVSBleGlzdHMgaW5zaWRlIGFuIGkxOG4gYmxvY2sgdGhhdCBhbHNvIGNvbnRhaW5zIG90aGVyIGxvY2FsaXphYmxlIGNvbnRlbnQgKHN1Y2ggYXNcbiAqIHN0cmluZyksIGNyZWF0ZSBhbiBhZGRpdGlvbmFsIGhlbHBlciBjb250ZXh0IG9wIGZvciB0aGUgSUNVLlxuICpcbiAqIFRoZXNlIGNvbnRleHQgb3BzIGFyZSBsYXRlciB1c2VkIGZvciBnZW5lcmF0aW5nIGkxOG4gbWVzc2FnZXMuIChBbHRob3VnaCB3ZSBnZW5lcmF0ZSBhdCBsZWFzdCBvbmVcbiAqIGNvbnRleHQgb3AgcGVyIG5lc3RlZCB2aWV3LCB3ZSB3aWxsIGNvbGxlY3QgdGhlbSB1cCB0aGUgdHJlZSBsYXRlciwgdG8gZ2VuZXJhdGUgYSB0b3AtbGV2ZWxcbiAqIG1lc3NhZ2UuKVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSTE4bkNvbnRleHRzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gQ3JlYXRlIGkxOG4gY29udGV4dCBvcHMgZm9yIGkxOG4gYXR0cnMuXG4gIGNvbnN0IGF0dHJDb250ZXh0QnlNZXNzYWdlID0gbmV3IE1hcDxpMThuLk1lc3NhZ2UsIGlyLlhyZWZJZD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkJpbmRpbmc6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZTpcbiAgICAgICAgICBpZiAob3AuaTE4bk1lc3NhZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWF0dHJDb250ZXh0QnlNZXNzYWdlLmhhcyhvcC5pMThuTWVzc2FnZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGkxOG5Db250ZXh0ID0gaXIuY3JlYXRlSTE4bkNvbnRleHRPcChcbiAgICAgICAgICAgICAgICBpci5JMThuQ29udGV4dEtpbmQuQXR0ciwgam9iLmFsbG9jYXRlWHJlZklkKCksIG51bGwsIG9wLmkxOG5NZXNzYWdlLCBudWxsISk7XG4gICAgICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGkxOG5Db250ZXh0KTtcbiAgICAgICAgICAgIGF0dHJDb250ZXh0QnlNZXNzYWdlLnNldChvcC5pMThuTWVzc2FnZSwgaTE4bkNvbnRleHQueHJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9wLmkxOG5Db250ZXh0ID0gYXR0ckNvbnRleHRCeU1lc3NhZ2UuZ2V0KG9wLmkxOG5NZXNzYWdlKSE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ3JlYXRlIGkxOG4gY29udGV4dCBvcHMgZm9yIHJvb3QgaTE4biBibG9ja3MuXG4gIGNvbnN0IGJsb2NrQ29udGV4dEJ5STE4bkJsb2NrID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmIChvcC54cmVmID09PSBvcC5yb290KSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0T3AgPSBpci5jcmVhdGVJMThuQ29udGV4dE9wKFxuICAgICAgICAgICAgICAgIGlyLkkxOG5Db250ZXh0S2luZC5Sb290STE4biwgam9iLmFsbG9jYXRlWHJlZklkKCksIG9wLnhyZWYsIG9wLm1lc3NhZ2UsIG51bGwhKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goY29udGV4dE9wKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSBjb250ZXh0T3AueHJlZjtcbiAgICAgICAgICAgIGJsb2NrQ29udGV4dEJ5STE4bkJsb2NrLnNldChvcC54cmVmLCBjb250ZXh0T3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NpZ24gaTE4biBjb250ZXh0cyBmb3IgY2hpbGQgaTE4biBibG9ja3MuIFRoZXNlIGRvbid0IG5lZWQgdGhlaXIgb3duIGNvbmV4dCwgaW5zdGVhZCB0aGV5XG4gIC8vIHNob3VsZCBpbmhlcml0IGZyb20gdGhlaXIgcm9vdCBpMThuIGJsb2NrLlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgJiYgb3AueHJlZiAhPT0gb3Aucm9vdCkge1xuICAgICAgICBjb25zdCByb290Q29udGV4dCA9IGJsb2NrQ29udGV4dEJ5STE4bkJsb2NrLmdldChvcC5yb290KTtcbiAgICAgICAgaWYgKHJvb3RDb250ZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IFJvb3QgaTE4biBibG9jayBpMThuIGNvbnRleHQgc2hvdWxkIGhhdmUgYmVlbiBjcmVhdGVkLicpO1xuICAgICAgICB9XG4gICAgICAgIG9wLmNvbnRleHQgPSByb290Q29udGV4dC54cmVmO1xuICAgICAgICBibG9ja0NvbnRleHRCeUkxOG5CbG9jay5zZXQob3AueHJlZiwgcm9vdENvbnRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSBvciBhc3NpZ24gaTE4biBjb250ZXh0cyBmb3IgSUNVcy5cbiAgbGV0IGN1cnJlbnRJMThuT3A6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gb3A7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVN0YXJ0OlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IFVuZXhwZWN0ZWQgSUNVIG91dHNpZGUgb2YgYW4gaTE4biBibG9jay4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wLm1lc3NhZ2UuaWQgIT09IGN1cnJlbnRJMThuT3AubWVzc2FnZS5pZCkge1xuICAgICAgICAgICAgLy8gVGhpcyBJQ1UgaXMgYSBzdWItbWVzc2FnZSBpbnNpZGUgaXRzIHBhcmVudCBpMThuIGJsb2NrIG1lc3NhZ2UuIFdlIG5lZWQgdG8gZ2l2ZSBpdFxuICAgICAgICAgICAgLy8gaXRzIG93biBjb250ZXh0LlxuICAgICAgICAgICAgY29uc3QgY29udGV4dE9wID0gaXIuY3JlYXRlSTE4bkNvbnRleHRPcChcbiAgICAgICAgICAgICAgICBpci5JMThuQ29udGV4dEtpbmQuSWN1LCBqb2IuYWxsb2NhdGVYcmVmSWQoKSwgY3VycmVudEkxOG5PcC54cmVmLCBvcC5tZXNzYWdlLCBudWxsIVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goY29udGV4dE9wKTtcbiAgICAgICAgICAgIG9wLmNvbnRleHQgPSBjb250ZXh0T3AueHJlZjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhpcyBJQ1UgaXMgdGhlIG9ubHkgdHJhbnNsYXRhYmxlIGNvbnRlbnQgaW4gaXRzIHBhcmVudCBpMThuIGJsb2NrLiBXZSBuZWVkIHRvXG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRoZSBwYXJlbnQncyBjb250ZXh0IGludG8gYW4gSUNVIGNvbnRleHQuXG4gICAgICAgICAgICBvcC5jb250ZXh0ID0gY3VycmVudEkxOG5PcC5jb250ZXh0O1xuICAgICAgICAgICAgYmxvY2tDb250ZXh0QnlJMThuQmxvY2suZ2V0KGN1cnJlbnRJMThuT3AueHJlZikhLmNvbnRleHRLaW5kID0gaXIuSTE4bkNvbnRleHRLaW5kLkljdTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=