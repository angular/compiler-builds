/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { SecurityContext } from '../core';
import { BoundElementProperty, EmptyExpr, ParsedEvent, ParsedProperty, ParsedPropertyType, ParsedVariable, RecursiveAstVisitor } from '../expression_parser/ast';
import { mergeNsAndName } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { CssSelector } from '../selector';
import { splitAtColon, splitAtPeriod } from '../util';
var /** @type {?} */ PROPERTY_PARTS_SEPARATOR = '.';
var /** @type {?} */ ATTRIBUTE_PREFIX = 'attr';
var /** @type {?} */ CLASS_PREFIX = 'class';
var /** @type {?} */ STYLE_PREFIX = 'style';
var /** @type {?} */ ANIMATE_PROP_PREFIX = 'animate-';
/**
 * Parses bindings in templates and in the directive host area.
 */
var /**
 * Parses bindings in templates and in the directive host area.
 */
BindingParser = /** @class */ (function () {
    function BindingParser(_exprParser, _interpolationConfig, _schemaRegistry, pipes, _targetErrors) {
        this._exprParser = _exprParser;
        this._interpolationConfig = _interpolationConfig;
        this._schemaRegistry = _schemaRegistry;
        this._targetErrors = _targetErrors;
        this.pipesByName = null;
        this._usedPipes = new Map();
        // When the `pipes` parameter is `null`, do not check for used pipes
        // This is used in IVY when we might not know the available pipes at compile time
        if (pipes) {
            var /** @type {?} */ pipesByName_1 = new Map();
            pipes.forEach(function (pipe) { return pipesByName_1.set(pipe.name, pipe); });
            this.pipesByName = pipesByName_1;
        }
    }
    /**
     * @return {?}
     */
    BindingParser.prototype.getUsedPipes = /**
     * @return {?}
     */
    function () { return Array.from(this._usedPipes.values()); };
    /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype.createBoundHostProperties = /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    function (dirMeta, sourceSpan) {
        var _this = this;
        if (dirMeta.hostProperties) {
            var /** @type {?} */ boundProps_1 = [];
            Object.keys(dirMeta.hostProperties).forEach(function (propName) {
                var /** @type {?} */ expression = dirMeta.hostProperties[propName];
                if (typeof expression === 'string') {
                    _this.parsePropertyBinding(propName, expression, true, sourceSpan, [], boundProps_1);
                }
                else {
                    _this._reportError("Value of the host property binding \"" + propName + "\" needs to be a string representing an expression but got \"" + expression + "\" (" + typeof expression + ")", sourceSpan);
                }
            });
            return boundProps_1;
        }
        return null;
    };
    /**
     * @param {?} dirMeta
     * @param {?} elementSelector
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype.createDirectiveHostPropertyAsts = /**
     * @param {?} dirMeta
     * @param {?} elementSelector
     * @param {?} sourceSpan
     * @return {?}
     */
    function (dirMeta, elementSelector, sourceSpan) {
        var _this = this;
        var /** @type {?} */ boundProps = this.createBoundHostProperties(dirMeta, sourceSpan);
        return boundProps &&
            boundProps.map(function (prop) { return _this.createBoundElementProperty(elementSelector, prop); });
    };
    /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype.createDirectiveHostEventAsts = /**
     * @param {?} dirMeta
     * @param {?} sourceSpan
     * @return {?}
     */
    function (dirMeta, sourceSpan) {
        var _this = this;
        if (dirMeta.hostListeners) {
            var /** @type {?} */ targetEvents_1 = [];
            Object.keys(dirMeta.hostListeners).forEach(function (propName) {
                var /** @type {?} */ expression = dirMeta.hostListeners[propName];
                if (typeof expression === 'string') {
                    _this.parseEvent(propName, expression, sourceSpan, [], targetEvents_1);
                }
                else {
                    _this._reportError("Value of the host listener \"" + propName + "\" needs to be a string representing an expression but got \"" + expression + "\" (" + typeof expression + ")", sourceSpan);
                }
            });
            return targetEvents_1;
        }
        return null;
    };
    /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype.parseInterpolation = /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    function (value, sourceSpan) {
        var /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            var /** @type {?} */ ast = /** @type {?} */ ((this._exprParser.parseInterpolation(value, sourceInfo, this._interpolationConfig)));
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (/** @type {?} */ e) {
            this._reportError("" + e, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    };
    // Parse an inline template binding. ie `<tag *tplKey="<tplValue>">`
    /**
     * @param {?} tplKey
     * @param {?} tplValue
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @param {?} targetVars
     * @return {?}
     */
    BindingParser.prototype.parseInlineTemplateBinding = /**
     * @param {?} tplKey
     * @param {?} tplValue
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @param {?} targetVars
     * @return {?}
     */
    function (tplKey, tplValue, sourceSpan, targetMatchableAttrs, targetProps, targetVars) {
        var /** @type {?} */ bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan);
        for (var /** @type {?} */ i = 0; i < bindings.length; i++) {
            var /** @type {?} */ binding = bindings[i];
            if (binding.keyIsVar) {
                targetVars.push(new ParsedVariable(binding.key, binding.name, sourceSpan));
            }
            else if (binding.expression) {
                this._parsePropertyAst(binding.key, binding.expression, sourceSpan, targetMatchableAttrs, targetProps);
            }
            else {
                targetMatchableAttrs.push([binding.key, '']);
                this.parseLiteralAttr(binding.key, null, sourceSpan, targetMatchableAttrs, targetProps);
            }
        }
    };
    /**
     * @param {?} tplKey
     * @param {?} tplValue
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype._parseTemplateBindings = /**
     * @param {?} tplKey
     * @param {?} tplValue
     * @param {?} sourceSpan
     * @return {?}
     */
    function (tplKey, tplValue, sourceSpan) {
        var _this = this;
        var /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            var /** @type {?} */ bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo);
            this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
            bindingsResult.templateBindings.forEach(function (binding) {
                if (binding.expression) {
                    _this._checkPipes(binding.expression, sourceSpan);
                }
            });
            bindingsResult.warnings.forEach(function (warning) { _this._reportError(warning, sourceSpan, ParseErrorLevel.WARNING); });
            return bindingsResult.templateBindings;
        }
        catch (/** @type {?} */ e) {
            this._reportError("" + e, sourceSpan);
            return [];
        }
    };
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    BindingParser.prototype.parseLiteralAttr = /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    function (name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        if (isAnimationLabel(name)) {
            name = name.substring(1);
            if (value) {
                this._reportError("Assigning animation triggers via @prop=\"exp\" attributes with an expression is invalid." +
                    " Use property bindings (e.g. [@prop]=\"exp\") or use an attribute without a value (e.g. @prop) instead.", sourceSpan, ParseErrorLevel.ERROR);
            }
            this._parseAnimation(name, value, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            targetProps.push(new ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, ''), ParsedPropertyType.LITERAL_ATTR, sourceSpan));
        }
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} isHost
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    BindingParser.prototype.parsePropertyBinding = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} isHost
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    function (name, expression, isHost, sourceSpan, targetMatchableAttrs, targetProps) {
        var /** @type {?} */ isAnimationProp = false;
        if (name.startsWith(ANIMATE_PROP_PREFIX)) {
            isAnimationProp = true;
            name = name.substring(ANIMATE_PROP_PREFIX.length);
        }
        else if (isAnimationLabel(name)) {
            isAnimationProp = true;
            name = name.substring(1);
        }
        if (isAnimationProp) {
            this._parseAnimation(name, expression, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            this._parsePropertyAst(name, this._parseBinding(expression, isHost, sourceSpan), sourceSpan, targetMatchableAttrs, targetProps);
        }
    };
    /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    BindingParser.prototype.parsePropertyInterpolation = /**
     * @param {?} name
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    function (name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        var /** @type {?} */ expr = this.parseInterpolation(value, sourceSpan);
        if (expr) {
            this._parsePropertyAst(name, expr, sourceSpan, targetMatchableAttrs, targetProps);
            return true;
        }
        return false;
    };
    /**
     * @param {?} name
     * @param {?} ast
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    BindingParser.prototype._parsePropertyAst = /**
     * @param {?} name
     * @param {?} ast
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    function (name, ast, sourceSpan, targetMatchableAttrs, targetProps) {
        targetMatchableAttrs.push([name, /** @type {?} */ ((ast.source))]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.DEFAULT, sourceSpan));
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    BindingParser.prototype._parseAnimation = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @return {?}
     */
    function (name, expression, sourceSpan, targetMatchableAttrs, targetProps) {
        // This will occur when a @trigger is not paired with an expression.
        // For animations it is valid to not have an expression since */void
        // states will be applied by angular when the element is attached/detached
        var /** @type {?} */ ast = this._parseBinding(expression || 'undefined', false, sourceSpan);
        targetMatchableAttrs.push([name, /** @type {?} */ ((ast.source))]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.ANIMATION, sourceSpan));
    };
    /**
     * @param {?} value
     * @param {?} isHostBinding
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype._parseBinding = /**
     * @param {?} value
     * @param {?} isHostBinding
     * @param {?} sourceSpan
     * @return {?}
     */
    function (value, isHostBinding, sourceSpan) {
        var /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            var /** @type {?} */ ast = isHostBinding ?
                this._exprParser.parseSimpleBinding(value, sourceInfo, this._interpolationConfig) :
                this._exprParser.parseBinding(value, sourceInfo, this._interpolationConfig);
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (/** @type {?} */ e) {
            this._reportError("" + e, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    };
    /**
     * @param {?} elementSelector
     * @param {?} boundProp
     * @return {?}
     */
    BindingParser.prototype.createBoundElementProperty = /**
     * @param {?} elementSelector
     * @param {?} boundProp
     * @return {?}
     */
    function (elementSelector, boundProp) {
        if (boundProp.isAnimation) {
            return new BoundElementProperty(boundProp.name, 4 /* Animation */, SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan);
        }
        var /** @type {?} */ unit = null;
        var /** @type {?} */ bindingType = /** @type {?} */ ((undefined));
        var /** @type {?} */ boundPropertyName = null;
        var /** @type {?} */ parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
        var /** @type {?} */ securityContexts = /** @type {?} */ ((undefined));
        // Check check for special cases (prefix style, attr, class)
        if (parts.length > 1) {
            if (parts[0] == ATTRIBUTE_PREFIX) {
                boundPropertyName = parts[1];
                this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
                securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, true);
                var /** @type {?} */ nsSeparatorIdx = boundPropertyName.indexOf(':');
                if (nsSeparatorIdx > -1) {
                    var /** @type {?} */ ns = boundPropertyName.substring(0, nsSeparatorIdx);
                    var /** @type {?} */ name_1 = boundPropertyName.substring(nsSeparatorIdx + 1);
                    boundPropertyName = mergeNsAndName(ns, name_1);
                }
                bindingType = 1 /* Attribute */;
            }
            else if (parts[0] == CLASS_PREFIX) {
                boundPropertyName = parts[1];
                bindingType = 2 /* Class */;
                securityContexts = [SecurityContext.NONE];
            }
            else if (parts[0] == STYLE_PREFIX) {
                unit = parts.length > 2 ? parts[2] : null;
                boundPropertyName = parts[1];
                bindingType = 3 /* Style */;
                securityContexts = [SecurityContext.STYLE];
            }
        }
        // If not a special case, use the full property name
        if (boundPropertyName === null) {
            boundPropertyName = this._schemaRegistry.getMappedPropName(boundProp.name);
            securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, false);
            bindingType = 0 /* Property */;
            this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, false);
        }
        return new BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan);
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    BindingParser.prototype.parseEvent = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    function (name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        if (isAnimationLabel(name)) {
            name = name.substr(1);
            this._parseAnimationEvent(name, expression, sourceSpan, targetEvents);
        }
        else {
            this._parseRegularEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents);
        }
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetEvents
     * @return {?}
     */
    BindingParser.prototype._parseAnimationEvent = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetEvents
     * @return {?}
     */
    function (name, expression, sourceSpan, targetEvents) {
        var /** @type {?} */ matches = splitAtPeriod(name, [name, '']);
        var /** @type {?} */ eventName = matches[0];
        var /** @type {?} */ phase = matches[1].toLowerCase();
        if (phase) {
            switch (phase) {
                case 'start':
                case 'done':
                    var /** @type {?} */ ast = this._parseAction(expression, sourceSpan);
                    targetEvents.push(new ParsedEvent(eventName, phase, 1 /* Animation */, ast, sourceSpan));
                    break;
                default:
                    this._reportError("The provided animation output phase value \"" + phase + "\" for \"@" + eventName + "\" is not supported (use start or done)", sourceSpan);
                    break;
            }
        }
        else {
            this._reportError("The animation trigger output event (@" + eventName + ") is missing its phase value name (start or done are currently supported)", sourceSpan);
        }
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    BindingParser.prototype._parseRegularEvent = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    function (name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        // long format: 'target: eventName'
        var _a = splitAtColon(name, [/** @type {?} */ ((null)), name]), target = _a[0], eventName = _a[1];
        var /** @type {?} */ ast = this._parseAction(expression, sourceSpan);
        targetMatchableAttrs.push([/** @type {?} */ ((name)), /** @type {?} */ ((ast.source))]);
        targetEvents.push(new ParsedEvent(eventName, target, 0 /* Regular */, ast, sourceSpan));
        // Don't detect directives for event names for now,
        // so don't add the event name to the matchableAttrs
    };
    /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype._parseAction = /**
     * @param {?} value
     * @param {?} sourceSpan
     * @return {?}
     */
    function (value, sourceSpan) {
        var /** @type {?} */ sourceInfo = sourceSpan.start.toString();
        try {
            var /** @type {?} */ ast = this._exprParser.parseAction(value, sourceInfo, this._interpolationConfig);
            if (ast) {
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            }
            if (!ast || ast.ast instanceof EmptyExpr) {
                this._reportError("Empty expressions are not allowed", sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
            }
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (/** @type {?} */ e) {
            this._reportError("" + e, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo);
        }
    };
    /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    BindingParser.prototype._reportError = /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    function (message, sourceSpan, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this._targetErrors.push(new ParseError(sourceSpan, message, level));
    };
    /**
     * @param {?} errors
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype._reportExpressionParserErrors = /**
     * @param {?} errors
     * @param {?} sourceSpan
     * @return {?}
     */
    function (errors, sourceSpan) {
        for (var _i = 0, errors_1 = errors; _i < errors_1.length; _i++) {
            var error = errors_1[_i];
            this._reportError(error.message, sourceSpan);
        }
    };
    /**
     * @param {?} ast
     * @param {?} sourceSpan
     * @return {?}
     */
    BindingParser.prototype._checkPipes = /**
     * @param {?} ast
     * @param {?} sourceSpan
     * @return {?}
     */
    function (ast, sourceSpan) {
        var _this = this;
        if (ast && this.pipesByName) {
            var /** @type {?} */ collector = new PipeCollector();
            ast.visit(collector);
            collector.pipes.forEach(function (ast, pipeName) {
                var /** @type {?} */ pipeMeta = /** @type {?} */ ((_this.pipesByName)).get(pipeName);
                if (!pipeMeta) {
                    _this._reportError("The pipe '" + pipeName + "' could not be found", new ParseSourceSpan(sourceSpan.start.moveBy(ast.span.start), sourceSpan.start.moveBy(ast.span.end)));
                }
                else {
                    _this._usedPipes.set(pipeName, pipeMeta);
                }
            });
        }
    };
    /**
     * @param {?} propName the name of the property / attribute
     * @param {?} sourceSpan
     * @param {?} isAttr true when binding to an attribute
     * @return {?}
     */
    BindingParser.prototype._validatePropertyOrAttributeName = /**
     * @param {?} propName the name of the property / attribute
     * @param {?} sourceSpan
     * @param {?} isAttr true when binding to an attribute
     * @return {?}
     */
    function (propName, sourceSpan, isAttr) {
        var /** @type {?} */ report = isAttr ? this._schemaRegistry.validateAttribute(propName) :
            this._schemaRegistry.validateProperty(propName);
        if (report.error) {
            this._reportError(/** @type {?} */ ((report.msg)), sourceSpan, ParseErrorLevel.ERROR);
        }
    };
    return BindingParser;
}());
/**
 * Parses bindings in templates and in the directive host area.
 */
export { BindingParser };
function BindingParser_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingParser.prototype.pipesByName;
    /** @type {?} */
    BindingParser.prototype._usedPipes;
    /** @type {?} */
    BindingParser.prototype._exprParser;
    /** @type {?} */
    BindingParser.prototype._interpolationConfig;
    /** @type {?} */
    BindingParser.prototype._schemaRegistry;
    /** @type {?} */
    BindingParser.prototype._targetErrors;
}
var PipeCollector = /** @class */ (function (_super) {
    tslib_1.__extends(PipeCollector, _super);
    function PipeCollector() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.pipes = new Map();
        return _this;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    PipeCollector.prototype.visitPipe = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        this.pipes.set(ast.name, ast);
        ast.exp.visit(this);
        this.visitAll(ast.args, context);
        return null;
    };
    return PipeCollector;
}(RecursiveAstVisitor));
export { PipeCollector };
function PipeCollector_tsickle_Closure_declarations() {
    /** @type {?} */
    PipeCollector.prototype.pipes;
}
/**
 * @param {?} name
 * @return {?}
 */
function isAnimationLabel(name) {
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
    var /** @type {?} */ ctxs = [];
    CssSelector.parse(selector).forEach(function (selector) {
        var /** @type {?} */ elementNames = selector.element ? [selector.element] : registry.allKnownElementNames();
        var /** @type {?} */ notElementNames = new Set(selector.notSelectors.filter(function (selector) { return selector.isElementSelector(); })
            .map(function (selector) { return selector.element; }));
        var /** @type {?} */ possibleElementNames = elementNames.filter(function (elementName) { return !notElementNames.has(elementName); });
        ctxs.push.apply(ctxs, possibleElementNames.map(function (elementName) { return registry.securityContext(elementName, propName, isAttribute); }));
    });
    return ctxs.length === 0 ? [SecurityContext.NONE] : Array.from(new Set(ctxs)).sort();
}
//# sourceMappingURL=binding_parser.js.map