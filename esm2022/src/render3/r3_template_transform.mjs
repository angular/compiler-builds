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
import { createForLoop, createIfBlock, createSwitchBlock } from './r3_control_flow';
import { createDeferredBlock } from './r3_deferred_blocks';
import { I18N_ICU_VAR_PREFIX, isI18nRootNode } from './view/i18n/util';
const BIND_NAME_REGEXP = /^(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*)$/;
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
const BINDING_DELIMS = {
    BANANA_BOX: { start: '[(', end: ')]' },
    PROPERTY: { start: '[', end: ']' },
    EVENT: { start: '(', end: ')' },
};
const TEMPLATE_ATTR_PREFIX = '*';
export function htmlAstToRender3Ast(htmlNodes, bindingParser, options) {
    const transformer = new HtmlAstToIvyAst(bindingParser, options);
    const ivyNodes = html.visitAll(transformer, htmlNodes);
    // Errors might originate in either the binding parser or the html to ivy transformer
    const allErrors = bindingParser.errors.concat(transformer.errors);
    const result = {
        nodes: ivyNodes,
        errors: allErrors,
        styleUrls: transformer.styleUrls,
        styles: transformer.styles,
        ngContentSelectors: transformer.ngContentSelectors
    };
    if (options.collectCommentNodes) {
        result.commentNodes = transformer.commentNodes;
    }
    return result;
}
class HtmlAstToIvyAst {
    constructor(bindingParser, options) {
        this.bindingParser = bindingParser;
        this.options = options;
        this.errors = [];
        this.styles = [];
        this.styleUrls = [];
        this.ngContentSelectors = [];
        // This array will be populated if `Render3ParseOptions['collectCommentNodes']` is true
        this.commentNodes = [];
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
                this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, absoluteValueOffset, [], templateParsedProperties, parsedVariables, true /* isIvyAst */);
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
        let children;
        if (preparsedElement.nonBindable) {
            // The `NonBindableVisitor` may need to return an array of nodes for block groups so we need
            // to flatten the array here. Avoid doing this for the `HtmlAstToIvyAst` since `flat` creates
            // a new array.
            children = html.visitAll(NON_BINDABLE_VISITOR, element.children).flat(Infinity);
        }
        else {
            children = html.visitAll(this, element.children);
        }
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
            const name = parsedElement instanceof t.Template ? null : parsedElement.name;
            parsedElement = new t.Template(name, hoistedAttrs.attributes, hoistedAttrs.inputs, hoistedAttrs.outputs, templateAttrs, [parsedElement], [ /* no references */], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, i18n);
        }
        if (isI18nRootElement) {
            this.inI18nBlock = false;
        }
        return parsedElement;
    }
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.keySpan, attribute.valueSpan, attribute.i18n);
    }
    visitText(text) {
        return this._visitTextWithInterpolation(text.value, text.sourceSpan, text.tokens, text.i18n);
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
                // Currently when the `plural` or `select` keywords in an ICU contain trailing spaces (e.g.
                // `{count, select , ...}`), these spaces are also included into the key names in ICU vars
                // (e.g. "VAR_SELECT "). These trailing spaces are not desirable, since they will later be
                // converted into `_` symbols while normalizing placeholder names, which might lead to
                // mismatches at runtime (i.e. placeholder will not be replaced with the correct value).
                const formattedKey = key.trim();
                const ast = this.bindingParser.parseInterpolationExpression(value.text, value.sourceSpan);
                vars[formattedKey] = new t.BoundText(ast, value.sourceSpan);
            }
            else {
                placeholders[key] = this._visitTextWithInterpolation(value.text, value.sourceSpan, null);
            }
        });
        return new t.Icu(vars, placeholders, expansion.sourceSpan, message);
    }
    visitExpansionCase(expansionCase) {
        return null;
    }
    visitComment(comment) {
        if (this.options.collectCommentNodes) {
            this.commentNodes.push(new t.Comment(comment.value || '', comment.sourceSpan));
        }
        return null;
    }
    visitBlockGroup(group, context) {
        const primaryBlock = group.blocks[0];
        // The HTML parser ensures that we don't hit this case, but we have an assertion just in case.
        if (!primaryBlock) {
            this.reportError('Block group must have at least one block.', group.sourceSpan);
            return null;
        }
        if (!this.options.enabledBlockTypes.has(primaryBlock.name)) {
            this.reportError(`Unrecognized block "${primaryBlock.name}".`, primaryBlock.sourceSpan);
            return null;
        }
        let result = null;
        switch (primaryBlock.name) {
            case 'defer':
                result = createDeferredBlock(group, this, this.bindingParser);
                break;
            case 'switch':
                result = createSwitchBlock(group, this, this.bindingParser);
                break;
            case 'for':
                result = createForLoop(group, this, this.bindingParser);
                break;
            case 'if':
                result = createIfBlock(group, this, this.bindingParser);
                break;
            default:
                result = {
                    node: null,
                    errors: [new ParseError(primaryBlock.sourceSpan, `Unrecognized block "${primaryBlock.name}".`)]
                };
                break;
        }
        this.errors.push(...result.errors);
        return result.node;
    }
    visitBlock(block, context) { }
    visitBlockParameter(parameter, context) { }
    // convert view engine `ParsedProperty` to a format suitable for IVY
    extractAttributes(elementName, properties, i18nPropsMeta) {
        const bound = [];
        const literal = [];
        properties.forEach(prop => {
            const i18n = i18nPropsMeta[prop.name];
            if (prop.isLiteral) {
                literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan, prop.keySpan, prop.valueSpan, i18n));
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
            return new ParseSourceSpan(keySpanStart, keySpanEnd, keySpanStart, identifier);
        }
        const bindParts = name.match(BIND_NAME_REGEXP);
        if (bindParts) {
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
                const keySpan = createKeySpan(srcSpan, bindParts[KW_REF_IDX], identifier);
                this.parseReference(identifier, value, srcSpan, keySpan, attribute.valueSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                const events = [];
                const identifier = bindParts[IDENT_KW_IDX];
                const keySpan = createKeySpan(srcSpan, bindParts[KW_ON_IDX], identifier);
                this.bindingParser.parseEvent(identifier, value, /* isAssignmentEvent */ false, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events, keySpan);
                addEvents(events, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                const identifier = bindParts[IDENT_KW_IDX];
                const keySpan = createKeySpan(srcSpan, bindParts[KW_BINDON_IDX], identifier);
                this.bindingParser.parsePropertyBinding(identifier, value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
                this.parseAssignmentEvent(identifier, value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents, keySpan);
            }
            else if (bindParts[KW_AT_IDX]) {
                const keySpan = createKeySpan(srcSpan, '', name);
                this.bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
            }
            return true;
        }
        // We didn't see a kw-prefixed property binding, but we have not yet checked
        // for the []/()/[()] syntax.
        let delims = null;
        if (name.startsWith(BINDING_DELIMS.BANANA_BOX.start)) {
            delims = BINDING_DELIMS.BANANA_BOX;
        }
        else if (name.startsWith(BINDING_DELIMS.PROPERTY.start)) {
            delims = BINDING_DELIMS.PROPERTY;
        }
        else if (name.startsWith(BINDING_DELIMS.EVENT.start)) {
            delims = BINDING_DELIMS.EVENT;
        }
        if (delims !== null &&
            // NOTE: older versions of the parser would match a start/end delimited
            // binding iff the property name was terminated by the ending delimiter
            // and the identifier in the binding was non-empty.
            // TODO(ayazhafiz): update this to handle malformed bindings.
            name.endsWith(delims.end) && name.length > delims.start.length + delims.end.length) {
            const identifier = name.substring(delims.start.length, name.length - delims.end.length);
            const keySpan = createKeySpan(srcSpan, delims.start, identifier);
            if (delims.start === BINDING_DELIMS.BANANA_BOX.start) {
                this.bindingParser.parsePropertyBinding(identifier, value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
                this.parseAssignmentEvent(identifier, value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents, keySpan);
            }
            else if (delims.start === BINDING_DELIMS.PROPERTY.start) {
                this.bindingParser.parsePropertyBinding(identifier, value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan);
            }
            else {
                const events = [];
                this.bindingParser.parseEvent(identifier, value, /* isAssignmentEvent */ false, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events, keySpan);
                addEvents(events, boundEvents);
            }
            return true;
        }
        // No explicit binding found.
        const keySpan = createKeySpan(srcSpan, '' /* prefix */, name);
        const hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, attribute.valueSpan, matchableAttributes, parsedProperties, keySpan, attribute.valueTokens ?? null);
        return hasBinding;
    }
    _visitTextWithInterpolation(value, sourceSpan, interpolatedTokens, i18n) {
        const valueNoNgsp = replaceNgsp(value);
        const expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan, interpolatedTokens);
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
    parseReference(identifier, value, sourceSpan, keySpan, valueSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        else if (identifier.length === 0) {
            this.reportError(`Reference does not have a name`, sourceSpan);
        }
        else if (references.some(reference => reference.name === identifier)) {
            this.reportError(`Reference "#${identifier}" is defined more than once`, sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan, keySpan, valueSpan));
    }
    parseAssignmentEvent(name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents, keySpan) {
        const events = [];
        this.bindingParser.parseEvent(`${name}Change`, `${expression} =$event`, /* isAssignmentEvent */ true, sourceSpan, valueSpan || sourceSpan, targetMatchableAttrs, events, keySpan);
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
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.keySpan, attribute.valueSpan, attribute.i18n);
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
    visitBlockGroup(group, context) {
        const nodes = html.visitAll(this, group.blocks);
        // We only need to do the end tag since the start will be added as a part of the primary block.
        if (group.endSourceSpan !== null) {
            nodes.push(new t.Text(group.endSourceSpan.toString(), group.endSourceSpan));
        }
        return nodes;
    }
    visitBlock(block, context) {
        return [
            // In an ngNonBindable context we treat the opening/closing tags of block as plain text.
            // This is the as if the `tokenizeBlocks` option was disabled.
            new t.Text(block.startSourceSpan.toString(), block.startSourceSpan),
            ...html.visitAll(this, block.children)
        ];
    }
    visitBlockParameter(parameter, context) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUUvQyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0UsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFM0QsT0FBTyxFQUFDLG9CQUFvQixFQUFFLGVBQWUsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRTVGLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBQyxhQUFhLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDbEYsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDekQsT0FBTyxFQUFDLG1CQUFtQixFQUFFLGNBQWMsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRXJFLE1BQU0sZ0JBQWdCLEdBQUcsdURBQXVELENBQUM7QUFFakYsb0JBQW9CO0FBQ3BCLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQztBQUN0QixtQkFBbUI7QUFDbkIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLHFCQUFxQjtBQUNyQixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDckIsa0JBQWtCO0FBQ2xCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixzQkFBc0I7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LFNBQVMsc0JBQXNCLENBQUMsUUFBZ0I7SUFDOUMsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDckUsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLE1BQXFCLEVBQUUsV0FBMkI7SUFDbkUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEUsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLElBQWU7SUFDdEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLElBQWU7SUFDcEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUN0QyxDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUMsSUFBa0I7SUFDdEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzFFLE9BQU8sSUFBSSxDQUFDO0tBQ2I7U0FBTTtRQUNMLE9BQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQWUsQ0FBQyxLQUFLLENBQUM7S0FDOUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VkRXZlbnQsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRWYXJpYWJsZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtyZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7SW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4sIEludGVycG9sYXRlZFRleHRUb2tlbn0gZnJvbSAnLi4vbWxfcGFyc2VyL3Rva2Vucyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aXNTdHlsZVVybFJlc29sdmFibGV9IGZyb20gJy4uL3N0eWxlX3VybF9yZXNvbHZlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge1ByZXBhcnNlZEVsZW1lbnRUeXBlLCBwcmVwYXJzZUVsZW1lbnR9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wcmVwYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7Y3JlYXRlRm9yTG9vcCwgY3JlYXRlSWZCbG9jaywgY3JlYXRlU3dpdGNoQmxvY2t9IGZyb20gJy4vcjNfY29udHJvbF9mbG93JztcbmltcG9ydCB7Y3JlYXRlRGVmZXJyZWRCbG9ja30gZnJvbSAnLi9yM19kZWZlcnJlZF9ibG9ja3MnO1xuaW1wb3J0IHtJMThOX0lDVV9WQVJfUFJFRklYLCBpc0kxOG5Sb290Tm9kZX0gZnJvbSAnLi92aWV3L2kxOG4vdXRpbCc7XG5cbmNvbnN0IEJJTkRfTkFNRV9SRUdFWFAgPSAvXig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4qKSQvO1xuXG4vLyBHcm91cCAxID0gXCJiaW5kLVwiXG5jb25zdCBLV19CSU5EX0lEWCA9IDE7XG4vLyBHcm91cCAyID0gXCJsZXQtXCJcbmNvbnN0IEtXX0xFVF9JRFggPSAyO1xuLy8gR3JvdXAgMyA9IFwicmVmLS8jXCJcbmNvbnN0IEtXX1JFRl9JRFggPSAzO1xuLy8gR3JvdXAgNCA9IFwib24tXCJcbmNvbnN0IEtXX09OX0lEWCA9IDQ7XG4vLyBHcm91cCA1ID0gXCJiaW5kb24tXCJcbmNvbnN0IEtXX0JJTkRPTl9JRFggPSA1O1xuLy8gR3JvdXAgNiA9IFwiQFwiXG5jb25zdCBLV19BVF9JRFggPSA2O1xuLy8gR3JvdXAgNyA9IHRoZSBpZGVudGlmaWVyIGFmdGVyIFwiYmluZC1cIiwgXCJsZXQtXCIsIFwicmVmLS8jXCIsIFwib24tXCIsIFwiYmluZG9uLVwiIG9yIFwiQFwiXG5jb25zdCBJREVOVF9LV19JRFggPSA3O1xuXG5jb25zdCBCSU5ESU5HX0RFTElNUyA9IHtcbiAgQkFOQU5BX0JPWDoge3N0YXJ0OiAnWygnLCBlbmQ6ICcpXSd9LFxuICBQUk9QRVJUWToge3N0YXJ0OiAnWycsIGVuZDogJ10nfSxcbiAgRVZFTlQ6IHtzdGFydDogJygnLCBlbmQ6ICcpJ30sXG59O1xuXG5jb25zdCBURU1QTEFURV9BVFRSX1BSRUZJWCA9ICcqJztcblxuLy8gUmVzdWx0IG9mIHRoZSBodG1sIEFTVCB0byBJdnkgQVNUIHRyYW5zZm9ybWF0aW9uXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlcjNQYXJzZVJlc3VsdCB7XG4gIG5vZGVzOiB0Lk5vZGVbXTtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW107XG4gIHN0eWxlczogc3RyaW5nW107XG4gIHN0eWxlVXJsczogc3RyaW5nW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG4gIC8vIFdpbGwgYmUgZGVmaW5lZCBpZiBgUmVuZGVyM1BhcnNlT3B0aW9uc1snY29sbGVjdENvbW1lbnROb2RlcyddYCBpcyB0cnVlXG4gIGNvbW1lbnROb2Rlcz86IHQuQ29tbWVudFtdO1xufVxuXG5pbnRlcmZhY2UgUmVuZGVyM1BhcnNlT3B0aW9ucyB7XG4gIGNvbGxlY3RDb21tZW50Tm9kZXM6IGJvb2xlYW47XG4gIGVuYWJsZWRCbG9ja1R5cGVzOiBTZXQ8c3RyaW5nPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGh0bWxBc3RUb1JlbmRlcjNBc3QoXG4gICAgaHRtbE5vZGVzOiBodG1sLk5vZGVbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICBvcHRpb25zOiBSZW5kZXIzUGFyc2VPcHRpb25zKTogUmVuZGVyM1BhcnNlUmVzdWx0IHtcbiAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgSHRtbEFzdFRvSXZ5QXN0KGJpbmRpbmdQYXJzZXIsIG9wdGlvbnMpO1xuICBjb25zdCBpdnlOb2RlcyA9IGh0bWwudmlzaXRBbGwodHJhbnNmb3JtZXIsIGh0bWxOb2Rlcyk7XG5cbiAgLy8gRXJyb3JzIG1pZ2h0IG9yaWdpbmF0ZSBpbiBlaXRoZXIgdGhlIGJpbmRpbmcgcGFyc2VyIG9yIHRoZSBodG1sIHRvIGl2eSB0cmFuc2Zvcm1lclxuICBjb25zdCBhbGxFcnJvcnMgPSBiaW5kaW5nUGFyc2VyLmVycm9ycy5jb25jYXQodHJhbnNmb3JtZXIuZXJyb3JzKTtcblxuICBjb25zdCByZXN1bHQ6IFJlbmRlcjNQYXJzZVJlc3VsdCA9IHtcbiAgICBub2RlczogaXZ5Tm9kZXMsXG4gICAgZXJyb3JzOiBhbGxFcnJvcnMsXG4gICAgc3R5bGVVcmxzOiB0cmFuc2Zvcm1lci5zdHlsZVVybHMsXG4gICAgc3R5bGVzOiB0cmFuc2Zvcm1lci5zdHlsZXMsXG4gICAgbmdDb250ZW50U2VsZWN0b3JzOiB0cmFuc2Zvcm1lci5uZ0NvbnRlbnRTZWxlY3RvcnNcbiAgfTtcbiAgaWYgKG9wdGlvbnMuY29sbGVjdENvbW1lbnROb2Rlcykge1xuICAgIHJlc3VsdC5jb21tZW50Tm9kZXMgPSB0cmFuc2Zvcm1lci5jb21tZW50Tm9kZXM7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuY2xhc3MgSHRtbEFzdFRvSXZ5QXN0IGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgc3R5bGVzOiBzdHJpbmdbXSA9IFtdO1xuICBzdHlsZVVybHM6IHN0cmluZ1tdID0gW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgLy8gVGhpcyBhcnJheSB3aWxsIGJlIHBvcHVsYXRlZCBpZiBgUmVuZGVyM1BhcnNlT3B0aW9uc1snY29sbGVjdENvbW1lbnROb2RlcyddYCBpcyB0cnVlXG4gIGNvbW1lbnROb2RlczogdC5Db21tZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBpbkkxOG5CbG9jazogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgcHJpdmF0ZSBvcHRpb25zOiBSZW5kZXIzUGFyc2VPcHRpb25zKSB7fVxuXG4gIC8vIEhUTUwgdmlzaXRvclxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50KTogdC5Ob2RlfG51bGwge1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50ID0gaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKTtcbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIGlmICh0aGlzLmluSTE4bkJsb2NrKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQ2Fubm90IG1hcmsgYW4gZWxlbWVudCBhcyB0cmFuc2xhdGFibGUgaW5zaWRlIG9mIGEgdHJhbnNsYXRhYmxlIHNlY3Rpb24uIFBsZWFzZSByZW1vdmUgdGhlIG5lc3RlZCBpMThuIG1hcmtlci4nLFxuICAgICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICBjb25zdCBjb250ZW50cyA9IHRleHRDb250ZW50cyhlbGVtZW50KTtcbiAgICAgIGlmIChjb250ZW50cyAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnN0eWxlcy5wdXNoKGNvbnRlbnRzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEVTSEVFVCAmJlxuICAgICAgICBpc1N0eWxlVXJsUmVzb2x2YWJsZShwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKSkge1xuICAgICAgdGhpcy5zdHlsZVVybHMucHVzaChwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgYSBgPG5nLXRlbXBsYXRlPmBcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgY29uc3QgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSA9IFtdO1xuICAgIGNvbnN0IHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG4gICAgY29uc3QgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgaTE4bkF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IGkxOG4uSTE4bk1ldGF9ID0ge307XG5cbiAgICBjb25zdCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZVZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGhhcyBhbnkgKi1hdHRyaWJ1dGVcbiAgICBsZXQgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZSBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJpYnV0ZS5uYW1lKTtcblxuICAgICAgLy8gYCphdHRyYCBkZWZpbmVzIHRlbXBsYXRlIGJpbmRpbmdzXG4gICAgICBsZXQgaXNUZW1wbGF0ZUJpbmRpbmcgPSBmYWxzZTtcblxuICAgICAgaWYgKGF0dHJpYnV0ZS5pMThuKSB7XG4gICAgICAgIGkxOG5BdHRyc01ldGFbYXR0cmlidXRlLm5hbWVdID0gYXR0cmlidXRlLmkxOG47XG4gICAgICB9XG5cbiAgICAgIGlmIChub3JtYWxpemVkTmFtZS5zdGFydHNXaXRoKFRFTVBMQVRFX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAvLyAqLWF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBDYW4ndCBoYXZlIG11bHRpcGxlIHRlbXBsYXRlIGJpbmRpbmdzIG9uIG9uZSBlbGVtZW50LiBVc2Ugb25seSBvbmUgYXR0cmlidXRlIHByZWZpeGVkIHdpdGggKmAsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgICBpc1RlbXBsYXRlQmluZGluZyA9IHRydWU7XG4gICAgICAgIGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG5cbiAgICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICAgIGNvbnN0IGFic29sdXRlVmFsdWVPZmZzZXQgPSBhdHRyaWJ1dGUudmFsdWVTcGFuID9cbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDpcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIHZhbHVlIHNwYW4gdGhlIGF0dHJpYnV0ZSBkb2VzIG5vdCBoYXZlIGEgdmFsdWUsIGxpa2UgYGF0dHJgIGluXG4gICAgICAgICAgICAvL2A8ZGl2IGF0dHI+PC9kaXY+YC4gSW4gdGhpcyBjYXNlLCBwb2ludCB0byBvbmUgY2hhcmFjdGVyIGJleW9uZCB0aGUgbGFzdCBjaGFyYWN0ZXIgb2ZcbiAgICAgICAgICAgIC8vIHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIGF0dHJpYnV0ZS5uYW1lLmxlbmd0aDtcblxuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgICB0ZW1wbGF0ZUtleSwgdGVtcGxhdGVWYWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGFic29sdXRlVmFsdWVPZmZzZXQsIFtdLFxuICAgICAgICAgICAgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLCBwYXJzZWRWYXJpYWJsZXMsIHRydWUgLyogaXNJdnlBc3QgKi8pO1xuICAgICAgICB0ZW1wbGF0ZVZhcmlhYmxlcy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAoXG4gICAgICAgICAgICB2ID0+IG5ldyB0LlZhcmlhYmxlKHYubmFtZSwgdi52YWx1ZSwgdi5zb3VyY2VTcGFuLCB2LmtleVNwYW4sIHYudmFsdWVTcGFuKSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQ2hlY2sgZm9yIHZhcmlhYmxlcywgZXZlbnRzLCBwcm9wZXJ0eSBiaW5kaW5ncywgaW50ZXJwb2xhdGlvblxuICAgICAgICBoYXNCaW5kaW5nID0gdGhpcy5wYXJzZUF0dHJpYnV0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyaWJ1dGUsIFtdLCBwYXJzZWRQcm9wZXJ0aWVzLCBib3VuZEV2ZW50cywgdmFyaWFibGVzLCByZWZlcmVuY2VzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFoYXNCaW5kaW5nICYmICFpc1RlbXBsYXRlQmluZGluZykge1xuICAgICAgICAvLyBkb24ndCBpbmNsdWRlIHRoZSBiaW5kaW5ncyBhcyBhdHRyaWJ1dGVzIGFzIHdlbGwgaW4gdGhlIEFTVFxuICAgICAgICBhdHRyaWJ1dGVzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgY2hpbGRyZW46IHQuTm9kZVtdO1xuXG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUpIHtcbiAgICAgIC8vIFRoZSBgTm9uQmluZGFibGVWaXNpdG9yYCBtYXkgbmVlZCB0byByZXR1cm4gYW4gYXJyYXkgb2Ygbm9kZXMgZm9yIGJsb2NrIGdyb3VwcyBzbyB3ZSBuZWVkXG4gICAgICAvLyB0byBmbGF0dGVuIHRoZSBhcnJheSBoZXJlLiBBdm9pZCBkb2luZyB0aGlzIGZvciB0aGUgYEh0bWxBc3RUb0l2eUFzdGAgc2luY2UgYGZsYXRgIGNyZWF0ZXNcbiAgICAgIC8vIGEgbmV3IGFycmF5LlxuICAgICAgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKE5PTl9CSU5EQUJMRV9WSVNJVE9SLCBlbGVtZW50LmNoaWxkcmVuKS5mbGF0KEluZmluaXR5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIGxldCBwYXJzZWRFbGVtZW50OiB0LkNvbnRlbnR8dC5UZW1wbGF0ZXx0LkVsZW1lbnR8dW5kZWZpbmVkO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLk5HX0NPTlRFTlQpIHtcbiAgICAgIC8vIGA8bmctY29udGVudD5gXG4gICAgICBpZiAoZWxlbWVudC5jaGlsZHJlbiAmJlxuICAgICAgICAgICFlbGVtZW50LmNoaWxkcmVuLmV2ZXJ5KFxuICAgICAgICAgICAgICAobm9kZTogaHRtbC5Ob2RlKSA9PiBpc0VtcHR5VGV4dE5vZGUobm9kZSkgfHwgaXNDb21tZW50Tm9kZShub2RlKSkpIHtcbiAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihgPG5nLWNvbnRlbnQ+IGVsZW1lbnQgY2Fubm90IGhhdmUgY29udGVudC5gLCBlbGVtZW50LnNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBwcmVwYXJzZWRFbGVtZW50LnNlbGVjdEF0dHI7XG4gICAgICBjb25zdCBhdHRyczogdC5UZXh0QXR0cmlidXRlW10gPSBlbGVtZW50LmF0dHJzLm1hcChhdHRyID0+IHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cikpO1xuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkNvbnRlbnQoc2VsZWN0b3IsIGF0dHJzLCBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4bik7XG5cbiAgICAgIHRoaXMubmdDb250ZW50U2VsZWN0b3JzLnB1c2goc2VsZWN0b3IpO1xuICAgIH0gZWxzZSBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgIC8vIGA8bmctdGVtcGxhdGU+YFxuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnQubmFtZSwgcGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICBlbGVtZW50Lm5hbWUsIGF0dHJpYnV0ZXMsIGF0dHJzLmJvdW5kLCBib3VuZEV2ZW50cywgWy8qIG5vIHRlbXBsYXRlIGF0dHJpYnV0ZXMgKi9dLFxuICAgICAgICAgIGNoaWxkcmVuLCByZWZlcmVuY2VzLCB2YXJpYWJsZXMsIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICAgICAgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhdHRycyA9IHRoaXMuZXh0cmFjdEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzLCBpMThuQXR0cnNNZXRhKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbGVtZW50KFxuICAgICAgICAgIGVsZW1lbnQubmFtZSwgYXR0cmlidXRlcywgYXR0cnMuYm91bmQsIGJvdW5kRXZlbnRzLCBjaGlsZHJlbiwgcmVmZXJlbmNlcyxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4bik7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgLy8gSWYgdGhpcyBub2RlIGlzIGFuIGlubGluZS10ZW1wbGF0ZSAoZS5nLiBoYXMgKm5nRm9yKSB0aGVuIHdlIG5lZWQgdG8gY3JlYXRlIGEgdGVtcGxhdGVcbiAgICAgIC8vIG5vZGUgdGhhdCBjb250YWlucyB0aGlzIG5vZGUuXG4gICAgICAvLyBNb3Jlb3ZlciwgaWYgdGhlIG5vZGUgaXMgYW4gZWxlbWVudCwgdGhlbiB3ZSBuZWVkIHRvIGhvaXN0IGl0cyBhdHRyaWJ1dGVzIHRvIHRoZSB0ZW1wbGF0ZVxuICAgICAgLy8gbm9kZSBmb3IgbWF0Y2hpbmcgYWdhaW5zdCBjb250ZW50IHByb2plY3Rpb24gc2VsZWN0b3JzLlxuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUF0dHJzOiAodC5UZXh0QXR0cmlidXRlfHQuQm91bmRBdHRyaWJ1dGUpW10gPSBbXTtcbiAgICAgIGF0dHJzLmxpdGVyYWwuZm9yRWFjaChhdHRyID0+IHRlbXBsYXRlQXR0cnMucHVzaChhdHRyKSk7XG4gICAgICBhdHRycy5ib3VuZC5mb3JFYWNoKGF0dHIgPT4gdGVtcGxhdGVBdHRycy5wdXNoKGF0dHIpKTtcbiAgICAgIGNvbnN0IGhvaXN0ZWRBdHRycyA9IHBhcnNlZEVsZW1lbnQgaW5zdGFuY2VvZiB0LkVsZW1lbnQgP1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHBhcnNlZEVsZW1lbnQuYXR0cmlidXRlcyxcbiAgICAgICAgICAgIGlucHV0czogcGFyc2VkRWxlbWVudC5pbnB1dHMsXG4gICAgICAgICAgICBvdXRwdXRzOiBwYXJzZWRFbGVtZW50Lm91dHB1dHMsXG4gICAgICAgICAgfSA6XG4gICAgICAgICAge2F0dHJpYnV0ZXM6IFtdLCBpbnB1dHM6IFtdLCBvdXRwdXRzOiBbXX07XG5cbiAgICAgIC8vIEZvciA8bmctdGVtcGxhdGU+cyB3aXRoIHN0cnVjdHVyYWwgZGlyZWN0aXZlcyBvbiB0aGVtLCBhdm9pZCBwYXNzaW5nIGkxOG4gaW5mb3JtYXRpb24gdG9cbiAgICAgIC8vIHRoZSB3cmFwcGluZyB0ZW1wbGF0ZSB0byBwcmV2ZW50IHVubmVjZXNzYXJ5IGkxOG4gaW5zdHJ1Y3Rpb25zIGZyb20gYmVpbmcgZ2VuZXJhdGVkLiBUaGVcbiAgICAgIC8vIG5lY2Vzc2FyeSBpMThuIG1ldGEgaW5mb3JtYXRpb24gd2lsbCBiZSBleHRyYWN0ZWQgZnJvbSBjaGlsZCBlbGVtZW50cy5cbiAgICAgIGNvbnN0IGkxOG4gPSBpc1RlbXBsYXRlRWxlbWVudCAmJiBpc0kxOG5Sb290RWxlbWVudCA/IHVuZGVmaW5lZCA6IGVsZW1lbnQuaTE4bjtcbiAgICAgIGNvbnN0IG5hbWUgPSBwYXJzZWRFbGVtZW50IGluc3RhbmNlb2YgdC5UZW1wbGF0ZSA/IG51bGwgOiBwYXJzZWRFbGVtZW50Lm5hbWU7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICBuYW1lLCBob2lzdGVkQXR0cnMuYXR0cmlidXRlcywgaG9pc3RlZEF0dHJzLmlucHV0cywgaG9pc3RlZEF0dHJzLm91dHB1dHMsIHRlbXBsYXRlQXR0cnMsXG4gICAgICAgICAgW3BhcnNlZEVsZW1lbnRdLCBbLyogbm8gcmVmZXJlbmNlcyAqL10sIHRlbXBsYXRlVmFyaWFibGVzLCBlbGVtZW50LnNvdXJjZVNwYW4sXG4gICAgICAgICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgaTE4bik7XG4gICAgfVxuICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgdGhpcy5pbkkxOG5CbG9jayA9IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkRWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiB0LlRleHRBdHRyaWJ1dGUge1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICBhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3BhbiwgYXR0cmlidXRlLmtleVNwYW4sXG4gICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIGF0dHJpYnV0ZS5pMThuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0Lk5vZGUge1xuICAgIHJldHVybiB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4sIHRleHQudG9rZW5zLCB0ZXh0LmkxOG4pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbik6IHQuSWN1fG51bGwge1xuICAgIGlmICghZXhwYW5zaW9uLmkxOG4pIHtcbiAgICAgIC8vIGRvIG5vdCBnZW5lcmF0ZSBJY3UgaW4gY2FzZSBpdCB3YXMgY3JlYXRlZFxuICAgICAgLy8gb3V0c2lkZSBvZiBpMThuIGJsb2NrIGluIGEgdGVtcGxhdGVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoIWlzSTE4blJvb3ROb2RlKGV4cGFuc2lvbi5pMThuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHR5cGUgXCIke2V4cGFuc2lvbi5pMThuLmNvbnN0cnVjdG9yfVwiIGZvciBcImkxOG5cIiBwcm9wZXJ0eSBvZiAke1xuICAgICAgICAgIGV4cGFuc2lvbi5zb3VyY2VTcGFuLnRvU3RyaW5nKCl9LiBFeHBlY3RlZCBhIFwiTWVzc2FnZVwiYCk7XG4gICAgfVxuICAgIGNvbnN0IG1lc3NhZ2UgPSBleHBhbnNpb24uaTE4bjtcbiAgICBjb25zdCB2YXJzOiB7W25hbWU6IHN0cmluZ106IHQuQm91bmRUZXh0fSA9IHt9O1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyczoge1tuYW1lOiBzdHJpbmddOiB0LlRleHR8dC5Cb3VuZFRleHR9ID0ge307XG4gICAgLy8gZXh0cmFjdCBWQVJzIGZyb20gSUNVcyAtIHdlIHByb2Nlc3MgdGhlbSBzZXBhcmF0ZWx5IHdoaWxlXG4gICAgLy8gYXNzZW1ibGluZyByZXN1bHRpbmcgbWVzc2FnZSB2aWEgZ29vZy5nZXRNc2cgZnVuY3Rpb24sIHNpbmNlXG4gICAgLy8gd2UgbmVlZCB0byBwYXNzIHRoZW0gdG8gdG9wLWxldmVsIGdvb2cuZ2V0TXNnIGNhbGxcbiAgICBPYmplY3Qua2V5cyhtZXNzYWdlLnBsYWNlaG9sZGVycykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBtZXNzYWdlLnBsYWNlaG9sZGVyc1trZXldO1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKEkxOE5fSUNVX1ZBUl9QUkVGSVgpKSB7XG4gICAgICAgIC8vIEN1cnJlbnRseSB3aGVuIHRoZSBgcGx1cmFsYCBvciBgc2VsZWN0YCBrZXl3b3JkcyBpbiBhbiBJQ1UgY29udGFpbiB0cmFpbGluZyBzcGFjZXMgKGUuZy5cbiAgICAgICAgLy8gYHtjb3VudCwgc2VsZWN0ICwgLi4ufWApLCB0aGVzZSBzcGFjZXMgYXJlIGFsc28gaW5jbHVkZWQgaW50byB0aGUga2V5IG5hbWVzIGluIElDVSB2YXJzXG4gICAgICAgIC8vIChlLmcuIFwiVkFSX1NFTEVDVCBcIikuIFRoZXNlIHRyYWlsaW5nIHNwYWNlcyBhcmUgbm90IGRlc2lyYWJsZSwgc2luY2UgdGhleSB3aWxsIGxhdGVyIGJlXG4gICAgICAgIC8vIGNvbnZlcnRlZCBpbnRvIGBfYCBzeW1ib2xzIHdoaWxlIG5vcm1hbGl6aW5nIHBsYWNlaG9sZGVyIG5hbWVzLCB3aGljaCBtaWdodCBsZWFkIHRvXG4gICAgICAgIC8vIG1pc21hdGNoZXMgYXQgcnVudGltZSAoaS5lLiBwbGFjZWhvbGRlciB3aWxsIG5vdCBiZSByZXBsYWNlZCB3aXRoIHRoZSBjb3JyZWN0IHZhbHVlKS5cbiAgICAgICAgY29uc3QgZm9ybWF0dGVkS2V5ID0ga2V5LnRyaW0oKTtcblxuICAgICAgICBjb25zdCBhc3QgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZS50ZXh0LCB2YWx1ZS5zb3VyY2VTcGFuKTtcblxuICAgICAgICB2YXJzW2Zvcm1hdHRlZEtleV0gPSBuZXcgdC5Cb3VuZFRleHQoYXN0LCB2YWx1ZS5zb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYWNlaG9sZGVyc1trZXldID0gdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odmFsdWUudGV4dCwgdmFsdWUuc291cmNlU3BhbiwgbnVsbCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyB0LkljdSh2YXJzLCBwbGFjZWhvbGRlcnMsIGV4cGFuc2lvbi5zb3VyY2VTcGFuLCBtZXNzYWdlKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBudWxsIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbGxlY3RDb21tZW50Tm9kZXMpIHtcbiAgICAgIHRoaXMuY29tbWVudE5vZGVzLnB1c2gobmV3IHQuQ29tbWVudChjb21tZW50LnZhbHVlIHx8ICcnLCBjb21tZW50LnNvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEJsb2NrR3JvdXAoZ3JvdXA6IGh0bWwuQmxvY2tHcm91cCwgY29udGV4dDogYW55KTogdC5Ob2RlfG51bGwge1xuICAgIGNvbnN0IHByaW1hcnlCbG9jayA9IGdyb3VwLmJsb2Nrc1swXTtcblxuICAgIC8vIFRoZSBIVE1MIHBhcnNlciBlbnN1cmVzIHRoYXQgd2UgZG9uJ3QgaGl0IHRoaXMgY2FzZSwgYnV0IHdlIGhhdmUgYW4gYXNzZXJ0aW9uIGp1c3QgaW4gY2FzZS5cbiAgICBpZiAoIXByaW1hcnlCbG9jaykge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcignQmxvY2sgZ3JvdXAgbXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBibG9jay4nLCBncm91cC5zb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5vcHRpb25zLmVuYWJsZWRCbG9ja1R5cGVzLmhhcyhwcmltYXJ5QmxvY2submFtZSkpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFVucmVjb2duaXplZCBibG9jayBcIiR7cHJpbWFyeUJsb2NrLm5hbWV9XCIuYCwgcHJpbWFyeUJsb2NrLnNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDoge25vZGU6IHQuTm9kZXxudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX18bnVsbCA9IG51bGw7XG5cbiAgICBzd2l0Y2ggKHByaW1hcnlCbG9jay5uYW1lKSB7XG4gICAgICBjYXNlICdkZWZlcic6XG4gICAgICAgIHJlc3VsdCA9IGNyZWF0ZURlZmVycmVkQmxvY2soZ3JvdXAsIHRoaXMsIHRoaXMuYmluZGluZ1BhcnNlcik7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzd2l0Y2gnOlxuICAgICAgICByZXN1bHQgPSBjcmVhdGVTd2l0Y2hCbG9jayhncm91cCwgdGhpcywgdGhpcy5iaW5kaW5nUGFyc2VyKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2Zvcic6XG4gICAgICAgIHJlc3VsdCA9IGNyZWF0ZUZvckxvb3AoZ3JvdXAsIHRoaXMsIHRoaXMuYmluZGluZ1BhcnNlcik7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdpZic6XG4gICAgICAgIHJlc3VsdCA9IGNyZWF0ZUlmQmxvY2soZ3JvdXAsIHRoaXMsIHRoaXMuYmluZGluZ1BhcnNlcik7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgbm9kZTogbnVsbCxcbiAgICAgICAgICBlcnJvcnM6IFtuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgcHJpbWFyeUJsb2NrLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgYmxvY2sgXCIke3ByaW1hcnlCbG9jay5uYW1lfVwiLmApXVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICB0aGlzLmVycm9ycy5wdXNoKC4uLnJlc3VsdC5lcnJvcnMpO1xuICAgIHJldHVybiByZXN1bHQubm9kZTtcbiAgfVxuXG4gIHZpc2l0QmxvY2soYmxvY2s6IGh0bWwuQmxvY2ssIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEJsb2NrUGFyYW1ldGVyKHBhcmFtZXRlcjogaHRtbC5CbG9ja1BhcmFtZXRlciwgY29udGV4dDogYW55KSB7fVxuXG4gIC8vIGNvbnZlcnQgdmlldyBlbmdpbmUgYFBhcnNlZFByb3BlcnR5YCB0byBhIGZvcm1hdCBzdWl0YWJsZSBmb3IgSVZZXG4gIHByaXZhdGUgZXh0cmFjdEF0dHJpYnV0ZXMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBwcm9wZXJ0aWVzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgaTE4blByb3BzTWV0YToge1trZXk6IHN0cmluZ106IGkxOG4uSTE4bk1ldGF9KTpcbiAgICAgIHtib3VuZDogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBsaXRlcmFsOiB0LlRleHRBdHRyaWJ1dGVbXX0ge1xuICAgIGNvbnN0IGJvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBsaXRlcmFsOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgcHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgY29uc3QgaTE4biA9IGkxOG5Qcm9wc01ldGFbcHJvcC5uYW1lXTtcbiAgICAgIGlmIChwcm9wLmlzTGl0ZXJhbCkge1xuICAgICAgICBsaXRlcmFsLnB1c2gobmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgICAgIHByb3AubmFtZSwgcHJvcC5leHByZXNzaW9uLnNvdXJjZSB8fCAnJywgcHJvcC5zb3VyY2VTcGFuLCBwcm9wLmtleVNwYW4sIHByb3AudmFsdWVTcGFuLFxuICAgICAgICAgICAgaTE4bikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHZhbGlkYXRpb24gaXMgc2tpcHBlZCBhbmQgcHJvcGVydHkgbWFwcGluZyBpcyBkaXNhYmxlZFxuICAgICAgICAvLyBkdWUgdG8gdGhlIGZhY3QgdGhhdCB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSBhIGdpdmVuIHByb3AgaXMgbm90IGFuXG4gICAgICAgIC8vIGlucHV0IG9mIGEgZGlyZWN0aXZlIGFuZCBkaXJlY3RpdmUgbWF0Y2hpbmcgaGFwcGVucyBhdCBydW50aW1lLlxuICAgICAgICBjb25zdCBiZXAgPSB0aGlzLmJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgICBlbGVtZW50TmFtZSwgcHJvcCwgLyogc2tpcFZhbGlkYXRpb24gKi8gdHJ1ZSwgLyogbWFwUHJvcGVydHlOYW1lICovIGZhbHNlKTtcbiAgICAgICAgYm91bmQucHVzaCh0LkJvdW5kQXR0cmlidXRlLmZyb21Cb3VuZEVsZW1lbnRQcm9wZXJ0eShiZXAsIGkxOG4pKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7Ym91bmQsIGxpdGVyYWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuICAgIGNvbnN0IGFic29sdXRlT2Zmc2V0ID1cbiAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiA/IGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDogc3JjU3Bhbi5zdGFydC5vZmZzZXQ7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVLZXlTcGFuKHNyY1NwYW46IFBhcnNlU291cmNlU3BhbiwgcHJlZml4OiBzdHJpbmcsIGlkZW50aWZpZXI6IHN0cmluZykge1xuICAgICAgLy8gV2UgbmVlZCB0byBhZGp1c3QgdGhlIHN0YXJ0IGxvY2F0aW9uIGZvciB0aGUga2V5U3BhbiB0byBhY2NvdW50IGZvciB0aGUgcmVtb3ZlZCAnZGF0YS0nXG4gICAgICAvLyBwcmVmaXggZnJvbSBgbm9ybWFsaXplQXR0cmlidXRlTmFtZWAuXG4gICAgICBjb25zdCBub3JtYWxpemF0aW9uQWRqdXN0bWVudCA9IGF0dHJpYnV0ZS5uYW1lLmxlbmd0aCAtIG5hbWUubGVuZ3RoO1xuICAgICAgY29uc3Qga2V5U3BhblN0YXJ0ID0gc3JjU3Bhbi5zdGFydC5tb3ZlQnkocHJlZml4Lmxlbmd0aCArIG5vcm1hbGl6YXRpb25BZGp1c3RtZW50KTtcbiAgICAgIGNvbnN0IGtleVNwYW5FbmQgPSBrZXlTcGFuU3RhcnQubW92ZUJ5KGlkZW50aWZpZXIubGVuZ3RoKTtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKGtleVNwYW5TdGFydCwga2V5U3BhbkVuZCwga2V5U3BhblN0YXJ0LCBpZGVudGlmaWVyKTtcbiAgICB9XG5cbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaWYgKGJpbmRQYXJ0c1tLV19CSU5EX0lEWF0gIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGJpbmRQYXJ0c1tLV19CSU5EX0lEWF0sIGlkZW50aWZpZXIpO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBpZGVudGlmaWVyLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcywga2V5U3Bhbik7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICBjb25zdCBrZXlTcGFuID0gY3JlYXRlS2V5U3BhbihzcmNTcGFuLCBiaW5kUGFydHNbS1dfTEVUX0lEWF0sIGlkZW50aWZpZXIpO1xuICAgICAgICAgIHRoaXMucGFyc2VWYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3Bhbiwga2V5U3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgdmFyaWFibGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGBcImxldC1cIiBpcyBvbmx5IHN1cHBvcnRlZCBvbiBuZy10ZW1wbGF0ZSBlbGVtZW50cy5gLCBzcmNTcGFuKTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19SRUZfSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGJpbmRQYXJ0c1tLV19SRUZfSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMucGFyc2VSZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGtleVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIHJlZmVyZW5jZXMpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfT05fSURYXSkge1xuICAgICAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICBjb25zdCBrZXlTcGFuID0gY3JlYXRlS2V5U3BhbihzcmNTcGFuLCBiaW5kUGFydHNbS1dfT05fSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgaWRlbnRpZmllciwgdmFsdWUsIC8qIGlzQXNzaWdubWVudEV2ZW50ICovIGZhbHNlLCBzcmNTcGFuLFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBzcmNTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBldmVudHMsIGtleVNwYW4pO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSwgaWRlbnRpZmllcik7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBib3VuZEV2ZW50cyxcbiAgICAgICAgICAgIGtleVNwYW4pO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICBjb25zdCBrZXlTcGFuID0gY3JlYXRlS2V5U3BhbihzcmNTcGFuLCAnJywgbmFtZSk7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLFxuICAgICAgICAgICAgcGFyc2VkUHJvcGVydGllcywga2V5U3Bhbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBkaWRuJ3Qgc2VlIGEga3ctcHJlZml4ZWQgcHJvcGVydHkgYmluZGluZywgYnV0IHdlIGhhdmUgbm90IHlldCBjaGVja2VkXG4gICAgLy8gZm9yIHRoZSBbXS8oKS9bKCldIHN5bnRheC5cbiAgICBsZXQgZGVsaW1zOiB7c3RhcnQ6IHN0cmluZywgZW5kOiBzdHJpbmd9fG51bGwgPSBudWxsO1xuICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgoQklORElOR19ERUxJTVMuQkFOQU5BX0JPWC5zdGFydCkpIHtcbiAgICAgIGRlbGltcyA9IEJJTkRJTkdfREVMSU1TLkJBTkFOQV9CT1g7XG4gICAgfSBlbHNlIGlmIChuYW1lLnN0YXJ0c1dpdGgoQklORElOR19ERUxJTVMuUFJPUEVSVFkuc3RhcnQpKSB7XG4gICAgICBkZWxpbXMgPSBCSU5ESU5HX0RFTElNUy5QUk9QRVJUWTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuc3RhcnRzV2l0aChCSU5ESU5HX0RFTElNUy5FVkVOVC5zdGFydCkpIHtcbiAgICAgIGRlbGltcyA9IEJJTkRJTkdfREVMSU1TLkVWRU5UO1xuICAgIH1cbiAgICBpZiAoZGVsaW1zICE9PSBudWxsICYmXG4gICAgICAgIC8vIE5PVEU6IG9sZGVyIHZlcnNpb25zIG9mIHRoZSBwYXJzZXIgd291bGQgbWF0Y2ggYSBzdGFydC9lbmQgZGVsaW1pdGVkXG4gICAgICAgIC8vIGJpbmRpbmcgaWZmIHRoZSBwcm9wZXJ0eSBuYW1lIHdhcyB0ZXJtaW5hdGVkIGJ5IHRoZSBlbmRpbmcgZGVsaW1pdGVyXG4gICAgICAgIC8vIGFuZCB0aGUgaWRlbnRpZmllciBpbiB0aGUgYmluZGluZyB3YXMgbm9uLWVtcHR5LlxuICAgICAgICAvLyBUT0RPKGF5YXpoYWZpeik6IHVwZGF0ZSB0aGlzIHRvIGhhbmRsZSBtYWxmb3JtZWQgYmluZGluZ3MuXG4gICAgICAgIG5hbWUuZW5kc1dpdGgoZGVsaW1zLmVuZCkgJiYgbmFtZS5sZW5ndGggPiBkZWxpbXMuc3RhcnQubGVuZ3RoICsgZGVsaW1zLmVuZC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBuYW1lLnN1YnN0cmluZyhkZWxpbXMuc3RhcnQubGVuZ3RoLCBuYW1lLmxlbmd0aCAtIGRlbGltcy5lbmQubGVuZ3RoKTtcbiAgICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sIGRlbGltcy5zdGFydCwgaWRlbnRpZmllcik7XG4gICAgICBpZiAoZGVsaW1zLnN0YXJ0ID09PSBCSU5ESU5HX0RFTElNUy5CQU5BTkFfQk9YLnN0YXJ0KSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBib3VuZEV2ZW50cyxcbiAgICAgICAgICAgIGtleVNwYW4pO1xuICAgICAgfSBlbHNlIGlmIChkZWxpbXMuc3RhcnQgPT09IEJJTkRJTkdfREVMSU1TLlBST1BFUlRZLnN0YXJ0KSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzLCBrZXlTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGlkZW50aWZpZXIsIHZhbHVlLCAvKiBpc0Fzc2lnbm1lbnRFdmVudCAqLyBmYWxzZSwgc3JjU3BhbixcbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgc3JjU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzLCBrZXlTcGFuKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBObyBleHBsaWNpdCBiaW5kaW5nIGZvdW5kLlxuICAgIGNvbnN0IGtleVNwYW4gPSBjcmVhdGVLZXlTcGFuKHNyY1NwYW4sICcnIC8qIHByZWZpeCAqLywgbmFtZSk7XG4gICAgY29uc3QgaGFzQmluZGluZyA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMsIGtleVNwYW4sXG4gICAgICAgIGF0dHJpYnV0ZS52YWx1ZVRva2VucyA/PyBudWxsKTtcbiAgICByZXR1cm4gaGFzQmluZGluZztcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgaW50ZXJwb2xhdGVkVG9rZW5zOiBJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbltdfEludGVycG9sYXRlZFRleHRUb2tlbltdfG51bGwsXG4gICAgICBpMThuPzogaTE4bi5JMThuTWV0YSk6IHQuVGV4dHx0LkJvdW5kVGV4dCB7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh2YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHNvdXJjZVNwYW4sIGludGVycG9sYXRlZFRva2Vucyk7XG4gICAgcmV0dXJuIGV4cHIgPyBuZXcgdC5Cb3VuZFRleHQoZXhwciwgc291cmNlU3BhbiwgaTE4bikgOiBuZXcgdC5UZXh0KHZhbHVlTm9OZ3NwLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VWYXJpYWJsZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBrZXlTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHZhcmlhYmxlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgVmFyaWFibGUgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB2YXJpYWJsZXMucHVzaChuZXcgdC5WYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGtleVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiByZWZlcmVuY2UgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBSZWZlcmVuY2UgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKHJlZmVyZW5jZXMuc29tZShyZWZlcmVuY2UgPT4gcmVmZXJlbmNlLm5hbWUgPT09IGlkZW50aWZpZXIpKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBSZWZlcmVuY2UgXCIjJHtpZGVudGlmaWVyfVwiIGlzIGRlZmluZWQgbW9yZSB0aGFuIG9uY2VgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICByZWZlcmVuY2VzLnB1c2gobmV3IHQuUmVmZXJlbmNlKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSwga2V5U3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgIGAke25hbWV9Q2hhbmdlYCwgYCR7ZXhwcmVzc2lvbn0gPSRldmVudGAsIC8qIGlzQXNzaWdubWVudEV2ZW50ICovIHRydWUsIHNvdXJjZVNwYW4sXG4gICAgICAgIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgZXZlbnRzLCBrZXlTcGFuKTtcbiAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCk6IHQuRWxlbWVudHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9IGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuLCBudWxsKTtcbiAgICByZXR1cm4gbmV3IHQuRWxlbWVudChcbiAgICAgICAgYXN0Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmF0dHJzKSBhcyB0LlRleHRBdHRyaWJ1dGVbXSxcbiAgICAgICAgLyogaW5wdXRzICovW10sIC8qIG91dHB1dHMgKi9bXSwgY2hpbGRyZW4sIC8qIHJlZmVyZW5jZXMgKi9bXSwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IHQuVGV4dEF0dHJpYnV0ZSB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHRBdHRyaWJ1dGUoXG4gICAgICAgIGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBhdHRyaWJ1dGUua2V5U3BhbixcbiAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiwgYXR0cmlidXRlLmkxOG4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuVGV4dCB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHQodGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24pOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEJsb2NrR3JvdXAoZ3JvdXA6IGh0bWwuQmxvY2tHcm91cCwgY29udGV4dDogYW55KSB7XG4gICAgY29uc3Qgbm9kZXMgPSBodG1sLnZpc2l0QWxsKHRoaXMsIGdyb3VwLmJsb2Nrcyk7XG5cbiAgICAvLyBXZSBvbmx5IG5lZWQgdG8gZG8gdGhlIGVuZCB0YWcgc2luY2UgdGhlIHN0YXJ0IHdpbGwgYmUgYWRkZWQgYXMgYSBwYXJ0IG9mIHRoZSBwcmltYXJ5IGJsb2NrLlxuICAgIGlmIChncm91cC5lbmRTb3VyY2VTcGFuICE9PSBudWxsKSB7XG4gICAgICBub2Rlcy5wdXNoKG5ldyB0LlRleHQoZ3JvdXAuZW5kU291cmNlU3Bhbi50b1N0cmluZygpLCBncm91cC5lbmRTb3VyY2VTcGFuKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgdmlzaXRCbG9jayhibG9jazogaHRtbC5CbG9jaywgY29udGV4dDogYW55KSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIEluIGFuIG5nTm9uQmluZGFibGUgY29udGV4dCB3ZSB0cmVhdCB0aGUgb3BlbmluZy9jbG9zaW5nIHRhZ3Mgb2YgYmxvY2sgYXMgcGxhaW4gdGV4dC5cbiAgICAgIC8vIFRoaXMgaXMgdGhlIGFzIGlmIHRoZSBgdG9rZW5pemVCbG9ja3NgIG9wdGlvbiB3YXMgZGlzYWJsZWQuXG4gICAgICBuZXcgdC5UZXh0KGJsb2NrLnN0YXJ0U291cmNlU3Bhbi50b1N0cmluZygpLCBibG9jay5zdGFydFNvdXJjZVNwYW4pLFxuICAgICAgLi4uaHRtbC52aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbilcbiAgICBdO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihwYXJhbWV0ZXI6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmNvbnN0IE5PTl9CSU5EQUJMRV9WSVNJVE9SID0gbmV3IE5vbkJpbmRhYmxlVmlzaXRvcigpO1xuXG5mdW5jdGlvbiBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gL15kYXRhLS9pLnRlc3QoYXR0ck5hbWUpID8gYXR0ck5hbWUuc3Vic3RyaW5nKDUpIDogYXR0ck5hbWU7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50cyhldmVudHM6IFBhcnNlZEV2ZW50W10sIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSkge1xuICBib3VuZEV2ZW50cy5wdXNoKC4uLmV2ZW50cy5tYXAoZSA9PiB0LkJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGUpKSk7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlUZXh0Tm9kZShub2RlOiBodG1sLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBodG1sLlRleHQgJiYgbm9kZS52YWx1ZS50cmltKCkubGVuZ3RoID09IDA7XG59XG5cbmZ1bmN0aW9uIGlzQ29tbWVudE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5Db21tZW50O1xufVxuXG5mdW5jdGlvbiB0ZXh0Q29udGVudHMobm9kZTogaHRtbC5FbGVtZW50KTogc3RyaW5nfG51bGwge1xuICBpZiAobm9kZS5jaGlsZHJlbi5sZW5ndGggIT09IDEgfHwgIShub2RlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgaHRtbC5UZXh0KSkge1xuICAgIHJldHVybiBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAobm9kZS5jaGlsZHJlblswXSBhcyBodG1sLlRleHQpLnZhbHVlO1xuICB9XG59XG4iXX0=