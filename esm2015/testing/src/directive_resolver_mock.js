/**
 * @fileoverview added by tsickle
 * Generated from: packages/compiler/testing/src/directive_resolver_mock.ts
 * @suppress {checkTypes,constantProperty,extraRequire,missingOverride,missingReturn,unusedPrivateMembers,uselessCode} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DirectiveResolver } from '@angular/compiler';
/**
 * An implementation of {\@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
export class MockDirectiveResolver extends DirectiveResolver {
    /**
     * @param {?} reflector
     */
    constructor(reflector) {
        super(reflector);
        this._directives = new Map();
    }
    /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    resolve(type, throwIfNotFound = true) {
        return this._directives.get(type) || super.resolve(type, throwIfNotFound);
    }
    /**
     * Overrides the {\@link core.Directive} for a directive.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    setDirective(type, metadata) {
        this._directives.set(type, metadata);
    }
}
if (false) {
    /**
     * @type {?}
     * @private
     */
    MockDirectiveResolver.prototype._directives;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlX3Jlc29sdmVyX21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9kaXJlY3RpdmVfcmVzb2x2ZXJfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFPQSxPQUFPLEVBQW1CLGlCQUFpQixFQUFPLE1BQU0sbUJBQW1CLENBQUM7Ozs7O0FBTzVFLE1BQU0sT0FBTyxxQkFBc0IsU0FBUSxpQkFBaUI7Ozs7SUFHMUQsWUFBWSxTQUEyQjtRQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUZwRCxnQkFBVyxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO0lBRUUsQ0FBQzs7Ozs7O0lBSzlELE9BQU8sQ0FBQyxJQUFlLEVBQUUsZUFBZSxHQUFHLElBQUk7UUFDN0MsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztJQUM1RSxDQUFDOzs7Ozs7O0lBS0QsWUFBWSxDQUFDLElBQWUsRUFBRSxRQUF3QjtRQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdkMsQ0FBQztDQUNGOzs7Ozs7SUFqQkMsNENBQTJEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yLCBEaXJlY3RpdmVSZXNvbHZlciwgY29yZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuXG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2Yge0BsaW5rIERpcmVjdGl2ZVJlc29sdmVyfSB0aGF0IGFsbG93cyBvdmVycmlkaW5nXG4gKiB2YXJpb3VzIHByb3BlcnRpZXMgb2YgZGlyZWN0aXZlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vY2tEaXJlY3RpdmVSZXNvbHZlciBleHRlbmRzIERpcmVjdGl2ZVJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGlyZWN0aXZlcyA9IG5ldyBNYXA8Y29yZS5UeXBlLCBjb3JlLkRpcmVjdGl2ZT4oKTtcblxuICBjb25zdHJ1Y3RvcihyZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHsgc3VwZXIocmVmbGVjdG9yKTsgfVxuXG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlKTogY29yZS5EaXJlY3RpdmU7XG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlLCB0aHJvd0lmTm90Rm91bmQ6IHRydWUpOiBjb3JlLkRpcmVjdGl2ZTtcbiAgcmVzb2x2ZSh0eXBlOiBjb3JlLlR5cGUsIHRocm93SWZOb3RGb3VuZDogYm9vbGVhbik6IGNvcmUuRGlyZWN0aXZlfG51bGw7XG4gIHJlc29sdmUodHlwZTogY29yZS5UeXBlLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTogY29yZS5EaXJlY3RpdmV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2RpcmVjdGl2ZXMuZ2V0KHR5cGUpIHx8IHN1cGVyLnJlc29sdmUodHlwZSwgdGhyb3dJZk5vdEZvdW5kKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPdmVycmlkZXMgdGhlIHtAbGluayBjb3JlLkRpcmVjdGl2ZX0gZm9yIGEgZGlyZWN0aXZlLlxuICAgKi9cbiAgc2V0RGlyZWN0aXZlKHR5cGU6IGNvcmUuVHlwZSwgbWV0YWRhdGE6IGNvcmUuRGlyZWN0aXZlKTogdm9pZCB7XG4gICAgdGhpcy5fZGlyZWN0aXZlcy5zZXQodHlwZSwgbWV0YWRhdGEpO1xuICB9XG59XG4iXX0=