/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import * as html from '../ml_parser/ast';
import { replaceNgsp } from '../ml_parser/html_whitespaces';
import { isNgTemplate } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel } from '../parse_util';
import { isStyleUrlResolvable } from '../style_url_resolver';
import { PreparsedElementType, preparseElement } from '../template_parser/template_preparser';
import { syntaxError } from '../util';
import * as t from './r3_ast';
import { I18N_ICU_VAR_PREFIX } from './view/i18n/util';
var BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
// Group 1 = "bind-"
var KW_BIND_IDX = 1;
// Group 2 = "let-"
var KW_LET_IDX = 2;
// Group 3 = "ref-/#"
var KW_REF_IDX = 3;
// Group 4 = "on-"
var KW_ON_IDX = 4;
// Group 5 = "bindon-"
var KW_BINDON_IDX = 5;
// Group 6 = "@"
var KW_AT_IDX = 6;
// Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
var IDENT_KW_IDX = 7;
// Group 8 = identifier inside [()]
var IDENT_BANANA_BOX_IDX = 8;
// Group 9 = identifier inside []
var IDENT_PROPERTY_IDX = 9;
// Group 10 = identifier inside ()
var IDENT_EVENT_IDX = 10;
var TEMPLATE_ATTR_PREFIX = '*';
export function htmlAstToRender3Ast(htmlNodes, bindingParser) {
    var transformer = new HtmlAstToIvyAst(bindingParser);
    var ivyNodes = html.visitAll(transformer, htmlNodes);
    // Errors might originate in either the binding parser or the html to ivy transformer
    var allErrors = bindingParser.errors.concat(transformer.errors);
    var errors = allErrors.filter(function (e) { return e.level === ParseErrorLevel.ERROR; });
    if (errors.length > 0) {
        var errorString = errors.join('\n');
        throw syntaxError("Template parse errors:\n" + errorString, errors);
    }
    return {
        nodes: ivyNodes,
        errors: allErrors,
    };
}
var HtmlAstToIvyAst = /** @class */ (function () {
    function HtmlAstToIvyAst(bindingParser) {
        this.bindingParser = bindingParser;
        this.errors = [];
    }
    // HTML visitor
    HtmlAstToIvyAst.prototype.visitElement = function (element) {
        var _this = this;
        var e_1, _a;
        var preparsedElement = preparseElement(element);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE) {
            // Skipping <script> for security reasons
            // Skipping <style> as we already processed them
            // in the StyleCompiler
            return null;
        }
        if (preparsedElement.type === PreparsedElementType.STYLESHEET &&
            isStyleUrlResolvable(preparsedElement.hrefAttr)) {
            // Skipping stylesheets with either relative urls or package scheme as we already processed
            // them in the StyleCompiler
            return null;
        }
        // Whether the element is a `<ng-template>`
        var isTemplateElement = isNgTemplate(element.name);
        var parsedProperties = [];
        var boundEvents = [];
        var variables = [];
        var references = [];
        var attributes = [];
        var i18nAttrsMeta = {};
        var templateParsedProperties = [];
        var templateVariables = [];
        // Whether the element has any *-attribute
        var elementHasInlineTemplate = false;
        try {
            for (var _b = tslib_1.__values(element.attrs), _c = _b.next(); !_c.done; _c = _b.next()) {
                var attribute = _c.value;
                var hasBinding = false;
                var normalizedName = normalizeAttributeName(attribute.name);
                // `*attr` defines template bindings
                var isTemplateBinding = false;
                if (attribute.i18n) {
                    i18nAttrsMeta[attribute.name] = attribute.i18n;
                }
                if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                    // *-attributes
                    if (elementHasInlineTemplate) {
                        this.reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attribute.sourceSpan);
                    }
                    isTemplateBinding = true;
                    elementHasInlineTemplate = true;
                    var templateValue = attribute.value;
                    var templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                    var parsedVariables = [];
                    this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, [], templateParsedProperties, parsedVariables);
                    templateVariables.push.apply(templateVariables, tslib_1.__spread(parsedVariables.map(function (v) { return new t.Variable(v.name, v.value, v.sourceSpan); })));
                }
                else {
                    // Check for variables, events, property bindings, interpolation
                    hasBinding = this.parseAttribute(isTemplateElement, attribute, [], parsedProperties, boundEvents, variables, references);
                }
                if (!hasBinding && !isTemplateBinding) {
                    // don't include the bindings as attributes as well in the AST
                    attributes.push(this.visitAttribute(attribute));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
        var parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>`
            if (element.children && !element.children.every(isEmptyTextNode)) {
                this.reportError("<ng-content> element cannot have content.", element.sourceSpan);
            }
            var selector = preparsedElement.selectAttr;
            var attrs = element.attrs.map(function (attr) { return _this.visitAttribute(attr); });
            parsedElement = new t.Content(selector, attrs, element.sourceSpan, element.i18n);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
            parsedElement = new t.Template(element.name, attributes, attrs.bound, boundEvents, children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        else {
            var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
            parsedElement = new t.Element(element.name, attributes, attrs.bound, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        if (elementHasInlineTemplate) {
            var attrs = this.extractAttributes('ng-template', templateParsedProperties, i18nAttrsMeta);
            // TODO(pk): test for this case
            parsedElement = new t.Template(parsedElement.name, attrs.literal, attrs.bound, [], [parsedElement], [], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        return parsedElement;
    };
    HtmlAstToIvyAst.prototype.visitAttribute = function (attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan, attribute.i18n);
    };
    HtmlAstToIvyAst.prototype.visitText = function (text) {
        return this._visitTextWithInterpolation(text.value, text.sourceSpan, text.i18n);
    };
    HtmlAstToIvyAst.prototype.visitExpansion = function (expansion) {
        var _this = this;
        var meta = expansion.i18n;
        // do not generate Icu in case it was created
        // outside of i18n block in a template
        if (!meta) {
            return null;
        }
        var vars = {};
        var placeholders = {};
        // extract VARs from ICUs - we process them separately while
        // assembling resulting message via goog.getMsg function, since
        // we need to pass them to top-level goog.getMsg call
        Object.keys(meta.placeholders).forEach(function (key) {
            var value = meta.placeholders[key];
            if (key.startsWith(I18N_ICU_VAR_PREFIX)) {
                var config = _this.bindingParser.interpolationConfig;
                // ICU expression is a plain string, not wrapped into start
                // and end tags, so we wrap it before passing to binding parser
                var wrapped = "" + config.start + value + config.end;
                vars[key] = _this._visitTextWithInterpolation(wrapped, expansion.sourceSpan);
            }
            else {
                placeholders[key] = _this._visitTextWithInterpolation(value, expansion.sourceSpan);
            }
        });
        return new t.Icu(vars, placeholders, expansion.sourceSpan, meta);
    };
    HtmlAstToIvyAst.prototype.visitExpansionCase = function (expansionCase) { return null; };
    HtmlAstToIvyAst.prototype.visitComment = function (comment) { return null; };
    // convert view engine `ParsedProperty` to a format suitable for IVY
    HtmlAstToIvyAst.prototype.extractAttributes = function (elementName, properties, i18nPropsMeta) {
        var _this = this;
        var bound = [];
        var literal = [];
        properties.forEach(function (prop) {
            var i18n = i18nPropsMeta[prop.name];
            if (prop.isLiteral) {
                literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan, undefined, i18n));
            }
            else {
                // we skip validation here, since we do this check at runtime due to the fact that we need
                // to make sure a given prop is not an input of some Directive (thus should not be a subject
                // of this check) and Directive matching happens at runtime
                var bep = _this.bindingParser.createBoundElementProperty(elementName, prop, /* skipValidation */ true);
                bound.push(t.BoundAttribute.fromBoundElementProperty(bep, i18n));
            }
        });
        return { bound: bound, literal: literal };
    };
    HtmlAstToIvyAst.prototype.parseAttribute = function (isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
        var name = normalizeAttributeName(attribute.name);
        var value = attribute.value;
        var srcSpan = attribute.sourceSpan;
        var bindParts = name.match(BIND_NAME_REGEXP);
        var hasBinding = false;
        if (bindParts) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    var identifier = bindParts[IDENT_KW_IDX];
                    this.parseVariable(identifier, value, srcSpan, variables);
                }
                else {
                    this.reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                var identifier = bindParts[IDENT_KW_IDX];
                this.parseReference(identifier, value, srcSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                var events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this.bindingParser.parseLiteralAttr(name, value, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                var events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, matchableAttributes, parsedProperties);
        }
        return hasBinding;
    };
    HtmlAstToIvyAst.prototype._visitTextWithInterpolation = function (value, sourceSpan, i18n) {
        var valueNoNgsp = replaceNgsp(value);
        var expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan);
        return expr ? new t.BoundText(expr, sourceSpan, i18n) : new t.Text(valueNoNgsp, sourceSpan);
    };
    HtmlAstToIvyAst.prototype.parseVariable = function (identifier, value, sourceSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in variable names", sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan));
    };
    HtmlAstToIvyAst.prototype.parseReference = function (identifier, value, sourceSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in reference names", sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan));
    };
    HtmlAstToIvyAst.prototype.parseAssignmentEvent = function (name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents) {
        var events = [];
        this.bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, valueSpan || sourceSpan, targetMatchableAttrs, events);
        addEvents(events, boundEvents);
    };
    HtmlAstToIvyAst.prototype.reportError = function (message, sourceSpan, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this.errors.push(new ParseError(sourceSpan, message, level));
    };
    return HtmlAstToIvyAst;
}());
var NonBindableVisitor = /** @class */ (function () {
    function NonBindableVisitor() {
    }
    NonBindableVisitor.prototype.visitElement = function (ast) {
        var preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        var children = html.visitAll(this, ast.children, null);
        return new t.Element(ast.name, html.visitAll(this, ast.attrs), 
        /* inputs */ [], /* outputs */ [], children, /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    };
    NonBindableVisitor.prototype.visitComment = function (comment) { return null; };
    NonBindableVisitor.prototype.visitAttribute = function (attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, undefined, attribute.i18n);
    };
    NonBindableVisitor.prototype.visitText = function (text) { return new t.Text(text.value, text.sourceSpan); };
    NonBindableVisitor.prototype.visitExpansion = function (expansion) { return null; };
    NonBindableVisitor.prototype.visitExpansionCase = function (expansionCase) { return null; };
    return NonBindableVisitor;
}());
var NON_BINDABLE_VISITOR = new NonBindableVisitor();
function normalizeAttributeName(attrName) {
    return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
}
function addEvents(events, boundEvents) {
    boundEvents.push.apply(boundEvents, tslib_1.__spread(events.map(function (e) { return t.BoundEvent.fromParsedEvent(e); })));
}
function isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFJSCxPQUFPLEtBQUssSUFBSSxNQUFNLGtCQUFrQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDL0MsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQWtCLE1BQU0sZUFBZSxDQUFDO0FBQzNFLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTNELE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxlQUFlLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RixPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRXBDLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRXJELElBQU0sZ0JBQWdCLEdBQ2xCLDBHQUEwRyxDQUFDO0FBRS9HLG9CQUFvQjtBQUNwQixJQUFNLFdBQVcsR0FBRyxDQUFDLENBQUM7QUFDdEIsbUJBQW1CO0FBQ25CLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztBQUNyQixxQkFBcUI7QUFDckIsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLGtCQUFrQjtBQUNsQixJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDcEIsc0JBQXNCO0FBQ3RCLElBQU0sYUFBYSxHQUFHLENBQUMsQ0FBQztBQUN4QixnQkFBZ0I7QUFDaEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FB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LENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdEYsMkNBQWMsR0FBZCxVQUFlLFNBQXlCLElBQVMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRS9ELCtDQUFrQixHQUFsQixVQUFtQixhQUFpQyxJQUFTLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3RSx5QkFBQztBQUFELENBQUMsQUEvQkQsSUErQkM7QUFFRCxJQUFNLG9CQUFvQixHQUFHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztBQUV0RCxTQUFTLHNCQUFzQixDQUFDLFFBQWdCO0lBQzlDLE9BQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3JFLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxNQUFxQixFQUFFLFdBQTJCO0lBQ25FLFdBQVcsQ0FBQyxJQUFJLE9BQWhCLFdBQVcsbUJBQVMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUEvQixDQUErQixDQUFDLEdBQUU7QUFDeEUsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLElBQWU7SUFDdEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDcEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZWRFdmVudCwgUGFyc2VkUHJvcGVydHksIFBhcnNlZFZhcmlhYmxlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge3JlcGxhY2VOZ3NwfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge2lzTmdUZW1wbGF0ZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUVycm9yTGV2ZWwsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzU3R5bGVVcmxSZXNvbHZhYmxlfSBmcm9tICcuLi9zdHlsZV91cmxfcmVzb2x2ZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHJlcGFyc2VFbGVtZW50fSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcHJlcGFyc2VyJztcbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7STE4Tl9JQ1VfVkFSX1BSRUZJWH0gZnJvbSAnLi92aWV3L2kxOG4vdXRpbCc7XG5cbmNvbnN0IEJJTkRfTkFNRV9SRUdFWFAgPVxuICAgIC9eKD86KD86KD86KGJpbmQtKXwobGV0LSl8KHJlZi18Iyl8KG9uLSl8KGJpbmRvbi0pfChAKSkoLispKXxcXFtcXCgoW15cXCldKylcXClcXF18XFxbKFteXFxdXSspXFxdfFxcKChbXlxcKV0rKVxcKSkkLztcblxuLy8gR3JvdXAgMSA9IFwiYmluZC1cIlxuY29uc3QgS1dfQklORF9JRFggPSAxO1xuLy8gR3JvdXAgMiA9IFwibGV0LVwiXG5jb25zdCBLV19MRVRfSURYID0gMjtcbi8vIEdyb3VwIDMgPSBcInJlZi0vI1wiXG5jb25zdCBLV19SRUZfSURYID0gMztcbi8vIEdyb3VwIDQgPSBcIm9uLVwiXG5jb25zdCBLV19PTl9JRFggPSA0O1xuLy8gR3JvdXAgNSA9IFwiYmluZG9uLVwiXG5jb25zdCBLV19CSU5ET05fSURYID0gNTtcbi8vIEdyb3VwIDYgPSBcIkBcIlxuY29uc3QgS1dfQVRfSURYID0gNjtcbi8vIEdyb3VwIDcgPSB0aGUgaWRlbnRpZmllciBhZnRlciBcImJpbmQtXCIsIFwibGV0LVwiLCBcInJlZi0vI1wiLCBcIm9uLVwiLCBcImJpbmRvbi1cIiBvciBcIkBcIlxuY29uc3QgSURFTlRfS1dfSURYID0gNztcbi8vIEdyb3VwIDggPSBpZGVudGlmaWVyIGluc2lkZSBbKCldXG5jb25zdCBJREVOVF9CQU5BTkFfQk9YX0lEWCA9IDg7XG4vLyBHcm91cCA5ID0gaWRlbnRpZmllciBpbnNpZGUgW11cbmNvbnN0IElERU5UX1BST1BFUlRZX0lEWCA9IDk7XG4vLyBHcm91cCAxMCA9IGlkZW50aWZpZXIgaW5zaWRlICgpXG5jb25zdCBJREVOVF9FVkVOVF9JRFggPSAxMDtcblxuY29uc3QgVEVNUExBVEVfQVRUUl9QUkVGSVggPSAnKic7XG5cbi8vIFJlc3VsdCBvZiB0aGUgaHRtbCBBU1QgdG8gSXZ5IEFTVCB0cmFuc2Zvcm1hdGlvblxuZXhwb3J0IHR5cGUgUmVuZGVyM1BhcnNlUmVzdWx0ID0ge1xuICBub2RlczogdC5Ob2RlW107IGVycm9yczogUGFyc2VFcnJvcltdO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGh0bWxBc3RUb1JlbmRlcjNBc3QoXG4gICAgaHRtbE5vZGVzOiBodG1sLk5vZGVbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFJlbmRlcjNQYXJzZVJlc3VsdCB7XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IEh0bWxBc3RUb0l2eUFzdChiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgaXZ5Tm9kZXMgPSBodG1sLnZpc2l0QWxsKHRyYW5zZm9ybWVyLCBodG1sTm9kZXMpO1xuXG4gIC8vIEVycm9ycyBtaWdodCBvcmlnaW5hdGUgaW4gZWl0aGVyIHRoZSBiaW5kaW5nIHBhcnNlciBvciB0aGUgaHRtbCB0byBpdnkgdHJhbnNmb3JtZXJcbiAgY29uc3QgYWxsRXJyb3JzID0gYmluZGluZ1BhcnNlci5lcnJvcnMuY29uY2F0KHRyYW5zZm9ybWVyLmVycm9ycyk7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gYWxsRXJyb3JzLmZpbHRlcihlID0+IGUubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG5cbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgdGhyb3cgc3ludGF4RXJyb3IoYFRlbXBsYXRlIHBhcnNlIGVycm9yczpcXG4ke2Vycm9yU3RyaW5nfWAsIGVycm9ycyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGVzOiBpdnlOb2RlcyxcbiAgICBlcnJvcnM6IGFsbEVycm9ycyxcbiAgfTtcbn1cblxuY2xhc3MgSHRtbEFzdFRvSXZ5QXN0IGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHt9XG5cbiAgLy8gSFRNTCB2aXNpdG9yXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQpOiB0Lk5vZGV8bnVsbCB7XG4gICAgY29uc3QgcHJlcGFyc2VkRWxlbWVudCA9IHByZXBhcnNlRWxlbWVudChlbGVtZW50KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSkge1xuICAgICAgLy8gU2tpcHBpbmcgPHNjcmlwdD4gZm9yIHNlY3VyaXR5IHJlYXNvbnNcbiAgICAgIC8vIFNraXBwaW5nIDxzdHlsZT4gYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUICYmXG4gICAgICAgIGlzU3R5bGVVcmxSZXNvbHZhYmxlKHByZXBhcnNlZEVsZW1lbnQuaHJlZkF0dHIpKSB7XG4gICAgICAvLyBTa2lwcGluZyBzdHlsZXNoZWV0cyB3aXRoIGVpdGhlciByZWxhdGl2ZSB1cmxzIG9yIHBhY2thZ2Ugc2NoZW1lIGFzIHdlIGFscmVhZHkgcHJvY2Vzc2VkXG4gICAgICAvLyB0aGVtIGluIHRoZSBTdHlsZUNvbXBpbGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGlzIGEgYDxuZy10ZW1wbGF0ZT5gXG4gICAgY29uc3QgaXNUZW1wbGF0ZUVsZW1lbnQgPSBpc05nVGVtcGxhdGUoZWxlbWVudC5uYW1lKTtcblxuICAgIGNvbnN0IHBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGkxOG5BdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBpMThuLkFTVH0gPSB7fTtcblxuICAgIGNvbnN0IHRlbXBsYXRlUGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IHRlbXBsYXRlVmFyaWFibGVzOiB0LlZhcmlhYmxlW10gPSBbXTtcblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaGFzIGFueSAqLWF0dHJpYnV0ZVxuICAgIGxldCBlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgYXR0cmlidXRlIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG4gICAgICBjb25zdCBub3JtYWxpemVkTmFtZSA9IG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0cmlidXRlLm5hbWUpO1xuXG4gICAgICAvLyBgKmF0dHJgIGRlZmluZXMgdGVtcGxhdGUgYmluZGluZ3NcbiAgICAgIGxldCBpc1RlbXBsYXRlQmluZGluZyA9IGZhbHNlO1xuXG4gICAgICBpZiAoYXR0cmlidXRlLmkxOG4pIHtcbiAgICAgICAgaTE4bkF0dHJzTWV0YVthdHRyaWJ1dGUubmFtZV0gPSBhdHRyaWJ1dGUuaTE4bjtcbiAgICAgIH1cblxuICAgICAgaWYgKG5vcm1hbGl6ZWROYW1lLnN0YXJ0c1dpdGgoVEVNUExBVEVfQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIC8vICotYXR0cmlidXRlc1xuICAgICAgICBpZiAoZWxlbWVudEhhc0lubGluZVRlbXBsYXRlKSB7XG4gICAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYENhbid0IGhhdmUgbXVsdGlwbGUgdGVtcGxhdGUgYmluZGluZ3Mgb24gb25lIGVsZW1lbnQuIFVzZSBvbmx5IG9uZSBhdHRyaWJ1dGUgcHJlZml4ZWQgd2l0aCAqYCxcbiAgICAgICAgICAgICAgYXR0cmlidXRlLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGlzVGVtcGxhdGVCaW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWYWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVLZXkgPSBub3JtYWxpemVkTmFtZS5zdWJzdHJpbmcoVEVNUExBVEVfQVRUUl9QUkVGSVgubGVuZ3RoKTtcblxuICAgICAgICBjb25zdCBwYXJzZWRWYXJpYWJsZXM6IFBhcnNlZFZhcmlhYmxlW10gPSBbXTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXksIHRlbXBsYXRlVmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBbXSwgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLFxuICAgICAgICAgICAgcGFyc2VkVmFyaWFibGVzKTtcbiAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMucHVzaChcbiAgICAgICAgICAgIC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiBuZXcgdC5WYXJpYWJsZSh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3BhbikpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciB2YXJpYWJsZXMsIGV2ZW50cywgcHJvcGVydHkgYmluZGluZ3MsIGludGVycG9sYXRpb25cbiAgICAgICAgaGFzQmluZGluZyA9IHRoaXMucGFyc2VBdHRyaWJ1dGUoXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgYXR0cmlidXRlLCBbXSwgcGFyc2VkUHJvcGVydGllcywgYm91bmRFdmVudHMsIHZhcmlhYmxlcywgcmVmZXJlbmNlcyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSBhcyB0LlRleHRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiYgIWVsZW1lbnQuY2hpbGRyZW4uZXZlcnkoaXNFbXB0eVRleHROb2RlKSkge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGA8bmctY29udGVudD4gZWxlbWVudCBjYW5ub3QgaGF2ZSBjb250ZW50LmAsIGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWxlY3RvciA9IHByZXBhcnNlZEVsZW1lbnQuc2VsZWN0QXR0cjtcbiAgICAgIGNvbnN0IGF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IGVsZW1lbnQuYXR0cnMubWFwKGF0dHIgPT4gdGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyKSk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuQ29udGVudChzZWxlY3RvciwgYXR0cnMsIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmBcbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcyhlbGVtZW50Lm5hbWUsIHBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIGNoaWxkcmVuLCByZWZlcmVuY2VzLCB2YXJpYWJsZXMsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhdHRycyA9IHRoaXMuZXh0cmFjdEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzLCBpMThuQXR0cnNNZXRhKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbGVtZW50KFxuICAgICAgICAgIGVsZW1lbnQubmFtZSwgYXR0cmlidXRlcywgYXR0cnMuYm91bmQsIGJvdW5kRXZlbnRzLCBjaGlsZHJlbiwgcmVmZXJlbmNlcyxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4bik7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG4gICAgICAvLyBUT0RPKHBrKTogdGVzdCBmb3IgdGhpcyBjYXNlXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgKHBhcnNlZEVsZW1lbnQgYXMgdC5FbGVtZW50KS5uYW1lLCBhdHRycy5saXRlcmFsLCBhdHRycy5ib3VuZCwgW10sIFtwYXJzZWRFbGVtZW50XSwgW10sXG4gICAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMsIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LmkxOG4pO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkRWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiB0LlRleHRBdHRyaWJ1dGUge1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICBhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgYXR0cmlidXRlLmkxOG4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuTm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbiwgdGV4dC5pMThuKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24pOiB0LkljdXxudWxsIHtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG4gYXMgaTE4bi5NZXNzYWdlO1xuICAgIC8vIGRvIG5vdCBnZW5lcmF0ZSBJY3UgaW4gY2FzZSBpdCB3YXMgY3JlYXRlZFxuICAgIC8vIG91dHNpZGUgb2YgaTE4biBibG9jayBpbiBhIHRlbXBsYXRlXG4gICAgaWYgKCFtZXRhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgdmFyczoge1tuYW1lOiBzdHJpbmddOiB0LkJvdW5kVGV4dH0gPSB7fTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnM6IHtbbmFtZTogc3RyaW5nXTogdC5UZXh0IHwgdC5Cb3VuZFRleHR9ID0ge307XG4gICAgLy8gZXh0cmFjdCBWQVJzIGZyb20gSUNVcyAtIHdlIHByb2Nlc3MgdGhlbSBzZXBhcmF0ZWx5IHdoaWxlXG4gICAgLy8gYXNzZW1ibGluZyByZXN1bHRpbmcgbWVzc2FnZSB2aWEgZ29vZy5nZXRNc2cgZnVuY3Rpb24sIHNpbmNlXG4gICAgLy8gd2UgbmVlZCB0byBwYXNzIHRoZW0gdG8gdG9wLWxldmVsIGdvb2cuZ2V0TXNnIGNhbGxcbiAgICBPYmplY3Qua2V5cyhtZXRhLnBsYWNlaG9sZGVycykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBtZXRhLnBsYWNlaG9sZGVyc1trZXldO1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKEkxOE5fSUNVX1ZBUl9QUkVGSVgpKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuYmluZGluZ1BhcnNlci5pbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAgICAgICAvLyBJQ1UgZXhwcmVzc2lvbiBpcyBhIHBsYWluIHN0cmluZywgbm90IHdyYXBwZWQgaW50byBzdGFydFxuICAgICAgICAvLyBhbmQgZW5kIHRhZ3MsIHNvIHdlIHdyYXAgaXQgYmVmb3JlIHBhc3NpbmcgdG8gYmluZGluZyBwYXJzZXJcbiAgICAgICAgY29uc3Qgd3JhcHBlZCA9IGAke2NvbmZpZy5zdGFydH0ke3ZhbHVlfSR7Y29uZmlnLmVuZH1gO1xuICAgICAgICB2YXJzW2tleV0gPSB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih3cmFwcGVkLCBleHBhbnNpb24uc291cmNlU3BhbikgYXMgdC5Cb3VuZFRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwbGFjZWhvbGRlcnNba2V5XSA9IHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHZhbHVlLCBleHBhbnNpb24uc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyB0LkljdSh2YXJzLCBwbGFjZWhvbGRlcnMsIGV4cGFuc2lvbi5zb3VyY2VTcGFuLCBtZXRhKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBudWxsIHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogbnVsbCB7IHJldHVybiBudWxsOyB9XG5cbiAgLy8gY29udmVydCB2aWV3IGVuZ2luZSBgUGFyc2VkUHJvcGVydHlgIHRvIGEgZm9ybWF0IHN1aXRhYmxlIGZvciBJVllcbiAgcHJpdmF0ZSBleHRyYWN0QXR0cmlidXRlcyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sIGkxOG5Qcm9wc01ldGE6IHtba2V5OiBzdHJpbmddOiBpMThuLkFTVH0pOlxuICAgICAge2JvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10sIGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdfSB7XG4gICAgY29uc3QgYm91bmQ6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBjb25zdCBpMThuID0gaTE4blByb3BzTWV0YVtwcm9wLm5hbWVdO1xuICAgICAgaWYgKHByb3AuaXNMaXRlcmFsKSB7XG4gICAgICAgIGxpdGVyYWwucHVzaChuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICAgICAgcHJvcC5uYW1lLCBwcm9wLmV4cHJlc3Npb24uc291cmNlIHx8ICcnLCBwcm9wLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgaTE4bikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2Ugc2tpcCB2YWxpZGF0aW9uIGhlcmUsIHNpbmNlIHdlIGRvIHRoaXMgY2hlY2sgYXQgcnVudGltZSBkdWUgdG8gdGhlIGZhY3QgdGhhdCB3ZSBuZWVkXG4gICAgICAgIC8vIHRvIG1ha2Ugc3VyZSBhIGdpdmVuIHByb3AgaXMgbm90IGFuIGlucHV0IG9mIHNvbWUgRGlyZWN0aXZlICh0aHVzIHNob3VsZCBub3QgYmUgYSBzdWJqZWN0XG4gICAgICAgIC8vIG9mIHRoaXMgY2hlY2spIGFuZCBEaXJlY3RpdmUgbWF0Y2hpbmcgaGFwcGVucyBhdCBydW50aW1lXG4gICAgICAgIGNvbnN0IGJlcCA9IHRoaXMuYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShcbiAgICAgICAgICAgIGVsZW1lbnROYW1lLCBwcm9wLCAvKiBza2lwVmFsaWRhdGlvbiAqLyB0cnVlKTtcbiAgICAgICAgYm91bmQucHVzaCh0LkJvdW5kQXR0cmlidXRlLmZyb21Cb3VuZEVsZW1lbnRQcm9wZXJ0eShiZXAsIGkxOG4pKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7Ym91bmQsIGxpdGVyYWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuXG4gICAgY29uc3QgYmluZFBhcnRzID0gbmFtZS5tYXRjaChCSU5EX05BTUVfUkVHRVhQKTtcbiAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaGFzQmluZGluZyA9IHRydWU7XG4gICAgICBpZiAoYmluZFBhcnRzW0tXX0JJTkRfSURYXSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19MRVRfSURYXSkge1xuICAgICAgICBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgICAgdGhpcy5wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB2YXJpYWJsZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwibGV0LVwiIGlzIG9ubHkgc3VwcG9ydGVkIG9uIG5nLXRlbXBsYXRlIGVsZW1lbnRzLmAsIHNyY1NwYW4pO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX1JFRl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgdGhpcy5wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgcmVmZXJlbmNlcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IHNyY1NwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBldmVudHMpO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0FUX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfRVZFTlRfSURYXSkge1xuICAgICAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfRVZFTlRfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGV2ZW50cyk7XG4gICAgICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaGFzQmluZGluZyA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc0JpbmRpbmc7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGkxOG4/OiBpMThuLkFTVCk6XG4gICAgICB0LlRleHR8dC5Cb3VuZFRleHQge1xuICAgIGNvbnN0IHZhbHVlTm9OZ3NwID0gcmVwbGFjZU5nc3AodmFsdWUpO1xuICAgIGNvbnN0IGV4cHIgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlTm9OZ3NwLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dChleHByLCBzb3VyY2VTcGFuLCBpMThuKSA6IG5ldyB0LlRleHQodmFsdWVOb05nc3AsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVZhcmlhYmxlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHZhcmlhYmxlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfVxuICAgIHZhcmlhYmxlcy5wdXNoKG5ldyB0LlZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gcmVmZXJlbmNlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgcmVmZXJlbmNlcy5wdXNoKG5ldyB0LlJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLFxuICAgICAgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgIGAke25hbWV9Q2hhbmdlYCwgYCR7ZXhwcmVzc2lvbn09JGV2ZW50YCwgc291cmNlU3BhbiwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sXG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBldmVudHMpO1xuICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogdC5FbGVtZW50fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIG51bGwpO1xuICAgIHJldHVybiBuZXcgdC5FbGVtZW50KFxuICAgICAgICBhc3QubmFtZSwgaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuYXR0cnMpIGFzIHQuVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgICAvKiBpbnB1dHMgKi9bXSwgLyogb3V0cHV0cyAqL1tdLCBjaGlsZHJlbizCoCAvKiByZWZlcmVuY2VzICovW10sIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgYXR0cmlidXRlLmkxOG4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuVGV4dCB7IHJldHVybiBuZXcgdC5UZXh0KHRleHQudmFsdWUsIHRleHQuc291cmNlU3Bhbik7IH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHsgcmV0dXJuIG51bGw7IH1cbn1cblxuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0ck5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiAvXmRhdGEtL2kudGVzdChhdHRyTmFtZSkgPyBhdHRyTmFtZS5zdWJzdHJpbmcoNSkgOiBhdHRyTmFtZTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRzKGV2ZW50czogUGFyc2VkRXZlbnRbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gIGJvdW5kRXZlbnRzLnB1c2goLi4uZXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcbn1cblxuZnVuY3Rpb24gaXNFbXB0eVRleHROb2RlKG5vZGU6IGh0bWwuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIGh0bWwuVGV4dCAmJiBub2RlLnZhbHVlLnRyaW0oKS5sZW5ndGggPT0gMDtcbn1cbiJdfQ==