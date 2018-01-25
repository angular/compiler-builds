/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileDirectiveMetadata } from '../compile_metadata';
import { CompileReflector } from '../compile_reflector';
import { TemplateAst } from '../template_parser/template_ast';
import { OutputContext } from '../util';
export declare function compileDirective(outputCtx: OutputContext, directive: CompileDirectiveMetadata, reflector: CompileReflector): void;
export declare function compileComponent(outputCtx: OutputContext, component: CompileDirectiveMetadata, template: TemplateAst[], reflector: CompileReflector): void;
