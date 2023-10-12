/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { CompilationJobKind } from '../compilation';
import { getElementsByXrefId } from '../util/elements';
/**
 * Find all extractable attribute and binding ops, and create ExtractedAttributeOps for them.
 * In cases where no instruction needs to be generated for the attribute or binding, it is removed.
 */
export function phaseAttributeExtraction(job) {
    for (const unit of job.units) {
        const elements = getElementsByXrefId(unit);
        for (const op of unit.ops()) {
            switch (op.kind) {
                case ir.OpKind.Attribute:
                    extractAttributeOp(unit, op, elements);
                    break;
                case ir.OpKind.Property:
                case ir.OpKind.PropertyCreate:
                    if (!op.isAnimationTrigger) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Property, op.name, null), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.StyleProp:
                case ir.OpKind.ClassProp:
                    // The old compiler treated empty style bindings as regular bindings for the purpose of
                    // directive matching. That behavior is incorrect, but we emulate it in compatibility
                    // mode.
                    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                        op.expression instanceof ir.EmptyExpr) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, null), lookupElement(elements, op.target));
                    }
                    break;
                case ir.OpKind.Listener:
                    if (!op.isAnimationListener) {
                        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, ir.BindingKind.Property, op.name, null);
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
    let extractable = op.expression.isConstant();
    if (unit.job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
        // TemplateDefinitionBuilder only extracted attributes that were string literals.
        extractable = ir.isStringLiteral(op.expression);
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
        const extractedAttributeOp = ir.createExtractedAttributeOp(op.target, op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Attribute, op.name, op.expression);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQTRDLGtCQUFrQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0YsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFckQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEdBQW1CO0lBQzFELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixNQUFNLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztnQkFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWM7b0JBQzNCLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUU7d0JBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFB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QUUsQ0FBQyxlQUFlLENBQUM7U0FDcEM7UUFDRCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLGtCQUFrQixDQUFDLElBQUksRUFBRTtZQUM3Qyw4RkFBOEY7WUFDOUYsb0JBQW9CO1lBQ3BCLFdBQVcsS0FBSyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ3BDO0tBQ0Y7SUFFRCxJQUFJLFdBQVcsRUFBRTtRQUNmLE1BQU0sb0JBQW9CLEdBQUcsRUFBRSxDQUFDLDBCQUEwQixDQUN0RCxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUN0RixFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUU7WUFDN0MsNkZBQTZGO1lBQzdGLFVBQVU7WUFDVixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3hDO2FBQU07WUFDTCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNwRTtRQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0tBQ25DO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7dHlwZSBDb21waWxhdGlvbkpvYiwgdHlwZSBDb21waWxhdGlvblVuaXQsIENvbXBpbGF0aW9uSm9iS2luZH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtnZXRFbGVtZW50c0J5WHJlZklkfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBGaW5kIGFsbCBleHRyYWN0YWJsZSBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY3JlYXRlIEV4dHJhY3RlZEF0dHJpYnV0ZU9wcyBmb3IgdGhlbS5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gZ2V0RWxlbWVudHNCeVhyZWZJZCh1bml0KTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgICAgZXh0cmFjdEF0dHJpYnV0ZU9wKHVuaXQsIG9wLCBlbGVtZW50cyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eUNyZWF0ZTpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uVHJpZ2dlcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgb3AuaXNUZW1wbGF0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuUHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgIG9wLm5hbWUsIG51bGwpLFxuICAgICAgICAgICAgICAgIGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgICAgICAgLy8gVGhlIG9sZCBjb21waWxlciB0cmVhdGVkIGVtcHR5IHN0eWxlIGJpbmRpbmdzIGFzIHJlZ3VsYXIgYmluZGluZ3MgZm9yIHRoZSBwdXJwb3NlIG9mXG4gICAgICAgICAgLy8gZGlyZWN0aXZlIG1hdGNoaW5nLiBUaGF0IGJlaGF2aW9yIGlzIGluY29ycmVjdCwgYnV0IHdlIGVtdWxhdGUgaXQgaW4gY29tcGF0aWJpbGl0eVxuICAgICAgICAgIC8vIG1vZGUuXG4gICAgICAgICAgaWYgKHVuaXQuam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkVtcHR5RXhwcikge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3Aob3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3AubmFtZSwgbnVsbCksXG4gICAgICAgICAgICAgICAgbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgICBpZiAoIW9wLmlzQW5pbWF0aW9uTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZEF0dHJpYnV0ZU9wID1cbiAgICAgICAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBvcC5uYW1lLCBudWxsKTtcbiAgICAgICAgICAgIGlmIChqb2Iua2luZCA9PT0gQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyBhdHRyaWJ1dGUgd2lsbCBhcHBseSB0byB0aGUgZW5jbG9zaW5nIGhvc3QgYmluZGluZyBjb21waWxhdGlvbiB1bml0LCBzbyBvcmRlclxuICAgICAgICAgICAgICAvLyBkb2Vzbid0IG1hdHRlci5cbiAgICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChleHRyYWN0ZWRBdHRyaWJ1dGVPcCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgICAgICAgIGV4dHJhY3RlZEF0dHJpYnV0ZU9wLCBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTG9va3MgdXAgYW4gZWxlbWVudCBpbiB0aGUgZ2l2ZW4gbWFwIGJ5IHhyZWYgSUQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cEVsZW1lbnQoXG4gICAgZWxlbWVudHM6IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcz4sIHhyZWY6IGlyLlhyZWZJZCk6IGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcyB7XG4gIGNvbnN0IGVsID0gZWxlbWVudHMuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbi8qKlxuICogRXh0cmFjdHMgYW4gYXR0cmlidXRlIGJpbmRpbmcuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RBdHRyaWJ1dGVPcChcbiAgICB1bml0OiBDb21waWxhdGlvblVuaXQsIG9wOiBpci5BdHRyaWJ1dGVPcCwgZWxlbWVudHM6IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcz4pIHtcbiAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGV4dHJhY3RhYmxlID0gb3AuZXhwcmVzc2lvbi5pc0NvbnN0YW50KCk7XG4gIGlmICh1bml0LmpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7XG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBvbmx5IGV4dHJhY3RlZCBhdHRyaWJ1dGVzIHRoYXQgd2VyZSBzdHJpbmcgbGl0ZXJhbHMuXG4gICAgZXh0cmFjdGFibGUgPSBpci5pc1N0cmluZ0xpdGVyYWwob3AuZXhwcmVzc2lvbik7XG4gICAgaWYgKG9wLm5hbWUgPT09ICdzdHlsZScgfHwgb3AubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgLy8gRm9yIHN0eWxlIGFuZCBjbGFzcyBhdHRyaWJ1dGVzLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIG9ubHkgZXh0cmFjdGVkIHRoZW0gaWYgdGhleSB3ZXJlXG4gICAgICAvLyB0ZXh0IGF0dHJpYnV0ZXMuIEZvciBleGFtcGxlLCBgW2F0dHIuY2xhc3NdPVwiJ215LWNsYXNzJ1wiYCB3YXMgbm90IGV4dHJhY3RlZCBkZXNwaXRlIGJlaW5nIGFcbiAgICAgIC8vIHN0cmluZyBsaXRlcmFsLCBiZWNhdXNlIGl0IGlzIG5vdCBhIHRleHQgYXR0cmlidXRlLlxuICAgICAgZXh0cmFjdGFibGUgJiY9IG9wLmlzVGV4dEF0dHJpYnV0ZTtcbiAgICB9XG4gICAgaWYgKHVuaXQuam9iLmtpbmQgPT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KSB7XG4gICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGFsc28gZG9lcyBub3Qgc2VlbSB0byBleHRyYWN0IHN0cmluZyBsaXRlcmFscyBpZiB0aGV5IGFyZSBwYXJ0IG9mXG4gICAgICAvLyBhIGhvc3QgYXR0cmlidXRlLlxuICAgICAgZXh0cmFjdGFibGUgJiY9IG9wLmlzVGV4dEF0dHJpYnV0ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoZXh0cmFjdGFibGUpIHtcbiAgICBjb25zdCBleHRyYWN0ZWRBdHRyaWJ1dGVPcCA9IGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICBvcC50YXJnZXQsIG9wLmlzVGVtcGxhdGUgPyBpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSA6IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgb3AubmFtZSxcbiAgICAgICAgb3AuZXhwcmVzc2lvbik7XG4gICAgaWYgKHVuaXQuam9iLmtpbmQgPT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KSB7XG4gICAgICAvLyBUaGlzIGF0dHJpYnV0ZSB3aWxsIGFwcGx5IHRvIHRoZSBlbmNsb3NpbmcgaG9zdCBiaW5kaW5nIGNvbXBpbGF0aW9uIHVuaXQsIHNvIG9yZGVyIGRvZXNuJ3RcbiAgICAgIC8vIG1hdHRlci5cbiAgICAgIHVuaXQuY3JlYXRlLnB1c2goZXh0cmFjdGVkQXR0cmlidXRlT3ApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KGV4dHJhY3RlZEF0dHJpYnV0ZU9wLCBvd25lck9wKTtcbiAgICB9XG4gICAgaXIuT3BMaXN0LnJlbW92ZTxpci5VcGRhdGVPcD4ob3ApO1xuICB9XG59XG4iXX0=