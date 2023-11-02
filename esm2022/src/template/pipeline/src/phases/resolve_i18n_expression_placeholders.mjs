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
export function resolveI18nExpressionPlaceholders(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLGtFQUFrRTtJQUNsRSxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztJQUNyRCxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQjtvQkFDN0IsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3RDLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxvRUFBb0U7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUV2RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtnQkFDeEMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3JDLElBQUksS0FBSyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNYLE1BQU0sS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7aUJBQ2xFO2dCQUNELE1BQU0sa0JBQWtCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEUsSUFBSSxDQUFDLGtCQUFrQixFQUFFO29CQUN2QixNQUFNLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO2lCQUM3RDtnQkFFRCwwREFBMEQ7Z0JBQzFELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDM0Isa0JBQWtCLENBQUMsb0JBQW9CLENBQUM7Z0JBQzVDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQztvQkFDVixLQUFLLEVBQUUsS0FBSztvQkFDWixnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO29CQUN6QyxLQUFLLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUk7aUJBQ25DLENBQUMsQ0FBQztnQkFDSCxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRXZDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQzthQUM1QztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBpMThuIGV4cHJlc3Npb24gcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkV4cHJlc3Npb25QbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBpMThuIGFuZCBleHRyYWN0ZWQgbWVzc2FnZSBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bk9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgY29uc3QgZXh0cmFjdGVkTWVzc2FnZU9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FeHRyYWN0ZWRNZXNzYWdlT3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGkxOG5PcHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRXh0cmFjdGVkTWVzc2FnZTpcbiAgICAgICAgICBleHRyYWN0ZWRNZXNzYWdlT3BzLnNldChvcC5vd25lciwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5leHQgYXZhaWxhYmxlIGV4cHJlc3Npb24gaW5kZXggcGVyIGkxOG4gYmxvY2suXG4gIGNvbnN0IGV4cHJlc3Npb25JbmRpY2VzID0gbmV3IE1hcDxpci5YcmVmSWQsIG51bWJlcj4oKTtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCBpMThuT3AgPSBpMThuT3BzLmdldChvcC5vd25lcik7XG4gICAgICAgIGxldCBpbmRleCA9IGV4cHJlc3Npb25JbmRpY2VzLmdldChvcC5vd25lcikgfHwgMDtcbiAgICAgICAgaWYgKCFpMThuT3ApIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGZpbmQgY29ycmVzcG9uZGluZyBpMThuIGJsb2NrIGZvciBpMThuRXhwcicpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGV4dHJhY3RlZE1lc3NhZ2VPcCA9IGV4dHJhY3RlZE1lc3NhZ2VPcHMuZ2V0KGkxOG5PcC54cmVmKTtcbiAgICAgICAgaWYgKCFleHRyYWN0ZWRNZXNzYWdlT3ApIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGZpbmQgZXh0cmFjdGVkIG1lc3NhZ2UgZm9yIGkxOG4gYmxvY2snKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCB0aGUgZXhwcmVzc2lvbiBpbmRleCBpbiB0aGUgYXBwcm9wcmlhdGUgcGFyYW1zIG1hcC5cbiAgICAgICAgY29uc3QgcGFyYW1zID0gb3AucmVzb2x1dGlvblRpbWUgPT09IGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uID9cbiAgICAgICAgICAgIGV4dHJhY3RlZE1lc3NhZ2VPcC5wYXJhbXMgOlxuICAgICAgICAgICAgZXh0cmFjdGVkTWVzc2FnZU9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBwYXJhbXMuZ2V0KG9wLmkxOG5QbGFjZWhvbGRlcikgfHwgW107XG4gICAgICAgIHZhbHVlcy5wdXNoKHtcbiAgICAgICAgICB2YWx1ZTogaW5kZXgsXG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRleDogaTE4bk9wLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZVxuICAgICAgICB9KTtcbiAgICAgICAgcGFyYW1zLnNldChvcC5pMThuUGxhY2Vob2xkZXIsIHZhbHVlcyk7XG5cbiAgICAgICAgZXhwcmVzc2lvbkluZGljZXMuc2V0KG9wLm93bmVyLCBpbmRleCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19