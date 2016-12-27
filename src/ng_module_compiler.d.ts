/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileNgModuleMetadata, CompileProviderMetadata } from './compile_metadata';
import * as o from './output/output_ast';
/**
 * This is currently not read, but will probably be used in the future.
 * We keep it as we already pass it through all the rigth places...
 */
export declare class ComponentFactoryDependency {
    compType: any;
    constructor(compType: any);
}
export declare class NgModuleCompileResult {
    statements: o.Statement[];
    ngModuleFactoryVar: string;
    dependencies: ComponentFactoryDependency[];
    constructor(statements: o.Statement[], ngModuleFactoryVar: string, dependencies: ComponentFactoryDependency[]);
}
export declare class NgModuleCompiler {
    compile(ngModuleMeta: CompileNgModuleMetadata, extraProviders: CompileProviderMetadata[]): NgModuleCompileResult;
}
