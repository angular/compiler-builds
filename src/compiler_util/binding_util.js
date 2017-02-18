/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../output/output_ast';
var CheckBindingField = (function () {
    /**
     * @param {?} expression
     * @param {?} bindingId
     */
    function CheckBindingField(expression, bindingId) {
        this.expression = expression;
        this.bindingId = bindingId;
    }
    return CheckBindingField;
}());
export { CheckBindingField };
function CheckBindingField_tsickle_Closure_declarations() {
    /** @type {?} */
    CheckBindingField.prototype.expression;
    /** @type {?} */
    CheckBindingField.prototype.bindingId;
}
/**
 * @param {?} builder
 * @return {?}
 */
export function createCheckBindingField(builder) {
    var /** @type {?} */ bindingId = "" + builder.fields.length;
    var /** @type {?} */ fieldExpr = createBindFieldExpr(bindingId);
    // private is fine here as no child view will reference the cached value...
    builder.fields.push(new o.ClassField(fieldExpr.name, null, [o.StmtModifier.Private]));
    builder.ctorStmts.push(o.THIS_EXPR.prop(fieldExpr.name).set(o.literal(undefined)).toStmt());
    return new CheckBindingField(fieldExpr, bindingId);
}
/**
 * @param {?} bindingId
 * @return {?}
 */
function createBindFieldExpr(bindingId) {
    return o.THIS_EXPR.prop("_expr_" + bindingId);
}
/**
 * @param {?} view
 * @return {?}
 */
export function isFirstViewCheck(view) {
    return o.not(view.prop('numberOfChecks'));
}
//# sourceMappingURL=binding_util.js.map