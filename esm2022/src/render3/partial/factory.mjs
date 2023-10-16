/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
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
    definitionMap.set('version', o.literal('17.1.0-next.0+sha-4ed6ff1'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxhQUFhLEVBQW9CLE1BQU0sZUFBZSxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUczQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFM0M7Ozs7OztHQU1HO0FBQ0gsTUFBTSw4QkFBOEIsR0FBRyxRQUFRLENBQUM7QUFFaEQsTUFBTSxVQUFVLDZCQUE2QixDQUFDLElBQXVCO0lBQ25FLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUE0QixDQUFDO0lBQ3BFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMzQyxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFN0YsT0FBTztRQUNMLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNsRixVQUFVLEVBQUUsRUFBRTtRQUNkLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7S0FDOUIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjcmVhdGVGYWN0b3J5VHlwZSwgRmFjdG9yeVRhcmdldCwgUjNGYWN0b3J5TWV0YWRhdGF9IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NvbXBpbGVEZXBlbmRlbmNpZXN9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogRXZlcnkgdGltZSB3ZSBtYWtlIGEgYnJlYWtpbmcgY2hhbmdlIHRvIHRoZSBkZWNsYXJhdGlvbiBpbnRlcmZhY2Ugb3IgcGFydGlhbC1saW5rZXIgYmVoYXZpb3IsIHdlXG4gKiBtdXN0IHVwZGF0ZSB0aGlzIGNvbnN0YW50IHRvIHByZXZlbnQgb2xkIHBhcnRpYWwtbGlua2VycyBmcm9tIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlXG4gKiBkZWNsYXJhdGlvbi5cbiAqXG4gKiBEbyBub3QgaW5jbHVkZSBhbnkgcHJlcmVsZWFzZSBpbiB0aGVzZSB2ZXJzaW9ucyBhcyB0aGV5IGFyZSBpZ25vcmVkLlxuICovXG5jb25zdCBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04gPSAnMTIuMC4wJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRmFjdG9yeUZ1bmN0aW9uKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhPigpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZS52YWx1ZSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdkZXBzJywgY29tcGlsZURlcGVuZGVuY2llcyhtZXRhLmRlcHMpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RhcmdldCcsIG8uaW1wb3J0RXhwcihSMy5GYWN0b3J5VGFyZ2V0KS5wcm9wKEZhY3RvcnlUYXJnZXRbbWV0YS50YXJnZXRdKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBleHByZXNzaW9uOiBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZUZhY3RvcnkpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pLFxuICAgIHN0YXRlbWVudHM6IFtdLFxuICAgIHR5cGU6IGNyZWF0ZUZhY3RvcnlUeXBlKG1ldGEpLFxuICB9O1xufVxuIl19