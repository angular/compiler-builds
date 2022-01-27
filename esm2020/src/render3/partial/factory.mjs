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
    definitionMap.set('version', o.literal('14.0.0-next.0+1018.sha-a03f80a.with-local-changes'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.internalType);
    definitionMap.set('deps', compileDependencies(meta.deps));
    definitionMap.set('target', o.importExpr(R3.FactoryTarget).prop(FactoryTarget[meta.target]));
    return {
        expression: o.importExpr(R3.declareFactory).callFn([definitionMap.toLiteralMap()]),
        statements: [],
        type: createFactoryType(meta),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxhQUFhLEVBQW9CLE1BQU0sZUFBZSxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUczQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFM0M7Ozs7OztHQU1HO0FBQ0gsTUFBTSw4QkFBOEIsR0FBRyxRQUFRLENBQUM7QUFFaEQsTUFBTSxVQUFVLDZCQUE2QixDQUFDLElBQXVCO0lBQ25FLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUE0QixDQUFDO0lBQ3BFLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzdDLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzFELGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU3RixPQUFPO1FBQ0wsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLFVBQVUsRUFBRSxFQUFFO1FBQ2QsSUFBSSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQztLQUM5QixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2NyZWF0ZUZhY3RvcnlUeXBlLCBGYWN0b3J5VGFyZ2V0LCBSM0ZhY3RvcnlNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVGYWN0b3J5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y29tcGlsZURlcGVuZGVuY2llc30gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlciBiZWhhdmlvciwgd2VcbiAqIG11c3QgdXBkYXRlIHRoaXMgY29uc3RhbnQgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb20gaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGVcbiAqIGRlY2xhcmF0aW9uLlxuICpcbiAqIERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTiA9ICcxMi4wLjAnO1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVGYWN0b3J5RnVuY3Rpb24obWV0YTogUjNGYWN0b3J5TWV0YWRhdGEpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVGYWN0b3J5TWV0YWRhdGE+KCk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZGVwcycsIGNvbXBpbGVEZXBlbmRlbmNpZXMobWV0YS5kZXBzKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0YXJnZXQnLCBvLmltcG9ydEV4cHIoUjMuRmFjdG9yeVRhcmdldCkucHJvcChGYWN0b3J5VGFyZ2V0W21ldGEudGFyZ2V0XSkpO1xuXG4gIHJldHVybiB7XG4gICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKFIzLmRlY2xhcmVGYWN0b3J5KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKSxcbiAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICB0eXBlOiBjcmVhdGVGYWN0b3J5VHlwZShtZXRhKSxcbiAgfTtcbn1cbiJdfQ==