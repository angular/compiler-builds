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
import { asLiteral, conditionallyCreateDirectiveBindingLiteral, DefinitionMap, UNSAFE_OBJECT_KEY_NAME_REGEXP } from '../view/util';
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
    const minVersion = getMinimumVersionForPartialOutput(meta);
    definitionMap.set('minVersion', o.literal(minVersion));
    definitionMap.set('version', o.literal('17.1.0+sha-5f9cac0'));
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
    definitionMap.set('inputs', needsNewInputPartialOutput(meta) ? createInputsPartialMetadata(meta.inputs) :
        legacyInputsPartialMetadata(meta.inputs));
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
 * Determines the minimum linker version for the partial output
 * generated for this directive.
 *
 * Every time we make a breaking change to the declaration interface or partial-linker
 * behavior, we must update the minimum versions to prevent old partial-linkers from
 * incorrectly processing the declaration.
 *
 * NOTE: Do not include any prerelease in these versions as they are ignored.
 */
function getMinimumVersionForPartialOutput(meta) {
    // We are starting with the oldest minimum version that can work for common
    // directive partial compilation output. As we discover usages of new features
    // that require a newer partial output emit, we bump the `minVersion`. Our goal
    // is to keep libraries as much compatible with older linker versions as possible.
    let minVersion = '14.0.0';
    // Note: in order to allow consuming Angular libraries that have been compiled with 16.1+ in
    // Angular 16.0, we only force a minimum version of 16.1 if input transform feature as introduced
    // in 16.1 is actually used.
    const hasDecoratorTransformFunctions = Object.values(meta.inputs).some(input => input.transformFunction !== null);
    if (hasDecoratorTransformFunctions) {
        minVersion = '16.1.0';
    }
    // If there are input flags and we need the new emit, use the actual minimum version,
    // where this was introduced. i.e. in 17.1.0
    // TODO(legacy-partial-output-inputs): Remove in v18.
    if (needsNewInputPartialOutput(meta)) {
        minVersion = '17.1.0';
    }
    return minVersion;
}
/**
 * Gets whether the given directive needs the new input partial output structure
 * that can hold additional metadata like `isRequired`, `isSignal` etc.
 */
function needsNewInputPartialOutput(meta) {
    return Object.values(meta.inputs).some(input => input.isSignal);
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
/**
 * Generates partial output metadata for inputs of a directive.
 *
 * The generated structure is expected to match `R3DeclareDirectiveFacade['inputs']`.
 */
function createInputsPartialMetadata(inputs) {
    const keys = Object.getOwnPropertyNames(inputs);
    if (keys.length === 0) {
        return null;
    }
    return o.literalMap(keys.map(declaredName => {
        const value = inputs[declaredName];
        return {
            key: declaredName,
            // put quotes around keys that contain potentially unsafe characters
            quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(declaredName),
            value: o.literalMap([
                { key: 'classPropertyName', quoted: false, value: asLiteral(value.classPropertyName) },
                { key: 'publicName', quoted: false, value: asLiteral(value.bindingPropertyName) },
                { key: 'isSignal', quoted: false, value: asLiteral(value.isSignal) },
                { key: 'isRequired', quoted: false, value: asLiteral(value.required) },
                { key: 'transformFunction', quoted: false, value: value.transformFunction ?? o.NULL_EXPR },
            ])
        };
    }));
}
/**
 * Pre v18 legacy partial output for inputs.
 *
 * Previously, inputs did not capture metadata like `isSignal` in the partial compilation output.
 * To enable capturing such metadata, we restructured how input metadata is communicated in the
 * partial output. This would make libraries incompatible with older Angular FW versions where the
 * linker would not know how to handle this new "format". For this reason, if we know this metadata
 * does not need to be captured- we fall back to the old format. This is what this function
 * generates.
 *
 * See:
 * https://github.com/angular/angular/blob/d4b423690210872b5c32a322a6090beda30b05a3/packages/core/src/compiler/compiler_facade_interface.ts#L197-L199
 */
function legacyInputsPartialMetadata(inputs) {
    // TODO(legacy-partial-output-inputs): Remove function in v18.
    const keys = Object.getOwnPropertyNames(inputs);
    if (keys.length === 0) {
        return null;
    }
    return o.literalMap(keys.map(declaredName => {
        const value = inputs[declaredName];
        const publicName = value.bindingPropertyName;
        const differentDeclaringName = publicName !== declaredName;
        let result;
        if (differentDeclaringName || value.transformFunction !== null) {
            const values = [asLiteral(publicName), asLiteral(declaredName)];
            if (value.transformFunction !== null) {
                values.push(value.transformFunction);
            }
            result = o.literalArr(values);
        }
        else {
            result = asLiteral(publicName);
        }
        return {
            key: declaredName,
            // put quotes around keys that contain potentially unsafe characters
            quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(declaredName),
            value: result,
        };
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSxrQkFBa0IsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFFdkcsT0FBTyxFQUFDLG1CQUFtQixFQUFFLGdDQUFnQyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdkYsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQ0FBMEMsRUFBRSxhQUFhLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFHakksT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLElBQXlCO0lBRTNFLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXpELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RixNQUFNLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxJQUF5QjtJQUVwRSxNQUFNLGFBQWEsR0FBRyxJQUFJ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QixDQUFDLENBQUM7WUFDdkMsQ0FBQztZQUNELE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsT0FBTztZQUNMLEdBQUcsRUFBRSxZQUFZO1lBQ2pCLG9FQUFvRTtZQUNwRSxNQUFNLEVBQUUsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN4RCxLQUFLLEVBQUUsTUFBTTtTQUNkLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2NvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbiwgZ2VuZXJhdGVGb3J3YXJkUmVmLCBSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4uL3ZpZXcvYXBpJztcbmltcG9ydCB7Y3JlYXRlRGlyZWN0aXZlVHlwZSwgY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXl9IGZyb20gJy4uL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbCwgRGVmaW5pdGlvbk1hcCwgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGEsIFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxNYXB9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTpcbiAgICBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGEpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVjbGFyZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIEdhdGhlcnMgdGhlIGRlY2xhcmF0aW9uIGZpZWxkcyBmb3IgYSBkaXJlY3RpdmUgaW50byBhIGBEZWZpbml0aW9uTWFwYC4gVGhpcyBhbGxvd3MgZm9yIHJldXNpbmdcbiAqIHRoaXMgbG9naWMgZm9yIGNvbXBvbmVudHMsIGFzIHRoZXkgZXh0ZW5kIHRoZSBkaXJlY3RpdmUgbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVEZWZpbml0aW9uTWFwKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuICBjb25zdCBtaW5WZXJzaW9uID0gZ2V0TWluaW11bVZlcnNpb25Gb3JQYXJ0aWFsT3V0cHV0KG1ldGEpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKG1pblZlcnNpb24pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZS52YWx1ZSk7XG5cbiAgaWYgKG1ldGEuaXNTdGFuZGFsb25lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzU3RhbmRhbG9uZScsIG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpO1xuICB9XG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzU2lnbmFsJywgby5saXRlcmFsKG1ldGEuaXNTaWduYWwpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHNlbGVjdG9yOiAnc29tZS1kaXInYFxuICBpZiAobWV0YS5zZWxlY3RvciAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChtZXRhLnNlbGVjdG9yKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdpbnB1dHMnLFxuICAgICAgbmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YSkgPyBjcmVhdGVJbnB1dHNQYXJ0aWFsTWV0YWRhdGEobWV0YS5pbnB1dHMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVnYWN5SW5wdXRzUGFydGlhbE1ldGFkYXRhKG1ldGEuaW5wdXRzKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdob3N0JywgY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhLmhvc3QpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdxdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEucXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnZpZXdRdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIGFzTGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc0luaGVyaXRhbmNlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNPbkNoYW5nZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0RGlyZWN0aXZlcycsIGNyZWF0ZUhvc3REaXJlY3RpdmVzKG1ldGEuaG9zdERpcmVjdGl2ZXMpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB0aGUgbWluaW11bSBsaW5rZXIgdmVyc2lvbiBmb3IgdGhlIHBhcnRpYWwgb3V0cHV0XG4gKiBnZW5lcmF0ZWQgZm9yIHRoaXMgZGlyZWN0aXZlLlxuICpcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyXG4gKiBiZWhhdmlvciwgd2UgbXVzdCB1cGRhdGUgdGhlIG1pbmltdW0gdmVyc2lvbnMgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb21cbiAqIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlIGRlY2xhcmF0aW9uLlxuICpcbiAqIE5PVEU6IERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmZ1bmN0aW9uIGdldE1pbmltdW1WZXJzaW9uRm9yUGFydGlhbE91dHB1dChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogc3RyaW5nIHtcbiAgLy8gV2UgYXJlIHN0YXJ0aW5nIHdpdGggdGhlIG9sZGVzdCBtaW5pbXVtIHZlcnNpb24gdGhhdCBjYW4gd29yayBmb3IgY29tbW9uXG4gIC8vIGRpcmVjdGl2ZSBwYXJ0aWFsIGNvbXBpbGF0aW9uIG91dHB1dC4gQXMgd2UgZGlzY292ZXIgdXNhZ2VzIG9mIG5ldyBmZWF0dXJlc1xuICAvLyB0aGF0IHJlcXVpcmUgYSBuZXdlciBwYXJ0aWFsIG91dHB1dCBlbWl0LCB3ZSBidW1wIHRoZSBgbWluVmVyc2lvbmAuIE91ciBnb2FsXG4gIC8vIGlzIHRvIGtlZXAgbGlicmFyaWVzIGFzIG11Y2ggY29tcGF0aWJsZSB3aXRoIG9sZGVyIGxpbmtlciB2ZXJzaW9ucyBhcyBwb3NzaWJsZS5cbiAgbGV0IG1pblZlcnNpb24gPSAnMTQuMC4wJztcblxuICAvLyBOb3RlOiBpbiBvcmRlciB0byBhbGxvdyBjb25zdW1pbmcgQW5ndWxhciBsaWJyYXJpZXMgdGhhdCBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCAxNi4xKyBpblxuICAvLyBBbmd1bGFyIDE2LjAsIHdlIG9ubHkgZm9yY2UgYSBtaW5pbXVtIHZlcnNpb24gb2YgMTYuMSBpZiBpbnB1dCB0cmFuc2Zvcm0gZmVhdHVyZSBhcyBpbnRyb2R1Y2VkXG4gIC8vIGluIDE2LjEgaXMgYWN0dWFsbHkgdXNlZC5cbiAgY29uc3QgaGFzRGVjb3JhdG9yVHJhbnNmb3JtRnVuY3Rpb25zID1cbiAgICAgIE9iamVjdC52YWx1ZXMobWV0YS5pbnB1dHMpLnNvbWUoaW5wdXQgPT4gaW5wdXQudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGwpO1xuICBpZiAoaGFzRGVjb3JhdG9yVHJhbnNmb3JtRnVuY3Rpb25zKSB7XG4gICAgbWluVmVyc2lvbiA9ICcxNi4xLjAnO1xuICB9XG5cbiAgLy8gSWYgdGhlcmUgYXJlIGlucHV0IGZsYWdzIGFuZCB3ZSBuZWVkIHRoZSBuZXcgZW1pdCwgdXNlIHRoZSBhY3R1YWwgbWluaW11bSB2ZXJzaW9uLFxuICAvLyB3aGVyZSB0aGlzIHdhcyBpbnRyb2R1Y2VkLiBpLmUuIGluIDE3LjEuMFxuICAvLyBUT0RPKGxlZ2FjeS1wYXJ0aWFsLW91dHB1dC1pbnB1dHMpOiBSZW1vdmUgaW4gdjE4LlxuICBpZiAobmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YSkpIHtcbiAgICBtaW5WZXJzaW9uID0gJzE3LjEuMCc7XG4gIH1cblxuICByZXR1cm4gbWluVmVyc2lvbjtcbn1cblxuLyoqXG4gKiBHZXRzIHdoZXRoZXIgdGhlIGdpdmVuIGRpcmVjdGl2ZSBuZWVkcyB0aGUgbmV3IGlucHV0IHBhcnRpYWwgb3V0cHV0IHN0cnVjdHVyZVxuICogdGhhdCBjYW4gaG9sZCBhZGRpdGlvbmFsIG1ldGFkYXRhIGxpa2UgYGlzUmVxdWlyZWRgLCBgaXNTaWduYWxgIGV0Yy5cbiAqL1xuZnVuY3Rpb24gbmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhtZXRhLmlucHV0cykuc29tZShpbnB1dCA9PiBpbnB1dC5pc1NpZ25hbCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIG1ldGFkYXRhIG9mIGEgc2luZ2xlIHF1ZXJ5IGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogYnkgYFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBjb21waWxlUXVlcnkocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUXVlcnlNZXRhZGF0YT4oKTtcbiAgbWV0YS5zZXQoJ3Byb3BlcnR5TmFtZScsIG8ubGl0ZXJhbChxdWVyeS5wcm9wZXJ0eU5hbWUpKTtcbiAgaWYgKHF1ZXJ5LmZpcnN0KSB7XG4gICAgbWV0YS5zZXQoJ2ZpcnN0Jywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldChcbiAgICAgICdwcmVkaWNhdGUnLFxuICAgICAgQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpID8gYXNMaXRlcmFsKHF1ZXJ5LnByZWRpY2F0ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uKHF1ZXJ5LnByZWRpY2F0ZSkpO1xuICBpZiAoIXF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5KSB7XG4gICAgLy8gYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBpcyBzcGVjaWFsIGJlY2F1c2Ugd2UgZXhwZWN0IGl0IHRvIGJlIGB0cnVlYC5cbiAgICAvLyBUaGVyZWZvcmUgd2UgZXhwbGljaXRseSBlbWl0IHRoZSBmaWVsZCwgYW5kIGV4cGxpY2l0bHkgcGxhY2UgaXQgb25seSB3aGVuIGl0J3MgYGZhbHNlYC5cbiAgICBtZXRhLnNldCgnZW1pdERpc3RpbmN0Q2hhbmdlc09ubHknLCBvLmxpdGVyYWwoZmFsc2UpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgbGlua2VyIHdpbGwgYXNzdW1lIHRoYXQgYW4gYWJzZW50IGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgZmxhZyBpcyBieSBkZWZhdWx0IGB0cnVlYC5cbiAgfVxuICBpZiAocXVlcnkuZGVzY2VuZGFudHMpIHtcbiAgICBtZXRhLnNldCgnZGVzY2VuZGFudHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KCdyZWFkJywgcXVlcnkucmVhZCk7XG4gIGlmIChxdWVyeS5zdGF0aWMpIHtcbiAgICBtZXRhLnNldCgnc3RhdGljJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICByZXR1cm4gbWV0YS50b0xpdGVyYWxNYXAoKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgaG9zdCBtZXRhZGF0YSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGluIGBSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddYFxuICovXG5mdW5jdGlvbiBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGE6IFIzSG9zdE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwcnxudWxsIHtcbiAgY29uc3QgaG9zdE1ldGFkYXRhID0gbmV3IERlZmluaXRpb25NYXA8Tm9uTnVsbGFibGU8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3QnXT4+KCk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2F0dHJpYnV0ZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmF0dHJpYnV0ZXMsIGV4cHJlc3Npb24gPT4gZXhwcmVzc2lvbikpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdsaXN0ZW5lcnMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmxpc3RlbmVycywgby5saXRlcmFsKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ3Byb3BlcnRpZXMnLCB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLnByb3BlcnRpZXMsIG8ubGl0ZXJhbCkpO1xuXG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ3N0eWxlQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSk7XG4gIH1cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnY2xhc3NBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpKTtcbiAgfVxuXG4gIGlmIChob3N0TWV0YWRhdGEudmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gaG9zdE1ldGFkYXRhLnRvTGl0ZXJhbE1hcCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzKGhvc3REaXJlY3RpdmVzOiBOb25OdWxsYWJsZTxSM0RpcmVjdGl2ZU1ldGFkYXRhWydob3N0RGlyZWN0aXZlcyddPik6XG4gICAgby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgY29uc3QgZXhwcmVzc2lvbnMgPSBob3N0RGlyZWN0aXZlcy5tYXAoY3VycmVudCA9PiB7XG4gICAgY29uc3Qga2V5cyA9IFt7XG4gICAgICBrZXk6ICdkaXJlY3RpdmUnLFxuICAgICAgdmFsdWU6IGN1cnJlbnQuaXNGb3J3YXJkUmVmZXJlbmNlID8gZ2VuZXJhdGVGb3J3YXJkUmVmKGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUsXG4gICAgICBxdW90ZWQ6IGZhbHNlXG4gICAgfV07XG4gICAgY29uc3QgaW5wdXRzTGl0ZXJhbCA9IGN1cnJlbnQuaW5wdXRzID8gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkoY3VycmVudC5pbnB1dHMpIDogbnVsbDtcbiAgICBjb25zdCBvdXRwdXRzTGl0ZXJhbCA9XG4gICAgICAgIGN1cnJlbnQub3V0cHV0cyA/IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQub3V0cHV0cykgOiBudWxsO1xuXG4gICAgaWYgKGlucHV0c0xpdGVyYWwpIHtcbiAgICAgIGtleXMucHVzaCh7a2V5OiAnaW5wdXRzJywgdmFsdWU6IGlucHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG5cbiAgICBpZiAob3V0cHV0c0xpdGVyYWwpIHtcbiAgICAgIGtleXMucHVzaCh7a2V5OiAnb3V0cHV0cycsIHZhbHVlOiBvdXRwdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgIH1cblxuICAgIHJldHVybiBvLmxpdGVyYWxNYXAoa2V5cyk7XG4gIH0pO1xuXG4gIC8vIElmIHRoZXJlJ3MgYSBmb3J3YXJkIHJlZmVyZW5jZSwgd2UgZ2VuZXJhdGUgYSBgZnVuY3Rpb24oKSB7IHJldHVybiBbe2RpcmVjdGl2ZTogSG9zdERpcn1dIH1gLFxuICAvLyBvdGhlcndpc2Ugd2UgY2FuIHNhdmUgc29tZSBieXRlcyBieSB1c2luZyBhIHBsYWluIGFycmF5LCBlLmcuIGBbe2RpcmVjdGl2ZTogSG9zdERpcn1dYC5cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycihleHByZXNzaW9ucyk7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIHBhcnRpYWwgb3V0cHV0IG1ldGFkYXRhIGZvciBpbnB1dHMgb2YgYSBkaXJlY3RpdmUuXG4gKlxuICogVGhlIGdlbmVyYXRlZCBzdHJ1Y3R1cmUgaXMgZXhwZWN0ZWQgdG8gbWF0Y2ggYFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZVsnaW5wdXRzJ11gLlxuICovXG5mdW5jdGlvbiBjcmVhdGVJbnB1dHNQYXJ0aWFsTWV0YWRhdGEoaW5wdXRzOiBSM0RpcmVjdGl2ZU1ldGFkYXRhWydpbnB1dHMnXSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGlucHV0cyk7XG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzLm1hcChkZWNsYXJlZE5hbWUgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gaW5wdXRzW2RlY2xhcmVkTmFtZV07XG5cbiAgICByZXR1cm4ge1xuICAgICAga2V5OiBkZWNsYXJlZE5hbWUsXG4gICAgICAvLyBwdXQgcXVvdGVzIGFyb3VuZCBrZXlzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcmFjdGVyc1xuICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KGRlY2xhcmVkTmFtZSksXG4gICAgICB2YWx1ZTogby5saXRlcmFsTWFwKFtcbiAgICAgICAge2tleTogJ2NsYXNzUHJvcGVydHlOYW1lJywgcXVvdGVkOiBmYWxzZSwgdmFsdWU6IGFzTGl0ZXJhbCh2YWx1ZS5jbGFzc1Byb3BlcnR5TmFtZSl9LFxuICAgICAgICB7a2V5OiAncHVibGljTmFtZScsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZSl9LFxuICAgICAgICB7a2V5OiAnaXNTaWduYWwnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLmlzU2lnbmFsKX0sXG4gICAgICAgIHtrZXk6ICdpc1JlcXVpcmVkJywgcXVvdGVkOiBmYWxzZSwgdmFsdWU6IGFzTGl0ZXJhbCh2YWx1ZS5yZXF1aXJlZCl9LFxuICAgICAgICB7a2V5OiAndHJhbnNmb3JtRnVuY3Rpb24nLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gPz8gby5OVUxMX0VYUFJ9LFxuICAgICAgXSlcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKlxuICogUHJlIHYxOCBsZWdhY3kgcGFydGlhbCBvdXRwdXQgZm9yIGlucHV0cy5cbiAqXG4gKiBQcmV2aW91c2x5LCBpbnB1dHMgZGlkIG5vdCBjYXB0dXJlIG1ldGFkYXRhIGxpa2UgYGlzU2lnbmFsYCBpbiB0aGUgcGFydGlhbCBjb21waWxhdGlvbiBvdXRwdXQuXG4gKiBUbyBlbmFibGUgY2FwdHVyaW5nIHN1Y2ggbWV0YWRhdGEsIHdlIHJlc3RydWN0dXJlZCBob3cgaW5wdXQgbWV0YWRhdGEgaXMgY29tbXVuaWNhdGVkIGluIHRoZVxuICogcGFydGlhbCBvdXRwdXQuIFRoaXMgd291bGQgbWFrZSBsaWJyYXJpZXMgaW5jb21wYXRpYmxlIHdpdGggb2xkZXIgQW5ndWxhciBGVyB2ZXJzaW9ucyB3aGVyZSB0aGVcbiAqIGxpbmtlciB3b3VsZCBub3Qga25vdyBob3cgdG8gaGFuZGxlIHRoaXMgbmV3IFwiZm9ybWF0XCIuIEZvciB0aGlzIHJlYXNvbiwgaWYgd2Uga25vdyB0aGlzIG1ldGFkYXRhXG4gKiBkb2VzIG5vdCBuZWVkIHRvIGJlIGNhcHR1cmVkLSB3ZSBmYWxsIGJhY2sgdG8gdGhlIG9sZCBmb3JtYXQuIFRoaXMgaXMgd2hhdCB0aGlzIGZ1bmN0aW9uXG4gKiBnZW5lcmF0ZXMuXG4gKlxuICogU2VlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9ibG9iL2Q0YjQyMzY5MDIxMDg3MmI1YzMyYTMyMmE2MDkwYmVkYTMwYjA1YTMvcGFja2FnZXMvY29yZS9zcmMvY29tcGlsZXIvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50cyNMMTk3LUwxOTlcbiAqL1xuZnVuY3Rpb24gbGVnYWN5SW5wdXRzUGFydGlhbE1ldGFkYXRhKGlucHV0czogUjNEaXJlY3RpdmVNZXRhZGF0YVsnaW5wdXRzJ10pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIC8vIFRPRE8obGVnYWN5LXBhcnRpYWwtb3V0cHV0LWlucHV0cyk6IFJlbW92ZSBmdW5jdGlvbiBpbiB2MTguXG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGlucHV0cyk7XG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzLm1hcChkZWNsYXJlZE5hbWUgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gaW5wdXRzW2RlY2xhcmVkTmFtZV07XG4gICAgY29uc3QgcHVibGljTmFtZSA9IHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWU7XG4gICAgY29uc3QgZGlmZmVyZW50RGVjbGFyaW5nTmFtZSA9IHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZTtcbiAgICBsZXQgcmVzdWx0OiBvLkV4cHJlc3Npb247XG5cbiAgICBpZiAoZGlmZmVyZW50RGVjbGFyaW5nTmFtZSB8fCB2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgdmFsdWVzID0gW2FzTGl0ZXJhbChwdWJsaWNOYW1lKSwgYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSldO1xuICAgICAgaWYgKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uKTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogZGVjbGFyZWROYW1lLFxuICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChkZWNsYXJlZE5hbWUpLFxuICAgICAgdmFsdWU6IHJlc3VsdCxcbiAgICB9O1xuICB9KSk7XG59XG4iXX0=