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
var /**
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
AstPath = /** @class */ (function () {
    function AstPath(path, position) {
        if (position === void 0) { position = -1; }
        this.path = path;
        this.position = position;
    }
    Object.defineProperty(AstPath.prototype, "empty", {
        get: /**
         * @return {?}
         */
        function () { return !this.path || !this.path.length; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AstPath.prototype, "head", {
        get: /**
         * @return {?}
         */
        function () { return this.path[0]; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AstPath.prototype, "tail", {
        get: /**
         * @return {?}
         */
        function () { return this.path[this.path.length - 1]; },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?} node
     * @return {?}
     */
    AstPath.prototype.parentOf = /**
     * @param {?} node
     * @return {?}
     */
    function (node) {
        return node && this.path[this.path.indexOf(node) - 1];
    };
    /**
     * @param {?} node
     * @return {?}
     */
    AstPath.prototype.childOf = /**
     * @param {?} node
     * @return {?}
     */
    function (node) { return this.path[this.path.indexOf(node) + 1]; };
    /**
     * @template N
     * @param {?} ctor
     * @return {?}
     */
    AstPath.prototype.first = /**
     * @template N
     * @param {?} ctor
     * @return {?}
     */
    function (ctor) {
        for (var /** @type {?} */ i = this.path.length - 1; i >= 0; i--) {
            var /** @type {?} */ item = this.path[i];
            if (item instanceof ctor)
                return /** @type {?} */ (item);
        }
    };
    /**
     * @param {?} node
     * @return {?}
     */
    AstPath.prototype.push = /**
     * @param {?} node
     * @return {?}
     */
    function (node) { this.path.push(node); };
    /**
     * @return {?}
     */
    AstPath.prototype.pop = /**
     * @return {?}
     */
    function () { return /** @type {?} */ ((this.path.pop())); };
    return AstPath;
}());
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
export { AstPath };
function AstPath_tsickle_Closure_declarations() {
    /** @type {?} */
    AstPath.prototype.path;
    /** @type {?} */
    AstPath.prototype.position;
}
//# sourceMappingURL=ast_path.js.map