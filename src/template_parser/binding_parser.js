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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFHSCxtREFBd0M7SUFDeEMsbUVBQTRSO0lBRzVSLDZEQUFpRDtJQUNqRCwrREFBMEY7SUFFMUYsMkRBQXdDO0lBQ3hDLG1EQUFvRDtJQUVwRCxJQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztJQUNyQyxJQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztJQUNoQyxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUM7SUFDN0IsSUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0lBQzdCLElBQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDO0lBQ2pDLElBQU0sbUJBQW1CLEdBQUcsVUFBVSxDQUFDO0lBRXZDOztPQUVHO0lBQ0g7UUFLRSx1QkFDWSxXQUFtQixFQUFVLG9CQUF5QyxFQUN0RSxlQUFzQyxFQUFFLEtBQWdDLEVBQ3pFLE1BQW9CO1lBRm5CLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1lBQVUseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFxQjtZQUN0RSxvQkFBZSxHQUFmLGVBQWUsQ0FBdUI7WUFDdkMsV0FBTSxHQUFOLE1BQU0sQ0FBYztZQVAvQixnQkFBVyxHQUF5QyxJQUFJLENBQUM7WUFFakQsZUFBVSxHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBTTlELG9FQUFvRTtZQUNwRSxpRkFBaUY7WUFDakYsSUFBSSxLQUFLLEVBQUU7Z0JBQ1QsSUFBTSxhQUFXLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQy9ELEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxhQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVB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LElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3ZGLENBQUM7SUFoQkQsb0VBZ0JDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsU0FBUyxtQkFBbUIsQ0FDeEIsVUFBMkIsRUFBRSxZQUFnQztRQUMvRCxxRUFBcUU7UUFDckUsSUFBTSxTQUFTLEdBQUcsWUFBWSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUMvRCxJQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO1FBQ3pELE9BQU8sSUFBSSw0QkFBZSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDakcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUGlwZVN1bW1hcnl9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEFTVFdpdGhTb3VyY2UsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIEVtcHR5RXhwciwgUGFyc2VkRXZlbnQsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VkUHJvcGVydHksIFBhcnNlZFByb3BlcnR5VHlwZSwgUGFyc2VkVmFyaWFibGUsIFBhcnNlckVycm9yLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBUZW1wbGF0ZUJpbmRpbmcsIFZhcmlhYmxlQmluZGluZ30gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHttZXJnZU5zQW5kTmFtZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUVycm9yTGV2ZWwsIFBhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0VsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vc2NoZW1hL2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uL3NlbGVjdG9yJztcbmltcG9ydCB7c3BsaXRBdENvbG9uLCBzcGxpdEF0UGVyaW9kfSBmcm9tICcuLi91dGlsJztcblxuY29uc3QgUFJPUEVSVFlfUEFSVFNfU0VQQVJBVE9SID0gJy4nO1xuY29uc3QgQVRUUklCVVRFX1BSRUZJWCA9ICdhdHRyJztcbmNvbnN0IENMQVNTX1BSRUZJWCA9ICdjbGFzcyc7XG5jb25zdCBTVFlMRV9QUkVGSVggPSAnc3R5bGUnO1xuY29uc3QgVEVNUExBVEVfQVRUUl9QUkVGSVggPSAnKic7XG5jb25zdCBBTklNQVRFX1BST1BfUFJFRklYID0gJ2FuaW1hdGUtJztcblxuLyoqXG4gKiBQYXJzZXMgYmluZGluZ3MgaW4gdGVtcGxhdGVzIGFuZCBpbiB0aGUgZGlyZWN0aXZlIGhvc3QgYXJlYS5cbiAqL1xuZXhwb3J0IGNsYXNzIEJpbmRpbmdQYXJzZXIge1xuICBwaXBlc0J5TmFtZTogTWFwPHN0cmluZywgQ29tcGlsZVBpcGVTdW1tYXJ5PnxudWxsID0gbnVsbDtcblxuICBwcml2YXRlIF91c2VkUGlwZXM6IE1hcDxzdHJpbmcsIENvbXBpbGVQaXBlU3VtbWFyeT4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9leHByUGFyc2VyOiBQYXJzZXIsIHByaXZhdGUgX2ludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcml2YXRlIF9zY2hlbWFSZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W118bnVsbCxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge1xuICAgIC8vIFdoZW4gdGhlIGBwaXBlc2AgcGFyYW1ldGVyIGlzIGBudWxsYCwgZG8gbm90IGNoZWNrIGZvciB1c2VkIHBpcGVzXG4gICAgLy8gVGhpcyBpcyB1c2VkIGluIElWWSB3aGVuIHdlIG1pZ2h0IG5vdCBrbm93IHRoZSBhdmFpbGFibGUgcGlwZXMgYXQgY29tcGlsZSB0aW1lXG4gICAgaWYgKHBpcGVzKSB7XG4gICAgICBjb25zdCBwaXBlc0J5TmFtZTogTWFwPHN0cmluZywgQ29tcGlsZVBpcGVTdW1tYXJ5PiA9IG5ldyBNYXAoKTtcbiAgICAgIHBpcGVzLmZvckVhY2gocGlwZSA9PiBwaXBlc0J5TmFtZS5zZXQocGlwZS5uYW1lLCBwaXBlKSk7XG4gICAgICB0aGlzLnBpcGVzQnlOYW1lID0gcGlwZXNCeU5hbWU7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGludGVycG9sYXRpb25Db25maWcoKTogSW50ZXJwb2xhdGlvbkNvbmZpZyB7XG4gICAgcmV0dXJuIHRoaXMuX2ludGVycG9sYXRpb25Db25maWc7XG4gIH1cblxuICBnZXRVc2VkUGlwZXMoKTogQ29tcGlsZVBpcGVTdW1tYXJ5W10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuX3VzZWRQaXBlcy52YWx1ZXMoKSk7XG4gIH1cblxuICBjcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgUGFyc2VkUHJvcGVydHlbXXxudWxsIHtcbiAgICBpZiAoZGlyTWV0YS5ob3N0UHJvcGVydGllcykge1xuICAgICAgY29uc3QgYm91bmRQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0UHJvcGVydGllcykuZm9yRWFjaChwcm9wTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgICAgaWYgKHR5cGVvZiBleHByZXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICAgIHByb3BOYW1lLCBleHByZXNzaW9uLCB0cnVlLCBzb3VyY2VTcGFuLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgdW5kZWZpbmVkLCBbXSxcbiAgICAgICAgICAgICAgLy8gVXNlIHRoZSBgc291cmNlU3BhbmAgZm9yICBga2V5U3BhbmAuIFRoaXMgaXNuJ3QgcmVhbGx5IGFjY3VyYXRlLCBidXQgbmVpdGhlciBpcyB0aGVcbiAgICAgICAgICAgICAgLy8gc291cmNlU3BhbiwgYXMgaXQgcmVwcmVzZW50cyB0aGUgc291cmNlU3BhbiBvZiB0aGUgaG9zdCBpdHNlbGYgcmF0aGVyIHRoYW4gdGhlXG4gICAgICAgICAgICAgIC8vIHNvdXJjZSBvZiB0aGUgaG9zdCBiaW5kaW5nICh3aGljaCBkb2Vzbid0IGV4aXN0IGluIHRoZSB0ZW1wbGF0ZSkuIFJlZ2FyZGxlc3MsXG4gICAgICAgICAgICAgIC8vIG5laXRoZXIgb2YgdGhlc2UgdmFsdWVzIGFyZSB1c2VkIGluIEl2eSBidXQgYXJlIG9ubHkgaGVyZSB0byBzYXRpc2Z5IHRoZSBmdW5jdGlvblxuICAgICAgICAgICAgICAvLyBzaWduYXR1cmUuIFRoaXMgc2hvdWxkIGxpa2VseSBiZSByZWZhY3RvcmVkIGluIHRoZSBmdXR1cmUgc28gdGhhdCBgc291cmNlU3BhbmBcbiAgICAgICAgICAgICAgLy8gaXNuJ3QgYmVpbmcgdXNlZCBpbmFjY3VyYXRlbHkuXG4gICAgICAgICAgICAgIGJvdW5kUHJvcHMsIHNvdXJjZVNwYW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZyBcIiR7XG4gICAgICAgICAgICAgICAgICBwcm9wTmFtZX1cIiBuZWVkcyB0byBiZSBhIHN0cmluZyByZXByZXNlbnRpbmcgYW4gZXhwcmVzc2lvbiBidXQgZ290IFwiJHtcbiAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb259XCIgKCR7dHlwZW9mIGV4cHJlc3Npb259KWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBib3VuZFByb3BzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RQcm9wZXJ0eUFzdHMoXG4gICAgICBkaXJNZXRhOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eVtdfG51bGwge1xuICAgIGNvbnN0IGJvdW5kUHJvcHMgPSB0aGlzLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyTWV0YSwgc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGJvdW5kUHJvcHMgJiZcbiAgICAgICAgYm91bmRQcm9wcy5tYXAoKHByb3ApID0+IHRoaXMuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudFNlbGVjdG9yLCBwcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgUGFyc2VkRXZlbnRbXXxudWxsIHtcbiAgICBpZiAoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKSB7XG4gICAgICBjb25zdCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgIE9iamVjdC5rZXlzKGRpck1ldGEuaG9zdExpc3RlbmVycykuZm9yRWFjaChwcm9wTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkaXJNZXRhLmhvc3RMaXN0ZW5lcnNbcHJvcE5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIGV4cHJlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gVE9ETzogcGFzcyBhIG1vcmUgYWNjdXJhdGUgaGFuZGxlclNwYW4gZm9yIHRoaXMgZXZlbnQuXG4gICAgICAgICAgdGhpcy5wYXJzZUV2ZW50KHByb3BOYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBzb3VyY2VTcGFuLCBbXSwgdGFyZ2V0RXZlbnRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFZhbHVlIG9mIHRoZSBob3N0IGxpc3RlbmVyIFwiJHtcbiAgICAgICAgICAgICAgICAgIHByb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke1xuICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbn1cIiAoJHt0eXBlb2YgZXhwcmVzc2lvbn0pYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRhcmdldEV2ZW50cztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwYXJzZUludGVycG9sYXRpb24odmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IHNvdXJjZVNwYW4uc3RhcnQudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSB0aGlzLl9leHByUGFyc2VyLnBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgICAgICB2YWx1ZSwgc291cmNlSW5mbywgc291cmNlU3Bhbi5zdGFydC5vZmZzZXQsIHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpITtcbiAgICAgIGlmIChhc3QpIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYXN0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyB0aGUgYmluZGluZ3MgaW4gYSBtaWNyb3N5bnRheCBleHByZXNzaW9uLCBhbmQgY29udmVydHMgdGhlbSB0b1xuICAgKiBgUGFyc2VkUHJvcGVydHlgIG9yIGBQYXJzZWRWYXJpYWJsZWAuXG4gICAqXG4gICAqIEBwYXJhbSB0cGxLZXkgdGVtcGxhdGUgYmluZGluZyBuYW1lXG4gICAqIEBwYXJhbSB0cGxWYWx1ZSB0ZW1wbGF0ZSBiaW5kaW5nIHZhbHVlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHNwYW4gb2YgdGVtcGxhdGUgYmluZGluZyByZWxhdGl2ZSB0byBlbnRpcmUgdGhlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSB0cGxWYWx1ZSByZWxhdGl2ZSB0byB0aGUgZW50aXJlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSB0YXJnZXRNYXRjaGFibGVBdHRycyBwb3RlbnRpYWwgYXR0cmlidXRlcyB0byBtYXRjaCBpbiB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldFByb3BzIHRhcmdldCBwcm9wZXJ0eSBiaW5kaW5ncyBpbiB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldFZhcnMgdGFyZ2V0IHZhcmlhYmxlcyBpbiB0aGUgdGVtcGxhdGVcbiAgICovXG4gIHBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgdHBsS2V5OiBzdHJpbmcsIHRwbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCB0YXJnZXRWYXJzOiBQYXJzZWRWYXJpYWJsZVtdLFxuICAgICAgaXNJdnlBc3Q6IGJvb2xlYW4pIHtcbiAgICBjb25zdCBhYnNvbHV0ZUtleU9mZnNldCA9IHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0ICsgVEVNUExBVEVfQVRUUl9QUkVGSVgubGVuZ3RoO1xuICAgIGNvbnN0IGJpbmRpbmdzID0gdGhpcy5fcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgICB0cGxLZXksIHRwbFZhbHVlLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZUtleU9mZnNldCwgYWJzb2x1dGVWYWx1ZU9mZnNldCk7XG5cbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYmluZGluZ3MpIHtcbiAgICAgIC8vIHNvdXJjZVNwYW4gaXMgZm9yIHRoZSBlbnRpcmUgSFRNTCBhdHRyaWJ1dGUuIGJpbmRpbmdTcGFuIGlzIGZvciBhIHBhcnRpY3VsYXJcbiAgICAgIC8vIGJpbmRpbmcgd2l0aGluIHRoZSBtaWNyb3N5bnRheCBleHByZXNzaW9uIHNvIGl0J3MgbW9yZSBuYXJyb3cgdGhhbiBzb3VyY2VTcGFuLlxuICAgICAgY29uc3QgYmluZGluZ1NwYW4gPSBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgICBjb25zdCBrZXkgPSBiaW5kaW5nLmtleS5zb3VyY2U7XG4gICAgICBjb25zdCBrZXlTcGFuID0gbW92ZVBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLCBiaW5kaW5nLmtleS5zcGFuKTtcbiAgICAgIGlmIChiaW5kaW5nIGluc3RhbmNlb2YgVmFyaWFibGVCaW5kaW5nKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gYmluZGluZy52YWx1ZSA/IGJpbmRpbmcudmFsdWUuc291cmNlIDogJyRpbXBsaWNpdCc7XG4gICAgICAgIGNvbnN0IHZhbHVlU3BhbiA9XG4gICAgICAgICAgICBiaW5kaW5nLnZhbHVlID8gbW92ZVBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLCBiaW5kaW5nLnZhbHVlLnNwYW4pIDogdW5kZWZpbmVkO1xuICAgICAgICB0YXJnZXRWYXJzLnB1c2gobmV3IFBhcnNlZFZhcmlhYmxlKGtleSwgdmFsdWUsIGJpbmRpbmdTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZGluZy52YWx1ZSkge1xuICAgICAgICBjb25zdCBzcmNTcGFuID0gaXNJdnlBc3QgPyBiaW5kaW5nU3BhbiA6IHNvdXJjZVNwYW47XG4gICAgICAgIGNvbnN0IHZhbHVlU3BhbiA9IG1vdmVQYXJzZVNvdXJjZVNwYW4oc291cmNlU3BhbiwgYmluZGluZy52YWx1ZS5hc3Quc291cmNlU3Bhbik7XG4gICAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgICBrZXksIGJpbmRpbmcudmFsdWUsIHNyY1NwYW4sIGtleVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW2tleSwgJycgLyogdmFsdWUgKi9dKTtcbiAgICAgICAgLy8gU2luY2UgdGhpcyBpcyBhIGxpdGVyYWwgYXR0cmlidXRlIHdpdGggbm8gUkhTLCBzb3VyY2Ugc3BhbiBzaG91bGQgYmVcbiAgICAgICAgLy8ganVzdCB0aGUga2V5IHNwYW4uXG4gICAgICAgIHRoaXMucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICAgIGtleSwgbnVsbCAvKiB2YWx1ZSAqLywga2V5U3BhbiwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdW5kZWZpbmVkIC8qIHZhbHVlU3BhbiAqLyxcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcywga2V5U3Bhbik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyB0aGUgYmluZGluZ3MgaW4gYSBtaWNyb3N5bnRheCBleHByZXNzaW9uLCBlLmcuXG4gICAqIGBgYFxuICAgKiAgICA8dGFnICp0cGxLZXk9XCJsZXQgdmFsdWUxID0gcHJvcDsgbGV0IHZhbHVlMiA9IGxvY2FsVmFyXCI+XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdHBsS2V5IHRlbXBsYXRlIGJpbmRpbmcgbmFtZVxuICAgKiBAcGFyYW0gdHBsVmFsdWUgdGVtcGxhdGUgYmluZGluZyB2YWx1ZVxuICAgKiBAcGFyYW0gc291cmNlU3BhbiBzcGFuIG9mIHRlbXBsYXRlIGJpbmRpbmcgcmVsYXRpdmUgdG8gZW50aXJlIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gYWJzb2x1dGVLZXlPZmZzZXQgc3RhcnQgb2YgdGhlIGB0cGxLZXlgXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdHBsVmFsdWVgXG4gICAqL1xuICBwcml2YXRlIF9wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICB0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZUtleU9mZnNldDogbnVtYmVyLFxuICAgICAgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyKTogVGVtcGxhdGVCaW5kaW5nW10ge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSBzb3VyY2VTcGFuLnN0YXJ0LnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYmluZGluZ3NSZXN1bHQgPSB0aGlzLl9leHByUGFyc2VyLnBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgICAgICB0cGxLZXksIHRwbFZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZUtleU9mZnNldCwgYWJzb2x1dGVWYWx1ZU9mZnNldCk7XG4gICAgICB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGJpbmRpbmdzUmVzdWx0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICBiaW5kaW5nc1Jlc3VsdC50ZW1wbGF0ZUJpbmRpbmdzLmZvckVhY2goKGJpbmRpbmcpID0+IHtcbiAgICAgICAgaWYgKGJpbmRpbmcudmFsdWUgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSB7XG4gICAgICAgICAgdGhpcy5fY2hlY2tQaXBlcyhiaW5kaW5nLnZhbHVlLCBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBiaW5kaW5nc1Jlc3VsdC53YXJuaW5ncy5mb3JFYWNoKCh3YXJuaW5nKSA9PiB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKHdhcm5pbmcsIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGJpbmRpbmdzUmVzdWx0LnRlbXBsYXRlQmluZGluZ3M7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICAvLyBUT0RPKGF0c2NvdHQpOiBrZXlTcGFuIGlzIG9ubHkgb3B0aW9uYWwgaGVyZSBzbyBWRSB0ZW1wbGF0ZSBwYXJzZXIgaW1wbGVtZW50YXRpb24gZG9lcyBub3RcbiAgICAgIC8vIGhhdmUgdG8gY2hhbmdlIFRoaXMgc2hvdWxkIGJlIHJlcXVpcmVkIHdoZW4gVkUgaXMgcmVtb3ZlZC5cbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCBrZXlTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgIGBBc3NpZ25pbmcgYW5pbWF0aW9uIHRyaWdnZXJzIHZpYSBAcHJvcD1cImV4cFwiIGF0dHJpYnV0ZXMgd2l0aCBhbiBleHByZXNzaW9uIGlzIGludmFsaWQuYCArXG4gICAgICAgICAgICAgICAgYCBVc2UgcHJvcGVydHkgYmluZGluZ3MgKGUuZy4gW0Bwcm9wXT1cImV4cFwiKSBvciB1c2UgYW4gYXR0cmlidXRlIHdpdGhvdXQgYSB2YWx1ZSAoZS5nLiBAcHJvcCkgaW5zdGVhZC5gLFxuICAgICAgICAgICAgc291cmNlU3BhbiwgUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCwga2V5U3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICB0YXJnZXRQcm9wcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFByb3BzLnB1c2gobmV3IFBhcnNlZFByb3BlcnR5KFxuICAgICAgICAgIG5hbWUsIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUodmFsdWUsICcnLCBhYnNvbHV0ZU9mZnNldCksXG4gICAgICAgICAgUGFyc2VkUHJvcGVydHlUeXBlLkxJVEVSQUxfQVRUUiwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgaXNIb3N0OiBib29sZWFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICAvLyBUT0RPKGF0c2NvdHQpOiBrZXlTcGFuIGlzIG9ubHkgb3B0aW9uYWwgaGVyZSBzbyBWRSB0ZW1wbGF0ZSBwYXJzZXIgaW1wbGVtZW50YXRpb24gZG9lcyBub3RcbiAgICAgIC8vIGhhdmUgdG8gY2hhbmdlIFRoaXMgc2hvdWxkIGJlIHJlcXVpcmVkIHdoZW4gVkUgaXMgcmVtb3ZlZC5cbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSwga2V5U3Bhbj86IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFByb3BlcnR5IG5hbWUgaXMgbWlzc2luZyBpbiBiaW5kaW5nYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgbGV0IGlzQW5pbWF0aW9uUHJvcCA9IGZhbHNlO1xuICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgoQU5JTUFURV9QUk9QX1BSRUZJWCkpIHtcbiAgICAgIGlzQW5pbWF0aW9uUHJvcCA9IHRydWU7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoQU5JTUFURV9QUk9QX1BSRUZJWC5sZW5ndGgpO1xuICAgIH0gZWxzZSBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgaXNBbmltYXRpb25Qcm9wID0gdHJ1ZTtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbmltYXRpb25Qcm9wKSB7XG4gICAgICB0aGlzLl9wYXJzZUFuaW1hdGlvbihcbiAgICAgICAgICBuYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCwga2V5U3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICB0YXJnZXRQcm9wcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fcGFyc2VCaW5kaW5nKGV4cHJlc3Npb24sIGlzSG9zdCwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0KSxcbiAgICAgICAgICBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICBuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICAvLyBUT0RPKGF0c2NvdHQpOiBrZXlTcGFuIGlzIG9ubHkgb3B0aW9uYWwgaGVyZSBzbyBWRSB0ZW1wbGF0ZSBwYXJzZXIgaW1wbGVtZW50YXRpb24gZG9lcyBub3RcbiAgICAgIC8vIGhhdmUgdG8gY2hhbmdlIFRoaXMgc2hvdWxkIGJlIHJlcXVpcmVkIHdoZW4gVkUgaXMgcmVtb3ZlZC5cbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCBrZXlTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlLCB2YWx1ZVNwYW4gfHwgc291cmNlU3Bhbik7XG4gICAgaWYgKGV4cHIpIHtcbiAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgbmFtZSwgZXhwciwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICBuYW1lOiBzdHJpbmcsIGFzdDogQVNUV2l0aFNvdXJjZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSFdKTtcbiAgICB0YXJnZXRQcm9wcy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VkUHJvcGVydHkobmFtZSwgYXN0LCBQYXJzZWRQcm9wZXJ0eVR5cGUuREVGQVVMVCwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFuaW1hdGlvbihcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGtleVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCxcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoJ0FuaW1hdGlvbiB0cmlnZ2VyIGlzIG1pc3NpbmcnLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIHdpbGwgb2NjdXIgd2hlbiBhIEB0cmlnZ2VyIGlzIG5vdCBwYWlyZWQgd2l0aCBhbiBleHByZXNzaW9uLlxuICAgIC8vIEZvciBhbmltYXRpb25zIGl0IGlzIHZhbGlkIHRvIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24gc2luY2UgKi92b2lkXG4gICAgLy8gc3RhdGVzIHdpbGwgYmUgYXBwbGllZCBieSBhbmd1bGFyIHdoZW4gdGhlIGVsZW1lbnQgaXMgYXR0YWNoZWQvZGV0YWNoZWRcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmcoXG4gICAgICAgIGV4cHJlc3Npb24gfHwgJ3VuZGVmaW5lZCcsIGZhbHNlLCB2YWx1ZVNwYW4gfHwgc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQpO1xuICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW25hbWUsIGFzdC5zb3VyY2UhXSk7XG4gICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkoXG4gICAgICAgIG5hbWUsIGFzdCwgUGFyc2VkUHJvcGVydHlUeXBlLkFOSU1BVElPTiwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmcoXG4gICAgICB2YWx1ZTogc3RyaW5nLCBpc0hvc3RCaW5kaW5nOiBib29sZWFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQgfHwgJyh1bmtub3duKScpLnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXN0ID0gaXNIb3N0QmluZGluZyA/XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZVNpbXBsZUJpbmRpbmcoXG4gICAgICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykgOlxuICAgICAgICAgIHRoaXMuX2V4cHJQYXJzZXIucGFyc2VCaW5kaW5nKFxuICAgICAgICAgICAgICB2YWx1ZSwgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQsIHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgIGVsZW1lbnRTZWxlY3Rvcjogc3RyaW5nLCBib3VuZFByb3A6IFBhcnNlZFByb3BlcnR5LCBza2lwVmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbWFwUHJvcGVydHlOYW1lOiBib29sZWFuID0gdHJ1ZSk6IEJvdW5kRWxlbWVudFByb3BlcnR5IHtcbiAgICBpZiAoYm91bmRQcm9wLmlzQW5pbWF0aW9uKSB7XG4gICAgICByZXR1cm4gbmV3IEJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgICAgIGJvdW5kUHJvcC5uYW1lLCBCaW5kaW5nVHlwZS5BbmltYXRpb24sIFNlY3VyaXR5Q29udGV4dC5OT05FLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgbnVsbCxcbiAgICAgICAgICBib3VuZFByb3Auc291cmNlU3BhbiwgYm91bmRQcm9wLmtleVNwYW4sIGJvdW5kUHJvcC52YWx1ZVNwYW4pO1xuICAgIH1cblxuICAgIGxldCB1bml0OiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IGJpbmRpbmdUeXBlOiBCaW5kaW5nVHlwZSA9IHVuZGVmaW5lZCE7XG4gICAgbGV0IGJvdW5kUHJvcGVydHlOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgcGFydHMgPSBib3VuZFByb3AubmFtZS5zcGxpdChQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IpO1xuICAgIGxldCBzZWN1cml0eUNvbnRleHRzOiBTZWN1cml0eUNvbnRleHRbXSA9IHVuZGVmaW5lZCE7XG5cbiAgICAvLyBDaGVjayBmb3Igc3BlY2lhbCBjYXNlcyAocHJlZml4IHN0eWxlLCBhdHRyLCBjbGFzcylcbiAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgaWYgKHBhcnRzWzBdID09IEFUVFJJQlVURV9QUkVGSVgpIHtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgICAgIGlmICghc2tpcFZhbGlkYXRpb24pIHtcbiAgICAgICAgICB0aGlzLl92YWxpZGF0ZVByb3BlcnR5T3JBdHRyaWJ1dGVOYW1lKGJvdW5kUHJvcGVydHlOYW1lLCBib3VuZFByb3Auc291cmNlU3BhbiwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgZWxlbWVudFNlbGVjdG9yLCBib3VuZFByb3BlcnR5TmFtZSwgdHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgbnNTZXBhcmF0b3JJZHggPSBib3VuZFByb3BlcnR5TmFtZS5pbmRleE9mKCc6Jyk7XG4gICAgICAgIGlmIChuc1NlcGFyYXRvcklkeCA+IC0xKSB7XG4gICAgICAgICAgY29uc3QgbnMgPSBib3VuZFByb3BlcnR5TmFtZS5zdWJzdHJpbmcoMCwgbnNTZXBhcmF0b3JJZHgpO1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBib3VuZFByb3BlcnR5TmFtZS5zdWJzdHJpbmcobnNTZXBhcmF0b3JJZHggKyAxKTtcbiAgICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IG1lcmdlTnNBbmROYW1lKG5zLCBuYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuQXR0cmlidXRlO1xuICAgICAgfSBlbHNlIGlmIChwYXJ0c1swXSA9PSBDTEFTU19QUkVGSVgpIHtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0c1sxXTtcbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5DbGFzcztcbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IFtTZWN1cml0eUNvbnRleHQuTk9ORV07XG4gICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09IFNUWUxFX1BSRUZJWCkge1xuICAgICAgICB1bml0ID0gcGFydHMubGVuZ3RoID4gMiA/IHBhcnRzWzJdIDogbnVsbDtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0c1sxXTtcbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5TdHlsZTtcbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IFtTZWN1cml0eUNvbnRleHQuU1RZTEVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIG5vdCBhIHNwZWNpYWwgY2FzZSwgdXNlIHRoZSBmdWxsIHByb3BlcnR5IG5hbWVcbiAgICBpZiAoYm91bmRQcm9wZXJ0eU5hbWUgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG1hcHBlZFByb3BOYW1lID0gdGhpcy5fc2NoZW1hUmVnaXN0cnkuZ2V0TWFwcGVkUHJvcE5hbWUoYm91bmRQcm9wLm5hbWUpO1xuICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBtYXBQcm9wZXJ0eU5hbWUgPyBtYXBwZWRQcm9wTmFtZSA6IGJvdW5kUHJvcC5uYW1lO1xuICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnksIGVsZW1lbnRTZWxlY3RvciwgbWFwcGVkUHJvcE5hbWUsIGZhbHNlKTtcbiAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuUHJvcGVydHk7XG4gICAgICBpZiAoIXNraXBWYWxpZGF0aW9uKSB7XG4gICAgICAgIHRoaXMuX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUobWFwcGVkUHJvcE5hbWUsIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUsIGJpbmRpbmdUeXBlLCBzZWN1cml0eUNvbnRleHRzWzBdLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgdW5pdCxcbiAgICAgICAgYm91bmRQcm9wLnNvdXJjZVNwYW4sIGJvdW5kUHJvcC5rZXlTcGFuLCBib3VuZFByb3AudmFsdWVTcGFuKTtcbiAgfVxuXG4gIHBhcnNlRXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYEV2ZW50IG5hbWUgaXMgbWlzc2luZyBpbiBiaW5kaW5nYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxKTtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uRXZlbnQobmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4sIHRhcmdldEV2ZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3BhcnNlUmVndWxhckV2ZW50KFxuICAgICAgICAgIG5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0RXZlbnRzKTtcbiAgICB9XG4gIH1cblxuICBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHNlbGVjdG9yOiBzdHJpbmcsIHByb3BOYW1lOiBzdHJpbmcsIGlzQXR0cmlidXRlOiBib29sZWFuKTpcbiAgICAgIFNlY3VyaXR5Q29udGV4dFtdIHtcbiAgICBjb25zdCBwcm9wID0gdGhpcy5fc2NoZW1hUmVnaXN0cnkuZ2V0TWFwcGVkUHJvcE5hbWUocHJvcE5hbWUpO1xuICAgIHJldHVybiBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBzZWxlY3RvciwgcHJvcCwgaXNBdHRyaWJ1dGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBbmltYXRpb25FdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICBjb25zdCBtYXRjaGVzID0gc3BsaXRBdFBlcmlvZChuYW1lLCBbbmFtZSwgJyddKTtcbiAgICBjb25zdCBldmVudE5hbWUgPSBtYXRjaGVzWzBdO1xuICAgIGNvbnN0IHBoYXNlID0gbWF0Y2hlc1sxXS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChwaGFzZSkge1xuICAgICAgc3dpdGNoIChwaGFzZSkge1xuICAgICAgICBjYXNlICdzdGFydCc6XG4gICAgICAgIGNhc2UgJ2RvbmUnOlxuICAgICAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQWN0aW9uKGV4cHJlc3Npb24sIGhhbmRsZXJTcGFuKTtcbiAgICAgICAgICB0YXJnZXRFdmVudHMucHVzaChuZXcgUGFyc2VkRXZlbnQoXG4gICAgICAgICAgICAgIGV2ZW50TmFtZSwgcGhhc2UsIFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24sIGFzdCwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4pKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVGhlIHByb3ZpZGVkIGFuaW1hdGlvbiBvdXRwdXQgcGhhc2UgdmFsdWUgXCIke3BoYXNlfVwiIGZvciBcIkAke1xuICAgICAgICAgICAgICAgICAgZXZlbnROYW1lfVwiIGlzIG5vdCBzdXBwb3J0ZWQgKHVzZSBzdGFydCBvciBkb25lKWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgVGhlIGFuaW1hdGlvbiB0cmlnZ2VyIG91dHB1dCBldmVudCAoQCR7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZX0pIGlzIG1pc3NpbmcgaXRzIHBoYXNlIHZhbHVlIG5hbWUgKHN0YXJ0IG9yIGRvbmUgYXJlIGN1cnJlbnRseSBzdXBwb3J0ZWQpYCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVJlZ3VsYXJFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgLy8gbG9uZyBmb3JtYXQ6ICd0YXJnZXQ6IGV2ZW50TmFtZSdcbiAgICBjb25zdCBbdGFyZ2V0LCBldmVudE5hbWVdID0gc3BsaXRBdENvbG9uKG5hbWUsIFtudWxsISwgbmFtZV0pO1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQWN0aW9uKGV4cHJlc3Npb24sIGhhbmRsZXJTcGFuKTtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lISwgYXN0LnNvdXJjZSFdKTtcbiAgICB0YXJnZXRFdmVudHMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlZEV2ZW50KGV2ZW50TmFtZSwgdGFyZ2V0LCBQYXJzZWRFdmVudFR5cGUuUmVndWxhciwgYXN0LCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbikpO1xuICAgIC8vIERvbid0IGRldGVjdCBkaXJlY3RpdmVzIGZvciBldmVudCBuYW1lcyBmb3Igbm93LFxuICAgIC8vIHNvIGRvbid0IGFkZCB0aGUgZXZlbnQgbmFtZSB0byB0aGUgbWF0Y2hhYmxlQXR0cnNcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQWN0aW9uKHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSAoc291cmNlU3BhbiAmJiBzb3VyY2VTcGFuLnN0YXJ0IHx8ICcodW5rbm93bicpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgYWJzb2x1dGVPZmZzZXQgPSAoc291cmNlU3BhbiAmJiBzb3VyY2VTcGFuLnN0YXJ0KSA/IHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0IDogMDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSB0aGlzLl9leHByUGFyc2VyLnBhcnNlQWN0aW9uKFxuICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYXN0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICBpZiAoIWFzdCB8fCBhc3QuYXN0IGluc3RhbmNlb2YgRW1wdHlFeHByKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGBFbXB0eSBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWRgLCBzb3VyY2VTcGFuKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhlcnJvcnM6IFBhcnNlckVycm9yW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvci5tZXNzYWdlLCBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICAvLyBNYWtlIHN1cmUgYWxsIHRoZSB1c2VkIHBpcGVzIGFyZSBrbm93biBpbiBgdGhpcy5waXBlc0J5TmFtZWBcbiAgcHJpdmF0ZSBfY2hlY2tQaXBlcyhhc3Q6IEFTVFdpdGhTb3VyY2UsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHZvaWQge1xuICAgIGlmIChhc3QgJiYgdGhpcy5waXBlc0J5TmFtZSkge1xuICAgICAgY29uc3QgY29sbGVjdG9yID0gbmV3IFBpcGVDb2xsZWN0b3IoKTtcbiAgICAgIGFzdC52aXNpdChjb2xsZWN0b3IpO1xuICAgICAgY29sbGVjdG9yLnBpcGVzLmZvckVhY2goKGFzdCwgcGlwZU5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcGlwZU1ldGEgPSB0aGlzLnBpcGVzQnlOYW1lIS5nZXQocGlwZU5hbWUpO1xuICAgICAgICBpZiAoIXBpcGVNZXRhKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGUgcGlwZSAnJHtwaXBlTmFtZX0nIGNvdWxkIG5vdCBiZSBmb3VuZGAsXG4gICAgICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShhc3Quc3Bhbi5zdGFydCksIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFzdC5zcGFuLmVuZCkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl91c2VkUGlwZXMuc2V0KHBpcGVOYW1lLCBwaXBlTWV0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gcHJvcE5hbWUgdGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IC8gYXR0cmlidXRlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuXG4gICAqIEBwYXJhbSBpc0F0dHIgdHJ1ZSB3aGVuIGJpbmRpbmcgdG8gYW4gYXR0cmlidXRlXG4gICAqL1xuICBwcml2YXRlIF92YWxpZGF0ZVByb3BlcnR5T3JBdHRyaWJ1dGVOYW1lKFxuICAgICAgcHJvcE5hbWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBpc0F0dHI6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCByZXBvcnQgPSBpc0F0dHIgPyB0aGlzLl9zY2hlbWFSZWdpc3RyeS52YWxpZGF0ZUF0dHJpYnV0ZShwcm9wTmFtZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LnZhbGlkYXRlUHJvcGVydHkocHJvcE5hbWUpO1xuICAgIGlmIChyZXBvcnQuZXJyb3IpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKHJlcG9ydC5tc2chLCBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGlwZUNvbGxlY3RvciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nUGlwZT4oKTtcbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5waXBlcy5zZXQoYXN0Lm5hbWUsIGFzdCk7XG4gICAgYXN0LmV4cC52aXNpdCh0aGlzKTtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0FuaW1hdGlvbkxhYmVsKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZVswXSA9PSAnQCc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgIHJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksIHNlbGVjdG9yOiBzdHJpbmcsIHByb3BOYW1lOiBzdHJpbmcsXG4gICAgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOiBTZWN1cml0eUNvbnRleHRbXSB7XG4gIGNvbnN0IGN0eHM6IFNlY3VyaXR5Q29udGV4dFtdID0gW107XG4gIENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKS5mb3JFYWNoKChzZWxlY3RvcikgPT4ge1xuICAgIGNvbnN0IGVsZW1lbnROYW1lcyA9IHNlbGVjdG9yLmVsZW1lbnQgPyBbc2VsZWN0b3IuZWxlbWVudF0gOiByZWdpc3RyeS5hbGxLbm93bkVsZW1lbnROYW1lcygpO1xuICAgIGNvbnN0IG5vdEVsZW1lbnROYW1lcyA9XG4gICAgICAgIG5ldyBTZXQoc2VsZWN0b3Iubm90U2VsZWN0b3JzLmZpbHRlcihzZWxlY3RvciA9PiBzZWxlY3Rvci5pc0VsZW1lbnRTZWxlY3RvcigpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKChzZWxlY3RvcikgPT4gc2VsZWN0b3IuZWxlbWVudCkpO1xuICAgIGNvbnN0IHBvc3NpYmxlRWxlbWVudE5hbWVzID1cbiAgICAgICAgZWxlbWVudE5hbWVzLmZpbHRlcihlbGVtZW50TmFtZSA9PiAhbm90RWxlbWVudE5hbWVzLmhhcyhlbGVtZW50TmFtZSkpO1xuXG4gICAgY3R4cy5wdXNoKC4uLnBvc3NpYmxlRWxlbWVudE5hbWVzLm1hcChcbiAgICAgICAgZWxlbWVudE5hbWUgPT4gcmVnaXN0cnkuc2VjdXJpdHlDb250ZXh0KGVsZW1lbnROYW1lLCBwcm9wTmFtZSwgaXNBdHRyaWJ1dGUpKSk7XG4gIH0pO1xuICByZXR1cm4gY3R4cy5sZW5ndGggPT09IDAgPyBbU2VjdXJpdHlDb250ZXh0Lk5PTkVdIDogQXJyYXkuZnJvbShuZXcgU2V0KGN0eHMpKS5zb3J0KCk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSBhIG5ldyBQYXJzZVNvdXJjZVNwYW4gYmFzZWQgb2ZmIGFuIG9yaWdpbmFsIGBzb3VyY2VTcGFuYCBieSB1c2luZ1xuICogYWJzb2x1dGUgb2Zmc2V0cyBmcm9tIHRoZSBzcGVjaWZpZWQgYGFic29sdXRlU3BhbmAuXG4gKlxuICogQHBhcmFtIHNvdXJjZVNwYW4gb3JpZ2luYWwgc291cmNlIHNwYW5cbiAqIEBwYXJhbSBhYnNvbHV0ZVNwYW4gYWJzb2x1dGUgc291cmNlIHNwYW4gdG8gbW92ZSB0b1xuICovXG5mdW5jdGlvbiBtb3ZlUGFyc2VTb3VyY2VTcGFuKFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVTcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW4pOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAvLyBUaGUgZGlmZmVyZW5jZSBvZiB0d28gYWJzb2x1dGUgb2Zmc2V0cyBwcm92aWRlIHRoZSByZWxhdGl2ZSBvZmZzZXRcbiAgY29uc3Qgc3RhcnREaWZmID0gYWJzb2x1dGVTcGFuLnN0YXJ0IC0gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQ7XG4gIGNvbnN0IGVuZERpZmYgPSBhYnNvbHV0ZVNwYW4uZW5kIC0gc291cmNlU3Bhbi5lbmQub2Zmc2V0O1xuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzdGFydERpZmYpLCBzb3VyY2VTcGFuLmVuZC5tb3ZlQnkoZW5kRGlmZikpO1xufVxuIl19