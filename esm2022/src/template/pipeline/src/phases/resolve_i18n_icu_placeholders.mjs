/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../../i18n/i18n_ast';
import * as ir from '../../ir';
/**
 * Resolves placeholders for element tags inside of an ICU.
 */
export function resolveI18nIcuPlaceholders(job) {
    const contextOps = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nContext:
                    contextOps.set(op.xref, op);
                    break;
            }
        }
    }
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.IcuStart:
                    if (op.context === null) {
                        throw Error('Icu should have its i18n context set.');
                    }
                    const i18nContext = contextOps.get(op.context);
                    for (const node of op.message.nodes) {
                        node.visit(new ResolveIcuPlaceholdersVisitor(i18nContext.postprocessingParams));
                    }
                    break;
            }
        }
    }
}
/**
 * Visitor for i18n AST that resolves ICU params into the given map.
 */
class ResolveIcuPlaceholdersVisitor extends i18n.RecurseVisitor {
    constructor(params) {
        super();
        this.params = params;
    }
    visitContainerPlaceholder(placeholder) {
        // Add the start and end source span for container placeholders. These need to be recorded for
        // elements inside ICUs. The slots for the nodes were recorded separately under the i18n
        // block's context as part of the `resolveI18nElementPlaceholders` phase.
        if (placeholder.startName && placeholder.startSourceSpan &&
            !this.params.has(placeholder.startName)) {
            this.params.set(placeholder.startName, [{
                    value: placeholder.startSourceSpan?.toString(),
                    subTemplateIndex: null,
                    flags: ir.I18nParamValueFlags.None
                }]);
        }
        if (placeholder.closeName && placeholder.endSourceSpan &&
            !this.params.has(placeholder.closeName)) {
            this.params.set(placeholder.closeName, [{
                    value: placeholder.endSourceSpan?.toString(),
                    subTemplateIndex: null,
                    flags: ir.I18nParamValueFlags.None
                }]);
        }
    }
    visitTagPlaceholder(placeholder) {
        super.visitTagPlaceholder(placeholder);
        this.visitContainerPlaceholder(placeholder);
    }
    visitBlockPlaceholder(placeholder) {
        super.visitBlockPlaceholder(placeholder);
        this.visitContainerPlaceholder(placeholder);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2ljdV9wbGFjZWhvbGRlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZXNvbHZlX2kxOG5faWN1X3BsYWNlaG9sZGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssSUFBSSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUFDLEdBQW1CO0lBQzVELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzFELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXO29CQUN4QixVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzVCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtvQkFDckIsSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLElBQUksRUFBRTt3QkFDdkIsTUFBTSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztxQkFDdEQ7b0JBQ0QsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFFLENBQUM7b0JBQ2hELEtBQUssTUFBTSxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7d0JBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO3FCQUNqRjtvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSw2QkFBOEIsU0FBUSxJQUFJLENBQUMsY0FBYztJQUM3RCxZQUE2QixNQUF3QztRQUNuRSxLQUFLLEVBQUUsQ0FBQztRQURtQixXQUFNLEdBQU4sTUFBTSxDQUFrQztJQUVyRSxDQUFDO0lBRU8seUJBQXlCLENBQUMsV0FBc0Q7UUFDdEYsOEZBQThGO1FBQzlGLHdGQUF3RjtRQUN4Rix5RUFBeUU7UUFDekUsSUFBSSxXQUFXLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxlQUFlO1lBQ3BELENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQzNDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDdEIsS0FBSyxFQUFFLFdBQVcsQ0FBQyxlQUFlLEVBQUUsUUFBUSxFQUFFO29CQUM5QyxnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixLQUFLLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUk7aUJBQ25DLENBQUMsQ0FBQyxDQUFDO1NBQ3JCO1FBQ0QsSUFBSSxXQUFXLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxhQUFhO1lBQ2xELENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQzNDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDdEIsS0FBSyxFQUFFLFdBQVcsQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFO29CQUM1QyxnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixLQUFLLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUk7aUJBQ25DLENBQUMsQ0FBQyxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQztJQUVRLG1CQUFtQixDQUFDLFdBQWdDO1FBQzNELEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMseUJBQXlCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVRLHFCQUFxQixDQUFDLFdBQWtDO1FBQy9ELEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMseUJBQXlCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZXMgcGxhY2Vob2xkZXJzIGZvciBlbGVtZW50IHRhZ3MgaW5zaWRlIG9mIGFuIElDVS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuSWN1UGxhY2Vob2xkZXJzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgY29udGV4dE9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGNvbnRleHRPcHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVN0YXJ0OlxuICAgICAgICAgIGlmIChvcC5jb250ZXh0ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignSWN1IHNob3VsZCBoYXZlIGl0cyBpMThuIGNvbnRleHQgc2V0LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBpMThuQ29udGV4dCA9IGNvbnRleHRPcHMuZ2V0KG9wLmNvbnRleHQpITtcbiAgICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygb3AubWVzc2FnZS5ub2Rlcykge1xuICAgICAgICAgICAgbm9kZS52aXNpdChuZXcgUmVzb2x2ZUljdVBsYWNlaG9sZGVyc1Zpc2l0b3IoaTE4bkNvbnRleHQucG9zdHByb2Nlc3NpbmdQYXJhbXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVmlzaXRvciBmb3IgaTE4biBBU1QgdGhhdCByZXNvbHZlcyBJQ1UgcGFyYW1zIGludG8gdGhlIGdpdmVuIG1hcC5cbiAqL1xuY2xhc3MgUmVzb2x2ZUljdVBsYWNlaG9sZGVyc1Zpc2l0b3IgZXh0ZW5kcyBpMThuLlJlY3Vyc2VWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRDb250YWluZXJQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogaTE4bi5UYWdQbGFjZWhvbGRlcnxpMThuLkJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICAvLyBBZGQgdGhlIHN0YXJ0IGFuZCBlbmQgc291cmNlIHNwYW4gZm9yIGNvbnRhaW5lciBwbGFjZWhvbGRlcnMuIFRoZXNlIG5lZWQgdG8gYmUgcmVjb3JkZWQgZm9yXG4gICAgLy8gZWxlbWVudHMgaW5zaWRlIElDVXMuIFRoZSBzbG90cyBmb3IgdGhlIG5vZGVzIHdlcmUgcmVjb3JkZWQgc2VwYXJhdGVseSB1bmRlciB0aGUgaTE4blxuICAgIC8vIGJsb2NrJ3MgY29udGV4dCBhcyBwYXJ0IG9mIHRoZSBgcmVzb2x2ZUkxOG5FbGVtZW50UGxhY2Vob2xkZXJzYCBwaGFzZS5cbiAgICBpZiAocGxhY2Vob2xkZXIuc3RhcnROYW1lICYmIHBsYWNlaG9sZGVyLnN0YXJ0U291cmNlU3BhbiAmJlxuICAgICAgICAhdGhpcy5wYXJhbXMuaGFzKHBsYWNlaG9sZGVyLnN0YXJ0TmFtZSkpIHtcbiAgICAgIHRoaXMucGFyYW1zLnNldChwbGFjZWhvbGRlci5zdGFydE5hbWUsIFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGxhY2Vob2xkZXIuc3RhcnRTb3VyY2VTcGFuPy50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZsYWdzOiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmVcbiAgICAgICAgICAgICAgICAgICAgICB9XSk7XG4gICAgfVxuICAgIGlmIChwbGFjZWhvbGRlci5jbG9zZU5hbWUgJiYgcGxhY2Vob2xkZXIuZW5kU291cmNlU3BhbiAmJlxuICAgICAgICAhdGhpcy5wYXJhbXMuaGFzKHBsYWNlaG9sZGVyLmNsb3NlTmFtZSkpIHtcbiAgICAgIHRoaXMucGFyYW1zLnNldChwbGFjZWhvbGRlci5jbG9zZU5hbWUsIFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGxhY2Vob2xkZXIuZW5kU291cmNlU3Bhbj8udG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXg6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmbGFnczogaXIuSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lXG4gICAgICAgICAgICAgICAgICAgICAgfV0pO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0VGFnUGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IGkxOG4uVGFnUGxhY2Vob2xkZXIpIHtcbiAgICBzdXBlci52aXNpdFRhZ1BsYWNlaG9sZGVyKHBsYWNlaG9sZGVyKTtcbiAgICB0aGlzLnZpc2l0Q29udGFpbmVyUGxhY2Vob2xkZXIocGxhY2Vob2xkZXIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRCbG9ja1BsYWNlaG9sZGVyKHBsYWNlaG9sZGVyOiBpMThuLkJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICBzdXBlci52aXNpdEJsb2NrUGxhY2Vob2xkZXIocGxhY2Vob2xkZXIpO1xuICAgIHRoaXMudmlzaXRDb250YWluZXJQbGFjZWhvbGRlcihwbGFjZWhvbGRlcik7XG4gIH1cbn1cbiJdfQ==