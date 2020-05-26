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
        define("@angular/compiler/src/output/map_util", ["require", "exports", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mapLiteral = exports.mapEntry = void 0;
    var o = require("@angular/compiler/src/output/output_ast");
    function mapEntry(key, value) {
        return { key: key, value: value, quoted: false };
    }
    exports.mapEntry = mapEntry;
    function mapLiteral(obj, quoted) {
        if (quoted === void 0) { quoted = false; }
        return o.literalMap(Object.keys(obj).map(function (key) { return ({
            key: key,
            quoted: quoted,
            value: obj[key],
        }); }));
    }
    exports.mapLiteral = mapLiteral;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFwX3V0aWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvb3V0cHV0L21hcF91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJEQUFrQztJQVVsQyxTQUFnQixRQUFRLENBQUMsR0FBVyxFQUFFLEtBQW1CO1FBQ3ZELE9BQU8sRUFBQyxHQUFHLEtBQUEsRUFBRSxLQUFLLE9BQUEsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUM7SUFDckMsQ0FBQztJQUZELDRCQUVDO0lBRUQsU0FBZ0IsVUFBVSxDQUN0QixHQUFrQyxFQUFFLE1BQXVCO1FBQXZCLHVCQUFBLEVBQUEsY0FBdUI7UUFDN0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsQ0FBQztZQUNOLEdBQUcsS0FBQTtZQUNILE1BQU0sUUFBQTtZQUNOLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDO1NBQ2hCLENBQUMsRUFKSyxDQUlMLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFQRCxnQ0FPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuXG5leHBvcnQgdHlwZSBNYXBFbnRyeSA9IHtcbiAga2V5OiBzdHJpbmcsXG4gIHF1b3RlZDogYm9vbGVhbixcbiAgdmFsdWU6IG8uRXhwcmVzc2lvblxufTtcblxuZXhwb3J0IHR5cGUgTWFwTGl0ZXJhbCA9IE1hcEVudHJ5W107XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXBFbnRyeShrZXk6IHN0cmluZywgdmFsdWU6IG8uRXhwcmVzc2lvbik6IE1hcEVudHJ5IHtcbiAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcExpdGVyYWwoXG4gICAgb2JqOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSwgcXVvdGVkOiBib29sZWFuID0gZmFsc2UpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5saXRlcmFsTWFwKE9iamVjdC5rZXlzKG9iaikubWFwKGtleSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IG9ialtrZXldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG59XG4iXX0=