/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { tokenReference } from '../compile_metadata';
import { createPureProxy } from '../compiler_util/identifier_util';
import { Identifiers, createIdentifier, resolveIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { getPropertyInView, injectFromViewParentInjector } from './util';
export class CompilePipe {
    /**
     * @param {?} view
     * @param {?} meta
     */
    constructor(view, meta) {
        this.view = view;
        this.meta = meta;
        this._purePipeProxyCount = 0;
        this.instance = o.THIS_EXPR.prop(`_pipe_${meta.name}_${view.pipeCount++}`);
        const deps = this.meta.type.diDeps.map((diDep) => {
            if (tokenReference(diDep.token) === resolveIdentifier(Identifiers.ChangeDetectorRef)) {
                return getPropertyInView(o.THIS_EXPR.prop('ref'), this.view, this.view.componentView);
            }
            return injectFromViewParentInjector(view, diDep.token, false);
        });
        this.view.fields.push(new o.ClassField(this.instance.name, o.importType(this.meta.type)));
        this.view.createMethod.resetDebugInfo(null, null);
        this.view.createMethod.addStmt(o.THIS_EXPR.prop(this.instance.name)
            .set(o.importExpr(this.meta.type).instantiate(deps))
            .toStmt());
    }
    /**
     * @param {?} view
     * @param {?} name
     * @param {?} args
     * @return {?}
     */
    static call(view, name, args) {
        const /** @type {?} */ compView = view.componentView;
        const /** @type {?} */ meta = _findPipeMeta(compView, name);
        let /** @type {?} */ pipe;
        if (meta.pure) {
            // pure pipes live on the component view
            pipe = compView.purePipes.get(name);
            if (!pipe) {
                pipe = new CompilePipe(compView, meta);
                compView.purePipes.set(name, pipe);
                compView.pipes.push(pipe);
            }
        }
        else {
            // Non pure pipes live on the view that called it
            pipe = new CompilePipe(view, meta);
            view.pipes.push(pipe);
        }
        return pipe._call(view, args);
    }
    /**
     * @return {?}
     */
    get pure() { return this.meta.pure; }
    /**
     * @param {?} callingView
     * @param {?} args
     * @return {?}
     */
    _call(callingView, args) {
        if (this.meta.pure) {
            // PurePipeProxies live on the view that called them.
            const /** @type {?} */ purePipeProxyInstance = o.THIS_EXPR.prop(`${this.instance.name}_${this._purePipeProxyCount++}`);
            const /** @type {?} */ pipeInstanceSeenFromPureProxy = getPropertyInView(this.instance, callingView, this.view);
            createPureProxy(pipeInstanceSeenFromPureProxy.prop('transform')
                .callMethod(o.BuiltinMethod.Bind, [pipeInstanceSeenFromPureProxy]), args.length, purePipeProxyInstance, { fields: callingView.fields, ctorStmts: callingView.createMethod });
            return o.importExpr(createIdentifier(Identifiers.castByValue))
                .callFn([purePipeProxyInstance, pipeInstanceSeenFromPureProxy.prop('transform')])
                .callFn(args);
        }
        else {
            return getPropertyInView(this.instance, callingView, this.view).callMethod('transform', args);
        }
    }
}
function CompilePipe_tsickle_Closure_declarations() {
    /** @type {?} */
    CompilePipe.prototype.instance;
    /** @type {?} */
    CompilePipe.prototype._purePipeProxyCount;
    /** @type {?} */
    CompilePipe.prototype.view;
    /** @type {?} */
    CompilePipe.prototype.meta;
}
/**
 * @param {?} view
 * @param {?} name
 * @return {?}
 */
function _findPipeMeta(view, name) {
    let /** @type {?} */ pipeMeta = null;
    for (let /** @type {?} */ i = view.pipeMetas.length - 1; i >= 0; i--) {
        const /** @type {?} */ localPipeMeta = view.pipeMetas[i];
        if (localPipeMeta.name == name) {
            pipeMeta = localPipeMeta;
            break;
        }
    }
    if (!pipeMeta) {
        throw new Error(`Illegal state: Could not find pipe ${name} although the parser should have detected this error!`);
    }
    return pipeMeta;
}
//# sourceMappingURL=compile_pipe.js.map