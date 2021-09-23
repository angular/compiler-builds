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
        define("@angular/compiler/src/pipe_resolver", ["require", "exports", "@angular/compiler/src/core", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PipeResolver = void 0;
    var core_1 = require("@angular/compiler/src/core");
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    var util_1 = require("@angular/compiler/src/util");
    /**
     * Resolve a `Type` for {@link Pipe}.
     *
     * This interface can be overridden by the application developer to create custom behavior.
     *
     * See {@link Compiler}
     */
    var PipeResolver = /** @class */ (function () {
        function PipeResolver(_reflector) {
            this._reflector = _reflector;
        }
        PipeResolver.prototype.isPipe = function (type) {
            var typeMetadata = this._reflector.annotations((0, util_1.resolveForwardRef)(type));
            return typeMetadata && typeMetadata.some(core_1.createPipe.isTypeOf);
        };
        /**
         * Return {@link Pipe} for a given `Type`.
         */
        PipeResolver.prototype.resolve = function (type, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var metas = this._reflector.annotations((0, util_1.resolveForwardRef)(type));
            if (metas) {
                var annotation = (0, directive_resolver_1.findLast)(metas, core_1.createPipe.isTypeOf);
                if (annotation) {
                    return annotation;
                }
            }
            if (throwIfNotFound) {
                throw new Error("No Pipe decorator found on " + (0, util_1.stringify)(type));
            }
            return null;
        };
        return PipeResolver;
    }());
    exports.PipeResolver = PipeResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9waXBlX3Jlc29sdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILG1EQUE4QztJQUM5QywrRUFBOEM7SUFDOUMsbURBQW9EO0lBRXBEOzs7Ozs7T0FNRztJQUNIO1FBQ0Usc0JBQW9CLFVBQTRCO1lBQTVCLGVBQVUsR0FBVixVQUFVLENBQWtCO1FBQUcsQ0FBQztRQUVwRCw2QkFBTSxHQUFOLFVBQU8sSUFBVTtZQUNmLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUEsd0JBQWlCLEVBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMxRSxPQUFPLFlBQVksSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUVEOztXQUVHO1FBQ0gsOEJBQU8sR0FBUCxVQUFRLElBQVUsRUFBRSxlQUFzQjtZQUF0QixnQ0FBQSxFQUFBLHNCQUFzQjtZQUN4QyxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFBLHdCQUFpQixFQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbkUsSUFBSSxLQUFLLEVBQUU7Z0JBQ1QsSUFBTSxVQUFVLEdBQUcsSUFBQSw2QkFBUSxFQUFDLEtBQUssRUFBRSxpQkFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLFVBQVUsRUFBRTtvQkFDZCxPQUFPLFVBQVUsQ0FBQztpQkFDbkI7YUFDRjtZQUNELElBQUksZUFBZSxFQUFFO2dCQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUE4QixJQUFBLGdCQUFTLEVBQUMsSUFBSSxDQUFHLENBQUMsQ0FBQzthQUNsRTtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQXhCRCxJQXdCQztJQXhCWSxvQ0FBWSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtjcmVhdGVQaXBlLCBQaXBlLCBUeXBlfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtmaW5kTGFzdH0gZnJvbSAnLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtyZXNvbHZlRm9yd2FyZFJlZiwgc3RyaW5naWZ5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIFJlc29sdmUgYSBgVHlwZWAgZm9yIHtAbGluayBQaXBlfS5cbiAqXG4gKiBUaGlzIGludGVyZmFjZSBjYW4gYmUgb3ZlcnJpZGRlbiBieSB0aGUgYXBwbGljYXRpb24gZGV2ZWxvcGVyIHRvIGNyZWF0ZSBjdXN0b20gYmVoYXZpb3IuXG4gKlxuICogU2VlIHtAbGluayBDb21waWxlcn1cbiAqL1xuZXhwb3J0IGNsYXNzIFBpcGVSZXNvbHZlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3JlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcikge31cblxuICBpc1BpcGUodHlwZTogVHlwZSkge1xuICAgIGNvbnN0IHR5cGVNZXRhZGF0YSA9IHRoaXMuX3JlZmxlY3Rvci5hbm5vdGF0aW9ucyhyZXNvbHZlRm9yd2FyZFJlZih0eXBlKSk7XG4gICAgcmV0dXJuIHR5cGVNZXRhZGF0YSAmJiB0eXBlTWV0YWRhdGEuc29tZShjcmVhdGVQaXBlLmlzVHlwZU9mKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4ge0BsaW5rIFBpcGV9IGZvciBhIGdpdmVuIGBUeXBlYC5cbiAgICovXG4gIHJlc29sdmUodHlwZTogVHlwZSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6IFBpcGV8bnVsbCB7XG4gICAgY29uc3QgbWV0YXMgPSB0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnMocmVzb2x2ZUZvcndhcmRSZWYodHlwZSkpO1xuICAgIGlmIChtZXRhcykge1xuICAgICAgY29uc3QgYW5ub3RhdGlvbiA9IGZpbmRMYXN0KG1ldGFzLCBjcmVhdGVQaXBlLmlzVHlwZU9mKTtcbiAgICAgIGlmIChhbm5vdGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBhbm5vdGF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhyb3dJZk5vdEZvdW5kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIFBpcGUgZGVjb3JhdG9yIGZvdW5kIG9uICR7c3RyaW5naWZ5KHR5cGUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl19