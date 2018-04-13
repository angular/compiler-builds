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
import { identifierName } from './compile_metadata';
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { convertValueToOutputAst } from './output/value_util';
/**
 * @param {?} key
 * @param {?} value
 * @return {?}
 */
function mapEntry(key, value) {
    return { key, value, quoted: false };
}
export class InjectableCompiler {
    /**
     * @param {?} reflector
     * @param {?} alwaysGenerateDef
     */
    constructor(reflector, alwaysGenerateDef) {
        this.reflector = reflector;
        this.alwaysGenerateDef = alwaysGenerateDef;
        this.tokenInjector = reflector.resolveExternalReference(Identifiers.Injector);
    }
    /**
     * @param {?} deps
     * @param {?} ctx
     * @return {?}
     */
    depsArray(deps, ctx) {
        return deps.map(dep => {
            let /** @type {?} */ token = dep;
            let /** @type {?} */ args = [token];
            let /** @type {?} */ flags = 0 /* Default */;
            if (Array.isArray(dep)) {
                for (let /** @type {?} */ i = 0; i < dep.length; i++) {
                    const /** @type {?} */ v = dep[i];
                    if (v) {
                        if (v.ngMetadataName === 'Optional') {
                            flags |= 8 /* Optional */;
                        }
                        else if (v.ngMetadataName === 'SkipSelf') {
                            flags |= 4 /* SkipSelf */;
                        }
                        else if (v.ngMetadataName === 'Self') {
                            flags |= 2 /* Self */;
                        }
                        else if (v.ngMetadataName === 'Inject') {
                            token = v.token;
                        }
                        else {
                            token = v;
                        }
                    }
                }
            }
            let /** @type {?} */ tokenExpr;
            if (typeof token === 'string') {
                tokenExpr = o.literal(token);
            }
            else if (token === this.tokenInjector) {
                tokenExpr = o.importExpr(Identifiers.INJECTOR);
            }
            else {
                tokenExpr = ctx.importExpr(token);
            }
            if (flags !== 0 /* Default */) {
                args = [tokenExpr, o.literal(flags)];
            }
            else {
                args = [tokenExpr];
            }
            return o.importExpr(Identifiers.inject).callFn(args);
        });
    }
    /**
     * @param {?} injectable
     * @param {?} ctx
     * @return {?}
     */
    factoryFor(injectable, ctx) {
        let /** @type {?} */ retValue;
        if (injectable.useExisting) {
            retValue = o.importExpr(Identifiers.inject).callFn([ctx.importExpr(injectable.useExisting)]);
        }
        else if (injectable.useFactory) {
            const /** @type {?} */ deps = injectable.deps || [];
            if (deps.length > 0) {
                retValue = ctx.importExpr(injectable.useFactory).callFn(this.depsArray(deps, ctx));
            }
            else {
                return ctx.importExpr(injectable.useFactory);
            }
        }
        else if (injectable.useValue) {
            retValue = convertValueToOutputAst(ctx, injectable.useValue);
        }
        else {
            const /** @type {?} */ clazz = injectable.useClass || injectable.symbol;
            const /** @type {?} */ depArgs = this.depsArray(this.reflector.parameters(clazz), ctx);
            retValue = new o.InstantiateExpr(ctx.importExpr(clazz), depArgs);
        }
        return o.fn([], [new o.ReturnStatement(retValue)], undefined, undefined, injectable.symbol.name + '_Factory');
    }
    /**
     * @param {?} injectable
     * @param {?} ctx
     * @return {?}
     */
    injectableDef(injectable, ctx) {
        let /** @type {?} */ providedIn = o.NULL_EXPR;
        if (injectable.providedIn !== undefined) {
            if (injectable.providedIn === null) {
                providedIn = o.NULL_EXPR;
            }
            else if (typeof injectable.providedIn === 'string') {
                providedIn = o.literal(injectable.providedIn);
            }
            else {
                providedIn = ctx.importExpr(injectable.providedIn);
            }
        }
        const /** @type {?} */ def = [
            mapEntry('factory', this.factoryFor(injectable, ctx)),
            mapEntry('token', ctx.importExpr(injectable.type.reference)),
            mapEntry('providedIn', providedIn),
        ];
        return o.importExpr(Identifiers.defineInjectable).callFn([o.literalMap(def)]);
    }
    /**
     * @param {?} injectable
     * @param {?} ctx
     * @return {?}
     */
    compile(injectable, ctx) {
        if (this.alwaysGenerateDef || injectable.providedIn !== undefined) {
            const /** @type {?} */ className = /** @type {?} */ ((identifierName(injectable.type)));
            const /** @type {?} */ clazz = new o.ClassStmt(className, null, [
                new o.ClassField('ngInjectableDef', o.INFERRED_TYPE, [o.StmtModifier.Static], this.injectableDef(injectable, ctx)),
            ], [], new o.ClassMethod(null, [], []), []);
            ctx.statements.push(clazz);
        }
    }
}
function InjectableCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    InjectableCompiler.prototype.tokenInjector;
    /** @type {?} */
    InjectableCompiler.prototype.reflector;
    /** @type {?} */
    InjectableCompiler.prototype.alwaysGenerateDef;
}
//# sourceMappingURL=injectable_compiler.js.map