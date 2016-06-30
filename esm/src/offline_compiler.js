/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createHostComponentMeta } from './compile_metadata';
import { ListWrapper } from './facade/collection';
import { BaseException } from './facade/exceptions';
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { ComponentFactoryDependency, ViewFactoryDependency } from './view_compiler/view_compiler';
export class SourceModule {
    constructor(moduleUrl, source) {
        this.moduleUrl = moduleUrl;
        this.source = source;
    }
}
export class AppModulesSummary {
    constructor() {
        this._compAppModule = new Map();
    }
    _hashKey(type) { return `${type.filePath}#${type.name}`; }
    hasComponent(component) {
        return this._compAppModule.has(this._hashKey(component));
    }
    addComponent(module, component) {
        this._compAppModule.set(this._hashKey(component), module);
    }
    getModule(comp) {
        return this._compAppModule.get(this._hashKey(comp));
    }
}
export class OfflineCompiler {
    constructor(_metadataResolver, _directiveNormalizer, _templateParser, _styleCompiler, _viewCompiler, _appModuleCompiler, _outputEmitter) {
        this._metadataResolver = _metadataResolver;
        this._directiveNormalizer = _directiveNormalizer;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._appModuleCompiler = _appModuleCompiler;
        this._outputEmitter = _outputEmitter;
    }
    analyzeModules(appModules) {
        let result = new AppModulesSummary();
        appModules.forEach((appModule) => {
            let appModuleMeta = this._metadataResolver.getAppModuleMetadata(appModule);
            appModuleMeta.precompile.forEach((precompileComp) => this._getTransitiveComponents(appModule, precompileComp.runtime, result));
        });
        return result;
    }
    _getTransitiveComponents(appModule, component, target = new AppModulesSummary()) {
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
        this._metadataResolver.getViewDirectivesMetadata(component).forEach((dirMeta) => {
            this._getTransitiveComponents(appModule, dirMeta.type.runtime);
        });
        compMeta.precompile.forEach((precompileComp) => {
            this._getTransitiveComponents(appModule, precompileComp.type.runtime);
        });
        return target;
    }
    clearCache() {
        this._directiveNormalizer.clearCache();
        this._metadataResolver.clearCache();
    }
    compile(moduleUrl, appModulesSummary, components, appModules) {
        let fileSuffix = _splitLastSuffix(moduleUrl)[1];
        let statements = [];
        let exportedVars = [];
        let outputSourceModules = [];
        // compile app modules
        exportedVars.push(...appModules.map((appModule) => this._compileAppModule(appModule, statements)));
        // compile components
        return Promise
            .all(components.map((compType) => {
            let appModule = appModulesSummary.getModule(compType);
            let appModuleDirectives = [];
            let appModulePipes = [];
            if (appModule) {
                let appModuleMeta = this._metadataResolver.getAppModuleMetadata(appModule);
                appModuleDirectives.push(...appModuleMeta.directives.map(type => this._metadataResolver.getDirectiveMetadata(type.runtime)));
                appModulePipes.push(...appModuleMeta.pipes.map(type => this._metadataResolver.getPipeMetadata(type.runtime)));
            }
            return Promise
                .all([
                this._metadataResolver.getDirectiveMetadata(compType), ...appModuleDirectives,
                ...this._metadataResolver.getViewDirectivesMetadata(compType)
            ].map(dirMeta => this._directiveNormalizer.normalizeDirective(dirMeta).asyncResult))
                .then((normalizedCompWithDirectives) => {
                let compMeta = normalizedCompWithDirectives[0];
                let dirMetas = normalizedCompWithDirectives.slice(1);
                _assertComponent(compMeta);
                // compile styles
                let stylesCompileResults = this._styleCompiler.compileComponent(compMeta);
                stylesCompileResults.externalStylesheets.forEach((compiledStyleSheet) => {
                    outputSourceModules.push(this._codgenStyles(compiledStyleSheet, fileSuffix));
                });
                // compile components
                exportedVars.push(this._compileComponentFactory(compMeta, fileSuffix, statements));
                let pipeMetas = [
                    ...appModulePipes,
                    ...this._metadataResolver.getViewPipesMetadata(compMeta.type.runtime)
                ];
                exportedVars.push(this._compileComponent(compMeta, dirMetas, pipeMetas, stylesCompileResults.componentStylesheet, fileSuffix, statements));
            });
        }))
            .then(() => {
            if (statements.length > 0) {
                outputSourceModules.unshift(this._codegenSourceModule(_ngfactoryModuleUrl(moduleUrl), statements, exportedVars));
            }
            return outputSourceModules;
        });
    }
    _compileAppModule(appModuleType, targetStatements) {
        let appModuleMeta = this._metadataResolver.getAppModuleMetadata(appModuleType);
        let appCompileResult = this._appModuleCompiler.compile(appModuleMeta);
        appCompileResult.dependencies.forEach((dep) => {
            dep.placeholder.name = _componentFactoryName(dep.comp);
            dep.placeholder.moduleUrl = _ngfactoryModuleUrl(dep.comp.moduleUrl);
        });
        targetStatements.push(...appCompileResult.statements);
        return appCompileResult.appModuleFactoryVar;
    }
    _compileComponentFactory(compMeta, fileSuffix, targetStatements) {
        var hostMeta = createHostComponentMeta(compMeta.type, compMeta.selector);
        var hostViewFactoryVar = this._compileComponent(hostMeta, [compMeta], [], null, fileSuffix, targetStatements);
        var compFactoryVar = _componentFactoryName(compMeta.type);
        targetStatements.push(o.variable(compFactoryVar)
            .set(o.importExpr(Identifiers.ComponentFactory, [o.importType(compMeta.type)])
            .instantiate([
            o.literal(compMeta.selector), o.variable(hostViewFactoryVar),
            o.importExpr(compMeta.type)
        ], o.importType(Identifiers.ComponentFactory, [o.importType(compMeta.type)], [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]));
        return compFactoryVar;
    }
    _compileComponent(compMeta, directives, pipes, componentStyles, fileSuffix, targetStatements) {
        var parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, directives, pipes, compMeta.type.name);
        var stylesExpr = componentStyles ? o.variable(componentStyles.stylesVar) : o.literalArr([]);
        var viewResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, stylesExpr, pipes);
        if (componentStyles) {
            ListWrapper.addAll(targetStatements, _resolveStyleStatements(componentStyles, fileSuffix));
        }
        ListWrapper.addAll(targetStatements, _resolveViewStatements(viewResult));
        return viewResult.viewFactoryVar;
    }
    _codgenStyles(stylesCompileResult, fileSuffix) {
        _resolveStyleStatements(stylesCompileResult, fileSuffix);
        return this._codegenSourceModule(_stylesModuleUrl(stylesCompileResult.meta.moduleUrl, stylesCompileResult.isShimmed, fileSuffix), stylesCompileResult.statements, [stylesCompileResult.stylesVar]);
    }
    _codegenSourceModule(moduleUrl, statements, exportedVars) {
        return new SourceModule(moduleUrl, this._outputEmitter.emitStatements(moduleUrl, statements, exportedVars));
    }
}
function _resolveViewStatements(compileResult) {
    compileResult.dependencies.forEach((dep) => {
        if (dep instanceof ViewFactoryDependency) {
            let vfd = dep;
            vfd.placeholder.moduleUrl = _ngfactoryModuleUrl(vfd.comp.moduleUrl);
        }
        else if (dep instanceof ComponentFactoryDependency) {
            let cfd = dep;
            cfd.placeholder.name = _componentFactoryName(cfd.comp);
            cfd.placeholder.moduleUrl = _ngfactoryModuleUrl(cfd.comp.moduleUrl);
        }
    });
    return compileResult.statements;
}
function _resolveStyleStatements(compileResult, fileSuffix) {
    compileResult.dependencies.forEach((dep) => {
        dep.valuePlaceholder.moduleUrl = _stylesModuleUrl(dep.moduleUrl, dep.isShimmed, fileSuffix);
    });
    return compileResult.statements;
}
function _ngfactoryModuleUrl(compUrl) {
    var urlWithSuffix = _splitLastSuffix(compUrl);
    return `${urlWithSuffix[0]}.ngfactory${urlWithSuffix[1]}`;
}
function _componentFactoryName(comp) {
    return `${comp.name}NgFactory`;
}
function _stylesModuleUrl(stylesheetUrl, shim, suffix) {
    return shim ? `${stylesheetUrl}.shim${suffix}` : `${stylesheetUrl}${suffix}`;
}
function _assertComponent(meta) {
    if (!meta.isComponent) {
        throw new BaseException(`Could not compile '${meta.type.name}' because it is not a component.`);
    }
}
function _splitLastSuffix(path) {
    let lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
        return [path.substring(0, lastDot), path.substring(lastDot)];
    }
    else {
        return [path, ''];
    }
}
//# sourceMappingURL=offline_compiler.js.map