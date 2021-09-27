(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/injectable", ["require", "exports", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util", "@angular/compiler/src/render3/partial/util"], factory);
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
    var util_1 = require("@angular/compiler/src/render3/view/util");
    var util_2 = require("@angular/compiler/src/render3/partial/util");
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
        var type = (0, injectable_compiler_2_1.createInjectableType)(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDeclareInjectableFromMetadata = compileDeclareInjectableFromMetadata;
    /**
     * Gathers the declaration fields for a Injectable into a `DefinitionMap`.
     */
    function createInjectableDefinitionMap(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
        definitionMap.set('version', o.literal('13.0.0-next.8+10.sha-988cca7.with-local-changes'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        // Only generate providedIn property if it has a non-null value
        if (meta.providedIn !== undefined) {
            var providedIn = convertFromProviderExpression(meta.providedIn);
            if (providedIn.value !== null) {
                definitionMap.set('providedIn', providedIn);
            }
        }
        if (meta.useClass !== undefined) {
            definitionMap.set('useClass', convertFromProviderExpression(meta.useClass));
        }
        if (meta.useExisting !== undefined) {
            definitionMap.set('useExisting', convertFromProviderExpression(meta.useExisting));
        }
        if (meta.useValue !== undefined) {
            definitionMap.set('useValue', convertFromProviderExpression(meta.useValue));
        }
        // Factories do not contain `ForwardRef`s since any types are already wrapped in a function call
        // so the types will not be eagerly evaluated. Therefore we do not need to process this expression
        // with `convertFromProviderExpression()`.
        if (meta.useFactory !== undefined) {
            definitionMap.set('useFactory', meta.useFactory);
        }
        if (meta.deps !== undefined) {
            definitionMap.set('deps', o.literalArr(meta.deps.map(util_2.compileDependency)));
        }
        return definitionMap;
    }
    exports.createInjectableDefinitionMap = createInjectableDefinitionMap;
    /**
     * Convert an `R3ProviderExpression` to an `Expression`, possibly wrapping its expression in a
     * `forwardRef()` call.
     *
     * If `R3ProviderExpression.isForwardRef` is true then the expression was originally wrapped in a
     * `forwardRef()` call to prevent the value from being eagerly evaluated in the code.
     *
     * Normally, the linker will statically process the code, putting the `expression` inside a factory
     * function so the `forwardRef()` wrapper is not evaluated before it has been defined. But if the
     * partial declaration is evaluated by the JIT compiler the `forwardRef()` call is still needed to
     * prevent eager evaluation of the `expression`.
     *
     * So in partial declarations, expressions that could be forward-refs are wrapped in `forwardRef()`
     * calls, and this is then unwrapped in the linker as necessary.
     *
     * See `packages/compiler-cli/src/ngtsc/annotations/src/injectable.ts` and
     * `packages/compiler/src/jit_compiler_facade.ts` for more information.
     */
    function convertFromProviderExpression(_a) {
        var expression = _a.expression, isForwardRef = _a.isForwardRef;
        return isForwardRef ? (0, util_2.generateForwardRef)(expression) : expression;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCxxRkFBNkc7SUFDN0csMkRBQTZDO0lBQzdDLCtFQUFvRDtJQUVwRCxnRUFBMkM7SUFHM0MsbUVBQTZEO0lBRTdEOzs7Ozs7T0FNRztJQUNILElBQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0lBRWhEOztPQUVHO0lBQ0gsU0FBZ0Isb0NBQW9DLENBQUMsSUFBMEI7UUFFN0UsSUFBTSxhQUFhLEdBQUcsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFMUQsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3RixJQUFNLElBQUksR0FBRyxJQUFBLDRDQUFvQixFQUFDLElBQUksQ0FBQyxDQUFDO1FBRXhDLE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7SUFDNUMsQ0FBQztJQVJELG9GQVFDO0lBRUQ7O09BRUc7SUFDSCxTQUFnQiw2QkFBNkIsQ0FBQyxJQUEwQjtRQUV0RSxJQUFNLGFBQWEsR0FBRyxJQUFJLG9CQUFhLEVBQStCLENBQUM7UUFFdkUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7UUFDM0UsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTdDLCtEQUErRDtRQUMvRCxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQ2pDLElBQU0sVUFBVSxHQUFHLDZCQUE2QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsRSxJQUFLLFVBQTRCLENBQUMsS0FBSyxLQUFLLElBQUksRUFBRTtnQkFDaEQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDN0M7U0FDRjtRQUVELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDL0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7U0FDN0U7UUFDRCxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFFO1lBQ2xDLGFBQWEsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLDZCQUE2QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1NBQ25GO1FBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMvQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUM3RTtRQUNELGdHQUFnRztRQUNoRyxrR0FBa0c7UUFDbEcsMENBQTBDO1FBQzFDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTLEVBQUU7WUFDakMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ2xEO1FBRUQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtZQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHdCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzNFO1FBRUQsT0FBTyxhQUFhLENBQUM7SUFDdkIsQ0FBQztJQXRDRCxzRUFzQ0M7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpQkc7SUFDSCxTQUFTLDZCQUE2QixDQUFDLEVBQWdEO1lBQS9DLFVBQVUsZ0JBQUEsRUFBRSxZQUFZLGtCQUFBO1FBRTlELE9BQU8sWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFBLHlCQUFrQixFQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7SUFDcEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtjcmVhdGVJbmplY3RhYmxlVHlwZSwgUjNJbmplY3RhYmxlTWV0YWRhdGEsIFIzUHJvdmlkZXJFeHByZXNzaW9ufSBmcm9tICcuLi8uLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVJbmplY3RhYmxlTWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y29tcGlsZURlcGVuZGVuY3ksIGdlbmVyYXRlRm9yd2FyZFJlZn0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlciBiZWhhdmlvciwgd2VcbiAqIG11c3QgdXBkYXRlIHRoaXMgY29uc3RhbnQgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb20gaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGVcbiAqIGRlY2xhcmF0aW9uLlxuICpcbiAqIERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTiA9ICcxMi4wLjAnO1xuXG4vKipcbiAqIENvbXBpbGUgYSBJbmplY3RhYmxlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0luamVjdGFibGVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUluamVjdGFibGVGcm9tTWV0YWRhdGEobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOlxuICAgIFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZUluamVjdGFibGVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUluamVjdGFibGUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlSW5qZWN0YWJsZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIEluamVjdGFibGUgaW50byBhIGBEZWZpbml0aW9uTWFwYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUluamVjdGFibGVEZWZpbml0aW9uTWFwKG1ldGE6IFIzSW5qZWN0YWJsZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUluamVjdGFibGVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhPigpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgcHJvdmlkZWRJbiBwcm9wZXJ0eSBpZiBpdCBoYXMgYSBub24tbnVsbCB2YWx1ZVxuICBpZiAobWV0YS5wcm92aWRlZEluICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBwcm92aWRlZEluID0gY29udmVydEZyb21Qcm92aWRlckV4cHJlc3Npb24obWV0YS5wcm92aWRlZEluKTtcbiAgICBpZiAoKHByb3ZpZGVkSW4gYXMgby5MaXRlcmFsRXhwcikudmFsdWUgIT09IG51bGwpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlZEluJywgcHJvdmlkZWRJbik7XG4gICAgfVxuICB9XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VDbGFzcycsIGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKG1ldGEudXNlQ2xhc3MpKTtcbiAgfVxuICBpZiAobWV0YS51c2VFeGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZUV4aXN0aW5nJywgY29udmVydEZyb21Qcm92aWRlckV4cHJlc3Npb24obWV0YS51c2VFeGlzdGluZykpO1xuICB9XG4gIGlmIChtZXRhLnVzZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlVmFsdWUnLCBjb252ZXJ0RnJvbVByb3ZpZGVyRXhwcmVzc2lvbihtZXRhLnVzZVZhbHVlKSk7XG4gIH1cbiAgLy8gRmFjdG9yaWVzIGRvIG5vdCBjb250YWluIGBGb3J3YXJkUmVmYHMgc2luY2UgYW55IHR5cGVzIGFyZSBhbHJlYWR5IHdyYXBwZWQgaW4gYSBmdW5jdGlvbiBjYWxsXG4gIC8vIHNvIHRoZSB0eXBlcyB3aWxsIG5vdCBiZSBlYWdlcmx5IGV2YWx1YXRlZC4gVGhlcmVmb3JlIHdlIGRvIG5vdCBuZWVkIHRvIHByb2Nlc3MgdGhpcyBleHByZXNzaW9uXG4gIC8vIHdpdGggYGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKClgLlxuICBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlRmFjdG9yeScsIG1ldGEudXNlRmFjdG9yeSk7XG4gIH1cblxuICBpZiAobWV0YS5kZXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVwcycsIG8ubGl0ZXJhbEFycihtZXRhLmRlcHMubWFwKGNvbXBpbGVEZXBlbmRlbmN5KSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBgUjNQcm92aWRlckV4cHJlc3Npb25gIHRvIGFuIGBFeHByZXNzaW9uYCwgcG9zc2libHkgd3JhcHBpbmcgaXRzIGV4cHJlc3Npb24gaW4gYVxuICogYGZvcndhcmRSZWYoKWAgY2FsbC5cbiAqXG4gKiBJZiBgUjNQcm92aWRlckV4cHJlc3Npb24uaXNGb3J3YXJkUmVmYCBpcyB0cnVlIHRoZW4gdGhlIGV4cHJlc3Npb24gd2FzIG9yaWdpbmFsbHkgd3JhcHBlZCBpbiBhXG4gKiBgZm9yd2FyZFJlZigpYCBjYWxsIHRvIHByZXZlbnQgdGhlIHZhbHVlIGZyb20gYmVpbmcgZWFnZXJseSBldmFsdWF0ZWQgaW4gdGhlIGNvZGUuXG4gKlxuICogTm9ybWFsbHksIHRoZSBsaW5rZXIgd2lsbCBzdGF0aWNhbGx5IHByb2Nlc3MgdGhlIGNvZGUsIHB1dHRpbmcgdGhlIGBleHByZXNzaW9uYCBpbnNpZGUgYSBmYWN0b3J5XG4gKiBmdW5jdGlvbiBzbyB0aGUgYGZvcndhcmRSZWYoKWAgd3JhcHBlciBpcyBub3QgZXZhbHVhdGVkIGJlZm9yZSBpdCBoYXMgYmVlbiBkZWZpbmVkLiBCdXQgaWYgdGhlXG4gKiBwYXJ0aWFsIGRlY2xhcmF0aW9uIGlzIGV2YWx1YXRlZCBieSB0aGUgSklUIGNvbXBpbGVyIHRoZSBgZm9yd2FyZFJlZigpYCBjYWxsIGlzIHN0aWxsIG5lZWRlZCB0b1xuICogcHJldmVudCBlYWdlciBldmFsdWF0aW9uIG9mIHRoZSBgZXhwcmVzc2lvbmAuXG4gKlxuICogU28gaW4gcGFydGlhbCBkZWNsYXJhdGlvbnMsIGV4cHJlc3Npb25zIHRoYXQgY291bGQgYmUgZm9yd2FyZC1yZWZzIGFyZSB3cmFwcGVkIGluIGBmb3J3YXJkUmVmKClgXG4gKiBjYWxscywgYW5kIHRoaXMgaXMgdGhlbiB1bndyYXBwZWQgaW4gdGhlIGxpbmtlciBhcyBuZWNlc3NhcnkuXG4gKlxuICogU2VlIGBwYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL2Fubm90YXRpb25zL3NyYy9pbmplY3RhYmxlLnRzYCBhbmRcbiAqIGBwYWNrYWdlcy9jb21waWxlci9zcmMvaml0X2NvbXBpbGVyX2ZhY2FkZS50c2AgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKHtleHByZXNzaW9uLCBpc0ZvcndhcmRSZWZ9OiBSM1Byb3ZpZGVyRXhwcmVzc2lvbik6XG4gICAgby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGlzRm9yd2FyZFJlZiA/IGdlbmVyYXRlRm9yd2FyZFJlZihleHByZXNzaW9uKSA6IGV4cHJlc3Npb247XG59XG4iXX0=