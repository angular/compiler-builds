/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { isI18nAttribute } from './i18n/util';
/**
 * Checks whether an object key contains potentially unsafe chars, thus the key should be wrapped in
 * quotes. Note: we do not wrap all keys into quotes, as it may have impact on minification and may
 * not work in some cases when object keys are mangled by a minifier.
 *
 * TODO(FW-1136): this is a temporary solution, we need to come up with a better way of working with
 * inputs that contain potentially unsafe chars.
 */
const UNSAFE_OBJECT_KEY_NAME_REGEXP = /[-.]/;
/** Name of the temporary to use during data binding */
export const TEMPORARY_NAME = '_t';
/** Name of the context parameter passed into a template function */
export const CONTEXT_NAME = 'ctx';
/** Name of the RenderFlag passed into a template function */
export const RENDER_FLAGS = 'rf';
/** The prefix reference variables */
export const REFERENCE_PREFIX = '_r';
/** The name of the implicit context reference */
export const IMPLICIT_REFERENCE = '$implicit';
/** Non bindable attribute name **/
export const NON_BINDABLE_ATTR = 'ngNonBindable';
/** Name for the variable keeping track of the context returned by `ɵɵrestoreView`. */
export const RESTORED_VIEW_CONTEXT_NAME = 'restoredCtx';
/** Special value representing a direct access to a template's context. */
export const DIRECT_CONTEXT_REFERENCE = '#context';
/**
 * Maximum length of a single instruction chain. Because our output AST uses recursion, we're
 * limited in how many expressions we can nest before we reach the call stack limit. This
 * length is set very conservatively in order to reduce the chance of problems.
 */
const MAX_CHAIN_LENGTH = 500;
/** Instructions that support chaining. */
const CHAINABLE_INSTRUCTIONS = new Set([
    R3.element,
    R3.elementStart,
    R3.elementEnd,
    R3.elementContainer,
    R3.elementContainerStart,
    R3.elementContainerEnd,
    R3.i18nExp,
    R3.listener,
    R3.classProp,
    R3.syntheticHostListener,
    R3.hostProperty,
    R3.syntheticHostProperty,
    R3.property,
    R3.propertyInterpolate1,
    R3.propertyInterpolate2,
    R3.propertyInterpolate3,
    R3.propertyInterpolate4,
    R3.propertyInterpolate5,
    R3.propertyInterpolate6,
    R3.propertyInterpolate7,
    R3.propertyInterpolate8,
    R3.propertyInterpolateV,
    R3.attribute,
    R3.attributeInterpolate1,
    R3.attributeInterpolate2,
    R3.attributeInterpolate3,
    R3.attributeInterpolate4,
    R3.attributeInterpolate5,
    R3.attributeInterpolate6,
    R3.attributeInterpolate7,
    R3.attributeInterpolate8,
    R3.attributeInterpolateV,
    R3.styleProp,
    R3.stylePropInterpolate1,
    R3.stylePropInterpolate2,
    R3.stylePropInterpolate3,
    R3.stylePropInterpolate4,
    R3.stylePropInterpolate5,
    R3.stylePropInterpolate6,
    R3.stylePropInterpolate7,
    R3.stylePropInterpolate8,
    R3.stylePropInterpolateV,
    R3.textInterpolate,
    R3.textInterpolate1,
    R3.textInterpolate2,
    R3.textInterpolate3,
    R3.textInterpolate4,
    R3.textInterpolate5,
    R3.textInterpolate6,
    R3.textInterpolate7,
    R3.textInterpolate8,
    R3.textInterpolateV,
    R3.templateCreate,
]);
/** Generates a call to a single instruction. */
export function invokeInstruction(span, reference, params) {
    return o.importExpr(reference, null, span).callFn(params, span);
}
/**
 * Creates an allocator for a temporary variable.
 *
 * A variable declaration is added to the statements the first time the allocator is invoked.
 */
export function temporaryAllocator(statements, name) {
    let temp = null;
    return () => {
        if (!temp) {
            statements.push(new o.DeclareVarStmt(TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
            temp = o.variable(name);
        }
        return temp;
    };
}
export function invalid(arg) {
    throw new Error(`Invalid state: Visitor ${this.constructor.name} doesn't handle ${arg.constructor.name}`);
}
export function asLiteral(value) {
    if (Array.isArray(value)) {
        return o.literalArr(value.map(asLiteral));
    }
    return o.literal(value, o.INFERRED_TYPE);
}
export function conditionallyCreateDirectiveBindingLiteral(map, keepDeclared) {
    const keys = Object.getOwnPropertyNames(map);
    if (keys.length === 0) {
        return null;
    }
    return o.literalMap(keys.map(key => {
        const value = map[key];
        let declaredName;
        let publicName;
        let minifiedName;
        let expressionValue;
        if (typeof value === 'string') {
            // canonical syntax: `dirProp: publicProp`
            declaredName = key;
            minifiedName = key;
            publicName = value;
            expressionValue = asLiteral(publicName);
        }
        else {
            minifiedName = key;
            declaredName = value.classPropertyName;
            publicName = value.bindingPropertyName;
            if (keepDeclared && (publicName !== declaredName || value.transformFunction != null)) {
                const expressionKeys = [asLiteral(publicName), asLiteral(declaredName)];
                if (value.transformFunction != null) {
                    expressionKeys.push(value.transformFunction);
                }
                expressionValue = o.literalArr(expressionKeys);
            }
            else {
                expressionValue = asLiteral(publicName);
            }
        }
        return {
            key: minifiedName,
            // put quotes around keys that contain potentially unsafe characters
            quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(minifiedName),
            value: expressionValue,
        };
    }));
}
/**
 *  Remove trailing null nodes as they are implied.
 */
export function trimTrailingNulls(parameters) {
    while (o.isNull(parameters[parameters.length - 1])) {
        parameters.pop();
    }
    return parameters;
}
export function getQueryPredicate(query, constantPool) {
    if (Array.isArray(query.predicate)) {
        let predicate = [];
        query.predicate.forEach((selector) => {
            // Each item in predicates array may contain strings with comma-separated refs
            // (for ex. 'ref, ref1, ..., refN'), thus we extract individual refs and store them
            // as separate array entities
            const selectors = selector.split(',').map(token => o.literal(token.trim()));
            predicate.push(...selectors);
        });
        return constantPool.getConstLiteral(o.literalArr(predicate), true);
    }
    else {
        // The original predicate may have been wrapped in a `forwardRef()` call.
        switch (query.predicate.forwardRef) {
            case 0 /* ForwardRefHandling.None */:
            case 2 /* ForwardRefHandling.Unwrapped */:
                return query.predicate.expression;
            case 1 /* ForwardRefHandling.Wrapped */:
                return o.importExpr(R3.resolveForwardRef).callFn([query.predicate.expression]);
        }
    }
}
/**
 * A representation for an object literal used during codegen of definition objects. The generic
 * type `T` allows to reference a documented type of the generated structure, such that the
 * property names that are set can be resolved to their documented declaration.
 */
export class DefinitionMap {
    constructor() {
        this.values = [];
    }
    set(key, value) {
        if (value) {
            const existing = this.values.find(value => value.key === key);
            if (existing) {
                existing.value = value;
            }
            else {
                this.values.push({ key: key, value, quoted: false });
            }
        }
    }
    toLiteralMap() {
        return o.literalMap(this.values);
    }
}
/**
 * Extract a map of properties to values for a given element or template node, which can be used
 * by the directive matching machinery.
 *
 * @param elOrTpl the element or template in question
 * @return an object set up for directive matching. For attributes on the element/template, this
 * object maps a property name to its (static) value. For any bindings, this map simply maps the
 * property name to an empty string.
 */
export function getAttrsForDirectiveMatching(elOrTpl) {
    const attributesMap = {};
    if (elOrTpl instanceof t.Template && elOrTpl.tagName !== 'ng-template') {
        elOrTpl.templateAttrs.forEach(a => attributesMap[a.name] = '');
    }
    else {
        elOrTpl.attributes.forEach(a => {
            if (!isI18nAttribute(a.name)) {
                attributesMap[a.name] = a.value;
            }
        });
        elOrTpl.inputs.forEach(i => {
            if (i.type === 0 /* BindingType.Property */) {
                attributesMap[i.name] = '';
            }
        });
        elOrTpl.outputs.forEach(o => {
            attributesMap[o.name] = '';
        });
    }
    return attributesMap;
}
/**
 * Gets the number of arguments expected to be passed to a generated instruction in the case of
 * interpolation instructions.
 * @param interpolation An interpolation ast
 */
export function getInterpolationArgsLength(interpolation) {
    const { expressions, strings } = interpolation;
    if (expressions.length === 1 && strings.length === 2 && strings[0] === '' && strings[1] === '') {
        // If the interpolation has one interpolated value, but the prefix and suffix are both empty
        // strings, we only pass one argument, to a special instruction like `propertyInterpolate` or
        // `textInterpolate`.
        return 1;
    }
    else {
        return expressions.length + strings.length;
    }
}
/**
 * Generates the final instruction call statements based on the passed in configuration.
 * Will try to chain instructions as much as possible, if chaining is supported.
 */
export function getInstructionStatements(instructions) {
    const statements = [];
    let pendingExpression = null;
    let pendingExpressionType = null;
    let chainLength = 0;
    for (const current of instructions) {
        const resolvedParams = (typeof current.paramsOrFn === 'function' ? current.paramsOrFn() : current.paramsOrFn) ??
            [];
        const params = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];
        // If the current instruction is the same as the previous one
        // and it can be chained, add another call to the chain.
        if (chainLength < MAX_CHAIN_LENGTH && pendingExpressionType === current.reference &&
            CHAINABLE_INSTRUCTIONS.has(pendingExpressionType)) {
            // We'll always have a pending expression when there's a pending expression type.
            pendingExpression = pendingExpression.callFn(params, pendingExpression.sourceSpan);
            chainLength++;
        }
        else {
            if (pendingExpression !== null) {
                statements.push(pendingExpression.toStmt());
            }
            pendingExpression = invokeInstruction(current.span, current.reference, params);
            pendingExpressionType = current.reference;
            chainLength = 0;
        }
    }
    // Since the current instruction adds the previous one to the statements,
    // we may be left with the final one at the end that is still pending.
    if (pendingExpression !== null) {
        statements.push(pendingExpression.toStmt());
    }
    return statements;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sS0FBSyxDQUFDLE1BQU0sV0FBVyxDQUFDO0FBQy9CLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFJcEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUc1Qzs7Ozs7OztHQU9HO0FBQ0gsTUFBTSw2QkFBNkIsR0FBRyxNQUFNLENBQUM7QUFFN0MsdURBQXVEO0FBQ3ZELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFFbkMsb0VBQW9FO0FBQ3BFLE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7QUFFbEMsNkRBQTZEO0FBQzdELE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFFakMscUNBQXFDO0FBQ3JDLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUVyQyxpREFBaUQ7QUFDakQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0FBRTlDLG1DQUFtQztBQUNuQyxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUM7QUFFakQsc0ZBQXNGO0FBQ3RGLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLGFBQWEsQ0FBQztBQUV4RCwwRUFBMEU7QUFDMUUsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsVUFBVSxDQUFDO0FBRW5EOzs7O0dBSUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3QiwwQ0FBMEM7QUFDMUMsTUFBTSxzQkFBc0Is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QUNQLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVqRiw2REFBNkQ7UUFDN0Qsd0RBQXdEO1FBQ3hELElBQUksV0FBVyxHQUFHLGdCQUFnQixJQUFJLHFCQUFxQixLQUFLLE9BQU8sQ0FBQyxTQUFTO1lBQzdFLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1lBQ3JELGlGQUFpRjtZQUNqRixpQkFBaUIsR0FBRyxpQkFBa0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLGlCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JGLFdBQVcsRUFBRSxDQUFDO1NBQ2Y7YUFBTTtZQUNMLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFO2dCQUM5QixVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7YUFDN0M7WUFDRCxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDL0UscUJBQXFCLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUMxQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1NBQ2pCO0tBQ0Y7SUFFRCx5RUFBeUU7SUFDekUsc0VBQXNFO0lBQ3RFLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFO1FBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztLQUM3QztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtCaW5kaW5nVHlwZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtGb3J3YXJkUmVmSGFuZGxpbmd9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtpc0kxOG5BdHRyaWJ1dGV9IGZyb20gJy4vaTE4bi91dGlsJztcblxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIGFuIG9iamVjdCBrZXkgY29udGFpbnMgcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLCB0aHVzIHRoZSBrZXkgc2hvdWxkIGJlIHdyYXBwZWQgaW5cbiAqIHF1b3Rlcy4gTm90ZTogd2UgZG8gbm90IHdyYXAgYWxsIGtleXMgaW50byBxdW90ZXMsIGFzIGl0IG1heSBoYXZlIGltcGFjdCBvbiBtaW5pZmljYXRpb24gYW5kIG1heVxuICogbm90IHdvcmsgaW4gc29tZSBjYXNlcyB3aGVuIG9iamVjdCBrZXlzIGFyZSBtYW5nbGVkIGJ5IGEgbWluaWZpZXIuXG4gKlxuICogVE9ETyhGVy0xMTM2KTogdGhpcyBpcyBhIHRlbXBvcmFyeSBzb2x1dGlvbiwgd2UgbmVlZCB0byBjb21lIHVwIHdpdGggYSBiZXR0ZXIgd2F5IG9mIHdvcmtpbmcgd2l0aFxuICogaW5wdXRzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMuXG4gKi9cbmNvbnN0IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQID0gL1stLl0vO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOb24gYmluZGFibGUgYXR0cmlidXRlIG5hbWUgKiovXG5leHBvcnQgY29uc3QgTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5cbi8qKiBOYW1lIGZvciB0aGUgdmFyaWFibGUga2VlcGluZyB0cmFjayBvZiB0aGUgY29udGV4dCByZXR1cm5lZCBieSBgybXJtXJlc3RvcmVWaWV3YC4gKi9cbmV4cG9ydCBjb25zdCBSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSA9ICdyZXN0b3JlZEN0eCc7XG5cbi8qKiBTcGVjaWFsIHZhbHVlIHJlcHJlc2VudGluZyBhIGRpcmVjdCBhY2Nlc3MgdG8gYSB0ZW1wbGF0ZSdzIGNvbnRleHQuICovXG5leHBvcnQgY29uc3QgRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFID0gJyNjb250ZXh0JztcblxuLyoqXG4gKiBNYXhpbXVtIGxlbmd0aCBvZiBhIHNpbmdsZSBpbnN0cnVjdGlvbiBjaGFpbi4gQmVjYXVzZSBvdXIgb3V0cHV0IEFTVCB1c2VzIHJlY3Vyc2lvbiwgd2UncmVcbiAqIGxpbWl0ZWQgaW4gaG93IG1hbnkgZXhwcmVzc2lvbnMgd2UgY2FuIG5lc3QgYmVmb3JlIHdlIHJlYWNoIHRoZSBjYWxsIHN0YWNrIGxpbWl0LiBUaGlzXG4gKiBsZW5ndGggaXMgc2V0IHZlcnkgY29uc2VydmF0aXZlbHkgaW4gb3JkZXIgdG8gcmVkdWNlIHRoZSBjaGFuY2Ugb2YgcHJvYmxlbXMuXG4gKi9cbmNvbnN0IE1BWF9DSEFJTl9MRU5HVEggPSA1MDA7XG5cbi8qKiBJbnN0cnVjdGlvbnMgdGhhdCBzdXBwb3J0IGNoYWluaW5nLiAqL1xuY29uc3QgQ0hBSU5BQkxFX0lOU1RSVUNUSU9OUyA9IG5ldyBTZXQoW1xuICBSMy5lbGVtZW50LFxuICBSMy5lbGVtZW50U3RhcnQsXG4gIFIzLmVsZW1lbnRFbmQsXG4gIFIzLmVsZW1lbnRDb250YWluZXIsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudENvbnRhaW5lckVuZCxcbiAgUjMuaTE4bkV4cCxcbiAgUjMubGlzdGVuZXIsXG4gIFIzLmNsYXNzUHJvcCxcbiAgUjMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICBSMy5ob3N0UHJvcGVydHksXG4gIFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSxcbiAgUjMucHJvcGVydHksXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMixcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTMsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTYsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlOCxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIFIzLmF0dHJpYnV0ZSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTIsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTUsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTgsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVixcbiAgUjMuc3R5bGVQcm9wLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUzLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlOCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBSMy50ZXh0SW50ZXJwb2xhdGUsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTEsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTIsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTMsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTQsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTUsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTYsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTcsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTgsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZVYsXG4gIFIzLnRlbXBsYXRlQ3JlYXRlLFxuXSk7XG5cbi8qKlxuICogUG9zc2libGUgdHlwZXMgdGhhdCBjYW4gYmUgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcGFyYW1ldGVycyBvZiBhbiBpbnN0cnVjdGlvbiBjYWxsLlxuICogSWYgdGhlIHBhcmFtZXRlcnMgYXJlIGEgZnVuY3Rpb24sIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGludm9rZWQgYXQgdGhlIHRpbWUgdGhlIGluc3RydWN0aW9uXG4gKiBpcyBnZW5lcmF0ZWQuXG4gKi9cbmV4cG9ydCB0eXBlIEluc3RydWN0aW9uUGFyYW1zID0gKG8uRXhwcmVzc2lvbnxvLkV4cHJlc3Npb25bXSl8KCgpID0+IChvLkV4cHJlc3Npb258by5FeHByZXNzaW9uW10pKTtcblxuLyoqIE5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBhIGNhbGwgdG8gYW4gaW5zdHJ1Y3Rpb24gZnVuY3Rpb24uICovXG5leHBvcnQgaW50ZXJmYWNlIEluc3RydWN0aW9uIHtcbiAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgcGFyYW1zT3JGbj86IEluc3RydWN0aW9uUGFyYW1zO1xufVxuXG4vKiogR2VuZXJhdGVzIGEgY2FsbCB0byBhIHNpbmdsZSBpbnN0cnVjdGlvbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnZva2VJbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhbGxvY2F0b3IgZm9yIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICpcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgYWRkZWQgdG8gdGhlIHN0YXRlbWVudHMgdGhlIGZpcnN0IHRpbWUgdGhlIGFsbG9jYXRvciBpcyBpbnZva2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIG5hbWU6IHN0cmluZyk6ICgpID0+IG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5EZWNsYXJlVmFyU3RtdChURU1QT1JBUllfTkFNRSwgdW5kZWZpbmVkLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgdGVtcCA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wO1xuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnZhbGlkPFQ+KHRoaXM6IHQuVmlzaXRvciwgYXJnOiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnR8dC5Ob2RlKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHthcmcuY29uc3RydWN0b3IubmFtZX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzTGl0ZXJhbCh2YWx1ZTogYW55KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZS5tYXAoYXNMaXRlcmFsKSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgby5JTkZFUlJFRF9UWVBFKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChcbiAgICBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ3x7XG4gICAgICBjbGFzc1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgdHJhbnNmb3JtRnVuY3Rpb246IG8uRXhwcmVzc2lvbnxudWxsO1xuICAgIH0+LCBrZWVwRGVjbGFyZWQ/OiBib29sZWFuKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKTtcblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAoa2V5cy5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFtrZXldO1xuICAgIGxldCBkZWNsYXJlZE5hbWU6IHN0cmluZztcbiAgICBsZXQgcHVibGljTmFtZTogc3RyaW5nO1xuICAgIGxldCBtaW5pZmllZE5hbWU6IHN0cmluZztcbiAgICBsZXQgZXhwcmVzc2lvblZhbHVlOiBvLkV4cHJlc3Npb247XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gY2Fub25pY2FsIHN5bnRheDogYGRpclByb3A6IHB1YmxpY1Byb3BgXG4gICAgICBkZWNsYXJlZE5hbWUgPSBrZXk7XG4gICAgICBtaW5pZmllZE5hbWUgPSBrZXk7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWU7XG4gICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIGRlY2xhcmVkTmFtZSA9IHZhbHVlLmNsYXNzUHJvcGVydHlOYW1lO1xuICAgICAgcHVibGljTmFtZSA9IHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWU7XG5cbiAgICAgIGlmIChrZWVwRGVjbGFyZWQgJiYgKHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZSB8fCB2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiAhPSBudWxsKSkge1xuICAgICAgICBjb25zdCBleHByZXNzaW9uS2V5cyA9IFthc0xpdGVyYWwocHVibGljTmFtZSksIGFzTGl0ZXJhbChkZWNsYXJlZE5hbWUpXTtcblxuICAgICAgICBpZiAodmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT0gbnVsbCkge1xuICAgICAgICAgIGV4cHJlc3Npb25LZXlzLnB1c2godmFsdWUudHJhbnNmb3JtRnVuY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gby5saXRlcmFsQXJyKGV4cHJlc3Npb25LZXlzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAga2V5OiBtaW5pZmllZE5hbWUsXG4gICAgICAvLyBwdXQgcXVvdGVzIGFyb3VuZCBrZXlzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcmFjdGVyc1xuICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KG1pbmlmaWVkTmFtZSksXG4gICAgICB2YWx1ZTogZXhwcmVzc2lvblZhbHVlLFxuICAgIH07XG4gIH0pKTtcbn1cblxuLyoqXG4gKiAgUmVtb3ZlIHRyYWlsaW5nIG51bGwgbm9kZXMgYXMgdGhleSBhcmUgaW1wbGllZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uW10ge1xuICB3aGlsZSAoby5pc051bGwocGFyYW1ldGVyc1twYXJhbWV0ZXJzLmxlbmd0aCAtIDFdKSkge1xuICAgIHBhcmFtZXRlcnMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRRdWVyeVByZWRpY2F0ZShcbiAgICBxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHF1ZXJ5LnByZWRpY2F0ZSkpIHtcbiAgICBsZXQgcHJlZGljYXRlOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIHF1ZXJ5LnByZWRpY2F0ZS5mb3JFYWNoKChzZWxlY3Rvcjogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAvLyBFYWNoIGl0ZW0gaW4gcHJlZGljYXRlcyBhcnJheSBtYXkgY29udGFpbiBzdHJpbmdzIHdpdGggY29tbWEtc2VwYXJhdGVkIHJlZnNcbiAgICAgIC8vIChmb3IgZXguICdyZWYsIHJlZjEsIC4uLiwgcmVmTicpLCB0aHVzIHdlIGV4dHJhY3QgaW5kaXZpZHVhbCByZWZzIGFuZCBzdG9yZSB0aGVtXG4gICAgICAvLyBhcyBzZXBhcmF0ZSBhcnJheSBlbnRpdGllc1xuICAgICAgY29uc3Qgc2VsZWN0b3JzID0gc2VsZWN0b3Iuc3BsaXQoJywnKS5tYXAodG9rZW4gPT4gby5saXRlcmFsKHRva2VuLnRyaW0oKSkpO1xuICAgICAgcHJlZGljYXRlLnB1c2goLi4uc2VsZWN0b3JzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIocHJlZGljYXRlKSwgdHJ1ZSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIG9yaWdpbmFsIHByZWRpY2F0ZSBtYXkgaGF2ZSBiZWVuIHdyYXBwZWQgaW4gYSBgZm9yd2FyZFJlZigpYCBjYWxsLlxuICAgIHN3aXRjaCAocXVlcnkucHJlZGljYXRlLmZvcndhcmRSZWYpIHtcbiAgICAgIGNhc2UgRm9yd2FyZFJlZkhhbmRsaW5nLk5vbmU6XG4gICAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5VbndyYXBwZWQ6XG4gICAgICAgIHJldHVybiBxdWVyeS5wcmVkaWNhdGUuZXhwcmVzc2lvbjtcbiAgICAgIGNhc2UgRm9yd2FyZFJlZkhhbmRsaW5nLldyYXBwZWQ6XG4gICAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMucmVzb2x2ZUZvcndhcmRSZWYpLmNhbGxGbihbcXVlcnkucHJlZGljYXRlLmV4cHJlc3Npb25dKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlcHJlc2VudGF0aW9uIGZvciBhbiBvYmplY3QgbGl0ZXJhbCB1c2VkIGR1cmluZyBjb2RlZ2VuIG9mIGRlZmluaXRpb24gb2JqZWN0cy4gVGhlIGdlbmVyaWNcbiAqIHR5cGUgYFRgIGFsbG93cyB0byByZWZlcmVuY2UgYSBkb2N1bWVudGVkIHR5cGUgb2YgdGhlIGdlbmVyYXRlZCBzdHJ1Y3R1cmUsIHN1Y2ggdGhhdCB0aGVcbiAqIHByb3BlcnR5IG5hbWVzIHRoYXQgYXJlIHNldCBjYW4gYmUgcmVzb2x2ZWQgdG8gdGhlaXIgZG9jdW1lbnRlZCBkZWNsYXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXA8VCA9IGFueT4ge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleToga2V5b2YgVCwgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudmFsdWVzLmZpbmQodmFsdWUgPT4gdmFsdWUua2V5ID09PSBrZXkpO1xuXG4gICAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgICAgZXhpc3RpbmcudmFsdWUgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleToga2V5IGFzIHN0cmluZywgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcCh0aGlzLnZhbHVlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBFeHRyYWN0IGEgbWFwIG9mIHByb3BlcnRpZXMgdG8gdmFsdWVzIGZvciBhIGdpdmVuIGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZSwgd2hpY2ggY2FuIGJlIHVzZWRcbiAqIGJ5IHRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbWFjaGluZXJ5LlxuICpcbiAqIEBwYXJhbSBlbE9yVHBsIHRoZSBlbGVtZW50IG9yIHRlbXBsYXRlIGluIHF1ZXN0aW9uXG4gKiBAcmV0dXJuIGFuIG9iamVjdCBzZXQgdXAgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy4gRm9yIGF0dHJpYnV0ZXMgb24gdGhlIGVsZW1lbnQvdGVtcGxhdGUsIHRoaXNcbiAqIG9iamVjdCBtYXBzIGEgcHJvcGVydHkgbmFtZSB0byBpdHMgKHN0YXRpYykgdmFsdWUuIEZvciBhbnkgYmluZGluZ3MsIHRoaXMgbWFwIHNpbXBseSBtYXBzIHRoZVxuICogcHJvcGVydHkgbmFtZSB0byBhbiBlbXB0eSBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGw6IHQuRWxlbWVudHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHQuVGVtcGxhdGUpOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuXG4gIGlmIChlbE9yVHBsIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBlbE9yVHBsLnRhZ05hbWUgIT09ICduZy10ZW1wbGF0ZScpIHtcbiAgICBlbE9yVHBsLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChhID0+IGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9ICcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGlmICghaXNJMThuQXR0cmlidXRlKGEubmFtZSkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFthLm5hbWVdID0gYS52YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7XG4gICAgICBpZiAoaS50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2kubmFtZV0gPSAnJztcbiAgICAgIH1cbiAgICB9KTtcbiAgICBlbE9yVHBsLm91dHB1dHMuZm9yRWFjaChvID0+IHtcbiAgICAgIGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGF0dHJpYnV0ZXNNYXA7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyBleHBlY3RlZCB0byBiZSBwYXNzZWQgdG8gYSBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb24gaW4gdGhlIGNhc2Ugb2ZcbiAqIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gaW50ZXJwb2xhdGlvbiBhc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgY29uc3Qge2V4cHJlc3Npb25zLCBzdHJpbmdzfSA9IGludGVycG9sYXRpb247XG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5ncy5sZW5ndGggPT09IDIgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICAvLyBJZiB0aGUgaW50ZXJwb2xhdGlvbiBoYXMgb25lIGludGVycG9sYXRlZCB2YWx1ZSwgYnV0IHRoZSBwcmVmaXggYW5kIHN1ZmZpeCBhcmUgYm90aCBlbXB0eVxuICAgIC8vIHN0cmluZ3MsIHdlIG9ubHkgcGFzcyBvbmUgYXJndW1lbnQsIHRvIGEgc3BlY2lhbCBpbnN0cnVjdGlvbiBsaWtlIGBwcm9wZXJ0eUludGVycG9sYXRlYCBvclxuICAgIC8vIGB0ZXh0SW50ZXJwb2xhdGVgLlxuICAgIHJldHVybiAxO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByZXNzaW9ucy5sZW5ndGggKyBzdHJpbmdzLmxlbmd0aDtcbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0aGUgZmluYWwgaW5zdHJ1Y3Rpb24gY2FsbCBzdGF0ZW1lbnRzIGJhc2VkIG9uIHRoZSBwYXNzZWQgaW4gY29uZmlndXJhdGlvbi5cbiAqIFdpbGwgdHJ5IHRvIGNoYWluIGluc3RydWN0aW9ucyBhcyBtdWNoIGFzIHBvc3NpYmxlLCBpZiBjaGFpbmluZyBpcyBzdXBwb3J0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMoaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IHBlbmRpbmdFeHByZXNzaW9uOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gIGxldCBwZW5kaW5nRXhwcmVzc2lvblR5cGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8bnVsbCA9IG51bGw7XG4gIGxldCBjaGFpbkxlbmd0aCA9IDA7XG5cbiAgZm9yIChjb25zdCBjdXJyZW50IG9mIGluc3RydWN0aW9ucykge1xuICAgIGNvbnN0IHJlc29sdmVkUGFyYW1zID1cbiAgICAgICAgKHR5cGVvZiBjdXJyZW50LnBhcmFtc09yRm4gPT09ICdmdW5jdGlvbicgPyBjdXJyZW50LnBhcmFtc09yRm4oKSA6IGN1cnJlbnQucGFyYW1zT3JGbikgPz9cbiAgICAgICAgW107XG4gICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShyZXNvbHZlZFBhcmFtcykgPyByZXNvbHZlZFBhcmFtcyA6IFtyZXNvbHZlZFBhcmFtc107XG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBpbnN0cnVjdGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgcHJldmlvdXMgb25lXG4gICAgLy8gYW5kIGl0IGNhbiBiZSBjaGFpbmVkLCBhZGQgYW5vdGhlciBjYWxsIHRvIHRoZSBjaGFpbi5cbiAgICBpZiAoY2hhaW5MZW5ndGggPCBNQVhfQ0hBSU5fTEVOR1RIICYmIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9PT0gY3VycmVudC5yZWZlcmVuY2UgJiZcbiAgICAgICAgQ0hBSU5BQkxFX0lOU1RSVUNUSU9OUy5oYXMocGVuZGluZ0V4cHJlc3Npb25UeXBlKSkge1xuICAgICAgLy8gV2UnbGwgYWx3YXlzIGhhdmUgYSBwZW5kaW5nIGV4cHJlc3Npb24gd2hlbiB0aGVyZSdzIGEgcGVuZGluZyBleHByZXNzaW9uIHR5cGUuXG4gICAgICBwZW5kaW5nRXhwcmVzc2lvbiA9IHBlbmRpbmdFeHByZXNzaW9uIS5jYWxsRm4ocGFyYW1zLCBwZW5kaW5nRXhwcmVzc2lvbiEuc291cmNlU3Bhbik7XG4gICAgICBjaGFpbkxlbmd0aCsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICAgICAgc3RhdGVtZW50cy5wdXNoKHBlbmRpbmdFeHByZXNzaW9uLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uID0gaW52b2tlSW5zdHJ1Y3Rpb24oY3VycmVudC5zcGFuLCBjdXJyZW50LnJlZmVyZW5jZSwgcGFyYW1zKTtcbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9IGN1cnJlbnQucmVmZXJlbmNlO1xuICAgICAgY2hhaW5MZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNpbmNlIHRoZSBjdXJyZW50IGluc3RydWN0aW9uIGFkZHMgdGhlIHByZXZpb3VzIG9uZSB0byB0aGUgc3RhdGVtZW50cyxcbiAgLy8gd2UgbWF5IGJlIGxlZnQgd2l0aCB0aGUgZmluYWwgb25lIGF0IHRoZSBlbmQgdGhhdCBpcyBzdGlsbCBwZW5kaW5nLlxuICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gocGVuZGluZ0V4cHJlc3Npb24udG9TdG10KCkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG4iXX0=