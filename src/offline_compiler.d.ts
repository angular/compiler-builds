import { AppModuleCompiler } from './app_module_compiler';
import { StaticSymbol } from './compile_metadata';
import { DirectiveNormalizer } from './directive_normalizer';
import { CompileMetadataResolver } from './metadata_resolver';
import { OutputEmitter } from './output/abstract_emitter';
import { StyleCompiler } from './style_compiler';
import { TemplateParser } from './template_parser';
import { ViewCompiler } from './view_compiler/view_compiler';
export declare class SourceModule {
    moduleUrl: string;
    source: string;
    constructor(moduleUrl: string, source: string);
}
export declare class AppModulesSummary {
    private _compAppModule;
    private _hashKey(type);
    hasComponent(component: StaticSymbol): boolean;
    addComponent(module: StaticSymbol, component: StaticSymbol): void;
    getModule(comp: StaticSymbol): StaticSymbol;
}
export declare class OfflineCompiler {
    private _metadataResolver;
    private _directiveNormalizer;
    private _templateParser;
    private _styleCompiler;
    private _viewCompiler;
    private _appModuleCompiler;
    private _outputEmitter;
    constructor(_metadataResolver: CompileMetadataResolver, _directiveNormalizer: DirectiveNormalizer, _templateParser: TemplateParser, _styleCompiler: StyleCompiler, _viewCompiler: ViewCompiler, _appModuleCompiler: AppModuleCompiler, _outputEmitter: OutputEmitter);
    analyzeModules(appModules: StaticSymbol[]): AppModulesSummary;
    private _getTransitiveComponents(appModule, component, target?);
    clearCache(): void;
    compile(moduleUrl: string, appModulesSummary: AppModulesSummary, components: StaticSymbol[], appModules: StaticSymbol[]): Promise<SourceModule[]>;
    private _compileAppModule(appModuleType, targetStatements);
    private _compileComponentFactory(compMeta, fileSuffix, targetStatements);
    private _compileComponent(compMeta, directives, pipes, componentStyles, fileSuffix, targetStatements);
    private _codgenStyles(stylesCompileResult, fileSuffix);
    private _codegenSourceModule(moduleUrl, statements, exportedVars);
}
