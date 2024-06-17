/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { compileComponentMetadataAsyncResolver, } from '../r3_class_metadata_compiler';
import { Identifiers as R3 } from '../r3_identifiers';
import { DefinitionMap } from '../view/util';
/**
 * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
 * must update this constant to prevent old partial-linkers from incorrectly processing the
 * declaration.
 *
 * Do not include any prerelease in these versions as they are ignored.
 */
const MINIMUM_PARTIAL_LINKER_VERSION = '12.0.0';
/**
 * Minimum version at which deferred blocks are supported in the linker.
 */
const MINIMUM_PARTIAL_LINKER_DEFER_SUPPORT_VERSION = '18.0.0';
export function compileDeclareClassMetadata(metadata) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('18.1.0-next.2+sha-5a45d2b'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', metadata.type);
    definitionMap.set('decorators', metadata.decorators);
    definitionMap.set('ctorParameters', metadata.ctorParameters);
    definitionMap.set('propDecorators', metadata.propDecorators);
    return o.importExpr(R3.declareClassMetadata).callFn([definitionMap.toLiteralMap()]);
}
export function compileComponentDeclareClassMetadata(metadata, dependencies) {
    if (dependencies === null || dependencies.length === 0) {
        return compileDeclareClassMetadata(metadata);
    }
    const definitionMap = new DefinitionMap();
    const callbackReturnDefinitionMap = new DefinitionMap();
    callbackReturnDefinitionMap.set('decorators', metadata.decorators);
    callbackReturnDefinitionMap.set('ctorParameters', metadata.ctorParameters ?? o.literal(null));
    callbackReturnDefinitionMap.set('propDecorators', metadata.propDecorators ?? o.literal(null));
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_DEFER_SUPPORT_VERSION));
    definitionMap.set('version', o.literal('18.1.0-next.2+sha-5a45d2b'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', metadata.type);
    definitionMap.set('resolveDeferredDeps', compileComponentMetadataAsyncResolver(dependencies));
    definitionMap.set('resolveMetadata', o.arrowFn(dependencies.map((dep) => new o.FnParam(dep.symbolName, o.DYNAMIC_TYPE)), callbackReturnDefinitionMap.toLiteralMap()));
    return o.importExpr(R3.declareClassMetadataAsync).callFn([definitionMap.toLiteralMap()]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NfbWV0YWRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9wYXJ0aWFsL2NsYXNzX21ldGFkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUNMLHFDQUFxQyxHQUV0QyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUkzQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztBQUVoRDs7R0FFRztBQUNILE1BQU0sNENBQTRDLEdBQUcsUUFBUSxDQUFDO0FBRTlELE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxRQUF5QjtJQUNuRSxNQUFNLGFBQWEsR0FBRyxJQUFJLGFBQWEsRUFBMEIsQ0FBQztJQUNsRSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztJQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JELGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFN0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUVELE1BQU0sVUFBVSxvQ0FBb0MsQ0FDbEQsUUFBeUIsRUFDekIsWUFBb0Q7SUFFcEQsSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDdkQsT0FBTywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQStCLENBQUM7SUFDdkUsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLGFBQWEsRUFBbUIsQ0FBQztJQUN6RSwyQkFBMkIsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNuRSwyQkFBMkIsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDOUYsMkJBQTJCLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRTlGLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsNENBQTRDLENBQUMsQ0FBQyxDQUFDO0lBQ3pGLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLGFBQWEsQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUscUNBQXFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUM5RixhQUFhLENBQUMsR0FBRyxDQUNmLGlCQUFpQixFQUNqQixDQUFDLENBQUMsT0FBTyxDQUNQLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUN4RSwyQkFBMkIsQ0FBQyxZQUFZLEVBQUUsQ0FDM0MsQ0FDRixDQUFDO0lBRUYsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1xuICBjb21waWxlQ29tcG9uZW50TWV0YWRhdGFBc3luY1Jlc29sdmVyLFxuICBSM0NsYXNzTWV0YWRhdGEsXG59IGZyb20gJy4uL3IzX2NsYXNzX21ldGFkYXRhX2NvbXBpbGVyJztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNEZWZlclBlckNvbXBvbmVudERlcGVuZGVuY3l9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7RGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVDbGFzc01ldGFkYXRhLCBSM0RlY2xhcmVDbGFzc01ldGFkYXRhQXN5bmN9IGZyb20gJy4vYXBpJztcblxuLyoqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlciBiZWhhdmlvciwgd2VcbiAqIG11c3QgdXBkYXRlIHRoaXMgY29uc3RhbnQgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb20gaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGVcbiAqIGRlY2xhcmF0aW9uLlxuICpcbiAqIERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTiA9ICcxMi4wLjAnO1xuXG4vKipcbiAqIE1pbmltdW0gdmVyc2lvbiBhdCB3aGljaCBkZWZlcnJlZCBibG9ja3MgYXJlIHN1cHBvcnRlZCBpbiB0aGUgbGlua2VyLlxuICovXG5jb25zdCBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX0RFRkVSX1NVUFBPUlRfVkVSU0lPTiA9ICcxOC4wLjAnO1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVDbGFzc01ldGFkYXRhKG1ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGEpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ2xhc3NNZXRhZGF0YT4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhZGF0YS50eXBlKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY29yYXRvcnMnLCBtZXRhZGF0YS5kZWNvcmF0b3JzKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2N0b3JQYXJhbWV0ZXJzJywgbWV0YWRhdGEuY3RvclBhcmFtZXRlcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgncHJvcERlY29yYXRvcnMnLCBtZXRhZGF0YS5wcm9wRGVjb3JhdG9ycyk7XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlQ2xhc3NNZXRhZGF0YSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RGVjbGFyZUNsYXNzTWV0YWRhdGEoXG4gIG1ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGEsXG4gIGRlcGVuZGVuY2llczogUjNEZWZlclBlckNvbXBvbmVudERlcGVuZGVuY3lbXSB8IG51bGwsXG4pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoZGVwZW5kZW5jaWVzID09PSBudWxsIHx8IGRlcGVuZGVuY2llcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gY29tcGlsZURlY2xhcmVDbGFzc01ldGFkYXRhKG1ldGFkYXRhKTtcbiAgfVxuXG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDbGFzc01ldGFkYXRhQXN5bmM+KCk7XG4gIGNvbnN0IGNhbGxiYWNrUmV0dXJuRGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzQ2xhc3NNZXRhZGF0YT4oKTtcbiAgY2FsbGJhY2tSZXR1cm5EZWZpbml0aW9uTWFwLnNldCgnZGVjb3JhdG9ycycsIG1ldGFkYXRhLmRlY29yYXRvcnMpO1xuICBjYWxsYmFja1JldHVybkRlZmluaXRpb25NYXAuc2V0KCdjdG9yUGFyYW1ldGVycycsIG1ldGFkYXRhLmN0b3JQYXJhbWV0ZXJzID8/IG8ubGl0ZXJhbChudWxsKSk7XG4gIGNhbGxiYWNrUmV0dXJuRGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3BEZWNvcmF0b3JzJywgbWV0YWRhdGEucHJvcERlY29yYXRvcnMgPz8gby5saXRlcmFsKG51bGwpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX0RFRkVSX1NVUFBPUlRfVkVSU0lPTikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YWRhdGEudHlwZSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdyZXNvbHZlRGVmZXJyZWREZXBzJywgY29tcGlsZUNvbXBvbmVudE1ldGFkYXRhQXN5bmNSZXNvbHZlcihkZXBlbmRlbmNpZXMpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgJ3Jlc29sdmVNZXRhZGF0YScsXG4gICAgby5hcnJvd0ZuKFxuICAgICAgZGVwZW5kZW5jaWVzLm1hcCgoZGVwKSA9PiBuZXcgby5GblBhcmFtKGRlcC5zeW1ib2xOYW1lLCBvLkRZTkFNSUNfVFlQRSkpLFxuICAgICAgY2FsbGJhY2tSZXR1cm5EZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpLFxuICAgICksXG4gICk7XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlQ2xhc3NNZXRhZGF0YUFzeW5jKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbn1cbiJdfQ==