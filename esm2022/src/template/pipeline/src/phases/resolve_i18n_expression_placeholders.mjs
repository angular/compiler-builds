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
    // Keep track of the next available expression index per i18n context.
    const expressionIndices = new Map();
    for (const unit of job.units) {
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const index = expressionIndices.get(op.context) || 0;
                const i18nContext = i18nContexts.get(op.context);
                const subTemplateIndex = subTemplateIndicies.get(i18nContext.i18nBlock);
                // Add the expression index in the appropriate params map.
                const params = op.resolutionTime === ir.I18nParamResolutionTime.Creation ?
                    i18nContext.params :
                    i18nContext.postprocessingParams;
                const values = params.get(op.i18nPlaceholder) || [];
                values.push({ value: index, subTemplateIndex: subTemplateIndex, flags: ir.I18nParamValueFlags.None });
                params.set(op.i18nPlaceholder, values);
                expressionIndices.set(op.context, index + 1);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLG1GQUFtRjtJQUNuRixNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO0lBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixtQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDdEQsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVztvQkFDeEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2FBQ1Q7U0FDRjtLQUNGO0lBRUQsc0VBQXNFO0lBQ3RFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7SUFFdkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7Z0JBQ3hDLE1BQU0sS0FBSyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUUsQ0FBQztnQkFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBRSxDQUFDO2dCQUN6RSwwREFBMEQ7Z0JBQzFELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3BCLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNwRCxNQUFNLENBQUMsSUFBSSxDQUNQLEVBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBQyxDQUFDLENBQUM7Z0JBQzVGLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFFdkMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQzlDO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGkxOG4gZXhwcmVzc2lvbiBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuRXhwcmVzc2lvblBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGkxOG4gY29udGV4dCBvcHMsIGFuZCB0aGUgc3ViLXRlbXBsYXRlIGluZGV4IGZvciBlYWNoIGkxOG4gb3AuXG4gIGNvbnN0IHN1YlRlbXBsYXRlSW5kaWNpZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyfG51bGw+KCk7XG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBzdWJUZW1wbGF0ZUluZGljaWVzLnNldChvcC54cmVmLCBvcC5zdWJUZW1wbGF0ZUluZGV4KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkNvbnRleHQ6XG4gICAgICAgICAgaTE4bkNvbnRleHRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gS2VlcCB0cmFjayBvZiB0aGUgbmV4dCBhdmFpbGFibGUgZXhwcmVzc2lvbiBpbmRleCBwZXIgaTE4biBjb250ZXh0LlxuICBjb25zdCBleHByZXNzaW9uSW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBleHByZXNzaW9uSW5kaWNlcy5nZXQob3AuY29udGV4dCkgfHwgMDtcbiAgICAgICAgY29uc3QgaTE4bkNvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpITtcbiAgICAgICAgY29uc3Qgc3ViVGVtcGxhdGVJbmRleCA9IHN1YlRlbXBsYXRlSW5kaWNpZXMuZ2V0KGkxOG5Db250ZXh0LmkxOG5CbG9jaykhO1xuICAgICAgICAvLyBBZGQgdGhlIGV4cHJlc3Npb24gaW5kZXggaW4gdGhlIGFwcHJvcHJpYXRlIHBhcmFtcyBtYXAuXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IG9wLnJlc29sdXRpb25UaW1lID09PSBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbiA/XG4gICAgICAgICAgICBpMThuQ29udGV4dC5wYXJhbXMgOlxuICAgICAgICAgICAgaTE4bkNvbnRleHQucG9zdHByb2Nlc3NpbmdQYXJhbXM7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IHBhcmFtcy5nZXQob3AuaTE4blBsYWNlaG9sZGVyKSB8fCBbXTtcbiAgICAgICAgdmFsdWVzLnB1c2goXG4gICAgICAgICAgICB7dmFsdWU6IGluZGV4LCBzdWJUZW1wbGF0ZUluZGV4OiBzdWJUZW1wbGF0ZUluZGV4LCBmbGFnczogaXIuSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lfSk7XG4gICAgICAgIHBhcmFtcy5zZXQob3AuaTE4blBsYWNlaG9sZGVyLCB2YWx1ZXMpO1xuXG4gICAgICAgIGV4cHJlc3Npb25JbmRpY2VzLnNldChvcC5jb250ZXh0LCBpbmRleCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19