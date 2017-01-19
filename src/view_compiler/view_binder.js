/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { tokenReference } from '../compile_metadata';
import { templateVisitAll } from '../template_parser/template_ast';
import { bindOutputs } from './event_binder';
import { bindDirectiveAfterContentLifecycleCallbacks, bindDirectiveAfterViewLifecycleCallbacks, bindDirectiveWrapperLifecycleCallbacks, bindInjectableDestroyLifecycleCallbacks, bindPipeDestroyLifecycleCallbacks } from './lifecycle_binder';
import { bindDirectiveHostProps, bindDirectiveInputs, bindRenderInputs, bindRenderText } from './property_binder';
import { bindQueryValues } from './query_binder';
/**
 * @param {?} view
 * @param {?} parsedTemplate
 * @param {?} schemaRegistry
 * @return {?}
 */
export function bindView(view, parsedTemplate, schemaRegistry) {
    const /** @type {?} */ visitor = new ViewBinderVisitor(view, schemaRegistry);
    templateVisitAll(visitor, parsedTemplate);
    view.pipes.forEach((pipe) => { bindPipeDestroyLifecycleCallbacks(pipe.meta, pipe.instance, pipe.view); });
}
class ViewBinderVisitor {
    /**
     * @param {?} view
     * @param {?} _schemaRegistry
     */
    constructor(view, _schemaRegistry) {
        this.view = view;
        this._schemaRegistry = _schemaRegistry;
        this._nodeIndex = 0;
    }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    visitBoundText(ast, parent) {
        const /** @type {?} */ node = this.view.nodes[this._nodeIndex++];
        bindRenderText(ast, node, this.view);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    visitText(ast, parent) {
        this._nodeIndex++;
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    visitNgContent(ast, parent) { return null; }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    visitElement(ast, parent) {
        const /** @type {?} */ compileElement = (this.view.nodes[this._nodeIndex++]);
        bindQueryValues(compileElement);
        const /** @type {?} */ hasEvents = bindOutputs(ast.outputs, ast.directives, compileElement, true);
        bindRenderInputs(ast.inputs, ast.outputs, hasEvents, compileElement);
        ast.directives.forEach((directiveAst, dirIndex) => {
            const /** @type {?} */ directiveWrapperInstance = compileElement.directiveWrapperInstance.get(directiveAst.directive.type.reference);
            bindDirectiveInputs(directiveAst, directiveWrapperInstance, dirIndex, compileElement);
            bindDirectiveHostProps(directiveAst, directiveWrapperInstance, compileElement, ast.name, this._schemaRegistry);
        });
        templateVisitAll(this, ast.children, compileElement);
        // afterContent and afterView lifecycles need to be called bottom up
        // so that children are notified before parents
        ast.directives.forEach((directiveAst) => {
            const /** @type {?} */ directiveInstance = compileElement.instances.get(directiveAst.directive.type.reference);
            const /** @type {?} */ directiveWrapperInstance = compileElement.directiveWrapperInstance.get(directiveAst.directive.type.reference);
            bindDirectiveAfterContentLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveAfterViewLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveWrapperLifecycleCallbacks(directiveAst, directiveWrapperInstance, compileElement);
        });
        ast.providers.forEach((providerAst) => {
            const /** @type {?} */ providerInstance = compileElement.instances.get(tokenReference(providerAst.token));
            bindInjectableDestroyLifecycleCallbacks(providerAst, providerInstance, compileElement);
        });
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    visitEmbeddedTemplate(ast, parent) {
        const /** @type {?} */ compileElement = (this.view.nodes[this._nodeIndex++]);
        bindQueryValues(compileElement);
        bindOutputs(ast.outputs, ast.directives, compileElement, false);
        ast.directives.forEach((directiveAst, dirIndex) => {
            const /** @type {?} */ directiveInstance = compileElement.instances.get(directiveAst.directive.type.reference);
            const /** @type {?} */ directiveWrapperInstance = compileElement.directiveWrapperInstance.get(directiveAst.directive.type.reference);
            bindDirectiveInputs(directiveAst, directiveWrapperInstance, dirIndex, compileElement);
            bindDirectiveAfterContentLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveAfterViewLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveWrapperLifecycleCallbacks(directiveAst, directiveWrapperInstance, compileElement);
        });
        ast.providers.forEach((providerAst) => {
            const /** @type {?} */ providerInstance = compileElement.instances.get(tokenReference(providerAst.token));
            bindInjectableDestroyLifecycleCallbacks(providerAst, providerInstance, compileElement);
        });
        bindView(compileElement.embeddedView, ast.children, this._schemaRegistry);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitAttr(ast, ctx) { return null; }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitDirective(ast, ctx) { return null; }
    /**
     * @param {?} ast
     * @param {?} eventTargetAndNames
     * @return {?}
     */
    visitEvent(ast, eventTargetAndNames) {
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReference(ast, ctx) { return null; }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitVariable(ast, ctx) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirectiveProperty(ast, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElementProperty(ast, context) { return null; }
}
function ViewBinderVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewBinderVisitor.prototype._nodeIndex;
    /** @type {?} */
    ViewBinderVisitor.prototype.view;
    /** @type {?} */
    ViewBinderVisitor.prototype._schemaRegistry;
}
//# sourceMappingURL=view_binder.js.map