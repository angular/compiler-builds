/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../../core';
import { isIframeSecuritySensitiveAttr } from '../../../../schema/dom_security_schema';
import * as ir from '../../ir';
import { createOpXrefMap } from '../util/elements';
/**
 * Mapping of security contexts to sanitizer function for that context.
 */
const sanitizers = new Map([
    [SecurityContext.HTML, ir.SanitizerFn.Html], [SecurityContext.SCRIPT, ir.SanitizerFn.Script],
    [SecurityContext.STYLE, ir.SanitizerFn.Style], [SecurityContext.URL, ir.SanitizerFn.Url],
    [SecurityContext.RESOURCE_URL, ir.SanitizerFn.ResourceUrl]
]);
/**
 * Resolves sanitization functions for ops that need them.
 */
export function resolveSanitizers(job) {
    for (const unit of job.units) {
        const elements = createOpXrefMap(unit);
        let sanitizerFn;
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                    sanitizerFn = sanitizers.get(op.securityContext) || null;
                    op.sanitizer = sanitizerFn ? new ir.SanitizerExpr(sanitizerFn) : null;
                    // If there was no sanitization function found based on the security context of an
                    // attribute/property, check whether this attribute/property is one of the
                    // security-sensitive <iframe> attributes (and that the current element is actually an
                    // <iframe>).
                    if (op.sanitizer === null) {
                        const ownerOp = elements.get(op.target);
                        if (ownerOp === undefined || !ir.isElementOrContainerOp(ownerOp)) {
                            throw Error('Property should have an element-like owner');
                        }
                        if (isIframeElement(ownerOp) && isIframeSecuritySensitiveAttr(op.name)) {
                            op.sanitizer = new ir.SanitizerExpr(ir.SanitizerFn.IframeAttribute);
                        }
                    }
                    break;
            }
        }
    }
}
/**
 * Checks whether the given op represents an iframe element.
 */
function isIframeElement(op) {
    return op.kind === ir.OpKind.ElementStart && op.tag?.toLowerCase() === 'iframe';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFakQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBdUM7SUFDL0QsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQzVGLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztJQUN4RixDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUM7Q0FDM0QsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBNEI7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksV0FBZ0MsQ0FBQztRQUNyQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztnQkFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLFdBQVcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxJQUFJLENBQUM7b0JBQ3pELEVBQUUsQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDdEUsa0ZBQWtGO29CQUNsRiwwRUFBMEU7b0JBQzFFLHNGQUFzRjtvQkFDdEYsYUFBYTtvQkFDYixJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQzFCLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUN4QyxJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzs0QkFDakUsTUFBTSxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQzt3QkFDNUQsQ0FBQzt3QkFDRCxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDdkUsRUFBRSxDQUFDLFNBQVMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQzt3QkFDdEUsQ0FBQztvQkFDSCxDQUFDO29CQUNELE1BQU07WUFDVixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxFQUE0QjtJQUNuRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDbEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi8uLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2NyZWF0ZU9wWHJlZk1hcH0gZnJvbSAnLi4vdXRpbC9lbGVtZW50cyc7XG5cbi8qKlxuICogTWFwcGluZyBvZiBzZWN1cml0eSBjb250ZXh0cyB0byBzYW5pdGl6ZXIgZnVuY3Rpb24gZm9yIHRoYXQgY29udGV4dC5cbiAqL1xuY29uc3Qgc2FuaXRpemVycyA9IG5ldyBNYXA8U2VjdXJpdHlDb250ZXh0LCBpci5TYW5pdGl6ZXJGbnxudWxsPihbXG4gIFtTZWN1cml0eUNvbnRleHQuSFRNTCwgaXIuU2FuaXRpemVyRm4uSHRtbF0sIFtTZWN1cml0eUNvbnRleHQuU0NSSVBULCBpci5TYW5pdGl6ZXJGbi5TY3JpcHRdLFxuICBbU2VjdXJpdHlDb250ZXh0LlNUWUxFLCBpci5TYW5pdGl6ZXJGbi5TdHlsZV0sIFtTZWN1cml0eUNvbnRleHQuVVJMLCBpci5TYW5pdGl6ZXJGbi5VcmxdLFxuICBbU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCwgaXIuU2FuaXRpemVyRm4uUmVzb3VyY2VVcmxdXG5dKTtcblxuLyoqXG4gKiBSZXNvbHZlcyBzYW5pdGl6YXRpb24gZnVuY3Rpb25zIGZvciBvcHMgdGhhdCBuZWVkIHRoZW0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU2FuaXRpemVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGNyZWF0ZU9wWHJlZk1hcCh1bml0KTtcbiAgICBsZXQgc2FuaXRpemVyRm46IGlyLlNhbml0aXplckZufG51bGw7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgICAgc2FuaXRpemVyRm4gPSBzYW5pdGl6ZXJzLmdldChvcC5zZWN1cml0eUNvbnRleHQpIHx8IG51bGw7XG4gICAgICAgICAgb3Auc2FuaXRpemVyID0gc2FuaXRpemVyRm4gPyBuZXcgaXIuU2FuaXRpemVyRXhwcihzYW5pdGl6ZXJGbikgOiBudWxsO1xuICAgICAgICAgIC8vIElmIHRoZXJlIHdhcyBubyBzYW5pdGl6YXRpb24gZnVuY3Rpb24gZm91bmQgYmFzZWQgb24gdGhlIHNlY3VyaXR5IGNvbnRleHQgb2YgYW5cbiAgICAgICAgICAvLyBhdHRyaWJ1dGUvcHJvcGVydHksIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXMgb25lIG9mIHRoZVxuICAgICAgICAgIC8vIHNlY3VyaXR5LXNlbnNpdGl2ZSA8aWZyYW1lPiBhdHRyaWJ1dGVzIChhbmQgdGhhdCB0aGUgY3VycmVudCBlbGVtZW50IGlzIGFjdHVhbGx5IGFuXG4gICAgICAgICAgLy8gPGlmcmFtZT4pLlxuICAgICAgICAgIGlmIChvcC5zYW5pdGl6ZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG93bmVyT3AgPSBlbGVtZW50cy5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgICAgIGlmIChvd25lck9wID09PSB1bmRlZmluZWQgfHwgIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3duZXJPcCkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1Byb3BlcnR5IHNob3VsZCBoYXZlIGFuIGVsZW1lbnQtbGlrZSBvd25lcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzSWZyYW1lRWxlbWVudChvd25lck9wKSAmJiBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cihvcC5uYW1lKSkge1xuICAgICAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBuZXcgaXIuU2FuaXRpemVyRXhwcihpci5TYW5pdGl6ZXJGbi5JZnJhbWVBdHRyaWJ1dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gb3AgcmVwcmVzZW50cyBhbiBpZnJhbWUgZWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gaXNJZnJhbWVFbGVtZW50KG9wOiBpci5FbGVtZW50T3JDb250YWluZXJPcHMpOiBib29sZWFuIHtcbiAgcmV0dXJuIG9wLmtpbmQgPT09IGlyLk9wS2luZC5FbGVtZW50U3RhcnQgJiYgb3AudGFnPy50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJztcbn1cbiJdfQ==