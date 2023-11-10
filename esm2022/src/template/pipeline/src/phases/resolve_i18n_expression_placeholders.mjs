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
    // Record all of the i18n context ops, and the sub-template index for each i18n op.
    const subTemplateIndicies = new Map();
    const i18nContexts = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    subTemplateIndicies.set(op.xref, op.subTemplateIndex);
                    break;
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
            }
        }
    }
    // Keep track of the next available expression index per i18n block.
    const expressionIndices = new Map();
    for (const unit of job.units) {
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const i18nContext = i18nContexts.get(op.context);
                const index = expressionIndices.get(i18nContext.i18nBlock) || 0;
                const subTemplateIndex = subTemplateIndicies.get(i18nContext.i18nBlock);
                // Add the expression index in the appropriate params map.
                const params = op.resolutionTime === ir.I18nParamResolutionTime.Creation ?
                    i18nContext.params :
                    i18nContext.postprocessingParams;
                const values = params.get(op.i18nPlaceholder) || [];
                values.push({
                    value: index,
                    subTemplateIndex: subTemplateIndex,
                    flags: ir.I18nParamValueFlags.ExpressionIndex
                });
                params.set(op.i18nPlaceholder, values);
                expressionIndices.set(i18nContext.i18nBlock, index + 1);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLG1GQUFtRjtJQUNuRixNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO0lBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixtQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDdEQsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVztvQkFDeEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2FBQ1Q7U0FDRjtLQUNGO0lBRUQsb0VBQW9FO0lBQ3BFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFdkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7Z0JBQ3hDLE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBRSxDQUFDO2dCQUNsRCxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEUsTUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBRSxDQUFDO2dCQUN6RSwwREFBMEQ7Z0JBQzFELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3BCLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNwRCxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUNWLEtBQUssRUFBRSxLQUFLO29CQUNaLGdCQUFnQixFQUFFLGdCQUFnQjtvQkFDbEMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlO2lCQUM5QyxDQUFDLENBQUM7Z0JBQ0gsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUV2QyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDekQ7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgaTE4biBleHByZXNzaW9uIHBsYWNlaG9sZGVycyBpbiBpMThuIG1lc3NhZ2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUkxOG5FeHByZXNzaW9uUGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgaTE4biBjb250ZXh0IG9wcywgYW5kIHRoZSBzdWItdGVtcGxhdGUgaW5kZXggZm9yIGVhY2ggaTE4biBvcC5cbiAgY29uc3Qgc3ViVGVtcGxhdGVJbmRpY2llcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXJ8bnVsbD4oKTtcbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kaWNpZXMuc2V0KG9wLnhyZWYsIG9wLnN1YlRlbXBsYXRlSW5kZXgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBuZXh0IGF2YWlsYWJsZSBleHByZXNzaW9uIGluZGV4IHBlciBpMThuIGJsb2NrLlxuICBjb25zdCBleHByZXNzaW9uSW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgaTE4bkNvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpITtcbiAgICAgICAgY29uc3QgaW5kZXggPSBleHByZXNzaW9uSW5kaWNlcy5nZXQoaTE4bkNvbnRleHQuaTE4bkJsb2NrKSB8fCAwO1xuICAgICAgICBjb25zdCBzdWJUZW1wbGF0ZUluZGV4ID0gc3ViVGVtcGxhdGVJbmRpY2llcy5nZXQoaTE4bkNvbnRleHQuaTE4bkJsb2NrKSE7XG4gICAgICAgIC8vIEFkZCB0aGUgZXhwcmVzc2lvbiBpbmRleCBpbiB0aGUgYXBwcm9wcmlhdGUgcGFyYW1zIG1hcC5cbiAgICAgICAgY29uc3QgcGFyYW1zID0gb3AucmVzb2x1dGlvblRpbWUgPT09IGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uID9cbiAgICAgICAgICAgIGkxOG5Db250ZXh0LnBhcmFtcyA6XG4gICAgICAgICAgICBpMThuQ29udGV4dC5wb3N0cHJvY2Vzc2luZ1BhcmFtcztcbiAgICAgICAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChvcC5pMThuUGxhY2Vob2xkZXIpIHx8IFtdO1xuICAgICAgICB2YWx1ZXMucHVzaCh7XG4gICAgICAgICAgdmFsdWU6IGluZGV4LFxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXg6IHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRXhwcmVzc2lvbkluZGV4XG4gICAgICAgIH0pO1xuICAgICAgICBwYXJhbXMuc2V0KG9wLmkxOG5QbGFjZWhvbGRlciwgdmFsdWVzKTtcblxuICAgICAgICBleHByZXNzaW9uSW5kaWNlcy5zZXQoaTE4bkNvbnRleHQuaTE4bkJsb2NrLCBpbmRleCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19