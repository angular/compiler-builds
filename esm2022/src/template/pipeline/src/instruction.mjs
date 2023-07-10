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
export function element(slot, tag, constIndex, localRefIndex) {
    return elementOrContainerBase(Identifiers.element, slot, tag, constIndex, localRefIndex);
}
export function elementStart(slot, tag, constIndex, localRefIndex) {
    return elementOrContainerBase(Identifiers.elementStart, slot, tag, constIndex, localRefIndex);
}
function elementOrContainerBase(instruction, slot, tag, constIndex, localRefIndex) {
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
    return call(instruction, args);
}
export function elementEnd() {
    return call(Identifiers.elementEnd, []);
}
export function elementContainerStart(slot, constIndex, localRefIndex) {
    return elementOrContainerBase(Identifiers.elementContainerStart, slot, /* tag */ null, constIndex, localRefIndex);
}
export function elementContainer(slot, constIndex, localRefIndex) {
    return elementOrContainerBase(Identifiers.elementContainer, slot, /* tag */ null, constIndex, localRefIndex);
}
export function elementContainerEnd() {
    return call(Identifiers.elementContainerEnd, []);
}
export function template(slot, templateFnRef, decls, vars, tag, constIndex) {
    return call(Identifiers.templateCreate, [
        o.literal(slot),
        templateFnRef,
        o.literal(decls),
        o.literal(vars),
        o.literal(tag),
        o.literal(constIndex),
    ]);
}
export function listener(name, handlerFn) {
    return call(Identifiers.listener, [
        o.literal(name),
        handlerFn,
    ]);
}
export function pipe(slot, name) {
    return call(Identifiers.pipe, [
        o.literal(slot),
        o.literal(name),
    ]);
}
export function advance(delta) {
    return call(Identifiers.advance, [
        o.literal(delta),
    ]);
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
export function text(slot, initialValue) {
    const args = [o.literal(slot)];
    if (initialValue !== '') {
        args.push(o.literal(initialValue));
    }
    return call(Identifiers.text, args);
}
export function property(name, expression) {
    return call(Identifiers.property, [
        o.literal(name),
        expression,
    ]);
}
export function attribute(name, expression) {
    return call(Identifiers.attribute, [o.literal(name), expression]);
}
export function styleProp(name, expression, unit) {
    const args = [o.literal(name), expression];
    if (unit !== null) {
        args.push(o.literal(unit));
    }
    return call(Identifiers.styleProp, args);
}
export function styleMap(expression) {
    return call(Identifiers.styleMap, [expression]);
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
export function textInterpolate(strings, expressions) {
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
    return callVariadicInstruction(TEXT_INTERPOLATE_CONFIG, [], interpolationArgs);
}
export function propertyInterpolate(name, strings, expressions) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(PROPERTY_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs);
}
export function attributeInterpolate(name, strings, expressions) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(ATTRIBUTE_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs);
}
export function stylePropInterpolate(name, strings, expressions, unit) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (unit !== null) {
        extraArgs.push(o.literal(unit));
    }
    return callVariadicInstruction(STYLE_PROP_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs);
}
export function styleMapInterpolate(strings, expressions) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(STYLE_MAP_INTERPOLATE_CONFIG, [], interpolationArgs);
}
export function pureFunction(varOffset, fn, args) {
    return callVariadicInstructionExpr(PURE_FUNCTION_CONFIG, [
        o.literal(varOffset),
        fn,
    ], args);
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
function call(instruction, args) {
    return ir.createStatementOp(o.importExpr(instruction).callFn(args).toStmt());
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
        null,
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
        if (n < 3) {
            throw new Error(`Expected at least 3 arguments`);
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
        null,
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
        if (n < 3) {
            throw new Error(`Expected at least 3 arguments`);
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
function callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs = []) {
    const n = config.mapping(interpolationArgs.length);
    if (n < config.constant.length) {
        // Constant calling pattern.
        return o.importExpr(config.constant[n]).callFn([
            ...baseArgs, ...interpolationArgs, ...extraArgs
        ]);
    }
    else if (config.variable !== null) {
        // Variable calling pattern.
        return o.importExpr(config.variable).callFn([
            ...baseArgs, o.literalArr(interpolationArgs), ...extraArgs
        ]);
    }
    else {
        throw new Error(`AssertionError: unable to call variadic function`);
    }
}
function callVariadicInstruction(config, baseArgs, interpolationArgs, extraArgs = []) {
    return ir.createStatementOp(callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs).toStmt());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQjtJQUNoRixPQUFPLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDM0YsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQ3hCLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQjtJQUNoRixPQUFPLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDaEcsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQzNCLFdBQWdDLEVBQUUsSUFBWSxFQUFFLEdBQWdCLEVBQUUsVUFBdUIsRUFDekYsYUFBMEI7SUFDNUIsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtRQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENB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OUYsWUFBNEIsRUFBRTtJQUNoQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQzlCLDRCQUE0QjtRQUM1QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUM3QyxHQUFHLFFBQVEsRUFBRSxHQUFHLGlCQUFpQixFQUFFLEdBQUcsU0FBUztTQUNoRCxDQUFDLENBQUM7S0FDSjtTQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7UUFDbkMsNEJBQTRCO1FBQzVCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQzFDLEdBQUcsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsRUFBRSxHQUFHLFNBQVM7U0FDM0QsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztLQUNyRTtBQUNILENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUM1QixNQUFpQyxFQUFFLFFBQXdCLEVBQUUsaUJBQWlDLEVBQzlGLFlBQTRCLEVBQUU7SUFDaEMsT0FBTyxFQUFFLENBQUMsaUJBQWlCLENBQ3ZCLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUM1RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbi8vIFRoaXMgZmlsZSBjb250YWlucyBoZWxwZXJzIGZvciBnZW5lcmF0aW5nIGNhbGxzIHRvIEl2eSBpbnN0cnVjdGlvbnMuIEluIHBhcnRpY3VsYXIsIGVhY2hcbi8vIGluc3RydWN0aW9uIHR5cGUgaXMgcmVwcmVzZW50ZWQgYXMgYSBmdW5jdGlvbiwgd2hpY2ggbWF5IHNlbGVjdCBhIHNwZWNpZmljIGluc3RydWN0aW9uIHZhcmlhbnRcbi8vIGRlcGVuZGluZyBvbiB0aGUgZXhhY3QgYXJndW1lbnRzLlxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudChcbiAgICBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKElkZW50aWZpZXJzLmVsZW1lbnQsIHNsb3QsIHRhZywgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50U3RhcnQoXG4gICAgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZywgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShJZGVudGlmaWVycy5lbGVtZW50U3RhcnQsIHNsb3QsIHRhZywgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCk7XG59XG5cbmZ1bmN0aW9uIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmd8bnVsbCwgY29uc3RJbmRleDogbnVtYmVyfG51bGwsXG4gICAgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmICh0YWcgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRhZykpO1xuICB9XG4gIGlmIChsb2NhbFJlZkluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksICAvLyBtaWdodCBiZSBudWxsLCBidXQgdGhhdCdzIG9rYXkuXG4gICAgICAgIG8ubGl0ZXJhbChsb2NhbFJlZkluZGV4KSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGNvbnN0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsKGluc3RydWN0aW9uLCBhcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRFbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50RW5kLCBbXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyU3RhcnQoXG4gICAgc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lclN0YXJ0LCBzbG90LCAvKiB0YWcgKi8gbnVsbCwgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyKFxuICAgIHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXIsIHNsb3QsIC8qIHRhZyAqLyBudWxsLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJFbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50Q29udGFpbmVyRW5kLCBbXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZShcbiAgICBzbG90OiBudW1iZXIsIHRlbXBsYXRlRm5SZWY6IG8uRXhwcmVzc2lvbiwgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0YWc6IHN0cmluZyxcbiAgICBjb25zdEluZGV4OiBudW1iZXIpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRlbXBsYXRlQ3JlYXRlLCBbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIHRlbXBsYXRlRm5SZWYsXG4gICAgby5saXRlcmFsKGRlY2xzKSxcbiAgICBvLmxpdGVyYWwodmFycyksXG4gICAgby5saXRlcmFsKHRhZyksXG4gICAgby5saXRlcmFsKGNvbnN0SW5kZXgpLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbmVyKG5hbWU6IHN0cmluZywgaGFuZGxlckZuOiBvLkV4cHJlc3Npb24pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmxpc3RlbmVyLCBbXG4gICAgby5saXRlcmFsKG5hbWUpLFxuICAgIGhhbmRsZXJGbixcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlKHNsb3Q6IG51bWJlciwgbmFtZTogc3RyaW5nKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5waXBlLCBbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8ubGl0ZXJhbChuYW1lKSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZHZhbmNlKGRlbHRhOiBudW1iZXIpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmFkdmFuY2UsIFtcbiAgICBvLmxpdGVyYWwoZGVsdGEpLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShzbG90OiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlZmVyZW5jZSkuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV4dENvbnRleHQoc3RlcHM6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubmV4dENvbnRleHQpLmNhbGxGbihzdGVwcyA9PT0gMSA/IFtdIDogW28ubGl0ZXJhbChzdGVwcyldKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFZpZXcoKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5nZXRDdXJyZW50VmlldykuY2FsbEZuKFtdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzdG9yZVZpZXcoc2F2ZWRWaWV3OiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc3RvcmVWaWV3KS5jYWxsRm4oW1xuICAgIHNhdmVkVmlldyxcbiAgXSk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VmlldyhyZXR1cm5WYWx1ZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXNldFZpZXcpLmNhbGxGbihbXG4gICAgcmV0dXJuVmFsdWUsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChzbG90OiBudW1iZXIsIGluaXRpYWxWYWx1ZTogc3RyaW5nKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICBpZiAoaW5pdGlhbFZhbHVlICE9PSAnJykge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMudGV4dCwgYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9wZXJ0eShuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucHJvcGVydHksIFtcbiAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgZXhwcmVzc2lvbixcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGUobmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmF0dHJpYnV0ZSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVQcm9wKG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCB1bml0OiBzdHJpbmd8bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAodW5pdCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodW5pdCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlUHJvcCwgYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlTWFwLCBbZXhwcmVzc2lvbl0pO1xufVxuXG5jb25zdCBQSVBFX0JJTkRJTkdTOiBvLkV4dGVybmFsUmVmZXJlbmNlW10gPSBbXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMSxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQyLFxuICBJZGVudGlmaWVycy5waXBlQmluZDMsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kNCxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZChzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhcmdzLmxlbmd0aCA8IDEgfHwgYXJncy5sZW5ndGggPiBQSVBFX0JJTkRJTkdTLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgcGlwZUJpbmQoKSBhcmd1bWVudCBjb3VudCBvdXQgb2YgYm91bmRzYCk7XG4gIH1cblxuICBjb25zdCBpbnN0cnVjdGlvbiA9IFBJUEVfQklORElOR1NbYXJncy5sZW5ndGggLSAxXTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgLi4uYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZFYoc2xvdDogbnVtYmVyLCB2YXJPZmZzZXQ6IG51bWJlciwgYXJnczogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5waXBlQmluZFYpLmNhbGxGbihbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgIGFyZ3MsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dEludGVycG9sYXRlKHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBpci5VcGRhdGVPcCB7XG4gIGlmIChzdHJpbmdzLmxlbmd0aCA8IDEgfHwgZXhwcmVzc2lvbnMubGVuZ3RoICE9PSBzdHJpbmdzLmxlbmd0aCAtIDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgc3BlY2lmaWMgc2hhcGUgb2YgYXJncyBmb3Igc3RyaW5ncy9leHByZXNzaW9ucyBpbiBpbnRlcnBvbGF0aW9uYCk7XG4gIH1cbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goZXhwcmVzc2lvbnNbMF0pO1xuICB9IGVsc2Uge1xuICAgIGxldCBpZHg6IG51bWJlcjtcbiAgICBmb3IgKGlkeCA9IDA7IGlkeCA8IGV4cHJlc3Npb25zLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSksIGV4cHJlc3Npb25zW2lkeF0pO1xuICAgIH1cbiAgICAvLyBpZHggcG9pbnRzIGF0IHRoZSBsYXN0IHN0cmluZy5cbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihURVhUX0lOVEVSUE9MQVRFX0NPTkZJRywgW10sIGludGVycG9sYXRpb25BcmdzKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oUFJPUEVSVFlfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgICAgQVRUUklCVVRFX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlUHJvcEludGVycG9sYXRlKFxuICAgIG5hbWU6IHN0cmluZywgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgdW5pdDogc3RyaW5nfG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgY29uc3QgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBpZiAodW5pdCAhPT0gbnVsbCkge1xuICAgIGV4dHJhQXJncy5wdXNoKG8ubGl0ZXJhbCh1bml0KSk7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBTVFlMRV9QUk9QX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVNYXBJbnRlcnBvbGF0ZShzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb24oXG4gICAgdmFyT2Zmc2V0OiBudW1iZXIsIGZuOiBvLkV4cHJlc3Npb24sIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICAgIFBVUkVfRlVOQ1RJT05fQ09ORklHLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAgICAgZm4sXG4gICAgICBdLFxuICAgICAgYXJncyxcbiAgKTtcbn1cblxuLyoqXG4gKiBDb2xsYXRlcyB0aGUgc3RyaW5nIGFuIGV4cHJlc3Npb24gYXJndW1lbnRzIGZvciBhbiBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9uLlxuICovXG5mdW5jdGlvbiBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgaWYgKHN0cmluZ3MubGVuZ3RoIDwgMSB8fCBleHByZXNzaW9ucy5sZW5ndGggIT09IHN0cmluZ3MubGVuZ3RoIC0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBzcGVjaWZpYyBzaGFwZSBvZiBhcmdzIGZvciBzdHJpbmdzL2V4cHJlc3Npb25zIGluIGludGVycG9sYXRpb25gKTtcbiAgfVxuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChleHByZXNzaW9uc1swXSk7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGlkeDogbnVtYmVyO1xuICAgIGZvciAoaWR4ID0gMDsgaWR4IDwgZXhwcmVzc2lvbnMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSwgZXhwcmVzc2lvbnNbaWR4XSk7XG4gICAgfVxuICAgIC8vIGlkeCBwb2ludHMgYXQgdGhlIGxhc3Qgc3RyaW5nLlxuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSkpO1xuICB9XG5cbiAgcmV0dXJuIGludGVycG9sYXRpb25BcmdzO1xufVxuXG5mdW5jdGlvbiBjYWxsPE9wVCBleHRlbmRzIGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPihcbiAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgYXJnczogby5FeHByZXNzaW9uW10pOiBPcFQge1xuICByZXR1cm4gaXIuY3JlYXRlU3RhdGVtZW50T3Aoby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oYXJncykudG9TdG10KCkpIGFzIE9wVDtcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgYSBzcGVjaWZpYyBmbGF2b3Igb2YgaW5zdHJ1Y3Rpb24gdXNlZCB0byByZXByZXNlbnQgdmFyaWFkaWMgaW5zdHJ1Y3Rpb25zLCB3aGljaCBoYXZlXG4gKiBzb21lIG51bWJlciBvZiB2YXJpYW50cyBmb3Igc3BlY2lmaWMgYXJndW1lbnQgY291bnRzLlxuICovXG5pbnRlcmZhY2UgVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyB7XG4gIGNvbnN0YW50OiBvLkV4dGVybmFsUmVmZXJlbmNlW107XG4gIHZhcmlhYmxlOiBvLkV4dGVybmFsUmVmZXJlbmNlfG51bGw7XG4gIG1hcHBpbmc6IChhcmdDb3VudDogbnVtYmVyKSA9PiBudW1iZXI7XG59XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHRleHRJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFRFWFRfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBwcm9wZXJ0eUludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgUFJPUEVSVFlfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHN0eWxlUHJvcEludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgU1RZTEVfUFJPUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgbnVsbCEsICAvLyBTaW5nbGUgYXJndW1lbnQgc3R5bGVQcm9wSW50ZXJwb2xhdGUgaXMgY29udmVydGVkIHRvIHN0eWxlUHJvcCBpbnN0cnVjdGlvbi5cbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgaWYgKG4gPCAzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGF0IGxlYXN0IDMgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGF0dHJpYnV0ZUludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgQVRUUklCVVRFX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGUsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHN0eWxlTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBTVFlMRV9NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIG51bGwhLCAgLy8gU2luZ2xlIGFyZ3VtZW50IHN0eWxlTWFwSW50ZXJwb2xhdGUgaXMgY29udmVydGVkIHRvIHN0eWxlTWFwIGluc3RydWN0aW9uLlxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICBpZiAobiA8IDMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYXQgbGVhc3QgMyBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuY29uc3QgUFVSRV9GVU5DVElPTl9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMCxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24xLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjIsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMyxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb240LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjUsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb243LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb25WLFxuICBtYXBwaW5nOiBuID0+IG4sXG59O1xuXG5mdW5jdGlvbiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbkV4cHIoXG4gICAgY29uZmlnOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnLCBiYXNlQXJnczogby5FeHByZXNzaW9uW10sIGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSxcbiAgICBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW10pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBuID0gY29uZmlnLm1hcHBpbmcoaW50ZXJwb2xhdGlvbkFyZ3MubGVuZ3RoKTtcbiAgaWYgKG4gPCBjb25maWcuY29uc3RhbnQubGVuZ3RoKSB7XG4gICAgLy8gQ29uc3RhbnQgY2FsbGluZyBwYXR0ZXJuLlxuICAgIHJldHVybiBvLmltcG9ydEV4cHIoY29uZmlnLmNvbnN0YW50W25dKS5jYWxsRm4oW1xuICAgICAgLi4uYmFzZUFyZ3MsIC4uLmludGVycG9sYXRpb25BcmdzLCAuLi5leHRyYUFyZ3NcbiAgICBdKTtcbiAgfSBlbHNlIGlmIChjb25maWcudmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAvLyBWYXJpYWJsZSBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcudmFyaWFibGUpLmNhbGxGbihbXG4gICAgICAuLi5iYXNlQXJncywgby5saXRlcmFsQXJyKGludGVycG9sYXRpb25BcmdzKSwgLi4uZXh0cmFBcmdzXG4gICAgXSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5hYmxlIHRvIGNhbGwgdmFyaWFkaWMgZnVuY3Rpb25gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10gPSBbXSk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGlyLmNyZWF0ZVN0YXRlbWVudE9wKFxuICAgICAgY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb25FeHByKGNvbmZpZywgYmFzZUFyZ3MsIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MpLnRvU3RtdCgpKTtcbn1cbiJdfQ==