/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import { parse as parseStyle } from '../../../../render3/view/style_parser';
import * as ir from '../../ir';
/**
 * Parses extracted style and class attributes into separate ExtractedAttributeOps per style or
 * class property.
 */
export function parseExtractedStyles(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedAttribute && op.bindingKind === ir.BindingKind.Attribute &&
                ir.isStringLiteral(op.expression)) {
                if (op.name === 'style') {
                    const parsedStyles = parseStyle(op.expression.value);
                    for (let i = 0; i < parsedStyles.length - 1; i += 2) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.StyleProperty, parsedStyles[i], o.literal(parsedStyles[i + 1])), op);
                    }
                    ir.OpList.remove(op);
                }
                else if (op.name === 'class') {
                    const parsedClasses = op.expression.value.trim().split(/\s+/g);
                    for (const parsedClass of parsedClasses) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.ClassName, parsedClass, null), op);
                    }
                    ir.OpList.remove(op);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfZXh0cmFjdGVkX3N0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BhcnNlX2V4dHJhY3RlZF9zdHlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsS0FBSyxJQUFJLFVBQVUsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBQzFFLE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxHQUFtQjtJQUN0RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQyxXQUFXLEtBQUssRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTO2dCQUN2RixFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxVQUFXLENBQUMsRUFBRTtnQkFDdEMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtvQkFDdkIsTUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3JELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FDbEIsRUFBRSxDQUFDLDBCQUEwQixDQUN6QixFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFDeEQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDbkMsRUFBRSxDQUFDLENBQUM7cUJBQ1Q7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7aUJBQ25DO3FCQUFNLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7b0JBQzlCLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDL0QsS0FBSyxNQUFNLFdBQVcsSUFBSSxhQUFhLEVBQUU7d0JBQ3ZDLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxFQUMzRCxFQUFFLENBQUMsQ0FBQztxQkFDVDtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQztpQkFDbkM7YUFDRjtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtwYXJzZSBhcyBwYXJzZVN0eWxlfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3ZpZXcvc3R5bGVfcGFyc2VyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFBhcnNlcyBleHRyYWN0ZWQgc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXMgaW50byBzZXBhcmF0ZSBFeHRyYWN0ZWRBdHRyaWJ1dGVPcHMgcGVyIHN0eWxlIG9yXG4gKiBjbGFzcyBwcm9wZXJ0eS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXh0cmFjdGVkU3R5bGVzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlICYmIG9wLmJpbmRpbmdLaW5kID09PSBpci5CaW5kaW5nS2luZC5BdHRyaWJ1dGUgJiZcbiAgICAgICAgICBpci5pc1N0cmluZ0xpdGVyYWwob3AuZXhwcmVzc2lvbiEpKSB7XG4gICAgICAgIGlmIChvcC5uYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkU3R5bGVzID0gcGFyc2VTdHlsZShvcC5leHByZXNzaW9uLnZhbHVlKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnNlZFN0eWxlcy5sZW5ndGggLSAxOyBpICs9IDIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHksIHBhcnNlZFN0eWxlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKHBhcnNlZFN0eWxlc1tpICsgMV0pKSxcbiAgICAgICAgICAgICAgICBvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcC5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkQ2xhc3NlcyA9IG9wLmV4cHJlc3Npb24udmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgICAgIGZvciAoY29uc3QgcGFyc2VkQ2xhc3Mgb2YgcGFyc2VkQ2xhc3Nlcykge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuQ2xhc3NOYW1lLCBwYXJzZWRDbGFzcywgbnVsbCksXG4gICAgICAgICAgICAgICAgb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==