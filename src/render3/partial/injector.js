(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/injector", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_injector_compiler", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileDeclareInjectorFromMetadata = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var r3_injector_compiler_1 = require("@angular/compiler/src/render3/r3_injector_compiler");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    /**
     * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
     * must update this constant to prevent old partial-linkers from incorrectly processing the
     * declaration.
     *
     * Do not include any prerelease in these versions as they are ignored.
     */
    var MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
    function compileDeclareInjectorFromMetadata(meta) {
        var definitionMap = createInjectorDefinitionMap(meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareInjector).callFn([definitionMap.toLiteralMap()]);
        var type = (0, r3_injector_compiler_1.createInjectorType)(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareInjectorFromMetadata = compileDeclareInjectorFromMetadata;
    /**
     * Gathers the declaration fields for an Injector into a `DefinitionMap`.
     */
    function createInjectorDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('13.0.0-next.8+10.sha-988cca7.with-local-changes'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        definitionMap.set('providers', meta.providers);
        if (meta.imports.length > 0) {
            definitionMap.set('imports', o.literalArr(meta.imports));
        }
        return definitionMap;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9wYXJ0aWFsL2luamVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILDJEQUE2QztJQUM3QywrRUFBb0Q7SUFDcEQsMkZBQStFO0lBRS9FLGdFQUEyQztJQUczQzs7Ozs7O09BTUc7SUFDSCxJQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztJQUVoRCxTQUFnQixrQ0FBa0MsQ0FBQyxJQUF3QjtRQUN6RSxJQUFNLGFBQWEsR0FBRywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV4RCxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRixJQUFNLElBQUksR0FBRyxJQUFBLHlDQUFrQixFQUFDLElBQUksQ0FBQyxDQUFDO1FBRXRDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVBELGdGQU9DO0lBRUQ7O09BRUc7SUFDSCxTQUFTLDJCQUEyQixDQUFDLElBQXdCO1FBRTNELElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBNkIsQ0FBQztRQUVyRSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9DLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDMUQ7UUFFRCxPQUFPLGFBQWEsQ0FBQztJQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y3JlYXRlSW5qZWN0b3JUeXBlLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4uL3IzX2luamVjdG9yX2NvbXBpbGVyJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuaW1wb3J0IHtSM0RlY2xhcmVJbmplY3Rvck1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5cbi8qKlxuICogRXZlcnkgdGltZSB3ZSBtYWtlIGEgYnJlYWtpbmcgY2hhbmdlIHRvIHRoZSBkZWNsYXJhdGlvbiBpbnRlcmZhY2Ugb3IgcGFydGlhbC1saW5rZXIgYmVoYXZpb3IsIHdlXG4gKiBtdXN0IHVwZGF0ZSB0aGlzIGNvbnN0YW50IHRvIHByZXZlbnQgb2xkIHBhcnRpYWwtbGlua2VycyBmcm9tIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlXG4gKiBkZWNsYXJhdGlvbi5cbiAqXG4gKiBEbyBub3QgaW5jbHVkZSBhbnkgcHJlcmVsZWFzZSBpbiB0aGVzZSB2ZXJzaW9ucyBhcyB0aGV5IGFyZSBpZ25vcmVkLlxuICovXG5jb25zdCBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04gPSAnMTIuMC4wJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlSW5qZWN0b3JGcm9tTWV0YWRhdGEobWV0YTogUjNJbmplY3Rvck1ldGFkYXRhKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlSW5qZWN0b3JEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUluamVjdG9yKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUluamVjdG9yVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGFuIEluamVjdG9yIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUluamVjdG9yRGVmaW5pdGlvbk1hcChtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlSW5qZWN0b3JNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlSW5qZWN0b3JNZXRhZGF0YT4oKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuICBpZiAobWV0YS5pbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW1wb3J0cycsIG8ubGl0ZXJhbEFycihtZXRhLmltcG9ydHMpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuIl19