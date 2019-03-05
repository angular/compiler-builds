(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/testing/src/testing.ngfactory", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @license
     * Copyright Google Inc. All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    /**
     * @module
     * @description
     * Entry point for all APIs of the compiler package.
     *
     * <div class="callout is-critical">
     *   <header>Unstable APIs</header>
     *   <p>
     *     All compiler apis are currently considered experimental and private!
     *   </p>
     *   <p>
     *     We expect the APIs in this package to keep on changing. Do not rely on them.
     *   </p>
     * </div>
     */
    exports.ɵNonEmptyModule = true;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZy5uZ2ZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy90ZXN0aW5nLm5nZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUVIOzs7Ozs7Ozs7Ozs7OztPQWNHO0lBRVUsUUFBQSxlQUFlLEdBQUcsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIEBtb2R1bGVcbiAqIEBkZXNjcmlwdGlvblxuICogRW50cnkgcG9pbnQgZm9yIGFsbCBBUElzIG9mIHRoZSBjb21waWxlciBwYWNrYWdlLlxuICpcbiAqIDxkaXYgY2xhc3M9XCJjYWxsb3V0IGlzLWNyaXRpY2FsXCI+XG4gKiAgIDxoZWFkZXI+VW5zdGFibGUgQVBJczwvaGVhZGVyPlxuICogICA8cD5cbiAqICAgICBBbGwgY29tcGlsZXIgYXBpcyBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsIGFuZCBwcml2YXRlIVxuICogICA8L3A+XG4gKiAgIDxwPlxuICogICAgIFdlIGV4cGVjdCB0aGUgQVBJcyBpbiB0aGlzIHBhY2thZ2UgdG8ga2VlcCBvbiBjaGFuZ2luZy4gRG8gbm90IHJlbHkgb24gdGhlbS5cbiAqICAgPC9wPlxuICogPC9kaXY+XG4gKi9cblxuZXhwb3J0IGNvbnN0IMm1Tm9uRW1wdHlNb2R1bGUgPSB0cnVlOyJdfQ==