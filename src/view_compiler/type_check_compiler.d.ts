/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AotCompilerOptions } from '../aot/compiler_options';
import { StaticReflector } from '../aot/static_reflector';
import { CompileDirectiveMetadata, CompilePipeSummary } from '../compile_metadata';
import { TemplateAst } from '../template_parser/template_ast';
import { OutputContext } from '../util';
/**
 * Generates code that is used to type check templates.
 */
export declare class TypeCheckCompiler {
    private options;
    private reflector;
    constructor(options: AotCompilerOptions, reflector: StaticReflector);
    compileComponent(outputCtx: OutputContext, component: CompileDirectiveMetadata, template: TemplateAst[], usedPipes: CompilePipeSummary[]): void;
}
