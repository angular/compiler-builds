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
        define("@angular/compiler/src/assertions", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assertInterpolationSymbols = exports.assertArrayOfStrings = void 0;
    function assertArrayOfStrings(identifier, value) {
        if (value == null) {
            return;
        }
        if (!Array.isArray(value)) {
            throw new Error("Expected '" + identifier + "' to be an array of strings.");
        }
        for (var i = 0; i < value.length; i += 1) {
            if (typeof value[i] !== 'string') {
                throw new Error("Expected '" + identifier + "' to be an array of strings.");
            }
        }
    }
    exports.assertArrayOfStrings = assertArrayOfStrings;
    var UNUSABLE_INTERPOLATION_REGEXPS = [
        /^\s*$/,
        /[<>]/,
        /^[{}]$/,
        /&(#|[a-z])/i,
        /^\/\//,
    ];
    function assertInterpolationSymbols(identifier, value) {
        if (value != null && !(Array.isArray(value) && value.length == 2)) {
            throw new Error("Expected '" + identifier + "' to be an array, [start, end].");
        }
        else if (value != null) {
            var start_1 = value[0];
            var end_1 = value[1];
            // Check for unusable interpolation symbols
            UNUSABLE_INTERPOLATION_REGEXPS.forEach(function (regexp) {
                if (regexp.test(start_1) || regexp.test(end_1)) {
                    throw new Error("['" + start_1 + "', '" + end_1 + "'] contains unusable interpolation symbol.");
                }
            });
        }
    }
    exports.assertInterpolationSymbols = assertInterpolationSymbols;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hc3NlcnRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILFNBQWdCLG9CQUFvQixDQUFDLFVBQWtCLEVBQUUsS0FBVTtRQUNqRSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7WUFDakIsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFhLFVBQVUsaUNBQThCLENBQUMsQ0FBQztTQUN4RTtRQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEMsSUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUU7Z0JBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBYSxVQUFVLGlDQUE4QixDQUFDLENBQUM7YUFDeEU7U0FDRjtJQUNILENBQUM7SUFaRCxvREFZQztJQUVELElBQU0sOEJBQThCLEdBQUc7UUFDckMsT0FBTztRQUNQLE1BQU07UUFDTixRQUFRO1FBQ1IsYUFBYTtRQUNiLE9BQU87S0FDUixDQUFDO0lBRUYsU0FBZ0IsMEJBQTBCLENBQUMsVUFBa0IsRUFBRSxLQUFVO1FBQ3ZFLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxFQUFFO1lBQ2pFLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBYSxVQUFVLG9DQUFpQyxDQUFDLENBQUM7U0FDM0U7YUFBTSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7WUFDeEIsSUFBTSxPQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBVyxDQUFDO1lBQ2pDLElBQU0sS0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQVcsQ0FBQztZQUMvQiwyQ0FBMkM7WUFDM0MsOEJBQThCLENBQUMsT0FBTyxDQUFDLFVBQUEsTUFBTTtnQkFDM0MsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBRyxDQUFDLEVBQUU7b0JBQzFDLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBSyxPQUFLLFlBQU8sS0FBRywrQ0FBNEMsQ0FBQyxDQUFDO2lCQUNuRjtZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0lBYkQsZ0VBYUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBcnJheU9mU3RyaW5ncyhpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7aWRlbnRpZmllcn0nIHRvIGJlIGFuIGFycmF5IG9mIHN0cmluZ3MuYCk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke2lkZW50aWZpZXJ9JyB0byBiZSBhbiBhcnJheSBvZiBzdHJpbmdzLmApO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCBVTlVTQUJMRV9JTlRFUlBPTEFUSU9OX1JFR0VYUFMgPSBbXG4gIC9eXFxzKiQvLCAgICAgICAgLy8gZW1wdHlcbiAgL1s8Pl0vLCAgICAgICAgIC8vIGh0bWwgdGFnXG4gIC9eW3t9XSQvLCAgICAgICAvLyBpMThuIGV4cGFuc2lvblxuICAvJigjfFthLXpdKS9pLCAgLy8gY2hhcmFjdGVyIHJlZmVyZW5jZSxcbiAgL15cXC9cXC8vLCAgICAgICAgLy8gY29tbWVudFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEludGVycG9sYXRpb25TeW1ib2xzKGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuICBpZiAodmFsdWUgIT0gbnVsbCAmJiAhKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PSAyKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7aWRlbnRpZmllcn0nIHRvIGJlIGFuIGFycmF5LCBbc3RhcnQsIGVuZF0uYCk7XG4gIH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHN0YXJ0ID0gdmFsdWVbMF0gYXMgc3RyaW5nO1xuICAgIGNvbnN0IGVuZCA9IHZhbHVlWzFdIGFzIHN0cmluZztcbiAgICAvLyBDaGVjayBmb3IgdW51c2FibGUgaW50ZXJwb2xhdGlvbiBzeW1ib2xzXG4gICAgVU5VU0FCTEVfSU5URVJQT0xBVElPTl9SRUdFWFBTLmZvckVhY2gocmVnZXhwID0+IHtcbiAgICAgIGlmIChyZWdleHAudGVzdChzdGFydCkgfHwgcmVnZXhwLnRlc3QoZW5kKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFsnJHtzdGFydH0nLCAnJHtlbmR9J10gY29udGFpbnMgdW51c2FibGUgaW50ZXJwb2xhdGlvbiBzeW1ib2wuYCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==