/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { COMPILER_OPTIONS, Compiler, CompilerFactory, Inject, Injectable, OptionalMetadata, PLATFORM_INITIALIZER, ReflectiveInjector, TRANSLATIONS, TRANSLATIONS_FORMAT, ViewEncapsulation, createPlatformFactory, isDevMode, platformCore } from '@angular/core';
export * from './template_parser/template_ast';
export { TEMPLATE_TRANSFORMS } from './template_parser/template_parser';
export { CompilerConfig, RenderTypes } from './config';
export * from './compile_metadata';
export * from './offline_compiler';
export { RuntimeCompiler } from './runtime_compiler';
export * from './url_resolver';
export * from './xhr';
export { DirectiveResolver } from './directive_resolver';
export { PipeResolver } from './pipe_resolver';
export { NgModuleResolver } from './ng_module_resolver';
import { TemplateParser } from './template_parser/template_parser';
import { HtmlParser } from './ml_parser/html_parser';
import { DirectiveNormalizer } from './directive_normalizer';
import { CompileMetadataResolver } from './metadata_resolver';
import { StyleCompiler } from './style_compiler';
import { ViewCompiler } from './view_compiler/view_compiler';
import { NgModuleCompiler } from './ng_module_compiler';
import { CompilerConfig } from './config';
import { RuntimeCompiler } from './runtime_compiler';
import { ElementSchemaRegistry } from './schema/element_schema_registry';
import { DomElementSchemaRegistry } from './schema/dom_element_schema_registry';
import { UrlResolver, DEFAULT_PACKAGE_URL_PROVIDER } from './url_resolver';
import { Parser } from './expression_parser/parser';
import { Lexer } from './expression_parser/lexer';
import { DirectiveResolver } from './directive_resolver';
import { PipeResolver } from './pipe_resolver';
import { NgModuleResolver } from './ng_module_resolver';
import { Console, Reflector, reflector, ReflectorReader, ReflectionCapabilities } from '../core_private';
import { XHR } from './xhr';
import * as i18n from './i18n/index';
const _NO_XHR = {
    get(url) {
        throw new Error(`No XHR implementation has been provided. Can't read the url "${url}"`);
    }
};
/**
 * A set of providers that provide `RuntimeCompiler` and its dependencies to use for
 * template compilation.
 */
export const COMPILER_PROVIDERS = [
    { provide: Reflector, useValue: reflector },
    { provide: ReflectorReader, useExisting: Reflector },
    { provide: XHR, useValue: _NO_XHR },
    Console,
    Lexer,
    Parser,
    HtmlParser,
    {
        provide: i18n.HtmlParser,
        useFactory: (parser, translations, format) => new i18n.HtmlParser(parser, translations, format),
        deps: [
            HtmlParser,
            [new OptionalMetadata(), new Inject(TRANSLATIONS)],
            [new OptionalMetadata(), new Inject(TRANSLATIONS_FORMAT)],
        ]
    },
    TemplateParser,
    DirectiveNormalizer,
    CompileMetadataResolver,
    DEFAULT_PACKAGE_URL_PROVIDER,
    StyleCompiler,
    ViewCompiler,
    NgModuleCompiler,
    { provide: CompilerConfig, useValue: new CompilerConfig() },
    RuntimeCompiler,
    { provide: Compiler, useExisting: RuntimeCompiler },
    DomElementSchemaRegistry,
    { provide: ElementSchemaRegistry, useExisting: DomElementSchemaRegistry },
    UrlResolver,
    DirectiveResolver,
    PipeResolver,
    NgModuleResolver
];
export function analyzeAppProvidersForDeprecatedConfiguration(appProviders = []) {
    let compilerProviders = [];
    let useDebug;
    let useJit;
    let defaultEncapsulation;
    const deprecationMessages = [];
    // Note: This is a hack to still support the old way
    // of configuring platform directives / pipes and the compiler xhr.
    // This will soon be deprecated!
    const tempInj = ReflectiveInjector.resolveAndCreate(appProviders);
    const compilerConfig = tempInj.get(CompilerConfig, null);
    if (compilerConfig) {
        useJit = compilerConfig.useJit;
        useDebug = compilerConfig.genDebugInfo;
        defaultEncapsulation = compilerConfig.defaultEncapsulation;
        deprecationMessages.push(`Passing CompilerConfig as a regular provider is deprecated. Use the "compilerOptions" parameter of "bootstrap()" or use a custom "CompilerFactory" platform provider instead.`);
    }
    const xhr = tempInj.get(XHR, null);
    if (xhr) {
        compilerProviders.push([{ provide: XHR, useValue: xhr }]);
        deprecationMessages.push(`Passing XHR as regular provider is deprecated. Pass the provider via "compilerOptions" instead.`);
    }
    const compilerOptions = {
        useJit: useJit,
        useDebug: useDebug,
        defaultEncapsulation: defaultEncapsulation,
        providers: compilerProviders
    };
    return { compilerOptions, moduleDeclarations: [], deprecationMessages: deprecationMessages };
}
export class RuntimeCompilerFactory {
    constructor(defaultOptions) {
        this._defaultOptions = [{
                useDebug: isDevMode(),
                useJit: true,
                defaultEncapsulation: ViewEncapsulation.Emulated
            }].concat(defaultOptions);
    }
    createCompiler(options = []) {
        const mergedOptions = _mergeOptions(this._defaultOptions.concat(options));
        const injector = ReflectiveInjector.resolveAndCreate([
            COMPILER_PROVIDERS, {
                provide: CompilerConfig,
                useFactory: () => {
                    return new CompilerConfig({
                        // let explicit values from the compiler options overwrite options
                        // from the app providers. E.g. important for the testing platform.
                        genDebugInfo: mergedOptions.useDebug,
                        // let explicit values from the compiler options overwrite options
                        // from the app providers
                        useJit: mergedOptions.useJit,
                        // let explicit values from the compiler options overwrite options
                        // from the app providers
                        defaultEncapsulation: mergedOptions.defaultEncapsulation,
                        logBindingUpdate: mergedOptions.useDebug
                    });
                },
                deps: []
            },
            mergedOptions.providers
        ]);
        return injector.get(Compiler);
    }
}
/** @nocollapse */
RuntimeCompilerFactory.decorators = [
    { type: Injectable },
];
/** @nocollapse */
RuntimeCompilerFactory.ctorParameters = [
    { type: Array, decorators: [{ type: Inject, args: [COMPILER_OPTIONS,] },] },
];
function _initReflector() {
    reflector.reflectionCapabilities = new ReflectionCapabilities();
}
/**
 * A platform that included corePlatform and the compiler.
 *
 * @experimental
 */
export const platformCoreDynamic = createPlatformFactory(platformCore, 'coreDynamic', [
    { provide: COMPILER_OPTIONS, useValue: {}, multi: true },
    { provide: CompilerFactory, useClass: RuntimeCompilerFactory },
    { provide: PLATFORM_INITIALIZER, useValue: _initReflector, multi: true },
]);
function _mergeOptions(optionsArr) {
    return {
        useDebug: _lastDefined(optionsArr.map(options => options.useDebug)),
        useJit: _lastDefined(optionsArr.map(options => options.useJit)),
        defaultEncapsulation: _lastDefined(optionsArr.map(options => options.defaultEncapsulation)),
        providers: _mergeArrays(optionsArr.map(options => options.providers))
    };
}
function _lastDefined(args) {
    for (var i = args.length - 1; i >= 0; i--) {
        if (args[i] !== undefined) {
            return args[i];
        }
    }
    return undefined;
}
function _mergeArrays(parts) {
    let result = [];
    parts.forEach((part) => part && result.push(...part));
    return result;
}
//# sourceMappingURL=compiler.js.map