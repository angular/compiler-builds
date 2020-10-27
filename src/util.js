/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/util", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.partitionArray = exports.newArray = exports.global = exports.Version = exports.isPromise = exports.resolveForwardRef = exports.stringify = exports.utf8Encode = exports.escapeRegExp = exports.getParseErrors = exports.isSyntaxError = exports.syntaxError = exports.error = exports.SyncAsync = exports.ValueTransformer = exports.noUndefined = exports.isDefined = exports.visitValue = exports.splitAtPeriod = exports.splitAtColon = exports.dashCaseToCamelCase = void 0;
    var tslib_1 = require("tslib");
    var DASH_CASE_REGEXP = /-+([a-z0-9])/g;
    function dashCaseToCamelCase(input) {
        return input.replace(DASH_CASE_REGEXP, function () {
            var m = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                m[_i] = arguments[_i];
            }
            return m[1].toUpperCase();
        });
    }
    exports.dashCaseToCamelCase = dashCaseToCamelCase;
    function splitAtColon(input, defaultValues) {
        return _splitAt(input, ':', defaultValues);
    }
    exports.splitAtColon = splitAtColon;
    function splitAtPeriod(input, defaultValues) {
        return _splitAt(input, '.', defaultValues);
    }
    exports.splitAtPeriod = splitAtPeriod;
    function _splitAt(input, character, defaultValues) {
        var characterIndex = input.indexOf(character);
        if (characterIndex == -1)
            return defaultValues;
        return [input.slice(0, characterIndex).trim(), input.slice(characterIndex + 1).trim()];
    }
    function visitValue(value, visitor, context) {
        if (Array.isArray(value)) {
            return visitor.visitArray(value, context);
        }
        if (isStrictStringMap(value)) {
            return visitor.visitStringMap(value, context);
        }
        if (value == null || typeof value == 'string' || typeof value == 'number' ||
            typeof value == 'boolean') {
            return visitor.visitPrimitive(value, context);
        }
        return visitor.visitOther(value, context);
    }
    exports.visitValue = visitValue;
    function isDefined(val) {
        return val !== null && val !== undefined;
    }
    exports.isDefined = isDefined;
    function noUndefined(val) {
        return val === undefined ? null : val;
    }
    exports.noUndefined = noUndefined;
    var ValueTransformer = /** @class */ (function () {
        function ValueTransformer() {
        }
        ValueTransformer.prototype.visitArray = function (arr, context) {
            var _this = this;
            return arr.map(function (value) { return visitValue(value, _this, context); });
        };
        ValueTransformer.prototype.visitStringMap = function (map, context) {
            var _this = this;
            var result = {};
            Object.keys(map).forEach(function (key) {
                result[key] = visitValue(map[key], _this, context);
            });
            return result;
        };
        ValueTransformer.prototype.visitPrimitive = function (value, context) {
            return value;
        };
        ValueTransformer.prototype.visitOther = function (value, context) {
            return value;
        };
        return ValueTransformer;
    }());
    exports.ValueTransformer = ValueTransformer;
    exports.SyncAsync = {
        assertSync: function (value) {
            if (isPromise(value)) {
                throw new Error("Illegal state: value cannot be a promise");
            }
            return value;
        },
        then: function (value, cb) {
            return isPromise(value) ? value.then(cb) : cb(value);
        },
        all: function (syncAsyncValues) {
            return syncAsyncValues.some(isPromise) ? Promise.all(syncAsyncValues) : syncAsyncValues;
        }
    };
    function error(msg) {
        throw new Error("Internal Error: " + msg);
    }
    exports.error = error;
    function syntaxError(msg, parseErrors) {
        var error = Error(msg);
        error[ERROR_SYNTAX_ERROR] = true;
        if (parseErrors)
            error[ERROR_PARSE_ERRORS] = parseErrors;
        return error;
    }
    exports.syntaxError = syntaxError;
    var ERROR_SYNTAX_ERROR = 'ngSyntaxError';
    var ERROR_PARSE_ERRORS = 'ngParseErrors';
    function isSyntaxError(error) {
        return error[ERROR_SYNTAX_ERROR];
    }
    exports.isSyntaxError = isSyntaxError;
    function getParseErrors(error) {
        return error[ERROR_PARSE_ERRORS] || [];
    }
    exports.getParseErrors = getParseErrors;
    // Escape characters that have a special meaning in Regular Expressions
    function escapeRegExp(s) {
        return s.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
    }
    exports.escapeRegExp = escapeRegExp;
    var STRING_MAP_PROTO = Object.getPrototypeOf({});
    function isStrictStringMap(obj) {
        return typeof obj === 'object' && obj !== null && Object.getPrototypeOf(obj) === STRING_MAP_PROTO;
    }
    function utf8Encode(str) {
        var encoded = '';
        for (var index = 0; index < str.length; index++) {
            var codePoint = str.charCodeAt(index);
            // decode surrogate
            // see https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            if (codePoint >= 0xd800 && codePoint <= 0xdbff && str.length > (index + 1)) {
                var low = str.charCodeAt(index + 1);
                if (low >= 0xdc00 && low <= 0xdfff) {
                    index++;
                    codePoint = ((codePoint - 0xd800) << 10) + low - 0xdc00 + 0x10000;
                }
            }
            if (codePoint <= 0x7f) {
                encoded += String.fromCharCode(codePoint);
            }
            else if (codePoint <= 0x7ff) {
                encoded += String.fromCharCode(((codePoint >> 6) & 0x1F) | 0xc0, (codePoint & 0x3f) | 0x80);
            }
            else if (codePoint <= 0xffff) {
                encoded += String.fromCharCode((codePoint >> 12) | 0xe0, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
            }
            else if (codePoint <= 0x1fffff) {
                encoded += String.fromCharCode(((codePoint >> 18) & 0x07) | 0xf0, ((codePoint >> 12) & 0x3f) | 0x80, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
            }
        }
        return encoded;
    }
    exports.utf8Encode = utf8Encode;
    function stringify(token) {
        if (typeof token === 'string') {
            return token;
        }
        if (Array.isArray(token)) {
            return '[' + token.map(stringify).join(', ') + ']';
        }
        if (token == null) {
            return '' + token;
        }
        if (token.overriddenName) {
            return "" + token.overriddenName;
        }
        if (token.name) {
            return "" + token.name;
        }
        if (!token.toString) {
            return 'object';
        }
        // WARNING: do not try to `JSON.stringify(token)` here
        // see https://github.com/angular/angular/issues/23440
        var res = token.toString();
        if (res == null) {
            return '' + res;
        }
        var newLineIndex = res.indexOf('\n');
        return newLineIndex === -1 ? res : res.substring(0, newLineIndex);
    }
    exports.stringify = stringify;
    /**
     * Lazily retrieves the reference value from a forwardRef.
     */
    function resolveForwardRef(type) {
        if (typeof type === 'function' && type.hasOwnProperty('__forward_ref__')) {
            return type();
        }
        else {
            return type;
        }
    }
    exports.resolveForwardRef = resolveForwardRef;
    /**
     * Determine if the argument is shaped like a Promise
     */
    function isPromise(obj) {
        // allow any Promise/A+ compliant thenable.
        // It's up to the caller to ensure that obj.then conforms to the spec
        return !!obj && typeof obj.then === 'function';
    }
    exports.isPromise = isPromise;
    var Version = /** @class */ (function () {
        function Version(full) {
            this.full = full;
            var splits = full.split('.');
            this.major = splits[0];
            this.minor = splits[1];
            this.patch = splits.slice(2).join('.');
        }
        return Version;
    }());
    exports.Version = Version;
    var __window = typeof window !== 'undefined' && window;
    var __self = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope && self;
    var __global = typeof global !== 'undefined' && global;
    // Check __global first, because in Node tests both __global and __window may be defined and _global
    // should be __global in that case.
    var _global = __global || __window || __self;
    exports.global = _global;
    function newArray(size, value) {
        var list = [];
        for (var i = 0; i < size; i++) {
            list.push(value);
        }
        return list;
    }
    exports.newArray = newArray;
    /**
     * Partitions a given array into 2 arrays, based on a boolean value returned by the condition
     * function.
     *
     * @param arr Input array that should be partitioned
     * @param conditionFn Condition function that is called for each item in a given array and returns a
     * boolean value.
     */
    function partitionArray(arr, conditionFn) {
        var e_1, _a;
        var truthy = [];
        var falsy = [];
        try {
            for (var arr_1 = tslib_1.__values(arr), arr_1_1 = arr_1.next(); !arr_1_1.done; arr_1_1 = arr_1.next()) {
                var item = arr_1_1.value;
                (conditionFn(item) ? truthy : falsy).push(item);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (arr_1_1 && !arr_1_1.done && (_a = arr_1.return)) _a.call(arr_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return [truthy, falsy];
    }
    exports.partitionArray = partitionArray;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFPSCxJQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztJQUV6QyxTQUFnQixtQkFBbUIsQ0FBQyxLQUFhO1FBQy9DLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtZQUFDLFdBQVc7aUJBQVgsVUFBVyxFQUFYLHFCQUFXLEVBQVgsSUFBVztnQkFBWCxzQkFBVzs7WUFBSyxPQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUU7UUFBbEIsQ0FBa0IsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFGRCxrREFFQztJQUVELFNBQWdCLFlBQVksQ0FBQyxLQUFhLEVBQUUsYUFBdUI7UUFDakUsT0FBTyxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRkQsb0NBRUM7SUFFRCxTQUFnQixhQUFhLENBQUMsS0FBYSxFQUFFLGFBQXVCO1FBQ2xFLE9BQU8sUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUZELHNDQUVDO0lBRUQsU0FBUyxRQUFRLENBQUMsS0FBYSxFQUFFLFNBQWlCLEVBQUUsYUFBdUI7UUFDekUsSUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNoRCxJQUFJLGNBQWMsSUFBSSxDQUFDLENBQUM7WUFBRSxPQUFPLGFBQWEsQ0FBQztRQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLEdBQUcsQ0FB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LEVBQUUsV0FBb0M7O1FBQ3BELElBQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQztRQUN2QixJQUFNLEtBQUssR0FBUSxFQUFFLENBQUM7O1lBQ3RCLEtBQW1CLElBQUEsUUFBQSxpQkFBQSxHQUFHLENBQUEsd0JBQUEseUNBQUU7Z0JBQW5CLElBQU0sSUFBSSxnQkFBQTtnQkFDYixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBVyxDQUFDLENBQUM7YUFDeEQ7Ozs7Ozs7OztRQUNELE9BQU8sQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQVJELHdDQVFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuXG5jb25zdCBEQVNIX0NBU0VfUkVHRVhQID0gLy0rKFthLXowLTldKS9nO1xuXG5leHBvcnQgZnVuY3Rpb24gZGFzaENhc2VUb0NhbWVsQ2FzZShpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlucHV0LnJlcGxhY2UoREFTSF9DQVNFX1JFR0VYUCwgKC4uLm06IGFueVtdKSA9PiBtWzFdLnRvVXBwZXJDYXNlKCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRBdENvbG9uKGlucHV0OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZXM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICByZXR1cm4gX3NwbGl0QXQoaW5wdXQsICc6JywgZGVmYXVsdFZhbHVlcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdEF0UGVyaW9kKGlucHV0OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZXM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICByZXR1cm4gX3NwbGl0QXQoaW5wdXQsICcuJywgZGVmYXVsdFZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIF9zcGxpdEF0KGlucHV0OiBzdHJpbmcsIGNoYXJhY3Rlcjogc3RyaW5nLCBkZWZhdWx0VmFsdWVzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgY2hhcmFjdGVySW5kZXggPSBpbnB1dC5pbmRleE9mKGNoYXJhY3Rlcik7XG4gIGlmIChjaGFyYWN0ZXJJbmRleCA9PSAtMSkgcmV0dXJuIGRlZmF1bHRWYWx1ZXM7XG4gIHJldHVybiBbaW5wdXQuc2xpY2UoMCwgY2hhcmFjdGVySW5kZXgpLnRyaW0oKSwgaW5wdXQuc2xpY2UoY2hhcmFjdGVySW5kZXggKyAxKS50cmltKCldO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmlzaXRWYWx1ZSh2YWx1ZTogYW55LCB2aXNpdG9yOiBWYWx1ZVZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0QXJyYXkoPGFueVtdPnZhbHVlLCBjb250ZXh0KTtcbiAgfVxuXG4gIGlmIChpc1N0cmljdFN0cmluZ01hcCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFN0cmluZ01hcCg8e1trZXk6IHN0cmluZ106IGFueX0+dmFsdWUsIGNvbnRleHQpO1xuICB9XG5cbiAgaWYgKHZhbHVlID09IG51bGwgfHwgdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fFxuICAgICAgdHlwZW9mIHZhbHVlID09ICdib29sZWFuJykge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0UHJpbWl0aXZlKHZhbHVlLCBjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiB2aXNpdG9yLnZpc2l0T3RoZXIodmFsdWUsIGNvbnRleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNEZWZpbmVkKHZhbDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWwgIT09IG51bGwgJiYgdmFsICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub1VuZGVmaW5lZDxUPih2YWw6IFR8dW5kZWZpbmVkKTogVCB7XG4gIHJldHVybiB2YWwgPT09IHVuZGVmaW5lZCA/IG51bGwhIDogdmFsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZhbHVlVmlzaXRvciB7XG4gIHZpc2l0QXJyYXkoYXJyOiBhbnlbXSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFN0cmluZ01hcChtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0UHJpbWl0aXZlKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRPdGhlcih2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZVRyYW5zZm9ybWVyIGltcGxlbWVudHMgVmFsdWVWaXNpdG9yIHtcbiAgdmlzaXRBcnJheShhcnI6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBhcnIubWFwKHZhbHVlID0+IHZpc2l0VmFsdWUodmFsdWUsIHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuICB2aXNpdFN0cmluZ01hcChtYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhtYXApLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmlzaXRWYWx1ZShtYXBba2V5XSwgdGhpcywgY29udGV4dCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICB2aXNpdFByaW1pdGl2ZSh2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICB2aXNpdE90aGVyKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIFN5bmNBc3luYzxUPiA9IFR8UHJvbWlzZTxUPjtcblxuZXhwb3J0IGNvbnN0IFN5bmNBc3luYyA9IHtcbiAgYXNzZXJ0U3luYzogPFQ+KHZhbHVlOiBTeW5jQXN5bmM8VD4pOiBUID0+IHtcbiAgICBpZiAoaXNQcm9taXNlKHZhbHVlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIHN0YXRlOiB2YWx1ZSBjYW5ub3QgYmUgYSBwcm9taXNlYCk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcbiAgdGhlbjogPFQsIFI+KHZhbHVlOiBTeW5jQXN5bmM8VD4sIGNiOiAodmFsdWU6IFQpID0+IFIgfCBQcm9taXNlPFI+fCBTeW5jQXN5bmM8Uj4pOlxuICAgICAgU3luY0FzeW5jPFI+ID0+IHtcbiAgICAgICAgcmV0dXJuIGlzUHJvbWlzZSh2YWx1ZSkgPyB2YWx1ZS50aGVuKGNiKSA6IGNiKHZhbHVlKTtcbiAgICAgIH0sXG4gIGFsbDogPFQ+KHN5bmNBc3luY1ZhbHVlczogU3luY0FzeW5jPFQ+W10pOiBTeW5jQXN5bmM8VFtdPiA9PiB7XG4gICAgcmV0dXJuIHN5bmNBc3luY1ZhbHVlcy5zb21lKGlzUHJvbWlzZSkgPyBQcm9taXNlLmFsbChzeW5jQXN5bmNWYWx1ZXMpIDogc3luY0FzeW5jVmFsdWVzIGFzIFRbXTtcbiAgfVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVycm9yKG1zZzogc3RyaW5nKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIEVycm9yOiAke21zZ31gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bnRheEVycm9yKG1zZzogc3RyaW5nLCBwYXJzZUVycm9ycz86IFBhcnNlRXJyb3JbXSk6IEVycm9yIHtcbiAgY29uc3QgZXJyb3IgPSBFcnJvcihtc2cpO1xuICAoZXJyb3IgYXMgYW55KVtFUlJPUl9TWU5UQVhfRVJST1JdID0gdHJ1ZTtcbiAgaWYgKHBhcnNlRXJyb3JzKSAoZXJyb3IgYXMgYW55KVtFUlJPUl9QQVJTRV9FUlJPUlNdID0gcGFyc2VFcnJvcnM7XG4gIHJldHVybiBlcnJvcjtcbn1cblxuY29uc3QgRVJST1JfU1lOVEFYX0VSUk9SID0gJ25nU3ludGF4RXJyb3InO1xuY29uc3QgRVJST1JfUEFSU0VfRVJST1JTID0gJ25nUGFyc2VFcnJvcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNTeW50YXhFcnJvcihlcnJvcjogRXJyb3IpOiBib29sZWFuIHtcbiAgcmV0dXJuIChlcnJvciBhcyBhbnkpW0VSUk9SX1NZTlRBWF9FUlJPUl07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYXJzZUVycm9ycyhlcnJvcjogRXJyb3IpOiBQYXJzZUVycm9yW10ge1xuICByZXR1cm4gKGVycm9yIGFzIGFueSlbRVJST1JfUEFSU0VfRVJST1JTXSB8fCBbXTtcbn1cblxuLy8gRXNjYXBlIGNoYXJhY3RlcnMgdGhhdCBoYXZlIGEgc3BlY2lhbCBtZWFuaW5nIGluIFJlZ3VsYXIgRXhwcmVzc2lvbnNcbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVSZWdFeHAoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvKFsuKis/Xj0hOiR7fSgpfFtcXF1cXC9cXFxcXSkvZywgJ1xcXFwkMScpO1xufVxuXG5jb25zdCBTVFJJTkdfTUFQX1BST1RPID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHt9KTtcbmZ1bmN0aW9uIGlzU3RyaWN0U3RyaW5nTWFwKG9iajogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiBvYmogIT09IG51bGwgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaikgPT09IFNUUklOR19NQVBfUFJPVE87XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1dGY4RW5jb2RlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IGVuY29kZWQgPSAnJztcbiAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHN0ci5sZW5ndGg7IGluZGV4KyspIHtcbiAgICBsZXQgY29kZVBvaW50ID0gc3RyLmNoYXJDb2RlQXQoaW5kZXgpO1xuXG4gICAgLy8gZGVjb2RlIHN1cnJvZ2F0ZVxuICAgIC8vIHNlZSBodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZyNzdXJyb2dhdGUtZm9ybXVsYWVcbiAgICBpZiAoY29kZVBvaW50ID49IDB4ZDgwMCAmJiBjb2RlUG9pbnQgPD0gMHhkYmZmICYmIHN0ci5sZW5ndGggPiAoaW5kZXggKyAxKSkge1xuICAgICAgY29uc3QgbG93ID0gc3RyLmNoYXJDb2RlQXQoaW5kZXggKyAxKTtcbiAgICAgIGlmIChsb3cgPj0gMHhkYzAwICYmIGxvdyA8PSAweGRmZmYpIHtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgICAgY29kZVBvaW50ID0gKChjb2RlUG9pbnQgLSAweGQ4MDApIDw8IDEwKSArIGxvdyAtIDB4ZGMwMCArIDB4MTAwMDA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA8PSAweDdmKSB7XG4gICAgICBlbmNvZGVkICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZVBvaW50KTtcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8PSAweDdmZikge1xuICAgICAgZW5jb2RlZCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCgoY29kZVBvaW50ID4+IDYpICYgMHgxRikgfCAweGMwLCAoY29kZVBvaW50ICYgMHgzZikgfCAweDgwKTtcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8PSAweGZmZmYpIHtcbiAgICAgIGVuY29kZWQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShcbiAgICAgICAgICAoY29kZVBvaW50ID4+IDEyKSB8IDB4ZTAsICgoY29kZVBvaW50ID4+IDYpICYgMHgzZikgfCAweDgwLCAoY29kZVBvaW50ICYgMHgzZikgfCAweDgwKTtcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8PSAweDFmZmZmZikge1xuICAgICAgZW5jb2RlZCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKFxuICAgICAgICAgICgoY29kZVBvaW50ID4+IDE4KSAmIDB4MDcpIHwgMHhmMCwgKChjb2RlUG9pbnQgPj4gMTIpICYgMHgzZikgfCAweDgwLFxuICAgICAgICAgICgoY29kZVBvaW50ID4+IDYpICYgMHgzZikgfCAweDgwLCAoY29kZVBvaW50ICYgMHgzZikgfCAweDgwKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZW5jb2RlZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPdXRwdXRDb250ZXh0IHtcbiAgZ2VuRmlsZVBhdGg6IHN0cmluZztcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXTtcbiAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2w7XG4gIGltcG9ydEV4cHIocmVmZXJlbmNlOiBhbnksIHR5cGVQYXJhbXM/OiBvLlR5cGVbXXxudWxsLCB1c2VTdW1tYXJpZXM/OiBib29sZWFuKTogby5FeHByZXNzaW9uO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5naWZ5KHRva2VuOiBhbnkpOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHRva2VuKSkge1xuICAgIHJldHVybiAnWycgKyB0b2tlbi5tYXAoc3RyaW5naWZ5KS5qb2luKCcsICcpICsgJ10nO1xuICB9XG5cbiAgaWYgKHRva2VuID09IG51bGwpIHtcbiAgICByZXR1cm4gJycgKyB0b2tlbjtcbiAgfVxuXG4gIGlmICh0b2tlbi5vdmVycmlkZGVuTmFtZSkge1xuICAgIHJldHVybiBgJHt0b2tlbi5vdmVycmlkZGVuTmFtZX1gO1xuICB9XG5cbiAgaWYgKHRva2VuLm5hbWUpIHtcbiAgICByZXR1cm4gYCR7dG9rZW4ubmFtZX1gO1xuICB9XG5cbiAgaWYgKCF0b2tlbi50b1N0cmluZykge1xuICAgIHJldHVybiAnb2JqZWN0JztcbiAgfVxuXG4gIC8vIFdBUk5JTkc6IGRvIG5vdCB0cnkgdG8gYEpTT04uc3RyaW5naWZ5KHRva2VuKWAgaGVyZVxuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjM0NDBcbiAgY29uc3QgcmVzID0gdG9rZW4udG9TdHJpbmcoKTtcblxuICBpZiAocmVzID09IG51bGwpIHtcbiAgICByZXR1cm4gJycgKyByZXM7XG4gIH1cblxuICBjb25zdCBuZXdMaW5lSW5kZXggPSByZXMuaW5kZXhPZignXFxuJyk7XG4gIHJldHVybiBuZXdMaW5lSW5kZXggPT09IC0xID8gcmVzIDogcmVzLnN1YnN0cmluZygwLCBuZXdMaW5lSW5kZXgpO1xufVxuXG4vKipcbiAqIExhemlseSByZXRyaWV2ZXMgdGhlIHJlZmVyZW5jZSB2YWx1ZSBmcm9tIGEgZm9yd2FyZFJlZi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVGb3J3YXJkUmVmKHR5cGU6IGFueSk6IGFueSB7XG4gIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlLmhhc093blByb3BlcnR5KCdfX2ZvcndhcmRfcmVmX18nKSkge1xuICAgIHJldHVybiB0eXBlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHR5cGU7XG4gIH1cbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgdGhlIGFyZ3VtZW50IGlzIHNoYXBlZCBsaWtlIGEgUHJvbWlzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9taXNlPFQgPSBhbnk+KG9iajogYW55KTogb2JqIGlzIFByb21pc2U8VD4ge1xuICAvLyBhbGxvdyBhbnkgUHJvbWlzZS9BKyBjb21wbGlhbnQgdGhlbmFibGUuXG4gIC8vIEl0J3MgdXAgdG8gdGhlIGNhbGxlciB0byBlbnN1cmUgdGhhdCBvYmoudGhlbiBjb25mb3JtcyB0byB0aGUgc3BlY1xuICByZXR1cm4gISFvYmogJiYgdHlwZW9mIG9iai50aGVuID09PSAnZnVuY3Rpb24nO1xufVxuXG5leHBvcnQgY2xhc3MgVmVyc2lvbiB7XG4gIHB1YmxpYyByZWFkb25seSBtYWpvcjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgbWlub3I6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHBhdGNoOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGZ1bGw6IHN0cmluZykge1xuICAgIGNvbnN0IHNwbGl0cyA9IGZ1bGwuc3BsaXQoJy4nKTtcbiAgICB0aGlzLm1ham9yID0gc3BsaXRzWzBdO1xuICAgIHRoaXMubWlub3IgPSBzcGxpdHNbMV07XG4gICAgdGhpcy5wYXRjaCA9IHNwbGl0cy5zbGljZSgyKS5qb2luKCcuJyk7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb25zb2xlIHtcbiAgbG9nKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG4gIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZDtcbn1cblxuXG5kZWNsYXJlIHZhciBXb3JrZXJHbG9iYWxTY29wZTogYW55O1xuLy8gQ29tbW9uSlMgLyBOb2RlIGhhdmUgZ2xvYmFsIGNvbnRleHQgZXhwb3NlZCBhcyBcImdsb2JhbFwiIHZhcmlhYmxlLlxuLy8gV2UgZG9uJ3Qgd2FudCB0byBpbmNsdWRlIHRoZSB3aG9sZSBub2RlLmQudHMgdGhpcyB0aGlzIGNvbXBpbGF0aW9uIHVuaXQgc28gd2UnbGwganVzdCBmYWtlXG4vLyB0aGUgZ2xvYmFsIFwiZ2xvYmFsXCIgdmFyIGZvciBub3cuXG5kZWNsYXJlIHZhciBnbG9iYWw6IGFueTtcbmNvbnN0IF9fd2luZG93ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93O1xuY29uc3QgX19zZWxmID0gdHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBXb3JrZXJHbG9iYWxTY29wZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUgJiYgc2VsZjtcbmNvbnN0IF9fZ2xvYmFsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsO1xuXG4vLyBDaGVjayBfX2dsb2JhbCBmaXJzdCwgYmVjYXVzZSBpbiBOb2RlIHRlc3RzIGJvdGggX19nbG9iYWwgYW5kIF9fd2luZG93IG1heSBiZSBkZWZpbmVkIGFuZCBfZ2xvYmFsXG4vLyBzaG91bGQgYmUgX19nbG9iYWwgaW4gdGhhdCBjYXNlLlxuY29uc3QgX2dsb2JhbDoge1tuYW1lOiBzdHJpbmddOiBhbnl9ID0gX19nbG9iYWwgfHwgX193aW5kb3cgfHwgX19zZWxmO1xuZXhwb3J0IHtfZ2xvYmFsIGFzIGdsb2JhbH07XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXdBcnJheTxUID0gYW55PihzaXplOiBudW1iZXIpOiBUW107XG5leHBvcnQgZnVuY3Rpb24gbmV3QXJyYXk8VD4oc2l6ZTogbnVtYmVyLCB2YWx1ZTogVCk6IFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBuZXdBcnJheTxUPihzaXplOiBudW1iZXIsIHZhbHVlPzogVCk6IFRbXSB7XG4gIGNvbnN0IGxpc3Q6IFRbXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgIGxpc3QucHVzaCh2YWx1ZSEpO1xuICB9XG4gIHJldHVybiBsaXN0O1xufVxuXG4vKipcbiAqIFBhcnRpdGlvbnMgYSBnaXZlbiBhcnJheSBpbnRvIDIgYXJyYXlzLCBiYXNlZCBvbiBhIGJvb2xlYW4gdmFsdWUgcmV0dXJuZWQgYnkgdGhlIGNvbmRpdGlvblxuICogZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIGFyciBJbnB1dCBhcnJheSB0aGF0IHNob3VsZCBiZSBwYXJ0aXRpb25lZFxuICogQHBhcmFtIGNvbmRpdGlvbkZuIENvbmRpdGlvbiBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBmb3IgZWFjaCBpdGVtIGluIGEgZ2l2ZW4gYXJyYXkgYW5kIHJldHVybnMgYVxuICogYm9vbGVhbiB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnRpdGlvbkFycmF5PFQsIEYgPSBUPihcbiAgICBhcnI6IChUfEYpW10sIGNvbmRpdGlvbkZuOiAodmFsdWU6IFR8RikgPT4gYm9vbGVhbik6IFtUW10sIEZbXV0ge1xuICBjb25zdCB0cnV0aHk6IFRbXSA9IFtdO1xuICBjb25zdCBmYWxzeTogRltdID0gW107XG4gIGZvciAoY29uc3QgaXRlbSBvZiBhcnIpIHtcbiAgICAoY29uZGl0aW9uRm4oaXRlbSkgPyB0cnV0aHkgOiBmYWxzeSkucHVzaChpdGVtIGFzIGFueSk7XG4gIH1cbiAgcmV0dXJuIFt0cnV0aHksIGZhbHN5XTtcbn1cbiJdfQ==