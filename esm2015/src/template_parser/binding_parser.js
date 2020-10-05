/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../core';
import { ASTWithSource, BoundElementProperty, EmptyExpr, ParsedEvent, ParsedProperty, ParsedPropertyType, ParsedVariable, RecursiveAstVisitor, VariableBinding } from '../expression_parser/ast';
import { mergeNsAndName } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { CssSelector } from '../selector';
import { splitAtColon, splitAtPeriod } from '../util';
const PROPERTY_PARTS_SEPARATOR = '.';
const ATTRIBUTE_PREFIX = 'attr';
const CLASS_PREFIX = 'class';
const STYLE_PREFIX = 'style';
const TEMPLATE_ATTR_PREFIX = '*';
const ANIMATE_PROP_PREFIX = 'animate-';
/**
 * Parses bindings in templates and in the directive host area.
 */
export class BindingParser {
    constructor(_exprParser, _interpolationConfig, _schemaRegistry, pipes, errors) {
        this._exprParser = _exprParser;
        this._interpolationConfig = _interpolationConfig;
        this._schemaRegistry = _schemaRegistry;
        this.errors = errors;
        this.pipesByName = null;
        this._usedPipes = new Map();
        // When the `pipes` parameter is `null`, do not check for used pipes
        // This is used in IVY when we might not know the available pipes at compile time
        if (pipes) {
            const pipesByName = new Map();
            pipes.forEach(pipe => pipesByName.set(pipe.name, pipe));
            this.pipesByName = pipesByName;
        }
    }
    get interpolationConfig() {
        return this._interpolationConfig;
    }
    getUsedPipes() {
        return Array.from(this._usedPipes.values());
    }
    createBoundHostProperties(dirMeta, sourceSpan) {
        if (dirMeta.hostProperties) {
            const boundProps = [];
            Object.keys(dirMeta.hostProperties).forEach(propName => {
                const expression = dirMeta.hostProperties[propName];
                if (typeof expression === 'string') {
                    this.parsePropertyBinding(propName, expression, true, sourceSpan, sourceSpan.start.offset, undefined, [], 
                    // Use the `sourceSpan` for  `keySpan`. This isn't really accurate, but neither is the
                    // sourceSpan, as it represents the sourceSpan of the host itself rather than the
                    // source of the host binding (which doesn't exist in the template). Regardless,
                    // neither of these values are used in Ivy but are only here to satisfy the function
                    // signature. This should likely be refactored in the future so that `sourceSpan`
                    // isn't being used inaccurately.
                    boundProps, sourceSpan);
                }
                else {
                    this._reportError(`Value of the host property binding "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
                }
            });
            return boundProps;
        }
        return null;
    }
    createDirectiveHostPropertyAsts(dirMeta, elementSelector, sourceSpan) {
        const boundProps = this.createBoundHostProperties(dirMeta, sourceSpan);
        return boundProps &&
            boundProps.map((prop) => this.createBoundElementProperty(elementSelector, prop));
    }
    createDirectiveHostEventAsts(dirMeta, sourceSpan) {
        if (dirMeta.hostListeners) {
            const targetEvents = [];
            Object.keys(dirMeta.hostListeners).forEach(propName => {
                const expression = dirMeta.hostListeners[propName];
                if (typeof expression === 'string') {
                    // TODO: pass a more accurate handlerSpan for this event.
                    this.parseEvent(propName, expression, sourceSpan, sourceSpan, [], targetEvents);
                }
                else {
                    this._reportError(`Value of the host listener "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
                }
            });
            return targetEvents;
        }
        return null;
    }
    parseInterpolation(value, sourceSpan) {
        const sourceInfo = sourceSpan.start.toString();
        try {
            const ast = this._exprParser.parseInterpolation(value, sourceInfo, sourceSpan.start.offset, this._interpolationConfig);
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, sourceSpan.start.offset);
        }
    }
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
    parseInlineTemplateBinding(tplKey, tplValue, sourceSpan, absoluteValueOffset, targetMatchableAttrs, targetProps, targetVars, isIvyAst) {
        const absoluteKeyOffset = sourceSpan.start.offset + TEMPLATE_ATTR_PREFIX.length;
        const bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset);
        for (const binding of bindings) {
            // sourceSpan is for the entire HTML attribute. bindingSpan is for a particular
            // binding within the microsyntax expression so it's more narrow than sourceSpan.
            const bindingSpan = moveParseSourceSpan(sourceSpan, binding.sourceSpan);
            const key = binding.key.source;
            const keySpan = moveParseSourceSpan(sourceSpan, binding.key.span);
            if (binding instanceof VariableBinding) {
                const value = binding.value ? binding.value.source : '$implicit';
                const valueSpan = binding.value ? moveParseSourceSpan(sourceSpan, binding.value.span) : undefined;
                targetVars.push(new ParsedVariable(key, value, bindingSpan, keySpan, valueSpan));
            }
            else if (binding.value) {
                const srcSpan = isIvyAst ? bindingSpan : sourceSpan;
                const valueSpan = moveParseSourceSpan(sourceSpan, binding.value.ast.sourceSpan);
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
    _parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset) {
        const sourceInfo = sourceSpan.start.toString();
        try {
            const bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo, absoluteKeyOffset, absoluteValueOffset);
            this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
            bindingsResult.templateBindings.forEach((binding) => {
                if (binding.value instanceof ASTWithSource) {
                    this._checkPipes(binding.value, sourceSpan);
                }
            });
            bindingsResult.warnings.forEach((warning) => {
                this._reportError(warning, sourceSpan, ParseErrorLevel.WARNING);
            });
            return bindingsResult.templateBindings;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return [];
        }
    }
    parseLiteralAttr(name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, 
    // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
    // have to change This should be required when VE is removed.
    targetProps, keySpan) {
        if (isAnimationLabel(name)) {
            name = name.substring(1);
            if (value) {
                this._reportError(`Assigning animation triggers via @prop="exp" attributes with an expression is invalid.` +
                    ` Use property bindings (e.g. [@prop]="exp") or use an attribute without a value (e.g. @prop) instead.`, sourceSpan, ParseErrorLevel.ERROR);
            }
            this._parseAnimation(name, value, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps);
        }
        else {
            targetProps.push(new ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, '', absoluteOffset), ParsedPropertyType.LITERAL_ATTR, sourceSpan, keySpan, valueSpan));
        }
    }
    parsePropertyBinding(name, expression, isHost, sourceSpan, absoluteOffset, valueSpan, 
    // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
    // have to change This should be required when VE is removed.
    targetMatchableAttrs, targetProps, keySpan) {
        if (name.length === 0) {
            this._reportError(`Property name is missing in binding`, sourceSpan);
        }
        let isAnimationProp = false;
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
    }
    parsePropertyInterpolation(name, value, sourceSpan, valueSpan, targetMatchableAttrs, 
    // TODO(atscott): keySpan is only optional here so VE template parser implementation does not
    // have to change This should be required when VE is removed.
    targetProps, keySpan) {
        const expr = this.parseInterpolation(value, valueSpan || sourceSpan);
        if (expr) {
            this._parsePropertyAst(name, expr, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
            return true;
        }
        return false;
    }
    _parsePropertyAst(name, ast, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.DEFAULT, sourceSpan, keySpan, valueSpan));
    }
    _parseAnimation(name, expression, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
        if (name.length === 0) {
            this._reportError('Animation trigger is missing', sourceSpan);
        }
        // This will occur when a @trigger is not paired with an expression.
        // For animations it is valid to not have an expression since */void
        // states will be applied by angular when the element is attached/detached
        const ast = this._parseBinding(expression || 'undefined', false, valueSpan || sourceSpan, absoluteOffset);
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.ANIMATION, sourceSpan, keySpan, valueSpan));
    }
    _parseBinding(value, isHostBinding, sourceSpan, absoluteOffset) {
        const sourceInfo = (sourceSpan && sourceSpan.start || '(unknown)').toString();
        try {
            const ast = isHostBinding ?
                this._exprParser.parseSimpleBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig) :
                this._exprParser.parseBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig);
            if (ast)
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
        }
    }
    createBoundElementProperty(elementSelector, boundProp, skipValidation = false, mapPropertyName = true) {
        if (boundProp.isAnimation) {
            return new BoundElementProperty(boundProp.name, 4 /* Animation */, SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
        }
        let unit = null;
        let bindingType = undefined;
        let boundPropertyName = null;
        const parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
        let securityContexts = undefined;
        // Check for special cases (prefix style, attr, class)
        if (parts.length > 1) {
            if (parts[0] == ATTRIBUTE_PREFIX) {
                boundPropertyName = parts.slice(1).join(PROPERTY_PARTS_SEPARATOR);
                if (!skipValidation) {
                    this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
                }
                securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, true);
                const nsSeparatorIdx = boundPropertyName.indexOf(':');
                if (nsSeparatorIdx > -1) {
                    const ns = boundPropertyName.substring(0, nsSeparatorIdx);
                    const name = boundPropertyName.substring(nsSeparatorIdx + 1);
                    boundPropertyName = mergeNsAndName(ns, name);
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
            const mappedPropName = this._schemaRegistry.getMappedPropName(boundProp.name);
            boundPropertyName = mapPropertyName ? mappedPropName : boundProp.name;
            securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, mappedPropName, false);
            bindingType = 0 /* Property */;
            if (!skipValidation) {
                this._validatePropertyOrAttributeName(mappedPropName, boundProp.sourceSpan, false);
            }
        }
        return new BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
    }
    parseEvent(name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents) {
        if (name.length === 0) {
            this._reportError(`Event name is missing in binding`, sourceSpan);
        }
        if (isAnimationLabel(name)) {
            name = name.substr(1);
            this._parseAnimationEvent(name, expression, sourceSpan, handlerSpan, targetEvents);
        }
        else {
            this._parseRegularEvent(name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents);
        }
    }
    calcPossibleSecurityContexts(selector, propName, isAttribute) {
        const prop = this._schemaRegistry.getMappedPropName(propName);
        return calcPossibleSecurityContexts(this._schemaRegistry, selector, prop, isAttribute);
    }
    _parseAnimationEvent(name, expression, sourceSpan, handlerSpan, targetEvents) {
        const matches = splitAtPeriod(name, [name, '']);
        const eventName = matches[0];
        const phase = matches[1].toLowerCase();
        if (phase) {
            switch (phase) {
                case 'start':
                case 'done':
                    const ast = this._parseAction(expression, handlerSpan);
                    targetEvents.push(new ParsedEvent(eventName, phase, 1 /* Animation */, ast, sourceSpan, handlerSpan));
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
    _parseRegularEvent(name, expression, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents) {
        // long format: 'target: eventName'
        const [target, eventName] = splitAtColon(name, [null, name]);
        const ast = this._parseAction(expression, handlerSpan);
        targetMatchableAttrs.push([name, ast.source]);
        targetEvents.push(new ParsedEvent(eventName, target, 0 /* Regular */, ast, sourceSpan, handlerSpan));
        // Don't detect directives for event names for now,
        // so don't add the event name to the matchableAttrs
    }
    _parseAction(value, sourceSpan) {
        const sourceInfo = (sourceSpan && sourceSpan.start || '(unknown').toString();
        const absoluteOffset = (sourceSpan && sourceSpan.start) ? sourceSpan.start.offset : 0;
        try {
            const ast = this._exprParser.parseAction(value, sourceInfo, absoluteOffset, this._interpolationConfig);
            if (ast) {
                this._reportExpressionParserErrors(ast.errors, sourceSpan);
            }
            if (!ast || ast.ast instanceof EmptyExpr) {
                this._reportError(`Empty expressions are not allowed`, sourceSpan);
                return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
            }
            this._checkPipes(ast, sourceSpan);
            return ast;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return this._exprParser.wrapLiteralPrimitive('ERROR', sourceInfo, absoluteOffset);
        }
    }
    _reportError(message, sourceSpan, level = ParseErrorLevel.ERROR) {
        this.errors.push(new ParseError(sourceSpan, message, level));
    }
    _reportExpressionParserErrors(errors, sourceSpan) {
        for (const error of errors) {
            this._reportError(error.message, sourceSpan);
        }
    }
    // Make sure all the used pipes are known in `this.pipesByName`
    _checkPipes(ast, sourceSpan) {
        if (ast && this.pipesByName) {
            const collector = new PipeCollector();
            ast.visit(collector);
            collector.pipes.forEach((ast, pipeName) => {
                const pipeMeta = this.pipesByName.get(pipeName);
                if (!pipeMeta) {
                    this._reportError(`The pipe '${pipeName}' could not be found`, new ParseSourceSpan(sourceSpan.start.moveBy(ast.span.start), sourceSpan.start.moveBy(ast.span.end)));
                }
                else {
                    this._usedPipes.set(pipeName, pipeMeta);
                }
            });
        }
    }
    /**
     * @param propName the name of the property / attribute
     * @param sourceSpan
     * @param isAttr true when binding to an attribute
     */
    _validatePropertyOrAttributeName(propName, sourceSpan, isAttr) {
        const report = isAttr ? this._schemaRegistry.validateAttribute(propName) :
            this._schemaRegistry.validateProperty(propName);
        if (report.error) {
            this._reportError(report.msg, sourceSpan, ParseErrorLevel.ERROR);
        }
    }
}
export class PipeCollector extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.pipes = new Map();
    }
    visitPipe(ast, context) {
        this.pipes.set(ast.name, ast);
        ast.exp.visit(this);
        this.visitAll(ast.args, context);
        return null;
    }
}
function isAnimationLabel(name) {
    return name[0] == '@';
}
export function calcPossibleSecurityContexts(registry, selector, propName, isAttribute) {
    const ctxs = [];
    CssSelector.parse(selector).forEach((selector) => {
        const elementNames = selector.element ? [selector.element] : registry.allKnownElementNames();
        const notElementNames = new Set(selector.notSelectors.filter(selector => selector.isElementSelector())
            .map((selector) => selector.element));
        const possibleElementNames = elementNames.filter(elementName => !notElementNames.has(elementName));
        ctxs.push(...possibleElementNames.map(elementName => registry.securityContext(elementName, propName, isAttribute)));
    });
    return ctxs.length === 0 ? [SecurityContext.NONE] : Array.from(new Set(ctxs)).sort();
}
/**
 * Compute a new ParseSourceSpan based off an original `sourceSpan` by using
 * absolute offsets from the specified `absoluteSpan`.
 *
 * @param sourceSpan original source span
 * @param absoluteSpan absolute source span to move to
 */
function moveParseSourceSpan(sourceSpan, absoluteSpan) {
    // The difference of two absolute offsets provide the relative offset
    const startDiff = absoluteSpan.start - sourceSpan.start.offset;
    const endDiff = absoluteSpan.end - sourceSpan.end.offset;
    return new ParseSourceSpan(sourceSpan.start.moveBy(startDiff), sourceSpan.end.moveBy(endDiff));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDeEMsT0FBTyxFQUFxQixhQUFhLEVBQTRCLG9CQUFvQixFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQW1CLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxjQUFjLEVBQWUsbUJBQW1CLEVBQW1CLGVBQWUsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRzVSLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBaUIsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRTFGLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDeEMsT0FBTyxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFcEQsTUFBTSx3QkFBd0IsR0FBRyxHQUFHLENBQUM7QUFDckMsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUM7QUFDaEMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0FBQzdCLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQztBQUM3QixNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQztBQUNqQyxNQUFNLG1CQUFtQixHQUFHLFVBQVUsQ0FBQztBQUV2Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxhQUFhO0lBS3hCLFlBQ1ksV0FBbUIsRUFBVSxvQkFBeUMsRUFDdEUsZUFBc0MsRUFBRSxLQUFnQyxFQUN6RSxNQUFvQjtRQUZuQixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUFVLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FB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QUFlLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVQaXBlU3VtbWFyeX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0Fic29sdXRlU291cmNlU3BhbiwgQVNUV2l0aFNvdXJjZSwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBCb3VuZEVsZW1lbnRQcm9wZXJ0eSwgRW1wdHlFeHByLCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkUHJvcGVydHlUeXBlLCBQYXJzZWRWYXJpYWJsZSwgUGFyc2VyRXJyb3IsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFRlbXBsYXRlQmluZGluZywgVmFyaWFibGVCaW5kaW5nfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge21lcmdlTnNBbmROYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3Rvcn0gZnJvbSAnLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtzcGxpdEF0Q29sb24sIHNwbGl0QXRQZXJpb2R9IGZyb20gJy4uL3V0aWwnO1xuXG5jb25zdCBQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IgPSAnLic7XG5jb25zdCBBVFRSSUJVVEVfUFJFRklYID0gJ2F0dHInO1xuY29uc3QgQ0xBU1NfUFJFRklYID0gJ2NsYXNzJztcbmNvbnN0IFNUWUxFX1BSRUZJWCA9ICdzdHlsZSc7XG5jb25zdCBURU1QTEFURV9BVFRSX1BSRUZJWCA9ICcqJztcbmNvbnN0IEFOSU1BVEVfUFJPUF9QUkVGSVggPSAnYW5pbWF0ZS0nO1xuXG4vKipcbiAqIFBhcnNlcyBiaW5kaW5ncyBpbiB0ZW1wbGF0ZXMgYW5kIGluIHRoZSBkaXJlY3RpdmUgaG9zdCBhcmVhLlxuICovXG5leHBvcnQgY2xhc3MgQmluZGluZ1BhcnNlciB7XG4gIHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+fG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgX3VzZWRQaXBlczogTWFwPHN0cmluZywgQ29tcGlsZVBpcGVTdW1tYXJ5PiA9IG5ldyBNYXAoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2V4cHJQYXJzZXI6IFBhcnNlciwgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXXxudWxsLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VFcnJvcltdKSB7XG4gICAgLy8gV2hlbiB0aGUgYHBpcGVzYCBwYXJhbWV0ZXIgaXMgYG51bGxgLCBkbyBub3QgY2hlY2sgZm9yIHVzZWQgcGlwZXNcbiAgICAvLyBUaGlzIGlzIHVzZWQgaW4gSVZZIHdoZW4gd2UgbWlnaHQgbm90IGtub3cgdGhlIGF2YWlsYWJsZSBwaXBlcyBhdCBjb21waWxlIHRpbWVcbiAgICBpZiAocGlwZXMpIHtcbiAgICAgIGNvbnN0IHBpcGVzQnlOYW1lOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+ID0gbmV3IE1hcCgpO1xuICAgICAgcGlwZXMuZm9yRWFjaChwaXBlID0+IHBpcGVzQnlOYW1lLnNldChwaXBlLm5hbWUsIHBpcGUpKTtcbiAgICAgIHRoaXMucGlwZXNCeU5hbWUgPSBwaXBlc0J5TmFtZTtcbiAgICB9XG4gIH1cblxuICBnZXQgaW50ZXJwb2xhdGlvbkNvbmZpZygpOiBJbnRlcnBvbGF0aW9uQ29uZmlnIHtcbiAgICByZXR1cm4gdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBDb21waWxlUGlwZVN1bW1hcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5fdXNlZFBpcGVzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRQcm9wZXJ0eVtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzKSB7XG4gICAgICBjb25zdCBib3VuZFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG4gICAgICBPYmplY3Qua2V5cyhkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdFByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIGV4cHJlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgICAgcHJvcE5hbWUsIGV4cHJlc3Npb24sIHRydWUsIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0LCB1bmRlZmluZWQsIFtdLFxuICAgICAgICAgICAgICAvLyBVc2UgdGhlIGBzb3VyY2VTcGFuYCBmb3IgIGBrZXlTcGFuYC4gVGhpcyBpc24ndCByZWFsbHkgYWNjdXJhdGUsIGJ1dCBuZWl0aGVyIGlzIHRoZVxuICAgICAgICAgICAgICAvLyBzb3VyY2VTcGFuLCBhcyBpdCByZXByZXNlbnRzIHRoZSBzb3VyY2VTcGFuIG9mIHRoZSBob3N0IGl0c2VsZiByYXRoZXIgdGhhbiB0aGVcbiAgICAgICAgICAgICAgLy8gc291cmNlIG9mIHRoZSBob3N0IGJpbmRpbmcgKHdoaWNoIGRvZXNuJ3QgZXhpc3QgaW4gdGhlIHRlbXBsYXRlKS4gUmVnYXJkbGVzcyxcbiAgICAgICAgICAgICAgLy8gbmVpdGhlciBvZiB0aGVzZSB2YWx1ZXMgYXJlIHVzZWQgaW4gSXZ5IGJ1dCBhcmUgb25seSBoZXJlIHRvIHNhdGlzZnkgdGhlIGZ1bmN0aW9uXG4gICAgICAgICAgICAgIC8vIHNpZ25hdHVyZS4gVGhpcyBzaG91bGQgbGlrZWx5IGJlIHJlZmFjdG9yZWQgaW4gdGhlIGZ1dHVyZSBzbyB0aGF0IGBzb3VyY2VTcGFuYFxuICAgICAgICAgICAgICAvLyBpc24ndCBiZWluZyB1c2VkIGluYWNjdXJhdGVseS5cbiAgICAgICAgICAgICAgYm91bmRQcm9wcywgc291cmNlU3Bhbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBWYWx1ZSBvZiB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nIFwiJHtcbiAgICAgICAgICAgICAgICAgIHByb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke1xuICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbn1cIiAoJHt0eXBlb2YgZXhwcmVzc2lvbn0pYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGJvdW5kUHJvcHM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhcbiAgICAgIGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBlbGVtZW50U2VsZWN0b3I6IHN0cmluZyxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEJvdW5kRWxlbWVudFByb3BlcnR5W118bnVsbCB7XG4gICAgY29uc3QgYm91bmRQcm9wcyA9IHRoaXMuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJNZXRhLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gYm91bmRQcm9wcyAmJlxuICAgICAgICBib3VuZFByb3BzLm1hcCgocHJvcCkgPT4gdGhpcy5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50U2VsZWN0b3IsIHByb3ApKTtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRFdmVudFtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RMaXN0ZW5lcnMpIHtcbiAgICAgIGNvbnN0IHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdExpc3RlbmVyc1twcm9wTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZXhwcmVzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBUT0RPOiBwYXNzIGEgbW9yZSBhY2N1cmF0ZSBoYW5kbGVyU3BhbiBmb3IgdGhpcyBldmVudC5cbiAgICAgICAgICB0aGlzLnBhcnNlRXZlbnQocHJvcE5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4sIFtdLCB0YXJnZXRFdmVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgbGlzdGVuZXIgXCIke1xuICAgICAgICAgICAgICAgICAgcHJvcE5hbWV9XCIgbmVlZHMgdG8gYmUgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGFuIGV4cHJlc3Npb24gYnV0IGdvdCBcIiR7XG4gICAgICAgICAgICAgICAgICBleHByZXNzaW9ufVwiICgke3R5cGVvZiBleHByZXNzaW9ufSlgLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGFyZ2V0RXZlbnRzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gc291cmNlU3Bhbi5zdGFydC50b1N0cmluZygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykhO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIHRoZSBiaW5kaW5ncyBpbiBhIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24sIGFuZCBjb252ZXJ0cyB0aGVtIHRvXG4gICAqIGBQYXJzZWRQcm9wZXJ0eWAgb3IgYFBhcnNlZFZhcmlhYmxlYC5cbiAgICpcbiAgICogQHBhcmFtIHRwbEtleSB0ZW1wbGF0ZSBiaW5kaW5nIG5hbWVcbiAgICogQHBhcmFtIHRwbFZhbHVlIHRlbXBsYXRlIGJpbmRpbmcgdmFsdWVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gc3BhbiBvZiB0ZW1wbGF0ZSBiaW5kaW5nIHJlbGF0aXZlIHRvIGVudGlyZSB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIHRwbFZhbHVlIHJlbGF0aXZlIHRvIHRoZSBlbnRpcmUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldE1hdGNoYWJsZUF0dHJzIHBvdGVudGlhbCBhdHRyaWJ1dGVzIHRvIG1hdGNoIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0UHJvcHMgdGFyZ2V0IHByb3BlcnR5IGJpbmRpbmdzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gdGFyZ2V0VmFycyB0YXJnZXQgdmFyaWFibGVzIGluIHRoZSB0ZW1wbGF0ZVxuICAgKi9cbiAgcGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICB0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIsXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIHRhcmdldFZhcnM6IFBhcnNlZFZhcmlhYmxlW10sXG4gICAgICBpc0l2eUFzdDogYm9vbGVhbikge1xuICAgIGNvbnN0IGFic29sdXRlS2V5T2Zmc2V0ID0gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBURU1QTEFURV9BVFRSX1BSRUZJWC5sZW5ndGg7XG4gICAgY29uc3QgYmluZGluZ3MgPSB0aGlzLl9wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICAgIHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZVNwYW4sIGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZVZhbHVlT2Zmc2V0KTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgLy8gc291cmNlU3BhbiBpcyBmb3IgdGhlIGVudGlyZSBIVE1MIGF0dHJpYnV0ZS4gYmluZGluZ1NwYW4gaXMgZm9yIGEgcGFydGljdWxhclxuICAgICAgLy8gYmluZGluZyB3aXRoaW4gdGhlIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24gc28gaXQncyBtb3JlIG5hcnJvdyB0aGFuIHNvdXJjZVNwYW4uXG4gICAgICBjb25zdCBiaW5kaW5nU3BhbiA9IG1vdmVQYXJzZVNvdXJjZVNwYW4oc291cmNlU3BhbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIGNvbnN0IGtleSA9IGJpbmRpbmcua2V5LnNvdXJjZTtcbiAgICAgIGNvbnN0IGtleVNwYW4gPSBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcua2V5LnNwYW4pO1xuICAgICAgaWYgKGJpbmRpbmcgaW5zdGFuY2VvZiBWYXJpYWJsZUJpbmRpbmcpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLnZhbHVlID8gYmluZGluZy52YWx1ZS5zb3VyY2UgOiAnJGltcGxpY2l0JztcbiAgICAgICAgY29uc3QgdmFsdWVTcGFuID1cbiAgICAgICAgICAgIGJpbmRpbmcudmFsdWUgPyBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcudmFsdWUuc3BhbikgOiB1bmRlZmluZWQ7XG4gICAgICAgIHRhcmdldFZhcnMucHVzaChuZXcgUGFyc2VkVmFyaWFibGUoa2V5LCB2YWx1ZSwgYmluZGluZ1NwYW4sIGtleVNwYW4sIHZhbHVlU3BhbikpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kaW5nLnZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHNyY1NwYW4gPSBpc0l2eUFzdCA/IGJpbmRpbmdTcGFuIDogc291cmNlU3BhbjtcbiAgICAgICAgY29uc3QgdmFsdWVTcGFuID0gbW92ZVBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLCBiaW5kaW5nLnZhbHVlLmFzdC5zb3VyY2VTcGFuKTtcbiAgICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICAgIGtleSwgYmluZGluZy52YWx1ZSwgc3JjU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChba2V5LCAnJyAvKiB2YWx1ZSAqL10pO1xuICAgICAgICAvLyBTaW5jZSB0aGlzIGlzIGEgbGl0ZXJhbCBhdHRyaWJ1dGUgd2l0aCBubyBSSFMsIHNvdXJjZSBzcGFuIHNob3VsZCBiZVxuICAgICAgICAvLyBqdXN0IHRoZSBrZXkgc3Bhbi5cbiAgICAgICAgdGhpcy5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAga2V5LCBudWxsIC8qIHZhbHVlICovLCBrZXlTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB1bmRlZmluZWQgLyogdmFsdWVTcGFuICovLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzLCBrZXlTcGFuKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIHRoZSBiaW5kaW5ncyBpbiBhIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24sIGUuZy5cbiAgICogYGBgXG4gICAqICAgIDx0YWcgKnRwbEtleT1cImxldCB2YWx1ZTEgPSBwcm9wOyBsZXQgdmFsdWUyID0gbG9jYWxWYXJcIj5cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB0cGxLZXkgdGVtcGxhdGUgYmluZGluZyBuYW1lXG4gICAqIEBwYXJhbSB0cGxWYWx1ZSB0ZW1wbGF0ZSBiaW5kaW5nIHZhbHVlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHNwYW4gb2YgdGVtcGxhdGUgYmluZGluZyByZWxhdGl2ZSB0byBlbnRpcmUgdGhlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZUtleU9mZnNldCBzdGFydCBvZiB0aGUgYHRwbEtleWBcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIGB0cGxWYWx1ZWBcbiAgICovXG4gIHByaXZhdGUgX3BhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRwbEtleTogc3RyaW5nLCB0cGxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGFic29sdXRlS2V5T2Zmc2V0OiBudW1iZXIsXG4gICAgICBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIpOiBUZW1wbGF0ZUJpbmRpbmdbXSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IHNvdXJjZVNwYW4uc3RhcnQudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBiaW5kaW5nc1Jlc3VsdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgICAgIHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZVZhbHVlT2Zmc2V0KTtcbiAgICAgIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYmluZGluZ3NSZXN1bHQuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIGJpbmRpbmdzUmVzdWx0LnRlbXBsYXRlQmluZGluZ3MuZm9yRWFjaCgoYmluZGluZykgPT4ge1xuICAgICAgICBpZiAoYmluZGluZy52YWx1ZSBpbnN0YW5jZW9mIEFTVFdpdGhTb3VyY2UpIHtcbiAgICAgICAgICB0aGlzLl9jaGVja1BpcGVzKGJpbmRpbmcudmFsdWUsIHNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJpbmRpbmdzUmVzdWx0Lndhcm5pbmdzLmZvckVhY2goKHdhcm5pbmcpID0+IHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3Iod2FybmluZywgc291cmNlU3BhbiwgUGFyc2VFcnJvckxldmVsLldBUk5JTkcpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICBuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIGtleVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgYEFzc2lnbmluZyBhbmltYXRpb24gdHJpZ2dlcnMgdmlhIEBwcm9wPVwiZXhwXCIgYXR0cmlidXRlcyB3aXRoIGFuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5gICtcbiAgICAgICAgICAgICAgICBgIFVzZSBwcm9wZXJ0eSBiaW5kaW5ncyAoZS5nLiBbQHByb3BdPVwiZXhwXCIpIG9yIHVzZSBhbiBhdHRyaWJ1dGUgd2l0aG91dCBhIHZhbHVlIChlLmcuIEBwcm9wKSBpbnN0ZWFkLmAsXG4gICAgICAgICAgICBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0LCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSwgJycsIGFic29sdXRlT2Zmc2V0KSxcbiAgICAgICAgICBQYXJzZWRQcm9wZXJ0eVR5cGUuTElURVJBTF9BVFRSLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBpc0hvc3Q6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCBrZXlTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgUHJvcGVydHkgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBsZXQgaXNBbmltYXRpb25Qcm9wID0gZmFsc2U7XG4gICAgaWYgKG5hbWUuc3RhcnRzV2l0aChBTklNQVRFX1BST1BfUFJFRklYKSkge1xuICAgICAgaXNBbmltYXRpb25Qcm9wID0gdHJ1ZTtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZyhBTklNQVRFX1BST1BfUFJFRklYLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChpc0FuaW1hdGlvbkxhYmVsKG5hbWUpKSB7XG4gICAgICBpc0FuaW1hdGlvblByb3AgPSB0cnVlO1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIGlmIChpc0FuaW1hdGlvblByb3ApIHtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgICAgIG5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0LCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCB0aGlzLl9wYXJzZUJpbmRpbmcoZXhwcmVzc2lvbiwgaXNIb3N0LCB2YWx1ZVNwYW4gfHwgc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQpLFxuICAgICAgICAgIHNvdXJjZVNwYW4sIGtleVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgIG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIC8vIFRPRE8oYXRzY290dCk6IGtleVNwYW4gaXMgb25seSBvcHRpb25hbCBoZXJlIHNvIFZFIHRlbXBsYXRlIHBhcnNlciBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuICAgICAgLy8gaGF2ZSB0byBjaGFuZ2UgVGhpcyBzaG91bGQgYmUgcmVxdWlyZWQgd2hlbiBWRSBpcyByZW1vdmVkLlxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIGtleVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBib29sZWFuIHtcbiAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZUludGVycG9sYXRpb24odmFsdWUsIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuKTtcbiAgICBpZiAoZXhwcikge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCBleHByLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgIG5hbWU6IHN0cmluZywgYXN0OiBBU1RXaXRoU291cmNlLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10pIHtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lLCBhc3Quc291cmNlIV0pO1xuICAgIHRhcmdldFByb3BzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZWRQcm9wZXJ0eShuYW1lLCBhc3QsIFBhcnNlZFByb3BlcnR5VHlwZS5ERUZBVUxULCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcignQW5pbWF0aW9uIHRyaWdnZXIgaXMgbWlzc2luZycsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd2lsbCBvY2N1ciB3aGVuIGEgQHRyaWdnZXIgaXMgbm90IHBhaXJlZCB3aXRoIGFuIGV4cHJlc3Npb24uXG4gICAgLy8gRm9yIGFuaW1hdGlvbnMgaXQgaXMgdmFsaWQgdG8gbm90IGhhdmUgYW4gZXhwcmVzc2lvbiBzaW5jZSAqL3ZvaWRcbiAgICAvLyBzdGF0ZXMgd2lsbCBiZSBhcHBsaWVkIGJ5IGFuZ3VsYXIgd2hlbiB0aGUgZWxlbWVudCBpcyBhdHRhY2hlZC9kZXRhY2hlZFxuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZyhcbiAgICAgICAgZXhwcmVzc2lvbiB8fCAndW5kZWZpbmVkJywgZmFsc2UsIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSFdKTtcbiAgICB0YXJnZXRQcm9wcy5wdXNoKG5ldyBQYXJzZWRQcm9wZXJ0eShcbiAgICAgICAgbmFtZSwgYXN0LCBQYXJzZWRQcm9wZXJ0eVR5cGUuQU5JTUFUSU9OLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQmluZGluZyhcbiAgICAgIHZhbHVlOiBzdHJpbmcsIGlzSG9zdEJpbmRpbmc6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gKHNvdXJjZVNwYW4gJiYgc291cmNlU3Bhbi5zdGFydCB8fCAnKHVua25vd24pJykudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSBpc0hvc3RCaW5kaW5nID9cbiAgICAgICAgICB0aGlzLl9leHByUGFyc2VyLnBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKSA6XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGFzdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsIGJvdW5kUHJvcDogUGFyc2VkUHJvcGVydHksIHNraXBWYWxpZGF0aW9uOiBib29sZWFuID0gZmFsc2UsXG4gICAgICBtYXBQcm9wZXJ0eU5hbWU6IGJvb2xlYW4gPSB0cnVlKTogQm91bmRFbGVtZW50UHJvcGVydHkge1xuICAgIGlmIChib3VuZFByb3AuaXNBbmltYXRpb24pIHtcbiAgICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgYm91bmRQcm9wLm5hbWUsIEJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBudWxsLFxuICAgICAgICAgIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBib3VuZFByb3Aua2V5U3BhbiwgYm91bmRQcm9wLnZhbHVlU3Bhbik7XG4gICAgfVxuXG4gICAgbGV0IHVuaXQ6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgYmluZGluZ1R5cGU6IEJpbmRpbmdUeXBlID0gdW5kZWZpbmVkITtcbiAgICBsZXQgYm91bmRQcm9wZXJ0eU5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBjb25zdCBwYXJ0cyA9IGJvdW5kUHJvcC5uYW1lLnNwbGl0KFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgbGV0IHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdID0gdW5kZWZpbmVkITtcblxuICAgIC8vIENoZWNrIGZvciBzcGVjaWFsIGNhc2VzIChwcmVmaXggc3R5bGUsIGF0dHIsIGNsYXNzKVxuICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICBpZiAocGFydHNbMF0gPT0gQVRUUklCVVRFX1BSRUZJWCkge1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oUFJPUEVSVFlfUEFSVFNfU0VQQVJBVE9SKTtcbiAgICAgICAgaWYgKCFza2lwVmFsaWRhdGlvbikge1xuICAgICAgICAgIHRoaXMuX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoYm91bmRQcm9wZXJ0eU5hbWUsIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBlbGVtZW50U2VsZWN0b3IsIGJvdW5kUHJvcGVydHlOYW1lLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBuc1NlcGFyYXRvcklkeCA9IGJvdW5kUHJvcGVydHlOYW1lLmluZGV4T2YoJzonKTtcbiAgICAgICAgaWYgKG5zU2VwYXJhdG9ySWR4ID4gLTEpIHtcbiAgICAgICAgICBjb25zdCBucyA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZygwLCBuc1NlcGFyYXRvcklkeCk7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZyhuc1NlcGFyYXRvcklkeCArIDEpO1xuICAgICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gbWVyZ2VOc0FuZE5hbWUobnMsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09IENMQVNTX1BSRUZJWCkge1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLkNsYXNzO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5OT05FXTtcbiAgICAgIH0gZWxzZSBpZiAocGFydHNbMF0gPT0gU1RZTEVfUFJFRklYKSB7XG4gICAgICAgIHVuaXQgPSBwYXJ0cy5sZW5ndGggPiAyID8gcGFydHNbMl0gOiBudWxsO1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLlN0eWxlO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5TVFlMRV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgbm90IGEgc3BlY2lhbCBjYXNlLCB1c2UgdGhlIGZ1bGwgcHJvcGVydHkgbmFtZVxuICAgIGlmIChib3VuZFByb3BlcnR5TmFtZSA9PT0gbnVsbCkge1xuICAgICAgY29uc3QgbWFwcGVkUHJvcE5hbWUgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShib3VuZFByb3AubmFtZSk7XG4gICAgICBib3VuZFByb3BlcnR5TmFtZSA9IG1hcFByb3BlcnR5TmFtZSA/IG1hcHBlZFByb3BOYW1lIDogYm91bmRQcm9wLm5hbWU7XG4gICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgZWxlbWVudFNlbGVjdG9yLCBtYXBwZWRQcm9wTmFtZSwgZmFsc2UpO1xuICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTtcbiAgICAgIGlmICghc2tpcFZhbGlkYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVQcm9wZXJ0eU9yQXR0cmlidXRlTmFtZShtYXBwZWRQcm9wTmFtZSwgYm91bmRQcm9wLnNvdXJjZVNwYW4sIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSwgYmluZGluZ1R5cGUsIHNlY3VyaXR5Q29udGV4dHNbMF0sIGJvdW5kUHJvcC5leHByZXNzaW9uLCB1bml0LFxuICAgICAgICBib3VuZFByb3Auc291cmNlU3BhbiwgYm91bmRQcm9wLmtleVNwYW4sIGJvdW5kUHJvcC52YWx1ZVNwYW4pO1xuICB9XG5cbiAgcGFyc2VFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgRXZlbnQgbmFtZSBpcyBtaXNzaW5nIGluIGJpbmRpbmdgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEpO1xuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb25FdmVudChuYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbiwgdGFyZ2V0RXZlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VSZWd1bGFyRXZlbnQoXG4gICAgICAgICAgbmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRFdmVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZywgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOlxuICAgICAgU2VjdXJpdHlDb250ZXh0W10ge1xuICAgIGNvbnN0IHByb3AgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShwcm9wTmFtZSk7XG4gICAgcmV0dXJuIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHModGhpcy5fc2NoZW1hUmVnaXN0cnksIHNlbGVjdG9yLCBwcm9wLCBpc0F0dHJpYnV0ZSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFuaW1hdGlvbkV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBzcGxpdEF0UGVyaW9kKG5hbWUsIFtuYW1lLCAnJ10pO1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IG1hdGNoZXNbMF07XG4gICAgY29uc3QgcGhhc2UgPSBtYXRjaGVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHBoYXNlKSB7XG4gICAgICBzd2l0Y2ggKHBoYXNlKSB7XG4gICAgICAgIGNhc2UgJ3N0YXJ0JzpcbiAgICAgICAgY2FzZSAnZG9uZSc6XG4gICAgICAgICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgaGFuZGxlclNwYW4pO1xuICAgICAgICAgIHRhcmdldEV2ZW50cy5wdXNoKG5ldyBQYXJzZWRFdmVudChcbiAgICAgICAgICAgICAgZXZlbnROYW1lLCBwaGFzZSwgUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiwgYXN0LCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGUgcHJvdmlkZWQgYW5pbWF0aW9uIG91dHB1dCBwaGFzZSB2YWx1ZSBcIiR7cGhhc2V9XCIgZm9yIFwiQCR7XG4gICAgICAgICAgICAgICAgICBldmVudE5hbWV9XCIgaXMgbm90IHN1cHBvcnRlZCAodXNlIHN0YXJ0IG9yIGRvbmUpYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBUaGUgYW5pbWF0aW9uIHRyaWdnZXIgb3V0cHV0IGV2ZW50IChAJHtcbiAgICAgICAgICAgICAgZXZlbnROYW1lfSkgaXMgbWlzc2luZyBpdHMgcGhhc2UgdmFsdWUgbmFtZSAoc3RhcnQgb3IgZG9uZSBhcmUgY3VycmVudGx5IHN1cHBvcnRlZClgLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVndWxhckV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaGFuZGxlclNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICAvLyBsb25nIGZvcm1hdDogJ3RhcmdldDogZXZlbnROYW1lJ1xuICAgIGNvbnN0IFt0YXJnZXQsIGV2ZW50TmFtZV0gPSBzcGxpdEF0Q29sb24obmFtZSwgW251bGwhLCBuYW1lXSk7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgaGFuZGxlclNwYW4pO1xuICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW25hbWUhLCBhc3Quc291cmNlIV0pO1xuICAgIHRhcmdldEV2ZW50cy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VkRXZlbnQoZXZlbnROYW1lLCB0YXJnZXQsIFBhcnNlZEV2ZW50VHlwZS5SZWd1bGFyLCBhc3QsIHNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuKSk7XG4gICAgLy8gRG9uJ3QgZGV0ZWN0IGRpcmVjdGl2ZXMgZm9yIGV2ZW50IG5hbWVzIGZvciBub3csXG4gICAgLy8gc28gZG9uJ3QgYWRkIHRoZSBldmVudCBuYW1lIHRvIHRoZSBtYXRjaGFibGVBdHRyc1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBY3Rpb24odmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQgfHwgJyh1bmtub3duJykudG9TdHJpbmcoKTtcbiAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQpID8gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgOiAwO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VBY3Rpb24oXG4gICAgICAgICAgdmFsdWUsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0LCB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGlmICghYXN0IHx8IGFzdC5hc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYEVtcHR5IGV4cHJlc3Npb25zIGFyZSBub3QgYWxsb3dlZGAsIHNvdXJjZVNwYW4pO1xuICAgICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGVycm9yczogUGFyc2VyRXJyb3JbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yLm1lc3NhZ2UsIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSBhbGwgdGhlIHVzZWQgcGlwZXMgYXJlIGtub3duIGluIGB0aGlzLnBpcGVzQnlOYW1lYFxuICBwcml2YXRlIF9jaGVja1BpcGVzKGFzdDogQVNUV2l0aFNvdXJjZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gICAgaWYgKGFzdCAmJiB0aGlzLnBpcGVzQnlOYW1lKSB7XG4gICAgICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgUGlwZUNvbGxlY3RvcigpO1xuICAgICAgYXN0LnZpc2l0KGNvbGxlY3Rvcik7XG4gICAgICBjb2xsZWN0b3IucGlwZXMuZm9yRWFjaCgoYXN0LCBwaXBlTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBwaXBlTWV0YSA9IHRoaXMucGlwZXNCeU5hbWUhLmdldChwaXBlTmFtZSk7XG4gICAgICAgIGlmICghcGlwZU1ldGEpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFRoZSBwaXBlICcke3BpcGVOYW1lfScgY291bGQgbm90IGJlIGZvdW5kYCxcbiAgICAgICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFzdC5zcGFuLnN0YXJ0KSwgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoYXN0LnNwYW4uZW5kKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3VzZWRQaXBlcy5zZXQocGlwZU5hbWUsIHBpcGVNZXRhKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBwcm9wTmFtZSB0aGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgLyBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW5cbiAgICogQHBhcmFtIGlzQXR0ciB0cnVlIHdoZW4gYmluZGluZyB0byBhbiBhdHRyaWJ1dGVcbiAgICovXG4gIHByaXZhdGUgX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoXG4gICAgICBwcm9wTmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGlzQXR0cjogYm9vbGVhbik6IHZvaWQge1xuICAgIGNvbnN0IHJlcG9ydCA9IGlzQXR0ciA/IHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LnZhbGlkYXRlQXR0cmlidXRlKHByb3BOYW1lKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnkudmFsaWRhdGVQcm9wZXJ0eShwcm9wTmFtZSk7XG4gICAgaWYgKHJlcG9ydC5lcnJvcikge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IocmVwb3J0Lm1zZyEsIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQ29sbGVjdG9yIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciB7XG4gIHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdQaXBlPigpO1xuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnBpcGVzLnNldChhc3QubmFtZSwgYXN0KTtcbiAgICBhc3QuZXhwLnZpc2l0KHRoaXMpO1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQW5pbWF0aW9uTGFiZWwobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lWzBdID09ICdAJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgcmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZyxcbiAgICBpc0F0dHJpYnV0ZTogYm9vbGVhbik6IFNlY3VyaXR5Q29udGV4dFtdIHtcbiAgY29uc3QgY3R4czogU2VjdXJpdHlDb250ZXh0W10gPSBbXTtcbiAgQ3NzU2VsZWN0b3IucGFyc2Uoc2VsZWN0b3IpLmZvckVhY2goKHNlbGVjdG9yKSA9PiB7XG4gICAgY29uc3QgZWxlbWVudE5hbWVzID0gc2VsZWN0b3IuZWxlbWVudCA/IFtzZWxlY3Rvci5lbGVtZW50XSA6IHJlZ2lzdHJ5LmFsbEtub3duRWxlbWVudE5hbWVzKCk7XG4gICAgY29uc3Qgbm90RWxlbWVudE5hbWVzID1cbiAgICAgICAgbmV3IFNldChzZWxlY3Rvci5ub3RTZWxlY3RvcnMuZmlsdGVyKHNlbGVjdG9yID0+IHNlbGVjdG9yLmlzRWxlbWVudFNlbGVjdG9yKCkpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKHNlbGVjdG9yKSA9PiBzZWxlY3Rvci5lbGVtZW50KSk7XG4gICAgY29uc3QgcG9zc2libGVFbGVtZW50TmFtZXMgPVxuICAgICAgICBlbGVtZW50TmFtZXMuZmlsdGVyKGVsZW1lbnROYW1lID0+ICFub3RFbGVtZW50TmFtZXMuaGFzKGVsZW1lbnROYW1lKSk7XG5cbiAgICBjdHhzLnB1c2goLi4ucG9zc2libGVFbGVtZW50TmFtZXMubWFwKFxuICAgICAgICBlbGVtZW50TmFtZSA9PiByZWdpc3RyeS5zZWN1cml0eUNvbnRleHQoZWxlbWVudE5hbWUsIHByb3BOYW1lLCBpc0F0dHJpYnV0ZSkpKTtcbiAgfSk7XG4gIHJldHVybiBjdHhzLmxlbmd0aCA9PT0gMCA/IFtTZWN1cml0eUNvbnRleHQuTk9ORV0gOiBBcnJheS5mcm9tKG5ldyBTZXQoY3R4cykpLnNvcnQoKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGEgbmV3IFBhcnNlU291cmNlU3BhbiBiYXNlZCBvZmYgYW4gb3JpZ2luYWwgYHNvdXJjZVNwYW5gIGJ5IHVzaW5nXG4gKiBhYnNvbHV0ZSBvZmZzZXRzIGZyb20gdGhlIHNwZWNpZmllZCBgYWJzb2x1dGVTcGFuYC5cbiAqXG4gKiBAcGFyYW0gc291cmNlU3BhbiBvcmlnaW5hbCBzb3VyY2Ugc3BhblxuICogQHBhcmFtIGFic29sdXRlU3BhbiBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0byBtb3ZlIHRvXG4gKi9cbmZ1bmN0aW9uIG1vdmVQYXJzZVNvdXJjZVNwYW4oXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVNwYW46IEFic29sdXRlU291cmNlU3Bhbik6IFBhcnNlU291cmNlU3BhbiB7XG4gIC8vIFRoZSBkaWZmZXJlbmNlIG9mIHR3byBhYnNvbHV0ZSBvZmZzZXRzIHByb3ZpZGUgdGhlIHJlbGF0aXZlIG9mZnNldFxuICBjb25zdCBzdGFydERpZmYgPSBhYnNvbHV0ZVNwYW4uc3RhcnQgLSBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldDtcbiAgY29uc3QgZW5kRGlmZiA9IGFic29sdXRlU3Bhbi5lbmQgLSBzb3VyY2VTcGFuLmVuZC5vZmZzZXQ7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHN0YXJ0RGlmZiksIHNvdXJjZVNwYW4uZW5kLm1vdmVCeShlbmREaWZmKSk7XG59XG4iXX0=