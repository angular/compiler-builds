/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { visitValue } from '../util';
import * as o from './output_ast';
export var QUOTED_KEYS = '$quoted$';
export function convertValueToOutputAst(ctx, value, type) {
    if (type === void 0) { type = null; }
    return visitValue(value, new _ValueOutputAstTransformer(ctx), type);
}
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
            values.push(visitValue(arr[i], this, null /* context */));
        }
        return o.literalArr(values, type);
    };
    _ValueOutputAstTransformer.prototype.visitStringMap = function (map, type) {
        var _this = this;
        var entries = [];
        var quotedSet = new Set(map && map[QUOTED_KEYS]);
        Object.keys(map).forEach(function (key) {
            entries.push(new o.LiteralMapEntry(key, visitValue(map[key], _this, null), quotedSet.has(key)));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsdWVfdXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvdmFsdWVfdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQWtDLFVBQVUsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwRSxPQUFPLEtBQUssQ0FBQyxNQUFNLGNBQWMsQ0FBQztBQUVsQyxNQUFNLENBQUMsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDO0FBRXRDLE1BQU0sVUFBVSx1QkFBdUIsQ0FDbkMsR0FBa0IsRUFBRSxLQUFVLEVBQUUsSUFBMEI7SUFBMUIscUJBQUEsRUFBQSxXQUEwQjtJQUM1RCxPQUFPLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN0RSxDQUFDO0FBRUQ7SUFDRSxvQ0FBb0IsR0FBa0I7UUFBbEIsUUFBRyxHQUFILEdBQUcsQ0FBZTtJQUFHLENBQUM7SUFDMUMsK0NBQVUsR0FBVixVQUFXLEdBQVUsRUFBRSxJQUFZO1FBQ2pDLElBQU0sTUFBTSxHQUFtQixFQUFFLENBQUM7UUFDbEMsMEVBQTBFO1FBQzFFLDRFQUE0RTtRQUM1RSx5RUFBeUU7UUFDekUsaUVBQWlFO1FBQ2pFLHlDQUF5QztRQUN6QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUNuQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQzNEO1FBQ0QsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsbURBQWMsR0FBZCxVQUFlLEdBQXlCLEVBQUUsSUFBZTtRQUF6RCxpQkFRQztRQVBDLElBQU0sT0FBTyxHQUF3QixFQUFFLENBQUM7UUFDeEMsSUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzNELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRztZQUMxQixPQUFPLENBQUMsSUFBSSxDQUNSLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELG1EQUFjLEdBQWQsVUFBZSxLQUFVLEVBQUUsSUFBWSxJQUFrQixPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6RiwrQ0FBVSxHQUFWLFVBQVcsS0FBVSxFQUFFLElBQVk7UUFDakMsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLFVBQVUsRUFBRTtZQUNqQyxPQUFPLEtBQUssQ0FBQztTQUNkO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ25DO0lBQ0gsQ0FBQztJQUNILGlDQUFDO0FBQUQsQ0FBQyxBQWxDRCxJQWtDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge091dHB1dENvbnRleHQsIFZhbHVlVHJhbnNmb3JtZXIsIHZpc2l0VmFsdWV9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5cbmV4cG9ydCBjb25zdCBRVU9URURfS0VZUyA9ICckcXVvdGVkJCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0VmFsdWVUb091dHB1dEFzdChcbiAgICBjdHg6IE91dHB1dENvbnRleHQsIHZhbHVlOiBhbnksIHR5cGU6IG8uVHlwZSB8IG51bGwgPSBudWxsKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIHZpc2l0VmFsdWUodmFsdWUsIG5ldyBfVmFsdWVPdXRwdXRBc3RUcmFuc2Zvcm1lcihjdHgpLCB0eXBlKTtcbn1cblxuY2xhc3MgX1ZhbHVlT3V0cHV0QXN0VHJhbnNmb3JtZXIgaW1wbGVtZW50cyBWYWx1ZVRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjdHg6IE91dHB1dENvbnRleHQpIHt9XG4gIHZpc2l0QXJyYXkoYXJyOiBhbnlbXSwgdHlwZTogby5UeXBlKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgLy8gTm90ZSBBcnJheS5tYXAoKSBtdXN0IG5vdCBiZSB1c2VkIHRvIGNvbnZlcnQgdGhlIHZhbHVlcyBiZWNhdXNlIGl0IHdpbGxcbiAgICAvLyBza2lwIG92ZXIgZW1wdHkgZWxlbWVudHMgaW4gYXJyYXlzIGNvbnN0cnVjdGVkIHVzaW5nIGBuZXcgQXJyYXkobGVuZ3RoKWAsXG4gICAgLy8gcmVzdWx0aW5nIGluIGB1bmRlZmluZWRgIGVsZW1lbnRzLiBUaGlzIGJyZWFrcyB0aGUgdHlwZSBndWFyYW50ZWUgdGhhdFxuICAgIC8vIGFsbCB2YWx1ZXMgaW4gYG8uTGl0ZXJhbEFycmF5RXhwcmAgYXJlIG9mIHR5cGUgYG8uRXhwcmVzc2lvbmAuXG4gICAgLy8gU2VlIHRlc3QgY2FzZSBpbiBgdmFsdWVfdXRpbF9zcGVjLnRzYC5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuICAgICAgdmFsdWVzLnB1c2godmlzaXRWYWx1ZShhcnJbaV0sIHRoaXMsIG51bGwgLyogY29udGV4dCAqLykpO1xuICAgIH1cbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlcywgdHlwZSk7XG4gIH1cblxuICB2aXNpdFN0cmluZ01hcChtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCB0eXBlOiBvLk1hcFR5cGUpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGVudHJpZXM6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgICBjb25zdCBxdW90ZWRTZXQgPSBuZXcgU2V0PHN0cmluZz4obWFwICYmIG1hcFtRVU9URURfS0VZU10pO1xuICAgIE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgZW50cmllcy5wdXNoKFxuICAgICAgICAgIG5ldyBvLkxpdGVyYWxNYXBFbnRyeShrZXksIHZpc2l0VmFsdWUobWFwW2tleV0sIHRoaXMsIG51bGwpLCBxdW90ZWRTZXQuaGFzKGtleSkpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IG8uTGl0ZXJhbE1hcEV4cHIoZW50cmllcywgdHlwZSk7XG4gIH1cblxuICB2aXNpdFByaW1pdGl2ZSh2YWx1ZTogYW55LCB0eXBlOiBvLlR5cGUpOiBvLkV4cHJlc3Npb24geyByZXR1cm4gby5saXRlcmFsKHZhbHVlLCB0eXBlKTsgfVxuXG4gIHZpc2l0T3RoZXIodmFsdWU6IGFueSwgdHlwZTogby5UeXBlKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb24pIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuY3R4LmltcG9ydEV4cHIodmFsdWUpO1xuICAgIH1cbiAgfVxufVxuIl19