import { CompileAppModuleMetadata, CompileIdentifierMetadata } from './compile_metadata';
import * as o from './output/output_ast';
export declare class ComponentFactoryDependency {
    comp: CompileIdentifierMetadata;
    placeholder: CompileIdentifierMetadata;
    constructor(comp: CompileIdentifierMetadata, placeholder: CompileIdentifierMetadata);
}
export declare class AppModuleCompileResult {
    statements: o.Statement[];
    appModuleFactoryVar: string;
    dependencies: ComponentFactoryDependency[];
    constructor(statements: o.Statement[], appModuleFactoryVar: string, dependencies: ComponentFactoryDependency[]);
}
export declare class AppModuleCompiler {
    compile(appModuleMeta: CompileAppModuleMetadata): AppModuleCompileResult;
}
