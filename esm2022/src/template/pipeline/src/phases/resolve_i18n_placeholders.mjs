/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../../i18n/i18n_ast';
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * The escape sequence used indicate message param values.
 */
const ESCAPE = '\uFFFD';
/**
 * Resolve the placeholders in i18n messages.
 */
export function phaseResolveI18nPlaceholders(job) {
    for (const unit of job.units) {
        let i18nOp = null;
        let startTags = [];
        let closeTags = [];
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.i18n instanceof i18n.Message) {
                i18nOp = op;
            }
            else if (op.kind === ir.OpKind.I18nEnd) {
                i18nOp = null;
            }
            else if ((op.kind === ir.OpKind.Element || op.kind === ir.OpKind.ElementStart) &&
                op.i18n instanceof i18n.TagPlaceholder) {
                if (i18nOp === null) {
                    throw Error('i18n tag placeholder should only occur inside an i18n block');
                }
                // In order to add the keys in the same order as TemplateDefinitionBuilder, we separately
                // track the start and close tag placeholders.
                // TODO: when TemplateDefinitionBuilder compatibility is not required, we can just add both
                //  keys directly to the map here.
                startTags.push({
                    i18nOp,
                    placeholder: op.i18n.startName,
                    value: o.literal(`${ESCAPE}#${op.slot}${ESCAPE}`)
                });
                closeTags.push({
                    i18nOp,
                    placeholder: op.i18n.closeName,
                    value: o.literal(`${ESCAPE}/#${op.slot}${ESCAPE}`)
                });
            }
        }
        // Add the start tags in the order we encountered them, to match TemplateDefinitionBuilder.
        for (const { i18nOp, placeholder, value } of startTags) {
            i18nOp.tagNameParams[placeholder] = value;
        }
        // Add the close tags in reverse order that we encountered the start tags, to match
        // TemplateDefinitionBuilder.
        for (let i = closeTags.length - 1; i >= 0; i--) {
            const { i18nOp, placeholder, value } = closeTags[i];
            i18nOp.tagNameParams[placeholder] = value;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX3BsYWNlaG9sZGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfaTE4bl9wbGFjZWhvbGRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLElBQUksTUFBTSwyQkFBMkIsQ0FBQztBQUNsRCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBYXhCOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDRCQUE0QixDQUFDLEdBQW1CO0lBQzlELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixJQUFJLE1BQU0sR0FBd0IsSUFBSSxDQUFDO1FBQ3ZDLElBQUksU0FBUyxHQUF1QixFQUFFLENBQUM7UUFDdkMsSUFBSSxTQUFTLEdBQXVCLEVBQUUsQ0FBQztRQUN2QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDdEUsTUFBTSxHQUFHLEVBQUUsQ0FBQzthQUNiO2lCQUFNLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtnQkFDeEMsTUFBTSxHQUFHLElBQUksQ0FBQzthQUNmO2lCQUFNLElBQ0gsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7Z0JBQ3JFLEVBQUUsQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLGNBQWMsRUFBRTtnQkFDMUMsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO29CQUNuQixNQUFNLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO2lCQUM1RTtnQkFDRCx5RkFBeUY7Z0JBQ3pGLDhDQUE4QztnQkFDOUMsMkZBQTJGO2dCQUMzRixrQ0FBa0M7Z0JBQ2xDLFNBQVMsQ0FBQyxJQUFJLENBQUM7b0JBQ2IsTUFBTTtvQkFDTixXQUFXLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTO29CQUM5QixLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE1BQU0sSUFBSSxFQUFFLENBQUMsSUFBSSxHQUFHLE1BQU0sRUFBRSxDQUFDO2lCQUNsRCxDQUFDLENBQUM7Z0JBQ0gsU0FBUyxDQUFDLElBQUksQ0FBQztvQkFDYixNQUFNO29CQUNOLFdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVM7b0JBQzlCLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsTUFBTSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEdBQUcsTUFBTSxFQUFFLENBQUM7aUJBQ25ELENBQUMsQ0FBQzthQUNKO1NBQ0Y7UUFDRCwyRkFBMkY7UUFDM0YsS0FBSyxNQUFNLEVBQUMsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUMsSUFBSSxTQUFTLEVBQUU7WUFDcEQsTUFBTSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDM0M7UUFDRCxtRkFBbUY7UUFDbkYsNkJBQTZCO1FBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QyxNQUFNLEVBQUMsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDM0M7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFRoZSBlc2NhcGUgc2VxdWVuY2UgdXNlZCBpbmRpY2F0ZSBtZXNzYWdlIHBhcmFtIHZhbHVlcy5cbiAqL1xuY29uc3QgRVNDQVBFID0gJ1xcdUZGRkQnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBwbGFjZWhvbGRlciB2YWx1ZSBtYXBwaW5nIG9uIGFuIEkxOG5TdGFydE9wLlxuICovXG5pbnRlcmZhY2UgUGxhY2Vob2xkZXJWYWx1ZSB7XG4gIGkxOG5PcDogaXIuSTE4blN0YXJ0T3A7XG5cbiAgcGxhY2Vob2xkZXI6IHN0cmluZztcblxuICB2YWx1ZTogby5FeHByZXNzaW9uO1xufVxuXG4vKipcbiAqIFJlc29sdmUgdGhlIHBsYWNlaG9sZGVycyBpbiBpMThuIG1lc3NhZ2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VSZXNvbHZlSTE4blBsYWNlaG9sZGVycyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBsZXQgaTE4bk9wOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcbiAgICBsZXQgc3RhcnRUYWdzOiBQbGFjZWhvbGRlclZhbHVlW10gPSBbXTtcbiAgICBsZXQgY2xvc2VUYWdzOiBQbGFjZWhvbGRlclZhbHVlW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCAmJiBvcC5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgICAgIGkxOG5PcCA9IG9wO1xuICAgICAgfSBlbHNlIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkVuZCkge1xuICAgICAgICBpMThuT3AgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkVsZW1lbnQgfHwgb3Aua2luZCA9PT0gaXIuT3BLaW5kLkVsZW1lbnRTdGFydCkgJiZcbiAgICAgICAgICBvcC5pMThuIGluc3RhbmNlb2YgaTE4bi5UYWdQbGFjZWhvbGRlcikge1xuICAgICAgICBpZiAoaTE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSW4gb3JkZXIgdG8gYWRkIHRoZSBrZXlzIGluIHRoZSBzYW1lIG9yZGVyIGFzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIHdlIHNlcGFyYXRlbHlcbiAgICAgICAgLy8gdHJhY2sgdGhlIHN0YXJ0IGFuZCBjbG9zZSB0YWcgcGxhY2Vob2xkZXJzLlxuICAgICAgICAvLyBUT0RPOiB3aGVuIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgY29tcGF0aWJpbGl0eSBpcyBub3QgcmVxdWlyZWQsIHdlIGNhbiBqdXN0IGFkZCBib3RoXG4gICAgICAgIC8vICBrZXlzIGRpcmVjdGx5IHRvIHRoZSBtYXAgaGVyZS5cbiAgICAgICAgc3RhcnRUYWdzLnB1c2goe1xuICAgICAgICAgIGkxOG5PcCxcbiAgICAgICAgICBwbGFjZWhvbGRlcjogb3AuaTE4bi5zdGFydE5hbWUsXG4gICAgICAgICAgdmFsdWU6IG8ubGl0ZXJhbChgJHtFU0NBUEV9IyR7b3Auc2xvdH0ke0VTQ0FQRX1gKVxuICAgICAgICB9KTtcbiAgICAgICAgY2xvc2VUYWdzLnB1c2goe1xuICAgICAgICAgIGkxOG5PcCxcbiAgICAgICAgICBwbGFjZWhvbGRlcjogb3AuaTE4bi5jbG9zZU5hbWUsXG4gICAgICAgICAgdmFsdWU6IG8ubGl0ZXJhbChgJHtFU0NBUEV9LyMke29wLnNsb3R9JHtFU0NBUEV9YClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFkZCB0aGUgc3RhcnQgdGFncyBpbiB0aGUgb3JkZXIgd2UgZW5jb3VudGVyZWQgdGhlbSwgdG8gbWF0Y2ggVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci5cbiAgICBmb3IgKGNvbnN0IHtpMThuT3AsIHBsYWNlaG9sZGVyLCB2YWx1ZX0gb2Ygc3RhcnRUYWdzKSB7XG4gICAgICBpMThuT3AudGFnTmFtZVBhcmFtc1twbGFjZWhvbGRlcl0gPSB2YWx1ZTtcbiAgICB9XG4gICAgLy8gQWRkIHRoZSBjbG9zZSB0YWdzIGluIHJldmVyc2Ugb3JkZXIgdGhhdCB3ZSBlbmNvdW50ZXJlZCB0aGUgc3RhcnQgdGFncywgdG8gbWF0Y2hcbiAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuICAgIGZvciAobGV0IGkgPSBjbG9zZVRhZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHtpMThuT3AsIHBsYWNlaG9sZGVyLCB2YWx1ZX0gPSBjbG9zZVRhZ3NbaV07XG4gICAgICBpMThuT3AudGFnTmFtZVBhcmFtc1twbGFjZWhvbGRlcl0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==