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
export function phaseResolveSanitizers(job) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFakQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBdUM7SUFDL0QsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQzVGLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztJQUN4RixDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUM7Q0FDM0QsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsR0FBNEI7SUFDakUsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLFdBQWdDLENBQUM7UUFDckMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO2dCQUN4QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsV0FBVyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksQ0FBQztvQkFDekQsRUFBRSxDQUFDLFNBQVMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUN0RSxrRkFBa0Y7b0JBQ2xGLDBFQUEwRTtvQkFDMUUsc0ZBQXNGO29CQUN0RixhQUFhO29CQUNiLElBQUksRUFBRSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7d0JBQ3pCLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUN4QyxJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLEVBQUU7NEJBQ2hFLE1BQU0sS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7eUJBQzNEO3dCQUNELElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxJQUFJLDZCQUE2QixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTs0QkFDdEUsRUFBRSxDQUFDLFNBQVMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQzt5QkFDckU7cUJBQ0Y7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLEVBQTRCO0lBQ25ELE9BQU8sRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNsRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi8uLi8uLi8uLi9jb3JlJztcbmltcG9ydCB7aXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHJ9IGZyb20gJy4uLy4uLy4uLy4uL3NjaGVtYS9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7Y3JlYXRlT3BYcmVmTWFwfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBNYXBwaW5nIG9mIHNlY3VyaXR5IGNvbnRleHRzIHRvIHNhbml0aXplciBmdW5jdGlvbiBmb3IgdGhhdCBjb250ZXh0LlxuICovXG5jb25zdCBzYW5pdGl6ZXJzID0gbmV3IE1hcDxTZWN1cml0eUNvbnRleHQsIGlyLlNhbml0aXplckZufG51bGw+KFtcbiAgW1NlY3VyaXR5Q29udGV4dC5IVE1MLCBpci5TYW5pdGl6ZXJGbi5IdG1sXSwgW1NlY3VyaXR5Q29udGV4dC5TQ1JJUFQsIGlyLlNhbml0aXplckZuLlNjcmlwdF0sXG4gIFtTZWN1cml0eUNvbnRleHQuU1RZTEUsIGlyLlNhbml0aXplckZuLlN0eWxlXSwgW1NlY3VyaXR5Q29udGV4dC5VUkwsIGlyLlNhbml0aXplckZuLlVybF0sXG4gIFtTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMLCBpci5TYW5pdGl6ZXJGbi5SZXNvdXJjZVVybF1cbl0pO1xuXG4vKipcbiAqIFJlc29sdmVzIHNhbml0aXphdGlvbiBmdW5jdGlvbnMgZm9yIG9wcyB0aGF0IG5lZWQgdGhlbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZVNhbml0aXplcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBjcmVhdGVPcFhyZWZNYXAodW5pdCk7XG4gICAgbGV0IHNhbml0aXplckZuOiBpci5TYW5pdGl6ZXJGbnxudWxsO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICAgIHNhbml0aXplckZuID0gc2FuaXRpemVycy5nZXQob3Auc2VjdXJpdHlDb250ZXh0KSB8fCBudWxsO1xuICAgICAgICAgIG9wLnNhbml0aXplciA9IHNhbml0aXplckZuID8gbmV3IGlyLlNhbml0aXplckV4cHIoc2FuaXRpemVyRm4pIDogbnVsbDtcbiAgICAgICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0IG9mIGFuXG4gICAgICAgICAgLy8gYXR0cmlidXRlL3Byb3BlcnR5LCBjaGVjayB3aGV0aGVyIHRoaXMgYXR0cmlidXRlL3Byb3BlcnR5IGlzIG9uZSBvZiB0aGVcbiAgICAgICAgICAvLyBzZWN1cml0eS1zZW5zaXRpdmUgPGlmcmFtZT4gYXR0cmlidXRlcyAoYW5kIHRoYXQgdGhlIGN1cnJlbnQgZWxlbWVudCBpcyBhY3R1YWxseSBhblxuICAgICAgICAgIC8vIDxpZnJhbWU+KS5cbiAgICAgICAgICBpZiAob3Auc2FuaXRpemVyID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBvd25lck9wID0gZWxlbWVudHMuZ2V0KG9wLnRhcmdldCk7XG4gICAgICAgICAgICBpZiAob3duZXJPcCA9PT0gdW5kZWZpbmVkIHx8ICFpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG93bmVyT3ApKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdQcm9wZXJ0eSBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2Ugb3duZXInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc0lmcmFtZUVsZW1lbnQob3duZXJPcCkgJiYgaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIob3AubmFtZSkpIHtcbiAgICAgICAgICAgICAgb3Auc2FuaXRpemVyID0gbmV3IGlyLlNhbml0aXplckV4cHIoaXIuU2FuaXRpemVyRm4uSWZyYW1lQXR0cmlidXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIG9wIHJlcHJlc2VudHMgYW4gaWZyYW1lIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGlzSWZyYW1lRWxlbWVudChvcDogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzKTogYm9vbGVhbiB7XG4gIHJldHVybiBvcC5raW5kID09PSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0ICYmIG9wLnRhZz8udG9Mb3dlckNhc2UoKSA9PT0gJ2lmcmFtZSc7XG59XG4iXX0=