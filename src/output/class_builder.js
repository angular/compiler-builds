/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from './output_ast';
/**
 * Create a new class stmts based on the given data.
 * @param {?} config
 * @return {?}
 */
export function createClassStmt(config) {
    const /** @type {?} */ parentArgs = config.parentArgs || [];
    const /** @type {?} */ superCtorStmts = config.parent ? [o.SUPER_EXPR.callFn(parentArgs).toStmt()] : [];
    const /** @type {?} */ builder = concatClassBuilderParts(Array.isArray(config.builders) ? config.builders : [config.builders]);
    const /** @type {?} */ ctor = new o.ClassMethod(null, config.ctorParams || [], superCtorStmts.concat(builder.ctorStmts));
    return new o.ClassStmt(config.name, config.parent, builder.fields, builder.getters, ctor, builder.methods, config.modifiers || []);
}
/**
 * @param {?} builders
 * @return {?}
 */
function concatClassBuilderParts(builders) {
    return {
        fields: [].concat(...builders.map(builder => builder.fields || [])),
        methods: [].concat(...builders.map(builder => builder.methods || [])),
        getters: [].concat(...builders.map(builder => builder.getters || [])),
        ctorStmts: [].concat(...builders.map(builder => builder.ctorStmts || [])),
    };
}
//# sourceMappingURL=class_builder.js.map