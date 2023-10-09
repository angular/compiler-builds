/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
export function phasePropagateI18nPlaceholders(job) {
    // Get all of the i18n ops.
    const i18nOps = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart) {
                i18nOps.set(op.xref, op);
            }
        }
    }
    // Propagate i18n params from sub-templates up to the root i18n op.
    for (const op of i18nOps.values()) {
        if (op.xref !== op.root) {
            const rootOp = i18nOps.get(op.root);
            for (const [placeholder, value] of op.params) {
                rootOp.params.set(placeholder, value);
            }
        }
    }
    // Validate the root i18n ops have all placeholders filled in.
    for (const op of i18nOps.values()) {
        if (op.xref === op.root) {
            for (const placeholder in op.message.placeholders) {
                if (!op.params.has(placeholder)) {
                    throw Error(`Failed to resolve i18n placeholder: ${placeholder}`);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9CLE1BQU0sVUFBVSw4QkFBOEIsQ0FBQyxHQUFtQjtJQUNoRSwyQkFBMkI7SUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFDckQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7Z0JBQ25DLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQzthQUMxQjtTQUNGO0tBQ0Y7SUFFRCxtRUFBbUU7SUFDbkUsS0FBSyxNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDakMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDdkIsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDckMsS0FBSyxNQUFNLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUU7Z0JBQzVDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUN2QztTQUNGO0tBQ0Y7SUFFRCw4REFBOEQ7SUFDOUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDakMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDdkIsS0FBSyxNQUFNLFdBQVcsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtnQkFDakQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO29CQUMvQixNQUFNLEtBQUssQ0FBQyx1Q0FBdUMsV0FBVyxFQUFFLENBQUMsQ0FBQztpQkFDbkU7YUFDRjtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUHJvcGFnYXRlSTE4blBsYWNlaG9sZGVycyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIEdldCBhbGwgb2YgdGhlIGkxOG4gb3BzLlxuICBjb25zdCBpMThuT3BzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgICAgaTE4bk9wcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFByb3BhZ2F0ZSBpMThuIHBhcmFtcyBmcm9tIHN1Yi10ZW1wbGF0ZXMgdXAgdG8gdGhlIHJvb3QgaTE4biBvcC5cbiAgZm9yIChjb25zdCBvcCBvZiBpMThuT3BzLnZhbHVlcygpKSB7XG4gICAgaWYgKG9wLnhyZWYgIT09IG9wLnJvb3QpIHtcbiAgICAgIGNvbnN0IHJvb3RPcCA9IGkxOG5PcHMuZ2V0KG9wLnJvb3QpITtcbiAgICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCB2YWx1ZV0gb2Ygb3AucGFyYW1zKSB7XG4gICAgICAgIHJvb3RPcC5wYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgdGhlIHJvb3QgaTE4biBvcHMgaGF2ZSBhbGwgcGxhY2Vob2xkZXJzIGZpbGxlZCBpbi5cbiAgZm9yIChjb25zdCBvcCBvZiBpMThuT3BzLnZhbHVlcygpKSB7XG4gICAgaWYgKG9wLnhyZWYgPT09IG9wLnJvb3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGxhY2Vob2xkZXIgaW4gb3AubWVzc2FnZS5wbGFjZWhvbGRlcnMpIHtcbiAgICAgICAgaWYgKCFvcC5wYXJhbXMuaGFzKHBsYWNlaG9sZGVyKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBGYWlsZWQgdG8gcmVzb2x2ZSBpMThuIHBsYWNlaG9sZGVyOiAke3BsYWNlaG9sZGVyfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=