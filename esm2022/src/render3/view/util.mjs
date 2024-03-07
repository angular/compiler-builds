/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InputFlags } from '../../core';
import { BindingType } from '../../expression_parser/ast';
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
    R3.twoWayProperty,
    R3.twoWayListener,
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
export function temporaryAllocator(pushStatement, name) {
    let temp = null;
    return () => {
        if (!temp) {
            pushStatement(new o.DeclareVarStmt(TEMPORARY_NAME, undefined, o.DYNAMIC_TYPE));
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
            if (i.type === BindingType.Property || i.type === BindingType.TwoWay) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3RDLE9BQU8sRUFBQyxXQUFXLEVBQWdCLE1BQU0sNkJBQTZCLENBQUM7QUFDdkUsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ2pELE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sS0FBSyxDQUFDLE1BQU0sV0FBVyxDQUFDO0FBQy9CLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUc1Qzs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQUcsTUFBTSxDQUFDO0FBRXBELHVEQUF1RDtBQUN2RCxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBRW5DLG9FQUFvRTtBQUNwRSxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBRWxDLDZEQUE2RDtBQUM3RCxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBRWpDLHFDQUFxQztBQUNyQyxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7QUFFckMsaURBQWlEO0FBQ2pELE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQztBQUU5QyxtQ0FBbUM7QUFDbkMsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDO0FBRWpELHNG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QUM7UUFDaEIsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLGlCQUFpQixLQUFLLElBQUksRUFBRSxDQUFDO2dCQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDOUMsQ0FBQztZQUNELGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMvRSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQzFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFFRCx5RUFBeUU7SUFDekUsc0VBQXNFO0lBQ3RFLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDL0IsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SW5wdXRGbGFnc30gZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0JpbmRpbmdUeXBlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5cbmltcG9ydCB7aXNJMThuQXR0cmlidXRlfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhbiBvYmplY3Qga2V5IGNvbnRhaW5zIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycywgdGh1cyB0aGUga2V5IHNob3VsZCBiZSB3cmFwcGVkIGluXG4gKiBxdW90ZXMuIE5vdGU6IHdlIGRvIG5vdCB3cmFwIGFsbCBrZXlzIGludG8gcXVvdGVzLCBhcyBpdCBtYXkgaGF2ZSBpbXBhY3Qgb24gbWluaWZpY2F0aW9uIGFuZCBtYXlcbiAqIG5vdCB3b3JrIGluIHNvbWUgY2FzZXMgd2hlbiBvYmplY3Qga2V5cyBhcmUgbWFuZ2xlZCBieSBhIG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5leHBvcnQgY29uc3QgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAgPSAvWy0uXS87XG5cbi8qKiBOYW1lIG9mIHRoZSB0ZW1wb3JhcnkgdG8gdXNlIGR1cmluZyBkYXRhIGJpbmRpbmcgKi9cbmV4cG9ydCBjb25zdCBURU1QT1JBUllfTkFNRSA9ICdfdCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBjb250ZXh0IHBhcmFtZXRlciBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgQ09OVEVYVF9OQU1FID0gJ2N0eCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBSZW5kZXJGbGFnIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJfRkxBR1MgPSAncmYnO1xuXG4vKiogVGhlIHByZWZpeCByZWZlcmVuY2UgdmFyaWFibGVzICovXG5leHBvcnQgY29uc3QgUkVGRVJFTkNFX1BSRUZJWCA9ICdfcic7XG5cbi8qKiBUaGUgbmFtZSBvZiB0aGUgaW1wbGljaXQgY29udGV4dCByZWZlcmVuY2UgKi9cbmV4cG9ydCBjb25zdCBJTVBMSUNJVF9SRUZFUkVOQ0UgPSAnJGltcGxpY2l0JztcblxuLyoqIE5vbiBiaW5kYWJsZSBhdHRyaWJ1dGUgbmFtZSAqKi9cbmV4cG9ydCBjb25zdCBOT05fQklOREFCTEVfQVRUUiA9ICduZ05vbkJpbmRhYmxlJztcblxuLyoqIE5hbWUgZm9yIHRoZSB2YXJpYWJsZSBrZWVwaW5nIHRyYWNrIG9mIHRoZSBjb250ZXh0IHJldHVybmVkIGJ5IGDJtcm1cmVzdG9yZVZpZXdgLiAqL1xuZXhwb3J0IGNvbnN0IFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FID0gJ3Jlc3RvcmVkQ3R4JztcblxuLyoqIFNwZWNpYWwgdmFsdWUgcmVwcmVzZW50aW5nIGEgZGlyZWN0IGFjY2VzcyB0byBhIHRlbXBsYXRlJ3MgY29udGV4dC4gKi9cbmV4cG9ydCBjb25zdCBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0UgPSAnI2NvbnRleHQnO1xuXG4vKipcbiAqIE1heGltdW0gbGVuZ3RoIG9mIGEgc2luZ2xlIGluc3RydWN0aW9uIGNoYWluLiBCZWNhdXNlIG91ciBvdXRwdXQgQVNUIHVzZXMgcmVjdXJzaW9uLCB3ZSdyZVxuICogbGltaXRlZCBpbiBob3cgbWFueSBleHByZXNzaW9ucyB3ZSBjYW4gbmVzdCBiZWZvcmUgd2UgcmVhY2ggdGhlIGNhbGwgc3RhY2sgbGltaXQuIFRoaXNcbiAqIGxlbmd0aCBpcyBzZXQgdmVyeSBjb25zZXJ2YXRpdmVseSBpbiBvcmRlciB0byByZWR1Y2UgdGhlIGNoYW5jZSBvZiBwcm9ibGVtcy5cbiAqL1xuY29uc3QgTUFYX0NIQUlOX0xFTkdUSCA9IDUwMDtcblxuLyoqIEluc3RydWN0aW9ucyB0aGF0IHN1cHBvcnQgY2hhaW5pbmcuICovXG5jb25zdCBDSEFJTkFCTEVfSU5TVFJVQ1RJT05TID0gbmV3IFNldChbXG4gIFIzLmVsZW1lbnQsXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudENvbnRhaW5lcixcbiAgUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0LFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5pMThuRXhwLFxuICBSMy5saXN0ZW5lcixcbiAgUjMuY2xhc3NQcm9wLFxuICBSMy5zeW50aGV0aWNIb3N0TGlzdGVuZXIsXG4gIFIzLmhvc3RQcm9wZXJ0eSxcbiAgUjMuc3ludGhldGljSG9zdFByb3BlcnR5LFxuICBSMy5wcm9wZXJ0eSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTEsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMyxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNixcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTcsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlVixcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMixcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlOCxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTMsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTYsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZVYsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZSxcbiAgUjMudGV4dEludGVycG9sYXRlMSxcbiAgUjMudGV4dEludGVycG9sYXRlMixcbiAgUjMudGV4dEludGVycG9sYXRlMyxcbiAgUjMudGV4dEludGVycG9sYXRlNCxcbiAgUjMudGV4dEludGVycG9sYXRlNSxcbiAgUjMudGV4dEludGVycG9sYXRlNixcbiAgUjMudGV4dEludGVycG9sYXRlNyxcbiAgUjMudGV4dEludGVycG9sYXRlOCxcbiAgUjMudGV4dEludGVycG9sYXRlVixcbiAgUjMudGVtcGxhdGVDcmVhdGUsXG4gIFIzLnR3b1dheVByb3BlcnR5LFxuICBSMy50d29XYXlMaXN0ZW5lcixcbl0pO1xuXG4vKipcbiAqIFBvc3NpYmxlIHR5cGVzIHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHBhcmFtZXRlcnMgb2YgYW4gaW5zdHJ1Y3Rpb24gY2FsbC5cbiAqIElmIHRoZSBwYXJhbWV0ZXJzIGFyZSBhIGZ1bmN0aW9uLCB0aGUgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIGF0IHRoZSB0aW1lIHRoZSBpbnN0cnVjdGlvblxuICogaXMgZ2VuZXJhdGVkLlxuICovXG5leHBvcnQgdHlwZSBJbnN0cnVjdGlvblBhcmFtcyA9IChvLkV4cHJlc3Npb258by5FeHByZXNzaW9uW10pfCgoKSA9PiAoby5FeHByZXNzaW9ufG8uRXhwcmVzc2lvbltdKSk7XG5cbi8qKiBOZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gZ2VuZXJhdGUgYSBjYWxsIHRvIGFuIGluc3RydWN0aW9uIGZ1bmN0aW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnN0cnVjdGlvbiB7XG4gIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIHBhcmFtc09yRm4/OiBJbnN0cnVjdGlvblBhcmFtcztcbn1cblxuLyoqIEdlbmVyYXRlcyBhIGNhbGwgdG8gYSBzaW5nbGUgaW5zdHJ1Y3Rpb24uICovXG5leHBvcnQgZnVuY3Rpb24gaW52b2tlSW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihwdXNoU3RhdGVtZW50OiAoc3Q6IG8uU3RhdGVtZW50KSA9PiB2b2lkLCBuYW1lOiBzdHJpbmcpOiAoKSA9PlxuICAgIG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHB1c2hTdGF0ZW1lbnQobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPih0aGlzOiB0LlZpc2l0b3IsIGFyZzogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50fHQuTm9kZSk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7YXJnLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0xpdGVyYWwodmFsdWU6IGFueSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWUubWFwKGFzTGl0ZXJhbCkpO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwodmFsdWUsIG8uSU5GRVJSRURfVFlQRSk7XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBpbnB1dHMgYW5kIG91dHB1dHMgZm9yIGBkZWZpbmVEaXJlY3RpdmVgIGFuZCBgZGVmaW5lQ29tcG9uZW50YC5cbiAqXG4gKiBUaGlzIHdpbGwgYXR0ZW1wdCB0byBnZW5lcmF0ZSBvcHRpbWl6ZWQgZGF0YSBzdHJ1Y3R1cmVzIHRvIG1pbmltaXplIG1lbW9yeSBvclxuICogZmlsZSBzaXplIG9mIGZ1bGx5IGNvbXBpbGVkIGFwcGxpY2F0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChcbiAgICBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ3x7XG4gICAgICBjbGFzc1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgdHJhbnNmb3JtRnVuY3Rpb246IG8uRXhwcmVzc2lvbnxudWxsO1xuICAgICAgaXNTaWduYWw6IGJvb2xlYW4sXG4gICAgfT4sIGZvcklucHV0cz86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApO1xuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gbWFwW2tleV07XG4gICAgbGV0IGRlY2xhcmVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBwdWJsaWNOYW1lOiBzdHJpbmc7XG4gICAgbGV0IG1pbmlmaWVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBleHByZXNzaW9uVmFsdWU6IG8uRXhwcmVzc2lvbjtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogcHVibGljUHJvcGBcbiAgICAgIGRlY2xhcmVkTmFtZSA9IGtleTtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIHB1YmxpY05hbWUgPSB2YWx1ZTtcbiAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgICAgZGVjbGFyZWROYW1lID0gdmFsdWUuY2xhc3NQcm9wZXJ0eU5hbWU7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZTtcblxuICAgICAgY29uc3QgZGlmZmVyZW50RGVjbGFyaW5nTmFtZSA9IHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZTtcbiAgICAgIGNvbnN0IGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtID0gdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGw7XG5cbiAgICAgIC8vIEJ1aWxkIHVwIGlucHV0IGZsYWdzXG4gICAgICBsZXQgZmxhZ3M6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICAgIGlmICh2YWx1ZS5pc1NpZ25hbCkge1xuICAgICAgICBmbGFncyA9IGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKElucHV0RmxhZ3MuU2lnbmFsQmFzZWQsIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSkge1xuICAgICAgICBmbGFncyA9IGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKElucHV0RmxhZ3MuSGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5wdXRzLCBjb21wYXJlZCB0byBvdXRwdXRzLCB3aWxsIHRyYWNrIHRoZWlyIGRlY2xhcmVkIG5hbWUgKGZvciBgbmdPbkNoYW5nZXNgKSwgc3VwcG9ydFxuICAgICAgLy8gZGVjb3JhdG9yIGlucHV0IHRyYW5zZm9ybSBmdW5jdGlvbnMsIG9yIHN0b3JlIGZsYWcgaW5mb3JtYXRpb24gaWYgdGhlcmUgaXMgYW55LlxuICAgICAgaWYgKGZvcklucHV0cyAmJiAoZGlmZmVyZW50RGVjbGFyaW5nTmFtZSB8fCBoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSB8fCBmbGFncyAhPT0gbnVsbCkpIHtcbiAgICAgICAgY29uc3QgZmxhZ3NFeHByID0gZmxhZ3MgPz8gby5pbXBvcnRFeHByKFIzLklucHV0RmxhZ3MpLnByb3AoSW5wdXRGbGFnc1tJbnB1dEZsYWdzLk5vbmVdKTtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBvLkV4cHJlc3Npb25bXSA9IFtmbGFnc0V4cHIsIGFzTGl0ZXJhbChwdWJsaWNOYW1lKV07XG5cbiAgICAgICAgaWYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICByZXN1bHQucHVzaChhc0xpdGVyYWwoZGVjbGFyZWROYW1lKSk7XG5cbiAgICAgICAgICBpZiAoaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uISk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gby5saXRlcmFsQXJyKHJlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogbWluaWZpZWROYW1lLFxuICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChtaW5pZmllZE5hbWUpLFxuICAgICAgdmFsdWU6IGV4cHJlc3Npb25WYWx1ZSxcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKiBHZXRzIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbiByZWZlcmVuY2luZyB0aGUgZ2l2ZW4gZmxhZy4gKi9cbmZ1bmN0aW9uIGdldElucHV0RmxhZ0V4cHIoZmxhZzogSW5wdXRGbGFncyk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuSW5wdXRGbGFncykucHJvcChJbnB1dEZsYWdzW2ZsYWddKTtcbn1cblxuLyoqIENvbWJpbmVzIGEgZ2l2ZW4gaW5wdXQgZmxhZyB3aXRoIGFuIGV4aXN0aW5nIGZsYWcgZXhwcmVzc2lvbiwgaWYgcHJlc2VudC4gKi9cbmZ1bmN0aW9uIGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKGZsYWc6IElucHV0RmxhZ3MsIGV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGV4cHIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZ2V0SW5wdXRGbGFnRXhwcihmbGFnKTtcbiAgfVxuICByZXR1cm4gZ2V0SW5wdXRGbGFnRXhwcihmbGFnKS5iaXR3aXNlT3IoZXhwcik7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vKipcbiAqIEEgcmVwcmVzZW50YXRpb24gZm9yIGFuIG9iamVjdCBsaXRlcmFsIHVzZWQgZHVyaW5nIGNvZGVnZW4gb2YgZGVmaW5pdGlvbiBvYmplY3RzLiBUaGUgZ2VuZXJpY1xuICogdHlwZSBgVGAgYWxsb3dzIHRvIHJlZmVyZW5jZSBhIGRvY3VtZW50ZWQgdHlwZSBvZiB0aGUgZ2VuZXJhdGVkIHN0cnVjdHVyZSwgc3VjaCB0aGF0IHRoZVxuICogcHJvcGVydHkgbmFtZXMgdGhhdCBhcmUgc2V0IGNhbiBiZSByZXNvbHZlZCB0byB0aGVpciBkb2N1bWVudGVkIGRlY2xhcmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgRGVmaW5pdGlvbk1hcDxUID0gYW55PiB7XG4gIHZhbHVlczoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW4sIHZhbHVlOiBvLkV4cHJlc3Npb259W10gPSBbXTtcblxuICBzZXQoa2V5OiBrZXlvZiBULCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy52YWx1ZXMuZmluZCh2YWx1ZSA9PiB2YWx1ZS5rZXkgPT09IGtleSk7XG5cbiAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICBleGlzdGluZy52YWx1ZSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy52YWx1ZXMucHVzaCh7a2V5OiBrZXkgYXMgc3RyaW5nLCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRvTGl0ZXJhbE1hcCgpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgICByZXR1cm4gby5saXRlcmFsTWFwKHRoaXMudmFsdWVzKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ3NzU2VsZWN0b3JgIGZyb20gYW4gQVNUIG5vZGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3RvckZyb21Ob2RlKG5vZGU6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBlbGVtZW50TmFtZSA9IG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQgPyBub2RlLm5hbWUgOiAnbmctdGVtcGxhdGUnO1xuICBjb25zdCBhdHRyaWJ1dGVzID0gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhub2RlKTtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcbiAgY29uc3QgZWxlbWVudE5hbWVOb05zID0gc3BsaXROc05hbWUoZWxlbWVudE5hbWUpWzFdO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQoZWxlbWVudE5hbWVOb05zKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgbmFtZU5vTnMgPSBzcGxpdE5zTmFtZShuYW1lKVsxXTtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZU5vTnMsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IGEgbWFwIG9mIHByb3BlcnRpZXMgdG8gdmFsdWVzIGZvciBhIGdpdmVuIGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZSwgd2hpY2ggY2FuIGJlIHVzZWRcbiAqIGJ5IHRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbWFjaGluZXJ5LlxuICpcbiAqIEBwYXJhbSBlbE9yVHBsIHRoZSBlbGVtZW50IG9yIHRlbXBsYXRlIGluIHF1ZXN0aW9uXG4gKiBAcmV0dXJuIGFuIG9iamVjdCBzZXQgdXAgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy4gRm9yIGF0dHJpYnV0ZXMgb24gdGhlIGVsZW1lbnQvdGVtcGxhdGUsIHRoaXNcbiAqIG9iamVjdCBtYXBzIGEgcHJvcGVydHkgbmFtZSB0byBpdHMgKHN0YXRpYykgdmFsdWUuIEZvciBhbnkgYmluZGluZ3MsIHRoaXMgbWFwIHNpbXBseSBtYXBzIHRoZVxuICogcHJvcGVydHkgbmFtZSB0byBhbiBlbXB0eSBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuXG4gIGlmIChlbE9yVHBsIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBlbE9yVHBsLnRhZ05hbWUgIT09ICduZy10ZW1wbGF0ZScpIHtcbiAgICBlbE9yVHBsLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChhID0+IGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9ICcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGlmICghaXNJMThuQXR0cmlidXRlKGEubmFtZSkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFthLm5hbWVdID0gYS52YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7XG4gICAgICBpZiAoaS50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSB8fCBpLnR5cGUgPT09IEJpbmRpbmdUeXBlLlR3b1dheSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2kubmFtZV0gPSAnJztcbiAgICAgIH1cbiAgICB9KTtcbiAgICBlbE9yVHBsLm91dHB1dHMuZm9yRWFjaChvID0+IHtcbiAgICAgIGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGF0dHJpYnV0ZXNNYXA7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyBleHBlY3RlZCB0byBiZSBwYXNzZWQgdG8gYSBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb24gaW4gdGhlIGNhc2Ugb2ZcbiAqIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gaW50ZXJwb2xhdGlvbiBhc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgY29uc3Qge2V4cHJlc3Npb25zLCBzdHJpbmdzfSA9IGludGVycG9sYXRpb247XG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5ncy5sZW5ndGggPT09IDIgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICAvLyBJZiB0aGUgaW50ZXJwb2xhdGlvbiBoYXMgb25lIGludGVycG9sYXRlZCB2YWx1ZSwgYnV0IHRoZSBwcmVmaXggYW5kIHN1ZmZpeCBhcmUgYm90aCBlbXB0eVxuICAgIC8vIHN0cmluZ3MsIHdlIG9ubHkgcGFzcyBvbmUgYXJndW1lbnQsIHRvIGEgc3BlY2lhbCBpbnN0cnVjdGlvbiBsaWtlIGBwcm9wZXJ0eUludGVycG9sYXRlYCBvclxuICAgIC8vIGB0ZXh0SW50ZXJwb2xhdGVgLlxuICAgIHJldHVybiAxO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByZXNzaW9ucy5sZW5ndGggKyBzdHJpbmdzLmxlbmd0aDtcbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0aGUgZmluYWwgaW5zdHJ1Y3Rpb24gY2FsbCBzdGF0ZW1lbnRzIGJhc2VkIG9uIHRoZSBwYXNzZWQgaW4gY29uZmlndXJhdGlvbi5cbiAqIFdpbGwgdHJ5IHRvIGNoYWluIGluc3RydWN0aW9ucyBhcyBtdWNoIGFzIHBvc3NpYmxlLCBpZiBjaGFpbmluZyBpcyBzdXBwb3J0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMoaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IHBlbmRpbmdFeHByZXNzaW9uOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gIGxldCBwZW5kaW5nRXhwcmVzc2lvblR5cGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8bnVsbCA9IG51bGw7XG4gIGxldCBjaGFpbkxlbmd0aCA9IDA7XG5cbiAgZm9yIChjb25zdCBjdXJyZW50IG9mIGluc3RydWN0aW9ucykge1xuICAgIGNvbnN0IHJlc29sdmVkUGFyYW1zID1cbiAgICAgICAgKHR5cGVvZiBjdXJyZW50LnBhcmFtc09yRm4gPT09ICdmdW5jdGlvbicgPyBjdXJyZW50LnBhcmFtc09yRm4oKSA6IGN1cnJlbnQucGFyYW1zT3JGbikgPz9cbiAgICAgICAgW107XG4gICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShyZXNvbHZlZFBhcmFtcykgPyByZXNvbHZlZFBhcmFtcyA6IFtyZXNvbHZlZFBhcmFtc107XG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBpbnN0cnVjdGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgcHJldmlvdXMgb25lXG4gICAgLy8gYW5kIGl0IGNhbiBiZSBjaGFpbmVkLCBhZGQgYW5vdGhlciBjYWxsIHRvIHRoZSBjaGFpbi5cbiAgICBpZiAoY2hhaW5MZW5ndGggPCBNQVhfQ0hBSU5fTEVOR1RIICYmIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9PT0gY3VycmVudC5yZWZlcmVuY2UgJiZcbiAgICAgICAgQ0hBSU5BQkxFX0lOU1RSVUNUSU9OUy5oYXMocGVuZGluZ0V4cHJlc3Npb25UeXBlKSkge1xuICAgICAgLy8gV2UnbGwgYWx3YXlzIGhhdmUgYSBwZW5kaW5nIGV4cHJlc3Npb24gd2hlbiB0aGVyZSdzIGEgcGVuZGluZyBleHByZXNzaW9uIHR5cGUuXG4gICAgICBwZW5kaW5nRXhwcmVzc2lvbiA9IHBlbmRpbmdFeHByZXNzaW9uIS5jYWxsRm4ocGFyYW1zLCBwZW5kaW5nRXhwcmVzc2lvbiEuc291cmNlU3Bhbik7XG4gICAgICBjaGFpbkxlbmd0aCsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICAgICAgc3RhdGVtZW50cy5wdXNoKHBlbmRpbmdFeHByZXNzaW9uLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uID0gaW52b2tlSW5zdHJ1Y3Rpb24oY3VycmVudC5zcGFuLCBjdXJyZW50LnJlZmVyZW5jZSwgcGFyYW1zKTtcbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9IGN1cnJlbnQucmVmZXJlbmNlO1xuICAgICAgY2hhaW5MZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNpbmNlIHRoZSBjdXJyZW50IGluc3RydWN0aW9uIGFkZHMgdGhlIHByZXZpb3VzIG9uZSB0byB0aGUgc3RhdGVtZW50cyxcbiAgLy8gd2UgbWF5IGJlIGxlZnQgd2l0aCB0aGUgZmluYWwgb25lIGF0IHRoZSBlbmQgdGhhdCBpcyBzdGlsbCBwZW5kaW5nLlxuICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gocGVuZGluZ0V4cHJlc3Npb24udG9TdG10KCkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG4iXX0=