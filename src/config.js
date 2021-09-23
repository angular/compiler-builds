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
        define("@angular/compiler/src/config", ["require", "exports", "@angular/compiler/src/core", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.preserveWhitespacesDefault = exports.CompilerConfig = void 0;
    var core_1 = require("@angular/compiler/src/core");
    var util_1 = require("@angular/compiler/src/util");
    var CompilerConfig = /** @class */ (function () {
        function CompilerConfig(_a) {
            var _b = _a === void 0 ? {} : _a, _c = _b.defaultEncapsulation, defaultEncapsulation = _c === void 0 ? core_1.ViewEncapsulation.Emulated : _c, _d = _b.useJit, useJit = _d === void 0 ? true : _d, _e = _b.jitDevMode, jitDevMode = _e === void 0 ? false : _e, _f = _b.missingTranslation, missingTranslation = _f === void 0 ? null : _f, preserveWhitespaces = _b.preserveWhitespaces, strictInjectionParameters = _b.strictInjectionParameters;
            this.defaultEncapsulation = defaultEncapsulation;
            this.useJit = !!useJit;
            this.jitDevMode = !!jitDevMode;
            this.missingTranslation = missingTranslation;
            this.preserveWhitespaces = preserveWhitespacesDefault((0, util_1.noUndefined)(preserveWhitespaces));
            this.strictInjectionParameters = strictInjectionParameters === true;
        }
        return CompilerConfig;
    }());
    exports.CompilerConfig = CompilerConfig;
    function preserveWhitespacesDefault(preserveWhitespacesOption, defaultSetting) {
        if (defaultSetting === void 0) { defaultSetting = false; }
        return preserveWhitespacesOption === null ? defaultSetting : preserveWhitespacesOption;
    }
    exports.preserveWhitespacesDefault = preserveWhitespacesDefault;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtREFBcUU7SUFDckUsbURBQW1DO0lBRW5DO1FBUUUsd0JBQVksRUFjTjtnQkFkTSxxQkFjUixFQUFFLEtBQUEsRUFiSiw0QkFBaUQsRUFBakQsb0JBQW9CLG1CQUFHLHdCQUFpQixDQUFDLFFBQVEsS0FBQSxFQUNqRCxjQUFhLEVBQWIsTUFBTSxtQkFBRyxJQUFJLEtBQUEsRUFDYixrQkFBa0IsRUFBbEIsVUFBVSxtQkFBRyxLQUFLLEtBQUEsRUFDbEIsMEJBQXlCLEVBQXpCLGtCQUFrQixtQkFBRyxJQUFJLEtBQUEsRUFDekIsbUJBQW1CLHlCQUFBLEVBQ25CLHlCQUF5QiwrQkFBQTtZQVN6QixJQUFJLENBQUMsb0JBQW9CLEdBQUcsb0JBQW9CLENBQUM7WUFDakQsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztZQUMvQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7WUFDN0MsSUFBSSxDQUFDLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDLElBQUEsa0JBQVcsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDeEYsSUFBSSxDQUFDLHlCQUF5QixHQUFHLHlCQUF5QixLQUFLLElBQUksQ0FBQztRQUN0RSxDQUFDO1FBQ0gscUJBQUM7SUFBRCxDQUFDLEFBOUJELElBOEJDO0lBOUJZLHdDQUFjO0lBZ0MzQixTQUFnQiwwQkFBMEIsQ0FDdEMseUJBQXVDLEVBQUUsY0FBc0I7UUFBdEIsK0JBQUEsRUFBQSxzQkFBc0I7UUFDakUsT0FBTyx5QkFBeUIsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUM7SUFDekYsQ0FBQztJQUhELGdFQUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7TWlzc2luZ1RyYW5zbGF0aW9uU3RyYXRlZ3ksIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtub1VuZGVmaW5lZH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGNsYXNzIENvbXBpbGVyQ29uZmlnIHtcbiAgcHVibGljIGRlZmF1bHRFbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbnxudWxsO1xuICBwdWJsaWMgdXNlSml0OiBib29sZWFuO1xuICBwdWJsaWMgaml0RGV2TW9kZTogYm9vbGVhbjtcbiAgcHVibGljIG1pc3NpbmdUcmFuc2xhdGlvbjogTWlzc2luZ1RyYW5zbGF0aW9uU3RyYXRlZ3l8bnVsbDtcbiAgcHVibGljIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW47XG4gIHB1YmxpYyBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKHtcbiAgICBkZWZhdWx0RW5jYXBzdWxhdGlvbiA9IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkLFxuICAgIHVzZUppdCA9IHRydWUsXG4gICAgaml0RGV2TW9kZSA9IGZhbHNlLFxuICAgIG1pc3NpbmdUcmFuc2xhdGlvbiA9IG51bGwsXG4gICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzXG4gIH06IHtcbiAgICBkZWZhdWx0RW5jYXBzdWxhdGlvbj86IFZpZXdFbmNhcHN1bGF0aW9uLFxuICAgIHVzZUppdD86IGJvb2xlYW4sXG4gICAgaml0RGV2TW9kZT86IGJvb2xlYW4sXG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uPzogTWlzc2luZ1RyYW5zbGF0aW9uU3RyYXRlZ3l8bnVsbCxcbiAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbixcbiAgICBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzPzogYm9vbGVhbixcbiAgfSA9IHt9KSB7XG4gICAgdGhpcy5kZWZhdWx0RW5jYXBzdWxhdGlvbiA9IGRlZmF1bHRFbmNhcHN1bGF0aW9uO1xuICAgIHRoaXMudXNlSml0ID0gISF1c2VKaXQ7XG4gICAgdGhpcy5qaXREZXZNb2RlID0gISFqaXREZXZNb2RlO1xuICAgIHRoaXMubWlzc2luZ1RyYW5zbGF0aW9uID0gbWlzc2luZ1RyYW5zbGF0aW9uO1xuICAgIHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlcyA9IHByZXNlcnZlV2hpdGVzcGFjZXNEZWZhdWx0KG5vVW5kZWZpbmVkKHByZXNlcnZlV2hpdGVzcGFjZXMpKTtcbiAgICB0aGlzLnN0cmljdEluamVjdGlvblBhcmFtZXRlcnMgPSBzdHJpY3RJbmplY3Rpb25QYXJhbWV0ZXJzID09PSB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVzZXJ2ZVdoaXRlc3BhY2VzRGVmYXVsdChcbiAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzT3B0aW9uOiBib29sZWFufG51bGwsIGRlZmF1bHRTZXR0aW5nID0gZmFsc2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByZXNlcnZlV2hpdGVzcGFjZXNPcHRpb24gPT09IG51bGwgPyBkZWZhdWx0U2V0dGluZyA6IHByZXNlcnZlV2hpdGVzcGFjZXNPcHRpb247XG59XG4iXX0=