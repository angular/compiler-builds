/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * i18nAttributes ops will be generated for each i18n attribute. However, not all i18n attribues
 * will contain dynamic content, and so some of these i18nAttributes ops may be unnecessary.
 */
export function removeUnusedI18nAttributesOps(job) {
    for (const unit of job.units) {
        const targetsWithI18nApply = new Set();
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.I18nApply:
                    targetsWithI18nApply.add(op.target);
            }
        }
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nAttributes:
                    if (targetsWithI18nApply.has(op.target)) {
                        continue;
                    }
                    ir.OpList.remove(op);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3ZlX3VudXNlZF9pMThuX2F0dHJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVtb3ZlX3VudXNlZF9pMThuX2F0dHJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxHQUFtQjtJQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBYSxDQUFDO1FBRWxELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDdkM7U0FDRjtRQUVELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWM7b0JBQzNCLElBQUksb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRTt3QkFDdkMsU0FBUztxQkFDVjtvQkFDRCxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBYyxFQUFFLENBQUMsQ0FBQzthQUNyQztTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBpMThuQXR0cmlidXRlcyBvcHMgd2lsbCBiZSBnZW5lcmF0ZWQgZm9yIGVhY2ggaTE4biBhdHRyaWJ1dGUuIEhvd2V2ZXIsIG5vdCBhbGwgaTE4biBhdHRyaWJ1ZXNcbiAqIHdpbGwgY29udGFpbiBkeW5hbWljIGNvbnRlbnQsIGFuZCBzbyBzb21lIG9mIHRoZXNlIGkxOG5BdHRyaWJ1dGVzIG9wcyBtYXkgYmUgdW5uZWNlc3NhcnkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbnVzZWRJMThuQXR0cmlidXRlc09wcyhqb2I6IENvbXBpbGF0aW9uSm9iKSB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCB0YXJnZXRzV2l0aEkxOG5BcHBseSA9IG5ldyBTZXQ8aXIuWHJlZklkPigpO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5BcHBseTpcbiAgICAgICAgICB0YXJnZXRzV2l0aEkxOG5BcHBseS5hZGQob3AudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkF0dHJpYnV0ZXM6XG4gICAgICAgICAgaWYgKHRhcmdldHNXaXRoSTE4bkFwcGx5LmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19