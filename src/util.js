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
            Object.keys(map).forEach(function (key) { result[key] = visitValue(map[key], _this, context); });
            return result;
        };
        ValueTransformer.prototype.visitPrimitive = function (value, context) { return value; };
        ValueTransformer.prototype.visitOther = function (value, context) { return value; };
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
        then: function (value, cb) { return isPromise(value) ? value.then(cb) : cb(value); },
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
        if (token instanceof Array) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBT0gsSUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7SUFFekMsU0FBZ0IsbUJBQW1CLENBQUMsS0FBYTtRQUMvQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7WUFBQyxXQUFXO2lCQUFYLFVBQVcsRUFBWCxxQkFBVyxFQUFYLElBQVc7Z0JBQVgsc0JBQVc7O1lBQUssT0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFO1FBQWxCLENBQWtCLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRkQsa0RBRUM7SUFFRCxTQUFnQixZQUFZLENBQUMsS0FBYSxFQUFFLGFBQXVCO1FBQ2pFLE9BQU8sUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUZELG9DQUVDO0lBRUQsU0FBZ0IsYUFBYSxDQUFDLEtBQWEsRUFBRSxhQUF1QjtRQUNsRSxPQUFPLFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFGRCxzQ0FFQztJQUVELFNBQVMsUUFBUSxDQUFDLEtBQWEsRUFBRSxTQUFpQixFQUFFLGFBQXVCO1FBQ3pFLElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsSUFBSSxjQUFjLElBQUksQ0FBQyxDQUFDO1lBQUUsT0FBTyxhQUFhLENBQUM7UUFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekYsQ0FBQztJQUVELFNBQWdCLFVBQVUsQ0FBQyxLQUFVLEVBQUUsT0FBcUIsRUFBRSxPQUFZO1FBQ3hFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN4QixPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQVEsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ2xEO1FBRUQsSUFBSSxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM1QixPQUFPLE9BQU8sQ0FBQyxjQUFjLENBQXVCLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNyRTtRQUVELElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRLElBQUksT0FBTyxLQUFLLElBQUksUUFBUTtZQUNyRSxPQUFPLEtBQUssSUFBSSxTQUFTLEVBQUU7WUFDN0IsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztTQUMvQztRQUVELE9BQU8sT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQWZELGdDQWVDO0lBRUQsU0FBZ0IsU0FBUyxDQUFDLEdBQVE7UUFDaEMsT0FBTyxHQUFHLEtBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxTQUFTLENBQUM7SUFDM0MsQ0FBQztJQUZELDhCQUVDO0lBRUQsU0FBZ0IsV0FBVyxDQUFJLEdBQWtCO1FBQy9DLE9BQU8sR0FBRyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDMUMsQ0FBQztJQUZELGtDQUVDO0lBU0Q7UUFBQTtRQVdBLENBQUM7UUFWQyxxQ0FBVSxHQUFWLFVBQVcsR0FBVSxFQUFFLE9BQVk7WUFBbkMsaUJBRUM7WUFEQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxVQUFVLENBQUMsS0FBSyxFQUFFLEtBQUksRUFBRSxPQUFPLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFDRCx5Q0FBYyxHQUFkLFVBQWUsR0FBeUIsRUFBRSxPQUFZO1lBQXRELGlCQUlDO1lBSEMsSUFBTSxNQUFNLEdBQXlCLEVBQUUsQ0FBQztZQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUcsSUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4RixPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBQ0QseUNBQWMsR0FBZCxVQUFlLEtBQVUsRUFBRSxPQUFZLElBQVMsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQy9ELHFDQUFVLEdBQVYsVUFBVyxLQUFVLEVBQUUsT0FBWSxJQUFTLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM3RCx1QkFBQztJQUFELENBQUMsQUFYRCxJQVdDO0lBWFksNENBQWdCO0lBZWhCLFFBQUEsU0FBUyxHQUFHO1FBQ3ZCLFVBQVUsRUFBRSxVQUFJLEtBQW1CO1lBQ2pDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7YUFDN0Q7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxJQUFJLEVBQUUsVUFBTyxLQUFtQixFQUFFLEVBQThDLElBQ3BELE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQSxDQUFDO1FBQ2xGLEdBQUcsRUFBRSxVQUFJLGVBQStCO1lBQ3RDLE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBc0IsQ0FBQztRQUNqRyxDQUFDO0tBQ0YsQ0FBQztJQUVGLFNBQWdCLEtBQUssQ0FBQyxHQUFXO1FBQy9CLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQW1CLEdBQUssQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFGRCxzQkFFQztJQUVELFNBQWdCLFdBQVcsQ0FBQyxHQUFXLEVBQUUsV0FBMEI7UUFDakUsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLEtBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUMxQyxJQUFJLFdBQVc7WUFBRyxLQUFhLENBQUMsa0JBQWtCLENBQUMsR0FBRyxXQUFXLENBQUM7UUFDbEUsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBTEQsa0NBS0M7SUFFRCxJQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBQztJQUMzQyxJQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBQztJQUUzQyxTQUFnQixhQUFhLENBQUMsS0FBWTtRQUN4QyxPQUFRLEtBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFGRCxzQ0FFQztJQUVELFNBQWdCLGNBQWMsQ0FBQyxLQUFZO1FBQ3pDLE9BQVEsS0FBYSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2xELENBQUM7SUFGRCx3Q0FFQztJQUVELHVFQUF1RTtJQUN2RSxTQUFnQixZQUFZLENBQUMsQ0FBUztRQUNwQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsNEJBQTRCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUZELG9DQUVDO0lBRUQsSUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELFNBQVMsaUJBQWlCLENBQUMsR0FBUTtRQUNqQyxPQUFPLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxHQUFHLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssZ0JBQWdCLENBQUM7SUFDcEcsQ0FBQztJQUVELFNBQWdCLFVBQVUsQ0FBQyxHQUFXO1FBQ3BDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNqQixLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUMvQyxJQUFJLFNBQVMsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXRDLG1CQUFtQjtZQUNuQiw0RUFBNEU7WUFDNUUsSUFBSSxTQUFTLElBQUksTUFBTSxJQUFJLFNBQVMsSUFBSSxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDMUUsSUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RDLElBQUksR0FBRyxJQUFJLE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO29CQUNsQyxLQUFLLEVBQUUsQ0FBQztvQkFDUixTQUFTLEdBQUcsQ0FBQyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxHQUFHLEdBQUcsTUFBTSxHQUFHLE9BQU8sQ0FBQztpQkFDbkU7YUFDRjtZQUVELElBQUksU0FBUyxJQUFJLElBQUksRUFBRTtnQkFDckIsT0FBTyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDM0M7aUJBQU0sSUFBSSxTQUFTLElBQUksS0FBSyxFQUFFO2dCQUM3QixPQUFPLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQzthQUM3RjtpQkFBTSxJQUFJLFNBQVMsSUFBSSxNQUFNLEVBQUU7Z0JBQzlCLE9BQU8sSUFBSSxNQUFNLENBQUMsWUFBWSxDQUMxQixDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7YUFDNUY7aUJBQU0sSUFBSSxTQUFTLElBQUksUUFBUSxFQUFFO2dCQUNoQyxPQUFPLElBQUksTUFBTSxDQUFDLFlBQVksQ0FDMUIsQ0FBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQ3BFLENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO2FBQ2xFO1NBQ0Y7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBOUJELGdDQThCQztJQVNELFNBQWdCLFNBQVMsQ0FBQyxLQUFVO1FBQ2xDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO1lBQzdCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxJQUFJLEtBQUssWUFBWSxLQUFLLEVBQUU7WUFDMUIsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDO1NBQ3BEO1FBRUQsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO1lBQ2pCLE9BQU8sRUFBRSxHQUFHLEtBQUssQ0FBQztTQUNuQjtRQUVELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QixPQUFPLEtBQUcsS0FBSyxDQUFDLGNBQWdCLENBQUM7U0FDbEM7UUFFRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDZCxPQUFPLEtBQUcsS0FBSyxDQUFDLElBQU0sQ0FBQztTQUN4QjtRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ25CLE9BQU8sUUFBUSxDQUFDO1NBQ2pCO1FBRUQsc0RBQXNEO1FBQ3RELHNEQUFzRDtRQUN0RCxJQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFN0IsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ2YsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDO1NBQ2pCO1FBRUQsSUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxPQUFPLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBbkNELDhCQW1DQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsaUJBQWlCLENBQUMsSUFBUztRQUN6QyxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEVBQUU7WUFDeEUsT0FBTyxJQUFJLEVBQUUsQ0FBQztTQUNmO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQU5ELDhDQU1DO0lBRUQ7O09BRUc7SUFDSCxTQUFnQixTQUFTLENBQUMsR0FBUTtRQUNoQywyQ0FBMkM7UUFDM0MscUVBQXFFO1FBQ3JFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDO0lBQ2pELENBQUM7SUFKRCw4QkFJQztJQUVEO1FBS0UsaUJBQW1CLElBQVk7WUFBWixTQUFJLEdBQUosSUFBSSxDQUFRO1lBQzdCLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBQ0gsY0FBQztJQUFELENBQUMsQUFYRCxJQVdDO0lBWFksMEJBQU87SUF3QnBCLElBQU0sUUFBUSxHQUFHLE9BQU8sTUFBTSxLQUFLLFdBQVcsSUFBSSxNQUFNLENBQUM7SUFDekQsSUFBTSxNQUFNLEdBQUcsT0FBTyxJQUFJLEtBQUssV0FBVyxJQUFJLE9BQU8saUJBQWlCLEtBQUssV0FBVztRQUNsRixJQUFJLFlBQVksaUJBQWlCLElBQUksSUFBSSxDQUFDO0lBQzlDLElBQU0sUUFBUSxHQUFHLE9BQU8sTUFBTSxLQUFLLFdBQVcsSUFBSSxNQUFNLENBQUM7SUFFekQsb0dBQW9HO0lBQ3BHLG1DQUFtQztJQUNuQyxJQUFNLE9BQU8sR0FBMEIsUUFBUSxJQUFJLFFBQVEsSUFBSSxNQUFNLENBQUM7SUFDbkQseUJBQU07SUFJekIsU0FBZ0IsUUFBUSxDQUFJLElBQVksRUFBRSxLQUFTO1FBQ2pELElBQU0sSUFBSSxHQUFRLEVBQUUsQ0FBQztRQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBTyxDQUFDLENBQUM7U0FDcEI7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFORCw0QkFNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3J9IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5cbmNvbnN0IERBU0hfQ0FTRV9SRUdFWFAgPSAvLSsoW2EtejAtOV0pL2c7XG5cbmV4cG9ydCBmdW5jdGlvbiBkYXNoQ2FzZVRvQ2FtZWxDYXNlKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaW5wdXQucmVwbGFjZShEQVNIX0NBU0VfUkVHRVhQLCAoLi4ubTogYW55W10pID0+IG1bMV0udG9VcHBlckNhc2UoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdEF0Q29sb24oaW5wdXQ6IHN0cmluZywgZGVmYXVsdFZhbHVlczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIHJldHVybiBfc3BsaXRBdChpbnB1dCwgJzonLCBkZWZhdWx0VmFsdWVzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0QXRQZXJpb2QoaW5wdXQ6IHN0cmluZywgZGVmYXVsdFZhbHVlczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIHJldHVybiBfc3BsaXRBdChpbnB1dCwgJy4nLCBkZWZhdWx0VmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gX3NwbGl0QXQoaW5wdXQ6IHN0cmluZywgY2hhcmFjdGVyOiBzdHJpbmcsIGRlZmF1bHRWYWx1ZXM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICBjb25zdCBjaGFyYWN0ZXJJbmRleCA9IGlucHV0LmluZGV4T2YoY2hhcmFjdGVyKTtcbiAgaWYgKGNoYXJhY3RlckluZGV4ID09IC0xKSByZXR1cm4gZGVmYXVsdFZhbHVlcztcbiAgcmV0dXJuIFtpbnB1dC5zbGljZSgwLCBjaGFyYWN0ZXJJbmRleCkudHJpbSgpLCBpbnB1dC5zbGljZShjaGFyYWN0ZXJJbmRleCArIDEpLnRyaW0oKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2aXNpdFZhbHVlKHZhbHVlOiBhbnksIHZpc2l0b3I6IFZhbHVlVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRBcnJheSg8YW55W10+dmFsdWUsIGNvbnRleHQpO1xuICB9XG5cbiAgaWYgKGlzU3RyaWN0U3RyaW5nTWFwKHZhbHVlKSkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0U3RyaW5nTWFwKDx7W2tleTogc3RyaW5nXTogYW55fT52YWx1ZSwgY29udGV4dCk7XG4gIH1cblxuICBpZiAodmFsdWUgPT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8XG4gICAgICB0eXBlb2YgdmFsdWUgPT0gJ2Jvb2xlYW4nKSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRQcmltaXRpdmUodmFsdWUsIGNvbnRleHQpO1xuICB9XG5cbiAgcmV0dXJuIHZpc2l0b3IudmlzaXRPdGhlcih2YWx1ZSwgY29udGV4dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RlZmluZWQodmFsOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbCAhPT0gbnVsbCAmJiB2YWwgIT09IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vVW5kZWZpbmVkPFQ+KHZhbDogVCB8IHVuZGVmaW5lZCk6IFQge1xuICByZXR1cm4gdmFsID09PSB1bmRlZmluZWQgPyBudWxsICEgOiB2YWw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmFsdWVWaXNpdG9yIHtcbiAgdmlzaXRBcnJheShhcnI6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0U3RyaW5nTWFwKG1hcDoge1trZXk6IHN0cmluZ106IGFueX0sIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRQcmltaXRpdmUodmFsdWU6IGFueSwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdE90aGVyKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlVHJhbnNmb3JtZXIgaW1wbGVtZW50cyBWYWx1ZVZpc2l0b3Ige1xuICB2aXNpdEFycmF5KGFycjogYW55W10sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGFyci5tYXAodmFsdWUgPT4gdmlzaXRWYWx1ZSh2YWx1ZSwgdGhpcywgY29udGV4dCkpO1xuICB9XG4gIHZpc2l0U3RyaW5nTWFwKG1hcDoge1trZXk6IHN0cmluZ106IGFueX0sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChrZXkgPT4geyByZXN1bHRba2V5XSA9IHZpc2l0VmFsdWUobWFwW2tleV0sIHRoaXMsIGNvbnRleHQpOyB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0UHJpbWl0aXZlKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB2YWx1ZTsgfVxuICB2aXNpdE90aGVyKHZhbHVlOiBhbnksIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB2YWx1ZTsgfVxufVxuXG5leHBvcnQgdHlwZSBTeW5jQXN5bmM8VD4gPSBUIHwgUHJvbWlzZTxUPjtcblxuZXhwb3J0IGNvbnN0IFN5bmNBc3luYyA9IHtcbiAgYXNzZXJ0U3luYzogPFQ+KHZhbHVlOiBTeW5jQXN5bmM8VD4pOiBUID0+IHtcbiAgICBpZiAoaXNQcm9taXNlKHZhbHVlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIHN0YXRlOiB2YWx1ZSBjYW5ub3QgYmUgYSBwcm9taXNlYCk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcbiAgdGhlbjogPFQsIFI+KHZhbHVlOiBTeW5jQXN5bmM8VD4sIGNiOiAodmFsdWU6IFQpID0+IFIgfCBQcm9taXNlPFI+fCBTeW5jQXN5bmM8Uj4pOlxuICAgICAgICAgICAgU3luY0FzeW5jPFI+ID0+IHsgcmV0dXJuIGlzUHJvbWlzZSh2YWx1ZSkgPyB2YWx1ZS50aGVuKGNiKSA6IGNiKHZhbHVlKTt9LFxuICBhbGw6IDxUPihzeW5jQXN5bmNWYWx1ZXM6IFN5bmNBc3luYzxUPltdKTogU3luY0FzeW5jPFRbXT4gPT4ge1xuICAgIHJldHVybiBzeW5jQXN5bmNWYWx1ZXMuc29tZShpc1Byb21pc2UpID8gUHJvbWlzZS5hbGwoc3luY0FzeW5jVmFsdWVzKSA6IHN5bmNBc3luY1ZhbHVlcyBhcyBUW107XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBlcnJvcihtc2c6IHN0cmluZyk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBFcnJvcjogJHttc2d9YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzeW50YXhFcnJvcihtc2c6IHN0cmluZywgcGFyc2VFcnJvcnM/OiBQYXJzZUVycm9yW10pOiBFcnJvciB7XG4gIGNvbnN0IGVycm9yID0gRXJyb3IobXNnKTtcbiAgKGVycm9yIGFzIGFueSlbRVJST1JfU1lOVEFYX0VSUk9SXSA9IHRydWU7XG4gIGlmIChwYXJzZUVycm9ycykgKGVycm9yIGFzIGFueSlbRVJST1JfUEFSU0VfRVJST1JTXSA9IHBhcnNlRXJyb3JzO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmNvbnN0IEVSUk9SX1NZTlRBWF9FUlJPUiA9ICduZ1N5bnRheEVycm9yJztcbmNvbnN0IEVSUk9SX1BBUlNFX0VSUk9SUyA9ICduZ1BhcnNlRXJyb3JzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3ludGF4RXJyb3IoZXJyb3I6IEVycm9yKTogYm9vbGVhbiB7XG4gIHJldHVybiAoZXJyb3IgYXMgYW55KVtFUlJPUl9TWU5UQVhfRVJST1JdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyc2VFcnJvcnMoZXJyb3I6IEVycm9yKTogUGFyc2VFcnJvcltdIHtcbiAgcmV0dXJuIChlcnJvciBhcyBhbnkpW0VSUk9SX1BBUlNFX0VSUk9SU10gfHwgW107XG59XG5cbi8vIEVzY2FwZSBjaGFyYWN0ZXJzIHRoYXQgaGF2ZSBhIHNwZWNpYWwgbWVhbmluZyBpbiBSZWd1bGFyIEV4cHJlc3Npb25zXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoLyhbLiorP149IToke30oKXxbXFxdXFwvXFxcXF0pL2csICdcXFxcJDEnKTtcbn1cblxuY29uc3QgU1RSSU5HX01BUF9QUk9UTyA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih7fSk7XG5mdW5jdGlvbiBpc1N0cmljdFN0cmluZ01hcChvYmo6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgb2JqICE9PSBudWxsICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopID09PSBTVFJJTkdfTUFQX1BST1RPO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXRmOEVuY29kZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBlbmNvZGVkID0gJyc7XG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBzdHIubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgbGV0IGNvZGVQb2ludCA9IHN0ci5jaGFyQ29kZUF0KGluZGV4KTtcblxuICAgIC8vIGRlY29kZSBzdXJyb2dhdGVcbiAgICAvLyBzZWUgaHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmcjc3Vycm9nYXRlLWZvcm11bGFlXG4gICAgaWYgKGNvZGVQb2ludCA+PSAweGQ4MDAgJiYgY29kZVBvaW50IDw9IDB4ZGJmZiAmJiBzdHIubGVuZ3RoID4gKGluZGV4ICsgMSkpIHtcbiAgICAgIGNvbnN0IGxvdyA9IHN0ci5jaGFyQ29kZUF0KGluZGV4ICsgMSk7XG4gICAgICBpZiAobG93ID49IDB4ZGMwMCAmJiBsb3cgPD0gMHhkZmZmKSB7XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIGNvZGVQb2ludCA9ICgoY29kZVBvaW50IC0gMHhkODAwKSA8PCAxMCkgKyBsb3cgLSAweGRjMDAgKyAweDEwMDAwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPD0gMHg3Zikge1xuICAgICAgZW5jb2RlZCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGVQb2ludCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHg3ZmYpIHtcbiAgICAgIGVuY29kZWQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGNvZGVQb2ludCA+PiA2KSAmIDB4MUYpIHwgMHhjMCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHhmZmZmKSB7XG4gICAgICBlbmNvZGVkICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoXG4gICAgICAgICAgKGNvZGVQb2ludCA+PiAxMikgfCAweGUwLCAoKGNvZGVQb2ludCA+PiA2KSAmIDB4M2YpIHwgMHg4MCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPD0gMHgxZmZmZmYpIHtcbiAgICAgIGVuY29kZWQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShcbiAgICAgICAgICAoKGNvZGVQb2ludCA+PiAxOCkgJiAweDA3KSB8IDB4ZjAsICgoY29kZVBvaW50ID4+IDEyKSAmIDB4M2YpIHwgMHg4MCxcbiAgICAgICAgICAoKGNvZGVQb2ludCA+PiA2KSAmIDB4M2YpIHwgMHg4MCwgKGNvZGVQb2ludCAmIDB4M2YpIHwgMHg4MCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVuY29kZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3V0cHV0Q29udGV4dCB7XG4gIGdlbkZpbGVQYXRoOiBzdHJpbmc7XG4gIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sO1xuICBpbXBvcnRFeHByKHJlZmVyZW5jZTogYW55LCB0eXBlUGFyYW1zPzogby5UeXBlW118bnVsbCwgdXNlU3VtbWFyaWVzPzogYm9vbGVhbik6IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ2lmeSh0b2tlbjogYW55KTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICBpZiAodG9rZW4gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIHJldHVybiAnWycgKyB0b2tlbi5tYXAoc3RyaW5naWZ5KS5qb2luKCcsICcpICsgJ10nO1xuICB9XG5cbiAgaWYgKHRva2VuID09IG51bGwpIHtcbiAgICByZXR1cm4gJycgKyB0b2tlbjtcbiAgfVxuXG4gIGlmICh0b2tlbi5vdmVycmlkZGVuTmFtZSkge1xuICAgIHJldHVybiBgJHt0b2tlbi5vdmVycmlkZGVuTmFtZX1gO1xuICB9XG5cbiAgaWYgKHRva2VuLm5hbWUpIHtcbiAgICByZXR1cm4gYCR7dG9rZW4ubmFtZX1gO1xuICB9XG5cbiAgaWYgKCF0b2tlbi50b1N0cmluZykge1xuICAgIHJldHVybiAnb2JqZWN0JztcbiAgfVxuXG4gIC8vIFdBUk5JTkc6IGRvIG5vdCB0cnkgdG8gYEpTT04uc3RyaW5naWZ5KHRva2VuKWAgaGVyZVxuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjM0NDBcbiAgY29uc3QgcmVzID0gdG9rZW4udG9TdHJpbmcoKTtcblxuICBpZiAocmVzID09IG51bGwpIHtcbiAgICByZXR1cm4gJycgKyByZXM7XG4gIH1cblxuICBjb25zdCBuZXdMaW5lSW5kZXggPSByZXMuaW5kZXhPZignXFxuJyk7XG4gIHJldHVybiBuZXdMaW5lSW5kZXggPT09IC0xID8gcmVzIDogcmVzLnN1YnN0cmluZygwLCBuZXdMaW5lSW5kZXgpO1xufVxuXG4vKipcbiAqIExhemlseSByZXRyaWV2ZXMgdGhlIHJlZmVyZW5jZSB2YWx1ZSBmcm9tIGEgZm9yd2FyZFJlZi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVGb3J3YXJkUmVmKHR5cGU6IGFueSk6IGFueSB7XG4gIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlLmhhc093blByb3BlcnR5KCdfX2ZvcndhcmRfcmVmX18nKSkge1xuICAgIHJldHVybiB0eXBlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHR5cGU7XG4gIH1cbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgdGhlIGFyZ3VtZW50IGlzIHNoYXBlZCBsaWtlIGEgUHJvbWlzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9taXNlKG9iajogYW55KTogb2JqIGlzIFByb21pc2U8YW55PiB7XG4gIC8vIGFsbG93IGFueSBQcm9taXNlL0ErIGNvbXBsaWFudCB0aGVuYWJsZS5cbiAgLy8gSXQncyB1cCB0byB0aGUgY2FsbGVyIHRvIGVuc3VyZSB0aGF0IG9iai50aGVuIGNvbmZvcm1zIHRvIHRoZSBzcGVjXG4gIHJldHVybiAhIW9iaiAmJiB0eXBlb2Ygb2JqLnRoZW4gPT09ICdmdW5jdGlvbic7XG59XG5cbmV4cG9ydCBjbGFzcyBWZXJzaW9uIHtcbiAgcHVibGljIHJlYWRvbmx5IG1ham9yOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBtaW5vcjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgcGF0Y2g6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZnVsbDogc3RyaW5nKSB7XG4gICAgY29uc3Qgc3BsaXRzID0gZnVsbC5zcGxpdCgnLicpO1xuICAgIHRoaXMubWFqb3IgPSBzcGxpdHNbMF07XG4gICAgdGhpcy5taW5vciA9IHNwbGl0c1sxXTtcbiAgICB0aGlzLnBhdGNoID0gc3BsaXRzLnNsaWNlKDIpLmpvaW4oJy4nKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbnNvbGUge1xuICBsb2cobWVzc2FnZTogc3RyaW5nKTogdm9pZDtcbiAgd2FybihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkO1xufVxuXG5cbmRlY2xhcmUgdmFyIFdvcmtlckdsb2JhbFNjb3BlOiBhbnk7XG4vLyBDb21tb25KUyAvIE5vZGUgaGF2ZSBnbG9iYWwgY29udGV4dCBleHBvc2VkIGFzIFwiZ2xvYmFsXCIgdmFyaWFibGUuXG4vLyBXZSBkb24ndCB3YW50IHRvIGluY2x1ZGUgdGhlIHdob2xlIG5vZGUuZC50cyB0aGlzIHRoaXMgY29tcGlsYXRpb24gdW5pdCBzbyB3ZSdsbCBqdXN0IGZha2Vcbi8vIHRoZSBnbG9iYWwgXCJnbG9iYWxcIiB2YXIgZm9yIG5vdy5cbmRlY2xhcmUgdmFyIGdsb2JhbDogYW55O1xuY29uc3QgX193aW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3c7XG5jb25zdCBfX3NlbGYgPSB0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHNlbGYgaW5zdGFuY2VvZiBXb3JrZXJHbG9iYWxTY29wZSAmJiBzZWxmO1xuY29uc3QgX19nbG9iYWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWw7XG5cbi8vIENoZWNrIF9fZ2xvYmFsIGZpcnN0LCBiZWNhdXNlIGluIE5vZGUgdGVzdHMgYm90aCBfX2dsb2JhbCBhbmQgX193aW5kb3cgbWF5IGJlIGRlZmluZWQgYW5kIF9nbG9iYWxcbi8vIHNob3VsZCBiZSBfX2dsb2JhbCBpbiB0aGF0IGNhc2UuXG5jb25zdCBfZ2xvYmFsOiB7W25hbWU6IHN0cmluZ106IGFueX0gPSBfX2dsb2JhbCB8fCBfX3dpbmRvdyB8fCBfX3NlbGY7XG5leHBvcnQge19nbG9iYWwgYXMgZ2xvYmFsfTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5ld0FycmF5PFQgPSBhbnk+KHNpemU6IG51bWJlcik6IFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBuZXdBcnJheTxUPihzaXplOiBudW1iZXIsIHZhbHVlOiBUKTogVFtdO1xuZXhwb3J0IGZ1bmN0aW9uIG5ld0FycmF5PFQ+KHNpemU6IG51bWJlciwgdmFsdWU/OiBUKTogVFtdIHtcbiAgY29uc3QgbGlzdDogVFtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7XG4gICAgbGlzdC5wdXNoKHZhbHVlICEpO1xuICB9XG4gIHJldHVybiBsaXN0O1xufSJdfQ==