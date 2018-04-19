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
import { StaticSymbol } from '../aot/static_symbol';
import { identifierName } from '../compile_metadata';
import { mapLiteral } from '../output/map_util';
import * as o from '../output/output_ast';
import { Identifiers as R3 } from './r3_identifiers';
/**
 * @param {?} meta
 * @param {?} ctx
 * @return {?}
 */
function convertMetaToOutput(meta, ctx) {
    if (Array.isArray(meta)) {
        return o.literalArr(meta.map(function (entry) { return convertMetaToOutput(entry, ctx); }));
    }
    if (meta instanceof StaticSymbol) {
        return ctx.importExpr(meta);
    }
    if (meta == null) {
        return o.literal(meta);
    }
    throw new Error("Internal error: Unsupported or unknown metadata: " + meta);
}
/**
 * @param {?} ctx
 * @param {?} ngModule
 * @param {?} injectableCompiler
 * @return {?}
 */
export function compileNgModule(ctx, ngModule, injectableCompiler) {
    var /** @type {?} */ className = /** @type {?} */ ((identifierName(ngModule.type)));
    var /** @type {?} */ rawImports = ngModule.rawImports ? [ngModule.rawImports] : [];
    var /** @type {?} */ rawExports = ngModule.rawExports ? [ngModule.rawExports] : [];
    var /** @type {?} */ injectorDefArg = mapLiteral({
        'factory': injectableCompiler.factoryFor({ type: ngModule.type, symbol: ngModule.type.reference }, ctx),
        'providers': convertMetaToOutput(ngModule.rawProviders, ctx),
        'imports': convertMetaToOutput(rawImports.concat(rawExports), ctx),
    });
    var /** @type {?} */ injectorDef = o.importExpr(R3.defineInjector).callFn([injectorDefArg]);
    ctx.statements.push(new o.ClassStmt(className, null, /* fields */ [new o.ClassField('ngInjectorDef', /* type */ o.INFERRED_TYPE, /* modifiers */ [o.StmtModifier.Static], injectorDef)], /* getters */ [], /* constructorMethod */ new o.ClassMethod(null, [], []), /* methods */ []));
}
//# sourceMappingURL=r3_module_compiler.js.map