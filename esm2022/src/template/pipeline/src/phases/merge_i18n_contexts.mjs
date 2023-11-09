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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2VfaTE4bl9jb250ZXh0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL21lcmdlX2kxOG5fY29udGV4dHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsa0VBQWtFO0lBQ2xFLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO0lBQ3JELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzdCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDaEIsTUFBTSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztvQkFDdEQsQ0FBQztvQkFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtZQUNWLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELGdGQUFnRjtJQUNoRixLQUFLLE1BQU0sV0FBVyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQzNDLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDMUMsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBUSxDQUFFLENBQUM7WUFDN0QsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDbEQsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBUSxDQUFFLENBQUM7WUFDM0QsV0FBVyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JELFdBQVcsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLEVBQUUsWUFBWSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDbkYsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FBQyxFQUFvQyxFQUFFLElBQXNDO0lBQy9GLEtBQUssTUFBTSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUM3QyxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMzQyxnR0FBZ0c7UUFDaEcsNEZBQTRGO1FBQzVGLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUM7UUFDbkMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUMzRixFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNwRCxDQUFDO2FBQU0sQ0FBQztZQUNOLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxRQUFRLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ3BELENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogTWVyZ2UgaTE4biBjb250ZXh0cyBmb3IgY2hpbGQgaTE4biBibG9ja3MgaW50byB0aGVpciBhbmNlc3RvciByb290IGNvbnRleHRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VJMThuQ29udGV4dHMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBpMThuIGFuZCBleHRyYWN0ZWQgbWVzc2FnZSBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bk9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmICghb3AuY29udGV4dCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0kxOG4gb3Agc2hvdWxkIGhhdmUgaXRzIGNvbnRleHQgc2V0LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpMThuT3BzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEZvciBlYWNoIG5vbi1yb290IGkxOG4gb3AsIG1lcmdlIGl0cyBjb250ZXh0IGludG8gdGhlIHJvb3QgaTE4biBvcCdzIGNvbnRleHQuXG4gIGZvciAoY29uc3QgY2hpbGRJMThuT3Agb2YgaTE4bk9wcy52YWx1ZXMoKSkge1xuICAgIGlmIChjaGlsZEkxOG5PcC54cmVmICE9PSBjaGlsZEkxOG5PcC5yb290KSB7XG4gICAgICBjb25zdCBjaGlsZENvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KGNoaWxkSTE4bk9wLmNvbnRleHQhKSE7XG4gICAgICBjb25zdCByb290STE4bk9wID0gaTE4bk9wcy5nZXQoY2hpbGRJMThuT3Aucm9vdCkhO1xuICAgICAgY29uc3Qgcm9vdENvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KHJvb3RJMThuT3AuY29udGV4dCEpITtcbiAgICAgIG1lcmdlUGFyYW1zKHJvb3RDb250ZXh0LnBhcmFtcywgY2hpbGRDb250ZXh0LnBhcmFtcyk7XG4gICAgICBtZXJnZVBhcmFtcyhyb290Q29udGV4dC5wb3N0cHJvY2Vzc2luZ1BhcmFtcywgY2hpbGRDb250ZXh0LnBvc3Rwcm9jZXNzaW5nUGFyYW1zKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBNZXJnZXMgdGhlIHBhcmFtcyBpbiB0aGUgYGZyb21gIG1hcCB0byBpbnRvIHRoZSBgdG9gIG1hcC5cbiAqL1xuZnVuY3Rpb24gbWVyZ2VQYXJhbXModG86IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBmcm9tOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPikge1xuICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgZnJvbVZhbHVlc10gb2YgZnJvbSkge1xuICAgIGNvbnN0IHRvVmFsdWVzID0gdG8uZ2V0KHBsYWNlaG9sZGVyKSB8fCBbXTtcbiAgICAvLyBUT0RPKG1tYWxlcmJhKTogQ2hpbGQgZWxlbWVudCBjbG9zZSB0YWcgcGFyYW1zIHNob3VsZCBiZSBwcmVwZW5kZWQgdG8gbWFpbnRhaW4gdGhlIHNhbWUgb3JkZXJcbiAgICAvLyBhcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLiBDYW4gYmUgY2xlYW5lZCB1cCB3aGVuIGNvbXBhdGliaWxpdHkgaXMgbm8gbG9uZ2VyIHJlcXVpcmVkLlxuICAgIGNvbnN0IGZsYWdzID0gZnJvbVZhbHVlc1swXSEuZmxhZ3M7XG4gICAgaWYgKChmbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpICYmICEoZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpKSB7XG4gICAgICB0by5zZXQocGxhY2Vob2xkZXIsIFsuLi5mcm9tVmFsdWVzLCAuLi50b1ZhbHVlc10pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0by5zZXQocGxhY2Vob2xkZXIsIFsuLi50b1ZhbHVlcywgLi4uZnJvbVZhbHVlc10pO1xuICAgIH1cbiAgfVxufVxuIl19