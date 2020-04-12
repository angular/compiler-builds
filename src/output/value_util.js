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
        define("@angular/compiler/src/output/value_util", ["require", "exports", "@angular/compiler/src/util", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require("@angular/compiler/src/util");
    var o = require("@angular/compiler/src/output/output_ast");
    exports.QUOTED_KEYS = '$quoted$';
    function convertValueToOutputAst(ctx, value, type) {
        if (type === void 0) { type = null; }
        return util_1.visitValue(value, new _ValueOutputAstTransformer(ctx), type);
    }
    exports.convertValueToOutputAst = convertValueToOutputAst;
    var _ValueOutputAstTransformer = /** @class */ (function () {
        function _ValueOutputAstTransformer(ctx) {
            this.ctx = ctx;
        }
        _ValueOutputAstTransformer.prototype.visitArray = function (arr, type) {
            var values = [];
            // Note Array.map() must not be used to convert the values because it will
            // skip over empty elements in arrays constructed using `new Array(length)`,
            // resulting in `undefined` elements. This breaks the type guarantee that
            // all values in `o.LiteralArrayExpr` are of type `o.Expression`.
            // See test case in `value_util_spec.ts`.
            for (var i = 0; i < arr.length; ++i) {
                values.push(util_1.visitValue(arr[i], this, null /* context */));
            }
            return o.literalArr(values, type);
        };
        _ValueOutputAstTransformer.prototype.visitStringMap = function (map, type) {
            var _this = this;
            var entries = [];
            var quotedSet = new Set(map && map[exports.QUOTED_KEYS]);
            Object.keys(map).forEach(function (key) {
                entries.push(new o.LiteralMapEntry(key, util_1.visitValue(map[key], _this, null), quotedSet.has(key)));
            });
            return new o.LiteralMapExpr(entries, type);
        };
        _ValueOutputAstTransformer.prototype.visitPrimitive = function (value, type) { return o.literal(value, type); };
        _ValueOutputAstTransformer.prototype.visitOther = function (value, type) {
            if (value instanceof o.Expression) {
                return value;
            }
            else {
                return this.ctx.importExpr(value);
            }
        };
        return _ValueOutputAstTransformer;
    }());
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsdWVfdXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvdmFsdWVfdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUdILG1EQUFvRTtJQUVwRSwyREFBa0M7SUFFckIsUUFBQSxXQUFXLEdBQUcsVUFBVSxDQUFDO0lBRXRDLFNBQWdCLHVCQUF1QixDQUNuQyxHQUFrQixFQUFFLEtBQVUsRUFBRSxJQUEwQjtRQUExQixxQkFBQSxFQUFBLFdBQTBCO1FBQzVELE9BQU8saUJBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBSEQsMERBR0M7SUFFRDtRQUNFLG9DQUFvQixHQUFrQjtZQUFsQixRQUFHLEdBQUgsR0FBRyxDQUFlO1FBQUcsQ0FBQztRQUMxQywrQ0FBVSxHQUFWLFVBQVcsR0FBVSxFQUFFLElBQVk7WUFDakMsSUFBTSxNQUFNLEdBQW1CLEVBQUUsQ0FBQztZQUNsQywwRUFBMEU7WUFDMUUsNEVBQTRFO1lBQzVFLHlFQUF5RTtZQUN6RSxpRUFBaUU7WUFDakUseUNBQXlDO1lBQ3pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO2dCQUNuQyxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzthQUMzRDtZQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELG1EQUFjLEdBQWQsVUFBZSxHQUF5QixFQUFFLElBQWU7WUFBekQsaUJBUUM7WUFQQyxJQUFNLE9BQU8sR0FBd0IsRUFBRSxDQUFDO1lBQ3hDLElBQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsbUJBQVcsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHO2dCQUMxQixPQUFPLENBQUMsSUFBSSxDQUNSLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsaUJBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSSxFQUFFLElBQUksQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLENBQUMsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFFRCxtREFBYyxHQUFkLFVBQWUsS0FBVSxFQUFFLElBQVksSUFBa0IsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFekYsK0NBQVUsR0FBVixVQUFXLEtBQVUsRUFBRSxJQUFZO1lBQ2pDLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQyxVQUFVLEVBQUU7Z0JBQ2pDLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNuQztRQUNILENBQUM7UUFDSCxpQ0FBQztJQUFELENBQUMsQUFsQ0QsSUFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBWYWx1ZVRyYW5zZm9ybWVyLCB2aXNpdFZhbHVlfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuXG5leHBvcnQgY29uc3QgUVVPVEVEX0tFWVMgPSAnJHF1b3RlZCQnO1xuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFZhbHVlVG9PdXRwdXRBc3QoXG4gICAgY3R4OiBPdXRwdXRDb250ZXh0LCB2YWx1ZTogYW55LCB0eXBlOiBvLlR5cGUgfCBudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiB2aXNpdFZhbHVlKHZhbHVlLCBuZXcgX1ZhbHVlT3V0cHV0QXN0VHJhbnNmb3JtZXIoY3R4KSwgdHlwZSk7XG59XG5cbmNsYXNzIF9WYWx1ZU91dHB1dEFzdFRyYW5zZm9ybWVyIGltcGxlbWVudHMgVmFsdWVUcmFuc2Zvcm1lciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY3R4OiBPdXRwdXRDb250ZXh0KSB7fVxuICB2aXNpdEFycmF5KGFycjogYW55W10sIHR5cGU6IG8uVHlwZSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIC8vIE5vdGUgQXJyYXkubWFwKCkgbXVzdCBub3QgYmUgdXNlZCB0byBjb252ZXJ0IHRoZSB2YWx1ZXMgYmVjYXVzZSBpdCB3aWxsXG4gICAgLy8gc2tpcCBvdmVyIGVtcHR5IGVsZW1lbnRzIGluIGFycmF5cyBjb25zdHJ1Y3RlZCB1c2luZyBgbmV3IEFycmF5KGxlbmd0aClgLFxuICAgIC8vIHJlc3VsdGluZyBpbiBgdW5kZWZpbmVkYCBlbGVtZW50cy4gVGhpcyBicmVha3MgdGhlIHR5cGUgZ3VhcmFudGVlIHRoYXRcbiAgICAvLyBhbGwgdmFsdWVzIGluIGBvLkxpdGVyYWxBcnJheUV4cHJgIGFyZSBvZiB0eXBlIGBvLkV4cHJlc3Npb25gLlxuICAgIC8vIFNlZSB0ZXN0IGNhc2UgaW4gYHZhbHVlX3V0aWxfc3BlYy50c2AuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhbHVlcy5wdXNoKHZpc2l0VmFsdWUoYXJyW2ldLCB0aGlzLCBudWxsIC8qIGNvbnRleHQgKi8pKTtcbiAgICB9XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMsIHR5cGUpO1xuICB9XG5cbiAgdmlzaXRTdHJpbmdNYXAobWFwOiB7W2tleTogc3RyaW5nXTogYW55fSwgdHlwZTogby5NYXBUeXBlKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBlbnRyaWVzOiBvLkxpdGVyYWxNYXBFbnRyeVtdID0gW107XG4gICAgY29uc3QgcXVvdGVkU2V0ID0gbmV3IFNldDxzdHJpbmc+KG1hcCAmJiBtYXBbUVVPVEVEX0tFWVNdKTtcbiAgICBPYmplY3Qua2V5cyhtYXApLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGVudHJpZXMucHVzaChcbiAgICAgICAgICBuZXcgby5MaXRlcmFsTWFwRW50cnkoa2V5LCB2aXNpdFZhbHVlKG1hcFtrZXldLCB0aGlzLCBudWxsKSwgcXVvdGVkU2V0LmhhcyhrZXkpKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBvLkxpdGVyYWxNYXBFeHByKGVudHJpZXMsIHR5cGUpO1xuICB9XG5cbiAgdmlzaXRQcmltaXRpdmUodmFsdWU6IGFueSwgdHlwZTogby5UeXBlKTogby5FeHByZXNzaW9uIHsgcmV0dXJuIG8ubGl0ZXJhbCh2YWx1ZSwgdHlwZSk7IH1cblxuICB2aXNpdE90aGVyKHZhbHVlOiBhbnksIHR5cGU6IG8uVHlwZSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2Ygby5FeHByZXNzaW9uKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmN0eC5pbXBvcnRFeHByKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==