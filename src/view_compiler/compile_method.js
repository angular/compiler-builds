/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../output/output_ast';
class _DebugState {
    /**
     * @param {?} nodeIndex
     * @param {?} sourceAst
     */
    constructor(nodeIndex, sourceAst) {
        this.nodeIndex = nodeIndex;
        this.sourceAst = sourceAst;
    }
}
function _DebugState_tsickle_Closure_declarations() {
    /** @type {?} */
    _DebugState.prototype.nodeIndex;
    /** @type {?} */
    _DebugState.prototype.sourceAst;
}
const /** @type {?} */ NULL_DEBUG_STATE = new _DebugState(null, null);
export class CompileMethod {
    /**
     * @param {?} _view
     */
    constructor(_view) {
        this._view = _view;
        this._newState = NULL_DEBUG_STATE;
        this._currState = NULL_DEBUG_STATE;
        this._bodyStatements = [];
        this._debugEnabled = this._view.genConfig.genDebugInfo;
    }
    /**
     * @return {?}
     */
    _updateDebugContextIfNeeded() {
        if (this._newState.nodeIndex !== this._currState.nodeIndex ||
            this._newState.sourceAst !== this._currState.sourceAst) {
            const /** @type {?} */ expr = this._updateDebugContext(this._newState);
            if (expr) {
                this._bodyStatements.push(expr.toStmt());
            }
        }
    }
    /**
     * @param {?} newState
     * @return {?}
     */
    _updateDebugContext(newState) {
        this._currState = this._newState = newState;
        if (this._debugEnabled) {
            const /** @type {?} */ sourceLocation = newState.sourceAst ? newState.sourceAst.sourceSpan.start : null;
            return o.THIS_EXPR.callMethod('debug', [
                o.literal(newState.nodeIndex),
                sourceLocation ? o.literal(sourceLocation.line) : o.NULL_EXPR,
                sourceLocation ? o.literal(sourceLocation.col) : o.NULL_EXPR
            ]);
        }
        else {
            return null;
        }
    }
    /**
     * @param {?} nodeIndex
     * @param {?} templateAst
     * @return {?}
     */
    resetDebugInfoExpr(nodeIndex, templateAst) {
        const /** @type {?} */ res = this._updateDebugContext(new _DebugState(nodeIndex, templateAst));
        return res || o.NULL_EXPR;
    }
    /**
     * @param {?} nodeIndex
     * @param {?} templateAst
     * @return {?}
     */
    resetDebugInfo(nodeIndex, templateAst) {
        this._newState = new _DebugState(nodeIndex, templateAst);
    }
    /**
     * @param {...?} stmts
     * @return {?}
     */
    push(...stmts) { this.addStmts(stmts); }
    /**
     * @param {?} stmt
     * @return {?}
     */
    addStmt(stmt) {
        this._updateDebugContextIfNeeded();
        this._bodyStatements.push(stmt);
    }
    /**
     * @param {?} stmts
     * @return {?}
     */
    addStmts(stmts) {
        this._updateDebugContextIfNeeded();
        this._bodyStatements.push(...stmts);
    }
    /**
     * @return {?}
     */
    finish() { return this._bodyStatements; }
    /**
     * @return {?}
     */
    isEmpty() { return this._bodyStatements.length === 0; }
}
function CompileMethod_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileMethod.prototype._newState;
    /** @type {?} */
    CompileMethod.prototype._currState;
    /** @type {?} */
    CompileMethod.prototype._debugEnabled;
    /** @type {?} */
    CompileMethod.prototype._bodyStatements;
    /** @type {?} */
    CompileMethod.prototype._view;
}
//# sourceMappingURL=compile_method.js.map