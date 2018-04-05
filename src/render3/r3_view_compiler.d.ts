/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileDirectiveMetadata, CompilePipeSummary, CompileQueryMetadata, CompileTypeMetadata } from '../compile_metadata';
import { CompileReflector } from '../compile_reflector';
import * as o from '../output/output_ast';
import { BindingParser } from '../template_parser/binding_parser';
import { TemplateAst } from '../template_parser/template_ast';
import { OutputContext } from '../util';
import { OutputMode } from './r3_types';
export declare function compileDirective(outputCtx: OutputContext, directive: CompileDirectiveMetadata, reflector: CompileReflector, bindingParser: BindingParser, mode: OutputMode): void;
export declare function compileComponent(outputCtx: OutputContext, component: CompileDirectiveMetadata, pipes: CompilePipeSummary[], template: TemplateAst[], reflector: CompileReflector, bindingParser: BindingParser, mode: OutputMode): void;
export declare function createFactory(type: CompileTypeMetadata, outputCtx: OutputContext, reflector: CompileReflector, queries: CompileQueryMetadata[]): o.Expression;
