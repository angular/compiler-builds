/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ViewEncapsulation } from '@angular/core/index';
import { CompileStylesheetMetadata, CompileTemplateMetadata } from './compile_metadata';
import { CompilerConfig } from './config';
import { stringify } from './facade/lang';
import { CompilerInjectable } from './injectable';
import * as html from './ml_parser/ast';
import { HtmlParser } from './ml_parser/html_parser';
import { InterpolationConfig } from './ml_parser/interpolation_config';
import { ResourceLoader } from './resource_loader';
import { extractStyleUrls, isStyleUrlResolvable } from './style_url_resolver';
import { PreparsedElementType, preparseElement } from './template_parser/template_preparser';
import { UrlResolver } from './url_resolver';
import { SyncAsyncResult, SyntaxError } from './util';
export let DirectiveNormalizer = class DirectiveNormalizer {
    /**
     * @param {?} _resourceLoader
     * @param {?} _urlResolver
     * @param {?} _htmlParser
     * @param {?} _config
     */
    constructor(_resourceLoader, _urlResolver, _htmlParser, _config) {
        this._resourceLoader = _resourceLoader;
        this._urlResolver = _urlResolver;
        this._htmlParser = _htmlParser;
        this._config = _config;
        this._resourceLoaderCache = new Map();
    }
    /**
     * @return {?}
     */
    clearCache() { this._resourceLoaderCache.clear(); }
    /**
     * @param {?} normalizedDirective
     * @return {?}
     */
    clearCacheFor(normalizedDirective) {
        if (!normalizedDirective.isComponent) {
            return;
        }
        this._resourceLoaderCache.delete(normalizedDirective.template.templateUrl);
        normalizedDirective.template.externalStylesheets.forEach((stylesheet) => { this._resourceLoaderCache.delete(stylesheet.moduleUrl); });
    }
    /**
     * @param {?} url
     * @return {?}
     */
    _fetch(url) {
        let /** @type {?} */ result = this._resourceLoaderCache.get(url);
        if (!result) {
            result = this._resourceLoader.get(url);
            this._resourceLoaderCache.set(url, result);
        }
        return result;
    }
    /**
     * @param {?} prenormData
     * @return {?}
     */
    normalizeTemplate(prenormData) {
        let /** @type {?} */ normalizedTemplateSync = null;
        let /** @type {?} */ normalizedTemplateAsync;
        if (prenormData.template != null) {
            if (typeof prenormData.template !== 'string') {
                throw new SyntaxError(`The template specified for component ${stringify(prenormData.componentType)} is not a string`);
            }
            normalizedTemplateSync = this.normalizeTemplateSync(prenormData);
            normalizedTemplateAsync = Promise.resolve(normalizedTemplateSync);
        }
        else if (prenormData.templateUrl) {
            if (typeof prenormData.templateUrl !== 'string') {
                throw new SyntaxError(`The templateUrl specified for component ${stringify(prenormData.componentType)} is not a string`);
            }
            normalizedTemplateAsync = this.normalizeTemplateAsync(prenormData);
        }
        else {
            throw new SyntaxError(`No template specified for component ${stringify(prenormData.componentType)}`);
        }
        if (normalizedTemplateSync && normalizedTemplateSync.styleUrls.length === 0) {
            // sync case
            return new SyncAsyncResult(normalizedTemplateSync);
        }
        else {
            // async case
            return new SyncAsyncResult(null, normalizedTemplateAsync.then((normalizedTemplate) => this.normalizeExternalStylesheets(normalizedTemplate)));
        }
    }
    /**
     * @param {?} prenomData
     * @return {?}
     */
    normalizeTemplateSync(prenomData) {
        return this.normalizeLoadedTemplate(prenomData, prenomData.template, prenomData.moduleUrl);
    }
    /**
     * @param {?} prenomData
     * @return {?}
     */
    normalizeTemplateAsync(prenomData) {
        const /** @type {?} */ templateUrl = this._urlResolver.resolve(prenomData.moduleUrl, prenomData.templateUrl);
        return this._fetch(templateUrl)
            .then((value) => this.normalizeLoadedTemplate(prenomData, value, templateUrl));
    }
    /**
     * @param {?} prenomData
     * @param {?} template
     * @param {?} templateAbsUrl
     * @return {?}
     */
    normalizeLoadedTemplate(prenomData, template, templateAbsUrl) {
        const /** @type {?} */ interpolationConfig = InterpolationConfig.fromArray(prenomData.interpolation);
        const /** @type {?} */ rootNodesAndErrors = this._htmlParser.parse(template, stringify(prenomData.componentType), true, interpolationConfig);
        if (rootNodesAndErrors.errors.length > 0) {
            const /** @type {?} */ errorString = rootNodesAndErrors.errors.join('\n');
            throw new SyntaxError(`Template parse errors:\n${errorString}`);
        }
        const /** @type {?} */ templateMetadataStyles = this.normalizeStylesheet(new CompileStylesheetMetadata({
            styles: prenomData.styles,
            styleUrls: prenomData.styleUrls,
            moduleUrl: prenomData.moduleUrl
        }));
        const /** @type {?} */ visitor = new TemplatePreparseVisitor();
        html.visitAll(visitor, rootNodesAndErrors.rootNodes);
        const /** @type {?} */ templateStyles = this.normalizeStylesheet(new CompileStylesheetMetadata({ styles: visitor.styles, styleUrls: visitor.styleUrls, moduleUrl: templateAbsUrl }));
        let /** @type {?} */ encapsulation = prenomData.encapsulation;
        if (encapsulation == null) {
            encapsulation = this._config.defaultEncapsulation;
        }
        const /** @type {?} */ styles = templateMetadataStyles.styles.concat(templateStyles.styles);
        const /** @type {?} */ styleUrls = templateMetadataStyles.styleUrls.concat(templateStyles.styleUrls);
        if (encapsulation === ViewEncapsulation.Emulated && styles.length === 0 &&
            styleUrls.length === 0) {
            encapsulation = ViewEncapsulation.None;
        }
        return new CompileTemplateMetadata({
            encapsulation,
            template,
            templateUrl: templateAbsUrl, styles, styleUrls,
            ngContentSelectors: visitor.ngContentSelectors,
            animations: prenomData.animations,
            interpolation: prenomData.interpolation,
        });
    }
    /**
     * @param {?} templateMeta
     * @return {?}
     */
    normalizeExternalStylesheets(templateMeta) {
        return this._loadMissingExternalStylesheets(templateMeta.styleUrls)
            .then((externalStylesheets) => new CompileTemplateMetadata({
            encapsulation: templateMeta.encapsulation,
            template: templateMeta.template,
            templateUrl: templateMeta.templateUrl,
            styles: templateMeta.styles,
            styleUrls: templateMeta.styleUrls,
            externalStylesheets: externalStylesheets,
            ngContentSelectors: templateMeta.ngContentSelectors,
            animations: templateMeta.animations,
            interpolation: templateMeta.interpolation
        }));
    }
    /**
     * @param {?} styleUrls
     * @param {?=} loadedStylesheets
     * @return {?}
     */
    _loadMissingExternalStylesheets(styleUrls, loadedStylesheets = new Map()) {
        return Promise
            .all(styleUrls.filter((styleUrl) => !loadedStylesheets.has(styleUrl))
            .map(styleUrl => this._fetch(styleUrl).then((loadedStyle) => {
            const /** @type {?} */ stylesheet = this.normalizeStylesheet(new CompileStylesheetMetadata({ styles: [loadedStyle], moduleUrl: styleUrl }));
            loadedStylesheets.set(styleUrl, stylesheet);
            return this._loadMissingExternalStylesheets(stylesheet.styleUrls, loadedStylesheets);
        })))
            .then((_) => Array.from(loadedStylesheets.values()));
    }
    /**
     * @param {?} stylesheet
     * @return {?}
     */
    normalizeStylesheet(stylesheet) {
        const /** @type {?} */ allStyleUrls = stylesheet.styleUrls.filter(isStyleUrlResolvable)
            .map(url => this._urlResolver.resolve(stylesheet.moduleUrl, url));
        const /** @type {?} */ allStyles = stylesheet.styles.map(style => {
            const /** @type {?} */ styleWithImports = extractStyleUrls(this._urlResolver, stylesheet.moduleUrl, style);
            allStyleUrls.push(...styleWithImports.styleUrls);
            return styleWithImports.style;
        });
        return new CompileStylesheetMetadata({ styles: allStyles, styleUrls: allStyleUrls, moduleUrl: stylesheet.moduleUrl });
    }
};
DirectiveNormalizer = __decorate([
    CompilerInjectable(), 
    __metadata('design:paramtypes', [ResourceLoader, UrlResolver, HtmlParser, CompilerConfig])
], DirectiveNormalizer);
function DirectiveNormalizer_tsickle_Closure_declarations() {
    /** @type {?} */
    DirectiveNormalizer.prototype._resourceLoaderCache;
    /** @type {?} */
    DirectiveNormalizer.prototype._resourceLoader;
    /** @type {?} */
    DirectiveNormalizer.prototype._urlResolver;
    /** @type {?} */
    DirectiveNormalizer.prototype._htmlParser;
    /** @type {?} */
    DirectiveNormalizer.prototype._config;
}
class TemplatePreparseVisitor {
    constructor() {
        this.ngContentSelectors = [];
        this.styles = [];
        this.styleUrls = [];
        this.ngNonBindableStackCount = 0;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElement(ast, context) {
        const /** @type {?} */ preparsedElement = preparseElement(ast);
        switch (preparsedElement.type) {
            case PreparsedElementType.NG_CONTENT:
                if (this.ngNonBindableStackCount === 0) {
                    this.ngContentSelectors.push(preparsedElement.selectAttr);
                }
                break;
            case PreparsedElementType.STYLE:
                let /** @type {?} */ textContent = '';
                ast.children.forEach(child => {
                    if (child instanceof html.Text) {
                        textContent += child.value;
                    }
                });
                this.styles.push(textContent);
                break;
            case PreparsedElementType.STYLESHEET:
                this.styleUrls.push(preparsedElement.hrefAttr);
                break;
            default:
                break;
        }
        if (preparsedElement.nonBindable) {
            this.ngNonBindableStackCount++;
        }
        html.visitAll(this, ast.children);
        if (preparsedElement.nonBindable) {
            this.ngNonBindableStackCount--;
        }
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExpansion(ast, context) { html.visitAll(this, ast.cases); }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitExpansionCase(ast, context) {
        html.visitAll(this, ast.expression);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitComment(ast, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAttribute(ast, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitText(ast, context) { return null; }
}
function TemplatePreparseVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplatePreparseVisitor.prototype.ngContentSelectors;
    /** @type {?} */
    TemplatePreparseVisitor.prototype.styles;
    /** @type {?} */
    TemplatePreparseVisitor.prototype.styleUrls;
    /** @type {?} */
    TemplatePreparseVisitor.prototype.ngNonBindableStackCount;
}
//# sourceMappingURL=directive_normalizer.js.map