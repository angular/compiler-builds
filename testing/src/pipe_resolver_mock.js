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
        define("@angular/compiler/testing/src/pipe_resolver_mock", ["require", "exports", "tslib", "@angular/compiler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MockPipeResolver = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var MockPipeResolver = /** @class */ (function (_super) {
        tslib_1.__extends(MockPipeResolver, _super);
        function MockPipeResolver(refector) {
            var _this = _super.call(this, refector) || this;
            _this._pipes = new Map();
            return _this;
        }
        /**
         * Overrides the {@link Pipe} for a pipe.
         */
        MockPipeResolver.prototype.setPipe = function (type, metadata) {
            this._pipes.set(type, metadata);
        };
        /**
         * Returns the {@link Pipe} for a pipe:
         * - Set the {@link Pipe} to the overridden view when it exists or fallback to the
         * default
         * `PipeResolver`, see `setPipe`.
         */
        MockPipeResolver.prototype.resolve = function (type, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var metadata = this._pipes.get(type);
            if (!metadata) {
                metadata = _super.prototype.resolve.call(this, type, throwIfNotFound);
            }
            return metadata;
        };
        return MockPipeResolver;
    }(compiler_1.PipeResolver));
    exports.MockPipeResolver = MockPipeResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlcl9tb2NrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvdGVzdGluZy9zcmMvcGlwZV9yZXNvbHZlcl9tb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBdUU7SUFFdkU7UUFBc0MsNENBQVk7UUFHaEQsMEJBQVksUUFBMEI7WUFBdEMsWUFDRSxrQkFBTSxRQUFRLENBQUMsU0FDaEI7WUFKTyxZQUFNLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7O1FBSWpELENBQUM7UUFFRDs7V0FFRztRQUNILGtDQUFPLEdBQVAsVUFBUSxJQUFlLEVBQUUsUUFBbUI7WUFDMUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRDs7Ozs7V0FLRztRQUNILGtDQUFPLEdBQVAsVUFBUSxJQUFlLEVBQUUsZUFBc0I7WUFBdEIsZ0NBQUEsRUFBQSxzQkFBc0I7WUFDN0MsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDYixRQUFRLEdBQUcsaUJBQU0sT0FBTyxZQUFDLElBQUksRUFBRSxlQUFlLENBQUUsQ0FBQzthQUNsRDtZQUNELE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7UUFDSCx1QkFBQztJQUFELENBQUMsQUEzQkQsQ0FBc0MsdUJBQVksR0EyQmpEO0lBM0JZLDRDQUFnQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yLCBjb3JlLCBQaXBlUmVzb2x2ZXJ9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcblxuZXhwb3J0IGNsYXNzIE1vY2tQaXBlUmVzb2x2ZXIgZXh0ZW5kcyBQaXBlUmVzb2x2ZXIge1xuICBwcml2YXRlIF9waXBlcyA9IG5ldyBNYXA8Y29yZS5UeXBlLCBjb3JlLlBpcGU+KCk7XG5cbiAgY29uc3RydWN0b3IocmVmZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHtcbiAgICBzdXBlcihyZWZlY3Rvcik7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcnJpZGVzIHRoZSB7QGxpbmsgUGlwZX0gZm9yIGEgcGlwZS5cbiAgICovXG4gIHNldFBpcGUodHlwZTogY29yZS5UeXBlLCBtZXRhZGF0YTogY29yZS5QaXBlKTogdm9pZCB7XG4gICAgdGhpcy5fcGlwZXMuc2V0KHR5cGUsIG1ldGFkYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB7QGxpbmsgUGlwZX0gZm9yIGEgcGlwZTpcbiAgICogLSBTZXQgdGhlIHtAbGluayBQaXBlfSB0byB0aGUgb3ZlcnJpZGRlbiB2aWV3IHdoZW4gaXQgZXhpc3RzIG9yIGZhbGxiYWNrIHRvIHRoZVxuICAgKiBkZWZhdWx0XG4gICAqIGBQaXBlUmVzb2x2ZXJgLCBzZWUgYHNldFBpcGVgLlxuICAgKi9cbiAgcmVzb2x2ZSh0eXBlOiBjb3JlLlR5cGUsIHRocm93SWZOb3RGb3VuZCA9IHRydWUpOiBjb3JlLlBpcGUge1xuICAgIGxldCBtZXRhZGF0YSA9IHRoaXMuX3BpcGVzLmdldCh0eXBlKTtcbiAgICBpZiAoIW1ldGFkYXRhKSB7XG4gICAgICBtZXRhZGF0YSA9IHN1cGVyLnJlc29sdmUodHlwZSwgdGhyb3dJZk5vdEZvdW5kKSE7XG4gICAgfVxuICAgIHJldHVybiBtZXRhZGF0YTtcbiAgfVxufVxuIl19