/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Change namespaces between HTML, SVG and MathML, depending on the next element.
 */
export function phaseNamespace(job) {
    for (const unit of job.units) {
        let activeNamespace = ir.Namespace.HTML;
        for (const op of unit.create) {
            if (op.kind !== ir.OpKind.Element && op.kind !== ir.OpKind.ElementStart) {
                continue;
            }
            if (op.namespace !== activeNamespace) {
                ir.OpList.insertBefore(ir.createNamespaceOp(op.namespace), op);
                activeNamespace = op.namespace;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtZXNwYWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvbmFtZXNwYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxHQUFtQjtJQUNoRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsSUFBSSxlQUFlLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFFeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFO2dCQUN2RSxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssZUFBZSxFQUFFO2dCQUNwQyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBYyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RSxlQUFlLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQzthQUNoQztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ2hhbmdlIG5hbWVzcGFjZXMgYmV0d2VlbiBIVE1MLCBTVkcgYW5kIE1hdGhNTCwgZGVwZW5kaW5nIG9uIHRoZSBuZXh0IGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZU5hbWVzcGFjZShqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBsZXQgYWN0aXZlTmFtZXNwYWNlID0gaXIuTmFtZXNwYWNlLkhUTUw7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLkVsZW1lbnQgJiYgb3Aua2luZCAhPT0gaXIuT3BLaW5kLkVsZW1lbnRTdGFydCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5uYW1lc3BhY2UgIT09IGFjdGl2ZU5hbWVzcGFjZSkge1xuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLkNyZWF0ZU9wPihpci5jcmVhdGVOYW1lc3BhY2VPcChvcC5uYW1lc3BhY2UpLCBvcCk7XG4gICAgICAgIGFjdGl2ZU5hbWVzcGFjZSA9IG9wLm5hbWVzcGFjZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==