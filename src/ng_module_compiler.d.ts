import { CompileNgModuleMetadata, CompileProviderMetadata } from './compile_metadata';
import * as o from './output/output_ast';
export declare class NgModuleCompileResult {
    statements: o.Statement[];
    ngModuleFactoryVar: string;
    constructor(statements: o.Statement[], ngModuleFactoryVar: string);
}
export declare class NgModuleCompiler {
    compile(ngModuleMeta: CompileNgModuleMetadata, extraProviders: CompileProviderMetadata[]): NgModuleCompileResult;
}
