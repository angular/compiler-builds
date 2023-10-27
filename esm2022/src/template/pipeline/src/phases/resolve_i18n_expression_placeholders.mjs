/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Resolve the i18n expression placeholders in i18n messages.
 */
export function phaseResolveI18nExpressionPlaceholders(job) {
    // Record all of the i18n and extracted message ops for use later.
    const i18nOps = new Map();
    const extractedMessageOps = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    i18nOps.set(op.xref, op);
                    break;
                case ir.OpKind.ExtractedMessage:
                    extractedMessageOps.set(op.owner, op);
                    break;
            }
        }
    }
    // Keep track of the next available expression index per i18n block.
    const expressionIndices = new Map();
    for (const unit of job.units) {
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const i18nOp = i18nOps.get(op.owner);
                let index = expressionIndices.get(op.owner) || 0;
                if (!i18nOp) {
                    throw Error('Cannot find corresponding i18n block for i18nExpr');
                }
                const extractedMessageOp = extractedMessageOps.get(i18nOp.xref);
                if (!extractedMessageOp) {
                    throw Error('Cannot find extracted message for i18n block');
                }
                // Add the expression index in the appropriate params map.
                const params = op.resolutionTime === ir.I18nParamResolutionTime.Creation ?
                    extractedMessageOp.params :
                    extractedMessageOp.postprocessingParams;
                const values = params.get(op.i18nPlaceholder) || [];
                values.push({
                    value: index,
                    subTemplateIndex: i18nOp.subTemplateIndex,
                    flags: ir.I18nParamValueFlags.None
                });
                params.set(op.i18nPlaceholder, values);
                expressionIndices.set(op.owner, index + 1);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHNDQUFzQyxDQUFDLEdBQTRCO0lBQ2pGLGtFQUFrRTtJQUNsRSxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztJQUNyRCxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQjtvQkFDN0IsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3RDLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxvRUFBb0U7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUV2RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtnQkFDeEMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3JDLElBQUksS0FBSyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNYLE1BQU0sS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7aUJBQ2xFO2dCQUNELE1BQU0sa0JBQWtCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEUsSUFBSSxDQUFDLGtCQUFrQixFQUFFO29CQUN2QixNQUFNLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO2lCQUM3RDtnQkFFRCwwREFBMEQ7Z0JBQzFELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDM0Isa0JBQWtCLENBQUMsb0JBQW9CLENBQUM7Z0JBQzVDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQztvQkFDVixLQUFLLEVBQUUsS0FBSztvQkFDWixnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO29CQUN6QyxLQUFLLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUk7aUJBQ25DLENBQUMsQ0FBQztnQkFDSCxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRXZDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQzthQUM1QztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBpMThuIGV4cHJlc3Npb24gcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVJMThuRXhwcmVzc2lvblBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGkxOG4gYW5kIGV4dHJhY3RlZCBtZXNzYWdlIG9wcyBmb3IgdXNlIGxhdGVyLlxuICBjb25zdCBpMThuT3BzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuICBjb25zdCBleHRyYWN0ZWRNZXNzYWdlT3BzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkV4dHJhY3RlZE1lc3NhZ2VPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaTE4bk9wcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlOlxuICAgICAgICAgIGV4dHJhY3RlZE1lc3NhZ2VPcHMuc2V0KG9wLm93bmVyLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmV4dCBhdmFpbGFibGUgZXhwcmVzc2lvbiBpbmRleCBwZXIgaTE4biBibG9jay5cbiAgY29uc3QgZXhwcmVzc2lvbkluZGljZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IGkxOG5PcCA9IGkxOG5PcHMuZ2V0KG9wLm93bmVyKTtcbiAgICAgICAgbGV0IGluZGV4ID0gZXhwcmVzc2lvbkluZGljZXMuZ2V0KG9wLm93bmVyKSB8fCAwO1xuICAgICAgICBpZiAoIWkxOG5PcCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgZmluZCBjb3JyZXNwb25kaW5nIGkxOG4gYmxvY2sgZm9yIGkxOG5FeHByJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXh0cmFjdGVkTWVzc2FnZU9wID0gZXh0cmFjdGVkTWVzc2FnZU9wcy5nZXQoaTE4bk9wLnhyZWYpO1xuICAgICAgICBpZiAoIWV4dHJhY3RlZE1lc3NhZ2VPcCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgZmluZCBleHRyYWN0ZWQgbWVzc2FnZSBmb3IgaTE4biBibG9jaycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBleHByZXNzaW9uIGluZGV4IGluIHRoZSBhcHByb3ByaWF0ZSBwYXJhbXMgbWFwLlxuICAgICAgICBjb25zdCBwYXJhbXMgPSBvcC5yZXNvbHV0aW9uVGltZSA9PT0gaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb24gP1xuICAgICAgICAgICAgZXh0cmFjdGVkTWVzc2FnZU9wLnBhcmFtcyA6XG4gICAgICAgICAgICBleHRyYWN0ZWRNZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXM7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IHBhcmFtcy5nZXQob3AuaTE4blBsYWNlaG9sZGVyKSB8fCBbXTtcbiAgICAgICAgdmFsdWVzLnB1c2goe1xuICAgICAgICAgIHZhbHVlOiBpbmRleCxcbiAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4OiBpMThuT3Auc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICBmbGFnczogaXIuSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lXG4gICAgICAgIH0pO1xuICAgICAgICBwYXJhbXMuc2V0KG9wLmkxOG5QbGFjZWhvbGRlciwgdmFsdWVzKTtcblxuICAgICAgICBleHByZXNzaW9uSW5kaWNlcy5zZXQob3Aub3duZXIsIGluZGV4ICsgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=