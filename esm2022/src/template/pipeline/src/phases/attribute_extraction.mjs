/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../../core';
import * as ir from '../../ir';
import { CompilationJobKind } from '../compilation';
import { createOpXrefMap } from '../util/elements';
/**
 * Find all extractable attribute and binding ops, and create ExtractedAttributeOps for them.
 * In cases where no instruction needs to be generated for the attribute or binding, it is removed.
 */
export function extractAttributes(job) {
    for (const unit of job.units) {
        const elements = createOpXrefMap(unit);
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Attribute:
                    extractAttributeOp(unit, op, elements);
                    break;
                case ir.OpKind.Property:
                    if (!op.isAnimationTrigger) {
                        let bindingKind;
                        if (op.i18nMessage !== null && op.templateKind === null) {
                            // If the binding has an i18n context, it is an i18n attribute, and should have that
                            // kind in the consts array.
                            bindingKind = ir.BindingKind.I18n;
                        }
                        else if (op.isStructuralTemplateAttribute) {
                            bindingKind = ir.BindingKind.Template;
                        }
                        else {
                            bindingKind = ir.BindingKind.Property;
                        }
                        ir.OpList.insertBefore(
                        // Deliberaly null i18nMessage value
                        ir.createExtractedAttributeOp(op.target, bindingKind, null, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, op.securityContext), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.TwoWayProperty:
                    ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.TwoWayProperty, null, op.name, /* expression */ null, 
                    /* i18nContext */ null, 
                    /* i18nMessage */ null, op.securityContext), lookupElement(elements, op.target));
                    break;
                case ir.OpKind.StyleProp:
                case ir.OpKind.ClassProp:
                    // TODO: Can style or class bindings be i18n attributes?
                    // The old compiler treated empty style bindings as regular bindings for the purpose of
                    // directive matching. That behavior is incorrect, but we emulate it in compatibility
                    // mode.
                    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                        op.expression instanceof ir.EmptyExpr) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, null, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, SecurityContext.STYLE), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.Listener:
                    if (!op.isAnimationListener) {
                        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, null, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, SecurityContext.NONE);
                        if (job.kind === CompilationJobKind.Host) {
                            if (job.compatibility) {
                                // TemplateDefinitionBuilder does not extract listener bindings to the const array
                                // (which is honestly pretty inconsistent).
                                break;
                            }
                            // This attribute will apply to the enclosing host binding compilation unit, so order
                            // doesn't matter.
                            unit.create.push(extractedAttributeOp);
                        }
                        else {
                            ir.OpList.insertBefore(extractedAttributeOp, lookupElement(elements, op.target));
                        }
                    }
                    break;
                case ir.OpKind.TwoWayListener:
                    // Two-way listeners aren't supported in host bindings.
                    if (job.kind !== CompilationJobKind.Host) {
                        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, null, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, SecurityContext.NONE);
                        ir.OpList.insertBefore(extractedAttributeOp, lookupElement(elements, op.target));
                    }
                    break;
            }
        }
    }
}
/**
 * Looks up an element in the given map by xref ID.
 */
function lookupElement(elements, xref) {
    const el = elements.get(xref);
    if (el === undefined) {
        throw new Error('All attributes should have an element-like target.');
    }
    return el;
}
/**
 * Extracts an attribute binding.
 */
function extractAttributeOp(unit, op, elements) {
    if (op.expression instanceof ir.Interpolation) {
        return;
    }
    let extractable = op.isTextAttribute || op.expression.isConstant();
    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
        // TemplateDefinitionBuilder only extracts text attributes. It does not extract attriibute
        // bindings, even if they are constants.
        extractable &&= op.isTextAttribute;
    }
    if (extractable) {
        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, op.isStructuralTemplateAttribute ? ir.BindingKind.Template : ir.BindingKind.Attribute, op.namespace, op.name, op.expression, op.i18nContext, op.i18nMessage, op.securityContext);
        if (unit.job.kind === CompilationJobKind.Host) {
            // This attribute will apply to the enclosing host binding compilation unit, so order doesn't
            // matter.
            unit.create.push(extractedAttributeOp);
        }
        else {
            const ownerOp = lookupElement(elements, op.target);
            ir.OpList.insertBefore(extractedAttributeOp, ownerOp);
        }
        ir.OpList.remove(op);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDL0IsT0FBTyxFQUFDLGtCQUFrQixFQUE0QyxNQUFNLGdCQUFnQixDQUFDO0FBQzdGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUN2QyxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUNyQixJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLENBQUM7d0JBQzNCLElBQUksV0FBMkIsQ0FBQzt3QkFDaEMsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRSxD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Q0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM5Qyw2RkFBNkY7WUFDN0YsVUFBVTtZQUNWLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDekMsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7SUFDcEMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iS2luZCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7Y3JlYXRlT3BYcmVmTWFwfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBGaW5kIGFsbCBleHRyYWN0YWJsZSBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY3JlYXRlIEV4dHJhY3RlZEF0dHJpYnV0ZU9wcyBmb3IgdGhlbS5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEF0dHJpYnV0ZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBjcmVhdGVPcFhyZWZNYXAodW5pdCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICAgIGV4dHJhY3RBdHRyaWJ1dGVPcCh1bml0LCBvcCwgZWxlbWVudHMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgbGV0IGJpbmRpbmdLaW5kOiBpci5CaW5kaW5nS2luZDtcbiAgICAgICAgICAgIGlmIChvcC5pMThuTWVzc2FnZSAhPT0gbnVsbCAmJiBvcC50ZW1wbGF0ZUtpbmQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIGJpbmRpbmcgaGFzIGFuIGkxOG4gY29udGV4dCwgaXQgaXMgYW4gaTE4biBhdHRyaWJ1dGUsIGFuZCBzaG91bGQgaGF2ZSB0aGF0XG4gICAgICAgICAgICAgIC8vIGtpbmQgaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICAgICAgICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5JMThuO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcC5pc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgLy8gRGVsaWJlcmFseSBudWxsIGkxOG5NZXNzYWdlIHZhbHVlXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgYmluZGluZ0tpbmQsIG51bGwsIG9wLm5hbWUsIC8qIGV4cHJlc3Npb24gKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bkNvbnRleHQgKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bk1lc3NhZ2UgKi8gbnVsbCwgb3Auc2VjdXJpdHlDb250ZXh0KSxcbiAgICAgICAgICAgICAgICBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlR3b1dheVByb3BlcnR5OlxuICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuVHdvV2F5UHJvcGVydHksIG51bGwsIG9wLm5hbWUsIC8qIGV4cHJlc3Npb24gKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAvKiBpMThuTWVzc2FnZSAqLyBudWxsLCBvcC5zZWN1cml0eUNvbnRleHQpLFxuICAgICAgICAgICAgICBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgICAgLy8gVE9ETzogQ2FuIHN0eWxlIG9yIGNsYXNzIGJpbmRpbmdzIGJlIGkxOG4gYXR0cmlidXRlcz9cblxuICAgICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgdHJlYXRlZCBlbXB0eSBzdHlsZSBiaW5kaW5ncyBhcyByZWd1bGFyIGJpbmRpbmdzIGZvciB0aGUgcHVycG9zZSBvZlxuICAgICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAvLyBtb2RlLlxuICAgICAgICAgIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyICYmXG4gICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5FbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBvcC5uYW1lLCAvKiBleHByZXNzaW9uICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIC8qIGkxOG5NZXNzYWdlICovIG51bGwsIFNlY3VyaXR5Q29udGV4dC5TVFlMRSksXG4gICAgICAgICAgICAgICAgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZEF0dHJpYnV0ZU9wID0gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgb3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgbnVsbCwgb3AubmFtZSwgLyogZXhwcmVzc2lvbiAqLyBudWxsLFxuICAgICAgICAgICAgICAgIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgLyogaTE4bk1lc3NhZ2UgKi8gbnVsbCwgU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuICAgICAgICAgICAgaWYgKGpvYi5raW5kID09PSBDb21waWxhdGlvbkpvYktpbmQuSG9zdCkge1xuICAgICAgICAgICAgICBpZiAoam9iLmNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGRvZXMgbm90IGV4dHJhY3QgbGlzdGVuZXIgYmluZGluZ3MgdG8gdGhlIGNvbnN0IGFycmF5XG4gICAgICAgICAgICAgICAgLy8gKHdoaWNoIGlzIGhvbmVzdGx5IHByZXR0eSBpbmNvbnNpc3RlbnQpLlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXJcbiAgICAgICAgICAgICAgLy8gZG9lc24ndCBtYXR0ZXIuXG4gICAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goZXh0cmFjdGVkQXR0cmlidXRlT3ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgICBleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Ud29XYXlMaXN0ZW5lcjpcbiAgICAgICAgICAvLyBUd28td2F5IGxpc3RlbmVycyBhcmVuJ3Qgc3VwcG9ydGVkIGluIGhvc3QgYmluZGluZ3MuXG4gICAgICAgICAgaWYgKGpvYi5raW5kICE9PSBDb21waWxhdGlvbkpvYktpbmQuSG9zdCkge1xuICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkQXR0cmlidXRlT3AgPSBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBudWxsLCBvcC5uYW1lLCAvKiBleHByZXNzaW9uICovIG51bGwsXG4gICAgICAgICAgICAgICAgLyogaTE4bkNvbnRleHQgKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAvKiBpMThuTWVzc2FnZSAqLyBudWxsLCBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBFbGVtZW50KFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPixcbiAgICB4cmVmOiBpci5YcmVmSWQpOiBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0cyBhbiBhdHRyaWJ1dGUgYmluZGluZy5cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdEF0dHJpYnV0ZU9wKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkF0dHJpYnV0ZU9wLFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPikge1xuICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZXh0cmFjdGFibGUgPSBvcC5pc1RleHRBdHRyaWJ1dGUgfHwgb3AuZXhwcmVzc2lvbi5pc0NvbnN0YW50KCk7XG4gIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7XG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBvbmx5IGV4dHJhY3RzIHRleHQgYXR0cmlidXRlcy4gSXQgZG9lcyBub3QgZXh0cmFjdCBhdHRyaWlidXRlXG4gICAgLy8gYmluZGluZ3MsIGV2ZW4gaWYgdGhleSBhcmUgY29uc3RhbnRzLlxuICAgIGV4dHJhY3RhYmxlICYmPSBvcC5pc1RleHRBdHRyaWJ1dGU7XG4gIH1cblxuICBpZiAoZXh0cmFjdGFibGUpIHtcbiAgICBjb25zdCBleHRyYWN0ZWRBdHRyaWJ1dGVPcCA9IGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICBvcC50YXJnZXQsXG4gICAgICAgIG9wLmlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlID8gaXIuQmluZGluZ0tpbmQuVGVtcGxhdGUgOiBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsXG4gICAgICAgIG9wLm5hbWVzcGFjZSwgb3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AuaTE4bkNvbnRleHQsIG9wLmkxOG5NZXNzYWdlLCBvcC5zZWN1cml0eUNvbnRleHQpO1xuICAgIGlmICh1bml0LmpvYi5raW5kID09PSBDb21waWxhdGlvbkpvYktpbmQuSG9zdCkge1xuICAgICAgLy8gVGhpcyBhdHRyaWJ1dGUgd2lsbCBhcHBseSB0byB0aGUgZW5jbG9zaW5nIGhvc3QgYmluZGluZyBjb21waWxhdGlvbiB1bml0LCBzbyBvcmRlciBkb2Vzbid0XG4gICAgICAvLyBtYXR0ZXIuXG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGV4dHJhY3RlZEF0dHJpYnV0ZU9wKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgb3duZXJPcCk7XG4gICAgfVxuICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuVXBkYXRlT3A+KG9wKTtcbiAgfVxufVxuIl19