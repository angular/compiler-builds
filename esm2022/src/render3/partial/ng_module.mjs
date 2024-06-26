/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { createNgModuleType, R3NgModuleMetadataKind, } from '../r3_module_compiler';
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
    if (meta.kind === R3NgModuleMetadataKind.Local) {
        throw new Error('Invalid path! Local compilation mode should not get into the partial compilation path');
    }
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('18.0.4+sha-f49a2a4'));
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
        definitionMap.set('schemas', o.literalArr(meta.schemas.map((ref) => ref.value)));
    }
    if (meta.id !== null) {
        definitionMap.set('id', meta.id);
    }
    return definitionMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9uZ19tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFDTCxrQkFBa0IsRUFFbEIsc0JBQXNCLEdBQ3ZCLE1BQU0sdUJBQXVCLENBQUM7QUFDL0IsT0FBTyxFQUF1QixXQUFXLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDMUQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUkzQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztBQUVoRCxNQUFNLFVBQVUsa0NBQWtDLENBQUMsSUFBd0I7SUFDekUsTUFBTSxhQUFhLEdBQUcsMkJBQTJCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFeEQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzRixNQUFNLElBQUksR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV0QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUywyQkFBMkIsQ0FDbEMsSUFBd0I7SUFFeEIsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQTZCLENBQUM7SUFFckUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLHNCQUFzQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9DLE1BQU0sSUFBSSxLQUFLLENBQ2IsdUZBQXVGLENBQ3hGLENBQUM7SUFDSixDQUFDO0lBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7SUFDM0UsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTNDLDBFQUEwRTtJQUUxRSw4RkFBOEY7SUFDOUYsZ0dBQWdHO0lBQ2hHLGtHQUFrRztJQUVsRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzlCLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7SUFDekYsQ0FBQztJQUVELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDakMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUMvRixDQUFDO0lBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUM1QixhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzVCLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVELElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRUQsSUFBSSxJQUFJLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3JCLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1xuICBjcmVhdGVOZ01vZHVsZVR5cGUsXG4gIFIzTmdNb2R1bGVNZXRhZGF0YSxcbiAgUjNOZ01vZHVsZU1ldGFkYXRhS2luZCxcbn0gZnJvbSAnLi4vcjNfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb24sIHJlZnNUb0FycmF5fSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVOZ01vZHVsZU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5cbi8qKlxuICogRXZlcnkgdGltZSB3ZSBtYWtlIGEgYnJlYWtpbmcgY2hhbmdlIHRvIHRoZSBkZWNsYXJhdGlvbiBpbnRlcmZhY2Ugb3IgcGFydGlhbC1saW5rZXIgYmVoYXZpb3IsIHdlXG4gKiBtdXN0IHVwZGF0ZSB0aGlzIGNvbnN0YW50IHRvIHByZXZlbnQgb2xkIHBhcnRpYWwtbGlua2VycyBmcm9tIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlXG4gKiBkZWNsYXJhdGlvbi5cbiAqXG4gKiBEbyBub3QgaW5jbHVkZSBhbnkgcHJlcmVsZWFzZSBpbiB0aGVzZSB2ZXJzaW9ucyBhcyB0aGV5IGFyZSBpZ25vcmVkLlxuICovXG5jb25zdCBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04gPSAnMTQuMC4wJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlTmdNb2R1bGVGcm9tTWV0YWRhdGEobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlTmdNb2R1bGVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZU5nTW9kdWxlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZU5nTW9kdWxlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGFuIE5nTW9kdWxlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU5nTW9kdWxlRGVmaW5pdGlvbk1hcChcbiAgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhLFxuKTogRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVOZ01vZHVsZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVOZ01vZHVsZU1ldGFkYXRhPigpO1xuXG4gIGlmIChtZXRhLmtpbmQgPT09IFIzTmdNb2R1bGVNZXRhZGF0YUtpbmQuTG9jYWwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnSW52YWxpZCBwYXRoISBMb2NhbCBjb21waWxhdGlvbiBtb2RlIHNob3VsZCBub3QgZ2V0IGludG8gdGhlIHBhcnRpYWwgY29tcGlsYXRpb24gcGF0aCcsXG4gICAgKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlLnZhbHVlKTtcblxuICAvLyBXZSBvbmx5IGdlbmVyYXRlIHRoZSBrZXlzIGluIHRoZSBtZXRhZGF0YSBpZiB0aGUgYXJyYXlzIGNvbnRhaW4gdmFsdWVzLlxuXG4gIC8vIFdlIG11c3Qgd3JhcCB0aGUgYXJyYXlzIGluc2lkZSBhIGZ1bmN0aW9uIGlmIGFueSBvZiB0aGUgdmFsdWVzIGFyZSBhIGZvcndhcmQgcmVmZXJlbmNlIHRvIGFcbiAgLy8gbm90LXlldC1kZWNsYXJlZCBjbGFzcy4gVGhpcyBpcyB0byBzdXBwb3J0IEpJVCBleGVjdXRpb24gb2YgdGhlIGDJtcm1bmdEZWNsYXJlTmdNb2R1bGUoKWAgY2FsbC5cbiAgLy8gSW4gdGhlIGxpbmtlciB0aGVzZSB3cmFwcGVycyBhcmUgc3RyaXBwZWQgYW5kIHRoZW4gcmVhcHBsaWVkIGZvciB0aGUgYMm1ybVkZWZpbmVOZ01vZHVsZSgpYCBjYWxsLlxuXG4gIGlmIChtZXRhLmJvb3RzdHJhcC5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2Jvb3RzdHJhcCcsIHJlZnNUb0FycmF5KG1ldGEuYm9vdHN0cmFwLCBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICBpZiAobWV0YS5kZWNsYXJhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNsYXJhdGlvbnMnLCByZWZzVG9BcnJheShtZXRhLmRlY2xhcmF0aW9ucywgbWV0YS5jb250YWluc0ZvcndhcmREZWNscykpO1xuICB9XG5cbiAgaWYgKG1ldGEuaW1wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ltcG9ydHMnLCByZWZzVG9BcnJheShtZXRhLmltcG9ydHMsIG1ldGEuY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmV4cG9ydHMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRzJywgcmVmc1RvQXJyYXkobWV0YS5leHBvcnRzLCBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICBpZiAobWV0YS5zY2hlbWFzICE9PSBudWxsICYmIG1ldGEuc2NoZW1hcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NjaGVtYXMnLCBvLmxpdGVyYWxBcnIobWV0YS5zY2hlbWFzLm1hcCgocmVmKSA9PiByZWYudmFsdWUpKSk7XG4gIH1cblxuICBpZiAobWV0YS5pZCAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpZCcsIG1ldGEuaWQpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG4iXX0=