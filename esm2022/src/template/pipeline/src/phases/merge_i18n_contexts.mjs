/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Merge i18n contexts for child i18n blocks into their ancestor root contexts.
 */
export function mergeI18nContexts(job) {
    // Record all of the i18n and extracted message ops for use later.
    const i18nOps = new Map();
    const i18nContexts = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    if (!op.context) {
                        throw Error('I18n op should have its context set.');
                    }
                    i18nOps.set(op.xref, op);
                    break;
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
            }
        }
    }
    // For each non-root i18n op, merge its context into the root i18n op's context.
    for (const childI18nOp of i18nOps.values()) {
        if (childI18nOp.xref !== childI18nOp.root) {
            const childContext = i18nContexts.get(childI18nOp.context);
            const rootI18nOp = i18nOps.get(childI18nOp.root);
            const rootContext = i18nContexts.get(rootI18nOp.context);
            mergeParams(rootContext.params, childContext.params);
            mergeParams(rootContext.postprocessingParams, childContext.postprocessingParams);
        }
    }
}
/**
 * Merges the params in the `from` map to into the `to` map.
 */
function mergeParams(to, from) {
    for (const [placeholder, fromValues] of from) {
        const toValues = to.get(placeholder) || [];
        // TODO(mmalerba): Child element close tag params should be prepended to maintain the same order
        // as TemplateDefinitionBuilder. Can be cleaned up when compatibility is no longer required.
        const flags = fromValues[0].flags;
        if ((flags & ir.I18nParamValueFlags.CloseTag) && !(flags & ir.I18nParamValueFlags.OpenTag)) {
            to.set(placeholder, [...fromValues, ...toValues]);
        }
        else {
            to.set(placeholder, [...toValues, ...fromValues]);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2VfaTE4bl9jb250ZXh0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL21lcmdlX2kxOG5fY29udGV4dHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsa0VBQWtFO0lBQ2xFLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO0lBQ3JELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRTt3QkFDZixNQUFNLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO3FCQUNyRDtvQkFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTthQUNUO1NBQ0Y7S0FDRjtJQUVELGdGQUFnRjtJQUNoRixLQUFLLE1BQU0sV0FBVyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUMxQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLElBQUksRUFBRTtZQUN6QyxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFRLENBQUUsQ0FBQztZQUM3RCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUUsQ0FBQztZQUNsRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFRLENBQUUsQ0FBQztZQUMzRCxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckQsV0FBVyxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsRUFBRSxZQUFZLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUNsRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxXQUFXLENBQUMsRUFBb0MsRUFBRSxJQUFzQztJQUMvRixLQUFLLE1BQU0sQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLElBQUksSUFBSSxFQUFFO1FBQzVDLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzNDLGdHQUFnRztRQUNoRyw0RkFBNEY7UUFDNUYsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQztRQUNuQyxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMxRixFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUNuRDthQUFNO1lBQ0wsRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLFFBQVEsRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUM7U0FDbkQ7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIE1lcmdlIGkxOG4gY29udGV4dHMgZm9yIGNoaWxkIGkxOG4gYmxvY2tzIGludG8gdGhlaXIgYW5jZXN0b3Igcm9vdCBjb250ZXh0cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlSTE4bkNvbnRleHRzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgaTE4biBhbmQgZXh0cmFjdGVkIG1lc3NhZ2Ugb3BzIGZvciB1c2UgbGF0ZXIuXG4gIGNvbnN0IGkxOG5PcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4blN0YXJ0T3A+KCk7XG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBpZiAoIW9wLmNvbnRleHQpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdJMThuIG9wIHNob3VsZCBoYXZlIGl0cyBjb250ZXh0IHNldC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaTE4bk9wcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBGb3IgZWFjaCBub24tcm9vdCBpMThuIG9wLCBtZXJnZSBpdHMgY29udGV4dCBpbnRvIHRoZSByb290IGkxOG4gb3AncyBjb250ZXh0LlxuICBmb3IgKGNvbnN0IGNoaWxkSTE4bk9wIG9mIGkxOG5PcHMudmFsdWVzKCkpIHtcbiAgICBpZiAoY2hpbGRJMThuT3AueHJlZiAhPT0gY2hpbGRJMThuT3Aucm9vdCkge1xuICAgICAgY29uc3QgY2hpbGRDb250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChjaGlsZEkxOG5PcC5jb250ZXh0ISkhO1xuICAgICAgY29uc3Qgcm9vdEkxOG5PcCA9IGkxOG5PcHMuZ2V0KGNoaWxkSTE4bk9wLnJvb3QpITtcbiAgICAgIGNvbnN0IHJvb3RDb250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChyb290STE4bk9wLmNvbnRleHQhKSE7XG4gICAgICBtZXJnZVBhcmFtcyhyb290Q29udGV4dC5wYXJhbXMsIGNoaWxkQ29udGV4dC5wYXJhbXMpO1xuICAgICAgbWVyZ2VQYXJhbXMocm9vdENvbnRleHQucG9zdHByb2Nlc3NpbmdQYXJhbXMsIGNoaWxkQ29udGV4dC5wb3N0cHJvY2Vzc2luZ1BhcmFtcyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWVyZ2VzIHRoZSBwYXJhbXMgaW4gdGhlIGBmcm9tYCBtYXAgdG8gaW50byB0aGUgYHRvYCBtYXAuXG4gKi9cbmZ1bmN0aW9uIG1lcmdlUGFyYW1zKHRvOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPiwgZnJvbTogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4pIHtcbiAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIGZyb21WYWx1ZXNdIG9mIGZyb20pIHtcbiAgICBjb25zdCB0b1ZhbHVlcyA9IHRvLmdldChwbGFjZWhvbGRlcikgfHwgW107XG4gICAgLy8gVE9ETyhtbWFsZXJiYSk6IENoaWxkIGVsZW1lbnQgY2xvc2UgdGFnIHBhcmFtcyBzaG91bGQgYmUgcHJlcGVuZGVkIHRvIG1haW50YWluIHRoZSBzYW1lIG9yZGVyXG4gICAgLy8gYXMgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci4gQ2FuIGJlIGNsZWFuZWQgdXAgd2hlbiBjb21wYXRpYmlsaXR5IGlzIG5vIGxvbmdlciByZXF1aXJlZC5cbiAgICBjb25zdCBmbGFncyA9IGZyb21WYWx1ZXNbMF0hLmZsYWdzO1xuICAgIGlmICgoZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSAmJiAhKGZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSkge1xuICAgICAgdG8uc2V0KHBsYWNlaG9sZGVyLCBbLi4uZnJvbVZhbHVlcywgLi4udG9WYWx1ZXNdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG8uc2V0KHBsYWNlaG9sZGVyLCBbLi4udG9WYWx1ZXMsIC4uLmZyb21WYWx1ZXNdKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==