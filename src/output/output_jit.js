/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName } from '../compile_metadata';
import { EmitterVisitorContext } from './abstract_emitter';
import { AbstractJsEmitterVisitor } from './abstract_js_emitter';
/**
 * @param {?} sourceUrl
 * @param {?} expr
 * @param {?} declarations
 * @param {?} vars
 * @return {?}
 */
function evalExpression(sourceUrl, expr, declarations, vars) {
    const /** @type {?} */ fnBody = `${declarations}\nreturn ${expr}\n//# sourceURL=${sourceUrl}`;
    const /** @type {?} */ fnArgNames = [];
    const /** @type {?} */ fnArgValues = [];
    for (const argName in vars) {
        fnArgNames.push(argName);
        fnArgValues.push(vars[argName]);
    }
    return new Function(...fnArgNames.concat(fnBody))(...fnArgValues);
}
/**
 * @param {?} sourceUrl
 * @param {?} statements
 * @param {?} resultVar
 * @return {?}
 */
export function jitStatements(sourceUrl, statements, resultVar) {
    const /** @type {?} */ converter = new JitEmitterVisitor();
    const /** @type {?} */ ctx = EmitterVisitorContext.createRoot([resultVar]);
    converter.visitAllStatements(statements, ctx);
    return evalExpression(sourceUrl, resultVar, ctx.toSource(), converter.getArgs());
}
class JitEmitterVisitor extends AbstractJsEmitterVisitor {
    constructor() {
        super(...arguments);
        this._evalArgNames = [];
        this._evalArgValues = [];
    }
    /**
     * @return {?}
     */
    getArgs() {
        const /** @type {?} */ result = {};
        for (let /** @type {?} */ i = 0; i < this._evalArgNames.length; i++) {
            result[this._evalArgNames[i]] = this._evalArgValues[i];
        }
        return result;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitExternalExpr(ast, ctx) {
        const /** @type {?} */ value = ast.value.reference;
        let /** @type {?} */ id = this._evalArgValues.indexOf(value);
        if (id === -1) {
            id = this._evalArgValues.length;
            this._evalArgValues.push(value);
            const /** @type {?} */ name = identifierName(ast.value) || 'val';
            this._evalArgNames.push(`jit_${name}${id}`);
        }
        ctx.print(this._evalArgNames[id]);
        return null;
    }
}
function JitEmitterVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    JitEmitterVisitor.prototype._evalArgNames;
    /** @type {?} */
    JitEmitterVisitor.prototype._evalArgValues;
}
//# sourceMappingURL=output_jit.js.map