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
import * as t from './r3_ast';
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
var CLASS_ATTR = 'class';
// Default selector used by `<ng-content>` if none specified
var DEFAULT_CONTENT_SELECTOR = '*';
var HtmlToTemplateTransform = /** @class */ (function () {
    function HtmlToTemplateTransform(bindingParser) {
        this.bindingParser = bindingParser;
        // Selectors for the `ng-content` tags. Only non `*` selectors are recorded here
        this.ngContentSelectors = [];
        // Any `<ng-content>` in the template ?
        this.hasNgContent = false;
    }
    // HTML visitor
    HtmlToTemplateTransform.prototype.visitElement = function (element) {
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
        var matchableAttributes = [];
        var parsedProperties = [];
        var boundEvents = [];
        var variables = [];
        var references = [];
        var attributes = [];
        var templateMatchableAttributes = [];
        var inlineTemplateSourceSpan;
        var templateParsedProperties = [];
        var templateVariables = [];
        // Whether the element has any *-attribute
        var elementHasInlineTemplate = false;
        try {
            for (var _a = tslib_1.__values(element.attrs), _b = _a.next(); !_b.done; _b = _a.next()) {
                var attribute = _b.value;
                var hasBinding = false;
                var normalizedName = normalizeAttributeName(attribute.name);
                // `*attr` defines template bindings
                var isTemplateBinding = false;
                if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                    if (elementHasInlineTemplate) {
                        this.reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attribute.sourceSpan);
                    }
                    isTemplateBinding = true;
                    elementHasInlineTemplate = true;
                    var templateValue = attribute.value;
                    var templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                    inlineTemplateSourceSpan = attribute.valueSpan || attribute.sourceSpan;
                    this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, templateMatchableAttributes, templateParsedProperties, templateVariables);
                }
                else {
                    // Check for variables, events, property bindings, interpolation
                    hasBinding = this.parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references);
                }
                if (!hasBinding && !isTemplateBinding) {
                    // don't include the bindings as attributes as well in the AST
                    attributes.push(this.visitAttribute(attribute));
                    matchableAttributes.push([attribute.name, attribute.value]);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
        var parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>`
            this.hasNgContent = true;
            if (element.children && !element.children.every(isEmptyTextNode)) {
                this.reportError("<ng-content> element cannot have content.", element.sourceSpan);
            }
            var selector = preparsedElement.selectAttr;
            var attributes_1 = element.attrs.map(function (attribute) {
                return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
            });
            var selectorIndex = selector === DEFAULT_CONTENT_SELECTOR ? 0 : this.ngContentSelectors.push(selector);
            parsedElement = new t.Content(selectorIndex, attributes_1, element.sourceSpan);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            var boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Template(attributes, boundAttributes, children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        else {
            var boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Element(element.name, attributes, boundAttributes, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        if (elementHasInlineTemplate) {
            var attributes_2 = [];
            templateMatchableAttributes.forEach(function (_a) {
                var _b = tslib_1.__read(_a, 2), name = _b[0], value = _b[1];
                return attributes_2.push(new t.TextAttribute(name, value, inlineTemplateSourceSpan));
            });
            var boundAttributes = this.createBoundAttributes('ng-template', templateParsedProperties);
            parsedElement = new t.Template(attributes_2, boundAttributes, [parsedElement], [], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        return parsedElement;
        var e_1, _c;
    };
    HtmlToTemplateTransform.prototype.visitAttribute = function (attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
    };
    HtmlToTemplateTransform.prototype.visitText = function (text) {
        var valueNoNgsp = replaceNgsp(text.value);
        var expr = this.bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
        return expr ? new t.BoundText(expr, text.sourceSpan) : new t.Text(valueNoNgsp, text.sourceSpan);
    };
    HtmlToTemplateTransform.prototype.visitComment = function (comment) { return null; };
    HtmlToTemplateTransform.prototype.visitExpansion = function (expansion) { return null; };
    HtmlToTemplateTransform.prototype.visitExpansionCase = function (expansionCase) { return null; };
    HtmlToTemplateTransform.prototype.createBoundAttributes = function (elementName, properties) {
        var _this = this;
        return properties.filter(function (prop) { return !prop.isLiteral; })
            .map(function (prop) { return _this.bindingParser.createBoundElementProperty(elementName, prop); })
            .map(function (prop) { return t.BoundAttribute.fromBoundElementProperty(prop); });
    };
    HtmlToTemplateTransform.prototype.parseAttribute = function (isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
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
                this.bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this.bindingParser.parseLiteralAttr(name, value, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                var events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, matchableAttributes, parsedProperties);
        }
        return hasBinding;
    };
    HtmlToTemplateTransform.prototype.parseVariable = function (identifier, value, sourceSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in variable names", sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan));
    };
    HtmlToTemplateTransform.prototype.parseReference = function (identifier, value, sourceSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in reference names", sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan));
    };
    HtmlToTemplateTransform.prototype.parseAssignmentEvent = function (name, expression, sourceSpan, targetMatchableAttrs, boundEvents) {
        var events = [];
        this.bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, targetMatchableAttrs, events);
        addEvents(events, boundEvents);
    };
    HtmlToTemplateTransform.prototype.reportError = function (message, sourceSpan, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this.errors.push(new ParseError(sourceSpan, message, level));
    };
    return HtmlToTemplateTransform;
}());
export { HtmlToTemplateTransform };
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
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFHSCxPQUFPLEtBQUssSUFBSSxNQUFNLGtCQUFrQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDL0MsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQWtCLE1BQU0sZUFBZSxDQUFDO0FBQzNFLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTNELE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxlQUFlLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUU1RixPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUU5QixJQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztBQUUvRyxvQkFBb0I7QUFDcEIsSUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLG1CQUFtQjtBQUNuQixJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDckIscUJBQXFCO0FBQ3JCLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztBQUNyQixrQkFBa0I7QUFDbEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLHNCQUFzQjtBQUN0QixJQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFDeEIsZ0JBQWdCO0FBQ2hCLElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixvRkFBb0Y7QUFDcEYsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLG1DQUFtQztBQUNuQyxJQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FB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Q0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNyRSxDQUFDO0FBRUQsbUJBQW1CLE1BQXFCLEVBQUUsV0FBMkI7SUFDbkUsV0FBVyxDQUFDLElBQUksT0FBaEIsV0FBVyxtQkFBUyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQS9CLENBQStCLENBQUMsR0FBRTtBQUN4RSxDQUFDO0FBRUQseUJBQXlCLElBQWU7SUFDdEMsTUFBTSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztBQUNwRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlZEV2ZW50LCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtyZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc1N0eWxlVXJsUmVzb2x2YWJsZX0gZnJvbSAnLi4vc3R5bGVfdXJsX3Jlc29sdmVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3ByZXBhcnNlcic7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4rKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuY29uc3QgQ0xBU1NfQVRUUiA9ICdjbGFzcyc7XG4vLyBEZWZhdWx0IHNlbGVjdG9yIHVzZWQgYnkgYDxuZy1jb250ZW50PmAgaWYgbm9uZSBzcGVjaWZpZWRcbmNvbnN0IERFRkFVTFRfQ09OVEVOVF9TRUxFQ1RPUiA9ICcqJztcblxuZXhwb3J0IGNsYXNzIEh0bWxUb1RlbXBsYXRlVHJhbnNmb3JtIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW107XG5cbiAgLy8gU2VsZWN0b3JzIGZvciB0aGUgYG5nLWNvbnRlbnRgIHRhZ3MuIE9ubHkgbm9uIGAqYCBzZWxlY3RvcnMgYXJlIHJlY29yZGVkIGhlcmVcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdO1xuICAvLyBBbnkgYDxuZy1jb250ZW50PmAgaW4gdGhlIHRlbXBsYXRlID9cbiAgaGFzTmdDb250ZW50ID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7fVxuXG4gIC8vIEhUTUwgdmlzaXRvclxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50KTogdC5Ob2RlfG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoZWxlbWVudCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFzIHdlIGFscmVhZHkgcHJvY2Vzc2VkIHRoZW1cbiAgICAgIC8vIGluIHRoZSBTdHlsZUNvbXBpbGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEVTSEVFVCAmJlxuICAgICAgICBpc1N0eWxlVXJsUmVzb2x2YWJsZShwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKSkge1xuICAgICAgLy8gU2tpcHBpbmcgc3R5bGVzaGVldHMgd2l0aCBlaXRoZXIgcmVsYXRpdmUgdXJscyBvciBwYWNrYWdlIHNjaGVtZSBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZFxuICAgICAgLy8gdGhlbSBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gV2hldGhlciB0aGUgZWxlbWVudCBpcyBhIGA8bmctdGVtcGxhdGU+YFxuICAgIGNvbnN0IGlzVGVtcGxhdGVFbGVtZW50ID0gaXNOZ1RlbXBsYXRlKGVsZW1lbnQubmFtZSk7XG5cbiAgICBjb25zdCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBwYXJzZWRQcm9wZXJ0aWVzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG4gICAgY29uc3QgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdID0gW107XG4gICAgY29uc3QgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10gPSBbXTtcbiAgICBjb25zdCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdID0gW107XG4gICAgY29uc3QgYXR0cmlidXRlczogdC5UZXh0QXR0cmlidXRlW10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlTWF0Y2hhYmxlQXR0cmlidXRlczogW3N0cmluZywgc3RyaW5nXVtdID0gW107XG4gICAgbGV0IGlubGluZVRlbXBsYXRlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICAgIGNvbnN0IHRlbXBsYXRlUGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IHRlbXBsYXRlVmFyaWFibGVzOiB0LlZhcmlhYmxlW10gPSBbXTtcblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaGFzIGFueSAqLWF0dHJpYnV0ZVxuICAgIGxldCBlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgYXR0cmlidXRlIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG4gICAgICBjb25zdCBub3JtYWxpemVkTmFtZSA9IG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0cmlidXRlLm5hbWUpO1xuXG4gICAgICAvLyBgKmF0dHJgIGRlZmluZXMgdGVtcGxhdGUgYmluZGluZ3NcbiAgICAgIGxldCBpc1RlbXBsYXRlQmluZGluZyA9IGZhbHNlO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBDYW4ndCBoYXZlIG11bHRpcGxlIHRlbXBsYXRlIGJpbmRpbmdzIG9uIG9uZSBlbGVtZW50LiBVc2Ugb25seSBvbmUgYXR0cmlidXRlIHByZWZpeGVkIHdpdGggKmAsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgICBpc1RlbXBsYXRlQmluZGluZyA9IHRydWU7XG4gICAgICAgIGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG5cbiAgICAgICAgaW5saW5lVGVtcGxhdGVTb3VyY2VTcGFuID0gYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBhdHRyaWJ1dGUuc291cmNlU3BhbjtcblxuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgICB0ZW1wbGF0ZUtleSwgdGVtcGxhdGVWYWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcywgdGVtcGxhdGVWYXJpYWJsZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQ2hlY2sgZm9yIHZhcmlhYmxlcywgZXZlbnRzLCBwcm9wZXJ0eSBiaW5kaW5ncywgaW50ZXJwb2xhdGlvblxuICAgICAgICBoYXNCaW5kaW5nID0gdGhpcy5wYXJzZUF0dHJpYnV0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyaWJ1dGUsIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMsIGJvdW5kRXZlbnRzLFxuICAgICAgICAgICAgdmFyaWFibGVzLCByZWZlcmVuY2VzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFoYXNCaW5kaW5nICYmICFpc1RlbXBsYXRlQmluZGluZykge1xuICAgICAgICAvLyBkb24ndCBpbmNsdWRlIHRoZSBiaW5kaW5ncyBhcyBhdHRyaWJ1dGVzIGFzIHdlbGwgaW4gdGhlIEFTVFxuICAgICAgICBhdHRyaWJ1dGVzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGUpIGFzIHQuVGV4dEF0dHJpYnV0ZSk7XG4gICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMucHVzaChbYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgdGhpcy5oYXNOZ0NvbnRlbnQgPSB0cnVlO1xuXG4gICAgICBpZiAoZWxlbWVudC5jaGlsZHJlbiAmJiAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShpc0VtcHR5VGV4dE5vZGUpKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBwcmVwYXJzZWRFbGVtZW50LnNlbGVjdEF0dHI7XG5cbiAgICAgIGxldCBhdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IGVsZW1lbnQuYXR0cnMubWFwKGF0dHJpYnV0ZSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHNlbGVjdG9ySW5kZXggPVxuICAgICAgICAgIHNlbGVjdG9yID09PSBERUZBVUxUX0NPTlRFTlRfU0VMRUNUT1IgPyAwIDogdGhpcy5uZ0NvbnRlbnRTZWxlY3RvcnMucHVzaChzZWxlY3Rvcik7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuQ29udGVudChzZWxlY3RvckluZGV4LCBhdHRyaWJ1dGVzLCBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgIC8vIGA8bmctdGVtcGxhdGU+YFxuICAgICAgY29uc3QgYm91bmRBdHRyaWJ1dGVzID0gdGhpcy5jcmVhdGVCb3VuZEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICBhdHRyaWJ1dGVzLCBib3VuZEF0dHJpYnV0ZXMsIGNoaWxkcmVuLCByZWZlcmVuY2VzLCB2YXJpYWJsZXMsIGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYm91bmRBdHRyaWJ1dGVzID0gdGhpcy5jcmVhdGVCb3VuZEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVsZW1lbnQoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBib3VuZEF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzLCBjaGlsZHJlbiwgcmVmZXJlbmNlcyxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICAgIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cmlidXRlcy5mb3JFYWNoKFxuICAgICAgICAgIChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2gobmV3IHQuVGV4dEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSwgaW5saW5lVGVtcGxhdGVTb3VyY2VTcGFuKSkpO1xuXG4gICAgICBjb25zdCBib3VuZEF0dHJpYnV0ZXMgPSB0aGlzLmNyZWF0ZUJvdW5kQXR0cmlidXRlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXMpO1xuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LlRlbXBsYXRlKFxuICAgICAgICAgIGF0dHJpYnV0ZXMsIGJvdW5kQXR0cmlidXRlcywgW3BhcnNlZEVsZW1lbnRdLCBbXSwgdGVtcGxhdGVWYXJpYWJsZXMsIGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZEVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5Ob2RlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuTm9kZSB7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh0ZXh0LnZhbHVlKTtcbiAgICBjb25zdCBleHByID0gdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZU5vTmdzcCwgdGV4dC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dChleHByLCB0ZXh0LnNvdXJjZVNwYW4pIDogbmV3IHQuVGV4dCh2YWx1ZU5vTmdzcCwgdGV4dC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBudWxsIHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogbnVsbCB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IG51bGwgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHByaXZhdGUgY3JlYXRlQm91bmRBdHRyaWJ1dGVzKGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10pOlxuICAgICAgdC5Cb3VuZEF0dHJpYnV0ZVtdIHtcbiAgICByZXR1cm4gcHJvcGVydGllcy5maWx0ZXIocHJvcCA9PiAhcHJvcC5pc0xpdGVyYWwpXG4gICAgICAgIC5tYXAocHJvcCA9PiB0aGlzLmJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudE5hbWUsIHByb3ApKVxuICAgICAgICAubWFwKHByb3AgPT4gdC5Cb3VuZEF0dHJpYnV0ZS5mcm9tQm91bmRFbGVtZW50UHJvcGVydHkocHJvcCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuXG4gICAgY29uc3QgYmluZFBhcnRzID0gbmFtZS5tYXRjaChCSU5EX05BTUVfUkVHRVhQKTtcbiAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaGFzQmluZGluZyA9IHRydWU7XG4gICAgICBpZiAoYmluZFBhcnRzW0tXX0JJTkRfSURYXSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19MRVRfSURYXSkge1xuICAgICAgICBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgICAgdGhpcy5wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB2YXJpYWJsZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwibGV0LVwiIGlzIG9ubHkgc3VwcG9ydGVkIG9uIG5nLXRlbXBsYXRlIGVsZW1lbnRzLmAsIHNyY1NwYW4pO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX1JFRl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgdGhpcy5wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgcmVmZXJlbmNlcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBldmVudHMpO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgYm91bmRFdmVudHMpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIHBhcnNlZFByb3BlcnRpZXMpO1xuICAgICAgICB0aGlzLnBhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSwgdmFsdWUsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLFxuICAgICAgICAgICAgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0pIHtcbiAgICAgICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBldmVudHMpO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBoYXNCaW5kaW5nO1xuICB9XG5cblxuICBwcml2YXRlIHBhcnNlVmFyaWFibGUoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gdmFyaWFibGUgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG4gICAgdmFyaWFibGVzLnB1c2gobmV3IHQuVmFyaWFibGUoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VSZWZlcmVuY2UoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiByZWZlcmVuY2UgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICByZWZlcmVuY2VzLnB1c2gobmV3IHQuUmVmZXJlbmNlKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10pIHtcbiAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgYCR7bmFtZX1DaGFuZ2VgLCBgJHtleHByZXNzaW9ufT0kZXZlbnRgLCBzb3VyY2VTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgZXZlbnRzKTtcbiAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCk6IHQuRWxlbWVudHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9IGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuLCBudWxsKTtcbiAgICByZXR1cm4gbmV3IHQuRWxlbWVudChcbiAgICAgICAgYXN0Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmF0dHJzKSBhcyB0LlRleHRBdHRyaWJ1dGVbXSxcbiAgICAgICAgLyogaW5wdXRzICovW10sIC8qIG91dHB1dHMgKi9bXSwgY2hpbGRyZW4swqAgLyogcmVmZXJlbmNlcyAqL1tdLCBhc3Quc291cmNlU3BhbixcbiAgICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IHQuVGV4dEF0dHJpYnV0ZSB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHRBdHRyaWJ1dGUoYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuVGV4dCB7IHJldHVybiBuZXcgdC5UZXh0KHRleHQudmFsdWUsIHRleHQuc291cmNlU3Bhbik7IH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHsgcmV0dXJuIG51bGw7IH1cbn1cblxuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0ck5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiAvXmRhdGEtL2kudGVzdChhdHRyTmFtZSkgPyBhdHRyTmFtZS5zdWJzdHJpbmcoNSkgOiBhdHRyTmFtZTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRzKGV2ZW50czogUGFyc2VkRXZlbnRbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gIGJvdW5kRXZlbnRzLnB1c2goLi4uZXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcbn1cblxuZnVuY3Rpb24gaXNFbXB0eVRleHROb2RlKG5vZGU6IGh0bWwuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIGh0bWwuVGV4dCAmJiBub2RlLnZhbHVlLnRyaW0oKS5sZW5ndGggPT0gMDtcbn1cbiJdfQ==