/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createInjectableType } from '../../injectable_compiler_2';
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { DefinitionMap } from '../view/util';
import { compileDependency, generateForwardRef } from './util';
/**
 * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
 * must update this constant to prevent old partial-linkers from incorrectly processing the
 * declaration.
 *
 * Do not include any prerelease in these versions as they are ignored.
 */
const MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
/**
 * Compile a Injectable declaration defined by the `R3InjectableMetadata`.
 */
export function compileDeclareInjectableFromMetadata(meta) {
    const definitionMap = createInjectableDefinitionMap(meta);
    const expression = o.importExpr(R3.declareInjectable).callFn([definitionMap.toLiteralMap()]);
    const type = createInjectableType(meta);
    return { expression, type, statements: [] };
}
/**
 * Gathers the declaration fields for a Injectable into a `DefinitionMap`.
 */
export function createInjectableDefinitionMap(meta) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('12.0.0-next.8+139.sha-aa35a1a'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.internalType);
    // Only generate providedIn property if it has a non-null value
    if (meta.providedIn !== undefined) {
        const providedIn = convertFromProviderExpression(meta.providedIn);
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
        definitionMap.set('deps', o.literalArr(meta.deps.map(compileDependency)));
    }
    return definitionMap;
}
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
function convertFromProviderExpression({ expression, isForwardRef }) {
    return isForwardRef ? generateForwardRef(expression) : expression;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQUMsb0JBQW9CLEVBQTZDLE1BQU0sNkJBQTZCLENBQUM7QUFDN0csT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFHM0MsT0FBTyxFQUFDLGlCQUFpQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTdEOzs7Ozs7R0FNRztBQUNILE1BQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0FBRWhEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG9DQUFvQyxDQUFDLElBQTBCO0lBRTdFLE1BQU0sYUFBYSxHQUFHLDZCQUE2QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTFELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM3RixNQUFNLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV4QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDZCQUE2QixDQUFDLElBQTBCO0lBRXRFLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUErQixDQUFDO0lBRXZFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRTdDLCtEQUErRDtJQUMvRCxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO1FBQ2pDLE1BQU0sVUFBVSxHQUFHLDZCQUE2QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRSxJQUFLLFVBQTRCLENBQUMsS0FBSyxLQUFLLElBQUksRUFBRTtZQUNoRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztTQUM3QztLQUNGO0lBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtRQUMvQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUM3RTtJQUNELElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7UUFDbEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7S0FDbkY7SUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQy9CLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLDZCQUE2QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0tBQzdFO0lBQ0QsZ0dBQWdHO0lBQ2hHLGtHQUFrRztJQUNsRywwQ0FBMEM7SUFDMUMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtRQUNqQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDbEQ7SUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDM0U7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0gsU0FBUyw2QkFBNkIsQ0FBQyxFQUFDLFVBQVUsRUFBRSxZQUFZLEVBQXVCO0lBRXJGLE9BQU8sWUFBWSxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3BFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Y3JlYXRlSW5qZWN0YWJsZVR5cGUsIFIzSW5qZWN0YWJsZU1ldGFkYXRhLCBSM1Byb3ZpZGVyRXhwcmVzc2lvbn0gZnJvbSAnLi4vLi4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NvbXBpbGVEZXBlbmRlbmN5LCBnZW5lcmF0ZUZvcndhcmRSZWZ9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogRXZlcnkgdGltZSB3ZSBtYWtlIGEgYnJlYWtpbmcgY2hhbmdlIHRvIHRoZSBkZWNsYXJhdGlvbiBpbnRlcmZhY2Ugb3IgcGFydGlhbC1saW5rZXIgYmVoYXZpb3IsIHdlXG4gKiBtdXN0IHVwZGF0ZSB0aGlzIGNvbnN0YW50IHRvIHByZXZlbnQgb2xkIHBhcnRpYWwtbGlua2VycyBmcm9tIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlXG4gKiBkZWNsYXJhdGlvbi5cbiAqXG4gKiBEbyBub3QgaW5jbHVkZSBhbnkgcHJlcmVsZWFzZSBpbiB0aGVzZSB2ZXJzaW9ucyBhcyB0aGV5IGFyZSBpZ25vcmVkLlxuICovXG5jb25zdCBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04gPSAnMTIuMC4wJztcblxuLyoqXG4gKiBDb21waWxlIGEgSW5qZWN0YWJsZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNJbmplY3RhYmxlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVJbmplY3RhYmxlRnJvbU1ldGFkYXRhKG1ldGE6IFIzSW5qZWN0YWJsZU1ldGFkYXRhKTpcbiAgICBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVJbmplY3RhYmxlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVJbmplY3RhYmxlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUluamVjdGFibGVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBJbmplY3RhYmxlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbmplY3RhYmxlRGVmaW5pdGlvbk1hcChtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6XG4gICAgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVJbmplY3RhYmxlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUluamVjdGFibGVNZXRhZGF0YT4oKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcblxuICAvLyBPbmx5IGdlbmVyYXRlIHByb3ZpZGVkSW4gcHJvcGVydHkgaWYgaXQgaGFzIGEgbm9uLW51bGwgdmFsdWVcbiAgaWYgKG1ldGEucHJvdmlkZWRJbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgcHJvdmlkZWRJbiA9IGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKG1ldGEucHJvdmlkZWRJbik7XG4gICAgaWYgKChwcm92aWRlZEluIGFzIG8uTGl0ZXJhbEV4cHIpLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZWRJbicsIHByb3ZpZGVkSW4pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlQ2xhc3MnLCBjb252ZXJ0RnJvbVByb3ZpZGVyRXhwcmVzc2lvbihtZXRhLnVzZUNsYXNzKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlRXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VFeGlzdGluZycsIGNvbnZlcnRGcm9tUHJvdmlkZXJFeHByZXNzaW9uKG1ldGEudXNlRXhpc3RpbmcpKTtcbiAgfVxuICBpZiAobWV0YS51c2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZVZhbHVlJywgY29udmVydEZyb21Qcm92aWRlckV4cHJlc3Npb24obWV0YS51c2VWYWx1ZSkpO1xuICB9XG4gIC8vIEZhY3RvcmllcyBkbyBub3QgY29udGFpbiBgRm9yd2FyZFJlZmBzIHNpbmNlIGFueSB0eXBlcyBhcmUgYWxyZWFkeSB3cmFwcGVkIGluIGEgZnVuY3Rpb24gY2FsbFxuICAvLyBzbyB0aGUgdHlwZXMgd2lsbCBub3QgYmUgZWFnZXJseSBldmFsdWF0ZWQuIFRoZXJlZm9yZSB3ZSBkbyBub3QgbmVlZCB0byBwcm9jZXNzIHRoaXMgZXhwcmVzc2lvblxuICAvLyB3aXRoIGBjb252ZXJ0RnJvbVByb3ZpZGVyRXhwcmVzc2lvbigpYC5cbiAgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZUZhY3RvcnknLCBtZXRhLnVzZUZhY3RvcnkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlcHMnLCBvLmxpdGVyYWxBcnIobWV0YS5kZXBzLm1hcChjb21waWxlRGVwZW5kZW5jeSkpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYW4gYFIzUHJvdmlkZXJFeHByZXNzaW9uYCB0byBhbiBgRXhwcmVzc2lvbmAsIHBvc3NpYmx5IHdyYXBwaW5nIGl0cyBleHByZXNzaW9uIGluIGFcbiAqIGBmb3J3YXJkUmVmKClgIGNhbGwuXG4gKlxuICogSWYgYFIzUHJvdmlkZXJFeHByZXNzaW9uLmlzRm9yd2FyZFJlZmAgaXMgdHJ1ZSB0aGVuIHRoZSBleHByZXNzaW9uIHdhcyBvcmlnaW5hbGx5IHdyYXBwZWQgaW4gYVxuICogYGZvcndhcmRSZWYoKWAgY2FsbCB0byBwcmV2ZW50IHRoZSB2YWx1ZSBmcm9tIGJlaW5nIGVhZ2VybHkgZXZhbHVhdGVkIGluIHRoZSBjb2RlLlxuICpcbiAqIE5vcm1hbGx5LCB0aGUgbGlua2VyIHdpbGwgc3RhdGljYWxseSBwcm9jZXNzIHRoZSBjb2RlLCBwdXR0aW5nIHRoZSBgZXhwcmVzc2lvbmAgaW5zaWRlIGEgZmFjdG9yeVxuICogZnVuY3Rpb24gc28gdGhlIGBmb3J3YXJkUmVmKClgIHdyYXBwZXIgaXMgbm90IGV2YWx1YXRlZCBiZWZvcmUgaXQgaGFzIGJlZW4gZGVmaW5lZC4gQnV0IGlmIHRoZVxuICogcGFydGlhbCBkZWNsYXJhdGlvbiBpcyBldmFsdWF0ZWQgYnkgdGhlIEpJVCBjb21waWxlciB0aGUgYGZvcndhcmRSZWYoKWAgY2FsbCBpcyBzdGlsbCBuZWVkZWQgdG9cbiAqIHByZXZlbnQgZWFnZXIgZXZhbHVhdGlvbiBvZiB0aGUgYGV4cHJlc3Npb25gLlxuICpcbiAqIFNvIGluIHBhcnRpYWwgZGVjbGFyYXRpb25zLCBleHByZXNzaW9ucyB0aGF0IGNvdWxkIGJlIGZvcndhcmQtcmVmcyBhcmUgd3JhcHBlZCBpbiBgZm9yd2FyZFJlZigpYFxuICogY2FsbHMsIGFuZCB0aGlzIGlzIHRoZW4gdW53cmFwcGVkIGluIHRoZSBsaW5rZXIgYXMgbmVjZXNzYXJ5LlxuICpcbiAqIFNlZSBgcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvaW5qZWN0YWJsZS50c2AgYW5kXG4gKiBgcGFja2FnZXMvY29tcGlsZXIvc3JjL2ppdF9jb21waWxlcl9mYWNhZGUudHNgIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0RnJvbVByb3ZpZGVyRXhwcmVzc2lvbih7ZXhwcmVzc2lvbiwgaXNGb3J3YXJkUmVmfTogUjNQcm92aWRlckV4cHJlc3Npb24pOlxuICAgIG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBpc0ZvcndhcmRSZWYgPyBnZW5lcmF0ZUZvcndhcmRSZWYoZXhwcmVzc2lvbikgOiBleHByZXNzaW9uO1xufVxuIl19