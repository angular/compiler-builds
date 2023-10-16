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
import { getElementsByXrefId } from '../util/elements';
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
export function phaseResolveSanitizers(job) {
    for (const unit of job.units) {
        const elements = getElementsByXrefId(unit);
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
                        if (ownerOp === undefined) {
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
    return op.kind === ir.OpKind.ElementStart && op.tag.toLowerCase() === 'iframe';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVyRDs7R0FFRztBQUNILE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUF1QztJQUMvRCxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDNUYsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0lBQ3hGLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQztDQUMzRCxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUE0QjtJQUNqRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsSUFBSSxXQUFnQyxDQUFDO1FBQ3JDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztnQkFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLFdBQVcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxJQUFJLENBQUM7b0JBQ3pELEVBQUUsQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDdEUsa0ZBQWtGO29CQUNsRiwwRUFBMEU7b0JBQzFFLHNGQUFzRjtvQkFDdEYsYUFBYTtvQkFDYixJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO3dCQUN6QixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDeEMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFOzRCQUN6QixNQUFNLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO3lCQUMzRDt3QkFDRCxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7NEJBQ3RFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7eUJBQ3JFO3FCQUNGO29CQUNELE1BQU07YUFDVDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxFQUE0QjtJQUNuRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDakYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vLi4vLi4vLi4vY29yZSc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi8uLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2dldEVsZW1lbnRzQnlYcmVmSWR9IGZyb20gJy4uL3V0aWwvZWxlbWVudHMnO1xuXG4vKipcbiAqIE1hcHBpbmcgb2Ygc2VjdXJpdHkgY29udGV4dHMgdG8gc2FuaXRpemVyIGZ1bmN0aW9uIGZvciB0aGF0IGNvbnRleHQuXG4gKi9cbmNvbnN0IHNhbml0aXplcnMgPSBuZXcgTWFwPFNlY3VyaXR5Q29udGV4dCwgaXIuU2FuaXRpemVyRm58bnVsbD4oW1xuICBbU2VjdXJpdHlDb250ZXh0LkhUTUwsIGlyLlNhbml0aXplckZuLkh0bWxdLCBbU2VjdXJpdHlDb250ZXh0LlNDUklQVCwgaXIuU2FuaXRpemVyRm4uU2NyaXB0XSxcbiAgW1NlY3VyaXR5Q29udGV4dC5TVFlMRSwgaXIuU2FuaXRpemVyRm4uU3R5bGVdLCBbU2VjdXJpdHlDb250ZXh0LlVSTCwgaXIuU2FuaXRpemVyRm4uVXJsXSxcbiAgW1NlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwsIGlyLlNhbml0aXplckZuLlJlc291cmNlVXJsXVxuXSk7XG5cbi8qKlxuICogUmVzb2x2ZXMgc2FuaXRpemF0aW9uIGZ1bmN0aW9ucyBmb3Igb3BzIHRoYXQgbmVlZCB0aGVtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VSZXNvbHZlU2FuaXRpemVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGdldEVsZW1lbnRzQnlYcmVmSWQodW5pdCk7XG4gICAgbGV0IHNhbml0aXplckZuOiBpci5TYW5pdGl6ZXJGbnxudWxsO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICAgIHNhbml0aXplckZuID0gc2FuaXRpemVycy5nZXQob3Auc2VjdXJpdHlDb250ZXh0KSB8fCBudWxsO1xuICAgICAgICAgIG9wLnNhbml0aXplciA9IHNhbml0aXplckZuID8gbmV3IGlyLlNhbml0aXplckV4cHIoc2FuaXRpemVyRm4pIDogbnVsbDtcbiAgICAgICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0IG9mIGFuXG4gICAgICAgICAgLy8gYXR0cmlidXRlL3Byb3BlcnR5LCBjaGVjayB3aGV0aGVyIHRoaXMgYXR0cmlidXRlL3Byb3BlcnR5IGlzIG9uZSBvZiB0aGVcbiAgICAgICAgICAvLyBzZWN1cml0eS1zZW5zaXRpdmUgPGlmcmFtZT4gYXR0cmlidXRlcyAoYW5kIHRoYXQgdGhlIGN1cnJlbnQgZWxlbWVudCBpcyBhY3R1YWxseSBhblxuICAgICAgICAgIC8vIDxpZnJhbWU+KS5cbiAgICAgICAgICBpZiAob3Auc2FuaXRpemVyID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBvd25lck9wID0gZWxlbWVudHMuZ2V0KG9wLnRhcmdldCk7XG4gICAgICAgICAgICBpZiAob3duZXJPcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdQcm9wZXJ0eSBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2Ugb3duZXInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc0lmcmFtZUVsZW1lbnQob3duZXJPcCkgJiYgaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIob3AubmFtZSkpIHtcbiAgICAgICAgICAgICAgb3Auc2FuaXRpemVyID0gbmV3IGlyLlNhbml0aXplckV4cHIoaXIuU2FuaXRpemVyRm4uSWZyYW1lQXR0cmlidXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIG9wIHJlcHJlc2VudHMgYW4gaWZyYW1lIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGlzSWZyYW1lRWxlbWVudChvcDogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzKTogYm9vbGVhbiB7XG4gIHJldHVybiBvcC5raW5kID09PSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0ICYmIG9wLnRhZy50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJztcbn1cbiJdfQ==