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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2RlZmVyX2RlcHNfZm5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY3JlYXRlX2RlZmVyX2RlcHNfZm5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBNEI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNsQyxTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsTUFBTSxZQUFZLEdBQW1CLEVBQUUsQ0FBQztnQkFDeEMsS0FBSyxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNuQyxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQzt3QkFDckIsOENBQThDO3dCQUM5QyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUNyQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBRWhGLGtEQUFrRDt3QkFDbEQsTUFBTSxVQUFVLEdBQ1osQ0FBQyxJQUFJLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsVUFBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzt3QkFDOUUsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLDJEQUEyRDt3QkFDM0QsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQzdELElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQzVCLE1BQU0sSUFBSSxLQUFLLENBQ1gsNkVBQTZFLENBQUMsQ0FBQztnQkFDckYsQ0FBQztnQkFDRCxFQUFFLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQy9DLFVBQVUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxhQUFhLFVBQVUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVM7Z0JBQ2pFLGtEQUFrRCxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hFLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ3JlYXRlIGV4dHJhY3RlZCBkZXBzIGZ1bmN0aW9ucyBmb3IgZGVmZXIgb3BzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmZXJEZXBzRm5zKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRGVmZXIpIHtcbiAgICAgICAgaWYgKG9wLm1ldGFkYXRhLmRlcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGVwZW5kZW5jaWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRlcCBvZiBvcC5tZXRhZGF0YS5kZXBzKSB7XG4gICAgICAgICAgaWYgKGRlcC5pc0RlZmVycmFibGUpIHtcbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZ1bmN0aW9uLCBlLmcuIGBtICgpID0+IG0uTXlDbXA7YC5cbiAgICAgICAgICAgIGNvbnN0IGlubmVyRm4gPSBvLmFycm93Rm4oXG4gICAgICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oJ20nLCBvLkRZTkFNSUNfVFlQRSldLCBvLnZhcmlhYmxlKCdtJykucHJvcChkZXAuc3ltYm9sTmFtZSkpO1xuXG4gICAgICAgICAgICAvLyBEeW5hbWljIGltcG9ydCwgZS5nLiBgaW1wb3J0KCcuL2EnKS50aGVuKC4uLilgLlxuICAgICAgICAgICAgY29uc3QgaW1wb3J0RXhwciA9XG4gICAgICAgICAgICAgICAgKG5ldyBvLkR5bmFtaWNJbXBvcnRFeHByKGRlcC5pbXBvcnRQYXRoISkpLnByb3AoJ3RoZW4nKS5jYWxsRm4oW2lubmVyRm5dKTtcbiAgICAgICAgICAgIGRlcGVuZGVuY2llcy5wdXNoKGltcG9ydEV4cHIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBOb24tZGVmZXJyYWJsZSBzeW1ib2wsIGp1c3QgdXNlIGEgcmVmZXJlbmNlIHRvIHRoZSB0eXBlLlxuICAgICAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goZGVwLnR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZXBzRm5FeHByID0gby5hcnJvd0ZuKFtdLCBvLmxpdGVyYWxBcnIoZGVwZW5kZW5jaWVzKSk7XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBzbG90IG11c3QgYmUgYXNzaWduZWQgYmZvcmUgZXh0cmFjdGluZyBkZWZlciBkZXBzIGZ1bmN0aW9ucycpO1xuICAgICAgICB9XG4gICAgICAgIG9wLnJlc29sdmVyRm4gPSBqb2IucG9vbC5nZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShcbiAgICAgICAgICAgIGRlcHNGbkV4cHIsIGAke2pvYi5jb21wb25lbnROYW1lfV9EZWZlcl8ke29wLmhhbmRsZS5zbG90fV9EZXBzRm5gLFxuICAgICAgICAgICAgLyogRG9uJ3QgdXNlIHVuaXF1ZSBuYW1lcyBmb3IgVERCIGNvbXBhdGliaWxpdHkgKi8gZmFsc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19