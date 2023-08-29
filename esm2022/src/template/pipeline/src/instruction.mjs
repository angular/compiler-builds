/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../output/output_ast';
import { Identifiers } from '../../../render3/r3_identifiers';
import * as ir from '../ir';
// This file contains helpers for generating calls to Ivy instructions. In particular, each
// instruction type is represented as a function, which may select a specific instruction variant
// depending on the exact arguments.
export function element(slot, tag, constIndex, localRefIndex, sourceSpan) {
    return elementOrContainerBase(Identifiers.element, slot, tag, constIndex, localRefIndex, sourceSpan);
}
export function elementStart(slot, tag, constIndex, localRefIndex, sourceSpan) {
    return elementOrContainerBase(Identifiers.elementStart, slot, tag, constIndex, localRefIndex, sourceSpan);
}
function elementOrContainerBase(instruction, slot, tag, constIndex, localRefIndex, sourceSpan) {
    const args = [o.literal(slot)];
    if (tag !== null) {
        args.push(o.literal(tag));
    }
    if (localRefIndex !== null) {
        args.push(o.literal(constIndex), // might be null, but that's okay.
        o.literal(localRefIndex));
    }
    else if (constIndex !== null) {
        args.push(o.literal(constIndex));
    }
    return call(instruction, args, sourceSpan);
}
export function elementEnd(sourceSpan) {
    return call(Identifiers.elementEnd, [], sourceSpan);
}
export function elementContainerStart(slot, constIndex, localRefIndex, sourceSpan) {
    return elementOrContainerBase(Identifiers.elementContainerStart, slot, /* tag */ null, constIndex, localRefIndex, sourceSpan);
}
export function elementContainer(slot, constIndex, localRefIndex, sourceSpan) {
    return elementOrContainerBase(Identifiers.elementContainer, slot, /* tag */ null, constIndex, localRefIndex, sourceSpan);
}
export function elementContainerEnd() {
    return call(Identifiers.elementContainerEnd, [], null);
}
export function template(slot, templateFnRef, decls, vars, tag, constIndex, sourceSpan) {
    const args = [o.literal(slot), templateFnRef, o.literal(decls), o.literal(vars)];
    if (tag != null && constIndex != null) {
        args.push(o.literal(tag), o.literal(constIndex));
    }
    return call(Identifiers.templateCreate, args, sourceSpan);
}
export function disableBindings() {
    return call(Identifiers.disableBindings, [], null);
}
export function enableBindings() {
    return call(Identifiers.enableBindings, [], null);
}
export function listener(name, handlerFn) {
    return call(Identifiers.listener, [
        o.literal(name),
        handlerFn,
    ], null);
}
export function syntheticHostListener(name, handlerFn) {
    return call(Identifiers.syntheticHostListener, [
        o.literal(name),
        handlerFn,
    ], null);
}
export function pipe(slot, name) {
    return call(Identifiers.pipe, [
        o.literal(slot),
        o.literal(name),
    ], null);
}
export function namespaceHTML() {
    return call(Identifiers.namespaceHTML, [], null);
}
export function namespaceSVG() {
    return call(Identifiers.namespaceSVG, [], null);
}
export function namespaceMath() {
    return call(Identifiers.namespaceMathML, [], null);
}
export function advance(delta, sourceSpan) {
    return call(Identifiers.advance, [
        o.literal(delta),
    ], sourceSpan);
}
export function reference(slot) {
    return o.importExpr(Identifiers.reference).callFn([
        o.literal(slot),
    ]);
}
export function nextContext(steps) {
    return o.importExpr(Identifiers.nextContext).callFn(steps === 1 ? [] : [o.literal(steps)]);
}
export function getCurrentView() {
    return o.importExpr(Identifiers.getCurrentView).callFn([]);
}
export function restoreView(savedView) {
    return o.importExpr(Identifiers.restoreView).callFn([
        savedView,
    ]);
}
export function resetView(returnValue) {
    return o.importExpr(Identifiers.resetView).callFn([
        returnValue,
    ]);
}
export function text(slot, initialValue, sourceSpan) {
    const args = [o.literal(slot, null)];
    if (initialValue !== '') {
        args.push(o.literal(initialValue));
    }
    return call(Identifiers.text, args, sourceSpan);
}
export function i18nStart(slot, constIndex) {
    return call(Identifiers.i18nStart, [o.literal(slot), o.literal(constIndex)], null);
}
export function i18n(slot) {
    return call(Identifiers.i18n, [o.literal(slot)], null);
}
export function i18nEnd() {
    return call(Identifiers.i18nEnd, [], null);
}
export function property(name, expression, sanitizer, sourceSpan) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null) {
        args.push(sanitizer);
    }
    return call(Identifiers.property, args, sourceSpan);
}
export function attribute(name, expression, sanitizer) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null) {
        args.push(sanitizer);
    }
    return call(Identifiers.attribute, args, null);
}
export function styleProp(name, expression, unit) {
    const args = [o.literal(name), expression];
    if (unit !== null) {
        args.push(o.literal(unit));
    }
    return call(Identifiers.styleProp, args, null);
}
export function classProp(name, expression) {
    return call(Identifiers.classProp, [o.literal(name), expression], null);
}
export function styleMap(expression) {
    return call(Identifiers.styleMap, [expression], null);
}
export function classMap(expression) {
    return call(Identifiers.classMap, [expression], null);
}
const PIPE_BINDINGS = [
    Identifiers.pipeBind1,
    Identifiers.pipeBind2,
    Identifiers.pipeBind3,
    Identifiers.pipeBind4,
];
export function pipeBind(slot, varOffset, args) {
    if (args.length < 1 || args.length > PIPE_BINDINGS.length) {
        throw new Error(`pipeBind() argument count out of bounds`);
    }
    const instruction = PIPE_BINDINGS[args.length - 1];
    return o.importExpr(instruction).callFn([
        o.literal(slot),
        o.literal(varOffset),
        ...args,
    ]);
}
export function pipeBindV(slot, varOffset, args) {
    return o.importExpr(Identifiers.pipeBindV).callFn([
        o.literal(slot),
        o.literal(varOffset),
        args,
    ]);
}
export function textInterpolate(strings, expressions, sourceSpan) {
    if (strings.length < 1 || expressions.length !== strings.length - 1) {
        throw new Error(`AssertionError: expected specific shape of args for strings/expressions in interpolation`);
    }
    const interpolationArgs = [];
    if (expressions.length === 1 && strings[0] === '' && strings[1] === '') {
        interpolationArgs.push(expressions[0]);
    }
    else {
        let idx;
        for (idx = 0; idx < expressions.length; idx++) {
            interpolationArgs.push(o.literal(strings[idx]), expressions[idx]);
        }
        // idx points at the last string.
        interpolationArgs.push(o.literal(strings[idx]));
    }
    return callVariadicInstruction(TEXT_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
export function propertyInterpolate(name, strings, expressions, sanitizer, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (sanitizer !== null) {
        extraArgs.push(sanitizer);
    }
    return callVariadicInstruction(PROPERTY_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
export function attributeInterpolate(name, strings, expressions, sanitizer) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (sanitizer !== null) {
        extraArgs.push(sanitizer);
    }
    return callVariadicInstruction(ATTRIBUTE_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, null);
}
export function stylePropInterpolate(name, strings, expressions, unit) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (unit !== null) {
        extraArgs.push(o.literal(unit));
    }
    return callVariadicInstruction(STYLE_PROP_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, null);
}
export function styleMapInterpolate(strings, expressions) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(STYLE_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], null);
}
export function classMapInterpolate(strings, expressions) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(CLASS_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], null);
}
export function hostProperty(name, expression) {
    return call(Identifiers.hostProperty, [o.literal(name), expression], null);
}
export function syntheticHostProperty(name, expression) {
    return call(Identifiers.syntheticHostProperty, [o.literal(name), expression], null);
}
export function pureFunction(varOffset, fn, args) {
    return callVariadicInstructionExpr(PURE_FUNCTION_CONFIG, [
        o.literal(varOffset),
        fn,
    ], args, [], null);
}
/**
 * Collates the string an expression arguments for an interpolation instruction.
 */
function collateInterpolationArgs(strings, expressions) {
    if (strings.length < 1 || expressions.length !== strings.length - 1) {
        throw new Error(`AssertionError: expected specific shape of args for strings/expressions in interpolation`);
    }
    const interpolationArgs = [];
    if (expressions.length === 1 && strings[0] === '' && strings[1] === '') {
        interpolationArgs.push(expressions[0]);
    }
    else {
        let idx;
        for (idx = 0; idx < expressions.length; idx++) {
            interpolationArgs.push(o.literal(strings[idx]), expressions[idx]);
        }
        // idx points at the last string.
        interpolationArgs.push(o.literal(strings[idx]));
    }
    return interpolationArgs;
}
function call(instruction, args, sourceSpan) {
    const expr = o.importExpr(instruction).callFn(args, sourceSpan);
    return ir.createStatementOp(new o.ExpressionStatement(expr, sourceSpan));
}
export function conditional(slot, condition) {
    return call(Identifiers.conditional, [o.literal(slot), condition], null);
}
/**
 * `InterpolationConfig` for the `textInterpolate` instruction.
 */
const TEXT_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.textInterpolate,
        Identifiers.textInterpolate1,
        Identifiers.textInterpolate2,
        Identifiers.textInterpolate3,
        Identifiers.textInterpolate4,
        Identifiers.textInterpolate5,
        Identifiers.textInterpolate6,
        Identifiers.textInterpolate7,
        Identifiers.textInterpolate8,
    ],
    variable: Identifiers.textInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
/**
 * `InterpolationConfig` for the `propertyInterpolate` instruction.
 */
const PROPERTY_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.propertyInterpolate,
        Identifiers.propertyInterpolate1,
        Identifiers.propertyInterpolate2,
        Identifiers.propertyInterpolate3,
        Identifiers.propertyInterpolate4,
        Identifiers.propertyInterpolate5,
        Identifiers.propertyInterpolate6,
        Identifiers.propertyInterpolate7,
        Identifiers.propertyInterpolate8,
    ],
    variable: Identifiers.propertyInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
/**
 * `InterpolationConfig` for the `stylePropInterpolate` instruction.
 */
const STYLE_PROP_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.styleProp,
        Identifiers.stylePropInterpolate1,
        Identifiers.stylePropInterpolate2,
        Identifiers.stylePropInterpolate3,
        Identifiers.stylePropInterpolate4,
        Identifiers.stylePropInterpolate5,
        Identifiers.stylePropInterpolate6,
        Identifiers.stylePropInterpolate7,
        Identifiers.stylePropInterpolate8,
    ],
    variable: Identifiers.stylePropInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
/**
 * `InterpolationConfig` for the `attributeInterpolate` instruction.
 */
const ATTRIBUTE_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.attribute,
        Identifiers.attributeInterpolate1,
        Identifiers.attributeInterpolate2,
        Identifiers.attributeInterpolate3,
        Identifiers.attributeInterpolate4,
        Identifiers.attributeInterpolate5,
        Identifiers.attributeInterpolate6,
        Identifiers.attributeInterpolate7,
        Identifiers.attributeInterpolate8,
    ],
    variable: Identifiers.attributeInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
/**
 * `InterpolationConfig` for the `styleMapInterpolate` instruction.
 */
const STYLE_MAP_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.styleMap,
        Identifiers.styleMapInterpolate1,
        Identifiers.styleMapInterpolate2,
        Identifiers.styleMapInterpolate3,
        Identifiers.styleMapInterpolate4,
        Identifiers.styleMapInterpolate5,
        Identifiers.styleMapInterpolate6,
        Identifiers.styleMapInterpolate7,
        Identifiers.styleMapInterpolate8,
    ],
    variable: Identifiers.styleMapInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
/**
 * `InterpolationConfig` for the `classMapInterpolate` instruction.
 */
const CLASS_MAP_INTERPOLATE_CONFIG = {
    constant: [
        Identifiers.classMap,
        Identifiers.classMapInterpolate1,
        Identifiers.classMapInterpolate2,
        Identifiers.classMapInterpolate3,
        Identifiers.classMapInterpolate4,
        Identifiers.classMapInterpolate5,
        Identifiers.classMapInterpolate6,
        Identifiers.classMapInterpolate7,
        Identifiers.classMapInterpolate8,
    ],
    variable: Identifiers.classMapInterpolateV,
    mapping: n => {
        if (n % 2 === 0) {
            throw new Error(`Expected odd number of arguments`);
        }
        return (n - 1) / 2;
    },
};
const PURE_FUNCTION_CONFIG = {
    constant: [
        Identifiers.pureFunction0,
        Identifiers.pureFunction1,
        Identifiers.pureFunction2,
        Identifiers.pureFunction3,
        Identifiers.pureFunction4,
        Identifiers.pureFunction5,
        Identifiers.pureFunction6,
        Identifiers.pureFunction7,
        Identifiers.pureFunction8,
    ],
    variable: Identifiers.pureFunctionV,
    mapping: n => n,
};
function callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs, sourceSpan) {
    const n = config.mapping(interpolationArgs.length);
    if (n < config.constant.length) {
        // Constant calling pattern.
        return o.importExpr(config.constant[n])
            .callFn([...baseArgs, ...interpolationArgs, ...extraArgs], sourceSpan);
    }
    else if (config.variable !== null) {
        // Variable calling pattern.
        return o.importExpr(config.variable)
            .callFn([...baseArgs, o.literalArr(interpolationArgs), ...extraArgs], sourceSpan);
    }
    else {
        throw new Error(`AssertionError: unable to call variadic function`);
    }
}
function callVariadicInstruction(config, baseArgs, interpolationArgs, extraArgs, sourceSpan) {
    return ir.createStatementOp(callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs, sourceSpan)
        .toStmt());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtR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QyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQzlCLDRCQUE0QjtRQUM1QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsQyxNQUFNLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxHQUFHLGlCQUFpQixFQUFFLEdBQUcsU0FBUyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7S0FDNUU7U0FBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFO1FBQ25DLDRCQUE0QjtRQUM1QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQzthQUMvQixNQUFNLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztLQUN2RjtTQUFNO1FBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO0tBQ3JFO0FBQ0gsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQzVCLE1BQWlDLEVBQUUsUUFBd0IsRUFBRSxpQkFBaUMsRUFDOUYsU0FBeUIsRUFBRSxVQUFnQztJQUM3RCxPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsQ0FDdkIsMkJBQTJCLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDO1NBQ2xGLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDckIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG4vLyBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVycyBmb3IgZ2VuZXJhdGluZyBjYWxscyB0byBJdnkgaW5zdHJ1Y3Rpb25zLiBJbiBwYXJ0aWN1bGFyLCBlYWNoXG4vLyBpbnN0cnVjdGlvbiB0eXBlIGlzIHJlcHJlc2VudGVkIGFzIGEgZnVuY3Rpb24sIHdoaWNoIG1heSBzZWxlY3QgYSBzcGVjaWZpYyBpbnN0cnVjdGlvbiB2YXJpYW50XG4vLyBkZXBlbmRpbmcgb24gdGhlIGV4YWN0IGFyZ3VtZW50cy5cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnQoXG4gICAgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZywgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFN0YXJ0KFxuICAgIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmcsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudFN0YXJ0LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLFxuICAgIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmICh0YWcgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRhZykpO1xuICB9XG4gIGlmIChsb2NhbFJlZkluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksICAvLyBtaWdodCBiZSBudWxsLCBidXQgdGhhdCdzIG9rYXkuXG4gICAgICAgIG8ubGl0ZXJhbChsb2NhbFJlZkluZGV4KSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGNvbnN0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsKGluc3RydWN0aW9uLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRFbmQoc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRFbmQsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lclN0YXJ0LCBzbG90LCAvKiB0YWcgKi8gbnVsbCwgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lcihcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lciwgc2xvdCwgLyogdGFnICovIG51bGwsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lckVuZCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXJFbmQsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlKFxuICAgIHNsb3Q6IG51bWJlciwgdGVtcGxhdGVGblJlZjogby5FeHByZXNzaW9uLCBkZWNsczogbnVtYmVyLCB2YXJzOiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsXG4gICAgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIHRlbXBsYXRlRm5SZWYsIG8ubGl0ZXJhbChkZWNscyksIG8ubGl0ZXJhbCh2YXJzKV07XG4gIGlmICh0YWcgIT0gbnVsbCAmJiBjb25zdEluZGV4ICE9IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRhZyksIG8ubGl0ZXJhbChjb25zdEluZGV4KSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMudGVtcGxhdGVDcmVhdGUsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZUJpbmRpbmdzKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGlzYWJsZUJpbmRpbmdzLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVCaW5kaW5ncygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVuYWJsZUJpbmRpbmdzLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0ZW5lcihuYW1lOiBzdHJpbmcsIGhhbmRsZXJGbjogby5FeHByZXNzaW9uKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLmxpc3RlbmVyLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICAgIGhhbmRsZXJGbixcbiAgICAgIF0sXG4gICAgICBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRoZXRpY0hvc3RMaXN0ZW5lcihuYW1lOiBzdHJpbmcsIGhhbmRsZXJGbjogby5FeHByZXNzaW9uKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lcixcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgICBoYW5kbGVyRm4sXG4gICAgICBdLFxuICAgICAgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlKHNsb3Q6IG51bWJlciwgbmFtZTogc3RyaW5nKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLnBpcGUsXG4gICAgICBbXG4gICAgICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgXSxcbiAgICAgIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlSFRNTCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZUhUTUwsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5hbWVzcGFjZVNWRygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZVNWRywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlTWF0aCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZU1hdGhNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWR2YW5jZShkZWx0YTogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMuYWR2YW5jZSxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKGRlbHRhKSxcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShzbG90OiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlZmVyZW5jZSkuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV4dENvbnRleHQoc3RlcHM6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubmV4dENvbnRleHQpLmNhbGxGbihzdGVwcyA9PT0gMSA/IFtdIDogW28ubGl0ZXJhbChzdGVwcyldKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFZpZXcoKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5nZXRDdXJyZW50VmlldykuY2FsbEZuKFtdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzdG9yZVZpZXcoc2F2ZWRWaWV3OiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc3RvcmVWaWV3KS5jYWxsRm4oW1xuICAgIHNhdmVkVmlldyxcbiAgXSk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VmlldyhyZXR1cm5WYWx1ZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXNldFZpZXcpLmNhbGxGbihbXG4gICAgcmV0dXJuVmFsdWUsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChcbiAgICBzbG90OiBudW1iZXIsIGluaXRpYWxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QsIG51bGwpXTtcbiAgaWYgKGluaXRpYWxWYWx1ZSAhPT0gJycpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGluaXRpYWxWYWx1ZSkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRleHQsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0KHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuU3RhcnQsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChjb25zdEluZGV4KV0sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bihzbG90OiBudW1iZXIpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG4sIFtvLmxpdGVyYWwoc2xvdCldLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5FbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRW5kLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb3BlcnR5LCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF0dHJpYnV0ZShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuYXR0cmlidXRlLCBhcmdzLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlUHJvcChuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgdW5pdDogc3RyaW5nfG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHVuaXQgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5zdHlsZVByb3AsIGFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NQcm9wKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jbGFzc1Byb3AsIFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlTWFwKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3R5bGVNYXAsIFtleHByZXNzaW9uXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmNsYXNzTWFwLCBbZXhwcmVzc2lvbl0sIG51bGwpO1xufVxuXG5jb25zdCBQSVBFX0JJTkRJTkdTOiBvLkV4dGVybmFsUmVmZXJlbmNlW10gPSBbXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMSxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQyLFxuICBJZGVudGlmaWVycy5waXBlQmluZDMsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kNCxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZChzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhcmdzLmxlbmd0aCA8IDEgfHwgYXJncy5sZW5ndGggPiBQSVBFX0JJTkRJTkdTLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgcGlwZUJpbmQoKSBhcmd1bWVudCBjb3VudCBvdXQgb2YgYm91bmRzYCk7XG4gIH1cblxuICBjb25zdCBpbnN0cnVjdGlvbiA9IFBJUEVfQklORElOR1NbYXJncy5sZW5ndGggLSAxXTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgLi4uYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZFYoc2xvdDogbnVtYmVyLCB2YXJPZmZzZXQ6IG51bWJlciwgYXJnczogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5waXBlQmluZFYpLmNhbGxGbihbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgIGFyZ3MsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgaWYgKHN0cmluZ3MubGVuZ3RoIDwgMSB8fCBleHByZXNzaW9ucy5sZW5ndGggIT09IHN0cmluZ3MubGVuZ3RoIC0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBzcGVjaWZpYyBzaGFwZSBvZiBhcmdzIGZvciBzdHJpbmdzL2V4cHJlc3Npb25zIGluIGludGVycG9sYXRpb25gKTtcbiAgfVxuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChleHByZXNzaW9uc1swXSk7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGlkeDogbnVtYmVyO1xuICAgIGZvciAoaWR4ID0gMDsgaWR4IDwgZXhwcmVzc2lvbnMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSwgZXhwcmVzc2lvbnNbaWR4XSk7XG4gICAgfVxuICAgIC8vIGlkeCBwb2ludHMgYXQgdGhlIGxhc3Qgc3RyaW5nLlxuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSkpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFRFWFRfSU5URVJQT0xBVEVfQ09ORklHLCBbXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLFxuICAgIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgY29uc3QgZXh0cmFBcmdzID0gW107XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwpIHtcbiAgICBleHRyYUFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgICAgQVRUUklCVVRFX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVQcm9wSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCB1bml0OiBzdHJpbmd8bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcEludGVycG9sYXRlKHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oU1RZTEVfTUFQX0lOVEVSUE9MQVRFX0NPTkZJRywgW10sIGludGVycG9sYXRpb25BcmdzLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcEludGVycG9sYXRlKHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oQ0xBU1NfTUFQX0lOVEVSUE9MQVRFX0NPTkZJRywgW10sIGludGVycG9sYXRpb25BcmdzLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBob3N0UHJvcGVydHkobmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmhvc3RQcm9wZXJ0eSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3ludGhldGljSG9zdFByb3BlcnR5KG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5zeW50aGV0aWNIb3N0UHJvcGVydHksIFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1cmVGdW5jdGlvbihcbiAgICB2YXJPZmZzZXQ6IG51bWJlciwgZm46IG8uRXhwcmVzc2lvbiwgYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb25FeHByKFxuICAgICAgUFVSRV9GVU5DVElPTl9DT05GSUcsXG4gICAgICBbXG4gICAgICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgICAgICBmbixcbiAgICAgIF0sXG4gICAgICBhcmdzLFxuICAgICAgW10sXG4gICAgICBudWxsLFxuICApO1xufVxuXG4vKipcbiAqIENvbGxhdGVzIHRoZSBzdHJpbmcgYW4gZXhwcmVzc2lvbiBhcmd1bWVudHMgZm9yIGFuIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uW10ge1xuICBpZiAoc3RyaW5ncy5sZW5ndGggPCAxIHx8IGV4cHJlc3Npb25zLmxlbmd0aCAhPT0gc3RyaW5ncy5sZW5ndGggLSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNwZWNpZmljIHNoYXBlIG9mIGFyZ3MgZm9yIHN0cmluZ3MvZXhwcmVzc2lvbnMgaW4gaW50ZXJwb2xhdGlvbmApO1xuICB9XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKGV4cHJlc3Npb25zWzBdKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaWR4OiBudW1iZXI7XG4gICAgZm9yIChpZHggPSAwOyBpZHggPCBleHByZXNzaW9ucy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pLCBleHByZXNzaW9uc1tpZHhdKTtcbiAgICB9XG4gICAgLy8gaWR4IHBvaW50cyBhdCB0aGUgbGFzdCBzdHJpbmcuXG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSk7XG4gIH1cblxuICByZXR1cm4gaW50ZXJwb2xhdGlvbkFyZ3M7XG59XG5cbmZ1bmN0aW9uIGNhbGw8T3BUIGV4dGVuZHMgaXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KFxuICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBhcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBPcFQge1xuICBjb25zdCBleHByID0gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oYXJncywgc291cmNlU3Bhbik7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGV4cHIsIHNvdXJjZVNwYW4pKSBhcyBPcFQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbChzbG90OiBudW1iZXIsIGNvbmRpdGlvbjogby5FeHByZXNzaW9uKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jb25kaXRpb25hbCwgW28ubGl0ZXJhbChzbG90KSwgY29uZGl0aW9uXSwgbnVsbCk7XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIGEgc3BlY2lmaWMgZmxhdm9yIG9mIGluc3RydWN0aW9uIHVzZWQgdG8gcmVwcmVzZW50IHZhcmlhZGljIGluc3RydWN0aW9ucywgd2hpY2hcbiAqIGhhdmUgc29tZSBudW1iZXIgb2YgdmFyaWFudHMgZm9yIHNwZWNpZmljIGFyZ3VtZW50IGNvdW50cy5cbiAqL1xuaW50ZXJmYWNlIFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcge1xuICBjb25zdGFudDogby5FeHRlcm5hbFJlZmVyZW5jZVtdO1xuICB2YXJpYWJsZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsO1xuICBtYXBwaW5nOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gbnVtYmVyO1xufVxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGB0ZXh0SW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBURVhUX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBzdHlsZVByb3BJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcCxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgYXR0cmlidXRlSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgc3R5bGVNYXBJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXAsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGNsYXNzTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG5jb25zdCBQVVJFX0ZVTkNUSU9OX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24wLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjEsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24zLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjQsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNSxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb242LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjcsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnB1cmVGdW5jdGlvblYsXG4gIG1hcHBpbmc6IG4gPT4gbixcbn07XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbiA9IGNvbmZpZy5tYXBwaW5nKGludGVycG9sYXRpb25BcmdzLmxlbmd0aCk7XG4gIGlmIChuIDwgY29uZmlnLmNvbnN0YW50Lmxlbmd0aCkge1xuICAgIC8vIENvbnN0YW50IGNhbGxpbmcgcGF0dGVybi5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGNvbmZpZy5jb25zdGFudFtuXSlcbiAgICAgICAgLmNhbGxGbihbLi4uYmFzZUFyZ3MsIC4uLmludGVycG9sYXRpb25BcmdzLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChjb25maWcudmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAvLyBWYXJpYWJsZSBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcudmFyaWFibGUpXG4gICAgICAgIC5jYWxsRm4oWy4uLmJhc2VBcmdzLCBvLmxpdGVyYWxBcnIoaW50ZXJwb2xhdGlvbkFyZ3MpLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gY2FsbCB2YXJpYWRpYyBmdW5jdGlvbmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgIGNvbmZpZzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZywgYmFzZUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10sXG4gICAgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChcbiAgICAgIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihjb25maWcsIGJhc2VBcmdzLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKVxuICAgICAgICAgIC50b1N0bXQoKSk7XG59XG4iXX0=