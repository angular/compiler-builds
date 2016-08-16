/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var compile_metadata_1 = require('./compile_metadata');
var collection_1 = require('./facade/collection');
var exceptions_1 = require('./facade/exceptions');
var identifiers_1 = require('./identifiers');
var o = require('./output/output_ast');
var view_compiler_1 = require('./view_compiler/view_compiler');
var SourceModule = (function () {
    function SourceModule(moduleUrl, source) {
        this.moduleUrl = moduleUrl;
        this.source = source;
    }
    return SourceModule;
}());
exports.SourceModule = SourceModule;
var AppModulesSummary = (function () {
    function AppModulesSummary() {
        this._compAppModule = new Map();
    }
    AppModulesSummary.prototype._hashKey = function (type) { return type.filePath + "#" + type.name; };
    AppModulesSummary.prototype.hasComponent = function (component) {
        return this._compAppModule.has(this._hashKey(component));
    };
    AppModulesSummary.prototype.addComponent = function (module, component) {
        this._compAppModule.set(this._hashKey(component), module);
    };
    AppModulesSummary.prototype.getModule = function (comp) {
        return this._compAppModule.get(this._hashKey(comp));
    };
    return AppModulesSummary;
}());
exports.AppModulesSummary = AppModulesSummary;
var OfflineCompiler = (function () {
    function OfflineCompiler(_metadataResolver, _directiveNormalizer, _templateParser, _styleCompiler, _viewCompiler, _appModuleCompiler, _outputEmitter) {
        this._metadataResolver = _metadataResolver;
        this._directiveNormalizer = _directiveNormalizer;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._appModuleCompiler = _appModuleCompiler;
        this._outputEmitter = _outputEmitter;
    }
    OfflineCompiler.prototype.analyzeModules = function (appModules) {
        var _this = this;
        var result = new AppModulesSummary();
        appModules.forEach(function (appModule) {
            var appModuleMeta = _this._metadataResolver.getAppModuleMetadata(appModule);
            appModuleMeta.precompile.forEach(function (precompileComp) {
                return _this._getTransitiveComponents(appModule, precompileComp.runtime, result);
            });
        });
        return result;
    };
    OfflineCompiler.prototype._getTransitiveComponents = function (appModule, component, target) {
        var _this = this;
        if (target === void 0) { target = new AppModulesSummary(); }
        var compMeta = this._metadataResolver.getDirectiveMetadata(component);
        // TODO(tbosch): preserve all modules per component, not just one.
        // Then run the template parser with the union and the intersection of the modules (regarding
        // directives/pipes)
        // and report an error if some directives/pipes are only matched with the union but not with the
        // intersection!
        // -> this means that a component is used in the wrong way!
        if (!compMeta.isComponent || target.hasComponent(component)) {
            return target;
        }
        target.addComponent(appModule, component);
        this._metadataResolver.getViewDirectivesMetadata(component).forEach(function (dirMeta) {
            _this._getTransitiveComponents(appModule, dirMeta.type.runtime);
        });
        compMeta.precompile.forEach(function (precompileComp) {
            _this._getTransitiveComponents(appModule, precompileComp.type.runtime);
        });
        return target;
    };
    OfflineCompiler.prototype.clearCache = function () {
        this._directiveNormalizer.clearCache();
        this._metadataResolver.clearCache();
    };
    OfflineCompiler.prototype.compile = function (moduleUrl, appModulesSummary, components, appModules) {
        var _this = this;
        var fileSuffix = _splitLastSuffix(moduleUrl)[1];
        var statements = [];
        var exportedVars = [];
        var outputSourceModules = [];
        // compile app modules
        exportedVars.push.apply(exportedVars, appModules.map(function (appModule) { return _this._compileAppModule(appModule, statements); }));
        // compile components
        return Promise
            .all(components.map(function (compType) {
            var appModule = appModulesSummary.getModule(compType);
            var appModuleDirectives = [];
            var appModulePipes = [];
            if (appModule) {
                var appModuleMeta = _this._metadataResolver.getAppModuleMetadata(appModule);
                appModuleDirectives.push.apply(appModuleDirectives, appModuleMeta.directives.map(function (type) { return _this._metadataResolver.getDirectiveMetadata(type.runtime); }));
                appModulePipes.push.apply(appModulePipes, appModuleMeta.pipes.map(function (type) { return _this._metadataResolver.getPipeMetadata(type.runtime); }));
            }
            return Promise
                .all([
                _this._metadataResolver.getDirectiveMetadata(compType)
            ].concat(appModuleDirectives, _this._metadataResolver.getViewDirectivesMetadata(compType)).map(function (dirMeta) { return _this._directiveNormalizer.normalizeDirective(dirMeta).asyncResult; }))
                .then(function (normalizedCompWithDirectives) {
                var compMeta = normalizedCompWithDirectives[0];
                var dirMetas = normalizedCompWithDirectives.slice(1);
                _assertComponent(compMeta);
                // compile styles
                var stylesCompileResults = _this._styleCompiler.compileComponent(compMeta);
                stylesCompileResults.externalStylesheets.forEach(function (compiledStyleSheet) {
                    outputSourceModules.push(_this._codgenStyles(compiledStyleSheet, fileSuffix));
                });
                // compile components
                exportedVars.push(_this._compileComponentFactory(compMeta, fileSuffix, statements));
                var pipeMetas = appModulePipes.concat(_this._metadataResolver.getViewPipesMetadata(compMeta.type.runtime));
                exportedVars.push(_this._compileComponent(compMeta, dirMetas, pipeMetas, stylesCompileResults.componentStylesheet, fileSuffix, statements));
            });
        }))
            .then(function () {
            if (statements.length > 0) {
                outputSourceModules.unshift(_this._codegenSourceModule(_ngfactoryModuleUrl(moduleUrl), statements, exportedVars));
            }
            return outputSourceModules;
        });
    };
    OfflineCompiler.prototype._compileAppModule = function (appModuleType, targetStatements) {
        var appModuleMeta = this._metadataResolver.getAppModuleMetadata(appModuleType);
        var appCompileResult = this._appModuleCompiler.compile(appModuleMeta);
        appCompileResult.dependencies.forEach(function (dep) {
            dep.placeholder.name = _componentFactoryName(dep.comp);
            dep.placeholder.moduleUrl = _ngfactoryModuleUrl(dep.comp.moduleUrl);
        });
        targetStatements.push.apply(targetStatements, appCompileResult.statements);
        return appCompileResult.appModuleFactoryVar;
    };
    OfflineCompiler.prototype._compileComponentFactory = function (compMeta, fileSuffix, targetStatements) {
        var hostMeta = compile_metadata_1.createHostComponentMeta(compMeta.type, compMeta.selector);
        var hostViewFactoryVar = this._compileComponent(hostMeta, [compMeta], [], null, fileSuffix, targetStatements);
        var compFactoryVar = _componentFactoryName(compMeta.type);
        targetStatements.push(o.variable(compFactoryVar)
            .set(o.importExpr(identifiers_1.Identifiers.ComponentFactory, [o.importType(compMeta.type)])
            .instantiate([
            o.literal(compMeta.selector), o.variable(hostViewFactoryVar),
            o.importExpr(compMeta.type)
        ], o.importType(identifiers_1.Identifiers.ComponentFactory, [o.importType(compMeta.type)], [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]));
        return compFactoryVar;
    };
    OfflineCompiler.prototype._compileComponent = function (compMeta, directives, pipes, componentStyles, fileSuffix, targetStatements) {
        var parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, directives, pipes, compMeta.type.name);
        var stylesExpr = componentStyles ? o.variable(componentStyles.stylesVar) : o.literalArr([]);
        var viewResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, stylesExpr, pipes);
        if (componentStyles) {
            collection_1.ListWrapper.addAll(targetStatements, _resolveStyleStatements(componentStyles, fileSuffix));
        }
        collection_1.ListWrapper.addAll(targetStatements, _resolveViewStatements(viewResult));
        return viewResult.viewFactoryVar;
    };
    OfflineCompiler.prototype._codgenStyles = function (stylesCompileResult, fileSuffix) {
        _resolveStyleStatements(stylesCompileResult, fileSuffix);
        return this._codegenSourceModule(_stylesModuleUrl(stylesCompileResult.meta.moduleUrl, stylesCompileResult.isShimmed, fileSuffix), stylesCompileResult.statements, [stylesCompileResult.stylesVar]);
    };
    OfflineCompiler.prototype._codegenSourceModule = function (moduleUrl, statements, exportedVars) {
        return new SourceModule(moduleUrl, this._outputEmitter.emitStatements(moduleUrl, statements, exportedVars));
    };
    return OfflineCompiler;
}());
exports.OfflineCompiler = OfflineCompiler;
function _resolveViewStatements(compileResult) {
    compileResult.dependencies.forEach(function (dep) {
        if (dep instanceof view_compiler_1.ViewFactoryDependency) {
            var vfd = dep;
            vfd.placeholder.moduleUrl = _ngfactoryModuleUrl(vfd.comp.moduleUrl);
        }
        else if (dep instanceof view_compiler_1.ComponentFactoryDependency) {
            var cfd = dep;
            cfd.placeholder.name = _componentFactoryName(cfd.comp);
            cfd.placeholder.moduleUrl = _ngfactoryModuleUrl(cfd.comp.moduleUrl);
        }
    });
    return compileResult.statements;
}
function _resolveStyleStatements(compileResult, fileSuffix) {
    compileResult.dependencies.forEach(function (dep) {
        dep.valuePlaceholder.moduleUrl = _stylesModuleUrl(dep.moduleUrl, dep.isShimmed, fileSuffix);
    });
    return compileResult.statements;
}
function _ngfactoryModuleUrl(compUrl) {
    var urlWithSuffix = _splitLastSuffix(compUrl);
    return urlWithSuffix[0] + ".ngfactory" + urlWithSuffix[1];
}
function _componentFactoryName(comp) {
    return comp.name + "NgFactory";
}
function _stylesModuleUrl(stylesheetUrl, shim, suffix) {
    return shim ? stylesheetUrl + ".shim" + suffix : "" + stylesheetUrl + suffix;
}
function _assertComponent(meta) {
    if (!meta.isComponent) {
        throw new exceptions_1.BaseException("Could not compile '" + meta.type.name + "' because it is not a component.");
    }
}
function _splitLastSuffix(path) {
    var lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
        return [path.substring(0, lastDot), path.substring(lastDot)];
    }
    else {
        return [path, ''];
    }
}
//# sourceMappingURL=offline_compiler.js.map