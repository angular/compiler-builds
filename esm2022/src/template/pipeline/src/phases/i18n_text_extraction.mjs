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
 * Also, replaces interpolations on these text nodes with i18n expressions of the non-text portions,
 * which will be applied later.
 */
export function convertI18nText(job) {
    for (const unit of job.units) {
        // Remove all text nodes within i18n blocks, their content is already captured in the i18n
        // message.
        let currentI18n = null;
        let currentIcu = null;
        const textNodeI18nBlocks = new Map();
        const textNodeIcus = new Map();
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
                case ir.OpKind.IcuStart:
                    if (op.context === null) {
                        throw Error('Icu op should have its context set.');
                    }
                    currentIcu = op;
                    break;
                case ir.OpKind.IcuEnd:
                    currentIcu = null;
                    break;
                case ir.OpKind.Text:
                    if (currentI18n !== null) {
                        textNodeI18nBlocks.set(op.xref, currentI18n);
                        textNodeIcus.set(op.xref, currentIcu);
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
                    const icuOp = textNodeIcus.get(op.target);
                    const contextId = icuOp ? icuOp.context : i18nOp.context;
                    const resolutionTime = icuOp ? ir.I18nParamResolutionTime.Postproccessing :
                        ir.I18nParamResolutionTime.Creation;
                    const ops = [];
                    for (let i = 0; i < op.interpolation.expressions.length; i++) {
                        const expr = op.interpolation.expressions[i];
                        // For now, this i18nExpression depends on the slot context of the enclosing i18n block.
                        // Later, we will modify this, and advance to a different point.
                        ops.push(ir.createI18nExpressionOp(contextId, i18nOp.xref, i18nOp.handle, expr, op.interpolation.i18nPlaceholders[i], resolutionTime, ir.I18nExpressionContext.Normal, '', expr.sourceSpan ?? op.sourceSpan));
                    }
                    ir.OpList.replaceWithMany(op, ops);
                    break;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxHQUFtQjtJQUNqRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLFdBQVc7UUFDWCxJQUFJLFdBQVcsR0FBd0IsSUFBSSxDQUFDO1FBQzVDLElBQUksVUFBVSxHQUF1QixJQUFJLENBQUM7UUFDMUMsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztRQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBaUMsQ0FBQztRQUM5RCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixJQUFJLEVBQUUsQ0FBQyxPQUFPLEtBQUssSUFBSSxFQUFFO3dCQUN2QixNQUFNLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO3FCQUNyRDtvQkFDRCxXQUFXLEdBQUcsRUFBRSxDQUFDO29CQUNqQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO29CQUNwQixXQUFXLEdBQUcsSUFBSSxDQUFDO29CQUNuQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUNyQixJQUFJLEVBQUUsQ0FBQyxPQUFPLEtBQUssSUFBSSxFQUFFO3dCQUN2QixNQUFNLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO3FCQUNwRDtvQkFDRCxVQUFVLEdBQUcsRUFBRSxDQUFDO29CQUNoQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNO29CQUNuQixVQUFVLEdBQUcsSUFBSSxDQUFDO29CQUNsQixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJO29CQUNqQixJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUU7d0JBQ3hCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO3dCQUM3QyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7d0JBQ3RDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO3FCQUNuQztvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtRQUVELGdHQUFnRztRQUNoRyxrQ0FBa0M7UUFDbEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZTtvQkFDNUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQ3RDLFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztvQkFDbEQsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzFDLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztvQkFDekQsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsdUJBQXVCLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQzVDLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUM7b0JBQ25FLE1BQU0sR0FBRyxHQUFrQixFQUFFLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzVELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM3Qyx3RkFBd0Y7d0JBQ3hGLGdFQUFnRTt3QkFDaEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQzlCLFNBQVUsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQ2xGLGNBQWMsRUFBRSxFQUFFLENBQUMscUJBQXFCLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFDbkQsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztxQkFDeEM7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBaUIsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDbEQsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlbW92ZXMgdGV4dCBub2RlcyB3aXRoaW4gaTE4biBibG9ja3Mgc2luY2UgdGhleSBhcmUgYWxyZWFkeSBoYXJkY29kZWQgaW50byB0aGUgaTE4biBtZXNzYWdlLlxuICogQWxzbywgcmVwbGFjZXMgaW50ZXJwb2xhdGlvbnMgb24gdGhlc2UgdGV4dCBub2RlcyB3aXRoIGkxOG4gZXhwcmVzc2lvbnMgb2YgdGhlIG5vbi10ZXh0IHBvcnRpb25zLFxuICogd2hpY2ggd2lsbCBiZSBhcHBsaWVkIGxhdGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEkxOG5UZXh0KGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlbW92ZSBhbGwgdGV4dCBub2RlcyB3aXRoaW4gaTE4biBibG9ja3MsIHRoZWlyIGNvbnRlbnQgaXMgYWxyZWFkeSBjYXB0dXJlZCBpbiB0aGUgaTE4blxuICAgIC8vIG1lc3NhZ2UuXG4gICAgbGV0IGN1cnJlbnRJMThuOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudEljdTogaXIuSWN1U3RhcnRPcHxudWxsID0gbnVsbDtcbiAgICBjb25zdCB0ZXh0Tm9kZUkxOG5CbG9ja3MgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4blN0YXJ0T3A+KCk7XG4gICAgY29uc3QgdGV4dE5vZGVJY3VzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkljdVN0YXJ0T3B8bnVsbD4oKTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmIChvcC5jb250ZXh0ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignSTE4biBvcCBzaG91bGQgaGF2ZSBpdHMgY29udGV4dCBzZXQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJMThuID0gb3A7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG4gPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VTdGFydDpcbiAgICAgICAgICBpZiAob3AuY29udGV4dCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0ljdSBvcCBzaG91bGQgaGF2ZSBpdHMgY29udGV4dCBzZXQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJY3UgPSBvcDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSWN1RW5kOlxuICAgICAgICAgIGN1cnJlbnRJY3UgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZXh0OlxuICAgICAgICAgIGlmIChjdXJyZW50STE4biAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGV4dE5vZGVJMThuQmxvY2tzLnNldChvcC54cmVmLCBjdXJyZW50STE4bik7XG4gICAgICAgICAgICB0ZXh0Tm9kZUljdXMuc2V0KG9wLnhyZWYsIGN1cnJlbnRJY3UpO1xuICAgICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgYW55IGludGVycG9sYXRpb25zIHRvIHRoZSByZW1vdmVkIHRleHQsIGFuZCBpbnN0ZWFkIHJlcHJlc2VudCB0aGVtIGFzIGEgc2VyaWVzIG9mIGkxOG5cbiAgICAvLyBleHByZXNzaW9ucyB0aGF0IHdlIHRoZW4gYXBwbHkuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgICAgICBpZiAoIXRleHROb2RlSTE4bkJsb2Nrcy5oYXMob3AudGFyZ2V0KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaTE4bk9wID0gdGV4dE5vZGVJMThuQmxvY2tzLmdldChvcC50YXJnZXQpITtcbiAgICAgICAgICBjb25zdCBpY3VPcCA9IHRleHROb2RlSWN1cy5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgICBjb25zdCBjb250ZXh0SWQgPSBpY3VPcCA/IGljdU9wLmNvbnRleHQgOiBpMThuT3AuY29udGV4dDtcbiAgICAgICAgICBjb25zdCByZXNvbHV0aW9uVGltZSA9IGljdU9wID8gaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuUG9zdHByb2NjZXNzaW5nIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb247XG4gICAgICAgICAgY29uc3Qgb3BzOiBpci5VcGRhdGVPcFtdID0gW107XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBleHByID0gb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXTtcbiAgICAgICAgICAgIC8vIEZvciBub3csIHRoaXMgaTE4bkV4cHJlc3Npb24gZGVwZW5kcyBvbiB0aGUgc2xvdCBjb250ZXh0IG9mIHRoZSBlbmNsb3NpbmcgaTE4biBibG9jay5cbiAgICAgICAgICAgIC8vIExhdGVyLCB3ZSB3aWxsIG1vZGlmeSB0aGlzLCBhbmQgYWR2YW5jZSB0byBhIGRpZmZlcmVudCBwb2ludC5cbiAgICAgICAgICAgIG9wcy5wdXNoKGlyLmNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgICAgICAgICAgICAgY29udGV4dElkISwgaTE4bk9wLnhyZWYsIGkxOG5PcC5oYW5kbGUsIGV4cHIsIG9wLmludGVycG9sYXRpb24uaTE4blBsYWNlaG9sZGVyc1tpXSxcbiAgICAgICAgICAgICAgICByZXNvbHV0aW9uVGltZSwgaXIuSTE4bkV4cHJlc3Npb25Db250ZXh0Lk5vcm1hbCwgJycsXG4gICAgICAgICAgICAgICAgZXhwci5zb3VyY2VTcGFuID8/IG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXIuT3BMaXN0LnJlcGxhY2VXaXRoTWFueShvcCBhcyBpci5VcGRhdGVPcCwgb3BzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==