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
import { identifierName } from '../compile_metadata';
import * as o from '../output/output_ast';
import { error } from '../util';
import { Identifiers as R3 } from './r3_identifiers';
import { createFactory } from './r3_view_compiler_local';
/**
 * Write a pipe definition to the output context.
 * @param {?} outputCtx
 * @param {?} pipe
 * @param {?} reflector
 * @return {?}
 */
export function compilePipe(outputCtx, pipe, reflector) {
    const /** @type {?} */ definitionMapValues = [];
    // e.g. `name: 'myPipe'`
    definitionMapValues.push({ key: 'name', value: o.literal(pipe.name), quoted: false });
    // e.g. `type: MyPipe`
    definitionMapValues.push({ key: 'type', value: outputCtx.importExpr(pipe.type.reference), quoted: false });
    // e.g. `factory: function MyPipe_Factory() { return new MyPipe(); }`
    const /** @type {?} */ templateFactory = createFactory(pipe.type, outputCtx, reflector, []);
    definitionMapValues.push({ key: 'factory', value: templateFactory, quoted: false });
    // e.g. `pure: true`
    if (pipe.pure) {
        definitionMapValues.push({ key: 'pure', value: o.literal(true), quoted: false });
    }
    const /** @type {?} */ className = /** @type {?} */ ((identifierName(pipe.type)));
    className || error(`Cannot resolve the name of ${pipe.type}`);
    const /** @type {?} */ definitionField = outputCtx.constantPool.propertyNameOf(3 /* Pipe */);
    const /** @type {?} */ definitionFunction = o.importExpr(R3.definePipe).callFn([o.literalMap(definitionMapValues)]);
    outputCtx.statements.push(new o.ClassStmt(className, null, /* fields */ [new o.ClassField(definitionField, /* type */ o.INFERRED_TYPE, /* modifiers */ [o.StmtModifier.Static], definitionFunction)], /* getters */ [], /* constructorMethod */ new o.ClassMethod(null, [], []), /* methods */ []));
}
//# sourceMappingURL=r3_pipe_compiler.js.map