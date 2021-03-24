/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { createDirectiveType } from '../view/compiler';
import { asLiteral, conditionallyCreateMapObjectLiteral, DefinitionMap } from '../view/util';
import { toOptionalLiteralMap } from './util';
/**
 * Compile a directive declaration defined by the `R3DirectiveMetadata`.
 */
export function compileDeclareDirectiveFromMetadata(meta) {
    const definitionMap = createDirectiveDefinitionMap(meta);
    const expression = o.importExpr(R3.declareDirective).callFn([definitionMap.toLiteralMap()]);
    const type = createDirectiveType(meta);
    return { expression, type, statements: [] };
}
/**
 * Gathers the declaration fields for a directive into a `DefinitionMap`. This allows for reusing
 * this logic for components, as they extend the directive metadata.
 */
export function createDirectiveDefinitionMap(meta) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('version', o.literal('12.0.0-next.5+40.sha-3177d63'));
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.internalType);
    // e.g. `selector: 'some-dir'`
    if (meta.selector !== null) {
        definitionMap.set('selector', o.literal(meta.selector));
    }
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs, true));
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    definitionMap.set('host', compileHostMetadata(meta.host));
    definitionMap.set('providers', meta.providers);
    if (meta.queries.length > 0) {
        definitionMap.set('queries', o.literalArr(meta.queries.map(compileQuery)));
    }
    if (meta.viewQueries.length > 0) {
        definitionMap.set('viewQueries', o.literalArr(meta.viewQueries.map(compileQuery)));
    }
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', asLiteral(meta.exportAs));
    }
    if (meta.usesInheritance) {
        definitionMap.set('usesInheritance', o.literal(true));
    }
    if (meta.lifecycle.usesOnChanges) {
        definitionMap.set('usesOnChanges', o.literal(true));
    }
    definitionMap.set('ngImport', o.importExpr(R3.core));
    return definitionMap;
}
/**
 * Compiles the metadata of a single query into its partial declaration form as declared
 * by `R3DeclareQueryMetadata`.
 */
function compileQuery(query) {
    const meta = new DefinitionMap();
    meta.set('propertyName', o.literal(query.propertyName));
    if (query.first) {
        meta.set('first', o.literal(true));
    }
    meta.set('predicate', Array.isArray(query.predicate) ? asLiteral(query.predicate) : query.predicate);
    if (!query.emitDistinctChangesOnly) {
        // `emitDistinctChangesOnly` is special because we expect it to be `true`.
        // Therefore we explicitly emit the field, and explicitly place it only when it's `false`.
        meta.set('emitDistinctChangesOnly', o.literal(false));
    }
    else {
        // The linker will assume that an absent `emitDistinctChangesOnly` flag is by default `true`.
    }
    if (query.descendants) {
        meta.set('descendants', o.literal(true));
    }
    meta.set('read', query.read);
    if (query.static) {
        meta.set('static', o.literal(true));
    }
    return meta.toLiteralMap();
}
/**
 * Compiles the host metadata into its partial declaration form as declared
 * in `R3DeclareDirectiveMetadata['host']`
 */
function compileHostMetadata(meta) {
    const hostMetadata = new DefinitionMap();
    hostMetadata.set('attributes', toOptionalLiteralMap(meta.attributes, expression => expression));
    hostMetadata.set('listeners', toOptionalLiteralMap(meta.listeners, o.literal));
    hostMetadata.set('properties', toOptionalLiteralMap(meta.properties, o.literal));
    if (meta.specialAttributes.styleAttr) {
        hostMetadata.set('styleAttribute', o.literal(meta.specialAttributes.styleAttr));
    }
    if (meta.specialAttributes.classAttr) {
        hostMetadata.set('classAttribute', o.literal(meta.specialAttributes.classAttr));
    }
    if (hostMetadata.values.length > 0) {
        return hostMetadata.toLiteralMap();
    }
    else {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBR3BELE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3JELE9BQU8sRUFBQyxTQUFTLEVBQUUsbUNBQW1DLEVBQUUsYUFBYSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRTNGLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUc1Qzs7R0FFRztBQUNILE1BQU0sVUFBVSxtQ0FBbUMsQ0FBQyxJQUF5QjtJQUUzRSxNQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV6RCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUYsTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdkMsT0FBTyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBQyxDQUFDO0FBQzVDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsSUFBeUI7SUFFcEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQThCLENBQUM7SUFFdEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIs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aUIsQ0FBQyxTQUFTLEVBQUU7UUFDcEMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0tBQ2pGO0lBQ0QsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFO1FBQ3BDLFlBQVksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztLQUNqRjtJQUVELElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ2xDLE9BQU8sWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO0tBQ3BDO1NBQU07UUFDTCxPQUFPLElBQUksQ0FBQztLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1IzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7UjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7YXNMaXRlcmFsLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcbmltcG9ydCB7UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGEsIFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxNYXB9IGZyb20gJy4vdXRpbCc7XG5cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGRpcmVjdGl2ZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLiBUaGlzIGFsbG93cyBmb3IgcmV1c2luZ1xuICogdGhpcyBsb2dpYyBmb3IgY29tcG9uZW50cywgYXMgdGhleSBleHRlbmQgdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6XG4gICAgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcjogJ3NvbWUtZGlyJ2BcbiAgaWYgKG1ldGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwobWV0YS5zZWxlY3RvcikpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3QnLCBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGEuaG9zdCkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlcnMnLCBtZXRhLnByb3ZpZGVycyk7XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS5xdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnZpZXdRdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIGFzTGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc0luaGVyaXRhbmNlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzT25DaGFuZ2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIG1ldGFkYXRhIG9mIGEgc2luZ2xlIHF1ZXJ5IGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogYnkgYFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBjb21waWxlUXVlcnkocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUXVlcnlNZXRhZGF0YT4oKTtcbiAgbWV0YS5zZXQoJ3Byb3BlcnR5TmFtZScsIG8ubGl0ZXJhbChxdWVyeS5wcm9wZXJ0eU5hbWUpKTtcbiAgaWYgKHF1ZXJ5LmZpcnN0KSB7XG4gICAgbWV0YS5zZXQoJ2ZpcnN0Jywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldChcbiAgICAgICdwcmVkaWNhdGUnLCBBcnJheS5pc0FycmF5KHF1ZXJ5LnByZWRpY2F0ZSkgPyBhc0xpdGVyYWwocXVlcnkucHJlZGljYXRlKSA6IHF1ZXJ5LnByZWRpY2F0ZSk7XG4gIGlmICghcXVlcnkuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkpIHtcbiAgICAvLyBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGlzIHNwZWNpYWwgYmVjYXVzZSB3ZSBleHBlY3QgaXQgdG8gYmUgYHRydWVgLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBleHBsaWNpdGx5IGVtaXQgdGhlIGZpZWxkLCBhbmQgZXhwbGljaXRseSBwbGFjZSBpdCBvbmx5IHdoZW4gaXQncyBgZmFsc2VgLlxuICAgIG1ldGEuc2V0KCdlbWl0RGlzdGluY3RDaGFuZ2VzT25seScsIG8ubGl0ZXJhbChmYWxzZSkpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoZSBsaW5rZXIgd2lsbCBhc3N1bWUgdGhhdCBhbiBhYnNlbnQgYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBmbGFnIGlzIGJ5IGRlZmF1bHQgYHRydWVgLlxuICB9XG4gIGlmIChxdWVyeS5kZXNjZW5kYW50cykge1xuICAgIG1ldGEuc2V0KCdkZXNjZW5kYW50cycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoJ3JlYWQnLCBxdWVyeS5yZWFkKTtcbiAgaWYgKHF1ZXJ5LnN0YXRpYykge1xuICAgIG1ldGEuc2V0KCdzdGF0aWMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBtZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBob3N0IG1ldGFkYXRhIGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogaW4gYFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J11gXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBjb25zdCBob3N0TWV0YWRhdGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddPj4oKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnYXR0cmlidXRlcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEuYXR0cmlidXRlcywgZXhwcmVzc2lvbiA9PiBleHByZXNzaW9uKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdfQ==