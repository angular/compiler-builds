/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
            get: function () { return this._interpolationConfig; },
            enumerable: true,
            configurable: true
        });
        BindingParser.prototype.getUsedPipes = function () { return Array.from(this._usedPipes.values()); };
        BindingParser.prototype.createBoundHostProperties = function (dirMeta, sourceSpan) {
            var _this = this;
            if (dirMeta.hostProperties) {
                var boundProps_1 = [];
                Object.keys(dirMeta.hostProperties).forEach(function (propName) {
                    var expression = dirMeta.hostProperties[propName];
                    if (typeof expression === 'string') {
                        _this.parsePropertyBinding(propName, expression, true, sourceSpan, sourceSpan.start.offset, undefined, [], boundProps_1);
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
         * Parses an inline template binding, e.g.
         *    <tag *tplKey="<tplValue>">
         * @param tplKey template binding name
         * @param tplValue template binding value
         * @param sourceSpan span of template binding relative to entire the template
         * @param absoluteValueOffset start of the tplValue relative to the entire template
         * @param targetMatchableAttrs potential attributes to match in the template
         * @param targetProps target property bindings in the template
         * @param targetVars target variables in the template
         */
        BindingParser.prototype.parseInlineTemplateBinding = function (tplKey, tplValue, sourceSpan, absoluteValueOffset, targetMatchableAttrs, targetProps, targetVars) {
            var bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteValueOffset);
            for (var i = 0; i < bindings.length; i++) {
                var binding = bindings[i];
                if (binding.keyIsVar) {
                    targetVars.push(new ast_1.ParsedVariable(binding.key, binding.name, sourceSpan));
                }
                else if (binding.value) {
                    this._parsePropertyAst(binding.key, binding.value, sourceSpan, undefined, targetMatchableAttrs, targetProps);
                }
                else {
                    targetMatchableAttrs.push([binding.key, '']);
                    this.parseLiteralAttr(binding.key, null, sourceSpan, absoluteValueOffset, undefined, targetMatchableAttrs, targetProps);
                }
            }
        };
        /**
         * Parses the bindings in an inline template binding, e.g.
         *    <tag *tplKey="let value1 = prop; let value2 = localVar">
         * @param tplKey template binding name
         * @param tplValue template binding value
         * @param sourceSpan span of template binding relative to entire the template
         * @param absoluteValueOffset start of the tplValue relative to the entire template
         */
        BindingParser.prototype._parseTemplateBindings = function (tplKey, tplValue, sourceSpan, absoluteValueOffset) {
            var _this = this;
            var sourceInfo = sourceSpan.start.toString();
            try {
                var bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo, absoluteValueOffset);
                this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
                bindingsResult.templateBindings.forEach(function (binding) {
                    if (binding.value) {
                        _this._checkPipes(binding.value, sourceSpan);
                    }
                });
                bindingsResult.warnings.forEach(function (warning) { _this._reportError(warning, sourceSpan, parse_util_1.ParseErrorLevel.WARNING); });
                return bindingsResult.templateBindings;
            }
            catch (e) {
                this._reportError("" + e, sourceSpan);
                return [];
            }
        };
        BindingParser.prototype.parseLiteralAttr = function (name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
            if (isAnimationLabel(name)) {
                name = name.substring(1);
                if (value) {
                    this._reportError("Assigning animation triggers via @prop=\"exp\" attributes with an expression is invalid." +
                        " Use property bindings (e.g. [@prop]=\"exp\") or use an attribute without a value (e.g. @prop) instead.", sourceSpan, parse_util_1.ParseErrorLevel.ERROR);
                }
                this._parseAnimation(name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps);
            }
            else {
                targetProps.push(new ast_1.ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, '', absoluteOffset), ast_1.ParsedPropertyType.LITERAL_ATTR, sourceSpan, valueSpan));
            }
        };
        BindingParser.prototype.parsePropertyBinding = function (name, expression, isHost, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
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
                this._parseAnimation(name, expression, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps);
            }
            else {
                this._parsePropertyAst(name, this._parseBinding(expression, isHost, valueSpan || sourceSpan, absoluteOffset), sourceSpan, valueSpan, targetMatchableAttrs, targetProps);
            }
        };
        BindingParser.prototype.parsePropertyInterpolation = function (name, value, sourceSpan, valueSpan, targetMatchableAttrs, targetProps) {
            var expr = this.parseInterpolation(value, valueSpan || sourceSpan);
            if (expr) {
                this._parsePropertyAst(name, expr, sourceSpan, valueSpan, targetMatchableAttrs, targetProps);
                return true;
            }
            return false;
        };
        BindingParser.prototype._parsePropertyAst = function (name, ast, sourceSpan, valueSpan, targetMatchableAttrs, targetProps) {
            targetMatchableAttrs.push([name, ast.source]);
            targetProps.push(new ast_1.ParsedProperty(name, ast, ast_1.ParsedPropertyType.DEFAULT, sourceSpan, valueSpan));
        };
        BindingParser.prototype._parseAnimation = function (name, expression, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
            if (name.length === 0) {
                this._reportError('Animation trigger is missing', sourceSpan);
            }
            // This will occur when a @trigger is not paired with an expression.
            // For animations it is valid to not have an expression since */void
            // states will be applied by angular when the element is attached/detached
            var ast = this._parseBinding(expression || 'undefined', false, valueSpan || sourceSpan, absoluteOffset);
            targetMatchableAttrs.push([name, ast.source]);
            targetProps.push(new ast_1.ParsedProperty(name, ast, ast_1.ParsedPropertyType.ANIMATION, sourceSpan, valueSpan));
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
                return new ast_1.BoundElementProperty(boundProp.name, 4 /* Animation */, core_1.SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan, boundProp.valueSpan);
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
            return new ast_1.BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan, boundProp.valueSpan);
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
            var e_1, _a;
            try {
                for (var errors_1 = tslib_1.__values(errors), errors_1_1 = errors_1.next(); !errors_1_1.done; errors_1_1 = errors_1.next()) {
                    var error = errors_1_1.value;
                    this._reportError(error.message, sourceSpan);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (errors_1_1 && !errors_1_1.done && (_a = errors_1.return)) _a.call(errors_1);
                }
                finally { if (e_1) throw e_1.error; }
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILG1EQUF3QztJQUN4QyxtRUFBdVA7SUFHdlAsNkRBQWlEO0lBQ2pELCtEQUEyRTtJQUUzRSwyREFBd0M7SUFDeEMsbURBQW9EO0lBRXBELElBQU0sd0JBQXdCLEdBQUcsR0FBRyxDQUFDO0lBQ3JDLElBQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDO0lBQ2hDLElBQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQztJQUM3QixJQUFNLFlBQVksR0FBRyxPQUFPLENBQUM7SUFFN0IsSUFBTSxtQkFBbUIsR0FBRyxVQUFVLENBQUM7SUFFdkM7O09BRUc7SUFDSDtRQUtFLHVCQUNZLFdBQW1CLEVBQVUsb0JBQXlDLEVBQ3RFLGVBQXNDLEVBQUUsS0FBZ0MsRUFDekUsTUFBb0I7WUFGbkIsZ0JBQVcsR0FBWCxXQUFXLENBQVE7WUFBVSx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXFCO1lBQ3RFLG9CQUFlLEdBQWYsZUFBZSxDQUF1QjtZQUN2QyxXQUFNLEdBQU4sTUFBTSxDQUFjO1lBUC9CLGdCQUFXLEdBQXlDLElBQUksQ0FBQztZQUVqRCxlQUFVLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7WUFNOUQsb0VBQW9FO1lBQ3BFLGlGQUFpRjtZQUNqRixJQUFJLEtBQUssRUFBRTtnQkFDVCxJQUFNLGFBQVcsR0FBb0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDL0QsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLGFBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFD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LElBQU0sZUFBZSxHQUNqQixJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxVQUFBLFFBQVEsSUFBSSxPQUFBLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxFQUE1QixDQUE0QixDQUFDO2lCQUNqRSxHQUFHLENBQUMsVUFBQyxRQUFRLElBQUssT0FBQSxRQUFRLENBQUMsT0FBTyxFQUFoQixDQUFnQixDQUFDLENBQUMsQ0FBQztZQUN0RCxJQUFNLG9CQUFvQixHQUN0QixZQUFZLENBQUMsTUFBTSxDQUFDLFVBQUEsV0FBVyxJQUFJLE9BQUEsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDLENBQUM7WUFFMUUsSUFBSSxDQUFDLElBQUksT0FBVCxJQUFJLG1CQUFTLG9CQUFvQixDQUFDLEdBQUcsQ0FDakMsVUFBQSxXQUFXLElBQUksT0FBQSxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLEVBQTVELENBQTRELENBQUMsR0FBRTtRQUNwRixDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3ZGLENBQUM7SUFoQkQsb0VBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUGlwZVN1bW1hcnl9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtBU1RXaXRoU291cmNlLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEJvdW5kRWxlbWVudFByb3BlcnR5LCBFbXB0eUV4cHIsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRQcm9wZXJ0eVR5cGUsIFBhcnNlZFZhcmlhYmxlLCBQYXJzZXJFcnJvciwgUmVjdXJzaXZlQXN0VmlzaXRvciwgVGVtcGxhdGVCaW5kaW5nfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge21lcmdlTnNBbmROYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3Rvcn0gZnJvbSAnLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtzcGxpdEF0Q29sb24sIHNwbGl0QXRQZXJpb2R9IGZyb20gJy4uL3V0aWwnO1xuXG5jb25zdCBQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IgPSAnLic7XG5jb25zdCBBVFRSSUJVVEVfUFJFRklYID0gJ2F0dHInO1xuY29uc3QgQ0xBU1NfUFJFRklYID0gJ2NsYXNzJztcbmNvbnN0IFNUWUxFX1BSRUZJWCA9ICdzdHlsZSc7XG5cbmNvbnN0IEFOSU1BVEVfUFJPUF9QUkVGSVggPSAnYW5pbWF0ZS0nO1xuXG4vKipcbiAqIFBhcnNlcyBiaW5kaW5ncyBpbiB0ZW1wbGF0ZXMgYW5kIGluIHRoZSBkaXJlY3RpdmUgaG9zdCBhcmVhLlxuICovXG5leHBvcnQgY2xhc3MgQmluZGluZ1BhcnNlciB7XG4gIHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+fG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgX3VzZWRQaXBlczogTWFwPHN0cmluZywgQ29tcGlsZVBpcGVTdW1tYXJ5PiA9IG5ldyBNYXAoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2V4cHJQYXJzZXI6IFBhcnNlciwgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXXxudWxsLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VFcnJvcltdKSB7XG4gICAgLy8gV2hlbiB0aGUgYHBpcGVzYCBwYXJhbWV0ZXIgaXMgYG51bGxgLCBkbyBub3QgY2hlY2sgZm9yIHVzZWQgcGlwZXNcbiAgICAvLyBUaGlzIGlzIHVzZWQgaW4gSVZZIHdoZW4gd2UgbWlnaHQgbm90IGtub3cgdGhlIGF2YWlsYWJsZSBwaXBlcyBhdCBjb21waWxlIHRpbWVcbiAgICBpZiAocGlwZXMpIHtcbiAgICAgIGNvbnN0IHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+ID0gbmV3IE1hcCgpO1xuICAgICAgcGlwZXMuZm9yRWFjaChwaXBlID0+IHBpcGVzQnlOYW1lLnNldChwaXBlLm5hbWUsIHBpcGUpKTtcbiAgICAgIHRoaXMucGlwZXNCeU5hbWUgPSBwaXBlc0J5TmFtZTtcbiAgICB9XG4gIH1cblxuICBnZXQgaW50ZXJwb2xhdGlvbkNvbmZpZygpOiBJbnRlcnBvbGF0aW9uQ29uZmlnIHsgcmV0dXJuIHRoaXMuX2ludGVycG9sYXRpb25Db25maWc7IH1cblxuICBnZXRVc2VkUGlwZXMoKTogQ29tcGlsZVBpcGVTdW1tYXJ5W10geyByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl91c2VkUGlwZXMudmFsdWVzKCkpOyB9XG5cbiAgY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJNZXRhOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIFBhcnNlZFByb3BlcnR5W118bnVsbCB7XG4gICAgaWYgKGRpck1ldGEuaG9zdFByb3BlcnRpZXMpIHtcbiAgICAgIGNvbnN0IGJvdW5kUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICAgIE9iamVjdC5rZXlzKGRpck1ldGEuaG9zdFByb3BlcnRpZXMpLmZvckVhY2gocHJvcE5hbWUgPT4ge1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gZGlyTWV0YS5ob3N0UHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZXhwcmVzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgICBwcm9wTmFtZSwgZXhwcmVzc2lvbiwgdHJ1ZSwgc291cmNlU3Bhbiwgc291cmNlU3Bhbi5zdGFydC5vZmZzZXQsIHVuZGVmaW5lZCwgW10sXG4gICAgICAgICAgICAgIGJvdW5kUHJvcHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZyBcIiR7cHJvcE5hbWV9XCIgbmVlZHMgdG8gYmUgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGFuIGV4cHJlc3Npb24gYnV0IGdvdCBcIiR7ZXhwcmVzc2lvbn1cIiAoJHt0eXBlb2YgZXhwcmVzc2lvbn0pYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGJvdW5kUHJvcHM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhcbiAgICAgIGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBlbGVtZW50U2VsZWN0b3I6IHN0cmluZyxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEJvdW5kRWxlbWVudFByb3BlcnR5W118bnVsbCB7XG4gICAgY29uc3QgYm91bmRQcm9wcyA9IHRoaXMuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJNZXRhLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gYm91bmRQcm9wcyAmJlxuICAgICAgICBib3VuZFByb3BzLm1hcCgocHJvcCkgPT4gdGhpcy5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50U2VsZWN0b3IsIHByb3ApKTtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRFdmVudFtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RMaXN0ZW5lcnMpIHtcbiAgICAgIGNvbnN0IHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdExpc3RlbmVyc1twcm9wTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZXhwcmVzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBUT0RPOiBwYXNzIGEgbW9yZSBhY2N1cmF0ZSBoYW5kbGVyU3BhbiBmb3IgdGhpcyBldmVudC5cbiAgICAgICAgICB0aGlzLnBhcnNlRXZlbnQocHJvcE5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4sIFtdLCB0YXJnZXRFdmVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgbGlzdGVuZXIgXCIke3Byb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke2V4cHJlc3Npb259XCIgKCR7dHlwZW9mIGV4cHJlc3Npb259KWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0YXJnZXRFdmVudHM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSBzb3VyY2VTcGFuLnN0YXJ0LnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXN0ID0gdGhpcy5fZXhwclBhcnNlci5wYXJzZUludGVycG9sYXRpb24oXG4gICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKSAhO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIGFuIGlubGluZSB0ZW1wbGF0ZSBiaW5kaW5nLCBlLmcuXG4gICAqICAgIDx0YWcgKnRwbEtleT1cIjx0cGxWYWx1ZT5cIj5cbiAgICogQHBhcmFtIHRwbEtleSB0ZW1wbGF0ZSBiaW5kaW5nIG5hbWVcbiAgICogQHBhcmFtIHRwbFZhbHVlIHRlbXBsYXRlIGJpbmRpbmcgdmFsdWVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gc3BhbiBvZiB0ZW1wbGF0ZSBiaW5kaW5nIHJlbGF0aXZlIHRvIGVudGlyZSB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIHRwbFZhbHVlIHJlbGF0aXZlIHRvIHRoZSBlbnRpcmUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldE1hdGNoYWJsZUF0dHJzIHBvdGVudGlhbCBhdHRyaWJ1dGVzIHRvIG1hdGNoIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0UHJvcHMgdGFyZ2V0IHByb3BlcnR5IGJpbmRpbmdzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0VmFycyB0YXJnZXQgdmFyaWFibGVzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKi9cbiAgcGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICB0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIsXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICB0YXJnZXRWYXJzOiBQYXJzZWRWYXJpYWJsZVtdKSB7XG4gICAgY29uc3QgYmluZGluZ3MgPSB0aGlzLl9wYXJzZVRlbXBsYXRlQmluZGluZ3ModHBsS2V5LCB0cGxWYWx1ZSwgc291cmNlU3BhbiwgYWJzb2x1dGVWYWx1ZU9mZnNldCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJpbmRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBiaW5kaW5nID0gYmluZGluZ3NbaV07XG4gICAgICBpZiAoYmluZGluZy5rZXlJc1Zhcikge1xuICAgICAgICB0YXJnZXRWYXJzLnB1c2gobmV3IFBhcnNlZFZhcmlhYmxlKGJpbmRpbmcua2V5LCBiaW5kaW5nLm5hbWUsIHNvdXJjZVNwYW4pKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZGluZy52YWx1ZSkge1xuICAgICAgICB0aGlzLl9wYXJzZVByb3BlcnR5QXN0KFxuICAgICAgICAgICAgYmluZGluZy5rZXksIGJpbmRpbmcudmFsdWUsIHNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW2JpbmRpbmcua2V5LCAnJ10pO1xuICAgICAgICB0aGlzLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBiaW5kaW5nLmtleSwgbnVsbCwgc291cmNlU3BhbiwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIHRoZSBiaW5kaW5ncyBpbiBhbiBpbmxpbmUgdGVtcGxhdGUgYmluZGluZywgZS5nLlxuICAgKiAgICA8dGFnICp0cGxLZXk9XCJsZXQgdmFsdWUxID0gcHJvcDsgbGV0IHZhbHVlMiA9IGxvY2FsVmFyXCI+XG4gICAqIEBwYXJhbSB0cGxLZXkgdGVtcGxhdGUgYmluZGluZyBuYW1lXG4gICAqIEBwYXJhbSB0cGxWYWx1ZSB0ZW1wbGF0ZSBiaW5kaW5nIHZhbHVlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHNwYW4gb2YgdGVtcGxhdGUgYmluZGluZyByZWxhdGl2ZSB0byBlbnRpcmUgdGhlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSB0cGxWYWx1ZSByZWxhdGl2ZSB0byB0aGUgZW50aXJlIHRlbXBsYXRlXG4gICAqL1xuICBwcml2YXRlIF9wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICB0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyKTogVGVtcGxhdGVCaW5kaW5nW10ge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSBzb3VyY2VTcGFuLnN0YXJ0LnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYmluZGluZ3NSZXN1bHQgPVxuICAgICAgICAgIHRoaXMuX2V4cHJQYXJzZXIucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlVmFsdWVPZmZzZXQpO1xuICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhiaW5kaW5nc1Jlc3VsdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nKSA9PiB7XG4gICAgICAgIGlmIChiaW5kaW5nLnZhbHVlKSB7XG4gICAgICAgICAgdGhpcy5fY2hlY2tQaXBlcyhiaW5kaW5nLnZhbHVlLCBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBiaW5kaW5nc1Jlc3VsdC53YXJuaW5ncy5mb3JFYWNoKFxuICAgICAgICAgICh3YXJuaW5nKSA9PiB7IHRoaXMuX3JlcG9ydEVycm9yKHdhcm5pbmcsIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTsgfSk7XG4gICAgICByZXR1cm4gYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICBuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgIGBBc3NpZ25pbmcgYW5pbWF0aW9uIHRyaWdnZXJzIHZpYSBAcHJvcD1cImV4cFwiIGF0dHJpYnV0ZXMgd2l0aCBhbiBleHByZXNzaW9uIGlzIGludmFsaWQuYCArXG4gICAgICAgICAgICAgICAgYCBVc2UgcHJvcGVydHkgYmluZGluZ3MgKGUuZy4gW0Bwcm9wXT1cImV4cFwiKSBvciB1c2UgYW4gYXR0cmlidXRlIHdpdGhvdXQgYSB2YWx1ZSAoZS5nLiBAcHJvcCkgaW5zdGVhZC5gLFxuICAgICAgICAgICAgc291cmNlU3BhbiwgUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRQcm9wcy5wdXNoKG5ldyBQYXJzZWRQcm9wZXJ0eShcbiAgICAgICAgICBuYW1lLCB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKHZhbHVlLCAnJywgYWJzb2x1dGVPZmZzZXQpLFxuICAgICAgICAgIFBhcnNlZFByb3BlcnR5VHlwZS5MSVRFUkFMX0FUVFIsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbikpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIGlzSG9zdDogYm9vbGVhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgYWJzb2x1dGVPZmZzZXQ6IG51bWJlciwgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgUHJvcGVydHkgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBsZXQgaXNBbmltYXRpb25Qcm9wID0gZmFsc2U7XG4gICAgaWYgKG5hbWUuc3RhcnRzV2l0aChBTklNQVRFX1BST1BfUFJFRklYKSkge1xuICAgICAgaXNBbmltYXRpb25Qcm9wID0gdHJ1ZTtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZyhBTklNQVRFX1BST1BfUFJFRklYLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChpc0FuaW1hdGlvbkxhYmVsKG5hbWUpKSB7XG4gICAgICBpc0FuaW1hdGlvblByb3AgPSB0cnVlO1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIGlmIChpc0FuaW1hdGlvblByb3ApIHtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgICAgIG5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0LCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCB0aGlzLl9wYXJzZUJpbmRpbmcoZXhwcmVzc2lvbiwgaXNIb3N0LCB2YWx1ZVNwYW4gfHwgc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQpLFxuICAgICAgICAgIHNvdXJjZVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgIG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlLCB2YWx1ZVNwYW4gfHwgc291cmNlU3Bhbik7XG4gICAgaWYgKGV4cHIpIHtcbiAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QobmFtZSwgZXhwciwgc291cmNlU3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICBuYW1lOiBzdHJpbmcsIGFzdDogQVNUV2l0aFNvdXJjZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSAhXSk7XG4gICAgdGFyZ2V0UHJvcHMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlZFByb3BlcnR5KG5hbWUsIGFzdCwgUGFyc2VkUHJvcGVydHlUeXBlLkRFRkFVTFQsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBbmltYXRpb24oXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZ3xudWxsLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLFxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10pIHtcbiAgICBpZiAobmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKCdBbmltYXRpb24gdHJpZ2dlciBpcyBtaXNzaW5nJywgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgLy8gVGhpcyB3aWxsIG9jY3VyIHdoZW4gYSBAdHJpZ2dlciBpcyBub3QgcGFpcmVkIHdpdGggYW4gZXhwcmVzc2lvbi5cbiAgICAvLyBGb3IgYW5pbWF0aW9ucyBpdCBpcyB2YWxpZCB0byBub3QgaGF2ZSBhbiBleHByZXNzaW9uIHNpbmNlICovdm9pZFxuICAgIC8vIHN0YXRlcyB3aWxsIGJlIGFwcGxpZWQgYnkgYW5ndWxhciB3aGVuIHRoZSBlbGVtZW50IGlzIGF0dGFjaGVkL2RldGFjaGVkXG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nKFxuICAgICAgICBleHByZXNzaW9uIHx8ICd1bmRlZmluZWQnLCBmYWxzZSwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0KTtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lLCBhc3Quc291cmNlICFdKTtcbiAgICB0YXJnZXRQcm9wcy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VkUHJvcGVydHkobmFtZSwgYXN0LCBQYXJzZWRQcm9wZXJ0eVR5cGUuQU5JTUFUSU9OLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQmluZGluZyhcbiAgICAgIHZhbHVlOiBzdHJpbmcsIGlzSG9zdEJpbmRpbmc6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gKHNvdXJjZVNwYW4gJiYgc291cmNlU3Bhbi5zdGFydCB8fCAnKHVua25vd24pJykudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSBpc0hvc3RCaW5kaW5nID9cbiAgICAgICAgICB0aGlzLl9leHByUGFyc2VyLnBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKSA6XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGFzdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsIGJvdW5kUHJvcDogUGFyc2VkUHJvcGVydHksIHNraXBWYWxpZGF0aW9uOiBib29sZWFuID0gZmFsc2UsXG4gICAgICBtYXBQcm9wZXJ0eU5hbWU6IGJvb2xlYW4gPSB0cnVlKTogQm91bmRFbGVtZW50UHJvcGVydHkge1xuICAgIGlmIChib3VuZFByb3AuaXNBbmltYXRpb24pIHtcbiAgICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgYm91bmRQcm9wLm5hbWUsIEJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBudWxsLFxuICAgICAgICAgIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBib3VuZFByb3AudmFsdWVTcGFuKTtcbiAgICB9XG5cbiAgICBsZXQgdW5pdDogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgIGxldCBiaW5kaW5nVHlwZTogQmluZGluZ1R5cGUgPSB1bmRlZmluZWQgITtcbiAgICBsZXQgYm91bmRQcm9wZXJ0eU5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBjb25zdCBwYXJ0cyA9IGJvdW5kUHJvcC5uYW1lLnNwbGl0KFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgbGV0IHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdID0gdW5kZWZpbmVkICE7XG5cbiAgICAvLyBDaGVjayBmb3Igc3BlY2lhbCBjYXNlcyAocHJlZml4IHN0eWxlLCBhdHRyLCBjbGFzcylcbiAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgaWYgKHBhcnRzWzBdID09IEFUVFJJQlVURV9QUkVGSVgpIHtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgICAgIGlmICghc2tpcFZhbGlkYXRpb24pIHtcbiAgICAgICAgICB0aGlzLl92YWxpZGF0ZVByb3BlcnR5T3JBdHRyaWJ1dGVOYW1lKGJvdW5kUHJvcGVydHlOYW1lLCBib3VuZFByb3Auc291cmNlU3BhbiwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgZWxlbWVudFNlbGVjdG9yLCBib3VuZFByb3BlcnR5TmFtZSwgdHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgbnNTZXBhcmF0b3JJZHggPSBib3VuZFByb3BlcnR5TmFtZS5pbmRleE9mKCc6Jyk7XG4gICAgICAgIGlmIChuc1NlcGFyYXRvcklkeCA+IC0xKSB7XG4gICAgICAgICAgY29uc3QgbnMgPSBib3VuZFByb3BlcnR5TmFtZS5zdWJzdHJpbmcoMCwgbnNTZXBhcmF0b3JJZHgpO1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBib3VuZFByb3BlcnR5TmFtZS5zdWJzdHJpbmcobnNTZXBhcmF0b3JJZHggKyAxKTtcbiAgICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IG1lcmdlTnNBbmROYW1lKG5zLCBuYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuQXR0cmlidXRlO1xuICAgICAgfSBlbHNlIGlmIChwYXJ0c1swXSA9PSBDTEFTU19QUkVGSVgpIHtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0c1sxXTtcbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5DbGFzcztcbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IFtTZWN1cml0eUNvbnRleHQuTk9ORV07XG4gICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09IFNUWUxFX1BSRUZJWCkge1xuICAgICAgICB1bml0ID0gcGFydHMubGVuZ3RoID4gMiA/IHBhcnRzWzJdIDogbnVsbDtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0c1sxXTtcbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5TdHlsZTtcbiAgICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IFtTZWN1cml0eUNvbnRleHQuU1RZTEVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIG5vdCBhIHNwZWNpYWwgY2FzZSwgdXNlIHRoZSBmdWxsIHByb3BlcnR5IG5hbWVcbiAgICBpZiAoYm91bmRQcm9wZXJ0eU5hbWUgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IG1hcHBlZFByb3BOYW1lID0gdGhpcy5fc2NoZW1hUmVnaXN0cnkuZ2V0TWFwcGVkUHJvcE5hbWUoYm91bmRQcm9wLm5hbWUpO1xuICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBtYXBQcm9wZXJ0eU5hbWUgPyBtYXBwZWRQcm9wTmFtZSA6IGJvdW5kUHJvcC5uYW1lO1xuICAgICAgc2VjdXJpdHlDb250ZXh0cyA9IGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnksIGVsZW1lbnRTZWxlY3RvciwgbWFwcGVkUHJvcE5hbWUsIGZhbHNlKTtcbiAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuUHJvcGVydHk7XG4gICAgICBpZiAoIXNraXBWYWxpZGF0aW9uKSB7XG4gICAgICAgIHRoaXMuX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUobWFwcGVkUHJvcE5hbWUsIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUsIGJpbmRpbmdUeXBlLCBzZWN1cml0eUNvbnRleHRzWzBdLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgdW5pdCxcbiAgICAgICAgYm91bmRQcm9wLnNvdXJjZVNwYW4sIGJvdW5kUHJvcC52YWx1ZVNwYW4pO1xuICB9XG5cbiAgcGFyc2VFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgRXZlbnQgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEpO1xuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb25FdmVudChuYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbiwgdGFyZ2V0RXZlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VSZWd1bGFyRXZlbnQoXG4gICAgICAgICAgbmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRFdmVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZywgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOlxuICAgICAgU2VjdXJpdHlDb250ZXh0W10ge1xuICAgIGNvbnN0IHByb3AgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShwcm9wTmFtZSk7XG4gICAgcmV0dXJuIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHModGhpcy5fc2NoZW1hUmVnaXN0cnksIHNlbGVjdG9yLCBwcm9wLCBpc0F0dHJpYnV0ZSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFuaW1hdGlvbkV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBzcGxpdEF0UGVyaW9kKG5hbWUsIFtuYW1lLCAnJ10pO1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IG1hdGNoZXNbMF07XG4gICAgY29uc3QgcGhhc2UgPSBtYXRjaGVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHBoYXNlKSB7XG4gICAgICBzd2l0Y2ggKHBoYXNlKSB7XG4gICAgICAgIGNhc2UgJ3N0YXJ0JzpcbiAgICAgICAgY2FzZSAnZG9uZSc6XG4gICAgICAgICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgaGFuZGxlclNwYW4pO1xuICAgICAgICAgIHRhcmdldEV2ZW50cy5wdXNoKG5ldyBQYXJzZWRFdmVudChcbiAgICAgICAgICAgICAgZXZlbnROYW1lLCBwaGFzZSwgUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiwgYXN0LCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGUgcHJvdmlkZWQgYW5pbWF0aW9uIG91dHB1dCBwaGFzZSB2YWx1ZSBcIiR7cGhhc2V9XCIgZm9yIFwiQCR7ZXZlbnROYW1lfVwiIGlzIG5vdCBzdXBwb3J0ZWQgKHVzZSBzdGFydCBvciBkb25lKWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgVGhlIGFuaW1hdGlvbiB0cmlnZ2VyIG91dHB1dCBldmVudCAoQCR7ZXZlbnROYW1lfSkgaXMgbWlzc2luZyBpdHMgcGhhc2UgdmFsdWUgbmFtZSAoc3RhcnQgb3IgZG9uZSBhcmUgY3VycmVudGx5IHN1cHBvcnRlZClgLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVndWxhckV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICAvLyBsb25nIGZvcm1hdDogJ3RhcmdldDogZXZlbnROYW1lJ1xuICAgIGNvbnN0IFt0YXJnZXQsIGV2ZW50TmFtZV0gPSBzcGxpdEF0Q29sb24obmFtZSwgW251bGwgISwgbmFtZV0pO1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQWN0aW9uKGV4cHJlc3Npb24sIGhhbmRsZXJTcGFuKTtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lICEsIGFzdC5zb3VyY2UgIV0pO1xuICAgIHRhcmdldEV2ZW50cy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VkRXZlbnQoZXZlbnROYW1lLCB0YXJnZXQsIFBhcnNlZEV2ZW50VHlwZS5SZWd1bGFyLCBhc3QsIHNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuKSk7XG4gICAgLy8gRG9uJ3QgZGV0ZWN0IGRpcmVjdGl2ZXMgZm9yIGV2ZW50IG5hbWVzIGZvciBub3csXG4gICAgLy8gc28gZG9uJ3QgYWRkIHRoZSBldmVudCBuYW1lIHRvIHRoZSBtYXRjaGFibGVBdHRyc1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBY3Rpb24odmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQgfHwgJyh1bmtub3duJykudG9TdHJpbmcoKTtcbiAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQpID8gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgOiAwO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VBY3Rpb24oXG4gICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGlmICghYXN0IHx8IGFzdC5hc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYEVtcHR5IGV4cHJlc3Npb25zIGFyZSBub3QgYWxsb3dlZGAsIHNvdXJjZVNwYW4pO1xuICAgICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGVycm9yczogUGFyc2VyRXJyb3JbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yLm1lc3NhZ2UsIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSBhbGwgdGhlIHVzZWQgcGlwZXMgYXJlIGtub3duIGluIGB0aGlzLnBpcGVzQnlOYW1lYFxuICBwcml2YXRlIF9jaGVja1BpcGVzKGFzdDogQVNUV2l0aFNvdXJjZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gICAgaWYgKGFzdCAmJiB0aGlzLnBpcGVzQnlOYW1lKSB7XG4gICAgICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgUGlwZUNvbGxlY3RvcigpO1xuICAgICAgYXN0LnZpc2l0KGNvbGxlY3Rvcik7XG4gICAgICBjb2xsZWN0b3IucGlwZXMuZm9yRWFjaCgoYXN0LCBwaXBlTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBwaXBlTWV0YSA9IHRoaXMucGlwZXNCeU5hbWUgIS5nZXQocGlwZU5hbWUpO1xuICAgICAgICBpZiAoIXBpcGVNZXRhKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGUgcGlwZSAnJHtwaXBlTmFtZX0nIGNvdWxkIG5vdCBiZSBmb3VuZGAsXG4gICAgICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShhc3Quc3Bhbi5zdGFydCksIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFzdC5zcGFuLmVuZCkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl91c2VkUGlwZXMuc2V0KHBpcGVOYW1lLCBwaXBlTWV0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gcHJvcE5hbWUgdGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IC8gYXR0cmlidXRlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuXG4gICAqIEBwYXJhbSBpc0F0dHIgdHJ1ZSB3aGVuIGJpbmRpbmcgdG8gYW4gYXR0cmlidXRlXG4gICAqL1xuICBwcml2YXRlIF92YWxpZGF0ZVByb3BlcnR5T3JBdHRyaWJ1dGVOYW1lKFxuICAgICAgcHJvcE5hbWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBpc0F0dHI6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCByZXBvcnQgPSBpc0F0dHIgPyB0aGlzLl9zY2hlbWFSZWdpc3RyeS52YWxpZGF0ZUF0dHJpYnV0ZShwcm9wTmFtZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LnZhbGlkYXRlUHJvcGVydHkocHJvcE5hbWUpO1xuICAgIGlmIChyZXBvcnQuZXJyb3IpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKHJlcG9ydC5tc2cgISwgc291cmNlU3BhbiwgUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVDb2xsZWN0b3IgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ1BpcGU+KCk7XG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucGlwZXMuc2V0KGFzdC5uYW1lLCBhc3QpO1xuICAgIGFzdC5leHAudmlzaXQodGhpcyk7XG4gICAgdGhpcy52aXNpdEFsbChhc3QuYXJncywgY29udGV4dCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBbmltYXRpb25MYWJlbChuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWVbMF0gPT0gJ0AnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICByZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LCBzZWxlY3Rvcjogc3RyaW5nLCBwcm9wTmFtZTogc3RyaW5nLFxuICAgIGlzQXR0cmlidXRlOiBib29sZWFuKTogU2VjdXJpdHlDb250ZXh0W10ge1xuICBjb25zdCBjdHhzOiBTZWN1cml0eUNvbnRleHRbXSA9IFtdO1xuICBDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvcikuZm9yRWFjaCgoc2VsZWN0b3IpID0+IHtcbiAgICBjb25zdCBlbGVtZW50TmFtZXMgPSBzZWxlY3Rvci5lbGVtZW50ID8gW3NlbGVjdG9yLmVsZW1lbnRdIDogcmVnaXN0cnkuYWxsS25vd25FbGVtZW50TmFtZXMoKTtcbiAgICBjb25zdCBub3RFbGVtZW50TmFtZXMgPVxuICAgICAgICBuZXcgU2V0KHNlbGVjdG9yLm5vdFNlbGVjdG9ycy5maWx0ZXIoc2VsZWN0b3IgPT4gc2VsZWN0b3IuaXNFbGVtZW50U2VsZWN0b3IoKSlcbiAgICAgICAgICAgICAgICAgICAgLm1hcCgoc2VsZWN0b3IpID0+IHNlbGVjdG9yLmVsZW1lbnQpKTtcbiAgICBjb25zdCBwb3NzaWJsZUVsZW1lbnROYW1lcyA9XG4gICAgICAgIGVsZW1lbnROYW1lcy5maWx0ZXIoZWxlbWVudE5hbWUgPT4gIW5vdEVsZW1lbnROYW1lcy5oYXMoZWxlbWVudE5hbWUpKTtcblxuICAgIGN0eHMucHVzaCguLi5wb3NzaWJsZUVsZW1lbnROYW1lcy5tYXAoXG4gICAgICAgIGVsZW1lbnROYW1lID0+IHJlZ2lzdHJ5LnNlY3VyaXR5Q29udGV4dChlbGVtZW50TmFtZSwgcHJvcE5hbWUsIGlzQXR0cmlidXRlKSkpO1xuICB9KTtcbiAgcmV0dXJuIGN0eHMubGVuZ3RoID09PSAwID8gW1NlY3VyaXR5Q29udGV4dC5OT05FXSA6IEFycmF5LmZyb20obmV3IFNldChjdHhzKSkuc29ydCgpO1xufVxuIl19