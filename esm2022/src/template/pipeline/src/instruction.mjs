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
    if (tag !== null) {
        args.push(o.literal(tag));
        if (constIndex !== null) {
            args.push(o.literal(constIndex));
        }
    }
    return call(Identifiers.templateCreate, args, sourceSpan);
}
export function disableBindings() {
    return call(Identifiers.disableBindings, [], null);
}
export function enableBindings() {
    return call(Identifiers.enableBindings, [], null);
}
export function listener(name, handlerFn, sourceSpan) {
    return call(Identifiers.listener, [
        o.literal(name),
        handlerFn,
    ], sourceSpan);
}
export function syntheticHostListener(name, handlerFn, sourceSpan) {
    return call(Identifiers.syntheticHostListener, [
        o.literal(name),
        handlerFn,
    ], sourceSpan);
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
export function defer(selfSlot, primarySlot, dependencyResolverFn, loadingSlot, placeholderSlot, errorSlot, loadingConfigIndex, placeholderConfigIndex, sourceSpan) {
    const args = [
        o.literal(selfSlot),
        o.literal(primarySlot),
        o.literal(dependencyResolverFn),
        o.literal(loadingSlot),
        o.literal(placeholderSlot),
        o.literal(errorSlot),
        o.literal(loadingConfigIndex),
        o.literal(placeholderConfigIndex),
    ];
    while (args[args.length - 1].value === null) {
        args.pop();
    }
    return call(Identifiers.defer, args, sourceSpan);
}
export function deferOn(sourceSpan) {
    return call(Identifiers.deferOnIdle, [], sourceSpan);
}
export function projectionDef(def) {
    return call(Identifiers.projectionDef, def ? [def] : [], null);
}
export function projection(slot, projectionSlotIndex, attributes) {
    const args = [o.literal(slot)];
    if (projectionSlotIndex !== 0 || attributes !== null) {
        args.push(o.literal(projectionSlotIndex));
        if (attributes != null) {
            args.push(o.literal(attributes));
        }
    }
    return call(Identifiers.projection, args, null);
}
export function i18nStart(slot, constIndex) {
    return call(Identifiers.i18nStart, [o.literal(slot), o.literal(constIndex)], null);
}
export function i18n(slot, constIndex) {
    return call(Identifiers.i18n, [o.literal(slot), o.literal(constIndex)], null);
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
export function styleProp(name, expression, unit, sourceSpan) {
    const args = [o.literal(name), expression];
    if (unit !== null) {
        args.push(o.literal(unit));
    }
    return call(Identifiers.styleProp, args, sourceSpan);
}
export function classProp(name, expression, sourceSpan) {
    return call(Identifiers.classProp, [o.literal(name), expression], sourceSpan);
}
export function styleMap(expression, sourceSpan) {
    return call(Identifiers.styleMap, [expression], sourceSpan);
}
export function classMap(expression, sourceSpan) {
    return call(Identifiers.classMap, [expression], sourceSpan);
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
export function i18nExp(expr, sourceSpan) {
    return call(Identifiers.i18nExp, [expr], sourceSpan);
}
export function i18nApply(slot, sourceSpan) {
    return call(Identifiers.i18nApply, [o.literal(slot)], sourceSpan);
}
export function propertyInterpolate(name, strings, expressions, sanitizer, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (sanitizer !== null) {
        extraArgs.push(sanitizer);
    }
    return callVariadicInstruction(PROPERTY_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
export function attributeInterpolate(name, strings, expressions, sanitizer, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (sanitizer !== null) {
        extraArgs.push(sanitizer);
    }
    return callVariadicInstruction(ATTRIBUTE_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
export function stylePropInterpolate(name, strings, expressions, unit, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    const extraArgs = [];
    if (unit !== null) {
        extraArgs.push(o.literal(unit));
    }
    return callVariadicInstruction(STYLE_PROP_INTERPOLATE_CONFIG, [o.literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
export function styleMapInterpolate(strings, expressions, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(STYLE_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
export function classMapInterpolate(strings, expressions, sourceSpan) {
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
    return callVariadicInstruction(CLASS_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
export function hostProperty(name, expression, sourceSpan) {
    return call(Identifiers.hostProperty, [o.literal(name), expression], sourceSpan);
}
export function syntheticHostProperty(name, expression, sourceSpan) {
    return call(Identifiers.syntheticHostProperty, [o.literal(name), expression], sourceSpan);
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
export function conditional(slot, condition, contextValue, sourceSpan) {
    const args = [o.literal(slot), condition];
    if (contextValue !== null) {
        args.push(contextValue);
    }
    return call(Identifiers.conditional, args, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtR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WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuLy8gVGhpcyBmaWxlIGNvbnRhaW5zIGhlbHBlcnMgZm9yIGdlbmVyYXRpbmcgY2FsbHMgdG8gSXZ5IGluc3RydWN0aW9ucy4gSW4gcGFydGljdWxhciwgZWFjaFxuLy8gaW5zdHJ1Y3Rpb24gdHlwZSBpcyByZXByZXNlbnRlZCBhcyBhIGZ1bmN0aW9uLCB3aGljaCBtYXkgc2VsZWN0IGEgc3BlY2lmaWMgaW5zdHJ1Y3Rpb24gdmFyaWFudFxuLy8gZGVwZW5kaW5nIG9uIHRoZSBleGFjdCBhcmd1bWVudHMuXG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50KFxuICAgIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmcsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudCwgc2xvdCwgdGFnLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRTdGFydChcbiAgICBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRTdGFydCwgc2xvdCwgdGFnLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICBpZiAodGFnICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh0YWcpKTtcbiAgfVxuICBpZiAobG9jYWxSZWZJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChcbiAgICAgICAgby5saXRlcmFsKGNvbnN0SW5kZXgpLCAgLy8gbWlnaHQgYmUgbnVsbCwgYnV0IHRoYXQncyBva2F5LlxuICAgICAgICBvLmxpdGVyYWwobG9jYWxSZWZJbmRleCksXG4gICAgKTtcbiAgfSBlbHNlIGlmIChjb25zdEluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChjb25zdEluZGV4KSk7XG4gIH1cblxuICByZXR1cm4gY2FsbChpbnN0cnVjdGlvbiwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50RW5kKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50RW5kLCBbXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyU3RhcnQoXG4gICAgc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXJTdGFydCwgc2xvdCwgLyogdGFnICovIG51bGwsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXIoXG4gICAgc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXIsIHNsb3QsIC8qIHRhZyAqLyBudWxsLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJFbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50Q29udGFpbmVyRW5kLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZShcbiAgICBzbG90OiBudW1iZXIsIHRlbXBsYXRlRm5SZWY6IG8uRXhwcmVzc2lvbiwgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLFxuICAgIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCB0ZW1wbGF0ZUZuUmVmLCBvLmxpdGVyYWwoZGVjbHMpLCBvLmxpdGVyYWwodmFycyldO1xuICBpZiAodGFnICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh0YWcpKTtcbiAgICBpZiAoY29uc3RJbmRleCAhPT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChjb25zdEluZGV4KSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRlbXBsYXRlQ3JlYXRlLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVCaW5kaW5ncygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmRpc2FibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlQmluZGluZ3MoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbmFibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuZXIoXG4gICAgbmFtZTogc3RyaW5nLCBoYW5kbGVyRm46IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLmxpc3RlbmVyLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICAgIGhhbmRsZXJGbixcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRoZXRpY0hvc3RMaXN0ZW5lcihcbiAgICBuYW1lOiBzdHJpbmcsIGhhbmRsZXJGbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICAgIGhhbmRsZXJGbixcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGUoc2xvdDogbnVtYmVyLCBuYW1lOiBzdHJpbmcpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMucGlwZSxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKHNsb3QpLFxuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICBdLFxuICAgICAgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VIVE1MKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlSFRNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlU1ZHKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlU1ZHLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VNYXRoKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlTWF0aE1MLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZHZhbmNlKGRlbHRhOiBudW1iZXIsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoXG4gICAgICBJZGVudGlmaWVycy5hZHZhbmNlLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwoZGVsdGEpLFxuICAgICAgXSxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmZXJlbmNlKHNsb3Q6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVmZXJlbmNlKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXh0Q29udGV4dChzdGVwczogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5uZXh0Q29udGV4dCkuY2FsbEZuKHN0ZXBzID09PSAxID8gW10gOiBbby5saXRlcmFsKHN0ZXBzKV0pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VmlldygpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmdldEN1cnJlbnRWaWV3KS5jYWxsRm4oW10pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlVmlldyhzYXZlZFZpZXc6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVzdG9yZVZpZXcpLmNhbGxGbihbXG4gICAgc2F2ZWRWaWV3LFxuICBdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRWaWV3KHJldHVyblZhbHVlOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc2V0VmlldykuY2FsbEZuKFtcbiAgICByZXR1cm5WYWx1ZSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KFxuICAgIHNsb3Q6IG51bWJlciwgaW5pdGlhbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCwgbnVsbCldO1xuICBpZiAoaW5pdGlhbFZhbHVlICE9PSAnJykge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMudGV4dCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcihcbiAgICBzZWxmU2xvdDogbnVtYmVyLCBwcmltYXJ5U2xvdDogbnVtYmVyLCBkZXBlbmRlbmN5UmVzb2x2ZXJGbjogbnVsbCwgbG9hZGluZ1Nsb3Q6IG51bWJlcnxudWxsLFxuICAgIHBsYWNlaG9sZGVyU2xvdDogbnVtYmVyfG51bGwsIGVycm9yU2xvdDogbnVtYmVyfG51bGwsIGxvYWRpbmdDb25maWdJbmRleDogbnVtYmVyfG51bGwsXG4gICAgcGxhY2Vob2xkZXJDb25maWdJbmRleDogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW1xuICAgIG8ubGl0ZXJhbChzZWxmU2xvdCksXG4gICAgby5saXRlcmFsKHByaW1hcnlTbG90KSxcbiAgICBvLmxpdGVyYWwoZGVwZW5kZW5jeVJlc29sdmVyRm4pLFxuICAgIG8ubGl0ZXJhbChsb2FkaW5nU2xvdCksXG4gICAgby5saXRlcmFsKHBsYWNlaG9sZGVyU2xvdCksXG4gICAgby5saXRlcmFsKGVycm9yU2xvdCksXG4gICAgby5saXRlcmFsKGxvYWRpbmdDb25maWdJbmRleCksXG4gICAgby5saXRlcmFsKHBsYWNlaG9sZGVyQ29uZmlnSW5kZXgpLFxuICBdO1xuXG4gIHdoaWxlIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0udmFsdWUgPT09IG51bGwpIHtcbiAgICBhcmdzLnBvcCgpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGVmZXIsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmZXJPbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGVmZXJPbklkbGUsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZWYoZGVmOiBvLkV4cHJlc3Npb258bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucHJvamVjdGlvbkRlZiwgZGVmID8gW2RlZl0gOiBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uKFxuICAgIHNsb3Q6IG51bWJlciwgcHJvamVjdGlvblNsb3RJbmRleDogbnVtYmVyLCBhdHRyaWJ1dGVzOiBudW1iZXJ8bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICBpZiAocHJvamVjdGlvblNsb3RJbmRleCAhPT0gMCB8fCBhdHRyaWJ1dGVzICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdEluZGV4KSk7XG4gICAgaWYgKGF0dHJpYnV0ZXMgIT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyaWJ1dGVzKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb2plY3Rpb24sIGFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0KHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuU3RhcnQsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChjb25zdEluZGV4KV0sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bihzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4biwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKGNvbnN0SW5kZXgpXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuRW5kKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4bkVuZCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHkoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl07XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5wcm9wZXJ0eSwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGUoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmF0dHJpYnV0ZSwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAodW5pdCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodW5pdCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlUHJvcCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc1Byb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NQcm9wLCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3R5bGVNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmNvbnN0IFBJUEVfQklORElOR1M6IG8uRXh0ZXJuYWxSZWZlcmVuY2VbXSA9IFtcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQxLFxuICBJZGVudGlmaWVycy5waXBlQmluZDIsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMyxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQ0LFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kKHNsb3Q6IG51bWJlciwgdmFyT2Zmc2V0OiBudW1iZXIsIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFyZ3MubGVuZ3RoIDwgMSB8fCBhcmdzLmxlbmd0aCA+IFBJUEVfQklORElOR1MubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBwaXBlQmluZCgpIGFyZ3VtZW50IGNvdW50IG91dCBvZiBib3VuZHNgKTtcbiAgfVxuXG4gIGNvbnN0IGluc3RydWN0aW9uID0gUElQRV9CSU5ESU5HU1thcmdzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAuLi5hcmdzLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kVihzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnBpcGVCaW5kVikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0SW50ZXJwb2xhdGUoXG4gICAgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBpZiAoc3RyaW5ncy5sZW5ndGggPCAxIHx8IGV4cHJlc3Npb25zLmxlbmd0aCAhPT0gc3RyaW5ncy5sZW5ndGggLSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNwZWNpZmljIHNoYXBlIG9mIGFyZ3MgZm9yIHN0cmluZ3MvZXhwcmVzc2lvbnMgaW4gaW50ZXJwb2xhdGlvbmApO1xuICB9XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKGV4cHJlc3Npb25zWzBdKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaWR4OiBudW1iZXI7XG4gICAgZm9yIChpZHggPSAwOyBpZHggPCBleHByZXNzaW9ucy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pLCBleHByZXNzaW9uc1tpZHhdKTtcbiAgICB9XG4gICAgLy8gaWR4IHBvaW50cyBhdCB0aGUgbGFzdCBzdHJpbmcuXG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSk7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oVEVYVF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkV4cChleHByOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRXhwLCBbZXhwcl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkFwcGx5KHNsb3Q6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChzbG90KV0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3MgPSBbXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGV4dHJhQXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NNYXBJbnRlcnBvbGF0ZShcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHLCBbXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmhvc3RQcm9wZXJ0eSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3ludGhldGljSG9zdFByb3BlcnR5KFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3ludGhldGljSG9zdFByb3BlcnR5LCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb24oXG4gICAgdmFyT2Zmc2V0OiBudW1iZXIsIGZuOiBvLkV4cHJlc3Npb24sIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICAgIFBVUkVfRlVOQ1RJT05fQ09ORklHLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAgICAgZm4sXG4gICAgICBdLFxuICAgICAgYXJncyxcbiAgICAgIFtdLFxuICAgICAgbnVsbCxcbiAgKTtcbn1cblxuLyoqXG4gKiBDb2xsYXRlcyB0aGUgc3RyaW5nIGFuIGV4cHJlc3Npb24gYXJndW1lbnRzIGZvciBhbiBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9uLlxuICovXG5mdW5jdGlvbiBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgaWYgKHN0cmluZ3MubGVuZ3RoIDwgMSB8fCBleHByZXNzaW9ucy5sZW5ndGggIT09IHN0cmluZ3MubGVuZ3RoIC0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBzcGVjaWZpYyBzaGFwZSBvZiBhcmdzIGZvciBzdHJpbmdzL2V4cHJlc3Npb25zIGluIGludGVycG9sYXRpb25gKTtcbiAgfVxuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChleHByZXNzaW9uc1swXSk7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGlkeDogbnVtYmVyO1xuICAgIGZvciAoaWR4ID0gMDsgaWR4IDwgZXhwcmVzc2lvbnMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSwgZXhwcmVzc2lvbnNbaWR4XSk7XG4gICAgfVxuICAgIC8vIGlkeCBwb2ludHMgYXQgdGhlIGxhc3Qgc3RyaW5nLlxuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSkpO1xuICB9XG5cbiAgcmV0dXJuIGludGVycG9sYXRpb25BcmdzO1xufVxuXG5mdW5jdGlvbiBjYWxsPE9wVCBleHRlbmRzIGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPihcbiAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgYXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogT3BUIHtcbiAgY29uc3QgZXhwciA9IG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGFyZ3MsIHNvdXJjZVNwYW4pO1xuICByZXR1cm4gaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBzb3VyY2VTcGFuKSkgYXMgT3BUO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uZGl0aW9uYWwoXG4gICAgc2xvdDogbnVtYmVyLCBjb25kaXRpb246IG8uRXhwcmVzc2lvbiwgY29udGV4dFZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIGNvbmRpdGlvbl07XG4gIGlmIChjb250ZXh0VmFsdWUgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goY29udGV4dFZhbHVlKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jb25kaXRpb25hbCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIGEgc3BlY2lmaWMgZmxhdm9yIG9mIGluc3RydWN0aW9uIHVzZWQgdG8gcmVwcmVzZW50IHZhcmlhZGljIGluc3RydWN0aW9ucywgd2hpY2hcbiAqIGhhdmUgc29tZSBudW1iZXIgb2YgdmFyaWFudHMgZm9yIHNwZWNpZmljIGFyZ3VtZW50IGNvdW50cy5cbiAqL1xuaW50ZXJmYWNlIFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcge1xuICBjb25zdGFudDogby5FeHRlcm5hbFJlZmVyZW5jZVtdO1xuICB2YXJpYWJsZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsO1xuICBtYXBwaW5nOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gbnVtYmVyO1xufVxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGB0ZXh0SW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBURVhUX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBzdHlsZVByb3BJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcCxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgYXR0cmlidXRlSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgc3R5bGVNYXBJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXAsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGNsYXNzTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG5jb25zdCBQVVJFX0ZVTkNUSU9OX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24wLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjEsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24zLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjQsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNSxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb242LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjcsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnB1cmVGdW5jdGlvblYsXG4gIG1hcHBpbmc6IG4gPT4gbixcbn07XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbiA9IGNvbmZpZy5tYXBwaW5nKGludGVycG9sYXRpb25BcmdzLmxlbmd0aCk7XG4gIGlmIChuIDwgY29uZmlnLmNvbnN0YW50Lmxlbmd0aCkge1xuICAgIC8vIENvbnN0YW50IGNhbGxpbmcgcGF0dGVybi5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGNvbmZpZy5jb25zdGFudFtuXSlcbiAgICAgICAgLmNhbGxGbihbLi4uYmFzZUFyZ3MsIC4uLmludGVycG9sYXRpb25BcmdzLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChjb25maWcudmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAvLyBWYXJpYWJsZSBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcudmFyaWFibGUpXG4gICAgICAgIC5jYWxsRm4oWy4uLmJhc2VBcmdzLCBvLmxpdGVyYWxBcnIoaW50ZXJwb2xhdGlvbkFyZ3MpLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gY2FsbCB2YXJpYWRpYyBmdW5jdGlvbmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgIGNvbmZpZzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZywgYmFzZUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10sXG4gICAgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChcbiAgICAgIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihjb25maWcsIGJhc2VBcmdzLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKVxuICAgICAgICAgIC50b1N0bXQoKSk7XG59XG4iXX0=