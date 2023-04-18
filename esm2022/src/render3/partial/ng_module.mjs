/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { createNgModuleType } from '../r3_module_compiler';
import { refsToArray } from '../util';
import { DefinitionMap } from '../view/util';
/**
 * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
 * must update this constant to prevent old partial-linkers from incorrectly processing the
 * declaration.
 *
 * Do not include any prerelease in these versions as they are ignored.
 */
const MINIMUM_PARTIAL_LINKER_VERSION = '14.0.0';
export function compileDeclareNgModuleFromMetadata(meta) {
    const definitionMap = createNgModuleDefinitionMap(meta);
    const expression = o.importExpr(R3.declareNgModule).callFn([definitionMap.toLiteralMap()]);
    const type = createNgModuleType(meta);
    return { expression, type, statements: [] };
}
/**
 * Gathers the declaration fields for an NgModule into a `DefinitionMap`.
 */
function createNgModuleDefinitionMap(meta) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('16.0.0-rc.1+sha-8219857'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.type.value);
    // We only generate the keys in the metadata if the arrays contain values.
    // We must wrap the arrays inside a function if any of the values are a forward reference to a
    // not-yet-declared class. This is to support JIT execution of the `ɵɵngDeclareNgModule()` call.
    // In the linker these wrappers are stripped and then reapplied for the `ɵɵdefineNgModule()` call.
    if (meta.bootstrap.length > 0) {
        definitionMap.set('bootstrap', refsToArray(meta.bootstrap, meta.containsForwardDecls));
    }
    if (meta.declarations.length > 0) {
        definitionMap.set('declarations', refsToArray(meta.declarations, meta.containsForwardDecls));
    }
    if (meta.imports.length > 0) {
        definitionMap.set('imports', refsToArray(meta.imports, meta.containsForwardDecls));
    }
    if (meta.exports.length > 0) {
        definitionMap.set('exports', refsToArray(meta.exports, meta.containsForwardDecls));
    }
    if (meta.schemas !== null && meta.schemas.length > 0) {
        definitionMap.set('schemas', o.literalArr(meta.schemas.map(ref => ref.value)));
    }
    if (meta.id !== null) {
        definitionMap.set('id', meta.id);
    }
    return definitionMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9uZ19tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxrQkFBa0IsRUFBcUIsTUFBTSx1QkFBdUIsQ0FBQztBQUM3RSxPQUFPLEVBQXVCLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUMxRCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBSTNDOzs7Ozs7R0FNRztBQUNILE1BQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0FBRWhELE1BQU0sVUFBVSxrQ0FBa0MsQ0FBQyxJQUF3QjtJQUN6RSxNQUFNLGFBQWEsR0FBRywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV4RCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNGLE1BQU0sSUFBSSxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXRDLE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLDJCQUEyQixDQUFDLElBQXdCO0lBRTNELE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUE2QixDQUFDO0lBRXJFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUUzQywwRUFBMEU7SUFFMUUsOEZBQThGO0lBQzlGLGdHQUFnRztJQUNoRyxrR0FBa0c7SUFFbEcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDN0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztLQUN4RjtJQUVELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ2hDLGFBQWEsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7S0FDOUY7SUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0tBQ3BGO0lBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztLQUNwRjtJQUVELElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3BELGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2hGO0lBRUQsSUFBSSxJQUFJLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNwQixhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbEM7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y3JlYXRlTmdNb2R1bGVUeXBlLCBSM05nTW9kdWxlTWV0YWRhdGF9IGZyb20gJy4uL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9uLCByZWZzVG9BcnJheX0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlTmdNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzE0LjAuMCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZU5nTW9kdWxlRnJvbU1ldGFkYXRhKG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZU5nTW9kdWxlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVOZ01vZHVsZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVOZ01vZHVsZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhbiBOZ01vZHVsZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLlxuICovXG5mdW5jdGlvbiBjcmVhdGVOZ01vZHVsZURlZmluaXRpb25NYXAobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZU5nTW9kdWxlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZU5nTW9kdWxlTWV0YWRhdGE+KCk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIC8vIFdlIG9ubHkgZ2VuZXJhdGUgdGhlIGtleXMgaW4gdGhlIG1ldGFkYXRhIGlmIHRoZSBhcnJheXMgY29udGFpbiB2YWx1ZXMuXG5cbiAgLy8gV2UgbXVzdCB3cmFwIHRoZSBhcnJheXMgaW5zaWRlIGEgZnVuY3Rpb24gaWYgYW55IG9mIHRoZSB2YWx1ZXMgYXJlIGEgZm9yd2FyZCByZWZlcmVuY2UgdG8gYVxuICAvLyBub3QteWV0LWRlY2xhcmVkIGNsYXNzLiBUaGlzIGlzIHRvIHN1cHBvcnQgSklUIGV4ZWN1dGlvbiBvZiB0aGUgYMm1ybVuZ0RlY2xhcmVOZ01vZHVsZSgpYCBjYWxsLlxuICAvLyBJbiB0aGUgbGlua2VyIHRoZXNlIHdyYXBwZXJzIGFyZSBzdHJpcHBlZCBhbmQgdGhlbiByZWFwcGxpZWQgZm9yIHRoZSBgybXJtWRlZmluZU5nTW9kdWxlKClgIGNhbGwuXG5cbiAgaWYgKG1ldGEuYm9vdHN0cmFwLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnYm9vdHN0cmFwJywgcmVmc1RvQXJyYXkobWV0YS5ib290c3RyYXAsIG1ldGEuY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xhcmF0aW9ucycsIHJlZnNUb0FycmF5KG1ldGEuZGVjbGFyYXRpb25zLCBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICBpZiAobWV0YS5pbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW1wb3J0cycsIHJlZnNUb0FycmF5KG1ldGEuaW1wb3J0cywgbWV0YS5jb250YWluc0ZvcndhcmREZWNscykpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydHMnLCByZWZzVG9BcnJheShtZXRhLmV4cG9ydHMsIG1ldGEuY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnNjaGVtYXMgIT09IG51bGwgJiYgbWV0YS5zY2hlbWFzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2NoZW1hcycsIG8ubGl0ZXJhbEFycihtZXRhLnNjaGVtYXMubWFwKHJlZiA9PiByZWYudmFsdWUpKSk7XG4gIH1cblxuICBpZiAobWV0YS5pZCAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpZCcsIG1ldGEuaWQpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG4iXX0=