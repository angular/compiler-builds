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
const MINIMUM_PARTIAL_LINKER_VERSION = '16.1.0';
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
    const hasTransformFunctions = Object.values(meta.inputs).some(input => input.transformFunction !== null);
    // Note: in order to allow consuming Angular libraries that have been compiled with 16.1+ in
    // Angular 16.0, we only force a minimum version of 16.1 if input transform feature as introduced
    // in 16.1 is actually used.
    const minVersion = hasTransformFunctions ? MINIMUM_PARTIAL_LINKER_VERSION : '14.0.0';
    definitionMap.set('minVersion', o.literal(minVersion));
    definitionMap.set('version', o.literal('17.0.0-next.8+sha-6fd863d'));
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.type.value);
    if (meta.isStandalone) {
        definitionMap.set('isStandalone', o.literal(meta.isStandalone));
    }
    if (meta.isSignal) {
        definitionMap.set('isSignal', o.literal(meta.isSignal));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSxrQkFBa0IsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFFdkcsT0FBTyxFQUFDLG1CQUFtQixFQUFFLGdDQUFnQyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdkYsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQ0FBMEMsRUFBRSxhQUFhLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFHbEcsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOzs7Ozs7R0FNRztBQUNILE1BQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0FBRWhEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLElBQXlCO0lBRTNFLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXpELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RixNQUFNLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSw0QkFBNEIs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QUksQ0FBQyxFQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQztTQUNqRTtRQUVELElBQUksY0FBYyxFQUFFO1lBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7U0FDbkU7UUFFRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsQ0FBQyxDQUFDLENBQUM7SUFFSCxnR0FBZ0c7SUFDaEcsMEZBQTBGO0lBQzFGLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNuQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBnZW5lcmF0ZUZvcndhcmRSZWYsIFIzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7UjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVUeXBlLCBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsLCBEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge3RvT3B0aW9uYWxMaXRlcmFsTWFwfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyIGJlaGF2aW9yLCB3ZVxuICogbXVzdCB1cGRhdGUgdGhpcyBjb25zdGFudCB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbSBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZVxuICogZGVjbGFyYXRpb24uXG4gKlxuICogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuY29uc3QgTUlOSU1VTV9QQVJUSUFMX0xJTktFUl9WRVJTSU9OID0gJzE2LjEuMCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBkaXJlY3RpdmUgaW50byBhIGBEZWZpbml0aW9uTWFwYC4gVGhpcyBhbGxvd3MgZm9yIHJldXNpbmdcbiAqIHRoaXMgbG9naWMgZm9yIGNvbXBvbmVudHMsIGFzIHRoZXkgZXh0ZW5kIHRoZSBkaXJlY3RpdmUgbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuXG4gIGNvbnN0IGhhc1RyYW5zZm9ybUZ1bmN0aW9ucyA9XG4gICAgICBPYmplY3QudmFsdWVzKG1ldGEuaW5wdXRzKS5zb21lKGlucHV0ID0+IGlucHV0LnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKTtcbiAgLy8gTm90ZTogaW4gb3JkZXIgdG8gYWxsb3cgY29uc3VtaW5nIEFuZ3VsYXIgbGlicmFyaWVzIHRoYXQgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggMTYuMSsgaW5cbiAgLy8gQW5ndWxhciAxNi4wLCB3ZSBvbmx5IGZvcmNlIGEgbWluaW11bSB2ZXJzaW9uIG9mIDE2LjEgaWYgaW5wdXQgdHJhbnNmb3JtIGZlYXR1cmUgYXMgaW50cm9kdWNlZFxuICAvLyBpbiAxNi4xIGlzIGFjdHVhbGx5IHVzZWQuXG4gIGNvbnN0IG1pblZlcnNpb24gPSBoYXNUcmFuc2Zvcm1GdW5jdGlvbnMgPyBNSU5JTVVNX1BBUlRJQUxfTElOS0VSX1ZFUlNJT04gOiAnMTQuMC4wJztcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChtaW5WZXJzaW9uKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIGlmIChtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc1N0YW5kYWxvbmUnLCBvLmxpdGVyYWwobWV0YS5pc1N0YW5kYWxvbmUpKTtcbiAgfVxuICBpZiAobWV0YS5pc1NpZ25hbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc1NpZ25hbCcsIG8ubGl0ZXJhbChtZXRhLmlzU2lnbmFsKSk7XG4gIH1cblxuICAvLyBlLmcuIGBzZWxlY3RvcjogJ3NvbWUtZGlyJ2BcbiAgaWYgKG1ldGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwobWV0YS5zZWxlY3RvcikpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdCcsIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YS5ob3N0KSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3ZpZGVycycsIG1ldGEucHJvdmlkZXJzKTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnF1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS52aWV3UXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBhc0xpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNJbmhlcml0YW5jZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzT25DaGFuZ2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdERpcmVjdGl2ZXMnLCBjcmVhdGVIb3N0RGlyZWN0aXZlcyhtZXRhLmhvc3REaXJlY3RpdmVzKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBtZXRhZGF0YSBvZiBhIHNpbmdsZSBxdWVyeSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGJ5IGBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVF1ZXJ5KHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGE+KCk7XG4gIG1ldGEuc2V0KCdwcm9wZXJ0eU5hbWUnLCBvLmxpdGVyYWwocXVlcnkucHJvcGVydHlOYW1lKSk7XG4gIGlmIChxdWVyeS5maXJzdCkge1xuICAgIG1ldGEuc2V0KCdmaXJzdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoXG4gICAgICAncHJlZGljYXRlJyxcbiAgICAgIEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKSA/IGFzTGl0ZXJhbChxdWVyeS5wcmVkaWNhdGUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihxdWVyeS5wcmVkaWNhdGUpKTtcbiAgaWYgKCFxdWVyeS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSkge1xuICAgIC8vIGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgaXMgc3BlY2lhbCBiZWNhdXNlIHdlIGV4cGVjdCBpdCB0byBiZSBgdHJ1ZWAuXG4gICAgLy8gVGhlcmVmb3JlIHdlIGV4cGxpY2l0bHkgZW1pdCB0aGUgZmllbGQsIGFuZCBleHBsaWNpdGx5IHBsYWNlIGl0IG9ubHkgd2hlbiBpdCdzIGBmYWxzZWAuXG4gICAgbWV0YS5zZXQoJ2VtaXREaXN0aW5jdENoYW5nZXNPbmx5Jywgby5saXRlcmFsKGZhbHNlKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIGxpbmtlciB3aWxsIGFzc3VtZSB0aGF0IGFuIGFic2VudCBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGZsYWcgaXMgYnkgZGVmYXVsdCBgdHJ1ZWAuXG4gIH1cbiAgaWYgKHF1ZXJ5LmRlc2NlbmRhbnRzKSB7XG4gICAgbWV0YS5zZXQoJ2Rlc2NlbmRhbnRzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldCgncmVhZCcsIHF1ZXJ5LnJlYWQpO1xuICBpZiAocXVlcnkuc3RhdGljKSB7XG4gICAgbWV0YS5zZXQoJ3N0YXRpYycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgcmV0dXJuIG1ldGEudG9MaXRlcmFsTWFwKCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGhvc3QgbWV0YWRhdGEgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBpbiBgUjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3QnXWBcbiAqL1xuZnVuY3Rpb24gY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHJ8bnVsbCB7XG4gIGNvbnN0IGhvc3RNZXRhZGF0YSA9IG5ldyBEZWZpbml0aW9uTWFwPE5vbk51bGxhYmxlPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J10+PigpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdhdHRyaWJ1dGVzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5hdHRyaWJ1dGVzLCBleHByZXNzaW9uID0+IGV4cHJlc3Npb24pKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnbGlzdGVuZXJzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5saXN0ZW5lcnMsIG8ubGl0ZXJhbCkpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdwcm9wZXJ0aWVzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5wcm9wZXJ0aWVzLCBvLmxpdGVyYWwpKTtcblxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdzdHlsZUF0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikpO1xuICB9XG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ2NsYXNzQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSk7XG4gIH1cblxuICBpZiAoaG9zdE1ldGFkYXRhLnZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGhvc3RNZXRhZGF0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlcyhob3N0RGlyZWN0aXZlczogTm9uTnVsbGFibGU8UjNEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdERpcmVjdGl2ZXMnXT4pOlxuICAgIG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGV4cHJlc3Npb25zID0gaG9zdERpcmVjdGl2ZXMubWFwKGN1cnJlbnQgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBbe1xuICAgICAga2V5OiAnZGlyZWN0aXZlJyxcbiAgICAgIHZhbHVlOiBjdXJyZW50LmlzRm9yd2FyZFJlZmVyZW5jZSA/IGdlbmVyYXRlRm9yd2FyZFJlZihjdXJyZW50LmRpcmVjdGl2ZS50eXBlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmRpcmVjdGl2ZS50eXBlLFxuICAgICAgcXVvdGVkOiBmYWxzZVxuICAgIH1dO1xuICAgIGNvbnN0IGlucHV0c0xpdGVyYWwgPSBjdXJyZW50LmlucHV0cyA/IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQuaW5wdXRzKSA6IG51bGw7XG4gICAgY29uc3Qgb3V0cHV0c0xpdGVyYWwgPVxuICAgICAgICBjdXJyZW50Lm91dHB1dHMgPyBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpIDogbnVsbDtcblxuICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ2lucHV0cycsIHZhbHVlOiBpbnB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMpO1xuICB9KTtcblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW3tkaXJlY3RpdmU6IEhvc3REaXJ9XSB9YCxcbiAgLy8gb3RoZXJ3aXNlIHdlIGNhbiBzYXZlIHNvbWUgYnl0ZXMgYnkgdXNpbmcgYSBwbGFpbiBhcnJheSwgZS5nLiBgW3tkaXJlY3RpdmU6IEhvc3REaXJ9XWAuXG4gIHJldHVybiBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuIl19