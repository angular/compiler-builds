/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Statement } from '../output/output_ast';
export declare class GeneratedFile {
    srcFileName: string;
    genFileName: string;
    source: string | null;
    stmts: Statement[] | null;
    constructor(srcFileName: string, genFileName: string, sourceOrStmts: string | Statement[]);
    isEquivalent(other: GeneratedFile): boolean;
}
export declare function toTypeScript(file: GeneratedFile, preamble?: string): string;
