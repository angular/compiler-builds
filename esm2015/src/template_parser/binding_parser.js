/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../core';
import { BoundElementProperty, EmptyExpr, ParsedEvent, ParsedProperty, ParsedPropertyType, ParsedVariable, RecursiveAstVisitor } from '../expression_parser/ast';
import { mergeNsAndName } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { CssSelector } from '../selector';
import { splitAtColon, splitAtPeriod } from '../util';
const PROPERTY_PARTS_SEPARATOR = '.';
const ATTRIBUTE_PREFIX = 'attr';
const CLASS_PREFIX = 'class';
const STYLE_PREFIX = 'style';
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
    getUsedPipes() { return Array.from(this._usedPipes.values()); }
    createBoundHostProperties(dirMeta, sourceSpan) {
        if (dirMeta.hostProperties) {
            const boundProps = [];
            Object.keys(dirMeta.hostProperties).forEach(propName => {
                const expression = dirMeta.hostProperties[propName];
                if (typeof expression === 'string') {
                    this.parsePropertyBinding(propName, expression, true, sourceSpan, [], boundProps);
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
                    this.parseEvent(propName, expression, sourceSpan, [], targetEvents);
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
            const ast = this._exprParser.parseInterpolation(value, sourceInfo, this._interpolationConfig);
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
    // Parse an inline template binding. ie `<tag *tplKey="<tplValue>">`
    parseInlineTemplateBinding(tplKey, tplValue, sourceSpan, targetMatchableAttrs, targetProps, targetVars) {
        const bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan);
        for (let i = 0; i < bindings.length; i++) {
            const binding = bindings[i];
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
    }
    _parseTemplateBindings(tplKey, tplValue, sourceSpan) {
        const sourceInfo = sourceSpan.start.toString();
        try {
            const bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo);
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
    parseLiteralAttr(name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        if (isAnimationLabel(name)) {
            name = name.substring(1);
            if (value) {
                this._reportError(`Assigning animation triggers via @prop="exp" attributes with an expression is invalid.` +
                    ` Use property bindings (e.g. [@prop]="exp") or use an attribute without a value (e.g. @prop) instead.`, sourceSpan, ParseErrorLevel.ERROR);
            }
            this._parseAnimation(name, value, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            targetProps.push(new ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, ''), ParsedPropertyType.LITERAL_ATTR, sourceSpan));
        }
    }
    parsePropertyBinding(name, expression, isHost, sourceSpan, targetMatchableAttrs, targetProps) {
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
            this._parseAnimation(name, expression, sourceSpan, targetMatchableAttrs, targetProps);
        }
        else {
            this._parsePropertyAst(name, this._parseBinding(expression, isHost, sourceSpan), sourceSpan, targetMatchableAttrs, targetProps);
        }
    }
    parsePropertyInterpolation(name, value, sourceSpan, targetMatchableAttrs, targetProps) {
        const expr = this.parseInterpolation(value, sourceSpan);
        if (expr) {
            this._parsePropertyAst(name, expr, sourceSpan, targetMatchableAttrs, targetProps);
            return true;
        }
        return false;
    }
    _parsePropertyAst(name, ast, sourceSpan, targetMatchableAttrs, targetProps) {
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.DEFAULT, sourceSpan));
    }
    _parseAnimation(name, expression, sourceSpan, targetMatchableAttrs, targetProps) {
        // This will occur when a @trigger is not paired with an expression.
        // For animations it is valid to not have an expression since */void
        // states will be applied by angular when the element is attached/detached
        const ast = this._parseBinding(expression || 'undefined', false, sourceSpan);
        targetMatchableAttrs.push([name, ast.source]);
        targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.ANIMATION, sourceSpan));
    }
    _parseBinding(value, isHostBinding, sourceSpan) {
        const sourceInfo = sourceSpan.start.toString();
        try {
            const ast = isHostBinding ?
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
    createBoundElementProperty(elementSelector, boundProp) {
        if (boundProp.isAnimation) {
            return new BoundElementProperty(boundProp.name, 4 /* Animation */, SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan);
        }
        let unit = null;
        let bindingType = undefined;
        let boundPropertyName = null;
        const parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
        let securityContexts = undefined;
        // Check check for special cases (prefix style, attr, class)
        if (parts.length > 1) {
            if (parts[0] == ATTRIBUTE_PREFIX) {
                boundPropertyName = parts[1];
                this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
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
            boundPropertyName = this._schemaRegistry.getMappedPropName(boundProp.name);
            securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, false);
            bindingType = 0 /* Property */;
            this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, false);
        }
        return new BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan);
    }
    parseEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        if (isAnimationLabel(name)) {
            name = name.substr(1);
            this._parseAnimationEvent(name, expression, sourceSpan, targetEvents);
        }
        else {
            this._parseRegularEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents);
        }
    }
    _parseAnimationEvent(name, expression, sourceSpan, targetEvents) {
        const matches = splitAtPeriod(name, [name, '']);
        const eventName = matches[0];
        const phase = matches[1].toLowerCase();
        if (phase) {
            switch (phase) {
                case 'start':
                case 'done':
                    const ast = this._parseAction(expression, sourceSpan);
                    targetEvents.push(new ParsedEvent(eventName, phase, 1 /* Animation */, ast, sourceSpan));
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
    _parseRegularEvent(name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        // long format: 'target: eventName'
        const [target, eventName] = splitAtColon(name, [null, name]);
        const ast = this._parseAction(expression, sourceSpan);
        targetMatchableAttrs.push([name, ast.source]);
        targetEvents.push(new ParsedEvent(eventName, target, 0 /* Regular */, ast, sourceSpan));
        // Don't detect directives for event names for now,
        // so don't add the event name to the matchableAttrs
    }
    _parseAction(value, sourceSpan) {
        const sourceInfo = sourceSpan.start.toString();
        try {
            const ast = this._exprParser.parseAction(value, sourceInfo, this._interpolationConfig);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDeEMsT0FBTyxFQUEwQyxvQkFBb0IsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFtQixjQUFjLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFlLG1CQUFtQixFQUFrQixNQUFNLDBCQUEwQixDQUFDO0FBR3ZQLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFM0UsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN4QyxPQUFPLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwRCxNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztBQUNyQyxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztBQUNoQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUM7QUFDN0IsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0FBRTdCLE1BQU0sbUJBQW1CLEdBQUcsVUFBVSxDQUFDO0FBRXZDOztHQUVHO0FBQ0gsTUFBTTtJQUtKLFlBQ1ksV0FBbUIsRUFBVSxvQkFBeUMsRUFDdEUsZUFBc0MsRUFBRSxLQUFnQyxFQUN6RSxNQUFvQjtRQUZuQixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUFVLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBcUI7UUFDdEUsb0JBQWUsR0FBZixlQUFlLENBQXVCO1FBQ3ZDLFdBQU0sR0FBTixNQUFNLENBQWM7UUFQL0IsZ0JB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akIsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsQ0FBQzthQUNqRSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sb0JBQW9CLEdBQ3RCLFlBQVksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUUxRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsb0JBQW9CLENBQUMsR0FBRyxDQUNqQyxXQUFXLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEYsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3ZGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVQaXBlU3VtbWFyeX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge1NlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVFdpdGhTb3VyY2UsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgQm91bmRFbGVtZW50UHJvcGVydHksIEVtcHR5RXhwciwgUGFyc2VkRXZlbnQsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VkUHJvcGVydHksIFBhcnNlZFByb3BlcnR5VHlwZSwgUGFyc2VkVmFyaWFibGUsIFBhcnNlckVycm9yLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBUZW1wbGF0ZUJpbmRpbmd9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7bWVyZ2VOc0FuZE5hbWV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi9zZWxlY3Rvcic7XG5pbXBvcnQge3NwbGl0QXRDb2xvbiwgc3BsaXRBdFBlcmlvZH0gZnJvbSAnLi4vdXRpbCc7XG5cbmNvbnN0IFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUiA9ICcuJztcbmNvbnN0IEFUVFJJQlVURV9QUkVGSVggPSAnYXR0cic7XG5jb25zdCBDTEFTU19QUkVGSVggPSAnY2xhc3MnO1xuY29uc3QgU1RZTEVfUFJFRklYID0gJ3N0eWxlJztcblxuY29uc3QgQU5JTUFURV9QUk9QX1BSRUZJWCA9ICdhbmltYXRlLSc7XG5cbi8qKlxuICogUGFyc2VzIGJpbmRpbmdzIGluIHRlbXBsYXRlcyBhbmQgaW4gdGhlIGRpcmVjdGl2ZSBob3N0IGFyZWEuXG4gKi9cbmV4cG9ydCBjbGFzcyBCaW5kaW5nUGFyc2VyIHtcbiAgcGlwZXNCeU5hbWU6IE1hcDxzdHJpbmcsIENvbXBpbGVQaXBlU3VtbWFyeT58bnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBfdXNlZFBpcGVzOiBNYXA8c3RyaW5nLCBDb21waWxlUGlwZVN1bW1hcnk+ID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfZXhwclBhcnNlcjogUGFyc2VyLCBwcml2YXRlIF9pbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgcHJpdmF0ZSBfc2NoZW1hUmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdfG51bGwsXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZUVycm9yW10pIHtcbiAgICAvLyBXaGVuIHRoZSBgcGlwZXNgIHBhcmFtZXRlciBpcyBgbnVsbGAsIGRvIG5vdCBjaGVjayBmb3IgdXNlZCBwaXBlc1xuICAgIC8vIFRoaXMgaXMgdXNlZCBpbiBJVlkgd2hlbiB3ZSBtaWdodCBub3Qga25vdyB0aGUgYXZhaWxhYmxlIHBpcGVzIGF0IGNvbXBpbGUgdGltZVxuICAgIGlmIChwaXBlcykge1xuICAgICAgY29uc3QgcGlwZXNCeU5hbWU6IE1hcDxzdHJpbmcsIENvbXBpbGVQaXBlU3VtbWFyeT4gPSBuZXcgTWFwKCk7XG4gICAgICBwaXBlcy5mb3JFYWNoKHBpcGUgPT4gcGlwZXNCeU5hbWUuc2V0KHBpcGUubmFtZSwgcGlwZSkpO1xuICAgICAgdGhpcy5waXBlc0J5TmFtZSA9IHBpcGVzQnlOYW1lO1xuICAgIH1cbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBDb21waWxlUGlwZVN1bW1hcnlbXSB7IHJldHVybiBBcnJheS5mcm9tKHRoaXMuX3VzZWRQaXBlcy52YWx1ZXMoKSk7IH1cblxuICBjcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgUGFyc2VkUHJvcGVydHlbXXxudWxsIHtcbiAgICBpZiAoZGlyTWV0YS5ob3N0UHJvcGVydGllcykge1xuICAgICAgY29uc3QgYm91bmRQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgICAgT2JqZWN0LmtleXMoZGlyTWV0YS5ob3N0UHJvcGVydGllcykuZm9yRWFjaChwcm9wTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkaXJNZXRhLmhvc3RQcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgICAgaWYgKHR5cGVvZiBleHByZXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMucGFyc2VQcm9wZXJ0eUJpbmRpbmcocHJvcE5hbWUsIGV4cHJlc3Npb24sIHRydWUsIHNvdXJjZVNwYW4sIFtdLCBib3VuZFByb3BzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFZhbHVlIG9mIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmcgXCIke3Byb3BOYW1lfVwiIG5lZWRzIHRvIGJlIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBleHByZXNzaW9uIGJ1dCBnb3QgXCIke2V4cHJlc3Npb259XCIgKCR7dHlwZW9mIGV4cHJlc3Npb259KWAsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBib3VuZFByb3BzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNyZWF0ZURpcmVjdGl2ZUhvc3RQcm9wZXJ0eUFzdHMoXG4gICAgICBkaXJNZXRhOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBCb3VuZEVsZW1lbnRQcm9wZXJ0eVtdfG51bGwge1xuICAgIGNvbnN0IGJvdW5kUHJvcHMgPSB0aGlzLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyTWV0YSwgc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGJvdW5kUHJvcHMgJiZcbiAgICAgICAgYm91bmRQcm9wcy5tYXAoKHByb3ApID0+IHRoaXMuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudFNlbGVjdG9yLCBwcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpck1ldGE6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOlxuICAgICAgUGFyc2VkRXZlbnRbXXxudWxsIHtcbiAgICBpZiAoZGlyTWV0YS5ob3N0TGlzdGVuZXJzKSB7XG4gICAgICBjb25zdCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgIE9iamVjdC5rZXlzKGRpck1ldGEuaG9zdExpc3RlbmVycykuZm9yRWFjaChwcm9wTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkaXJNZXRhLmhvc3RMaXN0ZW5lcnNbcHJvcE5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIGV4cHJlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5wYXJzZUV2ZW50KHByb3BOYW1lLCBleHByZXNzaW9uLCBzb3VyY2VTcGFuLCBbXSwgdGFyZ2V0RXZlbnRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFZhbHVlIG9mIHRoZSBob3N0IGxpc3RlbmVyIFwiJHtwcm9wTmFtZX1cIiBuZWVkcyB0byBiZSBhIHN0cmluZyByZXByZXNlbnRpbmcgYW4gZXhwcmVzc2lvbiBidXQgZ290IFwiJHtleHByZXNzaW9ufVwiICgke3R5cGVvZiBleHByZXNzaW9ufSlgLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGFyZ2V0RXZlbnRzO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VJbmZvID0gc291cmNlU3Bhbi5zdGFydC50b1N0cmluZygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFzdCA9XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWUsIHNvdXJjZUluZm8sIHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpICE7XG4gICAgICBpZiAoYXN0KSB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGFzdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbyk7XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UgYW4gaW5saW5lIHRlbXBsYXRlIGJpbmRpbmcuIGllIGA8dGFnICp0cGxLZXk9XCI8dHBsVmFsdWU+XCI+YFxuICBwYXJzZUlubGluZVRlbXBsYXRlQmluZGluZyhcbiAgICAgIHRwbEtleTogc3RyaW5nLCB0cGxWYWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICB0YXJnZXRWYXJzOiBQYXJzZWRWYXJpYWJsZVtdKSB7XG4gICAgY29uc3QgYmluZGluZ3MgPSB0aGlzLl9wYXJzZVRlbXBsYXRlQmluZGluZ3ModHBsS2V5LCB0cGxWYWx1ZSwgc291cmNlU3Bhbik7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJpbmRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBiaW5kaW5nID0gYmluZGluZ3NbaV07XG4gICAgICBpZiAoYmluZGluZy5rZXlJc1Zhcikge1xuICAgICAgICB0YXJnZXRWYXJzLnB1c2gobmV3IFBhcnNlZFZhcmlhYmxlKGJpbmRpbmcua2V5LCBiaW5kaW5nLm5hbWUsIHNvdXJjZVNwYW4pKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZGluZy5leHByZXNzaW9uKSB7XG4gICAgICAgIHRoaXMuX3BhcnNlUHJvcGVydHlBc3QoXG4gICAgICAgICAgICBiaW5kaW5nLmtleSwgYmluZGluZy5leHByZXNzaW9uLCBzb3VyY2VTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbYmluZGluZy5rZXksICcnXSk7XG4gICAgICAgIHRoaXMucGFyc2VMaXRlcmFsQXR0cihiaW5kaW5nLmtleSwgbnVsbCwgc291cmNlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVRlbXBsYXRlQmluZGluZ3ModHBsS2V5OiBzdHJpbmcsIHRwbFZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6XG4gICAgICBUZW1wbGF0ZUJpbmRpbmdbXSB7XG4gICAgY29uc3Qgc291cmNlSW5mbyA9IHNvdXJjZVNwYW4uc3RhcnQudG9TdHJpbmcoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBiaW5kaW5nc1Jlc3VsdCA9IHRoaXMuX2V4cHJQYXJzZXIucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRwbEtleSwgdHBsVmFsdWUsIHNvdXJjZUluZm8pO1xuICAgICAgdGhpcy5fcmVwb3J0RXhwcmVzc2lvblBhcnNlckVycm9ycyhiaW5kaW5nc1Jlc3VsdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgYmluZGluZ3NSZXN1bHQudGVtcGxhdGVCaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nKSA9PiB7XG4gICAgICAgIGlmIChiaW5kaW5nLmV4cHJlc3Npb24pIHtcbiAgICAgICAgICB0aGlzLl9jaGVja1BpcGVzKGJpbmRpbmcuZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYmluZGluZ3NSZXN1bHQud2FybmluZ3MuZm9yRWFjaChcbiAgICAgICAgICAod2FybmluZykgPT4geyB0aGlzLl9yZXBvcnRFcnJvcih3YXJuaW5nLCBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuV0FSTklORyk7IH0pO1xuICAgICAgcmV0dXJuIGJpbmRpbmdzUmVzdWx0LnRlbXBsYXRlQmluZGluZ3M7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYCR7ZX1gLCBzb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIGlmIChpc0FuaW1hdGlvbkxhYmVsKG5hbWUpKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICBgQXNzaWduaW5nIGFuaW1hdGlvbiB0cmlnZ2VycyB2aWEgQHByb3A9XCJleHBcIiBhdHRyaWJ1dGVzIHdpdGggYW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLmAgK1xuICAgICAgICAgICAgICAgIGAgVXNlIHByb3BlcnR5IGJpbmRpbmdzIChlLmcuIFtAcHJvcF09XCJleHBcIikgb3IgdXNlIGFuIGF0dHJpYnV0ZSB3aXRob3V0IGEgdmFsdWUgKGUuZy4gQHByb3ApIGluc3RlYWQuYCxcbiAgICAgICAgICAgIHNvdXJjZVNwYW4sIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgICB9XG4gICAgICB0aGlzLl9wYXJzZUFuaW1hdGlvbihuYW1lLCB2YWx1ZSwgc291cmNlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkoXG4gICAgICAgICAgbmFtZSwgdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSwgJycpLCBQYXJzZWRQcm9wZXJ0eVR5cGUuTElURVJBTF9BVFRSLFxuICAgICAgICAgIHNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBpc0hvc3Q6IGJvb2xlYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIGxldCBpc0FuaW1hdGlvblByb3AgPSBmYWxzZTtcbiAgICBpZiAobmFtZS5zdGFydHNXaXRoKEFOSU1BVEVfUFJPUF9QUkVGSVgpKSB7XG4gICAgICBpc0FuaW1hdGlvblByb3AgPSB0cnVlO1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKEFOSU1BVEVfUFJPUF9QUkVGSVgubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIGlzQW5pbWF0aW9uUHJvcCA9IHRydWU7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG4gICAgfVxuXG4gICAgaWYgKGlzQW5pbWF0aW9uUHJvcCkge1xuICAgICAgdGhpcy5fcGFyc2VBbmltYXRpb24obmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgICAgICBuYW1lLCB0aGlzLl9wYXJzZUJpbmRpbmcoZXhwcmVzc2lvbiwgaXNIb3N0LCBzb3VyY2VTcGFuKSwgc291cmNlU3BhbixcbiAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLFxuICAgICAgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10pOiBib29sZWFuIHtcbiAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZUludGVycG9sYXRpb24odmFsdWUsIHNvdXJjZVNwYW4pO1xuICAgIGlmIChleHByKSB7XG4gICAgICB0aGlzLl9wYXJzZVByb3BlcnR5QXN0KG5hbWUsIGV4cHIsIHNvdXJjZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VQcm9wZXJ0eUFzdChcbiAgICAgIG5hbWU6IHN0cmluZywgYXN0OiBBU1RXaXRoU291cmNlLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0UHJvcHM6IFBhcnNlZFByb3BlcnR5W10pIHtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lLCBhc3Quc291cmNlICFdKTtcbiAgICB0YXJnZXRQcm9wcy5wdXNoKG5ldyBQYXJzZWRQcm9wZXJ0eShuYW1lLCBhc3QsIFBhcnNlZFByb3BlcnR5VHlwZS5ERUZBVUxULCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFuaW1hdGlvbihcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nfG51bGwsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSkge1xuICAgIC8vIFRoaXMgd2lsbCBvY2N1ciB3aGVuIGEgQHRyaWdnZXIgaXMgbm90IHBhaXJlZCB3aXRoIGFuIGV4cHJlc3Npb24uXG4gICAgLy8gRm9yIGFuaW1hdGlvbnMgaXQgaXMgdmFsaWQgdG8gbm90IGhhdmUgYW4gZXhwcmVzc2lvbiBzaW5jZSAqL3ZvaWRcbiAgICAvLyBzdGF0ZXMgd2lsbCBiZSBhcHBsaWVkIGJ5IGFuZ3VsYXIgd2hlbiB0aGUgZWxlbWVudCBpcyBhdHRhY2hlZC9kZXRhY2hlZFxuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZyhleHByZXNzaW9uIHx8ICd1bmRlZmluZWQnLCBmYWxzZSwgc291cmNlU3Bhbik7XG4gICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMucHVzaChbbmFtZSwgYXN0LnNvdXJjZSAhXSk7XG4gICAgdGFyZ2V0UHJvcHMucHVzaChuZXcgUGFyc2VkUHJvcGVydHkobmFtZSwgYXN0LCBQYXJzZWRQcm9wZXJ0eVR5cGUuQU5JTUFUSU9OLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmcodmFsdWU6IHN0cmluZywgaXNIb3N0QmluZGluZzogYm9vbGVhbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSBzb3VyY2VTcGFuLnN0YXJ0LnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXN0ID0gaXNIb3N0QmluZGluZyA/XG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlci5wYXJzZVNpbXBsZUJpbmRpbmcodmFsdWUsIHNvdXJjZUluZm8sIHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpIDpcbiAgICAgICAgICB0aGlzLl9leHByUGFyc2VyLnBhcnNlQmluZGluZyh2YWx1ZSwgc291cmNlSW5mbywgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB0aGlzLl9yZXBvcnRFeHByZXNzaW9uUGFyc2VyRXJyb3JzKGFzdC5lcnJvcnMsIHNvdXJjZVNwYW4pO1xuICAgICAgdGhpcy5fY2hlY2tQaXBlcyhhc3QsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgJHtlfWAsIHNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbyk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudFNlbGVjdG9yOiBzdHJpbmcsIGJvdW5kUHJvcDogUGFyc2VkUHJvcGVydHkpOlxuICAgICAgQm91bmRFbGVtZW50UHJvcGVydHkge1xuICAgIGlmIChib3VuZFByb3AuaXNBbmltYXRpb24pIHtcbiAgICAgIHJldHVybiBuZXcgQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgYm91bmRQcm9wLm5hbWUsIEJpbmRpbmdUeXBlLkFuaW1hdGlvbiwgU2VjdXJpdHlDb250ZXh0Lk5PTkUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBudWxsLFxuICAgICAgICAgIGJvdW5kUHJvcC5zb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICBsZXQgdW5pdDogc3RyaW5nfG51bGwgPSBudWxsO1xuICAgIGxldCBiaW5kaW5nVHlwZTogQmluZGluZ1R5cGUgPSB1bmRlZmluZWQgITtcbiAgICBsZXQgYm91bmRQcm9wZXJ0eU5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBjb25zdCBwYXJ0cyA9IGJvdW5kUHJvcC5uYW1lLnNwbGl0KFBST1BFUlRZX1BBUlRTX1NFUEFSQVRPUik7XG4gICAgbGV0IHNlY3VyaXR5Q29udGV4dHM6IFNlY3VyaXR5Q29udGV4dFtdID0gdW5kZWZpbmVkICE7XG5cbiAgICAvLyBDaGVjayBjaGVjayBmb3Igc3BlY2lhbCBjYXNlcyAocHJlZml4IHN0eWxlLCBhdHRyLCBjbGFzcylcbiAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgaWYgKHBhcnRzWzBdID09IEFUVFJJQlVURV9QUkVGSVgpIHtcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSBwYXJ0c1sxXTtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVQcm9wZXJ0eU9yQXR0cmlidXRlTmFtZShib3VuZFByb3BlcnR5TmFtZSwgYm91bmRQcm9wLnNvdXJjZVNwYW4sIHRydWUpO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBlbGVtZW50U2VsZWN0b3IsIGJvdW5kUHJvcGVydHlOYW1lLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBuc1NlcGFyYXRvcklkeCA9IGJvdW5kUHJvcGVydHlOYW1lLmluZGV4T2YoJzonKTtcbiAgICAgICAgaWYgKG5zU2VwYXJhdG9ySWR4ID4gLTEpIHtcbiAgICAgICAgICBjb25zdCBucyA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZygwLCBuc1NlcGFyYXRvcklkeCk7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IGJvdW5kUHJvcGVydHlOYW1lLnN1YnN0cmluZyhuc1NlcGFyYXRvcklkeCArIDEpO1xuICAgICAgICAgIGJvdW5kUHJvcGVydHlOYW1lID0gbWVyZ2VOc0FuZE5hbWUobnMsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09IENMQVNTX1BSRUZJWCkge1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLkNsYXNzO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5OT05FXTtcbiAgICAgIH0gZWxzZSBpZiAocGFydHNbMF0gPT0gU1RZTEVfUFJFRklYKSB7XG4gICAgICAgIHVuaXQgPSBwYXJ0cy5sZW5ndGggPiAyID8gcGFydHNbMl0gOiBudWxsO1xuICAgICAgICBib3VuZFByb3BlcnR5TmFtZSA9IHBhcnRzWzFdO1xuICAgICAgICBiaW5kaW5nVHlwZSA9IEJpbmRpbmdUeXBlLlN0eWxlO1xuICAgICAgICBzZWN1cml0eUNvbnRleHRzID0gW1NlY3VyaXR5Q29udGV4dC5TVFlMRV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgbm90IGEgc3BlY2lhbCBjYXNlLCB1c2UgdGhlIGZ1bGwgcHJvcGVydHkgbmFtZVxuICAgIGlmIChib3VuZFByb3BlcnR5TmFtZSA9PT0gbnVsbCkge1xuICAgICAgYm91bmRQcm9wZXJ0eU5hbWUgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXRNYXBwZWRQcm9wTmFtZShib3VuZFByb3AubmFtZSk7XG4gICAgICBzZWN1cml0eUNvbnRleHRzID0gY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhcbiAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgZWxlbWVudFNlbGVjdG9yLCBib3VuZFByb3BlcnR5TmFtZSwgZmFsc2UpO1xuICAgICAgYmluZGluZ1R5cGUgPSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTtcbiAgICAgIHRoaXMuX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoYm91bmRQcm9wZXJ0eU5hbWUsIGJvdW5kUHJvcC5zb3VyY2VTcGFuLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgICAgYm91bmRQcm9wZXJ0eU5hbWUsIGJpbmRpbmdUeXBlLCBzZWN1cml0eUNvbnRleHRzWzBdLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgdW5pdCxcbiAgICAgICAgYm91bmRQcm9wLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcGFyc2VFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgaWYgKGlzQW5pbWF0aW9uTGFiZWwobmFtZSkpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxKTtcbiAgICAgIHRoaXMuX3BhcnNlQW5pbWF0aW9uRXZlbnQobmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgdGFyZ2V0RXZlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyc2VSZWd1bGFyRXZlbnQobmFtZSwgZXhwcmVzc2lvbiwgc291cmNlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldEV2ZW50cyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBbmltYXRpb25FdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBzcGxpdEF0UGVyaW9kKG5hbWUsIFtuYW1lLCAnJ10pO1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IG1hdGNoZXNbMF07XG4gICAgY29uc3QgcGhhc2UgPSBtYXRjaGVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHBoYXNlKSB7XG4gICAgICBzd2l0Y2ggKHBoYXNlKSB7XG4gICAgICAgIGNhc2UgJ3N0YXJ0JzpcbiAgICAgICAgY2FzZSAnZG9uZSc6XG4gICAgICAgICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VBY3Rpb24oZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG4gICAgICAgICAgdGFyZ2V0RXZlbnRzLnB1c2goXG4gICAgICAgICAgICAgIG5ldyBQYXJzZWRFdmVudChldmVudE5hbWUsIHBoYXNlLCBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uLCBhc3QsIHNvdXJjZVNwYW4pKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVGhlIHByb3ZpZGVkIGFuaW1hdGlvbiBvdXRwdXQgcGhhc2UgdmFsdWUgXCIke3BoYXNlfVwiIGZvciBcIkAke2V2ZW50TmFtZX1cIiBpcyBub3Qgc3VwcG9ydGVkICh1c2Ugc3RhcnQgb3IgZG9uZSlgLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYFRoZSBhbmltYXRpb24gdHJpZ2dlciBvdXRwdXQgZXZlbnQgKEAke2V2ZW50TmFtZX0pIGlzIG1pc3NpbmcgaXRzIHBoYXNlIHZhbHVlIG5hbWUgKHN0YXJ0IG9yIGRvbmUgYXJlIGN1cnJlbnRseSBzdXBwb3J0ZWQpYCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVJlZ3VsYXJFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgLy8gbG9uZyBmb3JtYXQ6ICd0YXJnZXQ6IGV2ZW50TmFtZSdcbiAgICBjb25zdCBbdGFyZ2V0LCBldmVudE5hbWVdID0gc3BsaXRBdENvbG9uKG5hbWUsIFtudWxsICEsIG5hbWVdKTtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUFjdGlvbihleHByZXNzaW9uLCBzb3VyY2VTcGFuKTtcbiAgICB0YXJnZXRNYXRjaGFibGVBdHRycy5wdXNoKFtuYW1lICEsIGFzdC5zb3VyY2UgIV0pO1xuICAgIHRhcmdldEV2ZW50cy5wdXNoKG5ldyBQYXJzZWRFdmVudChldmVudE5hbWUsIHRhcmdldCwgUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIsIGFzdCwgc291cmNlU3BhbikpO1xuICAgIC8vIERvbid0IGRldGVjdCBkaXJlY3RpdmVzIGZvciBldmVudCBuYW1lcyBmb3Igbm93LFxuICAgIC8vIHNvIGRvbid0IGFkZCB0aGUgZXZlbnQgbmFtZSB0byB0aGUgbWF0Y2hhYmxlQXR0cnNcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQWN0aW9uKHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZUluZm8gPSBzb3VyY2VTcGFuLnN0YXJ0LnRvU3RyaW5nKCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXN0ID0gdGhpcy5fZXhwclBhcnNlci5wYXJzZUFjdGlvbih2YWx1ZSwgc291cmNlSW5mbywgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgICBpZiAoYXN0KSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoYXN0LmVycm9ycywgc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICBpZiAoIWFzdCB8fCBhc3QuYXN0IGluc3RhbmNlb2YgRW1wdHlFeHByKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGBFbXB0eSBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWRgLCBzb3VyY2VTcGFuKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXIud3JhcExpdGVyYWxQcmltaXRpdmUoJ0VSUk9SJywgc291cmNlSW5mbyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jaGVja1BpcGVzKGFzdCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gYXN0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGAke2V9YCwgc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gdGhpcy5fZXhwclBhcnNlci53cmFwTGl0ZXJhbFByaW1pdGl2ZSgnRVJST1InLCBzb3VyY2VJbmZvKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCA9IFBhcnNlRXJyb3JMZXZlbC5FUlJPUikge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgbWVzc2FnZSwgbGV2ZWwpKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEV4cHJlc3Npb25QYXJzZXJFcnJvcnMoZXJyb3JzOiBQYXJzZXJFcnJvcltdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoZXJyb3IubWVzc2FnZSwgc291cmNlU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgLy8gTWFrZSBzdXJlIGFsbCB0aGUgdXNlZCBwaXBlcyBhcmUga25vd24gaW4gYHRoaXMucGlwZXNCeU5hbWVgXG4gIHByaXZhdGUgX2NoZWNrUGlwZXMoYXN0OiBBU1RXaXRoU291cmNlLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiB2b2lkIHtcbiAgICBpZiAoYXN0ICYmIHRoaXMucGlwZXNCeU5hbWUpIHtcbiAgICAgIGNvbnN0IGNvbGxlY3RvciA9IG5ldyBQaXBlQ29sbGVjdG9yKCk7XG4gICAgICBhc3QudmlzaXQoY29sbGVjdG9yKTtcbiAgICAgIGNvbGxlY3Rvci5waXBlcy5mb3JFYWNoKChhc3QsIHBpcGVOYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHBpcGVNZXRhID0gdGhpcy5waXBlc0J5TmFtZSAhLmdldChwaXBlTmFtZSk7XG4gICAgICAgIGlmICghcGlwZU1ldGEpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFRoZSBwaXBlICcke3BpcGVOYW1lfScgY291bGQgbm90IGJlIGZvdW5kYCxcbiAgICAgICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFzdC5zcGFuLnN0YXJ0KSwgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoYXN0LnNwYW4uZW5kKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3VzZWRQaXBlcy5zZXQocGlwZU5hbWUsIHBpcGVNZXRhKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBwcm9wTmFtZSB0aGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgLyBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHNvdXJjZVNwYW5cbiAgICogQHBhcmFtIGlzQXR0ciB0cnVlIHdoZW4gYmluZGluZyB0byBhbiBhdHRyaWJ1dGVcbiAgICovXG4gIHByaXZhdGUgX3ZhbGlkYXRlUHJvcGVydHlPckF0dHJpYnV0ZU5hbWUoXG4gICAgICBwcm9wTmFtZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGlzQXR0cjogYm9vbGVhbik6IHZvaWQge1xuICAgIGNvbnN0IHJlcG9ydCA9IGlzQXR0ciA/IHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LnZhbGlkYXRlQXR0cmlidXRlKHByb3BOYW1lKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnkudmFsaWRhdGVQcm9wZXJ0eShwcm9wTmFtZSk7XG4gICAgaWYgKHJlcG9ydC5lcnJvcikge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IocmVwb3J0Lm1zZyAhLCBzb3VyY2VTcGFuLCBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGlwZUNvbGxlY3RvciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3Ige1xuICBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nUGlwZT4oKTtcbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5waXBlcy5zZXQoYXN0Lm5hbWUsIGFzdCk7XG4gICAgYXN0LmV4cC52aXNpdCh0aGlzKTtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0FuaW1hdGlvbkxhYmVsKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZVswXSA9PSAnQCc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKFxuICAgIHJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksIHNlbGVjdG9yOiBzdHJpbmcsIHByb3BOYW1lOiBzdHJpbmcsXG4gICAgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOiBTZWN1cml0eUNvbnRleHRbXSB7XG4gIGNvbnN0IGN0eHM6IFNlY3VyaXR5Q29udGV4dFtdID0gW107XG4gIENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKS5mb3JFYWNoKChzZWxlY3RvcikgPT4ge1xuICAgIGNvbnN0IGVsZW1lbnROYW1lcyA9IHNlbGVjdG9yLmVsZW1lbnQgPyBbc2VsZWN0b3IuZWxlbWVudF0gOiByZWdpc3RyeS5hbGxLbm93bkVsZW1lbnROYW1lcygpO1xuICAgIGNvbnN0IG5vdEVsZW1lbnROYW1lcyA9XG4gICAgICAgIG5ldyBTZXQoc2VsZWN0b3Iubm90U2VsZWN0b3JzLmZpbHRlcihzZWxlY3RvciA9PiBzZWxlY3Rvci5pc0VsZW1lbnRTZWxlY3RvcigpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKChzZWxlY3RvcikgPT4gc2VsZWN0b3IuZWxlbWVudCkpO1xuICAgIGNvbnN0IHBvc3NpYmxlRWxlbWVudE5hbWVzID1cbiAgICAgICAgZWxlbWVudE5hbWVzLmZpbHRlcihlbGVtZW50TmFtZSA9PiAhbm90RWxlbWVudE5hbWVzLmhhcyhlbGVtZW50TmFtZSkpO1xuXG4gICAgY3R4cy5wdXNoKC4uLnBvc3NpYmxlRWxlbWVudE5hbWVzLm1hcChcbiAgICAgICAgZWxlbWVudE5hbWUgPT4gcmVnaXN0cnkuc2VjdXJpdHlDb250ZXh0KGVsZW1lbnROYW1lLCBwcm9wTmFtZSwgaXNBdHRyaWJ1dGUpKSk7XG4gIH0pO1xuICByZXR1cm4gY3R4cy5sZW5ndGggPT09IDAgPyBbU2VjdXJpdHlDb250ZXh0Lk5PTkVdIDogQXJyYXkuZnJvbShuZXcgU2V0KGN0eHMpKS5zb3J0KCk7XG59XG4iXX0=