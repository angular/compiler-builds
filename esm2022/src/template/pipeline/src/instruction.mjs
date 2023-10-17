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
    if (tag !== null || constIndex !== null) {
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
export function i18nStart(slot, constIndex, subTemplateIndex) {
    const args = [o.literal(slot), o.literal(constIndex)];
    if (subTemplateIndex !== null) {
        args.push(o.literal(subTemplateIndex));
    }
    return call(Identifiers.i18nStart, args, null);
}
export function i18n(slot, constIndex, subTemplateIndex) {
    const args = [o.literal(slot), o.literal(constIndex)];
    if (subTemplateIndex) {
        args.push(o.literal(subTemplateIndex));
    }
    return call(Identifiers.i18n, args, null);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtR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LENBQUMsQ0FBQztLQUN2RjtTQUFNO1FBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO0tBQ3JFO0FBQ0gsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQzVCLE1BQWlDLEVBQUUsUUFBd0IsRUFBRSxpQkFBaUMsRUFDOUYsU0FBeUIsRUFBRSxVQUFnQztJQUM3RCxPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsQ0FDdkIsMkJBQTJCLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDO1NBQ2xGLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDckIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG4vLyBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVycyBmb3IgZ2VuZXJhdGluZyBjYWxscyB0byBJdnkgaW5zdHJ1Y3Rpb25zLiBJbiBwYXJ0aWN1bGFyLCBlYWNoXG4vLyBpbnN0cnVjdGlvbiB0eXBlIGlzIHJlcHJlc2VudGVkIGFzIGEgZnVuY3Rpb24sIHdoaWNoIG1heSBzZWxlY3QgYSBzcGVjaWZpYyBpbnN0cnVjdGlvbiB2YXJpYW50XG4vLyBkZXBlbmRpbmcgb24gdGhlIGV4YWN0IGFyZ3VtZW50cy5cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnQoXG4gICAgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZywgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFN0YXJ0KFxuICAgIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmcsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudFN0YXJ0LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLFxuICAgIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmICh0YWcgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRhZykpO1xuICB9XG4gIGlmIChsb2NhbFJlZkluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksICAvLyBtaWdodCBiZSBudWxsLCBidXQgdGhhdCdzIG9rYXkuXG4gICAgICAgIG8ubGl0ZXJhbChsb2NhbFJlZkluZGV4KSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGNvbnN0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsKGluc3RydWN0aW9uLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRFbmQoc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRFbmQsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lclN0YXJ0LCBzbG90LCAvKiB0YWcgKi8gbnVsbCwgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lcihcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lciwgc2xvdCwgLyogdGFnICovIG51bGwsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lckVuZCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXJFbmQsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlKFxuICAgIHNsb3Q6IG51bWJlciwgdGVtcGxhdGVGblJlZjogby5FeHByZXNzaW9uLCBkZWNsczogbnVtYmVyLCB2YXJzOiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsXG4gICAgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIHRlbXBsYXRlRm5SZWYsIG8ubGl0ZXJhbChkZWNscyksIG8ubGl0ZXJhbCh2YXJzKV07XG4gIGlmICh0YWcgIT09IG51bGwgfHwgY29uc3RJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodGFnKSk7XG4gICAgaWYgKGNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoY29uc3RJbmRleCkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy50ZW1wbGF0ZUNyZWF0ZSwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlQmluZGluZ3MoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5kaXNhYmxlQmluZGluZ3MsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUJpbmRpbmdzKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZW5hYmxlQmluZGluZ3MsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbmVyKFxuICAgIG5hbWU6IHN0cmluZywgaGFuZGxlckZuOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoXG4gICAgICBJZGVudGlmaWVycy5saXN0ZW5lcixcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgICBoYW5kbGVyRm4sXG4gICAgICBdLFxuICAgICAgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzeW50aGV0aWNIb3N0TGlzdGVuZXIoXG4gICAgbmFtZTogc3RyaW5nLCBoYW5kbGVyRm46IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lcixcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgICBoYW5kbGVyRm4sXG4gICAgICBdLFxuICAgICAgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlKHNsb3Q6IG51bWJlciwgbmFtZTogc3RyaW5nKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLnBpcGUsXG4gICAgICBbXG4gICAgICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgXSxcbiAgICAgIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlSFRNTCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZUhUTUwsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5hbWVzcGFjZVNWRygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZVNWRywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlTWF0aCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZU1hdGhNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWR2YW5jZShkZWx0YTogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMuYWR2YW5jZSxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKGRlbHRhKSxcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShzbG90OiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlZmVyZW5jZSkuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV4dENvbnRleHQoc3RlcHM6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubmV4dENvbnRleHQpLmNhbGxGbihzdGVwcyA9PT0gMSA/IFtdIDogW28ubGl0ZXJhbChzdGVwcyldKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFZpZXcoKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5nZXRDdXJyZW50VmlldykuY2FsbEZuKFtdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzdG9yZVZpZXcoc2F2ZWRWaWV3OiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc3RvcmVWaWV3KS5jYWxsRm4oW1xuICAgIHNhdmVkVmlldyxcbiAgXSk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VmlldyhyZXR1cm5WYWx1ZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXNldFZpZXcpLmNhbGxGbihbXG4gICAgcmV0dXJuVmFsdWUsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChcbiAgICBzbG90OiBudW1iZXIsIGluaXRpYWxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QsIG51bGwpXTtcbiAgaWYgKGluaXRpYWxWYWx1ZSAhPT0gJycpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGluaXRpYWxWYWx1ZSkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRleHQsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmZXIoXG4gICAgc2VsZlNsb3Q6IG51bWJlciwgcHJpbWFyeVNsb3Q6IG51bWJlciwgZGVwZW5kZW5jeVJlc29sdmVyRm46IG51bGwsIGxvYWRpbmdTbG90OiBudW1iZXJ8bnVsbCxcbiAgICBwbGFjZWhvbGRlclNsb3Q6IG51bWJlcnxudWxsLCBlcnJvclNsb3Q6IG51bWJlcnxudWxsLCBsb2FkaW5nQ29uZmlnSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHBsYWNlaG9sZGVyQ29uZmlnSW5kZXg6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc2VsZlNsb3QpLFxuICAgIG8ubGl0ZXJhbChwcmltYXJ5U2xvdCksXG4gICAgby5saXRlcmFsKGRlcGVuZGVuY3lSZXNvbHZlckZuKSxcbiAgICBvLmxpdGVyYWwobG9hZGluZ1Nsb3QpLFxuICAgIG8ubGl0ZXJhbChwbGFjZWhvbGRlclNsb3QpLFxuICAgIG8ubGl0ZXJhbChlcnJvclNsb3QpLFxuICAgIG8ubGl0ZXJhbChsb2FkaW5nQ29uZmlnSW5kZXgpLFxuICAgIG8ubGl0ZXJhbChwbGFjZWhvbGRlckNvbmZpZ0luZGV4KSxcbiAgXTtcblxuICB3aGlsZSAoYXJnc1thcmdzLmxlbmd0aCAtIDFdLnZhbHVlID09PSBudWxsKSB7XG4gICAgYXJncy5wb3AoKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmRlZmVyLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmVyT24oc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmRlZmVyT25JZGxlLCBbXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uRGVmKGRlZjogby5FeHByZXNzaW9ufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb2plY3Rpb25EZWYsIGRlZiA/IFtkZWZdIDogW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvamVjdGlvbihcbiAgICBzbG90OiBudW1iZXIsIHByb2plY3Rpb25TbG90SW5kZXg6IG51bWJlciwgYXR0cmlidXRlczogbnVtYmVyfG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpXTtcbiAgaWYgKHByb2plY3Rpb25TbG90SW5kZXggIT09IDAgfHwgYXR0cmlidXRlcyAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJbmRleCkpO1xuICAgIGlmIChhdHRyaWJ1dGVzICE9IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXR0cmlidXRlcykpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5wcm9qZWN0aW9uLCBhcmdzLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5TdGFydChzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlciwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKGNvbnN0SW5kZXgpXTtcbiAgaWYgKHN1YlRlbXBsYXRlSW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHN1YlRlbXBsYXRlSW5kZXgpKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuU3RhcnQsIGFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bihzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlciwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKGNvbnN0SW5kZXgpXTtcbiAgaWYgKHN1YlRlbXBsYXRlSW5kZXgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHN1YlRlbXBsYXRlSW5kZXgpKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuLCBhcmdzLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5FbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRW5kLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb3BlcnR5LCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF0dHJpYnV0ZShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuYXR0cmlidXRlLCBhcmdzLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlUHJvcChcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgdW5pdDogc3RyaW5nfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl07XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh1bml0KSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3R5bGVQcm9wLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzUHJvcChcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jbGFzc1Byb3AsIFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlTWFwKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5zdHlsZU1hcCwgW2V4cHJlc3Npb25dLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzTWFwKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jbGFzc01hcCwgW2V4cHJlc3Npb25dLCBzb3VyY2VTcGFuKTtcbn1cblxuY29uc3QgUElQRV9CSU5ESU5HUzogby5FeHRlcm5hbFJlZmVyZW5jZVtdID0gW1xuICBJZGVudGlmaWVycy5waXBlQmluZDEsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMixcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQzLFxuICBJZGVudGlmaWVycy5waXBlQmluZDQsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gcGlwZUJpbmQoc2xvdDogbnVtYmVyLCB2YXJPZmZzZXQ6IG51bWJlciwgYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoYXJncy5sZW5ndGggPCAxIHx8IGFyZ3MubGVuZ3RoID4gUElQRV9CSU5ESU5HUy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHBpcGVCaW5kKCkgYXJndW1lbnQgY291bnQgb3V0IG9mIGJvdW5kc2ApO1xuICB9XG5cbiAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBQSVBFX0JJTkRJTkdTW2FyZ3MubGVuZ3RoIC0gMV07XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgIC4uLmFyZ3MsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGlwZUJpbmRWKHNsb3Q6IG51bWJlciwgdmFyT2Zmc2V0OiBudW1iZXIsIGFyZ3M6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucGlwZUJpbmRWKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICBhcmdzLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRleHRJbnRlcnBvbGF0ZShcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGlmIChzdHJpbmdzLmxlbmd0aCA8IDEgfHwgZXhwcmVzc2lvbnMubGVuZ3RoICE9PSBzdHJpbmdzLmxlbmd0aCAtIDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgc3BlY2lmaWMgc2hhcGUgb2YgYXJncyBmb3Igc3RyaW5ncy9leHByZXNzaW9ucyBpbiBpbnRlcnBvbGF0aW9uYCk7XG4gIH1cbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goZXhwcmVzc2lvbnNbMF0pO1xuICB9IGVsc2Uge1xuICAgIGxldCBpZHg6IG51bWJlcjtcbiAgICBmb3IgKGlkeCA9IDA7IGlkeCA8IGV4cHJlc3Npb25zLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSksIGV4cHJlc3Npb25zW2lkeF0pO1xuICAgIH1cbiAgICAvLyBpZHggcG9pbnRzIGF0IHRoZSBsYXN0IHN0cmluZy5cbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihURVhUX0lOVEVSUE9MQVRFX0NPTkZJRywgW10sIGludGVycG9sYXRpb25BcmdzLCBbXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuRXhwKGV4cHI6IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5FeHAsIFtleHByXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuQXBwbHkoc2xvdDogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4bkFwcGx5LCBbby5saXRlcmFsKHNsb3QpXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9wZXJ0eUludGVycG9sYXRlKFxuICAgIG5hbWU6IHN0cmluZywgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgY29uc3QgZXh0cmFBcmdzID0gW107XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwpIHtcbiAgICBleHRyYUFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgICAgUFJPUEVSVFlfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGVJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIEFUVFJJQlVURV9JTlRFUlBPTEFURV9DT05GSUcsIFtvLmxpdGVyYWwobmFtZSldLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlUHJvcEludGVycG9sYXRlKFxuICAgIG5hbWU6IHN0cmluZywgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgdW5pdDogc3RyaW5nfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgaWYgKHVuaXQgIT09IG51bGwpIHtcbiAgICBleHRyYUFyZ3MucHVzaChvLmxpdGVyYWwodW5pdCkpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgICAgU1RZTEVfUFJPUF9JTlRFUlBPTEFURV9DT05GSUcsIFtvLmxpdGVyYWwobmFtZSldLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlTWFwSW50ZXJwb2xhdGUoXG4gICAgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG5cbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgICAgU1RZTEVfTUFQX0lOVEVSUE9MQVRFX0NPTkZJRywgW10sIGludGVycG9sYXRpb25BcmdzLCBbXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIENMQVNTX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG9zdFByb3BlcnR5KFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaG9zdFByb3BlcnR5LCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzeW50aGV0aWNIb3N0UHJvcGVydHkoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5zeW50aGV0aWNIb3N0UHJvcGVydHksIFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1cmVGdW5jdGlvbihcbiAgICB2YXJPZmZzZXQ6IG51bWJlciwgZm46IG8uRXhwcmVzc2lvbiwgYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb25FeHByKFxuICAgICAgUFVSRV9GVU5DVElPTl9DT05GSUcsXG4gICAgICBbXG4gICAgICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgICAgICBmbixcbiAgICAgIF0sXG4gICAgICBhcmdzLFxuICAgICAgW10sXG4gICAgICBudWxsLFxuICApO1xufVxuXG4vKipcbiAqIENvbGxhdGVzIHRoZSBzdHJpbmcgYW4gZXhwcmVzc2lvbiBhcmd1bWVudHMgZm9yIGFuIGludGVycG9sYXRpb24gaW5zdHJ1Y3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uW10ge1xuICBpZiAoc3RyaW5ncy5sZW5ndGggPCAxIHx8IGV4cHJlc3Npb25zLmxlbmd0aCAhPT0gc3RyaW5ncy5sZW5ndGggLSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNwZWNpZmljIHNoYXBlIG9mIGFyZ3MgZm9yIHN0cmluZ3MvZXhwcmVzc2lvbnMgaW4gaW50ZXJwb2xhdGlvbmApO1xuICB9XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKGV4cHJlc3Npb25zWzBdKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaWR4OiBudW1iZXI7XG4gICAgZm9yIChpZHggPSAwOyBpZHggPCBleHByZXNzaW9ucy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pLCBleHByZXNzaW9uc1tpZHhdKTtcbiAgICB9XG4gICAgLy8gaWR4IHBvaW50cyBhdCB0aGUgbGFzdCBzdHJpbmcuXG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSk7XG4gIH1cblxuICByZXR1cm4gaW50ZXJwb2xhdGlvbkFyZ3M7XG59XG5cbmZ1bmN0aW9uIGNhbGw8T3BUIGV4dGVuZHMgaXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3A+KFxuICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBhcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBPcFQge1xuICBjb25zdCBleHByID0gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oYXJncywgc291cmNlU3Bhbik7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGV4cHIsIHNvdXJjZVNwYW4pKSBhcyBPcFQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25kaXRpb25hbChcbiAgICBzbG90OiBudW1iZXIsIGNvbmRpdGlvbjogby5FeHByZXNzaW9uLCBjb250ZXh0VmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzbG90KSwgY29uZGl0aW9uXTtcbiAgaWYgKGNvbnRleHRWYWx1ZSAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChjb250ZXh0VmFsdWUpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmNvbmRpdGlvbmFsLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgYSBzcGVjaWZpYyBmbGF2b3Igb2YgaW5zdHJ1Y3Rpb24gdXNlZCB0byByZXByZXNlbnQgdmFyaWFkaWMgaW5zdHJ1Y3Rpb25zLCB3aGljaFxuICogaGF2ZSBzb21lIG51bWJlciBvZiB2YXJpYW50cyBmb3Igc3BlY2lmaWMgYXJndW1lbnQgY291bnRzLlxuICovXG5pbnRlcmZhY2UgVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyB7XG4gIGNvbnN0YW50OiBvLkV4dGVybmFsUmVmZXJlbmNlW107XG4gIHZhcmlhYmxlOiBvLkV4dGVybmFsUmVmZXJlbmNlfG51bGw7XG4gIG1hcHBpbmc6IChhcmdDb3VudDogbnVtYmVyKSA9PiBudW1iZXI7XG59XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHRleHRJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFRFWFRfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBwcm9wZXJ0eUludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgUFJPUEVSVFlfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHN0eWxlUHJvcEludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgU1RZTEVfUFJPUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBhdHRyaWJ1dGVJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IEFUVFJJQlVURV9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBzdHlsZU1hcEludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgU1RZTEVfTUFQX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcCxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgY2xhc3NNYXBJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IENMQVNTX01BUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXAsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbmNvbnN0IFBVUkVfRlVOQ1RJT05fQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjAsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMSxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24yLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjMsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNCxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb241LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjYsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNyxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb244LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uVixcbiAgbWFwcGluZzogbiA9PiBuLFxufTtcblxuZnVuY3Rpb24gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb25FeHByKFxuICAgIGNvbmZpZzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZywgYmFzZUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10sXG4gICAgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBuID0gY29uZmlnLm1hcHBpbmcoaW50ZXJwb2xhdGlvbkFyZ3MubGVuZ3RoKTtcbiAgaWYgKG4gPCBjb25maWcuY29uc3RhbnQubGVuZ3RoKSB7XG4gICAgLy8gQ29uc3RhbnQgY2FsbGluZyBwYXR0ZXJuLlxuICAgIHJldHVybiBvLmltcG9ydEV4cHIoY29uZmlnLmNvbnN0YW50W25dKVxuICAgICAgICAuY2FsbEZuKFsuLi5iYXNlQXJncywgLi4uaW50ZXJwb2xhdGlvbkFyZ3MsIC4uLmV4dHJhQXJnc10sIHNvdXJjZVNwYW4pO1xuICB9IGVsc2UgaWYgKGNvbmZpZy52YXJpYWJsZSAhPT0gbnVsbCkge1xuICAgIC8vIFZhcmlhYmxlIGNhbGxpbmcgcGF0dGVybi5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGNvbmZpZy52YXJpYWJsZSlcbiAgICAgICAgLmNhbGxGbihbLi4uYmFzZUFyZ3MsIG8ubGl0ZXJhbEFycihpbnRlcnBvbGF0aW9uQXJncyksIC4uLmV4dHJhQXJnc10sIHNvdXJjZVNwYW4pO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHVuYWJsZSB0byBjYWxsIHZhcmlhZGljIGZ1bmN0aW9uYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgY29uZmlnOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnLCBiYXNlQXJnczogby5FeHByZXNzaW9uW10sIGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSxcbiAgICBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGlyLmNyZWF0ZVN0YXRlbWVudE9wKFxuICAgICAgY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb25FeHByKGNvbmZpZywgYmFzZUFyZ3MsIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pXG4gICAgICAgICAgLnRvU3RtdCgpKTtcbn1cbiJdfQ==