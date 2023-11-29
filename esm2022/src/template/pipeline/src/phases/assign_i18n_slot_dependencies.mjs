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
export function assignI18nSlotDependencies(job) {
    const i18nLastSlotConsumers = new Map();
    let lastSlotConsumer = null;
    let currentI18nOp = null;
    for (const unit of job.units) {
        // Record the last consumed slot before each i18n end instruction.
        for (const op of unit.create) {
            if (ir.hasConsumesSlotTrait(op)) {
                lastSlotConsumer = op.xref;
            }
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nOp = op;
                    break;
                case ir.OpKind.I18nEnd:
                    i18nLastSlotConsumers.set(currentI18nOp.xref, lastSlotConsumer);
                    currentI18nOp = null;
                    break;
            }
        }
        // Assign i18n expressions to target the last slot in its owning block.
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                op.target = i18nLastSlotConsumers.get(op.target);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWduX2kxOG5fc2xvdF9kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hc3NpZ25faTE4bl9zbG90X2RlcGVuZGVuY2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFtQjtJQUM1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO0lBQzlELElBQUksZ0JBQWdCLEdBQW1CLElBQUksQ0FBQztJQUM1QyxJQUFJLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lBRTlDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLGtFQUFrRTtRQUNsRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO1lBQzdCLENBQUM7WUFFRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUM7b0JBQ25CLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87b0JBQ3BCLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxhQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFpQixDQUFDLENBQUM7b0JBQ2xFLGFBQWEsR0FBRyxJQUFJLENBQUM7b0JBQ3JCLE1BQU07WUFDVixDQUFDO1FBQ0gsQ0FBQztRQUVELHVFQUF1RTtRQUN2RSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDekMsRUFBRSxDQUFDLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDO1lBQ3BELENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFVwZGF0ZXMgaTE4biBleHByZXNzaW9uIG9wcyB0byBkZXBlbmQgb24gdGhlIGxhc3Qgc2xvdCBpbiB0aGVpciBvd25pbmcgaTE4biBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2lnbkkxOG5TbG90RGVwZW5kZW5jaWVzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgaTE4bkxhc3RTbG90Q29uc3VtZXJzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLlhyZWZJZD4oKTtcbiAgbGV0IGxhc3RTbG90Q29uc3VtZXI6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgbGV0IGN1cnJlbnRJMThuT3A6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBSZWNvcmQgdGhlIGxhc3QgY29uc3VtZWQgc2xvdCBiZWZvcmUgZWFjaCBpMThuIGVuZCBpbnN0cnVjdGlvbi5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNTbG90VHJhaXQob3ApKSB7XG4gICAgICAgIGxhc3RTbG90Q29uc3VtZXIgPSBvcC54cmVmO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBvcDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBpMThuTGFzdFNsb3RDb25zdW1lcnMuc2V0KGN1cnJlbnRJMThuT3AhLnhyZWYsIGxhc3RTbG90Q29uc3VtZXIhKTtcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBc3NpZ24gaTE4biBleHByZXNzaW9ucyB0byB0YXJnZXQgdGhlIGxhc3Qgc2xvdCBpbiBpdHMgb3duaW5nIGJsb2NrLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgb3AudGFyZ2V0ID0gaTE4bkxhc3RTbG90Q29uc3VtZXJzLmdldChvcC50YXJnZXQpITtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==