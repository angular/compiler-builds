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
            (0, assertions_1.assertInterpolationSymbols)('interpolation', markers);
            return new InterpolationConfig(markers[0], markers[1]);
        };
        return InterpolationConfig;
    }());
    exports.InterpolationConfig = InterpolationConfig;
    exports.DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig('{{', '}}');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJwb2xhdGlvbl9jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILCtEQUF5RDtJQUV6RDtRQVVFLDZCQUFtQixLQUFhLEVBQVMsR0FBVztZQUFqQyxVQUFLLEdBQUwsS0FBSyxDQUFRO1lBQVMsUUFBRyxHQUFILEdBQUcsQ0FBUTtRQUFHLENBQUM7UUFUakQsNkJBQVMsR0FBaEIsVUFBaUIsT0FBOEI7WUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDWixPQUFPLG9DQUE0QixDQUFDO2FBQ3JDO1lBRUQsSUFBQSx1Q0FBMEIsRUFBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDckQsT0FBTyxJQUFJLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBR0gsMEJBQUM7SUFBRCxDQUFDLEFBWEQsSUFXQztJQVhZLGtEQUFtQjtJQWFuQixRQUFBLDRCQUE0QixHQUNyQyxJQUFJLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Fzc2VydEludGVycG9sYXRpb25TeW1ib2xzfSBmcm9tICcuLi9hc3NlcnRpb25zJztcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25Db25maWcge1xuICBzdGF0aWMgZnJvbUFycmF5KG1hcmtlcnM6IFtzdHJpbmcsIHN0cmluZ118bnVsbCk6IEludGVycG9sYXRpb25Db25maWcge1xuICAgIGlmICghbWFya2Vycykge1xuICAgICAgcmV0dXJuIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgfVxuXG4gICAgYXNzZXJ0SW50ZXJwb2xhdGlvblN5bWJvbHMoJ2ludGVycG9sYXRpb24nLCBtYXJrZXJzKTtcbiAgICByZXR1cm4gbmV3IEludGVycG9sYXRpb25Db25maWcobWFya2Vyc1swXSwgbWFya2Vyc1sxXSk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RhcnQ6IHN0cmluZywgcHVibGljIGVuZDogc3RyaW5nKSB7fVxufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgbmV3IEludGVycG9sYXRpb25Db25maWcoJ3t7JywgJ319Jyk7XG4iXX0=