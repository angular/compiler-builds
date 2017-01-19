/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createDiTokenExpression } from '../compiler_util/identifier_util';
import * as o from '../output/output_ast';
import { ViewType } from '../private_import_core';
/**
 * @param {?} property
 * @param {?} callingView
 * @param {?} definedView
 * @return {?}
 */
export function getPropertyInView(property, callingView, definedView) {
    if (callingView === definedView) {
        return property;
    }
    else {
        let /** @type {?} */ viewProp = o.THIS_EXPR;
        let /** @type {?} */ currView = callingView;
        while (currView !== definedView && currView.declarationElement.view) {
            currView = currView.declarationElement.view;
            viewProp = viewProp.prop('parentView');
        }
        if (currView !== definedView) {
            throw new Error(`Internal error: Could not calculate a property in a parent view: ${property}`);
        }
        return property.visitExpression(new _ReplaceViewTransformer(viewProp, definedView), null);
    }
}
class _ReplaceViewTransformer extends o.ExpressionTransformer {
    /**
     * @param {?} _viewExpr
     * @param {?} _view
     */
    constructor(_viewExpr, _view) {
        super();
        this._viewExpr = _viewExpr;
        this._view = _view;
    }
    /**
     * @param {?} expr
     * @return {?}
     */
    _isThis(expr) {
        return expr instanceof o.ReadVarExpr && expr.builtin === o.BuiltinVar.This;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadVarExpr(ast, context) {
        return this._isThis(ast) ? this._viewExpr : ast;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReadPropExpr(ast, context) {
        if (this._isThis(ast.receiver)) {
            // Note: Don't cast for members of the AppView base class...
            if (this._view.fields.some((field) => field.name == ast.name) ||
                this._view.getters.some((field) => field.name == ast.name)) {
                return this._viewExpr.cast(this._view.classType).prop(ast.name);
            }
        }
        return super.visitReadPropExpr(ast, context);
    }
}
function _ReplaceViewTransformer_tsickle_Closure_declarations() {
    /** @type {?} */
    _ReplaceViewTransformer.prototype._viewExpr;
    /** @type {?} */
    _ReplaceViewTransformer.prototype._view;
}
/**
 * @param {?} view
 * @param {?} token
 * @param {?} optional
 * @return {?}
 */
export function injectFromViewParentInjector(view, token, optional) {
    let /** @type {?} */ viewExpr;
    if (view.viewType === ViewType.HOST) {
        viewExpr = o.THIS_EXPR;
    }
    else {
        viewExpr = o.THIS_EXPR.prop('parentView');
    }
    const /** @type {?} */ args = [createDiTokenExpression(token), o.THIS_EXPR.prop('parentIndex')];
    if (optional) {
        args.push(o.NULL_EXPR);
    }
    return viewExpr.callMethod('injectorGet', args);
}
/**
 * @param {?} elementIndex
 * @return {?}
 */
export function getHandleEventMethodName(elementIndex) {
    return `handleEvent_${elementIndex}`;
}
//# sourceMappingURL=util.js.map