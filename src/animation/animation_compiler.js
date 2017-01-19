/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isPresent } from '../facade/lang';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { ANY_STATE, DEFAULT_STATE, EMPTY_STATE } from '../private_import_core';
import { AnimationStateTransitionFnExpression, AnimationStepAst } from './animation_ast';
export class AnimationEntryCompileResult {
    /**
     * @param {?} name
     * @param {?} statements
     * @param {?} fnExp
     */
    constructor(name, statements, fnExp) {
        this.name = name;
        this.statements = statements;
        this.fnExp = fnExp;
    }
}
function AnimationEntryCompileResult_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationEntryCompileResult.prototype.name;
    /** @type {?} */
    AnimationEntryCompileResult.prototype.statements;
    /** @type {?} */
    AnimationEntryCompileResult.prototype.fnExp;
}
export class AnimationCompiler {
    /**
     * @param {?} factoryNamePrefix
     * @param {?} parsedAnimations
     * @return {?}
     */
    compile(factoryNamePrefix, parsedAnimations) {
        return parsedAnimations.map(entry => {
            const /** @type {?} */ factoryName = `${factoryNamePrefix}_${entry.name}`;
            const /** @type {?} */ visitor = new _AnimationBuilder(entry.name, factoryName);
            return visitor.build(entry);
        });
    }
}
const /** @type {?} */ _ANIMATION_FACTORY_ELEMENT_VAR = o.variable('element');
const /** @type {?} */ _ANIMATION_DEFAULT_STATE_VAR = o.variable('defaultStateStyles');
const /** @type {?} */ _ANIMATION_FACTORY_VIEW_VAR = o.variable('view');
const /** @type {?} */ _ANIMATION_FACTORY_VIEW_CONTEXT = _ANIMATION_FACTORY_VIEW_VAR.prop('animationContext');
const /** @type {?} */ _ANIMATION_FACTORY_RENDERER_VAR = _ANIMATION_FACTORY_VIEW_VAR.prop('renderer');
const /** @type {?} */ _ANIMATION_CURRENT_STATE_VAR = o.variable('currentState');
const /** @type {?} */ _ANIMATION_NEXT_STATE_VAR = o.variable('nextState');
const /** @type {?} */ _ANIMATION_PLAYER_VAR = o.variable('player');
const /** @type {?} */ _ANIMATION_TIME_VAR = o.variable('totalTime');
const /** @type {?} */ _ANIMATION_START_STATE_STYLES_VAR = o.variable('startStateStyles');
const /** @type {?} */ _ANIMATION_END_STATE_STYLES_VAR = o.variable('endStateStyles');
const /** @type {?} */ _ANIMATION_COLLECTED_STYLES = o.variable('collectedStyles');
const /** @type {?} */ _PREVIOUS_ANIMATION_PLAYERS = o.variable('previousPlayers');
const /** @type {?} */ _EMPTY_MAP = o.literalMap([]);
const /** @type {?} */ _EMPTY_ARRAY = o.literalArr([]);
class _AnimationBuilder {
    /**
     * @param {?} animationName
     * @param {?} factoryName
     */
    constructor(animationName, factoryName) {
        this.animationName = animationName;
        this._fnVarName = factoryName + '_factory';
        this._statesMapVarName = factoryName + '_states';
        this._statesMapVar = o.variable(this._statesMapVarName);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationStyles(ast, context) {
        const /** @type {?} */ stylesArr = [];
        if (context.isExpectingFirstStyleStep) {
            stylesArr.push(_ANIMATION_START_STATE_STYLES_VAR);
            context.isExpectingFirstStyleStep = false;
        }
        ast.styles.forEach(entry => {
            const /** @type {?} */ entries = Object.keys(entry).map((key) => [key, o.literal(entry[key])]);
            stylesArr.push(o.literalMap(entries, null, true));
        });
        return o.importExpr(createIdentifier(Identifiers.AnimationStyles)).instantiate([
            o.importExpr(createIdentifier(Identifiers.collectAndResolveStyles)).callFn([
                _ANIMATION_COLLECTED_STYLES, o.literalArr(stylesArr)
            ])
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationKeyframe(ast, context) {
        return o.importExpr(createIdentifier(Identifiers.AnimationKeyframe)).instantiate([
            o.literal(ast.offset), ast.styles.visit(this, context)
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationStep(ast, context) {
        if (context.endStateAnimateStep === ast) {
            return this._visitEndStateAnimation(ast, context);
        }
        const /** @type {?} */ startingStylesExpr = ast.startingStyles.visit(this, context);
        const /** @type {?} */ keyframeExpressions = ast.keyframes.map(keyframeEntry => keyframeEntry.visit(this, context));
        return this._callAnimateMethod(ast, startingStylesExpr, o.literalArr(keyframeExpressions), context);
    }
    /**
     * \@internal
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _visitEndStateAnimation(ast, context) {
        const /** @type {?} */ startingStylesExpr = ast.startingStyles.visit(this, context);
        const /** @type {?} */ keyframeExpressions = ast.keyframes.map(keyframe => keyframe.visit(this, context));
        const /** @type {?} */ keyframesExpr = o.importExpr(createIdentifier(Identifiers.balanceAnimationKeyframes)).callFn([
            _ANIMATION_COLLECTED_STYLES, _ANIMATION_END_STATE_STYLES_VAR,
            o.literalArr(keyframeExpressions)
        ]);
        return this._callAnimateMethod(ast, startingStylesExpr, keyframesExpr, context);
    }
    /**
     * \@internal
     * @param {?} ast
     * @param {?} startingStylesExpr
     * @param {?} keyframesExpr
     * @param {?} context
     * @return {?}
     */
    _callAnimateMethod(ast, startingStylesExpr, keyframesExpr, context) {
        let /** @type {?} */ previousStylesValue = _EMPTY_ARRAY;
        if (context.isExpectingFirstAnimateStep) {
            previousStylesValue = _PREVIOUS_ANIMATION_PLAYERS;
            context.isExpectingFirstAnimateStep = false;
        }
        context.totalTransitionTime += ast.duration + ast.delay;
        return _ANIMATION_FACTORY_RENDERER_VAR.callMethod('animate', [
            _ANIMATION_FACTORY_ELEMENT_VAR, startingStylesExpr, keyframesExpr, o.literal(ast.duration),
            o.literal(ast.delay), o.literal(ast.easing), previousStylesValue
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationSequence(ast, context) {
        const /** @type {?} */ playerExprs = ast.steps.map(step => step.visit(this, context));
        return o.importExpr(createIdentifier(Identifiers.AnimationSequencePlayer)).instantiate([
            o.literalArr(playerExprs)
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationGroup(ast, context) {
        const /** @type {?} */ playerExprs = ast.steps.map(step => step.visit(this, context));
        return o.importExpr(createIdentifier(Identifiers.AnimationGroupPlayer)).instantiate([
            o.literalArr(playerExprs)
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationStateDeclaration(ast, context) {
        const /** @type {?} */ flatStyles = {};
        _getStylesArray(ast).forEach(entry => { Object.keys(entry).forEach(key => { flatStyles[key] = entry[key]; }); });
        context.stateMap.registerState(ast.stateName, flatStyles);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationStateTransition(ast, context) {
        const /** @type {?} */ steps = ast.animation.steps;
        const /** @type {?} */ lastStep = steps[steps.length - 1];
        if (_isEndStateAnimateStep(lastStep)) {
            context.endStateAnimateStep = (lastStep);
        }
        context.totalTransitionTime = 0;
        context.isExpectingFirstStyleStep = true;
        context.isExpectingFirstAnimateStep = true;
        const /** @type {?} */ stateChangePreconditions = [];
        ast.stateChanges.forEach(stateChange => {
            if (stateChange instanceof AnimationStateTransitionFnExpression) {
                stateChangePreconditions.push(o.importExpr({ reference: stateChange.fn }).callFn([
                    _ANIMATION_CURRENT_STATE_VAR, _ANIMATION_NEXT_STATE_VAR
                ]));
            }
            else {
                stateChangePreconditions.push(_compareToAnimationStateExpr(_ANIMATION_CURRENT_STATE_VAR, stateChange.fromState)
                    .and(_compareToAnimationStateExpr(_ANIMATION_NEXT_STATE_VAR, stateChange.toState)));
                if (stateChange.fromState != ANY_STATE) {
                    context.stateMap.registerState(stateChange.fromState);
                }
                if (stateChange.toState != ANY_STATE) {
                    context.stateMap.registerState(stateChange.toState);
                }
            }
        });
        const /** @type {?} */ animationPlayerExpr = ast.animation.visit(this, context);
        const /** @type {?} */ reducedStateChangesPrecondition = stateChangePreconditions.reduce((a, b) => a.or(b));
        const /** @type {?} */ precondition = _ANIMATION_PLAYER_VAR.equals(o.NULL_EXPR).and(reducedStateChangesPrecondition);
        const /** @type {?} */ animationStmt = _ANIMATION_PLAYER_VAR.set(animationPlayerExpr).toStmt();
        const /** @type {?} */ totalTimeStmt = _ANIMATION_TIME_VAR.set(o.literal(context.totalTransitionTime)).toStmt();
        return new o.IfStmt(precondition, [animationStmt, totalTimeStmt]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAnimationEntry(ast, context) {
        // visit each of the declarations first to build the context state map
        ast.stateDeclarations.forEach(def => def.visit(this, context));
        // this should always be defined even if the user overrides it
        context.stateMap.registerState(DEFAULT_STATE, {});
        const /** @type {?} */ statements = [];
        statements.push(_PREVIOUS_ANIMATION_PLAYERS
            .set(_ANIMATION_FACTORY_VIEW_CONTEXT.callMethod('getAnimationPlayers', [
            _ANIMATION_FACTORY_ELEMENT_VAR,
            _ANIMATION_NEXT_STATE_VAR.equals(o.literal(EMPTY_STATE))
                .conditional(o.NULL_EXPR, o.literal(this.animationName))
        ]))
            .toDeclStmt());
        statements.push(_ANIMATION_COLLECTED_STYLES.set(_EMPTY_MAP).toDeclStmt());
        statements.push(_ANIMATION_PLAYER_VAR.set(o.NULL_EXPR).toDeclStmt());
        statements.push(_ANIMATION_TIME_VAR.set(o.literal(0)).toDeclStmt());
        statements.push(_ANIMATION_DEFAULT_STATE_VAR.set(this._statesMapVar.key(o.literal(DEFAULT_STATE)))
            .toDeclStmt());
        statements.push(_ANIMATION_START_STATE_STYLES_VAR.set(this._statesMapVar.key(_ANIMATION_CURRENT_STATE_VAR))
            .toDeclStmt());
        statements.push(new o.IfStmt(_ANIMATION_START_STATE_STYLES_VAR.equals(o.NULL_EXPR), [_ANIMATION_START_STATE_STYLES_VAR.set(_ANIMATION_DEFAULT_STATE_VAR).toStmt()]));
        statements.push(_ANIMATION_END_STATE_STYLES_VAR.set(this._statesMapVar.key(_ANIMATION_NEXT_STATE_VAR))
            .toDeclStmt());
        statements.push(new o.IfStmt(_ANIMATION_END_STATE_STYLES_VAR.equals(o.NULL_EXPR), [_ANIMATION_END_STATE_STYLES_VAR.set(_ANIMATION_DEFAULT_STATE_VAR).toStmt()]));
        const /** @type {?} */ RENDER_STYLES_FN = o.importExpr(createIdentifier(Identifiers.renderStyles));
        ast.stateTransitions.forEach(transAst => statements.push(transAst.visit(this, context)));
        // this check ensures that the animation factory always returns a player
        // so that the onDone callback can be used for tracking
        statements.push(new o.IfStmt(_ANIMATION_PLAYER_VAR.equals(o.NULL_EXPR), [_ANIMATION_PLAYER_VAR
                .set(o.importExpr(createIdentifier(Identifiers.NoOpAnimationPlayer)).instantiate([]))
                .toStmt()]));
        // once complete we want to apply the styles on the element
        // since the destination state's values should persist once
        // the animation sequence has completed.
        statements.push(_ANIMATION_PLAYER_VAR
            .callMethod('onDone', [o
                .fn([], [
                _ANIMATION_PLAYER_VAR.callMethod('destroy', []).toStmt(),
                RENDER_STYLES_FN
                    .callFn([
                    _ANIMATION_FACTORY_ELEMENT_VAR, _ANIMATION_FACTORY_RENDERER_VAR,
                    o.importExpr(createIdentifier(Identifiers.prepareFinalAnimationStyles))
                        .callFn([
                        _ANIMATION_START_STATE_STYLES_VAR,
                        _ANIMATION_END_STATE_STYLES_VAR
                    ])
                ])
                    .toStmt()
            ])])
            .toStmt());
        statements.push(o.importExpr(createIdentifier(Identifiers.AnimationSequencePlayer))
            .instantiate([_PREVIOUS_ANIMATION_PLAYERS])
            .callMethod('destroy', [])
            .toStmt());
        // before we start any animation we want to clear out the starting
        // styles from the element's style property (since they were placed
        // there at the end of the last animation
        statements.push(RENDER_STYLES_FN
            .callFn([
            _ANIMATION_FACTORY_ELEMENT_VAR, _ANIMATION_FACTORY_RENDERER_VAR,
            o.importExpr(createIdentifier(Identifiers.clearStyles))
                .callFn([_ANIMATION_START_STATE_STYLES_VAR])
        ])
            .toStmt());
        statements.push(_ANIMATION_FACTORY_VIEW_CONTEXT
            .callMethod('queueAnimation', [
            _ANIMATION_FACTORY_ELEMENT_VAR, o.literal(this.animationName),
            _ANIMATION_PLAYER_VAR
        ])
            .toStmt());
        statements.push(new o.ReturnStatement(o.importExpr(createIdentifier(Identifiers.AnimationTransition)).instantiate([
            _ANIMATION_PLAYER_VAR, _ANIMATION_FACTORY_ELEMENT_VAR, o.literal(this.animationName),
            _ANIMATION_CURRENT_STATE_VAR, _ANIMATION_NEXT_STATE_VAR, _ANIMATION_TIME_VAR
        ])));
        return o.fn([
            new o.FnParam(_ANIMATION_FACTORY_VIEW_VAR.name, o.importType(createIdentifier(Identifiers.AppView), [o.DYNAMIC_TYPE])),
            new o.FnParam(_ANIMATION_FACTORY_ELEMENT_VAR.name, o.DYNAMIC_TYPE),
            new o.FnParam(_ANIMATION_CURRENT_STATE_VAR.name, o.DYNAMIC_TYPE),
            new o.FnParam(_ANIMATION_NEXT_STATE_VAR.name, o.DYNAMIC_TYPE)
        ], statements, o.importType(createIdentifier(Identifiers.AnimationTransition)));
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    build(ast) {
        const /** @type {?} */ context = new _AnimationBuilderContext();
        const /** @type {?} */ fnStatement = ast.visit(this, context).toDeclStmt(this._fnVarName);
        const /** @type {?} */ fnVariable = o.variable(this._fnVarName);
        const /** @type {?} */ lookupMap = [];
        Object.keys(context.stateMap.states).forEach(stateName => {
            const /** @type {?} */ value = context.stateMap.states[stateName];
            let /** @type {?} */ variableValue = _EMPTY_MAP;
            if (isPresent(value)) {
                const /** @type {?} */ styleMap = [];
                Object.keys(value).forEach(key => { styleMap.push([key, o.literal(value[key])]); });
                variableValue = o.literalMap(styleMap, null, true);
            }
            lookupMap.push([stateName, variableValue]);
        });
        const /** @type {?} */ compiledStatesMapStmt = this._statesMapVar.set(o.literalMap(lookupMap, null, true)).toDeclStmt();
        const /** @type {?} */ statements = [compiledStatesMapStmt, fnStatement];
        return new AnimationEntryCompileResult(this.animationName, statements, fnVariable);
    }
}
function _AnimationBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    _AnimationBuilder.prototype._fnVarName;
    /** @type {?} */
    _AnimationBuilder.prototype._statesMapVarName;
    /** @type {?} */
    _AnimationBuilder.prototype._statesMapVar;
    /** @type {?} */
    _AnimationBuilder.prototype.animationName;
}
class _AnimationBuilderContext {
    constructor() {
        this.stateMap = new _AnimationBuilderStateMap();
        this.endStateAnimateStep = null;
        this.isExpectingFirstStyleStep = false;
        this.isExpectingFirstAnimateStep = false;
        this.totalTransitionTime = 0;
    }
}
function _AnimationBuilderContext_tsickle_Closure_declarations() {
    /** @type {?} */
    _AnimationBuilderContext.prototype.stateMap;
    /** @type {?} */
    _AnimationBuilderContext.prototype.endStateAnimateStep;
    /** @type {?} */
    _AnimationBuilderContext.prototype.isExpectingFirstStyleStep;
    /** @type {?} */
    _AnimationBuilderContext.prototype.isExpectingFirstAnimateStep;
    /** @type {?} */
    _AnimationBuilderContext.prototype.totalTransitionTime;
}
class _AnimationBuilderStateMap {
    constructor() {
        this._states = {};
    }
    /**
     * @return {?}
     */
    get states() { return this._states; }
    /**
     * @param {?} name
     * @param {?=} value
     * @return {?}
     */
    registerState(name, value = null) {
        const /** @type {?} */ existingEntry = this._states[name];
        if (!existingEntry) {
            this._states[name] = value;
        }
    }
}
function _AnimationBuilderStateMap_tsickle_Closure_declarations() {
    /** @type {?} */
    _AnimationBuilderStateMap.prototype._states;
}
/**
 * @param {?} value
 * @param {?} animationState
 * @return {?}
 */
function _compareToAnimationStateExpr(value, animationState) {
    const /** @type {?} */ emptyStateLiteral = o.literal(EMPTY_STATE);
    switch (animationState) {
        case EMPTY_STATE:
            return value.equals(emptyStateLiteral);
        case ANY_STATE:
            return o.literal(true);
        default:
            return value.equals(o.literal(animationState));
    }
}
/**
 * @param {?} step
 * @return {?}
 */
function _isEndStateAnimateStep(step) {
    // the final animation step is characterized by having only TWO
    // keyframe values and it must have zero styles for both keyframes
    if (step instanceof AnimationStepAst && step.duration > 0 && step.keyframes.length == 2) {
        const /** @type {?} */ styles1 = _getStylesArray(step.keyframes[0])[0];
        const /** @type {?} */ styles2 = _getStylesArray(step.keyframes[1])[0];
        return Object.keys(styles1).length === 0 && Object.keys(styles2).length === 0;
    }
    return false;
}
/**
 * @param {?} obj
 * @return {?}
 */
function _getStylesArray(obj) {
    return obj.styles.styles;
}
//# sourceMappingURL=animation_compiler.js.map