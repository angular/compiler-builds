/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createCheckBindingField } from '../compiler_util/binding_util';
import { legacyConvertPropertyBinding } from '../compiler_util/expression_converter';
import { createEnumExpression } from '../compiler_util/identifier_util';
import { createCheckAnimationBindingStmts, createCheckRenderBindingStmt } from '../compiler_util/render_util';
import { DirectiveWrapperExpressions } from '../directive_wrapper_compiler';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { isDefaultChangeDetectionStrategy } from '../private_import_core';
import { PropertyBindingType } from '../template_parser/template_ast';
import { getHandleEventMethodName } from './util';
/**
 * @param {?} boundText
 * @param {?} compileNode
 * @param {?} view
 * @return {?}
 */
export function bindRenderText(boundText, compileNode, view) {
    var /** @type {?} */ valueField = createCheckBindingField(view);
    var /** @type {?} */ evalResult = legacyConvertPropertyBinding(view, view, view.componentContext, boundText.value, valueField.bindingId);
    if (!evalResult) {
        return null;
    }
    view.detectChangesRenderPropertiesMethod.resetDebugInfo(compileNode.nodeIndex, boundText);
    view.detectChangesRenderPropertiesMethod.addStmts(evalResult.stmts);
    view.detectChangesRenderPropertiesMethod.addStmt(o.importExpr(createIdentifier(Identifiers.checkRenderText))
        .callFn([
        o.THIS_EXPR, compileNode.renderNode, valueField.expression,
        valueField.expression.set(evalResult.currValExpr),
        evalResult.forceUpdate || o.literal(false)
    ])
        .toStmt());
}
/**
 * @param {?} boundProps
 * @param {?} boundOutputs
 * @param {?} hasEvents
 * @param {?} compileElement
 * @return {?}
 */
export function bindRenderInputs(boundProps, boundOutputs, hasEvents, compileElement) {
    var /** @type {?} */ view = compileElement.view;
    var /** @type {?} */ renderNode = compileElement.renderNode;
    boundProps.forEach(function (boundProp) {
        var /** @type {?} */ bindingField = createCheckBindingField(view);
        view.detectChangesRenderPropertiesMethod.resetDebugInfo(compileElement.nodeIndex, boundProp);
        var /** @type {?} */ evalResult = legacyConvertPropertyBinding(view, view, compileElement.view.componentContext, boundProp.value, bindingField.bindingId);
        if (!evalResult) {
            return;
        }
        var /** @type {?} */ compileMethod = view.detectChangesRenderPropertiesMethod;
        switch (boundProp.type) {
            case PropertyBindingType.Property:
            case PropertyBindingType.Attribute:
            case PropertyBindingType.Class:
            case PropertyBindingType.Style:
                compileMethod.addStmts(createCheckRenderBindingStmt(o.THIS_EXPR, renderNode, boundProp, bindingField.expression, evalResult));
                break;
            case PropertyBindingType.Animation:
                compileMethod = view.animationBindingsMethod;
                var _a = createCheckAnimationBindingStmts(o.THIS_EXPR, o.THIS_EXPR, boundProp, boundOutputs, (hasEvents ? o.THIS_EXPR.prop(getHandleEventMethodName(compileElement.nodeIndex)) :
                    o.importExpr(createIdentifier(Identifiers.noop)))
                    .callMethod(o.BuiltinMethod.Bind, [o.THIS_EXPR]), compileElement.renderNode, bindingField.expression, evalResult), checkUpdateStmts = _a.checkUpdateStmts, checkDetachStmts = _a.checkDetachStmts;
                view.detachMethod.addStmts(checkDetachStmts);
                compileMethod.addStmts(checkUpdateStmts);
                break;
        }
    });
}
/**
 * @param {?} directiveAst
 * @param {?} directiveWrapperInstance
 * @param {?} compileElement
 * @param {?} elementName
 * @param {?} schemaRegistry
 * @return {?}
 */
export function bindDirectiveHostProps(directiveAst, directiveWrapperInstance, compileElement, elementName, schemaRegistry) {
    // We need to provide the SecurityContext for properties that could need sanitization.
    var /** @type {?} */ runtimeSecurityCtxExprs = directiveAst.hostProperties.filter(function (boundProp) { return boundProp.needsRuntimeSecurityContext; })
        .map(function (boundProp) {
        var /** @type {?} */ ctx;
        switch (boundProp.type) {
            case PropertyBindingType.Property:
                ctx = schemaRegistry.securityContext(elementName, boundProp.name, false);
                break;
            case PropertyBindingType.Attribute:
                ctx = schemaRegistry.securityContext(elementName, boundProp.name, true);
                break;
            default:
                throw new Error("Illegal state: Only property / attribute bindings can have an unknown security context! Binding " + boundProp.name);
        }
        return createEnumExpression(Identifiers.SecurityContext, ctx);
    });
    compileElement.view.detectChangesRenderPropertiesMethod.addStmts(DirectiveWrapperExpressions.checkHost(directiveAst.hostProperties, directiveWrapperInstance, o.THIS_EXPR, compileElement.compViewExpr || o.THIS_EXPR, compileElement.renderNode, runtimeSecurityCtxExprs));
}
/**
 * @param {?} directiveAst
 * @param {?} directiveWrapperInstance
 * @param {?} dirIndex
 * @param {?} compileElement
 * @return {?}
 */
export function bindDirectiveInputs(directiveAst, directiveWrapperInstance, dirIndex, compileElement) {
    var /** @type {?} */ view = compileElement.view;
    var /** @type {?} */ detectChangesInInputsMethod = view.detectChangesInInputsMethod;
    detectChangesInInputsMethod.resetDebugInfo(compileElement.nodeIndex, compileElement.sourceAst);
    directiveAst.inputs.forEach(function (input, inputIdx) {
        // Note: We can't use `fields.length` here, as we are not adding a field!
        var /** @type {?} */ bindingId = compileElement.nodeIndex + "_" + dirIndex + "_" + inputIdx;
        detectChangesInInputsMethod.resetDebugInfo(compileElement.nodeIndex, input);
        var /** @type {?} */ evalResult = legacyConvertPropertyBinding(view, view, view.componentContext, input.value, bindingId);
        if (!evalResult) {
            return;
        }
        detectChangesInInputsMethod.addStmts(evalResult.stmts);
        detectChangesInInputsMethod.addStmt(directiveWrapperInstance
            .callMethod("check_" + input.directiveName, [o.THIS_EXPR, evalResult.currValExpr, evalResult.forceUpdate || o.literal(false)])
            .toStmt());
    });
    var /** @type {?} */ isOnPushComp = directiveAst.directive.isComponent &&
        !isDefaultChangeDetectionStrategy(directiveAst.directive.changeDetection);
    var /** @type {?} */ directiveDetectChangesExpr = DirectiveWrapperExpressions.ngDoCheck(directiveWrapperInstance, o.THIS_EXPR, compileElement.renderNode);
    var /** @type {?} */ directiveDetectChangesStmt = isOnPushComp ?
        new o.IfStmt(directiveDetectChangesExpr, [compileElement.compViewExpr.callMethod('markAsCheckOnce', []).toStmt()]) :
        directiveDetectChangesExpr.toStmt();
    detectChangesInInputsMethod.addStmt(directiveDetectChangesStmt);
}
//# sourceMappingURL=property_binder.js.map