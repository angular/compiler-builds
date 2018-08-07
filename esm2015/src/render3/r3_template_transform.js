/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { replaceNgsp } from '../ml_parser/html_whitespaces';
import { isNgTemplate } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel } from '../parse_util';
import { isStyleUrlResolvable } from '../style_url_resolver';
import { PreparsedElementType, preparseElement } from '../template_parser/template_preparser';
import { syntaxError } from '../util';
import * as t from './r3_ast';
const BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
// Group 1 = "bind-"
const KW_BIND_IDX = 1;
// Group 2 = "let-"
const KW_LET_IDX = 2;
// Group 3 = "ref-/#"
const KW_REF_IDX = 3;
// Group 4 = "on-"
const KW_ON_IDX = 4;
// Group 5 = "bindon-"
const KW_BINDON_IDX = 5;
// Group 6 = "@"
const KW_AT_IDX = 6;
// Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
const IDENT_KW_IDX = 7;
// Group 8 = identifier inside [()]
const IDENT_BANANA_BOX_IDX = 8;
// Group 9 = identifier inside []
const IDENT_PROPERTY_IDX = 9;
// Group 10 = identifier inside ()
const IDENT_EVENT_IDX = 10;
const TEMPLATE_ATTR_PREFIX = '*';
// Default selector used by `<ng-content>` if none specified
const DEFAULT_CONTENT_SELECTOR = '*';
export function htmlAstToRender3Ast(htmlNodes, bindingParser) {
    const transformer = new HtmlAstToIvyAst(bindingParser);
    const ivyNodes = html.visitAll(transformer, htmlNodes);
    // Errors might originate in either the binding parser or the html to ivy transformer
    const allErrors = bindingParser.errors.concat(transformer.errors);
    const errors = allErrors.filter(e => e.level === ParseErrorLevel.ERROR);
    if (errors.length > 0) {
        const errorString = errors.join('\n');
        throw syntaxError(`Template parse errors:\n${errorString}`, errors);
    }
    return {
        nodes: ivyNodes,
        errors: allErrors,
        ngContentSelectors: transformer.ngContentSelectors,
        hasNgContent: transformer.hasNgContent,
    };
}
class HtmlAstToIvyAst {
    constructor(bindingParser) {
        this.bindingParser = bindingParser;
        this.errors = [];
        // Selectors for the `ng-content` tags. Only non `*` selectors are recorded here
        this.ngContentSelectors = [];
        // Any `<ng-content>` in the template ?
        this.hasNgContent = false;
    }
    // HTML visitor
    visitElement(element) {
        const preparsedElement = preparseElement(element);
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
        const isTemplateElement = isNgTemplate(element.name);
        const parsedProperties = [];
        const boundEvents = [];
        const variables = [];
        const references = [];
        const attributes = [];
        const templateParsedProperties = [];
        const templateVariables = [];
        // Whether the element has any *-attribute
        let elementHasInlineTemplate = false;
        for (const attribute of element.attrs) {
            let hasBinding = false;
            const normalizedName = normalizeAttributeName(attribute.name);
            // `*attr` defines template bindings
            let isTemplateBinding = false;
            if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                // *-attributes
                if (elementHasInlineTemplate) {
                    this.reportError(`Can't have multiple template bindings on one element. Use only one attribute prefixed with *`, attribute.sourceSpan);
                }
                isTemplateBinding = true;
                elementHasInlineTemplate = true;
                const templateValue = attribute.value;
                const templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                const parsedVariables = [];
                this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, [], templateParsedProperties, parsedVariables);
                templateVariables.push(...parsedVariables.map(v => new t.Variable(v.name, v.value, v.sourceSpan)));
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
        const children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
        let parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>`
            this.hasNgContent = true;
            if (element.children && !element.children.every(isEmptyTextNode)) {
                this.reportError(`<ng-content> element cannot have content.`, element.sourceSpan);
            }
            const selector = preparsedElement.selectAttr;
            let attributes = element.attrs.map(attribute => this.visitAttribute(attribute));
            const selectorIndex = selector === DEFAULT_CONTENT_SELECTOR ? 0 : this.ngContentSelectors.push(selector);
            parsedElement = new t.Content(selectorIndex, attributes, element.sourceSpan);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            const attrs = this.extractAttributes(element.name, parsedProperties);
            parsedElement = new t.Template(attributes, attrs.bound, children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        else {
            const attrs = this.extractAttributes(element.name, parsedProperties);
            parsedElement = new t.Element(element.name, attributes, attrs.bound, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        if (elementHasInlineTemplate) {
            const attrs = this.extractAttributes('ng-template', templateParsedProperties);
            parsedElement = new t.Template(attrs.literal, attrs.bound, [parsedElement], [], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        return parsedElement;
    }
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
    }
    visitText(text) {
        const valueNoNgsp = replaceNgsp(text.value);
        const expr = this.bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
        return expr ? new t.BoundText(expr, text.sourceSpan) : new t.Text(valueNoNgsp, text.sourceSpan);
    }
    visitComment(comment) { return null; }
    visitExpansion(expansion) { return null; }
    visitExpansionCase(expansionCase) { return null; }
    // convert view engine `ParsedProperty` to a format suitable for IVY
    extractAttributes(elementName, properties) {
        const bound = [];
        const literal = [];
        properties.forEach(prop => {
            if (prop.isLiteral) {
                literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan));
            }
            else {
                const bep = this.bindingParser.createBoundElementProperty(elementName, prop);
                bound.push(t.BoundAttribute.fromBoundElementProperty(bep));
            }
        });
        return { bound, literal };
    }
    parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
        const name = normalizeAttributeName(attribute.name);
        const value = attribute.value;
        const srcSpan = attribute.sourceSpan;
        const bindParts = name.match(BIND_NAME_REGEXP);
        let hasBinding = false;
        if (bindParts) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    const identifier = bindParts[IDENT_KW_IDX];
                    this.parseVariable(identifier, value, srcSpan, variables);
                }
                else {
                    this.reportError(`"let-" is only supported on ng-template elements.`, srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                const identifier = bindParts[IDENT_KW_IDX];
                this.parseReference(identifier, value, srcSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                const events = [];
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
                const events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, matchableAttributes, parsedProperties);
        }
        return hasBinding;
    }
    parseVariable(identifier, value, sourceSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in variable names`, sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan));
    }
    parseReference(identifier, value, sourceSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan));
    }
    parseAssignmentEvent(name, expression, sourceSpan, targetMatchableAttrs, boundEvents) {
        const events = [];
        this.bindingParser.parseEvent(`${name}Change`, `${expression}=$event`, sourceSpan, targetMatchableAttrs, events);
        addEvents(events, boundEvents);
    }
    reportError(message, sourceSpan, level = ParseErrorLevel.ERROR) {
        this.errors.push(new ParseError(sourceSpan, message, level));
    }
}
class NonBindableVisitor {
    visitElement(ast) {
        const preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        const children = html.visitAll(this, ast.children, null);
        return new t.Element(ast.name, html.visitAll(this, ast.attrs), 
        /* inputs */ [], /* outputs */ [], children, /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    }
    visitComment(comment) { return null; }
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan);
    }
    visitText(text) { return new t.Text(text.value, text.sourceSpan); }
    visitExpansion(expansion) { return null; }
    visitExpansionCase(expansionCase) { return null; }
}
const NON_BINDABLE_VISITOR = new NonBindableVisitor();
function normalizeAttributeName(attrName) {
    return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
}
function addEvents(events, boundEvents) {
    boundEvents.push(...events.map(e => t.BoundEvent.fromParsedEvent(e)));
}
function isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBa0IsTUFBTSxlQUFlLENBQUM7QUFDM0UsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFM0QsT0FBTyxFQUFDLG9CQUFvQixFQUFFLGVBQWUsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBQzVGLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFcEMsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFHOUIsTUFBTSxnQkFBZ0IsR0FDbEIsMEdBQTBHLENBQUM7QUFFL0csb0JBQW9CO0FBQ3BCLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQztBQUN0QixtQkFBbUI7QUFDbkIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLHFCQUFxQjtBQUNyQixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDckIsa0JBQWtCO0FBQ2xCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixzQkFBc0I7QUFDdEIsTUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLGdCQUFnQjtBQUNoQixNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDcEIsb0ZBQW9GO0FBQ3BGLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQztBQUN2QixtQ0FBbUM7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QUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUVELFNBQVMsQ0FBQyxJQUFlLElBQVksT0FBTyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXRGLGNBQWMsQ0FBQyxTQUF5QixJQUFTLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztJQUUvRCxrQkFBa0IsQ0FBQyxhQUFpQyxJQUFTLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztDQUM1RTtBQUVELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBRXRELGdDQUFnQyxRQUFnQjtJQUM5QyxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNyRSxDQUFDO0FBRUQsbUJBQW1CLE1BQXFCLEVBQUUsV0FBMkI7SUFDbkUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEUsQ0FBQztBQUVELHlCQUF5QixJQUFlO0lBQ3RDLE9BQU8sSUFBSSxZQUFZLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO0FBQ3BFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VkRXZlbnQsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRWYXJpYWJsZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge3JlcGxhY2VOZ3NwfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge2lzTmdUZW1wbGF0ZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUVycm9yTGV2ZWwsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzU3R5bGVVcmxSZXNvbHZhYmxlfSBmcm9tICcuLi9zdHlsZV91cmxfcmVzb2x2ZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHJlcGFyc2VFbGVtZW50fSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcHJlcGFyc2VyJztcbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcblxuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4rKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuLy8gRGVmYXVsdCBzZWxlY3RvciB1c2VkIGJ5IGA8bmctY29udGVudD5gIGlmIG5vbmUgc3BlY2lmaWVkXG5jb25zdCBERUZBVUxUX0NPTlRFTlRfU0VMRUNUT1IgPSAnKic7XG5cbi8vIFJlc3VsdCBvZiB0aGUgaHRtbCBBU1QgdG8gSXZ5IEFTVCB0cmFuc2Zvcm1hdGlvblxuZXhwb3J0IHR5cGUgUmVuZGVyM1BhcnNlUmVzdWx0ID0ge1xuICBub2RlczogdC5Ob2RlW107IGVycm9yczogUGFyc2VFcnJvcltdO1xuICAvLyBBbnkgbm9uIGRlZmF1bHQgKGVtcHR5IG9yICcqJykgc2VsZWN0b3IgZm91bmQgaW4gdGhlIHRlbXBsYXRlXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG4gIC8vIFdldGhlciB0aGUgdGVtcGxhdGUgY29udGFpbnMgYW55IGA8bmctY29udGVudD5gXG4gIGhhc05nQ29udGVudDogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgIGh0bWxOb2RlczogaHRtbC5Ob2RlW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSZW5kZXIzUGFyc2VSZXN1bHQge1xuICBjb25zdCB0cmFuc2Zvcm1lciA9IG5ldyBIdG1sQXN0VG9JdnlBc3QoYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGl2eU5vZGVzID0gaHRtbC52aXNpdEFsbCh0cmFuc2Zvcm1lciwgaHRtbE5vZGVzKTtcblxuICAvLyBFcnJvcnMgbWlnaHQgb3JpZ2luYXRlIGluIGVpdGhlciB0aGUgYmluZGluZyBwYXJzZXIgb3IgdGhlIGh0bWwgdG8gaXZ5IHRyYW5zZm9ybWVyXG4gIGNvbnN0IGFsbEVycm9ycyA9IGJpbmRpbmdQYXJzZXIuZXJyb3JzLmNvbmNhdCh0cmFuc2Zvcm1lci5lcnJvcnMpO1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IGFsbEVycm9ycy5maWx0ZXIoZSA9PiBlLmxldmVsID09PSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGVycm9yU3RyaW5nID0gZXJyb3JzLmpvaW4oJ1xcbicpO1xuICAgIHRocm93IHN5bnRheEVycm9yKGBUZW1wbGF0ZSBwYXJzZSBlcnJvcnM6XFxuJHtlcnJvclN0cmluZ31gLCBlcnJvcnMpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlczogaXZ5Tm9kZXMsXG4gICAgZXJyb3JzOiBhbGxFcnJvcnMsXG4gICAgbmdDb250ZW50U2VsZWN0b3JzOiB0cmFuc2Zvcm1lci5uZ0NvbnRlbnRTZWxlY3RvcnMsXG4gICAgaGFzTmdDb250ZW50OiB0cmFuc2Zvcm1lci5oYXNOZ0NvbnRlbnQsXG4gIH07XG59XG5cbmNsYXNzIEh0bWxBc3RUb0l2eUFzdCBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIC8vIFNlbGVjdG9ycyBmb3IgdGhlIGBuZy1jb250ZW50YCB0YWdzLiBPbmx5IG5vbiBgKmAgc2VsZWN0b3JzIGFyZSByZWNvcmRlZCBoZXJlXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgLy8gQW55IGA8bmctY29udGVudD5gIGluIHRoZSB0ZW1wbGF0ZSA/XG4gIGhhc05nQ29udGVudCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge31cblxuICAvLyBIVE1MIHZpc2l0b3JcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IHQuTm9kZXxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgYSBgPG5nLXRlbXBsYXRlPmBcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgY29uc3QgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSA9IFtdO1xuICAgIGNvbnN0IHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG4gICAgY29uc3QgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBjb25zdCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZVZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGhhcyBhbnkgKi1hdHRyaWJ1dGVcbiAgICBsZXQgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZSBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJpYnV0ZS5uYW1lKTtcblxuICAgICAgLy8gYCphdHRyYCBkZWZpbmVzIHRlbXBsYXRlIGJpbmRpbmdzXG4gICAgICBsZXQgaXNUZW1wbGF0ZUJpbmRpbmcgPSBmYWxzZTtcblxuICAgICAgaWYgKG5vcm1hbGl6ZWROYW1lLnN0YXJ0c1dpdGgoVEVNUExBVEVfQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIC8vICotYXR0cmlidXRlc1xuICAgICAgICBpZiAoZWxlbWVudEhhc0lubGluZVRlbXBsYXRlKSB7XG4gICAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYENhbid0IGhhdmUgbXVsdGlwbGUgdGVtcGxhdGUgYmluZGluZ3Mgb24gb25lIGVsZW1lbnQuIFVzZSBvbmx5IG9uZSBhdHRyaWJ1dGUgcHJlZml4ZWQgd2l0aCAqYCxcbiAgICAgICAgICAgICAgYXR0cmlidXRlLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGlzVGVtcGxhdGVCaW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWYWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVLZXkgPSBub3JtYWxpemVkTmFtZS5zdWJzdHJpbmcoVEVNUExBVEVfQVRUUl9QUkVGSVgubGVuZ3RoKTtcblxuICAgICAgICBjb25zdCBwYXJzZWRWYXJpYWJsZXM6IFBhcnNlZFZhcmlhYmxlW10gPSBbXTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXksIHRlbXBsYXRlVmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBbXSwgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLFxuICAgICAgICAgICAgcGFyc2VkVmFyaWFibGVzKTtcbiAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMucHVzaChcbiAgICAgICAgICAgIC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiBuZXcgdC5WYXJpYWJsZSh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3BhbikpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciB2YXJpYWJsZXMsIGV2ZW50cywgcHJvcGVydHkgYmluZGluZ3MsIGludGVycG9sYXRpb25cbiAgICAgICAgaGFzQmluZGluZyA9IHRoaXMucGFyc2VBdHRyaWJ1dGUoXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgYXR0cmlidXRlLCBbXSwgcGFyc2VkUHJvcGVydGllcywgYm91bmRFdmVudHMsIHZhcmlhYmxlcywgcmVmZXJlbmNlcyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSBhcyB0LlRleHRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgdGhpcy5oYXNOZ0NvbnRlbnQgPSB0cnVlO1xuXG4gICAgICBpZiAoZWxlbWVudC5jaGlsZHJlbiAmJiAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShpc0VtcHR5VGV4dE5vZGUpKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBwcmVwYXJzZWRFbGVtZW50LnNlbGVjdEF0dHI7XG5cbiAgICAgIGxldCBhdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSA9XG4gICAgICAgICAgZWxlbWVudC5hdHRycy5tYXAoYXR0cmlidXRlID0+IHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSk7XG5cbiAgICAgIGNvbnN0IHNlbGVjdG9ySW5kZXggPVxuICAgICAgICAgIHNlbGVjdG9yID09PSBERUZBVUxUX0NPTlRFTlRfU0VMRUNUT1IgPyAwIDogdGhpcy5uZ0NvbnRlbnRTZWxlY3RvcnMucHVzaChzZWxlY3Rvcik7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuQ29udGVudChzZWxlY3RvckluZGV4LCBhdHRyaWJ1dGVzLCBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgIC8vIGA8bmctdGVtcGxhdGU+YFxuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnQubmFtZSwgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgY2hpbGRyZW4sIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgZWxlbWVudC5zb3VyY2VTcGFuLFxuICAgICAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhdHRycyA9IHRoaXMuZXh0cmFjdEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVsZW1lbnQoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIGNoaWxkcmVuLCByZWZlcmVuY2VzLFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcyk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgYXR0cnMubGl0ZXJhbCwgYXR0cnMuYm91bmQsIFtwYXJzZWRFbGVtZW50XSwgW10sIHRlbXBsYXRlVmFyaWFibGVzLCBlbGVtZW50LnNvdXJjZVNwYW4sXG4gICAgICAgICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3Bhbik7XG4gICAgfVxuICAgIHJldHVybiBwYXJzZWRFbGVtZW50O1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IHQuVGV4dEF0dHJpYnV0ZSB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHRBdHRyaWJ1dGUoXG4gICAgICAgIGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0Lk5vZGUge1xuICAgIGNvbnN0IHZhbHVlTm9OZ3NwID0gcmVwbGFjZU5nc3AodGV4dC52YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHRleHQuc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHIgPyBuZXcgdC5Cb3VuZFRleHQoZXhwciwgdGV4dC5zb3VyY2VTcGFuKSA6IG5ldyB0LlRleHQodmFsdWVOb05nc3AsIHRleHQuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogbnVsbCB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbik6IG51bGwgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBudWxsIHsgcmV0dXJuIG51bGw7IH1cblxuICAvLyBjb252ZXJ0IHZpZXcgZW5naW5lIGBQYXJzZWRQcm9wZXJ0eWAgdG8gYSBmb3JtYXQgc3VpdGFibGUgZm9yIElWWVxuICBwcml2YXRlIGV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10pOlxuICAgICAge2JvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10sIGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdfSB7XG4gICAgY29uc3QgYm91bmQ6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBpZiAocHJvcC5pc0xpdGVyYWwpIHtcbiAgICAgICAgbGl0ZXJhbC5wdXNoKG5ldyB0LlRleHRBdHRyaWJ1dGUocHJvcC5uYW1lLCBwcm9wLmV4cHJlc3Npb24uc291cmNlIHx8ICcnLCBwcm9wLnNvdXJjZVNwYW4pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGJlcCA9IHRoaXMuYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50TmFtZSwgcHJvcCk7XG4gICAgICAgIGJvdW5kLnB1c2godC5Cb3VuZEF0dHJpYnV0ZS5mcm9tQm91bmRFbGVtZW50UHJvcGVydHkoYmVwKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge2JvdW5kLCBsaXRlcmFsfTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdHRyaWJ1dGUoXG4gICAgICBpc1RlbXBsYXRlRWxlbWVudDogYm9vbGVhbiwgYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgbWF0Y2hhYmxlQXR0cmlidXRlczogc3RyaW5nW11bXSxcbiAgICAgIHBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sXG4gICAgICByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKSB7XG4gICAgY29uc3QgbmFtZSA9IG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0cmlidXRlLm5hbWUpO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgIGNvbnN0IHNyY1NwYW4gPSBhdHRyaWJ1dGUuc291cmNlU3BhbjtcblxuICAgIGNvbnN0IGJpbmRQYXJ0cyA9IG5hbWUubWF0Y2goQklORF9OQU1FX1JFR0VYUCk7XG4gICAgbGV0IGhhc0JpbmRpbmcgPSBmYWxzZTtcblxuICAgIGlmIChiaW5kUGFydHMpIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0cnVlO1xuICAgICAgaWYgKGJpbmRQYXJ0c1tLV19CSU5EX0lEWF0gIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfTEVUX0lEWF0pIHtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICAgIHRoaXMucGFyc2VWYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdmFyaWFibGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGBcImxldC1cIiBpcyBvbmx5IHN1cHBvcnRlZCBvbiBuZy10ZW1wbGF0ZSBlbGVtZW50cy5gLCBzcmNTcGFuKTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19SRUZfSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIHRoaXMucGFyc2VSZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIHJlZmVyZW5jZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19PTl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG4gICAgICAgIHRoaXMucGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0FUX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBib3VuZEV2ZW50cyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIHBhcnNlZFByb3BlcnRpZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBoYXNCaW5kaW5nID0gdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzQmluZGluZztcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VWYXJpYWJsZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiB2YXJpYWJsZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgICB2YXJpYWJsZXMucHVzaChuZXcgdC5WYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVJlZmVyZW5jZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHJlZmVyZW5jZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHJlZmVyZW5jZXMucHVzaChuZXcgdC5SZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSkge1xuICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICBgJHtuYW1lfUNoYW5nZWAsIGAke2V4cHJlc3Npb259PSRldmVudGAsIHNvdXJjZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBldmVudHMpO1xuICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogdC5FbGVtZW50fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIG51bGwpO1xuICAgIHJldHVybiBuZXcgdC5FbGVtZW50KFxuICAgICAgICBhc3QubmFtZSwgaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuYXR0cnMpIGFzIHQuVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgICAvKiBpbnB1dHMgKi9bXSwgLyogb3V0cHV0cyAqL1tdLCBjaGlsZHJlbizCoCAvKiByZWZlcmVuY2VzICovW10sIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogdC5UZXh0IHsgcmV0dXJuIG5ldyB0LlRleHQodGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKTsgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24pOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxufVxuXG5jb25zdCBOT05fQklOREFCTEVfVklTSVRPUiA9IG5ldyBOb25CaW5kYWJsZVZpc2l0b3IoKTtcblxuZnVuY3Rpb24gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIC9eZGF0YS0vaS50ZXN0KGF0dHJOYW1lKSA/IGF0dHJOYW1lLnN1YnN0cmluZyg1KSA6IGF0dHJOYW1lO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudHMoZXZlbnRzOiBQYXJzZWRFdmVudFtdLCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10pIHtcbiAgYm91bmRFdmVudHMucHVzaCguLi5ldmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChlKSkpO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuIl19