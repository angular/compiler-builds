/**
 * @abstract
 */
export class AnimationAst {
    constructor() {
        this.startTime = 0;
        this.playTime = 0;
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { }
}
function AnimationAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationAst.prototype.startTime;
    /** @type {?} */
    AnimationAst.prototype.playTime;
}
/**
 * @abstract
 */
export class AnimationStateAst extends AnimationAst {
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) { }
}
export class AnimationEntryAst extends AnimationAst {
    /**
     * @param {?} name
     * @param {?} stateDeclarations
     * @param {?} stateTransitions
     */
    constructor(name, stateDeclarations, stateTransitions) {
        super();
        this.name = name;
        this.stateDeclarations = stateDeclarations;
        this.stateTransitions = stateTransitions;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationEntry(this, context);
    }
}
function AnimationEntryAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationEntryAst.prototype.name;
    /** @type {?} */
    AnimationEntryAst.prototype.stateDeclarations;
    /** @type {?} */
    AnimationEntryAst.prototype.stateTransitions;
}
export class AnimationStateDeclarationAst extends AnimationStateAst {
    /**
     * @param {?} stateName
     * @param {?} styles
     */
    constructor(stateName, styles) {
        super();
        this.stateName = stateName;
        this.styles = styles;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationStateDeclaration(this, context);
    }
}
function AnimationStateDeclarationAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateDeclarationAst.prototype.stateName;
    /** @type {?} */
    AnimationStateDeclarationAst.prototype.styles;
}
export class AnimationStateTransitionExpression {
    /**
     * @param {?} fromState
     * @param {?} toState
     */
    constructor(fromState, toState) {
        this.fromState = fromState;
        this.toState = toState;
    }
}
function AnimationStateTransitionExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionExpression.prototype.fromState;
    /** @type {?} */
    AnimationStateTransitionExpression.prototype.toState;
}
export class AnimationStateTransitionFnExpression extends AnimationStateTransitionExpression {
    /**
     * @param {?} fn
     */
    constructor(fn) {
        super(null, null);
        this.fn = fn;
    }
}
function AnimationStateTransitionFnExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionFnExpression.prototype.fn;
}
export class AnimationStateTransitionAst extends AnimationStateAst {
    /**
     * @param {?} stateChanges
     * @param {?} animation
     */
    constructor(stateChanges, animation) {
        super();
        this.stateChanges = stateChanges;
        this.animation = animation;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationStateTransition(this, context);
    }
}
function AnimationStateTransitionAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionAst.prototype.stateChanges;
    /** @type {?} */
    AnimationStateTransitionAst.prototype.animation;
}
export class AnimationStepAst extends AnimationAst {
    /**
     * @param {?} startingStyles
     * @param {?} keyframes
     * @param {?} duration
     * @param {?} delay
     * @param {?} easing
     */
    constructor(startingStyles, keyframes, duration, delay, easing) {
        super();
        this.startingStyles = startingStyles;
        this.keyframes = keyframes;
        this.duration = duration;
        this.delay = delay;
        this.easing = easing;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationStep(this, context);
    }
}
function AnimationStepAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStepAst.prototype.startingStyles;
    /** @type {?} */
    AnimationStepAst.prototype.keyframes;
    /** @type {?} */
    AnimationStepAst.prototype.duration;
    /** @type {?} */
    AnimationStepAst.prototype.delay;
    /** @type {?} */
    AnimationStepAst.prototype.easing;
}
export class AnimationStylesAst extends AnimationAst {
    /**
     * @param {?} styles
     */
    constructor(styles) {
        super();
        this.styles = styles;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationStyles(this, context);
    }
}
function AnimationStylesAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStylesAst.prototype.styles;
}
export class AnimationKeyframeAst extends AnimationAst {
    /**
     * @param {?} offset
     * @param {?} styles
     */
    constructor(offset, styles) {
        super();
        this.offset = offset;
        this.styles = styles;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationKeyframe(this, context);
    }
}
function AnimationKeyframeAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationKeyframeAst.prototype.offset;
    /** @type {?} */
    AnimationKeyframeAst.prototype.styles;
}
/**
 * @abstract
 */
export class AnimationWithStepsAst extends AnimationAst {
    /**
     * @param {?} steps
     */
    constructor(steps) {
        super();
        this.steps = steps;
    }
}
function AnimationWithStepsAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationWithStepsAst.prototype.steps;
}
export class AnimationGroupAst extends AnimationWithStepsAst {
    /**
     * @param {?} steps
     */
    constructor(steps) {
        super(steps);
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationGroup(this, context);
    }
}
export class AnimationSequenceAst extends AnimationWithStepsAst {
    /**
     * @param {?} steps
     */
    constructor(steps) {
        super(steps);
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    visit(visitor, context) {
        return visitor.visitAnimationSequence(this, context);
    }
}
//# sourceMappingURL=animation_ast.js.map