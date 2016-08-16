/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { HtmlParser as BaseHtmlParser } from '../ml_parser/html_parser';
import { InterpolationConfig } from '../ml_parser/interpolation_config';
import { ParseTreeResult } from '../ml_parser/parser';
export declare class HtmlParser implements BaseHtmlParser {
    private _htmlParser;
    private _translations;
    private _translationsFormat;
    getTagDefinition: any;
    constructor(_htmlParser: BaseHtmlParser, _translations?: string, _translationsFormat?: string);
    parse(source: string, url: string, parseExpansionForms?: boolean, interpolationConfig?: InterpolationConfig): ParseTreeResult;
    private _createSerializer(interpolationConfig);
}
