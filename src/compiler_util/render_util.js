/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '@angular/core';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { EMPTY_STATE as EMPTY_ANIMATION_STATE } from '../private_import_core';
import { BoundEventAst, PropertyBindingType } from '../template_parser/template_ast';
import { isFirstViewCheck } from './binding_util';
import { createEnumExpression } from './identifier_util';
/**
 * @param {?} view
 * @param {?} renderElement
 * @param {?} boundProp
 * @param {?} oldValue
 * @param {?} evalResult
 * @param {?=} securityContextExpression
 * @return {?}
 */
export function createCheckRenderBindingStmt(view, renderElement, boundProp, oldValue, evalResult, securityContextExpression) {
    var /** @type {?} */ checkStmts = evalResult.stmts.slice();
    var /** @type {?} */ securityContext = calcSecurityContext(boundProp, securityContextExpression);
    switch (boundProp.type) {
        case PropertyBindingType.Property:
            checkStmts.push(o.importExpr(createIdentifier(Identifiers.checkRenderProperty))
                .callFn([
                view, renderElement, o.literal(boundProp.name), oldValue,
                oldValue.set(evalResult.currValExpr),
                evalResult.forceUpdate || o.literal(false), securityContext
            ])
                .toStmt());
            break;
        case PropertyBindingType.Attribute:
            checkStmts.push(o.importExpr(createIdentifier(Identifiers.checkRenderAttribute))
                .callFn([
                view, renderElement, o.literal(boundProp.name), oldValue,
                oldValue.set(evalResult.currValExpr),
                evalResult.forceUpdate || o.literal(false), securityContext
            ])
                .toStmt());
            break;
        case PropertyBindingType.Class:
            checkStmts.push(o.importExpr(createIdentifier(Identifiers.checkRenderClass))
                .callFn([
                view, renderElement, o.literal(boundProp.name), oldValue,
                oldValue.set(evalResult.currValExpr), evalResult.forceUpdate || o.literal(false)
            ])
                .toStmt());
            break;
        case PropertyBindingType.Style:
            checkStmts.push(o.importExpr(createIdentifier(Identifiers.checkRenderStyle))
                .callFn([
                view, renderElement, o.literal(boundProp.name), o.literal(boundProp.unit), oldValue,
                oldValue.set(evalResult.currValExpr), evalResult.forceUpdate || o.literal(false),
                securityContext
            ])
                .toStmt());
            break;
        case PropertyBindingType.Animation:
            throw new Error('Illegal state: Should not come here!');
    }
    return checkStmts;
}
/**
 * @param {?} boundProp
 * @param {?=} securityContextExpression
 * @return {?}
 */
function calcSecurityContext(boundProp, securityContextExpression) {
    if (boundProp.securityContext === SecurityContext.NONE) {
        return o.NULL_EXPR; // No sanitization needed.
    }
    if (!boundProp.needsRuntimeSecurityContext) {
        securityContextExpression =
            createEnumExpression(Identifiers.SecurityContext, boundProp.securityContext);
    }
    if (!securityContextExpression) {
        throw new Error("internal error, no SecurityContext given " + boundProp.name);
    }
    return securityContextExpression;
}
/**
 * @param {?} view
 * @param {?} componentView
 * @param {?} boundProp
 * @param {?} boundOutputs
 * @param {?} eventListener
 * @param {?} renderElement
 * @param {?} oldValue
 * @param {?} evalResult
 * @return {?}
 */
export function createCheckAnimationBindingStmts(view, componentView, boundProp, boundOutputs, eventListener, renderElement, oldValue, evalResult) {
    var /** @type {?} */ detachStmts = [];
    var /** @type {?} */ updateStmts = [];
    var /** @type {?} */ animationName = boundProp.name;
    var /** @type {?} */ animationFnExpr = componentView.prop('componentType').prop('animations').key(o.literal(animationName));
    // it's important to normalize the void value as `void` explicitly
    // so that the styles data can be obtained from the stringmap
    var /** @type {?} */ emptyStateValue = o.literal(EMPTY_ANIMATION_STATE);
    var /** @type {?} */ animationTransitionVar = o.variable('animationTransition_' + animationName);
    updateStmts.push(animationTransitionVar
        .set(animationFnExpr.callFn([
        view, renderElement, isFirstViewCheck(view).conditional(emptyStateValue, oldValue),
        evalResult.currValExpr
    ]))
        .toDeclStmt());
    updateStmts.push(oldValue.set(evalResult.currValExpr).toStmt());
    detachStmts.push(animationTransitionVar
        .set(animationFnExpr.callFn([view, renderElement, evalResult.currValExpr, emptyStateValue]))
        .toDeclStmt());
    var /** @type {?} */ registerStmts = [];
    var /** @type {?} */ animationStartMethodExists = boundOutputs.find(function (event) { return event.isAnimation && event.name == animationName && event.phase == 'start'; });
    if (animationStartMethodExists) {
        registerStmts.push(animationTransitionVar
            .callMethod('onStart', [eventListener.callMethod(o.BuiltinMethod.Bind, [view, o.literal(BoundEventAst.calcFullName(animationName, null, 'start'))])])
            .toStmt());
    }
    var /** @type {?} */ animationDoneMethodExists = boundOutputs.find(function (event) { return event.isAnimation && event.name == animationName && event.phase == 'done'; });
    if (animationDoneMethodExists) {
        registerStmts.push(animationTransitionVar
            .callMethod('onDone', [eventListener.callMethod(o.BuiltinMethod.Bind, [view, o.literal(BoundEventAst.calcFullName(animationName, null, 'done'))])])
            .toStmt());
    }
    updateStmts.push.apply(updateStmts, registerStmts);
    detachStmts.push.apply(detachStmts, registerStmts);
    var /** @type {?} */ checkUpdateStmts = evalResult.stmts.concat([
        new o.IfStmt(o.importExpr(createIdentifier(Identifiers.checkBinding)).callFn([
            view, oldValue, evalResult.currValExpr, evalResult.forceUpdate || o.literal(false)
        ]), updateStmts)
    ]);
    var /** @type {?} */ checkDetachStmts = evalResult.stmts.concat(detachStmts);
    return { checkUpdateStmts: checkUpdateStmts, checkDetachStmts: checkDetachStmts };
}
//# sourceMappingURL=render_util.js.map