/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { CompileAnimationAnimateMetadata, CompileAnimationGroupMetadata, CompileAnimationKeyframesSequenceMetadata, CompileAnimationSequenceMetadata, CompileAnimationStateDeclarationMetadata, CompileAnimationStyleMetadata, CompileAnimationWithStepsMetadata, identifierName } from '../compile_metadata';
import { StringMapWrapper } from '../facade/collection';
import { isBlank, isPresent } from '../facade/lang';
import { CompilerInjectable } from '../injectable';
import { ParseError } from '../parse_util';
import { ANY_STATE, FILL_STYLE_FLAG } from '../private_import_core';
import { ElementSchemaRegistry } from '../schema/element_schema_registry';
import { AnimationEntryAst, AnimationGroupAst, AnimationKeyframeAst, AnimationSequenceAst, AnimationStateDeclarationAst, AnimationStateTransitionAst, AnimationStateTransitionExpression, AnimationStateTransitionFnExpression, AnimationStepAst, AnimationStylesAst, AnimationWithStepsAst } from './animation_ast';
import { StylesCollection } from './styles_collection';
const /** @type {?} */ _INITIAL_KEYFRAME = 0;
const /** @type {?} */ _TERMINAL_KEYFRAME = 1;
const /** @type {?} */ _ONE_SECOND = 1000;
export class AnimationParseError extends ParseError {
    /**
     * @param {?} message
     */
    constructor(message) {
        super(null, message);
    }
    /**
     * @return {?}
     */
    toString() { return `${this.msg}`; }
}
export class AnimationEntryParseResult {
    /**
     * @param {?} ast
     * @param {?} errors
     */
    constructor(ast, errors) {
        this.ast = ast;
        this.errors = errors;
    }
}
function AnimationEntryParseResult_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationEntryParseResult.prototype.ast;
    /** @type {?} */
    AnimationEntryParseResult.prototype.errors;
}
export let AnimationParser = class AnimationParser {
    /**
     * @param {?} _schema
     */
    constructor(_schema) {
        this._schema = _schema;
    }
    /**
     * @param {?} component
     * @return {?}
     */
    parseComponent(component) {
        const /** @type {?} */ errors = [];
        const /** @type {?} */ componentName = identifierName(component.type);
        const /** @type {?} */ animationTriggerNames = new Set();
        const /** @type {?} */ asts = component.template.animations.map(entry => {
            const /** @type {?} */ result = this.parseEntry(entry);
            const /** @type {?} */ ast = result.ast;
            const /** @type {?} */ triggerName = ast.name;
            if (animationTriggerNames.has(triggerName)) {
                result.errors.push(new AnimationParseError(`The animation trigger "${triggerName}" has already been registered for the ${componentName} component`));
            }
            else {
                animationTriggerNames.add(triggerName);
            }
            if (result.errors.length > 0) {
                let /** @type {?} */ errorMessage = `- Unable to parse the animation sequence for "${triggerName}" on the ${componentName} component due to the following errors:`;
                result.errors.forEach((error) => { errorMessage += '\n-- ' + error.msg; });
                errors.push(errorMessage);
            }
            return ast;
        });
        if (errors.length > 0) {
            const /** @type {?} */ errorString = errors.join('\n');
            throw new Error(`Animation parse errors:\n${errorString}`);
        }
        return asts;
    }
    /**
     * @param {?} entry
     * @return {?}
     */
    parseEntry(entry) {
        const /** @type {?} */ errors = [];
        const /** @type {?} */ stateStyles = {};
        const /** @type {?} */ transitions = [];
        const /** @type {?} */ stateDeclarationAsts = [];
        entry.definitions.forEach(def => {
            if (def instanceof CompileAnimationStateDeclarationMetadata) {
                _parseAnimationDeclarationStates(def, this._schema, errors).forEach(ast => {
                    stateDeclarationAsts.push(ast);
                    stateStyles[ast.stateName] = ast.styles;
                });
            }
            else {
                transitions.push(/** @type {?} */ (def));
            }
        });
        const /** @type {?} */ stateTransitionAsts = transitions.map(transDef => _parseAnimationStateTransition(transDef, stateStyles, this._schema, errors));
        const /** @type {?} */ ast = new AnimationEntryAst(entry.name, stateDeclarationAsts, stateTransitionAsts);
        return new AnimationEntryParseResult(ast, errors);
    }
};
AnimationParser = __decorate([
    CompilerInjectable(), 
    __metadata('design:paramtypes', [ElementSchemaRegistry])
], AnimationParser);
function AnimationParser_tsickle_Closure_declarations() {
    /** @type {?} */
    AnimationParser.prototype._schema;
}
/**
 * @param {?} stateMetadata
 * @param {?} schema
 * @param {?} errors
 * @return {?}
 */
function _parseAnimationDeclarationStates(stateMetadata, schema, errors) {
    const /** @type {?} */ normalizedStyles = _normalizeStyleMetadata(stateMetadata.styles, {}, schema, errors, false);
    const /** @type {?} */ defStyles = new AnimationStylesAst(normalizedStyles);
    const /** @type {?} */ states = stateMetadata.stateNameExpr.split(/\s*,\s*/);
    return states.map(state => new AnimationStateDeclarationAst(state, defStyles));
}
/**
 * @param {?} transitionStateMetadata
 * @param {?} stateStyles
 * @param {?} schema
 * @param {?} errors
 * @return {?}
 */
function _parseAnimationStateTransition(transitionStateMetadata, stateStyles, schema, errors) {
    const /** @type {?} */ styles = new StylesCollection();
    const /** @type {?} */ transitionExprs = [];
    const /** @type {?} */ stateChangeExpr = transitionStateMetadata.stateChangeExpr;
    const /** @type {?} */ transitionStates = typeof stateChangeExpr == 'string' ?
        ((stateChangeExpr)).split(/\s*,\s*/) :
        [(stateChangeExpr)];
    transitionStates.forEach(expr => transitionExprs.push(..._parseAnimationTransitionExpr(expr, errors)));
    const /** @type {?} */ entry = _normalizeAnimationEntry(transitionStateMetadata.steps);
    const /** @type {?} */ animation = _normalizeStyleSteps(entry, stateStyles, schema, errors);
    const /** @type {?} */ animationAst = _parseTransitionAnimation(animation, 0, styles, stateStyles, errors);
    if (errors.length == 0) {
        _fillAnimationAstStartingKeyframes(animationAst, styles, errors);
    }
    const /** @type {?} */ stepsAst = (animationAst instanceof AnimationWithStepsAst) ?
        animationAst :
        new AnimationSequenceAst([animationAst]);
    return new AnimationStateTransitionAst(transitionExprs, stepsAst);
}
/**
 * @param {?} alias
 * @param {?} errors
 * @return {?}
 */
function _parseAnimationAlias(alias, errors) {
    switch (alias) {
        case ':enter':
            return 'void => *';
        case ':leave':
            return '* => void';
        default:
            errors.push(new AnimationParseError(`the transition alias value "${alias}" is not supported`));
            return '* => *';
    }
}
/**
 * @param {?} transitionValue
 * @param {?} errors
 * @return {?}
 */
function _parseAnimationTransitionExpr(transitionValue, errors) {
    const /** @type {?} */ expressions = [];
    if (typeof transitionValue == 'string') {
        let /** @type {?} */ eventStr = (transitionValue);
        if (eventStr[0] == ':') {
            eventStr = _parseAnimationAlias(eventStr, errors);
        }
        const /** @type {?} */ match = eventStr.match(/^(\*|[-\w]+)\s*(<?[=-]>)\s*(\*|[-\w]+)$/);
        if (!isPresent(match) || match.length < 4) {
            errors.push(new AnimationParseError(`the provided ${eventStr} is not of a supported format`));
            return expressions;
        }
        const /** @type {?} */ fromState = match[1];
        const /** @type {?} */ separator = match[2];
        const /** @type {?} */ toState = match[3];
        expressions.push(new AnimationStateTransitionExpression(fromState, toState));
        const /** @type {?} */ isFullAnyStateExpr = fromState == ANY_STATE && toState == ANY_STATE;
        if (separator[0] == '<' && !isFullAnyStateExpr) {
            expressions.push(new AnimationStateTransitionExpression(toState, fromState));
        }
    }
    else {
        expressions.push(new AnimationStateTransitionFnExpression(/** @type {?} */ (transitionValue)));
    }
    return expressions;
}
/**
 * @param {?} entry
 * @return {?}
 */
function _normalizeAnimationEntry(entry) {
    return Array.isArray(entry) ? new CompileAnimationSequenceMetadata(entry) : entry;
}
/**
 * @param {?} entry
 * @param {?} stateStyles
 * @param {?} schema
 * @param {?} errors
 * @param {?} permitStateReferences
 * @return {?}
 */
function _normalizeStyleMetadata(entry, stateStyles, schema, errors, permitStateReferences) {
    const /** @type {?} */ offset = entry.offset;
    if (offset > 1 || offset < 0) {
        errors.push(new AnimationParseError(`Offset values for animations must be between 0 and 1`));
    }
    const /** @type {?} */ normalizedStyles = [];
    entry.styles.forEach(styleEntry => {
        if (typeof styleEntry === 'string') {
            if (permitStateReferences) {
                normalizedStyles.push(..._resolveStylesFromState(/** @type {?} */ (styleEntry), stateStyles, errors));
            }
            else {
                errors.push(new AnimationParseError(`State based animations cannot contain references to other states`));
            }
        }
        else {
            const /** @type {?} */ stylesObj = (styleEntry);
            const /** @type {?} */ normalizedStylesObj = {};
            Object.keys(stylesObj).forEach(propName => {
                const /** @type {?} */ normalizedProp = schema.normalizeAnimationStyleProperty(propName);
                const /** @type {?} */ normalizedOutput = schema.normalizeAnimationStyleValue(normalizedProp, propName, stylesObj[propName]);
                const /** @type {?} */ normalizationError = normalizedOutput['error'];
                if (normalizationError) {
                    errors.push(new AnimationParseError(normalizationError));
                }
                normalizedStylesObj[normalizedProp] = normalizedOutput['value'];
            });
            normalizedStyles.push(normalizedStylesObj);
        }
    });
    return normalizedStyles;
}
/**
 * @param {?} entry
 * @param {?} stateStyles
 * @param {?} schema
 * @param {?} errors
 * @return {?}
 */
function _normalizeStyleSteps(entry, stateStyles, schema, errors) {
    const /** @type {?} */ steps = _normalizeStyleStepEntry(entry, stateStyles, schema, errors);
    return (entry instanceof CompileAnimationGroupMetadata) ?
        new CompileAnimationGroupMetadata(steps) :
        new CompileAnimationSequenceMetadata(steps);
}
/**
 * @param {?} stylesList
 * @param {?} newItem
 * @return {?}
 */
function _mergeAnimationStyles(stylesList, newItem) {
    if (typeof newItem === 'object' && newItem !== null && stylesList.length > 0) {
        const /** @type {?} */ lastIndex = stylesList.length - 1;
        const /** @type {?} */ lastItem = stylesList[lastIndex];
        if (typeof lastItem === 'object' && lastItem !== null) {
            stylesList[lastIndex] = StringMapWrapper.merge(/** @type {?} */ (lastItem), /** @type {?} */ (newItem));
            return;
        }
    }
    stylesList.push(newItem);
}
/**
 * @param {?} entry
 * @param {?} stateStyles
 * @param {?} schema
 * @param {?} errors
 * @return {?}
 */
function _normalizeStyleStepEntry(entry, stateStyles, schema, errors) {
    let /** @type {?} */ steps;
    if (entry instanceof CompileAnimationWithStepsMetadata) {
        steps = entry.steps;
    }
    else {
        return [entry];
    }
    const /** @type {?} */ newSteps = [];
    let /** @type {?} */ combinedStyles;
    steps.forEach(step => {
        if (step instanceof CompileAnimationStyleMetadata) {
            // this occurs when a style step is followed by a previous style step
            // or when the first style step is run. We want to concatenate all subsequent
            // style steps together into a single style step such that we have the correct
            // starting keyframe data to pass into the animation player.
            if (!isPresent(combinedStyles)) {
                combinedStyles = [];
            }
            _normalizeStyleMetadata(/** @type {?} */ (step), stateStyles, schema, errors, true)
                .forEach(entry => { _mergeAnimationStyles(combinedStyles, entry); });
        }
        else {
            // it is important that we create a metadata entry of the combined styles
            // before we go on an process the animate, sequence or group metadata steps.
            // This will ensure that the AST will have the previous styles painted on
            // screen before any further animations that use the styles take place.
            if (isPresent(combinedStyles)) {
                newSteps.push(new CompileAnimationStyleMetadata(0, combinedStyles));
                combinedStyles = null;
            }
            if (step instanceof CompileAnimationAnimateMetadata) {
                // we do not recurse into CompileAnimationAnimateMetadata since
                // those style steps are not going to be squashed
                const /** @type {?} */ animateStyleValue = ((step)).styles;
                if (animateStyleValue instanceof CompileAnimationStyleMetadata) {
                    animateStyleValue.styles =
                        _normalizeStyleMetadata(animateStyleValue, stateStyles, schema, errors, true);
                }
                else if (animateStyleValue instanceof CompileAnimationKeyframesSequenceMetadata) {
                    animateStyleValue.steps.forEach(step => {
                        step.styles = _normalizeStyleMetadata(step, stateStyles, schema, errors, true);
                    });
                }
            }
            else if (step instanceof CompileAnimationWithStepsMetadata) {
                const /** @type {?} */ innerSteps = _normalizeStyleStepEntry(step, stateStyles, schema, errors);
                step = step instanceof CompileAnimationGroupMetadata ?
                    new CompileAnimationGroupMetadata(innerSteps) :
                    new CompileAnimationSequenceMetadata(innerSteps);
            }
            newSteps.push(step);
        }
    });
    // this happens when only styles were animated within the sequence
    if (isPresent(combinedStyles)) {
        newSteps.push(new CompileAnimationStyleMetadata(0, combinedStyles));
    }
    return newSteps;
}
/**
 * @param {?} stateName
 * @param {?} stateStyles
 * @param {?} errors
 * @return {?}
 */
function _resolveStylesFromState(stateName, stateStyles, errors) {
    const /** @type {?} */ styles = [];
    if (stateName[0] != ':') {
        errors.push(new AnimationParseError(`Animation states via styles must be prefixed with a ":"`));
    }
    else {
        const /** @type {?} */ normalizedStateName = stateName.substring(1);
        const /** @type {?} */ value = stateStyles[normalizedStateName];
        if (!isPresent(value)) {
            errors.push(new AnimationParseError(`Unable to apply styles due to missing a state: "${normalizedStateName}"`));
        }
        else {
            value.styles.forEach(stylesEntry => {
                if (typeof stylesEntry === 'object' && stylesEntry !== null) {
                    styles.push(/** @type {?} */ (stylesEntry));
                }
            });
        }
    }
    return styles;
}
class _AnimationTimings {
    /**
     * @param {?} duration
     * @param {?} delay
     * @param {?} easing
     */
    constructor(duration, delay, easing) {
        this.duration = duration;
        this.delay = delay;
        this.easing = easing;
    }
}
function _AnimationTimings_tsickle_Closure_declarations() {
    /** @type {?} */
    _AnimationTimings.prototype.duration;
    /** @type {?} */
    _AnimationTimings.prototype.delay;
    /** @type {?} */
    _AnimationTimings.prototype.easing;
}
/**
 * @param {?} keyframeSequence
 * @param {?} currentTime
 * @param {?} collectedStyles
 * @param {?} stateStyles
 * @param {?} errors
 * @return {?}
 */
function _parseAnimationKeyframes(keyframeSequence, currentTime, collectedStyles, stateStyles, errors) {
    const /** @type {?} */ totalEntries = keyframeSequence.steps.length;
    let /** @type {?} */ totalOffsets = 0;
    keyframeSequence.steps.forEach(step => totalOffsets += (isPresent(step.offset) ? 1 : 0));
    if (totalOffsets > 0 && totalOffsets < totalEntries) {
        errors.push(new AnimationParseError(`Not all style() entries contain an offset for the provided keyframe()`));
        totalOffsets = totalEntries;
    }
    let /** @type {?} */ limit = totalEntries - 1;
    const /** @type {?} */ margin = totalOffsets == 0 ? (1 / limit) : 0;
    const /** @type {?} */ rawKeyframes = [];
    let /** @type {?} */ index = 0;
    let /** @type {?} */ doSortKeyframes = false;
    let /** @type {?} */ lastOffset = 0;
    keyframeSequence.steps.forEach(styleMetadata => {
        let /** @type {?} */ offset = styleMetadata.offset;
        const /** @type {?} */ keyframeStyles = {};
        styleMetadata.styles.forEach(entry => {
            Object.keys(entry).forEach(prop => {
                if (prop != 'offset') {
                    keyframeStyles[prop] = ((entry))[prop];
                }
            });
        });
        if (isPresent(offset)) {
            doSortKeyframes = doSortKeyframes || (offset < lastOffset);
        }
        else {
            offset = index == limit ? _TERMINAL_KEYFRAME : (margin * index);
        }
        rawKeyframes.push([offset, keyframeStyles]);
        lastOffset = offset;
        index++;
    });
    if (doSortKeyframes) {
        rawKeyframes.sort((a, b) => a[0] <= b[0] ? -1 : 1);
    }
    let /** @type {?} */ firstKeyframe = rawKeyframes[0];
    if (firstKeyframe[0] != _INITIAL_KEYFRAME) {
        rawKeyframes.splice(0, 0, firstKeyframe = [_INITIAL_KEYFRAME, {}]);
    }
    const /** @type {?} */ firstKeyframeStyles = firstKeyframe[1];
    limit = rawKeyframes.length - 1;
    let /** @type {?} */ lastKeyframe = rawKeyframes[limit];
    if (lastKeyframe[0] != _TERMINAL_KEYFRAME) {
        rawKeyframes.push(lastKeyframe = [_TERMINAL_KEYFRAME, {}]);
        limit++;
    }
    const /** @type {?} */ lastKeyframeStyles = lastKeyframe[1];
    for (let /** @type {?} */ i = 1; i <= limit; i++) {
        const /** @type {?} */ entry = rawKeyframes[i];
        const /** @type {?} */ styles = entry[1];
        Object.keys(styles).forEach(prop => {
            if (!isPresent(firstKeyframeStyles[prop])) {
                firstKeyframeStyles[prop] = FILL_STYLE_FLAG;
            }
        });
    }
    for (let /** @type {?} */ i = limit - 1; i >= 0; i--) {
        const /** @type {?} */ entry = rawKeyframes[i];
        const /** @type {?} */ styles = entry[1];
        Object.keys(styles).forEach(prop => {
            if (!isPresent(lastKeyframeStyles[prop])) {
                lastKeyframeStyles[prop] = styles[prop];
            }
        });
    }
    return rawKeyframes.map(entry => new AnimationKeyframeAst(entry[0], new AnimationStylesAst([entry[1]])));
}
/**
 * @param {?} entry
 * @param {?} currentTime
 * @param {?} collectedStyles
 * @param {?} stateStyles
 * @param {?} errors
 * @return {?}
 */
function _parseTransitionAnimation(entry, currentTime, collectedStyles, stateStyles, errors) {
    let /** @type {?} */ ast;
    let /** @type {?} */ playTime = 0;
    const /** @type {?} */ startingTime = currentTime;
    if (entry instanceof CompileAnimationWithStepsMetadata) {
        let /** @type {?} */ maxDuration = 0;
        const /** @type {?} */ steps = [];
        const /** @type {?} */ isGroup = entry instanceof CompileAnimationGroupMetadata;
        let /** @type {?} */ previousStyles;
        entry.steps.forEach(entry => {
            // these will get picked up by the next step...
            const /** @type {?} */ time = isGroup ? startingTime : currentTime;
            if (entry instanceof CompileAnimationStyleMetadata) {
                entry.styles.forEach(stylesEntry => {
                    // by this point we know that we only have stringmap values
                    const /** @type {?} */ map = (stylesEntry);
                    Object.keys(map).forEach(prop => { collectedStyles.insertAtTime(prop, time, map[prop]); });
                });
                previousStyles = entry.styles;
                return;
            }
            const /** @type {?} */ innerAst = _parseTransitionAnimation(entry, time, collectedStyles, stateStyles, errors);
            if (isPresent(previousStyles)) {
                if (entry instanceof CompileAnimationWithStepsMetadata) {
                    const /** @type {?} */ startingStyles = new AnimationStylesAst(previousStyles);
                    steps.push(new AnimationStepAst(startingStyles, [], 0, 0, ''));
                }
                else {
                    const /** @type {?} */ innerStep = (innerAst);
                    innerStep.startingStyles.styles.push(...previousStyles);
                }
                previousStyles = null;
            }
            const /** @type {?} */ astDuration = innerAst.playTime;
            currentTime += astDuration;
            playTime += astDuration;
            maxDuration = Math.max(astDuration, maxDuration);
            steps.push(innerAst);
        });
        if (isPresent(previousStyles)) {
            const /** @type {?} */ startingStyles = new AnimationStylesAst(previousStyles);
            steps.push(new AnimationStepAst(startingStyles, [], 0, 0, ''));
        }
        if (isGroup) {
            ast = new AnimationGroupAst(steps);
            playTime = maxDuration;
            currentTime = startingTime + playTime;
        }
        else {
            ast = new AnimationSequenceAst(steps);
        }
    }
    else if (entry instanceof CompileAnimationAnimateMetadata) {
        const /** @type {?} */ timings = _parseTimeExpression(entry.timings, errors);
        const /** @type {?} */ styles = entry.styles;
        let /** @type {?} */ keyframes;
        if (styles instanceof CompileAnimationKeyframesSequenceMetadata) {
            keyframes =
                _parseAnimationKeyframes(styles, currentTime, collectedStyles, stateStyles, errors);
        }
        else {
            const /** @type {?} */ styleData = (styles);
            const /** @type {?} */ offset = _TERMINAL_KEYFRAME;
            const /** @type {?} */ styleAst = new AnimationStylesAst(/** @type {?} */ (styleData.styles));
            const /** @type {?} */ keyframe = new AnimationKeyframeAst(offset, styleAst);
            keyframes = [keyframe];
        }
        ast = new AnimationStepAst(new AnimationStylesAst([]), keyframes, timings.duration, timings.delay, timings.easing);
        playTime = timings.duration + timings.delay;
        currentTime += playTime;
        keyframes.forEach((keyframe /** TODO #9100 */) => keyframe.styles.styles.forEach((entry /** TODO #9100 */) => Object.keys(entry).forEach(prop => { collectedStyles.insertAtTime(prop, currentTime, entry[prop]); })));
    }
    else {
        // if the code reaches this stage then an error
        // has already been populated within the _normalizeStyleSteps()
        // operation...
        ast = new AnimationStepAst(null, [], 0, 0, '');
    }
    ast.playTime = playTime;
    ast.startTime = startingTime;
    return ast;
}
/**
 * @param {?} ast
 * @param {?} collectedStyles
 * @param {?} errors
 * @return {?}
 */
function _fillAnimationAstStartingKeyframes(ast, collectedStyles, errors) {
    // steps that only contain style will not be filled
    if ((ast instanceof AnimationStepAst) && ast.keyframes.length > 0) {
        const /** @type {?} */ keyframes = ast.keyframes;
        if (keyframes.length == 1) {
            const /** @type {?} */ endKeyframe = keyframes[0];
            const /** @type {?} */ startKeyframe = _createStartKeyframeFromEndKeyframe(endKeyframe, ast.startTime, ast.playTime, collectedStyles, errors);
            ast.keyframes = [startKeyframe, endKeyframe];
        }
    }
    else if (ast instanceof AnimationWithStepsAst) {
        ast.steps.forEach(entry => _fillAnimationAstStartingKeyframes(entry, collectedStyles, errors));
    }
}
/**
 * @param {?} exp
 * @param {?} errors
 * @return {?}
 */
function _parseTimeExpression(exp, errors) {
    const /** @type {?} */ regex = /^([\.\d]+)(m?s)(?:\s+([\.\d]+)(m?s))?(?:\s+([-a-z]+(?:\(.+?\))?))?/i;
    let /** @type {?} */ duration;
    let /** @type {?} */ delay = 0;
    let /** @type {?} */ easing = null;
    if (typeof exp === 'string') {
        const /** @type {?} */ matches = exp.match(regex);
        if (matches === null) {
            errors.push(new AnimationParseError(`The provided timing value "${exp}" is invalid.`));
            return new _AnimationTimings(0, 0, null);
        }
        let /** @type {?} */ durationMatch = parseFloat(matches[1]);
        const /** @type {?} */ durationUnit = matches[2];
        if (durationUnit == 's') {
            durationMatch *= _ONE_SECOND;
        }
        duration = Math.floor(durationMatch);
        const /** @type {?} */ delayMatch = matches[3];
        const /** @type {?} */ delayUnit = matches[4];
        if (isPresent(delayMatch)) {
            let /** @type {?} */ delayVal = parseFloat(delayMatch);
            if (isPresent(delayUnit) && delayUnit == 's') {
                delayVal *= _ONE_SECOND;
            }
            delay = Math.floor(delayVal);
        }
        const /** @type {?} */ easingVal = matches[5];
        if (!isBlank(easingVal)) {
            easing = easingVal;
        }
    }
    else {
        duration = (exp);
    }
    return new _AnimationTimings(duration, delay, easing);
}
/**
 * @param {?} endKeyframe
 * @param {?} startTime
 * @param {?} duration
 * @param {?} collectedStyles
 * @param {?} errors
 * @return {?}
 */
function _createStartKeyframeFromEndKeyframe(endKeyframe, startTime, duration, collectedStyles, errors) {
    const /** @type {?} */ values = {};
    const /** @type {?} */ endTime = startTime + duration;
    endKeyframe.styles.styles.forEach((styleData) => {
        Object.keys(styleData).forEach(prop => {
            const /** @type {?} */ val = styleData[prop];
            if (prop == 'offset')
                return;
            const /** @type {?} */ resultIndex = collectedStyles.indexOfAtOrBeforeTime(prop, startTime);
            let /** @type {?} */ resultEntry /** TODO #9100 */, /** @type {?} */ nextEntry /** TODO #9100 */, /** @type {?} */ value;
            if (isPresent(resultIndex)) {
                resultEntry = collectedStyles.getByIndex(prop, resultIndex);
                value = resultEntry.value;
                nextEntry = collectedStyles.getByIndex(prop, resultIndex + 1);
            }
            else {
                // this is a flag that the runtime code uses to pass
                // in a value either from the state declaration styles
                // or using the AUTO_STYLE value (e.g. getComputedStyle)
                value = FILL_STYLE_FLAG;
            }
            if (isPresent(nextEntry) && !nextEntry.matches(endTime, val)) {
                errors.push(new AnimationParseError(`The animated CSS property "${prop}" unexpectedly changes between steps "${resultEntry.time}ms" and "${endTime}ms" at "${nextEntry.time}ms"`));
            }
            values[prop] = value;
        });
    });
    return new AnimationKeyframeAst(_INITIAL_KEYFRAME, new AnimationStylesAst([values]));
}
//# sourceMappingURL=animation_parser.js.map