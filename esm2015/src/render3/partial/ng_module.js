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
    definitionMap.set('version', o.literal('12.0.0-next.8+77.sha-b4c3c89'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.internalType);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9uZ19tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxrQkFBa0IsRUFBcUIsTUFBTSx1QkFBdUIsQ0FBQztBQUM3RSxPQUFPLEVBQXVCLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUMxRCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBSzNDLE1BQU0sVUFBVSxrQ0FBa0MsQ0FBQyxJQUF3QjtJQUN6RSxNQUFNLGFBQWEsR0FBRywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV4RCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNGLE1BQU0sSUFBSSxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXRDLE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLDJCQUEyQixDQUFDLElBQXdCO0lBRTNELE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUE2QixDQUFDO0lBRXJFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRTdDLDBFQUEwRTtJQUUxRSw4RkFBOEY7SUFDOUYsZ0dBQWdHO0lBQ2hHLGtHQUFrRztJQUVsRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUM3QixhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0tBQ3hGO0lBRUQsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDaEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztLQUM5RjtJQUVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7S0FDcEY7SUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0tBQ3BGO0lBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDcEQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDaEY7SUFFRCxJQUFJLElBQUksQ0FBQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3BCLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNsQztJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtjcmVhdGVOZ01vZHVsZVR5cGUsIFIzTmdNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi4vcjNfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb24sIHJlZnNUb0FycmF5fSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVOZ01vZHVsZU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlTmdNb2R1bGVGcm9tTWV0YWRhdGEobWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlTmdNb2R1bGVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZU5nTW9kdWxlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZU5nTW9kdWxlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGFuIE5nTW9kdWxlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU5nTW9kdWxlRGVmaW5pdGlvbk1hcChtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlTmdNb2R1bGVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlTmdNb2R1bGVNZXRhZGF0YT4oKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuXG4gIC8vIFdlIG9ubHkgZ2VuZXJhdGUgdGhlIGtleXMgaW4gdGhlIG1ldGFkYXRhIGlmIHRoZSBhcnJheXMgY29udGFpbiB2YWx1ZXMuXG5cbiAgLy8gV2UgbXVzdCB3cmFwIHRoZSBhcnJheXMgaW5zaWRlIGEgZnVuY3Rpb24gaWYgYW55IG9mIHRoZSB2YWx1ZXMgYXJlIGEgZm9yd2FyZCByZWZlcmVuY2UgdG8gYVxuICAvLyBub3QteWV0LWRlY2xhcmVkIGNsYXNzLiBUaGlzIGlzIHRvIHN1cHBvcnQgSklUIGV4ZWN1dGlvbiBvZiB0aGUgYMm1ybVuZ0RlY2xhcmVOZ01vZHVsZSgpYCBjYWxsLlxuICAvLyBJbiB0aGUgbGlua2VyIHRoZXNlIHdyYXBwZXJzIGFyZSBzdHJpcHBlZCBhbmQgdGhlbiByZWFwcGxpZWQgZm9yIHRoZSBgybXJtWRlZmluZU5nTW9kdWxlKClgIGNhbGwuXG5cbiAgaWYgKG1ldGEuYm9vdHN0cmFwLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnYm9vdHN0cmFwJywgcmVmc1RvQXJyYXkobWV0YS5ib290c3RyYXAsIG1ldGEuY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xhcmF0aW9ucycsIHJlZnNUb0FycmF5KG1ldGEuZGVjbGFyYXRpb25zLCBtZXRhLmNvbnRhaW5zRm9yd2FyZERlY2xzKSk7XG4gIH1cblxuICBpZiAobWV0YS5pbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaW1wb3J0cycsIHJlZnNUb0FycmF5KG1ldGEuaW1wb3J0cywgbWV0YS5jb250YWluc0ZvcndhcmREZWNscykpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydHMnLCByZWZzVG9BcnJheShtZXRhLmV4cG9ydHMsIG1ldGEuY29udGFpbnNGb3J3YXJkRGVjbHMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnNjaGVtYXMgIT09IG51bGwgJiYgbWV0YS5zY2hlbWFzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2NoZW1hcycsIG8ubGl0ZXJhbEFycihtZXRhLnNjaGVtYXMubWFwKHJlZiA9PiByZWYudmFsdWUpKSk7XG4gIH1cblxuICBpZiAobWV0YS5pZCAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpZCcsIG1ldGEuaWQpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG4iXX0=