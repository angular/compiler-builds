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
    var /** @type {?} */ parentArgs = config.parentArgs || [];
    var /** @type {?} */ superCtorStmts = config.parent ? [o.SUPER_EXPR.callFn(parentArgs).toStmt()] : [];
    var /** @type {?} */ builder = concatClassBuilderParts(Array.isArray(config.builders) ? config.builders : [config.builders]);
    var /** @type {?} */ ctor = new o.ClassMethod(null, config.ctorParams || [], superCtorStmts.concat(builder.ctorStmts));
    return new o.ClassStmt(config.name, config.parent, builder.fields, builder.getters, ctor, builder.methods, config.modifiers || [], config.sourceSpan);
}
/**
 * @param {?} builders
 * @return {?}
 */
function concatClassBuilderParts(builders) {
    return {
        fields: [].concat.apply([], builders.map(function (builder) { return builder.fields || []; })),
        methods: [].concat.apply([], builders.map(function (builder) { return builder.methods || []; })),
        getters: [].concat.apply([], builders.map(function (builder) { return builder.getters || []; })),
        ctorStmts: [].concat.apply([], builders.map(function (builder) { return builder.ctorStmts || []; })),
    };
}
//# sourceMappingURL=class_builder.js.map