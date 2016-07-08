/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AppModuleFactory, AppModuleMetadata, Compiler, ComponentFactory, ComponentResolver, Injector } from '@angular/core';
import { Console } from '../core_private';
import { ConcreteType, Type } from '../src/facade/lang';
import { StyleCompiler } from './style_compiler';
import { ViewCompiler } from './view_compiler/view_compiler';
import { AppModuleCompiler } from './app_module_compiler';
import { TemplateParser } from './template_parser';
import { DirectiveNormalizer } from './directive_normalizer';
import { CompileMetadataResolver } from './metadata_resolver';
import { CompilerConfig } from './config';
/**
 * An internal module of the Angular compiler that begins with component types,
 * extracts templates, and eventually produces a compiled version of the component
 * ready for linking into an application.
 *
 * @security  When compiling templates at runtime, you must ensure that the entire template comes
 * from a trusted source. Attacker-controlled data introduced by a template could expose your
 * application to XSS risks.  For more detail, see the [Security Guide](http://g.co/ng/security).
 */
export declare class RuntimeCompiler implements ComponentResolver, Compiler {
    private _injector;
    private _metadataResolver;
    private _templateNormalizer;
    private _templateParser;
    private _styleCompiler;
    private _viewCompiler;
    private _appModuleCompiler;
    private _genConfig;
    private _console;
    private _compiledTemplateCache;
    private _compiledHostTemplateCache;
    private _compiledAppModuleCache;
    private _warnOnComponentResolver;
    constructor(_injector: Injector, _metadataResolver: CompileMetadataResolver, _templateNormalizer: DirectiveNormalizer, _templateParser: TemplateParser, _styleCompiler: StyleCompiler, _viewCompiler: ViewCompiler, _appModuleCompiler: AppModuleCompiler, _genConfig: CompilerConfig, _console: Console);
    readonly injector: Injector;
    resolveComponent(component: Type | string): Promise<ComponentFactory<any>>;
    compileAppModuleSync<T>(moduleType: ConcreteType<T>, metadata?: AppModuleMetadata): AppModuleFactory<T>;
    compileAppModuleAsync<T>(moduleType: ConcreteType<T>, metadata?: AppModuleMetadata): Promise<AppModuleFactory<T>>;
    private _compileAppModule<T>(moduleType, isSync, metadata?);
    compileComponentAsync<T>(compType: ConcreteType<T>): Promise<ComponentFactory<T>>;
    compileComponentSync<T>(compType: ConcreteType<T>): ComponentFactory<T>;
    clearCacheFor(type: Type): void;
    clearCache(): void;
    private _createCompiledHostTemplate(type);
    private _createCompiledTemplate(type, moduleDirectives, modulePipes);
    private _getTransitiveCompiledTemplates(compType, isHost, moduleDirectives, modulePipes, target?);
    private _compileTemplate(template);
    private _resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
    private _resolveAndEvalStylesCompileResult(result, externalStylesheetsByModuleUrl);
}
