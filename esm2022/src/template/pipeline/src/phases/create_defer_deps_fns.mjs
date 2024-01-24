/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Create extracted deps functions for defer ops.
 */
export function createDeferDepsFns(job) {
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.Defer) {
                if (op.metadata.deps.length === 0) {
                    continue;
                }
                if (op.resolverFn !== null) {
                    continue;
                }
                const dependencies = [];
                for (const dep of op.metadata.deps) {
                    if (dep.isDeferrable) {
                        // Callback function, e.g. `m () => m.MyCmp;`.
                        const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], o.variable('m').prop(dep.symbolName));
                        // Dynamic import, e.g. `import('./a').then(...)`.
                        const importExpr = (new o.DynamicImportExpr(dep.importPath)).prop('then').callFn([innerFn]);
                        dependencies.push(importExpr);
                    }
                    else {
                        // Non-deferrable symbol, just use a reference to the type.
                        dependencies.push(dep.type);
                    }
                }
                const depsFnExpr = o.arrowFn([], o.literalArr(dependencies));
                if (op.handle.slot === null) {
                    throw new Error('AssertionError: slot must be assigned bfore extracting defer deps functions');
                }
                op.resolverFn = job.pool.getSharedFunctionReference(depsFnExpr, `${job.componentName}_Defer_${op.handle.slot}_DepsFn`, 
                /* Don't use unique names for TDB compatibility */ false);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2RlZmVyX2RlcHNfZm5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY3JlYXRlX2RlZmVyX2RlcHNfZm5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBNEI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNsQyxTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsSUFBSSxFQUFFLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUMzQixTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsTUFBTSxZQUFZLEdBQW1CLEVBQUUsQ0FBQztnQkFDeEMsS0FBSyxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNuQyxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQzt3QkFDckIsOENBQThDO3dCQUM5QyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUNyQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBRWhGLGtEQUFrRDt3QkFDbEQsTUFBTSxVQUFVLEdBQ1osQ0FBQyxJQUFJLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsVUFBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzt3QkFDOUUsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLDJEQUEyRDt3QkFDM0QsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQzdELElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQzVCLE1BQU0sSUFBSSxLQUFLLENBQ1gsNkVBQTZFLENBQUMsQ0FBQztnQkFDckYsQ0FBQztnQkFDRCxFQUFFLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQy9DLFVBQVUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxhQUFhLFVBQVUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVM7Z0JBQ2pFLGtEQUFrRCxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hFLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ3JlYXRlIGV4dHJhY3RlZCBkZXBzIGZ1bmN0aW9ucyBmb3IgZGVmZXIgb3BzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJEZXBzRm5zKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRGVmZXIpIHtcbiAgICAgICAgaWYgKG9wLm1ldGFkYXRhLmRlcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLnJlc29sdmVyRm4gIT09IG51bGwpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgZGVwIG9mIG9wLm1ldGFkYXRhLmRlcHMpIHtcbiAgICAgICAgICBpZiAoZGVwLmlzRGVmZXJyYWJsZSkge1xuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZnVuY3Rpb24sIGUuZy4gYG0gKCkgPT4gbS5NeUNtcDtgLlxuICAgICAgICAgICAgY29uc3QgaW5uZXJGbiA9IG8uYXJyb3dGbihcbiAgICAgICAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnbScsIG8uRFlOQU1JQ19UWVBFKV0sIG8udmFyaWFibGUoJ20nKS5wcm9wKGRlcC5zeW1ib2xOYW1lKSk7XG5cbiAgICAgICAgICAgIC8vIER5bmFtaWMgaW1wb3J0LCBlLmcuIGBpbXBvcnQoJy4vYScpLnRoZW4oLi4uKWAuXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRFeHByID1cbiAgICAgICAgICAgICAgICAobmV3IG8uRHluYW1pY0ltcG9ydEV4cHIoZGVwLmltcG9ydFBhdGghKSkucHJvcCgndGhlbicpLmNhbGxGbihbaW5uZXJGbl0pO1xuICAgICAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goaW1wb3J0RXhwcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIE5vbi1kZWZlcnJhYmxlIHN5bWJvbCwganVzdCB1c2UgYSByZWZlcmVuY2UgdG8gdGhlIHR5cGUuXG4gICAgICAgICAgICBkZXBlbmRlbmNpZXMucHVzaChkZXAudHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlcHNGbkV4cHIgPSBvLmFycm93Rm4oW10sIG8ubGl0ZXJhbEFycihkZXBlbmRlbmNpZXMpKTtcbiAgICAgICAgaWYgKG9wLmhhbmRsZS5zbG90ID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IHNsb3QgbXVzdCBiZSBhc3NpZ25lZCBiZm9yZSBleHRyYWN0aW5nIGRlZmVyIGRlcHMgZnVuY3Rpb25zJyk7XG4gICAgICAgIH1cbiAgICAgICAgb3AucmVzb2x2ZXJGbiA9IGpvYi5wb29sLmdldFNoYXJlZEZ1bmN0aW9uUmVmZXJlbmNlKFxuICAgICAgICAgICAgZGVwc0ZuRXhwciwgYCR7am9iLmNvbXBvbmVudE5hbWV9X0RlZmVyXyR7b3AuaGFuZGxlLnNsb3R9X0RlcHNGbmAsXG4gICAgICAgICAgICAvKiBEb24ndCB1c2UgdW5pcXVlIG5hbWVzIGZvciBUREIgY29tcGF0aWJpbGl0eSAqLyBmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=