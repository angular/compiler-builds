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
        let currentI18nId = null;
        let currentI18nSlot = null;
        const textNodes = new Map();
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    currentI18nId = op.xref;
                    currentI18nSlot = op.handle;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBbUI7SUFDakQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLDBGQUEwRjtRQUMxRixXQUFXO1FBQ1gsSUFBSSxhQUFhLEdBQW1CLElBQUksQ0FBQztRQUN6QyxJQUFJLGVBQWUsR0FBdUIsSUFBSSxDQUFDO1FBQy9DLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFxRCxDQUFDO1FBQy9FLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGFBQWEsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUN4QixlQUFlLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQztvQkFDNUIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTztvQkFDcEIsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDckIsZUFBZSxHQUFHLElBQUksQ0FBQztvQkFDdkIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSTtvQkFDakIsSUFBSSxhQUFhLEtBQUssSUFBSSxJQUFJLGVBQWUsS0FBSyxJQUFJLEVBQUU7d0JBQ3RELFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBQyxDQUFDLENBQUM7d0JBQ3JFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO3FCQUNuQztvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtRQUVELGdHQUFnRztRQUNoRyxrQ0FBa0M7UUFDbEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZTtvQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFO3dCQUM3QixTQUFTO3FCQUNWO29CQUVELE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDO29CQUM1QyxNQUFNLEdBQUcsR0FBa0IsRUFBRSxDQUFDO29CQUM5QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO3dCQUM1RCxNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDN0MsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUMzQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FDOUIsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxFQUN0RCxFQUFFLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7cUJBQzdFO29CQUNELElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7d0JBQ2xCLG1GQUFtRjtxQkFDcEY7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBaUIsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDbEQsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlbW92ZXMgdGV4dCBub2RlcyB3aXRoaW4gaTE4biBibG9ja3Mgc2luY2UgdGhleSBhcmUgYWxyZWFkeSBoYXJkY29kZWQgaW50byB0aGUgaTE4biBtZXNzYWdlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEkxOG5UZXh0KGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFJlbW92ZSBhbGwgdGV4dCBub2RlcyB3aXRoaW4gaTE4biBibG9ja3MsIHRoZWlyIGNvbnRlbnQgaXMgYWxyZWFkeSBjYXB0dXJlZCBpbiB0aGUgaTE4blxuICAgIC8vIG1lc3NhZ2UuXG4gICAgbGV0IGN1cnJlbnRJMThuSWQ6IGlyLlhyZWZJZHxudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudEkxOG5TbG90OiBpci5TbG90SGFuZGxlfG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHRleHROb2RlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCB7eHJlZjogaXIuWHJlZklkLCBzbG90OiBpci5TbG90SGFuZGxlfT4oKTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJMThuSWQgPSBvcC54cmVmO1xuICAgICAgICAgIGN1cnJlbnRJMThuU2xvdCA9IG9wLmhhbmRsZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50STE4bklkID0gbnVsbDtcbiAgICAgICAgICBjdXJyZW50STE4blNsb3QgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZXh0OlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bklkICE9PSBudWxsICYmIGN1cnJlbnRJMThuU2xvdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGV4dE5vZGVzLnNldChvcC54cmVmLCB7eHJlZjogY3VycmVudEkxOG5JZCwgc2xvdDogY3VycmVudEkxOG5TbG90fSk7XG4gICAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBhbnkgaW50ZXJwb2xhdGlvbnMgdG8gdGhlIHJlbW92ZWQgdGV4dCwgYW5kIGluc3RlYWQgcmVwcmVzZW50IHRoZW0gYXMgYSBzZXJpZXMgb2YgaTE4blxuICAgIC8vIGV4cHJlc3Npb25zIHRoYXQgd2UgdGhlbiBhcHBseS5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgICAgIGlmICghdGV4dE5vZGVzLmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpMThuQmxvY2sgPSB0ZXh0Tm9kZXMuZ2V0KG9wLnRhcmdldCkhO1xuICAgICAgICAgIGNvbnN0IG9wczogaXIuVXBkYXRlT3BbXSA9IFtdO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXhwciA9IG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlciA9IG9wLmkxOG5QbGFjZWhvbGRlcnNbaV07XG4gICAgICAgICAgICBvcHMucHVzaChpci5jcmVhdGVJMThuRXhwcmVzc2lvbk9wKFxuICAgICAgICAgICAgICAgIGkxOG5CbG9jay54cmVmLCBpMThuQmxvY2suc2xvdCwgZXhwciwgcGxhY2Vob2xkZXIubmFtZSxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbiwgZXhwci5zb3VyY2VTcGFuID8/IG9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBvcHMucHVzaChpci5jcmVhdGVJMThuQXBwbHlPcChpMThuQmxvY2tJZCwgb3AuaTE4blBsYWNlaG9sZGVycywgb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpci5PcExpc3QucmVwbGFjZVdpdGhNYW55KG9wIGFzIGlyLlVwZGF0ZU9wLCBvcHMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19