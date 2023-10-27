/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Propagate extractd message placeholders up to their root extracted message op.
 */
export function phasePropagateI18nPlaceholders(job) {
    // Record all of the i18n and extracted message ops for use later.
    const i18nOps = new Map();
    const extractedMessageOps = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    i18nOps.set(op.xref, op);
                    break;
                case ir.OpKind.ExtractedMessage:
                    extractedMessageOps.set(op.owner, op);
                    break;
            }
        }
    }
    // For each non-root message, merge its params into the root message's params.
    for (const [xref, childExtractedMessageOp] of extractedMessageOps) {
        if (!childExtractedMessageOp.isRoot) {
            const i18nOp = i18nOps.get(xref);
            if (i18nOp === undefined) {
                throw Error('Could not find owner i18n block for extracted message.');
            }
            const rootExtractedMessageOp = extractedMessageOps.get(i18nOp.root);
            if (rootExtractedMessageOp === undefined) {
                throw Error('Could not find extracted message op for root i18n block.');
            }
            mergeParams(rootExtractedMessageOp.params, childExtractedMessageOp.params);
            mergeParams(rootExtractedMessageOp.postprocessingParams, childExtractedMessageOp.postprocessingParams);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGtFQUFrRTtJQUNsRSxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztJQUNyRCxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQjtvQkFDN0IsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3RDLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLHVCQUF1QixDQUFDLElBQUksbUJBQW1CLEVBQUU7UUFDakUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRTtZQUNuQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDeEIsTUFBTSxLQUFLLENBQUMsd0RBQXdELENBQUMsQ0FBQzthQUN2RTtZQUNELE1BQU0sc0JBQXNCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRSxJQUFJLHNCQUFzQixLQUFLLFNBQVMsRUFBRTtnQkFDeEMsTUFBTSxLQUFLLENBQUMsMERBQTBELENBQUMsQ0FBQzthQUN6RTtZQUNELFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0UsV0FBVyxDQUNQLHNCQUFzQixDQUFDLG9CQUFvQixFQUMzQyx1QkFBdUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ25EO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FBQyxFQUFvQyxFQUFFLElBQXNDO0lBQy9GLEtBQUssTUFBTSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsSUFBSSxJQUFJLEVBQUU7UUFDNUMsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0MsZ0dBQWdHO1FBQ2hHLDRGQUE0RjtRQUM1RixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDO1FBQ25DLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzFGLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQ25EO2FBQU07WUFDTCxFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsUUFBUSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztTQUNuRDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUHJvcGFnYXRlIGV4dHJhY3RkIG1lc3NhZ2UgcGxhY2Vob2xkZXJzIHVwIHRvIHRoZWlyIHJvb3QgZXh0cmFjdGVkIG1lc3NhZ2Ugb3AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVByb3BhZ2F0ZUkxOG5QbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBpMThuIGFuZCBleHRyYWN0ZWQgbWVzc2FnZSBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bk9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgY29uc3QgZXh0cmFjdGVkTWVzc2FnZU9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FeHRyYWN0ZWRNZXNzYWdlT3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGkxOG5PcHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRXh0cmFjdGVkTWVzc2FnZTpcbiAgICAgICAgICBleHRyYWN0ZWRNZXNzYWdlT3BzLnNldChvcC5vd25lciwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEZvciBlYWNoIG5vbi1yb290IG1lc3NhZ2UsIG1lcmdlIGl0cyBwYXJhbXMgaW50byB0aGUgcm9vdCBtZXNzYWdlJ3MgcGFyYW1zLlxuICBmb3IgKGNvbnN0IFt4cmVmLCBjaGlsZEV4dHJhY3RlZE1lc3NhZ2VPcF0gb2YgZXh0cmFjdGVkTWVzc2FnZU9wcykge1xuICAgIGlmICghY2hpbGRFeHRyYWN0ZWRNZXNzYWdlT3AuaXNSb290KSB7XG4gICAgICBjb25zdCBpMThuT3AgPSBpMThuT3BzLmdldCh4cmVmKTtcbiAgICAgIGlmIChpMThuT3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgb3duZXIgaTE4biBibG9jayBmb3IgZXh0cmFjdGVkIG1lc3NhZ2UuJyk7XG4gICAgICB9XG4gICAgICBjb25zdCByb290RXh0cmFjdGVkTWVzc2FnZU9wID0gZXh0cmFjdGVkTWVzc2FnZU9wcy5nZXQoaTE4bk9wLnJvb3QpO1xuICAgICAgaWYgKHJvb3RFeHRyYWN0ZWRNZXNzYWdlT3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgZXh0cmFjdGVkIG1lc3NhZ2Ugb3AgZm9yIHJvb3QgaTE4biBibG9jay4nKTtcbiAgICAgIH1cbiAgICAgIG1lcmdlUGFyYW1zKHJvb3RFeHRyYWN0ZWRNZXNzYWdlT3AucGFyYW1zLCBjaGlsZEV4dHJhY3RlZE1lc3NhZ2VPcC5wYXJhbXMpO1xuICAgICAgbWVyZ2VQYXJhbXMoXG4gICAgICAgICAgcm9vdEV4dHJhY3RlZE1lc3NhZ2VPcC5wb3N0cHJvY2Vzc2luZ1BhcmFtcyxcbiAgICAgICAgICBjaGlsZEV4dHJhY3RlZE1lc3NhZ2VPcC5wb3N0cHJvY2Vzc2luZ1BhcmFtcyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWVyZ2VzIHRoZSBwYXJhbXMgaW4gdGhlIGBmcm9tYCBtYXAgdG8gaW50byB0aGUgYHRvYCBtYXAuXG4gKi9cbmZ1bmN0aW9uIG1lcmdlUGFyYW1zKHRvOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPiwgZnJvbTogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4pIHtcbiAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIGZyb21WYWx1ZXNdIG9mIGZyb20pIHtcbiAgICBjb25zdCB0b1ZhbHVlcyA9IHRvLmdldChwbGFjZWhvbGRlcikgfHwgW107XG4gICAgLy8gVE9ETyhtbWFsZXJiYSk6IENoaWxkIGVsZW1lbnQgY2xvc2UgdGFnIHBhcmFtcyBzaG91bGQgYmUgcHJlcGVuZGVkIHRvIG1haW50YWluIHRoZSBzYW1lIG9yZGVyXG4gICAgLy8gYXMgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci4gQ2FuIGJlIGNsZWFuZWQgdXAgd2hlbiBjb21wYXRpYmlsaXR5IGlzIG5vIGxvbmdlciByZXF1aXJlZC5cbiAgICBjb25zdCBmbGFncyA9IGZyb21WYWx1ZXNbMF0hLmZsYWdzO1xuICAgIGlmICgoZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSAmJiAhKGZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSkge1xuICAgICAgdG8uc2V0KHBsYWNlaG9sZGVyLCBbLi4uZnJvbVZhbHVlcywgLi4udG9WYWx1ZXNdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG8uc2V0KHBsYWNlaG9sZGVyLCBbLi4udG9WYWx1ZXMsIC4uLmZyb21WYWx1ZXNdKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==