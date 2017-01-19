/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '@angular/core/index';
import { EmptyExpr, RecursiveAstVisitor } from '../expression_parser/ast';
import { mergeNsAndName } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { CssSelector } from '../selector';
import { splitAtColon, splitAtPeriod } from '../util';
import { BoundElementPropertyAst, BoundEventAst, PropertyBindingType, VariableAst } from './template_ast';
const /** @type {?} */ PROPERTY_PARTS_SEPARATOR = '.';
const /** @type {?} */ ATTRIBUTE_PREFIX = 'attr';
const /** @type {?} */ CLASS_PREFIX = 'class';
const /** @type {?} */ STYLE_PREFIX = 'style';
const /** @type {?} */ ANIMATE_PROP_PREFIX = 'animate-';
export let BoundPropertyType = {};
BoundPropertyType.DEFAULT = 0;
BoundPropertyType.LITERAL_ATTR = 1;
BoundPropertyType.ANIMATION = 2;
BoundPropertyType[BoundPropertyType.DEFAULT] = "DEFAULT";
BoundPropertyType[BoundPropertyType.LITERAL_ATTR] = "LITERAL_ATTR";
BoundPropertyType[BoundPropertyType.ANIMATION] = "ANIMATION";
/**
 * Represents a parsed property.
 */
export class BoundProperty {
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} type
     * @param {?} sourceSpan
     */
    constructor(name, expression, type, sourceSpan) {
        this.name = name;
        this.expression = expression;
        this.type = type;
        this.sourceSpan = sourceSpan;
    }
    /**
     * @return {?}
     */
    get isLiteral() { return this.type === BoundPropertyType.LITERAL_ATTR; }
    /**
     * @return {?}
     */
    get isAnimation() { return this.type === BoundPropertyType.ANIMATION; }
}
function BoundProperty_tsickle_Closure_declarations() {
    /** @type {?} */
    BoundProperty.prototype.name;
    /** @type {?} */
    BoundProperty.prototype.expression;
    /** @type {?} */
    BoundProperty.prototype.type;
    /** @type {?} */
    BoundProperty.prototype.sourceSpan;
}
/**
 * Parses bindings in templates and in the directive host area.
 */
export class BindingParser {
    /**
     * @param {?} _exprParser
     * @param {?} _interpolationConfig
     * @param {?} _schemaRegistry
     * @param {?} pipes
     * @param {?} _targetErrors
     */
    constructor(_exprParser, _interpolationConfig, _schemaRegistry, pipes, _targetErrors) {
        this._exprParser = _exprParser;
        this._interpolationConfig = _interpolationConfig;
        this._schemaRegistry = _schemaRegistry;
        this._targetErrors = _targetErrors;
        this.pipesByName = new Map();
        pipes.forEach(pipe => this.pipesByName.set(pipe.name, pipe));
    }
    /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    createDirectiveHostPropertyAsts(dirMeta, sourceSpan) {
        if (dirMeta.hostProperties) {
            const /** @type {?} */ boundProps = [];
            Object.keys(dirMeta.hostProperties).forEach(propName => {
                const /** @type {?} */ expression = dirMeta.hostProperties[propName];
                if (typeof expression === 'string') {
                    this.parsePropertyBinding(propName, expression, true, sourceSpan, [], boundProps);
                }
                else {
                    this._reportError(`Value of the host property binding "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
                }
            });
            return boundProps.map((prop) => this.createElementPropertyAst(dirMeta.selector, prop));
        }
    }
    /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    createDirectiveHostEventAsts(dirMeta, sourceSpan) {
        if (dirMeta.hostListeners) {
            const /** @type {?} */ targetEventAsts = [];
            Object.keys(dirMeta.hostListeners).forEach(propName => {
                const /** @type {?} */ expression = dirMeta.hostListeners[propName];
                if (typeof expression === 'string') {
                    this.parseEvent(propName, expression, sourceSpan, [], targetEventAsts);
                }
                else {
                    this._reportError(`Value of the host listener "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
                }
            });
            return targetEventAsts;
        }
    }
    /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    parseInterpolation(value, sourceSpan) {
        const /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            const /** @type {?} */ ast = this._exprParser.parseInterpolation(value, sourceInfo, this._interpolationConfig);
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    }
    /**
     * @param {?} prefixToken
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @param {?} targetVars
     * @return {?}
     */
    parseInlineTemplateBinding(prefixToken, value, sourceSpan, targetMatchableAttrs, targetProps, targetVars) {
        const /** @type {?} */ bindings = this._parseTemplateBindings(prefixToken, value, sourceSpan);
        for (let /** @type {?} */ i = 0; i < bindings.length; i++) {
            const /** @type {?} */ binding = bindings[i];
            if (binding.keyIsVar) {
                targetVars.push(new VariableAst(binding.key, binding.name, sourceSpan));
            }
            else if (binding.expression) {
                this._parsePropertyAst(binding.key, binding.expression, sourceSpan, targetMatchableAttrs, targetProps);
            }
            else {
                targetMatchableAttrs.push([binding.key, '']);
                this.parseLiteralAttr(binding.key, null, sourceSpan, targetMatchableAttrs, targetProps);
            }
        }
    }
    /**
     * @param {?} prefixToken
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    _parseTemplateBindings(prefixToken, value, sourceSpan) {
        const /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            const /** @type {?} */ bindingsResult = this._exprParser.parseTemplateBindings(prefixToken, value, sourceInfo);
            this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
            bindingsResult.templateBindings.forEach((binding) => {
                if (binding.expression) {
                    this._checkPipes(binding.expression, sourceSpan);
                }
            });
            bindingsResult.warnings.forEach((warning) => { this._reportError(warning, sourceSpan, ParseErrorLevel.WARNING); });
            return bindingsResult.templateBindings;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return [];
        }
    }
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    parseLiteralAttr(name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        if (_isAnimationLabel(name)) {
            name = name.substring(1);
            if (value) {
                this._reportError(`Assigning animation triggers via @prop="exp" attributes with an expression is invalid.` +
                    ` Use property bindings (e.g. [@prop]="exp") or use an attribute without a value (e.g. @prop) instead.`, sourceSpan, ParseErrorLevel.FATAL);
            }
            this._parseAnimation(name, value, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            targetProps.push(new BoundProperty(name, this._exprParser.wrapLiteralPrimitive(value, ''), BoundPropertyType.LITERAL_ATTR, sourceSpan));
        }
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} isHost
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    parsePropertyBinding(name, expression, isHost, sourceSpan, targetMatchableAttrs, targetProps) {
        let /** @type {?} */ isAnimationProp = false;
        if (name.startsWith(ANIMATE_PROP_PREFIX)) {
            isAnimationProp = true;
            name = name.substring(ANIMATE_PROP_PREFIX.length);
        }
        else if (_isAnimationLabel(name)) {
            isAnimationProp = true;
            name = name.substring(1);
        }
        if (isAnimationProp) {
            this._parseAnimation(name, expression, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            this._parsePropertyAst(name, this._parseBinding(expression, isHost, sourceSpan), sourceSpan, targetMatchableAttrs, targetProps);
        }
    }
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    parsePropertyInterpolation(name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        const /** @type {?} */ expr = this.parseInterpolation(value, sourceSpan);
        if (expr) {
            this._parsePropertyAst(name, expr, sourceSpan, targetMatchableAttrs, targetProps);
            return true;
        }
        return false;
    }
    /**
     * @param {?} name
     * @param {?} ast
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    _parsePropertyAst(name, ast, sourceSpan, targetMatchableAttrs, targetProps) {
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new BoundProperty(name, ast, BoundPropertyType.DEFAULT, sourceSpan));
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    _parseAnimation(name, expression, sourceSpan, targetMatchableAttrs, targetProps) {
        // This will occur when a @trigger is not paired with an expression.
        // For animations it is valid to not have an expression since */void
        // states will be applied by angular when the element is attached/detached
        const /** @type {?} */ ast = this._parseBinding(expression || 'null', false, sourceSpan);
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new BoundProperty(name, ast, BoundPropertyType.ANIMATION, sourceSpan));
    }
    /**
     * @param {?} value
     * @param {?} isHostBinding
     * @param {?} sourceSpan
     * @return {?}
     */
    _parseBinding(value, isHostBinding, sourceSpan) {
        const /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            const /** @type {?} */ ast = isHostBinding ?
                this._exprParser.parseSimpleBinding(value, sourceInfo, this._interpolationConfig) :
                this._exprParser.parseBinding(value, sourceInfo, this._interpolationConfig);
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    }
    /**
     * @param {?} elementSelector
     * @param {?} boundProp
     * @return {?}
     */
    createElementPropertyAst(elementSelector, boundProp) {
        if (boundProp.isAnimation) {
            return new BoundElementPropertyAst(boundProp.name, PropertyBindingType.Animation, SecurityContext.NONE, false, boundProp.expression, null, boundProp.sourceSpan);
        }
        let /** @type {?} */ unit = null;
        let /** @type {?} */ bindingType;
        let /** @type {?} */ boundPropertyName = null;
        const /** @type {?} */ parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
        let /** @type {?} */ securityContexts;
        // Check check for special cases (prefix style, attr, class)
        if (parts.length > 1) {
            if (parts[0] == ATTRIBUTE_PREFIX) {
                boundPropertyName = parts[1];
                this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
                securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, true);
                const /** @type {?} */ nsSeparatorIdx = boundPropertyName.indexOf(':');
                if (nsSeparatorIdx > -1) {
                    const /** @type {?} */ ns = boundPropertyName.substring(0, nsSeparatorIdx);
                    const /** @type {?} */ name = boundPropertyName.substring(nsSeparatorIdx + 1);
                    boundPropertyName = mergeNsAndName(ns, name);
                }
                bindingType = PropertyBindingType.Attribute;
            }
            else if (parts[0] == CLASS_PREFIX) {
                boundPropertyName = parts[1];
                bindingType = PropertyBindingType.Class;
                securityContexts = [SecurityContext.NONE];
            }
            else if (parts[0] == STYLE_PREFIX) {
                unit = parts.length > 2 ? parts[2] : null;
                boundPropertyName = parts[1];
                bindingType = PropertyBindingType.Style;
                securityContexts = [SecurityContext.STYLE];
            }
        }
        // If not a special case, use the full property name
        if (boundPropertyName === null) {
            boundPropertyName = this._schemaRegistry.getMappedPropName(boundProp.name);
            securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, false);
            bindingType = PropertyBindingType.Property;
            this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, false);
        }
        return new BoundElementPropertyAst(boundPropertyName, bindingType, securityContexts.length === 1 ? securityContexts[0] : null, securityContexts.length > 1, boundProp.expression, unit, boundProp.sourceSpan);
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    parseEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        if (_isAnimationLabel(name)) {
            name = name.substr(1);
            this._parseAnimationEvent(name, expression, sourceSpan, targetEvents);
        }
        else {
            this._parseEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents);
        }
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetEvents
     * @return {?}
     */
    _parseAnimationEvent(name, expression, sourceSpan, targetEvents) {
        const /** @type {?} */ matches = splitAtPeriod(name, [name, '']);
        const /** @type {?} */ eventName = matches[0];
        const /** @type {?} */ phase = matches[1].toLowerCase();
        if (phase) {
            switch (phase) {
                case 'start':
                case 'done':
                    const /** @type {?} */ ast = this._parseAction(expression, sourceSpan);
                    targetEvents.push(new BoundEventAst(eventName, null, phase, ast, sourceSpan));
                    break;
                default:
                    this._reportError(`The provided animation output phase value "${phase}" for "@${eventName}" is not supported (use start or done)`, sourceSpan);
                    break;
            }
        }
        else {
            this._reportError(`The animation trigger output event (@${eventName}) is missing its phase value name (start or done are currently supported)`, sourceSpan);
        }
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    _parseEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        // long format: 'target: eventName'
        const [target, eventName] = splitAtColon(name, [null, name]);
        const /** @type {?} */ ast = this._parseAction(expression, sourceSpan);
        targetMatchableAttrs.push([name, ast.source]);
        targetEvents.push(new BoundEventAst(eventName, target, null, ast, sourceSpan));
        // Don't detect directives for event names for now,
        // so don't add the event name to the matchableAttrs
    }
    /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    _parseAction(value, sourceSpan) {
        const /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            const /** @type {?} */ ast = this._exprParser.parseAction(value, sourceInfo, this._interpolationConfig);
            if (ast) {
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            }
            if (!ast || ast.ast instanceof EmptyExpr) {
                this._reportError(`Empty expressions are not allowed`, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
            }
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    }
    /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    _reportError(message, sourceSpan, level = ParseErrorLevel.FATAL) {
        this._targetErrors.push(new ParseError(sourceSpan, message, level));
    }
    /**
     * @param {?} errors
     * @param {?} sourceSpan
     * @return {?}
     */
    _reportExpressionParserErrors(errors, sourceSpan) {
        for (const error of errors) {
            this._reportError(error.message, sourceSpan);
        }
    }
    /**
     * @param {?} ast
     * @param {?} sourceSpan
     * @return {?}
     */
    _checkPipes(ast, sourceSpan) {
        if (ast) {
            const /** @type {?} */ collector = new PipeCollector();
            ast.visit(collector);
            collector.pipes.forEach((ast, pipeName) => {
                if (!this.pipesByName.has(pipeName)) {
                    this._reportError(`The pipe '${pipeName}' could not be found`, new ParseSourceSpan(sourceSpan.start.moveBy(ast.span.start), sourceSpan.start.moveBy(ast.span.end)));
                }
            });
        }
    }
    /**
     * @param {?} propName the name of the property / attribute
     * @param {?} sourceSpan
     * @param {?} isAttr true when binding to an attribute
     * @return {?}
     */
    _validatePropertyOrAttributeName(propName, sourceSpan, isAttr) {
        const /** @type {?} */ report = isAttr ? this._schemaRegistry.validateAttribute(propName) :
            this._schemaRegistry.validateProperty(propName);
        if (report.error) {
            this._reportError(report.msg, sourceSpan, ParseErrorLevel.FATAL);
        }
    }
}
function BindingParser_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingParser.prototype.pipesByName;
    /** @type {?} */
    BindingParser.prototype._exprParser;
    /** @type {?} */
    BindingParser.prototype._interpolationConfig;
    /** @type {?} */
    BindingParser.prototype._schemaRegistry;
    /** @type {?} */
    BindingParser.prototype._targetErrors;
}
export class PipeCollector extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.pipes = new Map();
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) {
        this.pipes.set(ast.name, ast);
        ast.exp.visit(this);
        this.visitAll(ast.args, context);
        return null;
    }
}
function PipeCollector_tsickle_Closure_declarations() {
    /** @type {?} */
    PipeCollector.prototype.pipes;
}
/**
 * @param {?} name
 * @return {?}
 */
function _isAnimationLabel(name) {
    return name[0] == '@';
}
/**
 * @param {?} registry
 * @param {?} selector
 * @param {?} propName
 * @param {?} isAttribute
 * @return {?}
 */
export function calcPossibleSecurityContexts(registry, selector, propName, isAttribute) {
    const /** @type {?} */ ctxs = [];
    CssSelector.parse(selector).forEach((selector) => {
        const /** @type {?} */ elementNames = selector.element ? [selector.element] : registry.allKnownElementNames();
        const /** @type {?} */ notElementNames = new Set(selector.notSelectors.filter(selector => selector.isElementSelector())
            .map((selector) => selector.element));
        const /** @type {?} */ possibleElementNames = elementNames.filter(elementName => !notElementNames.has(elementName));
        ctxs.push(...possibleElementNames.map(elementName => registry.securityContext(elementName, propName, isAttribute)));
    });
    return ctxs.length === 0 ? [SecurityContext.NONE] : Array.from(new Set(ctxs)).sort();
}
//# sourceMappingURL=binding_parser.js.map