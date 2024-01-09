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
export function template(slot, templateFnRef, decls, vars, tag, constIndex, localRefs, sourceSpan) {
    const args = [
        o.literal(slot),
        templateFnRef,
        o.literal(decls),
        o.literal(vars),
        o.literal(tag),
        o.literal(constIndex),
    ];
    if (localRefs !== null) {
        args.push(o.literal(localRefs));
        args.push(o.importExpr(Identifiers.templateRefExtractor));
    }
    while (args[args.length - 1].isEquivalent(o.NULL_EXPR)) {
        args.pop();
    }
    return call(Identifiers.templateCreate, args, sourceSpan);
}
export function disableBindings() {
    return call(Identifiers.disableBindings, [], null);
}
export function enableBindings() {
    return call(Identifiers.enableBindings, [], null);
}
export function listener(name, handlerFn, eventTargetResolver, syntheticHost, sourceSpan) {
    const args = [o.literal(name), handlerFn];
    if (eventTargetResolver !== null) {
        args.push(o.literal(false)); // `useCapture` flag, defaults to `false`
        args.push(o.importExpr(eventTargetResolver));
    }
    return call(syntheticHost ? Identifiers.syntheticHostListener : Identifiers.listener, args, sourceSpan);
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
    return call(Identifiers.advance, delta > 1 ? [o.literal(delta)] : [], sourceSpan);
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
export function defer(selfSlot, primarySlot, dependencyResolverFn, loadingSlot, placeholderSlot, errorSlot, loadingConfig, placeholderConfig, enableTimerScheduling, sourceSpan) {
    const args = [
        o.literal(selfSlot),
        o.literal(primarySlot),
        dependencyResolverFn ?? o.literal(null),
        o.literal(loadingSlot),
        o.literal(placeholderSlot),
        o.literal(errorSlot),
        loadingConfig ?? o.literal(null),
        placeholderConfig ?? o.literal(null),
        enableTimerScheduling ? o.importExpr(Identifiers.deferEnableTimerScheduling) : o.literal(null),
    ];
    let expr;
    while ((expr = args[args.length - 1]) !== null && expr instanceof o.LiteralExpr &&
        expr.value === null) {
        args.pop();
    }
    return call(Identifiers.defer, args, sourceSpan);
}
const deferTriggerToR3TriggerInstructionsMap = new Map([
    [ir.DeferTriggerKind.Idle, [Identifiers.deferOnIdle, Identifiers.deferPrefetchOnIdle]],
    [
        ir.DeferTriggerKind.Immediate,
        [Identifiers.deferOnImmediate, Identifiers.deferPrefetchOnImmediate]
    ],
    [ir.DeferTriggerKind.Timer, [Identifiers.deferOnTimer, Identifiers.deferPrefetchOnTimer]],
    [ir.DeferTriggerKind.Hover, [Identifiers.deferOnHover, Identifiers.deferPrefetchOnHover]],
    [
        ir.DeferTriggerKind.Interaction,
        [Identifiers.deferOnInteraction, Identifiers.deferPrefetchOnInteraction]
    ],
    [
        ir.DeferTriggerKind.Viewport, [Identifiers.deferOnViewport, Identifiers.deferPrefetchOnViewport]
    ],
]);
export function deferOn(trigger, args, prefetch, sourceSpan) {
    const instructions = deferTriggerToR3TriggerInstructionsMap.get(trigger);
    if (instructions === undefined) {
        throw new Error(`Unable to determine instruction for trigger ${trigger}`);
    }
    const instructionToCall = prefetch ? instructions[1] : instructions[0];
    return call(instructionToCall, args.map(a => o.literal(a)), sourceSpan);
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
export function repeaterCreate(slot, viewFnName, decls, vars, tag, constIndex, trackByFn, trackByUsesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, sourceSpan) {
    const args = [
        o.literal(slot),
        o.variable(viewFnName),
        o.literal(decls),
        o.literal(vars),
        o.literal(tag),
        o.literal(constIndex),
        trackByFn,
    ];
    if (trackByUsesComponentInstance || emptyViewFnName !== null) {
        args.push(o.literal(trackByUsesComponentInstance));
        if (emptyViewFnName !== null) {
            args.push(o.variable(emptyViewFnName), o.literal(emptyDecls), o.literal(emptyVars));
        }
    }
    return call(Identifiers.repeaterCreate, args, sourceSpan);
}
export function repeater(collection, sourceSpan) {
    return call(Identifiers.repeater, [collection], sourceSpan);
}
export function deferWhen(prefetch, expr, sourceSpan) {
    return call(prefetch ? Identifiers.deferPrefetchWhen : Identifiers.deferWhen, [expr], sourceSpan);
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
export function i18nAttributes(slot, i18nAttributesConfig) {
    const args = [o.literal(slot), o.literal(i18nAttributesConfig)];
    return call(Identifiers.i18nAttributes, args, null);
}
export function property(name, expression, sanitizer, sourceSpan) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null) {
        args.push(sanitizer);
    }
    return call(Identifiers.property, args, sourceSpan);
}
export function attribute(name, expression, sanitizer, namespace) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null || namespace !== null) {
        args.push(sanitizer ?? o.literal(null));
    }
    if (namespace !== null) {
        args.push(o.literal(namespace));
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
export function hostProperty(name, expression, sanitizer, sourceSpan) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null) {
        args.push(sanitizer);
    }
    return call(Identifiers.hostProperty, args, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRTtR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bGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uLy4uLy4uL3JlbmRlcjMvcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vaXInO1xuXG4vLyBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVycyBmb3IgZ2VuZXJhdGluZyBjYWxscyB0byBJdnkgaW5zdHJ1Y3Rpb25zLiBJbiBwYXJ0aWN1bGFyLCBlYWNoXG4vLyBpbnN0cnVjdGlvbiB0eXBlIGlzIHJlcHJlc2VudGVkIGFzIGEgZnVuY3Rpb24sIHdoaWNoIG1heSBzZWxlY3QgYSBzcGVjaWZpYyBpbnN0cnVjdGlvbiB2YXJpYW50XG4vLyBkZXBlbmRpbmcgb24gdGhlIGV4YWN0IGFyZ3VtZW50cy5cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnQoXG4gICAgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZywgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGVsZW1lbnRPckNvbnRhaW5lckJhc2UoXG4gICAgICBJZGVudGlmaWVycy5lbGVtZW50LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFN0YXJ0KFxuICAgIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmcsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudFN0YXJ0LCBzbG90LCB0YWcsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLFxuICAgIGxvY2FsUmVmSW5kZXg6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmICh0YWcgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRhZykpO1xuICB9XG4gIGlmIChsb2NhbFJlZkluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksICAvLyBtaWdodCBiZSBudWxsLCBidXQgdGhhdCdzIG9rYXkuXG4gICAgICAgIG8ubGl0ZXJhbChsb2NhbFJlZkluZGV4KSxcbiAgICApO1xuICB9IGVsc2UgaWYgKGNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGNvbnN0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsKGluc3RydWN0aW9uLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRFbmQoc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRFbmQsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJTdGFydChcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lclN0YXJ0LCBzbG90LCAvKiB0YWcgKi8gbnVsbCwgY29uc3RJbmRleCwgbG9jYWxSZWZJbmRleCxcbiAgICAgIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lcihcbiAgICBzbG90OiBudW1iZXIsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudENvbnRhaW5lciwgc2xvdCwgLyogdGFnICovIG51bGwsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudENvbnRhaW5lckVuZCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXJFbmQsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlKFxuICAgIHNsb3Q6IG51bWJlciwgdGVtcGxhdGVGblJlZjogby5FeHByZXNzaW9uLCBkZWNsczogbnVtYmVyLCB2YXJzOiBudW1iZXIsIHRhZzogc3RyaW5nfG51bGwsXG4gICAgY29uc3RJbmRleDogbnVtYmVyfG51bGwsIGxvY2FsUmVmczogbnVtYmVyfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgdGVtcGxhdGVGblJlZixcbiAgICBvLmxpdGVyYWwoZGVjbHMpLFxuICAgIG8ubGl0ZXJhbCh2YXJzKSxcbiAgICBvLmxpdGVyYWwodGFnKSxcbiAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksXG4gIF07XG4gIGlmIChsb2NhbFJlZnMgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGxvY2FsUmVmcykpO1xuICAgIGFyZ3MucHVzaChvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgfVxuICB3aGlsZSAoYXJnc1thcmdzLmxlbmd0aCAtIDFdLmlzRXF1aXZhbGVudChvLk5VTExfRVhQUikpIHtcbiAgICBhcmdzLnBvcCgpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRlbXBsYXRlQ3JlYXRlLCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVCaW5kaW5ncygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmRpc2FibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlQmluZGluZ3MoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbmFibGVCaW5kaW5ncywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuZXIoXG4gICAgbmFtZTogc3RyaW5nLCBoYW5kbGVyRm46IG8uRXhwcmVzc2lvbiwgZXZlbnRUYXJnZXRSZXNvbHZlcjogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsLFxuICAgIHN5bnRoZXRpY0hvc3Q6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGhhbmRsZXJGbl07XG4gIGlmIChldmVudFRhcmdldFJlc29sdmVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChmYWxzZSkpOyAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICBhcmdzLnB1c2goby5pbXBvcnRFeHByKGV2ZW50VGFyZ2V0UmVzb2x2ZXIpKTtcbiAgfVxuICByZXR1cm4gY2FsbChcbiAgICAgIHN5bnRoZXRpY0hvc3QgPyBJZGVudGlmaWVycy5zeW50aGV0aWNIb3N0TGlzdGVuZXIgOiBJZGVudGlmaWVycy5saXN0ZW5lciwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlKHNsb3Q6IG51bWJlciwgbmFtZTogc3RyaW5nKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChcbiAgICAgIElkZW50aWZpZXJzLnBpcGUsXG4gICAgICBbXG4gICAgICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICAgICAgby5saXRlcmFsKG5hbWUpLFxuICAgICAgXSxcbiAgICAgIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlSFRNTCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZUhUTUwsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5hbWVzcGFjZVNWRygpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZVNWRywgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlTWF0aCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLm5hbWVzcGFjZU1hdGhNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWR2YW5jZShkZWx0YTogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmFkdmFuY2UsIGRlbHRhID4gMSA/IFtvLmxpdGVyYWwoZGVsdGEpXSA6IFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShzbG90OiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlZmVyZW5jZSkuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV4dENvbnRleHQoc3RlcHM6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubmV4dENvbnRleHQpLmNhbGxGbihzdGVwcyA9PT0gMSA/IFtdIDogW28ubGl0ZXJhbChzdGVwcyldKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFZpZXcoKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5nZXRDdXJyZW50VmlldykuY2FsbEZuKFtdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzdG9yZVZpZXcoc2F2ZWRWaWV3OiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc3RvcmVWaWV3KS5jYWxsRm4oW1xuICAgIHNhdmVkVmlldyxcbiAgXSk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VmlldyhyZXR1cm5WYWx1ZTogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5yZXNldFZpZXcpLmNhbGxGbihbXG4gICAgcmV0dXJuVmFsdWUsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChcbiAgICBzbG90OiBudW1iZXIsIGluaXRpYWxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QsIG51bGwpXTtcbiAgaWYgKGluaXRpYWxWYWx1ZSAhPT0gJycpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGluaXRpYWxWYWx1ZSkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnRleHQsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmZXIoXG4gICAgc2VsZlNsb3Q6IG51bWJlciwgcHJpbWFyeVNsb3Q6IG51bWJlciwgZGVwZW5kZW5jeVJlc29sdmVyRm46IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIGxvYWRpbmdTbG90OiBudW1iZXJ8bnVsbCwgcGxhY2Vob2xkZXJTbG90OiBudW1iZXJ8bnVsbCwgZXJyb3JTbG90OiBudW1iZXJ8bnVsbCxcbiAgICBsb2FkaW5nQ29uZmlnOiBvLkV4cHJlc3Npb258bnVsbCwgcGxhY2Vob2xkZXJDb25maWc6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIGVuYWJsZVRpbWVyU2NoZWR1bGluZzogYm9vbGVhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IEFycmF5PG8uRXhwcmVzc2lvbj4gPSBbXG4gICAgby5saXRlcmFsKHNlbGZTbG90KSxcbiAgICBvLmxpdGVyYWwocHJpbWFyeVNsb3QpLFxuICAgIGRlcGVuZGVuY3lSZXNvbHZlckZuID8/IG8ubGl0ZXJhbChudWxsKSxcbiAgICBvLmxpdGVyYWwobG9hZGluZ1Nsb3QpLFxuICAgIG8ubGl0ZXJhbChwbGFjZWhvbGRlclNsb3QpLFxuICAgIG8ubGl0ZXJhbChlcnJvclNsb3QpLFxuICAgIGxvYWRpbmdDb25maWcgPz8gby5saXRlcmFsKG51bGwpLFxuICAgIHBsYWNlaG9sZGVyQ29uZmlnID8/IG8ubGl0ZXJhbChudWxsKSxcbiAgICBlbmFibGVUaW1lclNjaGVkdWxpbmcgPyBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuZGVmZXJFbmFibGVUaW1lclNjaGVkdWxpbmcpIDogby5saXRlcmFsKG51bGwpLFxuICBdO1xuXG4gIGxldCBleHByOiBvLkV4cHJlc3Npb247XG4gIHdoaWxlICgoZXhwciA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSkgIT09IG51bGwgJiYgZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiZcbiAgICAgICAgIGV4cHIudmFsdWUgPT09IG51bGwpIHtcbiAgICBhcmdzLnBvcCgpO1xuICB9XG5cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZGVmZXIsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5jb25zdCBkZWZlclRyaWdnZXJUb1IzVHJpZ2dlckluc3RydWN0aW9uc01hcCA9IG5ldyBNYXAoW1xuICBbaXIuRGVmZXJUcmlnZ2VyS2luZC5JZGxlLCBbSWRlbnRpZmllcnMuZGVmZXJPbklkbGUsIElkZW50aWZpZXJzLmRlZmVyUHJlZmV0Y2hPbklkbGVdXSxcbiAgW1xuICAgIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW1tZWRpYXRlLFxuICAgIFtJZGVudGlmaWVycy5kZWZlck9uSW1tZWRpYXRlLCBJZGVudGlmaWVycy5kZWZlclByZWZldGNoT25JbW1lZGlhdGVdXG4gIF0sXG4gIFtpci5EZWZlclRyaWdnZXJLaW5kLlRpbWVyLCBbSWRlbnRpZmllcnMuZGVmZXJPblRpbWVyLCBJZGVudGlmaWVycy5kZWZlclByZWZldGNoT25UaW1lcl1dLFxuICBbaXIuRGVmZXJUcmlnZ2VyS2luZC5Ib3ZlciwgW0lkZW50aWZpZXJzLmRlZmVyT25Ib3ZlciwgSWRlbnRpZmllcnMuZGVmZXJQcmVmZXRjaE9uSG92ZXJdXSxcbiAgW1xuICAgIGlyLkRlZmVyVHJpZ2dlcktpbmQuSW50ZXJhY3Rpb24sXG4gICAgW0lkZW50aWZpZXJzLmRlZmVyT25JbnRlcmFjdGlvbiwgSWRlbnRpZmllcnMuZGVmZXJQcmVmZXRjaE9uSW50ZXJhY3Rpb25dXG4gIF0sXG4gIFtcbiAgICBpci5EZWZlclRyaWdnZXJLaW5kLlZpZXdwb3J0LCBbSWRlbnRpZmllcnMuZGVmZXJPblZpZXdwb3J0LCBJZGVudGlmaWVycy5kZWZlclByZWZldGNoT25WaWV3cG9ydF1cbiAgXSxcbl0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVmZXJPbihcbiAgICB0cmlnZ2VyOiBpci5EZWZlclRyaWdnZXJLaW5kLCBhcmdzOiBudW1iZXJbXSwgcHJlZmV0Y2g6IGJvb2xlYW4sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGluc3RydWN0aW9ucyA9IGRlZmVyVHJpZ2dlclRvUjNUcmlnZ2VySW5zdHJ1Y3Rpb25zTWFwLmdldCh0cmlnZ2VyKTtcbiAgaWYgKGluc3RydWN0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIGluc3RydWN0aW9uIGZvciB0cmlnZ2VyICR7dHJpZ2dlcn1gKTtcbiAgfVxuICBjb25zdCBpbnN0cnVjdGlvblRvQ2FsbCA9IHByZWZldGNoID8gaW5zdHJ1Y3Rpb25zWzFdIDogaW5zdHJ1Y3Rpb25zWzBdO1xuICByZXR1cm4gY2FsbChpbnN0cnVjdGlvblRvQ2FsbCwgYXJncy5tYXAoYSA9PiBvLmxpdGVyYWwoYSkpLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZWYoZGVmOiBvLkV4cHJlc3Npb258bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucHJvamVjdGlvbkRlZiwgZGVmID8gW2RlZl0gOiBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uKFxuICAgIHNsb3Q6IG51bWJlciwgcHJvamVjdGlvblNsb3RJbmRleDogbnVtYmVyLCBhdHRyaWJ1dGVzOiBzdHJpbmdbXSxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gIGlmIChwcm9qZWN0aW9uU2xvdEluZGV4ICE9PSAwIHx8IGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJbmRleCkpO1xuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIoYXR0cmlidXRlcy5tYXAoYXR0ciA9PiBvLmxpdGVyYWwoYXR0cikpKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb2plY3Rpb24sIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0KHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwoY29uc3RJbmRleCldO1xuICBpZiAoc3ViVGVtcGxhdGVJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoc3ViVGVtcGxhdGVJbmRleCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5TdGFydCwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXRlckNyZWF0ZShcbiAgICBzbG90OiBudW1iZXIsIHZpZXdGbk5hbWU6IHN0cmluZywgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLFxuICAgIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCB0cmFja0J5Rm46IG8uRXhwcmVzc2lvbiwgdHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZTogYm9vbGVhbixcbiAgICBlbXB0eVZpZXdGbk5hbWU6IHN0cmluZ3xudWxsLCBlbXB0eURlY2xzOiBudW1iZXJ8bnVsbCwgZW1wdHlWYXJzOiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby52YXJpYWJsZSh2aWV3Rm5OYW1lKSxcbiAgICBvLmxpdGVyYWwoZGVjbHMpLFxuICAgIG8ubGl0ZXJhbCh2YXJzKSxcbiAgICBvLmxpdGVyYWwodGFnKSxcbiAgICBvLmxpdGVyYWwoY29uc3RJbmRleCksXG4gICAgdHJhY2tCeUZuLFxuICBdO1xuICBpZiAodHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZSB8fCBlbXB0eVZpZXdGbk5hbWUgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UpKTtcbiAgICBpZiAoZW1wdHlWaWV3Rm5OYW1lICE9PSBudWxsKSB7XG4gICAgICBhcmdzLnB1c2goby52YXJpYWJsZShlbXB0eVZpZXdGbk5hbWUpLCBvLmxpdGVyYWwoZW1wdHlEZWNscyksIG8ubGl0ZXJhbChlbXB0eVZhcnMpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucmVwZWF0ZXJDcmVhdGUsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwZWF0ZXIoY29sbGVjdGlvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucmVwZWF0ZXIsIFtjb2xsZWN0aW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcldoZW4oXG4gICAgcHJlZmV0Y2g6IGJvb2xlYW4sIGV4cHI6IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKHByZWZldGNoID8gSWRlbnRpZmllcnMuZGVmZXJQcmVmZXRjaFdoZW4gOiBJZGVudGlmaWVycy5kZWZlcldoZW4sIFtleHByXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuKHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwoY29uc3RJbmRleCldO1xuICBpZiAoc3ViVGVtcGxhdGVJbmRleCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoc3ViVGVtcGxhdGVJbmRleCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG4sIGFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkVuZCgpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5FbmQsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5BdHRyaWJ1dGVzKHNsb3Q6IG51bWJlciwgaTE4bkF0dHJpYnV0ZXNDb25maWc6IG51bWJlcik6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChpMThuQXR0cmlidXRlc0NvbmZpZyldO1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuQXR0cmlidXRlcywgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb3BlcnR5LCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF0dHJpYnV0ZShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBuYW1lc3BhY2U6IHN0cmluZ3xudWxsKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl07XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwgfHwgbmFtZXNwYWNlICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplciA/PyBvLmxpdGVyYWwobnVsbCkpO1xuICB9XG4gIGlmIChuYW1lc3BhY2UgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKG5hbWVzcGFjZSkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmF0dHJpYnV0ZSwgYXJncywgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAodW5pdCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwodW5pdCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlUHJvcCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc1Byb3AoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NQcm9wLCBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuc3R5bGVNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc01hcChleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY2xhc3NNYXAsIFtleHByZXNzaW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmNvbnN0IFBJUEVfQklORElOR1M6IG8uRXh0ZXJuYWxSZWZlcmVuY2VbXSA9IFtcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQxLFxuICBJZGVudGlmaWVycy5waXBlQmluZDIsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMyxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQ0LFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kKHNsb3Q6IG51bWJlciwgdmFyT2Zmc2V0OiBudW1iZXIsIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGFyZ3MubGVuZ3RoIDwgMSB8fCBhcmdzLmxlbmd0aCA+IFBJUEVfQklORElOR1MubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBwaXBlQmluZCgpIGFyZ3VtZW50IGNvdW50IG91dCBvZiBib3VuZHNgKTtcbiAgfVxuXG4gIGNvbnN0IGluc3RydWN0aW9uID0gUElQRV9CSU5ESU5HU1thcmdzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgICBvLmxpdGVyYWwodmFyT2Zmc2V0KSxcbiAgICAuLi5hcmdzLFxuICBdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGVCaW5kVihzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnBpcGVCaW5kVikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0SW50ZXJwb2xhdGUoXG4gICAgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBpZiAoc3RyaW5ncy5sZW5ndGggPCAxIHx8IGV4cHJlc3Npb25zLmxlbmd0aCAhPT0gc3RyaW5ncy5sZW5ndGggLSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNwZWNpZmljIHNoYXBlIG9mIGFyZ3MgZm9yIHN0cmluZ3MvZXhwcmVzc2lvbnMgaW4gaW50ZXJwb2xhdGlvbmApO1xuICB9XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKGV4cHJlc3Npb25zWzBdKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgaWR4OiBudW1iZXI7XG4gICAgZm9yIChpZHggPSAwOyBpZHggPCBleHByZXNzaW9ucy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pLCBleHByZXNzaW9uc1tpZHhdKTtcbiAgICB9XG4gICAgLy8gaWR4IHBvaW50cyBhdCB0aGUgbGFzdCBzdHJpbmcuXG4gICAgaW50ZXJwb2xhdGlvbkFyZ3MucHVzaChvLmxpdGVyYWwoc3RyaW5nc1tpZHhdKSk7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oVEVYVF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkV4cChleHByOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRXhwLCBbZXhwcl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkFwcGx5KHNsb3Q6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChzbG90KV0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3MgPSBbXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGV4dHJhQXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NNYXBJbnRlcnBvbGF0ZShcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHLCBbXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaG9zdFByb3BlcnR5LCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRoZXRpY0hvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVyZUZ1bmN0aW9uKFxuICAgIHZhck9mZnNldDogbnVtYmVyLCBmbjogby5FeHByZXNzaW9uLCBhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbkV4cHIoXG4gICAgICBQVVJFX0ZVTkNUSU9OX0NPTkZJRyxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgICAgIGZuLFxuICAgICAgXSxcbiAgICAgIGFyZ3MsXG4gICAgICBbXSxcbiAgICAgIG51bGwsXG4gICk7XG59XG5cbi8qKlxuICogQ29sbGF0ZXMgdGhlIHN0cmluZyBhbiBleHByZXNzaW9uIGFyZ3VtZW50cyBmb3IgYW4gaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbi5cbiAqL1xuZnVuY3Rpb24gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIGlmIChzdHJpbmdzLmxlbmd0aCA8IDEgfHwgZXhwcmVzc2lvbnMubGVuZ3RoICE9PSBzdHJpbmdzLmxlbmd0aCAtIDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgc3BlY2lmaWMgc2hhcGUgb2YgYXJncyBmb3Igc3RyaW5ncy9leHByZXNzaW9ucyBpbiBpbnRlcnBvbGF0aW9uYCk7XG4gIH1cbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goZXhwcmVzc2lvbnNbMF0pO1xuICB9IGVsc2Uge1xuICAgIGxldCBpZHg6IG51bWJlcjtcbiAgICBmb3IgKGlkeCA9IDA7IGlkeCA8IGV4cHJlc3Npb25zLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSksIGV4cHJlc3Npb25zW2lkeF0pO1xuICAgIH1cbiAgICAvLyBpZHggcG9pbnRzIGF0IHRoZSBsYXN0IHN0cmluZy5cbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pKTtcbiAgfVxuXG4gIHJldHVybiBpbnRlcnBvbGF0aW9uQXJncztcbn1cblxuZnVuY3Rpb24gY2FsbDxPcFQgZXh0ZW5kcyBpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4oXG4gICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGFyZ3M6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IE9wVCB7XG4gIGNvbnN0IGV4cHIgPSBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihhcmdzLCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwciwgc291cmNlU3BhbikpIGFzIE9wVDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsKFxuICAgIHNsb3Q6IG51bWJlciwgY29uZGl0aW9uOiBvLkV4cHJlc3Npb24sIGNvbnRleHRWYWx1ZTogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBjb25kaXRpb25dO1xuICBpZiAoY29udGV4dFZhbHVlICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKGNvbnRleHRWYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuY29uZGl0aW9uYWwsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG4vKipcbiAqIERlc2NyaWJlcyBhIHNwZWNpZmljIGZsYXZvciBvZiBpbnN0cnVjdGlvbiB1c2VkIHRvIHJlcHJlc2VudCB2YXJpYWRpYyBpbnN0cnVjdGlvbnMsIHdoaWNoXG4gKiBoYXZlIHNvbWUgbnVtYmVyIG9mIHZhcmlhbnRzIGZvciBzcGVjaWZpYyBhcmd1bWVudCBjb3VudHMuXG4gKi9cbmludGVyZmFjZSBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnIHtcbiAgY29uc3RhbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2VbXTtcbiAgdmFyaWFibGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8bnVsbDtcbiAgbWFwcGluZzogKGFyZ0NvdW50OiBudW1iZXIpID0+IG51bWJlcjtcbn1cblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgdGV4dEludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgVEVYVF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHByb3BlcnR5SW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBQUk9QRVJUWV9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZSxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgc3R5bGVQcm9wSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBTVFlMRV9QUk9QX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3AsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGF0dHJpYnV0ZUludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgQVRUUklCVVRFX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGUsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYHN0eWxlTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBTVFlMRV9NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnN0eWxlTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBjbGFzc01hcEludGVycG9sYXRlYCBpbnN0cnVjdGlvbi5cbiAqL1xuY29uc3QgQ0xBU1NfTUFQX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcCxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlMixcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlNSxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy5jbGFzc01hcEludGVycG9sYXRlOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuY29uc3QgUFVSRV9GVU5DVElPTl9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMCxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24xLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjIsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMyxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb240LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjUsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb243LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb25WLFxuICBtYXBwaW5nOiBuID0+IG4sXG59O1xuXG5mdW5jdGlvbiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbkV4cHIoXG4gICAgY29uZmlnOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnLCBiYXNlQXJnczogby5FeHByZXNzaW9uW10sIGludGVycG9sYXRpb25BcmdzOiBvLkV4cHJlc3Npb25bXSxcbiAgICBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IG4gPSBjb25maWcubWFwcGluZyhpbnRlcnBvbGF0aW9uQXJncy5sZW5ndGgpO1xuICBpZiAobiA8IGNvbmZpZy5jb25zdGFudC5sZW5ndGgpIHtcbiAgICAvLyBDb25zdGFudCBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcuY29uc3RhbnRbbl0pXG4gICAgICAgIC5jYWxsRm4oWy4uLmJhc2VBcmdzLCAuLi5pbnRlcnBvbGF0aW9uQXJncywgLi4uZXh0cmFBcmdzXSwgc291cmNlU3Bhbik7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnZhcmlhYmxlICE9PSBudWxsKSB7XG4gICAgLy8gVmFyaWFibGUgY2FsbGluZyBwYXR0ZXJuLlxuICAgIHJldHVybiBvLmltcG9ydEV4cHIoY29uZmlnLnZhcmlhYmxlKVxuICAgICAgICAuY2FsbEZuKFsuLi5iYXNlQXJncywgby5saXRlcmFsQXJyKGludGVycG9sYXRpb25BcmdzKSwgLi4uZXh0cmFBcmdzXSwgc291cmNlU3Bhbik7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogdW5hYmxlIHRvIGNhbGwgdmFyaWFkaWMgZnVuY3Rpb25gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gaXIuY3JlYXRlU3RhdGVtZW50T3AoXG4gICAgICBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbkV4cHIoY29uZmlnLCBiYXNlQXJncywgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3BhbilcbiAgICAgICAgICAudG9TdG10KCkpO1xufVxuIl19