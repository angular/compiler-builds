/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Parser as ExpressionParser } from '../expression_parser/parser';
import { HtmlAst, HtmlAttrAst, HtmlElementAst, HtmlTextAst } from '../html_ast';
import { InterpolationConfig } from '../interpolation_config';
import { ParseError, ParseSourceSpan } from '../parse_util';
import { Message } from './message';
export declare const I18N_ATTR: string;
export declare const I18N_ATTR_PREFIX: string;
/**
 * An i18n error.
 */
export declare class I18nError extends ParseError {
    constructor(span: ParseSourceSpan, msg: string);
}
export declare function partition(nodes: HtmlAst[], errors: ParseError[], implicitTags: string[]): Part[];
export declare class Part {
    rootElement: HtmlElementAst;
    rootTextNode: HtmlTextAst;
    children: HtmlAst[];
    i18n: string;
    hasI18n: boolean;
    constructor(rootElement: HtmlElementAst, rootTextNode: HtmlTextAst, children: HtmlAst[], i18n: string, hasI18n: boolean);
    sourceSpan: ParseSourceSpan;
    createMessage(parser: ExpressionParser, interpolationConfig: InterpolationConfig): Message;
}
export declare function meaning(i18n: string): string;
export declare function description(i18n: string): string;
export declare function messageFromAttribute(parser: ExpressionParser, interpolationConfig: InterpolationConfig, attr: HtmlAttrAst, meaning?: string, description?: string): Message;
/**
 * Replace interpolation in the `value` string with placeholders
 */
export declare function removeInterpolation(value: string, source: ParseSourceSpan, expressionParser: ExpressionParser, interpolationConfig: InterpolationConfig): string;
/**
 * Extract the placeholder name from the interpolation.
 *
 * Use a custom name when specified (ie: `{{<expression> //i18n(ph="FIRST")}}`) otherwise generate a
 * unique name.
 */
export declare function extractPhNameFromInterpolation(input: string, index: number): string;
/**
 * Return a unique placeholder name based on the given name
 */
export declare function dedupePhName(usedNames: Map<string, number>, name: string): string;
/**
 * Convert a list of nodes to a string message.
 *
 */
export declare function stringifyNodes(nodes: HtmlAst[], expressionParser: ExpressionParser, interpolationConfig: InterpolationConfig): string;
