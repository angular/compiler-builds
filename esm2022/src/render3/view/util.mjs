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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBRXRDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLFdBQVcsQ0FBQztBQUMvQixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFHNUM7Ozs7Ozs7R0FPRztBQUNILE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQztBQUVwRCx1REFBdUQ7QUFDdkQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUVuQyxvRUFBb0U7QUFDcEUsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUVsQyw2REFBNkQ7QUFDN0QsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQztBQUVqQyxxQ0FBcUM7QUFDckMsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0FBRXJDLGlEQUFpRDtBQUNqRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxXQUFXLENBQUM7QUFFOUMsbUNBQW1DO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztBQUVqRCxzRkFBc0Y7QUFDdEYsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsYUFBYSxD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QWlCLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQy9FLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7WUFDMUMsV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNsQixDQUFDO0lBQ0gsQ0FBQztJQUVELHlFQUF5RTtJQUN6RSxzRUFBc0U7SUFDdEUsSUFBSSxpQkFBaUIsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJbnB1dEZsYWdzfSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QmluZGluZ1R5cGUsIEludGVycG9sYXRpb259IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtpc0kxOG5BdHRyaWJ1dGV9IGZyb20gJy4vaTE4bi91dGlsJztcblxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIGFuIG9iamVjdCBrZXkgY29udGFpbnMgcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLCB0aHVzIHRoZSBrZXkgc2hvdWxkIGJlIHdyYXBwZWQgaW5cbiAqIHF1b3Rlcy4gTm90ZTogd2UgZG8gbm90IHdyYXAgYWxsIGtleXMgaW50byBxdW90ZXMsIGFzIGl0IG1heSBoYXZlIGltcGFjdCBvbiBtaW5pZmljYXRpb24gYW5kIG1heVxuICogbm90IHdvcmsgaW4gc29tZSBjYXNlcyB3aGVuIG9iamVjdCBrZXlzIGFyZSBtYW5nbGVkIGJ5IGEgbWluaWZpZXIuXG4gKlxuICogVE9ETyhGVy0xMTM2KTogdGhpcyBpcyBhIHRlbXBvcmFyeSBzb2x1dGlvbiwgd2UgbmVlZCB0byBjb21lIHVwIHdpdGggYSBiZXR0ZXIgd2F5IG9mIHdvcmtpbmcgd2l0aFxuICogaW5wdXRzIHRoYXQgY29udGFpbiBwb3RlbnRpYWxseSB1bnNhZmUgY2hhcnMuXG4gKi9cbmV4cG9ydCBjb25zdCBVTlNBRkVfT0JKRUNUX0tFWV9OQU1FX1JFR0VYUCA9IC9bLS5dLztcblxuLyoqIE5hbWUgb2YgdGhlIHRlbXBvcmFyeSB0byB1c2UgZHVyaW5nIGRhdGEgYmluZGluZyAqL1xuZXhwb3J0IGNvbnN0IFRFTVBPUkFSWV9OQU1FID0gJ190JztcblxuLyoqIE5hbWUgb2YgdGhlIGNvbnRleHQgcGFyYW1ldGVyIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBDT05URVhUX05BTUUgPSAnY3R4JztcblxuLyoqIE5hbWUgb2YgdGhlIFJlbmRlckZsYWcgcGFzc2VkIGludG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiAqL1xuZXhwb3J0IGNvbnN0IFJFTkRFUl9GTEFHUyA9ICdyZic7XG5cbi8qKiBUaGUgcHJlZml4IHJlZmVyZW5jZSB2YXJpYWJsZXMgKi9cbmV4cG9ydCBjb25zdCBSRUZFUkVOQ0VfUFJFRklYID0gJ19yJztcblxuLyoqIFRoZSBuYW1lIG9mIHRoZSBpbXBsaWNpdCBjb250ZXh0IHJlZmVyZW5jZSAqL1xuZXhwb3J0IGNvbnN0IElNUExJQ0lUX1JFRkVSRU5DRSA9ICckaW1wbGljaXQnO1xuXG4vKiogTm9uIGJpbmRhYmxlIGF0dHJpYnV0ZSBuYW1lICoqL1xuZXhwb3J0IGNvbnN0IE5PTl9CSU5EQUJMRV9BVFRSID0gJ25nTm9uQmluZGFibGUnO1xuXG4vKiogTmFtZSBmb3IgdGhlIHZhcmlhYmxlIGtlZXBpbmcgdHJhY2sgb2YgdGhlIGNvbnRleHQgcmV0dXJuZWQgYnkgYMm1ybVyZXN0b3JlVmlld2AuICovXG5leHBvcnQgY29uc3QgUkVTVE9SRURfVklFV19DT05URVhUX05BTUUgPSAncmVzdG9yZWRDdHgnO1xuXG4vKiogU3BlY2lhbCB2YWx1ZSByZXByZXNlbnRpbmcgYSBkaXJlY3QgYWNjZXNzIHRvIGEgdGVtcGxhdGUncyBjb250ZXh0LiAqL1xuZXhwb3J0IGNvbnN0IERJUkVDVF9DT05URVhUX1JFRkVSRU5DRSA9ICcjY29udGV4dCc7XG5cbi8qKlxuICogTWF4aW11bSBsZW5ndGggb2YgYSBzaW5nbGUgaW5zdHJ1Y3Rpb24gY2hhaW4uIEJlY2F1c2Ugb3VyIG91dHB1dCBBU1QgdXNlcyByZWN1cnNpb24sIHdlJ3JlXG4gKiBsaW1pdGVkIGluIGhvdyBtYW55IGV4cHJlc3Npb25zIHdlIGNhbiBuZXN0IGJlZm9yZSB3ZSByZWFjaCB0aGUgY2FsbCBzdGFjayBsaW1pdC4gVGhpc1xuICogbGVuZ3RoIGlzIHNldCB2ZXJ5IGNvbnNlcnZhdGl2ZWx5IGluIG9yZGVyIHRvIHJlZHVjZSB0aGUgY2hhbmNlIG9mIHByb2JsZW1zLlxuICovXG5jb25zdCBNQVhfQ0hBSU5fTEVOR1RIID0gNTAwO1xuXG4vKiogSW5zdHJ1Y3Rpb25zIHRoYXQgc3VwcG9ydCBjaGFpbmluZy4gKi9cbmNvbnN0IENIQUlOQUJMRV9JTlNUUlVDVElPTlMgPSBuZXcgU2V0KFtcbiAgUjMuZWxlbWVudCxcbiAgUjMuZWxlbWVudFN0YXJ0LFxuICBSMy5lbGVtZW50RW5kLFxuICBSMy5lbGVtZW50Q29udGFpbmVyLFxuICBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQsXG4gIFIzLmVsZW1lbnRDb250YWluZXJFbmQsXG4gIFIzLmkxOG5FeHAsXG4gIFIzLmxpc3RlbmVyLFxuICBSMy5jbGFzc1Byb3AsXG4gIFIzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lcixcbiAgUjMuaG9zdFByb3BlcnR5LFxuICBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHksXG4gIFIzLnByb3BlcnR5LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTIsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUzLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNCxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTUsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU2LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNyxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTgsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGVWLFxuICBSMy5hdHRyaWJ1dGUsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUyLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTMsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNCxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU1LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTYsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNyxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU4LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZVYsXG4gIFIzLnN0eWxlUHJvcCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTIsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTUsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTgsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlVixcbiAgUjMudGV4dEludGVycG9sYXRlLFxuICBSMy50ZXh0SW50ZXJwb2xhdGUxLFxuICBSMy50ZXh0SW50ZXJwb2xhdGUyLFxuICBSMy50ZXh0SW50ZXJwb2xhdGUzLFxuICBSMy50ZXh0SW50ZXJwb2xhdGU0LFxuICBSMy50ZXh0SW50ZXJwb2xhdGU1LFxuICBSMy50ZXh0SW50ZXJwb2xhdGU2LFxuICBSMy50ZXh0SW50ZXJwb2xhdGU3LFxuICBSMy50ZXh0SW50ZXJwb2xhdGU4LFxuICBSMy50ZXh0SW50ZXJwb2xhdGVWLFxuICBSMy50ZW1wbGF0ZUNyZWF0ZSxcbl0pO1xuXG4vKipcbiAqIFBvc3NpYmxlIHR5cGVzIHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHBhcmFtZXRlcnMgb2YgYW4gaW5zdHJ1Y3Rpb24gY2FsbC5cbiAqIElmIHRoZSBwYXJhbWV0ZXJzIGFyZSBhIGZ1bmN0aW9uLCB0aGUgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIGF0IHRoZSB0aW1lIHRoZSBpbnN0cnVjdGlvblxuICogaXMgZ2VuZXJhdGVkLlxuICovXG5leHBvcnQgdHlwZSBJbnN0cnVjdGlvblBhcmFtcyA9IChvLkV4cHJlc3Npb258by5FeHByZXNzaW9uW10pfCgoKSA9PiAoby5FeHByZXNzaW9ufG8uRXhwcmVzc2lvbltdKSk7XG5cbi8qKiBOZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gZ2VuZXJhdGUgYSBjYWxsIHRvIGFuIGluc3RydWN0aW9uIGZ1bmN0aW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbnN0cnVjdGlvbiB7XG4gIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsO1xuICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIHBhcmFtc09yRm4/OiBJbnN0cnVjdGlvblBhcmFtcztcbn1cblxuLyoqIEdlbmVyYXRlcyBhIGNhbGwgdG8gYSBzaW5nbGUgaW5zdHJ1Y3Rpb24uICovXG5leHBvcnQgZnVuY3Rpb24gaW52b2tlSW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYWxsb2NhdG9yIGZvciBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAqXG4gKiBBIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGlzIGFkZGVkIHRvIHRoZSBzdGF0ZW1lbnRzIHRoZSBmaXJzdCB0aW1lIHRoZSBhbGxvY2F0b3IgaXMgaW52b2tlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeUFsbG9jYXRvcihwdXNoU3RhdGVtZW50OiAoc3Q6IG8uU3RhdGVtZW50KSA9PiB2b2lkLCBuYW1lOiBzdHJpbmcpOiAoKSA9PlxuICAgIG8uUmVhZFZhckV4cHIge1xuICBsZXQgdGVtcDogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHB1c2hTdGF0ZW1lbnQobmV3IG8uRGVjbGFyZVZhclN0bXQoVEVNUE9SQVJZX05BTUUsIHVuZGVmaW5lZCwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIHRlbXAgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcDtcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gaW52YWxpZDxUPih0aGlzOiB0LlZpc2l0b3IsIGFyZzogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50fHQuTm9kZSk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgc3RhdGU6IFZpc2l0b3IgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGRvZXNuJ3QgaGFuZGxlICR7YXJnLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0xpdGVyYWwodmFsdWU6IGFueSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWUubWFwKGFzTGl0ZXJhbCkpO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwodmFsdWUsIG8uSU5GRVJSRURfVFlQRSk7XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBpbnB1dHMgYW5kIG91dHB1dHMgZm9yIGBkZWZpbmVEaXJlY3RpdmVgIGFuZCBgZGVmaW5lQ29tcG9uZW50YC5cbiAqXG4gKiBUaGlzIHdpbGwgYXR0ZW1wdCB0byBnZW5lcmF0ZSBvcHRpbWl6ZWQgZGF0YSBzdHJ1Y3R1cmVzIHRvIG1pbmltaXplIG1lbW9yeSBvclxuICogZmlsZSBzaXplIG9mIGZ1bGx5IGNvbXBpbGVkIGFwcGxpY2F0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChcbiAgICBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ3x7XG4gICAgICBjbGFzc1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgYmluZGluZ1Byb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgICAgdHJhbnNmb3JtRnVuY3Rpb246IG8uRXhwcmVzc2lvbnxudWxsO1xuICAgICAgaXNTaWduYWw6IGJvb2xlYW4sXG4gICAgfT4sIGZvcklucHV0cz86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtYXApO1xuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChrZXlzLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gbWFwW2tleV07XG4gICAgbGV0IGRlY2xhcmVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBwdWJsaWNOYW1lOiBzdHJpbmc7XG4gICAgbGV0IG1pbmlmaWVkTmFtZTogc3RyaW5nO1xuICAgIGxldCBleHByZXNzaW9uVmFsdWU6IG8uRXhwcmVzc2lvbjtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogcHVibGljUHJvcGBcbiAgICAgIGRlY2xhcmVkTmFtZSA9IGtleTtcbiAgICAgIG1pbmlmaWVkTmFtZSA9IGtleTtcbiAgICAgIHB1YmxpY05hbWUgPSB2YWx1ZTtcbiAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IGFzTGl0ZXJhbChwdWJsaWNOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgICAgZGVjbGFyZWROYW1lID0gdmFsdWUuY2xhc3NQcm9wZXJ0eU5hbWU7XG4gICAgICBwdWJsaWNOYW1lID0gdmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZTtcblxuICAgICAgY29uc3QgZGlmZmVyZW50RGVjbGFyaW5nTmFtZSA9IHB1YmxpY05hbWUgIT09IGRlY2xhcmVkTmFtZTtcbiAgICAgIGNvbnN0IGhhc0RlY29yYXRvcklucHV0VHJhbnNmb3JtID0gdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGw7XG5cbiAgICAgIC8vIEJ1aWxkIHVwIGlucHV0IGZsYWdzXG4gICAgICBsZXQgZmxhZ3M6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICAgIGlmICh2YWx1ZS5pc1NpZ25hbCkge1xuICAgICAgICBmbGFncyA9IGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKElucHV0RmxhZ3MuU2lnbmFsQmFzZWQsIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSkge1xuICAgICAgICBmbGFncyA9IGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKElucHV0RmxhZ3MuSGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5wdXRzLCBjb21wYXJlZCB0byBvdXRwdXRzLCB3aWxsIHRyYWNrIHRoZWlyIGRlY2xhcmVkIG5hbWUgKGZvciBgbmdPbkNoYW5nZXNgKSwgc3VwcG9ydFxuICAgICAgLy8gZGVjb3JhdG9yIGlucHV0IHRyYW5zZm9ybSBmdW5jdGlvbnMsIG9yIHN0b3JlIGZsYWcgaW5mb3JtYXRpb24gaWYgdGhlcmUgaXMgYW55LlxuICAgICAgaWYgKGZvcklucHV0cyAmJiAoZGlmZmVyZW50RGVjbGFyaW5nTmFtZSB8fCBoYXNEZWNvcmF0b3JJbnB1dFRyYW5zZm9ybSB8fCBmbGFncyAhPT0gbnVsbCkpIHtcbiAgICAgICAgY29uc3QgZmxhZ3NFeHByID0gZmxhZ3MgPz8gby5pbXBvcnRFeHByKFIzLklucHV0RmxhZ3MpLnByb3AoSW5wdXRGbGFnc1tJbnB1dEZsYWdzLk5vbmVdKTtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBvLkV4cHJlc3Npb25bXSA9IFtmbGFnc0V4cHIsIGFzTGl0ZXJhbChwdWJsaWNOYW1lKV07XG5cbiAgICAgICAgaWYgKGRpZmZlcmVudERlY2xhcmluZ05hbWUgfHwgaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICByZXN1bHQucHVzaChhc0xpdGVyYWwoZGVjbGFyZWROYW1lKSk7XG5cbiAgICAgICAgICBpZiAoaGFzRGVjb3JhdG9ySW5wdXRUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uISk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXhwcmVzc2lvblZhbHVlID0gby5saXRlcmFsQXJyKHJlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogbWluaWZpZWROYW1lLFxuICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChtaW5pZmllZE5hbWUpLFxuICAgICAgdmFsdWU6IGV4cHJlc3Npb25WYWx1ZSxcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKiBHZXRzIGFuIG91dHB1dCBBU1QgZXhwcmVzc2lvbiByZWZlcmVuY2luZyB0aGUgZ2l2ZW4gZmxhZy4gKi9cbmZ1bmN0aW9uIGdldElucHV0RmxhZ0V4cHIoZmxhZzogSW5wdXRGbGFncyk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuSW5wdXRGbGFncykucHJvcChJbnB1dEZsYWdzW2ZsYWddKTtcbn1cblxuLyoqIENvbWJpbmVzIGEgZ2l2ZW4gaW5wdXQgZmxhZyB3aXRoIGFuIGV4aXN0aW5nIGZsYWcgZXhwcmVzc2lvbiwgaWYgcHJlc2VudC4gKi9cbmZ1bmN0aW9uIGJpdHdpc2VPcklucHV0RmxhZ3NFeHByKGZsYWc6IElucHV0RmxhZ3MsIGV4cHI6IG8uRXhwcmVzc2lvbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGV4cHIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZ2V0SW5wdXRGbGFnRXhwcihmbGFnKTtcbiAgfVxuICByZXR1cm4gZ2V0SW5wdXRGbGFnRXhwcihmbGFnKS5iaXR3aXNlT3IoZXhwcik7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vKipcbiAqIEEgcmVwcmVzZW50YXRpb24gZm9yIGFuIG9iamVjdCBsaXRlcmFsIHVzZWQgZHVyaW5nIGNvZGVnZW4gb2YgZGVmaW5pdGlvbiBvYmplY3RzLiBUaGUgZ2VuZXJpY1xuICogdHlwZSBgVGAgYWxsb3dzIHRvIHJlZmVyZW5jZSBhIGRvY3VtZW50ZWQgdHlwZSBvZiB0aGUgZ2VuZXJhdGVkIHN0cnVjdHVyZSwgc3VjaCB0aGF0IHRoZVxuICogcHJvcGVydHkgbmFtZXMgdGhhdCBhcmUgc2V0IGNhbiBiZSByZXNvbHZlZCB0byB0aGVpciBkb2N1bWVudGVkIGRlY2xhcmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgRGVmaW5pdGlvbk1hcDxUID0gYW55PiB7XG4gIHZhbHVlczoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW4sIHZhbHVlOiBvLkV4cHJlc3Npb259W10gPSBbXTtcblxuICBzZXQoa2V5OiBrZXlvZiBULCB2YWx1ZTogby5FeHByZXNzaW9ufG51bGwpOiB2b2lkIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy52YWx1ZXMuZmluZCh2YWx1ZSA9PiB2YWx1ZS5rZXkgPT09IGtleSk7XG5cbiAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICBleGlzdGluZy52YWx1ZSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy52YWx1ZXMucHVzaCh7a2V5OiBrZXkgYXMgc3RyaW5nLCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRvTGl0ZXJhbE1hcCgpOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgICByZXR1cm4gby5saXRlcmFsTWFwKHRoaXMudmFsdWVzKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ3NzU2VsZWN0b3JgIGZyb20gYW4gQVNUIG5vZGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3RvckZyb21Ob2RlKG5vZGU6IHQuRWxlbWVudHx0LlRlbXBsYXRlKTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBlbGVtZW50TmFtZSA9IG5vZGUgaW5zdGFuY2VvZiB0LkVsZW1lbnQgPyBub2RlLm5hbWUgOiAnbmctdGVtcGxhdGUnO1xuICBjb25zdCBhdHRyaWJ1dGVzID0gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhub2RlKTtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcbiAgY29uc3QgZWxlbWVudE5hbWVOb05zID0gc3BsaXROc05hbWUoZWxlbWVudE5hbWUpWzFdO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQoZWxlbWVudE5hbWVOb05zKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgbmFtZU5vTnMgPSBzcGxpdE5zTmFtZShuYW1lKVsxXTtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZU5vTnMsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IGEgbWFwIG9mIHByb3BlcnRpZXMgdG8gdmFsdWVzIGZvciBhIGdpdmVuIGVsZW1lbnQgb3IgdGVtcGxhdGUgbm9kZSwgd2hpY2ggY2FuIGJlIHVzZWRcbiAqIGJ5IHRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbWFjaGluZXJ5LlxuICpcbiAqIEBwYXJhbSBlbE9yVHBsIHRoZSBlbGVtZW50IG9yIHRlbXBsYXRlIGluIHF1ZXN0aW9uXG4gKiBAcmV0dXJuIGFuIG9iamVjdCBzZXQgdXAgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZy4gRm9yIGF0dHJpYnV0ZXMgb24gdGhlIGVsZW1lbnQvdGVtcGxhdGUsIHRoaXNcbiAqIG9iamVjdCBtYXBzIGEgcHJvcGVydHkgbmFtZSB0byBpdHMgKHN0YXRpYykgdmFsdWUuIEZvciBhbnkgYmluZGluZ3MsIHRoaXMgbWFwIHNpbXBseSBtYXBzIHRoZVxuICogcHJvcGVydHkgbmFtZSB0byBhbiBlbXB0eSBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBhdHRyaWJ1dGVzTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuXG4gIGlmIChlbE9yVHBsIGluc3RhbmNlb2YgdC5UZW1wbGF0ZSAmJiBlbE9yVHBsLnRhZ05hbWUgIT09ICduZy10ZW1wbGF0ZScpIHtcbiAgICBlbE9yVHBsLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChhID0+IGF0dHJpYnV0ZXNNYXBbYS5uYW1lXSA9ICcnKTtcbiAgfSBlbHNlIHtcbiAgICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGlmICghaXNJMThuQXR0cmlidXRlKGEubmFtZSkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFthLm5hbWVdID0gYS52YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGVsT3JUcGwuaW5wdXRzLmZvckVhY2goaSA9PiB7XG4gICAgICBpZiAoaS50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2kubmFtZV0gPSAnJztcbiAgICAgIH1cbiAgICB9KTtcbiAgICBlbE9yVHBsLm91dHB1dHMuZm9yRWFjaChvID0+IHtcbiAgICAgIGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGF0dHJpYnV0ZXNNYXA7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyBleHBlY3RlZCB0byBiZSBwYXNzZWQgdG8gYSBnZW5lcmF0ZWQgaW5zdHJ1Y3Rpb24gaW4gdGhlIGNhc2Ugb2ZcbiAqIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gaW50ZXJwb2xhdGlvbiBhc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgY29uc3Qge2V4cHJlc3Npb25zLCBzdHJpbmdzfSA9IGludGVycG9sYXRpb247XG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5ncy5sZW5ndGggPT09IDIgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICAvLyBJZiB0aGUgaW50ZXJwb2xhdGlvbiBoYXMgb25lIGludGVycG9sYXRlZCB2YWx1ZSwgYnV0IHRoZSBwcmVmaXggYW5kIHN1ZmZpeCBhcmUgYm90aCBlbXB0eVxuICAgIC8vIHN0cmluZ3MsIHdlIG9ubHkgcGFzcyBvbmUgYXJndW1lbnQsIHRvIGEgc3BlY2lhbCBpbnN0cnVjdGlvbiBsaWtlIGBwcm9wZXJ0eUludGVycG9sYXRlYCBvclxuICAgIC8vIGB0ZXh0SW50ZXJwb2xhdGVgLlxuICAgIHJldHVybiAxO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByZXNzaW9ucy5sZW5ndGggKyBzdHJpbmdzLmxlbmd0aDtcbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0aGUgZmluYWwgaW5zdHJ1Y3Rpb24gY2FsbCBzdGF0ZW1lbnRzIGJhc2VkIG9uIHRoZSBwYXNzZWQgaW4gY29uZmlndXJhdGlvbi5cbiAqIFdpbGwgdHJ5IHRvIGNoYWluIGluc3RydWN0aW9ucyBhcyBtdWNoIGFzIHBvc3NpYmxlLCBpZiBjaGFpbmluZyBpcyBzdXBwb3J0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMoaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgbGV0IHBlbmRpbmdFeHByZXNzaW9uOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gIGxldCBwZW5kaW5nRXhwcmVzc2lvblR5cGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8bnVsbCA9IG51bGw7XG4gIGxldCBjaGFpbkxlbmd0aCA9IDA7XG5cbiAgZm9yIChjb25zdCBjdXJyZW50IG9mIGluc3RydWN0aW9ucykge1xuICAgIGNvbnN0IHJlc29sdmVkUGFyYW1zID1cbiAgICAgICAgKHR5cGVvZiBjdXJyZW50LnBhcmFtc09yRm4gPT09ICdmdW5jdGlvbicgPyBjdXJyZW50LnBhcmFtc09yRm4oKSA6IGN1cnJlbnQucGFyYW1zT3JGbikgPz9cbiAgICAgICAgW107XG4gICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShyZXNvbHZlZFBhcmFtcykgPyByZXNvbHZlZFBhcmFtcyA6IFtyZXNvbHZlZFBhcmFtc107XG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBpbnN0cnVjdGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgcHJldmlvdXMgb25lXG4gICAgLy8gYW5kIGl0IGNhbiBiZSBjaGFpbmVkLCBhZGQgYW5vdGhlciBjYWxsIHRvIHRoZSBjaGFpbi5cbiAgICBpZiAoY2hhaW5MZW5ndGggPCBNQVhfQ0hBSU5fTEVOR1RIICYmIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9PT0gY3VycmVudC5yZWZlcmVuY2UgJiZcbiAgICAgICAgQ0hBSU5BQkxFX0lOU1RSVUNUSU9OUy5oYXMocGVuZGluZ0V4cHJlc3Npb25UeXBlKSkge1xuICAgICAgLy8gV2UnbGwgYWx3YXlzIGhhdmUgYSBwZW5kaW5nIGV4cHJlc3Npb24gd2hlbiB0aGVyZSdzIGEgcGVuZGluZyBleHByZXNzaW9uIHR5cGUuXG4gICAgICBwZW5kaW5nRXhwcmVzc2lvbiA9IHBlbmRpbmdFeHByZXNzaW9uIS5jYWxsRm4ocGFyYW1zLCBwZW5kaW5nRXhwcmVzc2lvbiEuc291cmNlU3Bhbik7XG4gICAgICBjaGFpbkxlbmd0aCsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICAgICAgc3RhdGVtZW50cy5wdXNoKHBlbmRpbmdFeHByZXNzaW9uLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uID0gaW52b2tlSW5zdHJ1Y3Rpb24oY3VycmVudC5zcGFuLCBjdXJyZW50LnJlZmVyZW5jZSwgcGFyYW1zKTtcbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uVHlwZSA9IGN1cnJlbnQucmVmZXJlbmNlO1xuICAgICAgY2hhaW5MZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNpbmNlIHRoZSBjdXJyZW50IGluc3RydWN0aW9uIGFkZHMgdGhlIHByZXZpb3VzIG9uZSB0byB0aGUgc3RhdGVtZW50cyxcbiAgLy8gd2UgbWF5IGJlIGxlZnQgd2l0aCB0aGUgZmluYWwgb25lIGF0IHRoZSBlbmQgdGhhdCBpcyBzdGlsbCBwZW5kaW5nLlxuICBpZiAocGVuZGluZ0V4cHJlc3Npb24gIT09IG51bGwpIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gocGVuZGluZ0V4cHJlc3Npb24udG9TdG10KCkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG4iXX0=