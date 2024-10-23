/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import * as o from '../../output/output_ast';
import { createFactoryType, FactoryTarget } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { DefinitionMap } from '../view/util';
import { compileDependencies } from './util';
/**
 * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
 * must update this constant to prevent old partial-linkers from incorrectly processing the
 * declaration.
 *
 * Do not include any prerelease in these versions as they are ignored.
 */
const MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
export function compileDeclareFactoryFunction(meta) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('18.2.9+sha-fae3c83'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.type.value);
    definitionMap.set('deps', compileDependencies(meta.deps));
    definitionMap.set('target', o.importExpr(R3.FactoryTarget).prop(FactoryTarget[meta.target]));
    return {
        expression: o.importExpr(R3.declareFactory).callFn([definitionMap.toLiteralMap()]),
        statements: [],
        type: createFactoryType(meta),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxhQUFhLEVBQW9CLE1BQU0sZUFBZSxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUczQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFM0M7Ozs7OztHQU1HO0FBQ0gsTUFBTSw4QkFBOEIsR0FBRyxRQUFRLENBQUM7QUFFaEQsTUFBTSxVQUFVLDZCQUE2QixDQUFDLElBQXVCO0lBQ25FLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUE0QixDQUFDO0lBQ3BFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMzQyxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFN0YsT0FBTztRQUNMLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNsRixVQUFVLEVBQUUsRUFBRTtRQUNkLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7S0FDOUIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5kZXYvbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Y3JlYXRlRmFjdG9yeVR5cGUsIEZhY3RvcnlUYXJnZXQsIFIzRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtjb21waWxlRGVwZW5kZW5jaWVzfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YT4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZGVwcycsIGNvbXBpbGVEZXBlbmRlbmNpZXMobWV0YS5kZXBzKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0YXJnZXQnLCBvLmltcG9ydEV4cHIoUjMuRmFjdG9yeVRhcmdldCkucHJvcChGYWN0b3J5VGFyZ2V0W21ldGEudGFyZ2V0XSkpO1xuXG4gIHJldHVybiB7XG4gICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKFIzLmRlY2xhcmVGYWN0b3J5KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKSxcbiAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICB0eXBlOiBjcmVhdGVGYWN0b3J5VHlwZShtZXRhKSxcbiAgfTtcbn1cbiJdfQ==