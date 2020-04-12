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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9waXBlX3Jlc29sdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7O0lBR0gsbURBQThDO0lBQzlDLCtFQUE4QztJQUM5QyxtREFBb0Q7SUFHcEQ7Ozs7OztPQU1HO0lBQ0g7UUFDRSxzQkFBb0IsVUFBNEI7WUFBNUIsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7UUFBRyxDQUFDO1FBRXBELDZCQUFNLEdBQU4sVUFBTyxJQUFVO1lBQ2YsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsd0JBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMxRSxPQUFPLFlBQVksSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUVEOztXQUVHO1FBQ0gsOEJBQU8sR0FBUCxVQUFRLElBQVUsRUFBRSxlQUFzQjtZQUF0QixnQ0FBQSxFQUFBLHNCQUFzQjtZQUN4QyxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyx3QkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25FLElBQUksS0FBSyxFQUFFO2dCQUNULElBQU0sVUFBVSxHQUFHLDZCQUFRLENBQUMsS0FBSyxFQUFFLGlCQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3hELElBQUksVUFBVSxFQUFFO29CQUNkLE9BQU8sVUFBVSxDQUFDO2lCQUNuQjthQUNGO1lBQ0QsSUFBSSxlQUFlLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQThCLGdCQUFTLENBQUMsSUFBSSxDQUFHLENBQUMsQ0FBQzthQUNsRTtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQXhCRCxJQXdCQztJQXhCWSxvQ0FBWSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7UGlwZSwgVHlwZSwgY3JlYXRlUGlwZX0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7ZmluZExhc3R9IGZyb20gJy4vZGlyZWN0aXZlX3Jlc29sdmVyJztcbmltcG9ydCB7cmVzb2x2ZUZvcndhcmRSZWYsIHN0cmluZ2lmeX0gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIFJlc29sdmUgYSBgVHlwZWAgZm9yIHtAbGluayBQaXBlfS5cbiAqXG4gKiBUaGlzIGludGVyZmFjZSBjYW4gYmUgb3ZlcnJpZGRlbiBieSB0aGUgYXBwbGljYXRpb24gZGV2ZWxvcGVyIHRvIGNyZWF0ZSBjdXN0b20gYmVoYXZpb3IuXG4gKlxuICogU2VlIHtAbGluayBDb21waWxlcn1cbiAqL1xuZXhwb3J0IGNsYXNzIFBpcGVSZXNvbHZlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3JlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcikge31cblxuICBpc1BpcGUodHlwZTogVHlwZSkge1xuICAgIGNvbnN0IHR5cGVNZXRhZGF0YSA9IHRoaXMuX3JlZmxlY3Rvci5hbm5vdGF0aW9ucyhyZXNvbHZlRm9yd2FyZFJlZih0eXBlKSk7XG4gICAgcmV0dXJuIHR5cGVNZXRhZGF0YSAmJiB0eXBlTWV0YWRhdGEuc29tZShjcmVhdGVQaXBlLmlzVHlwZU9mKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4ge0BsaW5rIFBpcGV9IGZvciBhIGdpdmVuIGBUeXBlYC5cbiAgICovXG4gIHJlc29sdmUodHlwZTogVHlwZSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6IFBpcGV8bnVsbCB7XG4gICAgY29uc3QgbWV0YXMgPSB0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnMocmVzb2x2ZUZvcndhcmRSZWYodHlwZSkpO1xuICAgIGlmIChtZXRhcykge1xuICAgICAgY29uc3QgYW5ub3RhdGlvbiA9IGZpbmRMYXN0KG1ldGFzLCBjcmVhdGVQaXBlLmlzVHlwZU9mKTtcbiAgICAgIGlmIChhbm5vdGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBhbm5vdGF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhyb3dJZk5vdEZvdW5kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIFBpcGUgZGVjb3JhdG9yIGZvdW5kIG9uICR7c3RyaW5naWZ5KHR5cGUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl19