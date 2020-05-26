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
            var typeMetadata = this._reflector.annotations(util_1.resolveForwardRef(type));
            return typeMetadata && typeMetadata.some(core_1.createPipe.isTypeOf);
        };
        /**
         * Return {@link Pipe} for a given `Type`.
         */
        PipeResolver.prototype.resolve = function (type, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var metas = this._reflector.annotations(util_1.resolveForwardRef(type));
            if (metas) {
                var annotation = directive_resolver_1.findLast(metas, core_1.createPipe.isTypeOf);
                if (annotation) {
                    return annotation;
                }
            }
            if (throwIfNotFound) {
                throw new Error("No Pipe decorator found on " + util_1.stringify(type));
            }
            return null;
        };
        return PipeResolver;
    }());
    exports.PipeResolver = PipeResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9waXBlX3Jlc29sdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdILG1EQUE4QztJQUM5QywrRUFBOEM7SUFDOUMsbURBQW9EO0lBRXBEOzs7Ozs7T0FNRztJQUNIO1FBQ0Usc0JBQW9CLFVBQTRCO1lBQTVCLGVBQVUsR0FBVixVQUFVLENBQWtCO1FBQUcsQ0FBQztRQUVwRCw2QkFBTSxHQUFOLFVBQU8sSUFBVTtZQUNmLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLHdCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDMUUsT0FBTyxZQUFZLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxpQkFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFFRDs7V0FFRztRQUNILDhCQUFPLEdBQVAsVUFBUSxJQUFVLEVBQUUsZUFBc0I7WUFBdEIsZ0NBQUEsRUFBQSxzQkFBc0I7WUFDeEMsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsd0JBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuRSxJQUFJLEtBQUssRUFBRTtnQkFDVCxJQUFNLFVBQVUsR0FBRyw2QkFBUSxDQUFDLEtBQUssRUFBRSxpQkFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLFVBQVUsRUFBRTtvQkFDZCxPQUFPLFVBQVUsQ0FBQztpQkFDbkI7YUFDRjtZQUNELElBQUksZUFBZSxFQUFFO2dCQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUE4QixnQkFBUyxDQUFDLElBQUksQ0FBRyxDQUFDLENBQUM7YUFDbEU7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDSCxtQkFBQztJQUFELENBQUMsQUF4QkQsSUF3QkM7SUF4Qlksb0NBQVkiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge2NyZWF0ZVBpcGUsIFBpcGUsIFR5cGV9IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge2ZpbmRMYXN0fSBmcm9tICcuL2RpcmVjdGl2ZV9yZXNvbHZlcic7XG5pbXBvcnQge3Jlc29sdmVGb3J3YXJkUmVmLCBzdHJpbmdpZnl9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogUmVzb2x2ZSBhIGBUeXBlYCBmb3Ige0BsaW5rIFBpcGV9LlxuICpcbiAqIFRoaXMgaW50ZXJmYWNlIGNhbiBiZSBvdmVycmlkZGVuIGJ5IHRoZSBhcHBsaWNhdGlvbiBkZXZlbG9wZXIgdG8gY3JlYXRlIGN1c3RvbSBiZWhhdmlvci5cbiAqXG4gKiBTZWUge0BsaW5rIENvbXBpbGVyfVxuICovXG5leHBvcnQgY2xhc3MgUGlwZVJlc29sdmVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7fVxuXG4gIGlzUGlwZSh0eXBlOiBUeXBlKSB7XG4gICAgY29uc3QgdHlwZU1ldGFkYXRhID0gdGhpcy5fcmVmbGVjdG9yLmFubm90YXRpb25zKHJlc29sdmVGb3J3YXJkUmVmKHR5cGUpKTtcbiAgICByZXR1cm4gdHlwZU1ldGFkYXRhICYmIHR5cGVNZXRhZGF0YS5zb21lKGNyZWF0ZVBpcGUuaXNUeXBlT2YpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB7QGxpbmsgUGlwZX0gZm9yIGEgZ2l2ZW4gYFR5cGVgLlxuICAgKi9cbiAgcmVzb2x2ZSh0eXBlOiBUeXBlLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTogUGlwZXxudWxsIHtcbiAgICBjb25zdCBtZXRhcyA9IHRoaXMuX3JlZmxlY3Rvci5hbm5vdGF0aW9ucyhyZXNvbHZlRm9yd2FyZFJlZih0eXBlKSk7XG4gICAgaWYgKG1ldGFzKSB7XG4gICAgICBjb25zdCBhbm5vdGF0aW9uID0gZmluZExhc3QobWV0YXMsIGNyZWF0ZVBpcGUuaXNUeXBlT2YpO1xuICAgICAgaWYgKGFubm90YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIGFubm90YXRpb247XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aHJvd0lmTm90Rm91bmQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gUGlwZSBkZWNvcmF0b3IgZm91bmQgb24gJHtzdHJpbmdpZnkodHlwZSl9YCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iXX0=