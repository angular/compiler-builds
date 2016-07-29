/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as xml from '../../html_parser/ast';
import { HtmlParser } from '../../html_parser/html_parser';
import { InterpolationConfig } from '../../html_parser/interpolation_config';
import * as i18n from '../i18n_ast';
import { Serializer } from './serializer';
export declare class Xtb implements Serializer {
    private _htmlParser;
    private _interpolationConfig;
    constructor(_htmlParser: HtmlParser, _interpolationConfig: InterpolationConfig);
    write(messageMap: {
        [id: string]: i18n.Message;
    }): string;
    load(content: string, url: string, placeholders: {
        [id: string]: {
            [name: string]: string;
        };
    }): {
        [id: string]: xml.Node[];
    };
}
