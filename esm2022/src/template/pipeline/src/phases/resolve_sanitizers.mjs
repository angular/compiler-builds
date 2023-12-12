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
import { CompilationJobKind } from '../compilation';
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
        // For normal element bindings we create trusted values for security sensitive constant
        // attributes. However, for host bindings we skip this step (this matches what
        // TemplateDefinitionBuilder does).
        // TODO: Is the TDB behavior correct here?
        if (job.kind !== CompilationJobKind.Host) {
            for (const op of unit.create) {
                if (op.kind === ir.OpKind.ExtractedAttribute) {
                    const trustedValueFn = trustedValueFns.get(getOnlySecurityContext(op.securityContext)) ?? null;
                    op.trustedValueFn = trustedValueFn !== null ? o.importExpr(trustedValueFn) : null;
                }
            }
        }
        for (const op of unit.update) {
            switch (op.kind) {
                case ir.OpKind.Property:
                case ir.OpKind.Attribute:
                case ir.OpKind.HostProperty:
                    let sanitizerFn = null;
                    if (Array.isArray(op.securityContext) && op.securityContext.length === 2 &&
                        op.securityContext.indexOf(SecurityContext.URL) > -1 &&
                        op.securityContext.indexOf(SecurityContext.RESOURCE_URL) > -1) {
                        // When the host element isn't known, some URL attributes (such as "src" and "href") may
                        // be part of multiple different security contexts. In this case we use special
                        // sanitization function and select the actual sanitizer at runtime based on a tag name
                        // that is provided while invoking sanitization function.
                        sanitizerFn = Identifiers.sanitizeUrlOrResourceUrl;
                    }
                    else {
                        sanitizerFn = sanitizerFns.get(getOnlySecurityContext(op.securityContext)) ?? null;
                    }
                    op.sanitizer = sanitizerFn !== null ? o.importExpr(sanitizerFn) : null;
                    // If there was no sanitization function found based on the security context of an
                    // attribute/property, check whether this attribute/property is one of the
                    // security-sensitive <iframe> attributes (and that the current element is actually an
                    // <iframe>).
                    if (op.sanitizer === null) {
                        let isIframe = false;
                        if (job.kind === CompilationJobKind.Host || op.kind === ir.OpKind.HostProperty) {
                            // Note: for host bindings defined on a directive, we do not try to find all
                            // possible places where it can be matched, so we can not determine whether
                            // the host element is an <iframe>. In this case, we just assume it is and append a
                            // validation function, which is invoked at runtime and would have access to the
                            // underlying DOM element to check if it's an <iframe> and if so - run extra checks.
                            isIframe = true;
                        }
                        else {
                            // For a normal binding we can just check if the element its on is an iframe.
                            const ownerOp = elements.get(op.target);
                            if (ownerOp === undefined || !ir.isElementOrContainerOp(ownerOp)) {
                                throw Error('Property should have an element-like owner');
                            }
                            isIframe = isIframeElement(ownerOp);
                        }
                        if (isIframe && isIframeSecuritySensitiveAttr(op.name)) {
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
/**
 * Asserts that there is only a single security context and returns it.
 */
function getOnlySecurityContext(securityContext) {
    if (Array.isArray(securityContext)) {
        if (securityContext.length > 1) {
            // TODO: What should we do here? TDB just took the first one, but this feels like something we
            // would want to know about and create a special case for like we did for Url/ResourceUrl. My
            // guess is that, outside of the Url/ResourceUrl case, this never actually happens. If there
            // do turn out to be other cases, throwing an error until we can address it feels safer.
            throw Error(`AssertionError: Ambiguous security context`);
        }
        return securityContext[0] || SecurityContext.NONE;
    }
    return securityContext;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9zYW5pdGl6ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9zYW5pdGl6ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMvQixPQUFPLEVBQWlCLGtCQUFrQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDbEUsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRWpEOztHQUVHO0FBQ0gsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQXVDO0lBQ2pFLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsWUFBWSxDQUFDO0lBQ2hELENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsbUJBQW1CLENBQUM7SUFDL0QsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUM7SUFDcEQsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQztDQUNuRyxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUF1QztJQUNwRSxDQUFDLGVBQWUsQ0FBQyxJQUFJ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Y2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uLy4uLy4uLy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHJ9IGZyb20gJy4uLy4uLy4uLy4uL3NjaGVtYS9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBpbGF0aW9uSm9iS2luZH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHtjcmVhdGVPcFhyZWZNYXB9IGZyb20gJy4uL3V0aWwvZWxlbWVudHMnO1xuXG4vKipcbiAqIE1hcCBvZiBzZWN1cml0eSBjb250ZXh0cyB0byB0aGVpciBzYW5pdGl6ZXIgZnVuY3Rpb24uXG4gKi9cbmNvbnN0IHNhbml0aXplckZucyA9IG5ldyBNYXA8U2VjdXJpdHlDb250ZXh0LCBvLkV4dGVybmFsUmVmZXJlbmNlPihbXG4gIFtTZWN1cml0eUNvbnRleHQuSFRNTCwgSWRlbnRpZmllcnMuc2FuaXRpemVIdG1sXSxcbiAgW1NlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwsIElkZW50aWZpZXJzLnNhbml0aXplUmVzb3VyY2VVcmxdLFxuICBbU2VjdXJpdHlDb250ZXh0LlNDUklQVCwgSWRlbnRpZmllcnMuc2FuaXRpemVTY3JpcHRdLFxuICBbU2VjdXJpdHlDb250ZXh0LlNUWUxFLCBJZGVudGlmaWVycy5zYW5pdGl6ZVN0eWxlXSwgW1NlY3VyaXR5Q29udGV4dC5VUkwsIElkZW50aWZpZXJzLnNhbml0aXplVXJsXVxuXSk7XG5cbi8qKlxuICogTWFwIG9mIHNlY3VyaXR5IGNvbnRleHRzIHRvIHRoZWlyIHRydXN0ZWQgdmFsdWUgZnVuY3Rpb24uXG4gKi9cbmNvbnN0IHRydXN0ZWRWYWx1ZUZucyA9IG5ldyBNYXA8U2VjdXJpdHlDb250ZXh0LCBvLkV4dGVybmFsUmVmZXJlbmNlPihbXG4gIFtTZWN1cml0eUNvbnRleHQuSFRNTCwgSWRlbnRpZmllcnMudHJ1c3RDb25zdGFudEh0bWxdLFxuICBbU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCwgSWRlbnRpZmllcnMudHJ1c3RDb25zdGFudFJlc291cmNlVXJsXSxcbl0pO1xuXG4vKipcbiAqIFJlc29sdmVzIHNhbml0aXphdGlvbiBmdW5jdGlvbnMgZm9yIG9wcyB0aGF0IG5lZWQgdGhlbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6ZXJzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gY3JlYXRlT3BYcmVmTWFwKHVuaXQpO1xuXG4gICAgLy8gRm9yIG5vcm1hbCBlbGVtZW50IGJpbmRpbmdzIHdlIGNyZWF0ZSB0cnVzdGVkIHZhbHVlcyBmb3Igc2VjdXJpdHkgc2Vuc2l0aXZlIGNvbnN0YW50XG4gICAgLy8gYXR0cmlidXRlcy4gSG93ZXZlciwgZm9yIGhvc3QgYmluZGluZ3Mgd2Ugc2tpcCB0aGlzIHN0ZXAgKHRoaXMgbWF0Y2hlcyB3aGF0XG4gICAgLy8gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBkb2VzKS5cbiAgICAvLyBUT0RPOiBJcyB0aGUgVERCIGJlaGF2aW9yIGNvcnJlY3QgaGVyZT9cbiAgICBpZiAoam9iLmtpbmQgIT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlKSB7XG4gICAgICAgICAgY29uc3QgdHJ1c3RlZFZhbHVlRm4gPVxuICAgICAgICAgICAgICB0cnVzdGVkVmFsdWVGbnMuZ2V0KGdldE9ubHlTZWN1cml0eUNvbnRleHQob3Auc2VjdXJpdHlDb250ZXh0KSkgPz8gbnVsbDtcbiAgICAgICAgICBvcC50cnVzdGVkVmFsdWVGbiA9IHRydXN0ZWRWYWx1ZUZuICE9PSBudWxsID8gby5pbXBvcnRFeHByKHRydXN0ZWRWYWx1ZUZuKSA6IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgICAgICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsID0gbnVsbDtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvcC5zZWN1cml0eUNvbnRleHQpICYmIG9wLnNlY3VyaXR5Q29udGV4dC5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICAgICAgb3Auc2VjdXJpdHlDb250ZXh0LmluZGV4T2YoU2VjdXJpdHlDb250ZXh0LlVSTCkgPiAtMSAmJlxuICAgICAgICAgICAgICBvcC5zZWN1cml0eUNvbnRleHQuaW5kZXhPZihTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMKSA+IC0xKSB7XG4gICAgICAgICAgICAvLyBXaGVuIHRoZSBob3N0IGVsZW1lbnQgaXNuJ3Qga25vd24sIHNvbWUgVVJMIGF0dHJpYnV0ZXMgKHN1Y2ggYXMgXCJzcmNcIiBhbmQgXCJocmVmXCIpIG1heVxuICAgICAgICAgICAgLy8gYmUgcGFydCBvZiBtdWx0aXBsZSBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbFxuICAgICAgICAgICAgLy8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGFuZCBzZWxlY3QgdGhlIGFjdHVhbCBzYW5pdGl6ZXIgYXQgcnVudGltZSBiYXNlZCBvbiBhIHRhZyBuYW1lXG4gICAgICAgICAgICAvLyB0aGF0IGlzIHByb3ZpZGVkIHdoaWxlIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgICAgIHNhbml0aXplckZuID0gSWRlbnRpZmllcnMuc2FuaXRpemVVcmxPclJlc291cmNlVXJsO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzYW5pdGl6ZXJGbiA9IHNhbml0aXplckZucy5nZXQoZ2V0T25seVNlY3VyaXR5Q29udGV4dChvcC5zZWN1cml0eUNvbnRleHQpKSA/PyBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBzYW5pdGl6ZXJGbiAhPT0gbnVsbCA/IG8uaW1wb3J0RXhwcihzYW5pdGl6ZXJGbikgOiBudWxsO1xuXG4gICAgICAgICAgLy8gSWYgdGhlcmUgd2FzIG5vIHNhbml0aXphdGlvbiBmdW5jdGlvbiBmb3VuZCBiYXNlZCBvbiB0aGUgc2VjdXJpdHkgY29udGV4dCBvZiBhblxuICAgICAgICAgIC8vIGF0dHJpYnV0ZS9wcm9wZXJ0eSwgY2hlY2sgd2hldGhlciB0aGlzIGF0dHJpYnV0ZS9wcm9wZXJ0eSBpcyBvbmUgb2YgdGhlXG4gICAgICAgICAgLy8gc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMgKGFuZCB0aGF0IHRoZSBjdXJyZW50IGVsZW1lbnQgaXMgYWN0dWFsbHkgYW5cbiAgICAgICAgICAvLyA8aWZyYW1lPikuXG4gICAgICAgICAgaWYgKG9wLnNhbml0aXplciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgbGV0IGlzSWZyYW1lID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoam9iLmtpbmQgPT09IENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0IHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5Ib3N0UHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgLy8gTm90ZTogZm9yIGhvc3QgYmluZGluZ3MgZGVmaW5lZCBvbiBhIGRpcmVjdGl2ZSwgd2UgZG8gbm90IHRyeSB0byBmaW5kIGFsbFxuICAgICAgICAgICAgICAvLyBwb3NzaWJsZSBwbGFjZXMgd2hlcmUgaXQgY2FuIGJlIG1hdGNoZWQsIHNvIHdlIGNhbiBub3QgZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgICAgICAgICAgLy8gdGhlIGhvc3QgZWxlbWVudCBpcyBhbiA8aWZyYW1lPi4gSW4gdGhpcyBjYXNlLCB3ZSBqdXN0IGFzc3VtZSBpdCBpcyBhbmQgYXBwZW5kIGFcbiAgICAgICAgICAgICAgLy8gdmFsaWRhdGlvbiBmdW5jdGlvbiwgd2hpY2ggaXMgaW52b2tlZCBhdCBydW50aW1lIGFuZCB3b3VsZCBoYXZlIGFjY2VzcyB0byB0aGVcbiAgICAgICAgICAgICAgLy8gdW5kZXJseWluZyBET00gZWxlbWVudCB0byBjaGVjayBpZiBpdCdzIGFuIDxpZnJhbWU+IGFuZCBpZiBzbyAtIHJ1biBleHRyYSBjaGVja3MuXG4gICAgICAgICAgICAgIGlzSWZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEZvciBhIG5vcm1hbCBiaW5kaW5nIHdlIGNhbiBqdXN0IGNoZWNrIGlmIHRoZSBlbGVtZW50IGl0cyBvbiBpcyBhbiBpZnJhbWUuXG4gICAgICAgICAgICAgIGNvbnN0IG93bmVyT3AgPSBlbGVtZW50cy5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgICAgICAgaWYgKG93bmVyT3AgPT09IHVuZGVmaW5lZCB8fCAhaXIuaXNFbGVtZW50T3JDb250YWluZXJPcChvd25lck9wKSkge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdQcm9wZXJ0eSBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2Ugb3duZXInKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpc0lmcmFtZSA9IGlzSWZyYW1lRWxlbWVudChvd25lck9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc0lmcmFtZSAmJiBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cihvcC5uYW1lKSkge1xuICAgICAgICAgICAgICBvcC5zYW5pdGl6ZXIgPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gb3AgcmVwcmVzZW50cyBhbiBpZnJhbWUgZWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gaXNJZnJhbWVFbGVtZW50KG9wOiBpci5FbGVtZW50T3JDb250YWluZXJPcHMpOiBib29sZWFuIHtcbiAgcmV0dXJuIG9wLmtpbmQgPT09IGlyLk9wS2luZC5FbGVtZW50U3RhcnQgJiYgb3AudGFnPy50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJztcbn1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgdGhlcmUgaXMgb25seSBhIHNpbmdsZSBzZWN1cml0eSBjb250ZXh0IGFuZCByZXR1cm5zIGl0LlxuICovXG5mdW5jdGlvbiBnZXRPbmx5U2VjdXJpdHlDb250ZXh0KHNlY3VyaXR5Q29udGV4dDogU2VjdXJpdHlDb250ZXh0fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTZWN1cml0eUNvbnRleHRbXSk6IFNlY3VyaXR5Q29udGV4dCB7XG4gIGlmIChBcnJheS5pc0FycmF5KHNlY3VyaXR5Q29udGV4dCkpIHtcbiAgICBpZiAoc2VjdXJpdHlDb250ZXh0Lmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIFRPRE86IFdoYXQgc2hvdWxkIHdlIGRvIGhlcmU/IFREQiBqdXN0IHRvb2sgdGhlIGZpcnN0IG9uZSwgYnV0IHRoaXMgZmVlbHMgbGlrZSBzb21ldGhpbmcgd2VcbiAgICAgIC8vIHdvdWxkIHdhbnQgdG8ga25vdyBhYm91dCBhbmQgY3JlYXRlIGEgc3BlY2lhbCBjYXNlIGZvciBsaWtlIHdlIGRpZCBmb3IgVXJsL1Jlc291cmNlVXJsLiBNeVxuICAgICAgLy8gZ3Vlc3MgaXMgdGhhdCwgb3V0c2lkZSBvZiB0aGUgVXJsL1Jlc291cmNlVXJsIGNhc2UsIHRoaXMgbmV2ZXIgYWN0dWFsbHkgaGFwcGVucy4gSWYgdGhlcmVcbiAgICAgIC8vIGRvIHR1cm4gb3V0IHRvIGJlIG90aGVyIGNhc2VzLCB0aHJvd2luZyBhbiBlcnJvciB1bnRpbCB3ZSBjYW4gYWRkcmVzcyBpdCBmZWVscyBzYWZlci5cbiAgICAgIHRocm93IEVycm9yKGBBc3NlcnRpb25FcnJvcjogQW1iaWd1b3VzIHNlY3VyaXR5IGNvbnRleHRgKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlY3VyaXR5Q29udGV4dFswXSB8fCBTZWN1cml0eUNvbnRleHQuTk9ORTtcbiAgfVxuICByZXR1cm4gc2VjdXJpdHlDb250ZXh0O1xufVxuIl19