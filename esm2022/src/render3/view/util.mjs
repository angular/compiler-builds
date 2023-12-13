/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDakQsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUU3QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0MsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUlwRCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRzVDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyxNQUFNLENBQUM7QUFFcEQsdURBQXVEO0FBQ3ZELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFFbkMsb0VBQW9FO0FBQ3BFLE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7QUFFbEMsNkRBQTZEO0FBQzdELE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFFakMscUNBQXFDO0FBQ3JDLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUVyQyxpREFBaUQ7QUFDakQsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0FBRTlDLG1DQUFtQztBQUNuQyxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUM7QUFFakQsc0ZBQXNGO0FBQ3RGLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLGFBQWEsQ0FBQztBQUV4RCwwRUFBMEU7QUFDMUUsTUFBTSxDQUFDLE1BQU0sd0JB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LENBQUM7SUFFRCx5RUFBeUU7SUFDekUsc0VBQXNFO0lBQ3RFLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDL0IsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7QmluZGluZ1R5cGUsIEludGVycG9sYXRpb259IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge3NwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7Rm9yd2FyZFJlZkhhbmRsaW5nfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7aXNJMThuQXR0cmlidXRlfSBmcm9tICcuL2kxOG4vdXRpbCc7XG5cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhbiBvYmplY3Qga2V5IGNvbnRhaW5zIHBvdGVudGlhbGx5IHVuc2FmZSBjaGFycywgdGh1cyB0aGUga2V5IHNob3VsZCBiZSB3cmFwcGVkIGluXG4gKiBxdW90ZXMuIE5vdGU6IHdlIGRvIG5vdCB3cmFwIGFsbCBrZXlzIGludG8gcXVvdGVzLCBhcyBpdCBtYXkgaGF2ZSBpbXBhY3Qgb24gbWluaWZpY2F0aW9uIGFuZCBtYXlcbiAqIG5vdCB3b3JrIGluIHNvbWUgY2FzZXMgd2hlbiBvYmplY3Qga2V5cyBhcmUgbWFuZ2xlZCBieSBhIG1pbmlmaWVyLlxuICpcbiAqIFRPRE8oRlctMTEzNik6IHRoaXMgaXMgYSB0ZW1wb3Jhcnkgc29sdXRpb24sIHdlIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIHdheSBvZiB3b3JraW5nIHdpdGhcbiAqIGlucHV0cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJzLlxuICovXG5leHBvcnQgY29uc3QgVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAgPSAvWy0uXS87XG5cbi8qKiBOYW1lIG9mIHRoZSB0ZW1wb3JhcnkgdG8gdXNlIGR1cmluZyBkYXRhIGJpbmRpbmcgKi9cbmV4cG9ydCBjb25zdCBURU1QT1JBUllfTkFNRSA9ICdfdCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBjb250ZXh0IHBhcmFtZXRlciBwYXNzZWQgaW50byBhIHRlbXBsYXRlIGZ1bmN0aW9uICovXG5leHBvcnQgY29uc3QgQ09OVEVYVF9OQU1FID0gJ2N0eCc7XG5cbi8qKiBOYW1lIG9mIHRoZSBSZW5kZXJGbGFnIHBhc3NlZCBpbnRvIGEgdGVtcGxhdGUgZnVuY3Rpb24gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJfRkxBR1MgPSAncmYnO1xuXG4vKiogVGhlIHByZWZpeCByZWZlcmVuY2UgdmFyaWFibGVzICovXG5leHBvcnQgY29uc3QgUkVGRVJFTkNFX1BSRUZJWCA9ICdfcic7XG5cbi8qKiBUaGUgbmFtZSBvZiB0aGUgaW1wbGljaXQgY29udGV4dCByZWZlcmVuY2UgKi9cbmV4cG9ydCBjb25zdCBJTVBMSUNJVF9SRUZFUkVOQ0UgPSAnJGltcGxpY2l0JztcblxuLyoqIE5vbiBiaW5kYWJsZSBhdHRyaWJ1dGUgbmFtZSAqKi9cbmV4cG9ydCBjb25zdCBOT05fQklOREFCTEVfQVRUUiA9ICduZ05vbkJpbmRhYmxlJztcblxuLyoqIE5hbWUgZm9yIHRoZSB2YXJpYWJsZSBrZWVwaW5nIHRyYWNrIG9mIHRoZSBjb250ZXh0IHJldHVybmVkIGJ5IGDJtcm1cmVzdG9yZVZpZXdgLiAqL1xuZXhwb3J0IGNvbnN0IFJFU1RPUkVEX1ZJRVdfQ09OVEVYVF9OQU1FID0gJ3Jlc3RvcmVkQ3R4JztcblxuLyoqIFNwZWNpYWwgdmFsdWUgcmVwcmVzZW50aW5nIGEgZGlyZWN0IGFjY2VzcyB0byBhIHRlbXBsYXRlJ3MgY29udGV4dC4gKi9cbmV4cG9ydCBjb25zdCBESVJFQ1RfQ09OVEVYVF9SRUZFUkVOQ0UgPSAnI2NvbnRleHQnO1xuXG4vKipcbiAqIE1heGltdW0gbGVuZ3RoIG9mIGEgc2luZ2xlIGluc3RydWN0aW9uIGNoYWluLiBCZWNhdXNlIG91ciBvdXRwdXQgQVNUIHVzZXMgcmVjdXJzaW9uLCB3ZSdyZVxuICogbGltaXRlZCBpbiBob3cgbWFueSBleHByZXNzaW9ucyB3ZSBjYW4gbmVzdCBiZWZvcmUgd2UgcmVhY2ggdGhlIGNhbGwgc3RhY2sgbGltaXQuIFRoaXNcbiAqIGxlbmd0aCBpcyBzZXQgdmVyeSBjb25zZXJ2YXRpdmVseSBpbiBvcmRlciB0byByZWR1Y2UgdGhlIGNoYW5jZSBvZiBwcm9ibGVtcy5cbiAqL1xuY29uc3QgTUFYX0NIQUlOX0xFTkdUSCA9IDUwMDtcblxuLyoqIEluc3RydWN0aW9ucyB0aGF0IHN1cHBvcnQgY2hhaW5pbmcuICovXG5jb25zdCBDSEFJTkFCTEVfSU5TVFJVQ1RJT05TID0gbmV3IFNldChbXG4gIFIzLmVsZW1lbnQsXG4gIFIzLmVsZW1lbnRTdGFydCxcbiAgUjMuZWxlbWVudEVuZCxcbiAgUjMuZWxlbWVudENvbnRhaW5lcixcbiAgUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0LFxuICBSMy5lbGVtZW50Q29udGFpbmVyRW5kLFxuICBSMy5pMThuRXhwLFxuICBSMy5saXN0ZW5lcixcbiAgUjMuY2xhc3NQcm9wLFxuICBSMy5zeW50aGV0aWNIb3N0TGlzdGVuZXIsXG4gIFIzLmhvc3RQcm9wZXJ0eSxcbiAgUjMuc3ludGhldGljSG9zdFByb3BlcnR5LFxuICBSMy5wcm9wZXJ0eSxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTEsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlMyxcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTQsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlNixcbiAgUjMucHJvcGVydHlJbnRlcnBvbGF0ZTcsXG4gIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBSMy5wcm9wZXJ0eUludGVycG9sYXRlVixcbiAgUjMuYXR0cmlidXRlLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMixcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUzLFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNSxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2LFxuICBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlOCxcbiAgUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBSMy5zdHlsZVByb3AsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlMSxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTMsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNCxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZTYsXG4gIFIzLnN0eWxlUHJvcEludGVycG9sYXRlNyxcbiAgUjMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBSMy5zdHlsZVByb3BJbnRlcnBvbGF0ZVYsXG4gIFIzLnRleHRJbnRlcnBvbGF0ZSxcbiAgUjMudGV4dEludGVycG9sYXRlMSxcbiAgUjMudGV4dEludGVycG9sYXRlMixcbiAgUjMudGV4dEludGVycG9sYXRlMyxcbiAgUjMudGV4dEludGVycG9sYXRlNCxcbiAgUjMudGV4dEludGVycG9sYXRlNSxcbiAgUjMudGV4dEludGVycG9sYXRlNixcbiAgUjMudGV4dEludGVycG9sYXRlNyxcbiAgUjMudGV4dEludGVycG9sYXRlOCxcbiAgUjMudGV4dEludGVycG9sYXRlVixcbiAgUjMudGVtcGxhdGVDcmVhdGUsXG5dKTtcblxuLyoqXG4gKiBQb3NzaWJsZSB0eXBlcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGdlbmVyYXRlIHRoZSBwYXJhbWV0ZXJzIG9mIGFuIGluc3RydWN0aW9uIGNhbGwuXG4gKiBJZiB0aGUgcGFyYW1ldGVycyBhcmUgYSBmdW5jdGlvbiwgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgaW52b2tlZCBhdCB0aGUgdGltZSB0aGUgaW5zdHJ1Y3Rpb25cbiAqIGlzIGdlbmVyYXRlZC5cbiAqL1xuZXhwb3J0IHR5cGUgSW5zdHJ1Y3Rpb25QYXJhbXMgPSAoby5FeHByZXNzaW9ufG8uRXhwcmVzc2lvbltdKXwoKCkgPT4gKG8uRXhwcmVzc2lvbnxvLkV4cHJlc3Npb25bXSkpO1xuXG4vKiogTmVjZXNzYXJ5IGluZm9ybWF0aW9uIHRvIGdlbmVyYXRlIGEgY2FsbCB0byBhbiBpbnN0cnVjdGlvbiBmdW5jdGlvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5zdHJ1Y3Rpb24ge1xuICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuICBwYXJhbXNPckZuPzogSW5zdHJ1Y3Rpb25QYXJhbXM7XG59XG5cbi8qKiBHZW5lcmF0ZXMgYSBjYWxsIHRvIGEgc2luZ2xlIGluc3RydWN0aW9uLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGludm9rZUluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFsbG9jYXRvciBmb3IgYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gKlxuICogQSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBpcyBhZGRlZCB0byB0aGUgc3RhdGVtZW50cyB0aGUgZmlyc3QgdGltZSB0aGUgYWxsb2NhdG9yIGlzIGludm9rZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wb3JhcnlBbGxvY2F0b3Ioc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgbmFtZTogc3RyaW5nKTogKCkgPT4gby5SZWFkVmFyRXhwciB7XG4gIGxldCB0ZW1wOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGlmICghdGVtcCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKG5ldyBvLkRlY2xhcmVWYXJTdG10KFRFTVBPUkFSWV9OQU1FLCB1bmRlZmluZWQsIG8uRFlOQU1JQ19UWVBFKSk7XG4gICAgICB0ZW1wID0gby52YXJpYWJsZShuYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXA7XG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGludmFsaWQ8VD4odGhpczogdC5WaXNpdG9yLCBhcmc6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHx0Lk5vZGUpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIHN0YXRlOiBWaXNpdG9yICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IGhhbmRsZSAke2FyZy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNMaXRlcmFsKHZhbHVlOiBhbnkpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlLm1hcChhc0xpdGVyYWwpKTtcbiAgfVxuICByZXR1cm4gby5saXRlcmFsKHZhbHVlLCBvLklORkVSUkVEX1RZUEUpO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgaW5wdXRzIGFuZCBvdXRwdXRzIGZvciBgZGVmaW5lRGlyZWN0aXZlYCBhbmQgYGRlZmluZUNvbXBvbmVudGAuXG4gKlxuICogVGhpcyB3aWxsIGF0dGVtcHQgdG8gZ2VuZXJhdGUgb3B0aW1pemVkIGRhdGEgc3RydWN0dXJlcyB0byBtaW5pbWl6ZSBtZW1vcnkgb3JcbiAqIGZpbGUgc2l6ZSBvZiBmdWxseSBjb21waWxlZCBhcHBsaWNhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwoXG4gICAgbWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmd8e1xuICAgICAgY2xhc3NQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIGJpbmRpbmdQcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgICAgIHRyYW5zZm9ybUZ1bmN0aW9uOiBvLkV4cHJlc3Npb258bnVsbDtcbiAgICB9Piwga2VlcERlY2xhcmVkPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG1hcCk7XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gby5saXRlcmFsTWFwKGtleXMubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBtYXBba2V5XTtcbiAgICBsZXQgZGVjbGFyZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IHB1YmxpY05hbWU6IHN0cmluZztcbiAgICBsZXQgbWluaWZpZWROYW1lOiBzdHJpbmc7XG4gICAgbGV0IGV4cHJlc3Npb25WYWx1ZTogby5FeHByZXNzaW9uO1xuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIGNhbm9uaWNhbCBzeW50YXg6IGBkaXJQcm9wOiBwdWJsaWNQcm9wYFxuICAgICAgZGVjbGFyZWROYW1lID0ga2V5O1xuICAgICAgbWluaWZpZWROYW1lID0ga2V5O1xuICAgICAgcHVibGljTmFtZSA9IHZhbHVlO1xuICAgICAgZXhwcmVzc2lvblZhbHVlID0gYXNMaXRlcmFsKHB1YmxpY05hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW5pZmllZE5hbWUgPSBrZXk7XG4gICAgICBkZWNsYXJlZE5hbWUgPSB2YWx1ZS5jbGFzc1Byb3BlcnR5TmFtZTtcbiAgICAgIHB1YmxpY05hbWUgPSB2YWx1ZS5iaW5kaW5nUHJvcGVydHlOYW1lO1xuXG4gICAgICBpZiAoa2VlcERlY2xhcmVkICYmIChwdWJsaWNOYW1lICE9PSBkZWNsYXJlZE5hbWUgfHwgdmFsdWUudHJhbnNmb3JtRnVuY3Rpb24gIT0gbnVsbCkpIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbktleXMgPSBbYXNMaXRlcmFsKHB1YmxpY05hbWUpLCBhc0xpdGVyYWwoZGVjbGFyZWROYW1lKV07XG5cbiAgICAgICAgaWYgKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uICE9IG51bGwpIHtcbiAgICAgICAgICBleHByZXNzaW9uS2V5cy5wdXNoKHZhbHVlLnRyYW5zZm9ybUZ1bmN0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHJlc3Npb25WYWx1ZSA9IG8ubGl0ZXJhbEFycihleHByZXNzaW9uS2V5cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHByZXNzaW9uVmFsdWUgPSBhc0xpdGVyYWwocHVibGljTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogbWluaWZpZWROYW1lLFxuICAgICAgLy8gcHV0IHF1b3RlcyBhcm91bmQga2V5cyB0aGF0IGNvbnRhaW4gcG90ZW50aWFsbHkgdW5zYWZlIGNoYXJhY3RlcnNcbiAgICAgIHF1b3RlZDogVU5TQUZFX09CSkVDVF9LRVlfTkFNRV9SRUdFWFAudGVzdChtaW5pZmllZE5hbWUpLFxuICAgICAgdmFsdWU6IGV4cHJlc3Npb25WYWx1ZSxcbiAgICB9O1xuICB9KSk7XG59XG5cbi8qKlxuICogIFJlbW92ZSB0cmFpbGluZyBudWxsIG5vZGVzIGFzIHRoZXkgYXJlIGltcGxpZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgd2hpbGUgKG8uaXNOdWxsKHBhcmFtZXRlcnNbcGFyYW1ldGVycy5sZW5ndGggLSAxXSkpIHtcbiAgICBwYXJhbWV0ZXJzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlQcmVkaWNhdGUoXG4gICAgcXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5wcmVkaWNhdGUpKSB7XG4gICAgbGV0IHByZWRpY2F0ZTogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBxdWVyeS5wcmVkaWNhdGUuZm9yRWFjaCgoc2VsZWN0b3I6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgLy8gRWFjaCBpdGVtIGluIHByZWRpY2F0ZXMgYXJyYXkgbWF5IGNvbnRhaW4gc3RyaW5ncyB3aXRoIGNvbW1hLXNlcGFyYXRlZCByZWZzXG4gICAgICAvLyAoZm9yIGV4LiAncmVmLCByZWYxLCAuLi4sIHJlZk4nKSwgdGh1cyB3ZSBleHRyYWN0IGluZGl2aWR1YWwgcmVmcyBhbmQgc3RvcmUgdGhlbVxuICAgICAgLy8gYXMgc2VwYXJhdGUgYXJyYXkgZW50aXRpZXNcbiAgICAgIGNvbnN0IHNlbGVjdG9ycyA9IHNlbGVjdG9yLnNwbGl0KCcsJykubWFwKHRva2VuID0+IG8ubGl0ZXJhbCh0b2tlbi50cmltKCkpKTtcbiAgICAgIHByZWRpY2F0ZS5wdXNoKC4uLnNlbGVjdG9ycyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKHByZWRpY2F0ZSksIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoZSBvcmlnaW5hbCBwcmVkaWNhdGUgbWF5IGhhdmUgYmVlbiB3cmFwcGVkIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbC5cbiAgICBzd2l0Y2ggKHF1ZXJ5LnByZWRpY2F0ZS5mb3J3YXJkUmVmKSB7XG4gICAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5Ob25lOlxuICAgICAgY2FzZSBGb3J3YXJkUmVmSGFuZGxpbmcuVW53cmFwcGVkOlxuICAgICAgICByZXR1cm4gcXVlcnkucHJlZGljYXRlLmV4cHJlc3Npb247XG4gICAgICBjYXNlIEZvcndhcmRSZWZIYW5kbGluZy5XcmFwcGVkOlxuICAgICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnJlc29sdmVGb3J3YXJkUmVmKS5jYWxsRm4oW3F1ZXJ5LnByZWRpY2F0ZS5leHByZXNzaW9uXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQSByZXByZXNlbnRhdGlvbiBmb3IgYW4gb2JqZWN0IGxpdGVyYWwgdXNlZCBkdXJpbmcgY29kZWdlbiBvZiBkZWZpbml0aW9uIG9iamVjdHMuIFRoZSBnZW5lcmljXG4gKiB0eXBlIGBUYCBhbGxvd3MgdG8gcmVmZXJlbmNlIGEgZG9jdW1lbnRlZCB0eXBlIG9mIHRoZSBnZW5lcmF0ZWQgc3RydWN0dXJlLCBzdWNoIHRoYXQgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGFyZSBzZXQgY2FuIGJlIHJlc29sdmVkIHRvIHRoZWlyIGRvY3VtZW50ZWQgZGVjbGFyYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWZpbml0aW9uTWFwPFQgPSBhbnk+IHtcbiAgdmFsdWVzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbiwgdmFsdWU6IG8uRXhwcmVzc2lvbn1bXSA9IFtdO1xuXG4gIHNldChrZXk6IGtleW9mIFQsIHZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCk6IHZvaWQge1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnZhbHVlcy5maW5kKHZhbHVlID0+IHZhbHVlLmtleSA9PT0ga2V5KTtcblxuICAgICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICAgIGV4aXN0aW5nLnZhbHVlID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnZhbHVlcy5wdXNoKHtrZXk6IGtleSBhcyBzdHJpbmcsIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9MaXRlcmFsTWFwKCk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICAgIHJldHVybiBvLmxpdGVyYWxNYXAodGhpcy52YWx1ZXMpO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZnJvbSBhbiBBU1Qgbm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yRnJvbU5vZGUobm9kZTogdC5FbGVtZW50fHQuVGVtcGxhdGUpOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGVsZW1lbnROYW1lID0gbm9kZSBpbnN0YW5jZW9mIHQuRWxlbWVudCA/IG5vZGUubmFtZSA6ICduZy10ZW1wbGF0ZSc7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpO1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICBjb25zdCBlbGVtZW50TmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbGVtZW50TmFtZU5vTnMpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCBuYW1lTm9OcyA9IHNwbGl0TnNOYW1lKG5hbWUpWzFdO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lTm9OcywgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgYSBtYXAgb2YgcHJvcGVydGllcyB0byB2YWx1ZXMgZm9yIGEgZ2l2ZW4gZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLCB3aGljaCBjYW4gYmUgdXNlZFxuICogYnkgdGhlIGRpcmVjdGl2ZSBtYXRjaGluZyBtYWNoaW5lcnkuXG4gKlxuICogQHBhcmFtIGVsT3JUcGwgdGhlIGVsZW1lbnQgb3IgdGVtcGxhdGUgaW4gcXVlc3Rpb25cbiAqIEByZXR1cm4gYW4gb2JqZWN0IHNldCB1cCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLiBGb3IgYXR0cmlidXRlcyBvbiB0aGUgZWxlbWVudC90ZW1wbGF0ZSwgdGhpc1xuICogb2JqZWN0IG1hcHMgYSBwcm9wZXJ0eSBuYW1lIHRvIGl0cyAoc3RhdGljKSB2YWx1ZS4gRm9yIGFueSBiaW5kaW5ncywgdGhpcyBtYXAgc2ltcGx5IG1hcHMgdGhlXG4gKiBwcm9wZXJ0eSBuYW1lIHRvIGFuIGVtcHR5IHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSB7XG4gIGNvbnN0IGF0dHJpYnV0ZXNNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG5cbiAgaWYgKGVsT3JUcGwgaW5zdGFuY2VvZiB0LlRlbXBsYXRlICYmIGVsT3JUcGwudGFnTmFtZSAhPT0gJ25nLXRlbXBsYXRlJykge1xuICAgIGVsT3JUcGwudGVtcGxhdGVBdHRycy5mb3JFYWNoKGEgPT4gYXR0cmlidXRlc01hcFthLm5hbWVdID0gJycpO1xuICB9IGVsc2Uge1xuICAgIGVsT3JUcGwuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgaWYgKCFpc0kxOG5BdHRyaWJ1dGUoYS5uYW1lKSkge1xuICAgICAgICBhdHRyaWJ1dGVzTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZWxPclRwbC5pbnB1dHMuZm9yRWFjaChpID0+IHtcbiAgICAgIGlmIChpLnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgIGF0dHJpYnV0ZXNNYXBbaS5uYW1lXSA9ICcnO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGVsT3JUcGwub3V0cHV0cy5mb3JFYWNoKG8gPT4ge1xuICAgICAgYXR0cmlidXRlc01hcFtvLm5hbWVdID0gJyc7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gYXR0cmlidXRlc01hcDtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIGV4cGVjdGVkIHRvIGJlIHBhc3NlZCB0byBhIGdlbmVyYXRlZCBpbnN0cnVjdGlvbiBpbiB0aGUgY2FzZSBvZlxuICogaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbnMuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBpbnRlcnBvbGF0aW9uIGFzdFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBjb25zdCB7ZXhwcmVzc2lvbnMsIHN0cmluZ3N9ID0gaW50ZXJwb2xhdGlvbjtcbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzLmxlbmd0aCA9PT0gMiAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIC8vIElmIHRoZSBpbnRlcnBvbGF0aW9uIGhhcyBvbmUgaW50ZXJwb2xhdGVkIHZhbHVlLCBidXQgdGhlIHByZWZpeCBhbmQgc3VmZml4IGFyZSBib3RoIGVtcHR5XG4gICAgLy8gc3RyaW5ncywgd2Ugb25seSBwYXNzIG9uZSBhcmd1bWVudCwgdG8gYSBzcGVjaWFsIGluc3RydWN0aW9uIGxpa2UgYHByb3BlcnR5SW50ZXJwb2xhdGVgIG9yXG4gICAgLy8gYHRleHRJbnRlcnBvbGF0ZWAuXG4gICAgcmV0dXJuIDE7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25zLmxlbmd0aCArIHN0cmluZ3MubGVuZ3RoO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIHRoZSBmaW5hbCBpbnN0cnVjdGlvbiBjYWxsIHN0YXRlbWVudHMgYmFzZWQgb24gdGhlIHBhc3NlZCBpbiBjb25maWd1cmF0aW9uLlxuICogV2lsbCB0cnkgdG8gY2hhaW4gaW5zdHJ1Y3Rpb25zIGFzIG11Y2ggYXMgcG9zc2libGUsIGlmIGNoYWluaW5nIGlzIHN1cHBvcnRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RydWN0aW9uU3RhdGVtZW50cyhpbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBsZXQgcGVuZGluZ0V4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgbGV0IHBlbmRpbmdFeHByZXNzaW9uVHlwZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsID0gbnVsbDtcbiAgbGV0IGNoYWluTGVuZ3RoID0gMDtcblxuICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgaW5zdHJ1Y3Rpb25zKSB7XG4gICAgY29uc3QgcmVzb2x2ZWRQYXJhbXMgPVxuICAgICAgICAodHlwZW9mIGN1cnJlbnQucGFyYW1zT3JGbiA9PT0gJ2Z1bmN0aW9uJyA/IGN1cnJlbnQucGFyYW1zT3JGbigpIDogY3VycmVudC5wYXJhbXNPckZuKSA/P1xuICAgICAgICBbXTtcbiAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHJlc29sdmVkUGFyYW1zKSA/IHJlc29sdmVkUGFyYW1zIDogW3Jlc29sdmVkUGFyYW1zXTtcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IGluc3RydWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBwcmV2aW91cyBvbmVcbiAgICAvLyBhbmQgaXQgY2FuIGJlIGNoYWluZWQsIGFkZCBhbm90aGVyIGNhbGwgdG8gdGhlIGNoYWluLlxuICAgIGlmIChjaGFpbkxlbmd0aCA8IE1BWF9DSEFJTl9MRU5HVEggJiYgcGVuZGluZ0V4cHJlc3Npb25UeXBlID09PSBjdXJyZW50LnJlZmVyZW5jZSAmJlxuICAgICAgICBDSEFJTkFCTEVfSU5TVFJVQ1RJT05TLmhhcyhwZW5kaW5nRXhwcmVzc2lvblR5cGUpKSB7XG4gICAgICAvLyBXZSdsbCBhbHdheXMgaGF2ZSBhIHBlbmRpbmcgZXhwcmVzc2lvbiB3aGVuIHRoZXJlJ3MgYSBwZW5kaW5nIGV4cHJlc3Npb24gdHlwZS5cbiAgICAgIHBlbmRpbmdFeHByZXNzaW9uID0gcGVuZGluZ0V4cHJlc3Npb24hLmNhbGxGbihwYXJhbXMsIHBlbmRpbmdFeHByZXNzaW9uIS5zb3VyY2VTcGFuKTtcbiAgICAgIGNoYWluTGVuZ3RoKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZW5kaW5nRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgICAgICBzdGF0ZW1lbnRzLnB1c2gocGVuZGluZ0V4cHJlc3Npb24udG9TdG10KCkpO1xuICAgICAgfVxuICAgICAgcGVuZGluZ0V4cHJlc3Npb24gPSBpbnZva2VJbnN0cnVjdGlvbihjdXJyZW50LnNwYW4sIGN1cnJlbnQucmVmZXJlbmNlLCBwYXJhbXMpO1xuICAgICAgcGVuZGluZ0V4cHJlc3Npb25UeXBlID0gY3VycmVudC5yZWZlcmVuY2U7XG4gICAgICBjaGFpbkxlbmd0aCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLy8gU2luY2UgdGhlIGN1cnJlbnQgaW5zdHJ1Y3Rpb24gYWRkcyB0aGUgcHJldmlvdXMgb25lIHRvIHRoZSBzdGF0ZW1lbnRzLFxuICAvLyB3ZSBtYXkgYmUgbGVmdCB3aXRoIHRoZSBmaW5hbCBvbmUgYXQgdGhlIGVuZCB0aGF0IGlzIHN0aWxsIHBlbmRpbmcuXG4gIGlmIChwZW5kaW5nRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgIHN0YXRlbWVudHMucHVzaChwZW5kaW5nRXhwcmVzc2lvbi50b1N0bXQoKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cbiJdfQ==