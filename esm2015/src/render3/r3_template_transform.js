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
                templateVariables.push(...parsedVariables.map(v => new t.Variable(v.name, v.value, v.sourceSpan, v.keySpan, v.valueSpan)));
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
                    const keySpan = createKeySpan(srcSpan, bindParts[KW_LET_IDX], identifier);
                    this.parseVariable(identifier, value, srcSpan, keySpan, attribute.valueSpan, variables);
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
    parseVariable(identifier, value, sourceSpan, keySpan, valueSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in variable names`, sourceSpan);
        }
        else if (identifier.length === 0) {
            this.reportError(`Variable does not have a name`, sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan, keySpan, valueSpan));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0UsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFM0QsT0FBTyxFQUFDLG9CQUFvQixFQUFFLGVBQWUsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRzVGLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVyRSxNQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztBQUUvRyxvQkFBb0I7QUFDcEIsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLG1CQUFtQjtBQUNuQixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDckIscUJBQXFCO0FBQ3JCLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztBQUNyQixrQkFBa0I7QUFDbEIsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLHNCQUFzQjtBQUN0QixNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFDeEIsZ0JBQWdCO0FBQ2hCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixvRkFBb0Y7QUFDcEYsTUFBTSxZQUFZLEdBQUcs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QUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxJQUFlO0lBQ3RDLE9BQU8sSUFBSSxZQUFZLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxJQUFlO0lBQ3BDLE9BQU8sSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdEMsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLElBQWtCO0lBQ3RDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUMxRSxPQUFPLElBQUksQ0FBQztLQUNiO1NBQU07UUFDTCxPQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFlLENBQUMsS0FBSyxDQUFDO0tBQzlDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlZEV2ZW50LCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7cmVwbGFjZU5nc3B9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7aXNOZ1RlbXBsYXRlfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aXNTdHlsZVVybFJlc29sdmFibGV9IGZyb20gJy4uL3N0eWxlX3VybF9yZXNvbHZlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge1ByZXBhcnNlZEVsZW1lbnRUeXBlLCBwcmVwYXJzZUVsZW1lbnR9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wcmVwYXJzZXInO1xuaW1wb3J0IHtzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuaW1wb3J0IHtJMThOX0lDVV9WQVJfUFJFRklYLCBpc0kxOG5Sb290Tm9kZX0gZnJvbSAnLi92aWV3L2kxOG4vdXRpbCc7XG5cbmNvbnN0IEJJTkRfTkFNRV9SRUdFWFAgPVxuICAgIC9eKD86KD86KD86KGJpbmQtKXwobGV0LSl8KHJlZi18Iyl8KG9uLSl8KGJpbmRvbi0pfChAKSkoLiopKXxcXFtcXCgoW15cXCldKylcXClcXF18XFxbKFteXFxdXSspXFxdfFxcKChbXlxcKV0rKVxcKSkkLztcblxuLy8gR3JvdXAgMSA9IFwiYmluZC1cIlxuY29uc3QgS1dfQklORF9JRFggPSAxO1xuLy8gR3JvdXAgMiA9IFwibGV0LVwiXG5jb25zdCBLV19MRVRfSURYID0gMjtcbi8vIEdyb3VwIDMgPSBcInJlZi0vI1wiXG5jb25zdCBLV19SRUZfSURYID0gMztcbi8vIEdyb3VwIDQgPSBcIm9uLVwiXG5jb25zdCBLV19PTl9JRFggPSA0O1xuLy8gR3JvdXAgNSA9IFwiYmluZG9uLVwiXG5jb25zdCBLV19CSU5ET05fSURYID0gNTtcbi8vIEdyb3VwIDYgPSBcIkBcIlxuY29uc3QgS1dfQVRfSURYID0gNjtcbi8vIEdyb3VwIDcgPSB0aGUgaWRlbnRpZmllciBhZnRlciBcImJpbmQtXCIsIFwibGV0LVwiLCBcInJlZi0vI1wiLCBcIm9uLVwiLCBcImJpbmRvbi1cIiBvciBcIkBcIlxuY29uc3QgSURFTlRfS1dfSURYID0gNztcbi8vIEdyb3VwIDggPSBpZGVudGlmaWVyIGluc2lkZSBbKCldXG5jb25zdCBJREVOVF9CQU5BTkFfQk9YX0lEWCA9IDg7XG4vLyBHcm91cCA5ID0gaWRlbnRpZmllciBpbnNpZGUgW11cbmNvbnN0IElERU5UX1BST1BFUlRZX0lEWCA9IDk7XG4vLyBHcm91cCAxMCA9IGlkZW50aWZpZXIgaW5zaWRlICgpXG5jb25zdCBJREVOVF9FVkVOVF9JRFggPSAxMDtcblxuY29uc3QgVEVNUExBVEVfQVRUUl9QUkVGSVggPSAnKic7XG5cbi8vIFJlc3VsdCBvZiB0aGUgaHRtbCBBU1QgdG8gSXZ5IEFTVCB0cmFuc2Zvcm1hdGlvblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXIzUGFyc2VSZXN1bHQge1xuICBub2RlczogdC5Ob2RlW107XG4gIGVycm9yczogUGFyc2VFcnJvcltdO1xuICBzdHlsZXM6IHN0cmluZ1tdO1xuICBzdHlsZVVybHM6IHN0cmluZ1tdO1xuICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaHRtbEFzdFRvUmVuZGVyM0FzdChcbiAgICBodG1sTm9kZXM6IGh0bWwuTm9kZVtdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUmVuZGVyM1BhcnNlUmVzdWx0IHtcbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgSHRtbEFzdFRvSXZ5QXN0KGJpbmRpbmdQYXJzZXIpO1xuICBjb25zdCBpdnlOb2RlcyA9IGh0bWwudmlzaXRBbGwodHJhbnNmb3JtZXIsIGh0bWxOb2Rlcyk7XG5cbiAgLy8gRXJyb3JzIG1pZ2h0IG9yaWdpbmF0ZSBpbiBlaXRoZXIgdGhlIGJpbmRpbmcgcGFyc2VyIG9yIHRoZSBodG1sIHRvIGl2eSB0cmFuc2Zvcm1lclxuICBjb25zdCBhbGxFcnJvcnMgPSBiaW5kaW5nUGFyc2VyLmVycm9ycy5jb25jYXQodHJhbnNmb3JtZXIuZXJyb3JzKTtcblxuICByZXR1cm4ge1xuICAgIG5vZGVzOiBpdnlOb2RlcyxcbiAgICBlcnJvcnM6IGFsbEVycm9ycyxcbiAgICBzdHlsZVVybHM6IHRyYW5zZm9ybWVyLnN0eWxlVXJscyxcbiAgICBzdHlsZXM6IHRyYW5zZm9ybWVyLnN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHRyYW5zZm9ybWVyLm5nQ29udGVudFNlbGVjdG9ycyxcbiAgfTtcbn1cblxuY2xhc3MgSHRtbEFzdFRvSXZ5QXN0IGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgc3R5bGVzOiBzdHJpbmdbXSA9IFtdO1xuICBzdHlsZVVybHM6IHN0cmluZ1tdID0gW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBpbkkxOG5CbG9jazogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge31cblxuICAvLyBIVE1MIHZpc2l0b3JcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IHQuTm9kZXxudWxsIHtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudCA9IGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bik7XG4gICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5pbkkxOG5CbG9jaykge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgJ0Nhbm5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uLiBQbGVhc2UgcmVtb3ZlIHRoZSBuZXN0ZWQgaTE4biBtYXJrZXIuJyxcbiAgICAgICAgICAgIGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICB0aGlzLmluSTE4bkJsb2NrID0gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgcHJlcGFyc2VkRWxlbWVudCA9IHByZXBhcnNlRWxlbWVudChlbGVtZW50KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSkge1xuICAgICAgY29uc3QgY29udGVudHMgPSB0ZXh0Q29udGVudHMoZWxlbWVudCk7XG4gICAgICBpZiAoY29udGVudHMgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5zdHlsZXMucHVzaChjb250ZW50cyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIHRoaXMuc3R5bGVVcmxzLnB1c2gocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGlzIGEgYDxuZy10ZW1wbGF0ZT5gXG4gICAgY29uc3QgaXNUZW1wbGF0ZUVsZW1lbnQgPSBpc05nVGVtcGxhdGUoZWxlbWVudC5uYW1lKTtcblxuICAgIGNvbnN0IHBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGkxOG5BdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBpMThuLkkxOG5NZXRhfSA9IHt9O1xuXG4gICAgY29uc3QgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG4gICAgY29uc3QgdGVtcGxhdGVWYXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdO1xuXG4gICAgLy8gV2hldGhlciB0aGUgZWxlbWVudCBoYXMgYW55ICotYXR0cmlidXRlXG4gICAgbGV0IGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgbGV0IGhhc0JpbmRpbmcgPSBmYWxzZTtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG5cbiAgICAgIC8vIGAqYXR0cmAgZGVmaW5lcyB0ZW1wbGF0ZSBiaW5kaW5nc1xuICAgICAgbGV0IGlzVGVtcGxhdGVCaW5kaW5nID0gZmFsc2U7XG5cbiAgICAgIGlmIChhdHRyaWJ1dGUuaTE4bikge1xuICAgICAgICBpMThuQXR0cnNNZXRhW2F0dHJpYnV0ZS5uYW1lXSA9IGF0dHJpYnV0ZS5pMThuO1xuICAgICAgfVxuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgLy8gKi1hdHRyaWJ1dGVzXG4gICAgICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgICAgaXNUZW1wbGF0ZUJpbmRpbmcgPSB0cnVlO1xuICAgICAgICBlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUgPSB0cnVlO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZVZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZUtleSA9IG5vcm1hbGl6ZWROYW1lLnN1YnN0cmluZyhURU1QTEFURV9BVFRSX1BSRUZJWC5sZW5ndGgpO1xuXG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICBjb25zdCBhYnNvbHV0ZVZhbHVlT2Zmc2V0ID0gYXR0cmlidXRlLnZhbHVlU3BhbiA/XG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB2YWx1ZSBzcGFuIHRoZSBhdHRyaWJ1dGUgZG9lcyBub3QgaGF2ZSBhIHZhbHVlLCBsaWtlIGBhdHRyYCBpblxuICAgICAgICAgICAgLy9gPGRpdiBhdHRyPjwvZGl2PmAuIEluIHRoaXMgY2FzZSwgcG9pbnQgdG8gb25lIGNoYXJhY3RlciBiZXlvbmQgdGhlIGxhc3QgY2hhcmFjdGVyIG9mXG4gICAgICAgICAgICAvLyB0aGUgYXR0cmlidXRlIG5hbWUuXG4gICAgICAgICAgICBhdHRyaWJ1dGUuc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBhdHRyaWJ1dGUubmFtZS5sZW5ndGg7XG5cbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXksIHRlbXBsYXRlVmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCBbXSxcbiAgICAgICAgICAgIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcywgcGFyc2VkVmFyaWFibGVzKTtcbiAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMucHVzaCguLi5wYXJzZWRWYXJpYWJsZXMubWFwKFxuICAgICAgICAgICAgdiA9PiBuZXcgdC5WYXJpYWJsZSh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3Bhbiwgdi5rZXlTcGFuLCB2LnZhbHVlU3BhbikpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciB2YXJpYWJsZXMsIGV2ZW50cywgcHJvcGVydHkgYmluZGluZ3MsIGludGVycG9sYXRpb25cbiAgICAgICAgaGFzQmluZGluZyA9IHRoaXMucGFyc2VBdHRyaWJ1dGUoXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgYXR0cmlidXRlLCBbXSwgcGFyc2VkUHJvcGVydGllcywgYm91bmRFdmVudHMsIHZhcmlhYmxlcywgcmVmZXJlbmNlcyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSBhcyB0LlRleHRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiZcbiAgICAgICAgICAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShcbiAgICAgICAgICAgICAgKG5vZGU6IGh0bWwuTm9kZSkgPT4gaXNFbXB0eVRleHROb2RlKG5vZGUpIHx8IGlzQ29tbWVudE5vZGUobm9kZSkpKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5zZWxlY3RBdHRyO1xuICAgICAgY29uc3QgYXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gZWxlbWVudC5hdHRycy5tYXAoYXR0ciA9PiB0aGlzLnZpc2l0QXR0cmlidXRlKGF0dHIpKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5Db250ZW50KHNlbGVjdG9yLCBhdHRycywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuXG4gICAgICB0aGlzLm5nQ29udGVudFNlbGVjdG9ycy5wdXNoKHNlbGVjdG9yKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmBcbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcyhlbGVtZW50Lm5hbWUsIHBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIFsvKiBubyB0ZW1wbGF0ZSBhdHRyaWJ1dGVzICovXSxcbiAgICAgICAgICBjaGlsZHJlbiwgcmVmZXJlbmNlcywgdmFyaWFibGVzLCBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnQubmFtZSwgcGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRWxlbWVudChcbiAgICAgICAgICBlbGVtZW50Lm5hbWUsIGF0dHJpYnV0ZXMsIGF0dHJzLmJvdW5kLCBib3VuZEV2ZW50cywgY2hpbGRyZW4sIHJlZmVyZW5jZXMsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgIC8vIElmIHRoaXMgbm9kZSBpcyBhbiBpbmxpbmUtdGVtcGxhdGUgKGUuZy4gaGFzICpuZ0ZvcikgdGhlbiB3ZSBuZWVkIHRvIGNyZWF0ZSBhIHRlbXBsYXRlXG4gICAgICAvLyBub2RlIHRoYXQgY29udGFpbnMgdGhpcyBub2RlLlxuICAgICAgLy8gTW9yZW92ZXIsIGlmIHRoZSBub2RlIGlzIGFuIGVsZW1lbnQsIHRoZW4gd2UgbmVlZCB0byBob2lzdCBpdHMgYXR0cmlidXRlcyB0byB0aGUgdGVtcGxhdGVcbiAgICAgIC8vIG5vZGUgZm9yIG1hdGNoaW5nIGFnYWluc3QgY29udGVudCBwcm9qZWN0aW9uIHNlbGVjdG9ycy5cbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVBdHRyczogKHQuVGV4dEF0dHJpYnV0ZXx0LkJvdW5kQXR0cmlidXRlKVtdID0gW107XG4gICAgICBhdHRycy5saXRlcmFsLmZvckVhY2goYXR0ciA9PiB0ZW1wbGF0ZUF0dHJzLnB1c2goYXR0cikpO1xuICAgICAgYXR0cnMuYm91bmQuZm9yRWFjaChhdHRyID0+IHRlbXBsYXRlQXR0cnMucHVzaChhdHRyKSk7XG4gICAgICBjb25zdCBob2lzdGVkQXR0cnMgPSBwYXJzZWRFbGVtZW50IGluc3RhbmNlb2YgdC5FbGVtZW50ID9cbiAgICAgICAgICB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBwYXJzZWRFbGVtZW50LmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBpbnB1dHM6IHBhcnNlZEVsZW1lbnQuaW5wdXRzLFxuICAgICAgICAgICAgb3V0cHV0czogcGFyc2VkRWxlbWVudC5vdXRwdXRzLFxuICAgICAgICAgIH0gOlxuICAgICAgICAgIHthdHRyaWJ1dGVzOiBbXSwgaW5wdXRzOiBbXSwgb3V0cHV0czogW119O1xuXG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMgd2l0aCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZXMgb24gdGhlbSwgYXZvaWQgcGFzc2luZyBpMThuIGluZm9ybWF0aW9uIHRvXG4gICAgICAvLyB0aGUgd3JhcHBpbmcgdGVtcGxhdGUgdG8gcHJldmVudCB1bm5lY2Vzc2FyeSBpMThuIGluc3RydWN0aW9ucyBmcm9tIGJlaW5nIGdlbmVyYXRlZC4gVGhlXG4gICAgICAvLyBuZWNlc3NhcnkgaTE4biBtZXRhIGluZm9ybWF0aW9uIHdpbGwgYmUgZXh0cmFjdGVkIGZyb20gY2hpbGQgZWxlbWVudHMuXG4gICAgICBjb25zdCBpMThuID0gaXNUZW1wbGF0ZUVsZW1lbnQgJiYgaXNJMThuUm9vdEVsZW1lbnQgPyB1bmRlZmluZWQgOiBlbGVtZW50LmkxOG47XG5cbiAgICAgIC8vIFRPRE8ocGspOiB0ZXN0IGZvciB0aGlzIGNhc2VcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICAocGFyc2VkRWxlbWVudCBhcyB0LkVsZW1lbnQgfCB0LkNvbnRlbnQpLm5hbWUsIGhvaXN0ZWRBdHRycy5hdHRyaWJ1dGVzLFxuICAgICAgICAgIGhvaXN0ZWRBdHRycy5pbnB1dHMsIGhvaXN0ZWRBdHRycy5vdXRwdXRzLCB0ZW1wbGF0ZUF0dHJzLCBbcGFyc2VkRWxlbWVudF0sXG4gICAgICAgICAgWy8qIG5vIHJlZmVyZW5jZXMgKi9dLCB0ZW1wbGF0ZVZhcmlhYmxlcywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGkxOG4pO1xuICAgIH1cbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZEVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIGF0dHJpYnV0ZS5pMThuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0Lk5vZGUge1xuICAgIHJldHVybiB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4sIHRleHQuaTE4bik7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogdC5JY3V8bnVsbCB7XG4gICAgaWYgKCFleHBhbnNpb24uaTE4bikge1xuICAgICAgLy8gZG8gbm90IGdlbmVyYXRlIEljdSBpbiBjYXNlIGl0IHdhcyBjcmVhdGVkXG4gICAgICAvLyBvdXRzaWRlIG9mIGkxOG4gYmxvY2sgaW4gYSB0ZW1wbGF0ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICghaXNJMThuUm9vdE5vZGUoZXhwYW5zaW9uLmkxOG4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdHlwZSBcIiR7ZXhwYW5zaW9uLmkxOG4uY29uc3RydWN0b3J9XCIgZm9yIFwiaTE4blwiIHByb3BlcnR5IG9mICR7XG4gICAgICAgICAgZXhwYW5zaW9uLnNvdXJjZVNwYW4udG9TdHJpbmcoKX0uIEV4cGVjdGVkIGEgXCJNZXNzYWdlXCJgKTtcbiAgICB9XG4gICAgY29uc3QgbWVzc2FnZSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIGNvbnN0IHZhcnM6IHtbbmFtZTogc3RyaW5nXTogdC5Cb3VuZFRleHR9ID0ge307XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzOiB7W25hbWU6IHN0cmluZ106IHQuVGV4dHx0LkJvdW5kVGV4dH0gPSB7fTtcbiAgICAvLyBleHRyYWN0IFZBUnMgZnJvbSBJQ1VzIC0gd2UgcHJvY2VzcyB0aGVtIHNlcGFyYXRlbHkgd2hpbGVcbiAgICAvLyBhc3NlbWJsaW5nIHJlc3VsdGluZyBtZXNzYWdlIHZpYSBnb29nLmdldE1zZyBmdW5jdGlvbiwgc2luY2VcbiAgICAvLyB3ZSBuZWVkIHRvIHBhc3MgdGhlbSB0byB0b3AtbGV2ZWwgZ29vZy5nZXRNc2cgY2FsbFxuICAgIE9iamVjdC5rZXlzKG1lc3NhZ2UucGxhY2Vob2xkZXJzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG1lc3NhZ2UucGxhY2Vob2xkZXJzW2tleV07XG4gICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoSTE4Tl9JQ1VfVkFSX1BSRUZJWCkpIHtcbiAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5iaW5kaW5nUGFyc2VyLmludGVycG9sYXRpb25Db25maWc7XG5cbiAgICAgICAgLy8gSUNVIGV4cHJlc3Npb24gaXMgYSBwbGFpbiBzdHJpbmcsIG5vdCB3cmFwcGVkIGludG8gc3RhcnRcbiAgICAgICAgLy8gYW5kIGVuZCB0YWdzLCBzbyB3ZSB3cmFwIGl0IGJlZm9yZSBwYXNzaW5nIHRvIGJpbmRpbmcgcGFyc2VyXG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSBgJHtjb25maWcuc3RhcnR9JHt2YWx1ZX0ke2NvbmZpZy5lbmR9YDtcblxuICAgICAgICAvLyBDdXJyZW50bHkgd2hlbiB0aGUgYHBsdXJhbGAgb3IgYHNlbGVjdGAga2V5d29yZHMgaW4gYW4gSUNVIGNvbnRhaW4gdHJhaWxpbmcgc3BhY2VzIChlLmcuXG4gICAgICAgIC8vIGB7Y291bnQsIHNlbGVjdCAsIC4uLn1gKSwgdGhlc2Ugc3BhY2VzIGFyZSBhbHNvIGluY2x1ZGVkIGludG8gdGhlIGtleSBuYW1lcyBpbiBJQ1UgdmFyc1xuICAgICAgICAvLyAoZS5nLiBcIlZBUl9TRUxFQ1QgXCIpLiBUaGVzZSB0cmFpbGluZyBzcGFjZXMgYXJlIG5vdCBkZXNpcmFibGUsIHNpbmNlIHRoZXkgd2lsbCBsYXRlciBiZVxuICAgICAgICAvLyBjb252ZXJ0ZWQgaW50byBgX2Agc3ltYm9scyB3aGlsZSBub3JtYWxpemluZyBwbGFjZWhvbGRlciBuYW1lcywgd2hpY2ggbWlnaHQgbGVhZCB0b1xuICAgICAgICAvLyBtaXNtYXRjaGVzIGF0IHJ1bnRpbWUgKGkuZS4gcGxhY2Vob2xkZXIgd2lsbCBub3QgYmUgcmVwbGFjZWQgd2l0aCB0aGUgY29ycmVjdCB2YWx1ZSkuXG4gICAgICAgIGNvbnN0IGZvcm1hdHRlZEtleSA9IGtleS50cmltKCk7XG5cbiAgICAgICAgdmFyc1tmb3JtYXR0ZWRLZXldID1cbiAgICAgICAgICAgIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHdyYXBwZWQsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKSBhcyB0LkJvdW5kVGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYWNlaG9sZGVyc1trZXldID0gdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odmFsdWUsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IHQuSWN1KHZhcnMsIHBsYWNlaG9sZGVycywgZXhwYW5zaW9uLnNvdXJjZVNwYW4sIG1lc3NhZ2UpO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gY29udmVydCB2aWV3IGVuZ2luZSBgUGFyc2VkUHJvcGVydHlgIHRvIGEgZm9ybWF0IHN1aXRhYmxlIGZvciBJVllcbiAgcHJpdmF0ZSBleHRyYWN0QXR0cmlidXRlcyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICBpMThuUHJvcHNNZXRhOiB7W2tleTogc3RyaW5nXTogaTE4bi5JMThuTWV0YX0pOlxuICAgICAge2JvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10sIGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdfSB7XG4gICAgY29uc3QgYm91bmQ6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBjb25zdCBpMThuID0gaTE4blByb3BzTWV0YVtwcm9wLm5hbWVdO1xuICAgICAgaWYgKHByb3AuaXNMaXRlcmFsKSB7XG4gICAgICAgIGxpdGVyYWwucHVzaChuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICAgICAgcHJvcC5uYW1lLCBwcm9wLmV4cHJlc3Npb24uc291cmNlIHx8ICcnLCBwcm9wLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgaTE4bikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHZhbGlkYXRpb24gaXMgc2tpcHBlZCBhbmQgcHJvcGVydHkgbWFwcGluZyBpcyBkaXNhYmxlZFxuICAgICAgICAvLyBkdWUgdG8gdGhlIGZhY3QgdGhhdCB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSBhIGdpdmVuIHByb3AgaXMgbm90IGFuXG4gICAgICAgIC8vIGlucHV0IG9mIGEgZGlyZWN0aXZlIGFuZCBkaXJlY3RpdmUgbWF0Y2hpbmcgaGFwcGVucyBhdCBydW50aW1lLlxuICAgICAgICBjb25zdCBiZXAgPSB0aGlzLmJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgICBlbGVtZW50TmFtZSwgcHJvcCwgLyogc2tpcFZhbGlkYXRpb24gKi8gdHJ1ZSwgLyogbWFwUHJvcGVydHlOYW1lICovIGZhbHNlKTtcbiAgICAgICAgYm91bmQucHVzaCh0LkJvdW5kQXR0cmlidXRlLmZyb21Cb3VuZEVsZW1lbnRQcm9wZXJ0eShiZXAsIGkxOG4pKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7Ym91bmQsIGxpdGVyYWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuICAgIGNvbnN0IGFic29sdXRlT2Zmc2V0ID1cbiAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiA/IGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDogc3JjU3Bhbi5zdGFydC5vZmZzZXQ7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVLZXlTcGFuKHNyY1NwYW46IFBhcnNlU291cmNlU3BhbiwgcHJlZml4OiBzdHJpbmcsIGlkZW50aWZpZXI6IHN0cmluZykge1xuICAgICAgLy8gV2UgbmVlZCB0byBhZGp1c3QgdGhlIHN0YXJ0IGxvY2F0aW9uIGZvciB0aGUga2V5U3BhbiB0byBhY2NvdW50IGZvciB0aGUgcmVtb3ZlZCAnZGF0YS0nXG4gICAgICAvLyBwcmVmaXggZnJvbSBgbm9ybWFsaXplQXR0cmlidXRlTmFtZWAuXG4gICAgICBjb25zdCBub3JtYWxpemF0aW9uQWRqdXN0bWVudCA9IGF0dHJpYnV0ZS5uYW1lLmxlbmd0aCAtIG5hbWUubGVuZ3RoO1xuICAgICAgY29uc3Qga2V5U3BhblN0YXJ0ID0gc3JjU3Bhbi5zdGFydC5tb3ZlQnkocHJlZml4Lmxlbmd0aCArIG5vcm1hbGl6YXRpb25BZGp1c3RtZW50KTtcbiAgICAgIGNvbnN0IGtleVNwYW5FbmQgPSBrZXlTcGFuU3RhcnQubW92ZUJ5KGlkZW50aWZpZXIubGVuZ3RoKTtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKGtleVNwYW5TdGFydCwga2V5U3BhbkVuZCwgaWRlbnRpZmllcik7XG4gICAgfVxuXG4gICAgY29uc3QgYmluZFBhcnRzID0gbmFtZS5tYXRjaChCSU5EX05BTUVfUkVHRVhQKTtcbiAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaGFzQmluZGluZyA9IHRydWU7XG4gICAgICBpZiAoYmluZFBhcnRzW0tXX0JJTkRfSURYXSAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgYmluZFBhcnRzW0tXX0JJTkRfSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfTEVUX0lEWF0pIHtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGJpbmRQYXJ0c1tLV19MRVRfSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgICAgdGhpcy5wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBrZXlTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCB2YXJpYWJsZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwibGV0LVwiIGlzIG9ubHkgc3VwcG9ydGVkIG9uIG5nLXRlbXBsYXRlIGVsZW1lbnRzLmAsIHNyY1NwYW4pO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX1JFRl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgdGhpcy5wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgcmVmZXJlbmNlcyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19PTl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIGV2ZW50cyk7XG4gICAgICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0JJTkRPTl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgYmluZFBhcnRzW0tXX0JJTkRPTl9JRFhdLCBpZGVudGlmaWVyKTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgaWRlbnRpZmllciwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCwgYXR0cmlidXRlLnZhbHVlU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMsIGtleVNwYW4pO1xuICAgICAgICB0aGlzLnBhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0FUX0lEWF0pIHtcbiAgICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgJycsIG5hbWUpO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCwgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIHBhcnNlZFByb3BlcnRpZXMsIGtleVNwYW4pO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0pIHtcbiAgICAgICAgY29uc3Qga2V5U3BhbiA9IGNyZWF0ZUtleVNwYW4oc3JjU3BhbiwgJ1soJywgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSk7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sICdbJywgYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0pO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMsIGtleVNwYW4pO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBrZXlTcGFuID0gY3JlYXRlS2V5U3BhbihzcmNTcGFuLCAnJyAvKiBwcmVmaXggKi8sIG5hbWUpO1xuICAgICAgaGFzQmluZGluZyA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyxcbiAgICAgICAgICBrZXlTcGFuKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzQmluZGluZztcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBpMThuPzogaTE4bi5JMThuTWV0YSk6IHQuVGV4dHx0LkJvdW5kVGV4dCB7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh2YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBleHByID8gbmV3IHQuQm91bmRUZXh0KGV4cHIsIHNvdXJjZVNwYW4sIGkxOG4pIDogbmV3IHQuVGV4dCh2YWx1ZU5vTmdzcCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlVmFyaWFibGUoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbiwga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiB2YXJpYWJsZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFZhcmlhYmxlIGRvZXMgbm90IGhhdmUgYSBuYW1lYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgdmFyaWFibGVzLnB1c2gobmV3IHQuVmFyaWFibGUoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4sIGtleVNwYW4sIHZhbHVlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVJlZmVyZW5jZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHJlZmVyZW5jZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFJlZmVyZW5jZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHJlZmVyZW5jZXMucHVzaChuZXcgdC5SZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLFxuICAgICAgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgIGAke25hbWV9Q2hhbmdlYCwgYCR7ZXhwcmVzc2lvbn09JGV2ZW50YCwgc291cmNlU3BhbiwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sXG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBldmVudHMpO1xuICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogdC5FbGVtZW50fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIG51bGwpO1xuICAgIHJldHVybiBuZXcgdC5FbGVtZW50KFxuICAgICAgICBhc3QubmFtZSwgaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuYXR0cnMpIGFzIHQuVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgICAvKiBpbnB1dHMgKi9bXSwgLyogb3V0cHV0cyAqL1tdLCBjaGlsZHJlbizCoCAvKiByZWZlcmVuY2VzICovW10sIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiB0LlRleHRBdHRyaWJ1dGUge1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICBhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3BhbiwgdW5kZWZpbmVkLCBhdHRyaWJ1dGUuaTE4bik7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogdC5UZXh0IHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbik6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5jb25zdCBOT05fQklOREFCTEVfVklTSVRPUiA9IG5ldyBOb25CaW5kYWJsZVZpc2l0b3IoKTtcblxuZnVuY3Rpb24gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIC9eZGF0YS0vaS50ZXN0KGF0dHJOYW1lKSA/IGF0dHJOYW1lLnN1YnN0cmluZyg1KSA6IGF0dHJOYW1lO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudHMoZXZlbnRzOiBQYXJzZWRFdmVudFtdLCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10pIHtcbiAgYm91bmRFdmVudHMucHVzaCguLi5ldmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChlKSkpO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5mdW5jdGlvbiBpc0NvbW1lbnROb2RlKG5vZGU6IGh0bWwuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIGh0bWwuQ29tbWVudDtcbn1cblxuZnVuY3Rpb24gdGV4dENvbnRlbnRzKG5vZGU6IGh0bWwuRWxlbWVudCk6IHN0cmluZ3xudWxsIHtcbiAgaWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoICE9PSAxIHx8ICEobm9kZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIGh0bWwuVGV4dCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKG5vZGUuY2hpbGRyZW5bMF0gYXMgaHRtbC5UZXh0KS52YWx1ZTtcbiAgfVxufVxuIl19