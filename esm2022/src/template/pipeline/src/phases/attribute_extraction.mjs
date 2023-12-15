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
        // TemplateDefinitionBuilder only extracted attributes that were string literals.
        extractable = op.isTextAttribute || ir.isStringLiteral(op.expression);
        if (op.name === 'style' || op.name === 'class') {
            // For style and class attributes, TemplateDefinitionBuilder only extracted them if they were
            // text attributes. For example, `[attr.class]="'my-class'"` was not extracted despite being a
            // string literal, because it is not a text attribute.
            extractable &&= op.isTextAttribute;
        }
        if (unit.job.kind === CompilationJobKind.Host) {
            // TemplateDefinitionBuilder also does not seem to extract string literals if they are part of
            // a host attribute.
            extractable &&= op.isTextAttribute;
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDL0IsT0FBTyxFQUFDLGtCQUFrQixFQUE0QyxNQUFNLGdCQUFnQixDQUFDO0FBQzdGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVqRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBbUI7SUFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7b0JBQ3JCLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUU7d0JBQzFCLElBQUksV0FBMkIsQ0FBQzt3QkFDaEMsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRTs0QkFDdkQsb0ZBQW9GOzRCQUNwRiw0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RUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDaEYsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUU7WUFDN0MsNkZBQTZGO1lBQzdGLFVBQVU7WUFDVixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3hDO2FBQU07WUFDTCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNwRTtRQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0tBQ25DO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi8uLi8uLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2JLaW5kLCB0eXBlIENvbXBpbGF0aW9uSm9iLCB0eXBlIENvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtjcmVhdGVPcFhyZWZNYXB9IGZyb20gJy4uL3V0aWwvZWxlbWVudHMnO1xuXG4vKipcbiAqIEZpbmQgYWxsIGV4dHJhY3RhYmxlIGF0dHJpYnV0ZSBhbmQgYmluZGluZyBvcHMsIGFuZCBjcmVhdGUgRXh0cmFjdGVkQXR0cmlidXRlT3BzIGZvciB0aGVtLlxuICogSW4gY2FzZXMgd2hlcmUgbm8gaW5zdHJ1Y3Rpb24gbmVlZHMgdG8gYmUgZ2VuZXJhdGVkIGZvciB0aGUgYXR0cmlidXRlIG9yIGJpbmRpbmcsIGl0IGlzIHJlbW92ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0QXR0cmlidXRlcyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGNyZWF0ZU9wWHJlZk1hcCh1bml0KTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgICAgZXh0cmFjdEF0dHJpYnV0ZU9wKHVuaXQsIG9wLCBlbGVtZW50cyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICAgIGlmICghb3AuaXNBbmltYXRpb25UcmlnZ2VyKSB7XG4gICAgICAgICAgICBsZXQgYmluZGluZ0tpbmQ6IGlyLkJpbmRpbmdLaW5kO1xuICAgICAgICAgICAgaWYgKG9wLmkxOG5NZXNzYWdlICE9PSBudWxsICYmIG9wLnRlbXBsYXRlS2luZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgYmluZGluZyBoYXMgYW4gaTE4biBjb250ZXh0LCBpdCBpcyBhbiBpMThuIGF0dHJpYnV0ZSwgYW5kIHNob3VsZCBoYXZlIHRoYXRcbiAgICAgICAgICAgICAgLy8ga2luZCBpbiB0aGUgY29uc3RzIGFycmF5LlxuICAgICAgICAgICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLkkxOG47XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wLmlzU3RydWN0dXJhbFRlbXBsYXRlQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgIGJpbmRpbmdLaW5kID0gaXIuQmluZGluZ0tpbmQuVGVtcGxhdGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBiaW5kaW5nS2luZCA9IGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgICAgICAvLyBEZWxpYmVyYWx5IG51bGwgaTE4bk1lc3NhZ2UgdmFsdWVcbiAgICAgICAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICAgICAgb3AudGFyZ2V0LCBiaW5kaW5nS2luZCwgb3AubmFtZSwgLyogZXhwcmVzc2lvbiAqLyBudWxsLCAvKiBpMThuQ29udGV4dCAqLyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAvKiBpMThuTWVzc2FnZSAqLyBudWxsLCBvcC5zZWN1cml0eUNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgICAgLy8gVE9ETzogQ2FuIHN0eWxlIG9yIGNsYXNzIGJpbmRpbmdzIGJlIGkxOG4gYXR0cmlidXRlcz9cblxuICAgICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgdHJlYXRlZCBlbXB0eSBzdHlsZSBiaW5kaW5ncyBhcyByZWd1bGFyIGJpbmRpbmdzIGZvciB0aGUgcHVycG9zZSBvZlxuICAgICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAvLyBtb2RlLlxuICAgICAgICAgIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyICYmXG4gICAgICAgICAgICAgIG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5FbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBvcC5uYW1lLCAvKiBleHByZXNzaW9uICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIC8qIGkxOG5NZXNzYWdlICovIG51bGwsIFNlY3VyaXR5Q29udGV4dC5TVFlMRSksXG4gICAgICAgICAgICAgICAgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZEF0dHJpYnV0ZU9wID0gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgb3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3AubmFtZSwgLyogZXhwcmVzc2lvbiAqLyBudWxsLFxuICAgICAgICAgICAgICAgIC8qIGkxOG5Db250ZXh0ICovIG51bGwsXG4gICAgICAgICAgICAgICAgLyogaTE4bk1lc3NhZ2UgKi8gbnVsbCwgU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuICAgICAgICAgICAgaWYgKGpvYi5raW5kID09PSBDb21waWxhdGlvbkpvYktpbmQuSG9zdCkge1xuICAgICAgICAgICAgICAvLyBUaGlzIGF0dHJpYnV0ZSB3aWxsIGFwcGx5IHRvIHRoZSBlbmNsb3NpbmcgaG9zdCBiaW5kaW5nIGNvbXBpbGF0aW9uIHVuaXQsIHNvIG9yZGVyXG4gICAgICAgICAgICAgIC8vIGRvZXNuJ3QgbWF0dGVyLlxuICAgICAgICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGV4dHJhY3RlZEF0dHJpYnV0ZU9wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgICAgZXh0cmFjdGVkQXR0cmlidXRlT3AsIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBMb29rcyB1cCBhbiBlbGVtZW50IGluIHRoZSBnaXZlbiBtYXAgYnkgeHJlZiBJRC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwRWxlbWVudChcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcD4sXG4gICAgeHJlZjogaXIuWHJlZklkKTogaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGVsID0gZWxlbWVudHMuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbi8qKlxuICogRXh0cmFjdHMgYW4gYXR0cmlidXRlIGJpbmRpbmcuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RBdHRyaWJ1dGVPcChcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wOiBpci5BdHRyaWJ1dGVPcCxcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuQ29uc3VtZXNTbG90T3BUcmFpdCZpci5DcmVhdGVPcD4pIHtcbiAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGV4dHJhY3RhYmxlID0gb3AuaXNUZXh0QXR0cmlidXRlIHx8IG9wLmV4cHJlc3Npb24uaXNDb25zdGFudCgpO1xuICBpZiAodW5pdC5qb2IuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcikge1xuICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb25seSBleHRyYWN0ZWQgYXR0cmlidXRlcyB0aGF0IHdlcmUgc3RyaW5nIGxpdGVyYWxzLlxuICAgIGV4dHJhY3RhYmxlID0gb3AuaXNUZXh0QXR0cmlidXRlIHx8IGlyLmlzU3RyaW5nTGl0ZXJhbChvcC5leHByZXNzaW9uKTtcbiAgICBpZiAob3AubmFtZSA9PT0gJ3N0eWxlJyB8fCBvcC5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAvLyBGb3Igc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXMsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb25seSBleHRyYWN0ZWQgdGhlbSBpZiB0aGV5IHdlcmVcbiAgICAgIC8vIHRleHQgYXR0cmlidXRlcy4gRm9yIGV4YW1wbGUsIGBbYXR0ci5jbGFzc109XCInbXktY2xhc3MnXCJgIHdhcyBub3QgZXh0cmFjdGVkIGRlc3BpdGUgYmVpbmcgYVxuICAgICAgLy8gc3RyaW5nIGxpdGVyYWwsIGJlY2F1c2UgaXQgaXMgbm90IGEgdGV4dCBhdHRyaWJ1dGUuXG4gICAgICBleHRyYWN0YWJsZSAmJj0gb3AuaXNUZXh0QXR0cmlidXRlO1xuICAgIH1cbiAgICBpZiAodW5pdC5qb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYWxzbyBkb2VzIG5vdCBzZWVtIHRvIGV4dHJhY3Qgc3RyaW5nIGxpdGVyYWxzIGlmIHRoZXkgYXJlIHBhcnQgb2ZcbiAgICAgIC8vIGEgaG9zdCBhdHRyaWJ1dGUuXG4gICAgICBleHRyYWN0YWJsZSAmJj0gb3AuaXNUZXh0QXR0cmlidXRlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChleHRyYWN0YWJsZSkge1xuICAgIGNvbnN0IGV4dHJhY3RlZEF0dHJpYnV0ZU9wID0gaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgIG9wLnRhcmdldCxcbiAgICAgICAgb3AuaXNTdHJ1Y3R1cmFsVGVtcGxhdGVBdHRyaWJ1dGUgPyBpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSA6IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSxcbiAgICAgICAgb3AubmFtZSwgb3AuZXhwcmVzc2lvbiwgb3AuaTE4bkNvbnRleHQsIG9wLmkxOG5NZXNzYWdlLCBvcC5zZWN1cml0eUNvbnRleHQpO1xuICAgIGlmICh1bml0LmpvYi5raW5kID09PSBDb21waWxhdGlvbkpvYktpbmQuSG9zdCkge1xuICAgICAgLy8gVGhpcyBhdHRyaWJ1dGUgd2lsbCBhcHBseSB0byB0aGUgZW5jbG9zaW5nIGhvc3QgYmluZGluZyBjb21waWxhdGlvbiB1bml0LCBzbyBvcmRlciBkb2Vzbid0XG4gICAgICAvLyBtYXR0ZXIuXG4gICAgICB1bml0LmNyZWF0ZS5wdXNoKGV4dHJhY3RlZEF0dHJpYnV0ZU9wKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihleHRyYWN0ZWRBdHRyaWJ1dGVPcCwgb3duZXJPcCk7XG4gICAgfVxuICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuVXBkYXRlT3A+KG9wKTtcbiAgfVxufVxuIl19