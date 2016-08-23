/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AnimationOutput } from '../../core_private';
import { CompileAnimationEntryMetadata } from '../compile_metadata';
import { ParseError } from '../parse_util';
import { AnimationEntryAst } from './animation_ast';
export declare class AnimationParseError extends ParseError {
    constructor(message: any);
    toString(): string;
}
export declare class ParsedAnimationResult {
    ast: AnimationEntryAst;
    errors: AnimationParseError[];
    constructor(ast: AnimationEntryAst, errors: AnimationParseError[]);
}
export declare function parseAnimationEntry(entry: CompileAnimationEntryMetadata): ParsedAnimationResult;
export declare function parseAnimationOutputName(outputName: string, errors: AnimationParseError[]): AnimationOutput;
