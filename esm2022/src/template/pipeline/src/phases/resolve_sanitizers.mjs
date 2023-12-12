/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../../../../core';
import * as o from '../../../../output/output_ast';
import { Identifiers } from '../../../../render3/r3_identifiers';
import { isIframeSecuritySensitiveAttr } from '../../../../schema/dom_security_schema';
import * as ir from '../../ir';
import { createOpXrefMap } from '../util/elements';
/**
 * Map of security contexts to their sanitizer function.
 */
const sanitizerFns = new Map([
    [SecurityContext.HTML, Identifiers.sanitizeHtml],
    [SecurityContext.RESOURCE_URL, Identifiers.sanitizeResourceUrl],
    [SecurityContext.SCRIPT, Identifiers.sanitizeScript],
    [SecurityContext.STYLE, Identifiers.sanitizeStyle], [SecurityContext.URL, Identifiers.sanitizeUrl]
]);
/**
 * Map of security contexts to their trusted value function.
 */
const trustedValueFns = new Map([
    [SecurityContext.HTML, Identifiers.trustConstantHtml],
    [SecurityContext.RESOURCE_URL, Identifiers.trustConstantResourceUrl],
]);
/**
 * Resolves sanitization functions for ops that need them.
 */
export function resolveSanitizers(job) {
    for (const unit of job.units) {
        const elements = createOpXrefMap(unit);
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.ExtractedAttribute) {
                const trustedValueFn = trustedValueFns.get(op.securityContext) ?? null;
                op.trustedValueFn = trustedValueFn !== null ? o.importExpr(trustedValueFn) : null;
            }
        }
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                    const sanitizerFn = sanitizerFns.get(op.securityContext) ?? null;
                    op.sanitizer = sanitizerFn !== null ? o.importExpr(sanitizerFn) : null;
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
                            op.sanitizer = o.importExpr(Identifiers.validateIframeAttribute);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUUvQixPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFakQ7O0dBRUc7QUFDSCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBdUM7SUFDakUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxZQUFZLENBQUM7SUFDaEQsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUMvRCxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLGNBQWMsQ0FBQztJQUNwRCxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDO0NBQ25HLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQXVDO0lBQ3BFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsaUJBQWlCLENBQUM7SUFDckQsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQztDQUNyRSxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUE0QjtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRTtnQkFDNUMsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksSUFBSSxDQUFDO2dCQUN2RSxFQUFFLENBQUMsY0FBYyxHQUFHLGNBQWMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzthQUNuRjtTQUNGO1FBRUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO2dCQUN4QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztvQkFDdEIsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksSUFBSSxDQUFDO29CQUNqRSxFQUFFLENBQUMsU0FBUyxHQUFHLFdBQVcsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztvQkFDdkUsa0ZBQWtGO29CQUNsRiwwRUFBMEU7b0JBQzFFLHNGQUFzRjtvQkFDdEYsYUFBYTtvQkFDYixJQUFJLEVBQUUsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO3dCQUN6QixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDeEMsSUFBSSxPQUFPLEtBQUssU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxFQUFFOzRCQUNoRSxNQUFNLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO3lCQUMzRDt3QkFDRCxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7NEJBQ3RFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsdUJBQXVCLENBQUMsQ0FBQzt5QkFDbEU7cUJBQ0Y7b0JBQ0QsTUFBTTthQUNUO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsZUFBZSxDQUFDLEVBQTRCO0lBQ25ELE9BQU8sRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNsRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi8uLi8uLi8uLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi8uLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5pbXBvcnQge2NyZWF0ZU9wWHJlZk1hcH0gZnJvbSAnLi4vdXRpbC9lbGVtZW50cyc7XG5cbi8qKlxuICogTWFwIG9mIHNlY3VyaXR5IGNvbnRleHRzIHRvIHRoZWlyIHNhbml0aXplciBmdW5jdGlvbi5cbiAqL1xuY29uc3Qgc2FuaXRpemVyRm5zID0gbmV3IE1hcDxTZWN1cml0eUNvbnRleHQsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFtcbiAgW1NlY3VyaXR5Q29udGV4dC5IVE1MLCBJZGVudGlmaWVycy5zYW5pdGl6ZUh0bWxdLFxuICBbU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCwgSWRlbnRpZmllcnMuc2FuaXRpemVSZXNvdXJjZVVybF0sXG4gIFtTZWN1cml0eUNvbnRleHQuU0NSSVBULCBJZGVudGlmaWVycy5zYW5pdGl6ZVNjcmlwdF0sXG4gIFtTZWN1cml0eUNvbnRleHQuU1RZTEUsIElkZW50aWZpZXJzLnNhbml0aXplU3R5bGVdLCBbU2VjdXJpdHlDb250ZXh0LlVSTCwgSWRlbnRpZmllcnMuc2FuaXRpemVVcmxdXG5dKTtcblxuLyoqXG4gKiBNYXAgb2Ygc2VjdXJpdHkgY29udGV4dHMgdG8gdGhlaXIgdHJ1c3RlZCB2YWx1ZSBmdW5jdGlvbi5cbiAqL1xuY29uc3QgdHJ1c3RlZFZhbHVlRm5zID0gbmV3IE1hcDxTZWN1cml0eUNvbnRleHQsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFtcbiAgW1NlY3VyaXR5Q29udGV4dC5IVE1MLCBJZGVudGlmaWVycy50cnVzdENvbnN0YW50SHRtbF0sXG4gIFtTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMLCBJZGVudGlmaWVycy50cnVzdENvbnN0YW50UmVzb3VyY2VVcmxdLFxuXSk7XG5cbi8qKlxuICogUmVzb2x2ZXMgc2FuaXRpemF0aW9uIGZ1bmN0aW9ucyBmb3Igb3BzIHRoYXQgbmVlZCB0aGVtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXplcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBjcmVhdGVPcFhyZWZNYXAodW5pdCk7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCB0cnVzdGVkVmFsdWVGbiA9IHRydXN0ZWRWYWx1ZUZucy5nZXQob3Auc2VjdXJpdHlDb250ZXh0KSA/PyBudWxsO1xuICAgICAgICBvcC50cnVzdGVkVmFsdWVGbiA9IHRydXN0ZWRWYWx1ZUZuICE9PSBudWxsID8gby5pbXBvcnRFeHByKHRydXN0ZWRWYWx1ZUZuKSA6IG51bGw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemVyRm4gPSBzYW5pdGl6ZXJGbnMuZ2V0KG9wLnNlY3VyaXR5Q29udGV4dCkgPz8gbnVsbDtcbiAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBzYW5pdGl6ZXJGbiAhPT0gbnVsbCA/IG8uaW1wb3J0RXhwcihzYW5pdGl6ZXJGbikgOiBudWxsO1xuICAgICAgICAgIC8vIElmIHRoZXJlIHdhcyBubyBzYW5pdGl6YXRpb24gZnVuY3Rpb24gZm91bmQgYmFzZWQgb24gdGhlIHNlY3VyaXR5IGNvbnRleHQgb2YgYW5cbiAgICAgICAgICAvLyBhdHRyaWJ1dGUvcHJvcGVydHksIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXMgb25lIG9mIHRoZVxuICAgICAgICAgIC8vIHNlY3VyaXR5LXNlbnNpdGl2ZSA8aWZyYW1lPiBhdHRyaWJ1dGVzIChhbmQgdGhhdCB0aGUgY3VycmVudCBlbGVtZW50IGlzIGFjdHVhbGx5IGFuXG4gICAgICAgICAgLy8gPGlmcmFtZT4pLlxuICAgICAgICAgIGlmIChvcC5zYW5pdGl6ZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG93bmVyT3AgPSBlbGVtZW50cy5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgICAgIGlmIChvd25lck9wID09PSB1bmRlZmluZWQgfHwgIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3duZXJPcCkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1Byb3BlcnR5IHNob3VsZCBoYXZlIGFuIGVsZW1lbnQtbGlrZSBvd25lcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzSWZyYW1lRWxlbWVudChvd25lck9wKSAmJiBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cihvcC5uYW1lKSkge1xuICAgICAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gb3AgcmVwcmVzZW50cyBhbiBpZnJhbWUgZWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gaXNJZnJhbWVFbGVtZW50KG9wOiBpci5FbGVtZW50T3JDb250YWluZXJPcHMpOiBib29sZWFuIHtcbiAgcmV0dXJuIG9wLmtpbmQgPT09IGlyLk9wS2luZC5FbGVtZW50U3RhcnQgJiYgb3AudGFnPy50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJztcbn1cbiJdfQ==