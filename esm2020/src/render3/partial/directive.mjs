/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { convertFromMaybeForwardRefExpression, generateForwardRef } from '../util';
import { createDirectiveType, createHostDirectivesMappingArray } from '../view/compiler';
import { asLiteral, conditionallyCreateDirectiveBindingLiteral, DefinitionMap } from '../view/util';
import { toOptionalLiteralMap } from './util';
/**
 * Every time we make a breaking change to the declaration interface or partial-linker behavior, we
 * must update this constant to prevent old partial-linkers from incorrectly processing the
 * declaration.
 *
 * Do not include any prerelease in these versions as they are ignored.
 */
const MINIMUM_PARTIAL_LINKER_VERSION = '14.0.0';
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
    definitionMap.set('minVersion', o.literal(MINIMUM_PARTIAL_LINKER_VERSION));
    definitionMap.set('version', o.literal('16.0.0-next.3+sha-d5946bd'));
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.internalType);
    if (meta.isStandalone) {
        definitionMap.set('isStandalone', o.literal(meta.isStandalone));
    }
    // e.g. `selector: 'some-dir'`
    if (meta.selector !== null) {
        definitionMap.set('selector', o.literal(meta.selector));
    }
    definitionMap.set('inputs', conditionallyCreateDirectiveBindingLiteral(meta.inputs, true));
    definitionMap.set('outputs', conditionallyCreateDirectiveBindingLiteral(meta.outputs));
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
    if (meta.hostDirectives?.length) {
        definitionMap.set('hostDirectives', createHostDirectives(meta.hostDirectives));
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
    meta.set('predicate', Array.isArray(query.predicate) ? asLiteral(query.predicate) :
        convertFromMaybeForwardRefExpression(query.predicate));
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
function createHostDirectives(hostDirectives) {
    const expressions = hostDirectives.map(current => {
        const keys = [{
                key: 'directive',
                value: current.isForwardReference ? generateForwardRef(current.directive.type) :
                    current.directive.type,
                quoted: false
            }];
        const inputsLiteral = current.inputs ? createHostDirectivesMappingArray(current.inputs) : null;
        const outputsLiteral = current.outputs ? createHostDirectivesMappingArray(current.outputs) : null;
        if (inputsLiteral) {
            keys.push({ key: 'inputs', value: inputsLiteral, quoted: false });
        }
        if (outputsLiteral) {
            keys.push({ key: 'outputs', value: outputsLiteral, quoted: false });
        }
        return o.literalMap(keys);
    });
    // If there's a forward reference, we generate a `function() { return [{directive: HostDir}] }`,
    // otherwise we can save some bytes by using a plain array, e.g. `[{directive: HostDir}]`.
    return o.literalArr(expressions);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSxrQkFBa0IsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFFdkcsT0FBTyxFQUFDLG1CQUFtQixFQUFFLGdDQUFnQyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdkYsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQ0FBMEMsRUFBRSxhQUFhLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFHbEcsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOzs7Ozs7R0FNRztBQUNILE1BQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0FBRWhEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLElBQXlCO0lBRTNFLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXpELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RixNQUFNLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSw0QkFBNEIs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IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2NvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgZ2VuZXJhdGVGb3J3YXJkUmVmLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlVHlwZSwgY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXl9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbCwgRGVmaW5pdGlvbk1hcH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbE1hcH0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlciBiZWhhdmlvciwgd2VcbiAqIG11c3QgdXBkYXRlIHRoaXMgY29uc3RhbnQgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb20gaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGVcbiAqIGRlY2xhcmF0aW9uLlxuICpcbiAqIERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmNvbnN0IE1JTklNVU1fUEFSVElBTF9MSU5LRVJfVkVSU0lPTiA9ICcxNC4wLjAnO1xuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6XG4gICAgUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgZGlyZWN0aXZlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuIFRoaXMgYWxsb3dzIGZvciByZXVzaW5nXG4gKiB0aGlzIGxvZ2ljIGZvciBjb21wb25lbnRzLCBhcyB0aGV5IGV4dGVuZCB0aGUgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YT4oKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcblxuICBpZiAobWV0YS5pc1N0YW5kYWxvbmUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaXNTdGFuZGFsb25lJywgby5saXRlcmFsKG1ldGEuaXNTdGFuZGFsb25lKSk7XG4gIH1cblxuICAvLyBlLmcuIGBzZWxlY3RvcjogJ3NvbWUtZGlyJ2BcbiAgaWYgKG1ldGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwobWV0YS5zZWxlY3RvcikpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdCcsIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YS5ob3N0KSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3ZpZGVycycsIG1ldGEucHJvdmlkZXJzKTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnF1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS52aWV3UXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBhc0xpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNJbmhlcml0YW5jZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzT25DaGFuZ2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdERpcmVjdGl2ZXMnLCBjcmVhdGVIb3N0RGlyZWN0aXZlcyhtZXRhLmhvc3REaXJlY3RpdmVzKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBtZXRhZGF0YSBvZiBhIHNpbmdsZSBxdWVyeSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGJ5IGBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVF1ZXJ5KHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGE+KCk7XG4gIG1ldGEuc2V0KCdwcm9wZXJ0eU5hbWUnLCBvLmxpdGVyYWwocXVlcnkucHJvcGVydHlOYW1lKSk7XG4gIGlmIChxdWVyeS5maXJzdCkge1xuICAgIG1ldGEuc2V0KCdmaXJzdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoXG4gICAgICAncHJlZGljYXRlJyxcbiAgICAgIEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSA/IGFzTGl0ZXJhbChxdWVyeS5wcmVkaWNhdGUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihxdWVyeS5wcmVkaWNhdGUpKTtcbiAgaWYgKCFxdWVyeS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSkge1xuICAgIC8vIGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgaXMgc3BlY2lhbCBiZWNhdXNlIHdlIGV4cGVjdCBpdCB0byBiZSBgdHJ1ZWAuXG4gICAgLy8gVGhlcmVmb3JlIHdlIGV4cGxpY2l0bHkgZW1pdCB0aGUgZmllbGQsIGFuZCBleHBsaWNpdGx5IHBsYWNlIGl0IG9ubHkgd2hlbiBpdCdzIGBmYWxzZWAuXG4gICAgbWV0YS5zZXQoJ2VtaXREaXN0aW5jdENoYW5nZXNPbmx5Jywgby5saXRlcmFsKGZhbHNlKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIGxpbmtlciB3aWxsIGFzc3VtZSB0aGF0IGFuIGFic2VudCBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGZsYWcgaXMgYnkgZGVmYXVsdCBgdHJ1ZWAuXG4gIH1cbiAgaWYgKHF1ZXJ5LmRlc2NlbmRhbnRzKSB7XG4gICAgbWV0YS5zZXQoJ2Rlc2NlbmRhbnRzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldCgncmVhZCcsIHF1ZXJ5LnJlYWQpO1xuICBpZiAocXVlcnkuc3RhdGljKSB7XG4gICAgbWV0YS5zZXQoJ3N0YXRpYycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgcmV0dXJuIG1ldGEudG9MaXRlcmFsTWFwKCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGhvc3QgbWV0YWRhdGEgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBpbiBgUjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3QnXWBcbiAqL1xuZnVuY3Rpb24gY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGhvc3RNZXRhZGF0YSA9IG5ldyBEZWZpbml0aW9uTWFwPE5vbk51bGxhYmxlPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J10+PigpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdhdHRyaWJ1dGVzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5hdHRyaWJ1dGVzLCBleHByZXNzaW9uID0+IGV4cHJlc3Npb24pKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnbGlzdGVuZXJzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5saXN0ZW5lcnMsIG8ubGl0ZXJhbCkpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdwcm9wZXJ0aWVzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5wcm9wZXJ0aWVzLCBvLmxpdGVyYWwpKTtcblxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdzdHlsZUF0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikpO1xuICB9XG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ2NsYXNzQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSk7XG4gIH1cblxuICBpZiAoaG9zdE1ldGFkYXRhLnZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGhvc3RNZXRhZGF0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlcyhob3N0RGlyZWN0aXZlczogTm9uTnVsbGFibGU8UjNEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdERpcmVjdGl2ZXMnXT4pOlxuICAgIG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGV4cHJlc3Npb25zID0gaG9zdERpcmVjdGl2ZXMubWFwKGN1cnJlbnQgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBbe1xuICAgICAga2V5OiAnZGlyZWN0aXZlJyxcbiAgICAgIHZhbHVlOiBjdXJyZW50LmlzRm9yd2FyZFJlZmVyZW5jZSA/IGdlbmVyYXRlRm9yd2FyZFJlZihjdXJyZW50LmRpcmVjdGl2ZS50eXBlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmRpcmVjdGl2ZS50eXBlLFxuICAgICAgcXVvdGVkOiBmYWxzZVxuICAgIH1dO1xuICAgIGNvbnN0IGlucHV0c0xpdGVyYWwgPSBjdXJyZW50LmlucHV0cyA/IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQuaW5wdXRzKSA6IG51bGw7XG4gICAgY29uc3Qgb3V0cHV0c0xpdGVyYWwgPVxuICAgICAgICBjdXJyZW50Lm91dHB1dHMgPyBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpIDogbnVsbDtcblxuICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ2lucHV0cycsIHZhbHVlOiBpbnB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMpO1xuICB9KTtcblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW3tkaXJlY3RpdmU6IEhvc3REaXJ9XSB9YCxcbiAgLy8gb3RoZXJ3aXNlIHdlIGNhbiBzYXZlIHNvbWUgYnl0ZXMgYnkgdXNpbmcgYSBwbGFpbiBhcnJheSwgZS5nLiBgW3tkaXJlY3RpdmU6IEhvc3REaXJ9XWAuXG4gIHJldHVybiBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuIl19