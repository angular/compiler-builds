/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/r3_types", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BUILD_OPTIMIZER_REMOVE = exports.BUILD_OPTIMIZER_COLOCATE = void 0;
    /**
     * Comment to insert above back-patch
     */
    exports.BUILD_OPTIMIZER_COLOCATE = '@__BUILD_OPTIMIZER_COLOCATE__';
    /**
     * Comment to mark removable expressions
     */
    exports.BUILD_OPTIMIZER_REMOVE = '@__BUILD_OPTIMIZER_REMOVE__';
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM190eXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSDs7T0FFRztJQUNVLFFBQUEsd0JBQXdCLEdBQUcsK0JBQStCLENBQUM7SUFFeEU7O09BRUc7SUFDVSxRQUFBLHNCQUFzQixHQUFHLDZCQUE2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIENvbW1lbnQgdG8gaW5zZXJ0IGFib3ZlIGJhY2stcGF0Y2hcbiAqL1xuZXhwb3J0IGNvbnN0IEJVSUxEX09QVElNSVpFUl9DT0xPQ0FURSA9ICdAX19CVUlMRF9PUFRJTUlaRVJfQ09MT0NBVEVfXyc7XG5cbi8qKlxuICogQ29tbWVudCB0byBtYXJrIHJlbW92YWJsZSBleHByZXNzaW9uc1xuICovXG5leHBvcnQgY29uc3QgQlVJTERfT1BUSU1JWkVSX1JFTU9WRSA9ICdAX19CVUlMRF9PUFRJTUlaRVJfUkVNT1ZFX18nO1xuIl19