/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/template_parser/binding_parser", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/parse_util", "@angular/compiler/src/selector", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.calcPossibleSecurityContexts = exports.PipeCollector = exports.BindingParser = void 0;
    var tslib_1 = require("tslib");
    var core_1 = require("@angular/compiler/src/core");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var selector_1 = require("@angular/compiler/src/selector");
    var util_1 = require("@angular/compiler/src/util");
    var PROPERTY_PARTS_SEPARATOR = '.';
    var ATTRIBUTE_PREFIX = 'attr';
    var CLASS_PREFIX = 'class';
    var STYLE_PREFIX = 'style';
    var TEMPLATE_ATTR_PREFIX = '*';
    var ANIMATE_PROP_PREFIX = 'animate-';
    /**
     * Parses bindings in templates and in the directive host area.
     */
    var BindingParser = /** @class */ (function () {
        function BindingParser(_exprParser, _interpolationConfig, _schemaRegistry, pipes, errors) {
            this._exprParser = _exprParser;
            this._interpolationConfig = _interpolationConfig;
            this._schemaRegistry = _schemaRegistry;
            this.errors = errors;
            this.pipesByName = null;
            this._usedPipes = new Map();
            // When the `pipes` parameter is `null`, do not check for used pipes
            // This is used in IVY when we might not know the available pipes at compile time
            if (pipes) {
                var pipesByName_1 = new Map();
                pipes.forEach(function (pipe) { return pipesByName_1.set(pipe.name, pipe); });
                this.pipesByName = pipesByName_1;
            }
        }
        Object.defineProperty(BindingParser.prototype, "interpolationConfig", {
            get: function () {
                return this._interpolationConfig;
            },
            enumerable: false,
            configurable: true
        });
        BindingParser.prototype.getUsedPipes = function () {
            return Array.from(this._usedPipes.values());
        };
        BindingParser.prototype.createBoundHostProperties = function (dirMeta, sourceSpan) {
            var _this = this;
            if (dirMeta.hostProperties) {
                var boundProps_1 = [];
                Object.keys(dirMeta.hostProperties).forEach(function (propName) {
                    var expression = dirMeta.hostProperties[propName];
                    if (typeof expression === 'string') {
                        _this.parsePropertyBinding(propName, expression, true, sourceSpan, sourceSpan.start.offset, undefined, [], 
                        // Use the `sourceSpan` for  `keySpan`. This isn't really accurate, but neither is the
                        // sourceSpan, as it represents the sourceSpan of the host itself rather than the
                        // source of the host binding (which doesn't exist in the template). Regardless,
                        // neither of these values are used in Ivy but are only here to satisfy the function
                        // signature. This should likely be refactored in the future so that `sourceSpan`
                        // isn't being used inaccurately.
                        boundProps_1, sourceSpan);
                    }
                    else {
                        _this._reportError("Value of the host property binding \"" + propName + "\" needs to be a string representing an expression but got \"" + expression + "\" (" + typeof expression + ")", sourceSpan);
                    }
                });
                return boundProps_1;
            }
            return null;
        };
        BindingParser.prototype.createDirectiveHostPropertyAsts = function (dirMeta, elementSelector, sourceSpan) {
            var _this = this;
            var boundProps = this.createBoundHostProperties(dirMeta, sourceSpan);
            return boundProps &&
                boundProps.map(function (prop) { return _this.createBoundElementProperty(elementSelector, prop); });
        };
        BindingParser.prototype.createDirectiveHostEventAsts = function (dirMeta, sourceSpan) {
            var _this = this;
            if (dirMeta.hostListeners) {
                var targetEvents_1 = [];
                Object.keys(dirMeta.hostListeners).forEach(function (propName) {
                    var expression = dirMeta.hostListeners[propName];
                    if (typeof expression === 'string') {
                        // TODO: pass a more accurate handlerSpan for this event.
                        _this.parseEvent(propName, expression, sourceSpan, sourceSpan, [], targetEvents_1);
                    }
                    else {
                        _this._reportError("Value of the host listener \"" + propName + "\" needs to be a string representing an expression but got \"" + expression + "\" (" + typeof expression + ")", sourceSpan);
                    }
                });
                return targetEvents_1;
            }
            return null;
        };
        BindingParser.prototype.parseInterpolation = function (value, sourceSpan) {
            var sourceInfo = sourceSpan.start.toString();
            try {
                var ast = this._exprParser.parseInterpolation(value, sourceInfo, sourceSpan.start.offset, this._interpolationConfig);
                if (ast)
                    this._reportExpressionParserErrors(ast.errors, sourceSpan);
                this._checkPipes(ast, sourceSpan);
                return ast;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, sourceSpan.start.offset);
            }
        };
        /**
         * Similar to `parseInterpolation`, but treats the provided string as a single expression
         * element that would normally appear within the interpolation prefix and suffix (`{{` and `}}`).
         * This is used for parsing the switch expression in ICUs.
         */
        BindingParser.prototype.parseInterpolationExpression = function (expression, sourceSpan) {
            var sourceInfo = sourceSpan.start.toString();
            try {
                var ast = this._exprParser.parseInterpolationExpression(expression, sourceInfo, sourceSpan.start.offset);
                if (ast)
                    this._reportExpressionParserErrors(ast.errors, sourceSpan);
                this._checkPipes(ast, sourceSpan);
                return ast;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, sourceSpan.start.offset);
            }
        };
        /**
         * Parses the bindings in a microsyntax expression, and converts them to
         * `ParsedProperty` or `ParsedVariable`.
         *
         * @param tplKey template binding name
         * @param tplValue template binding value
         * @param sourceSpan span of template binding relative to entire the template
         * @param absoluteValueOffset start of the tplValue relative to the entire template
         * @param targetMatchableAttrs potential attributes to match in the template
         * @param targetProps target property bindings in the template
         * @param targetVars target variables in the template
         */
        BindingParser.prototype.parseInlineTemplateBinding = function (tplKey, tplValue, sourceSpan, absoluteValueOffset, targetMatchableAttrs, targetProps, targetVars, isIvyAst) {
            var e_1, _a;
            var absoluteKeyOffset = sourceSpan.start.offset + TEMPLATE_ATTR_PREFIX.length;
            var bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset);
            try {
                for (var bindings_1 = tslib_1.__values(bindings), bindings_1_1 = bindings_1.next(); !bindings_1_1.done; bindings_1_1 = bindings_1.next()) {
                    var binding = bindings_1_1.value;
                    // sourceSpan is for the entire HTML attribute. bindingSpan is for a particular
                    // binding within the microsyntax expression so it's more narrow than sourceSpan.
                    var bindingSpan = moveParseSourceSpan(sourceSpan, binding.sourceSpan);
                    var key = binding.key.source;
                    var keySpan = moveParseSourceSpan(sourceSpan, binding.key.span);
                    if (binding instanceof ast_1.VariableBinding) {
                        var value = binding.value ? binding.value.source : '$implicit';
                        var valueSpan = binding.value ? moveParseSourceSpan(sourceSpan, binding.value.span) : undefined;
                        targetVars.push(new ast_1.ParsedVariable(key, value, bindingSpan, keySpan, valueSpan));
                    }
                    else if (binding.value) {
                        var srcSpan = isIvyAst ? bindingSpan : sourceSpan;
                        var valueSpan = moveParseSourceSpan(sourceSpan, binding.value.ast.sourceSpan);
                        this._parsePropertyAst(key, binding.value, srcSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
                    }
                    else {
                        targetMatchableAttrs.push([key, '' /* value */]);
                        // Since this is a literal attribute with no RHS, source span should be
                        // just the key span.
                        this.parseLiteralAttr(key, null /* value */, keySpan, absoluteValueOffset, undefined /* valueSpan */, targetMatchableAttrs, targetProps, keySpan);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (bindings_1_1 && !bindings_1_1.done && (_a = bindings_1.return)) _a.call(bindings_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        /**
         * Parses the bindings in a microsyntax expression, e.g.
         * ```
         *    <tag *tplKey="let value1 = prop; let value2 = localVar">
         * ```
         *
         * @param tplKey template binding name
         * @param tplValue template binding value
         * @param sourceSpan span of template binding relative to entire the template
         * @param absoluteKeyOffset start of the `tplKey`
         * @param absoluteValueOffset start of the `tplValue`
         */
        BindingParser.prototype._parseTemplateBindings = function (tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset) {
            var _this = this;
            var sourceInfo = sourceSpan.start.toString();
            try {
                var bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo, absoluteKeyOffset, absoluteValueOffset);
                this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
                bindingsResult.templateBindings.forEach(function (binding) {
                    if (binding.value instanceof ast_1.ASTWithSource) {
                        _this._checkPipes(binding.value, sourceSpan);
                    }
                });
                bindingsResult.warnings.forEach(function (warning) {
                    _this._reportError(warning, sourceSpan, parse_util_1.ParseErrorLevel.WARNING);
                });
                return bindingsResult.templateBindings;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return [];
            }
        };
        BindingParser.prototype.parseLiteralAttr = function (name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, 
        // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
        // have to change This should be required when VE is removed.
        targetProps, keySpan) {
            if (isAnimationLabel(name)) {
                name = name.substring(1);
                if (value) {
                    this._reportError("Assigning animation triggers via @prop=\"exp\" attributes with an expression is invalid." +
                        " Use property bindings (e.g. [@prop]=\"exp\") or use an attribute without a value (e.g. @prop) instead.", sourceSpan, parse_util_1.ParseErrorLevel.ERROR);
                }
                this._parseAnimation(name, value, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps);
            }
            else {
                targetProps.push(new ast_1.ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, '', absoluteOffset), ast_1.ParsedPropertyType.LITERAL_ATTR, sourceSpan, keySpan, valueSpan));
            }
        };
        BindingParser.prototype.parsePropertyBinding = function (name, expression, isHost, sourceSpan, absoluteOffset, valueSpan, 
        // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
        // have to change This should be required when VE is removed.
        targetMatchableAttrs, targetProps, keySpan) {
            if (name.length === 0) {
                this._reportError("Property name is missing in binding", sourceSpan);
            }
            var isAnimationProp = false;
            if (name.startsWith(ANIMATE_PROP_PREFIX)) {
                isAnimationProp = true;
                name = name.substring(ANIMATE_PROP_PREFIX.length);
            }
            else if (isAnimationLabel(name)) {
                isAnimationProp = true;
                name = name.substring(1);
            }
            if (isAnimationProp) {
                this._parseAnimation(name, expression, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps);
            }
            else {
                this._parsePropertyAst(name, this._parseBinding(expression, isHost, valueSpan || sourceSpan, absoluteOffset), sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
            }
        };
        BindingParser.prototype.parsePropertyInterpolation = function (name, value, sourceSpan, valueSpan, targetMatchableAttrs, 
        // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
        // have to change This should be required when VE is removed.
        targetProps, keySpan) {
            var expr = this.parseInterpolation(value, valueSpan || sourceSpan);
            if (expr) {
                this._parsePropertyAst(name, expr, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
                return true;
            }
            return false;
        };
        BindingParser.prototype._parsePropertyAst = function (name, ast, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
            targetMatchableAttrs.push([name, ast.source]);
            targetProps.push(new ast_1.ParsedProperty(name, ast, ast_1.ParsedPropertyType.DEFAULT, sourceSpan, keySpan, valueSpan));
        };
        BindingParser.prototype._parseAnimation = function (name, expression, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
            if (name.length === 0) {
                this._reportError('Animation trigger is missing', sourceSpan);
            }
            // This will occur when a @trigger is not paired with an expression.
            // For animations it is valid to not have an expression since */void
            // states will be applied by angular when the element is attached/detached
            var ast = this._parseBinding(expression || 'undefined', false, valueSpan || sourceSpan, absoluteOffset);
            targetMatchableAttrs.push([name, ast.source]);
            targetProps.push(new ast_1.ParsedProperty(name, ast, ast_1.ParsedPropertyType.ANIMATION, sourceSpan, keySpan, valueSpan));
        };
        BindingParser.prototype._parseBinding = function (value, isHostBinding, sourceSpan, absoluteOffset) {
            var sourceInfo = (sourceSpan && sourceSpan.start || '(unknown)').toString();
            try {
                var ast = isHostBinding ?
                    this._exprParser.parseSimpleBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig) :
                    this._exprParser.parseBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig);
                if (ast)
                    this._reportExpressionParserErrors(ast.errors, sourceSpan);
                this._checkPipes(ast, sourceSpan);
                return ast;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
            }
        };
        BindingParser.prototype.createBoundElementProperty = function (elementSelector, boundProp, skipValidation, mapPropertyName) {
            if (skipValidation === void 0) { skipValidation = false; }
            if (mapPropertyName === void 0) { mapPropertyName = true; }
            if (boundProp.isAnimation) {
                return new ast_1.BoundElementProperty(boundProp.name, 4 /* Animation */, core_1.SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
            }
            var unit = null;
            var bindingType = undefined;
            var boundPropertyName = null;
            var parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
            var securityContexts = undefined;
            // Check for special cases (prefix style, attr, class)
            if (parts.length > 1) {
                if (parts[0] == ATTRIBUTE_PREFIX) {
                    boundPropertyName = parts.slice(1).join(PROPERTY_PARTS_SEPARATOR);
                    if (!skipValidation) {
                        this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
                    }
                    securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, true);
                    var nsSeparatorIdx = boundPropertyName.indexOf(':');
                    if (nsSeparatorIdx > -1) {
                        var ns = boundPropertyName.substring(0, nsSeparatorIdx);
                        var name_1 = boundPropertyName.substring(nsSeparatorIdx + 1);
                        boundPropertyName = tags_1.mergeNsAndName(ns, name_1);
                    }
                    bindingType = 1 /* Attribute */;
                }
                else if (parts[0] == CLASS_PREFIX) {
                    boundPropertyName = parts[1];
                    bindingType = 2 /* Class */;
                    securityContexts = [core_1.SecurityContext.NONE];
                }
                else if (parts[0] == STYLE_PREFIX) {
                    unit = parts.length > 2 ? parts[2] : null;
                    boundPropertyName = parts[1];
                    bindingType = 3 /* Style */;
                    securityContexts = [core_1.SecurityContext.STYLE];
                }
            }
            // If not a special case, use the full property name
            if (boundPropertyName === null) {
                var mappedPropName = this._schemaRegistry.getMappedPropName(boundProp.name);
                boundPropertyName = mapPropertyName ? mappedPropName : boundProp.name;
                securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, mappedPropName, false);
                bindingType = 0 /* Property */;
                if (!skipValidation) {
                    this._validatePropertyOrAttributeName(mappedPropName, boundProp.sourceSpan, false);
                }
            }
            return new ast_1.BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
        };
        BindingParser.prototype.parseEvent = function (name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents) {
            if (name.length === 0) {
                this._reportError("Event name is missing in binding", sourceSpan);
            }
            if (isAnimationLabel(name)) {
                name = name.substr(1);
                this._parseAnimationEvent(name, expression, sourceSpan, handlerSpan, targetEvents);
            }
            else {
                this._parseRegularEvent(name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents);
            }
        };
        BindingParser.prototype.calcPossibleSecurityContexts = function (selector, propName, isAttribute) {
            var prop = this._schemaRegistry.getMappedPropName(propName);
            return calcPossibleSecurityContexts(this._schemaRegistry, selector, prop, isAttribute);
        };
        BindingParser.prototype._parseAnimationEvent = function (name, expression, sourceSpan, handlerSpan, targetEvents) {
            var matches = util_1.splitAtPeriod(name, [name, '']);
            var eventName = matches[0];
            var phase = matches[1].toLowerCase();
            if (phase) {
                switch (phase) {
                    case 'start':
                    case 'done':
                        var ast = this._parseAction(expression, handlerSpan);
                        targetEvents.push(new ast_1.ParsedEvent(eventName, phase, 1 /* Animation */, ast, sourceSpan, handlerSpan));
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
        BindingParser.prototype._parseRegularEvent = function (name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents) {
            // long format: 'target: eventName'
            var _a = tslib_1.__read(util_1.splitAtColon(name, [null, name]), 2), target = _a[0], eventName = _a[1];
            var ast = this._parseAction(expression, handlerSpan);
            targetMatchableAttrs.push([name, ast.source]);
            targetEvents.push(new ast_1.ParsedEvent(eventName, target, 0 /* Regular */, ast, sourceSpan, handlerSpan));
            // Don't detect directives for event names for now,
            // so don't add the event name to the matchableAttrs
        };
        BindingParser.prototype._parseAction = function (value, sourceSpan) {
            var sourceInfo = (sourceSpan && sourceSpan.start || '(unknown').toString();
            var absoluteOffset = (sourceSpan && sourceSpan.start) ? sourceSpan.start.offset : 0;
            try {
                var ast = this._exprParser.parseAction(value, sourceInfo, absoluteOffset, this._interpolationConfig);
                if (ast) {
                    this._reportExpressionParserErrors(ast.errors, sourceSpan);
                }
                if (!ast || ast.ast instanceof ast_1.EmptyExpr) {
                    this._reportError("Empty expressions are not allowed", sourceSpan);
                    return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
                }
                this._checkPipes(ast, sourceSpan);
                return ast;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
            }
        };
        BindingParser.prototype._reportError = function (message, sourceSpan, level) {
            if (level === void 0) { level = parse_util_1.ParseErrorLevel.ERROR; }
            this.errors.push(new parse_util_1.ParseError(sourceSpan, message, level));
        };
        BindingParser.prototype._reportExpressionParserErrors = function (errors, sourceSpan) {
            var e_2, _a;
            try {
                for (var errors_1 = tslib_1.__values(errors), errors_1_1 = errors_1.next(); !errors_1_1.done; errors_1_1 = errors_1.next()) {
                    var error = errors_1_1.value;
                    this._reportError(error.message, sourceSpan);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (errors_1_1 && !errors_1_1.done && (_a = errors_1.return)) _a.call(errors_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        };
        // Make sure all the used pipes are known in `this.pipesByName`
        BindingParser.prototype._checkPipes = function (ast, sourceSpan) {
            var _this = this;
            if (ast && this.pipesByName) {
                var collector = new PipeCollector();
                ast.visit(collector);
                collector.pipes.forEach(function (ast, pipeName) {
                    var pipeMeta = _this.pipesByName.get(pipeName);
                    if (!pipeMeta) {
                        _this._reportError("The pipe '" + pipeName + "' could not be found", new parse_util_1.ParseSourceSpan(sourceSpan.start.moveBy(ast.span.start), sourceSpan.start.moveBy(ast.span.end)));
                    }
                    else {
                        _this._usedPipes.set(pipeName, pipeMeta);
                    }
                });
            }
        };
        /**
         * @param propName the name of the property / attribute
         * @param sourceSpan
         * @param isAttr true when binding to an attribute
         */
        BindingParser.prototype._validatePropertyOrAttributeName = function (propName, sourceSpan, isAttr) {
            var report = isAttr ? this._schemaRegistry.validateAttribute(propName) :
                this._schemaRegistry.validateProperty(propName);
            if (report.error) {
                this._reportError(report.msg, sourceSpan, parse_util_1.ParseErrorLevel.ERROR);
            }
        };
        return BindingParser;
    }());
    exports.BindingParser = BindingParser;
    var PipeCollector = /** @class */ (function (_super) {
        tslib_1.__extends(PipeCollector, _super);
        function PipeCollector() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.pipes = new Map();
            return _this;
        }
        PipeCollector.prototype.visitPipe = function (ast, context) {
            this.pipes.set(ast.name, ast);
            ast.exp.visit(this);
            this.visitAll(ast.args, context);
            return null;
        };
        return PipeCollector;
    }(ast_1.RecursiveAstVisitor));
    exports.PipeCollector = PipeCollector;
    function isAnimationLabel(name) {
        return name[0] == '@';
    }
    function calcPossibleSecurityContexts(registry, selector, propName, isAttribute) {
        var ctxs = [];
        selector_1.CssSelector.parse(selector).forEach(function (selector) {
            var elementNames = selector.element ? [selector.element] : registry.allKnownElementNames();
            var notElementNames = new Set(selector.notSelectors.filter(function (selector) { return selector.isElementSelector(); })
                .map(function (selector) { return selector.element; }));
            var possibleElementNames = elementNames.filter(function (elementName) { return !notElementNames.has(elementName); });
            ctxs.push.apply(ctxs, tslib_1.__spread(possibleElementNames.map(function (elementName) { return registry.securityContext(elementName, propName, isAttribute); })));
        });
        return ctxs.length === 0 ? [core_1.SecurityContext.NONE] : Array.from(new Set(ctxs)).sort();
    }
    exports.calcPossibleSecurityContexts = calcPossibleSecurityContexts;
    /**
     * Compute a new ParseSourceSpan based off an original `sourceSpan` by using
     * absolute offsets from the specified `absoluteSpan`.
     *
     * @param sourceSpan original source span
     * @param absoluteSpan absolute source span to move to
     */
    function moveParseSourceSpan(sourceSpan, absoluteSpan) {
        // The difference of two absolute offsets provide the relative offset
        var startDiff = absoluteSpan.start - sourceSpan.start.offset;
        var endDiff = absoluteSpan.end - sourceSpan.end.offset;
        return new parse_util_1.ParseSourceSpan(sourceSpan.start.moveBy(startDiff), sourceSpan.end.moveBy(endDiff));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFHSCxtREFBd0M7SUFDeEMsbUVBQTRSO0lBRzVSLDZEQUFpRDtJQUNqRCwrREFBMEY7SUFFMUYsMkRBQXdDO0lBQ3hDLG1EQUFvRDtJQUVwRCxJQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztJQUNyQyxJQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztJQUNoQyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUM7SUFDN0IsSUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0lBQzdCLElBQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDO0lBQ2pDLElBQU0sbUJBQW1CLEdBQUcsVUFBVSxDQUFDO0lBRXZDOztPQUVHO0lBQ0g7UUFLRSx1QkFDWSxXQUFtQixFQUFVLG9CQUF5QyxFQUN0RSxlQUFzQyxFQUFFLEtBQWdDLEVBQ3pFLE1BQW9CO1lBRm5CLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1lBQVUseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFxQjtZQUN0RSxvQkFBZSxHQUFmLGVBQWUsQ0FBdUI7WUFDdkMsV0FBTSxHQUFOLE1BQU0sQ0FBYztZQVAvQixnQkFBVyxHQUF5QyxJQUFJLENBQUM7WUFFakQsZUFBVSxHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBTTlELG9FQUFvRTtZQUNwRSxpRkFBaUY7WUFDakYsSUFBSSxLQUFLLEVBQUU7Z0JBQ1QsSUFBTSxhQUFXLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQy9ELEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxhQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVB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LENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVQaXBlU3VtbWFyeX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0Fic29sdXRlU291cmNlU3BhbiwgQVNUV2l0aFNvdXJjZSwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBCb3VuZEVsZW1lbnRQcm9wZXJ0eSwgRW1wdHlFeHByLCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkUHJvcGVydHlUeXBlLCBQYXJzZWRWYXJpYWJsZSwgUGFyc2VyRXJyb3IsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFRlbXBsYXRlQmluZGluZywgVmFyaWFibGVCaW5kaW5nfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge21lcmdlTnNBbmROYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3Rvcn0gZnJvbSAnLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtzcGxpdEF0Q29sb24sIHNwbGl0QXRQZXJpb2R9IGZyb20gJy4uL3V0aWwnO1xuXG5jb25zdCBQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IgPSAnLic7XG5jb25zdCBBVFRSSUJVVEVfUFJFRklYID0gJ2F0dHInO1xuY29uc3QgQ0xBU1NfUFJFRklYID0gJ2NsYXNzJztcbmNvbnN0IFNUWUxFX1BSRUZJWCA9ICdzdHlsZSc7XG5jb25zdCBURU1QTEFURV9BVFRSX1BSRUZJWCA9ICcqJztcbmNvbnN0IEFOSU1BVEVfUFJPUF9QUkVGSVggPSAnYW5pbWF0ZS0nO1xuXG4vKipcbiAqIFBhcnNlcyBiaW5kaW5ncyBpbiB0ZW1wbGF0ZXMgYW5kIGluIHRoZSBkaXJlY3RpdmUgaG9zdCBhcmVhLlxuICovXG5leHBvcnQgY2xhc3MgQmluZGluZ1BhcnNlciB7XG4gIHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+fG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgX3VzZWRQaXBlczogTWFwPHN0cmluZywgQ29tcGlsZVBpcGVTdW1tYXJ5PiA9IG5ldyBNYXAoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2V4cHJQYXJzZXI6IFBhcnNlciwgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXXxudWxsLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VFcnJvcltdKSB7XG4gICAgLy8gV2hlbiB0aGUgYHBpcGVzYCBwYXJhbWV0ZXIgaXMgYG51bGxgLCBkbyBub3QgY2hlY2sgZm9yIHVzZWQgcGlwZXNcbiAgICAvLyBUaGlzIGlzIHVzZWQgaW4gSVZZIHdoZW4gd2UgbWlnaHQgbm90IGtub3cgdGhlIGF2YWlsYWJsZSBwaXBlcyBhdCBjb21waWxlIHRpbWVcbiAgICBpZiAocGlwZXMpIHtcbiAgICAgIGNvbnN0IHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+ID0gbmV3IE1hcCgpO1xuICAgICAgcGlwZXMuZm9yRWFjaChwaXBlID0+IHBpcGVzQnlOYW1lLnNldChwaXBlLm5hbWUsIHBpcGUpKTtcbiAgICAgIHRoaXMucGlwZXNCeU5hbWUgPSBwaXBlc0J5TmFtZTtcbiAgICB9XG4gIH1cblxuICBnZXQgaW50ZXJwb2xhdGlvbkNvbmZpZygpOiBJbnRlcnBvbGF0aW9uQ29uZmlnIHtcbiAgICByZXR1cm4gdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBDb21waWxlUGlwZVN1bW1hcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5fdXNlZFBpcGVzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRQcm9wZXJ0eVtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzKSB7XG4gICAgICBjb25zdCBib3VuZFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG4gICAgICBPYmplY3Qua2V5cyhkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdFByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIGV4cHJlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgICAgcHJvcE5hbWUsIGV4cHJlc3Npb24sIHRydWUsIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0LCB1bmRlZmluZWQsIFtdLFxuICAgICAgICAgICAgICAvLyBVc2UgdGhlIGBzb3VyY2VTcGFuYCBmb3IgIGBrZXlTcGFuYC4gVGhpcyBpc24ndCByZWFsbHkgYWNjdXJhdGUsIGJ1dCBuZWl0aGVyIGlzIHRoZVxuICAgICAgICAgICAgICAvLyBzb3VyY2VTcGFuLCBhcyBpdCByZXByZXNlbnRzIHRoZSBzb3VyY2VTcGFuIG9mIHRoZSBob3N0IGl0c2VsZiByYXRoZXIgdGhhbiB0aGVcbiAgICAgICAgICAgICAgLy8gc291cmNlIG9mIHRoZSBob3N0IGJpbmRpbmcgKHdoaWNoIGRvZXNuJ3QgZXhpc3QgaW4gdGhlIHRlbXBsYXRlKS4gUmVnYXJkbGVzcyxcbiAgICAgICAgICAgICAgLy8gbmVpdGhlciBvZiB0aGVzZSB2YWx1ZXMgYXJlIHVzZWQgaW4gSXZ5IGJ1dCBhcmUgb25seSBoZXJlIHRvIHNhdGlzZnkgdGhlIGZ1bmN0aW9uXG4gICAgICAgICAgICAgIC8vIHNpZ25hdHVyZS4gVGhpcyBzaG91bGQgbGlrZWx5IGJlIHJlZmFjdG9yZWQgaW4gdGhlIGZ1dHVyZSBzbyB0aGF0IGBzb3VyY2VTcGFuYFxuICAgICAgICAgICAgICAvLyBpc24ndCBiZWluZyB1c2VkIGluYWNjdXJhdGVseS5cbiAgICAgICAgICAgICAgYm91bmRQcm9wcywgc291cmNlU3Bhbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBWYWx1ZSBvZiB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nIFwiJHtcbiAgICAgICAgICAgICAgICAgIHByb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke1xuICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbn1cIiAoJHt0eXBlb2YgZXhwcmVzc2lvbn0pYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGJvdW5kUHJvcHM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhcbiAgICAgIGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBlbGVtZW50U2VsZWN0b3I6IHN0cmluZyxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEJvdW5kRWxlbWVudFByb3BlcnR5W118bnVsbCB7XG4gICAgY29uc3QgYm91bmRQcm9wcyA9IHRoaXMuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJNZXRhLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gYm91bmRQcm9wcyAmJlxuICAgICAgICBib3VuZFByb3BzLm1hcCgocHJvcCkgPT4gdGhpcy5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50U2VsZWN0b3IsIHByb3ApKTtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRFdmVudFtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RMaXN0ZW5lcnMpIHtcbiAgICAgIGNvbnN0IHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdExpc3RlbmVyc1twcm9wTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZXhwcmVzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBUT0RPOiBwYXNzIGEgbW9yZSBhY2N1cmF0ZSBoYW5kbGVyU3BhbiBmb3IgdGhpcyBldmVudC5cbiAgICAgICAgICB0aGlzLnBhcnNlRXZlbnQocHJvcE5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4sIFtdLCB0YXJnZXRFdmVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgbGlzdGVuZXIgXCIke1xuICAgICAgICAgICAgICAgICAgcHJvcE5hbWV9XCIgbmVlZHMgdG8gYmUgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGFuIGV4cHJlc3Npb24gYnV0IGdvdCBcIiR7XG4gICAgICAgICAgICAgICAgICBleHByZXNzaW9ufVwiICgke3R5cGVvZiBleHByZXNzaW9ufSlgLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGFyZ2V0RXZlbnRzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gc291cmNlU3Bhbi5zdGFydC50b1N0cmluZygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykhO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2ltaWxhciB0byBgcGFyc2VJbnRlcnBvbGF0aW9uYCwgYnV0IHRyZWF0cyB0aGUgcHJvdmlkZWQgc3RyaW5nIGFzIGEgc2luZ2xlIGV4cHJlc3Npb25cbiAgICogZWxlbWVudCB0aGF0IHdvdWxkIG5vcm1hbGx5IGFwcGVhciB3aXRoaW4gdGhlIGludGVycG9sYXRpb24gcHJlZml4IGFuZCBzdWZmaXggKGB7e2AgYW5kIGB9fWApLlxuICAgKiBUaGlzIGlzIHVzZWQgZm9yIHBhcnNpbmcgdGhlIHN3aXRjaCBleHByZXNzaW9uIGluIElDVXMuXG4gICAqL1xuICBwYXJzZUludGVycG9sYXRpb25FeHByZXNzaW9uKGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IHNvdXJjZVNwYW4uc3RhcnQudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSB0aGlzLl9leHByUGFyc2VyLnBhcnNlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oXG4gICAgICAgICAgZXhwcmVzc2lvbiwgc291cmNlSW5mbywgc291cmNlU3Bhbi5zdGFydC5vZmZzZXQpO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIHRoZSBiaW5kaW5ncyBpbiBhIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24sIGFuZCBjb252ZXJ0cyB0aGVtIHRvXG4gICAqIGBQYXJzZWRQcm9wZXJ0eWAgb3IgYFBhcnNlZFZhcmlhYmxlYC5cbiAgICpcbiAgICogQHBhcmFtIHRwbEtleSB0ZW1wbGF0ZSBiaW5kaW5nIG5hbWVcbiAgICogQHBhcmFtIHRwbFZhbHVlIHRlbXBsYXRlIGJpbmRpbmcgdmFsdWVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gc3BhbiBvZiB0ZW1wbGF0ZSBiaW5kaW5nIHJlbGF0aXZlIHRvIGVudGlyZSB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIHRwbFZhbHVlIHJlbGF0aXZlIHRvIHRoZSBlbnRpcmUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldE1hdGNoYWJsZUF0dHJzIHBvdGVudGlhbCBhdHRyaWJ1dGVzIHRvIG1hdGNoIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0UHJvcHMgdGFyZ2V0IHByb3BlcnR5IGJpbmRpbmdzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0VmFycyB0YXJnZXQgdmFyaWFibGVzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKi9cbiAgcGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICB0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIsXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIHRhcmdldFZhcnM6IFBhcnNlZFZhcmlhYmxlW10sXG4gICAgICBpc0l2eUFzdDogYm9vbGVhbikge1xuICAgIGNvbnN0IGFic29sdXRlS2V5T2Zmc2V0ID0gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBURU1QTEFURV9BVFRSX1BSRUZJWC5sZW5ndGg7XG4gICAgY29uc3QgYmluZGluZ3MgPSB0aGlzLl9wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICAgIHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZVNwYW4sIGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZVZhbHVlT2Zmc2V0KTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgLy8gc291cmNlU3BhbiBpcyBmb3IgdGhlIGVudGlyZSBIVE1MIGF0dHJpYnV0ZS4gYmluZGluZ1NwYW4gaXMgZm9yIGEgcGFydGljdWxhclxuICAgICAgLy8gYmluZGluZyB3aXRoaW4gdGhlIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24gc28gaXQncyBtb3JlIG5hcnJvdyB0aGFuIHNvdXJjZVNwYW4uXG4gICAgICBjb25zdCBiaW5kaW5nU3BhbiA9IG1vdmVQYXJzZVNvdXJjZVNwYW4oc291cmNlU3BhbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIGNvbnN0IGtleSA9IGJpbmRpbmcua2V5LnNvdXJjZTtcbiAgICAgIGNvbnN0IGtleVNwYW4gPSBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcua2V5LnNwYW4pO1xuICAgICAgaWYgKGJpbmRpbmcgaW5zdGFuY2VvZiBWYXJpYWJsZUJpbmRpbmcpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLnZhbHVlID8gYmluZGluZy52YWx1ZS5zb3VyY2UgOiAnJGltcGxpY2l0JztcbiAgICAgICAgY29uc3QgdmFsdWVTcGFuID1cbiAgICAgICAgICAgIGJpbmRpbmcudmFsdWUgPyBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcudmFsdWUuc3BhbikgOiB1bmRlZmluZWQ7XG4gICAgICAgIHRhcmdldFZhcnMucHVzaChuZXcgUGFyc2VkVmFyaWFibGUoa2V5LCB2YWx1ZSwgYmluZGluZ1NwYW4sIGtleVNwYW4sIHZhbHVlU3BhbikpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kaW5nLnZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHNyY1NwYW4gPSBpc0l2eUFzdCA/IGJpbmRpbmdTcGFuIDogc291cmNlU3BhbjtcbiAgICAgICAgY29uc3QgdmFsdWVTcGFuID0gbW92ZVBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLCBiaW5kaW5nLnZhbHVlLmFzdC5zb3VyY2VTcGFuKTtcbiAgICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICAgIGtleSwgYmluZGluZy52YWx1ZSwgc3JjU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChba2V5LCAnJyAvKiB2YWx1ZSAqL10pO1xuICAgICAgICAvLyBTaW5jZSB0aGlzIGlzIGEgbGl0ZXJhbCBhdHRyaWJ1dGUgd2l0aCBubyBSSFMsIHNvdXJjZSBzcGFuIHNob3VsZCBiZVxuICAgICAgICAvLyBqdXN0IHRoZSBrZXkgc3Bhbi5cbiAgICAgICAgdGhpcy5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAga2V5LCBudWxsIC8qIHZhbHVlICovLCBrZXlTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB1bmRlZmluZWQgLyogdmFsdWVTcGFuICovLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzLCBrZXlTcGFuKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIHRoZSBiaW5kaW5ncyBpbiBhIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24sIGUuZy5cbiAgICogYGBgXG4gICAqICAgIDx0YWcgKnRwbEtleT1cImxldCB2YWx1ZTEgPSBwcm9wOyBsZXQgdmFsdWUyID0gbG9jYWxWYXJcIj5cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB0cGxLZXkgdGVtcGxhdGUgYmluZGluZyBuYW1lXG4gICAqIEBwYXJhbSB0cGxWYWx1ZSB0ZW1wbGF0ZSBiaW5kaW5nIHZhbHVlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHNwYW4gb2YgdGVtcGxhdGUgYmluZGluZyByZWxhdGl2ZSB0byBlbnRpcmUgdGhlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZUtleU9mZnNldCBzdGFydCBvZiB0aGUgYHRwbEtleWBcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIGB0cGxWYWx1ZWBcbiAgICovXG4gIHByaXZhdGUgX3BhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRwbEtleTogc3RyaW5nLCB0cGxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGFic29sdXRlS2V5T2Zmc2V0OiBudW1iZXIsXG4gICAgICBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIpOiBUZW1wbGF0ZUJpbmRpbmdbXSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IHNvdXJjZVNwYW4uc3RhcnQudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBiaW5kaW5nc1Jlc3VsdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgICAgIHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZVZhbHVlT2Zmc2V0KTtcbiAgICAgIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYmluZGluZ3NSZXN1bHQuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIGJpbmRpbmdzUmVzdWx0LnRlbXBsYXRlQmluZGluZ3MuZm9yRWFjaCgoYmluZGluZykgPT4ge1xuICAgICAgICBpZiAoYmluZGluZy52YWx1ZSBpbnN0YW5jZW9mIEFTVFdpdGhTb3VyY2UpIHtcbiAgICAgICAgICB0aGlzLl9jaGVja1BpcGVzKGJpbmRpbmcudmFsdWUsIHNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJpbmRpbmdzUmVzdWx0Lndhcm5pbmdzLmZvckVhY2goKHdhcm5pbmcpID0+IHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3Iod2FybmluZywgc291cmNlU3BhbiwgUGFyc2VFcnJvckxldmVsLldBUk5JTkcpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICBuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIGtleVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgYEFzc2lnbmluZyBhbmltYXRpb24gdHJpZ2dlcnMgdmlhIEBwcm9wPVwiZXhwXCIgYXR0cmlidXRlcyB3aXRoIGFuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5gICtcbiAgICAgICAgICAgICAgICBgIFVzZSBwcm9wZXJ0eSBiaW5kaW5ncyAoZS5nLiBbQHByb3BdPVwiZXhwXCIpIG9yIHVzZSBhbiBhdHRyaWJ1dGUgd2l0aG91dCBhIHZhbHVlIChlLmcuIEBwcm9wKSBpbnN0ZWFkLmAsXG4gICAgICAgICAgICBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0LCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSwgJycsIGFic29sdXRlT2Zmc2V0KSxcbiAgICAgICAgICBQYXJzZWRQcm9wZXJ0eVR5cGUuTElURVJBTF9BVFRSLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBpc0hvc3Q6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCBrZXlTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgUHJvcGVydHkgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBsZXQgaXNBbmltYXRpb25Qcm9wID0gZmFsc2U7XG4gICAgaWYgKG5hbWUuc3RhcnRzV2l0aChBTklNQVRFX1BST1BfUFJFRklYKSkge1xuICAgICAgaXNBbmltYXRpb25Qcm9wID0gdHJ1ZTtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZyhBTklNQVRFX1BST1BfUFJFRklYLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChpc0FuaW1hdGlvbkxhYmVsKG5hbWUpKSB7XG4gICAgICBpc0FuaW1hdGlvblByb3AgPSB0cnVlO1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIGlmIChpc0FuaW1hdGlvblByb3ApIHtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgICAgIG5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0LCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCB0aGlzLl9wYXJzZUJpbmRpbmcoZXhwcmVzc2lvbiwgaXNIb3N0LCB2YWx1ZVNwYW4gfHwgc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQpLFxuICAgICAgICAgIHNvdXJjZVNwYW4sIGtleVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgIG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIGtleVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBib29sZWFuIHtcbiAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZUludGVycG9sYXRpb24odmFsdWUsIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuKTtcbiAgICBpZiAoZXhwcikge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCBleHByLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgIG5hbWU6IHN0cmluZywgYXN0OiBBU1RXaXRoU291cmNlLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10pIHtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lLCBhc3Quc291cmNlIV0pO1xuICAgIHRhcmdldFByb3BzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZWRQcm9wZXJ0eShuYW1lLCBhc3QsIFBhcnNlZFByb3BlcnR5VHlwZS5ERUZBVUxULCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcignQW5pbWF0aW9uIHRyaWdnZXIgaXMgbWlzc2luZycsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd2lsbCBvY2N1ciB3aGVuIGEgQHRyaWdnZXIgaXMgbm90IHBhaXJlZCB3aXRoIGFuIGV4cHJlc3Npb24uXG4gICAgLy8gRm9yIGFuaW1hdGlvbnMgaXQgaXMgdmFsaWQgdG8gbm90IGhhdmUgYW4gZXhwcmVzc2lvbiBzaW5jZSAqL3ZvaWRcbiAgICAvLyBzdGF0ZXMgd2lsbCBiZSBhcHBsaWVkIGJ5IGFuZ3VsYXIgd2hlbiB0aGUgZWxlbWVudCBpcyBhdHRhY2hlZC9kZXRhY2hlZFxuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZyhcbiAgICAgICAgZXhwcmVzc2lvbiB8fCAndW5kZWZpbmVkJywgZmFsc2UsIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSFdKTtcbiAgICB0YXJnZXRQcm9wcy5wdXNoKG5ldyBQYXJzZWRQcm9wZXJ0eShcbiAgICAgICAgbmFtZSwgYXN0LCBQYXJzZWRQcm9wZXJ0eVR5cGUuQU5JTUFUSU9OLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQmluZGluZyhcbiAgICAgIHZhbHVlOiBzdHJpbmcsIGlzSG9zdEJpbmRpbmc6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gKHNvdXJjZVNwYW4gJiYgc291cmNlU3Bhbi5zdGFydCB8fCAnKHVua25vd24pJykudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSBpc0hvc3RCaW5kaW5nID9cbiAgICAgICAgICB0aGlzLl9leHByUGFyc2VyLnBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKSA6XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGFzdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsIGJvdW5kUHJvcDogUGFyc2VkUHJvcGVydHksIHNraXBWYWxpZGF0aW9uOiBib29sZWFuID0gZmFsc2UsXG4gICAgICBtYXBQcm9wZXJ0eU5hbWU6IGJvb2xlYW4gPSB0cnVlKTogQm91bmRFbGVtZW50UHJvcGVydHkge1xuICAgIGlmIChib3VuZFByb3AuaXNBbmltYXRpb24pIHtcbiAgICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgYm91bmRQcm9wLm5hbWUsIEJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBudWxsLFxuICAgICAgICAgIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBib3VuZFByb3Aua2V5U3BhbiwgYm91bmRQcm9wLnZhbHVlU3Bhbik7XG4gICAgfVxuXG4gICAgbGV0IHVuaXQ6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgYmluZGluZ1R5cGU6IEJpbmRpbmdUeXBlID0gdW5kZWZpbmVkITtcbiAgICBsZXQgYm91bmRQcm9wZXJ0eU5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBjb25zdCBwYXJ0cyA9IGJvdW5kUHJvcC5uYW1lLnNwbGl0KFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgbGV0IHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdID0gdW5kZWZpbmVkITtcblxuICAgIC8vIENoZWNrIGZvciBzcGVjaWFsIGNhc2VzIChwcmVmaXggc3R5bGUsIGF0dHIsIGNsYXNzKVxuICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICBpZiAocGFydHNbMF0gPT0gQVRUUklCVVRFX1BSRUZJWCkge1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oUFJPUEVSVFlfUEFSVFNfU0VQQVJBVE9SKTtcbiAgICAgICAgaWYgKCFza2lwVmFsaWRhdGlvbikge1xuICAgICAgICAgIHRoaXMuX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoYm91bmRQcm9wZXJ0eU5hbWUsIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBlbGVtZW50U2VsZWN0b3IsIGJvdW5kUHJvcGVydHlOYW1lLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBuc1NlcGFyYXRvcklkeCA9IGJvdW5kUHJvcGVydHlOYW1lLmluZGV4T2YoJzonKTtcbiAgICAgICAgaWYgKG5zU2VwYXJhdG9ySWR4ID4gLTEpIHtcbiAgICAgICAgICBjb25zdCBucyA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZygwLCBuc1NlcGFyYXRvcklkeCk7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZyhuc1NlcGFyYXRvcklkeCArIDEpO1xuICAgICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gbWVyZ2VOc0FuZE5hbWUobnMsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09IENMQVNTX1BSRUZJWCkge1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLkNsYXNzO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5OT05FXTtcbiAgICAgIH0gZWxzZSBpZiAocGFydHNbMF0gPT0gU1RZTEVfUFJFRklYKSB7XG4gICAgICAgIHVuaXQgPSBwYXJ0cy5sZW5ndGggPiAyID8gcGFydHNbMl0gOiBudWxsO1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLlN0eWxlO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5TVFlMRV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgbm90IGEgc3BlY2lhbCBjYXNlLCB1c2UgdGhlIGZ1bGwgcHJvcGVydHkgbmFtZVxuICAgIGlmIChib3VuZFByb3BlcnR5TmFtZSA9PT0gbnVsbCkge1xuICAgICAgY29uc3QgbWFwcGVkUHJvcE5hbWUgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShib3VuZFByb3AubmFtZSk7XG4gICAgICBib3VuZFByb3BlcnR5TmFtZSA9IG1hcFByb3BlcnR5TmFtZSA/IG1hcHBlZFByb3BOYW1lIDogYm91bmRQcm9wLm5hbWU7XG4gICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgZWxlbWVudFNlbGVjdG9yLCBtYXBwZWRQcm9wTmFtZSwgZmFsc2UpO1xuICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTtcbiAgICAgIGlmICghc2tpcFZhbGlkYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVQcm9wZXJ0eU9yQXR0cmlidXRlTmFtZShtYXBwZWRQcm9wTmFtZSwgYm91bmRQcm9wLnNvdXJjZVNwYW4sIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSwgYmluZGluZ1R5cGUsIHNlY3VyaXR5Q29udGV4dHNbMF0sIGJvdW5kUHJvcC5leHByZXNzaW9uLCB1bml0LFxuICAgICAgICBib3VuZFByb3Auc291cmNlU3BhbiwgYm91bmRQcm9wLmtleVNwYW4sIGJvdW5kUHJvcC52YWx1ZVNwYW4pO1xuICB9XG5cbiAgcGFyc2VFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgRXZlbnQgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEpO1xuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb25FdmVudChuYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbiwgdGFyZ2V0RXZlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VSZWd1bGFyRXZlbnQoXG4gICAgICAgICAgbmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRFdmVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZywgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOlxuICAgICAgU2VjdXJpdHlDb250ZXh0W10ge1xuICAgIGNvbnN0IHByb3AgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShwcm9wTmFtZSk7XG4gICAgcmV0dXJuIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHModGhpcy5fc2NoZW1hUmVnaXN0cnksIHNlbGVjdG9yLCBwcm9wLCBpc0F0dHJpYnV0ZSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFuaW1hdGlvbkV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBzcGxpdEF0UGVyaW9kKG5hbWUsIFtuYW1lLCAnJ10pO1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IG1hdGNoZXNbMF07XG4gICAgY29uc3QgcGhhc2UgPSBtYXRjaGVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHBoYXNlKSB7XG4gICAgICBzd2l0Y2ggKHBoYXNlKSB7XG4gICAgICAgIGNhc2UgJ3N0YXJ0JzpcbiAgICAgICAgY2FzZSAnZG9uZSc6XG4gICAgICAgICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgaGFuZGxlclNwYW4pO1xuICAgICAgICAgIHRhcmdldEV2ZW50cy5wdXNoKG5ldyBQYXJzZWRFdmVudChcbiAgICAgICAgICAgICAgZXZlbnROYW1lLCBwaGFzZSwgUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiwgYXN0LCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGUgcHJvdmlkZWQgYW5pbWF0aW9uIG91dHB1dCBwaGFzZSB2YWx1ZSBcIiR7cGhhc2V9XCIgZm9yIFwiQCR7XG4gICAgICAgICAgICAgICAgICBldmVudE5hbWV9XCIgaXMgbm90IHN1cHBvcnRlZCAodXNlIHN0YXJ0IG9yIGRvbmUpYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBUaGUgYW5pbWF0aW9uIHRyaWdnZXIgb3V0cHV0IGV2ZW50IChAJHtcbiAgICAgICAgICAgICAgZXZlbnROYW1lfSkgaXMgbWlzc2luZyBpdHMgcGhhc2UgdmFsdWUgbmFtZSAoc3RhcnQgb3IgZG9uZSBhcmUgY3VycmVudGx5IHN1cHBvcnRlZClgLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVndWxhckV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICAvLyBsb25nIGZvcm1hdDogJ3RhcmdldDogZXZlbnROYW1lJ1xuICAgIGNvbnN0IFt0YXJnZXQsIGV2ZW50TmFtZV0gPSBzcGxpdEF0Q29sb24obmFtZSwgW251bGwhLCBuYW1lXSk7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgaGFuZGxlclNwYW4pO1xuICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW25hbWUhLCBhc3Quc291cmNlIV0pO1xuICAgIHRhcmdldEV2ZW50cy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VkRXZlbnQoZXZlbnROYW1lLCB0YXJnZXQsIFBhcnNlZEV2ZW50VHlwZS5SZWd1bGFyLCBhc3QsIHNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuKSk7XG4gICAgLy8gRG9uJ3QgZGV0ZWN0IGRpcmVjdGl2ZXMgZm9yIGV2ZW50IG5hbWVzIGZvciBub3csXG4gICAgLy8gc28gZG9uJ3QgYWRkIHRoZSBldmVudCBuYW1lIHRvIHRoZSBtYXRjaGFibGVBdHRyc1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBY3Rpb24odmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQgfHwgJyh1bmtub3duJykudG9TdHJpbmcoKTtcbiAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQpID8gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgOiAwO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VBY3Rpb24oXG4gICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGlmICghYXN0IHx8IGFzdC5hc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYEVtcHR5IGV4cHJlc3Npb25zIGFyZSBub3QgYWxsb3dlZGAsIHNvdXJjZVNwYW4pO1xuICAgICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGVycm9yczogUGFyc2VyRXJyb3JbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yLm1lc3NhZ2UsIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSBhbGwgdGhlIHVzZWQgcGlwZXMgYXJlIGtub3duIGluIGB0aGlzLnBpcGVzQnlOYW1lYFxuICBwcml2YXRlIF9jaGVja1BpcGVzKGFzdDogQVNUV2l0aFNvdXJjZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gICAgaWYgKGFzdCAmJiB0aGlzLnBpcGVzQnlOYW1lKSB7XG4gICAgICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgUGlwZUNvbGxlY3RvcigpO1xuICAgICAgYXN0LnZpc2l0KGNvbGxlY3Rvcik7XG4gICAgICBjb2xsZWN0b3IucGlwZXMuZm9yRWFjaCgoYXN0LCBwaXBlTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBwaXBlTWV0YSA9IHRoaXMucGlwZXNCeU5hbWUhLmdldChwaXBlTmFtZSk7XG4gICAgICAgIGlmICghcGlwZU1ldGEpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFRoZSBwaXBlICcke3BpcGVOYW1lfScgY291bGQgbm90IGJlIGZvdW5kYCxcbiAgICAgICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFzdC5zcGFuLnN0YXJ0KSwgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoYXN0LnNwYW4uZW5kKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3VzZWRQaXBlcy5zZXQocGlwZU5hbWUsIHBpcGVNZXRhKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBwcm9wTmFtZSB0aGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgLyBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW5cbiAgICogQHBhcmFtIGlzQXR0ciB0cnVlIHdoZW4gYmluZGluZyB0byBhbiBhdHRyaWJ1dGVcbiAgICovXG4gIHByaXZhdGUgX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoXG4gICAgICBwcm9wTmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGlzQXR0cjogYm9vbGVhbik6IHZvaWQge1xuICAgIGNvbnN0IHJlcG9ydCA9IGlzQXR0ciA/IHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LnZhbGlkYXRlQXR0cmlidXRlKHByb3BOYW1lKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnkudmFsaWRhdGVQcm9wZXJ0eShwcm9wTmFtZSk7XG4gICAgaWYgKHJlcG9ydC5lcnJvcikge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IocmVwb3J0Lm1zZyEsIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQ29sbGVjdG9yIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciB7XG4gIHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdQaXBlPigpO1xuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnBpcGVzLnNldChhc3QubmFtZSwgYXN0KTtcbiAgICBhc3QuZXhwLnZpc2l0KHRoaXMpO1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQW5pbWF0aW9uTGFiZWwobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lWzBdID09ICdAJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgcmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZyxcbiAgICBpc0F0dHJpYnV0ZTogYm9vbGVhbik6IFNlY3VyaXR5Q29udGV4dFtdIHtcbiAgY29uc3QgY3R4czogU2VjdXJpdHlDb250ZXh0W10gPSBbXTtcbiAgQ3NzU2VsZWN0b3IucGFyc2Uoc2VsZWN0b3IpLmZvckVhY2goKHNlbGVjdG9yKSA9PiB7XG4gICAgY29uc3QgZWxlbWVudE5hbWVzID0gc2VsZWN0b3IuZWxlbWVudCA/IFtzZWxlY3Rvci5lbGVtZW50XSA6IHJlZ2lzdHJ5LmFsbEtub3duRWxlbWVudE5hbWVzKCk7XG4gICAgY29uc3Qgbm90RWxlbWVudE5hbWVzID1cbiAgICAgICAgbmV3IFNldChzZWxlY3Rvci5ub3RTZWxlY3RvcnMuZmlsdGVyKHNlbGVjdG9yID0+IHNlbGVjdG9yLmlzRWxlbWVudFNlbGVjdG9yKCkpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKHNlbGVjdG9yKSA9PiBzZWxlY3Rvci5lbGVtZW50KSk7XG4gICAgY29uc3QgcG9zc2libGVFbGVtZW50TmFtZXMgPVxuICAgICAgICBlbGVtZW50TmFtZXMuZmlsdGVyKGVsZW1lbnROYW1lID0+ICFub3RFbGVtZW50TmFtZXMuaGFzKGVsZW1lbnROYW1lKSk7XG5cbiAgICBjdHhzLnB1c2goLi4ucG9zc2libGVFbGVtZW50TmFtZXMubWFwKFxuICAgICAgICBlbGVtZW50TmFtZSA9PiByZWdpc3RyeS5zZWN1cml0eUNvbnRleHQoZWxlbWVudE5hbWUsIHByb3BOYW1lLCBpc0F0dHJpYnV0ZSkpKTtcbiAgfSk7XG4gIHJldHVybiBjdHhzLmxlbmd0aCA9PT0gMCA/IFtTZWN1cml0eUNvbnRleHQuTk9ORV0gOiBBcnJheS5mcm9tKG5ldyBTZXQoY3R4cykpLnNvcnQoKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGEgbmV3IFBhcnNlU291cmNlU3BhbiBiYXNlZCBvZmYgYW4gb3JpZ2luYWwgYHNvdXJjZVNwYW5gIGJ5IHVzaW5nXG4gKiBhYnNvbHV0ZSBvZmZzZXRzIGZyb20gdGhlIHNwZWNpZmllZCBgYWJzb2x1dGVTcGFuYC5cbiAqXG4gKiBAcGFyYW0gc291cmNlU3BhbiBvcmlnaW5hbCBzb3VyY2Ugc3BhblxuICogQHBhcmFtIGFic29sdXRlU3BhbiBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0byBtb3ZlIHRvXG4gKi9cbmZ1bmN0aW9uIG1vdmVQYXJzZVNvdXJjZVNwYW4oXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVNwYW46IEFic29sdXRlU291cmNlU3Bhbik6IFBhcnNlU291cmNlU3BhbiB7XG4gIC8vIFRoZSBkaWZmZXJlbmNlIG9mIHR3byBhYnNvbHV0ZSBvZmZzZXRzIHByb3ZpZGUgdGhlIHJlbGF0aXZlIG9mZnNldFxuICBjb25zdCBzdGFydERpZmYgPSBhYnNvbHV0ZVNwYW4uc3RhcnQgLSBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldDtcbiAgY29uc3QgZW5kRGlmZiA9IGFic29sdXRlU3Bhbi5lbmQgLSBzb3VyY2VTcGFuLmVuZC5vZmZzZXQ7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHN0YXJ0RGlmZiksIHNvdXJjZVNwYW4uZW5kLm1vdmVCeShlbmREaWZmKSk7XG59XG4iXX0=