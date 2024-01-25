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
                const fullPathName = unit.fnName?.replace(`_Template`, ``);
                op.resolverFn = job.pool.getSharedFunctionReference(depsFnExpr, `${fullPathName}_Defer_${op.handle.slot}_DepsFn`, 
                /* Don't use unique names for TDB compatibility */ false);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2RlZmVyX2RlcHNfZm5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvY3JlYXRlX2RlZmVyX2RlcHNfZm5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBNEI7SUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNsQyxTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsSUFBSSxFQUFFLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUMzQixTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsTUFBTSxZQUFZLEdBQW1CLEVBQUUsQ0FBQztnQkFDeEMsS0FBSyxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNuQyxJQUFJLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQzt3QkFDckIsOENBQThDO3dCQUM5QyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUNyQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBRWhGLGtEQUFrRDt3QkFDbEQsTUFBTSxVQUFVLEdBQ1osQ0FBQyxJQUFJLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsVUFBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzt3QkFDOUUsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLDJEQUEyRDt3QkFDM0QsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQzdELElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQzVCLE1BQU0sSUFBSSxLQUFLLENBQ1gsNkVBQTZFLENBQUMsQ0FBQztnQkFDckYsQ0FBQztnQkFDRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FDL0MsVUFBVSxFQUFFLEdBQUcsWUFBWSxVQUFVLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTO2dCQUM1RCxrREFBa0QsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNoRSxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIENyZWF0ZSBleHRyYWN0ZWQgZGVwcyBmdW5jdGlvbnMgZm9yIGRlZmVyIG9wcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmVyRGVwc0Zucyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkRlZmVyKSB7XG4gICAgICAgIGlmIChvcC5tZXRhZGF0YS5kZXBzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5yZXNvbHZlckZuICE9PSBudWxsKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGVwZW5kZW5jaWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRlcCBvZiBvcC5tZXRhZGF0YS5kZXBzKSB7XG4gICAgICAgICAgaWYgKGRlcC5pc0RlZmVycmFibGUpIHtcbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZ1bmN0aW9uLCBlLmcuIGBtICgpID0+IG0uTXlDbXA7YC5cbiAgICAgICAgICAgIGNvbnN0IGlubmVyRm4gPSBvLmFycm93Rm4oXG4gICAgICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oJ20nLCBvLkRZTkFNSUNfVFlQRSldLCBvLnZhcmlhYmxlKCdtJykucHJvcChkZXAuc3ltYm9sTmFtZSkpO1xuXG4gICAgICAgICAgICAvLyBEeW5hbWljIGltcG9ydCwgZS5nLiBgaW1wb3J0KCcuL2EnKS50aGVuKC4uLilgLlxuICAgICAgICAgICAgY29uc3QgaW1wb3J0RXhwciA9XG4gICAgICAgICAgICAgICAgKG5ldyBvLkR5bmFtaWNJbXBvcnRFeHByKGRlcC5pbXBvcnRQYXRoISkpLnByb3AoJ3RoZW4nKS5jYWxsRm4oW2lubmVyRm5dKTtcbiAgICAgICAgICAgIGRlcGVuZGVuY2llcy5wdXNoKGltcG9ydEV4cHIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBOb24tZGVmZXJyYWJsZSBzeW1ib2wsIGp1c3QgdXNlIGEgcmVmZXJlbmNlIHRvIHRoZSB0eXBlLlxuICAgICAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goZGVwLnR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZXBzRm5FeHByID0gby5hcnJvd0ZuKFtdLCBvLmxpdGVyYWxBcnIoZGVwZW5kZW5jaWVzKSk7XG4gICAgICAgIGlmIChvcC5oYW5kbGUuc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBzbG90IG11c3QgYmUgYXNzaWduZWQgYmZvcmUgZXh0cmFjdGluZyBkZWZlciBkZXBzIGZ1bmN0aW9ucycpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZ1bGxQYXRoTmFtZSA9IHVuaXQuZm5OYW1lPy5yZXBsYWNlKGBfVGVtcGxhdGVgLCBgYCk7XG4gICAgICAgIG9wLnJlc29sdmVyRm4gPSBqb2IucG9vbC5nZXRTaGFyZWRGdW5jdGlvblJlZmVyZW5jZShcbiAgICAgICAgICAgIGRlcHNGbkV4cHIsIGAke2Z1bGxQYXRoTmFtZX1fRGVmZXJfJHtvcC5oYW5kbGUuc2xvdH1fRGVwc0ZuYCxcbiAgICAgICAgICAgIC8qIERvbid0IHVzZSB1bmlxdWUgbmFtZXMgZm9yIFREQiBjb21wYXRpYmlsaXR5ICovIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==