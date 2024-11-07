/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import * as o from '../../output/output_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { convertFromMaybeForwardRefExpression, generateForwardRef, } from '../util';
import { createDirectiveType, createHostDirectivesMappingArray } from '../view/compiler';
import { asLiteral, conditionallyCreateDirectiveBindingLiteral, DefinitionMap, UNSAFE_OBJECT_KEY_NAME_REGEXP, } from '../view/util';
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
    definitionMap.set('version', o.literal('18.2.11+sha-5a236c2'));
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
    definitionMap.set('inputs', needsNewInputPartialOutput(meta)
        ? createInputsPartialMetadata(meta.inputs)
        : legacyInputsPartialMetadata(meta.inputs));
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
    const hasDecoratorTransformFunctions = Object.values(meta.inputs).some((input) => input.transformFunction !== null);
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
    if (meta.queries.some((q) => q.isSignal) || meta.viewQueries.some((q) => q.isSignal)) {
        minVersion = '17.2.0';
    }
    return minVersion;
}
/**
 * Gets whether the given directive needs the new input partial output structure
 * that can hold additional metadata like `isRequired`, `isSignal` etc.
 */
function needsNewInputPartialOutput(meta) {
    return Object.values(meta.inputs).some((input) => input.isSignal);
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
    meta.set('predicate', Array.isArray(query.predicate)
        ? asLiteral(query.predicate)
        : convertFromMaybeForwardRefExpression(query.predicate));
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
    hostMetadata.set('attributes', toOptionalLiteralMap(meta.attributes, (expression) => expression));
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
    const expressions = hostDirectives.map((current) => {
        const keys = [
            {
                key: 'directive',
                value: current.isForwardReference
                    ? generateForwardRef(current.directive.type)
                    : current.directive.type,
                quoted: false,
            },
        ];
        const inputsLiteral = current.inputs ? createHostDirectivesMappingArray(current.inputs) : null;
        const outputsLiteral = current.outputs
            ? createHostDirectivesMappingArray(current.outputs)
            : null;
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
    return o.literalMap(keys.map((declaredName) => {
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
            ]),
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
    return o.literalMap(keys.map((declaredName) => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFDTCxvQ0FBb0MsRUFDcEMsa0JBQWtCLEdBRW5CLE1BQU0sU0FBUyxDQUFDO0FBRWpCLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxnQ0FBZ0MsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZGLE9BQU8sRUFDTCxTQUFTLEVBQ1QsMENBQTBDLEVBQzFDLGFBQWEsRUFDYiw2QkFBNkIsR0FDOUIsTUFBTSxjQUFjLENBQUM7QUFHdEIsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUNqRCxJQUF5QjtJQUV6QixNQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV6RCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUYsTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdkMsT0FBTyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBQyxDQUFDO0FBQzVDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQzFDLElBQXlCO0lBRXpCLE1BQU0sYUFBYSxHQUFH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QyxZQUFZLEVBQUUsRUFBRTtRQUN4QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixDQUFDO1FBQzdDLE1BQU0sc0JBQXNCLEdBQUcsVUFBVSxLQUFLLFlBQVksQ0FBQztRQUMzRCxJQUFJLE1BQW9CLENBQUM7UUFFekIsSUFBSSxzQkFBc0IsSUFBSSxLQUFLLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDL0QsTUFBTSxNQUFNLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDaEUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdkMsQ0FBQztZQUNELE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsT0FBTztZQUNMLEdBQUcsRUFBRSxZQUFZO1lBQ2pCLG9FQUFvRTtZQUNwRSxNQUFNLEVBQUUsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN4RCxLQUFLLEVBQUUsTUFBTTtTQUNkLENBQUM7SUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmRldi9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtcbiAgY29udmVydEZyb21NYXliZUZvcndhcmRSZWZFeHByZXNzaW9uLFxuICBnZW5lcmF0ZUZvcndhcmRSZWYsXG4gIFIzQ29tcGlsZWRFeHByZXNzaW9uLFxufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7UjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVEaXJlY3RpdmVUeXBlLCBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheX0gZnJvbSAnLi4vdmlldy9jb21waWxlcic7XG5pbXBvcnQge1xuICBhc0xpdGVyYWwsXG4gIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbCxcbiAgRGVmaW5pdGlvbk1hcCxcbiAgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAsXG59IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGEsIFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxNYXB9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBkZWNsYXJhdGlvbiBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSxcbik6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogR2F0aGVycyB0aGUgZGVjbGFyYXRpb24gZmllbGRzIGZvciBhIGRpcmVjdGl2ZSBpbnRvIGEgYERlZmluaXRpb25NYXBgLiBUaGlzIGFsbG93cyBmb3IgcmV1c2luZ1xuICogdGhpcyBsb2dpYyBmb3IgY29tcG9uZW50cywgYXMgdGhleSBleHRlbmQgdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAoXG4gIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsXG4pOiBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YT4oKTtcbiAgY29uc3QgbWluVmVyc2lvbiA9IGdldE1pbmltdW1WZXJzaW9uRm9yUGFydGlhbE91dHB1dChtZXRhKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnbWluVmVyc2lvbicsIG8ubGl0ZXJhbChtaW5WZXJzaW9uKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd2ZXJzaW9uJywgby5saXRlcmFsKCcwLjAuMC1QTEFDRUhPTERFUicpKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIGlmIChtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc1N0YW5kYWxvbmUnLCBvLmxpdGVyYWwobWV0YS5pc1N0YW5kYWxvbmUpKTtcbiAgfVxuICBpZiAobWV0YS5pc1NpZ25hbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc1NpZ25hbCcsIG8ubGl0ZXJhbChtZXRhLmlzU2lnbmFsKSk7XG4gIH1cblxuICAvLyBlLmcuIGBzZWxlY3RvcjogJ3NvbWUtZGlyJ2BcbiAgaWYgKG1ldGEuc2VsZWN0b3IgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3InLCBvLmxpdGVyYWwobWV0YS5zZWxlY3RvcikpO1xuICB9XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgJ2lucHV0cycsXG4gICAgbmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YSlcbiAgICAgID8gY3JlYXRlSW5wdXRzUGFydGlhbE1ldGFkYXRhKG1ldGEuaW5wdXRzKVxuICAgICAgOiBsZWdhY3lJbnB1dHNQYXJ0aWFsTWV0YWRhdGEobWV0YS5pbnB1dHMpLFxuICApO1xuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdCcsIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YS5ob3N0KSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3Byb3ZpZGVycycsIG1ldGEucHJvdmlkZXJzKTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnF1ZXJpZXMubWFwKGNvbXBpbGVRdWVyeSkpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmlld1F1ZXJpZXMnLCBvLmxpdGVyYWxBcnIobWV0YS52aWV3UXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBhc0xpdGVyYWwobWV0YS5leHBvcnRBcykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNJbmhlcml0YW5jZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd1c2VzT25DaGFuZ2VzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdERpcmVjdGl2ZXMnLCBjcmVhdGVIb3N0RGlyZWN0aXZlcyhtZXRhLmhvc3REaXJlY3RpdmVzKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuXG4gIHJldHVybiBkZWZpbml0aW9uTWFwO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgdGhlIG1pbmltdW0gbGlua2VyIHZlcnNpb24gZm9yIHRoZSBwYXJ0aWFsIG91dHB1dFxuICogZ2VuZXJhdGVkIGZvciB0aGlzIGRpcmVjdGl2ZS5cbiAqXG4gKiBFdmVyeSB0aW1lIHdlIG1ha2UgYSBicmVha2luZyBjaGFuZ2UgdG8gdGhlIGRlY2xhcmF0aW9uIGludGVyZmFjZSBvciBwYXJ0aWFsLWxpbmtlclxuICogYmVoYXZpb3IsIHdlIG11c3QgdXBkYXRlIHRoZSBtaW5pbXVtIHZlcnNpb25zIHRvIHByZXZlbnQgb2xkIHBhcnRpYWwtbGlua2VycyBmcm9tXG4gKiBpbmNvcnJlY3RseSBwcm9jZXNzaW5nIHRoZSBkZWNsYXJhdGlvbi5cbiAqXG4gKiBOT1RFOiBEbyBub3QgaW5jbHVkZSBhbnkgcHJlcmVsZWFzZSBpbiB0aGVzZSB2ZXJzaW9ucyBhcyB0aGV5IGFyZSBpZ25vcmVkLlxuICovXG5mdW5jdGlvbiBnZXRNaW5pbXVtVmVyc2lvbkZvclBhcnRpYWxPdXRwdXQobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IHN0cmluZyB7XG4gIC8vIFdlIGFyZSBzdGFydGluZyB3aXRoIHRoZSBvbGRlc3QgbWluaW11bSB2ZXJzaW9uIHRoYXQgY2FuIHdvcmsgZm9yIGNvbW1vblxuICAvLyBkaXJlY3RpdmUgcGFydGlhbCBjb21waWxhdGlvbiBvdXRwdXQuIEFzIHdlIGRpc2NvdmVyIHVzYWdlcyBvZiBuZXcgZmVhdHVyZXNcbiAgLy8gdGhhdCByZXF1aXJlIGEgbmV3ZXIgcGFydGlhbCBvdXRwdXQgZW1pdCwgd2UgYnVtcCB0aGUgYG1pblZlcnNpb25gLiBPdXIgZ29hbFxuICAvLyBpcyB0byBrZWVwIGxpYnJhcmllcyBhcyBtdWNoIGNvbXBhdGlibGUgd2l0aCBvbGRlciBsaW5rZXIgdmVyc2lvbnMgYXMgcG9zc2libGUuXG4gIGxldCBtaW5WZXJzaW9uID0gJzE0LjAuMCc7XG5cbiAgLy8gTm90ZTogaW4gb3JkZXIgdG8gYWxsb3cgY29uc3VtaW5nIEFuZ3VsYXIgbGlicmFyaWVzIHRoYXQgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggMTYuMSsgaW5cbiAgLy8gQW5ndWxhciAxNi4wLCB3ZSBvbmx5IGZvcmNlIGEgbWluaW11bSB2ZXJzaW9uIG9mIDE2LjEgaWYgaW5wdXQgdHJhbnNmb3JtIGZlYXR1cmUgYXMgaW50cm9kdWNlZFxuICAvLyBpbiAxNi4xIGlzIGFjdHVhbGx5IHVzZWQuXG4gIGNvbnN0IGhhc0RlY29yYXRvclRyYW5zZm9ybUZ1bmN0aW9ucyA9IE9iamVjdC52YWx1ZXMobWV0YS5pbnB1dHMpLnNvbWUoXG4gICAgKGlucHV0KSA9PiBpbnB1dC50cmFuc2Zvcm1GdW5jdGlvbiAhPT0gbnVsbCxcbiAgKTtcbiAgaWYgKGhhc0RlY29yYXRvclRyYW5zZm9ybUZ1bmN0aW9ucykge1xuICAgIG1pblZlcnNpb24gPSAnMTYuMS4wJztcbiAgfVxuXG4gIC8vIElmIHRoZXJlIGFyZSBpbnB1dCBmbGFncyBhbmQgd2UgbmVlZCB0aGUgbmV3IGVtaXQsIHVzZSB0aGUgYWN0dWFsIG1pbmltdW0gdmVyc2lvbixcbiAgLy8gd2hlcmUgdGhpcyB3YXMgaW50cm9kdWNlZC4gaS5lLiBpbiAxNy4xLjBcbiAgLy8gVE9ETyhsZWdhY3ktcGFydGlhbC1vdXRwdXQtaW5wdXRzKTogUmVtb3ZlIGluIHYxOC5cbiAgaWYgKG5lZWRzTmV3SW5wdXRQYXJ0aWFsT3V0cHV0KG1ldGEpKSB7XG4gICAgbWluVmVyc2lvbiA9ICcxNy4xLjAnO1xuICB9XG5cbiAgLy8gSWYgdGhlcmUgYXJlIHNpZ25hbC1iYXNlZCBxdWVyaWVzLCBwYXJ0aWFsIG91dHB1dCBnZW5lcmF0ZXMgYW4gZXh0cmEgZmllbGRcbiAgLy8gdGhhdCBzaG91bGQgYmUgcGFyc2VkIGJ5IGxpbmtlcnMuIEVuc3VyZSBhIHByb3BlciBtaW5pbXVtIGxpbmtlciB2ZXJzaW9uLlxuICBpZiAobWV0YS5xdWVyaWVzLnNvbWUoKHEpID0+IHEuaXNTaWduYWwpIHx8IG1ldGEudmlld1F1ZXJpZXMuc29tZSgocSkgPT4gcS5pc1NpZ25hbCkpIHtcbiAgICBtaW5WZXJzaW9uID0gJzE3LjIuMCc7XG4gIH1cblxuICByZXR1cm4gbWluVmVyc2lvbjtcbn1cblxuLyoqXG4gKiBHZXRzIHdoZXRoZXIgdGhlIGdpdmVuIGRpcmVjdGl2ZSBuZWVkcyB0aGUgbmV3IGlucHV0IHBhcnRpYWwgb3V0cHV0IHN0cnVjdHVyZVxuICogdGhhdCBjYW4gaG9sZCBhZGRpdGlvbmFsIG1ldGFkYXRhIGxpa2UgYGlzUmVxdWlyZWRgLCBgaXNTaWduYWxgIGV0Yy5cbiAqL1xuZnVuY3Rpb24gbmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhtZXRhLmlucHV0cykuc29tZSgoaW5wdXQpID0+IGlucHV0LmlzU2lnbmFsKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgbWV0YWRhdGEgb2YgYSBzaW5nbGUgcXVlcnkgaW50byBpdHMgcGFydGlhbCBkZWNsYXJhdGlvbiBmb3JtIGFzIGRlY2xhcmVkXG4gKiBieSBgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVRdWVyeShxdWVyeTogUjNRdWVyeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IG1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVRdWVyeU1ldGFkYXRhPigpO1xuICBtZXRhLnNldCgncHJvcGVydHlOYW1lJywgby5saXRlcmFsKHF1ZXJ5LnByb3BlcnR5TmFtZSkpO1xuICBpZiAocXVlcnkuZmlyc3QpIHtcbiAgICBtZXRhLnNldCgnZmlyc3QnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KFxuICAgICdwcmVkaWNhdGUnLFxuICAgIEFycmF5LmlzQXJyYXkocXVlcnkucHJlZGljYXRlKVxuICAgICAgPyBhc0xpdGVyYWwocXVlcnkucHJlZGljYXRlKVxuICAgICAgOiBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24ocXVlcnkucHJlZGljYXRlKSxcbiAgKTtcbiAgaWYgKCFxdWVyeS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSkge1xuICAgIC8vIGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgaXMgc3BlY2lhbCBiZWNhdXNlIHdlIGV4cGVjdCBpdCB0byBiZSBgdHJ1ZWAuXG4gICAgLy8gVGhlcmVmb3JlIHdlIGV4cGxpY2l0bHkgZW1pdCB0aGUgZmllbGQsIGFuZCBleHBsaWNpdGx5IHBsYWNlIGl0IG9ubHkgd2hlbiBpdCdzIGBmYWxzZWAuXG4gICAgbWV0YS5zZXQoJ2VtaXREaXN0aW5jdENoYW5nZXNPbmx5Jywgby5saXRlcmFsKGZhbHNlKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIGxpbmtlciB3aWxsIGFzc3VtZSB0aGF0IGFuIGFic2VudCBgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHlgIGZsYWcgaXMgYnkgZGVmYXVsdCBgdHJ1ZWAuXG4gIH1cbiAgaWYgKHF1ZXJ5LmRlc2NlbmRhbnRzKSB7XG4gICAgbWV0YS5zZXQoJ2Rlc2NlbmRhbnRzJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBtZXRhLnNldCgncmVhZCcsIHF1ZXJ5LnJlYWQpO1xuICBpZiAocXVlcnkuc3RhdGljKSB7XG4gICAgbWV0YS5zZXQoJ3N0YXRpYycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmlzU2lnbmFsKSB7XG4gICAgbWV0YS5zZXQoJ2lzU2lnbmFsJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICByZXR1cm4gbWV0YS50b0xpdGVyYWxNYXAoKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgaG9zdCBtZXRhZGF0YSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGluIGBSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddYFxuICovXG5mdW5jdGlvbiBjb21waWxlSG9zdE1ldGFkYXRhKG1ldGE6IFIzSG9zdE1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB8IG51bGwge1xuICBjb25zdCBob3N0TWV0YWRhdGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxOb25OdWxsYWJsZTxSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdCddPj4oKTtcbiAgaG9zdE1ldGFkYXRhLnNldChcbiAgICAnYXR0cmlidXRlcycsXG4gICAgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5hdHRyaWJ1dGVzLCAoZXhwcmVzc2lvbikgPT4gZXhwcmVzc2lvbiksXG4gICk7XG4gIGhvc3RNZXRhZGF0YS5zZXQoJ2xpc3RlbmVycycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEubGlzdGVuZXJzLCBvLmxpdGVyYWwpKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgncHJvcGVydGllcycsIHRvT3B0aW9uYWxMaXRlcmFsTWFwKG1ldGEucHJvcGVydGllcywgby5saXRlcmFsKSk7XG5cbiAgaWYgKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgaG9zdE1ldGFkYXRhLnNldCgnc3R5bGVBdHRyaWJ1dGUnLCBvLmxpdGVyYWwobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpKTtcbiAgfVxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdjbGFzc0F0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikpO1xuICB9XG5cbiAgaWYgKGhvc3RNZXRhZGF0YS52YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBob3N0TWV0YWRhdGEudG9MaXRlcmFsTWFwKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdERpcmVjdGl2ZXMoXG4gIGhvc3REaXJlY3RpdmVzOiBOb25OdWxsYWJsZTxSM0RpcmVjdGl2ZU1ldGFkYXRhWydob3N0RGlyZWN0aXZlcyddPixcbik6IG8uTGl0ZXJhbEFycmF5RXhwciB7XG4gIGNvbnN0IGV4cHJlc3Npb25zID0gaG9zdERpcmVjdGl2ZXMubWFwKChjdXJyZW50KSA9PiB7XG4gICAgY29uc3Qga2V5cyA9IFtcbiAgICAgIHtcbiAgICAgICAga2V5OiAnZGlyZWN0aXZlJyxcbiAgICAgICAgdmFsdWU6IGN1cnJlbnQuaXNGb3J3YXJkUmVmZXJlbmNlXG4gICAgICAgICAgPyBnZW5lcmF0ZUZvcndhcmRSZWYoY3VycmVudC5kaXJlY3RpdmUudHlwZSlcbiAgICAgICAgICA6IGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUsXG4gICAgICAgIHF1b3RlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIF07XG4gICAgY29uc3QgaW5wdXRzTGl0ZXJhbCA9IGN1cnJlbnQuaW5wdXRzID8gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkoY3VycmVudC5pbnB1dHMpIDogbnVsbDtcbiAgICBjb25zdCBvdXRwdXRzTGl0ZXJhbCA9IGN1cnJlbnQub3V0cHV0c1xuICAgICAgPyBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpXG4gICAgICA6IG51bGw7XG5cbiAgICBpZiAoaW5wdXRzTGl0ZXJhbCkge1xuICAgICAga2V5cy5wdXNoKHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogaW5wdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgIH1cblxuICAgIGlmIChvdXRwdXRzTGl0ZXJhbCkge1xuICAgICAga2V5cy5wdXNoKHtrZXk6ICdvdXRwdXRzJywgdmFsdWU6IG91dHB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzKTtcbiAgfSk7XG5cbiAgLy8gSWYgdGhlcmUncyBhIGZvcndhcmQgcmVmZXJlbmNlLCB3ZSBnZW5lcmF0ZSBhIGBmdW5jdGlvbigpIHsgcmV0dXJuIFt7ZGlyZWN0aXZlOiBIb3N0RGlyfV0gfWAsXG4gIC8vIG90aGVyd2lzZSB3ZSBjYW4gc2F2ZSBzb21lIGJ5dGVzIGJ5IHVzaW5nIGEgcGxhaW4gYXJyYXksIGUuZy4gYFt7ZGlyZWN0aXZlOiBIb3N0RGlyfV1gLlxuICByZXR1cm4gby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgcGFydGlhbCBvdXRwdXQgbWV0YWRhdGEgZm9yIGlucHV0cyBvZiBhIGRpcmVjdGl2ZS5cbiAqXG4gKiBUaGUgZ2VuZXJhdGVkIHN0cnVjdHVyZSBpcyBleHBlY3RlZCB0byBtYXRjaCBgUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlWydpbnB1dHMnXWAuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUlucHV0c1BhcnRpYWxNZXRhZGF0YShpbnB1dHM6IFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2lucHV0cyddKTogby5FeHByZXNzaW9uIHwgbnVsbCB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpbnB1dHMpO1xuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAoXG4gICAga2V5cy5tYXAoKGRlY2xhcmVkTmFtZSkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dHNbZGVjbGFyZWROYW1lXTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBkZWNsYXJlZE5hbWUsXG4gICAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChkZWNsYXJlZE5hbWUpLFxuICAgICAgICB2YWx1ZTogby5saXRlcmFsTWFwKFtcbiAgICAgICAgICB7a2V5OiAnY2xhc3NQcm9wZXJ0eU5hbWUnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLmNsYXNzUHJvcGVydHlOYW1lKX0sXG4gICAgICAgICAge2tleTogJ3B1YmxpY05hbWUnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWUpfSxcbiAgICAgICAgICB7a2V5OiAnaXNTaWduYWwnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLmlzU2lnbmFsKX0sXG4gICAgICAgICAge2tleTogJ2lzUmVxdWlyZWQnLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogYXNMaXRlcmFsKHZhbHVlLnJlcXVpcmVkKX0sXG4gICAgICAgICAge2tleTogJ3RyYW5zZm9ybUZ1bmN0aW9uJywgcXVvdGVkOiBmYWxzZSwgdmFsdWU6IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uID8/IG8uTlVMTF9FWFBSfSxcbiAgICAgICAgXSksXG4gICAgICB9O1xuICAgIH0pLFxuICApO1xufVxuXG4vKipcbiAqIFByZSB2MTggbGVnYWN5IHBhcnRpYWwgb3V0cHV0IGZvciBpbnB1dHMuXG4gKlxuICogUHJldmlvdXNseSwgaW5wdXRzIGRpZCBub3QgY2FwdHVyZSBtZXRhZGF0YSBsaWtlIGBpc1NpZ25hbGAgaW4gdGhlIHBhcnRpYWwgY29tcGlsYXRpb24gb3V0cHV0LlxuICogVG8gZW5hYmxlIGNhcHR1cmluZyBzdWNoIG1ldGFkYXRhLCB3ZSByZXN0cnVjdHVyZWQgaG93IGlucHV0IG1ldGFkYXRhIGlzIGNvbW11bmljYXRlZCBpbiB0aGVcbiAqIHBhcnRpYWwgb3V0cHV0LiBUaGlzIHdvdWxkIG1ha2UgbGlicmFyaWVzIGluY29tcGF0aWJsZSB3aXRoIG9sZGVyIEFuZ3VsYXIgRlcgdmVyc2lvbnMgd2hlcmUgdGhlXG4gKiBsaW5rZXIgd291bGQgbm90IGtub3cgaG93IHRvIGhhbmRsZSB0aGlzIG5ldyBcImZvcm1hdFwiLiBGb3IgdGhpcyByZWFzb24sIGlmIHdlIGtub3cgdGhpcyBtZXRhZGF0YVxuICogZG9lcyBub3QgbmVlZCB0byBiZSBjYXB0dXJlZC0gd2UgZmFsbCBiYWNrIHRvIHRoZSBvbGQgZm9ybWF0LiBUaGlzIGlzIHdoYXQgdGhpcyBmdW5jdGlvblxuICogZ2VuZXJhdGVzLlxuICpcbiAqIFNlZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvYmxvYi9kNGI0MjM2OTAyMTA4NzJiNWMzMmEzMjJhNjA5MGJlZGEzMGIwNWEzL3BhY2thZ2VzL2NvcmUvc3JjL2NvbXBpbGVyL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UudHMjTDE5Ny1MMTk5XG4gKi9cbmZ1bmN0aW9uIGxlZ2FjeUlucHV0c1BhcnRpYWxNZXRhZGF0YShpbnB1dHM6IFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2lucHV0cyddKTogby5FeHByZXNzaW9uIHwgbnVsbCB7XG4gIC8vIFRPRE8obGVnYWN5LXBhcnRpYWwtb3V0cHV0LWlucHV0cyk6IFJlbW92ZSBmdW5jdGlvbiBpbiB2MTguXG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGlucHV0cyk7XG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChcbiAgICBrZXlzLm1hcCgoZGVjbGFyZWROYW1lKSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0c1tkZWNsYXJlZE5hbWVdO1xuICAgICAgY29uc3QgcHVibGljTmFtZSA9IHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWU7XG4gICAgICBjb25zdCBkaWZmZXJlbnREZWNsYXJpbmdOYW1lID0gcHVibGljTmFtZSAhPT0gZGVjbGFyZWROYW1lO1xuICAgICAgbGV0IHJlc3VsdDogby5FeHByZXNzaW9uO1xuXG4gICAgICBpZiAoZGlmZmVyZW50RGVjbGFyaW5nTmFtZSB8fCB2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBbYXNMaXRlcmFsKHB1YmxpY05hbWUpLCBhc0xpdGVyYWwoZGVjbGFyZWROYW1lKV07XG4gICAgICAgIGlmICh2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICAgIHZhbHVlcy5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBkZWNsYXJlZE5hbWUsXG4gICAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChkZWNsYXJlZE5hbWUpLFxuICAgICAgICB2YWx1ZTogcmVzdWx0LFxuICAgICAgfTtcbiAgICB9KSxcbiAgKTtcbn1cbiJdfQ==