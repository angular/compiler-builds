/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PipeResolver } from '@angular/compiler';
export class MockPipeResolver extends PipeResolver {
    constructor(refector) {
        super(refector);
        this._pipes = new Map();
    }
    /**
     * Overrides the {@link Pipe} for a pipe.
     */
    setPipe(type, metadata) {
        this._pipes.set(type, metadata);
    }
    /**
     * Returns the {@link Pipe} for a pipe:
     * - Set the {@link Pipe} to the overridden view when it exists or fallback to the
     * default
     * `PipeResolver`, see `setPipe`.
     */
    resolve(type, throwIfNotFound = true) {
        let metadata = this._pipes.get(type);
        if (!metadata) {
            metadata = super.resolve(type, throwIfNotFound);
        }
        return metadata;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZV9yZXNvbHZlcl9tb2NrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvdGVzdGluZy9zcmMvcGlwZV9yZXNvbHZlcl9tb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBeUIsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFdkUsTUFBTSxPQUFPLGdCQUFpQixTQUFRLFlBQVk7SUFHaEQsWUFBWSxRQUEwQjtRQUNwQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFIVixXQUFNLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFJakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTyxDQUFDLElBQWUsRUFBRSxRQUFtQjtRQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsT0FBTyxDQUFDLElBQWUsRUFBRSxlQUFlLEdBQUcsSUFBSTtRQUM3QyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2IsUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBRSxDQUFDO1NBQ2xEO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3IsIGNvcmUsIFBpcGVSZXNvbHZlcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuXG5leHBvcnQgY2xhc3MgTW9ja1BpcGVSZXNvbHZlciBleHRlbmRzIFBpcGVSZXNvbHZlciB7XG4gIHByaXZhdGUgX3BpcGVzID0gbmV3IE1hcDxjb3JlLlR5cGUsIGNvcmUuUGlwZT4oKTtcblxuICBjb25zdHJ1Y3RvcihyZWZlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcikge1xuICAgIHN1cGVyKHJlZmVjdG9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPdmVycmlkZXMgdGhlIHtAbGluayBQaXBlfSBmb3IgYSBwaXBlLlxuICAgKi9cbiAgc2V0UGlwZSh0eXBlOiBjb3JlLlR5cGUsIG1ldGFkYXRhOiBjb3JlLlBpcGUpOiB2b2lkIHtcbiAgICB0aGlzLl9waXBlcy5zZXQodHlwZSwgbWV0YWRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHtAbGluayBQaXBlfSBmb3IgYSBwaXBlOlxuICAgKiAtIFNldCB0aGUge0BsaW5rIFBpcGV9IHRvIHRoZSBvdmVycmlkZGVuIHZpZXcgd2hlbiBpdCBleGlzdHMgb3IgZmFsbGJhY2sgdG8gdGhlXG4gICAqIGRlZmF1bHRcbiAgICogYFBpcGVSZXNvbHZlcmAsIHNlZSBgc2V0UGlwZWAuXG4gICAqL1xuICByZXNvbHZlKHR5cGU6IGNvcmUuVHlwZSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6IGNvcmUuUGlwZSB7XG4gICAgbGV0IG1ldGFkYXRhID0gdGhpcy5fcGlwZXMuZ2V0KHR5cGUpO1xuICAgIGlmICghbWV0YWRhdGEpIHtcbiAgICAgIG1ldGFkYXRhID0gc3VwZXIucmVzb2x2ZSh0eXBlLCB0aHJvd0lmTm90Rm91bmQpITtcbiAgICB9XG4gICAgcmV0dXJuIG1ldGFkYXRhO1xuICB9XG59XG4iXX0=