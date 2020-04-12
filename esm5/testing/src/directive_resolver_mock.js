import { __extends } from "tslib";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DirectiveResolver } from '@angular/compiler';
/**
 * An implementation of {@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
var MockDirectiveResolver = /** @class */ (function (_super) {
    __extends(MockDirectiveResolver, _super);
    function MockDirectiveResolver(reflector) {
        var _this = _super.call(this, reflector) || this;
        _this._directives = new Map();
        return _this;
    }
    MockDirectiveResolver.prototype.resolve = function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        return this._directives.get(type) || _super.prototype.resolve.call(this, type, throwIfNotFound);
    };
    /**
     * Overrides the {@link core.Directive} for a directive.
     */
    MockDirectiveResolver.prototype.setDirective = function (type, metadata) {
        this._directives.set(type, metadata);
    };
    return MockDirectiveResolver;
}(DirectiveResolver));
export { MockDirectiveResolver };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlX3Jlc29sdmVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9kaXJlY3RpdmVfcmVzb2x2ZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFtQixpQkFBaUIsRUFBTyxNQUFNLG1CQUFtQixDQUFDO0FBRzVFOzs7R0FHRztBQUNIO0lBQTJDLHlDQUFpQjtJQUcxRCwrQkFBWSxTQUEyQjtRQUF2QyxZQUEyQyxrQkFBTSxTQUFTLENBQUMsU0FBRztRQUZ0RCxpQkFBVyxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDOztJQUVFLENBQUM7SUFLOUQsdUNBQU8sR0FBUCxVQUFRLElBQWUsRUFBRSxlQUFzQjtRQUF0QixnQ0FBQSxFQUFBLHNCQUFzQjtRQUM3QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFNLE9BQU8sWUFBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsNENBQVksR0FBWixVQUFhLElBQWUsRUFBRSxRQUF3QjtRQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUNILDRCQUFDO0FBQUQsQ0FBQyxBQWxCRCxDQUEyQyxpQkFBaUIsR0FrQjNEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yLCBEaXJlY3RpdmVSZXNvbHZlciwgY29yZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuXG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2Yge0BsaW5rIERpcmVjdGl2ZVJlc29sdmVyfSB0aGF0IGFsbG93cyBvdmVycmlkaW5nXG4gKiB2YXJpb3VzIHByb3BlcnRpZXMgb2YgZGlyZWN0aXZlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vY2tEaXJlY3RpdmVSZXNvbHZlciBleHRlbmRzIERpcmVjdGl2ZVJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGlyZWN0aXZlcyA9IG5ldyBNYXA8Y29yZS5UeXBlLCBjb3JlLkRpcmVjdGl2ZT4oKTtcblxuICBjb25zdHJ1Y3RvcihyZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHsgc3VwZXIocmVmbGVjdG9yKTsgfVxuXG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlKTogY29yZS5EaXJlY3RpdmU7XG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlLCB0aHJvd0lmTm90Rm91bmQ6IHRydWUpOiBjb3JlLkRpcmVjdGl2ZTtcbiAgcmVzb2x2ZSh0eXBlOiBjb3JlLlR5cGUsIHRocm93SWZOb3RGb3VuZDogYm9vbGVhbik6IGNvcmUuRGlyZWN0aXZlfG51bGw7XG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTogY29yZS5EaXJlY3RpdmV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2RpcmVjdGl2ZXMuZ2V0KHR5cGUpIHx8IHN1cGVyLnJlc29sdmUodHlwZSwgdGhyb3dJZk5vdEZvdW5kKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPdmVycmlkZXMgdGhlIHtAbGluayBjb3JlLkRpcmVjdGl2ZX0gZm9yIGEgZGlyZWN0aXZlLlxuICAgKi9cbiAgc2V0RGlyZWN0aXZlKHR5cGU6IGNvcmUuVHlwZSwgbWV0YWRhdGE6IGNvcmUuRGlyZWN0aXZlKTogdm9pZCB7XG4gICAgdGhpcy5fZGlyZWN0aXZlcy5zZXQodHlwZSwgbWV0YWRhdGEpO1xuICB9XG59XG4iXX0=