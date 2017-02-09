/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createEnumExpression } from '../compiler_util/identifier_util';
import { Identifiers } from '../identifiers';
import * as o from '../output/output_ast';
var ViewTypeEnum = (function () {
    function ViewTypeEnum() {
    }
    /**
     * @param {?} value
     * @return {?}
     */
    ViewTypeEnum.fromValue = function (value) {
        return createEnumExpression(Identifiers.ViewType, value);
    };
    return ViewTypeEnum;
}());
export { ViewTypeEnum };
var ViewEncapsulationEnum = (function () {
    function ViewEncapsulationEnum() {
    }
    /**
     * @param {?} value
     * @return {?}
     */
    ViewEncapsulationEnum.fromValue = function (value) {
        return createEnumExpression(Identifiers.ViewEncapsulation, value);
    };
    return ViewEncapsulationEnum;
}());
export { ViewEncapsulationEnum };
var ChangeDetectorStatusEnum = (function () {
    function ChangeDetectorStatusEnum() {
    }
    /**
     * @param {?} value
     * @return {?}
     */
    ChangeDetectorStatusEnum.fromValue = function (value) {
        return createEnumExpression(Identifiers.ChangeDetectorStatus, value);
    };
    return ChangeDetectorStatusEnum;
}());
export { ChangeDetectorStatusEnum };
var ViewConstructorVars = (function () {
    function ViewConstructorVars() {
    }
    return ViewConstructorVars;
}());
export { ViewConstructorVars };
ViewConstructorVars.viewUtils = o.variable('viewUtils');
ViewConstructorVars.parentView = o.variable('parentView');
ViewConstructorVars.parentIndex = o.variable('parentIndex');
ViewConstructorVars.parentElement = o.variable('parentElement');
function ViewConstructorVars_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewConstructorVars.viewUtils;
    /** @type {?} */
    ViewConstructorVars.parentView;
    /** @type {?} */
    ViewConstructorVars.parentIndex;
    /** @type {?} */
    ViewConstructorVars.parentElement;
}
var ViewProperties = (function () {
    function ViewProperties() {
    }
    return ViewProperties;
}());
export { ViewProperties };
ViewProperties.renderer = o.THIS_EXPR.prop('renderer');
ViewProperties.viewUtils = o.THIS_EXPR.prop('viewUtils');
ViewProperties.throwOnChange = o.THIS_EXPR.prop('throwOnChange');
function ViewProperties_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewProperties.renderer;
    /** @type {?} */
    ViewProperties.viewUtils;
    /** @type {?} */
    ViewProperties.throwOnChange;
}
var InjectMethodVars = (function () {
    function InjectMethodVars() {
    }
    return InjectMethodVars;
}());
export { InjectMethodVars };
InjectMethodVars.token = o.variable('token');
InjectMethodVars.requestNodeIndex = o.variable('requestNodeIndex');
InjectMethodVars.notFoundResult = o.variable('notFoundResult');
function InjectMethodVars_tsickle_Closure_declarations() {
    /** @type {?} */
    InjectMethodVars.token;
    /** @type {?} */
    InjectMethodVars.requestNodeIndex;
    /** @type {?} */
    InjectMethodVars.notFoundResult;
}
//# sourceMappingURL=constants.js.map