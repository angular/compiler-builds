import * as html from '../ml_parser/ast';
import { ParseError } from '../parse_util';
import { BindingParser } from '../template_parser/binding_parser';
import * as t from './r3_ast';
export declare class HtmlToTemplateTransform implements html.Visitor {
    private bindingParser;
    errors: ParseError[];
    ngContentSelectors: string[];
    hasNgContent: boolean;
    constructor(bindingParser: BindingParser);
    visitElement(element: html.Element): t.Node | null;
    visitAttribute(attribute: html.Attribute): t.Node;
    visitText(text: html.Text): t.Node;
    visitComment(comment: html.Comment): null;
    visitExpansion(expansion: html.Expansion): null;
    visitExpansionCase(expansionCase: html.ExpansionCase): null;
    private createBoundAttributes(elementName, properties);
    private parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references);
    private parseVariable(identifier, value, sourceSpan, variables);
    private parseReference(identifier, value, sourceSpan, references);
    private parseAssignmentEvent(name, expression, sourceSpan, targetMatchableAttrs, boundEvents);
    private reportError(message, sourceSpan, level?);
}
