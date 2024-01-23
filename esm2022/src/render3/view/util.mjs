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
            const hasDecoratorInputTransform = value.transformFunction !== null;
            // Build up input flags
            let flags = null;
            if (value.isSignal) {
                flags = bitwiseOrInputFlagsExpr(InputFlags.SignalBased, flags);
            }
            if (hasDecoratorInputTransform) {
                flags = bitwiseOrInputFlagsExpr(InputFlags.HasDecoratorInputTransform, flags);
            }
            // Inputs, compared to outputs, will track their declared name (for `ngOnChanges`), support
            // decorator input transform functions, or store flag information if there is any.
            if (forInputs && (differentDeclaringName || hasDecoratorInputTransform || flags !== null)) {
                const flagsExpr = flags ?? o.importExpr(R3.InputFlags).prop(InputFlags[InputFlags.None]);
                const result = [flagsExpr, asLiteral(publicName)];
                if (differentDeclaringName || hasDecoratorInputTransform) {
                    result.push(asLiteral(declaredName));
                    if (hasDecoratorInputTransform) {
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
function bitwiseOrInputFlagsExpr(flag, expr) {
    if (expr === null) {
        return getInputFlagExpr(flag);
    }
    return getInputFlagExpr(flag).bitwiseOr(expr);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBRXRDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLFdBQVcsQ0FBQztBQUMvQixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFHNUM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQztBQUVwRCx1REFBdUQ7QUFDdkQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUVuQyxvRUFBb0U7QUFDcEUsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUVsQyw2REFBNkQ7QUFDN0QsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQztBQUVqQyxxQ0FBcUM7QUFDckMsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0FBRXJDLGlEQUFpRDtBQUNqRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxXQUFXLENBQUM7QUFFOUMsbUNBQW1DO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztBQUVqRCxzRkFBc0Y7QUFDdEYsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsYUFBYSxD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QztZQUNELGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMvRSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQzFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFFRCx5RUFBeUU7SUFDekUsc0VBQXNFO0lBQ3RFLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDL0IsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SW5wdXRGbGFnc30gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0JpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7aXNJMThuQXR0cmlidXRlfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhbiBvYmplY3Qga2V5IGNvbnRhaW5zIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycywgdGh1cyB0aGUga2V5IHNob3VsZCBiZSB3cmFwcGVkIGluXG4gKiBxdW90ZXMuIE5vdGU6IHdlIGRvIG5vdCB3cmFwIGFsbCBrZXlzIGludG8gcXVvdGVzLCBhcyBpdCBtYXkgaGF2ZSBpbXBhY3Qgb24gbWluaWZpY2F0aW9uIGFuZCBtYXlcbiAqIG5vdCB3b3JrIGluIHNvbWUgY2FzZXMgd2hlbiBvYmplY3Qga2V5cyBhcmUgbWFuZ2xlZCBieSBhIG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5leHBvcnQgY29uc3QgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAgPSAvWy0uXS87XG5cbi8qKiBOYW1lIG9mIHRoZSB0ZW1wb3JhcnkgdG8gdXNlIGR1cmluZyBkYXRhIGJpbmRpbmcgKi9cbmV4cG9ydCBjb25zdCBURU1QT1JBUllfTkFNRSA9ICdfdCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBjb250ZXh0IHBhcmFtZXRlciBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgQ09OVEVYVF9OQU1FID0gJ2N0eCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBSZW5kZXJGbGFnIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJfRkxBR1MgPSAncmYnO1xuXG4vKiogVGhlIHByZWZpeCByZWZlcmVuY2UgdmFyaWFibGVzICovXG5leHBvcnQgY29uc3QgUkVGRVJFTkNFX1BSRUZJWCA9ICdfcic7XG5cbi8qKiBUaGUgbmFtZSBvZiB0aGUgaW1wbGljaXQgY29udGV4dCByZWZlcmVuY2UgKi9cbmV4cG9ydCBjb25zdCBJTVBMSUNJVF9SRUZFUkVOQ0UgPSAnJGltcGxpY2l0JztcblxuLyoqIE5vbiBiaW5kYWJsZSBhdHRyaWJ1dGUgbmFtZSAqKi9cbmV4cG9ydCBjb25zdCBOT05fQklOREFCTEVfQVRUUiA9ICduZ05vbkJpbmRhYmxlJztcblxuLyoqIE5hbWUgZm9yIHRoZSB2YXJpYWJsZSBrZWVwaW5nIHRyYWNrIG9mIHRoZSBjb250ZXh0IHJldHVybmVkIGJ5IGDJtcm1cmVzdG9yZVZpZXdgLiAqL1xuZXhwb3J0IGNvbnN0IFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FID0gJ3Jlc3RvcmVkQ3R4JztcblxuLyoqIFNwZWNpYWwgdmFsdWUgcmVwcmVzZW50aW5nIGEgZGlyZWN0IGFjY2VzcyB0byBhIHRlbXBsYXRlJ3MgY29udGV4dC4gKi9cbmV4cG9ydCBjb25zdCBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0UgPSAnI2NvbnRleHQnO1xuXG4vKipcbiAqIE1heGltdW0gbGVuZ3RoIG9mIGEgc2luZ2xlIGluc3RydWN0aW9uIGNoYWluLiBCZWNhdXNlIG91ciBvdXRwdXQgQVNUIHVzZXMgcmVjdXJzaW9uLCB3ZSdyZVxuICogbGltaXRlZCBpbiBob3cgbWFueSBleHByZXNzaW9ucyB3ZSBjYW4gbmVzdCBiZWZvcmUgd2UgcmVhY2ggdGhlIGNhbGwgc3RhY2sgbGltaXQuIFRoaXNcbiAqIGxlbmd0aCBpcyBzZXQgdmVyeSBjb25zZXJ2YXRpdmVseSBpbiBvcmRlciB0byByZWR1Y2UgdGhlIGNoYW5jZSBvZiBwcm9ibGVtcy5cbiAqL1xuY29uc3QgTUFYX0NIQUlOX0xFTkdUSCA9IDUwMDtcblxuLyoqIEluc3RydWN0aW9ucyB0aGF0IHN1cHBvcnQgY2hhaW5pbmcuICovXG5jb25zdCBDSEFJTkFCTEVfSU5TVFJVQ1RJT05TID0gbmV3IFNldChbXG4gIFIzLmVsZW1lbnQsXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudENvbnRhaW5lcixcbiAgUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0LFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5pMThuRXhwLFxuICBSMy5saXN0ZW5lcixcbiAgUjMuY2xhc3NQcm9wLFxuICBSMy5zeW50aGV0aWNIb3N0TGlzdGVuZXIsXG4gIFIzLmhvc3RQcm9wZXJ0eSxcbiAgUjMuc3ludGhldGljSG9zdFByb3BlcnR5LFxuICBSMy5wcm9wZXJ0eSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTEsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMyxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNixcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTcsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlVixcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMixcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlOCxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTMsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTYsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZVYsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZSxcbiAgUjMudGV4dEludGVycG9sYXRlMSxcbiAgUjMudGV4dEludGVycG9sYXRlMixcbiAgUjMudGV4dEludGVycG9sYXRlMyxcbiAgUjMudGV4dEludGVycG9sYXRlNCxcbiAgUjMudGV4dEludGVycG9sYXRlNSxcbiAgUjMudGV4dEludGVycG9sYXRlNixcbiAgUjMudGV4dEludGVycG9sYXRlNyxcbiAgUjMudGV4dEludGVycG9sYXRlOCxcbiAgUjMudGV4dEludGVycG9sYXRlVixcbiAgUjMudGVtcGxhdGVDcmVhdGUsXG5dKTtcblxuLyoqXG4gKiBQb3NzaWJsZSB0eXBlcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGdlbmVyYXRlIHRoZSBwYXJhbWV0ZXJzIG9mIGFuIGluc3RydWN0aW9uIGNhbGwuXG4gKiBJZiB0aGUgcGFyYW1ldGVycyBhcmUgYSBmdW5jdGlvbiwgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgaW52b2tlZCBhdCB0aGUgdGltZSB0aGUgaW5zdHJ1Y3Rpb25cbiAqIGlzIGdlbmVyYXRlZC5cbiAqL1xuZXhwb3J0IHR5cGUgSW5zdHJ1Y3Rpb25QYXJhbXMgPSAoby5FeHByZXNzaW9ufG8uRXhwcmVzc2lvbltdKXwoKCkgPT4gKG8uRXhwcmVzc2lvbnxvLkV4cHJlc3Npb25bXSkpO1xuXG4vKiogTmVjZXNzYXJ5IGluZm9ybWF0aW9uIHRvIGdlbmVyYXRlIGEgY2FsbCB0byBhbiBpbnN0cnVjdGlvbiBmdW5jdGlvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5zdHJ1Y3Rpb24ge1xuICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBwYXJhbXNPckZuPzogSW5zdHJ1Y3Rpb25QYXJhbXM7XG59XG5cbi8qKiBHZW5lcmF0ZXMgYSBjYWxsIHRvIGEgc2luZ2xlIGluc3RydWN0aW9uLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGludm9rZUluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFsbG9jYXRvciBmb3IgYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gKlxuICogQSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpcyBhZGRlZCB0byB0aGUgc3RhdGVtZW50cyB0aGUgZmlyc3QgdGltZSB0aGUgYWxsb2NhdG9yIGlzIGludm9rZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wb3JhcnlBbGxvY2F0b3Ioc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgbmFtZTogc3RyaW5nKTogKCkgPT4gby5SZWFkVmFyRXhwciB7XG4gIGxldCB0ZW1wOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGlmICghdGVtcCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkRlY2xhcmVWYXJTdG10KFRFTVBPUkFSWV9OQU1FLCB1bmRlZmluZWQsIG8uRFlOQU1JQ19UWVBFKSk7XG4gICAgICB0ZW1wID0gby52YXJpYWJsZShuYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXA7XG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4odGhpczogdC5WaXNpdG9yLCBhcmc6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHx0Lk5vZGUpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIHN0YXRlOiBWaXNpdG9yICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IGhhbmRsZSAke2FyZy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNMaXRlcmFsKHZhbHVlOiBhbnkpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlLm1hcChhc0xpdGVyYWwpKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsKHZhbHVlLCBvLklORkVSUkVEX1RZUEUpO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgaW5wdXRzIGFuZCBvdXRwdXRzIGZvciBgZGVmaW5lRGlyZWN0aXZlYCBhbmQgYGRlZmluZUNvbXBvbmVudGAuXG4gKlxuICogVGhpcyB3aWxsIGF0dGVtcHQgdG8gZ2VuZXJhdGUgb3B0aW1pemVkIGRhdGEgc3RydWN0dXJlcyB0byBtaW5pbWl6ZSBtZW1vcnkgb3JcbiAqIGZpbGUgc2l6ZSBvZiBmdWxseSBjb21waWxlZCBhcHBsaWNhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwoXG4gICAgbWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmd8e1xuICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBvLkV4cHJlc3Npb258bnVsbDtcbiAgICAgIGlzU2lnbmFsOiBib29sZWFuLFxuICAgIH0+LCBmb3JJbnB1dHM/OiBib29sZWFuKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWFwKTtcblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAoa2V5cy5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFtrZXldO1xuICAgIGxldCBkZWNsYXJlZE5hbWU6IHN0cmluZztcbiAgICBsZXQgcHVibGljTmFtZTogc3RyaW5nO1xuICAgIGxldCBtaW5pZmllZE5hbWU6IHN0cmluZztcbiAgICBsZXQgZXhwcmVzc2lvblZhbHVlOiBvLkV4cHJlc3Npb247XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gY2Fub25pY2FsIHN5bnRheDogYGRpclByb3A6IHB1YmxpY1Byb3BgXG4gICAgICBkZWNsYXJlZE5hbWUgPSBrZXk7XG4gICAgICBtaW5pZmllZE5hbWUgPSBrZXk7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWU7XG4gICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIGRlY2xhcmVkTmFtZSA9IHZhbHVlLmNsYXNzUHJvcGVydHlOYW1lO1xuICAgICAgcHVibGljTmFtZSA9IHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWU7XG5cbiAgICAgIGNvbnN0IGRpZmZlcmVudERlY2xhcmluZ05hbWUgPSBwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWU7XG4gICAgICBjb25zdCBoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSA9IHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsO1xuXG4gICAgICAvLyBCdWlsZCB1cCBpbnB1dCBmbGFnc1xuICAgICAgbGV0IGZsYWdzOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgICBpZiAodmFsdWUuaXNTaWduYWwpIHtcbiAgICAgICAgZmxhZ3MgPSBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihJbnB1dEZsYWdzLlNpZ25hbEJhc2VkLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBpZiAoaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgZmxhZ3MgPSBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihJbnB1dEZsYWdzLkhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIElucHV0cywgY29tcGFyZWQgdG8gb3V0cHV0cywgd2lsbCB0cmFjayB0aGVpciBkZWNsYXJlZCBuYW1lIChmb3IgYG5nT25DaGFuZ2VzYCksIHN1cHBvcnRcbiAgICAgIC8vIGRlY29yYXRvciBpbnB1dCB0cmFuc2Zvcm0gZnVuY3Rpb25zLCBvciBzdG9yZSBmbGFnIGluZm9ybWF0aW9uIGlmIHRoZXJlIGlzIGFueS5cbiAgICAgIGlmIChmb3JJbnB1dHMgJiYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0gfHwgZmxhZ3MgIT09IG51bGwpKSB7XG4gICAgICAgIGNvbnN0IGZsYWdzRXhwciA9IGZsYWdzID8/IG8uaW1wb3J0RXhwcihSMy5JbnB1dEZsYWdzKS5wcm9wKElucHV0RmxhZ3NbSW5wdXRGbGFncy5Ob25lXSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogby5FeHByZXNzaW9uW10gPSBbZmxhZ3NFeHByLCBhc0xpdGVyYWwocHVibGljTmFtZSldO1xuXG4gICAgICAgIGlmIChkaWZmZXJlbnREZWNsYXJpbmdOYW1lIHx8IGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goYXNMaXRlcmFsKGRlY2xhcmVkTmFtZSkpO1xuXG4gICAgICAgICAgaWYgKGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZS50cmFuc2Zvcm1GdW5jdGlvbiEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IG8ubGl0ZXJhbEFycihyZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gYXNMaXRlcmFsKHB1YmxpY05hbWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBrZXk6IG1pbmlmaWVkTmFtZSxcbiAgICAgIC8vIHB1dCBxdW90ZXMgYXJvdW5kIGtleXMgdGhhdCBjb250YWluIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFyYWN0ZXJzXG4gICAgICBxdW90ZWQ6IFVOU0FGRV9PQkpFQ1RfS0VZX05BTUVfUkVHRVhQLnRlc3QobWluaWZpZWROYW1lKSxcbiAgICAgIHZhbHVlOiBleHByZXNzaW9uVmFsdWUsXG4gICAgfTtcbiAgfSkpO1xufVxuXG4vKiogR2V0cyBhbiBvdXRwdXQgQVNUIGV4cHJlc3Npb24gcmVmZXJlbmNpbmcgdGhlIGdpdmVuIGZsYWcuICovXG5mdW5jdGlvbiBnZXRJbnB1dEZsYWdFeHByKGZsYWc6IElucHV0RmxhZ3MpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLklucHV0RmxhZ3MpLnByb3AoSW5wdXRGbGFnc1tmbGFnXSk7XG59XG5cbi8qKiBDb21iaW5lcyBhIGdpdmVuIGlucHV0IGZsYWcgd2l0aCBhbiBleGlzdGluZyBmbGFnIGV4cHJlc3Npb24sIGlmIHByZXNlbnQuICovXG5mdW5jdGlvbiBiaXR3aXNlT3JJbnB1dEZsYWdzRXhwcihmbGFnOiBJbnB1dEZsYWdzLCBleHByOiBvLkV4cHJlc3Npb258bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChleHByID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGdldElucHV0RmxhZ0V4cHIoZmxhZyk7XG4gIH1cbiAgcmV0dXJuIGdldElucHV0RmxhZ0V4cHIoZmxhZykuYml0d2lzZU9yKGV4cHIpO1xufVxuXG4vKipcbiAqICBSZW1vdmUgdHJhaWxpbmcgbnVsbCBub2RlcyBhcyB0aGV5IGFyZSBpbXBsaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIHdoaWxlIChvLmlzTnVsbChwYXJhbWV0ZXJzW3BhcmFtZXRlcnMubGVuZ3RoIC0gMV0pKSB7XG4gICAgcGFyYW1ldGVycy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuLyoqXG4gKiBBIHJlcHJlc2VudGF0aW9uIGZvciBhbiBvYmplY3QgbGl0ZXJhbCB1c2VkIGR1cmluZyBjb2RlZ2VuIG9mIGRlZmluaXRpb24gb2JqZWN0cy4gVGhlIGdlbmVyaWNcbiAqIHR5cGUgYFRgIGFsbG93cyB0byByZWZlcmVuY2UgYSBkb2N1bWVudGVkIHR5cGUgb2YgdGhlIGdlbmVyYXRlZCBzdHJ1Y3R1cmUsIHN1Y2ggdGhhdCB0aGVcbiAqIHByb3BlcnR5IG5hbWVzIHRoYXQgYXJlIHNldCBjYW4gYmUgcmVzb2x2ZWQgdG8gdGhlaXIgZG9jdW1lbnRlZCBkZWNsYXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIERlZmluaXRpb25NYXA8VCA9IGFueT4ge1xuICB2YWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgc2V0KGtleToga2V5b2YgVCwgdmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudmFsdWVzLmZpbmQodmFsdWUgPT4gdmFsdWUua2V5ID09PSBrZXkpO1xuXG4gICAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgICAgZXhpc3RpbmcudmFsdWUgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudmFsdWVzLnB1c2goe2tleToga2V5IGFzIHN0cmluZywgdmFsdWUsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0xpdGVyYWxNYXAoKTogby5MaXRlcmFsTWFwRXhwciB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbE1hcCh0aGlzLnZhbHVlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBmcm9tIGFuIEFTVCBub2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3JGcm9tTm9kZShub2RlOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgZWxlbWVudE5hbWUgPSBub2RlIGluc3RhbmNlb2YgdC5FbGVtZW50ID8gbm9kZS5uYW1lIDogJ25nLXRlbXBsYXRlJztcbiAgY29uc3QgYXR0cmlidXRlcyA9IGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcobm9kZSk7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsZW1lbnROYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsZW1lbnROYW1lTm9Ocyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IG5hbWVOb05zID0gc3BsaXROc05hbWUobmFtZSlbMV07XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWVOb05zLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8qKlxuICogRXh0cmFjdCBhIG1hcCBvZiBwcm9wZXJ0aWVzIHRvIHZhbHVlcyBmb3IgYSBnaXZlbiBlbGVtZW50IG9yIHRlbXBsYXRlIG5vZGUsIHdoaWNoIGNhbiBiZSB1c2VkXG4gKiBieSB0aGUgZGlyZWN0aXZlIG1hdGNoaW5nIG1hY2hpbmVyeS5cbiAqXG4gKiBAcGFyYW0gZWxPclRwbCB0aGUgZWxlbWVudCBvciB0ZW1wbGF0ZSBpbiBxdWVzdGlvblxuICogQHJldHVybiBhbiBvYmplY3Qgc2V0IHVwIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcuIEZvciBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50L3RlbXBsYXRlLCB0aGlzXG4gKiBvYmplY3QgbWFwcyBhIHByb3BlcnR5IG5hbWUgdG8gaXRzIChzdGF0aWMpIHZhbHVlLiBGb3IgYW55IGJpbmRpbmdzLCB0aGlzIG1hcCBzaW1wbHkgbWFwcyB0aGVcbiAqIHByb3BlcnR5IG5hbWUgdG8gYW4gZW1wdHkgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKToge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9IHtcbiAgY29uc3QgYXR0cmlidXRlc01hcDoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cblxuICBpZiAoZWxPclRwbCBpbnN0YW5jZW9mIHQuVGVtcGxhdGUgJiYgZWxPclRwbC50YWdOYW1lICE9PSAnbmctdGVtcGxhdGUnKSB7XG4gICAgZWxPclRwbC50ZW1wbGF0ZUF0dHJzLmZvckVhY2goYSA9PiBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSAnJyk7XG4gIH0gZWxzZSB7XG4gICAgZWxPclRwbC5hdHRyaWJ1dGVzLmZvckVhY2goYSA9PiB7XG4gICAgICBpZiAoIWlzSTE4bkF0dHJpYnV0ZShhLm5hbWUpKSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBlbE9yVHBsLmlucHV0cy5mb3JFYWNoKGkgPT4ge1xuICAgICAgaWYgKGkudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFtpLm5hbWVdID0gJyc7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7XG4gICAgICBhdHRyaWJ1dGVzTWFwW28ubmFtZV0gPSAnJztcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBhdHRyaWJ1dGVzTWFwO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIG51bWJlciBvZiBhcmd1bWVudHMgZXhwZWN0ZWQgdG8gYmUgcGFzc2VkIHRvIGEgZ2VuZXJhdGVkIGluc3RydWN0aW9uIGluIHRoZSBjYXNlIG9mXG4gKiBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9ucy5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIGludGVycG9sYXRpb24gYXN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIGNvbnN0IHtleHByZXNzaW9ucywgc3RyaW5nc30gPSBpbnRlcnBvbGF0aW9uO1xuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3MubGVuZ3RoID09PSAyICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgLy8gSWYgdGhlIGludGVycG9sYXRpb24gaGFzIG9uZSBpbnRlcnBvbGF0ZWQgdmFsdWUsIGJ1dCB0aGUgcHJlZml4IGFuZCBzdWZmaXggYXJlIGJvdGggZW1wdHlcbiAgICAvLyBzdHJpbmdzLCB3ZSBvbmx5IHBhc3Mgb25lIGFyZ3VtZW50LCB0byBhIHNwZWNpYWwgaW5zdHJ1Y3Rpb24gbGlrZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgb3JcbiAgICAvLyBgdGV4dEludGVycG9sYXRlYC5cbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbnMubGVuZ3RoICsgc3RyaW5ncy5sZW5ndGg7XG4gIH1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgdGhlIGZpbmFsIGluc3RydWN0aW9uIGNhbGwgc3RhdGVtZW50cyBiYXNlZCBvbiB0aGUgcGFzc2VkIGluIGNvbmZpZ3VyYXRpb24uXG4gKiBXaWxsIHRyeSB0byBjaGFpbiBpbnN0cnVjdGlvbnMgYXMgbXVjaCBhcyBwb3NzaWJsZSwgaWYgY2hhaW5pbmcgaXMgc3VwcG9ydGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSk6IG8uU3RhdGVtZW50W10ge1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGxldCBwZW5kaW5nRXhwcmVzc2lvbjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICBsZXQgcGVuZGluZ0V4cHJlc3Npb25UeXBlOiBvLkV4dGVybmFsUmVmZXJlbmNlfG51bGwgPSBudWxsO1xuICBsZXQgY2hhaW5MZW5ndGggPSAwO1xuXG4gIGZvciAoY29uc3QgY3VycmVudCBvZiBpbnN0cnVjdGlvbnMpIHtcbiAgICBjb25zdCByZXNvbHZlZFBhcmFtcyA9XG4gICAgICAgICh0eXBlb2YgY3VycmVudC5wYXJhbXNPckZuID09PSAnZnVuY3Rpb24nID8gY3VycmVudC5wYXJhbXNPckZuKCkgOiBjdXJyZW50LnBhcmFtc09yRm4pID8/XG4gICAgICAgIFtdO1xuICAgIGNvbnN0IHBhcmFtcyA9IEFycmF5LmlzQXJyYXkocmVzb2x2ZWRQYXJhbXMpID8gcmVzb2x2ZWRQYXJhbXMgOiBbcmVzb2x2ZWRQYXJhbXNdO1xuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgaW5zdHJ1Y3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIHByZXZpb3VzIG9uZVxuICAgIC8vIGFuZCBpdCBjYW4gYmUgY2hhaW5lZCwgYWRkIGFub3RoZXIgY2FsbCB0byB0aGUgY2hhaW4uXG4gICAgaWYgKGNoYWluTGVuZ3RoIDwgTUFYX0NIQUlOX0xFTkdUSCAmJiBwZW5kaW5nRXhwcmVzc2lvblR5cGUgPT09IGN1cnJlbnQucmVmZXJlbmNlICYmXG4gICAgICAgIENIQUlOQUJMRV9JTlNUUlVDVElPTlMuaGFzKHBlbmRpbmdFeHByZXNzaW9uVHlwZSkpIHtcbiAgICAgIC8vIFdlJ2xsIGFsd2F5cyBoYXZlIGEgcGVuZGluZyBleHByZXNzaW9uIHdoZW4gdGhlcmUncyBhIHBlbmRpbmcgZXhwcmVzc2lvbiB0eXBlLlxuICAgICAgcGVuZGluZ0V4cHJlc3Npb24gPSBwZW5kaW5nRXhwcmVzc2lvbiEuY2FsbEZuKHBhcmFtcywgcGVuZGluZ0V4cHJlc3Npb24hLnNvdXJjZVNwYW4pO1xuICAgICAgY2hhaW5MZW5ndGgrKztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHBlbmRpbmdFeHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgICAgIHN0YXRlbWVudHMucHVzaChwZW5kaW5nRXhwcmVzc2lvbi50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgICBwZW5kaW5nRXhwcmVzc2lvbiA9IGludm9rZUluc3RydWN0aW9uKGN1cnJlbnQuc3BhbiwgY3VycmVudC5yZWZlcmVuY2UsIHBhcmFtcyk7XG4gICAgICBwZW5kaW5nRXhwcmVzc2lvblR5cGUgPSBjdXJyZW50LnJlZmVyZW5jZTtcbiAgICAgIGNoYWluTGVuZ3RoID0gMDtcbiAgICB9XG4gIH1cblxuICAvLyBTaW5jZSB0aGUgY3VycmVudCBpbnN0cnVjdGlvbiBhZGRzIHRoZSBwcmV2aW91cyBvbmUgdG8gdGhlIHN0YXRlbWVudHMsXG4gIC8vIHdlIG1heSBiZSBsZWZ0IHdpdGggdGhlIGZpbmFsIG9uZSBhdCB0aGUgZW5kIHRoYXQgaXMgc3RpbGwgcGVuZGluZy5cbiAgaWYgKHBlbmRpbmdFeHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKHBlbmRpbmdFeHByZXNzaW9uLnRvU3RtdCgpKTtcbiAgfVxuXG4gIHJldHVybiBzdGF0ZW1lbnRzO1xufVxuIl19