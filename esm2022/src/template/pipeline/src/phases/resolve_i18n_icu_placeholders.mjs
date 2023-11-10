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
    visitTagPlaceholder(placeholder) {
        super.visitTagPlaceholder(placeholder);
        // Add the start and end source span for tag placeholders. These need to be recorded for
        // elements inside ICUs. The slots for the elements were recorded separately under the i18n
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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2ljdV9wbGFjZWhvbGRlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9yZXNvbHZlX2kxOG5faWN1X3BsYWNlaG9sZGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssSUFBSSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUFDLEdBQW1CO0lBQzVELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzFELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXO29CQUN4QixVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzVCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtvQkFDckIsSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLElBQUksRUFBRTt3QkFDdkIsTUFBTSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztxQkFDdEQ7b0JBQ0QsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFFLENBQUM7b0JBQ2hELEtBQUssTUFBTSxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7d0JBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO3FCQUNqRjtvQkFDRCxNQUFNO2FBQ1Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSw2QkFBOEIsU0FBUSxJQUFJLENBQUMsY0FBYztJQUM3RCxZQUE2QixNQUF3QztRQUNuRSxLQUFLLEVBQUUsQ0FBQztRQURtQixXQUFNLEdBQU4sTUFBTSxDQUFrQztJQUVyRSxDQUFDO0lBRVEsbUJBQW1CLENBQUMsV0FBZ0M7UUFDM0QsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXZDLHdGQUF3RjtRQUN4RiwyRkFBMkY7UUFDM0YseUVBQXlFO1FBQ3pFLElBQUksV0FBVyxDQUFDLFNBQVMsSUFBSSxXQUFXLENBQUMsZUFBZTtZQUNwRCxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ3RCLEtBQUssRUFBRSxXQUFXLENBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRTtvQkFDOUMsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJO2lCQUNuQyxDQUFDLENBQUMsQ0FBQztTQUNyQjtRQUNELElBQUksV0FBVyxDQUFDLFNBQVMsSUFBSSxXQUFXLENBQUMsYUFBYTtZQUNsRCxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ3RCLEtBQUssRUFBRSxXQUFXLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRTtvQkFDNUMsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsS0FBSyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJO2lCQUNuQyxDQUFDLENBQUMsQ0FBQztTQUNyQjtJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmVzIHBsYWNlaG9sZGVycyBmb3IgZWxlbWVudCB0YWdzIGluc2lkZSBvZiBhbiBJQ1UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkljdVBsYWNlaG9sZGVycyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGNvbnN0IGNvbnRleHRPcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBjb250ZXh0T3BzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VTdGFydDpcbiAgICAgICAgICBpZiAob3AuY29udGV4dCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0ljdSBzaG91bGQgaGF2ZSBpdHMgaTE4biBjb250ZXh0IHNldC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgaTE4bkNvbnRleHQgPSBjb250ZXh0T3BzLmdldChvcC5jb250ZXh0KSE7XG4gICAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIG9wLm1lc3NhZ2Uubm9kZXMpIHtcbiAgICAgICAgICAgIG5vZGUudmlzaXQobmV3IFJlc29sdmVJY3VQbGFjZWhvbGRlcnNWaXNpdG9yKGkxOG5Db250ZXh0LnBvc3Rwcm9jZXNzaW5nUGFyYW1zKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFZpc2l0b3IgZm9yIGkxOG4gQVNUIHRoYXQgcmVzb2x2ZXMgSUNVIHBhcmFtcyBpbnRvIHRoZSBnaXZlbiBtYXAuXG4gKi9cbmNsYXNzIFJlc29sdmVJY3VQbGFjZWhvbGRlcnNWaXNpdG9yIGV4dGVuZHMgaTE4bi5SZWN1cnNlVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcGFyYW1zOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBsYWNlaG9sZGVyOiBpMThuLlRhZ1BsYWNlaG9sZGVyKSB7XG4gICAgc3VwZXIudmlzaXRUYWdQbGFjZWhvbGRlcihwbGFjZWhvbGRlcik7XG5cbiAgICAvLyBBZGQgdGhlIHN0YXJ0IGFuZCBlbmQgc291cmNlIHNwYW4gZm9yIHRhZyBwbGFjZWhvbGRlcnMuIFRoZXNlIG5lZWQgdG8gYmUgcmVjb3JkZWQgZm9yXG4gICAgLy8gZWxlbWVudHMgaW5zaWRlIElDVXMuIFRoZSBzbG90cyBmb3IgdGhlIGVsZW1lbnRzIHdlcmUgcmVjb3JkZWQgc2VwYXJhdGVseSB1bmRlciB0aGUgaTE4blxuICAgIC8vIGJsb2NrJ3MgY29udGV4dCBhcyBwYXJ0IG9mIHRoZSBgcmVzb2x2ZUkxOG5FbGVtZW50UGxhY2Vob2xkZXJzYCBwaGFzZS5cbiAgICBpZiAocGxhY2Vob2xkZXIuc3RhcnROYW1lICYmIHBsYWNlaG9sZGVyLnN0YXJ0U291cmNlU3BhbiAmJlxuICAgICAgICAhdGhpcy5wYXJhbXMuaGFzKHBsYWNlaG9sZGVyLnN0YXJ0TmFtZSkpIHtcbiAgICAgIHRoaXMucGFyYW1zLnNldChwbGFjZWhvbGRlci5zdGFydE5hbWUsIFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGxhY2Vob2xkZXIuc3RhcnRTb3VyY2VTcGFuPy50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZsYWdzOiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmVcbiAgICAgICAgICAgICAgICAgICAgICB9XSk7XG4gICAgfVxuICAgIGlmIChwbGFjZWhvbGRlci5jbG9zZU5hbWUgJiYgcGxhY2Vob2xkZXIuZW5kU291cmNlU3BhbiAmJlxuICAgICAgICAhdGhpcy5wYXJhbXMuaGFzKHBsYWNlaG9sZGVyLmNsb3NlTmFtZSkpIHtcbiAgICAgIHRoaXMucGFyYW1zLnNldChwbGFjZWhvbGRlci5jbG9zZU5hbWUsIFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGxhY2Vob2xkZXIuZW5kU291cmNlU3Bhbj8udG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXg6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmbGFnczogaXIuSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lXG4gICAgICAgICAgICAgICAgICAgICAgfV0pO1xuICAgIH1cbiAgfVxufVxuIl19