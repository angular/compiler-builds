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
/**
 * A path is an ordered set of elements. Typically a path is to  a
 * particular offset in a source file. The head of the list is the top
 * most node. The tail is the node that contains the offset directly.
 *
 * For example, the expression `a + b + c` might have an ast that looks
 * like:
 *     +
 *    / \
 *   a   +
 *      / \
 *     b   c
 *
 * The path to the node at offset 9 would be `['+' at 1-10, '+' at 7-10,
 * 'c' at 9-10]` and the path the node at offset 1 would be
 * `['+' at 1-10, 'a' at 1-2]`.
 * @template T
 */
export class AstPath {
    /**
     * @param {?} path
     * @param {?=} position
     */
    constructor(path, position = -1) {
        this.path = path;
        this.position = position;
    }
    /**
     * @return {?}
     */
    get empty() { return !this.path || !this.path.length; }
    /**
     * @return {?}
     */
    get head() { return this.path[0]; }
    /**
     * @return {?}
     */
    get tail() { return this.path[this.path.length - 1]; }
    /**
     * @param {?} node
     * @return {?}
     */
    parentOf(node) {
        return node && this.path[this.path.indexOf(node) - 1];
    }
    /**
     * @param {?} node
     * @return {?}
     */
    childOf(node) { return this.path[this.path.indexOf(node) + 1]; }
    /**
     * @template N
     * @param {?} ctor
     * @return {?}
     */
    first(ctor) {
        for (let /** @type {?} */ i = this.path.length - 1; i >= 0; i--) {
            let /** @type {?} */ item = this.path[i];
            if (item instanceof ctor)
                return /** @type {?} */ (item);
        }
    }
    /**
     * @param {?} node
     * @return {?}
     */
    push(node) { this.path.push(node); }
    /**
     * @return {?}
     */
    pop() { return /** @type {?} */ ((this.path.pop())); }
}
function AstPath_tsickle_Closure_declarations() {
    /** @type {?} */
    AstPath.prototype.path;
    /** @type {?} */
    AstPath.prototype.position;
}
//# sourceMappingURL=ast_path.js.map