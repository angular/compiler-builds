/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CompileStylesheetMetadata, CompileTemplateMetadata, templateSourceUrl } from './compile_metadata';
import { preserveWhitespacesDefault } from './config';
import { ViewEncapsulation } from './core';
import * as html from './ml_parser/ast';
import { InterpolationConfig } from './ml_parser/interpolation_config';
import { extractStyleUrls, isStyleUrlResolvable } from './style_url_resolver';
import { PreparsedElementType, preparseElement } from './template_parser/template_preparser';
import { SyncAsync, isDefined, stringify, syntaxError } from './util';
/**
 * @record
 */
export function PrenormalizedTemplateMetadata() { }
function PrenormalizedTemplateMetadata_tsickle_Closure_declarations() {
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.ngModuleType;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.componentType;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.moduleUrl;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.template;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.templateUrl;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.styles;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.styleUrls;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.interpolation;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.encapsulation;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.animations;
    /** @type {?} */
    PrenormalizedTemplateMetadata.prototype.preserveWhitespaces;
}
export class DirectiveNormalizer {
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
        const /** @type {?} */ template = /** @type {?} */ ((normalizedDirective.template));
        this._resourceLoaderCache.delete(/** @type {?} */ ((template.templateUrl)));
        template.externalStylesheets.forEach((stylesheet) => { this._resourceLoaderCache.delete(/** @type {?} */ ((stylesheet.moduleUrl))); });
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
        if (isDefined(prenormData.template)) {
            if (isDefined(prenormData.templateUrl)) {
                throw syntaxError(`'${stringify(prenormData.componentType)}' component cannot define both template and templateUrl`);
            }
            if (typeof prenormData.template !== 'string') {
                throw syntaxError(`The template specified for component ${stringify(prenormData.componentType)} is not a string`);
            }
        }
        else if (isDefined(prenormData.templateUrl)) {
            if (typeof prenormData.templateUrl !== 'string') {
                throw syntaxError(`The templateUrl specified for component ${stringify(prenormData.componentType)} is not a string`);
            }
        }
        else {
            throw syntaxError(`No template specified for component ${stringify(prenormData.componentType)}`);
        }
        if (isDefined(prenormData.preserveWhitespaces) &&
            typeof prenormData.preserveWhitespaces !== 'boolean') {
            throw syntaxError(`The preserveWhitespaces option for component ${stringify(prenormData.componentType)} must be a boolean`);
        }
        return SyncAsync.then(this._preParseTemplate(prenormData), (preparsedTemplate) => this._normalizeTemplateMetadata(prenormData, preparsedTemplate));
    }
    /**
     * @param {?} prenomData
     * @return {?}
     */
    _preParseTemplate(prenomData) {
        let /** @type {?} */ template;
        let /** @type {?} */ templateUrl;
        if (prenomData.template != null) {
            template = prenomData.template;
            templateUrl = prenomData.moduleUrl;
        }
        else {
            templateUrl = this._urlResolver.resolve(prenomData.moduleUrl, /** @type {?} */ ((prenomData.templateUrl)));
            template = this._fetch(templateUrl);
        }
        return SyncAsync.then(template, (template) => this._preparseLoadedTemplate(prenomData, template, templateUrl));
    }
    /**
     * @param {?} prenormData
     * @param {?} template
     * @param {?} templateAbsUrl
     * @return {?}
     */
    _preparseLoadedTemplate(prenormData, template, templateAbsUrl) {
        const /** @type {?} */ isInline = !!prenormData.template;
        const /** @type {?} */ interpolationConfig = InterpolationConfig.fromArray(/** @type {?} */ ((prenormData.interpolation)));
        const /** @type {?} */ rootNodesAndErrors = this._htmlParser.parse(template, templateSourceUrl({ reference: prenormData.ngModuleType }, { type: { reference: prenormData.componentType } }, { isInline, templateUrl: templateAbsUrl }), true, interpolationConfig);
        if (rootNodesAndErrors.errors.length > 0) {
            const /** @type {?} */ errorString = rootNodesAndErrors.errors.join('\n');
            throw syntaxError(`Template parse errors:\n${errorString}`);
        }
        const /** @type {?} */ templateMetadataStyles = this._normalizeStylesheet(new CompileStylesheetMetadata({ styles: prenormData.styles, moduleUrl: prenormData.moduleUrl }));
        const /** @type {?} */ visitor = new TemplatePreparseVisitor();
        html.visitAll(visitor, rootNodesAndErrors.rootNodes);
        const /** @type {?} */ templateStyles = this._normalizeStylesheet(new CompileStylesheetMetadata({ styles: visitor.styles, styleUrls: visitor.styleUrls, moduleUrl: templateAbsUrl }));
        const /** @type {?} */ styles = templateMetadataStyles.styles.concat(templateStyles.styles);
        const /** @type {?} */ inlineStyleUrls = templateMetadataStyles.styleUrls.concat(templateStyles.styleUrls);
        const /** @type {?} */ styleUrls = this
            ._normalizeStylesheet(new CompileStylesheetMetadata({ styleUrls: prenormData.styleUrls, moduleUrl: prenormData.moduleUrl }))
            .styleUrls;
        return {
            template,
            templateUrl: templateAbsUrl, isInline,
            htmlAst: rootNodesAndErrors, styles, inlineStyleUrls, styleUrls,
            ngContentSelectors: visitor.ngContentSelectors,
        };
    }
    /**
     * @param {?} prenormData
     * @param {?} preparsedTemplate
     * @return {?}
     */
    _normalizeTemplateMetadata(prenormData, preparsedTemplate) {
        return SyncAsync.then(this._loadMissingExternalStylesheets(preparsedTemplate.styleUrls.concat(preparsedTemplate.inlineStyleUrls)), (externalStylesheets) => this._normalizeLoadedTemplateMetadata(prenormData, preparsedTemplate, externalStylesheets));
    }
    /**
     * @param {?} prenormData
     * @param {?} preparsedTemplate
     * @param {?} stylesheets
     * @return {?}
     */
    _normalizeLoadedTemplateMetadata(prenormData, preparsedTemplate, stylesheets) {
        // Algorithm:
        // - produce exactly 1 entry per original styleUrl in
        // CompileTemplateMetadata.externalStylesheets with all styles inlined
        // - inline all styles that are referenced by the template into CompileTemplateMetadata.styles.
        // Reason: be able to determine how many stylesheets there are even without loading
        // the template nor the stylesheets, so we can create a stub for TypeScript always synchronously
        // (as resource loading may be async)
        const /** @type {?} */ styles = [...preparsedTemplate.styles];
        this._inlineStyles(preparsedTemplate.inlineStyleUrls, stylesheets, styles);
        const /** @type {?} */ styleUrls = preparsedTemplate.styleUrls;
        const /** @type {?} */ externalStylesheets = styleUrls.map(styleUrl => {
            const /** @type {?} */ stylesheet = /** @type {?} */ ((stylesheets.get(styleUrl)));
            const /** @type {?} */ styles = [...stylesheet.styles];
            this._inlineStyles(stylesheet.styleUrls, stylesheets, styles);
            return new CompileStylesheetMetadata({ moduleUrl: styleUrl, styles: styles });
        });
        let /** @type {?} */ encapsulation = prenormData.encapsulation;
        if (encapsulation == null) {
            encapsulation = this._config.defaultEncapsulation;
        }
        if (encapsulation === ViewEncapsulation.Emulated && styles.length === 0 &&
            styleUrls.length === 0) {
            encapsulation = ViewEncapsulation.None;
        }
        return new CompileTemplateMetadata({
            encapsulation,
            template: preparsedTemplate.template,
            templateUrl: preparsedTemplate.templateUrl,
            htmlAst: preparsedTemplate.htmlAst, styles, styleUrls,
            ngContentSelectors: preparsedTemplate.ngContentSelectors,
            animations: prenormData.animations,
            interpolation: prenormData.interpolation,
            isInline: preparsedTemplate.isInline, externalStylesheets,
            preserveWhitespaces: preserveWhitespacesDefault(prenormData.preserveWhitespaces, this._config.preserveWhitespaces),
        });
    }
    /**
     * @param {?} styleUrls
     * @param {?} stylesheets
     * @param {?} targetStyles
     * @return {?}
     */
    _inlineStyles(styleUrls, stylesheets, targetStyles) {
        styleUrls.forEach(styleUrl => {
            const /** @type {?} */ stylesheet = /** @type {?} */ ((stylesheets.get(styleUrl)));
            stylesheet.styles.forEach(style => targetStyles.push(style));
            this._inlineStyles(stylesheet.styleUrls, stylesheets, targetStyles);
        });
    }
    /**
     * @param {?} styleUrls
     * @param {?=} loadedStylesheets
     * @return {?}
     */
    _loadMissingExternalStylesheets(styleUrls, loadedStylesheets = new Map()) {
        return SyncAsync.then(SyncAsync.all(styleUrls.filter((styleUrl) => !loadedStylesheets.has(styleUrl))
            .map(styleUrl => SyncAsync.then(this._fetch(styleUrl), (loadedStyle) => {
            const /** @type {?} */ stylesheet = this._normalizeStylesheet(new CompileStylesheetMetadata({ styles: [loadedStyle], moduleUrl: styleUrl }));
            loadedStylesheets.set(styleUrl, stylesheet);
            return this._loadMissingExternalStylesheets(stylesheet.styleUrls, loadedStylesheets);
        }))), (_) => loadedStylesheets);
    }
    /**
     * @param {?} stylesheet
     * @return {?}
     */
    _normalizeStylesheet(stylesheet) {
        const /** @type {?} */ moduleUrl = /** @type {?} */ ((stylesheet.moduleUrl));
        const /** @type {?} */ allStyleUrls = stylesheet.styleUrls.filter(isStyleUrlResolvable)
            .map(url => this._urlResolver.resolve(moduleUrl, url));
        const /** @type {?} */ allStyles = stylesheet.styles.map(style => {
            const /** @type {?} */ styleWithImports = extractStyleUrls(this._urlResolver, moduleUrl, style);
            allStyleUrls.push(...styleWithImports.styleUrls);
            return styleWithImports.style;
        });
        return new CompileStylesheetMetadata({ styles: allStyles, styleUrls: allStyleUrls, moduleUrl: moduleUrl });
    }
}
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
/**
 * @record
 */
function PreparsedTemplate() { }
function PreparsedTemplate_tsickle_Closure_declarations() {
    /** @type {?} */
    PreparsedTemplate.prototype.template;
    /** @type {?} */
    PreparsedTemplate.prototype.templateUrl;
    /** @type {?} */
    PreparsedTemplate.prototype.isInline;
    /** @type {?} */
    PreparsedTemplate.prototype.htmlAst;
    /** @type {?} */
    PreparsedTemplate.prototype.styles;
    /** @type {?} */
    PreparsedTemplate.prototype.inlineStyleUrls;
    /** @type {?} */
    PreparsedTemplate.prototype.styleUrls;
    /** @type {?} */
    PreparsedTemplate.prototype.ngContentSelectors;
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