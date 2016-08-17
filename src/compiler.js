/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var core_1 = require('@angular/core');
__export(require('./template_parser/template_ast'));
var template_parser_1 = require('./template_parser/template_parser');
exports.TEMPLATE_TRANSFORMS = template_parser_1.TEMPLATE_TRANSFORMS;
var config_1 = require('./config');
exports.CompilerConfig = config_1.CompilerConfig;
exports.RenderTypes = config_1.RenderTypes;
__export(require('./compile_metadata'));
__export(require('./offline_compiler'));
var runtime_compiler_1 = require('./runtime_compiler');
exports.RuntimeCompiler = runtime_compiler_1.RuntimeCompiler;
__export(require('./url_resolver'));
__export(require('./resource_loader'));
var directive_resolver_1 = require('./directive_resolver');
exports.DirectiveResolver = directive_resolver_1.DirectiveResolver;
var pipe_resolver_1 = require('./pipe_resolver');
exports.PipeResolver = pipe_resolver_1.PipeResolver;
var ng_module_resolver_1 = require('./ng_module_resolver');
exports.NgModuleResolver = ng_module_resolver_1.NgModuleResolver;
var template_parser_2 = require('./template_parser/template_parser');
var html_parser_1 = require('./ml_parser/html_parser');
var directive_normalizer_1 = require('./directive_normalizer');
var metadata_resolver_1 = require('./metadata_resolver');
var style_compiler_1 = require('./style_compiler');
var view_compiler_1 = require('./view_compiler/view_compiler');
var ng_module_compiler_1 = require('./ng_module_compiler');
var config_2 = require('./config');
var runtime_compiler_2 = require('./runtime_compiler');
var element_schema_registry_1 = require('./schema/element_schema_registry');
var dom_element_schema_registry_1 = require('./schema/dom_element_schema_registry');
var url_resolver_2 = require('./url_resolver');
var parser_1 = require('./expression_parser/parser');
var lexer_1 = require('./expression_parser/lexer');
var directive_resolver_2 = require('./directive_resolver');
var pipe_resolver_2 = require('./pipe_resolver');
var ng_module_resolver_2 = require('./ng_module_resolver');
var core_private_1 = require('../core_private');
var resource_loader_2 = require('./resource_loader');
var i18n = require('./i18n/index');
var _NO_RESOURCE_LOADER = {
    get: function (url) {
        throw new Error("No ResourceLoader implementation has been provided. Can't read the url \"" + url + "\"");
    }
};
/**
 * A set of providers that provide `RuntimeCompiler` and its dependencies to use for
 * template compilation.
 */
exports.COMPILER_PROVIDERS = [
    { provide: core_private_1.Reflector, useValue: core_private_1.reflector },
    { provide: core_private_1.ReflectorReader, useExisting: core_private_1.Reflector },
    { provide: resource_loader_2.ResourceLoader, useValue: _NO_RESOURCE_LOADER },
    core_private_1.Console,
    lexer_1.Lexer,
    parser_1.Parser,
    html_parser_1.HtmlParser,
    {
        provide: i18n.HtmlParser,
        useFactory: function (parser, translations, format) {
            return new i18n.HtmlParser(parser, translations, format);
        },
        deps: [
            html_parser_1.HtmlParser,
            [new core_1.OptionalMetadata(), new core_1.Inject(core_1.TRANSLATIONS)],
            [new core_1.OptionalMetadata(), new core_1.Inject(core_1.TRANSLATIONS_FORMAT)],
        ]
    },
    template_parser_2.TemplateParser,
    directive_normalizer_1.DirectiveNormalizer,
    metadata_resolver_1.CompileMetadataResolver,
    url_resolver_2.DEFAULT_PACKAGE_URL_PROVIDER,
    style_compiler_1.StyleCompiler,
    view_compiler_1.ViewCompiler,
    ng_module_compiler_1.NgModuleCompiler,
    { provide: config_2.CompilerConfig, useValue: new config_2.CompilerConfig() },
    runtime_compiler_2.RuntimeCompiler,
    { provide: core_1.Compiler, useExisting: runtime_compiler_2.RuntimeCompiler },
    dom_element_schema_registry_1.DomElementSchemaRegistry,
    { provide: element_schema_registry_1.ElementSchemaRegistry, useExisting: dom_element_schema_registry_1.DomElementSchemaRegistry },
    url_resolver_2.UrlResolver,
    directive_resolver_2.DirectiveResolver,
    pipe_resolver_2.PipeResolver,
    ng_module_resolver_2.NgModuleResolver
];
function analyzeAppProvidersForDeprecatedConfiguration(appProviders) {
    if (appProviders === void 0) { appProviders = []; }
    var compilerProviders = [];
    var useDebug;
    var useJit;
    var defaultEncapsulation;
    var deprecationMessages = [];
    // Note: This is a hack to still support the old way
    // of configuring platform directives / pipes and the compiler resource loader.
    // This will soon be deprecated!
    var tempInj = core_1.ReflectiveInjector.resolveAndCreate(appProviders);
    var compilerConfig = tempInj.get(config_2.CompilerConfig, null);
    if (compilerConfig) {
        useJit = compilerConfig.useJit;
        useDebug = compilerConfig.genDebugInfo;
        defaultEncapsulation = compilerConfig.defaultEncapsulation;
        deprecationMessages.push("Passing CompilerConfig as a regular provider is deprecated. Use \"compilerOptions\" use a custom \"CompilerFactory\" platform provider instead.");
    }
    var resourceLoader = tempInj.get(resource_loader_2.ResourceLoader, null);
    if (resourceLoader) {
        compilerProviders.push([{ provide: resource_loader_2.ResourceLoader, useValue: resourceLoader }]);
        deprecationMessages.push("Passing ResourceLoader as regular provider is deprecated. Pass the provider via \"compilerOptions\" instead.");
    }
    var compilerOptions = {
        useJit: useJit,
        useDebug: useDebug,
        defaultEncapsulation: defaultEncapsulation,
        providers: compilerProviders
    };
    return { compilerOptions: compilerOptions, moduleDeclarations: [], deprecationMessages: deprecationMessages };
}
exports.analyzeAppProvidersForDeprecatedConfiguration = analyzeAppProvidersForDeprecatedConfiguration;
var RuntimeCompilerFactory = (function () {
    function RuntimeCompilerFactory(defaultOptions) {
        this._defaultOptions = [{
                useDebug: core_1.isDevMode(),
                useJit: true,
                defaultEncapsulation: core_1.ViewEncapsulation.Emulated
            }].concat(defaultOptions);
    }
    RuntimeCompilerFactory.prototype.createCompiler = function (options) {
        if (options === void 0) { options = []; }
        var mergedOptions = _mergeOptions(this._defaultOptions.concat(options));
        var injector = core_1.ReflectiveInjector.resolveAndCreate([
            exports.COMPILER_PROVIDERS, {
                provide: config_2.CompilerConfig,
                useFactory: function () {
                    return new config_2.CompilerConfig({
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
        return injector.get(core_1.Compiler);
    };
    /** @nocollapse */
    RuntimeCompilerFactory.decorators = [
        { type: core_1.Injectable },
    ];
    /** @nocollapse */
    RuntimeCompilerFactory.ctorParameters = [
        { type: Array, decorators: [{ type: core_1.Inject, args: [core_1.COMPILER_OPTIONS,] },] },
    ];
    return RuntimeCompilerFactory;
}());
exports.RuntimeCompilerFactory = RuntimeCompilerFactory;
function _initReflector() {
    core_private_1.reflector.reflectionCapabilities = new core_private_1.ReflectionCapabilities();
}
/**
 * A platform that included corePlatform and the compiler.
 *
 * @experimental
 */
exports.platformCoreDynamic = core_1.createPlatformFactory(core_1.platformCore, 'coreDynamic', [
    { provide: core_1.COMPILER_OPTIONS, useValue: {}, multi: true },
    { provide: core_1.CompilerFactory, useClass: RuntimeCompilerFactory },
    { provide: core_1.PLATFORM_INITIALIZER, useValue: _initReflector, multi: true },
]);
function _mergeOptions(optionsArr) {
    return {
        useDebug: _lastDefined(optionsArr.map(function (options) { return options.useDebug; })),
        useJit: _lastDefined(optionsArr.map(function (options) { return options.useJit; })),
        defaultEncapsulation: _lastDefined(optionsArr.map(function (options) { return options.defaultEncapsulation; })),
        providers: _mergeArrays(optionsArr.map(function (options) { return options.providers; }))
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
    var result = [];
    parts.forEach(function (part) { return part && result.push.apply(result, part); });
    return result;
}
//# sourceMappingURL=compiler.js.map