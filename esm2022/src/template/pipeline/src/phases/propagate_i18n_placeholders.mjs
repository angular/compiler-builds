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
export function propogateI18nPlaceholders(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLHlCQUF5QixDQUFDLEdBQTRCO0lBQ3BFLGtFQUFrRTtJQUNsRSxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztJQUNyRCxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTO29CQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLE1BQU07Z0JBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQjtvQkFDN0IsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3RDLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLHVCQUF1QixDQUFDLElBQUksbUJBQW1CLEVBQUU7UUFDakUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRTtZQUNuQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDeEIsTUFBTSxLQUFLLENBQUMsd0RBQXdELENBQUMsQ0FBQzthQUN2RTtZQUNELE1BQU0sc0JBQXNCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRSxJQUFJLHNCQUFzQixLQUFLLFNBQVMsRUFBRTtnQkFDeEMsTUFBTSxLQUFLLENBQUMsMERBQTBELENBQUMsQ0FBQzthQUN6RTtZQUNELFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0UsV0FBVyxDQUNQLHNCQUFzQixDQUFDLG9CQUFvQixFQUMzQyx1QkFBdUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ25EO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FBQyxFQUFvQyxFQUFFLElBQXNDO0lBQy9GLEtBQUssTUFBTSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsSUFBSSxJQUFJLEVBQUU7UUFDNUMsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0MsZ0dBQWdHO1FBQ2hHLDRGQUE0RjtRQUM1RixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDO1FBQ25DLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzFGLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQ25EO2FBQU07WUFDTCxFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsUUFBUSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztTQUNuRDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUHJvcGFnYXRlIGV4dHJhY3RkIG1lc3NhZ2UgcGxhY2Vob2xkZXJzIHVwIHRvIHRoZWlyIHJvb3QgZXh0cmFjdGVkIG1lc3NhZ2Ugb3AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9wb2dhdGVJMThuUGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgaTE4biBhbmQgZXh0cmFjdGVkIG1lc3NhZ2Ugb3BzIGZvciB1c2UgbGF0ZXIuXG4gIGNvbnN0IGkxOG5PcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4blN0YXJ0T3A+KCk7XG4gIGNvbnN0IGV4dHJhY3RlZE1lc3NhZ2VPcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRXh0cmFjdGVkTWVzc2FnZU9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBpMThuT3BzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkV4dHJhY3RlZE1lc3NhZ2U6XG4gICAgICAgICAgZXh0cmFjdGVkTWVzc2FnZU9wcy5zZXQob3Aub3duZXIsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBGb3IgZWFjaCBub24tcm9vdCBtZXNzYWdlLCBtZXJnZSBpdHMgcGFyYW1zIGludG8gdGhlIHJvb3QgbWVzc2FnZSdzIHBhcmFtcy5cbiAgZm9yIChjb25zdCBbeHJlZiwgY2hpbGRFeHRyYWN0ZWRNZXNzYWdlT3BdIG9mIGV4dHJhY3RlZE1lc3NhZ2VPcHMpIHtcbiAgICBpZiAoIWNoaWxkRXh0cmFjdGVkTWVzc2FnZU9wLmlzUm9vdCkge1xuICAgICAgY29uc3QgaTE4bk9wID0gaTE4bk9wcy5nZXQoeHJlZik7XG4gICAgICBpZiAoaTE4bk9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIG93bmVyIGkxOG4gYmxvY2sgZm9yIGV4dHJhY3RlZCBtZXNzYWdlLicpO1xuICAgICAgfVxuICAgICAgY29uc3Qgcm9vdEV4dHJhY3RlZE1lc3NhZ2VPcCA9IGV4dHJhY3RlZE1lc3NhZ2VPcHMuZ2V0KGkxOG5PcC5yb290KTtcbiAgICAgIGlmIChyb290RXh0cmFjdGVkTWVzc2FnZU9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGV4dHJhY3RlZCBtZXNzYWdlIG9wIGZvciByb290IGkxOG4gYmxvY2suJyk7XG4gICAgICB9XG4gICAgICBtZXJnZVBhcmFtcyhyb290RXh0cmFjdGVkTWVzc2FnZU9wLnBhcmFtcywgY2hpbGRFeHRyYWN0ZWRNZXNzYWdlT3AucGFyYW1zKTtcbiAgICAgIG1lcmdlUGFyYW1zKFxuICAgICAgICAgIHJvb3RFeHRyYWN0ZWRNZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMsXG4gICAgICAgICAgY2hpbGRFeHRyYWN0ZWRNZXNzYWdlT3AucG9zdHByb2Nlc3NpbmdQYXJhbXMpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1lcmdlcyB0aGUgcGFyYW1zIGluIHRoZSBgZnJvbWAgbWFwIHRvIGludG8gdGhlIGB0b2AgbWFwLlxuICovXG5mdW5jdGlvbiBtZXJnZVBhcmFtcyh0bzogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4sIGZyb206IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+KSB7XG4gIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBmcm9tVmFsdWVzXSBvZiBmcm9tKSB7XG4gICAgY29uc3QgdG9WYWx1ZXMgPSB0by5nZXQocGxhY2Vob2xkZXIpIHx8IFtdO1xuICAgIC8vIFRPRE8obW1hbGVyYmEpOiBDaGlsZCBlbGVtZW50IGNsb3NlIHRhZyBwYXJhbXMgc2hvdWxkIGJlIHByZXBlbmRlZCB0byBtYWludGFpbiB0aGUgc2FtZSBvcmRlclxuICAgIC8vIGFzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIuIENhbiBiZSBjbGVhbmVkIHVwIHdoZW4gY29tcGF0aWJpbGl0eSBpcyBubyBsb25nZXIgcmVxdWlyZWQuXG4gICAgY29uc3QgZmxhZ3MgPSBmcm9tVmFsdWVzWzBdIS5mbGFncztcbiAgICBpZiAoKGZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZykgJiYgIShmbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZykpIHtcbiAgICAgIHRvLnNldChwbGFjZWhvbGRlciwgWy4uLmZyb21WYWx1ZXMsIC4uLnRvVmFsdWVzXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvLnNldChwbGFjZWhvbGRlciwgWy4uLnRvVmFsdWVzLCAuLi5mcm9tVmFsdWVzXSk7XG4gICAgfVxuICB9XG59XG4iXX0=