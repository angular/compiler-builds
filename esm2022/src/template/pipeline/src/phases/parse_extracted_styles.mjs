/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../../core';
import * as o from '../../../../output/output_ast';
import { parse as parseStyle } from '../../../../render3/view/style_parser';
import * as ir from '../../ir';
/**
 * Parses extracted style and class attributes into separate ExtractedAttributeOps per style or
 * class property.
 */
export function parseExtractedStyles(job) {
    const elements = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (ir.isElementOrContainerOp(op)) {
                elements.set(op.xref, op);
            }
        }
    }
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedAttribute && op.bindingKind === ir.BindingKind.Attribute &&
                ir.isStringLiteral(op.expression)) {
                const target = elements.get(op.target);
                if (target !== undefined && target.kind === ir.OpKind.Template &&
                    target.templateKind === ir.TemplateKind.Structural) {
                    // TemplateDefinitionBuilder will not apply class and style bindings to structural
                    // directives; instead, it will leave them as attributes.
                    // (It's not clear what that would mean, anyway -- classes and styles on a structural
                    // element should probably be a parse error.)
                    // TODO: We may be able to remove this once Template Pipeline is the default.
                    continue;
                }
                if (op.name === 'style') {
                    const parsedStyles = parseStyle(op.expression.value);
                    for (let i = 0; i < parsedStyles.length - 1; i += 2) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.StyleProperty, null, parsedStyles[i], o.literal(parsedStyles[i + 1]), null, null, SecurityContext.STYLE), op);
                    }
                    ir.OpList.remove(op);
                }
                else if (op.name === 'class') {
                    const parsedClasses = op.expression.value.trim().split(/\s+/g);
                    for (const parsedClass of parsedClasses) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.ClassName, null, parsedClass, null, null, null, SecurityContext.NONE), op);
                    }
                    ir.OpList.remove(op);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfZXh0cmFjdGVkX3N0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BhcnNlX2V4dHJhY3RlZF9zdHlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUMxRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7SUFFbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDakMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzNCO1NBQ0Y7S0FDRjtJQUVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVM7Z0JBQ3ZGLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLFVBQVcsQ0FBQyxFQUFFO2dCQUN0QyxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztnQkFFeEMsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUMxRCxNQUFNLENBQUMsWUFBWSxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFO29CQUN0RCxrRkFBa0Y7b0JBQ2xGLHlEQUF5RDtvQkFDekQscUZBQXFGO29CQUNyRiw2Q0FBNkM7b0JBQzdDLDZFQUE2RTtvQkFDN0UsU0FBUztpQkFDVjtnQkFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO29CQUN2QixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDckQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ25ELEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFDOUQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQ3RFLEVBQUUsQ0FBQyxDQUFDO3FCQUNUO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO2lCQUNuQztxQkFBTSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO29CQUM5QixNQUFNLGFBQWEsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQy9ELEtBQUssTUFBTSxXQUFXLElBQUksYUFBYSxFQUFFO3dCQUN2QyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FDbEIsRUFBRSxDQUFDLDBCQUEwQixDQUN6QixFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3hFLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFDekIsRUFBRSxDQUFDLENBQUM7cUJBQ1Q7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7aUJBQ25DO2FBQ0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7cGFyc2UgYXMgcGFyc2VTdHlsZX0gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy92aWV3L3N0eWxlX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5cbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFBhcnNlcyBleHRyYWN0ZWQgc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXMgaW50byBzZXBhcmF0ZSBFeHRyYWN0ZWRBdHRyaWJ1dGVPcHMgcGVyIHN0eWxlIG9yXG4gKiBjbGFzcyBwcm9wZXJ0eS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXh0cmFjdGVkU3R5bGVzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuQ3JlYXRlT3A+KCk7XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgICBlbGVtZW50cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSAmJiBvcC5iaW5kaW5nS2luZCA9PT0gaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlICYmXG4gICAgICAgICAgaXIuaXNTdHJpbmdMaXRlcmFsKG9wLmV4cHJlc3Npb24hKSkge1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBlbGVtZW50cy5nZXQob3AudGFyZ2V0KSE7XG5cbiAgICAgICAgaWYgKHRhcmdldCAhPT0gdW5kZWZpbmVkICYmIHRhcmdldC5raW5kID09PSBpci5PcEtpbmQuVGVtcGxhdGUgJiZcbiAgICAgICAgICAgIHRhcmdldC50ZW1wbGF0ZUtpbmQgPT09IGlyLlRlbXBsYXRlS2luZC5TdHJ1Y3R1cmFsKSB7XG4gICAgICAgICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciB3aWxsIG5vdCBhcHBseSBjbGFzcyBhbmQgc3R5bGUgYmluZGluZ3MgdG8gc3RydWN0dXJhbFxuICAgICAgICAgIC8vIGRpcmVjdGl2ZXM7IGluc3RlYWQsIGl0IHdpbGwgbGVhdmUgdGhlbSBhcyBhdHRyaWJ1dGVzLlxuICAgICAgICAgIC8vIChJdCdzIG5vdCBjbGVhciB3aGF0IHRoYXQgd291bGQgbWVhbiwgYW55d2F5IC0tIGNsYXNzZXMgYW5kIHN0eWxlcyBvbiBhIHN0cnVjdHVyYWxcbiAgICAgICAgICAvLyBlbGVtZW50IHNob3VsZCBwcm9iYWJseSBiZSBhIHBhcnNlIGVycm9yLilcbiAgICAgICAgICAvLyBUT0RPOiBXZSBtYXkgYmUgYWJsZSB0byByZW1vdmUgdGhpcyBvbmNlIFRlbXBsYXRlIFBpcGVsaW5lIGlzIHRoZSBkZWZhdWx0LlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wLm5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICBjb25zdCBwYXJzZWRTdHlsZXMgPSBwYXJzZVN0eWxlKG9wLmV4cHJlc3Npb24udmFsdWUpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyc2VkU3R5bGVzLmxlbmd0aCAtIDE7IGkgKz0gMikge1xuICAgICAgICAgICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZTxpci5DcmVhdGVPcD4oXG4gICAgICAgICAgICAgICAgaXIuY3JlYXRlRXh0cmFjdGVkQXR0cmlidXRlT3AoXG4gICAgICAgICAgICAgICAgICAgIG9wLnRhcmdldCwgaXIuQmluZGluZ0tpbmQuU3R5bGVQcm9wZXJ0eSwgbnVsbCwgcGFyc2VkU3R5bGVzW2ldLFxuICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWwocGFyc2VkU3R5bGVzW2kgKyAxXSksIG51bGwsIG51bGwsIFNlY3VyaXR5Q29udGV4dC5TVFlMRSksXG4gICAgICAgICAgICAgICAgb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3AubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICAgIGNvbnN0IHBhcnNlZENsYXNzZXMgPSBvcC5leHByZXNzaW9uLnZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHBhcnNlZENsYXNzIG9mIHBhcnNlZENsYXNzZXMpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLkNsYXNzTmFtZSwgbnVsbCwgcGFyc2VkQ2xhc3MsIG51bGwsIG51bGwsIG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFNlY3VyaXR5Q29udGV4dC5OT05FKSxcbiAgICAgICAgICAgICAgICBvcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19