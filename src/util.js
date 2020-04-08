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
        define("@angular/compiler/src/util", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBT0gsSUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7SUFFekMsU0FBZ0IsbUJBQW1CLENBQUMsS0FBYTtRQUMvQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7WUFBQyxXQUFXO2lCQUFYLFVBQVcsRUFBWCxxQkFBVyxFQUFYLElBQVc7Z0JBQVgsc0JBQVc7O1lBQUssT0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFO1FBQWxCLENBQWtCLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRkQsa0RBRUM7SUFFRCxTQUFnQixZQUFZLENBQUMsS0FBYSxFQUFFLGFBQXVCO1FBQ2pFLE9BQU8sUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUZELG9DQUVDO0lBRUQsU0FBZ0IsYUFBYSxDQUFDLEtBQWEsRUFBRSxhQUF1QjtRQUNsRSxPQUFPLFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFGRCxzQ0FFQztJQUVELFNBQVMsUUFBUSxDQUFDLEtBQWEsRUFBRSxTQUFpQixFQUFFLGFBQXVCO1FBQ3pFLElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsSUFBSSxjQUFjLElBQUksQ0FBQyxDQUFDO1lBQUUsT0FBTyxhQUFhLENBQUM7UUFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLENBQUMs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eXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcblxuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvcn0gZnJvbSAnLi9wYXJzZV91dGlsJztcblxuY29uc3QgREFTSF9DQVNFX1JFR0VYUCA9IC8tKyhbYS16MC05XSkvZztcblxuZXhwb3J0IGZ1bmN0aW9uIGRhc2hDYXNlVG9DYW1lbENhc2UoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5yZXBsYWNlKERBU0hfQ0FTRV9SRUdFWFAsICguLi5tOiBhbnlbXSkgPT4gbVsxXS50b1VwcGVyQ2FzZSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0QXRDb2xvbihpbnB1dDogc3RyaW5nLCBkZWZhdWx0VmFsdWVzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIF9zcGxpdEF0KGlucHV0LCAnOicsIGRlZmF1bHRWYWx1ZXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRBdFBlcmlvZChpbnB1dDogc3RyaW5nLCBkZWZhdWx0VmFsdWVzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIF9zcGxpdEF0KGlucHV0LCAnLicsIGRlZmF1bHRWYWx1ZXMpO1xufVxuXG5mdW5jdGlvbiBfc3BsaXRBdChpbnB1dDogc3RyaW5nLCBjaGFyYWN0ZXI6IHN0cmluZywgZGVmYXVsdFZhbHVlczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGNoYXJhY3RlckluZGV4ID0gaW5wdXQuaW5kZXhPZihjaGFyYWN0ZXIpO1xuICBpZiAoY2hhcmFjdGVySW5kZXggPT0gLTEpIHJldHVybiBkZWZhdWx0VmFsdWVzO1xuICByZXR1cm4gW2lucHV0LnNsaWNlKDAsIGNoYXJhY3RlckluZGV4KS50cmltKCksIGlucHV0LnNsaWNlKGNoYXJhY3RlckluZGV4ICsgMSkudHJpbSgpXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0VmFsdWUodmFsdWU6IGFueSwgdmlzaXRvcjogVmFsdWVWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEFycmF5KDxhbnlbXT52YWx1ZSwgY29udGV4dCk7XG4gIH1cblxuICBpZiAoaXNTdHJpY3RTdHJpbmdNYXAodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRTdHJpbmdNYXAoPHtba2V5OiBzdHJpbmddOiBhbnl9PnZhbHVlLCBjb250ZXh0KTtcbiAgfVxuXG4gIGlmICh2YWx1ZSA9PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHxcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PSAnYm9vbGVhbicpIHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFByaW1pdGl2ZSh2YWx1ZSwgY29udGV4dCk7XG4gIH1cblxuICByZXR1cm4gdmlzaXRvci52aXNpdE90aGVyKHZhbHVlLCBjb250ZXh0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRGVmaW5lZCh2YWw6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFsICE9PSBudWxsICYmIHZhbCAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9VbmRlZmluZWQ8VD4odmFsOiBUfHVuZGVmaW5lZCk6IFQge1xuICByZXR1cm4gdmFsID09PSB1bmRlZmluZWQgPyBudWxsISA6IHZhbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBWYWx1ZVZpc2l0b3Ige1xuICB2aXNpdEFycmF5KGFycjogYW55W10sIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRTdHJpbmdNYXAobWFwOiB7W2tleTogc3RyaW5nXTogYW55fSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFByaW1pdGl2ZSh2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0T3RoZXIodmFsdWU6IGFueSwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVUcmFuc2Zvcm1lciBpbXBsZW1lbnRzIFZhbHVlVmlzaXRvciB7XG4gIHZpc2l0QXJyYXkoYXJyOiBhbnlbXSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXJyLm1hcCh2YWx1ZSA9PiB2aXNpdFZhbHVlKHZhbHVlLCB0aGlzLCBjb250ZXh0KSk7XG4gIH1cbiAgdmlzaXRTdHJpbmdNYXAobWFwOiB7W2tleTogc3RyaW5nXTogYW55fSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gICAgT2JqZWN0LmtleXMobWFwKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICByZXN1bHRba2V5XSA9IHZpc2l0VmFsdWUobWFwW2tleV0sIHRoaXMsIGNvbnRleHQpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgdmlzaXRQcmltaXRpdmUodmFsdWU6IGFueSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgdmlzaXRPdGhlcih2YWx1ZTogYW55LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBTeW5jQXN5bmM8VD4gPSBUfFByb21pc2U8VD47XG5cbmV4cG9ydCBjb25zdCBTeW5jQXN5bmMgPSB7XG4gIGFzc2VydFN5bmM6IDxUPih2YWx1ZTogU3luY0FzeW5jPFQ+KTogVCA9PiB7XG4gICAgaWYgKGlzUHJvbWlzZSh2YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBzdGF0ZTogdmFsdWUgY2Fubm90IGJlIGEgcHJvbWlzZWApO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH0sXG4gIHRoZW46IDxULCBSPih2YWx1ZTogU3luY0FzeW5jPFQ+LCBjYjogKHZhbHVlOiBUKSA9PiBSIHwgUHJvbWlzZTxSPnwgU3luY0FzeW5jPFI+KTpcbiAgICAgIFN5bmNBc3luYzxSPiA9PiB7XG4gICAgICAgIHJldHVybiBpc1Byb21pc2UodmFsdWUpID8gdmFsdWUudGhlbihjYikgOiBjYih2YWx1ZSk7XG4gICAgICB9LFxuICBhbGw6IDxUPihzeW5jQXN5bmNWYWx1ZXM6IFN5bmNBc3luYzxUPltdKTogU3luY0FzeW5jPFRbXT4gPT4ge1xuICAgIHJldHVybiBzeW5jQXN5bmNWYWx1ZXMuc29tZShpc1Byb21pc2UpID8gUHJvbWlzZS5hbGwoc3luY0FzeW5jVmFsdWVzKSA6IHN5bmNBc3luY1ZhbHVlcyBhcyBUW107XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBlcnJvcihtc2c6IHN0cmluZyk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBFcnJvcjogJHttc2d9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzeW50YXhFcnJvcihtc2c6IHN0cmluZywgcGFyc2VFcnJvcnM/OiBQYXJzZUVycm9yW10pOiBFcnJvciB7XG4gIGNvbnN0IGVycm9yID0gRXJyb3IobXNnKTtcbiAgKGVycm9yIGFzIGFueSlbRVJST1JfU1lOVEFYX0VSUk9SXSA9IHRydWU7XG4gIGlmIChwYXJzZUVycm9ycykgKGVycm9yIGFzIGFueSlbRVJST1JfUEFSU0VfRVJST1JTXSA9IHBhcnNlRXJyb3JzO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmNvbnN0IEVSUk9SX1NZTlRBWF9FUlJPUiA9ICduZ1N5bnRheEVycm9yJztcbmNvbnN0IEVSUk9SX1BBUlNFX0VSUk9SUyA9ICduZ1BhcnNlRXJyb3JzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3ludGF4RXJyb3IoZXJyb3I6IEVycm9yKTogYm9vbGVhbiB7XG4gIHJldHVybiAoZXJyb3IgYXMgYW55KVtFUlJPUl9TWU5UQVhfRVJST1JdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyc2VFcnJvcnMoZXJyb3I6IEVycm9yKTogUGFyc2VFcnJvcltdIHtcbiAgcmV0dXJuIChlcnJvciBhcyBhbnkpW0VSUk9SX1BBUlNFX0VSUk9SU10gfHwgW107XG59XG5cbi8vIEVzY2FwZSBjaGFyYWN0ZXJzIHRoYXQgaGF2ZSBhIHNwZWNpYWwgbWVhbmluZyBpbiBSZWd1bGFyIEV4cHJlc3Npb25zXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoLyhbLiorP149IToke30oKXxbXFxdXFwvXFxcXF0pL2csICdcXFxcJDEnKTtcbn1cblxuY29uc3QgU1RSSU5HX01BUF9QUk9UTyA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih7fSk7XG5mdW5jdGlvbiBpc1N0cmljdFN0cmluZ01hcChvYmo6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgb2JqICE9PSBudWxsICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopID09PSBTVFJJTkdfTUFQX1BST1RPO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXRmOEVuY29kZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBlbmNvZGVkID0gJyc7XG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBzdHIubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgbGV0IGNvZGVQb2ludCA9IHN0ci5jaGFyQ29kZUF0KGluZGV4KTtcblxuICAgIC8vIGRlY29kZSBzdXJyb2dhdGVcbiAgICAvLyBzZWUgaHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmcjc3Vycm9nYXRlLWZvcm11bGFlXG4gICAgaWYgKGNvZGVQb2ludCA+PSAweGQ4MDAgJiYgY29kZVBvaW50IDw9IDB4ZGJmZiAmJiBzdHIubGVuZ3RoID4gKGluZGV4ICsgMSkpIHtcbiAgICAgIGNvbnN0IGxvdyA9IHN0ci5jaGFyQ29kZUF0KGluZGV4ICsgMSk7XG4gICAgICBpZiAobG93ID49IDB4ZGMwMCAmJiBsb3cgPD0gMHhkZmZmKSB7XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIGNvZGVQb2ludCA9ICgoY29kZVBvaW50IC0gMHhkODAwKSA8PCAxMCkgKyBsb3cgLSAweGRjMDAgKyAweDEwMDAwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPD0gMHg3Zikge1xuICAgICAgZW5jb2RlZCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGVQb2ludCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHg3ZmYpIHtcbiAgICAgIGVuY29kZWQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGNvZGVQb2ludCA+PiA2KSAmIDB4MUYpIHwgMHhjMCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHhmZmZmKSB7XG4gICAgICBlbmNvZGVkICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoXG4gICAgICAgICAgKGNvZGVQb2ludCA+PiAxMikgfCAweGUwLCAoKGNvZGVQb2ludCA+PiA2KSAmIDB4M2YpIHwgMHg4MCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHgxZmZmZmYpIHtcbiAgICAgIGVuY29kZWQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShcbiAgICAgICAgICAoKGNvZGVQb2ludCA+PiAxOCkgJiAweDA3KSB8IDB4ZjAsICgoY29kZVBvaW50ID4+IDEyKSAmIDB4M2YpIHwgMHg4MCxcbiAgICAgICAgICAoKGNvZGVQb2ludCA+PiA2KSAmIDB4M2YpIHwgMHg4MCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVuY29kZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3V0cHV0Q29udGV4dCB7XG4gIGdlbkZpbGVQYXRoOiBzdHJpbmc7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sO1xuICBpbXBvcnRFeHByKHJlZmVyZW5jZTogYW55LCB0eXBlUGFyYW1zPzogby5UeXBlW118bnVsbCwgdXNlU3VtbWFyaWVzPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ2lmeSh0b2tlbjogYW55KTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh0b2tlbikpIHtcbiAgICByZXR1cm4gJ1snICsgdG9rZW4ubWFwKHN0cmluZ2lmeSkuam9pbignLCAnKSArICddJztcbiAgfVxuXG4gIGlmICh0b2tlbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnICsgdG9rZW47XG4gIH1cblxuICBpZiAodG9rZW4ub3ZlcnJpZGRlbk5hbWUpIHtcbiAgICByZXR1cm4gYCR7dG9rZW4ub3ZlcnJpZGRlbk5hbWV9YDtcbiAgfVxuXG4gIGlmICh0b2tlbi5uYW1lKSB7XG4gICAgcmV0dXJuIGAke3Rva2VuLm5hbWV9YDtcbiAgfVxuXG4gIGlmICghdG9rZW4udG9TdHJpbmcpIHtcbiAgICByZXR1cm4gJ29iamVjdCc7XG4gIH1cblxuICAvLyBXQVJOSU5HOiBkbyBub3QgdHJ5IHRvIGBKU09OLnN0cmluZ2lmeSh0b2tlbilgIGhlcmVcbiAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzIzNDQwXG4gIGNvbnN0IHJlcyA9IHRva2VuLnRvU3RyaW5nKCk7XG5cbiAgaWYgKHJlcyA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnICsgcmVzO1xuICB9XG5cbiAgY29uc3QgbmV3TGluZUluZGV4ID0gcmVzLmluZGV4T2YoJ1xcbicpO1xuICByZXR1cm4gbmV3TGluZUluZGV4ID09PSAtMSA/IHJlcyA6IHJlcy5zdWJzdHJpbmcoMCwgbmV3TGluZUluZGV4KTtcbn1cblxuLyoqXG4gKiBMYXppbHkgcmV0cmlldmVzIHRoZSByZWZlcmVuY2UgdmFsdWUgZnJvbSBhIGZvcndhcmRSZWYuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRm9yd2FyZFJlZih0eXBlOiBhbnkpOiBhbnkge1xuICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicgJiYgdHlwZS5oYXNPd25Qcm9wZXJ0eSgnX19mb3J3YXJkX3JlZl9fJykpIHtcbiAgICByZXR1cm4gdHlwZSgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0eXBlO1xuICB9XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIHRoZSBhcmd1bWVudCBpcyBzaGFwZWQgbGlrZSBhIFByb21pc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvbWlzZTxUID0gYW55PihvYmo6IGFueSk6IG9iaiBpcyBQcm9taXNlPFQ+IHtcbiAgLy8gYWxsb3cgYW55IFByb21pc2UvQSsgY29tcGxpYW50IHRoZW5hYmxlLlxuICAvLyBJdCdzIHVwIHRvIHRoZSBjYWxsZXIgdG8gZW5zdXJlIHRoYXQgb2JqLnRoZW4gY29uZm9ybXMgdG8gdGhlIHNwZWNcbiAgcmV0dXJuICEhb2JqICYmIHR5cGVvZiBvYmoudGhlbiA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZXhwb3J0IGNsYXNzIFZlcnNpb24ge1xuICBwdWJsaWMgcmVhZG9ubHkgbWFqb3I6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IG1pbm9yOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBwYXRjaDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBmdWxsOiBzdHJpbmcpIHtcbiAgICBjb25zdCBzcGxpdHMgPSBmdWxsLnNwbGl0KCcuJyk7XG4gICAgdGhpcy5tYWpvciA9IHNwbGl0c1swXTtcbiAgICB0aGlzLm1pbm9yID0gc3BsaXRzWzFdO1xuICAgIHRoaXMucGF0Y2ggPSBzcGxpdHMuc2xpY2UoMikuam9pbignLicpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29uc29sZSB7XG4gIGxvZyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkO1xuICB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG59XG5cblxuZGVjbGFyZSB2YXIgV29ya2VyR2xvYmFsU2NvcGU6IGFueTtcbi8vIENvbW1vbkpTIC8gTm9kZSBoYXZlIGdsb2JhbCBjb250ZXh0IGV4cG9zZWQgYXMgXCJnbG9iYWxcIiB2YXJpYWJsZS5cbi8vIFdlIGRvbid0IHdhbnQgdG8gaW5jbHVkZSB0aGUgd2hvbGUgbm9kZS5kLnRzIHRoaXMgdGhpcyBjb21waWxhdGlvbiB1bml0IHNvIHdlJ2xsIGp1c3QgZmFrZVxuLy8gdGhlIGdsb2JhbCBcImdsb2JhbFwiIHZhciBmb3Igbm93LlxuZGVjbGFyZSB2YXIgZ2xvYmFsOiBhbnk7XG5jb25zdCBfX3dpbmRvdyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdztcbmNvbnN0IF9fc2VsZiA9IHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgV29ya2VyR2xvYmFsU2NvcGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgc2VsZiBpbnN0YW5jZW9mIFdvcmtlckdsb2JhbFNjb3BlICYmIHNlbGY7XG5jb25zdCBfX2dsb2JhbCA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbDtcblxuLy8gQ2hlY2sgX19nbG9iYWwgZmlyc3QsIGJlY2F1c2UgaW4gTm9kZSB0ZXN0cyBib3RoIF9fZ2xvYmFsIGFuZCBfX3dpbmRvdyBtYXkgYmUgZGVmaW5lZCBhbmQgX2dsb2JhbFxuLy8gc2hvdWxkIGJlIF9fZ2xvYmFsIGluIHRoYXQgY2FzZS5cbmNvbnN0IF9nbG9iYWw6IHtbbmFtZTogc3RyaW5nXTogYW55fSA9IF9fZ2xvYmFsIHx8IF9fd2luZG93IHx8IF9fc2VsZjtcbmV4cG9ydCB7X2dsb2JhbCBhcyBnbG9iYWx9O1xuXG5leHBvcnQgZnVuY3Rpb24gbmV3QXJyYXk8VCA9IGFueT4oc2l6ZTogbnVtYmVyKTogVFtdO1xuZXhwb3J0IGZ1bmN0aW9uIG5ld0FycmF5PFQ+KHNpemU6IG51bWJlciwgdmFsdWU6IFQpOiBUW107XG5leHBvcnQgZnVuY3Rpb24gbmV3QXJyYXk8VD4oc2l6ZTogbnVtYmVyLCB2YWx1ZT86IFQpOiBUW10ge1xuICBjb25zdCBsaXN0OiBUW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaXplOyBpKyspIHtcbiAgICBsaXN0LnB1c2godmFsdWUhKTtcbiAgfVxuICByZXR1cm4gbGlzdDtcbn0iXX0=