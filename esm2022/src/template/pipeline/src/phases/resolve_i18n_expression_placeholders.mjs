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
    // Keep track of the next available expression index for each i18n message.
    const expressionIndices = new Map();
    // Keep track of a reference index for each expression.
    // We use different references for normal i18n expressio and attribute i18n expressions. This is
    // because child i18n blocks in templates don't get their own context, since they're rolled into
    // the translated message of the parent, but they may target a different slot.
    const referenceIndex = (op) => op.usage === ir.I18nExpressionFor.I18nText ? op.i18nOwner : op.context;
    for (const unit of job.units) {
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const i18nContext = i18nContexts.get(op.context);
                const index = expressionIndices.get(referenceIndex(op)) || 0;
                const subTemplateIndex = subTemplateIndicies.get(op.i18nOwner) ?? null;
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
                expressionIndices.set(referenceIndex(op), index + 1);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLG1GQUFtRjtJQUNuRixNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO0lBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ3RELE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtZQUNWLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELDJFQUEyRTtJQUMzRSxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRXZELHVEQUF1RDtJQUN2RCxnR0FBZ0c7SUFDaEcsZ0dBQWdHO0lBQ2hHLDhFQUE4RTtJQUM5RSxNQUFNLGNBQWMsR0FBRyxDQUFDLEVBQXVCLEVBQWEsRUFBRSxDQUMxRCxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUM7SUFFM0UsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3pDLE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBRSxDQUFDO2dCQUNsRCxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxNQUFNLGdCQUFnQixHQUFHLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDO2dCQUN2RSwwREFBMEQ7Z0JBQzFELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3BCLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNwRCxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUNWLEtBQUssRUFBRSxLQUFLO29CQUNaLGdCQUFnQixFQUFFLGdCQUFnQjtvQkFDbEMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlO2lCQUM5QyxDQUFDLENBQUM7Z0JBQ0gsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUV2QyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN2RCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBpMThuIGV4cHJlc3Npb24gcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkV4cHJlc3Npb25QbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBpMThuIGNvbnRleHQgb3BzLCBhbmQgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCBmb3IgZWFjaCBpMThuIG9wLlxuICBjb25zdCBzdWJUZW1wbGF0ZUluZGljaWVzID0gbmV3IE1hcDxpci5YcmVmSWQsIG51bWJlcnxudWxsPigpO1xuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRpY2llcy5zZXQob3AueHJlZiwgb3Auc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEtlZXAgdHJhY2sgb2YgdGhlIG5leHQgYXZhaWxhYmxlIGV4cHJlc3Npb24gaW5kZXggZm9yIGVhY2ggaTE4biBtZXNzYWdlLlxuICBjb25zdCBleHByZXNzaW9uSW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG5cbiAgLy8gS2VlcCB0cmFjayBvZiBhIHJlZmVyZW5jZSBpbmRleCBmb3IgZWFjaCBleHByZXNzaW9uLlxuICAvLyBXZSB1c2UgZGlmZmVyZW50IHJlZmVyZW5jZXMgZm9yIG5vcm1hbCBpMThuIGV4cHJlc3NpbyBhbmQgYXR0cmlidXRlIGkxOG4gZXhwcmVzc2lvbnMuIFRoaXMgaXNcbiAgLy8gYmVjYXVzZSBjaGlsZCBpMThuIGJsb2NrcyBpbiB0ZW1wbGF0ZXMgZG9uJ3QgZ2V0IHRoZWlyIG93biBjb250ZXh0LCBzaW5jZSB0aGV5J3JlIHJvbGxlZCBpbnRvXG4gIC8vIHRoZSB0cmFuc2xhdGVkIG1lc3NhZ2Ugb2YgdGhlIHBhcmVudCwgYnV0IHRoZXkgbWF5IHRhcmdldCBhIGRpZmZlcmVudCBzbG90LlxuICBjb25zdCByZWZlcmVuY2VJbmRleCA9IChvcDogaXIuSTE4bkV4cHJlc3Npb25PcCk6IGlyLlhyZWZJZCA9PlxuICAgICAgb3AudXNhZ2UgPT09IGlyLkkxOG5FeHByZXNzaW9uRm9yLkkxOG5UZXh0ID8gb3AuaTE4bk93bmVyIDogb3AuY29udGV4dDtcblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCBpMThuQ29udGV4dCA9IGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCkhO1xuICAgICAgICBjb25zdCBpbmRleCA9IGV4cHJlc3Npb25JbmRpY2VzLmdldChyZWZlcmVuY2VJbmRleChvcCkpIHx8IDA7XG4gICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPSBzdWJUZW1wbGF0ZUluZGljaWVzLmdldChvcC5pMThuT3duZXIpID8/IG51bGw7XG4gICAgICAgIC8vIEFkZCB0aGUgZXhwcmVzc2lvbiBpbmRleCBpbiB0aGUgYXBwcm9wcmlhdGUgcGFyYW1zIG1hcC5cbiAgICAgICAgY29uc3QgcGFyYW1zID0gb3AucmVzb2x1dGlvblRpbWUgPT09IGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uID9cbiAgICAgICAgICAgIGkxOG5Db250ZXh0LnBhcmFtcyA6XG4gICAgICAgICAgICBpMThuQ29udGV4dC5wb3N0cHJvY2Vzc2luZ1BhcmFtcztcbiAgICAgICAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChvcC5pMThuUGxhY2Vob2xkZXIpIHx8IFtdO1xuICAgICAgICB2YWx1ZXMucHVzaCh7XG4gICAgICAgICAgdmFsdWU6IGluZGV4LFxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXg6IHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRXhwcmVzc2lvbkluZGV4XG4gICAgICAgIH0pO1xuICAgICAgICBwYXJhbXMuc2V0KG9wLmkxOG5QbGFjZWhvbGRlciwgdmFsdWVzKTtcblxuICAgICAgICBleHByZXNzaW9uSW5kaWNlcy5zZXQocmVmZXJlbmNlSW5kZXgob3ApLCBpbmRleCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19