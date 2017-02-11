var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * @abstract
 */
var AnimationAst = (function () {
    function AnimationAst() {
        this.startTime = 0;
        this.playTime = 0;
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationAst.prototype.visit = function (visitor, context) { };
    return AnimationAst;
}());
export { AnimationAst };
function AnimationAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationAst.prototype.startTime;
    /** @type {?} */
    AnimationAst.prototype.playTime;
}
/**
 * @abstract
 */
var AnimationStateAst = (function (_super) {
    __extends(AnimationStateAst, _super);
    function AnimationStateAst() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @abstract
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationStateAst.prototype.visit = function (visitor, context) { };
    return AnimationStateAst;
}(AnimationAst));
export { AnimationStateAst };
var AnimationEntryAst = (function (_super) {
    __extends(AnimationEntryAst, _super);
    /**
     * @param {?} name
     * @param {?} stateDeclarations
     * @param {?} stateTransitions
     */
    function AnimationEntryAst(name, stateDeclarations, stateTransitions) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.stateDeclarations = stateDeclarations;
        _this.stateTransitions = stateTransitions;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationEntryAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationEntry(this, context);
    };
    return AnimationEntryAst;
}(AnimationAst));
export { AnimationEntryAst };
function AnimationEntryAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationEntryAst.prototype.name;
    /** @type {?} */
    AnimationEntryAst.prototype.stateDeclarations;
    /** @type {?} */
    AnimationEntryAst.prototype.stateTransitions;
}
var AnimationStateDeclarationAst = (function (_super) {
    __extends(AnimationStateDeclarationAst, _super);
    /**
     * @param {?} stateName
     * @param {?} styles
     */
    function AnimationStateDeclarationAst(stateName, styles) {
        var _this = _super.call(this) || this;
        _this.stateName = stateName;
        _this.styles = styles;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationStateDeclarationAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationStateDeclaration(this, context);
    };
    return AnimationStateDeclarationAst;
}(AnimationStateAst));
export { AnimationStateDeclarationAst };
function AnimationStateDeclarationAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateDeclarationAst.prototype.stateName;
    /** @type {?} */
    AnimationStateDeclarationAst.prototype.styles;
}
var AnimationStateTransitionExpression = (function () {
    /**
     * @param {?} fromState
     * @param {?} toState
     */
    function AnimationStateTransitionExpression(fromState, toState) {
        this.fromState = fromState;
        this.toState = toState;
    }
    return AnimationStateTransitionExpression;
}());
export { AnimationStateTransitionExpression };
function AnimationStateTransitionExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionExpression.prototype.fromState;
    /** @type {?} */
    AnimationStateTransitionExpression.prototype.toState;
}
var AnimationStateTransitionFnExpression = (function (_super) {
    __extends(AnimationStateTransitionFnExpression, _super);
    /**
     * @param {?} fn
     */
    function AnimationStateTransitionFnExpression(fn) {
        var _this = _super.call(this, null, null) || this;
        _this.fn = fn;
        return _this;
    }
    return AnimationStateTransitionFnExpression;
}(AnimationStateTransitionExpression));
export { AnimationStateTransitionFnExpression };
function AnimationStateTransitionFnExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionFnExpression.prototype.fn;
}
var AnimationStateTransitionAst = (function (_super) {
    __extends(AnimationStateTransitionAst, _super);
    /**
     * @param {?} stateChanges
     * @param {?} animation
     */
    function AnimationStateTransitionAst(stateChanges, animation) {
        var _this = _super.call(this) || this;
        _this.stateChanges = stateChanges;
        _this.animation = animation;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationStateTransitionAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationStateTransition(this, context);
    };
    return AnimationStateTransitionAst;
}(AnimationStateAst));
export { AnimationStateTransitionAst };
function AnimationStateTransitionAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStateTransitionAst.prototype.stateChanges;
    /** @type {?} */
    AnimationStateTransitionAst.prototype.animation;
}
var AnimationStepAst = (function (_super) {
    __extends(AnimationStepAst, _super);
    /**
     * @param {?} startingStyles
     * @param {?} keyframes
     * @param {?} duration
     * @param {?} delay
     * @param {?} easing
     */
    function AnimationStepAst(startingStyles, keyframes, duration, delay, easing) {
        var _this = _super.call(this) || this;
        _this.startingStyles = startingStyles;
        _this.keyframes = keyframes;
        _this.duration = duration;
        _this.delay = delay;
        _this.easing = easing;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationStepAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationStep(this, context);
    };
    return AnimationStepAst;
}(AnimationAst));
export { AnimationStepAst };
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
var AnimationStylesAst = (function (_super) {
    __extends(AnimationStylesAst, _super);
    /**
     * @param {?} styles
     */
    function AnimationStylesAst(styles) {
        var _this = _super.call(this) || this;
        _this.styles = styles;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationStylesAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationStyles(this, context);
    };
    return AnimationStylesAst;
}(AnimationAst));
export { AnimationStylesAst };
function AnimationStylesAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationStylesAst.prototype.styles;
}
var AnimationKeyframeAst = (function (_super) {
    __extends(AnimationKeyframeAst, _super);
    /**
     * @param {?} offset
     * @param {?} styles
     */
    function AnimationKeyframeAst(offset, styles) {
        var _this = _super.call(this) || this;
        _this.offset = offset;
        _this.styles = styles;
        return _this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationKeyframeAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationKeyframe(this, context);
    };
    return AnimationKeyframeAst;
}(AnimationAst));
export { AnimationKeyframeAst };
function AnimationKeyframeAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationKeyframeAst.prototype.offset;
    /** @type {?} */
    AnimationKeyframeAst.prototype.styles;
}
/**
 * @abstract
 */
var AnimationWithStepsAst = (function (_super) {
    __extends(AnimationWithStepsAst, _super);
    /**
     * @param {?} steps
     */
    function AnimationWithStepsAst(steps) {
        var _this = _super.call(this) || this;
        _this.steps = steps;
        return _this;
    }
    return AnimationWithStepsAst;
}(AnimationAst));
export { AnimationWithStepsAst };
function AnimationWithStepsAst_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationWithStepsAst.prototype.steps;
}
var AnimationGroupAst = (function (_super) {
    __extends(AnimationGroupAst, _super);
    /**
     * @param {?} steps
     */
    function AnimationGroupAst(steps) {
        return _super.call(this, steps) || this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationGroupAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationGroup(this, context);
    };
    return AnimationGroupAst;
}(AnimationWithStepsAst));
export { AnimationGroupAst };
var AnimationSequenceAst = (function (_super) {
    __extends(AnimationSequenceAst, _super);
    /**
     * @param {?} steps
     */
    function AnimationSequenceAst(steps) {
        return _super.call(this, steps) || this;
    }
    /**
     * @param {?} visitor
     * @param {?} context
     * @return {?}
     */
    AnimationSequenceAst.prototype.visit = function (visitor, context) {
        return visitor.visitAnimationSequence(this, context);
    };
    return AnimationSequenceAst;
}(AnimationWithStepsAst));
export { AnimationSequenceAst };
//# sourceMappingURL=animation_ast.js.map