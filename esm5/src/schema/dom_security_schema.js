/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
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
/** Map from tagName|propertyName SecurityContext. Properties applying to all tags use '*'. */
export var SECURITY_SCHEMA = {};
function registerContext(ctx, specs) {
    var e_1, _a;
    try {
        for (var specs_1 = tslib_1.__values(specs), specs_1_1 = specs_1.next(); !specs_1_1.done; specs_1_1 = specs_1.next()) {
            var spec = specs_1_1.value;
            SECURITY_SCHEMA[spec.toLowerCase()] = ctx;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (specs_1_1 && !specs_1_1.done && (_a = specs_1.return)) _a.call(specs_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
// Case is insignificant below, all element and attribute names are lower-cased for lookup.
registerContext(SecurityContext.HTML, [
    'iframe|srcdoc',
    '*|innerHTML',
    '*|outerHTML',
]);
registerContext(SecurityContext.STYLE, ['*|style']);
// NB: no SCRIPT contexts here, they are never allowed due to the parser stripping them.
registerContext(SecurityContext.URL, [
    '*|formAction', 'area|href', 'area|ping', 'audio|src', 'a|href',
    'a|ping', 'blockquote|cite', 'body|background', 'del|cite', 'form|action',
    'img|src', 'img|srcset', 'input|src', 'ins|cite', 'q|cite',
    'source|src', 'source|srcset', 'track|src', 'video|poster', 'video|src',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3NlY3VyaXR5X3NjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV4QyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLEVBQUU7QUFDRiwyRkFBMkY7QUFDM0Ysa0VBQWtFO0FBQ2xFLEVBQUU7QUFDRixvR0FBb0c7QUFFcEcsOEZBQThGO0FBQzlGLE1BQU0sQ0FBQyxJQUFNLGVBQWUsR0FBbUMsRUFBRSxDQUFDO0FBRWxFLFNBQVMsZUFBZSxDQUFDLEdBQW9CLEVBQUUsS0FBZTs7O1FBQzVELEtBQW1CLElBQUEsVUFBQSxpQkFBQSxLQUFLLENBQUEsNEJBQUE7WUFBbkIsSUFBTSxJQUFJLGtCQUFBO1lBQVcsZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztTQUFBOzs7Ozs7Ozs7QUFDdEUsQ0FBQztBQUVELDJGQUEyRjtBQUUzRixlQUFlLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRTtJQUNwQyxlQUFlO0lBQ2YsYUFBYTtJQUNiLGFBQWE7Q0FDZCxDQUFDLENBQUM7QUFDSCxlQUFlLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDcEQsd0ZBQXdGO0FBQ3hGLGVBQWUsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFO0lBQ25DLGNBQWMsRUFBRSxXQUFXLEVBQVEsV0FBVyxFQUFRLFdBQVcsRUFBSyxRQUFRO0lBQzlFLFFBQVEsRUFBUSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQU0sYUFBYTtJQUNuRixTQUFTLEVBQU8sWUFBWSxFQUFPLFdBQVcsRUFBUSxVQUFVLEVBQU0sUUFBUTtJQUM5RSxZQUFZLEVBQUksZUFBZSxFQUFJLFdBQVcsRUFBUSxjQUFjLEVBQUUsV0FBVztDQUNsRixDQUFDLENBQUM7QUFDSCxlQUFlLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtJQUM1QyxhQUFhO0lBQ2IsaUJBQWlCO0lBQ2pCLFdBQVc7SUFDWCxXQUFXO0lBQ1gsV0FBVztJQUNYLGNBQWM7SUFDZCxlQUFlO0lBQ2YsWUFBWTtJQUNaLFdBQVc7SUFDWCxXQUFXO0lBQ1gsaUJBQWlCO0lBQ2pCLGFBQWE7SUFDYixZQUFZO0NBQ2IsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09IFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgPT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyAgICAgICAgRE8gTk9UIEVESVQgVEhJUyBMSVNUIE9GIFNFQ1VSSVRZIFNFTlNJVElWRSBQUk9QRVJUSUVTIFdJVEhPVVQgQSBTRUNVUklUWSBSRVZJRVchXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZWFjaCBvdXQgdG8gbXByb2JzdCBmb3IgZGV0YWlscy5cbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiBNYXAgZnJvbSB0YWdOYW1lfHByb3BlcnR5TmFtZSBTZWN1cml0eUNvbnRleHQuIFByb3BlcnRpZXMgYXBwbHlpbmcgdG8gYWxsIHRhZ3MgdXNlICcqJy4gKi9cbmV4cG9ydCBjb25zdCBTRUNVUklUWV9TQ0hFTUE6IHtbazogc3RyaW5nXTogU2VjdXJpdHlDb250ZXh0fSA9IHt9O1xuXG5mdW5jdGlvbiByZWdpc3RlckNvbnRleHQoY3R4OiBTZWN1cml0eUNvbnRleHQsIHNwZWNzOiBzdHJpbmdbXSkge1xuICBmb3IgKGNvbnN0IHNwZWMgb2Ygc3BlY3MpIFNFQ1VSSVRZX1NDSEVNQVtzcGVjLnRvTG93ZXJDYXNlKCldID0gY3R4O1xufVxuXG4vLyBDYXNlIGlzIGluc2lnbmlmaWNhbnQgYmVsb3csIGFsbCBlbGVtZW50IGFuZCBhdHRyaWJ1dGUgbmFtZXMgYXJlIGxvd2VyLWNhc2VkIGZvciBsb29rdXAuXG5cbnJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuSFRNTCwgW1xuICAnaWZyYW1lfHNyY2RvYycsXG4gICcqfGlubmVySFRNTCcsXG4gICcqfG91dGVySFRNTCcsXG5dKTtcbnJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuU1RZTEUsIFsnKnxzdHlsZSddKTtcbi8vIE5COiBubyBTQ1JJUFQgY29udGV4dHMgaGVyZSwgdGhleSBhcmUgbmV2ZXIgYWxsb3dlZCBkdWUgdG8gdGhlIHBhcnNlciBzdHJpcHBpbmcgdGhlbS5cbnJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuVVJMLCBbXG4gICcqfGZvcm1BY3Rpb24nLCAnYXJlYXxocmVmJywgICAgICAgJ2FyZWF8cGluZycsICAgICAgICdhdWRpb3xzcmMnLCAgICAnYXxocmVmJyxcbiAgJ2F8cGluZycsICAgICAgICdibG9ja3F1b3RlfGNpdGUnLCAnYm9keXxiYWNrZ3JvdW5kJywgJ2RlbHxjaXRlJywgICAgICdmb3JtfGFjdGlvbicsXG4gICdpbWd8c3JjJywgICAgICAnaW1nfHNyY3NldCcsICAgICAgJ2lucHV0fHNyYycsICAgICAgICdpbnN8Y2l0ZScsICAgICAncXxjaXRlJyxcbiAgJ3NvdXJjZXxzcmMnLCAgICdzb3VyY2V8c3Jjc2V0JywgICAndHJhY2t8c3JjJywgICAgICAgJ3ZpZGVvfHBvc3RlcicsICd2aWRlb3xzcmMnLFxuXSk7XG5yZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCwgW1xuICAnYXBwbGV0fGNvZGUnLFxuICAnYXBwbGV0fGNvZGViYXNlJyxcbiAgJ2Jhc2V8aHJlZicsXG4gICdlbWJlZHxzcmMnLFxuICAnZnJhbWV8c3JjJyxcbiAgJ2hlYWR8cHJvZmlsZScsXG4gICdodG1sfG1hbmlmZXN0JyxcbiAgJ2lmcmFtZXxzcmMnLFxuICAnbGlua3xocmVmJyxcbiAgJ21lZGlhfHNyYycsXG4gICdvYmplY3R8Y29kZWJhc2UnLFxuICAnb2JqZWN0fGRhdGEnLFxuICAnc2NyaXB0fHNyYycsXG5dKTtcbiJdfQ==