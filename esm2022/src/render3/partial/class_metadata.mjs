/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { compileComponentMetadataAsyncResolver } from '../r3_class_metadata_compiler';
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
    definitionMap.set('version', o.literal('18.0.0-next.2+sha-d839c58'));
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
    definitionMap.set('version', o.literal('18.0.0-next.2+sha-d839c58'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', metadata.type);
    definitionMap.set('resolveDeferredDeps', compileComponentMetadataAsyncResolver(dependencies));
    definitionMap.set('resolveMetadata', o.arrowFn(dependencies.map(dep => new o.FnParam(dep.symbolName, o.DYNAMIC_TYPE)), callbackReturnDefinitionMap.toLiteralMap()));
    return o.importExpr(R3.declareClassMetadataAsync).callFn([definitionMap.toLiteralMap()]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NfbWV0YWRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9wYXJ0aWFsL2NsYXNzX21ldGFkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUFDLHFDQUFxQyxFQUFrQixNQUFNLCtCQUErQixDQUFDO0FBQ3JHLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUkzQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztBQUVoRDs7R0FFRztBQUNILE1BQU0sNENBQTRDLEdBQUcsUUFBUSxDQUFDO0FBRTlELE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxRQUF5QjtJQUNuRSxNQUFNLGFBQWEsR0FBRyxJQUFJLGFBQWEsRUFBMEIsQ0FBQztJQUNsRSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztJQUMzRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUM3RCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JELGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDckQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFN0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUdELE1BQU0sVUFBVSxvQ0FBb0MsQ0FDaEQsUUFBeUIsRUFBRSxZQUFrRDtJQUMvRSxJQUFJLFlBQVksS0FBSyxJQUFJLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2RCxPQUFPLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLGFBQWEsRUFBK0IsQ0FBQztJQUN2RSxNQUFNLDJCQUEyQixHQUFHLElBQUksYUFBYSxFQUFtQixDQUFDO0lBQ3pFLDJCQUEyQixDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25FLDJCQUEyQixDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5RiwyQkFBMkIsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFOUYsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDLENBQUM7SUFDekYsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxxQ0FBcUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQzlGLGFBQWEsQ0FBQyxHQUFHLENBQ2IsaUJBQWlCLEVBQ2pCLENBQUMsQ0FBQyxPQUFPLENBQ0wsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUN0RSwyQkFBMkIsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFckQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRNZXRhZGF0YUFzeW5jUmVzb2x2ZXIsIFIzQ2xhc3NNZXRhZGF0YX0gZnJvbSAnLi4vcjNfY2xhc3NfbWV0YWRhdGFfY29tcGlsZXInO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0RlZmVyUGVyQ29tcG9uZW50RGVwZW5kZW5jeX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNsYXNzTWV0YWRhdGEsIFIzRGVjbGFyZUNsYXNzTWV0YWRhdGFBc3luY30gZnJvbSAnLi9hcGknO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzEyLjAuMCc7XG5cbi8qKlxuICogTWluaW11bSB2ZXJzaW9uIGF0IHdoaWNoIGRlZmVycmVkIGJsb2NrcyBhcmUgc3VwcG9ydGVkIGluIHRoZSBsaW5rZXIuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfREVGRVJfU1VQUE9SVF9WRVJTSU9OID0gJzE4LjAuMCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUNsYXNzTWV0YWRhdGEobWV0YWRhdGE6IFIzQ2xhc3NNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVDbGFzc01ldGFkYXRhPigpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGFkYXRhLnR5cGUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZGVjb3JhdG9ycycsIG1ldGFkYXRhLmRlY29yYXRvcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnY3RvclBhcmFtZXRlcnMnLCBtZXRhZGF0YS5jdG9yUGFyYW1ldGVycyk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdwcm9wRGVjb3JhdG9ycycsIG1ldGFkYXRhLnByb3BEZWNvcmF0b3JzKTtcblxuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDbGFzc01ldGFkYXRhKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudERlY2xhcmVDbGFzc01ldGFkYXRhKFxuICAgIG1ldGFkYXRhOiBSM0NsYXNzTWV0YWRhdGEsIGRlcGVuZGVuY2llczogUjNEZWZlclBlckNvbXBvbmVudERlcGVuZGVuY3lbXXxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGRlcGVuZGVuY2llcyA9PT0gbnVsbCB8fCBkZXBlbmRlbmNpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGNvbXBpbGVEZWNsYXJlQ2xhc3NNZXRhZGF0YShtZXRhZGF0YSk7XG4gIH1cblxuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ2xhc3NNZXRhZGF0YUFzeW5jPigpO1xuICBjb25zdCBjYWxsYmFja1JldHVybkRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0NsYXNzTWV0YWRhdGE+KCk7XG4gIGNhbGxiYWNrUmV0dXJuRGVmaW5pdGlvbk1hcC5zZXQoJ2RlY29yYXRvcnMnLCBtZXRhZGF0YS5kZWNvcmF0b3JzKTtcbiAgY2FsbGJhY2tSZXR1cm5EZWZpbml0aW9uTWFwLnNldCgnY3RvclBhcmFtZXRlcnMnLCBtZXRhZGF0YS5jdG9yUGFyYW1ldGVycyA/PyBvLmxpdGVyYWwobnVsbCkpO1xuICBjYWxsYmFja1JldHVybkRlZmluaXRpb25NYXAuc2V0KCdwcm9wRGVjb3JhdG9ycycsIG1ldGFkYXRhLnByb3BEZWNvcmF0b3JzID8/IG8ubGl0ZXJhbChudWxsKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwoTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9ERUZFUl9TVVBQT1JUX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGFkYXRhLnR5cGUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgncmVzb2x2ZURlZmVycmVkRGVwcycsIGNvbXBpbGVDb21wb25lbnRNZXRhZGF0YUFzeW5jUmVzb2x2ZXIoZGVwZW5kZW5jaWVzKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ3Jlc29sdmVNZXRhZGF0YScsXG4gICAgICBvLmFycm93Rm4oXG4gICAgICAgICAgZGVwZW5kZW5jaWVzLm1hcChkZXAgPT4gbmV3IG8uRm5QYXJhbShkZXAuc3ltYm9sTmFtZSwgby5EWU5BTUlDX1RZUEUpKSxcbiAgICAgICAgICBjYWxsYmFja1JldHVybkRlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCkpKTtcblxuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDbGFzc01ldGFkYXRhQXN5bmMpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xufVxuIl19