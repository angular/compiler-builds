(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/injectable", ["require", "exports", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createInjectableDefinitionMap = exports.compileDeclareInjectableFromMetadata = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var injectable_compiler_2_1 = require("@angular/compiler/src/injectable_compiler_2");
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/util");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    var util_3 = require("@angular/compiler/src/render3/partial/util");
    /**
     * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
     * must update this constant to prevent old partial-linkers from incorrectly processing the
     * declaration.
     *
     * Do not include any prerelease in these versions as they are ignored.
     */
    var MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
    /**
     * Compile a Injectable declaration defined by the `R3InjectableMetadata`.
     */
    function compileDeclareInjectableFromMetadata(meta) {
        var definitionMap = createInjectableDefinitionMap(meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.declareInjectable).callFn([definitionMap.toLiteralMap()]);
        var type = injectable_compiler_2_1.createInjectableType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareInjectableFromMetadata = compileDeclareInjectableFromMetadata;
    /**
     * Gathers the declaration fields for a Injectable into a `DefinitionMap`.
     */
    function createInjectableDefinitionMap(meta) {
        var definitionMap = new util_2.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('12.2.13+9.sha-a1bd9d7.with-local-changes'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        // Only generate providedIn property if it has a non-null value
        if (meta.providedIn !== undefined) {
            var providedIn = util_1.convertFromMaybeForwardRefExpression(meta.providedIn);
            if (providedIn.value !== null) {
                definitionMap.set('providedIn', providedIn);
            }
        }
        if (meta.useClass !== undefined) {
            definitionMap.set('useClass', util_1.convertFromMaybeForwardRefExpression(meta.useClass));
        }
        if (meta.useExisting !== undefined) {
            definitionMap.set('useExisting', util_1.convertFromMaybeForwardRefExpression(meta.useExisting));
        }
        if (meta.useValue !== undefined) {
            definitionMap.set('useValue', util_1.convertFromMaybeForwardRefExpression(meta.useValue));
        }
        // Factories do not contain `ForwardRef`s since any types are already wrapped in a function call
        // so the types will not be eagerly evaluated. Therefore we do not need to process this expression
        // with `convertFromProviderExpression()`.
        if (meta.useFactory !== undefined) {
            definitionMap.set('useFactory', meta.useFactory);
        }
        if (meta.deps !== undefined) {
            definitionMap.set('deps', o.literalArr(meta.deps.map(util_3.compileDependency)));
        }
        return definitionMap;
    }
    exports.createInjectableDefinitionMap = createInjectableDefinitionMap;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCxxRkFBdUY7SUFDdkYsMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUNwRCwyREFBbUY7SUFDbkYsZ0VBQTJDO0lBRzNDLG1FQUF5QztJQUV6Qzs7Ozs7O09BTUc7SUFDSCxJQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztJQUVoRDs7T0FFRztJQUNILFNBQWdCLG9DQUFvQyxDQUFDLElBQTBCO1FBRTdFLElBQU0sYUFBYSxHQUFHLDZCQUE2QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTFELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0YsSUFBTSxJQUFJLEdBQUcsNENBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFeEMsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztJQUM1QyxDQUFDO0lBUkQsb0ZBUUM7SUFFRDs7T0FFRztJQUNILFNBQWdCLDZCQUE2QixDQUFDLElBQTBCO1FBRXRFLElBQU0sYUFBYSxHQUFHLElBQUksb0JBQWEsRUFBK0IsQ0FBQztRQUV2RSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFN0MsK0RBQStEO1FBQy9ELElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTLEVBQUU7WUFDakMsSUFBTSxVQUFVLEdBQUcsMkNBQW9DLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pFLElBQUssVUFBNEIsQ0FBQyxLQUFLLEtBQUssSUFBSSxFQUFFO2dCQUNoRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQzthQUM3QztTQUNGO1FBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMvQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSwyQ0FBb0MsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUNwRjtRQUNELElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7WUFDbEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsMkNBQW9DLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7U0FDMUY7UUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQy9CLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLDJDQUFvQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQ3BGO1FBQ0QsZ0dBQWdHO1FBQ2hHLGtHQUFrRztRQUNsRywwQ0FBMEM7UUFDMUMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtZQUNqQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDbEQ7UUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1lBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsd0JBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDM0U7UUFFRCxPQUFPLGFBQWEsQ0FBQztJQUN2QixDQUFDO0lBdENELHNFQXNDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtjcmVhdGVJbmplY3RhYmxlVHlwZSwgUjNJbmplY3RhYmxlTWV0YWRhdGF9IGZyb20gJy4uLy4uL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NvbXBpbGVEZXBlbmRlbmN5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIEluamVjdGFibGUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzSW5qZWN0YWJsZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlSW5qZWN0YWJsZUZyb21NZXRhZGF0YShtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6XG4gICAgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlSW5qZWN0YWJsZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlSW5qZWN0YWJsZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVJbmplY3RhYmxlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgSW5qZWN0YWJsZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5qZWN0YWJsZURlZmluaXRpb25NYXAobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVJbmplY3RhYmxlTWV0YWRhdGE+KCk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gT25seSBnZW5lcmF0ZSBwcm92aWRlZEluIHByb3BlcnR5IGlmIGl0IGhhcyBhIG5vbi1udWxsIHZhbHVlXG4gIGlmIChtZXRhLnByb3ZpZGVkSW4gIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IHByb3ZpZGVkSW4gPSBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24obWV0YS5wcm92aWRlZEluKTtcbiAgICBpZiAoKHByb3ZpZGVkSW4gYXMgby5MaXRlcmFsRXhwcikudmFsdWUgIT09IG51bGwpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlZEluJywgcHJvdmlkZWRJbik7XG4gICAgfVxuICB9XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VDbGFzcycsIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihtZXRhLnVzZUNsYXNzKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlRXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VFeGlzdGluZycsIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihtZXRhLnVzZUV4aXN0aW5nKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VWYWx1ZScsIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihtZXRhLnVzZVZhbHVlKSk7XG4gIH1cbiAgLy8gRmFjdG9yaWVzIGRvIG5vdCBjb250YWluIGBGb3J3YXJkUmVmYHMgc2luY2UgYW55IHR5cGVzIGFyZSBhbHJlYWR5IHdyYXBwZWQgaW4gYSBmdW5jdGlvbiBjYWxsXG4gIC8vIHNvIHRoZSB0eXBlcyB3aWxsIG5vdCBiZSBlYWdlcmx5IGV2YWx1YXRlZC4gVGhlcmVmb3JlIHdlIGRvIG5vdCBuZWVkIHRvIHByb2Nlc3MgdGhpcyBleHByZXNzaW9uXG4gIC8vIHdpdGggYGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKClgLlxuICBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlRmFjdG9yeScsIG1ldGEudXNlRmFjdG9yeSk7XG4gIH1cblxuICBpZiAobWV0YS5kZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVwcycsIG8ubGl0ZXJhbEFycihtZXRhLmRlcHMubWFwKGNvbXBpbGVEZXBlbmRlbmN5KSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG4iXX0=