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
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.StyleProperty, parsedStyles[i], o.literal(parsedStyles[i + 1]), null, null, SecurityContext.STYLE), op);
                    }
                    ir.OpList.remove(op);
                }
                else if (op.name === 'class') {
                    const parsedClasses = op.expression.value.trim().split(/\s+/g);
                    for (const parsedClass of parsedClasses) {
                        ir.OpList.insertBefore(ir.createExtractedAttributeOp(op.target, ir.BindingKind.ClassName, parsedClass, null, null, null, SecurityContext.NONE), op);
                    }
                    ir.OpList.remove(op);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VfZXh0cmFjdGVkX3N0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3BhcnNlX2V4dHJhY3RlZF9zdHlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxFQUFDLEtBQUssSUFBSSxVQUFVLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUMxRSxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUkvQjs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsR0FBbUI7SUFDdEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7SUFFbkQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDakMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQzNCO1NBQ0Y7S0FDRjtJQUVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVM7Z0JBQ3ZGLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLFVBQVcsQ0FBQyxFQUFFO2dCQUN0QyxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztnQkFFeEMsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO29CQUMxRCxNQUFNLENBQUMsWUFBWSxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFO29CQUN0RCxrRkFBa0Y7b0JBQ2xGLHlEQUF5RDtvQkFDekQscUZBQXFGO29CQUNyRiw2Q0FBNkM7b0JBQzdDLDZFQUE2RTtvQkFDN0UsU0FBUztpQkFDVjtnQkFFRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO29CQUN2QixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDckQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ25ELEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUN4RCxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGVBQWUsQ0FBQyxLQUFLLENBQUMsRUFDdEUsRUFBRSxDQUFDLENBQUM7cUJBQ1Q7b0JBQ0QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWMsRUFBRSxDQUFDLENBQUM7aUJBQ25DO3FCQUFNLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7b0JBQzlCLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDL0QsS0FBSyxNQUFNLFdBQVcsSUFBSSxhQUFhLEVBQUU7d0JBQ3ZDLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsMEJBQTBCLENBQ3pCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUNsRSxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQ3pCLEVBQUUsQ0FBQyxDQUFDO3FCQUNUO29CQUNELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFjLEVBQUUsQ0FBQyxDQUFDO2lCQUNuQzthQUNGO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3BhcnNlIGFzIHBhcnNlU3R5bGV9IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvdmlldy9zdHlsZV9wYXJzZXInO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuXG5pbXBvcnQgdHlwZSB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBQYXJzZXMgZXh0cmFjdGVkIHN0eWxlIGFuZCBjbGFzcyBhdHRyaWJ1dGVzIGludG8gc2VwYXJhdGUgRXh0cmFjdGVkQXR0cmlidXRlT3BzIHBlciBzdHlsZSBvclxuICogY2xhc3MgcHJvcGVydHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUV4dHJhY3RlZFN0eWxlcyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGNvbnN0IGVsZW1lbnRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkNyZWF0ZU9wPigpO1xuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAoaXIuaXNFbGVtZW50T3JDb250YWluZXJPcChvcCkpIHtcbiAgICAgICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGUgJiYgb3AuYmluZGluZ0tpbmQgPT09IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSAmJlxuICAgICAgICAgIGlyLmlzU3RyaW5nTGl0ZXJhbChvcC5leHByZXNzaW9uISkpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gZWxlbWVudHMuZ2V0KG9wLnRhcmdldCkhO1xuXG4gICAgICAgIGlmICh0YXJnZXQgIT09IHVuZGVmaW5lZCAmJiB0YXJnZXQua2luZCA9PT0gaXIuT3BLaW5kLlRlbXBsYXRlICYmXG4gICAgICAgICAgICB0YXJnZXQudGVtcGxhdGVLaW5kID09PSBpci5UZW1wbGF0ZUtpbmQuU3RydWN0dXJhbCkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgd2lsbCBub3QgYXBwbHkgY2xhc3MgYW5kIHN0eWxlIGJpbmRpbmdzIHRvIHN0cnVjdHVyYWxcbiAgICAgICAgICAvLyBkaXJlY3RpdmVzOyBpbnN0ZWFkLCBpdCB3aWxsIGxlYXZlIHRoZW0gYXMgYXR0cmlidXRlcy5cbiAgICAgICAgICAvLyAoSXQncyBub3QgY2xlYXIgd2hhdCB0aGF0IHdvdWxkIG1lYW4sIGFueXdheSAtLSBjbGFzc2VzIGFuZCBzdHlsZXMgb24gYSBzdHJ1Y3R1cmFsXG4gICAgICAgICAgLy8gZWxlbWVudCBzaG91bGQgcHJvYmFibHkgYmUgYSBwYXJzZSBlcnJvci4pXG4gICAgICAgICAgLy8gVE9ETzogV2UgbWF5IGJlIGFibGUgdG8gcmVtb3ZlIHRoaXMgb25jZSBUZW1wbGF0ZSBQaXBlbGluZSBpcyB0aGUgZGVmYXVsdC5cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcC5uYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkU3R5bGVzID0gcGFyc2VTdHlsZShvcC5leHByZXNzaW9uLnZhbHVlKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnNlZFN0eWxlcy5sZW5ndGggLSAxOyBpICs9IDIpIHtcbiAgICAgICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuQ3JlYXRlT3A+KFxuICAgICAgICAgICAgICAgIGlyLmNyZWF0ZUV4dHJhY3RlZEF0dHJpYnV0ZU9wKFxuICAgICAgICAgICAgICAgICAgICBvcC50YXJnZXQsIGlyLkJpbmRpbmdLaW5kLlN0eWxlUHJvcGVydHksIHBhcnNlZFN0eWxlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKHBhcnNlZFN0eWxlc1tpICsgMV0pLCBudWxsLCBudWxsLCBTZWN1cml0eUNvbnRleHQuU1RZTEUpLFxuICAgICAgICAgICAgICAgIG9wKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICB9IGVsc2UgaWYgKG9wLm5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgICBjb25zdCBwYXJzZWRDbGFzc2VzID0gb3AuZXhwcmVzc2lvbi52YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJzZWRDbGFzcyBvZiBwYXJzZWRDbGFzc2VzKSB7XG4gICAgICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihcbiAgICAgICAgICAgICAgICBpci5jcmVhdGVFeHRyYWN0ZWRBdHRyaWJ1dGVPcChcbiAgICAgICAgICAgICAgICAgICAgb3AudGFyZ2V0LCBpci5CaW5kaW5nS2luZC5DbGFzc05hbWUsIHBhcnNlZENsYXNzLCBudWxsLCBudWxsLCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBTZWN1cml0eUNvbnRleHQuTk9ORSksXG4gICAgICAgICAgICAgICAgb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==