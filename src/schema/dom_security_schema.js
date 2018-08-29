/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/schema/dom_security_schema", ["require", "exports", "tslib", "@angular/compiler/src/core"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular/compiler/src/core");
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
    exports.SECURITY_SCHEMA = {};
    function registerContext(ctx, specs) {
        var e_1, _a;
        try {
            for (var specs_1 = tslib_1.__values(specs), specs_1_1 = specs_1.next(); !specs_1_1.done; specs_1_1 = specs_1.next()) {
                var spec = specs_1_1.value;
                exports.SECURITY_SCHEMA[spec.toLowerCase()] = ctx;
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
    registerContext(core_1.SecurityContext.HTML, [
        'iframe|srcdoc',
        '*|innerHTML',
        '*|outerHTML',
    ]);
    registerContext(core_1.SecurityContext.STYLE, ['*|style']);
    // NB: no SCRIPT contexts here, they are never allowed due to the parser stripping them.
    registerContext(core_1.SecurityContext.URL, [
        '*|formAction', 'area|href', 'area|ping', 'audio|src', 'a|href',
        'a|ping', 'blockquote|cite', 'body|background', 'del|cite', 'form|action',
        'img|src', 'img|srcset', 'input|src', 'ins|cite', 'q|cite',
        'source|src', 'source|srcset', 'track|src', 'video|poster', 'video|src',
    ]);
    registerContext(core_1.SecurityContext.RESOURCE_URL, [
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3NlY3VyaXR5X3NjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtREFBd0M7SUFFeEMsb0dBQW9HO0lBQ3BHLG9HQUFvRztJQUNwRyxvR0FBb0c7SUFDcEcsb0dBQW9HO0lBQ3BHLG9HQUFvRztJQUNwRyxFQUFFO0lBQ0YsMkZBQTJGO0lBQzNGLGtFQUFrRTtJQUNsRSxFQUFFO0lBQ0Ysb0dBQW9HO0lBRXBHLDhGQUE4RjtJQUNqRixRQUFBLGVBQWUsR0FBbUMsRUFBRSxDQUFDO0lBRWxFLFNBQVMsZUFBZSxDQUFDLEdBQW9CLEVBQUUsS0FBZTs7O1lBQzVELEtBQW1CLElBQUEsVUFBQSxpQkFBQSxLQUFLLENBQUEsNEJBQUE7Z0JBQW5CLElBQU0sSUFBSSxrQkFBQTtnQkFBVyx1QkFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQzthQUFBOzs7Ozs7Ozs7SUFDdEUsQ0FBQztJQUVELDJGQUEyRjtJQUUzRixlQUFlLENBQUMsc0JBQWUsQ0FBQyxJQUFJLEVBQUU7UUFDcEMsZUFBZTtRQUNmLGFBQWE7UUFDYixhQUFhO0tBQ2QsQ0FBQyxDQUFDO0lBQ0gsZUFBZSxDQUFDLHNCQUFlLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUNwRCx3RkFBd0Y7SUFDeEYsZUFBZSxDQUFDLHNCQUFlLENBQUMsR0FBRyxFQUFFO1FBQ25DLGNBQWMsRUFBRSxXQUFXLEVBQVEsV0FBVyxFQUFRLFdBQVcsRUFBSyxRQUFRO1FBQzlFLFFBQVEsRUFBUSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQU0sYUFBYTtRQUNuRixTQUFTLEVBQU8sWUFBWSxFQUFPLFdBQVcsRUFBUSxVQUFVLEVBQU0sUUFBUTtRQUM5RSxZQUFZLEVBQUksZUFBZSxFQUFJLFdBQVcsRUFBUSxjQUFjLEVBQUUsV0FBVztLQUNsRixDQUFDLENBQUM7SUFDSCxlQUFlLENBQUMsc0JBQWUsQ0FBQyxZQUFZLEVBQUU7UUFDNUMsYUFBYTtRQUNiLGlCQUFpQjtRQUNqQixXQUFXO1FBQ1gsV0FBVztRQUNYLFdBQVc7UUFDWCxjQUFjO1FBQ2QsZUFBZTtRQUNmLFlBQVk7UUFDWixXQUFXO1FBQ1gsV0FBVztRQUNYLGlCQUFpQjtRQUNqQixhQUFhO1FBQ2IsWUFBWTtLQUNiLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PSBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgID09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gICAgICAgIERPIE5PVCBFRElUIFRISVMgTElTVCBPRiBTRUNVUklUWSBTRU5TSVRJVkUgUFJPUEVSVElFUyBXSVRIT1VUIEEgU0VDVVJJVFkgUkVWSUVXIVxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVhY2ggb3V0IHRvIG1wcm9ic3QgZm9yIGRldGFpbHMuXG4vL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKiogTWFwIGZyb20gdGFnTmFtZXxwcm9wZXJ0eU5hbWUgU2VjdXJpdHlDb250ZXh0LiBQcm9wZXJ0aWVzIGFwcGx5aW5nIHRvIGFsbCB0YWdzIHVzZSAnKicuICovXG5leHBvcnQgY29uc3QgU0VDVVJJVFlfU0NIRU1BOiB7W2s6IHN0cmluZ106IFNlY3VyaXR5Q29udGV4dH0gPSB7fTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJDb250ZXh0KGN0eDogU2VjdXJpdHlDb250ZXh0LCBzcGVjczogc3RyaW5nW10pIHtcbiAgZm9yIChjb25zdCBzcGVjIG9mIHNwZWNzKSBTRUNVUklUWV9TQ0hFTUFbc3BlYy50b0xvd2VyQ2FzZSgpXSA9IGN0eDtcbn1cblxuLy8gQ2FzZSBpcyBpbnNpZ25pZmljYW50IGJlbG93LCBhbGwgZWxlbWVudCBhbmQgYXR0cmlidXRlIG5hbWVzIGFyZSBsb3dlci1jYXNlZCBmb3IgbG9va3VwLlxuXG5yZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LkhUTUwsIFtcbiAgJ2lmcmFtZXxzcmNkb2MnLFxuICAnKnxpbm5lckhUTUwnLFxuICAnKnxvdXRlckhUTUwnLFxuXSk7XG5yZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LlNUWUxFLCBbJyp8c3R5bGUnXSk7XG4vLyBOQjogbm8gU0NSSVBUIGNvbnRleHRzIGhlcmUsIHRoZXkgYXJlIG5ldmVyIGFsbG93ZWQgZHVlIHRvIHRoZSBwYXJzZXIgc3RyaXBwaW5nIHRoZW0uXG5yZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LlVSTCwgW1xuICAnKnxmb3JtQWN0aW9uJywgJ2FyZWF8aHJlZicsICAgICAgICdhcmVhfHBpbmcnLCAgICAgICAnYXVkaW98c3JjJywgICAgJ2F8aHJlZicsXG4gICdhfHBpbmcnLCAgICAgICAnYmxvY2txdW90ZXxjaXRlJywgJ2JvZHl8YmFja2dyb3VuZCcsICdkZWx8Y2l0ZScsICAgICAnZm9ybXxhY3Rpb24nLFxuICAnaW1nfHNyYycsICAgICAgJ2ltZ3xzcmNzZXQnLCAgICAgICdpbnB1dHxzcmMnLCAgICAgICAnaW5zfGNpdGUnLCAgICAgJ3F8Y2l0ZScsXG4gICdzb3VyY2V8c3JjJywgICAnc291cmNlfHNyY3NldCcsICAgJ3RyYWNrfHNyYycsICAgICAgICd2aWRlb3xwb3N0ZXInLCAndmlkZW98c3JjJyxcbl0pO1xucmVnaXN0ZXJDb250ZXh0KFNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwsIFtcbiAgJ2FwcGxldHxjb2RlJyxcbiAgJ2FwcGxldHxjb2RlYmFzZScsXG4gICdiYXNlfGhyZWYnLFxuICAnZW1iZWR8c3JjJyxcbiAgJ2ZyYW1lfHNyYycsXG4gICdoZWFkfHByb2ZpbGUnLFxuICAnaHRtbHxtYW5pZmVzdCcsXG4gICdpZnJhbWV8c3JjJyxcbiAgJ2xpbmt8aHJlZicsXG4gICdtZWRpYXxzcmMnLFxuICAnb2JqZWN0fGNvZGViYXNlJyxcbiAgJ29iamVjdHxkYXRhJyxcbiAgJ3NjcmlwdHxzcmMnLFxuXSk7XG4iXX0=