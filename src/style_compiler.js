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
import { CompileStylesheetMetadata, identifierModuleUrl, identifierName } from './compile_metadata';
import { CompilerInjectable } from './injectable';
import * as o from './output/output_ast';
import { ShadowCss } from './shadow_css';
import { UrlResolver } from './url_resolver';
const /** @type {?} */ COMPONENT_VARIABLE = '%COMP%';
const /** @type {?} */ HOST_ATTR = `_nghost-${COMPONENT_VARIABLE}`;
const /** @type {?} */ CONTENT_ATTR = `_ngcontent-${COMPONENT_VARIABLE}`;
export class StylesCompileDependency {
    /**
     * @param {?} name
     * @param {?} moduleUrl
     * @param {?} isShimmed
     * @param {?} valuePlaceholder
     */
    constructor(name, moduleUrl, isShimmed, valuePlaceholder) {
        this.name = name;
        this.moduleUrl = moduleUrl;
        this.isShimmed = isShimmed;
        this.valuePlaceholder = valuePlaceholder;
    }
}
function StylesCompileDependency_tsickle_Closure_declarations() {
    /** @type {?} */
    StylesCompileDependency.prototype.name;
    /** @type {?} */
    StylesCompileDependency.prototype.moduleUrl;
    /** @type {?} */
    StylesCompileDependency.prototype.isShimmed;
    /** @type {?} */
    StylesCompileDependency.prototype.valuePlaceholder;
}
export class StylesCompileResult {
    /**
     * @param {?} componentStylesheet
     * @param {?} externalStylesheets
     */
    constructor(componentStylesheet, externalStylesheets) {
        this.componentStylesheet = componentStylesheet;
        this.externalStylesheets = externalStylesheets;
    }
}
function StylesCompileResult_tsickle_Closure_declarations() {
    /** @type {?} */
    StylesCompileResult.prototype.componentStylesheet;
    /** @type {?} */
    StylesCompileResult.prototype.externalStylesheets;
}
export class CompiledStylesheet {
    /**
     * @param {?} statements
     * @param {?} stylesVar
     * @param {?} dependencies
     * @param {?} isShimmed
     * @param {?} meta
     */
    constructor(statements, stylesVar, dependencies, isShimmed, meta) {
        this.statements = statements;
        this.stylesVar = stylesVar;
        this.dependencies = dependencies;
        this.isShimmed = isShimmed;
        this.meta = meta;
    }
}
function CompiledStylesheet_tsickle_Closure_declarations() {
    /** @type {?} */
    CompiledStylesheet.prototype.statements;
    /** @type {?} */
    CompiledStylesheet.prototype.stylesVar;
    /** @type {?} */
    CompiledStylesheet.prototype.dependencies;
    /** @type {?} */
    CompiledStylesheet.prototype.isShimmed;
    /** @type {?} */
    CompiledStylesheet.prototype.meta;
}
export let StyleCompiler = class StyleCompiler {
    /**
     * @param {?} _urlResolver
     */
    constructor(_urlResolver) {
        this._urlResolver = _urlResolver;
        this._shadowCss = new ShadowCss();
    }
    /**
     * @param {?} comp
     * @return {?}
     */
    compileComponent(comp) {
        const /** @type {?} */ externalStylesheets = [];
        const /** @type {?} */ componentStylesheet = this._compileStyles(comp, new CompileStylesheetMetadata({
            styles: comp.template.styles,
            styleUrls: comp.template.styleUrls,
            moduleUrl: identifierModuleUrl(comp.type)
        }), true);
        comp.template.externalStylesheets.forEach((stylesheetMeta) => {
            const /** @type {?} */ compiledStylesheet = this._compileStyles(comp, stylesheetMeta, false);
            externalStylesheets.push(compiledStylesheet);
        });
        return new StylesCompileResult(componentStylesheet, externalStylesheets);
    }
    /**
     * @param {?} comp
     * @param {?} stylesheet
     * @param {?} isComponentStylesheet
     * @return {?}
     */
    _compileStyles(comp, stylesheet, isComponentStylesheet) {
        const /** @type {?} */ shim = comp.template.encapsulation === ViewEncapsulation.Emulated;
        const /** @type {?} */ styleExpressions = stylesheet.styles.map(plainStyle => o.literal(this._shimIfNeeded(plainStyle, shim)));
        const /** @type {?} */ dependencies = [];
        for (let /** @type {?} */ i = 0; i < stylesheet.styleUrls.length; i++) {
            const /** @type {?} */ identifier = { reference: null };
            dependencies.push(new StylesCompileDependency(getStylesVarName(null), stylesheet.styleUrls[i], shim, identifier));
            styleExpressions.push(new o.ExternalExpr(identifier));
        }
        // styles variable contains plain strings and arrays of other styles arrays (recursive),
        // so we set its type to dynamic.
        const /** @type {?} */ stylesVar = getStylesVarName(isComponentStylesheet ? comp : null);
        const /** @type {?} */ stmt = o.variable(stylesVar)
            .set(o.literalArr(styleExpressions, new o.ArrayType(o.DYNAMIC_TYPE, [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]);
        return new CompiledStylesheet([stmt], stylesVar, dependencies, shim, stylesheet);
    }
    /**
     * @param {?} style
     * @param {?} shim
     * @return {?}
     */
    _shimIfNeeded(style, shim) {
        return shim ? this._shadowCss.shimCssText(style, CONTENT_ATTR, HOST_ATTR) : style;
    }
};
StyleCompiler = __decorate([
    CompilerInjectable(), 
    __metadata('design:paramtypes', [UrlResolver])
], StyleCompiler);
function StyleCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    StyleCompiler.prototype._shadowCss;
    /** @type {?} */
    StyleCompiler.prototype._urlResolver;
}
/**
 * @param {?} component
 * @return {?}
 */
function getStylesVarName(component) {
    let /** @type {?} */ result = `styles`;
    if (component) {
        result += `_${identifierName(component.type)}`;
    }
    return result;
}
//# sourceMappingURL=style_compiler.js.map