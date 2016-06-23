/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ComponentFactory, Injectable } from '@angular/core';
import { BaseException } from '../src/facade/exceptions';
import { IS_DART, isBlank, isString } from '../src/facade/lang';
import { ListWrapper } from '../src/facade/collection';
import { PromiseWrapper } from '../src/facade/async';
import { createHostComponentMeta, CompileIdentifierMetadata } from './compile_metadata';
import { StyleCompiler } from './style_compiler';
import { ViewCompiler, ViewFactoryDependency, ComponentFactoryDependency } from './view_compiler/view_compiler';
import { TemplateParser } from './template_parser';
import { DirectiveNormalizer } from './directive_normalizer';
import { CompileMetadataResolver } from './metadata_resolver';
import { CompilerConfig } from './config';
import * as ir from './output/output_ast';
import { jitStatements } from './output/output_jit';
import { interpretStatements } from './output/output_interpreter';
import { InterpretiveAppViewInstanceFactory } from './output/interpretive_view';
import { XHR } from './xhr';
export class RuntimeCompiler {
    constructor(_metadataResolver, _templateNormalizer, _templateParser, _styleCompiler, _viewCompiler, _xhr, _genConfig) {
        this._metadataResolver = _metadataResolver;
        this._templateNormalizer = _templateNormalizer;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._xhr = _xhr;
        this._genConfig = _genConfig;
        this._styleCache = new Map();
        this._hostCacheKeys = new Map();
        this._compiledTemplateCache = new Map();
    }
    resolveComponent(component) {
        if (isString(component)) {
            return PromiseWrapper.reject(new BaseException(`Cannot resolve component using '${component}'.`), null);
        }
        return this._loadAndCompileHostComponent(component).done;
    }
    clearCache() {
        this._styleCache.clear();
        this._compiledTemplateCache.clear();
        this._hostCacheKeys.clear();
    }
    _loadAndCompileHostComponent(componentType) {
        var compMeta = this._metadataResolver.getDirectiveMetadata(componentType);
        var hostCacheKey = this._hostCacheKeys.get(compMeta.type.runtime);
        if (isBlank(hostCacheKey)) {
            hostCacheKey = new Object();
            this._hostCacheKeys.set(compMeta.type.runtime, hostCacheKey);
            assertComponent(compMeta);
            var hostMeta = createHostComponentMeta(compMeta.type, compMeta.selector);
            this._loadAndCompileComponent(hostCacheKey, hostMeta, [compMeta], [], []);
        }
        var compTemplate = this._compiledTemplateCache.get(hostCacheKey);
        return new CompileHostTemplate(compTemplate, compMeta);
    }
    _loadAndCompileComponent(cacheKey, compMeta, viewDirectives, pipes, compilingComponentsPath) {
        var compiledTemplate = this._compiledTemplateCache.get(cacheKey);
        if (isBlank(compiledTemplate)) {
            let done = PromiseWrapper
                .all([this._compileComponentStyles(compMeta)].concat(viewDirectives.map(dirMeta => this._templateNormalizer.normalizeDirective(dirMeta))))
                .then((stylesAndNormalizedViewDirMetas) => {
                var normalizedViewDirMetas = stylesAndNormalizedViewDirMetas.slice(1);
                var styles = stylesAndNormalizedViewDirMetas[0];
                var parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, normalizedViewDirMetas, pipes, compMeta.type.name);
                var childPromises = [];
                compiledTemplate.init(this._compileComponent(compMeta, parsedTemplate, styles, pipes, compilingComponentsPath, childPromises));
                return PromiseWrapper.all(childPromises).then((_) => { return compiledTemplate; });
            });
            compiledTemplate = new CompiledTemplate(done);
            this._compiledTemplateCache.set(cacheKey, compiledTemplate);
        }
        return compiledTemplate;
    }
    _compileComponent(compMeta, parsedTemplate, styles, pipes, compilingComponentsPath, childPromises) {
        var compileResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, new ir.ExternalExpr(new CompileIdentifierMetadata({ runtime: styles })), pipes);
        compileResult.dependencies.forEach((dep) => {
            if (dep instanceof ViewFactoryDependency) {
                let childCompilingComponentsPath = ListWrapper.clone(compilingComponentsPath);
                let childCacheKey = dep.comp.type.runtime;
                let childViewDirectives = this._metadataResolver.getViewDirectivesMetadata(dep.comp.type.runtime);
                let childViewPipes = this._metadataResolver.getViewPipesMetadata(dep.comp.type.runtime);
                let childIsRecursive = childCompilingComponentsPath.indexOf(childCacheKey) > -1 ||
                    childViewDirectives.some(dir => childCompilingComponentsPath.indexOf(dir.type.runtime) > -1);
                childCompilingComponentsPath.push(childCacheKey);
                let childComp = this._loadAndCompileComponent(dep.comp.type.runtime, dep.comp, childViewDirectives, childViewPipes, childCompilingComponentsPath);
                dep.placeholder.runtime = childComp.proxyViewFactory;
                dep.placeholder.name = `viewFactory_${dep.comp.type.name}`;
                if (!childIsRecursive) {
                    // Only wait for a child if it is not a cycle
                    childPromises.push(childComp.done);
                }
            }
            else if (dep instanceof ComponentFactoryDependency) {
                let childComp = this._loadAndCompileHostComponent(dep.comp.runtime);
                dep.placeholder.runtime = childComp.componentFactory;
                dep.placeholder.name = `compFactory_${dep.comp.name}`;
                childPromises.push(childComp.done);
            }
        });
        var factory;
        if (IS_DART || !this._genConfig.useJit) {
            factory = interpretStatements(compileResult.statements, compileResult.viewFactoryVar, new InterpretiveAppViewInstanceFactory());
        }
        else {
            factory = jitStatements(`${compMeta.type.name}.template.js`, compileResult.statements, compileResult.viewFactoryVar);
        }
        return factory;
    }
    _compileComponentStyles(compMeta) {
        var compileResult = this._styleCompiler.compileComponent(compMeta);
        return this._resolveStylesCompileResult(compMeta.type.name, compileResult);
    }
    _resolveStylesCompileResult(sourceUrl, result) {
        var promises = result.dependencies.map((dep) => this._loadStylesheetDep(dep));
        return PromiseWrapper.all(promises)
            .then((cssTexts) => {
            var nestedCompileResultPromises = [];
            for (var i = 0; i < result.dependencies.length; i++) {
                var dep = result.dependencies[i];
                var cssText = cssTexts[i];
                var nestedCompileResult = this._styleCompiler.compileStylesheet(dep.moduleUrl, cssText, dep.isShimmed);
                nestedCompileResultPromises.push(this._resolveStylesCompileResult(dep.moduleUrl, nestedCompileResult));
            }
            return PromiseWrapper.all(nestedCompileResultPromises);
        })
            .then((nestedStylesArr) => {
            for (var i = 0; i < result.dependencies.length; i++) {
                var dep = result.dependencies[i];
                dep.valuePlaceholder.runtime = nestedStylesArr[i];
                dep.valuePlaceholder.name = `importedStyles${i}`;
            }
            if (IS_DART || !this._genConfig.useJit) {
                return interpretStatements(result.statements, result.stylesVar, new InterpretiveAppViewInstanceFactory());
            }
            else {
                return jitStatements(`${sourceUrl}.css.js`, result.statements, result.stylesVar);
            }
        });
    }
    _loadStylesheetDep(dep) {
        var cacheKey = `${dep.moduleUrl}${dep.isShimmed ? '.shim' : ''}`;
        var cssTextPromise = this._styleCache.get(cacheKey);
        if (isBlank(cssTextPromise)) {
            cssTextPromise = this._xhr.get(dep.moduleUrl);
            this._styleCache.set(cacheKey, cssTextPromise);
        }
        return cssTextPromise;
    }
}
/** @nocollapse */
RuntimeCompiler.decorators = [
    { type: Injectable },
];
/** @nocollapse */
RuntimeCompiler.ctorParameters = [
    { type: CompileMetadataResolver, },
    { type: DirectiveNormalizer, },
    { type: TemplateParser, },
    { type: StyleCompiler, },
    { type: ViewCompiler, },
    { type: XHR, },
    { type: CompilerConfig, },
];
class CompileHostTemplate {
    constructor(_template, compMeta) {
        this.componentFactory = new ComponentFactory(compMeta.selector, _template.proxyViewFactory, compMeta.type.runtime);
        this.done = _template.done.then((_) => this.componentFactory);
    }
}
class CompiledTemplate {
    constructor(done) {
        this.done = done;
        this._viewFactory = null;
        this.proxyViewFactory =
                (viewUtils /** TODO #9100 */, childInjector /** TODO #9100 */, contextEl /** TODO #9100 */) => this._viewFactory(viewUtils, childInjector, contextEl);
    }
    init(viewFactory) { this._viewFactory = viewFactory; }
}
function assertComponent(meta) {
    if (!meta.isComponent) {
        throw new BaseException(`Could not compile '${meta.type.name}' because it is not a component.`);
    }
}
//# sourceMappingURL=runtime_compiler.js.map