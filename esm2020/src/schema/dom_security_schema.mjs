/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../core';
// =================================================================================================
// =================================================================================================
// =========== S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P  ===========
// =================================================================================================
// =================================================================================================
//
//        DO NOT EDIT THIS LIST OF SECURITY SENSITIVE PROPERTIES WITHOUT A SECURITY REVIEW!
//                               Reach out to mprobst for details.
//
// =================================================================================================
/** Map from tagName|propertyName to SecurityContext. Properties applying to all tags use '*'. */
let _SECURITY_SCHEMA;
export function SECURITY_SCHEMA() {
    if (!_SECURITY_SCHEMA) {
        _SECURITY_SCHEMA = {};
        // Case is insignificant below, all element and attribute names are lower-cased for lookup.
        registerContext(SecurityContext.HTML, [
            'iframe|srcdoc',
            '*|innerHTML',
            '*|outerHTML',
        ]);
        registerContext(SecurityContext.STYLE, ['*|style']);
        // NB: no SCRIPT contexts here, they are never allowed due to the parser stripping them.
        registerContext(SecurityContext.URL, [
            '*|formAction',
            'area|href',
            'area|ping',
            'audio|src',
            'a|href',
            'a|ping',
            'blockquote|cite',
            'body|background',
            'del|cite',
            'form|action',
            'img|src',
            'input|src',
            'ins|cite',
            'q|cite',
            'source|src',
            'track|src',
            'video|poster',
            'video|src',
        ]);
        registerContext(SecurityContext.RESOURCE_URL, [
            'applet|code',
            'applet|codebase',
            'base|href',
            'embed|src',
            'frame|src',
            'head|profile',
            'html|manifest',
            'iframe|src',
            'link|href',
            'media|src',
            'object|codebase',
            'object|data',
            'script|src',
        ]);
    }
    return _SECURITY_SCHEMA;
}
function registerContext(ctx, specs) {
    for (const spec of specs)
        _SECURITY_SCHEMA[spec.toLowerCase()] = ctx;
}
/**
 * The set of security-sensitive attributes of an `<iframe>` that *must* be
 * applied before setting the `src` or `srcdoc` attribute value.
 * This ensures that all security-sensitive attributes are taken into account
 * while creating an instance of an `<iframe>` at runtime.
 *
 * Keep this list in sync with the `IFRAME_SECURITY_SENSITIVE_ATTRS` token
 * from the `packages/core/src/sanitization/iframe_attrs_validation.ts` script.
 *
 * Avoid using this set directly, use the `isIframeSecuritySensitiveAttr` function
 * in the code instead.
 */
export const IFRAME_SECURITY_SENSITIVE_ATTRS = new Set(['sandbox', 'allow', 'allowfullscreen', 'referrerpolicy', 'loading', 'csp', 'fetchpriority']);
/**
 * Checks whether a given attribute name might represent a security-sensitive
 * attribute of an <iframe>.
 */
export function isIframeSecuritySensitiveAttr(attrName) {
    // The `setAttribute` DOM API is case-insensitive, so we lowercase the value
    // before checking it against a known security-sensitive attributes.
    return IFRAME_SECURITY_SENSITIVE_ATTRS.has(attrName.toLowerCase());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3NlY3VyaXR5X3NjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXhDLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsRUFBRTtBQUNGLDJGQUEyRjtBQUMzRixrRUFBa0U7QUFDbEUsRUFBRTtBQUNGLG9HQUFvRztBQUVwRyxpR0FBaUc7QUFDakcsSUFBSSxnQkFBaUQsQ0FBQztBQUV0RCxNQUFNLFVBQVUsZUFBZTtJQUM3QixJQUFJLENBQUMsZ0JBQWdCLEVBQUU7UUFDckIsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLDJGQUEyRjtRQUUzRixlQUFlLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRTtZQUNwQyxlQUFlO1lBQ2YsYUFBYTtZQUNiLGFBQWE7U0FDZCxDQUFDLENBQUM7UUFDSCxlQUFlLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsd0ZBQXdGO1FBQ3hGLGVBQWUsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFO1lBQ25DLGNBQWM7WUFDZCxXQUFXO1lBQ1gsV0FBVztZQUNYLFdBQVc7WUFDWCxRQUFRO1lBQ1IsUUFBUTtZQUNSLGlCQUFpQjtZQUNqQixpQkFBaUI7WUFDakIsVUFBVTtZQUNWLGFBQWE7WUFDYixTQUFTO1lBQ1QsV0FBVztZQUNYLFVBQVU7WUFDVixRQUFRO1lBQ1IsWUFBWTtZQUNaLFdBQVc7WUFDWCxjQUFjO1lBQ2QsV0FBVztTQUNaLENBQUMsQ0FBQztRQUNILGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFO1lBQzVDLGFBQWE7WUFDYixpQkFBaUI7WUFDakIsV0FBVztZQUNYLFdBQVc7WUFDWCxXQUFXO1lBQ1gsY0FBYztZQUNkLGVBQWU7WUFDZixZQUFZO1lBQ1osV0FBVztZQUNYLFdBQVc7WUFDWCxpQkFBaUI7WUFDakIsYUFBYTtZQUNiLFlBQVk7U0FDYixDQUFDLENBQUM7S0FDSjtJQUNELE9BQU8sZ0JBQWdCLENBQUM7QUFDMUIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEdBQW9CLEVBQUUsS0FBZTtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUs7UUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDdkUsQ0FBQztBQUVEOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sK0JBQStCLEdBQUcsSUFBSSxHQUFHLENBQ2xELENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7QUFFbEc7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDZCQUE2QixDQUFDLFFBQWdCO0lBQzVELDRFQUE0RTtJQUM1RSxvRUFBb0U7SUFDcEUsT0FBTywrQkFBK0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDckUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09IFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgPT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyAgICAgICAgRE8gTk9UIEVESVQgVEhJUyBMSVNUIE9GIFNFQ1VSSVRZIFNFTlNJVElWRSBQUk9QRVJUSUVTIFdJVEhPVVQgQSBTRUNVUklUWSBSRVZJRVchXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZWFjaCBvdXQgdG8gbXByb2JzdCBmb3IgZGV0YWlscy5cbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiBNYXAgZnJvbSB0YWdOYW1lfHByb3BlcnR5TmFtZSB0byBTZWN1cml0eUNvbnRleHQuIFByb3BlcnRpZXMgYXBwbHlpbmcgdG8gYWxsIHRhZ3MgdXNlICcqJy4gKi9cbmxldCBfU0VDVVJJVFlfU0NIRU1BIToge1trOiBzdHJpbmddOiBTZWN1cml0eUNvbnRleHR9O1xuXG5leHBvcnQgZnVuY3Rpb24gU0VDVVJJVFlfU0NIRU1BKCk6IHtbazogc3RyaW5nXTogU2VjdXJpdHlDb250ZXh0fSB7XG4gIGlmICghX1NFQ1VSSVRZX1NDSEVNQSkge1xuICAgIF9TRUNVUklUWV9TQ0hFTUEgPSB7fTtcbiAgICAvLyBDYXNlIGlzIGluc2lnbmlmaWNhbnQgYmVsb3csIGFsbCBlbGVtZW50IGFuZCBhdHRyaWJ1dGUgbmFtZXMgYXJlIGxvd2VyLWNhc2VkIGZvciBsb29rdXAuXG5cbiAgICByZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LkhUTUwsIFtcbiAgICAgICdpZnJhbWV8c3JjZG9jJyxcbiAgICAgICcqfGlubmVySFRNTCcsXG4gICAgICAnKnxvdXRlckhUTUwnLFxuICAgIF0pO1xuICAgIHJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuU1RZTEUsIFsnKnxzdHlsZSddKTtcbiAgICAvLyBOQjogbm8gU0NSSVBUIGNvbnRleHRzIGhlcmUsIHRoZXkgYXJlIG5ldmVyIGFsbG93ZWQgZHVlIHRvIHRoZSBwYXJzZXIgc3RyaXBwaW5nIHRoZW0uXG4gICAgcmVnaXN0ZXJDb250ZXh0KFNlY3VyaXR5Q29udGV4dC5VUkwsIFtcbiAgICAgICcqfGZvcm1BY3Rpb24nLFxuICAgICAgJ2FyZWF8aHJlZicsXG4gICAgICAnYXJlYXxwaW5nJyxcbiAgICAgICdhdWRpb3xzcmMnLFxuICAgICAgJ2F8aHJlZicsXG4gICAgICAnYXxwaW5nJyxcbiAgICAgICdibG9ja3F1b3RlfGNpdGUnLFxuICAgICAgJ2JvZHl8YmFja2dyb3VuZCcsXG4gICAgICAnZGVsfGNpdGUnLFxuICAgICAgJ2Zvcm18YWN0aW9uJyxcbiAgICAgICdpbWd8c3JjJyxcbiAgICAgICdpbnB1dHxzcmMnLFxuICAgICAgJ2luc3xjaXRlJyxcbiAgICAgICdxfGNpdGUnLFxuICAgICAgJ3NvdXJjZXxzcmMnLFxuICAgICAgJ3RyYWNrfHNyYycsXG4gICAgICAndmlkZW98cG9zdGVyJyxcbiAgICAgICd2aWRlb3xzcmMnLFxuICAgIF0pO1xuICAgIHJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMLCBbXG4gICAgICAnYXBwbGV0fGNvZGUnLFxuICAgICAgJ2FwcGxldHxjb2RlYmFzZScsXG4gICAgICAnYmFzZXxocmVmJyxcbiAgICAgICdlbWJlZHxzcmMnLFxuICAgICAgJ2ZyYW1lfHNyYycsXG4gICAgICAnaGVhZHxwcm9maWxlJyxcbiAgICAgICdodG1sfG1hbmlmZXN0JyxcbiAgICAgICdpZnJhbWV8c3JjJyxcbiAgICAgICdsaW5rfGhyZWYnLFxuICAgICAgJ21lZGlhfHNyYycsXG4gICAgICAnb2JqZWN0fGNvZGViYXNlJyxcbiAgICAgICdvYmplY3R8ZGF0YScsXG4gICAgICAnc2NyaXB0fHNyYycsXG4gICAgXSk7XG4gIH1cbiAgcmV0dXJuIF9TRUNVUklUWV9TQ0hFTUE7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ29udGV4dChjdHg6IFNlY3VyaXR5Q29udGV4dCwgc3BlY3M6IHN0cmluZ1tdKSB7XG4gIGZvciAoY29uc3Qgc3BlYyBvZiBzcGVjcykgX1NFQ1VSSVRZX1NDSEVNQVtzcGVjLnRvTG93ZXJDYXNlKCldID0gY3R4O1xufVxuXG4vKipcbiAqIFRoZSBzZXQgb2Ygc2VjdXJpdHktc2Vuc2l0aXZlIGF0dHJpYnV0ZXMgb2YgYW4gYDxpZnJhbWU+YCB0aGF0ICptdXN0KiBiZVxuICogYXBwbGllZCBiZWZvcmUgc2V0dGluZyB0aGUgYHNyY2Agb3IgYHNyY2RvY2AgYXR0cmlidXRlIHZhbHVlLlxuICogVGhpcyBlbnN1cmVzIHRoYXQgYWxsIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGVzIGFyZSB0YWtlbiBpbnRvIGFjY291bnRcbiAqIHdoaWxlIGNyZWF0aW5nIGFuIGluc3RhbmNlIG9mIGFuIGA8aWZyYW1lPmAgYXQgcnVudGltZS5cbiAqXG4gKiBLZWVwIHRoaXMgbGlzdCBpbiBzeW5jIHdpdGggdGhlIGBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTYCB0b2tlblxuICogZnJvbSB0aGUgYHBhY2thZ2VzL2NvcmUvc3JjL3Nhbml0aXphdGlvbi9pZnJhbWVfYXR0cnNfdmFsaWRhdGlvbi50c2Agc2NyaXB0LlxuICpcbiAqIEF2b2lkIHVzaW5nIHRoaXMgc2V0IGRpcmVjdGx5LCB1c2UgdGhlIGBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cmAgZnVuY3Rpb25cbiAqIGluIHRoZSBjb2RlIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBjb25zdCBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTID0gbmV3IFNldChcbiAgICBbJ3NhbmRib3gnLCAnYWxsb3cnLCAnYWxsb3dmdWxsc2NyZWVuJywgJ3JlZmVycmVycG9saWN5JywgJ2xvYWRpbmcnLCAnY3NwJywgJ2ZldGNocHJpb3JpdHknXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBhdHRyaWJ1dGUgbmFtZSBtaWdodCByZXByZXNlbnQgYSBzZWN1cml0eS1zZW5zaXRpdmVcbiAqIGF0dHJpYnV0ZSBvZiBhbiA8aWZyYW1lPi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKGF0dHJOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gVGhlIGBzZXRBdHRyaWJ1dGVgIERPTSBBUEkgaXMgY2FzZS1pbnNlbnNpdGl2ZSwgc28gd2UgbG93ZXJjYXNlIHRoZSB2YWx1ZVxuICAvLyBiZWZvcmUgY2hlY2tpbmcgaXQgYWdhaW5zdCBhIGtub3duIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGVzLlxuICByZXR1cm4gSUZSQU1FX1NFQ1VSSVRZX1NFTlNJVElWRV9BVFRSUy5oYXMoYXR0ck5hbWUudG9Mb3dlckNhc2UoKSk7XG59XG4iXX0=