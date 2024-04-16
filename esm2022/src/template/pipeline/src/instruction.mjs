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
export function twoWayBindingSet(target, value) {
    return o.importExpr(Identifiers.twoWayBindingSet).callFn([target, value]);
}
export function twoWayListener(name, handlerFn, sourceSpan) {
    return call(Identifiers.twoWayListener, [o.literal(name), handlerFn], sourceSpan);
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
export function projection(slot, projectionSlotIndex, attributes, fallbackFnName, fallbackDecls, fallbackVars, sourceSpan) {
    const args = [o.literal(slot)];
    if (projectionSlotIndex !== 0 || attributes !== null || fallbackFnName !== null) {
        args.push(o.literal(projectionSlotIndex));
        if (attributes !== null) {
            args.push(attributes);
        }
        if (fallbackFnName !== null) {
            if (attributes === null) {
                args.push(o.literal(null));
            }
            args.push(o.variable(fallbackFnName), o.literal(fallbackDecls), o.literal(fallbackVars));
        }
    }
    return call(Identifiers.projection, args, sourceSpan);
}
export function i18nStart(slot, constIndex, subTemplateIndex, sourceSpan) {
    const args = [o.literal(slot), o.literal(constIndex)];
    if (subTemplateIndex !== null) {
        args.push(o.literal(subTemplateIndex));
    }
    return call(Identifiers.i18nStart, args, sourceSpan);
}
export function repeaterCreate(slot, viewFnName, decls, vars, tag, constIndex, trackByFn, trackByUsesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, emptyTag, emptyConstIndex, sourceSpan) {
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
            if (emptyTag !== null || emptyConstIndex !== null) {
                args.push(o.literal(emptyTag));
            }
            if (emptyConstIndex !== null) {
                args.push(o.literal(emptyConstIndex));
            }
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
export function i18n(slot, constIndex, subTemplateIndex, sourceSpan) {
    const args = [o.literal(slot), o.literal(constIndex)];
    if (subTemplateIndex) {
        args.push(o.literal(subTemplateIndex));
    }
    return call(Identifiers.i18n, args, sourceSpan);
}
export function i18nEnd(endSourceSpan) {
    return call(Identifiers.i18nEnd, [], endSourceSpan);
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
export function twoWayProperty(name, expression, sanitizer, sourceSpan) {
    const args = [o.literal(name), expression];
    if (sanitizer !== null) {
        args.push(sanitizer);
    }
    return call(Identifiers.twoWayProperty, args, sourceSpan);
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
    const interpolationArgs = collateInterpolationArgs(strings, expressions);
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
export function conditional(condition, contextValue, sourceSpan) {
    const args = [condition];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdHJ1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luc3RydWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRTVCLDJGQUEyRjtBQUMzRixpR0FBaUc7QUFDakcsb0NBQW9DO0FBRXBDLE1BQU0sVUFBVSxPQUFPLENBQ25CLElBQVksRUFBRSxHQUFXLEVBQUUsVUFBdUIsRUFBRSxhQUEwQixFQUM5RSxVQUEyQjtJQUM3QixPQUFPLHNCQUFzQixDQUN6QixXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FDeEIsSUFBWSxFQUFFLEdBQVcsRUFBRSxVQUF1QixFQUFFLGFBQTBCLEVBQzlFLFVBQTJCO0lBQzdCLE9BQU8sc0JBQXNCLENBQ3pCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixXQUFnQyxFQUFFLElBQVksRUFBRSxHQUFnQixFQUFFLFVBQXVCLEVBQ3pGLGFBQTBCLEVBQUUsVUFBMkI7SUFDekQsTUFBTSxJQUFJLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxLQUFLLElBQUksRUFBRSxD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KiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi8uLi8uLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL2lyJztcblxuLy8gVGhpcyBmaWxlIGNvbnRhaW5zIGhlbHBlcnMgZm9yIGdlbmVyYXRpbmcgY2FsbHMgdG8gSXZ5IGluc3RydWN0aW9ucy4gSW4gcGFydGljdWxhciwgZWFjaFxuLy8gaW5zdHJ1Y3Rpb24gdHlwZSBpcyByZXByZXNlbnRlZCBhcyBhIGZ1bmN0aW9uLCB3aGljaCBtYXkgc2VsZWN0IGEgc3BlY2lmaWMgaW5zdHJ1Y3Rpb24gdmFyaWFudFxuLy8gZGVwZW5kaW5nIG9uIHRoZSBleGFjdCBhcmd1bWVudHMuXG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50KFxuICAgIHNsb3Q6IG51bWJlciwgdGFnOiBzdHJpbmcsIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBlbGVtZW50T3JDb250YWluZXJCYXNlKFxuICAgICAgSWRlbnRpZmllcnMuZWxlbWVudCwgc2xvdCwgdGFnLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRTdGFydChcbiAgICBzbG90OiBudW1iZXIsIHRhZzogc3RyaW5nLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRTdGFydCwgc2xvdCwgdGFnLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgc2xvdDogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBsb2NhbFJlZkluZGV4OiBudW1iZXJ8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICBpZiAodGFnICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh0YWcpKTtcbiAgfVxuICBpZiAobG9jYWxSZWZJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChcbiAgICAgICAgby5saXRlcmFsKGNvbnN0SW5kZXgpLCAgLy8gbWlnaHQgYmUgbnVsbCwgYnV0IHRoYXQncyBva2F5LlxuICAgICAgICBvLmxpdGVyYWwobG9jYWxSZWZJbmRleCksXG4gICAgKTtcbiAgfSBlbHNlIGlmIChjb25zdEluZGV4ICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChjb25zdEluZGV4KSk7XG4gIH1cblxuICByZXR1cm4gY2FsbChpbnN0cnVjdGlvbiwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50RW5kKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50RW5kLCBbXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50Q29udGFpbmVyU3RhcnQoXG4gICAgc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXJTdGFydCwgc2xvdCwgLyogdGFnICovIG51bGwsIGNvbnN0SW5kZXgsIGxvY2FsUmVmSW5kZXgsXG4gICAgICBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXIoXG4gICAgc2xvdDogbnVtYmVyLCBjb25zdEluZGV4OiBudW1iZXJ8bnVsbCwgbG9jYWxSZWZJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gZWxlbWVudE9yQ29udGFpbmVyQmFzZShcbiAgICAgIElkZW50aWZpZXJzLmVsZW1lbnRDb250YWluZXIsIHNsb3QsIC8qIHRhZyAqLyBudWxsLCBjb25zdEluZGV4LCBsb2NhbFJlZkluZGV4LCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRDb250YWluZXJFbmQoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5lbGVtZW50Q29udGFpbmVyRW5kLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZShcbiAgICBzbG90OiBudW1iZXIsIHRlbXBsYXRlRm5SZWY6IG8uRXhwcmVzc2lvbiwgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLFxuICAgIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCBsb2NhbFJlZnM6IG51bWJlcnxudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIHRlbXBsYXRlRm5SZWYsXG4gICAgby5saXRlcmFsKGRlY2xzKSxcbiAgICBvLmxpdGVyYWwodmFycyksXG4gICAgby5saXRlcmFsKHRhZyksXG4gICAgby5saXRlcmFsKGNvbnN0SW5kZXgpLFxuICBdO1xuICBpZiAobG9jYWxSZWZzICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChsb2NhbFJlZnMpKTtcbiAgICBhcmdzLnB1c2goby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnRlbXBsYXRlUmVmRXh0cmFjdG9yKSk7XG4gIH1cbiAgd2hpbGUgKGFyZ3NbYXJncy5sZW5ndGggLSAxXS5pc0VxdWl2YWxlbnQoby5OVUxMX0VYUFIpKSB7XG4gICAgYXJncy5wb3AoKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy50ZW1wbGF0ZUNyZWF0ZSwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlQmluZGluZ3MoKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5kaXNhYmxlQmluZGluZ3MsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUJpbmRpbmdzKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuZW5hYmxlQmluZGluZ3MsIFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbmVyKFxuICAgIG5hbWU6IHN0cmluZywgaGFuZGxlckZuOiBvLkV4cHJlc3Npb24sIGV2ZW50VGFyZ2V0UmVzb2x2ZXI6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8bnVsbCxcbiAgICBzeW50aGV0aWNIb3N0OiBib29sZWFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAoZXZlbnRUYXJnZXRSZXNvbHZlciAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoZmFsc2UpKTsgIC8vIGB1c2VDYXB0dXJlYCBmbGFnLCBkZWZhdWx0cyB0byBgZmFsc2VgXG4gICAgYXJncy5wdXNoKG8uaW1wb3J0RXhwcihldmVudFRhcmdldFJlc29sdmVyKSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoXG4gICAgICBzeW50aGV0aWNIb3N0ID8gSWRlbnRpZmllcnMuc3ludGhldGljSG9zdExpc3RlbmVyIDogSWRlbnRpZmllcnMubGlzdGVuZXIsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHdvV2F5QmluZGluZ1NldCh0YXJnZXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMudHdvV2F5QmluZGluZ1NldCkuY2FsbEZuKFt0YXJnZXQsIHZhbHVlXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0d29XYXlMaXN0ZW5lcihcbiAgICBuYW1lOiBzdHJpbmcsIGhhbmRsZXJGbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnR3b1dheUxpc3RlbmVyLCBbby5saXRlcmFsKG5hbWUpLCBoYW5kbGVyRm5dLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpcGUoc2xvdDogbnVtYmVyLCBuYW1lOiBzdHJpbmcpOiBpci5DcmVhdGVPcCB7XG4gIHJldHVybiBjYWxsKFxuICAgICAgSWRlbnRpZmllcnMucGlwZSxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKHNsb3QpLFxuICAgICAgICBvLmxpdGVyYWwobmFtZSksXG4gICAgICBdLFxuICAgICAgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VIVE1MKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlSFRNTCwgW10sIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlU1ZHKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlU1ZHLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYW1lc3BhY2VNYXRoKCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMubmFtZXNwYWNlTWF0aE1MLCBbXSwgbnVsbCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZHZhbmNlKGRlbHRhOiBudW1iZXIsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuYWR2YW5jZSwgZGVsdGEgPiAxID8gW28ubGl0ZXJhbChkZWx0YSldIDogW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmZXJlbmNlKHNsb3Q6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVmZXJlbmNlKS5jYWxsRm4oW1xuICAgIG8ubGl0ZXJhbChzbG90KSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXh0Q29udGV4dChzdGVwczogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5uZXh0Q29udGV4dCkuY2FsbEZuKHN0ZXBzID09PSAxID8gW10gOiBbby5saXRlcmFsKHN0ZXBzKV0pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VmlldygpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmdldEN1cnJlbnRWaWV3KS5jYWxsRm4oW10pO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlVmlldyhzYXZlZFZpZXc6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucmVzdG9yZVZpZXcpLmNhbGxGbihbXG4gICAgc2F2ZWRWaWV3LFxuICBdKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRWaWV3KHJldHVyblZhbHVlOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLnJlc2V0VmlldykuY2FsbEZuKFtcbiAgICByZXR1cm5WYWx1ZSxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KFxuICAgIHNsb3Q6IG51bWJlciwgaW5pdGlhbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCwgbnVsbCldO1xuICBpZiAoaW5pdGlhbFZhbHVlICE9PSAnJykge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoaW5pdGlhbFZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMudGV4dCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcihcbiAgICBzZWxmU2xvdDogbnVtYmVyLCBwcmltYXJ5U2xvdDogbnVtYmVyLCBkZXBlbmRlbmN5UmVzb2x2ZXJGbjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgbG9hZGluZ1Nsb3Q6IG51bWJlcnxudWxsLCBwbGFjZWhvbGRlclNsb3Q6IG51bWJlcnxudWxsLCBlcnJvclNsb3Q6IG51bWJlcnxudWxsLFxuICAgIGxvYWRpbmdDb25maWc6IG8uRXhwcmVzc2lvbnxudWxsLCBwbGFjZWhvbGRlckNvbmZpZzogby5FeHByZXNzaW9ufG51bGwsXG4gICAgZW5hYmxlVGltZXJTY2hlZHVsaW5nOiBib29sZWFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgYXJnczogQXJyYXk8by5FeHByZXNzaW9uPiA9IFtcbiAgICBvLmxpdGVyYWwoc2VsZlNsb3QpLFxuICAgIG8ubGl0ZXJhbChwcmltYXJ5U2xvdCksXG4gICAgZGVwZW5kZW5jeVJlc29sdmVyRm4gPz8gby5saXRlcmFsKG51bGwpLFxuICAgIG8ubGl0ZXJhbChsb2FkaW5nU2xvdCksXG4gICAgby5saXRlcmFsKHBsYWNlaG9sZGVyU2xvdCksXG4gICAgby5saXRlcmFsKGVycm9yU2xvdCksXG4gICAgbG9hZGluZ0NvbmZpZyA/PyBvLmxpdGVyYWwobnVsbCksXG4gICAgcGxhY2Vob2xkZXJDb25maWcgPz8gby5saXRlcmFsKG51bGwpLFxuICAgIGVuYWJsZVRpbWVyU2NoZWR1bGluZyA/IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5kZWZlckVuYWJsZVRpbWVyU2NoZWR1bGluZykgOiBvLmxpdGVyYWwobnVsbCksXG4gIF07XG5cbiAgbGV0IGV4cHI6IG8uRXhwcmVzc2lvbjtcbiAgd2hpbGUgKChleHByID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdKSAhPT0gbnVsbCAmJiBleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJlxuICAgICAgICAgZXhwci52YWx1ZSA9PT0gbnVsbCkge1xuICAgIGFyZ3MucG9wKCk7XG4gIH1cblxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5kZWZlciwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmNvbnN0IGRlZmVyVHJpZ2dlclRvUjNUcmlnZ2VySW5zdHJ1Y3Rpb25zTWFwID0gbmV3IE1hcChbXG4gIFtpci5EZWZlclRyaWdnZXJLaW5kLklkbGUsIFtJZGVudGlmaWVycy5kZWZlck9uSWRsZSwgSWRlbnRpZmllcnMuZGVmZXJQcmVmZXRjaE9uSWRsZV1dLFxuICBbXG4gICAgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbW1lZGlhdGUsXG4gICAgW0lkZW50aWZpZXJzLmRlZmVyT25JbW1lZGlhdGUsIElkZW50aWZpZXJzLmRlZmVyUHJlZmV0Y2hPbkltbWVkaWF0ZV1cbiAgXSxcbiAgW2lyLkRlZmVyVHJpZ2dlcktpbmQuVGltZXIsIFtJZGVudGlmaWVycy5kZWZlck9uVGltZXIsIElkZW50aWZpZXJzLmRlZmVyUHJlZmV0Y2hPblRpbWVyXV0sXG4gIFtpci5EZWZlclRyaWdnZXJLaW5kLkhvdmVyLCBbSWRlbnRpZmllcnMuZGVmZXJPbkhvdmVyLCBJZGVudGlmaWVycy5kZWZlclByZWZldGNoT25Ib3Zlcl1dLFxuICBbXG4gICAgaXIuRGVmZXJUcmlnZ2VyS2luZC5JbnRlcmFjdGlvbixcbiAgICBbSWRlbnRpZmllcnMuZGVmZXJPbkludGVyYWN0aW9uLCBJZGVudGlmaWVycy5kZWZlclByZWZldGNoT25JbnRlcmFjdGlvbl1cbiAgXSxcbiAgW1xuICAgIGlyLkRlZmVyVHJpZ2dlcktpbmQuVmlld3BvcnQsIFtJZGVudGlmaWVycy5kZWZlck9uVmlld3BvcnQsIElkZW50aWZpZXJzLmRlZmVyUHJlZmV0Y2hPblZpZXdwb3J0XVxuICBdLFxuXSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlck9uKFxuICAgIHRyaWdnZXI6IGlyLkRlZmVyVHJpZ2dlcktpbmQsIGFyZ3M6IG51bWJlcltdLCBwcmVmZXRjaDogYm9vbGVhbixcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgY29uc3QgaW5zdHJ1Y3Rpb25zID0gZGVmZXJUcmlnZ2VyVG9SM1RyaWdnZXJJbnN0cnVjdGlvbnNNYXAuZ2V0KHRyaWdnZXIpO1xuICBpZiAoaW5zdHJ1Y3Rpb25zID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgaW5zdHJ1Y3Rpb24gZm9yIHRyaWdnZXIgJHt0cmlnZ2VyfWApO1xuICB9XG4gIGNvbnN0IGluc3RydWN0aW9uVG9DYWxsID0gcHJlZmV0Y2ggPyBpbnN0cnVjdGlvbnNbMV0gOiBpbnN0cnVjdGlvbnNbMF07XG4gIHJldHVybiBjYWxsKGluc3RydWN0aW9uVG9DYWxsLCBhcmdzLm1hcChhID0+IG8ubGl0ZXJhbChhKSksIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvamVjdGlvbkRlZihkZWY6IG8uRXhwcmVzc2lvbnxudWxsKTogaXIuQ3JlYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5wcm9qZWN0aW9uRGVmLCBkZWYgPyBbZGVmXSA6IFtdLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb24oXG4gICAgc2xvdDogbnVtYmVyLCBwcm9qZWN0aW9uU2xvdEluZGV4OiBudW1iZXIsIGF0dHJpYnV0ZXM6IG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsLFxuICAgIGZhbGxiYWNrRm5OYW1lOiBzdHJpbmd8bnVsbCwgZmFsbGJhY2tEZWNsczogbnVtYmVyfG51bGwsIGZhbGxiYWNrVmFyczogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICBpZiAocHJvamVjdGlvblNsb3RJbmRleCAhPT0gMCB8fCBhdHRyaWJ1dGVzICE9PSBudWxsIHx8IGZhbGxiYWNrRm5OYW1lICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdEluZGV4KSk7XG4gICAgaWYgKGF0dHJpYnV0ZXMgIT09IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaChhdHRyaWJ1dGVzKTtcbiAgICB9XG4gICAgaWYgKGZhbGxiYWNrRm5OYW1lICE9PSBudWxsKSB7XG4gICAgICBpZiAoYXR0cmlidXRlcyA9PT0gbnVsbCkge1xuICAgICAgICBhcmdzLnB1c2goby5saXRlcmFsKG51bGwpKTtcbiAgICAgIH1cbiAgICAgIGFyZ3MucHVzaChvLnZhcmlhYmxlKGZhbGxiYWNrRm5OYW1lKSwgby5saXRlcmFsKGZhbGxiYWNrRGVjbHMpLCBvLmxpdGVyYWwoZmFsbGJhY2tWYXJzKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnByb2plY3Rpb24sIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0KFxuICAgIHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwoY29uc3RJbmRleCldO1xuICBpZiAoc3ViVGVtcGxhdGVJbmRleCAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoc3ViVGVtcGxhdGVJbmRleCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5TdGFydCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXRlckNyZWF0ZShcbiAgICBzbG90OiBudW1iZXIsIHZpZXdGbk5hbWU6IHN0cmluZywgZGVjbHM6IG51bWJlciwgdmFyczogbnVtYmVyLCB0YWc6IHN0cmluZ3xudWxsLFxuICAgIGNvbnN0SW5kZXg6IG51bWJlcnxudWxsLCB0cmFja0J5Rm46IG8uRXhwcmVzc2lvbiwgdHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZTogYm9vbGVhbixcbiAgICBlbXB0eVZpZXdGbk5hbWU6IHN0cmluZ3xudWxsLCBlbXB0eURlY2xzOiBudW1iZXJ8bnVsbCwgZW1wdHlWYXJzOiBudW1iZXJ8bnVsbCxcbiAgICBlbXB0eVRhZzogc3RyaW5nfG51bGwsIGVtcHR5Q29uc3RJbmRleDogbnVtYmVyfG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8udmFyaWFibGUodmlld0ZuTmFtZSksXG4gICAgby5saXRlcmFsKGRlY2xzKSxcbiAgICBvLmxpdGVyYWwodmFycyksXG4gICAgby5saXRlcmFsKHRhZyksXG4gICAgby5saXRlcmFsKGNvbnN0SW5kZXgpLFxuICAgIHRyYWNrQnlGbixcbiAgXTtcbiAgaWYgKHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2UgfHwgZW1wdHlWaWV3Rm5OYW1lICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbCh0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlKSk7XG4gICAgaWYgKGVtcHR5Vmlld0ZuTmFtZSAhPT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKG8udmFyaWFibGUoZW1wdHlWaWV3Rm5OYW1lKSwgby5saXRlcmFsKGVtcHR5RGVjbHMpLCBvLmxpdGVyYWwoZW1wdHlWYXJzKSk7XG4gICAgICBpZiAoZW1wdHlUYWcgIT09IG51bGwgfHwgZW1wdHlDb25zdEluZGV4ICE9PSBudWxsKSB7XG4gICAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoZW1wdHlUYWcpKTtcbiAgICAgIH1cbiAgICAgIGlmIChlbXB0eUNvbnN0SW5kZXggIT09IG51bGwpIHtcbiAgICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChlbXB0eUNvbnN0SW5kZXgpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucmVwZWF0ZXJDcmVhdGUsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwZWF0ZXIoY29sbGVjdGlvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucmVwZWF0ZXIsIFtjb2xsZWN0aW9uXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcldoZW4oXG4gICAgcHJlZmV0Y2g6IGJvb2xlYW4sIGV4cHI6IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKHByZWZldGNoID8gSWRlbnRpZmllcnMuZGVmZXJQcmVmZXRjaFdoZW4gOiBJZGVudGlmaWVycy5kZWZlcldoZW4sIFtleHByXSwgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpMThuKFxuICAgIHNsb3Q6IG51bWJlciwgY29uc3RJbmRleDogbnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5DcmVhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwoY29uc3RJbmRleCldO1xuICBpZiAoc3ViVGVtcGxhdGVJbmRleCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoc3ViVGVtcGxhdGVJbmRleCkpO1xuICB9XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG4sIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkVuZChlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLkNyZWF0ZU9wIHtcbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaTE4bkVuZCwgW10sIGVuZFNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkF0dHJpYnV0ZXMoc2xvdDogbnVtYmVyLCBpMThuQXR0cmlidXRlc0NvbmZpZzogbnVtYmVyKTogaXIuQ3JlYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKGkxOG5BdHRyaWJ1dGVzQ29uZmlnKV07XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5BdHRyaWJ1dGVzLCBhcmdzLCBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3BlcnR5KFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMucHJvcGVydHksIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHdvV2F5UHJvcGVydHkoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl07XG4gIGlmIChzYW5pdGl6ZXIgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy50d29XYXlQcm9wZXJ0eSwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGUoXG4gICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgbmFtZXNwYWNlOiBzdHJpbmd8bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsIHx8IG5hbWVzcGFjZSAhPT0gbnVsbCkge1xuICAgIGFyZ3MucHVzaChzYW5pdGl6ZXIgPz8gby5saXRlcmFsKG51bGwpKTtcbiAgfVxuICBpZiAobmFtZXNwYWNlICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChuYW1lc3BhY2UpKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5hdHRyaWJ1dGUsIGFyZ3MsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVQcm9wKFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCB1bml0OiBzdHJpbmd8bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKG5hbWUpLCBleHByZXNzaW9uXTtcbiAgaWYgKHVuaXQgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5zdHlsZVByb3AsIGFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NQcm9wKFxuICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmNsYXNzUHJvcCwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVNYXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN0eWxlTWFwLCBbZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NNYXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmNsYXNzTWFwLCBbZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5jb25zdCBQSVBFX0JJTkRJTkdTOiBvLkV4dGVybmFsUmVmZXJlbmNlW10gPSBbXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kMSxcbiAgSWRlbnRpZmllcnMucGlwZUJpbmQyLFxuICBJZGVudGlmaWVycy5waXBlQmluZDMsXG4gIElkZW50aWZpZXJzLnBpcGVCaW5kNCxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZChzbG90OiBudW1iZXIsIHZhck9mZnNldDogbnVtYmVyLCBhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChhcmdzLmxlbmd0aCA8IDEgfHwgYXJncy5sZW5ndGggPiBQSVBFX0JJTkRJTkdTLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgcGlwZUJpbmQoKSBhcmd1bWVudCBjb3VudCBvdXQgb2YgYm91bmRzYCk7XG4gIH1cblxuICBjb25zdCBpbnN0cnVjdGlvbiA9IFBJUEVfQklORElOR1NbYXJncy5sZW5ndGggLSAxXTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKFtcbiAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgLi4uYXJncyxcbiAgXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaXBlQmluZFYoc2xvdDogbnVtYmVyLCB2YXJPZmZzZXQ6IG51bWJlciwgYXJnczogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5waXBlQmluZFYpLmNhbGxGbihbXG4gICAgby5saXRlcmFsKHNsb3QpLFxuICAgIG8ubGl0ZXJhbCh2YXJPZmZzZXQpLFxuICAgIGFyZ3MsXG4gIF0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oVEVYVF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkV4cChleHByOiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5pMThuRXhwLCBbZXhwcl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaTE4bkFwcGx5KHNsb3Q6IG51bWJlciwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChzbG90KV0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHlJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNhbml0aXplcjogby5FeHByZXNzaW9ufG51bGwsXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQXJncyA9IGNvbGxhdGVJbnRlcnBvbGF0aW9uQXJncyhzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gIGNvbnN0IGV4dHJhQXJncyA9IFtdO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goc2FuaXRpemVyKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRywgW28ubGl0ZXJhbChuYW1lKV0sIGludGVycG9sYXRpb25BcmdzLCBleHRyYUFyZ3MsIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlSW50ZXJwb2xhdGUoXG4gICAgbmFtZTogc3RyaW5nLCBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzYW5pdGl6ZXI6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3MgPSBbXTtcbiAgaWYgKHNhbml0aXplciAhPT0gbnVsbCkge1xuICAgIGV4dHJhQXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZVByb3BJbnRlcnBvbGF0ZShcbiAgICBuYW1lOiBzdHJpbmcsIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHVuaXQ6IHN0cmluZ3xudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICBjb25zdCBleHRyYUFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGlmICh1bml0ICE9PSBudWxsKSB7XG4gICAgZXh0cmFBcmdzLnB1c2goby5saXRlcmFsKHVuaXQpKTtcbiAgfVxuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHLCBbby5saXRlcmFsKG5hbWUpXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIGV4dHJhQXJncywgc291cmNlU3Bhbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHlsZU1hcEludGVycG9sYXRlKFxuICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3MgPSBjb2xsYXRlSW50ZXJwb2xhdGlvbkFyZ3Moc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuXG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbihcbiAgICAgIFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUcsIFtdLCBpbnRlcnBvbGF0aW9uQXJncywgW10sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NNYXBJbnRlcnBvbGF0ZShcbiAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBpci5VcGRhdGVPcCB7XG4gIGNvbnN0IGludGVycG9sYXRpb25BcmdzID0gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcblxuICByZXR1cm4gY2FsbFZhcmlhZGljSW5zdHJ1Y3Rpb24oXG4gICAgICBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHLCBbXSwgaW50ZXJwb2xhdGlvbkFyZ3MsIFtdLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc2FuaXRpemVyOiBvLkV4cHJlc3Npb258bnVsbCxcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IGlyLlVwZGF0ZU9wIHtcbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwobmFtZSksIGV4cHJlc3Npb25dO1xuICBpZiAoc2FuaXRpemVyICE9PSBudWxsKSB7XG4gICAgYXJncy5wdXNoKHNhbml0aXplcik7XG4gIH1cbiAgcmV0dXJuIGNhbGwoSWRlbnRpZmllcnMuaG9zdFByb3BlcnR5LCBhcmdzLCBzb3VyY2VTcGFuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRoZXRpY0hvc3RQcm9wZXJ0eShcbiAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBjYWxsKElkZW50aWZpZXJzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSwgW28ubGl0ZXJhbChuYW1lKSwgZXhwcmVzc2lvbl0sIHNvdXJjZVNwYW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVyZUZ1bmN0aW9uKFxuICAgIHZhck9mZnNldDogbnVtYmVyLCBmbjogby5FeHByZXNzaW9uLCBhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBjYWxsVmFyaWFkaWNJbnN0cnVjdGlvbkV4cHIoXG4gICAgICBQVVJFX0ZVTkNUSU9OX0NPTkZJRyxcbiAgICAgIFtcbiAgICAgICAgby5saXRlcmFsKHZhck9mZnNldCksXG4gICAgICAgIGZuLFxuICAgICAgXSxcbiAgICAgIGFyZ3MsXG4gICAgICBbXSxcbiAgICAgIG51bGwsXG4gICk7XG59XG5cbi8qKlxuICogQ29sbGF0ZXMgdGhlIHN0cmluZyBhbiBleHByZXNzaW9uIGFyZ3VtZW50cyBmb3IgYW4gaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbi5cbiAqL1xuZnVuY3Rpb24gY29sbGF0ZUludGVycG9sYXRpb25BcmdzKHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gIGlmIChzdHJpbmdzLmxlbmd0aCA8IDEgfHwgZXhwcmVzc2lvbnMubGVuZ3RoICE9PSBzdHJpbmdzLmxlbmd0aCAtIDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBc3NlcnRpb25FcnJvcjogZXhwZWN0ZWQgc3BlY2lmaWMgc2hhcGUgb2YgYXJncyBmb3Igc3RyaW5ncy9leHByZXNzaW9ucyBpbiBpbnRlcnBvbGF0aW9uYCk7XG4gIH1cbiAgY29uc3QgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMSAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goZXhwcmVzc2lvbnNbMF0pO1xuICB9IGVsc2Uge1xuICAgIGxldCBpZHg6IG51bWJlcjtcbiAgICBmb3IgKGlkeCA9IDA7IGlkeCA8IGV4cHJlc3Npb25zLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGludGVycG9sYXRpb25BcmdzLnB1c2goby5saXRlcmFsKHN0cmluZ3NbaWR4XSksIGV4cHJlc3Npb25zW2lkeF0pO1xuICAgIH1cbiAgICAvLyBpZHggcG9pbnRzIGF0IHRoZSBsYXN0IHN0cmluZy5cbiAgICBpbnRlcnBvbGF0aW9uQXJncy5wdXNoKG8ubGl0ZXJhbChzdHJpbmdzW2lkeF0pKTtcbiAgfVxuXG4gIHJldHVybiBpbnRlcnBvbGF0aW9uQXJncztcbn1cblxuZnVuY3Rpb24gY2FsbDxPcFQgZXh0ZW5kcyBpci5DcmVhdGVPcHxpci5VcGRhdGVPcD4oXG4gICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGFyZ3M6IG8uRXhwcmVzc2lvbltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCk6IE9wVCB7XG4gIGNvbnN0IGV4cHIgPSBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihhcmdzLCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGlyLmNyZWF0ZVN0YXRlbWVudE9wKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwciwgc291cmNlU3BhbikpIGFzIE9wVDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmRpdGlvbmFsKFxuICAgIGNvbmRpdGlvbjogby5FeHByZXNzaW9uLCBjb250ZXh0VmFsdWU6IG8uRXhwcmVzc2lvbnxudWxsLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogaXIuVXBkYXRlT3Age1xuICBjb25zdCBhcmdzID0gW2NvbmRpdGlvbl07XG4gIGlmIChjb250ZXh0VmFsdWUgIT09IG51bGwpIHtcbiAgICBhcmdzLnB1c2goY29udGV4dFZhbHVlKTtcbiAgfVxuICByZXR1cm4gY2FsbChJZGVudGlmaWVycy5jb25kaXRpb25hbCwgYXJncywgc291cmNlU3Bhbik7XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIGEgc3BlY2lmaWMgZmxhdm9yIG9mIGluc3RydWN0aW9uIHVzZWQgdG8gcmVwcmVzZW50IHZhcmlhZGljIGluc3RydWN0aW9ucywgd2hpY2hcbiAqIGhhdmUgc29tZSBudW1iZXIgb2YgdmFyaWFudHMgZm9yIHNwZWNpZmljIGFyZ3VtZW50IGNvdW50cy5cbiAqL1xuaW50ZXJmYWNlIFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcge1xuICBjb25zdGFudDogby5FeHRlcm5hbFJlZmVyZW5jZVtdO1xuICB2YXJpYWJsZTogby5FeHRlcm5hbFJlZmVyZW5jZXxudWxsO1xuICBtYXBwaW5nOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gbnVtYmVyO1xufVxuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGB0ZXh0SW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBURVhUX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlMSxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNCxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnRleHRJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlNyxcbiAgICBJZGVudGlmaWVycy50ZXh0SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMudGV4dEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFBST1BFUlRZX0lOVEVSUE9MQVRFX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wcm9wZXJ0eUludGVycG9sYXRlLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLnByb3BlcnR5SW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMucHJvcGVydHlJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG4vKipcbiAqIGBJbnRlcnBvbGF0aW9uQ29uZmlnYCBmb3IgdGhlIGBzdHlsZVByb3BJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX1BST1BfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcCxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLnN0eWxlUHJvcEludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5zdHlsZVByb3BJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuc3R5bGVQcm9wSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgYXR0cmlidXRlSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBBVFRSSUJVVEVfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZSxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlMyxcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmF0dHJpYnV0ZUludGVycG9sYXRlNixcbiAgICBJZGVudGlmaWVycy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuYXR0cmlidXRlSW50ZXJwb2xhdGVWLFxuICBtYXBwaW5nOiBuID0+IHtcbiAgICBpZiAobiAlIDIgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgb2RkIG51bWJlciBvZiBhcmd1bWVudHNgKTtcbiAgICB9XG4gICAgcmV0dXJuIChuIC0gMSkgLyAyO1xuICB9LFxufTtcblxuLyoqXG4gKiBgSW50ZXJwb2xhdGlvbkNvbmZpZ2AgZm9yIHRoZSBgc3R5bGVNYXBJbnRlcnBvbGF0ZWAgaW5zdHJ1Y3Rpb24uXG4gKi9cbmNvbnN0IFNUWUxFX01BUF9JTlRFUlBPTEFURV9DT05GSUc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcgPSB7XG4gIGNvbnN0YW50OiBbXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXAsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTEsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTIsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTMsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTQsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTUsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTYsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTcsXG4gICAgSWRlbnRpZmllcnMuc3R5bGVNYXBJbnRlcnBvbGF0ZTgsXG4gIF0sXG4gIHZhcmlhYmxlOiBJZGVudGlmaWVycy5zdHlsZU1hcEludGVycG9sYXRlVixcbiAgbWFwcGluZzogbiA9PiB7XG4gICAgaWYgKG4gJSAyID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIG9kZCBudW1iZXIgb2YgYXJndW1lbnRzYCk7XG4gICAgfVxuICAgIHJldHVybiAobiAtIDEpIC8gMjtcbiAgfSxcbn07XG5cbi8qKlxuICogYEludGVycG9sYXRpb25Db25maWdgIGZvciB0aGUgYGNsYXNzTWFwSW50ZXJwb2xhdGVgIGluc3RydWN0aW9uLlxuICovXG5jb25zdCBDTEFTU19NQVBfSU5URVJQT0xBVEVfQ09ORklHOiBWYXJpYWRpY0luc3RydWN0aW9uQ29uZmlnID0ge1xuICBjb25zdGFudDogW1xuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUxLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUyLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGUzLFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU0LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU1LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU2LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU3LFxuICAgIElkZW50aWZpZXJzLmNsYXNzTWFwSW50ZXJwb2xhdGU4LFxuICBdLFxuICB2YXJpYWJsZTogSWRlbnRpZmllcnMuY2xhc3NNYXBJbnRlcnBvbGF0ZVYsXG4gIG1hcHBpbmc6IG4gPT4ge1xuICAgIGlmIChuICUgMiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBvZGQgbnVtYmVyIG9mIGFyZ3VtZW50c2ApO1xuICAgIH1cbiAgICByZXR1cm4gKG4gLSAxKSAvIDI7XG4gIH0sXG59O1xuXG5jb25zdCBQVVJFX0ZVTkNUSU9OX0NPTkZJRzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZyA9IHtcbiAgY29uc3RhbnQ6IFtcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24wLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjEsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uMixcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb24zLFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjQsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uNSxcbiAgICBJZGVudGlmaWVycy5wdXJlRnVuY3Rpb242LFxuICAgIElkZW50aWZpZXJzLnB1cmVGdW5jdGlvbjcsXG4gICAgSWRlbnRpZmllcnMucHVyZUZ1bmN0aW9uOCxcbiAgXSxcbiAgdmFyaWFibGU6IElkZW50aWZpZXJzLnB1cmVGdW5jdGlvblYsXG4gIG1hcHBpbmc6IG4gPT4gbixcbn07XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihcbiAgICBjb25maWc6IFZhcmlhZGljSW5zdHJ1Y3Rpb25Db25maWcsIGJhc2VBcmdzOiBvLkV4cHJlc3Npb25bXSwgaW50ZXJwb2xhdGlvbkFyZ3M6IG8uRXhwcmVzc2lvbltdLFxuICAgIGV4dHJhQXJnczogby5FeHByZXNzaW9uW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbiA9IGNvbmZpZy5tYXBwaW5nKGludGVycG9sYXRpb25BcmdzLmxlbmd0aCk7XG4gIGlmIChuIDwgY29uZmlnLmNvbnN0YW50Lmxlbmd0aCkge1xuICAgIC8vIENvbnN0YW50IGNhbGxpbmcgcGF0dGVybi5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKGNvbmZpZy5jb25zdGFudFtuXSlcbiAgICAgICAgLmNhbGxGbihbLi4uYmFzZUFyZ3MsIC4uLmludGVycG9sYXRpb25BcmdzLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIGlmIChjb25maWcudmFyaWFibGUgIT09IG51bGwpIHtcbiAgICAvLyBWYXJpYWJsZSBjYWxsaW5nIHBhdHRlcm4uXG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihjb25maWcudmFyaWFibGUpXG4gICAgICAgIC5jYWxsRm4oWy4uLmJhc2VBcmdzLCBvLmxpdGVyYWxBcnIoaW50ZXJwb2xhdGlvbkFyZ3MpLCAuLi5leHRyYUFyZ3NdLCBzb3VyY2VTcGFuKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB1bmFibGUgdG8gY2FsbCB2YXJpYWRpYyBmdW5jdGlvbmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uKFxuICAgIGNvbmZpZzogVmFyaWFkaWNJbnN0cnVjdGlvbkNvbmZpZywgYmFzZUFyZ3M6IG8uRXhwcmVzc2lvbltdLCBpbnRlcnBvbGF0aW9uQXJnczogby5FeHByZXNzaW9uW10sXG4gICAgZXh0cmFBcmdzOiBvLkV4cHJlc3Npb25bXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBpci5VcGRhdGVPcCB7XG4gIHJldHVybiBpci5jcmVhdGVTdGF0ZW1lbnRPcChcbiAgICAgIGNhbGxWYXJpYWRpY0luc3RydWN0aW9uRXhwcihjb25maWcsIGJhc2VBcmdzLCBpbnRlcnBvbGF0aW9uQXJncywgZXh0cmFBcmdzLCBzb3VyY2VTcGFuKVxuICAgICAgICAgIC50b1N0bXQoKSk7XG59XG4iXX0=