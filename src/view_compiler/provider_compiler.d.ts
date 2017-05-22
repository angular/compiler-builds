/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵLifecycleHooks as LifecycleHooks, ɵNodeFlags as NodeFlags } from '@angular/core';
import { CompileDiDependencyMetadata, CompileEntryComponentMetadata } from '../compile_metadata';
import * as o from '../output/output_ast';
import { ProviderAst } from '../template_parser/template_ast';
export declare function providerDef(providerAst: ProviderAst): {
    providerExpr: o.Expression;
    flags: NodeFlags;
    depsExpr: o.Expression;
    tokenExpr: o.Expression;
};
export declare function depDef(dep: CompileDiDependencyMetadata): o.Expression;
export declare function lifecycleHookToNodeFlag(lifecycleHook: LifecycleHooks): NodeFlags;
export declare function componentFactoryResolverProviderDef(flags: NodeFlags, entryComponents: CompileEntryComponentMetadata[]): {
    providerExpr: o.Expression;
    flags: NodeFlags;
    depsExpr: o.Expression;
    tokenExpr: o.Expression;
};
