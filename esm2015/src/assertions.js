/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export function assertArrayOfStrings(identifier, value) {
    if (value == null) {
        return;
    }
    if (!Array.isArray(value)) {
        throw new Error(`Expected '${identifier}' to be an array of strings.`);
    }
    for (let i = 0; i < value.length; i += 1) {
        if (typeof value[i] !== 'string') {
            throw new Error(`Expected '${identifier}' to be an array of strings.`);
        }
    }
}
const UNUSABLE_INTERPOLATION_REGEXPS = [
    /^\s*$/,
    /[<>]/,
    /^[{}]$/,
    /&(#|[a-z])/i,
    /^\/\//,
];
export function assertInterpolationSymbols(identifier, value) {
    if (value != null && !(Array.isArray(value) && value.length == 2)) {
        throw new Error(`Expected '${identifier}' to be an array, [start, end].`);
    }
    else if (value != null) {
        const start = value[0];
        const end = value[1];
        // Check for unusable interpolation symbols
        UNUSABLE_INTERPOLATION_REGEXPS.forEach(regexp => {
            if (regexp.test(start) || regexp.test(end)) {
                throw new Error(`['${start}', '${end}'] contains unusable interpolation symbol.`);
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hc3NlcnRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxVQUFrQixFQUFFLEtBQVU7SUFDakUsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO1FBQ2pCLE9BQU87S0FDUjtJQUNELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxVQUFVLDhCQUE4QixDQUFDLENBQUM7S0FDeEU7SUFDRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3hDLElBQUksT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxFQUFFO1lBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxVQUFVLDhCQUE4QixDQUFDLENBQUM7U0FDeEU7S0FDRjtBQUNILENBQUM7QUFFRCxNQUFNLDhCQUE4QixHQUFHO0lBQ3JDLE9BQU87SUFDUCxNQUFNO0lBQ04sUUFBUTtJQUNSLGFBQWE7SUFDYixPQUFPO0NBQ1IsQ0FBQztBQUVGLE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxVQUFrQixFQUFFLEtBQVU7SUFDdkUsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLEVBQUU7UUFDakUsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLFVBQVUsaUNBQWlDLENBQUMsQ0FBQztLQUMzRTtTQUFNLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtRQUN4QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFXLENBQUM7UUFDakMsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBVyxDQUFDO1FBQy9CLDJDQUEyQztRQUMzQyw4QkFBOEIsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDOUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzFDLE1BQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQU8sR0FBRyw0Q0FBNEMsQ0FBQyxDQUFDO2FBQ25GO1FBQ0gsQ0FBQyxDQUFDLENBQUM7S0FDSjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBcnJheU9mU3RyaW5ncyhpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7aWRlbnRpZmllcn0nIHRvIGJlIGFuIGFycmF5IG9mIHN0cmluZ3MuYCk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke2lkZW50aWZpZXJ9JyB0byBiZSBhbiBhcnJheSBvZiBzdHJpbmdzLmApO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCBVTlVTQUJMRV9JTlRFUlBPTEFUSU9OX1JFR0VYUFMgPSBbXG4gIC9eXFxzKiQvLCAgICAgICAgLy8gZW1wdHlcbiAgL1s8Pl0vLCAgICAgICAgIC8vIGh0bWwgdGFnXG4gIC9eW3t9XSQvLCAgICAgICAvLyBpMThuIGV4cGFuc2lvblxuICAvJigjfFthLXpdKS9pLCAgLy8gY2hhcmFjdGVyIHJlZmVyZW5jZSxcbiAgL15cXC9cXC8vLCAgICAgICAgLy8gY29tbWVudFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEludGVycG9sYXRpb25TeW1ib2xzKGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuICBpZiAodmFsdWUgIT0gbnVsbCAmJiAhKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PSAyKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7aWRlbnRpZmllcn0nIHRvIGJlIGFuIGFycmF5LCBbc3RhcnQsIGVuZF0uYCk7XG4gIH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHN0YXJ0ID0gdmFsdWVbMF0gYXMgc3RyaW5nO1xuICAgIGNvbnN0IGVuZCA9IHZhbHVlWzFdIGFzIHN0cmluZztcbiAgICAvLyBDaGVjayBmb3IgdW51c2FibGUgaW50ZXJwb2xhdGlvbiBzeW1ib2xzXG4gICAgVU5VU0FCTEVfSU5URVJQT0xBVElPTl9SRUdFWFBTLmZvckVhY2gocmVnZXhwID0+IHtcbiAgICAgIGlmIChyZWdleHAudGVzdChzdGFydCkgfHwgcmVnZXhwLnRlc3QoZW5kKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFsnJHtzdGFydH0nLCAnJHtlbmR9J10gY29udGFpbnMgdW51c2FibGUgaW50ZXJwb2xhdGlvbiBzeW1ib2wuYCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==