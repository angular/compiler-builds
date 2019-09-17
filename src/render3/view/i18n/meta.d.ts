/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as i18n from '../../../i18n/i18n_ast';
import * as html from '../../../ml_parser/ast';
import { InterpolationConfig } from '../../../ml_parser/interpolation_config';
import { ParseTreeResult } from '../../../ml_parser/parser';
import * as o from '../../../output/output_ast';
export declare type I18nMeta = {
    id?: string;
    description?: string;
    meaning?: string;
};
/**
 * This visitor walks over HTML parse tree and converts information stored in
 * i18n-related attributes ("i18n" and "i18n-*") into i18n meta object that is
 * stored with other element's and attribute's information.
 */
export declare class I18nMetaVisitor implements html.Visitor {
    private interpolationConfig;
    private keepI18nAttrs;
    private _createI18nMessage;
    constructor(interpolationConfig?: InterpolationConfig, keepI18nAttrs?: boolean);
    private _generateI18nMessage;
    visitElement(element: html.Element, context: any): any;
    visitExpansion(expansion: html.Expansion, context: any): any;
    visitText(text: html.Text, context: any): any;
    visitAttribute(attribute: html.Attribute, context: any): any;
    visitComment(comment: html.Comment, context: any): any;
    visitExpansionCase(expansionCase: html.ExpansionCase, context: any): any;
}
export declare function processI18nMeta(htmlAstWithErrors: ParseTreeResult, interpolationConfig?: InterpolationConfig): ParseTreeResult;
export declare function metaFromI18nMessage(message: i18n.Message, id?: string | null): I18nMeta;
/**
 * Parses i18n metas like:
 *  - "@@id",
 *  - "description[@@id]",
 *  - "meaning|description[@@id]"
 * and returns an object with parsed output.
 *
 * @param meta String that represents i18n meta
 * @returns Object with id, meaning and description fields
 */
export declare function parseI18nMeta(meta?: string): I18nMeta;
/**
 * Serialize the given `meta` into a string that can be used in a `$localize` tagged string metadata
 * block. The format is the same as that parsed by `parseI18nMeta()`.
 *
 * @param meta The metadata to serialize
 */
export declare function serializeI18nMeta(meta: I18nMeta): string;
export declare function i18nMetaToDocStmt(meta: I18nMeta): o.JSDocCommentStmt | null;
