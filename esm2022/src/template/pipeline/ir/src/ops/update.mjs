/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { OpKind } from '../enums';
import { TRAIT_CONSUMES_VARS, TRAIT_DEPENDS_ON_SLOT_CONTEXT } from '../traits';
import { NEW_OP } from './shared';
/**
 * Create an `InterpolationTextOp`.
 */
export function createInterpolateTextOp(xref, interpolation, sourceSpan) {
    return {
        kind: OpKind.InterpolateText,
        target: xref,
        interpolation,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
export class Interpolation {
    constructor(strings, expressions, i18nPlaceholders) {
        this.strings = strings;
        this.expressions = expressions;
        this.i18nPlaceholders = i18nPlaceholders;
        if (i18nPlaceholders.length !== 0 && i18nPlaceholders.length !== expressions.length) {
            throw new Error(`Expected ${expressions.length} placeholders to match interpolation expression count, but got ${i18nPlaceholders.length}`);
        }
    }
}
/**
 * Create a `BindingOp`, not yet transformed into a particular type of binding.
 */
export function createBindingOp(target, kind, name, expression, unit, securityContext, isTextAttribute, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
    return {
        kind: OpKind.Binding,
        bindingKind: kind,
        target,
        name,
        expression,
        unit,
        securityContext,
        isTextAttribute,
        isStructuralTemplateAttribute,
        templateKind,
        i18nContext: null,
        i18nMessage,
        sourceSpan,
        ...NEW_OP,
    };
}
/**
 * Create a `PropertyOp`.
 */
export function createPropertyOp(target, name, expression, isAnimationTrigger, securityContext, isStructuralTemplateAttribute, templateKind, i18nContext, i18nMessage, sourceSpan) {
    return {
        kind: OpKind.Property,
        target,
        name,
        expression,
        isAnimationTrigger,
        securityContext,
        sanitizer: null,
        isStructuralTemplateAttribute,
        templateKind,
        i18nContext,
        i18nMessage,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/** Create a `StylePropOp`. */
export function createStylePropOp(xref, name, expression, unit, sourceSpan) {
    return {
        kind: OpKind.StyleProp,
        target: xref,
        name,
        expression,
        unit,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/**
 * Create a `ClassPropOp`.
 */
export function createClassPropOp(xref, name, expression, sourceSpan) {
    return {
        kind: OpKind.ClassProp,
        target: xref,
        name,
        expression,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/** Create a `StyleMapOp`. */
export function createStyleMapOp(xref, expression, sourceSpan) {
    return {
        kind: OpKind.StyleMap,
        target: xref,
        expression,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/**
 * Create a `ClassMapOp`.
 */
export function createClassMapOp(xref, expression, sourceSpan) {
    return {
        kind: OpKind.ClassMap,
        target: xref,
        expression,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/**
 * Create an `AttributeOp`.
 */
export function createAttributeOp(target, name, expression, securityContext, isTextAttribute, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
    return {
        kind: OpKind.Attribute,
        target,
        name,
        expression,
        securityContext,
        sanitizer: null,
        isTextAttribute,
        isStructuralTemplateAttribute,
        templateKind,
        i18nContext: null,
        i18nMessage,
        sourceSpan,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
        ...NEW_OP,
    };
}
/**
 * Create an `AdvanceOp`.
 */
export function createAdvanceOp(delta, sourceSpan) {
    return {
        kind: OpKind.Advance,
        delta,
        sourceSpan,
        ...NEW_OP,
    };
}
/**
 * Create a conditional op, which will display an embedded view according to a condtion.
 */
export function createConditionalOp(target, targetSlot, test, conditions, sourceSpan) {
    return {
        kind: OpKind.Conditional,
        target,
        targetSlot,
        test,
        conditions,
        processed: null,
        sourceSpan,
        contextValue: null,
        ...NEW_OP,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
        ...TRAIT_CONSUMES_VARS,
    };
}
export function createRepeaterOp(repeaterCreate, targetSlot, collection, sourceSpan) {
    return {
        kind: OpKind.Repeater,
        target: repeaterCreate,
        targetSlot,
        collection,
        sourceSpan,
        ...NEW_OP,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    };
}
export function createDeferWhenOp(target, expr, prefetch, sourceSpan) {
    return {
        kind: OpKind.DeferWhen,
        target,
        expr,
        prefetch,
        sourceSpan,
        ...NEW_OP,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    };
}
/**
 * Create an i18n expression op.
 */
export function createI18nExpressionOp(context, target, i18nOwner, handle, expression, i18nPlaceholder, resolutionTime, usage, name, sourceSpan) {
    return {
        kind: OpKind.I18nExpression,
        context,
        target,
        i18nOwner,
        handle,
        expression,
        i18nPlaceholder,
        resolutionTime,
        usage,
        name,
        sourceSpan,
        ...NEW_OP,
        ...TRAIT_CONSUMES_VARS,
        ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    };
}
/**
 * Creates an op to apply i18n expression ops.
 */
export function createI18nApplyOp(owner, handle, sourceSpan) {
    return {
        kind: OpKind.I18nApply,
        owner,
        handle,
        sourceSpan,
        ...NEW_OP,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL2lyL3NyYy9vcHMvdXBkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQU1ILE9BQU8sRUFBMEQsTUFBTSxFQUFlLE1BQU0sVUFBVSxDQUFDO0FBSXZHLE9BQU8sRUFBaUQsbUJBQW1CLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFN0gsT0FBTyxFQUFZLE1BQU0sRUFBMEIsTUFBTSxVQUFVLENBQUM7QUFpQ3BFOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUNuQyxJQUFZLEVBQUUsYUFBNEIsRUFBRSxVQUEyQjtJQUN6RSxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxlQUFlO1FBQzVCLE1BQU0sRUFBRSxJQUFJO1FBQ1osYUFBYTtRQUNiLFVBQVU7UUFDVixHQUFHLDZCQUE2QjtRQUNoQyxHQUFHLG1CQUFtQjtRQUN0QixHQUFHLE1BQU07S0FDVixDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sT0FBTyxhQUFhO0lBQ3hCLFlBQ2EsT0FBaUIsRUFBVyxXQUEyQixFQUN2RCxnQkFBMEI7UUFEMUIsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUFXLGdCQUFXLEdBQVgsV0FBVyxDQUFnQjtRQUN2RCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVU7UUFDckMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDcEYsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUNaLFdBQVcsQ0FBQyxNQUFNLGtFQUNsQixnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0NBQ0Y7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VTtRQUNWLEdBQUcsTUFBTTtRQUNULEdBQUcsNkJBQTZCO0tBQ2pDLENBQUM7QUFDSixDQUFDO0FBdUJELE1BQU0sVUFBVSxpQkFBaUIsQ0FDN0IsTUFBYyxFQUFFLElBQWtCLEVBQUUsUUFBaUIsRUFDckQsVUFBMkI7SUFDN0IsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsU0FBUztRQUN0QixNQUFNO1FBQ04sSUFBSTtRQUNKLFFBQVE7UUFDUixVQUFVO1FBQ1YsR0FBRyxNQUFNO1FBQ1QsR0FBRyw2QkFBNkI7S0FDakMsQ0FBQztBQUNKLENBQUM7QUF5RUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ2xDLE9BQWUsRUFBRSxNQUFjLEVBQUUsU0FBaUIsRUFBRSxNQUFrQixFQUN0RSxVQUF3QixFQUFFLGVBQXVCLEVBQUUsY0FBdUMsRUFDMUYsS0FBd0IsRUFBRSxJQUFZLEVBQUUsVUFBMkI7SUFDckUsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsY0FBYztRQUMzQixPQUFPO1FBQ1AsTUFBTTtRQUNOLFNBQVM7UUFDVCxNQUFNO1FBQ04sVUFBVTtRQUNWLGVBQWU7UUFDZixjQUFjO1FBQ2QsS0FBSztRQUNMLElBQUk7UUFDSixVQUFVO1FBQ1YsR0FBRyxNQUFNO1FBQ1QsR0FBRyxtQkFBbUI7UUFDdEIsR0FBRyw2QkFBNkI7S0FDakMsQ0FBQztBQUNKLENBQUM7QUF5QkQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQzdCLEtBQWEsRUFBRSxNQUFrQixFQUFFLFVBQTJCO0lBQ2hFLE9BQU87UUFDTCxJQUFJLEVBQUUsTUFBTSxDQUFDLFNBQVM7UUFDdEIsS0FBSztRQUNMLE1BQU07UUFDTixVQUFVO1FBQ1YsR0FBRyxNQUFNO0tBQ1YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nS2luZCwgSTE4bkV4cHJlc3Npb25Gb3IsIEkxOG5QYXJhbVJlc29sdXRpb25UaW1lLCBPcEtpbmQsIFRlbXBsYXRlS2luZH0gZnJvbSAnLi4vZW51bXMnO1xuaW1wb3J0IHR5cGUge0NvbmRpdGlvbmFsQ2FzZUV4cHJ9IGZyb20gJy4uL2V4cHJlc3Npb24nO1xuaW1wb3J0IHtTbG90SGFuZGxlfSBmcm9tICcuLi9oYW5kbGUnO1xuaW1wb3J0IHtPcCwgWHJlZklkfSBmcm9tICcuLi9vcGVyYXRpb25zJztcbmltcG9ydCB7Q29uc3VtZXNWYXJzVHJhaXQsIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCwgVFJBSVRfQ09OU1VNRVNfVkFSUywgVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFR9IGZyb20gJy4uL3RyYWl0cyc7XG5pbXBvcnQgdHlwZSB7SG9zdFByb3BlcnR5T3B9IGZyb20gJy4vaG9zdCc7XG5pbXBvcnQge0xpc3RFbmRPcCwgTkVXX09QLCBTdGF0ZW1lbnRPcCwgVmFyaWFibGVPcH0gZnJvbSAnLi9zaGFyZWQnO1xuXG5cbi8qKlxuICogQW4gb3BlcmF0aW9uIHVzYWJsZSBvbiB0aGUgdXBkYXRlIHNpZGUgb2YgdGhlIElSLlxuICovXG5leHBvcnQgdHlwZSBVcGRhdGVPcCA9IExpc3RFbmRPcDxVcGRhdGVPcD58U3RhdGVtZW50T3A8VXBkYXRlT3A+fFByb3BlcnR5T3B8QXR0cmlidXRlT3B8U3R5bGVQcm9wT3B8XG4gICAgQ2xhc3NQcm9wT3B8U3R5bGVNYXBPcHxDbGFzc01hcE9wfEludGVycG9sYXRlVGV4dE9wfEFkdmFuY2VPcHxWYXJpYWJsZU9wPFVwZGF0ZU9wPnxCaW5kaW5nT3B8XG4gICAgSG9zdFByb3BlcnR5T3B8Q29uZGl0aW9uYWxPcHxJMThuRXhwcmVzc2lvbk9wfEkxOG5BcHBseU9wfFJlcGVhdGVyT3B8RGVmZXJXaGVuT3A7XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiB0byBwZXJmb3JtIHN0cmluZyBpbnRlcnBvbGF0aW9uIG9uIGEgdGV4dCBub2RlLlxuICpcbiAqIEludGVycG9sYXRpb24gaW5wdXRzIGFyZSBzdG9yZWQgYXMgc3RhdGljIGBzdHJpbmdgcyBhbmQgZHluYW1pYyBgby5FeHByZXNzaW9uYHMsIGluIHNlcGFyYXRlXG4gKiBhcnJheXMuIFRodXMsIHRoZSBpbnRlcnBvbGF0aW9uIGBBe3tifX1De3tkfX1FYCBpcyBzdG9yZWQgYXMgMyBzdGF0aWMgc3RyaW5ncyBgWydBJywgJ0MnLCAnRSddYFxuICogYW5kIDIgZHluYW1pYyBleHByZXNzaW9ucyBgW2IsIGRdYC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnRlcnBvbGF0ZVRleHRPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgQ29uc3VtZXNWYXJzVHJhaXQge1xuICBraW5kOiBPcEtpbmQuSW50ZXJwb2xhdGVUZXh0O1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIHRleHQgbm9kZSB0byB3aGljaCB0aGUgaW50ZXJwb2xhdGlvbiBpcyBib3VuZC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBUaGUgaW50ZXJwb2xhdGVkIHZhbHVlLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbjtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGBJbnRlcnBvbGF0aW9uVGV4dE9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUludGVycG9sYXRlVGV4dE9wKFxuICAgIHhyZWY6IFhyZWZJZCwgaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogSW50ZXJwb2xhdGVUZXh0T3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5JbnRlcnBvbGF0ZVRleHQsXG4gICAgdGFyZ2V0OiB4cmVmLFxuICAgIGludGVycG9sYXRpb24sXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19WQVJTLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb24ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IHN0cmluZ3M6IHN0cmluZ1tdLCByZWFkb25seSBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sXG4gICAgICByZWFkb25seSBpMThuUGxhY2Vob2xkZXJzOiBzdHJpbmdbXSkge1xuICAgIGlmIChpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCAhPT0gMCAmJiBpMThuUGxhY2Vob2xkZXJzLmxlbmd0aCAhPT0gZXhwcmVzc2lvbnMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7XG4gICAgICAgICAgZXhwcmVzc2lvbnMubGVuZ3RofSBwbGFjZWhvbGRlcnMgdG8gbWF0Y2ggaW50ZXJwb2xhdGlvbiBleHByZXNzaW9uIGNvdW50LCBidXQgZ290ICR7XG4gICAgICAgICAgaTE4blBsYWNlaG9sZGVycy5sZW5ndGh9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQW4gaW50ZXJtZWRpYXRlIGJpbmRpbmcgb3AsIHRoYXQgaGFzIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWQgaW50byBhbiBpbmRpdmlkdWFsIHByb3BlcnR5LFxuICogYXR0cmlidXRlLCBzdHlsZSwgZXRjLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEJpbmRpbmdPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiB7XG4gIGtpbmQ6IE9wS2luZC5CaW5kaW5nO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqICBUaGUga2luZCBvZiBiaW5kaW5nIHJlcHJlc2VudGVkIGJ5IHRoaXMgb3AuXG4gICAqL1xuICBiaW5kaW5nS2luZDogQmluZGluZ0tpbmQ7XG5cbiAgLyoqXG4gICAqICBUaGUgbmFtZSBvZiB0aGlzIGJpbmRpbmcuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEV4cHJlc3Npb24gd2hpY2ggaXMgYm91bmQgdG8gdGhlIHByb3BlcnR5LlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb247XG5cbiAgLyoqXG4gICAqIFRoZSB1bml0IG9mIHRoZSBib3VuZCB2YWx1ZS5cbiAgICovXG4gIHVuaXQ6IHN0cmluZ3xudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAgICovXG4gIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0O1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBiaW5kaW5nIGlzIGEgVGV4dEF0dHJpYnV0ZSAoZS5nLiBgc29tZS1hdHRyPVwic29tZS12YWx1ZVwiYCkuIFRoaXMgbmVlZHMgdG8gYmVcbiAgICogdHJhY2tlZCBmb3IgY29tcGF0aWJsaXR5IHdpdGggYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgIHdoaWNoIHRyZWF0cyBgc3R5bGVgIGFuZCBgY2xhc3NgXG4gICAqIFRleHRBdHRyaWJ1dGVzIGRpZmZlcmVudGx5IGZyb20gYFthdHRyLnN0eWxlXWAgYW5kIGBbYXR0ci5jbGFzc11gLlxuICAgKi9cbiAgaXNUZXh0QXR0cmlidXRlOiBib29sZWFuO1xuXG4gIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoaXMgYmluZGluZyBpcyBvbiBhIHN0cnVjdHVyYWwgdGVtcGxhdGUuXG4gICAqL1xuICB0ZW1wbGF0ZUtpbmQ6IFRlbXBsYXRlS2luZHxudWxsO1xuXG4gIGkxOG5Db250ZXh0OiBYcmVmSWR8bnVsbDtcbiAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgQmluZGluZ09wYCwgbm90IHlldCB0cmFuc2Zvcm1lZCBpbnRvIGEgcGFydGljdWxhciB0eXBlIG9mIGJpbmRpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCaW5kaW5nT3AoXG4gICAgdGFyZ2V0OiBYcmVmSWQsIGtpbmQ6IEJpbmRpbmdLaW5kLCBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uLFxuICAgIHVuaXQ6IHN0cmluZ3xudWxsLCBzZWN1cml0eUNvbnRleHQ6IFNlY3VyaXR5Q29udGV4dCwgaXNUZXh0QXR0cmlidXRlOiBib29sZWFuLFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuLCB0ZW1wbGF0ZUtpbmQ6IFRlbXBsYXRlS2luZHxudWxsLFxuICAgIGkxOG5NZXNzYWdlOiBpMThuLk1lc3NhZ2V8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQmluZGluZ09wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuQmluZGluZyxcbiAgICBiaW5kaW5nS2luZDoga2luZCxcbiAgICB0YXJnZXQsXG4gICAgbmFtZSxcbiAgICBleHByZXNzaW9uLFxuICAgIHVuaXQsXG4gICAgc2VjdXJpdHlDb250ZXh0LFxuICAgIGlzVGV4dEF0dHJpYnV0ZSxcbiAgICBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSxcbiAgICB0ZW1wbGF0ZUtpbmQsXG4gICAgaTE4bkNvbnRleHQ6IG51bGwsXG4gICAgaTE4bk1lc3NhZ2UsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYmluZGluZyB0byBhIHByb3BlcnR5IGluIHRoZSB1cGRhdGUgSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJvcGVydHlPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgQ29uc3VtZXNWYXJzVHJhaXQsIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5Qcm9wZXJ0eTtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IG9uIHdoaWNoIHRoZSBwcm9wZXJ0eSBpcyBib3VuZC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBib3VuZCBwcm9wZXJ0eS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogRXhwcmVzc2lvbiB3aGljaCBpcyBib3VuZCB0byB0aGUgcHJvcGVydHkuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGlzIHByb3BlcnR5IGlzIGFuIGFuaW1hdGlvbiB0cmlnZ2VyLlxuICAgKi9cbiAgaXNBbmltYXRpb25UcmlnZ2VyOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAgICovXG4gIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0O1xuXG4gIC8qKlxuICAgKiBUaGUgc2FuaXRpemVyIGZvciB0aGlzIHByb3BlcnR5LlxuICAgKi9cbiAgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGtpbmQgb2YgdGVtcGxhdGUgdGFyZ2V0ZWQgYnkgdGhlIGJpbmRpbmcsIG9yIG51bGwgaWYgdGhpcyBiaW5kaW5nIGRvZXMgbm90IHRhcmdldCBhXG4gICAqIHRlbXBsYXRlLlxuICAgKi9cbiAgdGVtcGxhdGVLaW5kOiBUZW1wbGF0ZUtpbmR8bnVsbDtcblxuICBpMThuQ29udGV4dDogWHJlZklkfG51bGw7XG4gIGkxOG5NZXNzYWdlOiBpMThuLk1lc3NhZ2V8bnVsbDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYFByb3BlcnR5T3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUHJvcGVydHlPcChcbiAgICB0YXJnZXQ6IFhyZWZJZCwgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbixcbiAgICBpc0FuaW1hdGlvblRyaWdnZXI6IGJvb2xlYW4sIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuLCB0ZW1wbGF0ZUtpbmQ6IFRlbXBsYXRlS2luZHxudWxsLFxuICAgIGkxOG5Db250ZXh0OiBYcmVmSWR8bnVsbCwgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFByb3BlcnR5T3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5Qcm9wZXJ0eSxcbiAgICB0YXJnZXQsXG4gICAgbmFtZSxcbiAgICBleHByZXNzaW9uLFxuICAgIGlzQW5pbWF0aW9uVHJpZ2dlcixcbiAgICBzZWN1cml0eUNvbnRleHQsXG4gICAgc2FuaXRpemVyOiBudWxsLFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLFxuICAgIHRlbXBsYXRlS2luZCxcbiAgICBpMThuQ29udGV4dCxcbiAgICBpMThuTWVzc2FnZSxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIEEgbG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGJpbmRpbmcgdG8gYSBzdHlsZSBwcm9wZXJ0eSBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxlUHJvcE9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLlN0eWxlUHJvcDtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IG9uIHdoaWNoIHRoZSBwcm9wZXJ0eSBpcyBib3VuZC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBib3VuZCBwcm9wZXJ0eS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogRXhwcmVzc2lvbiB3aGljaCBpcyBib3VuZCB0byB0aGUgcHJvcGVydHkuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbjtcblxuICAvKipcbiAgICogVGhlIHVuaXQgb2YgdGhlIGJvdW5kIHZhbHVlLlxuICAgKi9cbiAgdW5pdDogc3RyaW5nfG51bGw7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKiogQ3JlYXRlIGEgYFN0eWxlUHJvcE9wYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZVByb3BPcChcbiAgICB4cmVmOiBYcmVmSWQsIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb24sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFN0eWxlUHJvcE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuU3R5bGVQcm9wLFxuICAgIHRhcmdldDogeHJlZixcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgdW5pdCxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIEEgbG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGJpbmRpbmcgdG8gYSBjbGFzcyBwcm9wZXJ0eSBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzUHJvcE9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkNsYXNzUHJvcDtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IG9uIHdoaWNoIHRoZSBwcm9wZXJ0eSBpcyBib3VuZC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBib3VuZCBwcm9wZXJ0eS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogRXhwcmVzc2lvbiB3aGljaCBpcyBib3VuZCB0byB0aGUgcHJvcGVydHkuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb247XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGBDbGFzc1Byb3BPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDbGFzc1Byb3BPcChcbiAgICB4cmVmOiBYcmVmSWQsIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IENsYXNzUHJvcE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuQ2xhc3NQcm9wLFxuICAgIHRhcmdldDogeHJlZixcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19WQVJTLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBIGxvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBiaW5kaW5nIHRvIGEgc3R5bGUgbWFwIGluIHRoZSB1cGRhdGUgSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVNYXBPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgQ29uc3VtZXNWYXJzVHJhaXQsIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5TdHlsZU1hcDtcblxuICAvKipcbiAgICogUmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IG9uIHdoaWNoIHRoZSBwcm9wZXJ0eSBpcyBib3VuZC5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBFeHByZXNzaW9uIHdoaWNoIGlzIGJvdW5kIHRvIHRoZSBwcm9wZXJ0eS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqIENyZWF0ZSBhIGBTdHlsZU1hcE9wYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZU1hcE9wKFxuICAgIHhyZWY6IFhyZWZJZCwgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFN0eWxlTWFwT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5TdHlsZU1hcCxcbiAgICB0YXJnZXQ6IHhyZWYsXG4gICAgZXhwcmVzc2lvbixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIEEgbG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGJpbmRpbmcgdG8gYSBzdHlsZSBtYXAgaW4gdGhlIHVwZGF0ZSBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDbGFzc01hcE9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkNsYXNzTWFwO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEV4cHJlc3Npb24gd2hpY2ggaXMgYm91bmQgdG8gdGhlIHByb3BlcnR5LlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb247XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGBDbGFzc01hcE9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsYXNzTWFwT3AoXG4gICAgeHJlZjogWHJlZklkLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQ2xhc3NNYXBPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkNsYXNzTWFwLFxuICAgIHRhcmdldDogeHJlZixcbiAgICBleHByZXNzaW9uLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgc2V0dGluZyBhbiBhdHRyaWJ1dGUgb24gYW4gZWxlbWVudCBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEF0dHJpYnV0ZU9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+IHtcbiAga2luZDogT3BLaW5kLkF0dHJpYnV0ZTtcblxuICAvKipcbiAgICogVGhlIGBYcmVmSWRgIG9mIHRoZSB0ZW1wbGF0ZS1saWtlIGVsZW1lbnQgdGhlIGF0dHJpYnV0ZSB3aWxsIGJlbG9uZyB0by5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgc2VjdXJpdHkgY29udGV4dCBvZiB0aGUgYmluZGluZy5cbiAgICovXG4gIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0O1xuXG4gIC8qKlxuICAgKiBUaGUgc2FuaXRpemVyIGZvciB0aGlzIGF0dHJpYnV0ZS5cbiAgICovXG4gIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGJpbmRpbmcgaXMgYSBUZXh0QXR0cmlidXRlIChlLmcuIGBzb21lLWF0dHI9XCJzb21lLXZhbHVlXCJgKS4gVGhpcyBuZWVkcyBvdCBiZVxuICAgKiB0cmFja2VkIGZvciBjb21wYXRpYmxpdHkgd2l0aCBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgd2hpY2ggdHJlYXRzIGBzdHlsZWAgYW5kIGBjbGFzc2BcbiAgICogVGV4dEF0dHJpYnV0ZXMgZGlmZmVyZW50bHkgZnJvbSBgW2F0dHIuc3R5bGVdYCBhbmQgYFthdHRyLmNsYXNzXWAuXG4gICAqL1xuICBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW47XG5cbiAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBraW5kIG9mIHRlbXBsYXRlIHRhcmdldGVkIGJ5IHRoZSBiaW5kaW5nLCBvciBudWxsIGlmIHRoaXMgYmluZGluZyBkb2VzIG5vdCB0YXJnZXQgYVxuICAgKiB0ZW1wbGF0ZS5cbiAgICovXG4gIHRlbXBsYXRlS2luZDogVGVtcGxhdGVLaW5kfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBpMThuIGNvbnRleHQsIGlmIHRoaXMgaXMgYW4gaTE4biBhdHRyaWJ1dGUuXG4gICAqL1xuICBpMThuQ29udGV4dDogWHJlZklkfG51bGw7XG5cbiAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEF0dHJpYnV0ZU9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUF0dHJpYnV0ZU9wKFxuICAgIHRhcmdldDogWHJlZklkLCBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uLFxuICAgIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0LCBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW4sXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW4sIHRlbXBsYXRlS2luZDogVGVtcGxhdGVLaW5kfG51bGwsXG4gICAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBdHRyaWJ1dGVPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkF0dHJpYnV0ZSxcbiAgICB0YXJnZXQsXG4gICAgbmFtZSxcbiAgICBleHByZXNzaW9uLFxuICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICBzYW5pdGl6ZXI6IG51bGwsXG4gICAgaXNUZXh0QXR0cmlidXRlLFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLFxuICAgIHRlbXBsYXRlS2luZCxcbiAgICBpMThuQ29udGV4dDogbnVsbCxcbiAgICBpMThuTWVzc2FnZSxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbnRlcm5hbCBzbG90IHBvaW50ZXIgaW4gdGhlIHVwZGF0ZSBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBZHZhbmNlT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuQWR2YW5jZTtcblxuICAvKipcbiAgICogRGVsdGEgYnkgd2hpY2ggdG8gYWR2YW5jZSB0aGUgcG9pbnRlci5cbiAgICovXG4gIGRlbHRhOiBudW1iZXI7XG5cbiAgLy8gU291cmNlIHNwYW4gb2YgdGhlIGJpbmRpbmcgdGhhdCBjYXVzZWQgdGhlIGFkdmFuY2VcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBgQWR2YW5jZU9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFkdmFuY2VPcChkZWx0YTogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBZHZhbmNlT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5BZHZhbmNlLFxuICAgIGRlbHRhLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIExvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBhIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gaW4gdGhlIHVwZGF0ZSBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb25kaXRpb25hbE9wIGV4dGVuZHMgT3A8Q29uZGl0aW9uYWxPcD4sIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENvbnN1bWVzVmFyc1RyYWl0IHtcbiAga2luZDogT3BLaW5kLkNvbmRpdGlvbmFsO1xuXG4gIC8qKlxuICAgKiBUaGUgaW5zZXJ0aW9uIHBvaW50LCB3aGljaCBpcyB0aGUgZmlyc3QgdGVtcGxhdGUgaW4gdGhlIGNyZWF0aW9uIGJsb2NrIGJlbG9uZ2luZyB0byB0aGlzXG4gICAqIGNvbmRpdGlvbi5cbiAgICovXG4gIHRhcmdldDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBUaGUgc2xvdCBvZiB0aGUgdGFyZ2V0LCB0byBiZSBwb3B1bGF0ZWQgZHVyaW5nIHNsb3QgYWxsb2NhdGlvbi5cbiAgICovXG4gIHRhcmdldFNsb3Q6IFNsb3RIYW5kbGU7XG5cbiAgLyoqXG4gICAqIFRoZSBtYWluIHRlc3QgZXhwcmVzc2lvbiAoZm9yIGEgc3dpdGNoKSwgb3IgYG51bGxgIChmb3IgYW4gaWYsIHdoaWNoIGhhcyBubyB0ZXN0XG4gICAqIGV4cHJlc3Npb24pLlxuICAgKi9cbiAgdGVzdDogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIEVhY2ggcG9zc2libGUgZW1iZWRkZWQgdmlldyB0aGF0IGNvdWxkIGJlIGRpc3BsYXllZCBoYXMgYSBjb25kaXRpb24gKG9yIGlzIGRlZmF1bHQpLiBUaGlzXG4gICAqIHN0cnVjdHVyZSBtYXBzIGVhY2ggdmlldyB4cmVmIHRvIGl0cyBjb3JyZXNwb25kaW5nIGNvbmRpdGlvbi5cbiAgICovXG4gIGNvbmRpdGlvbnM6IEFycmF5PENvbmRpdGlvbmFsQ2FzZUV4cHI+O1xuXG4gIC8qKlxuICAgKiBBZnRlciBwcm9jZXNzaW5nLCB0aGlzIHdpbGwgYmUgYSBzaW5nbGUgY29sbGFwc2VkIEpvb3N0LWV4cHJlc3Npb24gdGhhdCBldmFsdWF0ZXMgdGhlXG4gICAqIGNvbmRpdGlvbnMsIGFuZCB5aWVsZHMgdGhlIHNsb3QgbnVtYmVyIG9mIHRoZSB0ZW1wbGF0ZSB3aGljaCBzaG91bGQgYmUgZGlzcGxheWVkLlxuICAgKi9cbiAgcHJvY2Vzc2VkOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogQ29udHJvbCBmbG93IGNvbmRpdGlvbmFscyBjYW4gYWNjZXB0IGEgY29udGV4dCB2YWx1ZSAodGhpcyBpcyBhIHJlc3VsdCBvZiBzcGVjaWZ5aW5nIGFuXG4gICAqIGFsaWFzKS4gVGhpcyBleHByZXNzaW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBjb25kaXRpb25hbCBpbnN0cnVjdGlvbidzIGNvbnRleHQgcGFyYW1ldGVyLlxuICAgKi9cbiAgY29udGV4dFZhbHVlOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgY29uZGl0aW9uYWwgb3AsIHdoaWNoIHdpbGwgZGlzcGxheSBhbiBlbWJlZGRlZCB2aWV3IGFjY29yZGluZyB0byBhIGNvbmR0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uZGl0aW9uYWxPcChcbiAgICB0YXJnZXQ6IFhyZWZJZCwgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZSwgdGVzdDogby5FeHByZXNzaW9ufG51bGwsXG4gICAgY29uZGl0aW9uczogQXJyYXk8Q29uZGl0aW9uYWxDYXNlRXhwcj4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IENvbmRpdGlvbmFsT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5Db25kaXRpb25hbCxcbiAgICB0YXJnZXQsXG4gICAgdGFyZ2V0U2xvdCxcbiAgICB0ZXN0LFxuICAgIGNvbmRpdGlvbnMsXG4gICAgcHJvY2Vzc2VkOiBudWxsLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgY29udGV4dFZhbHVlOiBudWxsLFxuICAgIC4uLk5FV19PUCxcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19WQVJTLFxuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlcGVhdGVyT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4sIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5SZXBlYXRlcjtcblxuICAvKipcbiAgICogVGhlIFJlcGVhdGVyQ3JlYXRlIG9wIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlcGVhdGVyLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZTtcblxuICAvKipcbiAgICogVGhlIGNvbGxlY3Rpb24gcHJvdmlkZWQgdG8gdGhlIGZvciBsb29wIGFzIGl0cyBleHByZXNzaW9uLlxuICAgKi9cbiAgY29sbGVjdGlvbjogby5FeHByZXNzaW9uO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlcGVhdGVyT3AoXG4gICAgcmVwZWF0ZXJDcmVhdGU6IFhyZWZJZCwgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZSwgY29sbGVjdGlvbjogby5FeHByZXNzaW9uLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFJlcGVhdGVyT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5SZXBlYXRlcixcbiAgICB0YXJnZXQ6IHJlcGVhdGVyQ3JlYXRlLFxuICAgIHRhcmdldFNsb3QsXG4gICAgY29sbGVjdGlvbixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLk5FV19PUCxcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEZWZlcldoZW5PcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLkRlZmVyV2hlbjtcblxuICAvKipcbiAgICogVGhlIGBkZWZlcmAgY3JlYXRlIG9wIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHdoZW4gY29uZGl0aW9uLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEEgdXNlci1wcm92aWRlZCBleHByZXNzaW9uIHRoYXQgdHJpZ2dlcnMgdGhlIGRlZmVyIG9wLlxuICAgKi9cbiAgZXhwcjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVtaXQgdGhlIHByZWZldGNoIHZlcnNpb24gb2YgdGhlIGluc3RydWN0aW9uLlxuICAgKi9cbiAgcHJlZmV0Y2g6IGJvb2xlYW47XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJXaGVuT3AoXG4gICAgdGFyZ2V0OiBYcmVmSWQsIGV4cHI6IG8uRXhwcmVzc2lvbiwgcHJlZmV0Y2g6IGJvb2xlYW4sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogRGVmZXJXaGVuT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5EZWZlcldoZW4sXG4gICAgdGFyZ2V0LFxuICAgIGV4cHIsXG4gICAgcHJlZmV0Y2gsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5ORVdfT1AsXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gIH07XG59XG5cbi8qKlxuICogQW4gb3AgdGhhdCByZXByZXNlbnRzIGFuIGV4cHJlc3Npb24gaW4gYW4gaTE4biBtZXNzYWdlLlxuICpcbiAqIFRPRE86IFRoaXMgY2FuIHJlcHJlc2VudCBleHByZXNzaW9ucyB1c2VkIGluIGJvdGggaTE4biBhdHRyaWJ1dGVzIGFuZCBub3JtYWwgaTE4biBjb250ZW50LiBXZVxuICogbWF5IHdhbnQgdG8gc3BsaXQgdGhlc2UgaW50byB0d28gZGlmZmVyZW50IG9wIHR5cGVzLCBkZXJpdmluZyBmcm9tIHRoZSBzYW1lIGJhc2UgY2xhc3MuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bkV4cHJlc3Npb25PcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgQ29uc3VtZXNWYXJzVHJhaXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuSTE4bkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFRoZSBpMThuIGNvbnRleHQgdGhhdCB0aGlzIGV4cHJlc3Npb24gYmVsb25ncyB0by5cbiAgICovXG4gIGNvbnRleHQ6IFhyZWZJZDtcblxuICAvKipcbiAgICogVGhlIFhyZWYgb2YgdGhlIG9wIHRoYXQgd2UgbmVlZCB0byBgYWR2YW5jZWAgdG8uXG4gICAqXG4gICAqIEluIGFuIGkxOG4gYmxvY2ssIHRoaXMgaXMgaW5pdGlhbGx5IHRoZSBpMThuIHN0YXJ0IG9wLCBidXQgd2lsbCBldmVudHVhbGx5IGNvcnJlc3BvbmQgdG9cbiAgICogdGhlIGZpbmFsIHNsb3QgY29uc3VtZXIgaW4gdGhlIG93bmluZyBpMThuIGJsb2NrLlxuICAgKiBUT0RPOiBXZSBzaG91bGQgbWFrZSB0ZXh0IGkxOG5FeHByZXNzaW9ucyB0YXJnZXQgdGhlIGkxOG5FbmQgaW5zdHJ1Y3Rpb24sIGluc3RlYWQgdGhlIGxhc3RcbiAgICogc2xvdCBjb25zdW1lciBpbiB0aGUgaTE4biBibG9jay4gVGhpcyBtYWtlcyB0aGVtIHJlc2lsaWVudCB0byB0aGF0IGxhc3QgY29uc3VtZXIgYmVpbmdcbiAgICogZGVsZXRlZC4gKE9yIG5ldyBzbG90IGNvbnN1bWVycyBiZWluZyBhZGRlZCEpXG4gICAqXG4gICAqIEluIGFuIGkxOG4gYXR0cmlidXRlLCB0aGlzIGlzIHRoZSB4cmVmIG9mIHRoZSBjb3JyZXNwb25kaW5nIGVsZW1lbnRTdGFydC9lbGVtZW50LlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEluIGFuIGkxOG4gYmxvY2ssIHRoaXMgc2hvdWxkIGJlIHRoZSBpMThuIHN0YXJ0IG9wLlxuICAgKlxuICAgKiBJbiBhbiBpMThuIGF0dHJpYnV0ZSwgdGhpcyB3aWxsIGJlIHRoZSB4cmVmIG9mIHRoZSBhdHRyaWJ1dGUgY29uZmlndXJhdGlvbiBpbnN0cnVjdGlvbi5cbiAgICovXG4gIGkxOG5Pd25lcjogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBBIGhhbmRsZSBmb3IgdGhlIHNsb3QgdGhhdCB0aGlzIGV4cHJlc3Npb24gbW9kaWZpZXMuXG4gICAqIC0gSW4gYW4gaTE4biBibG9jaywgdGhpcyBpcyB0aGUgaGFuZGxlIG9mIHRoZSBibG9jay5cbiAgICogLSBJbiBhbiBpMThuIGF0dHJpYnV0ZSwgdGhpcyBpcyB0aGUgaGFuZGxlIG9mIHRoZSBjb3JyZXNwb25kaW5nIGkxOG5BdHRyaWJ1dGVzIGluc3RydWN0aW9uLlxuICAgKi9cbiAgaGFuZGxlOiBTbG90SGFuZGxlO1xuXG4gIC8qKlxuICAgKiBUaGUgZXhwcmVzc2lvbiB2YWx1ZS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGkxOG4gcGxhY2Vob2xkZXIgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZXhwcmVzc2lvbi5cbiAgICovXG4gIGkxOG5QbGFjZWhvbGRlcjogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgdGltZSB0aGF0IHRoaXMgZXhwcmVzc2lvbiBpcyByZXNvbHZlZC5cbiAgICovXG4gIHJlc29sdXRpb25UaW1lOiBJMThuUGFyYW1SZXNvbHV0aW9uVGltZTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGlzIGkxOG4gZXhwcmVzc2lvbiBhcHBsaWVzIHRvIGEgdGVtcGxhdGUgb3IgdG8gYSBiaW5kaW5nLlxuICAgKi9cbiAgdXNhZ2U6IEkxOG5FeHByZXNzaW9uRm9yO1xuXG4gIC8qKlxuICAgKiBJZiB0aGlzIGlzIGFuIEkxOG5FeHByZXNzaW9uQ29udGV4dC5CaW5kaW5nLCB0aGlzIGV4cHJlc3Npb24gaXMgYXNzb2NpYXRlZCB3aXRoIGEgbmFtZWRcbiAgICogYXR0cmlidXRlLiBUaGF0IG5hbWUgaXMgc3RvcmVkIGhlcmUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBpMThuIGV4cHJlc3Npb24gb3AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuRXhwcmVzc2lvbk9wKFxuICAgIGNvbnRleHQ6IFhyZWZJZCwgdGFyZ2V0OiBYcmVmSWQsIGkxOG5Pd25lcjogWHJlZklkLCBoYW5kbGU6IFNsb3RIYW5kbGUsXG4gICAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBpMThuUGxhY2Vob2xkZXI6IHN0cmluZywgcmVzb2x1dGlvblRpbWU6IEkxOG5QYXJhbVJlc29sdXRpb25UaW1lLFxuICAgIHVzYWdlOiBJMThuRXhwcmVzc2lvbkZvciwgbmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBJMThuRXhwcmVzc2lvbk9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuSTE4bkV4cHJlc3Npb24sXG4gICAgY29udGV4dCxcbiAgICB0YXJnZXQsXG4gICAgaTE4bk93bmVyLFxuICAgIGhhbmRsZSxcbiAgICBleHByZXNzaW9uLFxuICAgIGkxOG5QbGFjZWhvbGRlcixcbiAgICByZXNvbHV0aW9uVGltZSxcbiAgICB1c2FnZSxcbiAgICBuYW1lLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gIH07XG59XG5cbi8qKlxuICogQW4gb3AgdGhhdCByZXByZXNlbnRzIGFwcGx5aW5nIGEgc2V0IG9mIGkxOG4gZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bkFwcGx5T3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuSTE4bkFwcGx5O1xuXG4gIC8qKlxuICAgKiBJbiBhbiBpMThuIGJsb2NrLCB0aGlzIHNob3VsZCBiZSB0aGUgaTE4biBzdGFydCBvcC5cbiAgICpcbiAgICogSW4gYW4gaTE4biBhdHRyaWJ1dGUsIHRoaXMgd2lsbCBiZSB0aGUgeHJlZiBvZiB0aGUgYXR0cmlidXRlIGNvbmZpZ3VyYXRpb24gaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBvd25lcjogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBBIGhhbmRsZSBmb3IgdGhlIHNsb3QgdGhhdCBpMThuIGFwcGx5IGluc3RydWN0aW9uIHNob3VsZCBhcHBseSB0by4gSW4gYW4gaTE4biBibG9jaywgdGhpc1xuICAgKiBpcyB0aGUgc2xvdCBvZiB0aGUgaTE4biBibG9jayB0aGlzIGV4cHJlc3Npb24gYmVsb25ncyB0by4gSW4gYW4gaTE4biBhdHRyaWJ1dGUsIHRoaXMgaXMgdGhlXG4gICAqIHNsb3Qgb2YgdGhlIGNvcnJlc3BvbmRpbmcgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBoYW5kbGU6IFNsb3RIYW5kbGU7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gb3AgdG8gYXBwbHkgaTE4biBleHByZXNzaW9uIG9wcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5BcHBseU9wKFxuICAgIG93bmVyOiBYcmVmSWQsIGhhbmRsZTogU2xvdEhhbmRsZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogSTE4bkFwcGx5T3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5JMThuQXBwbHksXG4gICAgb3duZXIsXG4gICAgaGFuZGxlLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuIl19