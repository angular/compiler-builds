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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl90ZXh0X2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9pMThuX3RleHRfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBbUI7SUFDakQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLDBGQUEwRjtRQUMxRixXQUFXO1FBQ1gsSUFBSSxXQUFXLEdBQXdCLElBQUksQ0FBQztRQUM1QyxNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO1FBQ2hFLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxJQUFJLEVBQUU7d0JBQ3ZCLE1BQU0sS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7cUJBQ3JEO29CQUNELFdBQVcsR0FBRyxFQUFFLENBQUM7b0JBQ2pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87b0JBQ3BCLFdBQVcsR0FBRyxJQUFJLENBQUM7b0JBQ25CLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUk7b0JBQ2pCLElBQUksV0FBVyxLQUFLLElBQUksRUFBRTt3QkFDeEIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7d0JBQzdDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO3FCQUNuQztvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtRQUVELGdHQUFnRztRQUNoRyxrQ0FBa0M7UUFDbEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZTtvQkFDNUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQ3RDLFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztvQkFDbEQsTUFBTSxHQUFHLEdBQWtCLEVBQUUsQ0FBQztvQkFDOUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDNUQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzdDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDM0Msd0ZBQXdGO3dCQUN4RixnRUFBZ0U7d0JBQ2hFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUM5QixNQUFNLENBQUMsT0FBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksRUFDbkUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3FCQUM3RTtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNsRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVtb3ZlcyB0ZXh0IG5vZGVzIHdpdGhpbiBpMThuIGJsb2NrcyBzaW5jZSB0aGV5IGFyZSBhbHJlYWR5IGhhcmRjb2RlZCBpbnRvIHRoZSBpMThuIG1lc3NhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0STE4blRleHQoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgLy8gUmVtb3ZlIGFsbCB0ZXh0IG5vZGVzIHdpdGhpbiBpMThuIGJsb2NrcywgdGhlaXIgY29udGVudCBpcyBhbHJlYWR5IGNhcHR1cmVkIGluIHRoZSBpMThuXG4gICAgLy8gbWVzc2FnZS5cbiAgICBsZXQgY3VycmVudEkxOG46IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICAgIGNvbnN0IHRleHROb2RlSTE4bkJsb2NrcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmIChvcC5jb250ZXh0ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignSTE4biBvcCBzaG91bGQgaGF2ZSBpdHMgY29udGV4dCBzZXQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJMThuID0gb3A7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG4gPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZXh0OlxuICAgICAgICAgIGlmIChjdXJyZW50STE4biAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGV4dE5vZGVJMThuQmxvY2tzLnNldChvcC54cmVmLCBjdXJyZW50STE4bik7XG4gICAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBhbnkgaW50ZXJwb2xhdGlvbnMgdG8gdGhlIHJlbW92ZWQgdGV4dCwgYW5kIGluc3RlYWQgcmVwcmVzZW50IHRoZW0gYXMgYSBzZXJpZXMgb2YgaTE4blxuICAgIC8vIGV4cHJlc3Npb25zIHRoYXQgd2UgdGhlbiBhcHBseS5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgICAgIGlmICghdGV4dE5vZGVJMThuQmxvY2tzLmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpMThuT3AgPSB0ZXh0Tm9kZUkxOG5CbG9ja3MuZ2V0KG9wLnRhcmdldCkhO1xuICAgICAgICAgIGNvbnN0IG9wczogaXIuVXBkYXRlT3BbXSA9IFtdO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXhwciA9IG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlciA9IG9wLmkxOG5QbGFjZWhvbGRlcnNbaV07XG4gICAgICAgICAgICAvLyBGb3Igbm93LCB0aGlzIGkxOG5FeHByZXNzaW9uIGRlcGVuZHMgb24gdGhlIHNsb3QgY29udGV4dCBvZiB0aGUgZW5jbG9zaW5nIGkxOG4gYmxvY2suXG4gICAgICAgICAgICAvLyBMYXRlciwgd2Ugd2lsbCBtb2RpZnkgdGhpcywgYW5kIGFkdmFuY2UgdG8gYSBkaWZmZXJlbnQgcG9pbnQuXG4gICAgICAgICAgICBvcHMucHVzaChpci5jcmVhdGVJMThuRXhwcmVzc2lvbk9wKFxuICAgICAgICAgICAgICAgIGkxOG5PcC5jb250ZXh0ISwgaTE4bk9wLnhyZWYsIGkxOG5PcC5oYW5kbGUsIGV4cHIsIHBsYWNlaG9sZGVyLm5hbWUsXG4gICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb24sIGV4cHIuc291cmNlU3BhbiA/PyBvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZXBsYWNlV2l0aE1hbnkob3AgYXMgaXIuVXBkYXRlT3AsIG9wcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=