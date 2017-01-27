/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MissingTranslationStrategy } from '@angular/core';
import { HtmlParser } from '../ml_parser/html_parser';
import { InterpolationConfig } from '../ml_parser/interpolation_config';
import { ParseTreeResult } from '../ml_parser/parser';
import { Console } from '../private_import_core';
export declare class I18NHtmlParser implements HtmlParser {
    private _htmlParser;
    private _translations;
    private _translationsFormat;
    private _missingTranslation;
    private _console;
    getTagDefinition: any;
    constructor(_htmlParser: HtmlParser, _translations?: string, _translationsFormat?: string, _missingTranslation?: MissingTranslationStrategy, _console?: Console);
    parse(source: string, url: string, parseExpansionForms?: boolean, interpolationConfig?: InterpolationConfig): ParseTreeResult;
    private _createSerializer();
}
