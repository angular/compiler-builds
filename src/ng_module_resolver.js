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
        define("@angular/compiler/src/ng_module_resolver", ["require", "exports", "@angular/compiler/src/core", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NgModuleResolver = void 0;
    var core_1 = require("@angular/compiler/src/core");
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    var util_1 = require("@angular/compiler/src/util");
    /**
     * Resolves types to {@link NgModule}.
     */
    var NgModuleResolver = /** @class */ (function () {
        function NgModuleResolver(_reflector) {
            this._reflector = _reflector;
        }
        NgModuleResolver.prototype.isNgModule = function (type) {
            return this._reflector.annotations(type).some(core_1.createNgModule.isTypeOf);
        };
        NgModuleResolver.prototype.resolve = function (type, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var ngModuleMeta = directive_resolver_1.findLast(this._reflector.annotations(type), core_1.createNgModule.isTypeOf);
            if (ngModuleMeta) {
                return ngModuleMeta;
            }
            else {
                if (throwIfNotFound) {
                    throw new Error("No NgModule metadata found for '" + util_1.stringify(type) + "'.");
                }
                return null;
            }
        };
        return NgModuleResolver;
    }());
    exports.NgModuleResolver = NgModuleResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL25nX21vZHVsZV9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFHSCxtREFBc0Q7SUFDdEQsK0VBQThDO0lBQzlDLG1EQUFpQztJQUdqQzs7T0FFRztJQUNIO1FBQ0UsMEJBQW9CLFVBQTRCO1lBQTVCLGVBQVUsR0FBVixVQUFVLENBQWtCO1FBQUcsQ0FBQztRQUVwRCxxQ0FBVSxHQUFWLFVBQVcsSUFBUztZQUNsQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxrQ0FBTyxHQUFQLFVBQVEsSUFBVSxFQUFFLGVBQXNCO1lBQXRCLGdDQUFBLEVBQUEsc0JBQXNCO1lBQ3hDLElBQU0sWUFBWSxHQUNkLDZCQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUscUJBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUV6RSxJQUFJLFlBQVksRUFBRTtnQkFDaEIsT0FBTyxZQUFZLENBQUM7YUFDckI7aUJBQU07Z0JBQ0wsSUFBSSxlQUFlLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQW1DLGdCQUFTLENBQUMsSUFBSSxDQUFDLE9BQUksQ0FBQyxDQUFDO2lCQUN6RTtnQkFDRCxPQUFPLElBQUksQ0FBQzthQUNiO1FBQ0gsQ0FBQztRQUNILHVCQUFDO0lBQUQsQ0FBQyxBQXBCRCxJQW9CQztJQXBCWSw0Q0FBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge2NyZWF0ZU5nTW9kdWxlLCBOZ01vZHVsZSwgVHlwZX0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7ZmluZExhc3R9IGZyb20gJy4vZGlyZWN0aXZlX3Jlc29sdmVyJztcbmltcG9ydCB7c3RyaW5naWZ5fSBmcm9tICcuL3V0aWwnO1xuXG5cbi8qKlxuICogUmVzb2x2ZXMgdHlwZXMgdG8ge0BsaW5rIE5nTW9kdWxlfS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5nTW9kdWxlUmVzb2x2ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHt9XG5cbiAgaXNOZ01vZHVsZSh0eXBlOiBhbnkpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVmbGVjdG9yLmFubm90YXRpb25zKHR5cGUpLnNvbWUoY3JlYXRlTmdNb2R1bGUuaXNUeXBlT2YpO1xuICB9XG5cbiAgcmVzb2x2ZSh0eXBlOiBUeXBlLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTogTmdNb2R1bGV8bnVsbCB7XG4gICAgY29uc3QgbmdNb2R1bGVNZXRhOiBOZ01vZHVsZSA9XG4gICAgICAgIGZpbmRMYXN0KHRoaXMuX3JlZmxlY3Rvci5hbm5vdGF0aW9ucyh0eXBlKSwgY3JlYXRlTmdNb2R1bGUuaXNUeXBlT2YpO1xuXG4gICAgaWYgKG5nTW9kdWxlTWV0YSkge1xuICAgICAgcmV0dXJuIG5nTW9kdWxlTWV0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRocm93SWZOb3RGb3VuZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIE5nTW9kdWxlIG1ldGFkYXRhIGZvdW5kIGZvciAnJHtzdHJpbmdpZnkodHlwZSl9Jy5gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxufVxuIl19