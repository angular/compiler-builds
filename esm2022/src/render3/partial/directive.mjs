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
    definitionMap.set('version', o.literal('17.2.2+sha-11a0a5d'));
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
    // If there are signal-based queries, partial output generates an extra field
    // that should be parsed by linkers. Ensure a proper minimum linker version.
    if (meta.queries.some(q => q.isSignal) || meta.viewQueries.some(q => q.isSignal)) {
        minVersion = '17.2.0';
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
    if (query.isSignal) {
        meta.set('isSignal', o.literal(true));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSxrQkFBa0IsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFFdkcsT0FBTyxFQUFDLG1CQUFtQixFQUFFLGdDQUFnQyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDdkYsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQ0FBMEMsRUFBRSxhQUFhLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFHakksT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLElBQXlCO0lBRTNFLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXpELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RixNQUFNLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QyxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxJQUF5QjtJQUVwRSxNQUFNLGFBQWEsR0FBRyxJQUFJ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LENBQUMsQ0FBQztRQUNuQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsbUJBQW1CLENBQUM7UUFDN0MsTUFBTSxzQkFBc0IsR0FBRyxVQUFVLEtBQUssWUFBWSxDQUFDO1FBQzNELElBQUksTUFBb0IsQ0FBQztRQUV6QixJQUFJLHNCQUFzQixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMvRCxNQUFNLE1BQU0sR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNoRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN2QyxDQUFDO1lBQ0QsTUFBTSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxPQUFPO1lBQ0wsR0FBRyxFQUFFLFlBQVk7WUFDakIsb0VBQW9FO1lBQ3BFLE1BQU0sRUFBRSw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ3hELEtBQUssRUFBRSxNQUFNO1NBQ2QsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLCBnZW5lcmF0ZUZvcndhcmRSZWYsIFIzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7UjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVUeXBlLCBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsLCBEZWZpbml0aW9uTWFwLCBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUH0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbE1hcH0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOlxuICAgIFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGRpcmVjdGl2ZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLiBUaGlzIGFsbG93cyBmb3IgcmV1c2luZ1xuICogdGhpcyBsb2dpYyBmb3IgY29tcG9uZW50cywgYXMgdGhleSBleHRlbmQgdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6XG4gICAgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YT4ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG4gIGNvbnN0IG1pblZlcnNpb24gPSBnZXRNaW5pbXVtVmVyc2lvbkZvclBhcnRpYWxPdXRwdXQobWV0YSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ21pblZlcnNpb24nLCBvLmxpdGVyYWwobWluVmVyc2lvbikpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlLnZhbHVlKTtcblxuICBpZiAobWV0YS5pc1N0YW5kYWxvbmUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaXNTdGFuZGFsb25lJywgby5saXRlcmFsKG1ldGEuaXNTdGFuZGFsb25lKSk7XG4gIH1cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaXNTaWduYWwnLCBvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpO1xuICB9XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3I6ICdzb21lLWRpcidgXG4gIGlmIChtZXRhLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9yJywgby5saXRlcmFsKG1ldGEuc2VsZWN0b3IpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2lucHV0cycsXG4gICAgICBuZWVkc05ld0lucHV0UGFydGlhbE91dHB1dChtZXRhKSA/IGNyZWF0ZUlucHV0c1BhcnRpYWxNZXRhZGF0YShtZXRhLmlucHV0cykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZWdhY3lJbnB1dHNQYXJ0aWFsTWV0YWRhdGEobWV0YS5pbnB1dHMpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3QnLCBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGEuaG9zdCkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdwcm92aWRlcnMnLCBtZXRhLnByb3ZpZGVycyk7XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS5xdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEudmlld1F1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgYXNMaXRlcmFsKG1ldGEuZXhwb3J0QXMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnVzZXNJbmhlcml0YW5jZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzSW5oZXJpdGFuY2UnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc09uQ2hhbmdlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBpZiAobWV0YS5ob3N0RGlyZWN0aXZlcz8ubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3REaXJlY3RpdmVzJywgY3JlYXRlSG9zdERpcmVjdGl2ZXMobWV0YS5ob3N0RGlyZWN0aXZlcykpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nSW1wb3J0Jywgby5pbXBvcnRFeHByKFIzLmNvcmUpKTtcblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIHRoZSBtaW5pbXVtIGxpbmtlciB2ZXJzaW9uIGZvciB0aGUgcGFydGlhbCBvdXRwdXRcbiAqIGdlbmVyYXRlZCBmb3IgdGhpcyBkaXJlY3RpdmUuXG4gKlxuICogRXZlcnkgdGltZSB3ZSBtYWtlIGEgYnJlYWtpbmcgY2hhbmdlIHRvIHRoZSBkZWNsYXJhdGlvbiBpbnRlcmZhY2Ugb3IgcGFydGlhbC1saW5rZXJcbiAqIGJlaGF2aW9yLCB3ZSBtdXN0IHVwZGF0ZSB0aGUgbWluaW11bSB2ZXJzaW9ucyB0byBwcmV2ZW50IG9sZCBwYXJ0aWFsLWxpbmtlcnMgZnJvbVxuICogaW5jb3JyZWN0bHkgcHJvY2Vzc2luZyB0aGUgZGVjbGFyYXRpb24uXG4gKlxuICogTk9URTogRG8gbm90IGluY2x1ZGUgYW55IHByZXJlbGVhc2UgaW4gdGhlc2UgdmVyc2lvbnMgYXMgdGhleSBhcmUgaWdub3JlZC5cbiAqL1xuZnVuY3Rpb24gZ2V0TWluaW11bVZlcnNpb25Gb3JQYXJ0aWFsT3V0cHV0KG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBzdHJpbmcge1xuICAvLyBXZSBhcmUgc3RhcnRpbmcgd2l0aCB0aGUgb2xkZXN0IG1pbmltdW0gdmVyc2lvbiB0aGF0IGNhbiB3b3JrIGZvciBjb21tb25cbiAgLy8gZGlyZWN0aXZlIHBhcnRpYWwgY29tcGlsYXRpb24gb3V0cHV0LiBBcyB3ZSBkaXNjb3ZlciB1c2FnZXMgb2YgbmV3IGZlYXR1cmVzXG4gIC8vIHRoYXQgcmVxdWlyZSBhIG5ld2VyIHBhcnRpYWwgb3V0cHV0IGVtaXQsIHdlIGJ1bXAgdGhlIGBtaW5WZXJzaW9uYC4gT3VyIGdvYWxcbiAgLy8gaXMgdG8ga2VlcCBsaWJyYXJpZXMgYXMgbXVjaCBjb21wYXRpYmxlIHdpdGggb2xkZXIgbGlua2VyIHZlcnNpb25zIGFzIHBvc3NpYmxlLlxuICBsZXQgbWluVmVyc2lvbiA9ICcxNC4wLjAnO1xuXG4gIC8vIE5vdGU6IGluIG9yZGVyIHRvIGFsbG93IGNvbnN1bWluZyBBbmd1bGFyIGxpYnJhcmllcyB0aGF0IGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIDE2LjErIGluXG4gIC8vIEFuZ3VsYXIgMTYuMCwgd2Ugb25seSBmb3JjZSBhIG1pbmltdW0gdmVyc2lvbiBvZiAxNi4xIGlmIGlucHV0IHRyYW5zZm9ybSBmZWF0dXJlIGFzIGludHJvZHVjZWRcbiAgLy8gaW4gMTYuMSBpcyBhY3R1YWxseSB1c2VkLlxuICBjb25zdCBoYXNEZWNvcmF0b3JUcmFuc2Zvcm1GdW5jdGlvbnMgPVxuICAgICAgT2JqZWN0LnZhbHVlcyhtZXRhLmlucHV0cykuc29tZShpbnB1dCA9PiBpbnB1dC50cmFuc2Zvcm1GdW5jdGlvbiAhPT0gbnVsbCk7XG4gIGlmIChoYXNEZWNvcmF0b3JUcmFuc2Zvcm1GdW5jdGlvbnMpIHtcbiAgICBtaW5WZXJzaW9uID0gJzE2LjEuMCc7XG4gIH1cblxuICAvLyBJZiB0aGVyZSBhcmUgaW5wdXQgZmxhZ3MgYW5kIHdlIG5lZWQgdGhlIG5ldyBlbWl0LCB1c2UgdGhlIGFjdHVhbCBtaW5pbXVtIHZlcnNpb24sXG4gIC8vIHdoZXJlIHRoaXMgd2FzIGludHJvZHVjZWQuIGkuZS4gaW4gMTcuMS4wXG4gIC8vIFRPRE8obGVnYWN5LXBhcnRpYWwtb3V0cHV0LWlucHV0cyk6IFJlbW92ZSBpbiB2MTguXG4gIGlmIChuZWVkc05ld0lucHV0UGFydGlhbE91dHB1dChtZXRhKSkge1xuICAgIG1pblZlcnNpb24gPSAnMTcuMS4wJztcbiAgfVxuXG4gIC8vIElmIHRoZXJlIGFyZSBzaWduYWwtYmFzZWQgcXVlcmllcywgcGFydGlhbCBvdXRwdXQgZ2VuZXJhdGVzIGFuIGV4dHJhIGZpZWxkXG4gIC8vIHRoYXQgc2hvdWxkIGJlIHBhcnNlZCBieSBsaW5rZXJzLiBFbnN1cmUgYSBwcm9wZXIgbWluaW11bSBsaW5rZXIgdmVyc2lvbi5cbiAgaWYgKG1ldGEucXVlcmllcy5zb21lKHEgPT4gcS5pc1NpZ25hbCkgfHwgbWV0YS52aWV3UXVlcmllcy5zb21lKHEgPT4gcS5pc1NpZ25hbCkpIHtcbiAgICBtaW5WZXJzaW9uID0gJzE3LjIuMCc7XG4gIH1cblxuICByZXR1cm4gbWluVmVyc2lvbjtcbn1cblxuLyoqXG4gKiBHZXRzIHdoZXRoZXIgdGhlIGdpdmVuIGRpcmVjdGl2ZSBuZWVkcyB0aGUgbmV3IGlucHV0IHBhcnRpYWwgb3V0cHV0IHN0cnVjdHVyZVxuICogdGhhdCBjYW4gaG9sZCBhZGRpdGlvbmFsIG1ldGFkYXRhIGxpa2UgYGlzUmVxdWlyZWRgLCBgaXNTaWduYWxgIGV0Yy5cbiAqL1xuZnVuY3Rpb24gbmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhtZXRhLmlucHV0cykuc29tZShpbnB1dCA9PiBpbnB1dC5pc1NpZ25hbCk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIG1ldGFkYXRhIG9mIGEgc2luZ2xlIHF1ZXJ5IGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogYnkgYFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBjb21waWxlUXVlcnkocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlUXVlcnlNZXRhZGF0YT4oKTtcbiAgbWV0YS5zZXQoJ3Byb3BlcnR5TmFtZScsIG8ubGl0ZXJhbChxdWVyeS5wcm9wZXJ0eU5hbWUpKTtcbiAgaWYgKHF1ZXJ5LmZpcnN0KSB7XG4gICAgbWV0YS5zZXQoJ2ZpcnN0Jywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldChcbiAgICAgICdwcmVkaWNhdGUnLFxuICAgICAgQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpID8gYXNMaXRlcmFsKHF1ZXJ5LnByZWRpY2F0ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uKHF1ZXJ5LnByZWRpY2F0ZSkpO1xuICBpZiAoIXF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5KSB7XG4gICAgLy8gYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBpcyBzcGVjaWFsIGJlY2F1c2Ugd2UgZXhwZWN0IGl0IHRvIGJlIGB0cnVlYC5cbiAgICAvLyBUaGVyZWZvcmUgd2UgZXhwbGljaXRseSBlbWl0IHRoZSBmaWVsZCwgYW5kIGV4cGxpY2l0bHkgcGxhY2UgaXQgb25seSB3aGVuIGl0J3MgYGZhbHNlYC5cbiAgICBtZXRhLnNldCgnZW1pdERpc3RpbmN0Q2hhbmdlc09ubHknLCBvLmxpdGVyYWwoZmFsc2UpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgbGlua2VyIHdpbGwgYXNzdW1lIHRoYXQgYW4gYWJzZW50IGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgZmxhZyBpcyBieSBkZWZhdWx0IGB0cnVlYC5cbiAgfVxuICBpZiAocXVlcnkuZGVzY2VuZGFudHMpIHtcbiAgICBtZXRhLnNldCgnZGVzY2VuZGFudHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KCdyZWFkJywgcXVlcnkucmVhZCk7XG4gIGlmIChxdWVyeS5zdGF0aWMpIHtcbiAgICBtZXRhLnNldCgnc3RhdGljJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAocXVlcnkuaXNTaWduYWwpIHtcbiAgICBtZXRhLnNldCgnaXNTaWduYWwnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBtZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBob3N0IG1ldGFkYXRhIGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogaW4gYFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J11gXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByfG51bGwge1xuICBjb25zdCBob3N0TWV0YWRhdGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddPj4oKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnYXR0cmlidXRlcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEuYXR0cmlidXRlcywgZXhwcmVzc2lvbiA9PiBleHByZXNzaW9uKSk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdERpcmVjdGl2ZXMoaG9zdERpcmVjdGl2ZXM6IE5vbk51bGxhYmxlPFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3REaXJlY3RpdmVzJ10+KTpcbiAgICBvLkxpdGVyYWxBcnJheUV4cHIge1xuICBjb25zdCBleHByZXNzaW9ucyA9IGhvc3REaXJlY3RpdmVzLm1hcChjdXJyZW50ID0+IHtcbiAgICBjb25zdCBrZXlzID0gW3tcbiAgICAgIGtleTogJ2RpcmVjdGl2ZScsXG4gICAgICB2YWx1ZTogY3VycmVudC5pc0ZvcndhcmRSZWZlcmVuY2UgPyBnZW5lcmF0ZUZvcndhcmRSZWYoY3VycmVudC5kaXJlY3RpdmUudHlwZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5kaXJlY3RpdmUudHlwZSxcbiAgICAgIHF1b3RlZDogZmFsc2VcbiAgICB9XTtcbiAgICBjb25zdCBpbnB1dHNMaXRlcmFsID0gY3VycmVudC5pbnB1dHMgPyBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50LmlucHV0cykgOiBudWxsO1xuICAgIGNvbnN0IG91dHB1dHNMaXRlcmFsID1cbiAgICAgICAgY3VycmVudC5vdXRwdXRzID8gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkoY3VycmVudC5vdXRwdXRzKSA6IG51bGw7XG5cbiAgICBpZiAoaW5wdXRzTGl0ZXJhbCkge1xuICAgICAga2V5cy5wdXNoKHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogaW5wdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgIH1cblxuICAgIGlmIChvdXRwdXRzTGl0ZXJhbCkge1xuICAgICAga2V5cy5wdXNoKHtrZXk6ICdvdXRwdXRzJywgdmFsdWU6IG91dHB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzKTtcbiAgfSk7XG5cbiAgLy8gSWYgdGhlcmUncyBhIGZvcndhcmQgcmVmZXJlbmNlLCB3ZSBnZW5lcmF0ZSBhIGBmdW5jdGlvbigpIHsgcmV0dXJuIFt7ZGlyZWN0aXZlOiBIb3N0RGlyfV0gfWAsXG4gIC8vIG90aGVyd2lzZSB3ZSBjYW4gc2F2ZSBzb21lIGJ5dGVzIGJ5IHVzaW5nIGEgcGxhaW4gYXJyYXksIGUuZy4gYFt7ZGlyZWN0aXZlOiBIb3N0RGlyfV1gLlxuICByZXR1cm4gby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgcGFydGlhbCBvdXRwdXQgbWV0YWRhdGEgZm9yIGlucHV0cyBvZiBhIGRpcmVjdGl2ZS5cbiAqXG4gKiBUaGUgZ2VuZXJhdGVkIHN0cnVjdHVyZSBpcyBleHBlY3RlZCB0byBtYXRjaCBgUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlWydpbnB1dHMnXWAuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUlucHV0c1BhcnRpYWxNZXRhZGF0YShpbnB1dHM6IFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2lucHV0cyddKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoaW5wdXRzKTtcbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMubWFwKGRlY2xhcmVkTmFtZSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBpbnB1dHNbZGVjbGFyZWROYW1lXTtcblxuICAgIHJldHVybiB7XG4gICAgICBrZXk6IGRlY2xhcmVkTmFtZSxcbiAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICBxdW90ZWQ6IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQLnRlc3QoZGVjbGFyZWROYW1lKSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWxNYXAoW1xuICAgICAgICB7a2V5OiAnY2xhc3NQcm9wZXJ0eU5hbWUnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLmNsYXNzUHJvcGVydHlOYW1lKX0sXG4gICAgICAgIHtrZXk6ICdwdWJsaWNOYW1lJywgcXVvdGVkOiBmYWxzZSwgdmFsdWU6IGFzTGl0ZXJhbCh2YWx1ZS5iaW5kaW5nUHJvcGVydHlOYW1lKX0sXG4gICAgICAgIHtrZXk6ICdpc1NpZ25hbCcsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUuaXNTaWduYWwpfSxcbiAgICAgICAge2tleTogJ2lzUmVxdWlyZWQnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLnJlcXVpcmVkKX0sXG4gICAgICAgIHtrZXk6ICd0cmFuc2Zvcm1GdW5jdGlvbicsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiB2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiA/PyBvLk5VTExfRVhQUn0sXG4gICAgICBdKVxuICAgIH07XG4gIH0pKTtcbn1cblxuLyoqXG4gKiBQcmUgdjE4IGxlZ2FjeSBwYXJ0aWFsIG91dHB1dCBmb3IgaW5wdXRzLlxuICpcbiAqIFByZXZpb3VzbHksIGlucHV0cyBkaWQgbm90IGNhcHR1cmUgbWV0YWRhdGEgbGlrZSBgaXNTaWduYWxgIGluIHRoZSBwYXJ0aWFsIGNvbXBpbGF0aW9uIG91dHB1dC5cbiAqIFRvIGVuYWJsZSBjYXB0dXJpbmcgc3VjaCBtZXRhZGF0YSwgd2UgcmVzdHJ1Y3R1cmVkIGhvdyBpbnB1dCBtZXRhZGF0YSBpcyBjb21tdW5pY2F0ZWQgaW4gdGhlXG4gKiBwYXJ0aWFsIG91dHB1dC4gVGhpcyB3b3VsZCBtYWtlIGxpYnJhcmllcyBpbmNvbXBhdGlibGUgd2l0aCBvbGRlciBBbmd1bGFyIEZXIHZlcnNpb25zIHdoZXJlIHRoZVxuICogbGlua2VyIHdvdWxkIG5vdCBrbm93IGhvdyB0byBoYW5kbGUgdGhpcyBuZXcgXCJmb3JtYXRcIi4gRm9yIHRoaXMgcmVhc29uLCBpZiB3ZSBrbm93IHRoaXMgbWV0YWRhdGFcbiAqIGRvZXMgbm90IG5lZWQgdG8gYmUgY2FwdHVyZWQtIHdlIGZhbGwgYmFjayB0byB0aGUgb2xkIGZvcm1hdC4gVGhpcyBpcyB3aGF0IHRoaXMgZnVuY3Rpb25cbiAqIGdlbmVyYXRlcy5cbiAqXG4gKiBTZWU6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2Jsb2IvZDRiNDIzNjkwMjEwODcyYjVjMzJhMzIyYTYwOTBiZWRhMzBiMDVhMy9wYWNrYWdlcy9jb3JlL3NyYy9jb21waWxlci9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlLnRzI0wxOTctTDE5OVxuICovXG5mdW5jdGlvbiBsZWdhY3lJbnB1dHNQYXJ0aWFsTWV0YWRhdGEoaW5wdXRzOiBSM0RpcmVjdGl2ZU1ldGFkYXRhWydpbnB1dHMnXSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgLy8gVE9ETyhsZWdhY3ktcGFydGlhbC1vdXRwdXQtaW5wdXRzKTogUmVtb3ZlIGZ1bmN0aW9uIGluIHYxOC5cblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoaW5wdXRzKTtcbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMubWFwKGRlY2xhcmVkTmFtZSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBpbnB1dHNbZGVjbGFyZWROYW1lXTtcbiAgICBjb25zdCBwdWJsaWNOYW1lID0gdmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZTtcbiAgICBjb25zdCBkaWZmZXJlbnREZWNsYXJpbmdOYW1lID0gcHVibGljTmFtZSAhPT0gZGVjbGFyZWROYW1lO1xuICAgIGxldCByZXN1bHQ6IG8uRXhwcmVzc2lvbjtcblxuICAgIGlmIChkaWZmZXJlbnREZWNsYXJpbmdOYW1lIHx8IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSBbYXNMaXRlcmFsKHB1YmxpY05hbWUpLCBhc0xpdGVyYWwoZGVjbGFyZWROYW1lKV07XG4gICAgICBpZiAodmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGwpIHtcbiAgICAgICAgdmFsdWVzLnB1c2godmFsdWUudHJhbnNmb3JtRnVuY3Rpb24pO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAga2V5OiBkZWNsYXJlZE5hbWUsXG4gICAgICAvLyBwdXQgcXVvdGVzIGFyb3VuZCBrZXlzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcmFjdGVyc1xuICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KGRlY2xhcmVkTmFtZSksXG4gICAgICB2YWx1ZTogcmVzdWx0LFxuICAgIH07XG4gIH0pKTtcbn1cbiJdfQ==