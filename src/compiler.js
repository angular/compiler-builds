/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var core_1 = require('@angular/core');
__export(require('./template_ast'));
var template_parser_1 = require('./template_parser');
exports.TEMPLATE_TRANSFORMS = template_parser_1.TEMPLATE_TRANSFORMS;
var config_1 = require('./config');
exports.CompilerConfig = config_1.CompilerConfig;
exports.RenderTypes = config_1.RenderTypes;
__export(require('./compile_metadata'));
__export(require('./offline_compiler'));
var runtime_compiler_1 = require('./runtime_compiler');
exports.RuntimeCompiler = runtime_compiler_1.RuntimeCompiler;
__export(require('./url_resolver'));
__export(require('./xhr'));
var view_resolver_1 = require('./view_resolver');
exports.ViewResolver = view_resolver_1.ViewResolver;
var directive_resolver_1 = require('./directive_resolver');
exports.DirectiveResolver = directive_resolver_1.DirectiveResolver;
var pipe_resolver_1 = require('./pipe_resolver');
exports.PipeResolver = pipe_resolver_1.PipeResolver;
var template_parser_2 = require('./template_parser');
var html_parser_1 = require('./html_parser');
var directive_normalizer_1 = require('./directive_normalizer');
var metadata_resolver_1 = require('./metadata_resolver');
var style_compiler_1 = require('./style_compiler');
var view_compiler_1 = require('./view_compiler/view_compiler');
var app_module_compiler_1 = require('./app_module_compiler');
var config_2 = require('./config');
var runtime_compiler_2 = require('./runtime_compiler');
var element_schema_registry_1 = require('./schema/element_schema_registry');
var dom_element_schema_registry_1 = require('./schema/dom_element_schema_registry');
var url_resolver_2 = require('./url_resolver');
var parser_1 = require('./expression_parser/parser');
var lexer_1 = require('./expression_parser/lexer');
var view_resolver_2 = require('./view_resolver');
var directive_resolver_2 = require('./directive_resolver');
var pipe_resolver_2 = require('./pipe_resolver');
var core_private_1 = require('../core_private');
var xhr_2 = require('./xhr');
/**
 * A set of providers that provide `RuntimeCompiler` and its dependencies to use for
 * template compilation.
 */
exports.COMPILER_PROVIDERS = 
/*@ts2dart_const*/ [
    { provide: core_1.PLATFORM_DIRECTIVES, useValue: [], multi: true },
    { provide: core_1.PLATFORM_PIPES, useValue: [], multi: true },
    { provide: core_private_1.Reflector, useValue: core_private_1.reflector },
    { provide: core_private_1.ReflectorReader, useExisting: core_private_1.Reflector },
    core_private_1.Console,
    lexer_1.Lexer,
    parser_1.Parser,
    html_parser_1.HtmlParser,
    template_parser_2.TemplateParser,
    directive_normalizer_1.DirectiveNormalizer,
    metadata_resolver_1.CompileMetadataResolver,
    url_resolver_2.DEFAULT_PACKAGE_URL_PROVIDER,
    style_compiler_1.StyleCompiler,
    view_compiler_1.ViewCompiler,
    app_module_compiler_1.AppModuleCompiler,
    /*@ts2dart_Provider*/ { provide: config_2.CompilerConfig, useValue: new config_2.CompilerConfig() },
    runtime_compiler_2.RuntimeCompiler,
    /*@ts2dart_Provider*/ { provide: core_1.ComponentResolver, useExisting: runtime_compiler_2.RuntimeCompiler },
    /*@ts2dart_Provider*/ { provide: core_1.Compiler, useExisting: runtime_compiler_2.RuntimeCompiler },
    dom_element_schema_registry_1.DomElementSchemaRegistry,
    /*@ts2dart_Provider*/ { provide: element_schema_registry_1.ElementSchemaRegistry, useExisting: dom_element_schema_registry_1.DomElementSchemaRegistry },
    url_resolver_2.UrlResolver,
    view_resolver_2.ViewResolver,
    directive_resolver_2.DirectiveResolver,
    pipe_resolver_2.PipeResolver
];
var _RuntimeCompilerFactory = (function (_super) {
    __extends(_RuntimeCompilerFactory, _super);
    function _RuntimeCompilerFactory() {
        _super.apply(this, arguments);
    }
    _RuntimeCompilerFactory.prototype.createCompiler = function (options) {
        var deprecationMessages = [];
        var platformDirectivesFromAppProviders = [];
        var platformPipesFromAppProviders = [];
        var compilerProvidersFromAppProviders = [];
        var useDebugFromAppProviders;
        var useJitFromAppProviders;
        var defaultEncapsulationFromAppProviders;
        if (options.deprecatedAppProviders && options.deprecatedAppProviders.length > 0) {
            // Note: This is a hack to still support the old way
            // of configuring platform directives / pipes and the compiler xhr.
            // This will soon be deprecated!
            var inj = core_1.ReflectiveInjector.resolveAndCreate(options.deprecatedAppProviders);
            var compilerConfig = inj.get(config_2.CompilerConfig, null);
            if (compilerConfig) {
                platformDirectivesFromAppProviders = compilerConfig.deprecatedPlatformDirectives;
                platformPipesFromAppProviders = compilerConfig.deprecatedPlatformPipes;
                useJitFromAppProviders = compilerConfig.useJit;
                useDebugFromAppProviders = compilerConfig.genDebugInfo;
                defaultEncapsulationFromAppProviders = compilerConfig.defaultEncapsulation;
                deprecationMessages.push("Passing a CompilerConfig to \"bootstrap()\" as provider is deprecated. Pass the provider via the new parameter \"compilerOptions\" of \"bootstrap()\" instead.");
            }
            else {
                // If nobody provided a CompilerConfig, use the
                // PLATFORM_DIRECTIVES / PLATFORM_PIPES values directly if existing
                platformDirectivesFromAppProviders = inj.get(core_1.PLATFORM_DIRECTIVES, []);
                if (platformDirectivesFromAppProviders.length > 0) {
                    deprecationMessages.push("Passing PLATFORM_DIRECTIVES to \"bootstrap()\" as provider is deprecated. Use the new parameter \"directives\" of \"bootstrap()\" instead.");
                }
                platformPipesFromAppProviders = inj.get(core_1.PLATFORM_PIPES, []);
                if (platformPipesFromAppProviders.length > 0) {
                    deprecationMessages.push("Passing PLATFORM_PIPES to \"bootstrap()\" as provider is deprecated. Use the new parameter \"pipes\" of \"bootstrap()\" instead.");
                }
            }
            var xhr = inj.get(xhr_2.ResourceLoader, null);
            if (xhr) {
                compilerProvidersFromAppProviders.push([{ provide: xhr_2.ResourceLoader, useValue: xhr }]);
                deprecationMessages.push("Passing an instance of XHR to \"bootstrap()\" as provider is deprecated. Pass the provider via the new parameter \"compilerOptions\" of \"bootstrap()\" instead.");
            }
            // Need to copy console from deprecatedAppProviders to compiler providers
            // as well so that we can test the above deprecation messages in old style bootstrap
            // where we only have app providers!
            var console_1 = inj.get(core_private_1.Console, null);
            if (console_1) {
                compilerProvidersFromAppProviders.push([{ provide: core_private_1.Console, useValue: console_1 }]);
            }
        }
        var injector = core_1.ReflectiveInjector.resolveAndCreate([
            exports.COMPILER_PROVIDERS, {
                provide: config_2.CompilerConfig,
                useFactory: function (platformDirectives, platformPipes) {
                    return new config_2.CompilerConfig({
                        deprecatedPlatformDirectives: _mergeArrays(platformDirectivesFromAppProviders, platformDirectives),
                        deprecatedPlatformPipes: _mergeArrays(platformPipesFromAppProviders, platformPipes),
                        // let explicit values from the compiler options overwrite options
                        // from the app providers. E.g. important for the testing platform.
                        genDebugInfo: _firstDefined(options.useDebug, useDebugFromAppProviders, core_1.isDevMode()),
                        // let explicit values from the compiler options overwrite options
                        // from the app providers
                        useJit: _firstDefined(options.useJit, useJitFromAppProviders, true),
                        // let explicit values from the compiler options overwrite options
                        // from the app providers
                        defaultEncapsulation: _firstDefined(options.defaultEncapsulation, defaultEncapsulationFromAppProviders, core_1.ViewEncapsulation.Emulated)
                    });
                },
                deps: [core_1.PLATFORM_DIRECTIVES, core_1.PLATFORM_PIPES]
            },
            // options.providers will always contain a provider for ResourceLoader as well
            // (added by platforms). So allow compilerProvidersFromAppProviders to overwrite this
            _mergeArrays(options.providers, compilerProvidersFromAppProviders)
        ]);
        var console = injector.get(core_private_1.Console);
        deprecationMessages.forEach(function (msg) { console.warn(msg); });
        return injector.get(core_1.Compiler);
    };
    /** @nocollapse */
    _RuntimeCompilerFactory.decorators = [
        { type: core_1.Injectable },
    ];
    return _RuntimeCompilerFactory;
}(core_1.CompilerFactory));
exports._RuntimeCompilerFactory = _RuntimeCompilerFactory;
exports.RUNTIME_COMPILER_FACTORY = new _RuntimeCompilerFactory();
function _firstDefined() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    for (var i = 0; i < args.length; i++) {
        if (args[i] !== undefined) {
            return args[i];
        }
    }
    return undefined;
}
function _mergeArrays() {
    var parts = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        parts[_i - 0] = arguments[_i];
    }
    var result = [];
    parts.forEach(function (part) { return result.push.apply(result, part); });
    return result;
}
//# sourceMappingURL=compiler.js.map