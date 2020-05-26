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
        define("@angular/compiler/src/ml_parser/interpolation_config", ["require", "exports", "@angular/compiler/src/assertions"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_INTERPOLATION_CONFIG = exports.InterpolationConfig = void 0;
    var assertions_1 = require("@angular/compiler/src/assertions");
    var InterpolationConfig = /** @class */ (function () {
        function InterpolationConfig(start, end) {
            this.start = start;
            this.end = end;
        }
        InterpolationConfig.fromArray = function (markers) {
            if (!markers) {
                return exports.DEFAULT_INTERPOLATION_CONFIG;
            }
            assertions_1.assertInterpolationSymbols('interpolation', markers);
            return new InterpolationConfig(markers[0], markers[1]);
        };
        return InterpolationConfig;
    }());
    exports.InterpolationConfig = InterpolationConfig;
    exports.DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig('{{', '}}');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJwb2xhdGlvbl9jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILCtEQUF5RDtJQUV6RDtRQVVFLDZCQUFtQixLQUFhLEVBQVMsR0FBVztZQUFqQyxVQUFLLEdBQUwsS0FBSyxDQUFRO1lBQVMsUUFBRyxHQUFILEdBQUcsQ0FBUTtRQUFHLENBQUM7UUFUakQsNkJBQVMsR0FBaEIsVUFBaUIsT0FBOEI7WUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDWixPQUFPLG9DQUE0QixDQUFDO2FBQ3JDO1lBRUQsdUNBQTBCLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUdILDBCQUFDO0lBQUQsQ0FBQyxBQVhELElBV0M7SUFYWSxrREFBbUI7SUFhbkIsUUFBQSw0QkFBNEIsR0FDckMsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0SW50ZXJwb2xhdGlvblN5bWJvbHN9IGZyb20gJy4uL2Fzc2VydGlvbnMnO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvbkNvbmZpZyB7XG4gIHN0YXRpYyBmcm9tQXJyYXkobWFya2VyczogW3N0cmluZywgc3RyaW5nXXxudWxsKTogSW50ZXJwb2xhdGlvbkNvbmZpZyB7XG4gICAgaWYgKCFtYXJrZXJzKSB7XG4gICAgICByZXR1cm4gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgICB9XG5cbiAgICBhc3NlcnRJbnRlcnBvbGF0aW9uU3ltYm9scygnaW50ZXJwb2xhdGlvbicsIG1hcmtlcnMpO1xuICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvbkNvbmZpZyhtYXJrZXJzWzBdLCBtYXJrZXJzWzFdKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdGFydDogc3RyaW5nLCBwdWJsaWMgZW5kOiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHOiBJbnRlcnBvbGF0aW9uQ29uZmlnID1cbiAgICBuZXcgSW50ZXJwb2xhdGlvbkNvbmZpZygne3snLCAnfX0nKTtcbiJdfQ==