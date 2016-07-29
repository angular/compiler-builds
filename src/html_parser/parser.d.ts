import * as html from './ast';
import { ParseSourceSpan, ParseError } from '../parse_util';
import { TagDefinition } from './tags';
import { InterpolationConfig } from './interpolation_config';
export declare class TreeError extends ParseError {
    elementName: string;
    static create(elementName: string, span: ParseSourceSpan, msg: string): TreeError;
    constructor(elementName: string, span: ParseSourceSpan, msg: string);
}
export declare class ParseTreeResult {
    rootNodes: html.Node[];
    errors: ParseError[];
    constructor(rootNodes: html.Node[], errors: ParseError[]);
}
export declare class Parser {
    private _getTagDefinition;
    constructor(_getTagDefinition: (tagName: string) => TagDefinition);
    parse(source: string, url: string, parseExpansionForms?: boolean, interpolationConfig?: InterpolationConfig): ParseTreeResult;
}
