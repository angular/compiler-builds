/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var exceptions_1 = require('../src/facade/exceptions');
var lang_1 = require('../src/facade/lang');
var async_1 = require('../src/facade/async');
var compile_metadata_1 = require('./compile_metadata');
var style_compiler_1 = require('./style_compiler');
var view_compiler_1 = require('./view_compiler/view_compiler');
var app_module_compiler_1 = require('./app_module_compiler');
var template_parser_1 = require('./template_parser');
var directive_normalizer_1 = require('./directive_normalizer');
var metadata_resolver_1 = require('./metadata_resolver');
var config_1 = require('./config');
var ir = require('./output/output_ast');
var output_jit_1 = require('./output/output_jit');
var output_interpreter_1 = require('./output/output_interpreter');
var util_1 = require('./util');
var RuntimeCompiler = (function () {
    function RuntimeCompiler(_metadataResolver, _templateNormalizer, _templateParser, _styleCompiler, _viewCompiler, _appModuleCompiler, _genConfig) {
        this._metadataResolver = _metadataResolver;
        this._templateNormalizer = _templateNormalizer;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._appModuleCompiler = _appModuleCompiler;
        this._genConfig = _genConfig;
        this._compiledTemplateCache = new Map();
        this._compiledHostTemplateCache = new Map();
        this._compiledAppModuleCache = new Map();
    }
    RuntimeCompiler.prototype.resolveComponent = function (component) {
        if (lang_1.isString(component)) {
            return async_1.PromiseWrapper.reject(new exceptions_1.BaseException("Cannot resolve component using '" + component + "'."), null);
        }
        return this.compileComponentAsync(component);
    };
    RuntimeCompiler.prototype.compileAppModuleSync = function (moduleType, metadata) {
        if (metadata === void 0) { metadata = null; }
        return this._compileAppModule(moduleType, true, metadata).syncResult;
    };
    RuntimeCompiler.prototype.compileAppModuleAsync = function (moduleType, metadata) {
        if (metadata === void 0) { metadata = null; }
        return this._compileAppModule(moduleType, false, metadata).asyncResult;
    };
    RuntimeCompiler.prototype._compileAppModule = function (moduleType, isSync, metadata) {
        var _this = this;
        if (metadata === void 0) { metadata = null; }
        // Only cache if we read the metadata via the reflector,
        // as we use the moduleType as cache key.
        var useCache = !metadata;
        var appModuleFactory = this._compiledAppModuleCache.get(moduleType);
        var componentCompilePromises = [];
        if (!appModuleFactory || !useCache) {
            var compileModuleMeta = this._metadataResolver.getAppModuleMetadata(moduleType, metadata);
            var boundCompiler = new BoundCompiler(this, compileModuleMeta.directives.map(function (dir) { return dir.type.runtime; }), compileModuleMeta.pipes.map(function (pipe) { return pipe.type.runtime; }));
            // Always provide a bound Compiler / ComponentResolver
            compileModuleMeta.providers.push(this._metadataResolver.getProviderMetadata(new core_1.Provider(core_1.Compiler, { useValue: boundCompiler })));
            compileModuleMeta.providers.push(this._metadataResolver.getProviderMetadata(new core_1.Provider(core_1.ComponentResolver, { useExisting: core_1.Compiler })));
            var compileResult = this._appModuleCompiler.compile(compileModuleMeta);
            compileResult.dependencies.forEach(function (dep) {
                var compileResult = _this._compileComponent(dep.comp.runtime, isSync, compileModuleMeta.directives.map(function (compileType) { return compileType.runtime; }), compileModuleMeta.pipes.map(function (compileType) { return compileType.runtime; }));
                dep.placeholder.runtime = compileResult.syncResult;
                componentCompilePromises.push(compileResult.asyncResult);
                dep.placeholder.name = "compFactory_" + dep.comp.name;
            });
            if (lang_1.IS_DART || !this._genConfig.useJit) {
                appModuleFactory =
                    output_interpreter_1.interpretStatements(compileResult.statements, compileResult.appModuleFactoryVar);
            }
            else {
                appModuleFactory = output_jit_1.jitStatements(compileModuleMeta.type.name + ".ngfactory.js", compileResult.statements, compileResult.appModuleFactoryVar);
            }
            if (useCache) {
                this._compiledAppModuleCache.set(moduleType, appModuleFactory);
            }
        }
        return new util_1.SyncAsyncResult(appModuleFactory, Promise.all(componentCompilePromises).then(function () { return appModuleFactory; }));
    };
    RuntimeCompiler.prototype.compileComponentAsync = function (compType) {
        return this._compileComponent(compType, false, [], []).asyncResult;
    };
    RuntimeCompiler.prototype.compileComponentSync = function (compType) {
        return this._compileComponent(compType, true, [], []).syncResult;
    };
    /**
     * @internal
     */
    RuntimeCompiler.prototype._compileComponent = function (compType, isSync, moduleDirectives, modulePipes) {
        var _this = this;
        var templates = this._getTransitiveCompiledTemplates(compType, true, moduleDirectives, modulePipes);
        var loadingPromises = [];
        templates.forEach(function (template) {
            if (template.loading) {
                if (isSync) {
                    throw new exceptions_1.BaseException("Can't compile synchronously as " + template.compType.name + " is still being loaded!");
                }
                else {
                    loadingPromises.push(template.loading);
                }
            }
        });
        var compile = function () { templates.forEach(function (template) { _this._compileTemplate(template); }); };
        if (isSync) {
            compile();
        }
        var result = this._compiledHostTemplateCache.get(compType).proxyComponentFactory;
        return new util_1.SyncAsyncResult(result, Promise.all(loadingPromises).then(function () {
            compile();
            return result;
        }));
    };
    RuntimeCompiler.prototype.clearCacheFor = function (type) {
        this._compiledAppModuleCache.delete(type);
        this._metadataResolver.clearCacheFor(type);
        this._compiledHostTemplateCache.delete(type);
        var compiledTemplate = this._compiledTemplateCache.get(type);
        if (compiledTemplate) {
            this._templateNormalizer.clearCacheFor(compiledTemplate.normalizedCompMeta);
            this._compiledTemplateCache.delete(type);
        }
    };
    RuntimeCompiler.prototype.clearCache = function () {
        this._metadataResolver.clearCache();
        this._compiledTemplateCache.clear();
        this._compiledHostTemplateCache.clear();
        this._templateNormalizer.clearCache();
        this._compiledAppModuleCache.clear();
    };
    RuntimeCompiler.prototype._createCompiledHostTemplate = function (type) {
        var compiledTemplate = this._compiledHostTemplateCache.get(type);
        if (lang_1.isBlank(compiledTemplate)) {
            var compMeta = this._metadataResolver.getDirectiveMetadata(type);
            assertComponent(compMeta);
            var hostMeta = compile_metadata_1.createHostComponentMeta(compMeta.type, compMeta.selector);
            compiledTemplate = new CompiledTemplate(true, compMeta.selector, compMeta.type, [], [type], [], [], this._templateNormalizer.normalizeDirective(hostMeta));
            this._compiledHostTemplateCache.set(type, compiledTemplate);
        }
        return compiledTemplate;
    };
    RuntimeCompiler.prototype._createCompiledTemplate = function (type, moduleDirectives, modulePipes) {
        var _this = this;
        var compiledTemplate = this._compiledTemplateCache.get(type);
        if (lang_1.isBlank(compiledTemplate)) {
            var compMeta = this._metadataResolver.getDirectiveMetadata(type);
            assertComponent(compMeta);
            var viewDirectives = [];
            moduleDirectives.forEach(function (type) { return viewDirectives.push(_this._metadataResolver.getDirectiveMetadata(type)); });
            var viewComponentTypes = [];
            this._metadataResolver.getViewDirectivesMetadata(type).forEach(function (dirOrComp) {
                if (dirOrComp.isComponent) {
                    viewComponentTypes.push(dirOrComp.type.runtime);
                }
                else {
                    viewDirectives.push(dirOrComp);
                }
            });
            var precompileComponentTypes = compMeta.precompile.map(function (typeMeta) { return typeMeta.runtime; });
            var pipes = modulePipes.map(function (type) { return _this._metadataResolver.getPipeMetadata(type); }).concat(this._metadataResolver.getViewPipesMetadata(type));
            compiledTemplate = new CompiledTemplate(false, compMeta.selector, compMeta.type, viewDirectives, viewComponentTypes, precompileComponentTypes, pipes, this._templateNormalizer.normalizeDirective(compMeta));
            this._compiledTemplateCache.set(type, compiledTemplate);
        }
        return compiledTemplate;
    };
    RuntimeCompiler.prototype._getTransitiveCompiledTemplates = function (compType, isHost, moduleDirectives, modulePipes, target) {
        var _this = this;
        if (target === void 0) { target = new Set(); }
        var template = isHost ? this._createCompiledHostTemplate(compType) :
            this._createCompiledTemplate(compType, moduleDirectives, modulePipes);
        if (!target.has(template)) {
            target.add(template);
            template.viewComponentTypes.forEach(function (compType) {
                _this._getTransitiveCompiledTemplates(compType, false, moduleDirectives, modulePipes, target);
            });
            template.precompileHostComponentTypes.forEach(function (compType) {
                _this._getTransitiveCompiledTemplates(compType, true, moduleDirectives, modulePipes, target);
            });
        }
        return target;
    };
    RuntimeCompiler.prototype._compileTemplate = function (template) {
        var _this = this;
        if (template.isCompiled) {
            return;
        }
        var compMeta = template.normalizedCompMeta;
        var externalStylesheetsByModuleUrl = new Map();
        var stylesCompileResult = this._styleCompiler.compileComponent(compMeta);
        stylesCompileResult.externalStylesheets.forEach(function (r) { externalStylesheetsByModuleUrl.set(r.meta.moduleUrl, r); });
        this._resolveStylesCompileResult(stylesCompileResult.componentStylesheet, externalStylesheetsByModuleUrl);
        var viewCompMetas = template.viewComponentTypes.map(function (compType) { return _this._compiledTemplateCache.get(compType).normalizedCompMeta; });
        var parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, template.viewDirectives.concat(viewCompMetas), template.viewPipes, compMeta.type.name);
        var compileResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, ir.variable(stylesCompileResult.componentStylesheet.stylesVar), template.viewPipes);
        var depTemplates = compileResult.dependencies.map(function (dep) {
            var depTemplate;
            if (dep instanceof view_compiler_1.ViewFactoryDependency) {
                var vfd = dep;
                depTemplate = _this._compiledTemplateCache.get(vfd.comp.runtime);
                vfd.placeholder.runtime = depTemplate.proxyViewFactory;
                vfd.placeholder.name = "viewFactory_" + vfd.comp.name;
            }
            else if (dep instanceof view_compiler_1.ComponentFactoryDependency) {
                var cfd = dep;
                depTemplate = _this._compiledHostTemplateCache.get(cfd.comp.runtime);
                cfd.placeholder.runtime = depTemplate.proxyComponentFactory;
                cfd.placeholder.name = "compFactory_" + cfd.comp.name;
            }
            return depTemplate;
        });
        var statements = stylesCompileResult.componentStylesheet.statements.concat(compileResult.statements);
        var factory;
        if (lang_1.IS_DART || !this._genConfig.useJit) {
            factory = output_interpreter_1.interpretStatements(statements, compileResult.viewFactoryVar);
        }
        else {
            factory = output_jit_1.jitStatements(template.compType.name + ".ngfactory.js", statements, compileResult.viewFactoryVar);
        }
        template.compiled(factory);
    };
    RuntimeCompiler.prototype._resolveStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
        var _this = this;
        result.dependencies.forEach(function (dep, i) {
            var nestedCompileResult = externalStylesheetsByModuleUrl.get(dep.moduleUrl);
            var nestedStylesArr = _this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
            dep.valuePlaceholder.runtime = nestedStylesArr;
            dep.valuePlaceholder.name = "importedStyles" + i;
        });
    };
    RuntimeCompiler.prototype._resolveAndEvalStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
        this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
        if (lang_1.IS_DART || !this._genConfig.useJit) {
            return output_interpreter_1.interpretStatements(result.statements, result.stylesVar);
        }
        else {
            return output_jit_1.jitStatements(result.meta.moduleUrl + ".css.js", result.statements, result.stylesVar);
        }
    };
    /** @nocollapse */
    RuntimeCompiler.decorators = [
        { type: core_1.Injectable },
    ];
    /** @nocollapse */
    RuntimeCompiler.ctorParameters = [
        { type: metadata_resolver_1.CompileMetadataResolver, },
        { type: directive_normalizer_1.DirectiveNormalizer, },
        { type: template_parser_1.TemplateParser, },
        { type: style_compiler_1.StyleCompiler, },
        { type: view_compiler_1.ViewCompiler, },
        { type: app_module_compiler_1.AppModuleCompiler, },
        { type: config_1.CompilerConfig, },
    ];
    return RuntimeCompiler;
}());
exports.RuntimeCompiler = RuntimeCompiler;
var CompiledTemplate = (function () {
    function CompiledTemplate(isHost, selector, compType, viewDirectives, viewComponentTypes, precompileHostComponentTypes, viewPipes, _normalizeResult) {
        var _this = this;
        this.isHost = isHost;
        this.compType = compType;
        this.viewDirectives = viewDirectives;
        this.viewComponentTypes = viewComponentTypes;
        this.precompileHostComponentTypes = precompileHostComponentTypes;
        this.viewPipes = viewPipes;
        this._viewFactory = null;
        this.loading = null;
        this._normalizedCompMeta = null;
        this.isCompiled = false;
        this.isCompiledWithDeps = false;
        this.proxyViewFactory = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            return _this._viewFactory.apply(null, args);
        };
        this.proxyComponentFactory = isHost ?
            new core_1.ComponentFactory(selector, this.proxyViewFactory, compType.runtime) :
            null;
        if (_normalizeResult.syncResult) {
            this._normalizedCompMeta = _normalizeResult.syncResult;
        }
        else {
            this.loading = _normalizeResult.asyncResult.then(function (normalizedCompMeta) {
                _this._normalizedCompMeta = normalizedCompMeta;
                _this.loading = null;
            });
        }
    }
    Object.defineProperty(CompiledTemplate.prototype, "normalizedCompMeta", {
        get: function () {
            if (this.loading) {
                throw new exceptions_1.BaseException("Template is still loading for " + this.compType.name + "!");
            }
            return this._normalizedCompMeta;
        },
        enumerable: true,
        configurable: true
    });
    CompiledTemplate.prototype.compiled = function (viewFactory) {
        this._viewFactory = viewFactory;
        this.isCompiled = true;
    };
    CompiledTemplate.prototype.depsCompiled = function () { this.isCompiledWithDeps = true; };
    return CompiledTemplate;
}());
function assertComponent(meta) {
    if (!meta.isComponent) {
        throw new exceptions_1.BaseException("Could not compile '" + meta.type.name + "' because it is not a component.");
    }
}
/**
 * A wrapper around `Compiler` and `ComponentResolver` that
 * provides default patform directives / pipes.
 */
var BoundCompiler = (function () {
    function BoundCompiler(_delegate, _directives, _pipes) {
        this._delegate = _delegate;
        this._directives = _directives;
        this._pipes = _pipes;
    }
    BoundCompiler.prototype.resolveComponent = function (component) {
        if (lang_1.isString(component)) {
            return async_1.PromiseWrapper.reject(new exceptions_1.BaseException("Cannot resolve component using '" + component + "'."), null);
        }
        return this.compileComponentAsync(component);
    };
    BoundCompiler.prototype.compileComponentAsync = function (compType) {
        return this._delegate._compileComponent(compType, false, this._directives, this._pipes)
            .asyncResult;
    };
    BoundCompiler.prototype.compileComponentSync = function (compType) {
        return this._delegate._compileComponent(compType, true, this._directives, this._pipes)
            .syncResult;
    };
    BoundCompiler.prototype.compileAppModuleSync = function (moduleType, metadata) {
        if (metadata === void 0) { metadata = null; }
        return this._delegate.compileAppModuleSync(moduleType, metadata);
    };
    BoundCompiler.prototype.compileAppModuleAsync = function (moduleType, metadata) {
        if (metadata === void 0) { metadata = null; }
        return this._delegate.compileAppModuleAsync(moduleType, metadata);
    };
    /**
     * Clears all caches
     */
    BoundCompiler.prototype.clearCache = function () { this._delegate.clearCache(); };
    /**
     * Clears the cache for the given component/appModule.
     */
    BoundCompiler.prototype.clearCacheFor = function (type) { this._delegate.clearCacheFor(type); };
    return BoundCompiler;
}());
//# sourceMappingURL=runtime_compiler.js.map