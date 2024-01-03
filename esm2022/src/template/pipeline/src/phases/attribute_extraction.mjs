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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDL0IsT0FBTyxFQUFDLGtCQUFrQixFQUE0QyxNQUFNLGdCQUFnQixDQUFDO0FBQzdGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUN2QyxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUNyQixJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLENBQUM7d0JBQzNCLElBQUksV0FBMkIsQ0FBQzt3QkFDaEMsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRSxD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QUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDOUYsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM5Qyw2RkFBNkY7WUFDN0YsVUFBVTtZQUNWLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDekMsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7SUFDcEMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iS2luZCwgdHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7Y3JlYXRlT3BYcmVmTWFwfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBGaW5kIGFsbCBleHRyYWN0YWJsZSBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY3JlYXRlIEV4dHJhY3RlZEF0dHJpYnV0ZU9wcyBmb3IgdGhlbS5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEF0dHJpYnV0ZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBjcmVhdGVPcFhyZWZNYXAodW5pdCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICAgIGV4dHJhY3RBdHRyaWJ1dGVPcCh1bml0LCBvcCwgZWxlbWVudHMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgbGV0IGJpbmRpbmdLaW5kOiBpci5CaW5kaW5nS2luZDtcbiAgICAgICAgICAgIGlmIChvcC5pMThuTWVzc2FnZSAhPT0gbnVsbCAmJiBvcC50ZW1wbGF0ZUtpbmQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIGJpbmRpbmcgaGFzIGFuIGkxOG4gY29udGV4dCwgaXQgaXMgYW4gaTE4biBhdHRyaWJ1dGUsIGFuZCBzaG91bGQgaGF2ZSB0aGF0XG4gICAgICAgICAgICAgIC8vIGtpbmQgaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICAgICAgICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5JMThuO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcC5pc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYmluZGluZ0tpbmQgPSBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgLy8gRGVsaWJlcmFseSBudWxsIGkxOG5NZXNzYWdlIHZhbHVlXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgYmluZGluZ0tpbmQsIG51bGwsIG9wLm5hbWUsIC8qIGV4cHJlc3Npb24gKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bkNvbnRleHQgKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgLyogaTE4bk1lc3NhZ2UgKi8gbnVsbCwgb3Auc2VjdXJpdHlDb250ZXh0KSxcbiAgICAgICAgICAgICAgICBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgICAgICAgIC8vIFRPRE86IENhbiBzdHlsZSBvciBjbGFzcyBiaW5kaW5ncyBiZSBpMThuIGF0dHJpYnV0ZXM/XG5cbiAgICAgICAgICAvLyBUaGUgb2xkIGNvbXBpbGVyIHRyZWF0ZWQgZW1wdHkgc3R5bGUgYmluZGluZ3MgYXMgcmVndWxhciBiaW5kaW5ncyBmb3IgdGhlIHB1cnBvc2Ugb2ZcbiAgICAgICAgICAvLyBkaXJlY3RpdmUgbWF0Y2hpbmcuIFRoYXQgYmVoYXZpb3IgaXMgaW5jb3JyZWN0LCBidXQgd2UgZW11bGF0ZSBpdCBpbiBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgLy8gbW9kZS5cbiAgICAgICAgICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciAmJlxuICAgICAgICAgICAgICBvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuRW1wdHlFeHByKSB7XG4gICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICAgICAgb3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgbnVsbCwgb3AubmFtZSwgLyogZXhwcmVzc2lvbiAqLyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAvKiBpMThuQ29udGV4dCAqLyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAvKiBpMThuTWVzc2FnZSAqLyBudWxsLCBTZWN1cml0eUNvbnRleHQuU1RZTEUpLFxuICAgICAgICAgICAgICAgIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgICAgaWYgKCFvcC5pc0FuaW1hdGlvbkxpc3RlbmVyKSB7XG4gICAgICAgICAgICBjb25zdCBleHRyYWN0ZWRBdHRyaWJ1dGVPcCA9IGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG51bGwsIG9wLm5hbWUsIC8qIGV4cHJlc3Npb24gKi8gbnVsbCxcbiAgICAgICAgICAgICAgICAvKiBpMThuQ29udGV4dCAqLyBudWxsLFxuICAgICAgICAgICAgICAgIC8qIGkxOG5NZXNzYWdlICovIG51bGwsIFNlY3VyaXR5Q29udGV4dC5OT05FKTtcbiAgICAgICAgICAgIGlmIChqb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgICAgICAgICAgaWYgKGpvYi5jb21wYXRpYmlsaXR5KSB7XG4gICAgICAgICAgICAgICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzIG5vdCBleHRyYWN0IGxpc3RlbmVyIGJpbmRpbmdzIHRvIHRoZSBjb25zdCBhcnJheVxuICAgICAgICAgICAgICAgIC8vICh3aGljaCBpcyBob25lc3RseSBwcmV0dHkgaW5jb25zaXN0ZW50KS5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBUaGlzIGF0dHJpYnV0ZSB3aWxsIGFwcGx5IHRvIHRoZSBlbmNsb3NpbmcgaG9zdCBiaW5kaW5nIGNvbXBpbGF0aW9uIHVuaXQsIHNvIG9yZGVyXG4gICAgICAgICAgICAgIC8vIGRvZXNuJ3QgbWF0dGVyLlxuICAgICAgICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGV4dHJhY3RlZEF0dHJpYnV0ZU9wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgICAgZXh0cmFjdGVkQXR0cmlidXRlT3AsIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBMb29rcyB1cCBhbiBlbGVtZW50IGluIHRoZSBnaXZlbiBtYXAgYnkgeHJlZiBJRC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwRWxlbWVudChcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcD4sXG4gICAgeHJlZjogaXIuWHJlZklkKTogaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGVsID0gZWxlbWVudHMuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbi8qKlxuICogRXh0cmFjdHMgYW4gYXR0cmlidXRlIGJpbmRpbmcuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RBdHRyaWJ1dGVPcChcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wOiBpci5BdHRyaWJ1dGVPcCxcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcD4pIHtcbiAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGV4dHJhY3RhYmxlID0gb3AuaXNUZXh0QXR0cmlidXRlIHx8IG9wLmV4cHJlc3Npb24uaXNDb25zdGFudCgpO1xuICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcikge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb25seSBleHRyYWN0cyB0ZXh0IGF0dHJpYnV0ZXMuIEl0IGRvZXMgbm90IGV4dHJhY3QgYXR0cmlpYnV0ZVxuICAgIC8vIGJpbmRpbmdzLCBldmVuIGlmIHRoZXkgYXJlIGNvbnN0YW50cy5cbiAgICBleHRyYWN0YWJsZSAmJj0gb3AuaXNUZXh0QXR0cmlidXRlO1xuICB9XG5cbiAgaWYgKGV4dHJhY3RhYmxlKSB7XG4gICAgY29uc3QgZXh0cmFjdGVkQXR0cmlidXRlT3AgPSBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgb3AudGFyZ2V0LFxuICAgICAgICBvcC5pc1N0cnVjdHVyYWxUZW1wbGF0ZUF0dHJpYnV0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLFxuICAgICAgICBvcC5uYW1lc3BhY2UsIG9wLm5hbWUsIG9wLmV4cHJlc3Npb24sIG9wLmkxOG5Db250ZXh0LCBvcC5pMThuTWVzc2FnZSwgb3Auc2VjdXJpdHlDb250ZXh0KTtcbiAgICBpZiAodW5pdC5qb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgIC8vIFRoaXMgYXR0cmlidXRlIHdpbGwgYXBwbHkgdG8gdGhlIGVuY2xvc2luZyBob3N0IGJpbmRpbmcgY29tcGlsYXRpb24gdW5pdCwgc28gb3JkZXIgZG9lc24ndFxuICAgICAgLy8gbWF0dGVyLlxuICAgICAgdW5pdC5jcmVhdGUucHVzaChleHRyYWN0ZWRBdHRyaWJ1dGVPcCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oZXh0cmFjdGVkQXR0cmlidXRlT3AsIG93bmVyT3ApO1xuICAgIH1cbiAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gIH1cbn1cbiJdfQ==