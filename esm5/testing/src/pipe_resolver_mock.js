/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { PipeResolver } from '@angular/compiler';
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
    /**
       * Overrides the {@link Pipe} for a pipe.
       */
    MockPipeResolver.prototype.setPipe = /**
       * Overrides the {@link Pipe} for a pipe.
       */
    function (type, metadata) { this._pipes.set(type, metadata); };
    /**
     * Returns the {@link Pipe} for a pipe:
     * - Set the {@link Pipe} to the overridden view when it exists or fallback to the
     * default
     * `PipeResolver`, see `setPipe`.
     */
    /**
       * Returns the {@link Pipe} for a pipe:
       * - Set the {@link Pipe} to the overridden view when it exists or fallback to the
       * default
       * `PipeResolver`, see `setPipe`.
       */
    MockPipeResolver.prototype.resolve = /**
       * Returns the {@link Pipe} for a pipe:
       * - Set the {@link Pipe} to the overridden view when it exists or fallback to the
       * default
       * `PipeResolver`, see `setPipe`.
       */
    function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        var metadata = this._pipes.get(type);
        if (!metadata) {
            metadata = (_super.prototype.resolve.call(this, type, throwIfNotFound));
        }
        return metadata;
    };
    return MockPipeResolver;
}(PipeResolver));
export { MockPipeResolver };

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlcl9tb2NrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvdGVzdGluZy9zcmMvcGlwZV9yZXNvbHZlcl9tb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBUUEsT0FBTyxFQUFtQixZQUFZLEVBQU8sTUFBTSxtQkFBbUIsQ0FBQztBQUV2RSxJQUFBO0lBQXNDLDRDQUFZO0lBR2hELDBCQUFZLFFBQTBCO1FBQXRDLFlBQTBDLGtCQUFNLFFBQVEsQ0FBQyxTQUFHO3VCQUYzQyxJQUFJLEdBQUcsRUFBd0I7O0tBRVk7SUFFNUQ7O09BRUc7Ozs7SUFDSCxrQ0FBTzs7O0lBQVAsVUFBUSxJQUFlLEVBQUUsUUFBbUIsSUFBVSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTtJQUV4Rjs7Ozs7T0FLRzs7Ozs7OztJQUNILGtDQUFPOzs7Ozs7SUFBUCxVQUFRLElBQWUsRUFBRSxlQUFzQjtRQUF0QixnQ0FBQSxFQUFBLHNCQUFzQjtRQUM3QyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2IsUUFBUSxJQUFHLGlCQUFNLE9BQU8sWUFBQyxJQUFJLEVBQUUsZUFBZSxDQUFHLENBQUEsQ0FBQztTQUNuRDtRQUNELE9BQU8sUUFBUSxDQUFDO0tBQ2pCOzJCQWhDSDtFQVVzQyxZQUFZLEVBdUJqRCxDQUFBO0FBdkJELDRCQXVCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yLCBQaXBlUmVzb2x2ZXIsIGNvcmV9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcblxuZXhwb3J0IGNsYXNzIE1vY2tQaXBlUmVzb2x2ZXIgZXh0ZW5kcyBQaXBlUmVzb2x2ZXIge1xuICBwcml2YXRlIF9waXBlcyA9IG5ldyBNYXA8Y29yZS5UeXBlLCBjb3JlLlBpcGU+KCk7XG5cbiAgY29uc3RydWN0b3IocmVmZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHsgc3VwZXIocmVmZWN0b3IpOyB9XG5cbiAgLyoqXG4gICAqIE92ZXJyaWRlcyB0aGUge0BsaW5rIFBpcGV9IGZvciBhIHBpcGUuXG4gICAqL1xuICBzZXRQaXBlKHR5cGU6IGNvcmUuVHlwZSwgbWV0YWRhdGE6IGNvcmUuUGlwZSk6IHZvaWQgeyB0aGlzLl9waXBlcy5zZXQodHlwZSwgbWV0YWRhdGEpOyB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHtAbGluayBQaXBlfSBmb3IgYSBwaXBlOlxuICAgKiAtIFNldCB0aGUge0BsaW5rIFBpcGV9IHRvIHRoZSBvdmVycmlkZGVuIHZpZXcgd2hlbiBpdCBleGlzdHMgb3IgZmFsbGJhY2sgdG8gdGhlXG4gICAqIGRlZmF1bHRcbiAgICogYFBpcGVSZXNvbHZlcmAsIHNlZSBgc2V0UGlwZWAuXG4gICAqL1xuICByZXNvbHZlKHR5cGU6IGNvcmUuVHlwZSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6IGNvcmUuUGlwZSB7XG4gICAgbGV0IG1ldGFkYXRhID0gdGhpcy5fcGlwZXMuZ2V0KHR5cGUpO1xuICAgIGlmICghbWV0YWRhdGEpIHtcbiAgICAgIG1ldGFkYXRhID0gc3VwZXIucmVzb2x2ZSh0eXBlLCB0aHJvd0lmTm90Rm91bmQpICE7XG4gICAgfVxuICAgIHJldHVybiBtZXRhZGF0YTtcbiAgfVxufVxuIl19