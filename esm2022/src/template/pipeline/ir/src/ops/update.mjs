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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL2lyL3NyYy9vcHMvdXBkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQU1ILE9BQU8sRUFBMEQsTUFBTSxFQUFlLE1BQU0sVUFBVSxDQUFDO0FBSXZHLE9BQU8sRUFBaUQsbUJBQW1CLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFN0gsT0FBTyxFQUFZLE1BQU0sRUFBMEIsTUFBTSxVQUFVLENBQUM7QUFpQ3BFOztHQUVHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUNuQyxJQUFZLEVBQUUsYUFBNEIsRUFBRSxVQUEyQjtJQUN6RSxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxlQUFlO1FBQzVCLE1BQU0sRUFBRSxJQUFJO1FBQ1osYUFBYTtRQUNiLFVBQVU7UUFDVixHQUFHLDZCQUE2QjtRQUNoQyxHQUFHLG1CQUFtQjtRQUN0QixHQUFHLE1BQU07S0FDVixDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sT0FBTyxhQUFhO0lBQ3hCLFlBQ2EsT0FBaUIsRUFBVyxXQUEyQixFQUN2RCxnQkFBMEI7UUFEMUIsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUFXLGdCQUFXLEdBQVgsV0FBVyxDQUFnQjtRQUN2RCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVU7UUFDckMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ25GLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFDWixXQUFXLENBQUMsTUFBTSxrRUFDbEIsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNoQztJQUNILENBQUM7Q0FDRjtBQTRERDs7R0FF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RyxNQUFNO1FBQ1QsR0FBRyw2QkFBNkI7S0FDakMsQ0FBQztBQUNKLENBQUM7QUF1QkQsTUFBTSxVQUFVLGlCQUFpQixDQUM3QixNQUFjLEVBQUUsSUFBa0IsRUFBRSxRQUFpQixFQUNyRCxVQUEyQjtJQUM3QixPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxTQUFTO1FBQ3RCLE1BQU07UUFDTixJQUFJO1FBQ0osUUFBUTtRQUNSLFVBQVU7UUFDVixHQUFHLE1BQU07UUFDVCxHQUFHLDZCQUE2QjtLQUNqQyxDQUFDO0FBQ0osQ0FBQztBQXlFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FDbEMsT0FBZSxFQUFFLE1BQWMsRUFBRSxTQUFpQixFQUFFLE1BQWtCLEVBQ3RFLFVBQXdCLEVBQUUsZUFBdUIsRUFBRSxjQUF1QyxFQUMxRixLQUF3QixFQUFFLElBQVksRUFBRSxVQUEyQjtJQUNyRSxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxjQUFjO1FBQzNCLE9BQU87UUFDUCxNQUFNO1FBQ04sU0FBUztRQUNULE1BQU07UUFDTixVQUFVO1FBQ1YsZUFBZTtRQUNmLGNBQWM7UUFDZCxLQUFLO1FBQ0wsSUFBSTtRQUNKLFVBQVU7UUFDVixHQUFHLE1BQU07UUFDVCxHQUFHLG1CQUFtQjtRQUN0QixHQUFHLDZCQUE2QjtLQUNqQyxDQUFDO0FBQ0osQ0FBQztBQXlCRDs7R0FFRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FDN0IsS0FBYSxFQUFFLE1BQWtCLEVBQUUsVUFBMkI7SUFDaEUsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLENBQUMsU0FBUztRQUN0QixLQUFLO1FBQ0wsTUFBTTtRQUNOLFVBQVU7UUFDVixHQUFHLE1BQU07S0FDVixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdLaW5kLCBJMThuRXhwcmVzc2lvbkZvciwgSTE4blBhcmFtUmVzb2x1dGlvblRpbWUsIE9wS2luZCwgVGVtcGxhdGVLaW5kfSBmcm9tICcuLi9lbnVtcyc7XG5pbXBvcnQgdHlwZSB7Q29uZGl0aW9uYWxDYXNlRXhwcn0gZnJvbSAnLi4vZXhwcmVzc2lvbic7XG5pbXBvcnQge1Nsb3RIYW5kbGV9IGZyb20gJy4uL2hhbmRsZSc7XG5pbXBvcnQge09wLCBYcmVmSWR9IGZyb20gJy4uL29wZXJhdGlvbnMnO1xuaW1wb3J0IHtDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0LCBUUkFJVF9DT05TVU1FU19WQVJTLCBUUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVH0gZnJvbSAnLi4vdHJhaXRzJztcbmltcG9ydCB0eXBlIHtIb3N0UHJvcGVydHlPcH0gZnJvbSAnLi9ob3N0JztcbmltcG9ydCB7TGlzdEVuZE9wLCBORVdfT1AsIFN0YXRlbWVudE9wLCBWYXJpYWJsZU9wfSBmcm9tICcuL3NoYXJlZCc7XG5cblxuLyoqXG4gKiBBbiBvcGVyYXRpb24gdXNhYmxlIG9uIHRoZSB1cGRhdGUgc2lkZSBvZiB0aGUgSVIuXG4gKi9cbmV4cG9ydCB0eXBlIFVwZGF0ZU9wID0gTGlzdEVuZE9wPFVwZGF0ZU9wPnxTdGF0ZW1lbnRPcDxVcGRhdGVPcD58UHJvcGVydHlPcHxBdHRyaWJ1dGVPcHxTdHlsZVByb3BPcHxcbiAgICBDbGFzc1Byb3BPcHxTdHlsZU1hcE9wfENsYXNzTWFwT3B8SW50ZXJwb2xhdGVUZXh0T3B8QWR2YW5jZU9wfFZhcmlhYmxlT3A8VXBkYXRlT3A+fEJpbmRpbmdPcHxcbiAgICBIb3N0UHJvcGVydHlPcHxDb25kaXRpb25hbE9wfEkxOG5FeHByZXNzaW9uT3B8STE4bkFwcGx5T3B8UmVwZWF0ZXJPcHxEZWZlcldoZW5PcDtcblxuLyoqXG4gKiBBIGxvZ2ljYWwgb3BlcmF0aW9uIHRvIHBlcmZvcm0gc3RyaW5nIGludGVycG9sYXRpb24gb24gYSB0ZXh0IG5vZGUuXG4gKlxuICogSW50ZXJwb2xhdGlvbiBpbnB1dHMgYXJlIHN0b3JlZCBhcyBzdGF0aWMgYHN0cmluZ2BzIGFuZCBkeW5hbWljIGBvLkV4cHJlc3Npb25gcywgaW4gc2VwYXJhdGVcbiAqIGFycmF5cy4gVGh1cywgdGhlIGludGVycG9sYXRpb24gYEF7e2J9fUN7e2R9fUVgIGlzIHN0b3JlZCBhcyAzIHN0YXRpYyBzdHJpbmdzIGBbJ0EnLCAnQycsICdFJ11gXG4gKiBhbmQgMiBkeW5hbWljIGV4cHJlc3Npb25zIGBbYiwgZF1gLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEludGVycG9sYXRlVGV4dE9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5JbnRlcnBvbGF0ZVRleHQ7XG5cbiAgLyoqXG4gICAqIFJlZmVyZW5jZSB0byB0aGUgdGV4dCBub2RlIHRvIHdoaWNoIHRoZSBpbnRlcnBvbGF0aW9uIGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBpbnRlcnBvbGF0ZWQgdmFsdWUuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYEludGVycG9sYXRpb25UZXh0T3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW50ZXJwb2xhdGVUZXh0T3AoXG4gICAgeHJlZjogWHJlZklkLCBpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBJbnRlcnBvbGF0ZVRleHRPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkludGVycG9sYXRlVGV4dCxcbiAgICB0YXJnZXQ6IHhyZWYsXG4gICAgaW50ZXJwb2xhdGlvbixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgc3RyaW5nczogc3RyaW5nW10sIHJlYWRvbmx5IGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSxcbiAgICAgIHJlYWRvbmx5IGkxOG5QbGFjZWhvbGRlcnM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKGkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoICE9PSAwICYmIGkxOG5QbGFjZWhvbGRlcnMubGVuZ3RoICE9PSBleHByZXNzaW9ucy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtcbiAgICAgICAgICBleHByZXNzaW9ucy5sZW5ndGh9IHBsYWNlaG9sZGVycyB0byBtYXRjaCBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb24gY291bnQsIGJ1dCBnb3QgJHtcbiAgICAgICAgICBpMThuUGxhY2Vob2xkZXJzLmxlbmd0aH1gKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBpbnRlcm1lZGlhdGUgYmluZGluZyBvcCwgdGhhdCBoYXMgbm90IHlldCBiZWVuIHByb2Nlc3NlZCBpbnRvIGFuIGluZGl2aWR1YWwgcHJvcGVydHksXG4gKiBhdHRyaWJ1dGUsIHN0eWxlLCBldGMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmluZGluZ09wIGV4dGVuZHMgT3A8VXBkYXRlT3A+IHtcbiAga2luZDogT3BLaW5kLkJpbmRpbmc7XG5cbiAgLyoqXG4gICAqIFJlZmVyZW5jZSB0byB0aGUgZWxlbWVudCBvbiB3aGljaCB0aGUgcHJvcGVydHkgaXMgYm91bmQuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICAvKipcbiAgICogIFRoZSBraW5kIG9mIGJpbmRpbmcgcmVwcmVzZW50ZWQgYnkgdGhpcyBvcC5cbiAgICovXG4gIGJpbmRpbmdLaW5kOiBCaW5kaW5nS2luZDtcblxuICAvKipcbiAgICogIFRoZSBuYW1lIG9mIHRoaXMgYmluZGluZy5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogRXhwcmVzc2lvbiB3aGljaCBpcyBib3VuZCB0byB0aGUgcHJvcGVydHkuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbjtcblxuICAvKipcbiAgICogVGhlIHVuaXQgb2YgdGhlIGJvdW5kIHZhbHVlLlxuICAgKi9cbiAgdW5pdDogc3RyaW5nfG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBzZWN1cml0eSBjb250ZXh0IG9mIHRoZSBiaW5kaW5nLlxuICAgKi9cbiAgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHR8U2VjdXJpdHlDb250ZXh0W107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGJpbmRpbmcgaXMgYSBUZXh0QXR0cmlidXRlIChlLmcuIGBzb21lLWF0dHI9XCJzb21lLXZhbHVlXCJgKS5cbiAgICpcbiAgICogVGhpcyBuZWVkcyB0byBiZSB0cmFja2VkIGZvciBjb21wYXRpYmxpdHkgd2l0aCBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgd2hpY2ggdHJlYXRzIGBzdHlsZWBcbiAgICogYW5kIGBjbGFzc2AgVGV4dEF0dHJpYnV0ZXMgZGlmZmVyZW50bHkgZnJvbSBgW2F0dHIuc3R5bGVdYCBhbmQgYFthdHRyLmNsYXNzXWAuXG4gICAqL1xuICBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW47XG5cbiAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhpcyBiaW5kaW5nIGlzIG9uIGEgc3RydWN0dXJhbCB0ZW1wbGF0ZS5cbiAgICovXG4gIHRlbXBsYXRlS2luZDogVGVtcGxhdGVLaW5kfG51bGw7XG5cbiAgaTE4bkNvbnRleHQ6IFhyZWZJZHxudWxsO1xuICBpMThuTWVzc2FnZTogaTE4bi5NZXNzYWdlfG51bGw7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGBCaW5kaW5nT3BgLCBub3QgeWV0IHRyYW5zZm9ybWVkIGludG8gYSBwYXJ0aWN1bGFyIHR5cGUgb2YgYmluZGluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJpbmRpbmdPcChcbiAgICB0YXJnZXQ6IFhyZWZJZCwga2luZDogQmluZGluZ0tpbmQsIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb24sXG4gICAgdW5pdDogc3RyaW5nfG51bGwsIHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0fFNlY3VyaXR5Q29udGV4dFtdLCBpc1RleHRBdHRyaWJ1dGU6IGJvb2xlYW4sXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW4sIHRlbXBsYXRlS2luZDogVGVtcGxhdGVLaW5kfG51bGwsXG4gICAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBCaW5kaW5nT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5CaW5kaW5nLFxuICAgIGJpbmRpbmdLaW5kOiBraW5kLFxuICAgIHRhcmdldCxcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgdW5pdCxcbiAgICBzZWN1cml0eUNvbnRleHQsXG4gICAgaXNUZXh0QXR0cmlidXRlLFxuICAgIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlLFxuICAgIHRlbXBsYXRlS2luZCxcbiAgICBpMThuQ29udGV4dDogbnVsbCxcbiAgICBpMThuTWVzc2FnZSxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBIGxvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBiaW5kaW5nIHRvIGEgcHJvcGVydHkgaW4gdGhlIHVwZGF0ZSBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9wZXJ0eU9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLlByb3BlcnR5O1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGJvdW5kIHByb3BlcnR5LlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBFeHByZXNzaW9uIHdoaWNoIGlzIGJvdW5kIHRvIHRoZSBwcm9wZXJ0eS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoaXMgcHJvcGVydHkgaXMgYW4gYW5pbWF0aW9uIHRyaWdnZXIuXG4gICAqL1xuICBpc0FuaW1hdGlvblRyaWdnZXI6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBzZWN1cml0eSBjb250ZXh0IG9mIHRoZSBiaW5kaW5nLlxuICAgKi9cbiAgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHR8U2VjdXJpdHlDb250ZXh0W107XG5cbiAgLyoqXG4gICAqIFRoZSBzYW5pdGl6ZXIgZm9yIHRoaXMgcHJvcGVydHkuXG4gICAqL1xuICBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIGlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUga2luZCBvZiB0ZW1wbGF0ZSB0YXJnZXRlZCBieSB0aGUgYmluZGluZywgb3IgbnVsbCBpZiB0aGlzIGJpbmRpbmcgZG9lcyBub3QgdGFyZ2V0IGFcbiAgICogdGVtcGxhdGUuXG4gICAqL1xuICB0ZW1wbGF0ZUtpbmQ6IFRlbXBsYXRlS2luZHxudWxsO1xuXG4gIGkxOG5Db250ZXh0OiBYcmVmSWR8bnVsbDtcbiAgaTE4bk1lc3NhZ2U6IGkxOG4uTWVzc2FnZXxudWxsO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgUHJvcGVydHlPcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcm9wZXJ0eU9wKFxuICAgIHRhcmdldDogWHJlZklkLCBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uLFxuICAgIGlzQW5pbWF0aW9uVHJpZ2dlcjogYm9vbGVhbiwgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHR8U2VjdXJpdHlDb250ZXh0W10sXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGU6IGJvb2xlYW4sIHRlbXBsYXRlS2luZDogVGVtcGxhdGVLaW5kfG51bGwsXG4gICAgaTE4bkNvbnRleHQ6IFhyZWZJZHxudWxsLCBpMThuTWVzc2FnZTogaTE4bi5NZXNzYWdlfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUHJvcGVydHlPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLlByb3BlcnR5LFxuICAgIHRhcmdldCxcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgaXNBbmltYXRpb25UcmlnZ2VyLFxuICAgIHNlY3VyaXR5Q29udGV4dCxcbiAgICBzYW5pdGl6ZXI6IG51bGwsXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUsXG4gICAgdGVtcGxhdGVLaW5kLFxuICAgIGkxOG5Db250ZXh0LFxuICAgIGkxOG5NZXNzYWdlLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYmluZGluZyB0byBhIHN0eWxlIHByb3BlcnR5IGluIHRoZSB1cGRhdGUgSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVQcm9wT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4sIENvbnN1bWVzVmFyc1RyYWl0LCBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuU3R5bGVQcm9wO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGJvdW5kIHByb3BlcnR5LlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBFeHByZXNzaW9uIHdoaWNoIGlzIGJvdW5kIHRvIHRoZSBwcm9wZXJ0eS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgdW5pdCBvZiB0aGUgYm91bmQgdmFsdWUuXG4gICAqL1xuICB1bml0OiBzdHJpbmd8bnVsbDtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKiBDcmVhdGUgYSBgU3R5bGVQcm9wT3BgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlUHJvcE9wKFxuICAgIHhyZWY6IFhyZWZJZCwgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbiwgdW5pdDogc3RyaW5nfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogU3R5bGVQcm9wT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5TdHlsZVByb3AsXG4gICAgdGFyZ2V0OiB4cmVmLFxuICAgIG5hbWUsXG4gICAgZXhwcmVzc2lvbixcbiAgICB1bml0LFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYmluZGluZyB0byBhIGNsYXNzIHByb3BlcnR5IGluIHRoZSB1cGRhdGUgSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhc3NQcm9wT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4sIENvbnN1bWVzVmFyc1RyYWl0LCBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuQ2xhc3NQcm9wO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGJvdW5kIHByb3BlcnR5LlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBFeHByZXNzaW9uIHdoaWNoIGlzIGJvdW5kIHRvIHRoZSBwcm9wZXJ0eS5cbiAgICovXG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYENsYXNzUHJvcE9wYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsYXNzUHJvcE9wKFxuICAgIHhyZWY6IFhyZWZJZCwgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQ2xhc3NQcm9wT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5DbGFzc1Byb3AsXG4gICAgdGFyZ2V0OiB4cmVmLFxuICAgIG5hbWUsXG4gICAgZXhwcmVzc2lvbixcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gICAgLi4uTkVXX09QLFxuICB9O1xufVxuXG4vKipcbiAqIEEgbG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGJpbmRpbmcgdG8gYSBzdHlsZSBtYXAgaW4gdGhlIHVwZGF0ZSBJUi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsZU1hcE9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLlN0eWxlTWFwO1xuXG4gIC8qKlxuICAgKiBSZWZlcmVuY2UgdG8gdGhlIGVsZW1lbnQgb24gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGJvdW5kLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEV4cHJlc3Npb24gd2hpY2ggaXMgYm91bmQgdG8gdGhlIHByb3BlcnR5LlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb247XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKiogQ3JlYXRlIGEgYFN0eWxlTWFwT3BgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlTWFwT3AoXG4gICAgeHJlZjogWHJlZklkLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogU3R5bGVNYXBPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLlN0eWxlTWFwLFxuICAgIHRhcmdldDogeHJlZixcbiAgICBleHByZXNzaW9uLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogQSBsb2dpY2FsIG9wZXJhdGlvbiByZXByZXNlbnRpbmcgYmluZGluZyB0byBhIHN0eWxlIG1hcCBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzTWFwT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4sIENvbnN1bWVzVmFyc1RyYWl0LCBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuQ2xhc3NNYXA7XG5cbiAgLyoqXG4gICAqIFJlZmVyZW5jZSB0byB0aGUgZWxlbWVudCBvbiB3aGljaCB0aGUgcHJvcGVydHkgaXMgYm91bmQuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICAvKipcbiAgICogRXhwcmVzc2lvbiB3aGljaCBpcyBib3VuZCB0byB0aGUgcHJvcGVydHkuXG4gICAqL1xuICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb258SW50ZXJwb2xhdGlvbjtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYENsYXNzTWFwT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2xhc3NNYXBPcChcbiAgICB4cmVmOiBYcmVmSWQsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxJbnRlcnBvbGF0aW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBDbGFzc01hcE9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuQ2xhc3NNYXAsXG4gICAgdGFyZ2V0OiB4cmVmLFxuICAgIGV4cHJlc3Npb24sXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgICAuLi5UUkFJVF9DT05TVU1FU19WQVJTLFxuICAgIC4uLk5FV19PUCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBIGxvZ2ljYWwgb3BlcmF0aW9uIHJlcHJlc2VudGluZyBzZXR0aW5nIGFuIGF0dHJpYnV0ZSBvbiBhbiBlbGVtZW50IGluIHRoZSB1cGRhdGUgSVIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXR0cmlidXRlT3AgZXh0ZW5kcyBPcDxVcGRhdGVPcD4ge1xuICBraW5kOiBPcEtpbmQuQXR0cmlidXRlO1xuXG4gIC8qKlxuICAgKiBUaGUgYFhyZWZJZGAgb2YgdGhlIHRlbXBsYXRlLWxpa2UgZWxlbWVudCB0aGUgYXR0cmlidXRlIHdpbGwgYmVsb25nIHRvLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoZSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb247XG5cbiAgLyoqXG4gICAqIFRoZSBzZWN1cml0eSBjb250ZXh0IG9mIHRoZSBiaW5kaW5nLlxuICAgKi9cbiAgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHR8U2VjdXJpdHlDb250ZXh0W107XG5cbiAgLyoqXG4gICAqIFRoZSBzYW5pdGl6ZXIgZm9yIHRoaXMgYXR0cmlidXRlLlxuICAgKi9cbiAgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgYmluZGluZyBpcyBhIFRleHRBdHRyaWJ1dGUgKGUuZy4gYHNvbWUtYXR0cj1cInNvbWUtdmFsdWVcImApLlxuICAgKlxuICAgKiBUaGlzIG5lZWRzIHRvIGJlIHRyYWNrZWQgZm9yIGNvbXBhdGlibGl0eSB3aXRoIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCB3aGljaCB0cmVhdHMgYHN0eWxlYFxuICAgKiBhbmQgYGNsYXNzYCBUZXh0QXR0cmlidXRlcyBkaWZmZXJlbnRseSBmcm9tIGBbYXR0ci5zdHlsZV1gIGFuZCBgW2F0dHIuY2xhc3NdYC5cbiAgICovXG4gIGlzVGV4dEF0dHJpYnV0ZTogYm9vbGVhbjtcblxuICBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGtpbmQgb2YgdGVtcGxhdGUgdGFyZ2V0ZWQgYnkgdGhlIGJpbmRpbmcsIG9yIG51bGwgaWYgdGhpcyBiaW5kaW5nIGRvZXMgbm90IHRhcmdldCBhXG4gICAqIHRlbXBsYXRlLlxuICAgKi9cbiAgdGVtcGxhdGVLaW5kOiBUZW1wbGF0ZUtpbmR8bnVsbDtcblxuICAvKipcbiAgICogVGhlIGkxOG4gY29udGV4dCwgaWYgdGhpcyBpcyBhbiBpMThuIGF0dHJpYnV0ZS5cbiAgICovXG4gIGkxOG5Db250ZXh0OiBYcmVmSWR8bnVsbDtcblxuICBpMThuTWVzc2FnZTogaTE4bi5NZXNzYWdlfG51bGw7XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBgQXR0cmlidXRlT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXR0cmlidXRlT3AoXG4gICAgdGFyZ2V0OiBYcmVmSWQsIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufEludGVycG9sYXRpb24sXG4gICAgc2VjdXJpdHlDb250ZXh0OiBTZWN1cml0eUNvbnRleHR8U2VjdXJpdHlDb250ZXh0W10sIGlzVGV4dEF0dHJpYnV0ZTogYm9vbGVhbixcbiAgICBpc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZTogYm9vbGVhbiwgdGVtcGxhdGVLaW5kOiBUZW1wbGF0ZUtpbmR8bnVsbCxcbiAgICBpMThuTWVzc2FnZTogaTE4bi5NZXNzYWdlfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEF0dHJpYnV0ZU9wIHtcbiAgcmV0dXJuIHtcbiAgICBraW5kOiBPcEtpbmQuQXR0cmlidXRlLFxuICAgIHRhcmdldCxcbiAgICBuYW1lLFxuICAgIGV4cHJlc3Npb24sXG4gICAgc2VjdXJpdHlDb250ZXh0LFxuICAgIHNhbml0aXplcjogbnVsbCxcbiAgICBpc1RleHRBdHRyaWJ1dGUsXG4gICAgaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUsXG4gICAgdGVtcGxhdGVLaW5kLFxuICAgIGkxOG5Db250ZXh0OiBudWxsLFxuICAgIGkxOG5NZXNzYWdlLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uVFJBSVRfREVQRU5EU19PTl9TTE9UX0NPTlRFWFQsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gdG8gYWR2YW5jZSB0aGUgcnVudGltZSdzIGludGVybmFsIHNsb3QgcG9pbnRlciBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFkdmFuY2VPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiB7XG4gIGtpbmQ6IE9wS2luZC5BZHZhbmNlO1xuXG4gIC8qKlxuICAgKiBEZWx0YSBieSB3aGljaCB0byBhZHZhbmNlIHRoZSBwb2ludGVyLlxuICAgKi9cbiAgZGVsdGE6IG51bWJlcjtcblxuICAvLyBTb3VyY2Ugc3BhbiBvZiB0aGUgYmluZGluZyB0aGF0IGNhdXNlZCB0aGUgYWR2YW5jZVxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGBBZHZhbmNlT3BgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWR2YW5jZU9wKGRlbHRhOiBudW1iZXIsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEFkdmFuY2VPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkFkdmFuY2UsXG4gICAgZGVsdGEsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG5cbi8qKlxuICogTG9naWNhbCBvcGVyYXRpb24gcmVwcmVzZW50aW5nIGEgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBpbiB0aGUgdXBkYXRlIElSLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbmRpdGlvbmFsT3AgZXh0ZW5kcyBPcDxDb25kaXRpb25hbE9wPiwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29uc3VtZXNWYXJzVHJhaXQge1xuICBraW5kOiBPcEtpbmQuQ29uZGl0aW9uYWw7XG5cbiAgLyoqXG4gICAqIFRoZSBpbnNlcnRpb24gcG9pbnQsIHdoaWNoIGlzIHRoZSBmaXJzdCB0ZW1wbGF0ZSBpbiB0aGUgY3JlYXRpb24gYmxvY2sgYmVsb25naW5nIHRvIHRoaXNcbiAgICogY29uZGl0aW9uLlxuICAgKi9cbiAgdGFyZ2V0OiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIFRoZSBzbG90IG9mIHRoZSB0YXJnZXQsIHRvIGJlIHBvcHVsYXRlZCBkdXJpbmcgc2xvdCBhbGxvY2F0aW9uLlxuICAgKi9cbiAgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZTtcblxuICAvKipcbiAgICogVGhlIG1haW4gdGVzdCBleHByZXNzaW9uIChmb3IgYSBzd2l0Y2gpLCBvciBgbnVsbGAgKGZvciBhbiBpZiwgd2hpY2ggaGFzIG5vIHRlc3RcbiAgICogZXhwcmVzc2lvbikuXG4gICAqL1xuICB0ZXN0OiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogRWFjaCBwb3NzaWJsZSBlbWJlZGRlZCB2aWV3IHRoYXQgY291bGQgYmUgZGlzcGxheWVkIGhhcyBhIGNvbmRpdGlvbiAob3IgaXMgZGVmYXVsdCkuIFRoaXNcbiAgICogc3RydWN0dXJlIG1hcHMgZWFjaCB2aWV3IHhyZWYgdG8gaXRzIGNvcnJlc3BvbmRpbmcgY29uZGl0aW9uLlxuICAgKi9cbiAgY29uZGl0aW9uczogQXJyYXk8Q29uZGl0aW9uYWxDYXNlRXhwcj47XG5cbiAgLyoqXG4gICAqIEFmdGVyIHByb2Nlc3NpbmcsIHRoaXMgd2lsbCBiZSBhIHNpbmdsZSBjb2xsYXBzZWQgSm9vc3QtZXhwcmVzc2lvbiB0aGF0IGV2YWx1YXRlcyB0aGVcbiAgICogY29uZGl0aW9ucywgYW5kIHlpZWxkcyB0aGUgc2xvdCBudW1iZXIgb2YgdGhlIHRlbXBsYXRlIHdoaWNoIHNob3VsZCBiZSBkaXNwbGF5ZWQuXG4gICAqL1xuICBwcm9jZXNzZWQ6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBDb250cm9sIGZsb3cgY29uZGl0aW9uYWxzIGNhbiBhY2NlcHQgYSBjb250ZXh0IHZhbHVlICh0aGlzIGlzIGEgcmVzdWx0IG9mIHNwZWNpZnlpbmcgYW5cbiAgICogYWxpYXMpLiBUaGlzIGV4cHJlc3Npb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGNvbmRpdGlvbmFsIGluc3RydWN0aW9uJ3MgY29udGV4dCBwYXJhbWV0ZXIuXG4gICAqL1xuICBjb250ZXh0VmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBjb25kaXRpb25hbCBvcCwgd2hpY2ggd2lsbCBkaXNwbGF5IGFuIGVtYmVkZGVkIHZpZXcgYWNjb3JkaW5nIHRvIGEgY29uZHRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb25kaXRpb25hbE9wKFxuICAgIHRhcmdldDogWHJlZklkLCB0YXJnZXRTbG90OiBTbG90SGFuZGxlLCB0ZXN0OiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBjb25kaXRpb25zOiBBcnJheTxDb25kaXRpb25hbENhc2VFeHByPiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQ29uZGl0aW9uYWxPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkNvbmRpdGlvbmFsLFxuICAgIHRhcmdldCxcbiAgICB0YXJnZXRTbG90LFxuICAgIHRlc3QsXG4gICAgY29uZGl0aW9ucyxcbiAgICBwcm9jZXNzZWQ6IG51bGwsXG4gICAgc291cmNlU3BhbixcbiAgICBjb250ZXh0VmFsdWU6IG51bGwsXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICAgIC4uLlRSQUlUX0NPTlNVTUVTX1ZBUlMsXG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVwZWF0ZXJPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiwgRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0IHtcbiAga2luZDogT3BLaW5kLlJlcGVhdGVyO1xuXG4gIC8qKlxuICAgKiBUaGUgUmVwZWF0ZXJDcmVhdGUgb3AgYXNzb2NpYXRlZCB3aXRoIHRoaXMgcmVwZWF0ZXIuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICB0YXJnZXRTbG90OiBTbG90SGFuZGxlO1xuXG4gIC8qKlxuICAgKiBUaGUgY29sbGVjdGlvbiBwcm92aWRlZCB0byB0aGUgZm9yIGxvb3AgYXMgaXRzIGV4cHJlc3Npb24uXG4gICAqL1xuICBjb2xsZWN0aW9uOiBvLkV4cHJlc3Npb247XG5cbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwZWF0ZXJPcChcbiAgICByZXBlYXRlckNyZWF0ZTogWHJlZklkLCB0YXJnZXRTbG90OiBTbG90SGFuZGxlLCBjb2xsZWN0aW9uOiBvLkV4cHJlc3Npb24sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUmVwZWF0ZXJPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLlJlcGVhdGVyLFxuICAgIHRhcmdldDogcmVwZWF0ZXJDcmVhdGUsXG4gICAgdGFyZ2V0U2xvdCxcbiAgICBjb2xsZWN0aW9uLFxuICAgIHNvdXJjZVNwYW4sXG4gICAgLi4uTkVXX09QLFxuICAgIC4uLlRSQUlUX0RFUEVORFNfT05fU0xPVF9DT05URVhULFxuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVyV2hlbk9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBEZXBlbmRzT25TbG90Q29udGV4dE9wVHJhaXQge1xuICBraW5kOiBPcEtpbmQuRGVmZXJXaGVuO1xuXG4gIC8qKlxuICAgKiBUaGUgYGRlZmVyYCBjcmVhdGUgb3AgYXNzb2NpYXRlZCB3aXRoIHRoaXMgd2hlbiBjb25kaXRpb24uXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICAvKipcbiAgICogQSB1c2VyLXByb3ZpZGVkIGV4cHJlc3Npb24gdGhhdCB0cmlnZ2VycyB0aGUgZGVmZXIgb3AuXG4gICAqL1xuICBleHByOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZW1pdCB0aGUgcHJlZmV0Y2ggdmVyc2lvbiBvZiB0aGUgaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBwcmVmZXRjaDogYm9vbGVhbjtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWZlcldoZW5PcChcbiAgICB0YXJnZXQ6IFhyZWZJZCwgZXhwcjogby5FeHByZXNzaW9uLCBwcmVmZXRjaDogYm9vbGVhbixcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBEZWZlcldoZW5PcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkRlZmVyV2hlbixcbiAgICB0YXJnZXQsXG4gICAgZXhwcixcbiAgICBwcmVmZXRjaCxcbiAgICBzb3VyY2VTcGFuLFxuICAgIC4uLk5FV19PUCxcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBbiBvcCB0aGF0IHJlcHJlc2VudHMgYW4gZXhwcmVzc2lvbiBpbiBhbiBpMThuIG1lc3NhZ2UuXG4gKlxuICogVE9ETzogVGhpcyBjYW4gcmVwcmVzZW50IGV4cHJlc3Npb25zIHVzZWQgaW4gYm90aCBpMThuIGF0dHJpYnV0ZXMgYW5kIG5vcm1hbCBpMThuIGNvbnRlbnQuIFdlXG4gKiBtYXkgd2FudCB0byBzcGxpdCB0aGVzZSBpbnRvIHR3byBkaWZmZXJlbnQgb3AgdHlwZXMsIGRlcml2aW5nIGZyb20gdGhlIHNhbWUgYmFzZSBjbGFzcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuRXhwcmVzc2lvbk9wIGV4dGVuZHMgT3A8VXBkYXRlT3A+LCBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlcGVuZHNPblNsb3RDb250ZXh0T3BUcmFpdCB7XG4gIGtpbmQ6IE9wS2luZC5JMThuRXhwcmVzc2lvbjtcblxuICAvKipcbiAgICogVGhlIGkxOG4gY29udGV4dCB0aGF0IHRoaXMgZXhwcmVzc2lvbiBiZWxvbmdzIHRvLlxuICAgKi9cbiAgY29udGV4dDogWHJlZklkO1xuXG4gIC8qKlxuICAgKiBUaGUgWHJlZiBvZiB0aGUgb3AgdGhhdCB3ZSBuZWVkIHRvIGBhZHZhbmNlYCB0by5cbiAgICpcbiAgICogSW4gYW4gaTE4biBibG9jaywgdGhpcyBpcyBpbml0aWFsbHkgdGhlIGkxOG4gc3RhcnQgb3AsIGJ1dCB3aWxsIGV2ZW50dWFsbHkgY29ycmVzcG9uZCB0b1xuICAgKiB0aGUgZmluYWwgc2xvdCBjb25zdW1lciBpbiB0aGUgb3duaW5nIGkxOG4gYmxvY2suXG4gICAqIFRPRE86IFdlIHNob3VsZCBtYWtlIHRleHQgaTE4bkV4cHJlc3Npb25zIHRhcmdldCB0aGUgaTE4bkVuZCBpbnN0cnVjdGlvbiwgaW5zdGVhZCB0aGUgbGFzdFxuICAgKiBzbG90IGNvbnN1bWVyIGluIHRoZSBpMThuIGJsb2NrLiBUaGlzIG1ha2VzIHRoZW0gcmVzaWxpZW50IHRvIHRoYXQgbGFzdCBjb25zdW1lciBiZWluZ1xuICAgKiBkZWxldGVkLiAoT3IgbmV3IHNsb3QgY29uc3VtZXJzIGJlaW5nIGFkZGVkISlcbiAgICpcbiAgICogSW4gYW4gaTE4biBhdHRyaWJ1dGUsIHRoaXMgaXMgdGhlIHhyZWYgb2YgdGhlIGNvcnJlc3BvbmRpbmcgZWxlbWVudFN0YXJ0L2VsZW1lbnQuXG4gICAqL1xuICB0YXJnZXQ6IFhyZWZJZDtcblxuICAvKipcbiAgICogSW4gYW4gaTE4biBibG9jaywgdGhpcyBzaG91bGQgYmUgdGhlIGkxOG4gc3RhcnQgb3AuXG4gICAqXG4gICAqIEluIGFuIGkxOG4gYXR0cmlidXRlLCB0aGlzIHdpbGwgYmUgdGhlIHhyZWYgb2YgdGhlIGF0dHJpYnV0ZSBjb25maWd1cmF0aW9uIGluc3RydWN0aW9uLlxuICAgKi9cbiAgaTE4bk93bmVyOiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEEgaGFuZGxlIGZvciB0aGUgc2xvdCB0aGF0IHRoaXMgZXhwcmVzc2lvbiBtb2RpZmllcy5cbiAgICogLSBJbiBhbiBpMThuIGJsb2NrLCB0aGlzIGlzIHRoZSBoYW5kbGUgb2YgdGhlIGJsb2NrLlxuICAgKiAtIEluIGFuIGkxOG4gYXR0cmlidXRlLCB0aGlzIGlzIHRoZSBoYW5kbGUgb2YgdGhlIGNvcnJlc3BvbmRpbmcgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBoYW5kbGU6IFNsb3RIYW5kbGU7XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHZhbHVlLlxuICAgKi9cbiAgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uO1xuXG4gIC8qKlxuICAgKiBUaGUgaTE4biBwbGFjZWhvbGRlciBhc3NvY2lhdGVkIHdpdGggdGhpcyBleHByZXNzaW9uLlxuICAgKi9cbiAgaTE4blBsYWNlaG9sZGVyOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoZSB0aW1lIHRoYXQgdGhpcyBleHByZXNzaW9uIGlzIHJlc29sdmVkLlxuICAgKi9cbiAgcmVzb2x1dGlvblRpbWU6IEkxOG5QYXJhbVJlc29sdXRpb25UaW1lO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoaXMgaTE4biBleHByZXNzaW9uIGFwcGxpZXMgdG8gYSB0ZW1wbGF0ZSBvciB0byBhIGJpbmRpbmcuXG4gICAqL1xuICB1c2FnZTogSTE4bkV4cHJlc3Npb25Gb3I7XG5cbiAgLyoqXG4gICAqIElmIHRoaXMgaXMgYW4gSTE4bkV4cHJlc3Npb25Db250ZXh0LkJpbmRpbmcsIHRoaXMgZXhwcmVzc2lvbiBpcyBhc3NvY2lhdGVkIHdpdGggYSBuYW1lZFxuICAgKiBhdHRyaWJ1dGUuIFRoYXQgbmFtZSBpcyBzdG9yZWQgaGVyZS5cbiAgICovXG4gIG5hbWU6IHN0cmluZztcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGkxOG4gZXhwcmVzc2lvbiBvcC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5FeHByZXNzaW9uT3AoXG4gICAgY29udGV4dDogWHJlZklkLCB0YXJnZXQ6IFhyZWZJZCwgaTE4bk93bmVyOiBYcmVmSWQsIGhhbmRsZTogU2xvdEhhbmRsZSxcbiAgICBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIGkxOG5QbGFjZWhvbGRlcjogc3RyaW5nLCByZXNvbHV0aW9uVGltZTogSTE4blBhcmFtUmVzb2x1dGlvblRpbWUsXG4gICAgdXNhZ2U6IEkxOG5FeHByZXNzaW9uRm9yLCBuYW1lOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEkxOG5FeHByZXNzaW9uT3Age1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IE9wS2luZC5JMThuRXhwcmVzc2lvbixcbiAgICBjb250ZXh0LFxuICAgIHRhcmdldCxcbiAgICBpMThuT3duZXIsXG4gICAgaGFuZGxlLFxuICAgIGV4cHJlc3Npb24sXG4gICAgaTE4blBsYWNlaG9sZGVyLFxuICAgIHJlc29sdXRpb25UaW1lLFxuICAgIHVzYWdlLFxuICAgIG5hbWUsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5ORVdfT1AsXG4gICAgLi4uVFJBSVRfQ09OU1VNRVNfVkFSUyxcbiAgICAuLi5UUkFJVF9ERVBFTkRTX09OX1NMT1RfQ09OVEVYVCxcbiAgfTtcbn1cblxuLyoqXG4gKiBBbiBvcCB0aGF0IHJlcHJlc2VudHMgYXBwbHlpbmcgYSBzZXQgb2YgaTE4biBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuQXBwbHlPcCBleHRlbmRzIE9wPFVwZGF0ZU9wPiB7XG4gIGtpbmQ6IE9wS2luZC5JMThuQXBwbHk7XG5cbiAgLyoqXG4gICAqIEluIGFuIGkxOG4gYmxvY2ssIHRoaXMgc2hvdWxkIGJlIHRoZSBpMThuIHN0YXJ0IG9wLlxuICAgKlxuICAgKiBJbiBhbiBpMThuIGF0dHJpYnV0ZSwgdGhpcyB3aWxsIGJlIHRoZSB4cmVmIG9mIHRoZSBhdHRyaWJ1dGUgY29uZmlndXJhdGlvbiBpbnN0cnVjdGlvbi5cbiAgICovXG4gIG93bmVyOiBYcmVmSWQ7XG5cbiAgLyoqXG4gICAqIEEgaGFuZGxlIGZvciB0aGUgc2xvdCB0aGF0IGkxOG4gYXBwbHkgaW5zdHJ1Y3Rpb24gc2hvdWxkIGFwcGx5IHRvLiBJbiBhbiBpMThuIGJsb2NrLCB0aGlzXG4gICAqIGlzIHRoZSBzbG90IG9mIHRoZSBpMThuIGJsb2NrIHRoaXMgZXhwcmVzc2lvbiBiZWxvbmdzIHRvLiBJbiBhbiBpMThuIGF0dHJpYnV0ZSwgdGhpcyBpcyB0aGVcbiAgICogc2xvdCBvZiB0aGUgY29ycmVzcG9uZGluZyBpMThuQXR0cmlidXRlcyBpbnN0cnVjdGlvbi5cbiAgICovXG4gIGhhbmRsZTogU2xvdEhhbmRsZTtcblxuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBvcCB0byBhcHBseSBpMThuIGV4cHJlc3Npb24gb3BzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSTE4bkFwcGx5T3AoXG4gICAgb3duZXI6IFhyZWZJZCwgaGFuZGxlOiBTbG90SGFuZGxlLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBJMThuQXBwbHlPcCB7XG4gIHJldHVybiB7XG4gICAga2luZDogT3BLaW5kLkkxOG5BcHBseSxcbiAgICBvd25lcixcbiAgICBoYW5kbGUsXG4gICAgc291cmNlU3BhbixcbiAgICAuLi5ORVdfT1AsXG4gIH07XG59XG4iXX0=