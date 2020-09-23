/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { replaceNgsp } from '../ml_parser/html_whitespaces';
import { isNgTemplate } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { isStyleUrlResolvable } from '../style_url_resolver';
import { PreparsedElementType, preparseElement } from '../template_parser/template_preparser';
import * as t from './r3_ast';
import { I18N_ICU_VAR_PREFIX, isI18nRootNode } from './view/i18n/util';
const BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
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
export function htmlAstToRender3Ast(htmlNodes, bindingParser) {
    const transformer = new HtmlAstToIvyAst(bindingParser);
    const ivyNodes = html.visitAll(transformer, htmlNodes);
    // Errors might originate in either the binding parser or the html to ivy transformer
    const allErrors = bindingParser.errors.concat(transformer.errors);
    return {
        nodes: ivyNodes,
        errors: allErrors,
        styleUrls: transformer.styleUrls,
        styles: transformer.styles,
        ngContentSelectors: transformer.ngContentSelectors,
    };
}
class HtmlAstToIvyAst {
    constructor(bindingParser) {
        this.bindingParser = bindingParser;
        this.errors = [];
        this.styles = [];
        this.styleUrls = [];
        this.ngContentSelectors = [];
        this.inI18nBlock = false;
    }
    // HTML visitor
    visitElement(element) {
        const isI18nRootElement = isI18nRootNode(element.i18n);
        if (isI18nRootElement) {
            if (this.inI18nBlock) {
                this.reportError('Cannot mark an element as translatable inside of a translatable section. Please remove the nested i18n marker.', element.sourceSpan);
            }
            this.inI18nBlock = true;
        }
        const preparsedElement = preparseElement(element);
        if (preparsedElement.type === PreparsedElementType.SCRIPT) {
            return null;
        }
        else if (preparsedElement.type === PreparsedElementType.STYLE) {
            const contents = textContents(element);
            if (contents !== null) {
                this.styles.push(contents);
            }
            return null;
        }
        else if (preparsedElement.type === PreparsedElementType.STYLESHEET &&
            isStyleUrlResolvable(preparsedElement.hrefAttr)) {
            this.styleUrls.push(preparsedElement.hrefAttr);
            return null;
        }
        // Whether the element is a `<ng-template>`
        const isTemplateElement = isNgTemplate(element.name);
        const parsedProperties = [];
        const boundEvents = [];
        const variables = [];
        const references = [];
        const attributes = [];
        const i18nAttrsMeta = {};
        const templateParsedProperties = [];
        const templateVariables = [];
        // Whether the element has any *-attribute
        let elementHasInlineTemplate = false;
        for (const attribute of element.attrs) {
            let hasBinding = false;
            const normalizedName = normalizeAttributeName(attribute.name);
            // `*attr` defines template bindings
            let isTemplateBinding = false;
            if (attribute.i18n) {
                i18nAttrsMeta[attribute.name] = attribute.i18n;
            }
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
                const absoluteValueOffset = attribute.valueSpan ?
                    attribute.valueSpan.start.offset :
                    // If there is no value span the attribute does not have a value, like `attr` in
                    //`<div attr></div>`. In this case, point to one character beyond the last character of
                    // the attribute name.
                    attribute.sourceSpan.start.offset + attribute.name.length;
                this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, absoluteValueOffset, [], templateParsedProperties, parsedVariables);
                templateVariables.push(...parsedVariables.map(v => new t.Variable(v.name, v.value, v.sourceSpan, v.valueSpan)));
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
            if (element.children &&
                !element.children.every((node) => isEmptyTextNode(node) || isCommentNode(node))) {
                this.reportError(`<ng-content> element cannot have content.`, element.sourceSpan);
            }
            const selector = preparsedElement.selectAttr;
            const attrs = element.attrs.map(attr => this.visitAttribute(attr));
            parsedElement = new t.Content(selector, attrs, element.sourceSpan, element.i18n);
            this.ngContentSelectors.push(selector);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            const attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
            parsedElement = new t.Template(element.name, attributes, attrs.bound, boundEvents, [ /* no template attributes */], children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        else {
            const attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
            parsedElement = new t.Element(element.name, attributes, attrs.bound, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        if (elementHasInlineTemplate) {
            // If this node is an inline-template (e.g. has *ngFor) then we need to create a template
            // node that contains this node.
            // Moreover, if the node is an element, then we need to hoist its attributes to the template
            // node for matching against content projection selectors.
            const attrs = this.extractAttributes('ng-template', templateParsedProperties, i18nAttrsMeta);
            const templateAttrs = [];
            attrs.literal.forEach(attr => templateAttrs.push(attr));
            attrs.bound.forEach(attr => templateAttrs.push(attr));
            const hoistedAttrs = parsedElement instanceof t.Element ?
                {
                    attributes: parsedElement.attributes,
                    inputs: parsedElement.inputs,
                    outputs: parsedElement.outputs,
                } :
                { attributes: [], inputs: [], outputs: [] };
            // For <ng-template>s with structural directives on them, avoid passing i18n information to
            // the wrapping template to prevent unnecessary i18n instructions from being generated. The
            // necessary i18n meta information will be extracted from child elements.
            const i18n = isTemplateElement && isI18nRootElement ? undefined : element.i18n;
            // TODO(pk): test for this case
            parsedElement = new t.Template(parsedElement.name, hoistedAttrs.attributes, hoistedAttrs.inputs, hoistedAttrs.outputs, templateAttrs, [parsedElement], [ /* no references */], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, i18n);
        }
        if (isI18nRootElement) {
            this.inI18nBlock = false;
        }
        return parsedElement;
    }
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan, attribute.i18n);
    }
    visitText(text) {
        return this._visitTextWithInterpolation(text.value, text.sourceSpan, text.i18n);
    }
    visitExpansion(expansion) {
        if (!expansion.i18n) {
            // do not generate Icu in case it was created
            // outside of i18n block in a template
            return null;
        }
        if (!isI18nRootNode(expansion.i18n)) {
            throw new Error(`Invalid type "${expansion.i18n.constructor}" for "i18n" property of ${expansion.sourceSpan.toString()}. Expected a "Message"`);
        }
        const message = expansion.i18n;
        const vars = {};
        const placeholders = {};
        // extract VARs from ICUs - we process them separately while
        // assembling resulting message via goog.getMsg function, since
        // we need to pass them to top-level goog.getMsg call
        Object.keys(message.placeholders).forEach(key => {
            const value = message.placeholders[key];
            if (key.startsWith(I18N_ICU_VAR_PREFIX)) {
                const config = this.bindingParser.interpolationConfig;
                // ICU expression is a plain string, not wrapped into start
                // and end tags, so we wrap it before passing to binding parser
                const wrapped = `${config.start}${value}${config.end}`;
                // Currently when the `plural` or `select` keywords in an ICU contain trailing spaces (e.g.
                // `{count, select , ...}`), these spaces are also included into the key names in ICU vars
                // (e.g. "VAR_SELECT "). These trailing spaces are not desirable, since they will later be
                // converted into `_` symbols while normalizing placeholder names, which might lead to
                // mismatches at runtime (i.e. placeholder will not be replaced with the correct value).
                const formattedKey = key.trim();
                vars[formattedKey] =
                    this._visitTextWithInterpolation(wrapped, expansion.sourceSpan);
            }
            else {
                placeholders[key] = this._visitTextWithInterpolation(value, expansion.sourceSpan);
            }
        });
        return new t.Icu(vars, placeholders, expansion.sourceSpan, message);
    }
    visitExpansionCase(expansionCase) {
        return null;
    }
    visitComment(comment) {
        return null;
    }
    // convert view engine `ParsedProperty` to a format suitable for IVY
    extractAttributes(elementName, properties, i18nPropsMeta) {
        const bound = [];
        const literal = [];
        properties.forEach(prop => {
            const i18n = i18nPropsMeta[prop.name];
            if (prop.isLiteral) {
                literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan, undefined, i18n));
            }
            else {
                // Note that validation is skipped and property mapping is disabled
                // due to the fact that we need to make sure a given prop is not an
                // input of a directive and directive matching happens at runtime.
                const bep = this.bindingParser.createBoundElementProperty(elementName, prop, /* skipValidation */ true, /* mapPropertyName */ false);
                bound.push(t.BoundAttribute.fromBoundElementProperty(bep, i18n));
            }
        });
        return { bound, literal };
    }
    parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
        const name = normalizeAttributeName(attribute.name);
        const value = attribute.value;
        const srcSpan = attribute.sourceSpan;
        const absoluteOffset = attribute.valueSpan ? attribute.valueSpan.start.offset : srcSpan.start.offset;
        function createKeySpan(srcSpan, prefix, identifier) {
            // We need to adjust the start location for the keySpan to account for the removed 'data-'
            // prefix from `normalizeAttributeName`.
            const normalizationAdjustment = attribute.name.length - name.length;
            const keySpanStart = srcSpan.start.moveBy(prefix.length + normalizationAdjustment);
            const keySpanEnd = keySpanStart.moveBy(identifier.length);
            return new ParseSourceSpan(keySpanStart, keySpanEnd, identifier);
        }
        const bindParts = name.match(BIND_NAME_REGEXP);
        let hasBinding = false;
        if (bindParts) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                const identifier = bindParts[IDENT_KW_IDX];
                const keySpan = createKeySpan(srcSpan, bindParts[KW_BIND_IDX], identifier);
                this.bindingParser.parsePropertyBinding(identifier, value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    const identifier = bindParts[IDENT_KW_IDX];
                    this.parseVariable(identifier, value, srcSpan, attribute.valueSpan, variables);
                }
                else {
                    this.reportError(`"let-" is only supported on ng-template elements.`, srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                const identifier = bindParts[IDENT_KW_IDX];
                this.parseReference(identifier, value, srcSpan, attribute.valueSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                const events = [];
                const identifier = bindParts[IDENT_KW_IDX];
                this.bindingParser.parseEvent(identifier, value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                const identifier = bindParts[IDENT_KW_IDX];
                const keySpan = createKeySpan(srcSpan, bindParts[KW_BINDON_IDX], identifier);
                this.bindingParser.parsePropertyBinding(identifier, value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
                this.parseAssignmentEvent(identifier, value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                const keySpan = createKeySpan(srcSpan, '', name);
                this.bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                const keySpan = createKeySpan(srcSpan, '[(', bindParts[IDENT_BANANA_BOX_IDX]);
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
                this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                const keySpan = createKeySpan(srcSpan, '[', bindParts[IDENT_PROPERTY_IDX]);
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                const events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            const keySpan = createKeySpan(srcSpan, '' /* prefix */, name);
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
        }
        return hasBinding;
    }
    _visitTextWithInterpolation(value, sourceSpan, i18n) {
        const valueNoNgsp = replaceNgsp(value);
        const expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan);
        return expr ? new t.BoundText(expr, sourceSpan, i18n) : new t.Text(valueNoNgsp, sourceSpan);
    }
    parseVariable(identifier, value, sourceSpan, valueSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in variable names`, sourceSpan);
        }
        else if (identifier.length === 0) {
            this.reportError(`Variable does not have a name`, sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan, valueSpan));
    }
    parseReference(identifier, value, sourceSpan, valueSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        else if (identifier.length === 0) {
            this.reportError(`Reference does not have a name`, sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan, valueSpan));
    }
    parseAssignmentEvent(name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents) {
        const events = [];
        this.bindingParser.parseEvent(`${name}Change`, `${expression}=$event`, sourceSpan, valueSpan || sourceSpan, targetMatchableAttrs, events);
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
    visitComment(comment) {
        return null;
    }
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, undefined, attribute.i18n);
    }
    visitText(text) {
        return new t.Text(text.value, text.sourceSpan);
    }
    visitExpansion(expansion) {
        return null;
    }
    visitExpansionCase(expansionCase) {
        return null;
    }
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
function isCommentNode(node) {
    return node instanceof html.Comment;
}
function textContents(node) {
    if (node.children.length !== 1 || !(node.children[0] instanceof html.Text)) {
        return null;
    }
    else {
        return node.children[0].value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0UsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFM0QsT0FBTyxFQUFDLG9CQUFvQixFQUFFLGVBQWUsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRzVGLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVyRSxNQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztBQUUvRyxvQkFBb0I7QUFDcEIsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLG1CQUFtQjtBQUNuQixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDckIscUJBQXFCO0FBQ3JCLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztBQUNyQixrQkFBa0I7QUFDbEIsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLHNCQUFzQjtBQUN0QixNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFDeEIsZ0JBQWdCO0FBQ2hCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixvRkFBb0Y7QUFDcEYsTUFBTSxZQUFZLEdBQUcs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dEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLElBQWU7SUFDcEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUN0QyxDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUMsSUFBa0I7SUFDdEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzFFLE9BQU8sSUFBSSxDQUFDO0tBQ2I7U0FBTTtRQUNMLE9BQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQWUsQ0FBQyxLQUFLLENBQUM7S0FDOUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VkRXZlbnQsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRWYXJpYWJsZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtyZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc1N0eWxlVXJsUmVzb2x2YWJsZX0gZnJvbSAnLi4vc3R5bGVfdXJsX3Jlc29sdmVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3ByZXBhcnNlcic7XG5pbXBvcnQge3N5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5pbXBvcnQge0kxOE5fSUNVX1ZBUl9QUkVGSVgsIGlzSTE4blJvb3ROb2RlfSBmcm9tICcuL3ZpZXcvaTE4bi91dGlsJztcblxuY29uc3QgQklORF9OQU1FX1JFR0VYUCA9XG4gICAgL14oPzooPzooPzooYmluZC0pfChsZXQtKXwocmVmLXwjKXwob24tKXwoYmluZG9uLSl8KEApKSguKikpfFxcW1xcKChbXlxcKV0rKVxcKVxcXXxcXFsoW15cXF1dKylcXF18XFwoKFteXFwpXSspXFwpKSQvO1xuXG4vLyBHcm91cCAxID0gXCJiaW5kLVwiXG5jb25zdCBLV19CSU5EX0lEWCA9IDE7XG4vLyBHcm91cCAyID0gXCJsZXQtXCJcbmNvbnN0IEtXX0xFVF9JRFggPSAyO1xuLy8gR3JvdXAgMyA9IFwicmVmLS8jXCJcbmNvbnN0IEtXX1JFRl9JRFggPSAzO1xuLy8gR3JvdXAgNCA9IFwib24tXCJcbmNvbnN0IEtXX09OX0lEWCA9IDQ7XG4vLyBHcm91cCA1ID0gXCJiaW5kb24tXCJcbmNvbnN0IEtXX0JJTkRPTl9JRFggPSA1O1xuLy8gR3JvdXAgNiA9IFwiQFwiXG5jb25zdCBLV19BVF9JRFggPSA2O1xuLy8gR3JvdXAgNyA9IHRoZSBpZGVudGlmaWVyIGFmdGVyIFwiYmluZC1cIiwgXCJsZXQtXCIsIFwicmVmLS8jXCIsIFwib24tXCIsIFwiYmluZG9uLVwiIG9yIFwiQFwiXG5jb25zdCBJREVOVF9LV19JRFggPSA3O1xuLy8gR3JvdXAgOCA9IGlkZW50aWZpZXIgaW5zaWRlIFsoKV1cbmNvbnN0IElERU5UX0JBTkFOQV9CT1hfSURYID0gODtcbi8vIEdyb3VwIDkgPSBpZGVudGlmaWVyIGluc2lkZSBbXVxuY29uc3QgSURFTlRfUFJPUEVSVFlfSURYID0gOTtcbi8vIEdyb3VwIDEwID0gaWRlbnRpZmllciBpbnNpZGUgKClcbmNvbnN0IElERU5UX0VWRU5UX0lEWCA9IDEwO1xuXG5jb25zdCBURU1QTEFURV9BVFRSX1BSRUZJWCA9ICcqJztcblxuLy8gUmVzdWx0IG9mIHRoZSBodG1sIEFTVCB0byBJdnkgQVNUIHRyYW5zZm9ybWF0aW9uXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlcjNQYXJzZVJlc3VsdCB7XG4gIG5vZGVzOiB0Lk5vZGVbXTtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW107XG4gIHN0eWxlczogc3RyaW5nW107XG4gIHN0eWxlVXJsczogc3RyaW5nW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgIGh0bWxOb2RlczogaHRtbC5Ob2RlW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSZW5kZXIzUGFyc2VSZXN1bHQge1xuICBjb25zdCB0cmFuc2Zvcm1lciA9IG5ldyBIdG1sQXN0VG9JdnlBc3QoYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGl2eU5vZGVzID0gaHRtbC52aXNpdEFsbCh0cmFuc2Zvcm1lciwgaHRtbE5vZGVzKTtcblxuICAvLyBFcnJvcnMgbWlnaHQgb3JpZ2luYXRlIGluIGVpdGhlciB0aGUgYmluZGluZyBwYXJzZXIgb3IgdGhlIGh0bWwgdG8gaXZ5IHRyYW5zZm9ybWVyXG4gIGNvbnN0IGFsbEVycm9ycyA9IGJpbmRpbmdQYXJzZXIuZXJyb3JzLmNvbmNhdCh0cmFuc2Zvcm1lci5lcnJvcnMpO1xuXG4gIHJldHVybiB7XG4gICAgbm9kZXM6IGl2eU5vZGVzLFxuICAgIGVycm9yczogYWxsRXJyb3JzLFxuICAgIHN0eWxlVXJsczogdHJhbnNmb3JtZXIuc3R5bGVVcmxzLFxuICAgIHN0eWxlczogdHJhbnNmb3JtZXIuc3R5bGVzLFxuICAgIG5nQ29udGVudFNlbGVjdG9yczogdHJhbnNmb3JtZXIubmdDb250ZW50U2VsZWN0b3JzLFxuICB9O1xufVxuXG5jbGFzcyBIdG1sQXN0VG9JdnlBc3QgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBzdHlsZXM6IHN0cmluZ1tdID0gW107XG4gIHN0eWxlVXJsczogc3RyaW5nW10gPSBbXTtcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluSTE4bkJsb2NrOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7fVxuXG4gIC8vIEhUTUwgdmlzaXRvclxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50KTogdC5Ob2RlfG51bGwge1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50ID0gaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKTtcbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIGlmICh0aGlzLmluSTE4bkJsb2NrKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQ2Fubm90IG1hcmsgYW4gZWxlbWVudCBhcyB0cmFuc2xhdGFibGUgaW5zaWRlIG9mIGEgdHJhbnNsYXRhYmxlIHNlY3Rpb24uIFBsZWFzZSByZW1vdmUgdGhlIG5lc3RlZCBpMThuIG1hcmtlci4nLFxuICAgICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICBjb25zdCBjb250ZW50cyA9IHRleHRDb250ZW50cyhlbGVtZW50KTtcbiAgICAgIGlmIChjb250ZW50cyAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnN0eWxlcy5wdXNoKGNvbnRlbnRzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEVTSEVFVCAmJlxuICAgICAgICBpc1N0eWxlVXJsUmVzb2x2YWJsZShwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKSkge1xuICAgICAgdGhpcy5zdHlsZVVybHMucHVzaChwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgYSBgPG5nLXRlbXBsYXRlPmBcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgY29uc3QgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSA9IFtdO1xuICAgIGNvbnN0IHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG4gICAgY29uc3QgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgaTE4bkF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IGkxOG4uSTE4bk1ldGF9ID0ge307XG5cbiAgICBjb25zdCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZVZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGhhcyBhbnkgKi1hdHRyaWJ1dGVcbiAgICBsZXQgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZSBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJpYnV0ZS5uYW1lKTtcblxuICAgICAgLy8gYCphdHRyYCBkZWZpbmVzIHRlbXBsYXRlIGJpbmRpbmdzXG4gICAgICBsZXQgaXNUZW1wbGF0ZUJpbmRpbmcgPSBmYWxzZTtcblxuICAgICAgaWYgKGF0dHJpYnV0ZS5pMThuKSB7XG4gICAgICAgIGkxOG5BdHRyc01ldGFbYXR0cmlidXRlLm5hbWVdID0gYXR0cmlidXRlLmkxOG47XG4gICAgICB9XG5cbiAgICAgIGlmIChub3JtYWxpemVkTmFtZS5zdGFydHNXaXRoKFRFTVBMQVRFX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAvLyAqLWF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBDYW4ndCBoYXZlIG11bHRpcGxlIHRlbXBsYXRlIGJpbmRpbmdzIG9uIG9uZSBlbGVtZW50LiBVc2Ugb25seSBvbmUgYXR0cmlidXRlIHByZWZpeGVkIHdpdGggKmAsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgICBpc1RlbXBsYXRlQmluZGluZyA9IHRydWU7XG4gICAgICAgIGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG5cbiAgICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICAgIGNvbnN0IGFic29sdXRlVmFsdWVPZmZzZXQgPSBhdHRyaWJ1dGUudmFsdWVTcGFuID9cbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDpcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIHZhbHVlIHNwYW4gdGhlIGF0dHJpYnV0ZSBkb2VzIG5vdCBoYXZlIGEgdmFsdWUsIGxpa2UgYGF0dHJgIGluXG4gICAgICAgICAgICAvL2A8ZGl2IGF0dHI+PC9kaXY+YC4gSW4gdGhpcyBjYXNlLCBwb2ludCB0byBvbmUgY2hhcmFjdGVyIGJleW9uZCB0aGUgbGFzdCBjaGFyYWN0ZXIgb2ZcbiAgICAgICAgICAgIC8vIHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIGF0dHJpYnV0ZS5uYW1lLmxlbmd0aDtcblxuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgICB0ZW1wbGF0ZUtleSwgdGVtcGxhdGVWYWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGFic29sdXRlVmFsdWVPZmZzZXQsIFtdLFxuICAgICAgICAgICAgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZVZhcmlhYmxlcy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAoXG4gICAgICAgICAgICB2ID0+IG5ldyB0LlZhcmlhYmxlKHYubmFtZSwgdi52YWx1ZSwgdi5zb3VyY2VTcGFuLCB2LnZhbHVlU3BhbikpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciB2YXJpYWJsZXMsIGV2ZW50cywgcHJvcGVydHkgYmluZGluZ3MsIGludGVycG9sYXRpb25cbiAgICAgICAgaGFzQmluZGluZyA9IHRoaXMucGFyc2VBdHRyaWJ1dGUoXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgYXR0cmlidXRlLCBbXSwgcGFyc2VkUHJvcGVydGllcywgYm91bmRFdmVudHMsIHZhcmlhYmxlcywgcmVmZXJlbmNlcyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSBhcyB0LlRleHRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiZcbiAgICAgICAgICAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShcbiAgICAgICAgICAgICAgKG5vZGU6IGh0bWwuTm9kZSkgPT4gaXNFbXB0eVRleHROb2RlKG5vZGUpIHx8IGlzQ29tbWVudE5vZGUobm9kZSkpKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5zZWxlY3RBdHRyO1xuICAgICAgY29uc3QgYXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gZWxlbWVudC5hdHRycy5tYXAoYXR0ciA9PiB0aGlzLnZpc2l0QXR0cmlidXRlKGF0dHIpKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5Db250ZW50KHNlbGVjdG9yLCBhdHRycywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuXG4gICAgICB0aGlzLm5nQ29udGVudFNlbGVjdG9ycy5wdXNoKHNlbGVjdG9yKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmBcbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcyhlbGVtZW50Lm5hbWUsIHBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIFsvKiBubyB0ZW1wbGF0ZSBhdHRyaWJ1dGVzICovXSxcbiAgICAgICAgICBjaGlsZHJlbiwgcmVmZXJlbmNlcywgdmFyaWFibGVzLCBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnQubmFtZSwgcGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRWxlbWVudChcbiAgICAgICAgICBlbGVtZW50Lm5hbWUsIGF0dHJpYnV0ZXMsIGF0dHJzLmJvdW5kLCBib3VuZEV2ZW50cywgY2hpbGRyZW4sIHJlZmVyZW5jZXMsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgIC8vIElmIHRoaXMgbm9kZSBpcyBhbiBpbmxpbmUtdGVtcGxhdGUgKGUuZy4gaGFzICpuZ0ZvcikgdGhlbiB3ZSBuZWVkIHRvIGNyZWF0ZSBhIHRlbXBsYXRlXG4gICAgICAvLyBub2RlIHRoYXQgY29udGFpbnMgdGhpcyBub2RlLlxuICAgICAgLy8gTW9yZW92ZXIsIGlmIHRoZSBub2RlIGlzIGFuIGVsZW1lbnQsIHRoZW4gd2UgbmVlZCB0byBob2lzdCBpdHMgYXR0cmlidXRlcyB0byB0aGUgdGVtcGxhdGVcbiAgICAgIC8vIG5vZGUgZm9yIG1hdGNoaW5nIGFnYWluc3QgY29udGVudCBwcm9qZWN0aW9uIHNlbGVjdG9ycy5cbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVBdHRyczogKHQuVGV4dEF0dHJpYnV0ZXx0LkJvdW5kQXR0cmlidXRlKVtdID0gW107XG4gICAgICBhdHRycy5saXRlcmFsLmZvckVhY2goYXR0ciA9PiB0ZW1wbGF0ZUF0dHJzLnB1c2goYXR0cikpO1xuICAgICAgYXR0cnMuYm91bmQuZm9yRWFjaChhdHRyID0+IHRlbXBsYXRlQXR0cnMucHVzaChhdHRyKSk7XG4gICAgICBjb25zdCBob2lzdGVkQXR0cnMgPSBwYXJzZWRFbGVtZW50IGluc3RhbmNlb2YgdC5FbGVtZW50ID9cbiAgICAgICAgICB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBwYXJzZWRFbGVtZW50LmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBpbnB1dHM6IHBhcnNlZEVsZW1lbnQuaW5wdXRzLFxuICAgICAgICAgICAgb3V0cHV0czogcGFyc2VkRWxlbWVudC5vdXRwdXRzLFxuICAgICAgICAgIH0gOlxuICAgICAgICAgIHthdHRyaWJ1dGVzOiBbXSwgaW5wdXRzOiBbXSwgb3V0cHV0czogW119O1xuXG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMgd2l0aCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZXMgb24gdGhlbSwgYXZvaWQgcGFzc2luZyBpMThuIGluZm9ybWF0aW9uIHRvXG4gICAgICAvLyB0aGUgd3JhcHBpbmcgdGVtcGxhdGUgdG8gcHJldmVudCB1bm5lY2Vzc2FyeSBpMThuIGluc3RydWN0aW9ucyBmcm9tIGJlaW5nIGdlbmVyYXRlZC4gVGhlXG4gICAgICAvLyBuZWNlc3NhcnkgaTE4biBtZXRhIGluZm9ybWF0aW9uIHdpbGwgYmUgZXh0cmFjdGVkIGZyb20gY2hpbGQgZWxlbWVudHMuXG4gICAgICBjb25zdCBpMThuID0gaXNUZW1wbGF0ZUVsZW1lbnQgJiYgaXNJMThuUm9vdEVsZW1lbnQgPyB1bmRlZmluZWQgOiBlbGVtZW50LmkxOG47XG5cbiAgICAgIC8vIFRPRE8ocGspOiB0ZXN0IGZvciB0aGlzIGNhc2VcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICAocGFyc2VkRWxlbWVudCBhcyB0LkVsZW1lbnQgfCB0LkNvbnRlbnQpLm5hbWUsIGhvaXN0ZWRBdHRycy5hdHRyaWJ1dGVzLFxuICAgICAgICAgIGhvaXN0ZWRBdHRycy5pbnB1dHMsIGhvaXN0ZWRBdHRycy5vdXRwdXRzLCB0ZW1wbGF0ZUF0dHJzLCBbcGFyc2VkRWxlbWVudF0sXG4gICAgICAgICAgWy8qIG5vIHJlZmVyZW5jZXMgKi9dLCB0ZW1wbGF0ZVZhcmlhYmxlcywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGkxOG4pO1xuICAgIH1cbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZEVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIGF0dHJpYnV0ZS5pMThuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0Lk5vZGUge1xuICAgIHJldHVybiB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4sIHRleHQuaTE4bik7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogdC5JY3V8bnVsbCB7XG4gICAgaWYgKCFleHBhbnNpb24uaTE4bikge1xuICAgICAgLy8gZG8gbm90IGdlbmVyYXRlIEljdSBpbiBjYXNlIGl0IHdhcyBjcmVhdGVkXG4gICAgICAvLyBvdXRzaWRlIG9mIGkxOG4gYmxvY2sgaW4gYSB0ZW1wbGF0ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICghaXNJMThuUm9vdE5vZGUoZXhwYW5zaW9uLmkxOG4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdHlwZSBcIiR7ZXhwYW5zaW9uLmkxOG4uY29uc3RydWN0b3J9XCIgZm9yIFwiaTE4blwiIHByb3BlcnR5IG9mICR7XG4gICAgICAgICAgZXhwYW5zaW9uLnNvdXJjZVNwYW4udG9TdHJpbmcoKX0uIEV4cGVjdGVkIGEgXCJNZXNzYWdlXCJgKTtcbiAgICB9XG4gICAgY29uc3QgbWVzc2FnZSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIGNvbnN0IHZhcnM6IHtbbmFtZTogc3RyaW5nXTogdC5Cb3VuZFRleHR9ID0ge307XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzOiB7W25hbWU6IHN0cmluZ106IHQuVGV4dHx0LkJvdW5kVGV4dH0gPSB7fTtcbiAgICAvLyBleHRyYWN0IFZBUnMgZnJvbSBJQ1VzIC0gd2UgcHJvY2VzcyB0aGVtIHNlcGFyYXRlbHkgd2hpbGVcbiAgICAvLyBhc3NlbWJsaW5nIHJlc3VsdGluZyBtZXNzYWdlIHZpYSBnb29nLmdldE1zZyBmdW5jdGlvbiwgc2luY2VcbiAgICAvLyB3ZSBuZWVkIHRvIHBhc3MgdGhlbSB0byB0b3AtbGV2ZWwgZ29vZy5nZXRNc2cgY2FsbFxuICAgIE9iamVjdC5rZXlzKG1lc3NhZ2UucGxhY2Vob2xkZXJzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG1lc3NhZ2UucGxhY2Vob2xkZXJzW2tleV07XG4gICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoSTE4Tl9JQ1VfVkFSX1BSRUZJWCkpIHtcbiAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5iaW5kaW5nUGFyc2VyLmludGVycG9sYXRpb25Db25maWc7XG5cbiAgICAgICAgLy8gSUNVIGV4cHJlc3Npb24gaXMgYSBwbGFpbiBzdHJpbmcsIG5vdCB3cmFwcGVkIGludG8gc3RhcnRcbiAgICAgICAgLy8gYW5kIGVuZCB0YWdzLCBzbyB3ZSB3cmFwIGl0IGJlZm9yZSBwYXNzaW5nIHRvIGJpbmRpbmcgcGFyc2VyXG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSBgJHtjb25maWcuc3RhcnR9JHt2YWx1ZX0ke2NvbmZpZy5lbmR9YDtcblxuICAgICAgICAvLyBDdXJyZW50bHkgd2hlbiB0aGUgYHBsdXJhbGAgb3IgYHNlbGVjdGAga2V5d29yZHMgaW4gYW4gSUNVIGNvbnRhaW4gdHJhaWxpbmcgc3BhY2VzIChlLmcuXG4gICAgICAgIC8vIGB7Y291bnQsIHNlbGVjdCAsIC4uLn1gKSwgdGhlc2Ugc3BhY2VzIGFyZSBhbHNvIGluY2x1ZGVkIGludG8gdGhlIGtleSBuYW1lcyBpbiBJQ1UgdmFyc1xuICAgICAgICAvLyAoZS5nLiBcIlZBUl9TRUxFQ1QgXCIpLiBUaGVzZSB0cmFpbGluZyBzcGFjZXMgYXJlIG5vdCBkZXNpcmFibGUsIHNpbmNlIHRoZXkgd2lsbCBsYXRlciBiZVxuICAgICAgICAvLyBjb252ZXJ0ZWQgaW50byBgX2Agc3ltYm9scyB3aGlsZSBub3JtYWxpemluZyBwbGFjZWhvbGRlciBuYW1lcywgd2hpY2ggbWlnaHQgbGVhZCB0b1xuICAgICAgICAvLyBtaXNtYXRjaGVzIGF0IHJ1bnRpbWUgKGkuZS4gcGxhY2Vob2xkZXIgd2lsbCBub3QgYmUgcmVwbGFjZWQgd2l0aCB0aGUgY29ycmVjdCB2YWx1ZSkuXG4gICAgICAgIGNvbnN0IGZvcm1hdHRlZEtleSA9IGtleS50cmltKCk7XG5cbiAgICAgICAgdmFyc1tmb3JtYXR0ZWRLZXldID1cbiAgICAgICAgICAgIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHdyYXBwZWQsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKSBhcyB0LkJvdW5kVGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYWNlaG9sZGVyc1trZXldID0gdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odmFsdWUsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IHQuSWN1KHZhcnMsIHBsYWNlaG9sZGVycywgZXhwYW5zaW9uLnNvdXJjZVNwYW4sIG1lc3NhZ2UpO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gY29udmVydCB2aWV3IGVuZ2luZSBgUGFyc2VkUHJvcGVydHlgIHRvIGEgZm9ybWF0IHN1aXRhYmxlIGZvciBJVllcbiAgcHJpdmF0ZSBleHRyYWN0QXR0cmlidXRlcyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICBpMThuUHJvcHNNZXRhOiB7W2tleTogc3RyaW5nXTogaTE4bi5JMThuTWV0YX0pOlxuICAgICAge2JvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10sIGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdfSB7XG4gICAgY29uc3QgYm91bmQ6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBjb25zdCBpMThuID0gaTE4blByb3BzTWV0YVtwcm9wLm5hbWVdO1xuICAgICAgaWYgKHByb3AuaXNMaXRlcmFsKSB7XG4gICAgICAgIGxpdGVyYWwucHVzaChuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICAgICAgcHJvcC5uYW1lLCBwcm9wLmV4cHJlc3Npb24uc291cmNlIHx8ICcnLCBwcm9wLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgaTE4bikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHZhbGlkYXRpb24gaXMgc2tpcHBlZCBhbmQgcHJvcGVydHkgbWFwcGluZyBpcyBkaXNhYmxlZFxuICAgICAgICAvLyBkdWUgdG8gdGhlIGZhY3QgdGhhdCB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSBhIGdpdmVuIHByb3AgaXMgbm90IGFuXG4gICAgICAgIC8vIGlucHV0IG9mIGEgZGlyZWN0aXZlIGFuZCBkaXJlY3RpdmUgbWF0Y2hpbmcgaGFwcGVucyBhdCBydW50aW1lLlxuICAgICAgICBjb25zdCBiZXAgPSB0aGlzLmJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgICBlbGVtZW50TmFtZSwgcHJvcCwgLyogc2tpcFZhbGlkYXRpb24gKi8gdHJ1ZSwgLyogbWFwUHJvcGVydHlOYW1lICovIGZhbHNlKTtcbiAgICAgICAgYm91bmQucHVzaCh0LkJvdW5kQXR0cmlidXRlLmZyb21Cb3VuZEVsZW1lbnRQcm9wZXJ0eShiZXAsIGkxOG4pKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7Ym91bmQsIGxpdGVyYWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuICAgIGNvbnN0IGFic29sdXRlT2Zmc2V0ID1cbiAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiA/IGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDogc3JjU3Bhbi5zdGFydC5vZmZzZXQ7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVLZXlTcGFuKHNyY1NwYW46IFBhcnNlU291cmNlU3BhbiwgcHJlZml4OiBzdHJpbmcsIGlkZW50aWZpZXI6IHN0cmluZykge1xuICAgICAgLy8gV2UgbmVlZCB0byBhZGp1c3QgdGhlIHN0YXJ0IGxvY2F0aW9uIGZvciB0aGUga2V5U3BhbiB0byBhY2NvdW50IGZvciB0aGUgcmVtb3ZlZCAnZGF0YS0nXG4gICAgICAvLyBwcmVmaXggZnJvbSBgbm9ybWFsaXplQXR0cmlidXRlTmFtZWAuXG4gICAgICBjb25zdCBub3JtYWxpemF0aW9uQWRqdXN0bWVudCA9IGF0dHJpYnV0ZS5uYW1lLmxlbmd0aCAtIG5hbWUubGVuZ3RoO1xuICAgICAgY29uc3Qga2V5U3BhblN0YXJ0ID0gc3JjU3Bhbi5zdGFydC5tb3ZlQnkocHJlZml4Lmxlbmd0aCArIG5vcm1hbGl6YXRpb25BZGp1c3RtZW50KTtcbiAgICAgIGNvbnN0IGtleVNwYW5FbmQgPSBrZXlTcGFuU3RhcnQubW92ZUJ5KGlkZW50aWZpZXIubGVuZ3RoKTtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKGtleVNwYW5TdGFydCwga2V5U3BhbkVuZCwgaWRlbnRpZmllcik7XG4gICAgfVxuXG4gICAgY29uc3QgYmluZFBhcnRzID0gbmFtZS5tYXRjaChCSU5EX05BTUVfUkVHRVhQKTtcbiAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaGFzQmluZGluZyA9IHRydWU7XG4gICAgICBpZiAoYmluZFBhcnRzW0tXX0JJTkRfSURYXSAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgYmluZFBhcnRzW0tXX0JJTkRfSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfTEVUX0lEWF0pIHtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICAgIHRoaXMucGFyc2VWYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgdmFyaWFibGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGBcImxldC1cIiBpcyBvbmx5IHN1cHBvcnRlZCBvbiBuZy10ZW1wbGF0ZSBlbGVtZW50cy5gLCBzcmNTcGFuKTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19SRUZfSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIHRoaXMucGFyc2VSZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIHJlZmVyZW5jZXMpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfT05fSURYXSkge1xuICAgICAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IHNyY1NwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBldmVudHMpO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19BVF9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sICcnLCBuYW1lKTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sICdbKCcsIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0pO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcywga2V5U3Bhbik7XG4gICAgICAgIHRoaXMucGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSkge1xuICAgICAgICBjb25zdCBrZXlTcGFuID0gY3JlYXRlS2V5U3BhbihzcmNTcGFuLCAnWycsIGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfRVZFTlRfSURYXSkge1xuICAgICAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfRVZFTlRfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGV2ZW50cyk7XG4gICAgICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgJycgLyogcHJlZml4ICovLCBuYW1lKTtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMsXG4gICAgICAgICAga2V5U3Bhbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc0JpbmRpbmc7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgaTE4bj86IGkxOG4uSTE4bk1ldGEpOiB0LlRleHR8dC5Cb3VuZFRleHQge1xuICAgIGNvbnN0IHZhbHVlTm9OZ3NwID0gcmVwbGFjZU5nc3AodmFsdWUpO1xuICAgIGNvbnN0IGV4cHIgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlTm9OZ3NwLCBzb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dChleHByLCBzb3VyY2VTcGFuLCBpMThuKSA6IG5ldyB0LlRleHQodmFsdWVOb05nc3AsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVZhcmlhYmxlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHZhcmlhYmxlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgVmFyaWFibGUgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB2YXJpYWJsZXMucHVzaChuZXcgdC5WYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gcmVmZXJlbmNlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgUmVmZXJlbmNlIGRvZXMgbm90IGhhdmUgYSBuYW1lYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgcmVmZXJlbmNlcy5wdXNoKG5ldyB0LlJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgbmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10pIHtcbiAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgYCR7bmFtZX1DaGFuZ2VgLCBgJHtleHByZXNzaW9ufT0kZXZlbnRgLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4gfHwgc291cmNlU3BhbixcbiAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGV2ZW50cyk7XG4gICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXBvcnRFcnJvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCA9IFBhcnNlRXJyb3JMZXZlbC5FUlJPUikge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgbWVzc2FnZSwgbGV2ZWwpKTtcbiAgfVxufVxuXG5jbGFzcyBOb25CaW5kYWJsZVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICB2aXNpdEVsZW1lbnQoYXN0OiBodG1sLkVsZW1lbnQpOiB0LkVsZW1lbnR8bnVsbCB7XG4gICAgY29uc3QgcHJlcGFyc2VkRWxlbWVudCA9IHByZXBhcnNlRWxlbWVudChhc3QpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEVTSEVFVCkge1xuICAgICAgLy8gU2tpcHBpbmcgPHNjcmlwdD4gZm9yIHNlY3VyaXR5IHJlYXNvbnNcbiAgICAgIC8vIFNraXBwaW5nIDxzdHlsZT4gYW5kIHN0eWxlc2hlZXRzIGFzIHdlIGFscmVhZHkgcHJvY2Vzc2VkIHRoZW1cbiAgICAgIC8vIGluIHRoZSBTdHlsZUNvbXBpbGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbjogdC5Ob2RlW10gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5jaGlsZHJlbiwgbnVsbCk7XG4gICAgcmV0dXJuIG5ldyB0LkVsZW1lbnQoXG4gICAgICAgIGFzdC5uYW1lLCBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5hdHRycykgYXMgdC5UZXh0QXR0cmlidXRlW10sXG4gICAgICAgIC8qIGlucHV0cyAqL1tdLCAvKiBvdXRwdXRzICovW10sIGNoaWxkcmVuLMKgIC8qIHJlZmVyZW5jZXMgKi9bXSwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IHQuVGV4dEF0dHJpYnV0ZSB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHRBdHRyaWJ1dGUoXG4gICAgICAgIGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCB1bmRlZmluZWQsIGF0dHJpYnV0ZS5pMThuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0LlRleHQge1xuICAgIHJldHVybiBuZXcgdC5UZXh0KHRleHQudmFsdWUsIHRleHQuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmNvbnN0IE5PTl9CSU5EQUJMRV9WSVNJVE9SID0gbmV3IE5vbkJpbmRhYmxlVmlzaXRvcigpO1xuXG5mdW5jdGlvbiBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gL15kYXRhLS9pLnRlc3QoYXR0ck5hbWUpID8gYXR0ck5hbWUuc3Vic3RyaW5nKDUpIDogYXR0ck5hbWU7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50cyhldmVudHM6IFBhcnNlZEV2ZW50W10sIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSkge1xuICBib3VuZEV2ZW50cy5wdXNoKC4uLmV2ZW50cy5tYXAoZSA9PiB0LkJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGUpKSk7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlUZXh0Tm9kZShub2RlOiBodG1sLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBodG1sLlRleHQgJiYgbm9kZS52YWx1ZS50cmltKCkubGVuZ3RoID09IDA7XG59XG5cbmZ1bmN0aW9uIGlzQ29tbWVudE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5Db21tZW50O1xufVxuXG5mdW5jdGlvbiB0ZXh0Q29udGVudHMobm9kZTogaHRtbC5FbGVtZW50KTogc3RyaW5nfG51bGwge1xuICBpZiAobm9kZS5jaGlsZHJlbi5sZW5ndGggIT09IDEgfHwgIShub2RlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgaHRtbC5UZXh0KSkge1xuICAgIHJldHVybiBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAobm9kZS5jaGlsZHJlblswXSBhcyBodG1sLlRleHQpLnZhbHVlO1xuICB9XG59XG4iXX0=