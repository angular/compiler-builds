/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
    get interpolationConfig() { return this._interpolationConfig; }
    getUsedPipes() { return Array.from(this._usedPipes.values()); }
    createBoundHostProperties(dirMeta, sourceSpan) {
        if (dirMeta.hostProperties) {
            const boundProps = [];
            Object.keys(dirMeta.hostProperties).forEach(propName => {
                const expression = dirMeta.hostProperties[propName];
                if (typeof expression === 'string') {
                    this.parsePropertyBinding(propName, expression, true, sourceSpan, sourceSpan.start.offset, undefined, [], boundProps);
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
    parseInlineTemplateBinding(tplKey, tplValue, sourceSpan, absoluteValueOffset, targetMatchableAttrs, targetProps, targetVars) {
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
                const valueSpan = moveParseSourceSpan(sourceSpan, binding.value.ast.sourceSpan);
                this._parsePropertyAst(key, binding.value, sourceSpan, valueSpan, targetMatchableAttrs, targetProps);
            }
            else {
                targetMatchableAttrs.push([key, '']);
                this.parseLiteralAttr(key, null, sourceSpan, absoluteValueOffset, undefined, targetMatchableAttrs, targetProps);
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
            bindingsResult.warnings.forEach((warning) => { this._reportError(warning, sourceSpan, ParseErrorLevel.WARNING); });
            return bindingsResult.templateBindings;
        }
        catch (e) {
            this._reportError(`${e}`, sourceSpan);
            return [];
        }
    }
    parseLiteralAttr(name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
        if (isAnimationLabel(name)) {
            name = name.substring(1);
            if (value) {
                this._reportError(`Assigning animation triggers via @prop="exp" attributes with an expression is invalid.` +
                    ` Use property bindings (e.g. [@prop]="exp") or use an attribute without a value (e.g. @prop) instead.`, sourceSpan, ParseErrorLevel.ERROR);
            }
            this._parseAnimation(name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps);
        }
        else {
            targetProps.push(new ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, '', absoluteOffset), ParsedPropertyType.LITERAL_ATTR, sourceSpan, valueSpan));
        }
    }
    parsePropertyBinding(name, expression, isHost, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
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
            this._parseAnimation(name, expression, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps);
        }
        else {
            this._parsePropertyAst(name, this._parseBinding(expression, isHost, valueSpan || sourceSpan, absoluteOffset), sourceSpan, valueSpan, targetMatchableAttrs, targetProps);
        }
    }
    parsePropertyInterpolation(name, value, sourceSpan, valueSpan, targetMatchableAttrs, targetProps) {
        const expr = this.parseInterpolation(value, valueSpan || sourceSpan);
        if (expr) {
            this._parsePropertyAst(name, expr, sourceSpan, valueSpan, targetMatchableAttrs, targetProps);
            return true;
        }
        return false;
    }
    _parsePropertyAst(name, ast, sourceSpan, valueSpan, targetMatchableAttrs, targetProps) {
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.DEFAULT, sourceSpan, valueSpan));
    }
    _parseAnimation(name, expression, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps) {
        if (name.length === 0) {
            this._reportError('Animation trigger is missing', sourceSpan);
        }
        // This will occur when a @trigger is not paired with an expression.
        // For animations it is valid to not have an expression since */void
        // states will be applied by angular when the element is attached/detached
        const ast = this._parseBinding(expression || 'undefined', false, valueSpan || sourceSpan, absoluteOffset);
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.ANIMATION, sourceSpan, valueSpan));
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
            return new BoundElementProperty(boundProp.name, 4 /* Animation */, SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan, boundProp.valueSpan);
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
        return new BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan, boundProp.valueSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDeEMsT0FBTyxFQUFDLGFBQWEsRUFBZ0Qsb0JBQW9CLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBbUIsY0FBYyxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBZSxtQkFBbUIsRUFBbUIsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFHNVIsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ2pELE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFpQixlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFMUYsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN4QyxPQUFPLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwRCxNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztBQUNyQyxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztBQUNoQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUM7QUFDN0IsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0FBQzdCLE1BQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDO0FBQ2pDLE1BQU0sbUJBQW1CLEdBQUcsVUFBVSxDQUFDO0FBRXZDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFLeEIsWUFDWSxXQUFtQixFQUFVLG9CQUF5QyxFQUN0RSxlQUFzQyxFQUFFLEtBQWdDLEVBQ3pFLE1BQW9CO1FBRm5CLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQVUseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFx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QUNILE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDdkYsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMsbUJBQW1CLENBQ3hCLFVBQTJCLEVBQUUsWUFBZ0M7SUFDL0QscUVBQXFFO0lBQ3JFLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDL0QsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUN6RCxPQUFPLElBQUksZUFBZSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDakcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZVBpcGVTdW1tYXJ5fSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7U2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNUV2l0aFNvdXJjZSwgQWJzb2x1dGVTb3VyY2VTcGFuLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEJvdW5kRWxlbWVudFByb3BlcnR5LCBFbXB0eUV4cHIsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRQcm9wZXJ0eVR5cGUsIFBhcnNlZFZhcmlhYmxlLCBQYXJzZXJFcnJvciwgUmVjdXJzaXZlQXN0VmlzaXRvciwgVGVtcGxhdGVCaW5kaW5nLCBWYXJpYWJsZUJpbmRpbmd9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7bWVyZ2VOc0FuZE5hbWV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi9zZWxlY3Rvcic7XG5pbXBvcnQge3NwbGl0QXRDb2xvbiwgc3BsaXRBdFBlcmlvZH0gZnJvbSAnLi4vdXRpbCc7XG5cbmNvbnN0IFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUiA9ICcuJztcbmNvbnN0IEFUVFJJQlVURV9QUkVGSVggPSAnYXR0cic7XG5jb25zdCBDTEFTU19QUkVGSVggPSAnY2xhc3MnO1xuY29uc3QgU1RZTEVfUFJFRklYID0gJ3N0eWxlJztcbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuY29uc3QgQU5JTUFURV9QUk9QX1BSRUZJWCA9ICdhbmltYXRlLSc7XG5cbi8qKlxuICogUGFyc2VzIGJpbmRpbmdzIGluIHRlbXBsYXRlcyBhbmQgaW4gdGhlIGRpcmVjdGl2ZSBob3N0IGFyZWEuXG4gKi9cbmV4cG9ydCBjbGFzcyBCaW5kaW5nUGFyc2VyIHtcbiAgcGlwZXNCeU5hbWU6IE1hcDxzdHJpbmcsIENvbXBpbGVQaXBlU3VtbWFyeT58bnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBfdXNlZFBpcGVzOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+ID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfZXhwclBhcnNlcjogUGFyc2VyLCBwcml2YXRlIF9pbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcHJpdmF0ZSBfc2NoZW1hUmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdfG51bGwsXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZUVycm9yW10pIHtcbiAgICAvLyBXaGVuIHRoZSBgcGlwZXNgIHBhcmFtZXRlciBpcyBgbnVsbGAsIGRvIG5vdCBjaGVjayBmb3IgdXNlZCBwaXBlc1xuICAgIC8vIFRoaXMgaXMgdXNlZCBpbiBJVlkgd2hlbiB3ZSBtaWdodCBub3Qga25vdyB0aGUgYXZhaWxhYmxlIHBpcGVzIGF0IGNvbXBpbGUgdGltZVxuICAgIGlmIChwaXBlcykge1xuICAgICAgY29uc3QgcGlwZXNCeU5hbWU6IE1hcDxzdHJpbmcsIENvbXBpbGVQaXBlU3VtbWFyeT4gPSBuZXcgTWFwKCk7XG4gICAgICBwaXBlcy5mb3JFYWNoKHBpcGUgPT4gcGlwZXNCeU5hbWUuc2V0KHBpcGUubmFtZSwgcGlwZSkpO1xuICAgICAgdGhpcy5waXBlc0J5TmFtZSA9IHBpcGVzQnlOYW1lO1xuICAgIH1cbiAgfVxuXG4gIGdldCBpbnRlcnBvbGF0aW9uQ29uZmlnKCk6IEludGVycG9sYXRpb25Db25maWcgeyByZXR1cm4gdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZzsgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBDb21waWxlUGlwZVN1bW1hcnlbXSB7IHJldHVybiBBcnJheS5mcm9tKHRoaXMuX3VzZWRQaXBlcy52YWx1ZXMoKSk7IH1cblxuICBjcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgUGFyc2VkUHJvcGVydHlbXXxudWxsIHtcbiAgICBpZiAoZGlyTWV0YS5ob3N0UHJvcGVydGllcykge1xuICAgICAgY29uc3QgYm91bmRQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0UHJvcGVydGllcykuZm9yRWFjaChwcm9wTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgICAgaWYgKHR5cGVvZiBleHByZXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICAgIHByb3BOYW1lLCBleHByZXNzaW9uLCB0cnVlLCBzb3VyY2VTcGFuLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgdW5kZWZpbmVkLCBbXSxcbiAgICAgICAgICAgICAgYm91bmRQcm9wcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBWYWx1ZSBvZiB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nIFwiJHtcbiAgICAgICAgICAgICAgICAgIHByb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke1xuICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbn1cIiAoJHt0eXBlb2YgZXhwcmVzc2lvbn0pYCxcbiAgICAgICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGJvdW5kUHJvcHM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhcbiAgICAgIGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBlbGVtZW50U2VsZWN0b3I6IHN0cmluZyxcbiAgICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEJvdW5kRWxlbWVudFByb3BlcnR5W118bnVsbCB7XG4gICAgY29uc3QgYm91bmRQcm9wcyA9IHRoaXMuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJNZXRhLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gYm91bmRQcm9wcyAmJlxuICAgICAgICBib3VuZFByb3BzLm1hcCgocHJvcCkgPT4gdGhpcy5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50U2VsZWN0b3IsIHByb3ApKTtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyTWV0YTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBQYXJzZWRFdmVudFtdfG51bGwge1xuICAgIGlmIChkaXJNZXRhLmhvc3RMaXN0ZW5lcnMpIHtcbiAgICAgIGNvbnN0IHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKS5mb3JFYWNoKHByb3BOYW1lID0+IHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGRpck1ldGEuaG9zdExpc3RlbmVyc1twcm9wTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZXhwcmVzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBUT0RPOiBwYXNzIGEgbW9yZSBhY2N1cmF0ZSBoYW5kbGVyU3BhbiBmb3IgdGhpcyBldmVudC5cbiAgICAgICAgICB0aGlzLnBhcnNlRXZlbnQocHJvcE5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4sIFtdLCB0YXJnZXRFdmVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVmFsdWUgb2YgdGhlIGhvc3QgbGlzdGVuZXIgXCIke1xuICAgICAgICAgICAgICAgICAgcHJvcE5hbWV9XCIgbmVlZHMgdG8gYmUgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGFuIGV4cHJlc3Npb24gYnV0IGdvdCBcIiR7XG4gICAgICAgICAgICAgICAgICBleHByZXNzaW9ufVwiICgke3R5cGVvZiBleHByZXNzaW9ufSlgLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGFyZ2V0RXZlbnRzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gc291cmNlU3Bhbi5zdGFydC50b1N0cmluZygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykgITtcbiAgICAgIGlmIChhc3QpIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYXN0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyB0aGUgYmluZGluZ3MgaW4gYSBtaWNyb3N5bnRheCBleHByZXNzaW9uLCBhbmQgY29udmVydHMgdGhlbSB0b1xuICAgKiBgUGFyc2VkUHJvcGVydHlgIG9yIGBQYXJzZWRWYXJpYWJsZWAuXG4gICAqXG4gICAqIEBwYXJhbSB0cGxLZXkgdGVtcGxhdGUgYmluZGluZyBuYW1lXG4gICAqIEBwYXJhbSB0cGxWYWx1ZSB0ZW1wbGF0ZSBiaW5kaW5nIHZhbHVlXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIHNwYW4gb2YgdGVtcGxhdGUgYmluZGluZyByZWxhdGl2ZSB0byBlbnRpcmUgdGhlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSB0cGxWYWx1ZSByZWxhdGl2ZSB0byB0aGUgZW50aXJlIHRlbXBsYXRlXG4gICAqIEBwYXJhbSB0YXJnZXRNYXRjaGFibGVBdHRycyBwb3RlbnRpYWwgYXR0cmlidXRlcyB0byBtYXRjaCBpbiB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldFByb3BzIHRhcmdldCBwcm9wZXJ0eSBiaW5kaW5ncyBpbiB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIHRhcmdldFZhcnMgdGFyZ2V0IHZhcmlhYmxlcyBpbiB0aGUgdGVtcGxhdGVcbiAgICovXG4gIHBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgdHBsS2V5OiBzdHJpbmcsIHRwbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgdGFyZ2V0VmFyczogUGFyc2VkVmFyaWFibGVbXSkge1xuICAgIGNvbnN0IGFic29sdXRlS2V5T2Zmc2V0ID0gc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBURU1QTEFURV9BVFRSX1BSRUZJWC5sZW5ndGg7XG4gICAgY29uc3QgYmluZGluZ3MgPSB0aGlzLl9wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICAgIHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZVNwYW4sIGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZVZhbHVlT2Zmc2V0KTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgLy8gc291cmNlU3BhbiBpcyBmb3IgdGhlIGVudGlyZSBIVE1MIGF0dHJpYnV0ZS4gYmluZGluZ1NwYW4gaXMgZm9yIGEgcGFydGljdWxhclxuICAgICAgLy8gYmluZGluZyB3aXRoaW4gdGhlIG1pY3Jvc3ludGF4IGV4cHJlc3Npb24gc28gaXQncyBtb3JlIG5hcnJvdyB0aGFuIHNvdXJjZVNwYW4uXG4gICAgICBjb25zdCBiaW5kaW5nU3BhbiA9IG1vdmVQYXJzZVNvdXJjZVNwYW4oc291cmNlU3BhbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIGNvbnN0IGtleSA9IGJpbmRpbmcua2V5LnNvdXJjZTtcbiAgICAgIGNvbnN0IGtleVNwYW4gPSBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcua2V5LnNwYW4pO1xuICAgICAgaWYgKGJpbmRpbmcgaW5zdGFuY2VvZiBWYXJpYWJsZUJpbmRpbmcpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLnZhbHVlID8gYmluZGluZy52YWx1ZS5zb3VyY2UgOiAnJGltcGxpY2l0JztcbiAgICAgICAgY29uc3QgdmFsdWVTcGFuID1cbiAgICAgICAgICAgIGJpbmRpbmcudmFsdWUgPyBtb3ZlUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4sIGJpbmRpbmcudmFsdWUuc3BhbikgOiB1bmRlZmluZWQ7XG4gICAgICAgIHRhcmdldFZhcnMucHVzaChuZXcgUGFyc2VkVmFyaWFibGUoa2V5LCB2YWx1ZSwgYmluZGluZ1NwYW4sIGtleVNwYW4sIHZhbHVlU3BhbikpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kaW5nLnZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlU3BhbiA9IG1vdmVQYXJzZVNvdXJjZVNwYW4oc291cmNlU3BhbiwgYmluZGluZy52YWx1ZS5hc3Quc291cmNlU3Bhbik7XG4gICAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgICBrZXksIGJpbmRpbmcudmFsdWUsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW2tleSwgJyddKTtcbiAgICAgICAgdGhpcy5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAga2V5LCBudWxsLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB1bmRlZmluZWQsIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgICAgdGFyZ2V0UHJvcHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgdGhlIGJpbmRpbmdzIGluIGEgbWljcm9zeW50YXggZXhwcmVzc2lvbiwgZS5nLlxuICAgKiBgYGBcbiAgICogICAgPHRhZyAqdHBsS2V5PVwibGV0IHZhbHVlMSA9IHByb3A7IGxldCB2YWx1ZTIgPSBsb2NhbFZhclwiPlxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHRwbEtleSB0ZW1wbGF0ZSBiaW5kaW5nIG5hbWVcbiAgICogQHBhcmFtIHRwbFZhbHVlIHRlbXBsYXRlIGJpbmRpbmcgdmFsdWVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gc3BhbiBvZiB0ZW1wbGF0ZSBiaW5kaW5nIHJlbGF0aXZlIHRvIGVudGlyZSB0aGUgdGVtcGxhdGVcbiAgICogQHBhcmFtIGFic29sdXRlS2V5T2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdHBsS2V5YFxuICAgKiBAcGFyYW0gYWJzb2x1dGVWYWx1ZU9mZnNldCBzdGFydCBvZiB0aGUgYHRwbFZhbHVlYFxuICAgKi9cbiAgcHJpdmF0ZSBfcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgdHBsS2V5OiBzdHJpbmcsIHRwbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVLZXlPZmZzZXQ6IG51bWJlcixcbiAgICAgIGFic29sdXRlVmFsdWVPZmZzZXQ6IG51bWJlcik6IFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gc291cmNlU3Bhbi5zdGFydC50b1N0cmluZygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJpbmRpbmdzUmVzdWx0ID0gdGhpcy5fZXhwclBhcnNlci5wYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICAgICAgdHBsS2V5LCB0cGxWYWx1ZSwgc291cmNlSW5mbywgYWJzb2x1dGVLZXlPZmZzZXQsIGFic29sdXRlVmFsdWVPZmZzZXQpO1xuICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhiaW5kaW5nc1Jlc3VsdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nKSA9PiB7XG4gICAgICAgIGlmIChiaW5kaW5nLnZhbHVlIGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkge1xuICAgICAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYmluZGluZy52YWx1ZSwgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYmluZGluZ3NSZXN1bHQud2FybmluZ3MuZm9yRWFjaChcbiAgICAgICAgICAod2FybmluZykgPT4geyB0aGlzLl9yZXBvcnRFcnJvcih3YXJuaW5nLCBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuV0FSTklORyk7IH0pO1xuICAgICAgcmV0dXJuIGJpbmRpbmdzUmVzdWx0LnRlbXBsYXRlQmluZGluZ3M7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIGlmIChpc0FuaW1hdGlvbkxhYmVsKG5hbWUpKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICBgQXNzaWduaW5nIGFuaW1hdGlvbiB0cmlnZ2VycyB2aWEgQHByb3A9XCJleHBcIiBhdHRyaWJ1dGVzIHdpdGggYW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLmAgK1xuICAgICAgICAgICAgICAgIGAgVXNlIHByb3BlcnR5IGJpbmRpbmdzIChlLmcuIFtAcHJvcF09XCJleHBcIikgb3IgdXNlIGFuIGF0dHJpYnV0ZSB3aXRob3V0IGEgdmFsdWUgKGUuZy4gQHByb3ApIGluc3RlYWQuYCxcbiAgICAgICAgICAgIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgICB9XG4gICAgICB0aGlzLl9wYXJzZUFuaW1hdGlvbihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQsIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSwgJycsIGFic29sdXRlT2Zmc2V0KSxcbiAgICAgICAgICBQYXJzZWRQcm9wZXJ0eVR5cGUuTElURVJBTF9BVFRSLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBpc0hvc3Q6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCxcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFByb3BlcnR5IG5hbWUgaXMgbWlzc2luZyBpbiBiaW5kaW5nYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgbGV0IGlzQW5pbWF0aW9uUHJvcCA9IGZhbHNlO1xuICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgoQU5JTUFURV9QUk9QX1BSRUZJWCkpIHtcbiAgICAgIGlzQW5pbWF0aW9uUHJvcCA9IHRydWU7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoQU5JTUFURV9QUk9QX1BSRUZJWC5sZW5ndGgpO1xuICAgIH0gZWxzZSBpZiAoaXNBbmltYXRpb25MYWJlbChuYW1lKSkge1xuICAgICAgaXNBbmltYXRpb25Qcm9wID0gdHJ1ZTtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBbmltYXRpb25Qcm9wKSB7XG4gICAgICB0aGlzLl9wYXJzZUFuaW1hdGlvbihcbiAgICAgICAgICBuYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICB0YXJnZXRQcm9wcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fcGFyc2VCaW5kaW5nKGV4cHJlc3Npb24sIGlzSG9zdCwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sIGFic29sdXRlT2Zmc2V0KSxcbiAgICAgICAgICBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICBuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGV4cHIgPSB0aGlzLnBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZSwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4pO1xuICAgIGlmIChleHByKSB7XG4gICAgICB0aGlzLl9wYXJzZVByb3BlcnR5QXN0KG5hbWUsIGV4cHIsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVByb3BlcnR5QXN0KFxuICAgICAgbmFtZTogc3RyaW5nLCBhc3Q6IEFTVFdpdGhTb3VyY2UsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLnB1c2goW25hbWUsIGFzdC5zb3VyY2UgIV0pO1xuICAgIHRhcmdldFByb3BzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZWRQcm9wZXJ0eShuYW1lLCBhc3QsIFBhcnNlZFByb3BlcnR5VHlwZS5ERUZBVUxULCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQW5pbWF0aW9uKFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmd8bnVsbCwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdKSB7XG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcignQW5pbWF0aW9uIHRyaWdnZXIgaXMgbWlzc2luZycsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd2lsbCBvY2N1ciB3aGVuIGEgQHRyaWdnZXIgaXMgbm90IHBhaXJlZCB3aXRoIGFuIGV4cHJlc3Npb24uXG4gICAgLy8gRm9yIGFuaW1hdGlvbnMgaXQgaXMgdmFsaWQgdG8gbm90IGhhdmUgYW4gZXhwcmVzc2lvbiBzaW5jZSAqL3ZvaWRcbiAgICAvLyBzdGF0ZXMgd2lsbCBiZSBhcHBsaWVkIGJ5IGFuZ3VsYXIgd2hlbiB0aGUgZWxlbWVudCBpcyBhdHRhY2hlZC9kZXRhY2hlZFxuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZyhcbiAgICAgICAgZXhwcmVzc2lvbiB8fCAndW5kZWZpbmVkJywgZmFsc2UsIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCk7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSAhXSk7XG4gICAgdGFyZ2V0UHJvcHMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlZFByb3BlcnR5KG5hbWUsIGFzdCwgUGFyc2VkUHJvcGVydHlUeXBlLkFOSU1BVElPTiwgc291cmNlU3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmcoXG4gICAgICB2YWx1ZTogc3RyaW5nLCBpc0hvc3RCaW5kaW5nOiBib29sZWFuLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IChzb3VyY2VTcGFuICYmIHNvdXJjZVNwYW4uc3RhcnQgfHwgJyh1bmtub3duKScpLnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXN0ID0gaXNIb3N0QmluZGluZyA/XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZVNpbXBsZUJpbmRpbmcoXG4gICAgICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykgOlxuICAgICAgICAgIHRoaXMuX2V4cHJQYXJzZXIucGFyc2VCaW5kaW5nKFxuICAgICAgICAgICAgICB2YWx1ZSwgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQsIHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpO1xuICAgICAgaWYgKGFzdCkgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhhc3QuZXJyb3JzLCBzb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuX2NoZWNrUGlwZXMoYXN0LCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBhc3Q7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiB0aGlzLl9leHByUGFyc2VyLndyYXBMaXRlcmFsUHJpbWl0aXZlKCdFUlJPUicsIHNvdXJjZUluZm8sIGFic29sdXRlT2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgIGVsZW1lbnRTZWxlY3Rvcjogc3RyaW5nLCBib3VuZFByb3A6IFBhcnNlZFByb3BlcnR5LCBza2lwVmFsaWRhdGlvbjogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbWFwUHJvcGVydHlOYW1lOiBib29sZWFuID0gdHJ1ZSk6IEJvdW5kRWxlbWVudFByb3BlcnR5IHtcbiAgICBpZiAoYm91bmRQcm9wLmlzQW5pbWF0aW9uKSB7XG4gICAgICByZXR1cm4gbmV3IEJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgICAgIGJvdW5kUHJvcC5uYW1lLCBCaW5kaW5nVHlwZS5BbmltYXRpb24sIFNlY3VyaXR5Q29udGV4dC5OT05FLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgbnVsbCxcbiAgICAgICAgICBib3VuZFByb3Auc291cmNlU3BhbiwgYm91bmRQcm9wLnZhbHVlU3Bhbik7XG4gICAgfVxuXG4gICAgbGV0IHVuaXQ6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgYmluZGluZ1R5cGU6IEJpbmRpbmdUeXBlID0gdW5kZWZpbmVkICE7XG4gICAgbGV0IGJvdW5kUHJvcGVydHlOYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgY29uc3QgcGFydHMgPSBib3VuZFByb3AubmFtZS5zcGxpdChQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IpO1xuICAgIGxldCBzZWN1cml0eUNvbnRleHRzOiBTZWN1cml0eUNvbnRleHRbXSA9IHVuZGVmaW5lZCAhO1xuXG4gICAgLy8gQ2hlY2sgZm9yIHNwZWNpYWwgY2FzZXMgKHByZWZpeCBzdHlsZSwgYXR0ciwgY2xhc3MpXG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGlmIChwYXJ0c1swXSA9PSBBVFRSSUJVVEVfUFJFRklYKSB7XG4gICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbihQUk9QRVJUWV9QQVJUU19TRVBBUkFUT1IpO1xuICAgICAgICBpZiAoIXNraXBWYWxpZGF0aW9uKSB7XG4gICAgICAgICAgdGhpcy5fdmFsaWRhdGVQcm9wZXJ0eU9yQXR0cmlidXRlTmFtZShib3VuZFByb3BlcnR5TmFtZSwgYm91bmRQcm9wLnNvdXJjZVNwYW4sIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIHNlY3VyaXR5Q29udGV4dHMgPSBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnksIGVsZW1lbnRTZWxlY3RvciwgYm91bmRQcm9wZXJ0eU5hbWUsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IG5zU2VwYXJhdG9ySWR4ID0gYm91bmRQcm9wZXJ0eU5hbWUuaW5kZXhPZignOicpO1xuICAgICAgICBpZiAobnNTZXBhcmF0b3JJZHggPiAtMSkge1xuICAgICAgICAgIGNvbnN0IG5zID0gYm91bmRQcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKDAsIG5zU2VwYXJhdG9ySWR4KTtcbiAgICAgICAgICBjb25zdCBuYW1lID0gYm91bmRQcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKG5zU2VwYXJhdG9ySWR4ICsgMSk7XG4gICAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBtZXJnZU5zQW5kTmFtZShucywgbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTtcbiAgICAgIH0gZWxzZSBpZiAocGFydHNbMF0gPT0gQ0xBU1NfUFJFRklYKSB7XG4gICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gcGFydHNbMV07XG4gICAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuQ2xhc3M7XG4gICAgICAgIHNlY3VyaXR5Q29udGV4dHMgPSBbU2VjdXJpdHlDb250ZXh0Lk5PTkVdO1xuICAgICAgfSBlbHNlIGlmIChwYXJ0c1swXSA9PSBTVFlMRV9QUkVGSVgpIHtcbiAgICAgICAgdW5pdCA9IHBhcnRzLmxlbmd0aCA+IDIgPyBwYXJ0c1syXSA6IG51bGw7XG4gICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gcGFydHNbMV07XG4gICAgICAgIGJpbmRpbmdUeXBlID0gQmluZGluZ1R5cGUuU3R5bGU7XG4gICAgICAgIHNlY3VyaXR5Q29udGV4dHMgPSBbU2VjdXJpdHlDb250ZXh0LlNUWUxFXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBub3QgYSBzcGVjaWFsIGNhc2UsIHVzZSB0aGUgZnVsbCBwcm9wZXJ0eSBuYW1lXG4gICAgaWYgKGJvdW5kUHJvcGVydHlOYW1lID09PSBudWxsKSB7XG4gICAgICBjb25zdCBtYXBwZWRQcm9wTmFtZSA9IHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LmdldE1hcHBlZFByb3BOYW1lKGJvdW5kUHJvcC5uYW1lKTtcbiAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gbWFwUHJvcGVydHlOYW1lID8gbWFwcGVkUHJvcE5hbWUgOiBib3VuZFByb3AubmFtZTtcbiAgICAgIHNlY3VyaXR5Q29udGV4dHMgPSBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBlbGVtZW50U2VsZWN0b3IsIG1hcHBlZFByb3BOYW1lLCBmYWxzZSk7XG4gICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLlByb3BlcnR5O1xuICAgICAgaWYgKCFza2lwVmFsaWRhdGlvbikge1xuICAgICAgICB0aGlzLl92YWxpZGF0ZVByb3BlcnR5T3JBdHRyaWJ1dGVOYW1lKG1hcHBlZFByb3BOYW1lLCBib3VuZFByb3Auc291cmNlU3BhbiwgZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgIGJvdW5kUHJvcGVydHlOYW1lLCBiaW5kaW5nVHlwZSwgc2VjdXJpdHlDb250ZXh0c1swXSwgYm91bmRQcm9wLmV4cHJlc3Npb24sIHVuaXQsXG4gICAgICAgIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBib3VuZFByb3AudmFsdWVTcGFuKTtcbiAgfVxuXG4gIHBhcnNlRXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBoYW5kbGVyU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYEV2ZW50IG5hbWUgaXMgbWlzc2luZyBpbiBiaW5kaW5nYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxKTtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uRXZlbnQobmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4sIHRhcmdldEV2ZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3BhcnNlUmVndWxhckV2ZW50KFxuICAgICAgICAgIG5hbWUsIGV4cHJlc3Npb24sIHNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0RXZlbnRzKTtcbiAgICB9XG4gIH1cblxuICBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHNlbGVjdG9yOiBzdHJpbmcsIHByb3BOYW1lOiBzdHJpbmcsIGlzQXR0cmlidXRlOiBib29sZWFuKTpcbiAgICAgIFNlY3VyaXR5Q29udGV4dFtdIHtcbiAgICBjb25zdCBwcm9wID0gdGhpcy5fc2NoZW1hUmVnaXN0cnkuZ2V0TWFwcGVkUHJvcE5hbWUocHJvcE5hbWUpO1xuICAgIHJldHVybiBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBzZWxlY3RvciwgcHJvcCwgaXNBdHRyaWJ1dGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBbmltYXRpb25FdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICBjb25zdCBtYXRjaGVzID0gc3BsaXRBdFBlcmlvZChuYW1lLCBbbmFtZSwgJyddKTtcbiAgICBjb25zdCBldmVudE5hbWUgPSBtYXRjaGVzWzBdO1xuICAgIGNvbnN0IHBoYXNlID0gbWF0Y2hlc1sxXS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChwaGFzZSkge1xuICAgICAgc3dpdGNoIChwaGFzZSkge1xuICAgICAgICBjYXNlICdzdGFydCc6XG4gICAgICAgIGNhc2UgJ2RvbmUnOlxuICAgICAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQWN0aW9uKGV4cHJlc3Npb24sIGhhbmRsZXJTcGFuKTtcbiAgICAgICAgICB0YXJnZXRFdmVudHMucHVzaChuZXcgUGFyc2VkRXZlbnQoXG4gICAgICAgICAgICAgIGV2ZW50TmFtZSwgcGhhc2UsIFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24sIGFzdCwgc291cmNlU3BhbiwgaGFuZGxlclNwYW4pKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVGhlIHByb3ZpZGVkIGFuaW1hdGlvbiBvdXRwdXQgcGhhc2UgdmFsdWUgXCIke3BoYXNlfVwiIGZvciBcIkAke1xuICAgICAgICAgICAgICAgICAgZXZlbnROYW1lfVwiIGlzIG5vdCBzdXBwb3J0ZWQgKHVzZSBzdGFydCBvciBkb25lKWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgVGhlIGFuaW1hdGlvbiB0cmlnZ2VyIG91dHB1dCBldmVudCAoQCR7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZX0pIGlzIG1pc3NpbmcgaXRzIHBoYXNlIHZhbHVlIG5hbWUgKHN0YXJ0IG9yIGRvbmUgYXJlIGN1cnJlbnRseSBzdXBwb3J0ZWQpYCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVJlZ3VsYXJFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGhhbmRsZXJTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgLy8gbG9uZyBmb3JtYXQ6ICd0YXJnZXQ6IGV2ZW50TmFtZSdcbiAgICBjb25zdCBbdGFyZ2V0LCBldmVudE5hbWVdID0gc3BsaXRBdENvbG9uKG5hbWUsIFtudWxsICEsIG5hbWVdKTtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUFjdGlvbihleHByZXNzaW9uLCBoYW5kbGVyU3Bhbik7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSAhLCBhc3Quc291cmNlICFdKTtcbiAgICB0YXJnZXRFdmVudHMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlZEV2ZW50KGV2ZW50TmFtZSwgdGFyZ2V0LCBQYXJzZWRFdmVudFR5cGUuUmVndWxhciwgYXN0LCBzb3VyY2VTcGFuLCBoYW5kbGVyU3BhbikpO1xuICAgIC8vIERvbid0IGRldGVjdCBkaXJlY3RpdmVzIGZvciBldmVudCBuYW1lcyBmb3Igbm93LFxuICAgIC8vIHNvIGRvbid0IGFkZCB0aGUgZXZlbnQgbmFtZSB0byB0aGUgbWF0Y2hhYmxlQXR0cnNcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQWN0aW9uKHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSAoc291cmNlU3BhbiAmJiBzb3VyY2VTcGFuLnN0YXJ0IHx8ICcodW5rbm93bicpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgYWJzb2x1dGVPZmZzZXQgPSAoc291cmNlU3BhbiAmJiBzb3VyY2VTcGFuLnN0YXJ0KSA/IHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0IDogMDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBhc3QgPSB0aGlzLl9leHByUGFyc2VyLnBhcnNlQWN0aW9uKFxuICAgICAgICAgIHZhbHVlLCBzb3VyY2VJbmZvLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYXN0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICBpZiAoIWFzdCB8fCBhc3QuYXN0IGluc3RhbmNlb2YgRW1wdHlFeHByKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGBFbXB0eSBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWRgLCBzb3VyY2VTcGFuKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbywgYWJzb2x1dGVPZmZzZXQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhlcnJvcnM6IFBhcnNlckVycm9yW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvci5tZXNzYWdlLCBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICAvLyBNYWtlIHN1cmUgYWxsIHRoZSB1c2VkIHBpcGVzIGFyZSBrbm93biBpbiBgdGhpcy5waXBlc0J5TmFtZWBcbiAgcHJpdmF0ZSBfY2hlY2tQaXBlcyhhc3Q6IEFTVFdpdGhTb3VyY2UsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHZvaWQge1xuICAgIGlmIChhc3QgJiYgdGhpcy5waXBlc0J5TmFtZSkge1xuICAgICAgY29uc3QgY29sbGVjdG9yID0gbmV3IFBpcGVDb2xsZWN0b3IoKTtcbiAgICAgIGFzdC52aXNpdChjb2xsZWN0b3IpO1xuICAgICAgY29sbGVjdG9yLnBpcGVzLmZvckVhY2goKGFzdCwgcGlwZU5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcGlwZU1ldGEgPSB0aGlzLnBpcGVzQnlOYW1lICEuZ2V0KHBpcGVOYW1lKTtcbiAgICAgICAgaWYgKCFwaXBlTWV0YSkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVGhlIHBpcGUgJyR7cGlwZU5hbWV9JyBjb3VsZCBub3QgYmUgZm91bmRgLFxuICAgICAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgICAgICAgICAgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoYXN0LnNwYW4uc3RhcnQpLCBzb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShhc3Quc3Bhbi5lbmQpKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fdXNlZFBpcGVzLnNldChwaXBlTmFtZSwgcGlwZU1ldGEpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHByb3BOYW1lIHRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSAvIGF0dHJpYnV0ZVxuICAgKiBAcGFyYW0gc291cmNlU3BhblxuICAgKiBAcGFyYW0gaXNBdHRyIHRydWUgd2hlbiBiaW5kaW5nIHRvIGFuIGF0dHJpYnV0ZVxuICAgKi9cbiAgcHJpdmF0ZSBfdmFsaWRhdGVQcm9wZXJ0eU9yQXR0cmlidXRlTmFtZShcbiAgICAgIHByb3BOYW1lOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaXNBdHRyOiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgcmVwb3J0ID0gaXNBdHRyID8gdGhpcy5fc2NoZW1hUmVnaXN0cnkudmFsaWRhdGVBdHRyaWJ1dGUocHJvcE5hbWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeS52YWxpZGF0ZVByb3BlcnR5KHByb3BOYW1lKTtcbiAgICBpZiAocmVwb3J0LmVycm9yKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihyZXBvcnQubXNnICEsIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQ29sbGVjdG9yIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciB7XG4gIHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdQaXBlPigpO1xuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnBpcGVzLnNldChhc3QubmFtZSwgYXN0KTtcbiAgICBhc3QuZXhwLnZpc2l0KHRoaXMpO1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIGNvbnRleHQpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQW5pbWF0aW9uTGFiZWwobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lWzBdID09ICdAJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoXG4gICAgcmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgc2VsZWN0b3I6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZyxcbiAgICBpc0F0dHJpYnV0ZTogYm9vbGVhbik6IFNlY3VyaXR5Q29udGV4dFtdIHtcbiAgY29uc3QgY3R4czogU2VjdXJpdHlDb250ZXh0W10gPSBbXTtcbiAgQ3NzU2VsZWN0b3IucGFyc2Uoc2VsZWN0b3IpLmZvckVhY2goKHNlbGVjdG9yKSA9PiB7XG4gICAgY29uc3QgZWxlbWVudE5hbWVzID0gc2VsZWN0b3IuZWxlbWVudCA/IFtzZWxlY3Rvci5lbGVtZW50XSA6IHJlZ2lzdHJ5LmFsbEtub3duRWxlbWVudE5hbWVzKCk7XG4gICAgY29uc3Qgbm90RWxlbWVudE5hbWVzID1cbiAgICAgICAgbmV3IFNldChzZWxlY3Rvci5ub3RTZWxlY3RvcnMuZmlsdGVyKHNlbGVjdG9yID0+IHNlbGVjdG9yLmlzRWxlbWVudFNlbGVjdG9yKCkpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKHNlbGVjdG9yKSA9PiBzZWxlY3Rvci5lbGVtZW50KSk7XG4gICAgY29uc3QgcG9zc2libGVFbGVtZW50TmFtZXMgPVxuICAgICAgICBlbGVtZW50TmFtZXMuZmlsdGVyKGVsZW1lbnROYW1lID0+ICFub3RFbGVtZW50TmFtZXMuaGFzKGVsZW1lbnROYW1lKSk7XG5cbiAgICBjdHhzLnB1c2goLi4ucG9zc2libGVFbGVtZW50TmFtZXMubWFwKFxuICAgICAgICBlbGVtZW50TmFtZSA9PiByZWdpc3RyeS5zZWN1cml0eUNvbnRleHQoZWxlbWVudE5hbWUsIHByb3BOYW1lLCBpc0F0dHJpYnV0ZSkpKTtcbiAgfSk7XG4gIHJldHVybiBjdHhzLmxlbmd0aCA9PT0gMCA/IFtTZWN1cml0eUNvbnRleHQuTk9ORV0gOiBBcnJheS5mcm9tKG5ldyBTZXQoY3R4cykpLnNvcnQoKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGEgbmV3IFBhcnNlU291cmNlU3BhbiBiYXNlZCBvZmYgYW4gb3JpZ2luYWwgYHNvdXJjZVNwYW5gIGJ5IHVzaW5nXG4gKiBhYnNvbHV0ZSBvZmZzZXRzIGZyb20gdGhlIHNwZWNpZmllZCBgYWJzb2x1dGVTcGFuYC5cbiAqXG4gKiBAcGFyYW0gc291cmNlU3BhbiBvcmlnaW5hbCBzb3VyY2Ugc3BhblxuICogQHBhcmFtIGFic29sdXRlU3BhbiBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0byBtb3ZlIHRvXG4gKi9cbmZ1bmN0aW9uIG1vdmVQYXJzZVNvdXJjZVNwYW4oXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhYnNvbHV0ZVNwYW46IEFic29sdXRlU291cmNlU3Bhbik6IFBhcnNlU291cmNlU3BhbiB7XG4gIC8vIFRoZSBkaWZmZXJlbmNlIG9mIHR3byBhYnNvbHV0ZSBvZmZzZXRzIHByb3ZpZGUgdGhlIHJlbGF0aXZlIG9mZnNldFxuICBjb25zdCBzdGFydERpZmYgPSBhYnNvbHV0ZVNwYW4uc3RhcnQgLSBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldDtcbiAgY29uc3QgZW5kRGlmZiA9IGFic29sdXRlU3Bhbi5lbmQgLSBzb3VyY2VTcGFuLmVuZC5vZmZzZXQ7XG4gIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHN0YXJ0RGlmZiksIHNvdXJjZVNwYW4uZW5kLm1vdmVCeShlbmREaWZmKSk7XG59XG4iXX0=