/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Deduplicate text bindings, e.g. <div class="cls1" class="cls2">
 */
export function deduplicateTextBindings(job) {
    const seen = new Map();
    for (const unit of job.units) {
        for (const op of unit.update.reversed()) {
            if (op.kind === ir.OpKind.Binding && op.isTextAttribute) {
                const seenForElement = seen.get(op.target) || new Set();
                if (seenForElement.has(op.name)) {
                    if (job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
                        // For most duplicated attributes, TemplateDefinitionBuilder lists all of the values in
                        // the consts array. However, for style and class attributes it only keeps the last one.
                        // We replicate that behavior here since it has actual consequences for apps with
                        // duplicate class or style attrs.
                        if (op.name === 'style' || op.name === 'class') {
                            ir.OpList.remove(op);
                        }
                    }
                    else {
                        // TODO: Determine the correct behavior. It would probably make sense to merge multiple
                        // style and class attributes. Alternatively we could just throw an error, as HTML
                        // doesn't permit duplicate attributes.
                    }
                }
                seenForElement.add(op.name);
                seen.set(op.target, seenForElement);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVkdXBsaWNhdGVfdGV4dF9iaW5kaW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2RlZHVwbGljYXRlX3RleHRfYmluZGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsR0FBbUI7SUFDekQsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7SUFDL0MsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUN2QyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLGVBQWUsRUFBRTtnQkFDdkQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDeEQsSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDL0IsSUFBSSxHQUFHLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsRUFBRTt3QkFDeEUsdUZBQXVGO3dCQUN2Rix3RkFBd0Y7d0JBQ3hGLGlGQUFpRjt3QkFDakYsa0NBQWtDO3dCQUNsQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssT0FBTyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFOzRCQUM5QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzt5QkFDbkM7cUJBQ0Y7eUJBQU07d0JBQ0wsdUZBQXVGO3dCQUN2RixrRkFBa0Y7d0JBQ2xGLHVDQUF1QztxQkFDeEM7aUJBQ0Y7Z0JBQ0QsY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQzthQUNyQztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIERlZHVwbGljYXRlIHRleHQgYmluZGluZ3MsIGUuZy4gPGRpdiBjbGFzcz1cImNsczFcIiBjbGFzcz1cImNsczJcIj5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZHVwbGljYXRlVGV4dEJpbmRpbmdzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBNYXA8aXIuWHJlZklkLCBTZXQ8c3RyaW5nPj4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUucmV2ZXJzZWQoKSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5CaW5kaW5nICYmIG9wLmlzVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCBzZWVuRm9yRWxlbWVudCA9IHNlZW4uZ2V0KG9wLnRhcmdldCkgfHwgbmV3IFNldCgpO1xuICAgICAgICBpZiAoc2VlbkZvckVsZW1lbnQuaGFzKG9wLm5hbWUpKSB7XG4gICAgICAgICAgaWYgKGpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7XG4gICAgICAgICAgICAvLyBGb3IgbW9zdCBkdXBsaWNhdGVkIGF0dHJpYnV0ZXMsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgbGlzdHMgYWxsIG9mIHRoZSB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHRoZSBjb25zdHMgYXJyYXkuIEhvd2V2ZXIsIGZvciBzdHlsZSBhbmQgY2xhc3MgYXR0cmlidXRlcyBpdCBvbmx5IGtlZXBzIHRoZSBsYXN0IG9uZS5cbiAgICAgICAgICAgIC8vIFdlIHJlcGxpY2F0ZSB0aGF0IGJlaGF2aW9yIGhlcmUgc2luY2UgaXQgaGFzIGFjdHVhbCBjb25zZXF1ZW5jZXMgZm9yIGFwcHMgd2l0aFxuICAgICAgICAgICAgLy8gZHVwbGljYXRlIGNsYXNzIG9yIHN0eWxlIGF0dHJzLlxuICAgICAgICAgICAgaWYgKG9wLm5hbWUgPT09ICdzdHlsZScgfHwgb3AubmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLlVwZGF0ZU9wPihvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE86IERldGVybWluZSB0aGUgY29ycmVjdCBiZWhhdmlvci4gSXQgd291bGQgcHJvYmFibHkgbWFrZSBzZW5zZSB0byBtZXJnZSBtdWx0aXBsZVxuICAgICAgICAgICAgLy8gc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXMuIEFsdGVybmF0aXZlbHkgd2UgY291bGQganVzdCB0aHJvdyBhbiBlcnJvciwgYXMgSFRNTFxuICAgICAgICAgICAgLy8gZG9lc24ndCBwZXJtaXQgZHVwbGljYXRlIGF0dHJpYnV0ZXMuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNlZW5Gb3JFbGVtZW50LmFkZChvcC5uYW1lKTtcbiAgICAgICAgc2Vlbi5zZXQob3AudGFyZ2V0LCBzZWVuRm9yRWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=