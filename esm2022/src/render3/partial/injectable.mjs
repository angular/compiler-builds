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
import { convertFromMaybeForwardRefExpression } from '../util';
import { DefinitionMap } from '../view/util';
import { compileDependency } from './util';
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
    definitionMap.set('version', o.literal('17.1.1+sha-b216e76'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.type.value);
    // Only generate providedIn property if it has a non-null value
    if (meta.providedIn !== undefined) {
        const providedIn = convertFromMaybeForwardRefExpression(meta.providedIn);
        if (providedIn.value !== null) {
            definitionMap.set('providedIn', providedIn);
        }
    }
    if (meta.useClass !== undefined) {
        definitionMap.set('useClass', convertFromMaybeForwardRefExpression(meta.useClass));
    }
    if (meta.useExisting !== undefined) {
        definitionMap.set('useExisting', convertFromMaybeForwardRefExpression(meta.useExisting));
    }
    if (meta.useValue !== undefined) {
        definitionMap.set('useValue', convertFromMaybeForwardRefExpression(meta.useValue));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvaW5qZWN0YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQUMsb0JBQW9CLEVBQXVCLE1BQU0sNkJBQTZCLENBQUM7QUFDdkYsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxvQ0FBb0MsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFDbkYsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUczQyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFekM7Ozs7OztHQU1HO0FBQ0gsTUFBTSw4QkFBOEIsR0FBRyxRQUFRLENBQUM7QUFFaEQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0NBQW9DLENBQUMsSUFBMEI7SUFFN0UsTUFBTSxhQUFhLEdBQUcsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFMUQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdGLE1BQU0sSUFBSSxHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXhDLE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsNkJBQTZCLENBQUMsSUFBMEI7SUFFdEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQStCLENBQUM7SUFFdkUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7SUFDM0UsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTNDLCtEQUErRDtJQUMvRCxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDbEMsTUFBTSxVQUFVLEdBQUcsb0NBQW9DLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pFLElBQUssVUFBNEIsQ0FBQyxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDakQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDOUMsQ0FBQztJQUNILENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDaEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsb0NBQW9DLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUNELElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNuQyxhQUFhLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ2hDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7SUFDRCxnR0FBZ0c7SUFDaEcsa0dBQWtHO0lBQ2xHLDBDQUEwQztJQUMxQyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDbEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDNUIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtjcmVhdGVJbmplY3RhYmxlVHlwZSwgUjNJbmplY3RhYmxlTWV0YWRhdGF9IGZyb20gJy4uLy4uL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NvbXBpbGVEZXBlbmRlbmN5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIEluamVjdGFibGUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzSW5qZWN0YWJsZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlSW5qZWN0YWJsZUZyb21NZXRhZGF0YShtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6XG4gICAgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlSW5qZWN0YWJsZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlSW5qZWN0YWJsZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVJbmplY3RhYmxlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgSW5qZWN0YWJsZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW5qZWN0YWJsZURlZmluaXRpb25NYXAobWV0YTogUjNJbmplY3RhYmxlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlSW5qZWN0YWJsZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVJbmplY3RhYmxlTWV0YWRhdGE+KCk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIC8vIE9ubHkgZ2VuZXJhdGUgcHJvdmlkZWRJbiBwcm9wZXJ0eSBpZiBpdCBoYXMgYSBub24tbnVsbCB2YWx1ZVxuICBpZiAobWV0YS5wcm92aWRlZEluICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBwcm92aWRlZEluID0gY29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uKG1ldGEucHJvdmlkZWRJbik7XG4gICAgaWYgKChwcm92aWRlZEluIGFzIG8uTGl0ZXJhbEV4cHIpLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZWRJbicsIHByb3ZpZGVkSW4pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChtZXRhLnVzZUNsYXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlQ2xhc3MnLCBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24obWV0YS51c2VDbGFzcykpO1xuICB9XG4gIGlmIChtZXRhLnVzZUV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlRXhpc3RpbmcnLCBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24obWV0YS51c2VFeGlzdGluZykpO1xuICB9XG4gIGlmIChtZXRhLnVzZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlVmFsdWUnLCBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24obWV0YS51c2VWYWx1ZSkpO1xuICB9XG4gIC8vIEZhY3RvcmllcyBkbyBub3QgY29udGFpbiBgRm9yd2FyZFJlZmBzIHNpbmNlIGFueSB0eXBlcyBhcmUgYWxyZWFkeSB3cmFwcGVkIGluIGEgZnVuY3Rpb24gY2FsbFxuICAvLyBzbyB0aGUgdHlwZXMgd2lsbCBub3QgYmUgZWFnZXJseSBldmFsdWF0ZWQuIFRoZXJlZm9yZSB3ZSBkbyBub3QgbmVlZCB0byBwcm9jZXNzIHRoaXMgZXhwcmVzc2lvblxuICAvLyB3aXRoIGBjb252ZXJ0RnJvbVByb3ZpZGVyRXhwcmVzc2lvbigpYC5cbiAgaWYgKG1ldGEudXNlRmFjdG9yeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZUZhY3RvcnknLCBtZXRhLnVzZUZhY3RvcnkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZGVwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlcHMnLCBvLmxpdGVyYWxBcnIobWV0YS5kZXBzLm1hcChjb21waWxlRGVwZW5kZW5jeSkpKTtcbiAgfVxuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuIl19