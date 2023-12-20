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
    const icuPlaceholders = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    subTemplateIndicies.set(op.xref, op.subTemplateIndex);
                    break;
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.IcuPlaceholder:
                    icuPlaceholders.set(op.xref, op);
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
                const index = expressionIndices.get(referenceIndex(op)) || 0;
                const subTemplateIndex = subTemplateIndicies.get(op.i18nOwner) ?? null;
                const value = {
                    value: index,
                    subTemplateIndex: subTemplateIndex,
                    flags: ir.I18nParamValueFlags.ExpressionIndex
                };
                updatePlaceholder(op, value, i18nContexts, icuPlaceholders);
                expressionIndices.set(referenceIndex(op), index + 1);
            }
        }
    }
}
function updatePlaceholder(op, value, i18nContexts, icuPlaceholders) {
    if (op.i18nPlaceholder !== null) {
        const i18nContext = i18nContexts.get(op.context);
        const params = op.resolutionTime === ir.I18nParamResolutionTime.Creation ?
            i18nContext.params :
            i18nContext.postprocessingParams;
        const values = params.get(op.i18nPlaceholder) || [];
        values.push(value);
        params.set(op.i18nPlaceholder, values);
    }
    if (op.icuPlaceholder !== null) {
        const icuPlaceholderOp = icuPlaceholders.get(op.icuPlaceholder);
        icuPlaceholderOp?.expressionPlaceholders.push(value);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2V4cHJlc3Npb25fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLEdBQTRCO0lBQzVFLG1GQUFtRjtJQUNuRixNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO0lBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFrQyxDQUFDO0lBQ2xFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixtQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDdEQsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVztvQkFDeEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjO29CQUMzQixlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ2pDLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCwyRUFBMkU7SUFDM0UsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztJQUV2RCx1REFBdUQ7SUFDdkQsZ0dBQWdHO0lBQ2hHLGdHQUFnRztJQUNoRyw4RUFBOEU7SUFDOUUsTUFBTSxjQUFjLEdBQUcsQ0FBQyxFQUF1QixFQUFhLEVBQUUsQ0FDMUQsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDO0lBRTNFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUN4QyxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxNQUFNLGdCQUFnQixHQUFHLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDO2dCQUN2RSxNQUFNLEtBQUssR0FBc0I7b0JBQy9CLEtBQUssRUFBRSxLQUFLO29CQUNaLGdCQUFnQixFQUFFLGdCQUFnQjtvQkFDbEMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlO2lCQUM5QyxDQUFDO2dCQUNGLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLGVBQWUsQ0FBQyxDQUFDO2dCQUM1RCxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQzthQUN0RDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FDdEIsRUFBdUIsRUFBRSxLQUF3QixFQUNqRCxZQUE4QyxFQUM5QyxlQUFvRDtJQUN0RCxJQUFJLEVBQUUsQ0FBQyxlQUFlLEtBQUssSUFBSSxFQUFFO1FBQy9CLE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBRSxDQUFDO1FBQ2xELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxjQUFjLEtBQUssRUFBRSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RFLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwQixXQUFXLENBQUMsb0JBQW9CLENBQUM7UUFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BELE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0tBQ3hDO0lBQ0QsSUFBSSxFQUFFLENBQUMsY0FBYyxLQUFLLElBQUksRUFBRTtRQUM5QixNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2hFLGdCQUFnQixFQUFFLHNCQUFzQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUN0RDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGkxOG4gZXhwcmVzc2lvbiBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuRXhwcmVzc2lvblBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGkxOG4gY29udGV4dCBvcHMsIGFuZCB0aGUgc3ViLXRlbXBsYXRlIGluZGV4IGZvciBlYWNoIGkxOG4gb3AuXG4gIGNvbnN0IHN1YlRlbXBsYXRlSW5kaWNpZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyfG51bGw+KCk7XG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBjb25zdCBpY3VQbGFjZWhvbGRlcnMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSWN1UGxhY2Vob2xkZXJPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRpY2llcy5zZXQob3AueHJlZiwgb3Auc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VQbGFjZWhvbGRlcjpcbiAgICAgICAgICBpY3VQbGFjZWhvbGRlcnMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBuZXh0IGF2YWlsYWJsZSBleHByZXNzaW9uIGluZGV4IGZvciBlYWNoIGkxOG4gbWVzc2FnZS5cbiAgY29uc3QgZXhwcmVzc2lvbkluZGljZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuXG4gIC8vIEtlZXAgdHJhY2sgb2YgYSByZWZlcmVuY2UgaW5kZXggZm9yIGVhY2ggZXhwcmVzc2lvbi5cbiAgLy8gV2UgdXNlIGRpZmZlcmVudCByZWZlcmVuY2VzIGZvciBub3JtYWwgaTE4biBleHByZXNzaW8gYW5kIGF0dHJpYnV0ZSBpMThuIGV4cHJlc3Npb25zLiBUaGlzIGlzXG4gIC8vIGJlY2F1c2UgY2hpbGQgaTE4biBibG9ja3MgaW4gdGVtcGxhdGVzIGRvbid0IGdldCB0aGVpciBvd24gY29udGV4dCwgc2luY2UgdGhleSdyZSByb2xsZWQgaW50b1xuICAvLyB0aGUgdHJhbnNsYXRlZCBtZXNzYWdlIG9mIHRoZSBwYXJlbnQsIGJ1dCB0aGV5IG1heSB0YXJnZXQgYSBkaWZmZXJlbnQgc2xvdC5cbiAgY29uc3QgcmVmZXJlbmNlSW5kZXggPSAob3A6IGlyLkkxOG5FeHByZXNzaW9uT3ApOiBpci5YcmVmSWQgPT5cbiAgICAgIG9wLnVzYWdlID09PSBpci5JMThuRXhwcmVzc2lvbkZvci5JMThuVGV4dCA/IG9wLmkxOG5Pd25lciA6IG9wLmNvbnRleHQ7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBleHByZXNzaW9uSW5kaWNlcy5nZXQocmVmZXJlbmNlSW5kZXgob3ApKSB8fCAwO1xuICAgICAgICBjb25zdCBzdWJUZW1wbGF0ZUluZGV4ID0gc3ViVGVtcGxhdGVJbmRpY2llcy5nZXQob3AuaTE4bk93bmVyKSA/PyBudWxsO1xuICAgICAgICBjb25zdCB2YWx1ZTogaXIuSTE4blBhcmFtVmFsdWUgPSB7XG4gICAgICAgICAgdmFsdWU6IGluZGV4LFxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXg6IHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRXhwcmVzc2lvbkluZGV4XG4gICAgICAgIH07XG4gICAgICAgIHVwZGF0ZVBsYWNlaG9sZGVyKG9wLCB2YWx1ZSwgaTE4bkNvbnRleHRzLCBpY3VQbGFjZWhvbGRlcnMpO1xuICAgICAgICBleHByZXNzaW9uSW5kaWNlcy5zZXQocmVmZXJlbmNlSW5kZXgob3ApLCBpbmRleCArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVQbGFjZWhvbGRlcihcbiAgICBvcDogaXIuSTE4bkV4cHJlc3Npb25PcCwgdmFsdWU6IGlyLkkxOG5QYXJhbVZhbHVlLFxuICAgIGkxOG5Db250ZXh0czogTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4sXG4gICAgaWN1UGxhY2Vob2xkZXJzOiBNYXA8aXIuWHJlZklkLCBpci5JY3VQbGFjZWhvbGRlck9wPikge1xuICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSBudWxsKSB7XG4gICAgY29uc3QgaTE4bkNvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpITtcbiAgICBjb25zdCBwYXJhbXMgPSBvcC5yZXNvbHV0aW9uVGltZSA9PT0gaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb24gP1xuICAgICAgICBpMThuQ29udGV4dC5wYXJhbXMgOlxuICAgICAgICBpMThuQ29udGV4dC5wb3N0cHJvY2Vzc2luZ1BhcmFtcztcbiAgICBjb25zdCB2YWx1ZXMgPSBwYXJhbXMuZ2V0KG9wLmkxOG5QbGFjZWhvbGRlcikgfHwgW107XG4gICAgdmFsdWVzLnB1c2godmFsdWUpO1xuICAgIHBhcmFtcy5zZXQob3AuaTE4blBsYWNlaG9sZGVyLCB2YWx1ZXMpO1xuICB9XG4gIGlmIChvcC5pY3VQbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGljdVBsYWNlaG9sZGVyT3AgPSBpY3VQbGFjZWhvbGRlcnMuZ2V0KG9wLmljdVBsYWNlaG9sZGVyKTtcbiAgICBpY3VQbGFjZWhvbGRlck9wPy5leHByZXNzaW9uUGxhY2Vob2xkZXJzLnB1c2godmFsdWUpO1xuICB9XG59XG4iXX0=