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
import { CompileStylesheetMetadata, identifierModuleUrl, identifierName } from './compile_metadata';
import { ViewEncapsulation } from './core';
import * as o from './output/output_ast';
import { ShadowCss } from './shadow_css';
const /** @type {?} */ COMPONENT_VARIABLE = '%COMP%';
const /** @type {?} */ HOST_ATTR = `_nghost-${COMPONENT_VARIABLE}`;
const /** @type {?} */ CONTENT_ATTR = `_ngcontent-${COMPONENT_VARIABLE}`;
export class StylesCompileDependency {
    /**
     * @param {?} name
     * @param {?} moduleUrl
     * @param {?} setValue
     */
    constructor(name, moduleUrl, setValue) {
        this.name = name;
        this.moduleUrl = moduleUrl;
        this.setValue = setValue;
    }
}
function StylesCompileDependency_tsickle_Closure_declarations() {
    /** @type {?} */
    StylesCompileDependency.prototype.name;
    /** @type {?} */
    StylesCompileDependency.prototype.moduleUrl;
    /** @type {?} */
    StylesCompileDependency.prototype.setValue;
}
export class CompiledStylesheet {
    /**
     * @param {?} outputCtx
     * @param {?} stylesVar
     * @param {?} dependencies
     * @param {?} isShimmed
     * @param {?} meta
     */
    constructor(outputCtx, stylesVar, dependencies, isShimmed, meta) {
        this.outputCtx = outputCtx;
        this.stylesVar = stylesVar;
        this.dependencies = dependencies;
        this.isShimmed = isShimmed;
        this.meta = meta;
    }
}
function CompiledStylesheet_tsickle_Closure_declarations() {
    /** @type {?} */
    CompiledStylesheet.prototype.outputCtx;
    /** @type {?} */
    CompiledStylesheet.prototype.stylesVar;
    /** @type {?} */
    CompiledStylesheet.prototype.dependencies;
    /** @type {?} */
    CompiledStylesheet.prototype.isShimmed;
    /** @type {?} */
    CompiledStylesheet.prototype.meta;
}
export class StyleCompiler {
    /**
     * @param {?} _urlResolver
     */
    constructor(_urlResolver) {
        this._urlResolver = _urlResolver;
        this._shadowCss = new ShadowCss();
    }
    /**
     * @param {?} outputCtx
     * @param {?} comp
     * @return {?}
     */
    compileComponent(outputCtx, comp) {
        const /** @type {?} */ template = /** @type {?} */ ((comp.template));
        return this._compileStyles(outputCtx, comp, new CompileStylesheetMetadata({
            styles: template.styles,
            styleUrls: template.styleUrls,
            moduleUrl: identifierModuleUrl(comp.type)
        }), this.needsStyleShim(comp), true);
    }
    /**
     * @param {?} outputCtx
     * @param {?} comp
     * @param {?} stylesheet
     * @param {?=} shim
     * @return {?}
     */
    compileStyles(outputCtx, comp, stylesheet, shim = this.needsStyleShim(comp)) {
        return this._compileStyles(outputCtx, comp, stylesheet, shim, false);
    }
    /**
     * @param {?} comp
     * @return {?}
     */
    needsStyleShim(comp) {
        return /** @type {?} */ ((comp.template)).encapsulation === ViewEncapsulation.Emulated;
    }
    /**
     * @param {?} outputCtx
     * @param {?} comp
     * @param {?} stylesheet
     * @param {?} shim
     * @param {?} isComponentStylesheet
     * @return {?}
     */
    _compileStyles(outputCtx, comp, stylesheet, shim, isComponentStylesheet) {
        const /** @type {?} */ styleExpressions = stylesheet.styles.map(plainStyle => o.literal(this._shimIfNeeded(plainStyle, shim)));
        const /** @type {?} */ dependencies = [];
        stylesheet.styleUrls.forEach((styleUrl) => {
            const /** @type {?} */ exprIndex = styleExpressions.length;
            // Note: This placeholder will be filled later.
            styleExpressions.push(/** @type {?} */ ((null)));
            dependencies.push(new StylesCompileDependency(getStylesVarName(null), styleUrl, (value) => styleExpressions[exprIndex] = outputCtx.importExpr(value)));
        });
        // styles variable contains plain strings and arrays of other styles arrays (recursive),
        // so we set its type to dynamic.
        const /** @type {?} */ stylesVar = getStylesVarName(isComponentStylesheet ? comp : null);
        const /** @type {?} */ stmt = o.variable(stylesVar)
            .set(o.literalArr(styleExpressions, new o.ArrayType(o.DYNAMIC_TYPE, [o.TypeModifier.Const])))
            .toDeclStmt(null, isComponentStylesheet ? [o.StmtModifier.Final] : [
            o.StmtModifier.Final, o.StmtModifier.Exported
        ]);
        outputCtx.statements.push(stmt);
        return new CompiledStylesheet(outputCtx, stylesVar, dependencies, shim, stylesheet);
    }
    /**
     * @param {?} style
     * @param {?} shim
     * @return {?}
     */
    _shimIfNeeded(style, shim) {
        return shim ? this._shadowCss.shimCssText(style, CONTENT_ATTR, HOST_ATTR) : style;
    }
}
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