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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3NlY3VyaXR5X3NjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXhDLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsRUFBRTtBQUNGLDJGQUEyRjtBQUMzRixrRUFBa0U7QUFDbEUsRUFBRTtBQUNGLG9HQUFvRztBQUVwRyxpR0FBaUc7QUFDakcsSUFBSSxnQkFBaUQsQ0FBQztBQUV0RCxNQUFNLFVBQVUsZUFBZTtJQUM3QixJQUFJLENBQUMsZ0JBQWdCLEVBQUU7UUFDckIsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLDJGQUEyRjtRQUUzRixlQUFlLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRTtZQUNwQyxlQUFlO1lBQ2YsYUFBYTtZQUNiLGFBQWE7U0FDZCxDQUFDLENBQUM7UUFDSCxlQUFlLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsd0ZBQXdGO1FBQ3hGLGVBQWUsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFO1lBQ25DLGNBQWM7WUFDZCxXQUFXO1lBQ1gsV0FBVztZQUNYLFdBQVc7WUFDWCxRQUFRO1lBQ1IsUUFBUTtZQUNSLGlCQUFpQjtZQUNqQixpQkFBaUI7WUFDakIsVUFBVTtZQUNWLGFBQWE7WUFDYixTQUFTO1lBQ1QsV0FBVztZQUNYLFVBQVU7WUFDVixRQUFRO1lBQ1IsWUFBWTtZQUNaLFdBQVc7WUFDWCxjQUFjO1lBQ2QsV0FBVztTQUNaLENBQUMsQ0FBQztRQUNILGVBQWUsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFO1lBQzVDLGFBQWE7WUFDYixpQkFBaUI7WUFDakIsV0FBVztZQUNYLFdBQVc7WUFDWCxXQUFXO1lBQ1gsY0FBYztZQUNkLGVBQWU7WUFDZixZQUFZO1lBQ1osV0FBVztZQUNYLFdBQVc7WUFDWCxpQkFBaUI7WUFDakIsYUFBYTtZQUNiLFlBQVk7U0FDYixDQUFDLENBQUM7S0FDSjtJQUNELE9BQU8sZ0JBQWdCLENBQUM7QUFDMUIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEdBQW9CLEVBQUUsS0FBZTtJQUM1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUs7UUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09IFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgPT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyAgICAgICAgRE8gTk9UIEVESVQgVEhJUyBMSVNUIE9GIFNFQ1VSSVRZIFNFTlNJVElWRSBQUk9QRVJUSUVTIFdJVEhPVVQgQSBTRUNVUklUWSBSRVZJRVchXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZWFjaCBvdXQgdG8gbXByb2JzdCBmb3IgZGV0YWlscy5cbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiBNYXAgZnJvbSB0YWdOYW1lfHByb3BlcnR5TmFtZSB0byBTZWN1cml0eUNvbnRleHQuIFByb3BlcnRpZXMgYXBwbHlpbmcgdG8gYWxsIHRhZ3MgdXNlICcqJy4gKi9cbmxldCBfU0VDVVJJVFlfU0NIRU1BIToge1trOiBzdHJpbmddOiBTZWN1cml0eUNvbnRleHR9O1xuXG5leHBvcnQgZnVuY3Rpb24gU0VDVVJJVFlfU0NIRU1BKCk6IHtbazogc3RyaW5nXTogU2VjdXJpdHlDb250ZXh0fSB7XG4gIGlmICghX1NFQ1VSSVRZX1NDSEVNQSkge1xuICAgIF9TRUNVUklUWV9TQ0hFTUEgPSB7fTtcbiAgICAvLyBDYXNlIGlzIGluc2lnbmlmaWNhbnQgYmVsb3csIGFsbCBlbGVtZW50IGFuZCBhdHRyaWJ1dGUgbmFtZXMgYXJlIGxvd2VyLWNhc2VkIGZvciBsb29rdXAuXG5cbiAgICByZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LkhUTUwsIFtcbiAgICAgICdpZnJhbWV8c3JjZG9jJyxcbiAgICAgICcqfGlubmVySFRNTCcsXG4gICAgICAnKnxvdXRlckhUTUwnLFxuICAgIF0pO1xuICAgIHJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuU1RZTEUsIFsnKnxzdHlsZSddKTtcbiAgICAvLyBOQjogbm8gU0NSSVBUIGNvbnRleHRzIGhlcmUsIHRoZXkgYXJlIG5ldmVyIGFsbG93ZWQgZHVlIHRvIHRoZSBwYXJzZXIgc3RyaXBwaW5nIHRoZW0uXG4gICAgcmVnaXN0ZXJDb250ZXh0KFNlY3VyaXR5Q29udGV4dC5VUkwsIFtcbiAgICAgICcqfGZvcm1BY3Rpb24nLFxuICAgICAgJ2FyZWF8aHJlZicsXG4gICAgICAnYXJlYXxwaW5nJyxcbiAgICAgICdhdWRpb3xzcmMnLFxuICAgICAgJ2F8aHJlZicsXG4gICAgICAnYXxwaW5nJyxcbiAgICAgICdibG9ja3F1b3RlfGNpdGUnLFxuICAgICAgJ2JvZHl8YmFja2dyb3VuZCcsXG4gICAgICAnZGVsfGNpdGUnLFxuICAgICAgJ2Zvcm18YWN0aW9uJyxcbiAgICAgICdpbWd8c3JjJyxcbiAgICAgICdpbnB1dHxzcmMnLFxuICAgICAgJ2luc3xjaXRlJyxcbiAgICAgICdxfGNpdGUnLFxuICAgICAgJ3NvdXJjZXxzcmMnLFxuICAgICAgJ3RyYWNrfHNyYycsXG4gICAgICAndmlkZW98cG9zdGVyJyxcbiAgICAgICd2aWRlb3xzcmMnLFxuICAgIF0pO1xuICAgIHJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMLCBbXG4gICAgICAnYXBwbGV0fGNvZGUnLFxuICAgICAgJ2FwcGxldHxjb2RlYmFzZScsXG4gICAgICAnYmFzZXxocmVmJyxcbiAgICAgICdlbWJlZHxzcmMnLFxuICAgICAgJ2ZyYW1lfHNyYycsXG4gICAgICAnaGVhZHxwcm9maWxlJyxcbiAgICAgICdodG1sfG1hbmlmZXN0JyxcbiAgICAgICdpZnJhbWV8c3JjJyxcbiAgICAgICdsaW5rfGhyZWYnLFxuICAgICAgJ21lZGlhfHNyYycsXG4gICAgICAnb2JqZWN0fGNvZGViYXNlJyxcbiAgICAgICdvYmplY3R8ZGF0YScsXG4gICAgICAnc2NyaXB0fHNyYycsXG4gICAgXSk7XG4gIH1cbiAgcmV0dXJuIF9TRUNVUklUWV9TQ0hFTUE7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ29udGV4dChjdHg6IFNlY3VyaXR5Q29udGV4dCwgc3BlY3M6IHN0cmluZ1tdKSB7XG4gIGZvciAoY29uc3Qgc3BlYyBvZiBzcGVjcykgX1NFQ1VSSVRZX1NDSEVNQVtzcGVjLnRvTG93ZXJDYXNlKCldID0gY3R4O1xufVxuIl19