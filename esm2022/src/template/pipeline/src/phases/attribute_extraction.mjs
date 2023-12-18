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
                        ir.createExtractedAttributeOp(op.target, bindingKind, op.name, /* expression */ null, /* i18nContext */ null, 
                        /* i18nMessage */ null, op.securityContext), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.StyleProp:
                case ir.OpKind.ClassProp:
                    // TODO: Can style or class bindings be i18n attributes?
                    // The old compiler treated empty style bindings as regular bindings for the purpose of
                    // directive matching. That behavior is incorrect, but we emulate it in compatibility
                    // mode.
                    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                        op.expression instanceof ir.EmptyExpr) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, SecurityContext.STYLE), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.Listener:
                    if (!op.isAnimationListener) {
                        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, /* expression */ null, 
                        /* i18nContext */ null, 
                        /* i18nMessage */ null, SecurityContext.NONE);
                        if (job.kind === CompilationJobKind.Host) {
                            // This attribute will apply to the enclosing host binding compilation unit, so order
                            // doesn't matter.
                            unit.create.push(extractedAttributeOp);
                        }
                        else {
                            ir.OpList.insertBefore(extractedAttributeOp, lookupElement(elements, op.target));
                        }
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
        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, op.isStructuralTemplateAttribute ? ir.BindingKind.Template : ir.BindingKind.Attribute, op.name, op.expression, op.i18nContext, op.i18nMessage, op.securityContext);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDL0IsT0FBTyxFQUFDLGtCQUFrQixFQUE0QyxNQUFNLGdCQUFnQixDQUFDO0FBQzdGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUU7d0JBQzFCLElBQUksV0FBMkIsQ0FBQzt3QkFDaEMsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRTs0QkFDdkQsb0ZBQW9GOzRCQUNwRiw0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QUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFjLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3BFO1FBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7S0FDbkM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYktpbmQsIHR5cGUgQ29tcGlsYXRpb25Kb2IsIHR5cGUgQ29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2NyZWF0ZU9wWHJlZk1hcH0gZnJvbSAnLi4vdXRpbC9lbGVtZW50cyc7XG5cbi8qKlxuICogRmluZCBhbGwgZXh0cmFjdGFibGUgYXR0cmlidXRlIGFuZCBiaW5kaW5nIG9wcywgYW5kIGNyZWF0ZSBFeHRyYWN0ZWRBdHRyaWJ1dGVPcHMgZm9yIHRoZW0uXG4gKiBJbiBjYXNlcyB3aGVyZSBubyBpbnN0cnVjdGlvbiBuZWVkcyB0byBiZSBnZW5lcmF0ZWQgZm9yIHRoZSBhdHRyaWJ1dGUgb3IgYmluZGluZywgaXQgaXMgcmVtb3ZlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RBdHRyaWJ1dGVzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gY3JlYXRlT3BYcmVmTWFwKHVuaXQpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgICBleHRyYWN0QXR0cmlidXRlT3AodW5pdCwgb3AsIGVsZW1lbnRzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgICAgaWYgKCFvcC5pc0FuaW1hdGlvblRyaWdnZXIpIHtcbiAgICAgICAgICAgIGxldCBiaW5kaW5nS2luZDogaXIuQmluZGluZ0tpbmQ7XG4gICAgICAgICAgICBpZiAob3AuaTE4bk1lc3NhZ2UgIT09IG51bGwgJiYgb3AudGVtcGxhdGVLaW5kID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoZSBiaW5kaW5nIGhhcyBhbiBpMThuIGNvbnRleHQsIGl0IGlzIGFuIGkxOG4gYXR0cmlidXRlLCBhbmQgc2hvdWxkIGhhdmUgdGhhdFxuICAgICAgICAgICAgICAvLyBraW5kIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAgICAgICAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuSTE4bjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AuaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5UZW1wbGF0ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuUHJvcGVydHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIC8vIERlbGliZXJhbHkgbnVsbCBpMThuTWVzc2FnZSB2YWx1ZVxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGJpbmRpbmdLaW5kLCBvcC5uYW1lLCAvKiBleHByZXNzaW9uICovIG51bGwsIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIC8qIGkxOG5NZXNzYWdlICovIG51bGwsIG9wLnNlY3VyaXR5Q29udGV4dCksXG4gICAgICAgICAgICAgICAgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgICAvLyBUT0RPOiBDYW4gc3R5bGUgb3IgY2xhc3MgYmluZGluZ3MgYmUgaTE4biBhdHRyaWJ1dGVzP1xuXG4gICAgICAgICAgLy8gVGhlIG9sZCBjb21waWxlciB0cmVhdGVkIGVtcHR5IHN0eWxlIGJpbmRpbmdzIGFzIHJlZ3VsYXIgYmluZGluZ3MgZm9yIHRoZSBwdXJwb3NlIG9mXG4gICAgICAgICAgLy8gZGlyZWN0aXZlIG1hdGNoaW5nLiBUaGF0IGJlaGF2aW9yIGlzIGluY29ycmVjdCwgYnV0IHdlIGVtdWxhdGUgaXQgaW4gY29tcGF0aWJpbGl0eVxuICAgICAgICAgIC8vIG1vZGUuXG4gICAgICAgICAgaWYgKHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkVtcHR5RXhwcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIC8qIGV4cHJlc3Npb24gKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bkNvbnRleHQgKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bk1lc3NhZ2UgKi8gbnVsbCwgU2VjdXJpdHlDb250ZXh0LlNUWUxFKSxcbiAgICAgICAgICAgICAgICBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICAgIGlmICghb3AuaXNBbmltYXRpb25MaXN0ZW5lcikge1xuICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkQXR0cmlidXRlT3AgPSBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBvcC5uYW1lLCAvKiBleHByZXNzaW9uICovIG51bGwsXG4gICAgICAgICAgICAgICAgLyogaTE4bkNvbnRleHQgKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAvKiBpMThuTWVzc2FnZSAqLyBudWxsLCBTZWN1cml0eUNvbnRleHQuTk9ORSk7XG4gICAgICAgICAgICBpZiAoam9iLmtpbmQgPT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KSB7XG4gICAgICAgICAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXJcbiAgICAgICAgICAgICAgLy8gZG9lc24ndCBtYXR0ZXIuXG4gICAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goZXh0cmFjdGVkQXR0cmlidXRlT3ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgICBleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBFbGVtZW50KFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPixcbiAgICB4cmVmOiBpci5YcmVmSWQpOiBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0cyBhbiBhdHRyaWJ1dGUgYmluZGluZy5cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdEF0dHJpYnV0ZU9wKFxuICAgIHVuaXQ6IENvbXBpbGF0aW9uVW5pdCwgb3A6IGlyLkF0dHJpYnV0ZU9wLFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5Db25zdW1lc1Nsb3RPcFRyYWl0JmlyLkNyZWF0ZU9wPikge1xuICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgZXh0cmFjdGFibGUgPSBvcC5pc1RleHRBdHRyaWJ1dGUgfHwgb3AuZXhwcmVzc2lvbi5pc0NvbnN0YW50KCk7XG4gIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7XG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBvbmx5IGV4dHJhY3RzIHRleHQgYXR0cmlidXRlcy4gSXQgZG9lcyBub3QgZXh0cmFjdCBhdHRyaWlidXRlXG4gICAgLy8gYmluZGluZ3MsIGV2ZW4gaWYgdGhleSBhcmUgY29uc3RhbnRzLlxuICAgIGV4dHJhY3RhYmxlICYmPSBvcC5pc1RleHRBdHRyaWJ1dGU7XG4gIH1cblxuICBpZiAoZXh0cmFjdGFibGUpIHtcbiAgICBjb25zdCBleHRyYWN0ZWRBdHRyaWJ1dGVPcCA9IGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICBvcC50YXJnZXQsXG4gICAgICAgIG9wLmlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlID8gaXIuQmluZGluZ0tpbmQuVGVtcGxhdGUgOiBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUsXG4gICAgICAgIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLmkxOG5Db250ZXh0LCBvcC5pMThuTWVzc2FnZSwgb3Auc2VjdXJpdHlDb250ZXh0KTtcbiAgICBpZiAodW5pdC5qb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXIgZG9lc24ndFxuICAgICAgLy8gbWF0dGVyLlxuICAgICAgdW5pdC5jcmVhdGUucHVzaChleHRyYWN0ZWRBdHRyaWJ1dGVPcCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oZXh0cmFjdGVkQXR0cmlidXRlT3AsIG93bmVyT3ApO1xuICAgIH1cbiAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gIH1cbn1cbiJdfQ==