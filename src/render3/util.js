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
        define("@angular/compiler/src/render3/util", ["require", "exports", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var o = require("@angular/compiler/src/output/output_ast");
    /**
     * Convert an object map with `Expression` values into a `LiteralMapExpr`.
     */
    function mapToMapExpression(map) {
        var result = Object.keys(map).map(function (key) { return ({ key: key, value: map[key], quoted: false }); });
        return o.literalMap(result);
    }
    exports.mapToMapExpression = mapToMapExpression;
    /**
     * Convert metadata into an `Expression` in the given `OutputContext`.
     *
     * This operation will handle arrays, references to symbols, or literal `null` or `undefined`.
     */
    function convertMetaToOutput(meta, ctx) {
        if (Array.isArray(meta)) {
            return o.literalArr(meta.map(function (entry) { return convertMetaToOutput(entry, ctx); }));
        }
        if (meta instanceof static_symbol_1.StaticSymbol) {
            return ctx.importExpr(meta);
        }
        if (meta == null) {
            return o.literal(meta);
        }
        throw new Error("Internal error: Unsupported or unknown metadata: " + meta);
    }
    exports.convertMetaToOutput = convertMetaToOutput;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3V0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCx5RUFBa0Q7SUFDbEQsMkRBQTBDO0lBRzFDOztPQUVHO0lBQ0gsNEJBQW1DLEdBQWtDO1FBQ25FLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsQ0FBQyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLEVBQXZDLENBQXVDLENBQUMsQ0FBQztRQUNwRixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUhELGdEQUdDO0lBRUQ7Ozs7T0FJRztJQUNILDZCQUFvQyxJQUFTLEVBQUUsR0FBa0I7UUFDL0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsbUJBQW1CLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUEvQixDQUErQixDQUFDLENBQUMsQ0FBQztTQUN6RTtRQUNELElBQUksSUFBSSxZQUFZLDRCQUFZLEVBQUU7WUFDaEMsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzdCO1FBQ0QsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2hCLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4QjtRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQW9ELElBQU0sQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFaRCxrREFZQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi91dGlsJztcblxuLyoqXG4gKiBDb252ZXJ0IGFuIG9iamVjdCBtYXAgd2l0aCBgRXhwcmVzc2lvbmAgdmFsdWVzIGludG8gYSBgTGl0ZXJhbE1hcEV4cHJgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFwVG9NYXBFeHByZXNzaW9uKG1hcDoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgcmVzdWx0ID0gT2JqZWN0LmtleXMobWFwKS5tYXAoa2V5ID0+ICh7a2V5LCB2YWx1ZTogbWFwW2tleV0sIHF1b3RlZDogZmFsc2V9KSk7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAocmVzdWx0KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IG1ldGFkYXRhIGludG8gYW4gYEV4cHJlc3Npb25gIGluIHRoZSBnaXZlbiBgT3V0cHV0Q29udGV4dGAuXG4gKlxuICogVGhpcyBvcGVyYXRpb24gd2lsbCBoYW5kbGUgYXJyYXlzLCByZWZlcmVuY2VzIHRvIHN5bWJvbHMsIG9yIGxpdGVyYWwgYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydE1ldGFUb091dHB1dChtZXRhOiBhbnksIGN0eDogT3V0cHV0Q29udGV4dCk6IG8uRXhwcmVzc2lvbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KG1ldGEpKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycihtZXRhLm1hcChlbnRyeSA9PiBjb252ZXJ0TWV0YVRvT3V0cHV0KGVudHJ5LCBjdHgpKSk7XG4gIH1cbiAgaWYgKG1ldGEgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICByZXR1cm4gY3R4LmltcG9ydEV4cHIobWV0YSk7XG4gIH1cbiAgaWYgKG1ldGEgPT0gbnVsbCkge1xuICAgIHJldHVybiBvLmxpdGVyYWwobWV0YSk7XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIGVycm9yOiBVbnN1cHBvcnRlZCBvciB1bmtub3duIG1ldGFkYXRhOiAke21ldGF9YCk7XG59XG4iXX0=