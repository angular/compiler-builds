/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../html_parser/ast';
import { I18nError } from './parse_util';
/**
 * Extract translatable message from an html AST as a list of html AST nodes
 */
export declare function extractAstMessages(sourceAst: html.Node[], implicitTags: string[], implicitAttrs: {
    [k: string]: string[];
}): ExtractionResult;
export declare class ExtractionResult {
    messages: Message[];
    errors: I18nError[];
    constructor(messages: Message[], errors: I18nError[]);
}
/**
 * A Message contain a fragment (= a subtree) of the source html AST.
 */
export declare class Message {
    nodes: html.Node[];
    meaning: string;
    description: string;
    constructor(nodes: html.Node[], meaning: string, description: string);
}
