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
    return (op.kind === ir.OpKind.Element || op.kind === ir.OpKind.ElementStart) &&
        op.tag.toLowerCase() === 'iframe';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVyRDs7R0FFRztBQUNILE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUF1QztJQUMvRCxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDNUYsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0lBQ3hGLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQztDQUMzRCxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxHQUE0QjtJQUNqRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsSUFBSSxXQUFnQyxDQUFDO1FBQ3JDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztnQkFDeEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7b0JBQ3RCLFdBQVcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxJQUFJLENBQUM7b0JBQ3pELEVBQUUsQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDdEUsa0ZBQWtGO29CQUNsRiwwRUFBMEU7b0JBQzFFLHNGQUFzRjtvQkFDdEYsYUFBYTtvQkFDYixJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO3dCQUN6QixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDeEMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFOzRCQUN6QixNQUFNLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO3lCQUMzRDt3QkFDRCxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7NEJBQ3RFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7eUJBQ3JFO3FCQUNGO29CQUNELE1BQU07YUFDVDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxFQUE0QjtJQUNuRCxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO1FBQ3hFLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssUUFBUSxDQUFDO0FBQ3hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cn0gZnJvbSAnLi4vLi4vLi4vLi4vc2NoZW1hL2RvbV9zZWN1cml0eV9zY2hlbWEnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtnZXRFbGVtZW50c0J5WHJlZklkfSBmcm9tICcuLi91dGlsL2VsZW1lbnRzJztcblxuLyoqXG4gKiBNYXBwaW5nIG9mIHNlY3VyaXR5IGNvbnRleHRzIHRvIHNhbml0aXplciBmdW5jdGlvbiBmb3IgdGhhdCBjb250ZXh0LlxuICovXG5jb25zdCBzYW5pdGl6ZXJzID0gbmV3IE1hcDxTZWN1cml0eUNvbnRleHQsIGlyLlNhbml0aXplckZufG51bGw+KFtcbiAgW1NlY3VyaXR5Q29udGV4dC5IVE1MLCBpci5TYW5pdGl6ZXJGbi5IdG1sXSwgW1NlY3VyaXR5Q29udGV4dC5TQ1JJUFQsIGlyLlNhbml0aXplckZuLlNjcmlwdF0sXG4gIFtTZWN1cml0eUNvbnRleHQuU1RZTEUsIGlyLlNhbml0aXplckZuLlN0eWxlXSwgW1NlY3VyaXR5Q29udGV4dC5VUkwsIGlyLlNhbml0aXplckZuLlVybF0sXG4gIFtTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMLCBpci5TYW5pdGl6ZXJGbi5SZXNvdXJjZVVybF1cbl0pO1xuXG4vKipcbiAqIFJlc29sdmVzIHNhbml0aXphdGlvbiBmdW5jdGlvbnMgZm9yIG9wcyB0aGF0IG5lZWQgdGhlbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZVNhbml0aXplcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBnZXRFbGVtZW50c0J5WHJlZklkKHVuaXQpO1xuICAgIGxldCBzYW5pdGl6ZXJGbjogaXIuU2FuaXRpemVyRm58bnVsbDtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgICBzYW5pdGl6ZXJGbiA9IHNhbml0aXplcnMuZ2V0KG9wLnNlY3VyaXR5Q29udGV4dCkgfHwgbnVsbDtcbiAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBzYW5pdGl6ZXJGbiA/IG5ldyBpci5TYW5pdGl6ZXJFeHByKHNhbml0aXplckZuKSA6IG51bGw7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgd2FzIG5vIHNhbml0aXphdGlvbiBmdW5jdGlvbiBmb3VuZCBiYXNlZCBvbiB0aGUgc2VjdXJpdHkgY29udGV4dCBvZiBhblxuICAgICAgICAgIC8vIGF0dHJpYnV0ZS9wcm9wZXJ0eSwgY2hlY2sgd2hldGhlciB0aGlzIGF0dHJpYnV0ZS9wcm9wZXJ0eSBpcyBvbmUgb2YgdGhlXG4gICAgICAgICAgLy8gc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMgKGFuZCB0aGF0IHRoZSBjdXJyZW50IGVsZW1lbnQgaXMgYWN0dWFsbHkgYW5cbiAgICAgICAgICAvLyA8aWZyYW1lPikuXG4gICAgICAgICAgaWYgKG9wLnNhbml0aXplciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3Qgb3duZXJPcCA9IGVsZW1lbnRzLmdldChvcC50YXJnZXQpO1xuICAgICAgICAgICAgaWYgKG93bmVyT3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignUHJvcGVydHkgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIG93bmVyJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaXNJZnJhbWVFbGVtZW50KG93bmVyT3ApICYmIGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKG9wLm5hbWUpKSB7XG4gICAgICAgICAgICAgIG9wLnNhbml0aXplciA9IG5ldyBpci5TYW5pdGl6ZXJFeHByKGlyLlNhbml0aXplckZuLklmcmFtZUF0dHJpYnV0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBvcCByZXByZXNlbnRzIGFuIGlmcmFtZSBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBpc0lmcmFtZUVsZW1lbnQob3A6IGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKG9wLmtpbmQgPT09IGlyLk9wS2luZC5FbGVtZW50IHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5FbGVtZW50U3RhcnQpICYmXG4gICAgICBvcC50YWcudG9Mb3dlckNhc2UoKSA9PT0gJ2lmcmFtZSc7XG59XG4iXX0=