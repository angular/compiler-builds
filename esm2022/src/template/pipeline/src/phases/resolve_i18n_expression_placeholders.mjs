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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLG1GQUFtRjtJQUNuRixNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO0lBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ3RELE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtZQUNWLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELHNFQUFzRTtJQUN0RSxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRXZELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN6QyxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckQsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFFLENBQUM7Z0JBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUUsQ0FBQztnQkFDekUsMERBQTBEO2dCQUMxRCxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsY0FBYyxLQUFLLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDdEUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNwQixXQUFXLENBQUMsb0JBQW9CLENBQUM7Z0JBQ3JDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxDQUFDLElBQUksQ0FDUCxFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDO2dCQUM1RixNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRXZDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBpMThuIGV4cHJlc3Npb24gcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkV4cHJlc3Npb25QbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBpMThuIGNvbnRleHQgb3BzLCBhbmQgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCBmb3IgZWFjaCBpMThuIG9wLlxuICBjb25zdCBzdWJUZW1wbGF0ZUluZGljaWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIG51bWJlcnxudWxsPigpO1xuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRpY2llcy5zZXQob3AueHJlZiwgb3Auc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5leHQgYXZhaWxhYmxlIGV4cHJlc3Npb24gaW5kZXggcGVyIGkxOG4gY29udGV4dC5cbiAgY29uc3QgZXhwcmVzc2lvbkluZGljZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gZXhwcmVzc2lvbkluZGljZXMuZ2V0KG9wLmNvbnRleHQpIHx8IDA7XG4gICAgICAgIGNvbnN0IGkxOG5Db250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSE7XG4gICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPSBzdWJUZW1wbGF0ZUluZGljaWVzLmdldChpMThuQ29udGV4dC5pMThuQmxvY2spITtcbiAgICAgICAgLy8gQWRkIHRoZSBleHByZXNzaW9uIGluZGV4IGluIHRoZSBhcHByb3ByaWF0ZSBwYXJhbXMgbWFwLlxuICAgICAgICBjb25zdCBwYXJhbXMgPSBvcC5yZXNvbHV0aW9uVGltZSA9PT0gaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb24gP1xuICAgICAgICAgICAgaTE4bkNvbnRleHQucGFyYW1zIDpcbiAgICAgICAgICAgIGkxOG5Db250ZXh0LnBvc3Rwcm9jZXNzaW5nUGFyYW1zO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBwYXJhbXMuZ2V0KG9wLmkxOG5QbGFjZWhvbGRlcikgfHwgW107XG4gICAgICAgIHZhbHVlcy5wdXNoKFxuICAgICAgICAgICAge3ZhbHVlOiBpbmRleCwgc3ViVGVtcGxhdGVJbmRleDogc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZX0pO1xuICAgICAgICBwYXJhbXMuc2V0KG9wLmkxOG5QbGFjZWhvbGRlciwgdmFsdWVzKTtcblxuICAgICAgICBleHByZXNzaW9uSW5kaWNlcy5zZXQob3AuY29udGV4dCwgaW5kZXggKyAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==