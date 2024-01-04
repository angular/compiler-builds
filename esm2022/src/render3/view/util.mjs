/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InputFlags } from '../../core';
import { splitNsName } from '../../ml_parser/tags';
import * as o from '../../output/output_ast';
import { CssSelector } from '../../selector';
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
export const UNSAFE_OBJECT_KEY_NAME_REGEXP = /[-.]/;
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
/**
 * Serializes inputs and outputs for `defineDirective` and `defineComponent`.
 *
 * This will attempt to generate optimized data structures to minimize memory or
 * file size of fully compiled applications.
 */
export function conditionallyCreateDirectiveBindingLiteral(map, forInputs) {
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
            const differentDeclaringName = publicName !== declaredName;
            const hasTransform = value.transformFunction !== null;
            // Build up input flags
            let flags = null;
            if (value.isSignal) {
                flags = bitwiseAndInputFlagsExpr(InputFlags.SignalBased, flags);
            }
            if (value.transformFunction !== null) {
                flags = bitwiseAndInputFlagsExpr(InputFlags.HasTransform, flags);
            }
            // Inputs, compared to outputs, will track their declared name (for `ngOnChanges`), or support
            // transform functions, or store flag information if there is any.
            if (forInputs && (differentDeclaringName || hasTransform || flags !== null)) {
                const flagsExpr = flags ?? o.importExpr(R3.InputFlags).prop(InputFlags[InputFlags.None]);
                const result = [flagsExpr, asLiteral(publicName)];
                if (differentDeclaringName || hasTransform) {
                    result.push(asLiteral(declaredName));
                    if (hasTransform) {
                        result.push(value.transformFunction);
                    }
                }
                expressionValue = o.literalArr(result);
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
/** Gets an output AST expression referencing the given flag. */
function getInputFlagExpr(flag) {
    return o.importExpr(R3.InputFlags).prop(InputFlags[flag]);
}
/** Combines a given input flag with an existing flag expression, if present. */
function bitwiseAndInputFlagsExpr(flag, expr) {
    if (expr === null) {
        return getInputFlagExpr(flag);
    }
    return new o.BinaryOperatorExpr(o.BinaryOperator.BitwiseAnd, expr, getInputFlagExpr(flag));
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
 * Creates a `CssSelector` from an AST node.
 */
export function createCssSelectorFromNode(node) {
    const elementName = node instanceof t.Element ? node.name : 'ng-template';
    const attributes = getAttrsForDirectiveMatching(node);
    const cssSelector = new CssSelector();
    const elementNameNoNs = splitNsName(elementName)[1];
    cssSelector.setElement(elementNameNoNs);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const nameNoNs = splitNsName(name)[1];
        const value = attributes[name];
        cssSelector.addAttribute(nameNoNs, value);
        if (name.toLowerCase() === 'class') {
            const classes = value.trim().split(/\s+/);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    });
    return cssSelector;
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
function getAttrsForDirectiveMatching(elOrTpl) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBRXRDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLFdBQVcsQ0FBQztBQUMvQixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBSXBELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFHNUM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQztBQUVwRCx1REFBdUQ7QUFDdkQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUVuQyxvRUFBb0U7QUFDcEUsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUVsQyw2REFBNkQ7QUFDN0QsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQztBQUVqQyxxQ0FBcUM7QUFDckMsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0FBRXJDLGlEQUFpRDtBQUNqRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxXQUFXLENBQUM7QUFFOUMsbUNBQW1DO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztBQUVqRCxzRkFBc0Y7QUFDdEYsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsYUFBYSxD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LE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMvRSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQzFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFFRCx5RUFBeUU7SUFDekUsc0VBQXNFO0lBQ3RFLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDL0IsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7SW5wdXRGbGFnc30gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0JpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge0ZvcndhcmRSZWZIYW5kbGluZ30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2lzSTE4bkF0dHJpYnV0ZX0gZnJvbSAnLi9pMThuL3V0aWwnO1xuXG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgYW4gb2JqZWN0IGtleSBjb250YWlucyBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMsIHRodXMgdGhlIGtleSBzaG91bGQgYmUgd3JhcHBlZCBpblxuICogcXVvdGVzLiBOb3RlOiB3ZSBkbyBub3Qgd3JhcCBhbGwga2V5cyBpbnRvIHF1b3RlcywgYXMgaXQgbWF5IGhhdmUgaW1wYWN0IG9uIG1pbmlmaWNhdGlvbiBhbmQgbWF5XG4gKiBub3Qgd29yayBpbiBzb21lIGNhc2VzIHdoZW4gb2JqZWN0IGtleXMgYXJlIG1hbmdsZWQgYnkgYSBtaW5pZmllci5cbiAqXG4gKiBUT0RPKEZXLTExMzYpOiB0aGlzIGlzIGEgdGVtcG9yYXJ5IHNvbHV0aW9uLCB3ZSBuZWVkIHRvIGNvbWUgdXAgd2l0aCBhIGJldHRlciB3YXkgb2Ygd29ya2luZyB3aXRoXG4gKiBpbnB1dHMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycy5cbiAqL1xuZXhwb3J0IGNvbnN0IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQID0gL1stLl0vO1xuXG4vKiogTmFtZSBvZiB0aGUgdGVtcG9yYXJ5IHRvIHVzZSBkdXJpbmcgZGF0YSBiaW5kaW5nICovXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX05BTUUgPSAnX3QnO1xuXG4vKiogTmFtZSBvZiB0aGUgY29udGV4dCBwYXJhbWV0ZXIgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfTkFNRSA9ICdjdHgnO1xuXG4vKiogTmFtZSBvZiB0aGUgUmVuZGVyRmxhZyBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgUkVOREVSX0ZMQUdTID0gJ3JmJztcblxuLyoqIFRoZSBwcmVmaXggcmVmZXJlbmNlIHZhcmlhYmxlcyAqL1xuZXhwb3J0IGNvbnN0IFJFRkVSRU5DRV9QUkVGSVggPSAnX3InO1xuXG4vKiogVGhlIG5hbWUgb2YgdGhlIGltcGxpY2l0IGNvbnRleHQgcmVmZXJlbmNlICovXG5leHBvcnQgY29uc3QgSU1QTElDSVRfUkVGRVJFTkNFID0gJyRpbXBsaWNpdCc7XG5cbi8qKiBOb24gYmluZGFibGUgYXR0cmlidXRlIG5hbWUgKiovXG5leHBvcnQgY29uc3QgTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5cbi8qKiBOYW1lIGZvciB0aGUgdmFyaWFibGUga2VlcGluZyB0cmFjayBvZiB0aGUgY29udGV4dCByZXR1cm5lZCBieSBgybXJtXJlc3RvcmVWaWV3YC4gKi9cbmV4cG9ydCBjb25zdCBSRVNUT1JFRF9WSUVXX0NPTlRFWFRfTkFNRSA9ICdyZXN0b3JlZEN0eCc7XG5cbi8qKiBTcGVjaWFsIHZhbHVlIHJlcHJlc2VudGluZyBhIGRpcmVjdCBhY2Nlc3MgdG8gYSB0ZW1wbGF0ZSdzIGNvbnRleHQuICovXG5leHBvcnQgY29uc3QgRElSRUNUX0NPTlRFWFRfUkVGRVJFTkNFID0gJyNjb250ZXh0JztcblxuLyoqXG4gKiBNYXhpbXVtIGxlbmd0aCBvZiBhIHNpbmdsZSBpbnN0cnVjdGlvbiBjaGFpbi4gQmVjYXVzZSBvdXIgb3V0cHV0IEFTVCB1c2VzIHJlY3Vyc2lvbiwgd2UncmVcbiAqIGxpbWl0ZWQgaW4gaG93IG1hbnkgZXhwcmVzc2lvbnMgd2UgY2FuIG5lc3QgYmVmb3JlIHdlIHJlYWNoIHRoZSBjYWxsIHN0YWNrIGxpbWl0LiBUaGlzXG4gKiBsZW5ndGggaXMgc2V0IHZlcnkgY29uc2VydmF0aXZlbHkgaW4gb3JkZXIgdG8gcmVkdWNlIHRoZSBjaGFuY2Ugb2YgcHJvYmxlbXMuXG4gKi9cbmNvbnN0IE1BWF9DSEFJTl9MRU5HVEggPSA1MDA7XG5cbi8qKiBJbnN0cnVjdGlvbnMgdGhhdCBzdXBwb3J0IGNoYWluaW5nLiAqL1xuY29uc3QgQ0hBSU5BQkxFX0lOU1RSVUNUSU9OUyA9IG5ldyBTZXQoW1xuICBSMy5lbGVtZW50LFxuICBSMy5lbGVtZW50U3RhcnQsXG4gIFIzLmVsZW1lbnRFbmQsXG4gIFIzLmVsZW1lbnRDb250YWluZXIsXG4gIFIzLmVsZW1lbnRDb250YWluZXJTdGFydCxcbiAgUjMuZWxlbWVudENvbnRhaW5lckVuZCxcbiAgUjMuaTE4bkV4cCxcbiAgUjMubGlzdGVuZXIsXG4gIFIzLmNsYXNzUHJvcCxcbiAgUjMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICBSMy5ob3N0UHJvcGVydHksXG4gIFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSxcbiAgUjMucHJvcGVydHksXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMixcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTMsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTYsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlOCxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIFIzLmF0dHJpYnV0ZSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTIsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTUsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTgsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVixcbiAgUjMuc3R5bGVQcm9wLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUzLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlOCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBSMy50ZXh0SW50ZXJwb2xhdGUsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTEsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTIsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTMsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTQsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTUsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTYsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTcsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZTgsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZVYsXG4gIFIzLnRlbXBsYXRlQ3JlYXRlLFxuXSk7XG5cbi8qKlxuICogUG9zc2libGUgdHlwZXMgdGhhdCBjYW4gYmUgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcGFyYW1ldGVycyBvZiBhbiBpbnN0cnVjdGlvbiBjYWxsLlxuICogSWYgdGhlIHBhcmFtZXRlcnMgYXJlIGEgZnVuY3Rpb24sIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGludm9rZWQgYXQgdGhlIHRpbWUgdGhlIGluc3RydWN0aW9uXG4gKiBpcyBnZW5lcmF0ZWQuXG4gKi9cbmV4cG9ydCB0eXBlIEluc3RydWN0aW9uUGFyYW1zID0gKG8uRXhwcmVzc2lvbnxvLkV4cHJlc3Npb25bXSl8KCgpID0+IChvLkV4cHJlc3Npb258by5FeHByZXNzaW9uW10pKTtcblxuLyoqIE5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBhIGNhbGwgdG8gYW4gaW5zdHJ1Y3Rpb24gZnVuY3Rpb24uICovXG5leHBvcnQgaW50ZXJmYWNlIEluc3RydWN0aW9uIHtcbiAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZTtcbiAgcGFyYW1zT3JGbj86IEluc3RydWN0aW9uUGFyYW1zO1xufVxuXG4vKiogR2VuZXJhdGVzIGEgY2FsbCB0byBhIHNpbmdsZSBpbnN0cnVjdGlvbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnZva2VJbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhbGxvY2F0b3IgZm9yIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICpcbiAqIEEgdmFyaWFibGUgZGVjbGFyYXRpb24gaXMgYWRkZWQgdG8gdGhlIHN0YXRlbWVudHMgdGhlIGZpcnN0IHRpbWUgdGhlIGFsbG9jYXRvciBpcyBpbnZva2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIG5hbWU6IHN0cmluZyk6ICgpID0+IG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5EZWNsYXJlVmFyU3RtdChURU1QT1JBUllfTkFNRSwgdW5kZWZpbmVkLCBvLkRZTkFNSUNfVFlQRSkpO1xuICAgICAgdGVtcCA9IG8udmFyaWFibGUobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wO1xuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnZhbGlkPFQ+KHRoaXM6IHQuVmlzaXRvciwgYXJnOiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnR8dC5Ob2RlKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBzdGF0ZTogVmlzaXRvciAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gZG9lc24ndCBoYW5kbGUgJHthcmcuY29uc3RydWN0b3IubmFtZX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzTGl0ZXJhbCh2YWx1ZTogYW55KTogby5FeHByZXNzaW9uIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZS5tYXAoYXNMaXRlcmFsKSk7XG4gIH1cbiAgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgby5JTkZFUlJFRF9UWVBFKTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIGlucHV0cyBhbmQgb3V0cHV0cyBmb3IgYGRlZmluZURpcmVjdGl2ZWAgYW5kIGBkZWZpbmVDb21wb25lbnRgLlxuICpcbiAqIFRoaXMgd2lsbCBhdHRlbXB0IHRvIGdlbmVyYXRlIG9wdGltaXplZCBkYXRhIHN0cnVjdHVyZXMgdG8gbWluaW1pemUgbWVtb3J5IG9yXG4gKiBmaWxlIHNpemUgb2YgZnVsbHkgY29tcGlsZWQgYXBwbGljYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKFxuICAgIG1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nfHtcbiAgICAgIGNsYXNzUHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gICAgICBiaW5kaW5nUHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gICAgICB0cmFuc2Zvcm1GdW5jdGlvbjogby5FeHByZXNzaW9ufG51bGw7XG4gICAgICBpc1NpZ25hbDogYm9vbGVhbixcbiAgICB9PiwgZm9ySW5wdXRzPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG1hcCk7XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBtYXBba2V5XTtcbiAgICBsZXQgZGVjbGFyZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IHB1YmxpY05hbWU6IHN0cmluZztcbiAgICBsZXQgbWluaWZpZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IGV4cHJlc3Npb25WYWx1ZTogby5FeHByZXNzaW9uO1xuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIGNhbm9uaWNhbCBzeW50YXg6IGBkaXJQcm9wOiBwdWJsaWNQcm9wYFxuICAgICAgZGVjbGFyZWROYW1lID0ga2V5O1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgICAgcHVibGljTmFtZSA9IHZhbHVlO1xuICAgICAgZXhwcmVzc2lvblZhbHVlID0gYXNMaXRlcmFsKHB1YmxpY05hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW5pZmllZE5hbWUgPSBrZXk7XG4gICAgICBkZWNsYXJlZE5hbWUgPSB2YWx1ZS5jbGFzc1Byb3BlcnR5TmFtZTtcbiAgICAgIHB1YmxpY05hbWUgPSB2YWx1ZS5iaW5kaW5nUHJvcGVydHlOYW1lO1xuXG4gICAgICBjb25zdCBkaWZmZXJlbnREZWNsYXJpbmdOYW1lID0gcHVibGljTmFtZSAhPT0gZGVjbGFyZWROYW1lO1xuICAgICAgY29uc3QgaGFzVHJhbnNmb3JtID0gdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGw7XG5cbiAgICAgIC8vIEJ1aWxkIHVwIGlucHV0IGZsYWdzXG4gICAgICBsZXQgZmxhZ3M6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICAgIGlmICh2YWx1ZS5pc1NpZ25hbCkge1xuICAgICAgICBmbGFncyA9IGJpdHdpc2VBbmRJbnB1dEZsYWdzRXhwcihJbnB1dEZsYWdzLlNpZ25hbEJhc2VkLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGwpIHtcbiAgICAgICAgZmxhZ3MgPSBiaXR3aXNlQW5kSW5wdXRGbGFnc0V4cHIoSW5wdXRGbGFncy5IYXNUcmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5wdXRzLCBjb21wYXJlZCB0byBvdXRwdXRzLCB3aWxsIHRyYWNrIHRoZWlyIGRlY2xhcmVkIG5hbWUgKGZvciBgbmdPbkNoYW5nZXNgKSwgb3Igc3VwcG9ydFxuICAgICAgLy8gdHJhbnNmb3JtIGZ1bmN0aW9ucywgb3Igc3RvcmUgZmxhZyBpbmZvcm1hdGlvbiBpZiB0aGVyZSBpcyBhbnkuXG4gICAgICBpZiAoZm9ySW5wdXRzICYmIChkaWZmZXJlbnREZWNsYXJpbmdOYW1lIHx8IGhhc1RyYW5zZm9ybSB8fCBmbGFncyAhPT0gbnVsbCkpIHtcbiAgICAgICAgY29uc3QgZmxhZ3NFeHByID0gZmxhZ3MgPz8gby5pbXBvcnRFeHByKFIzLklucHV0RmxhZ3MpLnByb3AoSW5wdXRGbGFnc1tJbnB1dEZsYWdzLk5vbmVdKTtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBvLkV4cHJlc3Npb25bXSA9IFtmbGFnc0V4cHIsIGFzTGl0ZXJhbChwdWJsaWNOYW1lKV07XG5cbiAgICAgICAgaWYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzVHJhbnNmb3JtKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSkpO1xuXG4gICAgICAgICAgaWYgKGhhc1RyYW5zZm9ybSkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUudHJhbnNmb3JtRnVuY3Rpb24hKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHByZXNzaW9uVmFsdWUgPSBvLmxpdGVyYWxBcnIocmVzdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAga2V5OiBtaW5pZmllZE5hbWUsXG4gICAgICAvLyBwdXQgcXVvdGVzIGFyb3VuZCBrZXlzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcmFjdGVyc1xuICAgICAgcXVvdGVkOiBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUC50ZXN0KG1pbmlmaWVkTmFtZSksXG4gICAgICB2YWx1ZTogZXhwcmVzc2lvblZhbHVlLFxuICAgIH07XG4gIH0pKTtcbn1cblxuLyoqIEdldHMgYW4gb3V0cHV0IEFTVCBleHByZXNzaW9uIHJlZmVyZW5jaW5nIHRoZSBnaXZlbiBmbGFnLiAqL1xuZnVuY3Rpb24gZ2V0SW5wdXRGbGFnRXhwcihmbGFnOiBJbnB1dEZsYWdzKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5JbnB1dEZsYWdzKS5wcm9wKElucHV0RmxhZ3NbZmxhZ10pO1xufVxuXG4vKiogQ29tYmluZXMgYSBnaXZlbiBpbnB1dCBmbGFnIHdpdGggYW4gZXhpc3RpbmcgZmxhZyBleHByZXNzaW9uLCBpZiBwcmVzZW50LiAqL1xuZnVuY3Rpb24gYml0d2lzZUFuZElucHV0RmxhZ3NFeHByKGZsYWc6IElucHV0RmxhZ3MsIGV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGV4cHIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZ2V0SW5wdXRGbGFnRXhwcihmbGFnKTtcbiAgfVxuICByZXR1cm4gbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgby5CaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kLFxuICAgICAgZXhwcixcbiAgICAgIGdldElucHV0RmxhZ0V4cHIoZmxhZyksXG4gICk7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlQcmVkaWNhdGUoXG4gICAgcXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpKSB7XG4gICAgbGV0IHByZWRpY2F0ZTogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBxdWVyeS5wcmVkaWNhdGUuZm9yRWFjaCgoc2VsZWN0b3I6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgLy8gRWFjaCBpdGVtIGluIHByZWRpY2F0ZXMgYXJyYXkgbWF5IGNvbnRhaW4gc3RyaW5ncyB3aXRoIGNvbW1hLXNlcGFyYXRlZCByZWZzXG4gICAgICAvLyAoZm9yIGV4LiAncmVmLCByZWYxLCAuLi4sIHJlZk4nKSwgdGh1cyB3ZSBleHRyYWN0IGluZGl2aWR1YWwgcmVmcyBhbmQgc3RvcmUgdGhlbVxuICAgICAgLy8gYXMgc2VwYXJhdGUgYXJyYXkgZW50aXRpZXNcbiAgICAgIGNvbnN0IHNlbGVjdG9ycyA9IHNlbGVjdG9yLnNwbGl0KCcsJykubWFwKHRva2VuID0+IG8ubGl0ZXJhbCh0b2tlbi50cmltKCkpKTtcbiAgICAgIHByZWRpY2F0ZS5wdXNoKC4uLnNlbGVjdG9ycyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHByZWRpY2F0ZSksIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoZSBvcmlnaW5hbCBwcmVkaWNhdGUgbWF5IGhhdmUgYmVlbiB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbC5cbiAgICBzd2l0Y2ggKHF1ZXJ5LnByZWRpY2F0ZS5mb3J3YXJkUmVmKSB7XG4gICAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lOlxuICAgICAgY2FzZSBGb3J3YXJkUmVmSGFuZGxpbmcuVW53cmFwcGVkOlxuICAgICAgICByZXR1cm4gcXVlcnkucHJlZGljYXRlLmV4cHJlc3Npb247XG4gICAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5XcmFwcGVkOlxuICAgICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnJlc29sdmVGb3J3YXJkUmVmKS5jYWxsRm4oW3F1ZXJ5LnByZWRpY2F0ZS5leHByZXNzaW9uXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQSByZXByZXNlbnRhdGlvbiBmb3IgYW4gb2JqZWN0IGxpdGVyYWwgdXNlZCBkdXJpbmcgY29kZWdlbiBvZiBkZWZpbml0aW9uIG9iamVjdHMuIFRoZSBnZW5lcmljXG4gKiB0eXBlIGBUYCBhbGxvd3MgdG8gcmVmZXJlbmNlIGEgZG9jdW1lbnRlZCB0eXBlIG9mIHRoZSBnZW5lcmF0ZWQgc3RydWN0dXJlLCBzdWNoIHRoYXQgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGFyZSBzZXQgY2FuIGJlIHJlc29sdmVkIHRvIHRoZWlyIGRvY3VtZW50ZWQgZGVjbGFyYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWZpbml0aW9uTWFwPFQgPSBhbnk+IHtcbiAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IG8uRXhwcmVzc2lvbn1bXSA9IFtdO1xuXG4gIHNldChrZXk6IGtleW9mIFQsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnZhbHVlcy5maW5kKHZhbHVlID0+IHZhbHVlLmtleSA9PT0ga2V5KTtcblxuICAgICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICAgIGV4aXN0aW5nLnZhbHVlID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnZhbHVlcy5wdXNoKHtrZXk6IGtleSBhcyBzdHJpbmcsIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9MaXRlcmFsTWFwKCk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICAgIHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZnJvbSBhbiBBU1Qgbm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yRnJvbU5vZGUobm9kZTogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGVsZW1lbnROYW1lID0gbm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IG5vZGUubmFtZSA6ICduZy10ZW1wbGF0ZSc7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpO1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICBjb25zdCBlbGVtZW50TmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbGVtZW50TmFtZU5vTnMpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCBuYW1lTm9OcyA9IHNwbGl0TnNOYW1lKG5hbWUpWzFdO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lTm9OcywgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgYSBtYXAgb2YgcHJvcGVydGllcyB0byB2YWx1ZXMgZm9yIGEgZ2l2ZW4gZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLCB3aGljaCBjYW4gYmUgdXNlZFxuICogYnkgdGhlIGRpcmVjdGl2ZSBtYXRjaGluZyBtYWNoaW5lcnkuXG4gKlxuICogQHBhcmFtIGVsT3JUcGwgdGhlIGVsZW1lbnQgb3IgdGVtcGxhdGUgaW4gcXVlc3Rpb25cbiAqIEByZXR1cm4gYW4gb2JqZWN0IHNldCB1cCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLiBGb3IgYXR0cmlidXRlcyBvbiB0aGUgZWxlbWVudC90ZW1wbGF0ZSwgdGhpc1xuICogb2JqZWN0IG1hcHMgYSBwcm9wZXJ0eSBuYW1lIHRvIGl0cyAoc3RhdGljKSB2YWx1ZS4gRm9yIGFueSBiaW5kaW5ncywgdGhpcyBtYXAgc2ltcGx5IG1hcHMgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lIHRvIGFuIGVtcHR5IHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSB7XG4gIGNvbnN0IGF0dHJpYnV0ZXNNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG5cbiAgaWYgKGVsT3JUcGwgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGVsT3JUcGwudGFnTmFtZSAhPT0gJ25nLXRlbXBsYXRlJykge1xuICAgIGVsT3JUcGwudGVtcGxhdGVBdHRycy5mb3JFYWNoKGEgPT4gYXR0cmlidXRlc01hcFthLm5hbWVdID0gJycpO1xuICB9IGVsc2Uge1xuICAgIGVsT3JUcGwuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgaWYgKCFpc0kxOG5BdHRyaWJ1dGUoYS5uYW1lKSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZWxPclRwbC5pbnB1dHMuZm9yRWFjaChpID0+IHtcbiAgICAgIGlmIChpLnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGVsT3JUcGwub3V0cHV0cy5mb3JFYWNoKG8gPT4ge1xuICAgICAgYXR0cmlidXRlc01hcFtvLm5hbWVdID0gJyc7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIGV4cGVjdGVkIHRvIGJlIHBhc3NlZCB0byBhIGdlbmVyYXRlZCBpbnN0cnVjdGlvbiBpbiB0aGUgY2FzZSBvZlxuICogaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbnMuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBpbnRlcnBvbGF0aW9uIGFzdFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBjb25zdCB7ZXhwcmVzc2lvbnMsIHN0cmluZ3N9ID0gaW50ZXJwb2xhdGlvbjtcbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzLmxlbmd0aCA9PT0gMiAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIC8vIElmIHRoZSBpbnRlcnBvbGF0aW9uIGhhcyBvbmUgaW50ZXJwb2xhdGVkIHZhbHVlLCBidXQgdGhlIHByZWZpeCBhbmQgc3VmZml4IGFyZSBib3RoIGVtcHR5XG4gICAgLy8gc3RyaW5ncywgd2Ugb25seSBwYXNzIG9uZSBhcmd1bWVudCwgdG8gYSBzcGVjaWFsIGluc3RydWN0aW9uIGxpa2UgYHByb3BlcnR5SW50ZXJwb2xhdGVgIG9yXG4gICAgLy8gYHRleHRJbnRlcnBvbGF0ZWAuXG4gICAgcmV0dXJuIDE7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25zLmxlbmd0aCArIHN0cmluZ3MubGVuZ3RoO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIHRoZSBmaW5hbCBpbnN0cnVjdGlvbiBjYWxsIHN0YXRlbWVudHMgYmFzZWQgb24gdGhlIHBhc3NlZCBpbiBjb25maWd1cmF0aW9uLlxuICogV2lsbCB0cnkgdG8gY2hhaW4gaW5zdHJ1Y3Rpb25zIGFzIG11Y2ggYXMgcG9zc2libGUsIGlmIGNoYWluaW5nIGlzIHN1cHBvcnRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RydWN0aW9uU3RhdGVtZW50cyhpbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBsZXQgcGVuZGluZ0V4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgbGV0IHBlbmRpbmdFeHByZXNzaW9uVHlwZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsID0gbnVsbDtcbiAgbGV0IGNoYWluTGVuZ3RoID0gMDtcblxuICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgaW5zdHJ1Y3Rpb25zKSB7XG4gICAgY29uc3QgcmVzb2x2ZWRQYXJhbXMgPVxuICAgICAgICAodHlwZW9mIGN1cnJlbnQucGFyYW1zT3JGbiA9PT0gJ2Z1bmN0aW9uJyA/IGN1cnJlbnQucGFyYW1zT3JGbigpIDogY3VycmVudC5wYXJhbXNPckZuKSA/P1xuICAgICAgICBbXTtcbiAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHJlc29sdmVkUGFyYW1zKSA/IHJlc29sdmVkUGFyYW1zIDogW3Jlc29sdmVkUGFyYW1zXTtcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IGluc3RydWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBwcmV2aW91cyBvbmVcbiAgICAvLyBhbmQgaXQgY2FuIGJlIGNoYWluZWQsIGFkZCBhbm90aGVyIGNhbGwgdG8gdGhlIGNoYWluLlxuICAgIGlmIChjaGFpbkxlbmd0aCA8IE1BWF9DSEFJTl9MRU5HVEggJiYgcGVuZGluZ0V4cHJlc3Npb25UeXBlID09PSBjdXJyZW50LnJlZmVyZW5jZSAmJlxuICAgICAgICBDSEFJTkFCTEVfSU5TVFJVQ1RJT05TLmhhcyhwZW5kaW5nRXhwcmVzc2lvblR5cGUpKSB7XG4gICAgICAvLyBXZSdsbCBhbHdheXMgaGF2ZSBhIHBlbmRpbmcgZXhwcmVzc2lvbiB3aGVuIHRoZXJlJ3MgYSBwZW5kaW5nIGV4cHJlc3Npb24gdHlwZS5cbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uID0gcGVuZGluZ0V4cHJlc3Npb24hLmNhbGxGbihwYXJhbXMsIHBlbmRpbmdFeHByZXNzaW9uIS5zb3VyY2VTcGFuKTtcbiAgICAgIGNoYWluTGVuZ3RoKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZW5kaW5nRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgICAgICBzdGF0ZW1lbnRzLnB1c2gocGVuZGluZ0V4cHJlc3Npb24udG9TdG10KCkpO1xuICAgICAgfVxuICAgICAgcGVuZGluZ0V4cHJlc3Npb24gPSBpbnZva2VJbnN0cnVjdGlvbihjdXJyZW50LnNwYW4sIGN1cnJlbnQucmVmZXJlbmNlLCBwYXJhbXMpO1xuICAgICAgcGVuZGluZ0V4cHJlc3Npb25UeXBlID0gY3VycmVudC5yZWZlcmVuY2U7XG4gICAgICBjaGFpbkxlbmd0aCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLy8gU2luY2UgdGhlIGN1cnJlbnQgaW5zdHJ1Y3Rpb24gYWRkcyB0aGUgcHJldmlvdXMgb25lIHRvIHRoZSBzdGF0ZW1lbnRzLFxuICAvLyB3ZSBtYXkgYmUgbGVmdCB3aXRoIHRoZSBmaW5hbCBvbmUgYXQgdGhlIGVuZCB0aGF0IGlzIHN0aWxsIHBlbmRpbmcuXG4gIGlmIChwZW5kaW5nRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgIHN0YXRlbWVudHMucHVzaChwZW5kaW5nRXhwcmVzc2lvbi50b1N0bXQoKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cbiJdfQ==