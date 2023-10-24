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
export function projection(slot, projectionSlotIndex, attributes, sourceSpan) {
    const args = [o.literal(slot)];
    if (projectionSlotIndex !== 0 || attributes.length > 0) {
        args.push(o.literal(projectionSlotIndex));
        if (attributes.length > 0) {
            args.push(o.literalArr(attributes.map(attr => o.literal(attr))));
        }
    }
    return call(Identifiers.projection, args, sourceSpan);
}
export function i18nStart(slot, constIndex, subTemplateIndex) {
    const args = [o.literal(slot), o.literal(constIndex)];
    if (subTemplateIndex !== null) {
        args.push(o.literal(subTemplateIndex));
    }
    return call(Identifiers.i18nStart, args, null);
}
export function repeaterCreate(slot, viewFnName, decls, vars, trackByFn, trackByUsesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, sourceSpan) {
    let args = [
        o.literal(slot),
        o.variable(viewFnName),
        o.literal(decls),
        o.literal(vars),
        trackByFn,
    ];
    if (trackByUsesComponentInstance || emptyViewFnName !== null) {
        args.push(o.literal(trackByUsesComponentInstance));
        if (emptyViewFnName !== null) {
            args.push(o.variable(emptyViewFnName));
            args.push(o.literal(emptyDecls));
            args.push(o.literal(emptyVars));
        }
    }
    return call(Identifiers.repeaterCreate, args, sourceSpan);
}
export function repeater(metadataSlot, collection, sourceSpan) {
    return call(Identifiers.repeater, [o.literal(metadataSlot), collection], sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtR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QyxNQUFNLENBQUMsUUFBUSxDQUFDO2FBQy9CLE1BQU0sQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsRUFBRSxHQUFHLFNBQVMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZGO1NBQU07UUFDTCxNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7S0FDckU7QUFDSCxDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FDNUIsTUFBaUMsRUFBRSxRQUF3QixFQUFFLGlCQUFpQyxFQUM5RixTQUF5QixFQUFFLFVBQWdDO0lBQzdELE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUN2QiwyQkFBMkIsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUM7U0FDbEYsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNyQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vLi4vLi4vcmVuZGVyMy9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi9pcic7XG5cbi8vIFRoaXMgZmlsZSBjb250YWlucyBoZWxwZXJzIGZvciBnZW5lcmF0aW5nIGNhbGxzIHRvIEl2eSBpbnN0cnVjdGlvbnMuIEluIHBhcnRpY3VsYXIsIGVhY2hcbi8vIGluc3RydWN0aW9uIHR5cGUgaXMgcmVwcmVzZW50ZWQgYXMgYSBmdW5jdGlvbiwgd2hpY2ggbWF5IHNlbGVjdCBhIHNwZWNpZmljIGluc3RydWN0aW9uIHZhcmlhbnRcbi8vIGRlcGVuZGluZyBvbiB0aGUgZXhhY3QgYXJndW1lbnRzLlxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudChcbiAgICBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnQsIHNsb3QsIHRhZywgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50U3RhcnQoXG4gICAgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZywgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50U3RhcnQsIHNsb3QsIHRhZywgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCwgc291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmd8bnVsbCwgY29uc3RJbmRleDogbnVtYmVyfG51bGwsXG4gICAgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcbiAgaWYgKHRhZyAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodGFnKSk7XG4gIH1cbiAgaWYgKGxvY2FsUmVmSW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChjb25zdEluZGV4KSwgIC8vIG1pZ2h0IGJlIG51bGwsIGJ1dCB0aGF0J3Mgb2theS5cbiAgICAgICAgby5saXRlcmFsKGxvY2FsUmVmSW5kZXgpLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoY29uc3RJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoY29uc3RJbmRleCkpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGwoaW5zdHJ1Y3Rpb24sIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudEVuZChzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZWxlbWVudEVuZCwgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lclN0YXJ0KFxuICAgIHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50Q29udGFpbmVyU3RhcnQsIHNsb3QsIC8qIHRhZyAqLyBudWxsLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LFxuICAgICAgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyKFxuICAgIHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50Q29udGFpbmVyLCBzbG90LCAvKiB0YWcgKi8gbnVsbCwgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyRW5kKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lckVuZCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGVtcGxhdGUoXG4gICAgc2xvdDogbnVtYmVyLCB0ZW1wbGF0ZUZuUmVmOiBvLkV4cHJlc3Npb24sIGRlY2xzOiBudW1iZXIsIHZhcnM6IG51bWJlciwgdGFnOiBzdHJpbmd8bnVsbCxcbiAgICBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzbG90KSwgdGVtcGxhdGVGblJlZiwgby5saXRlcmFsKGRlY2xzKSwgby5saXRlcmFsKHZhcnMpXTtcbiAgaWYgKHRhZyAhPT0gbnVsbCB8fCBjb25zdEluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh0YWcpKTtcbiAgICBpZiAoY29uc3RJbmRleCAhPT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChjb25zdEluZGV4KSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRlbXBsYXRlQ3JlYXRlLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVCaW5kaW5ncygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmRpc2FibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlQmluZGluZ3MoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbmFibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuZXIoXG4gICAgbmFtZTogc3RyaW5nLCBoYW5kbGVyRm46IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLmxpc3RlbmVyLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICAgIGhhbmRsZXJGbixcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRoZXRpY0hvc3RMaXN0ZW5lcihcbiAgICBuYW1lOiBzdHJpbmcsIGhhbmRsZXJGbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMuc3ludGhldGljSG9zdExpc3RlbmVyLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICAgIGhhbmRsZXJGbixcbiAgICAgIF0sXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGUoc2xvdDogbnVtYmVyLCBuYW1lOiBzdHJpbmcpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMucGlwZSxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKHNsb3QpLFxuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICBdLFxuICAgICAgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VIVE1MKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlSFRNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlU1ZHKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlU1ZHLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VNYXRoKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlTWF0aE1MLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZHZhbmNlKGRlbHRhOiBudW1iZXIsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoXG4gICAgICBJZGVudGlmaWVycy5hZHZhbmNlLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwoZGVsdGEpLFxuICAgICAgXSxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmZXJlbmNlKHNsb3Q6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVmZXJlbmNlKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXh0Q29udGV4dChzdGVwczogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5uZXh0Q29udGV4dCkuY2FsbEZuKHN0ZXBzID09PSAxID8gW10gOiBbby5saXRlcmFsKHN0ZXBzKV0pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VmlldygpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmdldEN1cnJlbnRWaWV3KS5jYWxsRm4oW10pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlVmlldyhzYXZlZFZpZXc6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVzdG9yZVZpZXcpLmNhbGxGbihbXG4gICAgc2F2ZWRWaWV3LFxuICBdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRWaWV3KHJldHVyblZhbHVlOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc2V0VmlldykuY2FsbEZuKFtcbiAgICByZXR1cm5WYWx1ZSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KFxuICAgIHNsb3Q6IG51bWJlciwgaW5pdGlhbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCwgbnVsbCldO1xuICBpZiAoaW5pdGlhbFZhbHVlICE9PSAnJykge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMudGV4dCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcihcbiAgICBzZWxmU2xvdDogbnVtYmVyLCBwcmltYXJ5U2xvdDogbnVtYmVyLCBkZXBlbmRlbmN5UmVzb2x2ZXJGbjogbnVsbCwgbG9hZGluZ1Nsb3Q6IG51bWJlcnxudWxsLFxuICAgIHBsYWNlaG9sZGVyU2xvdDogbnVtYmVyfG51bGwsIGVycm9yU2xvdDogbnVtYmVyfG51bGwsIGxvYWRpbmdDb25maWdJbmRleDogbnVtYmVyfG51bGwsXG4gICAgcGxhY2Vob2xkZXJDb25maWdJbmRleDogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW1xuICAgIG8ubGl0ZXJhbChzZWxmU2xvdCksXG4gICAgby5saXRlcmFsKHByaW1hcnlTbG90KSxcbiAgICBvLmxpdGVyYWwoZGVwZW5kZW5jeVJlc29sdmVyRm4pLFxuICAgIG8ubGl0ZXJhbChsb2FkaW5nU2xvdCksXG4gICAgby5saXRlcmFsKHBsYWNlaG9sZGVyU2xvdCksXG4gICAgby5saXRlcmFsKGVycm9yU2xvdCksXG4gICAgby5saXRlcmFsKGxvYWRpbmdDb25maWdJbmRleCksXG4gICAgby5saXRlcmFsKHBsYWNlaG9sZGVyQ29uZmlnSW5kZXgpLFxuICBdO1xuXG4gIHdoaWxlIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0udmFsdWUgPT09IG51bGwpIHtcbiAgICBhcmdzLnBvcCgpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGVmZXIsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmZXJPbihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGVmZXJPbklkbGUsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZWYoZGVmOiBvLkV4cHJlc3Npb258bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucHJvamVjdGlvbkRlZiwgZGVmID8gW2RlZl0gOiBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uKFxuICAgIHNsb3Q6IG51bWJlciwgcHJvamVjdGlvblNsb3RJbmRleDogbnVtYmVyLCBhdHRyaWJ1dGVzOiBzdHJpbmdbXSxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmIChwcm9qZWN0aW9uU2xvdEluZGV4ICE9PSAwIHx8IGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJbmRleCkpO1xuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIoYXR0cmlidXRlcy5tYXAoYXR0ciA9PiBvLmxpdGVyYWwoYXR0cikpKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb2plY3Rpb24sIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0KHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwoY29uc3RJbmRleCldO1xuICBpZiAoc3ViVGVtcGxhdGVJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoc3ViVGVtcGxhdGVJbmRleCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5TdGFydCwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXRlckNyZWF0ZShcbiAgICBzbG90OiBudW1iZXIsIHZpZXdGbk5hbWU6IHN0cmluZywgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0cmFja0J5Rm46IG8uRXhwcmVzc2lvbixcbiAgICB0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlOiBib29sZWFuLCBlbXB0eVZpZXdGbk5hbWU6IHN0cmluZ3xudWxsLCBlbXB0eURlY2xzOiBudW1iZXJ8bnVsbCxcbiAgICBlbXB0eVZhcnM6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgbGV0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8udmFyaWFibGUodmlld0ZuTmFtZSksXG4gICAgby5saXRlcmFsKGRlY2xzKSxcbiAgICBvLmxpdGVyYWwodmFycyksXG4gICAgdHJhY2tCeUZuLFxuICBdO1xuICBpZiAodHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZSB8fCBlbXB0eVZpZXdGbk5hbWUgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpKTtcbiAgICBpZiAoZW1wdHlWaWV3Rm5OYW1lICE9PSBudWxsKSB7XG4gICAgICBhcmdzLnB1c2goby52YXJpYWJsZShlbXB0eVZpZXdGbk5hbWUpKTtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoZW1wdHlEZWNscykpO1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChlbXB0eVZhcnMpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucmVwZWF0ZXJDcmVhdGUsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwZWF0ZXIoXG4gICAgbWV0YWRhdGFTbG90OiBudW1iZXIsIGNvbGxlY3Rpb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnJlcGVhdGVyLCBbby5saXRlcmFsKG1ldGFkYXRhU2xvdCksIGNvbGxlY3Rpb25dLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGkxOG4oc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXIsIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChjb25zdEluZGV4KV07XG4gIGlmIChzdWJUZW1wbGF0ZUluZGV4KSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChzdWJUZW1wbGF0ZUluZGV4KSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4biwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuRW5kKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4bkVuZCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHkoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl07XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5wcm9wZXJ0eSwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGUoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmF0dHJpYnV0ZSwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAodW5pdCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodW5pdCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlUHJvcCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc1Byb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NQcm9wLCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3R5bGVNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmNvbnN0IFBJUEVfQklORElOR1M6IG8uRXh0ZXJuYWxSZWZlcmVuY2VbXSA9IFtcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQxLFxuICBJZGVudGlmaWVycy5waXBlQmluZDIsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMyxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQ0LFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kKHNsb3Q6IG51bWJlciwgdmFyT2Zmc2V0OiBudW1iZXIsIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFyZ3MubGVuZ3RoIDwgMSB8fCBhcmdzLmxlbmd0aCA+IFBJUEVfQklORElOR1MubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBwaXBlQmluZCgpIGFyZ3VtZW50IGNvdW50IG91dCBvZiBib3VuZHNgKTtcbiAgfVxuXG4gIGNvbnN0IGluc3RydWN0aW9uID0gUElQRV9CSU5ESU5HU1thcmdzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAuLi5hcmdzLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kVihzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnBpcGVCaW5kVikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0SW50ZXJwb2xhdGUoXG4gICAgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBpZiAoc3RyaW5ncy5sZW5ndGggPCAxIHx8IGV4cHJlc3Npb25zLmxlbmd0aCAhPT0gc3RyaW5ncy5sZW5ndGggLSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNwZWNpZmljIHNoYXBlIG9mIGFyZ3MgZm9yIHN0cmluZ3MvZXhwcmVzc2lvbnMgaW4gaW50ZXJwb2xhdGlvbmApO1xuICB9XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKGV4cHJlc3Npb25zWzBdKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaWR4OiBudW1iZXI7XG4gICAgZm9yIChpZHggPSAwOyBpZHggPCBleHByZXNzaW9ucy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pLCBleHByZXNzaW9uc1tpZHhdKTtcbiAgICB9XG4gICAgLy8gaWR4IHBvaW50cyBhdCB0aGUgbGFzdCBzdHJpbmcuXG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSk7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oVEVYVF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkV4cChleHByOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRXhwLCBbZXhwcl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkFwcGx5KHNsb3Q6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChzbG90KV0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3MgPSBbXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGV4dHJhQXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NNYXBJbnRlcnBvbGF0ZShcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHLCBbXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmhvc3RQcm9wZXJ0eSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3ludGhldGljSG9zdFByb3BlcnR5KFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3ludGhldGljSG9zdFByb3BlcnR5LCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb24oXG4gICAgdmFyT2Zmc2V0OiBudW1iZXIsIGZuOiBvLkV4cHJlc3Npb24sIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICAgIFBVUkVfRlVOQ1RJT05fQ09ORklHLFxuICAgICAgW1xuICAgICAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAgICAgZm4sXG4gICAgICBdLFxuICAgICAgYXJncyxcbiAgICAgIFtdLFxuICAgICAgbnVsbCxcbiAgKTtcbn1cblxuLyoqXG4gKiBDb2xsYXRlcyB0aGUgc3RyaW5nIGFuIGV4cHJlc3Npb24gYXJndW1lbnRzIGZvciBhbiBpbnRlcnBvbGF0aW9uIGluc3RydWN0aW9uLlxuICovXG5mdW5jdGlvbiBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgaWYgKHN0cmluZ3MubGVuZ3RoIDwgMSB8fCBleHByZXNzaW9ucy5sZW5ndGggIT09IHN0cmluZ3MubGVuZ3RoIC0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBzcGVjaWZpYyBzaGFwZSBvZiBhcmdzIGZvciBzdHJpbmdzL2V4cHJlc3Npb25zIGluIGludGVycG9sYXRpb25gKTtcbiAgfVxuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChleHByZXNzaW9uc1swXSk7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGlkeDogbnVtYmVyO1xuICAgIGZvciAoaWR4ID0gMDsgaWR4IDwgZXhwcmVzc2lvbnMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSwgZXhwcmVzc2lvbnNbaWR4XSk7XG4gICAgfVxuICAgIC8vIGlkeCBwb2ludHMgYXQgdGhlIGxhc3Qgc3RyaW5nLlxuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSkpO1xuICB9XG5cbiAgcmV0dXJuIGludGVycG9sYXRpb25BcmdzO1xufVxuXG5mdW5jdGlvbiBjYWxsPE9wVCBleHRlbmRzIGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wPihcbiAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgYXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogT3BUIHtcbiAgY29uc3QgZXhwciA9IG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGFyZ3MsIHNvdXJjZVNwYW4pO1xuICByZXR1cm4gaXIuY3JlYXRlU3RhdGVtZW50T3AobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChleHByLCBzb3VyY2VTcGFuKSkgYXMgT3BUO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uZGl0aW9uYWwoXG4gICAgc2xvdDogbnVtYmVyLCBjb25kaXRpb246IG8uRXhwcmVzc2lvbiwgY29udGV4dFZhbHVlOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIGNvbmRpdGlvbl07XG4gIGlmIChjb250ZXh0VmFsdWUgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goY29udGV4dFZhbHVlKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jb25kaXRpb25hbCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIGEgc3BlY2lmaWMgZmxhdm9yIG9mIGluc3RydWN0aW9uIHVzZWQgdG8gcmVwcmVzZW50IHZhcmlhZGljIGluc3RydWN0aW9ucywgd2hpY2hcbiAqIGhhdmUgc29tZSBudW1iZXIgb2YgdmFyaWFudHMgZm9yIHNwZWNpZmljIGFyZ3VtZW50IGNvdW50cy5cbiAqL1xuaW50ZXJmYWNlIFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcge1xuICBjb25zdGFudDogby5FeHRlcm5hbFJlZmVyZW5jZVtdO1xuICB2YXJpYWJsZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsO1xuICBtYXBwaW5nOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gbnVtYmVyO1xufVxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGB0ZXh0SW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBURVhUX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBzdHlsZVByb3BJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcCxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgYXR0cmlidXRlSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgc3R5bGVNYXBJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXAsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGNsYXNzTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG5jb25zdCBQVVJFX0ZVTkNUSU9OX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24wLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjEsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24zLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjQsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNSxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb242LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjcsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnB1cmVGdW5jdGlvblYsXG4gIG1hcHBpbmc6IG4gPT4gbixcbn07XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbiA9IGNvbmZpZy5tYXBwaW5nKGludGVycG9sYXRpb25BcmdzLmxlbmd0aCk7XG4gIGlmIChuIDwgY29uZmlnLmNvbnN0YW50Lmxlbmd0aCkge1xuICAgIC8vIENvbnN0YW50IGNhbGxpbmcgcGF0dGVybi5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGNvbmZpZy5jb25zdGFudFtuXSlcbiAgICAgICAgLmNhbGxGbihbLi4uYmFzZUFyZ3MsIC4uLmludGVycG9sYXRpb25BcmdzLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChjb25maWcudmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAvLyBWYXJpYWJsZSBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcudmFyaWFibGUpXG4gICAgICAgIC5jYWxsRm4oWy4uLmJhc2VBcmdzLCBvLmxpdGVyYWxBcnIoaW50ZXJwb2xhdGlvbkFyZ3MpLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gY2FsbCB2YXJpYWRpYyBmdW5jdGlvbmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgIGNvbmZpZzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZywgYmFzZUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10sXG4gICAgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChcbiAgICAgIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihjb25maWcsIGJhc2VBcmdzLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKVxuICAgICAgICAgIC50b1N0bXQoKSk7XG59XG4iXX0=