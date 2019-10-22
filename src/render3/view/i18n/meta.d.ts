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
import * as o from '../../../output/output_ast';
export declare type I18nMeta = {
    id?: string;
    customId?: string;
    legacyId?: string;
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
    private i18nLegacyMessageIdFormat;
    hasI18nMeta: boolean;
    private _createI18nMessage;
    constructor(interpolationConfig?: InterpolationConfig, keepI18nAttrs?: boolean, i18nLegacyMessageIdFormat?: string);
    private _generateI18nMessage;
    visitElement(element: html.Element): any;
    visitExpansion(expansion: html.Expansion, currentMessage: i18n.Message | undefined): any;
    visitText(text: html.Text): any;
    visitAttribute(attribute: html.Attribute): any;
    visitComment(comment: html.Comment): any;
    visitExpansionCase(expansionCase: html.ExpansionCase): any;
    /**
     * Parse the general form `meta` passed into extract the explicit metadata needed to create a
     * `Message`.
     *
     * There are three possibilities for the `meta` variable
     * 1) a string from an `i18n` template attribute: parse it to extract the metadata values.
     * 2) a `Message` from a previous processing pass: reuse the metadata values in the message.
     * 4) other: ignore this and just process the message metadata as normal
     *
     * @param meta the bucket that holds information about the message
     * @returns the parsed metadata.
     */
    private _parseMetadata;
    /**
     * Generate (or restore) message id if not specified already.
     */
    private _setMessageId;
    /**
     * Update the `message` with a `legacyId` if necessary.
     *
     * @param message the message whose legacy id should be set
     * @param meta information about the message being processed
     */
    private _setLegacyId;
}
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
 * Serialize the given `meta` and `messagePart` a string that can be used in a `$localize`
 * tagged string. The format of the metadata is the same as that parsed by `parseI18nMeta()`.
 *
 * @param meta The metadata to serialize
 * @param messagePart The first part of the tagged string
 */
export declare function serializeI18nHead(meta: I18nMeta, messagePart: string): string;
/**
 * Serialize the given `placeholderName` and `messagePart` into strings that can be used in a
 * `$localize` tagged string.
 *
 * @param placeholderName The placeholder name to serialize
 * @param messagePart The following message string after this placeholder
 */
export declare function serializeI18nTemplatePart(placeholderName: string, messagePart: string): string;
export declare function i18nMetaToDocStmt(meta: I18nMeta): o.JSDocCommentStmt | null;
export declare function escapeStartingColon(str: string): string;
export declare function escapeColons(str: string): string;
