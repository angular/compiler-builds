/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
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
    definitionMap.set('version', o.literal('18.2.0-next.0+sha-c8e2885'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFDTCxvQ0FBb0MsRUFDcEMsa0JBQWtCLEdBRW5CLE1BQU0sU0FBUyxDQUFDO0FBRWpCLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxnQ0FBZ0MsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZGLE9BQU8sRUFDTCxTQUFTLEVBQ1QsMENBQTBDLEVBQzFDLGFBQWEsRUFDYiw2QkFBNkIsR0FDOUIsTUFBTSxjQUFjLENBQUM7QUFHdEIsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUNqRCxJQUF5QjtJQUV6QixNQUFNLGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV6RCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUYsTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdkMsT0FBTyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBQyxDQUFDO0FBQzVDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQzFDLElBQXlCO0lBRXpCLE1BQU0sYUFBYSxHQUFH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QyxZQUFZLEVBQUUsRUFBRTtRQUN4QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixDQUFDO1FBQzdDLE1BQU0sc0JBQXNCLEdBQUcsVUFBVSxLQUFLLFlBQVksQ0FBQztRQUMzRCxJQUFJLE1BQW9CLENBQUM7UUFFekIsSUFBSSxzQkFBc0IsSUFBSSxLQUFLLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDL0QsTUFBTSxNQUFNLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDaEUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdkMsQ0FBQztZQUNELE1BQU0sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsT0FBTztZQUNMLEdBQUcsRUFBRSxZQUFZO1lBQ2pCLG9FQUFvRTtZQUNwRSxNQUFNLEVBQUUsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN4RCxLQUFLLEVBQUUsTUFBTTtTQUNkLENBQUM7SUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1xuICBjb252ZXJ0RnJvbU1heWJlRm9yd2FyZFJlZkV4cHJlc3Npb24sXG4gIGdlbmVyYXRlRm9yd2FyZFJlZixcbiAgUjNDb21waWxlZEV4cHJlc3Npb24sXG59IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuLi92aWV3L2FwaSc7XG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZVR5cGUsIGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5fSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7XG4gIGFzTGl0ZXJhbCxcbiAgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsLFxuICBEZWZpbml0aW9uTWFwLFxuICBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUCxcbn0gZnJvbSAnLi4vdmlldy91dGlsJztcblxuaW1wb3J0IHtSM0RlY2xhcmVEaXJlY3RpdmVNZXRhZGF0YSwgUjNEZWNsYXJlUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHt0b09wdGlvbmFsTGl0ZXJhbE1hcH0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGRlY2xhcmF0aW9uIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLFxuKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChtZXRhKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgZGlyZWN0aXZlIGludG8gYSBgRGVmaW5pdGlvbk1hcGAuIFRoaXMgYWxsb3dzIGZvciByZXVzaW5nXG4gKiB0aGlzIGxvZ2ljIGZvciBjb21wb25lbnRzLCBhcyB0aGV5IGV4dGVuZCB0aGUgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlRGVmaW5pdGlvbk1hcChcbiAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSxcbik6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGlyZWN0aXZlTWV0YWRhdGE+IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuICBjb25zdCBtaW5WZXJzaW9uID0gZ2V0TWluaW11bVZlcnNpb25Gb3JQYXJ0aWFsT3V0cHV0KG1ldGEpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdtaW5WZXJzaW9uJywgby5saXRlcmFsKG1pblZlcnNpb24pKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZS52YWx1ZSk7XG5cbiAgaWYgKG1ldGEuaXNTdGFuZGFsb25lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzU3RhbmRhbG9uZScsIG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpO1xuICB9XG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lzU2lnbmFsJywgby5saXRlcmFsKG1ldGEuaXNTaWduYWwpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHNlbGVjdG9yOiAnc29tZS1kaXInYFxuICBpZiAobWV0YS5zZWxlY3RvciAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChtZXRhLnNlbGVjdG9yKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAnaW5wdXRzJyxcbiAgICBuZWVkc05ld0lucHV0UGFydGlhbE91dHB1dChtZXRhKVxuICAgICAgPyBjcmVhdGVJbnB1dHNQYXJ0aWFsTWV0YWRhdGEobWV0YS5pbnB1dHMpXG4gICAgICA6IGxlZ2FjeUlucHV0c1BhcnRpYWxNZXRhZGF0YShtZXRhLmlucHV0cyksXG4gICk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdob3N0JywgY29tcGlsZUhvc3RNZXRhZGF0YShtZXRhLmhvc3QpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgncHJvdmlkZXJzJywgbWV0YS5wcm92aWRlcnMpO1xuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdxdWVyaWVzJywgby5saXRlcmFsQXJyKG1ldGEucXVlcmllcy5tYXAoY29tcGlsZVF1ZXJ5KSkpO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcmllcycsIG8ubGl0ZXJhbEFycihtZXRhLnZpZXdRdWVyaWVzLm1hcChjb21waWxlUXVlcnkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIGFzTGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndXNlc0luaGVyaXRhbmNlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3VzZXNPbkNoYW5nZXMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0RGlyZWN0aXZlcycsIGNyZWF0ZUhvc3REaXJlY3RpdmVzKG1ldGEuaG9zdERpcmVjdGl2ZXMpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB0aGUgbWluaW11bSBsaW5rZXIgdmVyc2lvbiBmb3IgdGhlIHBhcnRpYWwgb3V0cHV0XG4gKiBnZW5lcmF0ZWQgZm9yIHRoaXMgZGlyZWN0aXZlLlxuICpcbiAqIEV2ZXJ5IHRpbWUgd2UgbWFrZSBhIGJyZWFraW5nIGNoYW5nZSB0byB0aGUgZGVjbGFyYXRpb24gaW50ZXJmYWNlIG9yIHBhcnRpYWwtbGlua2VyXG4gKiBiZWhhdmlvciwgd2UgbXVzdCB1cGRhdGUgdGhlIG1pbmltdW0gdmVyc2lvbnMgdG8gcHJldmVudCBvbGQgcGFydGlhbC1saW5rZXJzIGZyb21cbiAqIGluY29ycmVjdGx5IHByb2Nlc3NpbmcgdGhlIGRlY2xhcmF0aW9uLlxuICpcbiAqIE5PVEU6IERvIG5vdCBpbmNsdWRlIGFueSBwcmVyZWxlYXNlIGluIHRoZXNlIHZlcnNpb25zIGFzIHRoZXkgYXJlIGlnbm9yZWQuXG4gKi9cbmZ1bmN0aW9uIGdldE1pbmltdW1WZXJzaW9uRm9yUGFydGlhbE91dHB1dChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogc3RyaW5nIHtcbiAgLy8gV2UgYXJlIHN0YXJ0aW5nIHdpdGggdGhlIG9sZGVzdCBtaW5pbXVtIHZlcnNpb24gdGhhdCBjYW4gd29yayBmb3IgY29tbW9uXG4gIC8vIGRpcmVjdGl2ZSBwYXJ0aWFsIGNvbXBpbGF0aW9uIG91dHB1dC4gQXMgd2UgZGlzY292ZXIgdXNhZ2VzIG9mIG5ldyBmZWF0dXJlc1xuICAvLyB0aGF0IHJlcXVpcmUgYSBuZXdlciBwYXJ0aWFsIG91dHB1dCBlbWl0LCB3ZSBidW1wIHRoZSBgbWluVmVyc2lvbmAuIE91ciBnb2FsXG4gIC8vIGlzIHRvIGtlZXAgbGlicmFyaWVzIGFzIG11Y2ggY29tcGF0aWJsZSB3aXRoIG9sZGVyIGxpbmtlciB2ZXJzaW9ucyBhcyBwb3NzaWJsZS5cbiAgbGV0IG1pblZlcnNpb24gPSAnMTQuMC4wJztcblxuICAvLyBOb3RlOiBpbiBvcmRlciB0byBhbGxvdyBjb25zdW1pbmcgQW5ndWxhciBsaWJyYXJpZXMgdGhhdCBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCAxNi4xKyBpblxuICAvLyBBbmd1bGFyIDE2LjAsIHdlIG9ubHkgZm9yY2UgYSBtaW5pbXVtIHZlcnNpb24gb2YgMTYuMSBpZiBpbnB1dCB0cmFuc2Zvcm0gZmVhdHVyZSBhcyBpbnRyb2R1Y2VkXG4gIC8vIGluIDE2LjEgaXMgYWN0dWFsbHkgdXNlZC5cbiAgY29uc3QgaGFzRGVjb3JhdG9yVHJhbnNmb3JtRnVuY3Rpb25zID0gT2JqZWN0LnZhbHVlcyhtZXRhLmlucHV0cykuc29tZShcbiAgICAoaW5wdXQpID0+IGlucHV0LnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsLFxuICApO1xuICBpZiAoaGFzRGVjb3JhdG9yVHJhbnNmb3JtRnVuY3Rpb25zKSB7XG4gICAgbWluVmVyc2lvbiA9ICcxNi4xLjAnO1xuICB9XG5cbiAgLy8gSWYgdGhlcmUgYXJlIGlucHV0IGZsYWdzIGFuZCB3ZSBuZWVkIHRoZSBuZXcgZW1pdCwgdXNlIHRoZSBhY3R1YWwgbWluaW11bSB2ZXJzaW9uLFxuICAvLyB3aGVyZSB0aGlzIHdhcyBpbnRyb2R1Y2VkLiBpLmUuIGluIDE3LjEuMFxuICAvLyBUT0RPKGxlZ2FjeS1wYXJ0aWFsLW91dHB1dC1pbnB1dHMpOiBSZW1vdmUgaW4gdjE4LlxuICBpZiAobmVlZHNOZXdJbnB1dFBhcnRpYWxPdXRwdXQobWV0YSkpIHtcbiAgICBtaW5WZXJzaW9uID0gJzE3LjEuMCc7XG4gIH1cblxuICAvLyBJZiB0aGVyZSBhcmUgc2lnbmFsLWJhc2VkIHF1ZXJpZXMsIHBhcnRpYWwgb3V0cHV0IGdlbmVyYXRlcyBhbiBleHRyYSBmaWVsZFxuICAvLyB0aGF0IHNob3VsZCBiZSBwYXJzZWQgYnkgbGlua2Vycy4gRW5zdXJlIGEgcHJvcGVyIG1pbmltdW0gbGlua2VyIHZlcnNpb24uXG4gIGlmIChtZXRhLnF1ZXJpZXMuc29tZSgocSkgPT4gcS5pc1NpZ25hbCkgfHwgbWV0YS52aWV3UXVlcmllcy5zb21lKChxKSA9PiBxLmlzU2lnbmFsKSkge1xuICAgIG1pblZlcnNpb24gPSAnMTcuMi4wJztcbiAgfVxuXG4gIHJldHVybiBtaW5WZXJzaW9uO1xufVxuXG4vKipcbiAqIEdldHMgd2hldGhlciB0aGUgZ2l2ZW4gZGlyZWN0aXZlIG5lZWRzIHRoZSBuZXcgaW5wdXQgcGFydGlhbCBvdXRwdXQgc3RydWN0dXJlXG4gKiB0aGF0IGNhbiBob2xkIGFkZGl0aW9uYWwgbWV0YWRhdGEgbGlrZSBgaXNSZXF1aXJlZGAsIGBpc1NpZ25hbGAgZXRjLlxuICovXG5mdW5jdGlvbiBuZWVkc05ld0lucHV0UGFydGlhbE91dHB1dChtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogYm9vbGVhbiB7XG4gIHJldHVybiBPYmplY3QudmFsdWVzKG1ldGEuaW5wdXRzKS5zb21lKChpbnB1dCkgPT4gaW5wdXQuaXNTaWduYWwpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBtZXRhZGF0YSBvZiBhIHNpbmdsZSBxdWVyeSBpbnRvIGl0cyBwYXJ0aWFsIGRlY2xhcmF0aW9uIGZvcm0gYXMgZGVjbGFyZWRcbiAqIGJ5IGBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVF1ZXJ5KHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWV0YSA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGE+KCk7XG4gIG1ldGEuc2V0KCdwcm9wZXJ0eU5hbWUnLCBvLmxpdGVyYWwocXVlcnkucHJvcGVydHlOYW1lKSk7XG4gIGlmIChxdWVyeS5maXJzdCkge1xuICAgIG1ldGEuc2V0KCdmaXJzdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgbWV0YS5zZXQoXG4gICAgJ3ByZWRpY2F0ZScsXG4gICAgQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpXG4gICAgICA/IGFzTGl0ZXJhbChxdWVyeS5wcmVkaWNhdGUpXG4gICAgICA6IGNvbnZlcnRGcm9tTWF5YmVGb3J3YXJkUmVmRXhwcmVzc2lvbihxdWVyeS5wcmVkaWNhdGUpLFxuICApO1xuICBpZiAoIXF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5KSB7XG4gICAgLy8gYGVtaXREaXN0aW5jdENoYW5nZXNPbmx5YCBpcyBzcGVjaWFsIGJlY2F1c2Ugd2UgZXhwZWN0IGl0IHRvIGJlIGB0cnVlYC5cbiAgICAvLyBUaGVyZWZvcmUgd2UgZXhwbGljaXRseSBlbWl0IHRoZSBmaWVsZCwgYW5kIGV4cGxpY2l0bHkgcGxhY2UgaXQgb25seSB3aGVuIGl0J3MgYGZhbHNlYC5cbiAgICBtZXRhLnNldCgnZW1pdERpc3RpbmN0Q2hhbmdlc09ubHknLCBvLmxpdGVyYWwoZmFsc2UpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgbGlua2VyIHdpbGwgYXNzdW1lIHRoYXQgYW4gYWJzZW50IGBlbWl0RGlzdGluY3RDaGFuZ2VzT25seWAgZmxhZyBpcyBieSBkZWZhdWx0IGB0cnVlYC5cbiAgfVxuICBpZiAocXVlcnkuZGVzY2VuZGFudHMpIHtcbiAgICBtZXRhLnNldCgnZGVzY2VuZGFudHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIG1ldGEuc2V0KCdyZWFkJywgcXVlcnkucmVhZCk7XG4gIGlmIChxdWVyeS5zdGF0aWMpIHtcbiAgICBtZXRhLnNldCgnc3RhdGljJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAocXVlcnkuaXNTaWduYWwpIHtcbiAgICBtZXRhLnNldCgnaXNTaWduYWwnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBtZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBob3N0IG1ldGFkYXRhIGludG8gaXRzIHBhcnRpYWwgZGVjbGFyYXRpb24gZm9ybSBhcyBkZWNsYXJlZFxuICogaW4gYFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J11gXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVIb3N0TWV0YWRhdGEobWV0YTogUjNIb3N0TWV0YWRhdGEpOiBvLkxpdGVyYWxNYXBFeHByIHwgbnVsbCB7XG4gIGNvbnN0IGhvc3RNZXRhZGF0YSA9IG5ldyBEZWZpbml0aW9uTWFwPE5vbk51bGxhYmxlPFIzRGVjbGFyZURpcmVjdGl2ZU1ldGFkYXRhWydob3N0J10+PigpO1xuICBob3N0TWV0YWRhdGEuc2V0KFxuICAgICdhdHRyaWJ1dGVzJyxcbiAgICB0b09wdGlvbmFsTGl0ZXJhbE1hcChtZXRhLmF0dHJpYnV0ZXMsIChleHByZXNzaW9uKSA9PiBleHByZXNzaW9uKSxcbiAgKTtcbiAgaG9zdE1ldGFkYXRhLnNldCgnbGlzdGVuZXJzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5saXN0ZW5lcnMsIG8ubGl0ZXJhbCkpO1xuICBob3N0TWV0YWRhdGEuc2V0KCdwcm9wZXJ0aWVzJywgdG9PcHRpb25hbExpdGVyYWxNYXAobWV0YS5wcm9wZXJ0aWVzLCBvLmxpdGVyYWwpKTtcblxuICBpZiAobWV0YS5zcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIpIHtcbiAgICBob3N0TWV0YWRhdGEuc2V0KCdzdHlsZUF0dHJpYnV0ZScsIG8ubGl0ZXJhbChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikpO1xuICB9XG4gIGlmIChtZXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikge1xuICAgIGhvc3RNZXRhZGF0YS5zZXQoJ2NsYXNzQXR0cmlidXRlJywgby5saXRlcmFsKG1ldGEuc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyKSk7XG4gIH1cblxuICBpZiAoaG9zdE1ldGFkYXRhLnZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGhvc3RNZXRhZGF0YS50b0xpdGVyYWxNYXAoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlcyhcbiAgaG9zdERpcmVjdGl2ZXM6IE5vbk51bGxhYmxlPFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3REaXJlY3RpdmVzJ10+LFxuKTogby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgY29uc3QgZXhwcmVzc2lvbnMgPSBob3N0RGlyZWN0aXZlcy5tYXAoKGN1cnJlbnQpID0+IHtcbiAgICBjb25zdCBrZXlzID0gW1xuICAgICAge1xuICAgICAgICBrZXk6ICdkaXJlY3RpdmUnLFxuICAgICAgICB2YWx1ZTogY3VycmVudC5pc0ZvcndhcmRSZWZlcmVuY2VcbiAgICAgICAgICA/IGdlbmVyYXRlRm9yd2FyZFJlZihjdXJyZW50LmRpcmVjdGl2ZS50eXBlKVxuICAgICAgICAgIDogY3VycmVudC5kaXJlY3RpdmUudHlwZSxcbiAgICAgICAgcXVvdGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXTtcbiAgICBjb25zdCBpbnB1dHNMaXRlcmFsID0gY3VycmVudC5pbnB1dHMgPyBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50LmlucHV0cykgOiBudWxsO1xuICAgIGNvbnN0IG91dHB1dHNMaXRlcmFsID0gY3VycmVudC5vdXRwdXRzXG4gICAgICA/IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQub3V0cHV0cylcbiAgICAgIDogbnVsbDtcblxuICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ2lucHV0cycsIHZhbHVlOiBpbnB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dHNMaXRlcmFsKSB7XG4gICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMpO1xuICB9KTtcblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW3tkaXJlY3RpdmU6IEhvc3REaXJ9XSB9YCxcbiAgLy8gb3RoZXJ3aXNlIHdlIGNhbiBzYXZlIHNvbWUgYnl0ZXMgYnkgdXNpbmcgYSBwbGFpbiBhcnJheSwgZS5nLiBgW3tkaXJlY3RpdmU6IEhvc3REaXJ9XWAuXG4gIHJldHVybiBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBwYXJ0aWFsIG91dHB1dCBtZXRhZGF0YSBmb3IgaW5wdXRzIG9mIGEgZGlyZWN0aXZlLlxuICpcbiAqIFRoZSBnZW5lcmF0ZWQgc3RydWN0dXJlIGlzIGV4cGVjdGVkIHRvIG1hdGNoIGBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGVbJ2lucHV0cyddYC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlSW5wdXRzUGFydGlhbE1ldGFkYXRhKGlucHV0czogUjNEaXJlY3RpdmVNZXRhZGF0YVsnaW5wdXRzJ10pOiBvLkV4cHJlc3Npb24gfCBudWxsIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGlucHV0cyk7XG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChcbiAgICBrZXlzLm1hcCgoZGVjbGFyZWROYW1lKSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0c1tkZWNsYXJlZE5hbWVdO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IGRlY2xhcmVkTmFtZSxcbiAgICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KGRlY2xhcmVkTmFtZSksXG4gICAgICAgIHZhbHVlOiBvLmxpdGVyYWxNYXAoW1xuICAgICAgICAgIHtrZXk6ICdjbGFzc1Byb3BlcnR5TmFtZScsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUuY2xhc3NQcm9wZXJ0eU5hbWUpfSxcbiAgICAgICAgICB7a2V5OiAncHVibGljTmFtZScsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZSl9LFxuICAgICAgICAgIHtrZXk6ICdpc1NpZ25hbCcsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUuaXNTaWduYWwpfSxcbiAgICAgICAgICB7a2V5OiAnaXNSZXF1aXJlZCcsIHF1b3RlZDogZmFsc2UsIHZhbHVlOiBhc0xpdGVyYWwodmFsdWUucmVxdWlyZWQpfSxcbiAgICAgICAgICB7a2V5OiAndHJhbnNmb3JtRnVuY3Rpb24nLCBxdW90ZWQ6IGZhbHNlLCB2YWx1ZTogdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gPz8gby5OVUxMX0VYUFJ9LFxuICAgICAgICBdKSxcbiAgICAgIH07XG4gICAgfSksXG4gICk7XG59XG5cbi8qKlxuICogUHJlIHYxOCBsZWdhY3kgcGFydGlhbCBvdXRwdXQgZm9yIGlucHV0cy5cbiAqXG4gKiBQcmV2aW91c2x5LCBpbnB1dHMgZGlkIG5vdCBjYXB0dXJlIG1ldGFkYXRhIGxpa2UgYGlzU2lnbmFsYCBpbiB0aGUgcGFydGlhbCBjb21waWxhdGlvbiBvdXRwdXQuXG4gKiBUbyBlbmFibGUgY2FwdHVyaW5nIHN1Y2ggbWV0YWRhdGEsIHdlIHJlc3RydWN0dXJlZCBob3cgaW5wdXQgbWV0YWRhdGEgaXMgY29tbXVuaWNhdGVkIGluIHRoZVxuICogcGFydGlhbCBvdXRwdXQuIFRoaXMgd291bGQgbWFrZSBsaWJyYXJpZXMgaW5jb21wYXRpYmxlIHdpdGggb2xkZXIgQW5ndWxhciBGVyB2ZXJzaW9ucyB3aGVyZSB0aGVcbiAqIGxpbmtlciB3b3VsZCBub3Qga25vdyBob3cgdG8gaGFuZGxlIHRoaXMgbmV3IFwiZm9ybWF0XCIuIEZvciB0aGlzIHJlYXNvbiwgaWYgd2Uga25vdyB0aGlzIG1ldGFkYXRhXG4gKiBkb2VzIG5vdCBuZWVkIHRvIGJlIGNhcHR1cmVkLSB3ZSBmYWxsIGJhY2sgdG8gdGhlIG9sZCBmb3JtYXQuIFRoaXMgaXMgd2hhdCB0aGlzIGZ1bmN0aW9uXG4gKiBnZW5lcmF0ZXMuXG4gKlxuICogU2VlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9ibG9iL2Q0YjQyMzY5MDIxMDg3MmI1YzMyYTMyMmE2MDkwYmVkYTMwYjA1YTMvcGFja2FnZXMvY29yZS9zcmMvY29tcGlsZXIvY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZS50cyNMMTk3LUwxOTlcbiAqL1xuZnVuY3Rpb24gbGVnYWN5SW5wdXRzUGFydGlhbE1ldGFkYXRhKGlucHV0czogUjNEaXJlY3RpdmVNZXRhZGF0YVsnaW5wdXRzJ10pOiBvLkV4cHJlc3Npb24gfCBudWxsIHtcbiAgLy8gVE9ETyhsZWdhY3ktcGFydGlhbC1vdXRwdXQtaW5wdXRzKTogUmVtb3ZlIGZ1bmN0aW9uIGluIHYxOC5cblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoaW5wdXRzKTtcbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gby5saXRlcmFsTWFwKFxuICAgIGtleXMubWFwKChkZWNsYXJlZE5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXRzW2RlY2xhcmVkTmFtZV07XG4gICAgICBjb25zdCBwdWJsaWNOYW1lID0gdmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZTtcbiAgICAgIGNvbnN0IGRpZmZlcmVudERlY2xhcmluZ05hbWUgPSBwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWU7XG4gICAgICBsZXQgcmVzdWx0OiBvLkV4cHJlc3Npb247XG5cbiAgICAgIGlmIChkaWZmZXJlbnREZWNsYXJpbmdOYW1lIHx8IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IFthc0xpdGVyYWwocHVibGljTmFtZSksIGFzTGl0ZXJhbChkZWNsYXJlZE5hbWUpXTtcbiAgICAgICAgaWYgKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICAgICAgdmFsdWVzLnB1c2godmFsdWUudHJhbnNmb3JtRnVuY3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gYXNMaXRlcmFsKHB1YmxpY05hbWUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IGRlY2xhcmVkTmFtZSxcbiAgICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KGRlY2xhcmVkTmFtZSksXG4gICAgICAgIHZhbHVlOiByZXN1bHQsXG4gICAgICB9O1xuICAgIH0pLFxuICApO1xufVxuIl19